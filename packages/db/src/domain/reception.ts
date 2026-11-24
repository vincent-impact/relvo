import {
  ChannelType,
  ConversationStatus,
  ConversationType,
} from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import {
  conversationDuFil,
  conversationIdentity,
  emailParticipants,
} from "./conversations";
import { EVENT_TYPES, logEvent } from "./events";
import {
  type IngestInboundEmailInput,
  type IngestInboundWhatsAppInput,
  type IngestOutboundEmailInput,
  type IngestOutboundWhatsAppInput,
  ingestInboundEmail,
  ingestInboundEmailSchema,
  ingestInboundWhatsApp,
  ingestInboundWhatsAppSchema,
  ingestOutboundEmail,
  ingestOutboundEmailSchema,
  ingestOutboundWhatsApp,
  ingestOutboundWhatsAppSchema,
} from "./messages";
import type { WhatsAppChatDirectoryPort } from "./whatsapp-port";

// LA RÉCEPTION (M25.9) — « ignorer, c'est ne plus importer ».
//
// Une conversation ignorée, par le dirigeant ou par Relvo, ne reçoit plus
// rien : ni le texte, ni le HTML, ni les pièces de ses messages, reçus ou
// écrits par le dirigeant depuis son téléphone ou son client de messagerie.
// Elle ne garde qu'un COMPTE — combien, depuis quand, le dernier — et le fil
// se remet à jour depuis la source quand elle est réactivée.
//
// C'est ICI que la règle vit, et nulle part ailleurs : tout ce qui reçoit un
// message d'un fournisseur (webhook, lecture à la connexion) appelle
// `recevoir…`, jamais `ingest…` — les primitives d'ingestion persistent sans
// rien demander, pour les graines et les tests. Un test de l'application tient
// cet inventaire (`reception-garde.test.ts`).
//
// La garde passe AVANT toute écriture et ne crée jamais de conversation : un
// fil nouveau, même d'un expéditeur déjà écarté, s'importe — il faut bien le
// lire une fois pour le juger.

/** Le message n'a pas été importé : sa conversation est ignorée. */
export type ReceptionEcartee = { ecartee: true; conversationId: string };
export type Reception<T> = ReceptionEcartee | ({ ecartee: false } & T);

/** Déjà en base : la question ne se pose plus, l'idempotence répondra. */
async function dejaImporte(
  db: TenantDb,
  channelId: string,
  externalIds: (string | null | undefined)[],
): Promise<boolean> {
  const ids = externalIds.filter((i): i is string => Boolean(i));
  if (ids.length === 0) return false;
  const existing = await db.message.findFirst({
    where: { channelId, externalId: { in: ids } },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Compte un message non importé sur sa conversation — sans rien en garder
 * d'autre que sa date et son identifiant externe, qui évite de compter deux
 * fois une seconde livraison du même webhook.
 */
async function noterNonImporte(
  db: TenantDb,
  conversationId: string,
  externalId: string,
  quand: Date,
): Promise<void> {
  const c = await db.conversation.findFirst({
    where: { id: conversationId },
    select: { unimportedSince: true, unimportedLastExternalId: true },
  });
  if (!c || c.unimportedLastExternalId === externalId) return;
  await db.conversation.updateMany({
    where: { id: conversationId },
    data: {
      unimportedCount: { increment: 1 },
      unimportedSince: c.unimportedSince ?? quand,
      unimportedLastAt: quand,
      unimportedLastExternalId: externalId,
    },
  });
}

type CourrierDesigne = {
  channelId: string;
  /** L'AUTRE : l'expéditeur d'un reçu, le premier destinataire d'un envoi. */
  interlocutorRaw: string | null | undefined;
  recipients: readonly string[] | null | undefined;
  subjectLine: string | null | undefined;
};

/**
 * La CLÉ de la conversation qu'un e-mail désigne — le calcul de `createMessage`,
 * sans rien écrire. Sert à la garde, et à qui relit un trou chez le fournisseur :
 * parmi le courrier d'un interlocuteur, seul celui de CETTE conversation entre.
 */
export async function emailConversationKey(
  db: TenantDb,
  args: CourrierDesigne,
): Promise<string | null> {
  const channel = await db.channel.findFirst({
    where: { id: args.channelId },
    select: {
      type: true,
      identifier: true,
      account: { select: { email: true } },
    },
  });
  if (!channel || channel.type !== ChannelType.email) return null;
  const interlocutorRaw = args.interlocutorRaw?.trim() || null;
  return conversationIdentity({
    channelId: args.channelId,
    channelType: channel.type,
    interlocutorRaw,
    participantsRaw: emailParticipants({
      selfAddresses: [channel.identifier, channel.account?.email],
      interlocutorRaw,
      recipients: args.recipients,
    }),
    subjectLine: args.subjectLine ?? null,
  }).key;
}

/** La conversation IGNORÉE qu'un e-mail désigne par sa clé, s'il y en a une. */
async function emailIgnore(
  db: TenantDb,
  args: CourrierDesigne,
): Promise<string | null> {
  const key = await emailConversationKey(db, args);
  if (!key) return null;
  const conversation = await db.conversation.findFirst({
    where: { key, status: ConversationStatus.ignored },
    select: { id: true },
  });
  return conversation?.id ?? null;
}

/** La conversation IGNORÉE d'un fil de messagerie, s'il y en a une. */
async function filIgnore(
  db: TenantDb,
  args: { channelId: string; externalThreadId?: string | null },
): Promise<string | null> {
  const thread = args.externalThreadId?.trim();
  if (!thread) return null;
  const conversation = await conversationDuFil(db, {
    channelId: args.channelId,
    externalThreadId: thread,
    types: [ConversationType.whatsapp_direct, ConversationType.whatsapp_group],
  });
  return conversation?.status === ConversationStatus.ignored
    ? conversation.id
    : null;
}

/** Un e-mail REÇU d'un fournisseur. */
export async function recevoirEmailEntrant(
  db: TenantDb,
  input: IngestInboundEmailInput,
): Promise<Reception<Awaited<ReturnType<typeof ingestInboundEmail>>>> {
  const data = ingestInboundEmailSchema.parse(input);
  if (!(await dejaImporte(db, data.channelId, [data.externalId]))) {
    const conversationId = await emailIgnore(db, {
      channelId: data.channelId,
      interlocutorRaw: data.senderRaw,
      recipients: data.recipients,
      subjectLine: data.subjectLine,
    });
    if (conversationId) {
      await noterNonImporte(
        db,
        conversationId,
        data.externalId,
        data.receivedAt ?? new Date(),
      );
      return { ecartee: true, conversationId };
    }
  }
  return { ecartee: false, ...(await ingestInboundEmail(db, input)) };
}

/** Un e-mail que le dirigeant a ENVOYÉ depuis un client de messagerie. */
export async function recevoirEmailSortant(
  db: TenantDb,
  input: IngestOutboundEmailInput,
): Promise<Reception<Awaited<ReturnType<typeof ingestOutboundEmail>>>> {
  const data = ingestOutboundEmailSchema.parse(input);
  // Parti par l'agrégateur : c'est un envoi de Relvo, connu ou non — jamais un
  // message à compter (`ingestOutboundEmail` en décide).
  const parRelvo = data.origin?.toLowerCase() === "unipile";
  if (
    !parRelvo &&
    !(await dejaImporte(db, data.channelId, [data.externalId, data.trackingId]))
  ) {
    const conversationId = await emailIgnore(db, {
      channelId: data.channelId,
      interlocutorRaw: data.recipients[0],
      recipients: data.recipients,
      subjectLine: data.subjectLine,
    });
    if (conversationId) {
      await noterNonImporte(
        db,
        conversationId,
        data.externalId,
        data.sentAt ?? new Date(),
      );
      return { ecartee: true, conversationId };
    }
  }
  return { ecartee: false, ...(await ingestOutboundEmail(db, input)) };
}

/** Un message de messagerie REÇU. */
export async function recevoirWhatsAppEntrant(
  db: TenantDb,
  input: IngestInboundWhatsAppInput,
  chats?: WhatsAppChatDirectoryPort | null,
): Promise<Reception<Awaited<ReturnType<typeof ingestInboundWhatsApp>>>> {
  const data = ingestInboundWhatsAppSchema.parse(input);
  if (!(await dejaImporte(db, data.channelId, [data.externalId]))) {
    const conversationId = await filIgnore(db, data);
    if (conversationId) {
      await noterNonImporte(
        db,
        conversationId,
        data.externalId,
        data.receivedAt ?? new Date(),
      );
      return { ecartee: true, conversationId };
    }
  }
  return { ecartee: false, ...(await ingestInboundWhatsApp(db, input, chats)) };
}

/** Un message de messagerie que le dirigeant a ÉCRIT depuis son téléphone. */
export async function recevoirWhatsAppSortant(
  db: TenantDb,
  input: IngestOutboundWhatsAppInput,
): Promise<Reception<Awaited<ReturnType<typeof ingestOutboundWhatsApp>>>> {
  const data = ingestOutboundWhatsAppSchema.parse(input);
  if (!(await dejaImporte(db, data.channelId, [data.externalId]))) {
    const conversationId = await filIgnore(db, data);
    if (conversationId) {
      await noterNonImporte(
        db,
        conversationId,
        data.externalId,
        data.sentAt ?? new Date(),
      );
      return { ecartee: true, conversationId };
    }
  }
  return { ecartee: false, ...(await ingestOutboundWhatsApp(db, input)) };
}

// ─────────────────────────────────────────────────────────────
// Le trou (M25.10) — ce qu'une conversation redevenue active n'a pas importé.
// Il reste écrit sur elle tant que personne ne l'a relu chez le fournisseur.
// ─────────────────────────────────────────────────────────────

export type TrouARelire = {
  conversationId: string;
  type: ConversationType;
  key: string;
  channelId: string;
  externalThreadId: string | null;
  interlocutorRaw: string | null;
  participantsRaw: string[];
  /** Combien de messages n'ont pas été importés. */
  count: number;
  /** Depuis quand — la date du premier message laissé passer. */
  since: Date;
};

/** Le trou d'une conversation ACTIVE, s'il y en a un. Une conversation encore ignorée n'a rien à relire. */
export async function getUnimportedGap(
  db: TenantDb,
  conversationId: string,
): Promise<TrouARelire | null> {
  const c = await db.conversation.findFirst({
    where: { id: conversationId },
    select: {
      id: true,
      type: true,
      key: true,
      status: true,
      channelId: true,
      externalThreadId: true,
      interlocutorRaw: true,
      participantsRaw: true,
      unimportedCount: true,
      unimportedSince: true,
    },
  });
  if (!c || c.status !== ConversationStatus.active) return null;
  if (c.unimportedCount <= 0 || !c.unimportedSince) return null;
  return {
    conversationId: c.id,
    type: c.type,
    key: c.key,
    channelId: c.channelId,
    externalThreadId: c.externalThreadId,
    interlocutorRaw: c.interlocutorRaw,
    participantsRaw: c.participantsRaw,
    count: c.unimportedCount,
    since: c.unimportedSince,
  };
}

/**
 * Le trou a été relu : le compte s'efface, et le journal dit ce qui était
 * attendu et ce qui a été retrouvé — un média trop ancien, un message supprimé
 * à la source ne reviennent pas, et cela doit pouvoir se lire.
 */
export async function closeUnimportedGap(
  db: TenantDb,
  conversationId: string,
  bilan: { recovered: number },
): Promise<{ expected: number; recovered: number } | null> {
  const gap = await getUnimportedGap(db, conversationId);
  if (!gap) return null;
  await db.conversation.updateMany({
    where: { id: conversationId },
    data: {
      unimportedCount: 0,
      unimportedSince: null,
      unimportedLastAt: null,
      unimportedLastExternalId: null,
    },
  });
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: conversationId,
    eventType: EVENT_TYPES.conversationGapReread,
    title: "Messages relus après une ignorance",
    actor: "system",
    metadata: {
      expected: gap.count,
      recovered: bilan.recovered,
      since: gap.since.toISOString(),
    },
  });
  return { expected: gap.count, recovered: bilan.recovered };
}
