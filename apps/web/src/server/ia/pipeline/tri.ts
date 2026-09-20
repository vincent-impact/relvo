import "server-only";
import {
  IGNORE_REASON_OF_NATURE,
  applyTriageMatter,
  getTriageProjection,
  hasAiSolicitationForMessage,
  ignoreConversation,
  isAssistantEnabled,
  logAiSolicitation,
  logTriageFailure,
  recordTriageVerdict,
  tenantDb,
} from "@relvo/db";
import { expireTenantData } from "@/server/cached";
import { EchecSollicitation, extract } from "../client";
import { inferenceDisponible, NIVEAU_RETENU } from "../config";
import { contexteTri, prefixeStable } from "../contexte";
import { SortieTri } from "../schemas";
import { detecterBruitDeterministe, signauxAutomatiques } from "./bruit";
import { NATURE_DE_LA_RAISON, deciderParExpediteur } from "./expediteur";
import {
  NATURE_EN_BASE,
  avisEnBase,
  deciderTri,
  type Nature,
} from "./decision";
import { relireSujet, type IssueRelecture } from "./relecture";
import { structurerSujet, type IssueStructuration } from "./structuration";

// LE TRI EN PRODUCTION (M7, tranche 4 — M7.1, M7.4, M7.5, M7.14 à M7.16) :
// « un e-mail entrant devient un sujet titré et classé ». Déclenché par le
// webhook APRÈS sa réponse HTTP, une fois par message, sur une conversation
// orpheline. E-mail seul ; WhatsApp attend.
//
// Ordre, et ce que chaque étape garantit :
//   1. Assistant actif sur le compte, inférence joignable, idempotence — sinon rien.
//   2. Projection depuis la base, par le domaine (`getTriageProjection`).
//   3. Filtre déterministe de la publicité : avis sans appel, zéro jeton
//      (05 §9.5), et la source est mise en sourdine — la règle est sûre. Les
//      signaux d'automate, eux, sont relevés et poussés au modèle.
//   3 bis. Ce que l'EXPÉDITEUR décide sans appel (`./expediteur`) : une source
//      déjà écartée est mise en sourdine ; un contact connu dont le seul sujet
//      ouvert attend sa réponse est rattaché. Sinon, son profil part au modèle.
//   4. Appel de tri, sortie conforme au schéma ; l'appel est consigné AVANT
//      d'être exploité — un coût est un coût, même si la suite échoue.
//   5. Action, nature, confiance et raison écrites sur la conversation. Puis
//      la décision (`./decision`) : le rattachement prime ; « à traiter »
//      au-dessus de la frontière ouvre ; « rien à faire » en confiance haute
//      fait taire ; sinon l'avis seul (05 §1.1, §1.2, §9.5).
//   6. Ouverture ou rattachement par les primitives du domaine.
//   7. Cache de données invalidé après toute écriture (PITFALLS.md #45).
//   8. Un sujet OUVERT enchaîne sur la STRUCTURATION (`./structuration`,
//      tranche 5) : le second appel, qui apporte les tâches et la date. Son
//      échec ne défait pas l'ouverture — le sujet reste, sans tâche. Un fil
//      RATTACHÉ à un sujet existant — par le modèle ou par la règle de
//      l'expéditeur — enchaîne sur la RELECTURE (`./relecture`, tranche 6) :
//      le sujet qui attendait ce message doit lire ce qu'il dit.
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
  | "source-ecartee"
  | "sujet-en-attente"
  | "ignore"
  | "avis-seul"
  | "ouvert"
  | "rattache"
  | "echec";

export type ResultatTri = {
  issue: IssueTri;
  detail?: string;
  /** Ce qu'a donné la structuration, quand un sujet a été ouvert. */
  structuration?: IssueStructuration;
  /** Ce qu'a donné la relecture, quand le fil a été rattaché à un sujet existant. */
  relecture?: IssueRelecture;
  /** Tâches déduites par la structuration. */
  taches?: number;
};

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
  if (!(await isAssistantEnabled(db, accountId))) return { issue: "desactive" };
  if (await hasAiSolicitationForMessage(db, messageId, "tri")) {
    return { issue: "deja-traite" };
  }

  const projection = await getTriageProjection(db, conversationId);
  if (projection.type !== "email_subject")
    return { issue: "canal-non-couvert" };
  if (!projection.orpheline) return { issue: "non-orpheline" };
  const entrant = projection.dernierEntrant;
  if (!entrant) return { issue: "sans-message-entrant" };

  // Faire taire la source sur un « rien à faire » sûr (05 §9.5) : la nature
  // donne la raison d'ignorance, la phrase de Relvo la note. Réversible d'un
  // appui dans le filtre « Ignorées ».
  const ignorer = (nature: Nature, raison: string) =>
    ignoreConversation(db, conversationId, {
      reason: IGNORE_REASON_OF_NATURE[NATURE_EN_BASE[nature]],
      note: raison,
      actor: "ai",
    });

  const entree = {
    adresse: entrant.adresse,
    nom: entrant.nom,
    objet: entrant.objet,
    contenu: entrant.contenu,
    entetes: args.entetes,
  };

  try {
    const bruit = detecterBruitDeterministe(entree);
    if (bruit) {
      await recordTriageVerdict(db, {
        conversationId,
        messageId,
        verdict: "noise",
        nature: NATURE_EN_BASE[bruit.nature],
        confidence: "high",
        reason: bruit.raison,
        source: "deterministic",
        rule: bruit.regle,
      });
      await ignorer(bruit.nature, bruit.raison);
      expireTenantData();
      return { issue: "bruit-deterministe", detail: bruit.regle };
    }

    const parExpediteur = deciderParExpediteur(projection.expediteur);
    if (parExpediteur?.type === "ignorer") {
      const nature = NATURE_DE_LA_RAISON[parExpediteur.raison] ?? "publicite";
      const raison = `Cette adresse a déjà été écartée ${parExpediteur.nombre} fois pour la même raison.`;
      await recordTriageVerdict(db, {
        conversationId,
        messageId,
        verdict: "noise",
        nature: NATURE_EN_BASE[nature],
        confidence: "high",
        reason: raison,
        source: "deterministic",
        rule: "source-deja-ecartee",
      });
      await ignorer(nature, raison);
      expireTenantData();
      return { issue: "source-ecartee", detail: parExpediteur.raison };
    }
    if (parExpediteur?.type === "rattacher") {
      const raison = `Prolonge le sujet ${parExpediteur.reference}, qui attendait la réponse de ce contact.`;
      await recordTriageVerdict(db, {
        conversationId,
        messageId,
        verdict: "matter",
        nature: "professional",
        confidence: "high",
        reason: raison,
        source: "deterministic",
        rule: "sujet-en-attente",
      });
      const applied = await applyTriageMatter(db, {
        conversationId,
        messageId,
        existingSubjectReference: parExpediteur.reference,
      });
      expireTenantData();
      const relecture = await relireSujet({
        accountId,
        subjectId: applied.subjectId,
        messageId,
      });
      return {
        issue: "sujet-en-attente",
        detail: applied.reference,
        relecture: relecture.issue,
        taches: relecture.taches,
      };
    }

    const contexte = contexteTri({
      compte: projection.compte,
      conversation: {
        ...projection.conversation,
        expediteur: projection.expediteur,
        signaux: signauxAutomatiques(entree),
      },
      instant: { maintenant: new Date().toISOString() },
    });
    const { sortie, mesure } = await extract({
      sollicitation: "tri",
      schema: SortieTri,
      nomSchema: "verdict_de_tri",
      system: contexte.system,
      prompt: contexte.prompt,
      reasoning: NIVEAU_RETENU.extraction,
      cacheCle: accountId,
      prefixeStable: prefixeStable(contexte),
    });
    await logAiSolicitation(db, { ...mesure, messageId, conversationId });

    await recordTriageVerdict(db, {
      conversationId,
      messageId,
      ...avisEnBase(sortie),
      source: "model",
      proposal: sortie,
    });

    const decision = deciderTri(sortie);
    if (decision.type === "avis-seul") {
      expireTenantData();
      return { issue: "avis-seul", detail: decision.motif };
    }
    if (decision.type === "ignorer") {
      await ignorer(decision.nature, decision.raison);
      expireTenantData();
      return { issue: "ignore", detail: decision.nature };
    }

    const applied = await applyTriageMatter(db, {
      conversationId,
      messageId,
      title: decision.type === "ouvrir" ? decision.titre : null,
      folderName: decision.domaine,
      proposedFolder: decision.domainePropose,
      existingSubjectReference:
        decision.type === "rattacher" ? decision.sujetExistant : null,
      priority: decision.priorite,
    });
    expireTenantData();
    if (applied.action === "attached") {
      // Le fil rejoint un sujet qui l'attendait : la relecture lit ce qu'il
      // dit. Elle gère ses propres échecs ; le tri, lui, a réussi.
      const relecture = await relireSujet({
        accountId,
        subjectId: applied.subjectId,
        messageId,
      });
      return {
        issue: "rattache",
        detail: applied.reference,
        relecture: relecture.issue,
        taches: relecture.taches,
      };
    }
    // Le sujet vient d'être ouvert : le second appel le structure. Il gère ses
    // propres échecs ; le tri, lui, a réussi.
    const structuration = await structurerSujet({
      accountId,
      subjectId: applied.subjectId,
      messageId,
    });
    return {
      issue: "ouvert",
      detail: applied.reference,
      structuration: structuration.issue,
      taches: structuration.taches,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[ia] tri interrompu",
      { conversationId, messageId },
      message,
    );
    try {
      // Un appel qui a échoué a coûté ses jetons : consigné comme les autres
      // (tranche 8), avant l'échec lui-même, qui dit son motif.
      const echec = err instanceof EchecSollicitation ? err : null;
      if (echec?.mesure) {
        await logAiSolicitation(db, {
          ...echec.mesure,
          messageId,
          conversationId,
        });
      }
      await logTriageFailure(db, {
        conversationId,
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
