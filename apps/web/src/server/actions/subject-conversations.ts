"use server";

import {
  type ChannelType,
  attachConversationToSubjectFromMessage,
  attachEmailConversationToSubject,
  detachConversationFromSubject,
  ensureSubjectAnchors,
  extendSubjectToConversation,
  stopListeningOnConversation,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";
import { revalidateTenantData } from "@/server/cached";

// Server Actions SubjectConversation (M6bis.12) — étendre un sujet à une seconde
// conversation (cas S).
//
// ⚠️ Une seule action pour les deux canaux, DÉLIBÉRÉMENT : côté utilisateur il
// n'y a qu'un geste (« écrire à quelqu'un d'autre à propos de ce sujet »).
// L'asymétrie email (créer) / WhatsApp direct (rattacher) est absorbée par le
// domaine et ne remonte jamais jusqu'à l'UI — pas même dans le message de succès.

export async function extendSubjectToConversationAction(input: {
  subjectId: string;
  contactId: string;
  channelType: ChannelType;
  /** Objet de la conversation email (défaut = titre du sujet). */
  subjectLine?: string;
  /** WhatsApp : n'attacher qu'un fil déjà existant (pas de nouveau fil). */
  openExistingOnly?: boolean;
}) {
  const result = await domainAction((db) =>
    extendSubjectToConversation(db, input),
  );
  if (result.ok) {
    revalidatePath(`/sujets/${input.subjectId}`);
    revalidatePath("/conversations");
    // Le KPI « Sans sujet » compte les conversations non couvertes : en couvrir
    // une de plus le fait baisser immédiatement.
    revalidatePath("/fil");
    revalidateTenantData();
  }
  return result;
}

/**
 * Pose les ancres manquantes d'un sujet. Appelée après un envoi : au moment où
 * l'on étend un sujet à un nouvel interlocuteur, le premier message n'existe pas
 * encore — c'est l'envoi qui le crée, et c'est lui qui devient l'ancre.
 * Idempotente et sans effet si rien ne manque.
 */
export async function ensureSubjectAnchorsAction(subjectId: string) {
  return domainAction((db) => ensureSubjectAnchors(db, subjectId));
}

/**
 * « Rattacher à un sujet existant » (2e option du swipe droite email, M6ter) —
 * attache le fil au sujet choisi et y balaie tout l'amont. Renvoie l'id du sujet
 * pour naviguer vers sa fiche.
 */
export async function attachConversationToSubjectAction(input: {
  subjectId: string;
  conversationId: string;
}) {
  const result = await domainAction(async (db) => {
    await attachEmailConversationToSubject(
      db,
      input.subjectId,
      input.conversationId,
    );
    return { subjectId: input.subjectId };
  });
  if (result.ok) {
    revalidatePath(`/sujets/${input.subjectId}`);
    revalidatePath("/conversations");
    revalidatePath("/fil");
    revalidateTenantData();
  }
  return result;
}

/**
 * « Lier à un sujet existant » depuis une conversation WhatsApp (2026-07-23) —
 * l'écoute démarre au message choisi (anchre) et balaie l'aval. Le pendant
 * email passe par `attachConversationToSubjectAction` (fil entier, sans ancre).
 */
export async function attachConversationToSubjectFromMessageAction(input: {
  subjectId: string;
  messageId: string;
}) {
  const result = await domainAction(async (db) => {
    await attachConversationToSubjectFromMessage(
      db,
      input.subjectId,
      input.messageId,
    );
    return { subjectId: input.subjectId };
  });
  if (result.ok) {
    revalidatePath(`/sujets/${input.subjectId}`);
    revalidatePath("/conversations");
    revalidatePath("/fil");
    revalidateTenantData();
  }
  return result;
}

/**
 * « Détacher » un fil E-MAIL (onglet E-mail de la fiche, M6quater) — retire la
 * conversation du sujet ET purge le `subjectId` de ses messages. C'est un
 * RATTRAPAGE D'ERREUR (« ce fil n'aurait pas dû être là »), le SEUL geste qui
 * détache un fil e-mail (invariant n°13bis). La conversation continue de vivre ;
 * elle redevient « Sans sujet » si aucun autre sujet ne la porte.
 */
export async function detachConversationFromSubjectAction(input: {
  subjectId: string;
  conversationId: string;
}) {
  const result = await domainAction((db) =>
    detachConversationFromSubject(db, input.subjectId, input.conversationId),
  );
  if (result.ok) {
    revalidatePath(`/sujets/${input.subjectId}`);
    revalidatePath("/conversations");
    revalidatePath("/fil");
    revalidateTenantData();
  }
  return result;
}

/**
 * « Arrêter l'écoute » d'un fil de MESSAGERIE (onglet Messagerie de la fiche,
 * M6quater) — pose la borne de fin (`closingMessageId`) : le passé reste
 * rattaché, les messages à venir retombent orphelins. Contrairement au détachement
 * e-mail, on NE purge PAS les messages déjà couverts (« on a assez entendu »).
 */
export async function stopListeningOnConversationAction(input: {
  subjectId: string;
  conversationId: string;
}) {
  const result = await domainAction((db) =>
    stopListeningOnConversation(db, input.subjectId, input.conversationId),
  );
  if (result.ok) {
    revalidatePath(`/sujets/${input.subjectId}`);
    revalidatePath("/conversations");
    revalidatePath("/fil");
    revalidateTenantData();
  }
  return result;
}
