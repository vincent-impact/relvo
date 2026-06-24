import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import {
  Actor,
  MessageDirection,
  MessageStatus,
  TriageHint,
} from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { type CreateContactInput, createContact } from "./contacts";
import { DomainError, assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { ensureAffected } from "./helpers";
import { type Page, cursorArgs, paginationSchema, toPage } from "./pagination";
import { createSubject } from "./subjects";

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

/** Intitulé de sujet dérivé d'un message : objet d'email, sinon extrait du corps. */
function deriveSubjectTitle(
  subjectLine: string | null,
  content: string | null,
): string {
  const fromLine = subjectLine?.trim();
  if (fromLine) return fromLine.slice(0, 200);
  const fromContent = content?.replace(/\s+/g, " ").trim();
  if (fromContent) return fromContent.slice(0, 80);
  return "Nouveau sujet";
}

/**
 * Crée un Sujet À PARTIR d'un message reçu (le réflexe « Relvo aurait dû m'en
 * faire un sujet »). Crée le contact si l'expéditeur n'était qu'un `sender_raw`
 * (invariant n°12 : un contact naît à la création d'un sujet), rattache le
 * message au nouveau sujet (`linked`) et journalise. Retourne le sujet créé.
 */
export async function createSubjectFromMessage(
  db: TenantDb,
  messageId: string,
  overrides?: { title?: string; folderId?: string | null },
) {
  const message = assertFound(
    await db.message.findFirst({ where: { id: messageId } }),
    "Message",
  );
  if (message.subjectId) {
    throw new DomainError(
      "INVALID_STATE",
      "Ce message est déjà rattaché à un sujet.",
    );
  }

  // Contact : on réutilise celui du message, sinon on le matérialise depuis
  // l'expéditeur brut (sender_raw) — un expéditeur inconnu devient un contact.
  let contactId = message.senderContactId;
  if (!contactId && message.senderRaw) {
    const contact = await createContact(db, {
      name: message.senderRaw,
      sourceActor: Actor.user,
    });
    contactId = contact.id;
    await db.message.updateMany({
      where: { id: messageId },
      data: { senderContactId: contactId },
    });
  }

  // Le domaine du message « donne » son domaine au sujet (sauf override).
  const subject = await createSubject(db, {
    title:
      overrides?.title ??
      deriveSubjectTitle(message.subjectLine, message.content),
    folderId: overrides?.folderId ?? message.folderId ?? null,
    contactIds: contactId ? [contactId] : [],
    createdByActor: Actor.user,
  });

  await assignMessageToSubject(db, messageId, subject.id);
  return subject;
}

/**
 * Crée un contact à partir de l'expéditeur d'un message (expéditeur inconnu =
 * `sender_raw`) et le RELIE au message (senderContactId). Permet, depuis un
 * message, de matérialiser l'émetteur en contact enregistré.
 */
export async function createContactFromMessageSender(
  db: TenantDb,
  messageId: string,
  input: CreateContactInput,
) {
  const message = assertFound(
    await db.message.findFirst({ where: { id: messageId } }),
    "Message",
  );
  const contact = await createContact(db, {
    ...input,
    sourceActor: Actor.user,
  });
  await db.message.updateMany({
    where: { id: messageId },
    data: { senderContactId: contact.id },
  });
  // On relie aussi les autres messages du même expéditeur brut encore orphelins
  // de contact (même sender_raw) → cohérence de l'annuaire.
  if (message.senderRaw) {
    await db.message.updateMany({
      where: { senderRaw: message.senderRaw, senderContactId: null },
      data: { senderContactId: contact.id },
    });
  }
  return contact;
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

// ─────────────────────────────────────────────────────────────
// Pile d'événements (page Messages) — Relvo n'est pas un gestionnaire de
// conversation : les messages reçus sont une PILE d'événements, jamais une
// timeline d'échanges. On ne sert donc que l'`incoming` (aucun envoyé), et le
// seul moyen d'interagir reste le Sujet. Deux vues : « Tous » et « Sans sujet ».
// ─────────────────────────────────────────────────────────────

export type MessageEventItem = {
  id: string;
  direction: "incoming" | "outgoing";
  content: string | null;
  subjectLine: string | null;
  /** Type de canal (`email` | `whatsapp`) pour le logo enveloppe/bulle. */
  channelType: string;
  /** Nom du canal (« Boîte contact@… », « WhatsApp Pro »…) — le canal exact. */
  channelName: string;
  /** Identifiant du canal (adresse e-mail, numéro WhatsApp). */
  channelIdentifier: string;
  /** Nom du contact, sinon expéditeur brut, sinon « Expéditeur inconnu ». */
  senderName: string;
  /** Contact lié si l'expéditeur est enregistré ; null sinon (sender brut). */
  senderContactId: string | null;
  /** Expéditeur brut (adresse/numéro) quand le contact n'est pas enregistré. */
  senderRaw: string | null;
  /** Destinataire : « Moi » pour un message reçu, le contact pour un envoyé. */
  recipientName: string;
  recipientContactId: string | null;
  /** Domaine (dossier) assigné au message à la réception ; null = non classé. */
  folder: { id: string; name: string; slug: string } | null;
  receivedAt: Date;
  /** Lu = `readAt` posé (à l'ouverture du sujet). Null pour les orphelins. */
  read: boolean;
  subject: { id: string; reference: string; title: string } | null;
};

/** Relations nécessaires au mapping d'un événement message (canal, expéditeur). */
const MESSAGE_EVENT_INCLUDE = {
  senderContact: { select: { id: true, name: true } },
  recipientContact: { select: { id: true, name: true } },
  channel: { select: { type: true, name: true, identifier: true } },
  subject: { select: { id: true, reference: true, title: true } },
  folder: { select: { id: true, name: true, slug: true } },
} as const;

type MessageEventRow = Prisma.MessageGetPayload<{
  include: typeof MESSAGE_EVENT_INCLUDE;
}>;

function toMessageEventItem(m: MessageEventRow): MessageEventItem {
  return {
    id: m.id,
    direction: m.direction,
    content: m.content,
    subjectLine: m.subjectLine,
    channelType: m.channel.type,
    channelName: m.channel.name,
    channelIdentifier: m.channel.identifier,
    senderName: m.senderContact?.name ?? m.senderRaw ?? "Expéditeur inconnu",
    senderContactId: m.senderContact?.id ?? null,
    senderRaw: m.senderRaw,
    // Reçu → le destinataire est l'utilisateur (« Moi ») ; envoyé → le contact.
    recipientName:
      m.direction === "incoming"
        ? "Moi"
        : (m.recipientContact?.name ?? "Destinataire inconnu"),
    recipientContactId:
      m.direction === "incoming" ? null : (m.recipientContact?.id ?? null),
    folder: m.folder
      ? { id: m.folder.id, name: m.folder.name, slug: m.folder.slug }
      : null,
    receivedAt: m.receivedAt ?? m.createdAt,
    read: m.readAt != null,
    subject: m.subject
      ? {
          id: m.subject.id,
          reference: m.subject.reference,
          title: m.subject.title,
        }
      : null,
  };
}

/**
 * Pile paginée des messages reçus (curseur), filtrable sur les orphelins.
 * Exclut l'envoyé (`outgoing`) et les messages ignorés.
 */
export async function listMessageEvents(
  db: TenantDb,
  opts: { filter?: "all" | "orphan"; cursor?: string; limit?: number } = {},
): Promise<Page<MessageEventItem>> {
  const { limit } = paginationSchema.parse(opts);
  const { _limit, ...args } = cursorArgs(opts);
  const rows = await db.message.findMany({
    ...args,
    where: {
      direction: MessageDirection.incoming,
      status: { not: MessageStatus.ignored },
      ...(opts.filter === "orphan" ? { subjectId: null } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: MESSAGE_EVENT_INCLUDE,
  });
  const page = toPage(rows, limit);
  return {
    nextCursor: page.nextCursor,
    items: page.items.map(toMessageEventItem),
  };
}

/** Détail d'un message reçu (page /messages/[id]). */
export async function getMessageEvent(
  db: TenantDb,
  id: string,
): Promise<MessageEventItem | null> {
  const m = await db.message.findFirst({
    where: { id },
    include: MESSAGE_EVENT_INCLUDE,
  });
  return m ? toMessageEventItem(m) : null;
}

/**
 * Compteurs de NON-LUS pour les badges d'onglets : « Tous » (tous les messages
 * reçus non-lus, classés ou non) et « Sans sujet » (orphelins, tous non-lus).
 */
export async function countUnreadMessages(
  db: TenantDb,
): Promise<{ all: number; orphan: number }> {
  const base = {
    direction: MessageDirection.incoming,
    status: { not: MessageStatus.ignored },
    readAt: null,
  } as const;
  const [all, orphan] = await Promise.all([
    db.message.count({ where: base }),
    db.message.count({ where: { ...base, subjectId: null } }),
  ]);
  return { all, orphan };
}

/** Nombre de messages « Sans sujet » en attente de tri (lus ou non). */
export async function countOrphanMessages(db: TenantDb): Promise<number> {
  return db.message.count({
    where: {
      direction: MessageDirection.incoming,
      subjectId: null,
      status: { not: MessageStatus.ignored },
    },
  });
}

/**
 * Marque un message comme LU (idempotent). Pour un orphelin, « lire » = déplier
 * son contenu (il n'a pas de sujet à ouvrir) ; ça aide à distinguer ce qu'on a
 * déjà regardé de ce qui est nouveau. Aucun log (un coup d'œil n'est pas un
 * événement du journal).
 */
export async function markMessageRead(db: TenantDb, id: string) {
  await db.message.updateMany({
    where: { id, readAt: null },
    data: { readAt: new Date() },
  });
  return { id };
}

/**
 * Purge des messages « Sans sujet » trop anciens (rétention 15 j par défaut) :
 * un message jamais rattaché à un sujet n'a pas vocation à rester — Relvo
 * n'archive pas la boîte de réception. Destiné à un job planifié (worker/cron) ;
 * NON branché automatiquement en V1.
 */
export async function purgeStaleOrphanMessages(
  db: TenantDb,
  olderThanDays = 15,
): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
  const { count } = await db.message.deleteMany({
    where: {
      subjectId: null,
      direction: MessageDirection.incoming,
      createdAt: { lt: cutoff },
    },
  });
  return { deleted: count };
}
