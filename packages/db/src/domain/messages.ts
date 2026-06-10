import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import {
  MessageDirection,
  MessageStatus,
  TriageHint,
} from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { DomainError, assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { ensureAffected } from "./helpers";
import { cursorArgs, paginationSchema, toPage } from "./pagination";

// Domaine Messages (M3.8). Un message reste « Sans sujet » tant que subject_id
// est null ; triage_hint n'est renseigné que dans ce cas. Tri humain : cas M
// (rattachement), N (ignore), O (réaffectation / détachement).

export const createMessageSchema = z.object({
  channelId: z.uuid(),
  direction: z.enum(MessageDirection),
  subjectId: z.uuid().optional().nullable(),
  senderContactId: z.uuid().optional().nullable(),
  senderRaw: z.string().trim().max(320).optional().nullable(),
  recipientContactId: z.uuid().optional().nullable(),
  externalId: z.string().trim().max(255).optional().nullable(),
  externalThreadId: z.string().trim().max(255).optional().nullable(),
  subjectLine: z.string().trim().max(500).optional().nullable(),
  content: z.string().optional().nullable(),
  receivedAt: z.date().optional().nullable(),
  sentAt: z.date().optional().nullable(),
  status: z.enum(MessageStatus).optional(),
  triageHint: z.enum(TriageHint).optional().nullable(),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export async function listMessages(
  db: TenantDb,
  opts: {
    subjectId?: string | null;
    contactId?: string;
    cursor?: string;
    limit?: number;
  } = {},
) {
  const { limit } = paginationSchema.parse(opts);
  const { _limit, ...args } = cursorArgs(opts);
  const rows = await db.message.findMany({
    ...args,
    where: {
      ...(opts.subjectId !== undefined ? { subjectId: opts.subjectId } : {}),
      ...(opts.contactId
        ? {
            OR: [
              { senderContactId: opts.contactId },
              { recipientContactId: opts.contactId },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return toPage(rows, limit);
}

export async function getMessage(db: TenantDb, id: string) {
  return assertFound(await db.message.findFirst({ where: { id } }), "Message");
}

export async function createMessage(db: TenantDb, input: CreateMessageInput) {
  const data = createMessageSchema.parse(input);
  // triage_hint n'a de sens que pour un message « Sans sujet ».
  if (data.triageHint && data.subjectId) {
    throw new DomainError(
      "INVALID_STATE",
      "triage_hint ne peut être renseigné que sur un message sans sujet.",
    );
  }
  const incoming = data.direction === MessageDirection.incoming;

  return db.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        channelId: data.channelId,
        direction: data.direction,
        subjectId: data.subjectId ?? null,
        senderContactId: data.senderContactId ?? null,
        senderRaw: data.senderRaw ?? null,
        recipientContactId: data.recipientContactId ?? null,
        externalId: data.externalId ?? null,
        externalThreadId: data.externalThreadId ?? null,
        subjectLine: data.subjectLine ?? null,
        content: data.content ?? null,
        receivedAt: data.receivedAt ?? (incoming ? new Date() : null),
        sentAt: data.sentAt ?? (incoming ? null : new Date()),
        triageHint: data.triageHint ?? null,
        status:
          data.status ??
          (incoming ? MessageStatus.received : MessageStatus.sent),
      } as Prisma.MessageUncheckedCreateInput,
    });
    await logEvent(tx as Tx, {
      entityType: "message",
      entityId: message.id,
      messageId: message.id,
      subjectId: message.subjectId,
      contactId: incoming ? (message.senderContactId ?? null) : null,
      eventType: incoming
        ? EVENT_TYPES.messageIncomingReceived
        : EVENT_TYPES.messageOutgoingSent,
      title: incoming ? "Message reçu" : "Message envoyé",
      actor: incoming ? "contact" : "user",
    });
    return message;
  });
}

/** Cas M : rattacher un message « Sans sujet » à un sujet. */
export async function assignMessageToSubject(
  db: TenantDb,
  id: string,
  subjectId: string,
) {
  return db.$transaction(async (tx) => {
    assertFound(
      await tx.subject.findFirst({ where: { id: subjectId } }),
      "Sujet",
    );
    const { count } = await tx.message.updateMany({
      where: { id },
      data: { subjectId, status: MessageStatus.linked, triageHint: null },
    });
    ensureAffected(count, "Message");
    await logEvent(tx as Tx, {
      entityType: "message",
      entityId: id,
      messageId: id,
      subjectId,
      eventType: EVENT_TYPES.messageLinked,
      title: "Message rattaché à un sujet",
      actor: "user",
    });
    return assertFound(
      await tx.message.findFirst({ where: { id } }),
      "Message",
    );
  });
}

/** Cas N : ignorer un message « Sans sujet » (spam, non pertinent). */
export async function ignoreMessage(db: TenantDb, id: string) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.message.updateMany({
      where: { id },
      data: { status: MessageStatus.ignored },
    });
    ensureAffected(count, "Message");
    await logEvent(tx as Tx, {
      entityType: "message",
      entityId: id,
      messageId: id,
      eventType: EVENT_TYPES.messageIgnored,
      title: "Message ignoré",
      actor: "user",
    });
    return assertFound(
      await tx.message.findFirst({ where: { id } }),
      "Message",
    );
  });
}

/** Cas O : réaffecter un message à un autre sujet. */
export async function reassignMessage(
  db: TenantDb,
  id: string,
  subjectId: string,
) {
  return db.$transaction(async (tx) => {
    assertFound(
      await tx.subject.findFirst({ where: { id: subjectId } }),
      "Sujet",
    );
    const { count } = await tx.message.updateMany({
      where: { id },
      data: { subjectId, status: MessageStatus.linked, triageHint: null },
    });
    ensureAffected(count, "Message");
    await logEvent(tx as Tx, {
      entityType: "message",
      entityId: id,
      messageId: id,
      subjectId,
      eventType: EVENT_TYPES.messageReassigned,
      title: "Message réaffecté à un autre sujet",
      actor: "user",
    });
    return assertFound(
      await tx.message.findFirst({ where: { id } }),
      "Message",
    );
  });
}

/** Cas O : détacher un message (retour « Sans sujet »). */
export async function detachMessage(db: TenantDb, id: string) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.message.updateMany({
      where: { id },
      data: { subjectId: null, status: MessageStatus.received },
    });
    ensureAffected(count, "Message");
    await logEvent(tx as Tx, {
      entityType: "message",
      entityId: id,
      messageId: id,
      eventType: EVENT_TYPES.messageDetached,
      title: "Message détaché (sans sujet)",
      actor: "user",
    });
    return assertFound(
      await tx.message.findFirst({ where: { id } }),
      "Message",
    );
  });
}

/** Renseigne le triage_hint d'un message « Sans sujet ». */
export async function setTriageHint(
  db: TenantDb,
  id: string,
  hint: TriageHint,
) {
  const message = assertFound(
    await db.message.findFirst({ where: { id } }),
    "Message",
  );
  if (message.subjectId) {
    throw new DomainError(
      "INVALID_STATE",
      "triage_hint ne s'applique qu'aux messages sans sujet.",
    );
  }
  const { count } = await db.message.updateMany({
    where: { id },
    data: { triageHint: hint },
  });
  ensureAffected(count, "Message");
  return { id, triageHint: hint };
}
