import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import {
  Actor,
  MessageDirection,
  MessageStatus,
} from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import {
  type CreateContactInput,
  contactDisplayName,
  createContact,
  splitFullName,
} from "./contacts";
import {
  findOpenSubjectForConversation,
  resolveConversation,
  resolveWhatsAppChatIdentity,
} from "./conversations";
import type { EmailSenderPort } from "./email-port";
import type {
  WhatsAppChatDirectoryPort,
  WhatsAppSenderPort,
} from "./whatsapp-port";
import { DomainError, assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { type TenantCreate, ensureAffected } from "./helpers";
import { type Page, cursorArgs, paginationSchema, toPage } from "./pagination";
import { createSubject } from "./subjects";

// Domaine Messages (M3.8). Un message reste « Sans sujet » tant que subject_id
// est null. Tri humain : cas M (rattachement), N (ignore), O (réaffectation /
// détachement).
//
// M6bis — `triage_hint` est CADUC et n'est plus jamais alimenté : il expliquait
// pourquoi Relvo n'avait pas su ranger un message, or le rangement en
// conversation est désormais déterministe et infaillible. La colonne survit pour
// l'historique (cf. 02-modele-donnees §7), le code qui l'écrivait a disparu.

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
  // Nom réel du groupe, quand l'appelant a su le lire (M6bis.7). Purement
  // TRAVERSANT : il ne sert qu'à nommer la conversation, jamais le message.
  groupTitle: z.string().trim().max(200).optional().nullable(),
  subjectLine: z.string().trim().max(500).optional().nullable(),
  content: z.string().optional().nullable(),
  receivedAt: z.date().optional().nullable(),
  sentAt: z.date().optional().nullable(),
  status: z.enum(MessageStatus).optional(),
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
  const incoming = data.direction === MessageDirection.incoming;

  // M6bis — tout message se range dans une conversation, et c'est ICI que ça se
  // décide, pour TOUS les points d'entrée (ingestion email, ingestion WhatsApp,
  // envoi sortant, seed, tests). Résoudre la conversation dans chaque appelant
  // aurait garanti qu'un appelant finisse par l'oublier — or la colonne est NON
  // NULLABLE, donc l'oubli casserait à l'exécution, pas à la compilation.
  const channel = assertFound(
    await db.channel.findFirst({
      where: { id: data.channelId },
      select: { id: true, type: true },
    }),
    "Canal",
  );

  // L'interlocuteur est l'AUTRE, quel que soit le sens du message : l'expéditeur
  // d'un entrant, le destinataire d'un sortant. C'est ce qui range les deux sens
  // de l'échange dans la même conversation.
  const recipient = data.recipientContactId
    ? await db.contact.findFirst({
        where: { id: data.recipientContactId },
        select: { email: true, phone: true, firstName: true, lastName: true },
      })
    : null;
  const interlocutorRaw = incoming
    ? (data.senderRaw ?? null)
    : (recipient?.email ?? recipient?.phone ?? null);
  const interlocutorName = incoming
    ? (data.senderName ?? null)
    : recipient
      ? contactDisplayName(recipient)
      : null;

  const conversation = await resolveConversation(db, {
    channelId: channel.id,
    channelType: channel.type,
    interlocutorRaw,
    interlocutorName,
    contactId:
      (incoming ? data.senderContactId : data.recipientContactId) ?? null,
    subjectLine: data.subjectLine ?? null,
    externalThreadId: data.externalThreadId ?? null,
    isGroup: data.isGroup ?? false,
    groupTitle: data.groupTitle ?? null,
  });

  // Règle d'ancrage : à défaut de sujet imposé par l'appelant, le message rejoint
  // la fenêtre ouverte sur sa conversation, s'il y en a une.
  const subjectId =
    data.subjectId ??
    (await findOpenSubjectForConversation(db, conversation.id));

  const occurredAt = (incoming ? data.receivedAt : data.sentAt) ?? new Date();

  return db.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        channelId: data.channelId,
        conversationId: conversation.id,
        direction: data.direction,
        subjectId: subjectId ?? null,
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
        status:
          data.status ??
          (subjectId
            ? MessageStatus.linked
            : incoming
              ? MessageStatus.received
              : MessageStatus.sent),
        // `satisfies` plutôt qu'un cast nu : `accountId` est injecté par la
        // couche tenant, mais TOUS les autres champs obligatoires restent
        // vérifiés — dont `conversationId`. L'ancien `as ...UncheckedCreateInput`
        // masquait justement ce genre d'oubli jusqu'à l'exécution.
      } satisfies TenantCreate<Prisma.MessageUncheckedCreateInput> as Prisma.MessageUncheckedCreateInput,
    });
    // Dernier message de la conversation — pilote le tri de la liste ET le KPI
    // « Sans sujet » (cf. Conversation.lastMessageId). Posé ici, dans la même
    // transaction que la création : c'est le seul moment où il change.
    await tx.conversation.updateMany({
      where: { id: conversation.id },
      data: { lastMessageId: message.id, lastMessageAt: occurredAt },
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
// (Unipile) tombe TOUJOURS dans une conversation (M6bis), rattaché à un sujet ou
// non. Le pipeline IA qui en fait un Sujet est M7 ; ici on ne fait que persister
// l'événement brut.
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
 * Persiste un email entrant, de façon IDEMPOTENTE (même `channelId` +
 * `externalId` → pas de doublon ; double garde applicative + contrainte unique).
 *
 * Le RANGEMENT n'est plus fait ici : `createMessage` résout la conversation
 * (interlocuteur + objet normalisé) et applique la règle d'ancrage. L'ancienne
 * heuristique « même interlocuteur ET même objet qu'un message du sujet »
 * a disparu avec elle — elle cherchait un sujet là où il fallait d'abord
 * chercher une conversation.
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

  try {
    const message = await createMessage(db, {
      channelId: data.channelId,
      direction: MessageDirection.incoming,
      senderContactId,
      senderRaw: data.senderRaw ?? null,
      senderName: data.senderName ?? null,
      externalId: data.externalId,
      externalThreadId: data.externalThreadId ?? null,
      subjectLine: data.subjectLine ?? null,
      content: data.content ?? null,
      receivedAt: data.receivedAt ?? new Date(),
    });
    // Ancré dans une fenêtre ouverte → le sujet refait surface dans le fil des
    // ouverts. Best-effort, hors transaction du message.
    if (message.subjectId) {
      await db.subject.updateMany({
        where: { id: message.subjectId },
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
// Ingestion entrante WhatsApp (M6.4) — même contrat que l'email. WhatsApp n'a
// PAS de ligne d'objet : c'est le `chat_id` (groupe) ou le numéro (direct) qui
// porte l'identité de la conversation. Cette asymétrie est absorbée par
// `conversationIdentity()` — l'ingestion, elle, est identique des deux côtés.
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
 * Persiste un message WhatsApp entrant, de façon IDEMPOTENTE. Comme pour
 * l'email, le rangement est délégué à `createMessage` (conversation + règle
 * d'ancrage) : il n'y a plus de résolution de sujet propre à WhatsApp.
 */
export async function ingestInboundWhatsApp(
  db: TenantDb,
  input: IngestInboundWhatsAppInput,
  /**
   * Annuaire des fils (M6bis.7) — OPTIONNEL : sans lui, l'ingestion se comporte
   * exactement comme avant (type d'après `is_group`, groupe nommé « Groupe
   * WhatsApp »). C'est ce qui laisse les tests et les seeds sans dépendance
   * réseau.
   */
  chats?: WhatsAppChatDirectoryPort | null,
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

  // Nom et type réels du fil. Placé APRÈS le court-circuit d'idempotence : une
  // re-livraison du même webhook ne doit rien coûter en réseau. En régime établi
  // (fil déjà connu et nommé) la résolution se fait par une simple lecture en base.
  const chat = await resolveWhatsAppChatIdentity(
    db,
    { chatId: data.externalThreadId, isGroupHint: data.isGroup },
    chats,
  );

  try {
    const message = await createMessage(db, {
      channelId: data.channelId,
      direction: MessageDirection.incoming,
      senderContactId,
      senderRaw: data.senderRaw ?? null,
      senderName: data.senderName ?? null,
      externalId: data.externalId,
      externalThreadId: data.externalThreadId ?? null,
      isGroup: chat.isGroup,
      groupTitle: chat.groupTitle,
      // WhatsApp n'a pas d'objet → subjectLine reste null.
      content: data.content ?? null,
      receivedAt: data.receivedAt ?? new Date(),
    });
    if (message.subjectId) {
      await db.subject.updateMany({
        where: { id: message.subjectId },
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

  // M6bis — ouvrir un sujet, c'est OUVRIR UNE FENÊTRE sur la conversation du
  // message, ancrée sur ce message. C'est le seul geste qui pose une ancre.
  await db.subjectConversation.create({
    data: {
      subjectId: subject.id,
      conversationId: message.conversationId,
      anchorMessageId: message.id,
    } satisfies TenantCreate<Prisma.SubjectConversationUncheckedCreateInput> as Prisma.SubjectConversationUncheckedCreateInput,
  });

  // La fenêtre s'ouvre À PARTIR de l'ancre : les messages de la conversation
  // postérieurs à l'ancre et non encore couverts rejoignent le sujet ; les
  // ANTÉRIEURS restent dans la conversation sans lui appartenir.
  //
  // C'est ce qui remplace l'ancien « balayage des frères orphelins » — avec une
  // règle qui se justifie (la fenêtre) au lieu d'une heuristique de similarité.
  const anchoredAt = message.receivedAt ?? message.sentAt ?? message.createdAt;
  const covered = {
    conversationId: message.conversationId,
    subjectId: null,
    status: { not: MessageStatus.ignored },
    createdAt: { gte: message.createdAt },
    OR: [{ receivedAt: { gte: anchoredAt } }, { sentAt: { gte: anchoredAt } }],
  } satisfies Prisma.MessageWhereInput;

  const [{ count: swept }] = await db.$transaction([
    db.message.updateMany({
      where: covered,
      data: { subjectId: subject.id, status: MessageStatus.linked },
    }),
    db.attachment.updateMany({
      where: { message: { is: covered } },
      data: { subjectId: subject.id },
    }),
  ]);

  await assignMessageToSubject(db, messageId, subject.id);

  // Un SEUL événement de synthèse si la fenêtre a emporté d'autres messages —
  // pas N entrées de journal.
  if (swept > 0) {
    const plural = swept > 1 ? "s" : "";
    await logEvent(db, {
      entityType: "subject",
      entityId: subject.id,
      subjectId: subject.id,
      eventType: EVENT_TYPES.messageLinked,
      title: `${swept} message${plural} de la conversation couvert${plural} par le sujet`,
      actor: "system",
    });
  }

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
 * Rattache UN message à un sujet — un seul, jamais ses voisins.
 *
 * Le balayage des « frères orphelins » a disparu avec M6bis : il rattrapait à la
 * main ce que la règle d'ancrage fait maintenant à la réception. Surtout, il
 * était incompatible avec les sujets ENTRELACÉS — dans un fil WhatsApp direct où
 * Karim parle de la sauce blanche et de la facture emballages en alternance,
 * rattacher un message emportait tout le fil.
 *
 * Conformément au modèle, ce rattachement NE DÉPLACE PAS la fenêtre active :
 * seule l'ouverture d'un sujet pose une ancre (cf. `openSubjectFromMessage`).
 * Un message peut donc appartenir au sujet A pendant que la conversation reste
 * ancrée sur le sujet B.
 */
export async function assignMessageToSubject(
  db: TenantDb,
  id: string,
  subjectId: string,
) {
  assertFound(
    await db.subject.findFirst({ where: { id: subjectId } }),
    "Sujet",
  );

  // Les PJ suivent leur message (box « Pièces jointes » de la fiche). Deux
  // updateMany groupés = nombre de requêtes CONSTANT (cf. incident P2028).
  const [{ count }] = await db.$transaction([
    db.message.updateMany({
      where: { id },
      data: { subjectId, status: MessageStatus.linked },
    }),
    db.attachment.updateMany({ where: { messageId: id }, data: { subjectId } }),
  ]);
  ensureAffected(count, "Message");

  await logEvent(db, {
    entityType: "message",
    entityId: id,
    messageId: id,
    subjectId,
    eventType: EVENT_TYPES.messageLinked,
    title: "Message rattaché à un sujet",
    actor: "user",
  });

  return assertFound(await db.message.findFirst({ where: { id } }), "Message");
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
      data: { subjectId, status: MessageStatus.linked },
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

/**
 * Cas O : détacher un message de son sujet.
 *
 * ⚠️ Si ce message était l'ANCRE d'une fenêtre, l'ancre GLISSE au message
 * suivant du sujet dans cette conversation. Sans ce glissement, la fenêtre
 * resterait accrochée à un message qui n'appartient plus au sujet — et la
 * suppression de l'ancre (FK `SetNull`) laisserait une fenêtre sans point de
 * départ. Si le sujet ne couvre plus aucun message de la conversation, la
 * fenêtre elle-même est retirée : le sujet n'a plus lieu d'y capter les
 * nouveaux messages.
 */
export async function detachMessage(db: TenantDb, id: string) {
  const before = assertFound(
    await db.message.findFirst({
      where: { id },
      select: { id: true, subjectId: true, conversationId: true },
    }),
    "Message",
  );

  const result = await db.$transaction(async (tx) => {
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

  // Glissement d'ancre — hors transaction : ce sont des requêtes de réparation,
  // pas la mutation demandée par l'utilisateur (cf. incident P2028, on ne fait
  // pas grossir une transaction interactive).
  if (before.subjectId) {
    const window = await db.subjectConversation.findFirst({
      where: {
        subjectId: before.subjectId,
        conversationId: before.conversationId,
      },
      select: { id: true, anchorMessageId: true },
    });
    if (window?.anchorMessageId === id) {
      const next = await db.message.findFirst({
        where: {
          subjectId: before.subjectId,
          conversationId: before.conversationId,
        },
        select: { id: true },
        orderBy: [
          { receivedAt: "asc" },
          { sentAt: "asc" },
          { createdAt: "asc" },
        ],
      });
      if (next) {
        await db.subjectConversation.updateMany({
          where: { id: window.id },
          data: { anchorMessageId: next.id },
        });
        await logEvent(db, {
          entityType: "subject",
          entityId: before.subjectId,
          subjectId: before.subjectId,
          eventType: EVENT_TYPES.anchorMoved,
          title: "Ancre déplacée au message suivant",
          actor: "system",
        });
      } else {
        // Plus aucun message du sujet dans cette conversation : la fenêtre n'a
        // plus d'objet, on la retire (les nouveaux messages redeviennent libres).
        await db.subjectConversation.deleteMany({ where: { id: window.id } });
        await logEvent(db, {
          entityType: "subject",
          entityId: before.subjectId,
          subjectId: before.subjectId,
          eventType: EVENT_TYPES.conversationDetached,
          title: "Fenêtre refermée sur la conversation (plus aucun message)",
          actor: "system",
        });
      }
    }
  }

  return result;
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
  /** Lu = `readAt` posé (à l'ouverture du sujet ou de la conversation). */
  read: boolean;
  subject: { id: string; reference: string; title: string } | null;
  /** Pièces jointes du message (photos WhatsApp, PJ email…) — pour l'aperçu du
   *  détail, y compris quand le message n'est rattaché à aucun sujet. */
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
 * Pile paginée des messages reçus (curseur), filtrable sur les non rattachés.
 * Exclut l'envoyé (`outgoing`) et les messages ignorés.
 */
export async function listMessageEvents(
  db: TenantDb,
  opts: { filter?: "all" | "unsorted"; cursor?: string; limit?: number } = {},
): Promise<Page<MessageEventItem>> {
  const { limit } = paginationSchema.parse(opts);
  const { _limit, ...args } = cursorArgs(opts);
  const rows = await db.message.findMany({
    ...args,
    where: {
      direction: MessageDirection.incoming,
      status: { not: MessageStatus.ignored },
      ...(opts.filter === "unsorted" ? { subjectId: null } : {}),
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
 * reçus non-lus, classés ou non) et « Sans sujet » (non rattachés, non lus).
 *
 * ⚠️ Le non-lu de référence vit désormais sur la CONVERSATION
 * (`markConversationRead`) : ces compteurs ne servent que la page `/messages`,
 * transitoire jusqu'à `/conversations`.
 */
export async function countUnreadMessages(
  db: TenantDb,
): Promise<{ all: number; unsorted: number }> {
  const base = {
    direction: MessageDirection.incoming,
    status: { not: MessageStatus.ignored },
    readAt: null,
  } as const;
  const [all, unsorted] = await Promise.all([
    db.message.count({ where: base }),
    db.message.count({ where: { ...base, subjectId: null } }),
  ]);
  return { all, unsorted };
}

/**
 * Nombre de messages reçus non rattachés à un sujet.
 *
 * ⚠️ Ce n'est PAS le KPI « Sans sujet » — celui-ci compte des CONVERSATIONS
 * (`countUnsortedConversations`). Ce compteur ne sert qu'à titrer la pile de la
 * page `/messages`, dont il doit rester l'exact reflet.
 */
export async function countUnsortedMessages(db: TenantDb): Promise<number> {
  return db.message.count({
    where: {
      direction: MessageDirection.incoming,
      subjectId: null,
      status: { not: MessageStatus.ignored },
    },
  });
}

/**
 * Marque un message comme LU (idempotent). Pour un message non rattaché,
 * « lire » = déplier son contenu ; ça aide à distinguer ce qu'on a déjà regardé
 * de ce qui est nouveau. Aucun log (un coup d'œil n'est pas un événement du
 * journal).
 */
export async function markMessageRead(db: TenantDb, id: string) {
  await db.message.updateMany({
    where: { id, readAt: null },
    data: { readAt: new Date() },
  });
  return { id };
}
