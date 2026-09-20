import { z } from "zod";
import { prisma } from "../index";
import {
  Actor,
  CatchupStatus,
  ChannelType,
  ConversationStatus,
  MessageDirection,
} from "../generated/prisma/enums";
import type { Prisma } from "../generated/prisma/client";
import type { TenantDb, Tx } from "../tenant";
import { assertFound, DomainError } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";

// Domaine RATTRAPAGE (M7, tranche 9 — M7.19) : « Relvo lit le courrier récent
// la nuit de la connexion ». Ce que le pipeline LIT et ÉCRIT en base autour
// d'un rattrapage : la demande à la connexion d'un canal, les candidats au tri,
// l'avancement, la clôture. Le pipeline lui-même — import depuis l'agrégateur,
// tri en lot, plafonds — vit dans l'application, unique consommateur de
// l'inférence et de l'agrégateur.
//
// Trois règles tenues ici :
//   1. UN rattrapage ouvert par canal : demander pendant qu'un autre est en
//      cours ou en attente ne crée rien.
//   2. Un candidat au tri est une conversation ACTIVE du canal dont le dernier
//      message est ENTRANT, reçu dans la fenêtre, sans sujet et pas encore
//      trié — exactement ce que le tri au fil de l'eau aurait traité.
//   3. Tout changement d'état est journalisé (02, EventLog), avec les
//      compteurs : c'est ce que l'écran des canaux montre au matin.

export const requestCatchupSchema = z.object({
  channelId: z.uuid(),
  /** Début de la fenêtre lue. */
  since: z.date(),
});

/**
 * Demande un rattrapage sur un canal e-mail. Idempotent : un rattrapage déjà
 * en attente ou en cours sur ce canal est rendu tel quel. Un canal de
 * messagerie est refusé — le tri WhatsApp message par message n'existe pas
 * encore (A8).
 */
export async function requestChannelCatchup(
  db: TenantDb,
  input: z.input<typeof requestCatchupSchema>,
) {
  const data = requestCatchupSchema.parse(input);
  const channel = assertFound(
    await db.channel.findFirst({
      where: { id: data.channelId },
      select: { id: true, type: true, accountId: true },
    }),
    "Canal",
  );
  if (channel.type !== ChannelType.email) {
    throw new DomainError(
      "VALIDATION",
      "Le rattrapage ne couvre que les canaux e-mail.",
    );
  }
  const ouvert = await db.channelCatchup.findFirst({
    where: {
      channelId: channel.id,
      status: { in: [CatchupStatus.pending, CatchupStatus.running] },
    },
  });
  if (ouvert) return ouvert;
  return db.$transaction(async (tx) => {
    const catchup = await tx.channelCatchup.create({
      // `accountId` est injecté par le client tenant (même forme que les
      // autres créations du domaine).
      data: {
        channelId: channel.id,
        since: data.since,
      } as Prisma.ChannelCatchupUncheckedCreateInput,
    });
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: catchup.id,
      eventType: EVENT_TYPES.catchupRequested,
      title: "Rattrapage du courrier récent demandé",
      description: `Depuis le ${data.since.toISOString().slice(0, 10)}`,
      actor: Actor.system,
      metadata: { channelId: channel.id, since: data.since.toISOString() },
    });
    return catchup;
  });
}

/** Le dernier rattrapage d'un canal, pour l'écran des canaux ; null s'il n'y en a jamais eu. */
export function getLatestChannelCatchup(db: TenantDb, channelId: string) {
  return db.channelCatchup.findFirst({
    where: { channelId },
    orderBy: { requestedAt: "desc" },
  });
}

/**
 * Les rattrapages à traiter cette nuit — HORS tenant, comme le drainage de
 * l'outbox (M4.6) : le cron ne connaît aucun compte, il les découvre ici. Les
 * plus anciens d'abord ; seuls les canaux encore connectés.
 */
export async function listDueCatchups(opts: { limit?: number } = {}) {
  return prisma.channelCatchup.findMany({
    where: {
      status: { in: [CatchupStatus.pending, CatchupStatus.running] },
      channel: { is: { config: { is: { status: "connected" } } } },
    },
    orderBy: { requestedAt: "asc" },
    take: opts.limit ?? 20,
    select: {
      id: true,
      accountId: true,
      channelId: true,
      status: true,
      since: true,
      runs: true,
      importDone: true,
      messagesImported: true,
      messagesTriaged: true,
      subjectsOpened: true,
      conversationsIgnored: true,
      costEur: true,
      channel: {
        select: {
          config: { select: { externalAccountId: true } },
        },
      },
    },
  });
}

/** Ouvre une nuit de travail : statut « en cours », une passe de plus. */
export async function startCatchupRun(db: TenantDb, id: string) {
  const catchup = assertFound(
    await db.channelCatchup.findFirst({ where: { id } }),
    "Rattrapage",
  );
  const updated = await db.channelCatchup.update({
    where: { id },
    data: {
      status: CatchupStatus.running,
      startedAt: catchup.startedAt ?? new Date(),
      runs: { increment: 1 },
      lastError: null,
    },
  });
  if (catchup.status === CatchupStatus.pending) {
    await logEvent(db as Tx, {
      entityType: "system",
      entityId: id,
      eventType: EVENT_TYPES.catchupStarted,
      title: "Rattrapage du courrier récent commencé",
      actor: Actor.ai,
      metadata: { channelId: catchup.channelId },
    });
  }
  return updated;
}

export type CatchupProgress = {
  messagesImported?: number;
  messagesTriaged?: number;
  subjectsOpened?: number;
  conversationsIgnored?: number;
  costEur?: number;
  importDone?: boolean;
};

/** Ajoute à l'avancement — les compteurs s'incrémentent, l'import se marque fini. */
export async function recordCatchupProgress(
  db: TenantDb,
  id: string,
  p: CatchupProgress,
) {
  return db.channelCatchup.update({
    where: { id },
    data: {
      ...(p.messagesImported
        ? { messagesImported: { increment: p.messagesImported } }
        : {}),
      ...(p.messagesTriaged
        ? { messagesTriaged: { increment: p.messagesTriaged } }
        : {}),
      ...(p.subjectsOpened
        ? { subjectsOpened: { increment: p.subjectsOpened } }
        : {}),
      ...(p.conversationsIgnored
        ? { conversationsIgnored: { increment: p.conversationsIgnored } }
        : {}),
      ...(p.costEur ? { costEur: { increment: p.costEur } } : {}),
      ...(p.importDone !== undefined ? { importDone: p.importDone } : {}),
    },
  });
}

export type CatchupStopReason =
  | "courrier-epuise"
  | "plafond-messages"
  | "plafond-euros"
  | "nuits-epuisees"
  | "erreur";

/**
 * Clôt un rattrapage : terminé (le courrier de la fenêtre est lu), arrêté au
 * plafond (le reste est trié à la main ou au fil de l'eau), ou en échec.
 * Journalisé avec les compteurs : c'est le bilan du matin.
 */
export async function finishCatchup(
  db: TenantDb,
  id: string,
  outcome: {
    status: "done" | "capped" | "failed";
    reason: CatchupStopReason;
    error?: string | null;
  },
) {
  const updated = await db.channelCatchup.update({
    where: { id },
    data: {
      status: outcome.status,
      finishedAt: new Date(),
      stopReason: outcome.reason,
      lastError: outcome.error?.slice(0, 500) ?? null,
    },
  });
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: id,
    eventType: EVENT_TYPES.catchupFinished,
    title:
      outcome.status === "done"
        ? "Rattrapage du courrier récent terminé"
        : outcome.status === "capped"
          ? "Rattrapage arrêté au plafond"
          : "Rattrapage interrompu",
    description: `${updated.messagesImported} message${updated.messagesImported > 1 ? "s" : ""} lu${updated.messagesImported > 1 ? "s" : ""}, ${updated.subjectsOpened} sujet${updated.subjectsOpened > 1 ? "s" : ""} ouvert${updated.subjectsOpened > 1 ? "s" : ""}, ${updated.conversationsIgnored} mise${updated.conversationsIgnored > 1 ? "s" : ""} en sourdine · ${updated.costEur.toFixed(4)} €`,
    actor: Actor.ai,
    metadata: {
      channelId: updated.channelId,
      reason: outcome.reason,
      messagesImported: updated.messagesImported,
      messagesTriaged: updated.messagesTriaged,
      subjectsOpened: updated.subjectsOpened,
      conversationsIgnored: updated.conversationsIgnored,
      costEur: updated.costEur,
      runs: updated.runs,
    },
  });
  return updated;
}

/** Garde la dernière erreur d'une nuit sans clore : la nuit suivante reprend. */
export function recordCatchupError(db: TenantDb, id: string, error: string) {
  return db.channelCatchup.update({
    where: { id },
    data: { lastError: error.slice(0, 500) },
  });
}

/**
 * Les conversations du canal que le rattrapage doit trier : actives, dernier
 * message ENTRANT, reçu dans la fenêtre, sans sujet, pas encore triées. Les
 * plus anciennes d'abord — le fil du courrier se relit dans l'ordre.
 */
export async function listCatchupCandidates(
  db: TenantDb,
  args: {
    channelId: string;
    since: Date;
    limit: number;
    /** Conversations déjà vues cette nuit — un tri qui a échoué ne se rappelle pas en boucle. */
    exclude?: readonly string[];
  },
): Promise<{ conversationId: string; messageId: string }[]> {
  const rows = await db.conversation.findMany({
    where: {
      channelId: args.channelId,
      status: ConversationStatus.active,
      triagedAt: null,
      ...(args.exclude?.length ? { id: { notIn: [...args.exclude] } } : {}),
      lastMessage: {
        is: {
          subjectId: null,
          direction: MessageDirection.incoming,
          receivedAt: { gte: args.since },
        },
      },
    },
    orderBy: { lastMessageAt: "asc" },
    take: args.limit,
    select: { id: true, lastMessageId: true },
  });
  return rows
    .filter((r): r is { id: string; lastMessageId: string } =>
      Boolean(r.lastMessageId),
    )
    .map((r) => ({ conversationId: r.id, messageId: r.lastMessageId }));
}

/** Combien de candidats restent — pour savoir si la fenêtre est épuisée. */
export function countCatchupCandidates(
  db: TenantDb,
  args: { channelId: string; since: Date },
): Promise<number> {
  return db.conversation.count({
    where: {
      channelId: args.channelId,
      status: ConversationStatus.active,
      triagedAt: null,
      lastMessage: {
        is: {
          subjectId: null,
          direction: MessageDirection.incoming,
          receivedAt: { gte: args.since },
        },
      },
    },
  });
}

/**
 * Parmi des identifiants de messages chez l'agrégateur, ceux DÉJÀ en base sur
 * ce canal : l'import ne relit pas le corps d'un message qu'il a déjà.
 */
export async function listKnownExternalIds(
  db: TenantDb,
  args: { channelId: string; externalIds: string[] },
): Promise<Set<string>> {
  if (args.externalIds.length === 0) return new Set();
  const rows = await db.message.findMany({
    where: { channelId: args.channelId, externalId: { in: args.externalIds } },
    select: { externalId: true },
  });
  return new Set(
    rows.map((r) => r.externalId).filter((x): x is string => Boolean(x)),
  );
}
