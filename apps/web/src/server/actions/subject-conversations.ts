"use server";

import {
  type ChannelType,
  detachConversationFromSubject,
  ensureSubjectAnchors,
  extendSubjectToConversation,
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
 * « Arrêter l'écoute » (feuille de la fiche sujet, M6ter) — détache CETTE
 * conversation du sujet. C'est le SEUL geste qui détache un fil email d'un sujet
 * (invariant n°13bis). La conversation continue de vivre ; elle cesse simplement
 * d'alimenter ce sujet, et redevient « Sans sujet » si aucun autre ne l'écoute.
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
