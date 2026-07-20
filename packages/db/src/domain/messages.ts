import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import {
  Actor,
  MessageDirection,
  MessageStatus,
  SubjectStatus,
  TriageHint,
} from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import {
  type CreateContactInput,
  contactDisplayName,
  createContact,
  splitFullName,
} from "./contacts";
import type { EmailSenderPort } from "./email-port";
import type { WhatsAppSenderPort } from "./whatsapp-port";
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
  senderName: z.string().trim().max(200).optional().nullable(),
  recipientContactId: z.uuid().optional().nullable(),
  externalId: z.string().trim().max(255).optional().nullable(),
  externalThreadId: z.string().trim().max(255).optional().nullable(),
  // Message reçu dans un GROUPE (WhatsApp) → 1 groupe = 1 sujet, réponse à Tous.
  isGroup: z.boolean().optional(),
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
        senderName: data.senderName ?? null,
        recipientContactId: data.recipientContactId ?? null,
        externalId: data.externalId ?? null,
        externalThreadId: data.externalThreadId ?? null,
        isGroup: data.isGroup ?? false,
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

// ─────────────────────────────────────────────────────────────
// Ingestion entrante (M5.3) — un email reçu via le fournisseur d'intégration
// (Unipile) devient un Message ORPHELIN (« Sans sujet »). Le pipeline IA qui en
// fait un Sujet est M7 ; ici on ne fait que persister l'événement brut.
// ─────────────────────────────────────────────────────────────

export const ingestInboundEmailSchema = z.object({
  channelId: z.uuid(),
  // Idempotence : identifiant du message chez le fournisseur (Unipile email_id).
  externalId: z.string().trim().min(1).max(255),
  externalThreadId: z.string().trim().max(255).optional().nullable(),
  senderRaw: z.string().trim().max(320).optional().nullable(),
  senderName: z.string().trim().max(200).optional().nullable(),
  subjectLine: z.string().trim().max(500).optional().nullable(),
  content: z.string().optional().nullable(),
  receivedAt: z.date().optional().nullable(),
});

export type IngestInboundEmailInput = z.infer<typeof ingestInboundEmailSchema>;

/**
 * Normalise un objet d'email pour le comparer d'un message à l'autre : retire
 * les préfixes de réponse/transfert (Re, Ré, Rép, Fwd, Tr, Aw, Answer…, y
 * compris répétés « Re: Re: »), écrase les espaces, passe en minuscules.
 */
export function normalizeSubjectLine(raw: string): string {
  return raw
    .replace(
      /^(\s*(re|ré|rep|rép|répondre|réf|ref|fw|fwd|tr|aw|antw|answer|rv)\s*(\[\d+\])?\s*[:：]\s*)+/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Rattachement métier PRÉ-M7 (règle déterministe, remplaçable plus tard par
 * l'IA) : un email entrant rejoint un sujet existant si — et seulement si — il
 * partage le MÊME interlocuteur ET le MÊME objet normalisé qu'un message (ou le
 * titre) de ce sujet. On exclut les sujets `ignored` (l'ignorance est collante,
 * invariant n°7) et `archived` (système, inactif). Retourne l'id du sujet, ou
 * null (→ message orphelin « Sans sujet »).
 */
async function findSubjectForInboundEmail(
  db: TenantDb,
  input: {
    senderEmail: string | null;
    senderContactId: string | null;
    subjectLine: string | null;
  },
): Promise<string | null> {
  const target = input.subjectLine
    ? normalizeSubjectLine(input.subjectLine)
    : "";
  if (!target || !input.senderEmail) return null;

  // Sujets où cet interlocuteur apparaît déjà : soit via un contact lié
  // (contactIds / recipientContact), soit via l'expéditeur brut (sender_raw)
  // quand l'email n'est pas encore un contact enregistré.
  const orInterlocutor: Prisma.SubjectWhereInput[] = [
    {
      messages: {
        some: { senderRaw: { equals: input.senderEmail, mode: "insensitive" } },
      },
    },
    {
      messages: {
        some: {
          recipientContact: {
            email: { equals: input.senderEmail, mode: "insensitive" },
          },
        },
      },
    },
  ];
  if (input.senderContactId) {
    orInterlocutor.push({ contactIds: { has: input.senderContactId } });
  }

  const candidates = await db.subject.findMany({
    where: {
      status: { in: [SubjectStatus.acknowledged, SubjectStatus.resolved] },
      OR: orInterlocutor,
    },
    select: {
      id: true,
      title: true,
      messages: { select: { subjectLine: true } },
    },
    orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
  });

  for (const s of candidates) {
    const objects = [s.title, ...s.messages.map((m) => m.subjectLine)]
      .filter((v): v is string => Boolean(v))
      .map(normalizeSubjectLine);
    if (objects.includes(target)) return s.id;
  }
  return null;
}

/**
 * Persiste un email entrant en Message, de façon IDEMPOTENTE : un webhook rejoué
 * (même `channelId` + `externalId`) ne crée pas de doublon. Double garde : check
 * applicatif (findFirst) + contrainte unique en base
 * (`messages_channel_id_external_id_key`) qui gagne en cas de course.
 *
 * Rattachement automatique (pré-M7) : si l'email partage interlocuteur + objet
 * avec un sujet existant, il y est rangé (`linked`) plutôt que laissé orphelin.
 * Sinon il reste « Sans sujet » en attente de tri.
 */
export async function ingestInboundEmail(
  db: TenantDb,
  input: IngestInboundEmailInput,
): Promise<{
  message: Awaited<ReturnType<typeof createMessage>>;
  created: boolean;
}> {
  const data = ingestInboundEmailSchema.parse(input);

  const existing = await db.message.findFirst({
    where: { channelId: data.channelId, externalId: data.externalId },
  });
  if (existing) return { message: existing, created: false };

  // Résout l'interlocuteur : contact déjà connu pour ce sender_raw (email vu
  // dans un message précédent), à défaut un contact dont l'email correspond.
  const senderEmail = data.senderRaw?.trim() || null;
  const senderContactId = senderEmail
    ? ((
        await db.message.findFirst({
          where: {
            senderRaw: { equals: senderEmail, mode: "insensitive" },
            senderContactId: { not: null },
          },
          select: { senderContactId: true },
          orderBy: { createdAt: "desc" },
        })
      )?.senderContactId ??
      (
        await db.contact.findFirst({
          where: { email: { equals: senderEmail, mode: "insensitive" } },
          select: { id: true },
        })
      )?.id ??
      null)
    : null;

  const subjectId = await findSubjectForInboundEmail(db, {
    senderEmail,
    senderContactId,
    subjectLine: data.subjectLine ?? null,
  });

  try {
    const message = await createMessage(db, {
      channelId: data.channelId,
      direction: MessageDirection.incoming,
      subjectId,
      senderContactId,
      senderRaw: data.senderRaw ?? null,
      senderName: data.senderName ?? null,
      externalId: data.externalId,
      externalThreadId: data.externalThreadId ?? null,
      subjectLine: data.subjectLine ?? null,
      content: data.content ?? null,
      receivedAt: data.receivedAt ?? new Date(),
      status: subjectId ? MessageStatus.linked : undefined,
    });
    // Rangé dans un sujet → on remonte son activité (il refait surface dans le
    // fil des ouverts). Best-effort, hors transaction du message.
    if (subjectId) {
      await db.subject.updateMany({
        where: { id: subjectId },
        data: { lastActivityAt: new Date() },
      });
    }
    return { message, created: true };
  } catch (err) {
    // Course entre deux livraisons concurrentes : la contrainte unique a rejeté
    // le second insert. On relit et on renvoie l'existant — pas un doublon.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const raced = await db.message.findFirst({
        where: { channelId: data.channelId, externalId: data.externalId },
      });
      if (raced) return { message: raced, created: false };
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Ingestion entrante WhatsApp (M6.4) — un message WhatsApp reçu via Unipile
// devient un Message ORPHELIN, comme l'email. Différence structurante : WhatsApp
// n'a PAS de ligne d'objet → le rattachement pré-M7 ne peut pas se faire sur
// l'objet normalisé (règle email M5.9). On se cale sur le `chat_id` (fil), stocké
// dans `externalThreadId` : un message rejoint un sujet ouvert qui contient DÉJÀ
// un message du même fil. Le pipeline IA (M7) fera le vrai regroupement.
// ─────────────────────────────────────────────────────────────

export const ingestInboundWhatsAppSchema = z.object({
  channelId: z.uuid(),
  // Idempotence : identifiant du message chez Unipile (messaging `message_id`).
  externalId: z.string().trim().min(1).max(255),
  // Le `chat_id` WhatsApp = le fil de discussion. Sert au rattachement ET à la
  // réponse (le composer répond dans ce chat). Toujours présent en pratique.
  externalThreadId: z.string().trim().max(255).optional().nullable(),
  // Numéro / identifiant WhatsApp brut de l'expéditeur (cf. modèle : « adresse
  // email ou numéro »). Peut être absent pour un événement système.
  senderRaw: z.string().trim().max(320).optional().nullable(),
  // Nom de profil WhatsApp (« Leroy Frederique ») — label lisible avant contact.
  senderName: z.string().trim().max(200).optional().nullable(),
  // Message reçu dans un GROUPE WhatsApp (`is_group` du webhook). Marque le sujet
  // comme « de groupe » → réponse par défaut à Tous (cf. composer fiche sujet).
  isGroup: z.boolean().optional().nullable(),
  content: z.string().optional().nullable(),
  receivedAt: z.date().optional().nullable(),
});

export type IngestInboundWhatsAppInput = z.infer<
  typeof ingestInboundWhatsAppSchema
>;

/**
 * Rattachement pré-M7 pour WhatsApp (règle déterministe, remplacée par l'IA en
 * M7) : un message entrant rejoint un sujet existant si — et seulement si — le
 * sujet contient DÉJÀ un message du même fil (`chat_id` = `externalThreadId`).
 * On ne devine JAMAIS un nouveau sujet à partir d'un premier message de chat (il
 * reste orphelin). On exclut les sujets `ignored` (ignorance collante, invariant
 * n°7) et `archived` (système). Retourne l'id du sujet, ou null.
 */
async function findSubjectByChatThread(
  db: TenantDb,
  externalThreadId: string | null,
): Promise<string | null> {
  if (!externalThreadId) return null;
  const linked = await db.message.findFirst({
    where: {
      externalThreadId,
      subjectId: { not: null },
      subject: {
        status: { in: [SubjectStatus.acknowledged, SubjectStatus.resolved] },
      },
    },
    select: { subjectId: true },
    orderBy: { createdAt: "desc" },
  });
  return linked?.subjectId ?? null;
}

/**
 * Persiste un message WhatsApp entrant en Message, de façon IDEMPOTENTE (même
 * `channelId` + `externalId` → pas de doublon ; double garde applicative + unique
 * en base). Rattachement automatique par fil (`chat_id`) si un sujet ouvert le
 * porte déjà ; sinon orphelin « Sans sujet ». Même contrat de retour que
 * `ingestInboundEmail`.
 */
export async function ingestInboundWhatsApp(
  db: TenantDb,
  input: IngestInboundWhatsAppInput,
): Promise<{
  message: Awaited<ReturnType<typeof createMessage>>;
  created: boolean;
}> {
  const data = ingestInboundWhatsAppSchema.parse(input);

  const existing = await db.message.findFirst({
    where: { channelId: data.channelId, externalId: data.externalId },
  });
  if (existing) return { message: existing, created: false };

  // Résout l'interlocuteur : contact déjà vu pour ce numéro (senderRaw dans un
  // message précédent), à défaut un contact dont le téléphone correspond.
  const senderNumber = data.senderRaw?.trim() || null;
  const senderContactId = senderNumber
    ? ((
        await db.message.findFirst({
          where: {
            senderRaw: { equals: senderNumber, mode: "insensitive" },
            senderContactId: { not: null },
          },
          select: { senderContactId: true },
          orderBy: { createdAt: "desc" },
        })
      )?.senderContactId ??
      (
        await db.contact.findFirst({
          where: { phone: { equals: senderNumber, mode: "insensitive" } },
          select: { id: true },
        })
      )?.id ??
      null)
    : null;

  const subjectId = await findSubjectByChatThread(
    db,
    data.externalThreadId ?? null,
  );

  try {
    const message = await createMessage(db, {
      channelId: data.channelId,
      direction: MessageDirection.incoming,
      subjectId,
      senderContactId,
      senderRaw: data.senderRaw ?? null,
      senderName: data.senderName ?? null,
      externalId: data.externalId,
      externalThreadId: data.externalThreadId ?? null,
      isGroup: data.isGroup ?? false,
      // WhatsApp n'a pas d'objet → subjectLine reste null.
      content: data.content ?? null,
      receivedAt: data.receivedAt ?? new Date(),
      status: subjectId ? MessageStatus.linked : undefined,
    });
    if (subjectId) {
      await db.subject.updateMany({
        where: { id: subjectId },
        data: { lastActivityAt: new Date() },
      });
    }
    return { message, created: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const raced = await db.message.findFirst({
        where: { channelId: data.channelId, externalId: data.externalId },
      });
      if (raced) return { message: raced, created: false };
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Envoi sortant (M5.6) — répondre DEPUIS la vraie adresse de l'utilisateur via
// le port d'envoi injecté (Unipile côté web). Le brouillon du composer ne part
// JAMAIS tout seul : c'est cette fonction, déclenchée par l'utilisateur, qui
// envoie puis journalise un Message sortant rattaché au sujet.
// ─────────────────────────────────────────────────────────────

export const sendEmailReplySchema = z.object({
  subjectId: z.uuid(),
  channelId: z.uuid(),
  to: z.object({
    identifier: z.email(),
    displayName: z.string().trim().max(200).optional(),
  }),
  // Interlocuteur destinataire. Fourni explicitement par l'appelant (le contact
  // sélectionné dans le composer) : sans lui, le message sortant ne serait
  // rattaché à personne et disparaîtrait du fil filtré par interlocuteur.
  recipientContactId: z.uuid().optional().nullable(),
  subject: z.string().trim().min(1).max(500),
  body: z.string().min(1),
});

export type SendEmailReplyInput = z.infer<typeof sendEmailReplySchema>;

export async function sendEmailReply(
  db: TenantDb,
  sender: EmailSenderPort,
  input: SendEmailReplyInput,
) {
  const data = sendEmailReplySchema.parse(input);

  assertFound(
    await db.subject.findFirst({ where: { id: data.subjectId } }),
    "Sujet",
  );
  const channel = assertFound(
    await db.channel.findFirst({
      where: { id: data.channelId },
      include: { config: true },
    }),
    "Canal",
  );
  const externalAccountId = channel.config?.externalAccountId;
  if (!externalAccountId) {
    throw new DomainError(
      "INVALID_STATE",
      "Ce canal n'est pas connecté : impossible d'envoyer un email.",
    );
  }

  const { emailId } = await sender.sendEmail({
    externalAccountId,
    to: [{ identifier: data.to.identifier, display_name: data.to.displayName }],
    subject: data.subject,
    body: data.body,
  });

  // Destinataire : celui passé par l'appelant (interlocuteur sélectionné) ;
  // à défaut, on retombe sur une recherche par email (best-effort).
  const recipientContactId =
    data.recipientContactId ??
    (
      await db.contact.findFirst({
        where: { email: data.to.identifier },
        select: { id: true },
      })
    )?.id ??
    null;

  return createMessage(db, {
    channelId: data.channelId,
    direction: MessageDirection.outgoing,
    subjectId: data.subjectId,
    recipientContactId,
    externalId: emailId,
    subjectLine: data.subject,
    content: data.body,
    status: MessageStatus.sent,
  });
}

// ─────────────────────────────────────────────────────────────
// Envoi sortant WhatsApp (M6.5) — répondre DANS un fil existant. Le `chatId`
// vient d'un message entrant du même contact (stocké en `externalThreadId`).
// Comme l'email, le brouillon ne part jamais seul : c'est cette fonction,
// déclenchée par l'utilisateur, qui envoie puis journalise le Message sortant.
// ─────────────────────────────────────────────────────────────

export const sendWhatsAppReplySchema = z.object({
  subjectId: z.uuid(),
  channelId: z.uuid(),
  // Fil WhatsApp cible (chat_id Unipile), connu via un message entrant.
  chatId: z.string().trim().min(1).max(255),
  // Interlocuteur destinataire (contact sélectionné dans le composer) : sans lui
  // le message sortant ne serait rattaché à personne et disparaîtrait du fil
  // filtré par interlocuteur.
  recipientContactId: z.uuid().optional().nullable(),
  body: z.string().min(1),
});

export type SendWhatsAppReplyInput = z.infer<typeof sendWhatsAppReplySchema>;

export async function sendWhatsAppReply(
  db: TenantDb,
  sender: WhatsAppSenderPort,
  input: SendWhatsAppReplyInput,
) {
  const data = sendWhatsAppReplySchema.parse(input);

  assertFound(
    await db.subject.findFirst({ where: { id: data.subjectId } }),
    "Sujet",
  );
  const channel = assertFound(
    await db.channel.findFirst({
      where: { id: data.channelId },
      include: { config: true },
    }),
    "Canal",
  );
  if (!channel.config?.externalAccountId) {
    throw new DomainError(
      "INVALID_STATE",
      "Ce canal n'est pas connecté : impossible d'envoyer un message.",
    );
  }

  const { messageId } = await sender.sendMessage({
    chatId: data.chatId,
    text: data.body,
  });

  return createMessage(db, {
    channelId: data.channelId,
    direction: MessageDirection.outgoing,
    subjectId: data.subjectId,
    recipientContactId: data.recipientContactId ?? null,
    externalId: messageId,
    // On garde le fil pour recoller l'écho entrant (anti-loop) et filtrer la
    // conversation par interlocuteur.
    externalThreadId: data.chatId,
    content: data.body,
    status: MessageStatus.sent,
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

  // Groupe WhatsApp (hypothèse métier pré-M7 : 1 groupe = 1 sujet) → le sujet
  // représente le GROUPE, pas un membre. On n'enregistre AUCUN contact en masse
  // (invariant n°12 : jamais de contact « dans le vide ») : les participants
  // restent visibles via le `senderName` de chaque message, et le composer
  // répondra à « Tous » (le fil). Sinon (1:1) on matérialise l'expéditeur en
  // contact : on réutilise celui du message, sinon on le crée depuis sender_raw.
  // On PRIVILÉGIE le nom de profil (« Leroy Frederique ») pour le prénom/nom, et
  // on classe l'identifiant brut en email ou téléphone selon sa forme.
  let contactId = message.senderContactId;
  if (
    !message.isGroup &&
    !contactId &&
    (message.senderName || message.senderRaw)
  ) {
    const rawId = message.senderRaw?.trim() || null;
    const isEmail = rawId?.includes("@") ?? false;
    const contact = await createContact(db, {
      ...splitFullName(message.senderName ?? rawId ?? ""),
      email: isEmail ? rawId : null,
      phone: rawId && !isEmail ? rawId : null,
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
    // Sujet de groupe → aucun interlocuteur individuel (réponse à Tous).
    contactIds: !message.isGroup && contactId ? [contactId] : [],
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

/**
 * Rattache UN message à un sujet dans une transaction (message `linked`, PJ qui
 * suivent le sujet, journal). Brique commune au rattachement simple ET au
 * balayage des frères orphelins ci-dessous — elle ne se rappelle jamais
 * elle-même (le balayage ne se re-déclenche pas en cascade).
 */
async function linkMessageTx(tx: Tx, id: string, subjectId: string) {
  const { count } = await tx.message.updateMany({
    where: { id },
    data: { subjectId, status: MessageStatus.linked, triageHint: null },
  });
  ensureAffected(count, "Message");
  // Les PJ du message suivent son sujet (box « Pièces jointes » de la fiche).
  await tx.attachment.updateMany({
    where: { messageId: id },
    data: { subjectId },
  });
  await logEvent(tx, {
    entityType: "message",
    entityId: id,
    messageId: id,
    subjectId,
    eventType: EVENT_TYPES.messageLinked,
    title: "Message rattaché à un sujet",
    actor: "user",
  });
}

/**
 * Balaye les AUTRES orphelins du même GROUPE que `source` et les range dans le
 * même sujet. Le groupe suit les règles de rattachement de l'ingestion :
 *   • WhatsApp → même fil (`chat_id` = externalThreadId, portée par canal) ;
 *   • Email    → même interlocuteur ET même objet normalisé.
 * Rattacher manuellement un orphelin « ouvre » ainsi tout son fil d'un coup —
 * règle déterministe pré-M7, que l'IA de classement affinera (validé Vincent).
 * On ne touche qu'aux orphelins ENTRANTS encore `received` (jamais un message
 * déjà classé ou ignoré, invariant n°7).
 */
async function linkSiblingOrphans(
  tx: Tx,
  source: {
    id: string;
    channelId: string;
    channelType: string;
    externalThreadId: string | null;
    subjectLine: string | null;
    senderRaw: string | null;
    senderContactId: string | null;
  },
  subjectId: string,
) {
  const base: Prisma.MessageWhereInput = {
    id: { not: source.id },
    subjectId: null,
    status: MessageStatus.received,
    direction: MessageDirection.incoming,
  };

  let siblingIds: string[] = [];
  if (source.channelType === "whatsapp" && source.externalThreadId) {
    const rows = await tx.message.findMany({
      where: {
        ...base,
        channelId: source.channelId,
        externalThreadId: source.externalThreadId,
      },
      select: { id: true },
    });
    siblingIds = rows.map((r) => r.id);
  } else if (source.subjectLine) {
    const target = normalizeSubjectLine(source.subjectLine);
    const senderEmail = source.senderRaw?.trim() || null;
    // Même interlocuteur : contact lié à défaut expéditeur brut (email).
    const orInterlocutor: Prisma.MessageWhereInput[] = [];
    if (source.senderContactId)
      orInterlocutor.push({ senderContactId: source.senderContactId });
    if (senderEmail)
      orInterlocutor.push({
        senderRaw: { equals: senderEmail, mode: "insensitive" },
      });
    if (orInterlocutor.length === 0) return;
    const rows = await tx.message.findMany({
      where: { ...base, OR: orInterlocutor },
      select: { id: true, subjectLine: true },
    });
    // L'objet normalisé se compare en JS (regex de préfixes Re/Fwd…), comme à
    // l'ingestion — pas d'équivalent SQL fidèle.
    siblingIds = rows
      .filter(
        (r) => r.subjectLine && normalizeSubjectLine(r.subjectLine) === target,
      )
      .map((r) => r.id);
  }

  for (const siblingId of siblingIds) {
    await linkMessageTx(tx, siblingId, subjectId);
  }
}

/**
 * Cas M : rattacher un message « Sans sujet » à un sujet. Range dans la foulée
 * les autres orphelins du MÊME groupe (même fil WhatsApp / même objet +
 * interlocuteur email) — cf. `linkSiblingOrphans`.
 */
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
    const source = assertFound(
      await tx.message.findFirst({
        where: { id },
        include: { channel: { select: { type: true } } },
      }),
      "Message",
    );
    await linkMessageTx(tx as Tx, id, subjectId);
    await linkSiblingOrphans(
      tx as Tx,
      {
        id: source.id,
        channelId: source.channelId,
        channelType: source.channel.type,
        externalThreadId: source.externalThreadId,
        subjectLine: source.subjectLine,
        senderRaw: source.senderRaw,
        senderContactId: source.senderContactId,
      },
      subjectId,
    );
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
    await tx.attachment.updateMany({
      where: { messageId: id },
      data: { subjectId },
    });
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
    await tx.attachment.updateMany({
      where: { messageId: id },
      data: { subjectId: null },
    });
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
  /** Pièces jointes du message (photos WhatsApp, PJ email…) — pour l'aperçu du
   *  détail, y compris quand le message est encore orphelin. */
  attachments: {
    id: string;
    name: string;
    label: string | null;
    mimeType: string | null;
  }[];
};

/** Relations nécessaires au mapping d'un événement message (canal, expéditeur). */
const MESSAGE_EVENT_INCLUDE = {
  senderContact: { select: { id: true, firstName: true, lastName: true } },
  recipientContact: { select: { id: true, firstName: true, lastName: true } },
  channel: { select: { type: true, name: true, identifier: true } },
  subject: { select: { id: true, reference: true, title: true } },
  folder: { select: { id: true, name: true, slug: true } },
  attachments: {
    select: { id: true, name: true, aiLabel: true, mimeType: true },
  },
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
    // Label prioritaire : contact enregistré > nom de profil du canal (WhatsApp
    // « Leroy Frederique », display-name email) > identifiant brut (numéro/email).
    senderName: m.senderContact
      ? contactDisplayName(m.senderContact)
      : (m.senderName ?? m.senderRaw ?? "Expéditeur inconnu"),
    senderContactId: m.senderContact?.id ?? null,
    senderRaw: m.senderRaw,
    // Reçu → le destinataire est l'utilisateur (« Moi ») ; envoyé → le contact.
    recipientName:
      m.direction === "incoming"
        ? "Moi"
        : m.recipientContact
          ? contactDisplayName(m.recipientContact)
          : "Destinataire inconnu",
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
    attachments: m.attachments.map((a) => ({
      id: a.id,
      name: a.name,
      label: a.aiLabel,
      mimeType: a.mimeType,
    })),
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
