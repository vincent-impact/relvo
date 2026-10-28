import {
  getOpenCatchup,
  ingestInboundEmail,
  ingestOutboundEmail,
  type TenantDb,
} from "@relvo/db";
import { after } from "next/server";
import { tenantDb } from "@/lib/tenant-db";
import { expireTenantData } from "@/server/cached";
import { estHistorique } from "@/server/ia/pipeline/rattrapage-regles";
import { relireSujet } from "@/server/ia/pipeline/relecture";
import { trierConversation } from "@/server/ia/pipeline/tri";
import { stockerPiecesJointes } from "./pieces-jointes";
import type { Boite, CourrierEntrant, FournisseurCourrier } from "./types";

// CE QUI SUIT LA RÉCEPTION d'un e-mail (M24.1) — le même code pour tout
// fournisseur, en deux étages :
//
//   • `rangerCourrier` : l'ingestion idempotente dans sa conversation, le
//     sujet qui l'écoute, les pièces jointes dans R2. C'est ce que la lecture
//     à la connexion appelle, tranche par tranche, et rien d'autre : elle trie
//     elle-même, du plus récent au plus ancien.
//   • `recevoirCourrier` : `rangerCourrier`, puis ce qu'un webhook doit faire
//     d'un courrier VIVANT — l'invalidation du cache (#45), l'historique laissé
//     à la tranche en cours (M7.19), et après la réponse HTTP le tri d'une
//     conversation orpheline ou la relecture du sujet qui a capté le message.
//
// Un courrier `brouillon` ou `ecarte` n'est jamais rangé (#69).

export type BilanRangement = {
  messageId: string | null;
  conversationId: string | null;
  subjectId: string | null;
  created: boolean;
  piecesStockees: number;
};

export async function rangerCourrier(
  db: TenantDb,
  boite: Boite,
  courrier: CourrierEntrant,
  fournisseur: FournisseurCourrier,
): Promise<BilanRangement> {
  if (courrier.nature === "brouillon" || courrier.nature === "ecarte") {
    return {
      messageId: null,
      conversationId: null,
      subjectId: null,
      created: false,
      piecesStockees: 0,
    };
  }
  if (courrier.nature === "envoye") {
    // Les pièces jointes d'un envoi ne sont pas rapatriées : le sujet se lit,
    // il ne stocke pas ce que le dirigeant a déjà.
    const { message, created } = await ingestOutboundEmail(
      db,
      courrier.sortant,
    );
    return {
      messageId: message?.id ?? null,
      conversationId: message?.conversationId ?? null,
      subjectId: message?.subjectId ?? null,
      created,
      piecesStockees: 0,
    };
  }
  const { message, created } = await ingestInboundEmail(db, courrier.entrant);
  // Pièces jointes (M5.4) : au premier passage — ou à un passage suivant si le
  // message est entré SANS elles (importé depuis une ligne de liste qui ne les
  // détaillait pas) : le courrier qui les porte les range, une fois.
  const piecesManquantes =
    !created &&
    courrier.pieces.length > 0 &&
    (await db.attachment.count({ where: { messageId: message.id } })) === 0;
  const piecesStockees =
    (created || piecesManquantes) && courrier.pieces.length
      ? await stockerPiecesJointes(db, {
          fournisseur,
          accountId: boite.accountId,
          externalAccountId: boite.externalAccountId,
          emailId: courrier.externalId,
          messageId: message.id,
          subjectId: message.subjectId,
          pieces: courrier.pieces,
        })
      : 0;
  return {
    messageId: message.id,
    conversationId: message.conversationId,
    subjectId: message.subjectId,
    created,
    piecesStockees,
  };
}

export type BilanReception = BilanRangement & {
  ignore: string | null;
  historique: boolean;
};

export async function recevoirCourrier(
  boite: Boite,
  courrier: CourrierEntrant,
  fournisseur: FournisseurCourrier,
): Promise<BilanReception> {
  const db = tenantDb(boite.accountId);
  const range = await rangerCourrier(db, boite, courrier, fournisseur);
  const bilan: BilanReception = { ...range, ignore: null, historique: false };
  if (courrier.nature === "brouillon" || courrier.nature === "ecarte") {
    return { ...bilan, ignore: courrier.nature };
  }
  if (!range.created || !range.messageId || !range.conversationId) {
    // Déjà en base — l'écho d'un envoi fait depuis Relvo, une seconde
    // livraison du même courrier. Des pièces jointes arrivées après coup
    // méritent quand même que l'écran les voie.
    if (range.piecesStockees > 0) expireTenantData();
    return { ...bilan, ignore: "deja-range" };
  }

  // Un courrier d'HISTORIQUE — synchronisé à la connexion, daté d'avant la
  // demande d'une lecture encore ouverte sur le canal — est rangé mais laissé
  // à la tranche en cours (M7.19) : il ne se trie pas plein tarif à la volée,
  // ni ne relit un sujet à contretemps.
  const ouvert = await getOpenCatchup(db, boite.channelId);
  expireTenantData();
  if (ouvert && estHistorique(courrier.date, ouvert.requestedAt)) {
    return { ...bilan, historique: true };
  }

  const { accountId } = boite;
  const { messageId, conversationId, subjectId } = range;
  if (courrier.nature === "recu" && !subjectId) {
    // Tri automatique (M7, tranche 4) — APRÈS la réponse HTTP, une fois par
    // message, et seulement si aucun sujet n'a capté le message au rangement.
    // Le pipeline revérifie tout et n'échoue jamais vers l'appelant.
    const entetes = courrier.entetes;
    after(async () => {
      const resultat = await trierConversation({
        accountId,
        conversationId,
        messageId,
        entetes,
      });
      console.info("[ia] tri", { accountId, messageId, ...resultat });
    });
  } else if (subjectId) {
    // Capté par un sujet au rangement (écoute du fil, réouverture mécanique) :
    // Relvo relit le sujet à sa lumière — reçu, ou envoyé d'ailleurs (05 §4.1).
    // Un envoi sans sujet reste dans sa conversation : rien ne se trie sur un
    // envoi seul.
    after(async () => {
      const resultat = await relireSujet({ accountId, subjectId, messageId });
      console.info(
        courrier.nature === "envoye"
          ? "[ia] relecture après envoi"
          : "[ia] relecture",
        { accountId, messageId, ...resultat },
      );
    });
  }
  return bilan;
}
