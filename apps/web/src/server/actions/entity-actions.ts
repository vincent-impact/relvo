"use server";

import {
  type CreateActionInput,
  type DraftReplyInput,
  cancelAction,
  createAction,
  createDraftReply,
  markActionDone,
  updateActionPayload,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";
import { revalidateTenantData } from "@/server/cached";

// Server Actions pour l'entité Action (M3.11) — brouillons send_message et
// exécution. Nommé entity-actions pour ne pas masquer le dossier actions/.

function revalidateSubjects() {
  revalidatePath("/");
  revalidatePath("/fil");
  revalidatePath("/sujets/[id]", "page"); // brouillons/actions dans la fiche
  revalidateTenantData();
}

export async function createActionAction(input: CreateActionInput) {
  const result = await domainAction((db) => createAction(db, input));
  if (result.ok) revalidateSubjects();
  return result;
}

export async function createDraftReplyAction(input: DraftReplyInput) {
  const result = await domainAction((db) => createDraftReply(db, input));
  if (result.ok) revalidateSubjects();
  return result;
}

export async function updateDraftPayloadAction(
  id: string,
  payload: Record<string, unknown>,
) {
  return domainAction((db) => updateActionPayload(db, id, payload));
}

export async function markActionDoneAction(id: string) {
  const result = await domainAction((db) => markActionDone(db, id));
  if (result.ok) revalidateSubjects();
  return result;
}

export async function cancelActionAction(id: string) {
  const result = await domainAction((db) => cancelAction(db, id));
  if (result.ok) revalidateSubjects();
  return result;
}
