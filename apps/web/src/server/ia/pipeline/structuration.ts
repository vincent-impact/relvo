import "server-only";
import {
  applyStructuration,
  getStructurationProjection,
  hasAiSolicitationForSubject,
  isAssistantEnabled,
  logAiSolicitation,
  logStructurationFailure,
  tenantDb,
  type StructurationProjection,
} from "@relvo/db";
import { expireTenantData } from "@/server/cached";
import { EchecSollicitation, extract } from "../client";
import { inferenceDisponible, NIVEAU_RETENU } from "../config";
import {
  contexteStructuration,
  extraireSignature,
  ficheCloture,
  prefixeStable,
  type ContactContexte,
  type DomaineContexte,
  type Precedent,
  type SujetContexte,
} from "../contexte";
import { SortieStructuration } from "../schemas";
import { retenirProposition, type CadreRetenue } from "./proposition";

// LA STRUCTURATION EN PRODUCTION (M7, tranche 5 — M7.6, M7.18, M7.20) :
// « le sujet arrive avec ses tâches et sa date ». Le SECOND appel, enchaîné par
// le tri quand un sujet vient d'être ouvert, une fois par sujet. Il charge
// tout — le domaine et ses connaissances, la fiche du sujet, celle du contact,
// les précédents —, rédige la situation structurée et le résumé, déduit les
// tâches avec leur raison et leur provenance, complète le contact.
//
// Ordre, et ce que chaque étape garantit :
//   1. Assistant actif, inférence joignable, idempotence par sujet — sinon rien.
//   2. Projection depuis la base, par le domaine (`getStructurationProjection`) ;
//      les fiches de clôture des précédents proches sont fabriquées ici, sans
//      appel (`ficheCloture`).
//   3. Appel de structuration, sortie conforme au schéma ; consigné AVANT
//      d'être exploité.
//   4. Retenue de la proposition (`./proposition`, module pur) : plafonds,
//      dates conformes, provenances résolues, étiquettes du registre.
//   5. Écriture par le domaine (`applyStructuration`) : situation, résumé,
//      tâches par la primitive, contact selon son statut, journal avec la
//      proposition intégrale.
//   6. Cache de données invalidé (PITFALLS.md #45).
//
// UN ÉCHEC LAISSE LE SUJET TEL QUE LE TRI L'A OUVERT — titré, classé, sans
// tâche — et n'invente rien (M7.15) : journalisé, jamais remonté au tri.

export type IssueStructuration =
  | "desactive"
  | "inference-indisponible"
  | "deja-structure"
  | "structure"
  | "echec";

export type ResultatStructuration = {
  issue: IssueStructuration;
  detail?: string;
  /** Tâches créées, pour la ligne de journal serveur. */
  taches?: number;
};

/** Le cadre de retenue, depuis la projection : ce que le modèle a eu sous les yeux. */
export function cadreDeRetenue(p: StructurationProjection): CadreRetenue {
  return {
    registre: p.compte.etiquettes,
    precedents: p.precedents.map((x) => ({
      reference: x.reference,
      titre: x.titre,
    })),
    instructions: [
      ...p.compte.instructionsGenerales.map((i) => i.titre),
      ...(p.domaine?.instructions.map((i) => i.titre) ?? []),
    ],
    documents: p.domaine?.documents.map((d) => d.nom) ?? [],
    domaineConnu: p.sujet.folderId !== null,
    domaineProposeExistant: p.sujet.proposedFolder,
    contact: p.contact ? p.contact.statut : "aucun",
  };
}

/** Les entrées du profil « structuration », depuis la projection. */
export function entreesDuContexte(p: StructurationProjection): {
  domaine: DomaineContexte | null;
  sujet: SujetContexte;
  contact: ContactContexte | null;
  precedents: Precedent[];
} {
  return {
    domaine: p.domaine
      ? {
          nom: p.domaine.nom,
          description: p.domaine.description,
          instructions: p.domaine.instructions,
          documents: p.domaine.documents,
        }
      : null,
    sujet: {
      reference: p.sujet.reference,
      titre: p.sujet.titre,
      domaine: p.sujet.domaine,
      etiquettes: p.sujet.etiquettes,
      statut: p.sujet.statut,
      priorite: p.sujet.priorite,
      enAttente: p.sujet.enAttente,
      resolutionSuggeree: p.sujet.resolutionSuggeree,
      ouvertLe: p.sujet.ouvertLe,
      situation: p.sujet.situation,
      resume: p.sujet.resume,
      taches: p.sujet.taches,
      contacts: p.sujet.contacts,
      messages: p.sujet.messages,
    },
    contact: p.contact
      ? {
          nom: p.contact.nom,
          aCompleter: p.contact.statut === "auto" || p.contact.nomProvisoire,
          // La signature que l'hygiène retire du fil : c'est là que sont le
          // nom, l'entreprise et le téléphone d'un contact à compléter.
          signature:
            p.contact.statut === "auto"
              ? extraireSignature(
                  [...p.sujet.messages]
                    .reverse()
                    .find((m) => m.sens === "entrant")?.contenu ?? "",
                )
              : null,
          entreprise: p.contact.entreprise,
          role: p.contact.role,
          noteRelvo: p.contact.noteRelvo,
          domaineHabituel: p.contact.domaineHabituel,
          delaiReponseJours: p.contact.delaiReponseJours,
          sujetsOuverts: p.contact.sujetsOuverts,
          derniersValides: p.contact.derniersValides,
          antecedentsTri: p.contact.antecedentsTri,
        }
      : null,
    precedents: p.precedents.map((x) => ({
      reference: x.reference,
      titre: x.titre,
      fiche: x.clos ? ficheCloture(x.clos) : null,
    })),
  };
}

export async function structurerSujet(args: {
  accountId: string;
  subjectId: string;
  /** Le message dont le tri a ouvert le sujet — rattaché aux tâches et au journal. */
  messageId: string | null;
}): Promise<ResultatStructuration> {
  const { accountId, subjectId, messageId } = args;
  const db = tenantDb(accountId);

  if (!inferenceDisponible()) return { issue: "inference-indisponible" };
  if (!(await isAssistantEnabled(db, accountId))) return { issue: "desactive" };
  if (await hasAiSolicitationForSubject(db, subjectId, "structuration")) {
    return { issue: "deja-structure" };
  }

  try {
    const projection = await getStructurationProjection(db, subjectId);
    const contexte = contexteStructuration({
      compte: projection.compte,
      ...entreesDuContexte(projection),
      instant: { maintenant: new Date().toISOString() },
    });
    const { sortie, mesure } = await extract({
      sollicitation: "structuration",
      schema: SortieStructuration,
      nomSchema: "structuration_du_sujet",
      system: contexte.system,
      prompt: contexte.prompt,
      reasoning: NIVEAU_RETENU.extraction,
      cacheCle: accountId,
      prefixeStable: prefixeStable(contexte),
    });
    await logAiSolicitation(db, { ...mesure, subjectId, messageId });

    const retenue = retenirProposition(sortie, cadreDeRetenue(projection));
    const applied = await applyStructuration(db, {
      subjectId,
      messageId,
      situation: {
        where: retenue.situation.ouOnEnEst,
        nextStep: retenue.situation.prochaineEtape,
        waitingFor: retenue.situation.attente,
        deadline: retenue.situation.echeance,
      },
      summary: retenue.resume,
      tasks: retenue.taches.map((t) => ({
        title: t.titre,
        kind: t.type,
        startDate: t.date,
        startTime: t.heure,
        endDate: t.dateFin,
        endTime: t.heureFin,
        reason: t.raison,
        provenance: t.provenance,
        decisions: t.decisions,
      })),
      contact: retenue.contact
        ? {
            firstName: retenue.contact.prenom,
            lastName: retenue.contact.nom,
            company: retenue.contact.entreprise,
            role: retenue.contact.role,
            phone: retenue.contact.telephone,
            email: retenue.contact.email,
          }
        : null,
      labels: retenue.etiquettes,
      proposedFolder: retenue.domainePropose,
      // La proposition intégrale — étiquette nouvelle, questions et écarts
      // compris : ce que M17 relira (05 §9.1).
      proposal: {
        sortie,
        etiquetteNouvelle: retenue.etiquetteNouvelle,
        questions: retenue.questions,
        ecarts: retenue.ecarts,
      },
    });
    expireTenantData();
    return {
      issue: "structure",
      detail: projection.sujet.reference,
      taches: applied.taskIds.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[ia] structuration interrompue",
      { subjectId, messageId },
      message,
    );
    try {
      const echec = err instanceof EchecSollicitation ? err : null;
      if (echec?.mesure) {
        await logAiSolicitation(db, { ...echec.mesure, subjectId, messageId });
      }
      await logStructurationFailure(db, {
        subjectId,
        messageId,
        error: message,
        cause: echec?.motif ?? null,
      });
    } catch (e) {
      console.error("[ia] échec non journalisé", e);
    }
    expireTenantData();
    return { issue: "echec", detail: message };
  }
}
