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
  type TenantDb,
  type TriageProjection,
} from "@relvo/db";
import { expireTenantData } from "@/server/cached";
import { EchecSollicitation, extract } from "../client";
import { inferenceDisponible, MESSAGERIE, NIVEAU_RETENU } from "../config";
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
import {
  ancreDeLaSalve,
  estDernierDeLaSalve,
  peutFaireTaire,
} from "./messagerie-regles";
import { estHistorique } from "./rattrapage-regles";
import { relireSujet, type IssueRelecture } from "./relecture";
import { structurerSujet, type IssueStructuration } from "./structuration";

// LE TRI EN PRODUCTION (M7, tranche 4 — M7.1, M7.4, M7.5, M7.14 à M7.16 ;
// tranche 11 — la messagerie directe, A8) : « un fil entrant devient un sujet
// titré et classé ». Déclenché par le webhook APRÈS sa réponse HTTP, une fois
// par message, sur une conversation orpheline. Un fil e-mail et un fil
// WhatsApp DIRECT passent par le MÊME pipeline ; un groupe n'est jamais trié
// (l'écoute s'y pose à la main, 05 §9.5).
//
// Ordre, et ce que chaque étape garantit :
//   1. Assistant actif sur le compte, inférence joignable, idempotence — sinon rien.
//   2. Projection depuis la base, par le domaine (`getTriageProjection`) :
//      type du fil, orphelinat, dernier entrant, date de connexion du canal.
//   2 bis. MESSAGERIE SEULEMENT (`./messagerie-regles`) : un message daté
//      d'avant la connexion du numéro est de l'HISTORIQUE rejoué par
//      l'agrégateur — rangé, laissé à la future lecture de la messagerie, zéro
//      jeton ; sans date de connexion connue, rien ne se trie. Puis le tri
//      ATTEND la fin de la salve et ne se joue que si le message qui l'a
//      déclenché est toujours le DERNIER ENTRANT du fil, encore orphelin —
//      sinon il s'efface, le webhook du message suivant portera le tri : une
//      salve, un tour.
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
//      fait taire — SELON LE CANAL (`peutFaireTaire`) : sur un fil direct,
//      un « merci » professionnel n'est pas une raison de ne plus écouter un
//      client, seules la publicité et l'automatique mettent en sourdine ;
//      sinon l'avis seul (05 §1.1, §1.2, §9.5).
//   6. Ouverture ou rattachement par les primitives du domaine — sur un fil
//      direct, ANCRÉS au début de la salve (`ancreDeLaSalve`) : l'affaire
//      écoute depuis là, et rattacher ouvre une écoute sur l'affaire existante.
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
  | "historique"
  | "salve-en-cours"
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
  /** Ce que le tri et ce qu'il a enchaîné ont coûté, en euros — le rattrapage compte (M7.19). */
  coutEur: number;
};

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function trierConversation(args: {
  accountId: string;
  conversationId: string;
  /** Le message entrant qui déclenche le tri — clé de l'idempotence. */
  messageId: string;
  /** En-têtes de l'e-mail, clés en minuscules, si le transport les fournit. */
  entetes?: Record<string, string>;
  /** En LOT (rattrapage, M7.19) : niveau de service « flex », moitié prix, latence libre. */
  lot?: boolean;
  /** L'attente de la salve, remplaçable par un test ; par défaut, celle de la configuration. */
  attendre?: (ms: number) => Promise<void>;
}): Promise<ResultatTri> {
  const { accountId, conversationId, messageId } = args;
  const lot = args.lot ?? false;
  const db = tenantDb(accountId);

  if (!inferenceDisponible())
    return { issue: "inference-indisponible", coutEur: 0 };
  if (!(await isAssistantEnabled(db, accountId)))
    return { issue: "desactive", coutEur: 0 };
  if (await hasAiSolicitationForMessage(db, messageId, "tri")) {
    return { issue: "deja-traite", coutEur: 0 };
  }

  let projection = await getTriageProjection(db, conversationId);
  if (
    projection.type !== "email_subject" &&
    projection.type !== "whatsapp_direct"
  ) {
    return { issue: "canal-non-couvert", coutEur: 0 };
  }
  if (!projection.orpheline) return { issue: "non-orpheline", coutEur: 0 };
  if (!projection.dernierEntrant)
    return { issue: "sans-message-entrant", coutEur: 0 };

  let ancre: string | null = null;
  if (projection.type === "whatsapp_direct") {
    // L'historique rejoué à la connexion d'un numéro n'est pas du courrier
    // vivant ; sans date de connexion connue, rien ne se trie — le dirigeant
    // qui connecte un numéro avec des années de fils ne paie jamais
    // l'historique à contretemps.
    const declencheur = projection.conversation.messages.find(
      (m) => m.id === messageId,
    );
    if (
      !projection.connecteLe ||
      !declencheur ||
      estHistorique(declencheur.recuLe, projection.connecteLe)
    ) {
      return { issue: "historique", coutEur: 0 };
    }
    // La salve se laisse arriver : le tri ne se joue que sur son dernier
    // message. Un message déjà dépassé s'efface sans attendre.
    const dernier = (p: TriageProjection) =>
      estDernierDeLaSalve({
        declencheurId: messageId,
        dernierEntrantId: p.dernierEntrant?.id ?? null,
      });
    if (!dernier(projection)) return { issue: "salve-en-cours", coutEur: 0 };
    await (args.attendre ?? dormir)(MESSAGERIE.attenteSalveMs);
    projection = await getTriageProjection(db, conversationId);
    if (!projection.orpheline) return { issue: "non-orpheline", coutEur: 0 };
    if (!projection.dernierEntrant)
      return { issue: "sans-message-entrant", coutEur: 0 };
    if (!dernier(projection)) return { issue: "salve-en-cours", coutEur: 0 };
    ancre = ancreDeLaSalve(projection.conversation.messages, {
      id: messageId,
      recuLe: declencheur.recuLe,
    });
  }

  return trierFil({
    db,
    accountId,
    conversationId,
    messageId,
    projection,
    entetes: args.entetes,
    lot,
    ancre,
  });
}

/**
 * Le tri d'un fil orphelin, du filtre déterministe à l'ouverture ou au
 * rattachement — commun à l'e-mail (ancre nulle) et à la messagerie directe
 * (ancre au début de la salve). C'est le canal du fil qui dit ce qu'un « rien
 * à faire » sûr a le droit de faire taire.
 */
async function trierFil(p: {
  db: TenantDb;
  accountId: string;
  conversationId: string;
  messageId: string;
  projection: TriageProjection;
  entetes?: Record<string, string>;
  lot: boolean;
  ancre: string | null;
}): Promise<ResultatTri> {
  const { db, accountId, conversationId, messageId, projection, lot, ancre } =
    p;
  const canal = projection.conversation.canal;
  const entrant = projection.dernierEntrant!;

  // Faire taire la source sur un « rien à faire » sûr (05 §9.5) : la nature
  // donne la raison d'ignorance, la phrase de Relvo la note. Réversible d'un
  // appui dans le filtre « Ignorées ».
  const ignorer = (nature: Nature, raison: string) =>
    ignoreConversation(db, conversationId, {
      reason: IGNORE_REASON_OF_NATURE[NATURE_EN_BASE[nature]],
      note: raison,
      actor: "ai",
    });

  // Le filtre ne lit que ce qu'il a : sur la messagerie, ni en-têtes ni objet
  // — le lien de désabonnement dans le texte reste lisible.
  const entree = {
    adresse: entrant.adresse,
    nom: entrant.nom,
    objet: entrant.objet,
    contenu: entrant.contenu,
    entetes: p.entetes,
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
      return { issue: "bruit-deterministe", detail: bruit.regle, coutEur: 0 };
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
      return {
        issue: "source-ecartee",
        detail: parExpediteur.raison,
        coutEur: 0,
      };
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
        anchorMessageId: ancre,
      });
      expireTenantData();
      const relecture = await relireSujet({
        accountId,
        subjectId: applied.subjectId,
        messageId,
        lot,
      });
      return {
        issue: "sujet-en-attente",
        detail: applied.reference,
        relecture: relecture.issue,
        taches: relecture.taches,
        coutEur: relecture.coutEur,
      };
    }

    const contexte = contexteTri({
      compte: projection.compte,
      conversation: {
        canal,
        messages: projection.conversation.messages,
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
      lot,
    });
    await logAiSolicitation(db, { ...mesure, messageId, conversationId });
    const coutTri = mesure.cout.eur;

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
      return { issue: "avis-seul", detail: decision.motif, coutEur: coutTri };
    }
    if (decision.type === "ignorer") {
      if (
        !peutFaireTaire({
          canal,
          nature: decision.nature,
          confiance: sortie.confiance,
        })
      ) {
        // Sur un fil direct, « merci, bonne journée » n'éteint pas un client :
        // l'avis est écrit, la conversation reste vivante.
        expireTenantData();
        return { issue: "avis-seul", detail: "rien-a-faire", coutEur: coutTri };
      }
      await ignorer(decision.nature, decision.raison);
      expireTenantData();
      return { issue: "ignore", detail: decision.nature, coutEur: coutTri };
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
      anchorMessageId: ancre,
    });
    expireTenantData();
    if (applied.action === "attached") {
      // Le fil rejoint un sujet qui l'attendait : la relecture lit ce qu'il
      // dit. Elle gère ses propres échecs ; le tri, lui, a réussi.
      const relecture = await relireSujet({
        accountId,
        subjectId: applied.subjectId,
        messageId,
        lot,
      });
      return {
        issue: "rattache",
        detail: applied.reference,
        relecture: relecture.issue,
        taches: relecture.taches,
        coutEur: coutTri + relecture.coutEur,
      };
    }
    // Le sujet vient d'être ouvert : le second appel le structure. Il gère ses
    // propres échecs ; le tri, lui, a réussi.
    const structuration = await structurerSujet({
      accountId,
      subjectId: applied.subjectId,
      messageId,
      lot,
    });
    return {
      issue: "ouvert",
      detail: applied.reference,
      structuration: structuration.issue,
      taches: structuration.taches,
      coutEur: coutTri + structuration.coutEur,
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
    return {
      issue: "echec",
      detail: message,
      coutEur:
        err instanceof EchecSollicitation ? (err.mesure?.cout.eur ?? 0) : 0,
    };
  }
}
