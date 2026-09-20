import "server-only";
import {
  applyRelecture,
  getRelectureProjection,
  hasAiSolicitationForMessage,
  isAssistantEnabled,
  logAiSolicitation,
  logRelectureFailure,
  tenantDb,
  type RelectureProjection,
} from "@relvo/db";
import { expireTenantData } from "@/server/cached";
import { EchecSollicitation, extract } from "../client";
import { inferenceDisponible, NIVEAU_RETENU } from "../config";
import { contexteRelecture, prefixeStable } from "../contexte";
import { SortieRelecture } from "../schemas";
import { retenirRelecture, type CadreRelecture } from "./proposition";
import { entreesDuContexte } from "./structuration";

// LA RELECTURE EN PRODUCTION (M7, tranche 6 — M7.9, M7.11) : « Relvo suit
// l'affaire ». UN SEUL appel quand un message ENTRANT arrive sur un sujet
// suivi — capté au rangement par l'écoute du fil, rattaché par le tri, ou
// arrivé sur un sujet validé que la mécanique vient de rouvrir — ET quand le
// dirigeant ENVOIE une réponse depuis Relvo (retour du second essai réel,
// 2026-09-16 : la tâche se cochait, la fiche disait encore « valider le
// devis »). La correspondance tâche ↔ envoi et le marqueur « En attente »
// restent mécaniques (05 §3.2, §5.3) ; l'appel ne sert qu'à réécrire la
// situation. Le poste le plus fréquent du pipeline (05 §1) : son contexte est
// le plus borné.
//
// Ordre, et ce que chaque étape garantit :
//   1. Assistant actif, inférence joignable, idempotence PAR MESSAGE — sinon
//      rien.
//   2. Projection depuis la base, par le domaine (`getRelectureProjection`) :
//      la fiche bornée aux messages antérieurs, le message nouveau à part, les
//      précédents, la réouverture constatée. Un sujet qui n'est pas ouvert
//      n'est pas relu — la réouverture est mécanique et a déjà eu lieu, ou
//      n'a pas lieu d'être (05 §5.2).
//   3. Appel de relecture, sortie conforme au schéma ; consigné AVANT d'être
//      exploité.
//   4. Retenue (`./proposition`, module pur) : tâches sans doublon avec les
//      ouvertes, plafond, dates, provenances ; tâches OBSOLÈTES seulement par
//      leur titre exact dans la fiche ; la clôture n'est suggérée que sans
//      tâche ouverte ; « En attente » seulement avec un objet.
//   5. Écriture par le domaine (`applyRelecture`) : situation, résumé,
//      tâches, étiquettes, priorité, attente, suggestion de clôture, journal
//      avec la proposition intégrale.
//   6. Cache de données invalidé (PITFALLS.md #45).
//
// UN ÉCHEC LAISSE LE SUJET TEL QU'IL ÉTAIT — le message est rangé et lisible,
// la situation d'avant reste vraie — et n'invente rien (M7.15) : journalisé,
// jamais remonté à l'appelant.

export type IssueRelecture =
  | "desactive"
  | "inference-indisponible"
  | "deja-relu"
  | "sujet-non-ouvert"
  | "relu"
  | "echec";

export type ResultatRelecture = {
  issue: IssueRelecture;
  detail?: string;
  /** Tâches ajoutées, pour la ligne de journal serveur. */
  taches?: number;
};

/** Le cadre de retenue, depuis la projection : ce que le modèle a eu sous les yeux, et l'état du sujet. */
export function cadreDeRelecture(p: RelectureProjection): CadreRelecture {
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
    tachesOuvertes: p.sujet.taches
      .filter((t) => !t.terminee)
      .map((t) => t.titre),
    resolutionSuggeree: p.sujet.resolutionSuggeree,
  };
}

export async function relireSujet(args: {
  accountId: string;
  subjectId: string;
  /** Le message — reçu ou envoyé — qui déclenche la relecture ; clé de l'idempotence. */
  messageId: string;
}): Promise<ResultatRelecture> {
  const { accountId, subjectId, messageId } = args;
  const db = tenantDb(accountId);

  if (!inferenceDisponible()) return { issue: "inference-indisponible" };
  if (!(await isAssistantEnabled(db, accountId))) return { issue: "desactive" };
  if (await hasAiSolicitationForMessage(db, messageId, "relecture")) {
    return { issue: "deja-relu" };
  }

  try {
    const projection = await getRelectureProjection(db, {
      subjectId,
      messageId,
    });
    if (projection.sujet.statut !== "ouvert") {
      return { issue: "sujet-non-ouvert", detail: projection.sujet.statut };
    }
    const entrees = entreesDuContexte(projection);
    const contexte = contexteRelecture({
      compte: projection.compte,
      domaine: entrees.domaine,
      sujet: entrees.sujet,
      precedents: entrees.precedents,
      nouveauxMessages: projection.nouveauxMessages,
      rouvert: projection.rouvert,
      instant: { maintenant: new Date().toISOString() },
    });
    const { sortie, mesure } = await extract({
      sollicitation: "relecture",
      schema: SortieRelecture,
      nomSchema: "relecture_du_sujet",
      system: contexte.system,
      prompt: contexte.prompt,
      reasoning: NIVEAU_RETENU.extraction,
      cacheCle: accountId,
      prefixeStable: prefixeStable(contexte),
    });
    await logAiSolicitation(db, { ...mesure, subjectId, messageId });

    const retenue = retenirRelecture(sortie, cadreDeRelecture(projection));
    const applied = await applyRelecture(db, {
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
      completedTasks: retenue.tachesTerminees.map((t) => ({
        title: t.titre,
        reason: t.raison,
      })),
      obsoleteTasks: retenue.tachesObsoletes.map((t) => ({
        title: t.titre,
        reason: t.raison,
      })),
      labels: retenue.etiquettes,
      priority: retenue.priorite,
      waitingForReply: retenue.enAttente,
      resolution:
        retenue.resolution === "suggerer"
          ? "suggest"
          : retenue.resolution === "revoquer"
            ? "revoke"
            : "keep",
      reason: retenue.raison,
      // La proposition intégrale et ce qui en a été écarté : ce que M17
      // relira (05 §9.1).
      proposal: { sortie, ecarts: retenue.ecarts, rouvert: projection.rouvert },
    });
    expireTenantData();
    return {
      issue: "relu",
      detail: `${projection.sujet.reference} · ${applied.resolution}${applied.waitingForReplySet ? " · en attente" : ""}${applied.priorityChanged ? " · priorité" : ""}${applied.completedTaskIds.length ? ` · ${applied.completedTaskIds.length} cochée(s)` : ""}${applied.retiredTaskIds.length ? ` · ${applied.retiredTaskIds.length} retirée(s)` : ""}`,
      taches: applied.taskIds.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[ia] relecture interrompue",
      { subjectId, messageId },
      message,
    );
    try {
      const echec = err instanceof EchecSollicitation ? err : null;
      if (echec?.mesure) {
        await logAiSolicitation(db, { ...echec.mesure, subjectId, messageId });
      }
      await logRelectureFailure(db, {
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
