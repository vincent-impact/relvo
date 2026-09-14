import "server-only";
import {
  applyTriageMatter,
  getTriageProjection,
  hasAiSolicitationForMessage,
  isAutoTriageEnabled,
  logAiSolicitation,
  logTriageFailure,
  recordTriageVerdict,
  tenantDb,
} from "@relvo/db";
import { expireTenantData } from "@/server/cached";
import { extract } from "../client";
import { inferenceDisponible, NIVEAU_RETENU } from "../config";
import { contexteTri } from "../contexte";
import { SortieTri } from "../schemas";
import { detecterBruitDeterministe } from "./bruit";
import { deciderTri, verdictEnBase } from "./decision";

// LE TRI EN PRODUCTION (M7, tranche 4 — M7.1, M7.4, M7.5, M7.14 à M7.16) :
// « un e-mail entrant devient un sujet titré et classé ». Déclenché par le
// webhook APRÈS sa réponse HTTP, une fois par message, sur une conversation
// orpheline. E-mail seul ; WhatsApp attend.
//
// Ordre, et ce que chaque étape garantit :
//   1. Interrupteur par compte, inférence joignable, idempotence — sinon rien.
//   2. Projection depuis la base, par le domaine (`getTriageProjection`).
//   3. Filtre déterministe du bruit : verdict sans appel, zéro jeton (05 §9.5).
//   4. Appel de tri, sortie conforme au schéma ; l'appel est consigné AVANT
//      d'être exploité — un coût est un coût, même si la suite échoue.
//   5. Verdict, confiance et raison écrits sur la conversation ; sous la
//      frontière de confiance, rien d'autre (05 §1.1).
//   6. Ouverture ou rattachement par les primitives du domaine.
//   7. Cache de données invalidé après toute écriture (PITFALLS.md #45).
//
// UN ÉCHEC LAISSE LA CONVERSATION ORPHELINE, il n'invente rien (M7.15) : le
// message est déjà rangé et lisible, l'utilisateur peut trier à la main, et
// l'échec est journalisé.

export type IssueTri =
  | "desactive"
  | "inference-indisponible"
  | "deja-traite"
  | "canal-non-couvert"
  | "non-orpheline"
  | "sans-message-entrant"
  | "bruit-deterministe"
  | "verdict-seul"
  | "ouvert"
  | "rattache"
  | "echec";

export type ResultatTri = { issue: IssueTri; detail?: string };

export async function trierConversationEmail(args: {
  accountId: string;
  conversationId: string;
  /** Le message entrant qui déclenche le tri — clé de l'idempotence. */
  messageId: string;
  /** En-têtes de l'e-mail, clés en minuscules, si le transport les fournit. */
  entetes?: Record<string, string>;
}): Promise<ResultatTri> {
  const { accountId, conversationId, messageId } = args;
  const db = tenantDb(accountId);

  if (!inferenceDisponible()) return { issue: "inference-indisponible" };
  if (!(await isAutoTriageEnabled(db, accountId)))
    return { issue: "desactive" };
  if (await hasAiSolicitationForMessage(db, messageId, "tri")) {
    return { issue: "deja-traite" };
  }

  const projection = await getTriageProjection(db, conversationId);
  if (projection.type !== "email_subject")
    return { issue: "canal-non-couvert" };
  if (!projection.orpheline) return { issue: "non-orpheline" };
  const entrant = projection.dernierEntrant;
  if (!entrant) return { issue: "sans-message-entrant" };

  try {
    const bruit = detecterBruitDeterministe({
      adresse: entrant.adresse,
      nom: entrant.nom,
      objet: entrant.objet,
      contenu: entrant.contenu,
      entetes: args.entetes,
    });
    if (bruit) {
      await recordTriageVerdict(db, {
        conversationId,
        messageId,
        verdict: "noise",
        noiseReason: bruit.categorie,
        confidence: "high",
        reason: bruit.raison,
        source: "deterministic",
        rule: bruit.regle,
      });
      expireTenantData();
      return { issue: "bruit-deterministe", detail: bruit.regle };
    }

    const { system, prompt } = contexteTri({
      compte: projection.compte,
      conversation: projection.conversation,
      instant: { maintenant: new Date().toISOString() },
    });
    const { sortie, mesure } = await extract({
      sollicitation: "tri",
      schema: SortieTri,
      nomSchema: "verdict_de_tri",
      system,
      prompt,
      reasoning: NIVEAU_RETENU.extraction,
    });
    await logAiSolicitation(db, { ...mesure, messageId, conversationId });

    await recordTriageVerdict(db, {
      conversationId,
      messageId,
      ...verdictEnBase(sortie),
      source: "model",
      proposal: sortie,
    });

    const decision = deciderTri(sortie);
    if (decision.type === "verdict-seul") {
      expireTenantData();
      return { issue: "verdict-seul", detail: decision.motif };
    }

    const applied = await applyTriageMatter(db, {
      conversationId,
      messageId,
      title: decision.titre,
      folderName: decision.domaine,
      proposedFolder: decision.domainePropose,
      existingSubjectReference: decision.sujetExistant,
      priority: decision.priorite,
    });
    expireTenantData();
    return {
      issue: applied.action === "opened" ? "ouvert" : "rattache",
      detail: applied.reference,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[ia] tri interrompu",
      { conversationId, messageId },
      message,
    );
    try {
      await logTriageFailure(db, { conversationId, messageId, error: message });
    } catch (e) {
      console.error("[ia] échec non journalisé", e);
    }
    expireTenantData();
    return { issue: "echec", detail: message };
  }
}
