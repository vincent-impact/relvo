import { z } from "zod";
import { prisma } from "../index";
import {
  Actor,
  CatchupStatus,
  ChannelType,
  ConversationStatus,
  MessageDirection,
  ServiceLevel,
} from "../generated/prisma/enums";
import type { Prisma } from "../generated/prisma/client";
import type { TenantDb, Tx } from "../tenant";
import { assertFound, DomainError } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { jourParis } from "./temps";

// Domaine RATTRAPAGE (M7.19) : « Relvo lit le courrier récent dès la
// connexion ». Ce que le pipeline LIT et ÉCRIT en base autour d'un
// rattrapage : la demande à la connexion d'un canal, le verrou d'une tranche,
// les candidats au tri, l'avancement, la clôture, la reprise nocturne. Le
// pipeline lui-même — import depuis l'agrégateur, tri, garde-fou,
// enchaînement des tranches — vit dans l'application, unique consommateur de
// l'inférence et de l'agrégateur.
//
// Les règles tenues ici :
//   1. UN rattrapage ouvert par canal : demander pendant qu'un autre est en
//      cours ou en attente ne crée rien.
//   2. UNE tranche à la fois par ligne : le verrou se prend par une mise à
//      jour conditionnelle — jamais un SELECT puis un UPDATE —, et un verrou
//      plus vieux que la durée maximale d'une fonction est une tranche morte,
//      que la suivante peut reprendre.
//   3. Un candidat au tri est une conversation ACTIVE du canal dont le dernier
//      message est ENTRANT, reçu dans la fenêtre, sans sujet et pas encore
//      trié — exactement ce que le tri au fil de l'eau aurait traité —, du
//      plus récent au plus ancien : le dirigeant regarde, le récent d'abord.
//   4. Une ligne arrêtée au garde-fou en direct reste REPRENABLE la nuit, au
//      niveau de service « flex » ; une ligne close ne l'est plus.
//   5. Tout changement d'état est journalisé (02, EventLog), avec les
//      compteurs : c'est ce que la carte vivante et l'écran des canaux montrent.

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
      description: `Depuis le ${jourParis(data.since)}`,
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

/** Les statuts d'une ligne OUVERTE en direct : une tranche peut la prendre. */
export const CATCHUP_OPEN_STATUSES = [
  CatchupStatus.pending,
  CatchupStatus.running,
] as const;

/** Les motifs d'arrêt après lesquels la nuit REPREND la ligne, à moitié prix. */
export const CATCHUP_RESUMABLE_REASONS = [
  "plafond-messages",
  "plafond-euros",
] as const;

/**
 * Le rattrapage OUVERT d'un canal — en attente ou en cours —, ou arrêté au
 * garde-fou et reprenable la nuit ; null sinon. C'est ce que le webhook
 * consulte pour laisser un message d'historique à la tranche, et ce que les
 * pages montrent en carte vivante.
 */
export function getOpenCatchup(db: TenantDb, channelId: string) {
  return db.channelCatchup.findFirst({
    where: {
      channelId,
      OR: [
        { status: { in: [...CATCHUP_OPEN_STATUSES] } },
        {
          status: CatchupStatus.capped,
          stopReason: { in: [...CATCHUP_RESUMABLE_REASONS] },
        },
      ],
    },
    orderBy: { requestedAt: "desc" },
  });
}

/** Relvo LIT en ce moment : au moins une ligne en attente ou en cours — ce que le dock respire. */
export function countActiveCatchups(db: TenantDb): Promise<number> {
  return db.channelCatchup.count({
    where: { status: { in: [...CATCHUP_OPEN_STATUSES] } },
  });
}

/** Les rattrapages ouverts ou reprenables du compte, le plus récent d'abord — pour la reprise depuis une page. */
export function listOpenCatchups(db: TenantDb) {
  return db.channelCatchup.findMany({
    where: {
      OR: [
        { status: { in: [...CATCHUP_OPEN_STATUSES] } },
        {
          status: CatchupStatus.capped,
          stopReason: { in: [...CATCHUP_RESUMABLE_REASONS] },
        },
      ],
    },
    orderBy: { requestedAt: "desc" },
    include: { channel: { select: { name: true } } },
  });
}

/**
 * Les rattrapages que le FILET nocturne reprend — HORS tenant, comme le
 * drainage de l'outbox (M4.6) : le cron ne connaît aucun compte, il les
 * découvre ici. Une ligne encore ouverte (une tranche est morte sans relancer
 * la suivante), ou arrêtée au garde-fou avec des nuits devant elle. Les plus
 * anciennes d'abord ; seuls les canaux encore connectés.
 */
const SELECTION_TRANCHE = {
  id: true,
  accountId: true,
  channelId: true,
  status: true,
  stopReason: true,
  since: true,
  requestedAt: true,
  runs: true,
  nightRuns: true,
  trancheStartedAt: true,
  lastTrancheAt: true,
  emptyRounds: true,
  candidatesTotal: true,
  serviceLevel: true,
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
} as const;

export async function listDueCatchups(
  opts: { limit?: number; nuitsMax?: number } = {},
) {
  return prisma.channelCatchup.findMany({
    where: {
      channel: { is: { config: { is: { status: "connected" } } } },
      OR: [
        { status: { in: [...CATCHUP_OPEN_STATUSES] } },
        {
          status: CatchupStatus.capped,
          stopReason: { in: [...CATCHUP_RESUMABLE_REASONS] },
          ...(opts.nuitsMax !== undefined
            ? { nightRuns: { lt: opts.nuitsMax } }
            : {}),
        },
      ],
    },
    orderBy: { requestedAt: "asc" },
    take: opts.limit ?? 20,
    select: SELECTION_TRANCHE,
  });
}

/**
 * Une ligne par son identifiant, dans la forme qu'une tranche attend — HORS
 * tenant, la route de tranche ne connaît que l'identifiant ; null si la ligne
 * n'existe pas ou n'est plus ouverte ni reprenable.
 */
export async function findCatchupForTranche(id: string) {
  return prisma.channelCatchup.findFirst({
    where: {
      id,
      OR: [
        { status: { in: [...CATCHUP_OPEN_STATUSES] } },
        {
          status: CatchupStatus.capped,
          stopReason: { in: [...CATCHUP_RESUMABLE_REASONS] },
        },
      ],
    },
    select: SELECTION_TRANCHE,
  });
}

/**
 * PREND le verrou d'une tranche : une mise à jour conditionnelle — la ligne
 * est ouverte, et aucune tranche vivante ne la tient (verrou absent, ou plus
 * vieux que `trancheMaxMs`, la durée maximale d'une fonction : une tranche
 * morte). Rend la ligne verrouillée, ou null si une autre tranche la tient.
 * Une passe de plus ; la première passe journalise le début.
 */
export async function claimCatchupTranche(
  db: TenantDb,
  id: string,
  opts: { trancheMaxMs: number; now?: Date },
) {
  const now = opts.now ?? new Date();
  const avant = assertFound(
    await db.channelCatchup.findFirst({
      where: { id },
      select: { startedAt: true, channelId: true },
    }),
    "Rattrapage",
  );
  const { count } = await db.channelCatchup.updateMany({
    where: {
      id,
      status: { in: [...CATCHUP_OPEN_STATUSES] },
      OR: [
        { trancheStartedAt: null },
        {
          trancheStartedAt: { lt: new Date(now.getTime() - opts.trancheMaxMs) },
        },
      ],
    },
    data: {
      status: CatchupStatus.running,
      startedAt: avant.startedAt ?? now,
      trancheStartedAt: now,
      runs: { increment: 1 },
      lastError: null,
    },
  });
  if (count === 0) return null;
  if (!avant.startedAt) {
    await logEvent(db as Tx, {
      entityType: "system",
      entityId: id,
      eventType: EVENT_TYPES.catchupStarted,
      title: "Rattrapage du courrier récent commencé",
      actor: Actor.ai,
      metadata: { channelId: avant.channelId },
    });
  }
  return assertFound(
    await db.channelCatchup.findFirst({ where: { id } }),
    "Rattrapage",
  );
}

/** LÈVE le verrou d'une tranche et date sa fin : ce que la reprise et le filet regardent. */
export function releaseCatchupTranche(
  db: TenantDb,
  id: string,
  opts: { now?: Date; error?: string | null } = {},
) {
  return db.channelCatchup.update({
    where: { id },
    data: {
      trancheStartedAt: null,
      lastTrancheAt: opts.now ?? new Date(),
      ...(opts.error !== undefined
        ? { lastError: opts.error?.slice(0, 500) ?? null }
        : {}),
    },
  });
}

/**
 * REPREND la nuit une ligne arrêtée au garde-fou : elle repasse en cours, au
 * niveau « flex », une nuit de plus. Journalisé.
 */
export async function resumeCatchupAtNight(db: TenantDb, id: string) {
  const c = assertFound(
    await db.channelCatchup.findFirst({ where: { id } }),
    "Rattrapage",
  );
  if (c.status !== CatchupStatus.capped) return c;
  const maj = await db.channelCatchup.update({
    where: { id },
    data: {
      status: CatchupStatus.running,
      serviceLevel: ServiceLevel.flex,
      nightRuns: { increment: 1 },
      stopReason: null,
      finishedAt: null,
    },
  });
  await logEvent(db as Tx, {
    entityType: "system",
    entityId: id,
    eventType: EVENT_TYPES.catchupResumed,
    title: "Rattrapage repris la nuit",
    description: `Nuit ${maj.nightRuns}, après « ${c.stopReason} »`,
    actor: Actor.ai,
    metadata: {
      channelId: c.channelId,
      nightRuns: maj.nightRuns,
      previousReason: c.stopReason,
    },
  });
  return maj;
}

export type CatchupProgress = {
  messagesImported?: number;
  messagesTriaged?: number;
  subjectsOpened?: number;
  conversationsIgnored?: number;
  costEur?: number;
  importDone?: boolean;
  /** Les candidats au moment où l'import se ferme : l'avancement en fraction. */
  candidatesTotal?: number | null;
  /** Une passe d'import vide s'ajoute ; une passe qui importe remet à zéro. */
  emptyRounds?: "increment" | "reset";
  serviceLevel?: ServiceLevel;
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
      ...(p.candidatesTotal !== undefined
        ? { candidatesTotal: p.candidatesTotal }
        : {}),
      ...(p.emptyRounds === "increment"
        ? { emptyRounds: { increment: 1 } }
        : p.emptyRounds === "reset"
          ? { emptyRounds: 0 }
          : {}),
      ...(p.serviceLevel ? { serviceLevel: p.serviceLevel } : {}),
    },
  });
}

export type CatchupStopReason =
  | "courrier-epuise"
  | "plafond-messages"
  | "plafond-euros"
  | "tranches-epuisees"
  | "nuits-epuisees"
  | "erreur";

/**
 * Clôt un rattrapage : terminé (le courrier de la fenêtre est lu), arrêté au
 * garde-fou (la nuit reprend, ou le reste est trié à la main ou au fil de
 * l'eau), ou en échec. Journalisé avec les compteurs : c'est le bilan.
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
      trancheStartedAt: null,
      lastTrancheAt: new Date(),
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
    description: `${updated.messagesImported} message${updated.messagesImported > 1 ? "s" : ""} lu${updated.messagesImported > 1 ? "s" : ""}, ${updated.subjectsOpened} affaire${updated.subjectsOpened > 1 ? "s" : ""} ouverte${updated.subjectsOpened > 1 ? "s" : ""}, ${updated.conversationsIgnored} mise${updated.conversationsIgnored > 1 ? "s" : ""} en sourdine · ${updated.costEur.toFixed(4)} €`,
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
      nightRuns: updated.nightRuns,
      serviceLevel: updated.serviceLevel,
    },
  });
  return updated;
}

/** Garde la dernière erreur d'une tranche sans clore : la suivante reprend. */
export function recordCatchupError(db: TenantDb, id: string, error: string) {
  return db.channelCatchup.update({
    where: { id },
    data: { lastError: error.slice(0, 500) },
  });
}

/**
 * Les conversations du canal que le rattrapage doit trier : actives, dernier
 * message ENTRANT, reçu dans la fenêtre, sans sujet, pas encore triées. Les
 * plus RÉCENTES d'abord — le dirigeant regarde, et ce qui vient d'arriver est
 * ce qu'il reconnaît.
 */
export async function listCatchupCandidates(
  db: TenantDb,
  args: {
    channelId: string;
    since: Date;
    limit: number;
    /** Conversations déjà vues cette tranche — un tri qui a échoué ne se rappelle pas en boucle. */
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
    orderBy: { lastMessageAt: "desc" },
    take: args.limit,
    select: { id: true, lastMessageId: true },
  });
  return rows
    .filter((r): r is { id: string; lastMessageId: string } =>
      Boolean(r.lastMessageId),
    )
    .map((r) => ({ conversationId: r.id, messageId: r.lastMessageId }));
}

/** Combien de candidats restent — pour savoir si la fenêtre est épuisée, et pour la fraction. */
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
