"use server";

import {
  type CreateMessageInput,
  type TriageHint,
  assignMessageToSubject,
  createMessage,
  detachMessage,
  ignoreMessage,
  reassignMessage,
  setTriageHint,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";

// Server Actions Messages (M3.8) — tri humain des messages « Sans sujet »
// (cas M, N, O) + création.

function revalidateMessages() {
  revalidatePath("/");
  revalidatePath("/messages");
  revalidatePath("/fil");
}

export async function createMessageAction(input: CreateMessageInput) {
  const result = await domainAction((db) => createMessage(db, input));
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

export async function setTriageHintAction(id: string, hint: TriageHint) {
  const result = await domainAction((db) => setTriageHint(db, id, hint));
  if (result.ok) revalidateMessages();
  return result;
}
