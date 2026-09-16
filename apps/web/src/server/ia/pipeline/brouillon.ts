import "server-only";
import {
  cancelAction,
  createDraftReply,
  getDraftProjection,
  isAssistantEnabled,
  logAiSolicitation,
  tenantDb,
  type DraftProjection,
} from "@relvo/db";
import { expireTenantData } from "@/server/cached";
import { draft } from "../client";
import { inferenceDisponible, NIVEAU_RETENU } from "../config";
import { contexteBrouillon } from "../contexte";
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
//   3. Appel de rédaction (tier rédaction), consigné.
//   4. Le brouillon devient une Action « envoi de message », ouverte, sur la
//      tâche ; c'est l'envoi qui la clôt (`applyOutgoingMatch`).

export type IssueBrouillon =
  | "desactive"
  | "inference-indisponible"
  | "decisions-en-attente"
  | "reutilise"
  | "redige"
  | "echec";

export type ResultatBrouillon =
  | { issue: "redige" | "reutilise"; actionId: string; contenu: string }
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

  try {
    const projection: DraftProjection = await getDraftProjection(db, taskId);
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
      };
    }
    if (projection.brouillonOuvert && args.regenerer) {
      await cancelAction(db, projection.brouillonOuvert.id);
    }

    const { system, prompt } = contexteBrouillon({
      compte: projection.compte,
      ...entreesDuContexte({ ...projection, precedents: [] }),
      tache: projection.tache,
      instant: { maintenant: new Date().toISOString() },
    });
    const { sortie, mesure } = await draft({
      sollicitation: "brouillon",
      system,
      prompt,
      reasoning: NIVEAU_RETENU.redaction,
    });
    await logAiSolicitation(db, {
      ...mesure,
      subjectId: projection.sujet.id,
      conversationId: projection.cible.conversationId,
    });

    const contenu = nettoyerBrouillon(sortie);
    const action = await createDraftReply(db, {
      subjectId: projection.sujet.id,
      taskId,
      to: projection.cible.destinataires.join(", ") || "—",
      channel: projection.cible.canal,
      content: contenu,
      title: projection.tache.titre,
      conversationId: projection.cible.conversationId,
    });
    expireTenantData();
    return { issue: "redige", actionId: action.id, contenu };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ia] brouillon interrompu", { taskId }, message);
    return { issue: "echec", detail: message };
  }
}
