import "server-only";
import {
  cancelAction,
  createDraftReply,
  getDraftProjection,
  isAssistantEnabled,
  logAiSolicitation,
  tenantDb,
  type DraftProjection,
  type TaskProvenance,
} from "@relvo/db";
import { expireTenantData } from "@/server/cached";
import { draft, EchecSollicitation } from "../client";
import { inferenceDisponible, NIVEAU_RETENU } from "../config";
import { contexteBrouillon, prefixeStable } from "../contexte";
import { SortieBrouillon } from "../schemas";
import { retenirSources } from "./proposition";
import { entreesDuContexte } from "./structuration";

// LE BROUILLON DE RÉPONSE (M7, tranche 7 — M7.7) : « le sujet arrive avec un
// brouillon prêt ». Rédigé À L'APPUI sur « Répondre » depuis une tâche, dans
// le fil où elle se répond — jamais à la création de la tâche, et jamais
// envoyé seul (05 §3.1, §7.4). Un brouillon ouvert est réutilisé ; « régénérer »
// l'annule et en rédige un autre.
//
//   1. Assistant actif, inférence joignable, et AUCUNE décision de la tâche
//      sans réponse — sinon rien : le composer reste vide (05 §3.1).
//   2. Projection depuis la base (`getDraftProjection`) : la fiche du sujet et
//      du contact, la tâche, le fil cible, le brouillon ouvert s'il existe.
//   3. Appel de rédaction (tier rédaction), sortie structurée : le texte ET
//      ses CITATIONS (`SortieBrouillon`, 05 §10.4 — tranche 8), consigné.
//   4. Les sources sont RÉSOLUES contre ce que le modèle a lu — instructions,
//      documents, précédents — par la retenue (`retenirSources`) ; une source
//      inconnue n'est jamais une citation.
//   5. Le brouillon devient une Action « envoi de message », ouverte, sur la
//      tâche, ses sources dans le payload ; c'est l'envoi qui la clôt
//      (`applyOutgoingMatch`). Le composer affiche « Basé sur : … ».
//
// Un échec ne rédige rien (M7.15) : le composer reste libre d'écrire soi-même.
// Un appel raté a coûté ses jetons : il est consigné comme les autres.

export type IssueBrouillon =
  | "desactive"
  | "inference-indisponible"
  | "decisions-en-attente"
  | "reutilise"
  | "redige"
  | "echec";

export type ResultatBrouillon =
  | {
      issue: "redige" | "reutilise";
      actionId: string;
      contenu: string;
      /** Les sources en clair, pour l'encart « Basé sur » du composer. */
      sources: string[];
    }
  | {
      issue:
        | "desactive"
        | "inference-indisponible"
        | "decisions-en-attente"
        | "echec";
      detail?: string;
    };

/** Le brouillon, tel qu'il part au composer : texte seul, sans objet ni signature. */
function nettoyerBrouillon(texte: string): string {
  return texte.replace(/^\s*(Objet|Subject)\s*:.*\n+/i, "").trim();
}

/** Une source en clair — ce que le composer montre sous « Basé sur ». */
export function libelleSource(p: TaskProvenance): string {
  return p.type === "precedent" && p.reference
    ? `${p.reference} · ${p.libelle}`
    : p.libelle;
}

export async function preparerBrouillon(args: {
  accountId: string;
  taskId: string;
  /** Annule le brouillon ouvert et en rédige un nouveau. */
  regenerer?: boolean;
}): Promise<ResultatBrouillon> {
  const { accountId, taskId } = args;
  const db = tenantDb(accountId);

  if (!inferenceDisponible()) return { issue: "inference-indisponible" };
  if (!(await isAssistantEnabled(db, accountId))) return { issue: "desactive" };

  let projection: DraftProjection | null = null;
  try {
    projection = await getDraftProjection(db, taskId);
    // Une décision sans réponse : Relvo ne rédige pas (05 §3.1). Le formulaire
    // de la conversation la pose ; le composer reste libre d'écrire soi-même.
    if (projection.tache.decisions?.some((d) => !d.reponse)) {
      return { issue: "decisions-en-attente" };
    }
    if (projection.brouillonOuvert && !args.regenerer) {
      return {
        issue: "reutilise",
        actionId: projection.brouillonOuvert.id,
        contenu: projection.brouillonOuvert.contenu,
        sources: projection.brouillonOuvert.sources.map(libelleSource),
      };
    }
    if (projection.brouillonOuvert && args.regenerer) {
      await cancelAction(db, projection.brouillonOuvert.id);
    }

    const entrees = entreesDuContexte({ ...projection, precedents: [] });
    const contexte = contexteBrouillon({
      compte: projection.compte,
      ...entrees,
      tache: projection.tache,
      instant: { maintenant: new Date().toISOString() },
    });
    const { sortie, mesure } = await draft({
      sollicitation: "brouillon",
      schema: SortieBrouillon,
      nomSchema: "brouillon_de_reponse",
      system: contexte.system,
      prompt: contexte.prompt,
      reasoning: NIVEAU_RETENU.redaction,
      cacheCle: accountId,
      prefixeStable: prefixeStable(contexte),
    });
    await logAiSolicitation(db, {
      ...mesure,
      subjectId: projection.sujet.id,
      conversationId: projection.cible.conversationId,
    });

    // Les citations, résolues contre ce que le modèle a eu sous les yeux.
    const ecarts: string[] = [];
    const sources = retenirSources(
      sortie.sources,
      {
        precedents: [],
        instructions: [
          ...projection.compte.instructionsGenerales.map((i) => i.titre),
          ...(projection.domaine?.instructions.map((i) => i.titre) ?? []),
        ],
        documents: projection.domaine?.documents.map((d) => d.nom) ?? [],
      },
      ecarts,
    );
    if (ecarts.length) {
      console.info("[ia] brouillon : sources écartées", { taskId }, ecarts);
    }

    const contenu = nettoyerBrouillon(sortie.texte);
    const action = await createDraftReply(db, {
      subjectId: projection.sujet.id,
      taskId,
      to: projection.cible.destinataires.join(", ") || "—",
      channel: projection.cible.canal,
      content: contenu,
      title: projection.tache.titre,
      conversationId: projection.cible.conversationId,
      sources: sources.filter(
        (s): s is TaskProvenance & { type: TaskProvenance["type"] } =>
          s.type !== "autre",
      ),
    });
    expireTenantData();
    return {
      issue: "redige",
      actionId: action.id,
      contenu,
      sources: sources.map(libelleSource),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ia] brouillon interrompu", { taskId }, message);
    // Un appel raté a coûté ses jetons (tranche 8) : consigné, en dehors du
    // chemin nominal — si le journal échoue aussi, l'issue reste « echec ».
    const echec = err instanceof EchecSollicitation ? err : null;
    if (echec?.mesure && projection) {
      await logAiSolicitation(db, {
        ...echec.mesure,
        subjectId: projection.sujet.id,
        conversationId: projection.cible.conversationId,
      }).catch((e) => console.error("[ia] échec non journalisé", e));
    }
    return {
      issue: "echec",
      detail: echec ? `${echec.motif} — ${message}` : message,
    };
  }
}
