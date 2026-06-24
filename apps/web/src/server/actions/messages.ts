"use server";

import {
  type CreateContactInput,
  type CreateMessageInput,
  type TriageHint,
  assignMessageToSubject,
  createContactFromMessageSender,
  createMessage,
  createSubjectFromMessage,
  detachMessage,
  ignoreMessage,
  listMessageEvents,
  markMessageRead,
  reassignMessage,
  setTriageHint,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";
import {
  MESSAGES_PAGE_SIZE,
  type MessageRowData,
  toMessageRowData,
} from "@/lib/message-row";

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

/** Charge une page suivante de la pile Messages (scroll infini, côté client). */
export async function loadMessageEventsAction(
  filter: "all" | "orphan",
  cursor: string | null,
): Promise<
  | { ok: true; data: { items: MessageRowData[]; nextCursor: string | null } }
  | { ok: false; message: string }
> {
  const res = await domainAction((db) =>
    listMessageEvents(db, {
      filter,
      cursor: cursor ?? undefined,
      limit: MESSAGES_PAGE_SIZE,
    }),
  );
  if (!res.ok) return res;
  return {
    ok: true,
    data: {
      items: res.data.items.map(toMessageRowData),
      nextCursor: res.data.nextCursor,
    },
  };
}

/**
 * Marque un message lu (à l'ouverture de sa page détail). Revalide /messages
 * pour que la pile reflète l'état lu au retour.
 */
export async function markMessageReadAction(id: string) {
  const result = await domainAction((db) => markMessageRead(db, id));
  if (result.ok) revalidatePath("/messages");
  return result;
}

export async function createContactFromMessageSenderAction(
  messageId: string,
  input: CreateContactInput,
) {
  const result = await domainAction((db) =>
    createContactFromMessageSender(db, messageId, input),
  );
  if (result.ok) {
    revalidateMessages();
    revalidatePath("/contacts");
  }
  return result;
}

export async function createSubjectFromMessageAction(messageId: string) {
  const result = await domainAction((db) =>
    createSubjectFromMessage(db, messageId),
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

export async function setTriageHintAction(id: string, hint: TriageHint) {
  const result = await domainAction((db) => setTriageHint(db, id, hint));
  if (result.ok) revalidateMessages();
  return result;
}
