"use server";

import {
  type CreateMessageInput,
  assignMessageToSubject,
  createMessage,
  createSubjectFromMessage,
  detachMessage,
  ignoreMessage,
  reassignMessage,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";
import { revalidateTenantData } from "@/server/cached";

// Server Actions Messages (M3.8) — tri humain d'un message (cas M, N, O) +
// création. Un message se voit dans sa CONVERSATION (seule surface d'affichage,
// invariant 4) : il n'y a plus de pile ni de page « message » à revalider.

function revalidateMessages() {
  revalidatePath("/");
  revalidatePath("/conversations");
  revalidatePath("/fil");
  revalidatePath("/sujets/[id]", "page"); // message rattaché → onglet Conversations
  revalidateTenantData();
}

export async function createMessageAction(input: CreateMessageInput) {
  const result = await domainAction((db) => createMessage(db, input));
  if (result.ok) revalidateMessages();
  return result;
}

export async function createSubjectFromMessageAction(
  messageId: string,
  overrides?: {
    title?: string;
    description?: string | null;
    folderId?: string | null;
  },
) {
  const result = await domainAction((db) =>
    createSubjectFromMessage(db, messageId, overrides),
  );
  if (result.ok) revalidateMessages();
  return result;
}

export async function assignMessageAction(id: string, subjectId: string) {
  const result = await domainAction((db) =>
    assignMessageToSubject(db, id, subjectId),
  );
  if (result.ok) revalidateMessages();
  return result;
}

export async function reassignMessageAction(id: string, subjectId: string) {
  const result = await domainAction((db) => reassignMessage(db, id, subjectId));
  if (result.ok) revalidateMessages();
  return result;
}

export async function detachMessageAction(id: string) {
  const result = await domainAction((db) => detachMessage(db, id));
  if (result.ok) revalidateMessages();
  return result;
}

export async function ignoreMessageAction(id: string) {
  const result = await domainAction((db) => ignoreMessage(db, id));
  if (result.ok) revalidateMessages();
  return result;
}
