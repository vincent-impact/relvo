import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import { ChannelConfigStatus, ChannelType } from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { assertFound, DomainError } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { ensureAffected } from "./helpers";

// Domaine Channels (M3.6). Un Channel est un point d'entrée côté utilisateur
// (boîte mail, numéro WhatsApp). ChannelConfig (1-1) porte la configuration
// technique de connexion, isolée pour ne pas alourdir Channel.

export const createChannelSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(120),
  type: z.enum(ChannelType),
  identifier: z.string().trim().min(1, "Identifiant requis").max(255),
  folderIds: z.array(z.uuid()).optional().default([]),
  isActive: z.boolean().optional(),
});

export const updateChannelSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  identifier: z.string().trim().min(1).max(255).optional(),
  folderIds: z.array(z.uuid()).optional(),
  isActive: z.boolean().optional(),
});

export const channelConfigSchema = z.object({
  provider: z.string().trim().min(1).max(80),
  connectionData: z.record(z.string(), z.unknown()).optional().nullable(),
  status: z.enum(ChannelConfigStatus).optional(),
  lastSyncAt: z.date().optional().nullable(),
});

export type CreateChannelInput = z.input<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
export type ChannelConfigInput = z.infer<typeof channelConfigSchema>;

export function listChannels(db: TenantDb) {
  return db.channel.findMany({
    include: { config: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getChannel(db: TenantDb, id: string) {
  return assertFound(
    await db.channel.findFirst({ where: { id }, include: { config: true } }),
    "Canal",
  );
}

export async function createChannel(db: TenantDb, input: CreateChannelInput) {
  const data = createChannelSchema.parse(input);
  return db.$transaction(async (tx) => {
    const channel = await tx.channel.create({
      data: {
        name: data.name,
        type: data.type,
        identifier: data.identifier,
        folderIds: data.folderIds,
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      } as Prisma.ChannelUncheckedCreateInput,
    });
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: channel.id,
      eventType: EVENT_TYPES.channelCreated,
      title: `Canal « ${channel.name} » connecté`,
      actor: "user",
    });
    return channel;
  });
}

/**
 * Un canal JAMAIS CONNECTÉ chez le fournisseur : pré-créé pour la page de
 * connexion, avec sa configuration mais sans compte externe. C'est l'état
 * d'un canal dont l'utilisateur est revenu en arrière avant la fin — un geste
 * à reprendre, jamais une boîte qui compte (PITFALLS #70). Un canal SANS
 * configuration (le jeu de démonstration) n'a rien à reprendre : il n'en est
 * pas un.
 */
export function isNeverConnected(ch: {
  config: { externalAccountId: string | null } | null;
}): boolean {
  return ch.config != null && !ch.config.externalAccountId;
}

export const prepareChannelConnectionSchema = z.object({
  type: z.enum(ChannelType),
  name: z.string().trim().min(1).max(120),
  /** Le fournisseur de messagerie choisi dans l'application, pour reprendre la même page. */
  mailProvider: z.string().trim().min(1).max(40).optional(),
});
export type PrepareChannelConnectionInput = z.input<
  typeof prepareChannelConnectionSchema
>;

/**
 * PRÉPARE la connexion d'un canal avant d'ouvrir la page du fournisseur : un
 * seul canal par type en V1. S'il en existe un déjà connecté, c'est un
 * conflit ; s'il en existe un jamais connecté — l'utilisateur est revenu en
 * arrière —, c'est LUI qu'on reprend, sous le nom et le fournisseur choisis
 * cette fois, jamais un second à côté (PITFALLS #70). Sinon, le canal et sa
 * configuration `pending` sont créés. Rend le canal et si c'est une reprise.
 */
export async function prepareChannelConnection(
  db: TenantDb,
  input: PrepareChannelConnectionInput,
): Promise<{ channel: { id: string; name: string }; reprise: boolean }> {
  const data = prepareChannelConnectionSchema.parse(input);
  const existants = await db.channel.findMany({
    where: { type: data.type },
    include: { config: { select: { externalAccountId: true } } },
    orderBy: { createdAt: "asc" },
  });
  const connecte = existants.find((c) => !isNeverConnected(c));
  if (connecte) {
    throw new DomainError(
      "CONFLICT",
      data.type === ChannelType.whatsapp
        ? "Un canal WhatsApp est déjà connecté. Supprimez-le pour en connecter un autre."
        : "Une boîte e-mail est déjà connectée. Supprimez-la pour en connecter une autre.",
    );
  }
  const connectionData = data.mailProvider
    ? { mailProvider: data.mailProvider }
    : null;
  const orphelin = existants[0];
  if (orphelin) {
    await db.channel.updateMany({
      where: { id: orphelin.id },
      data: { name: data.name },
    });
    await upsertChannelConfig(db, orphelin.id, {
      provider: "unipile",
      status: ChannelConfigStatus.pending,
      connectionData,
    });
    return { channel: { id: orphelin.id, name: data.name }, reprise: true };
  }
  const channel = await createChannel(db, {
    name: data.name,
    type: data.type,
    identifier: "En attente de connexion…",
  });
  await upsertChannelConfig(db, channel.id, {
    provider: "unipile",
    status: ChannelConfigStatus.pending,
    connectionData,
  });
  return { channel: { id: channel.id, name: channel.name }, reprise: false };
}

/** Le fournisseur de messagerie retenu à la préparation d'un canal, s'il y en a un. */
export function mailProviderOf(
  config: { connectionData: unknown } | null,
): string | null {
  const d = config?.connectionData;
  if (!d || typeof d !== "object") return null;
  const v = (d as { mailProvider?: unknown }).mailProvider;
  return typeof v === "string" && v ? v : null;
}

export async function updateChannel(
  db: TenantDb,
  id: string,
  input: UpdateChannelInput,
) {
  const data = updateChannelSchema.parse(input);
  return db.$transaction(async (tx) => {
    const { count } = await tx.channel.updateMany({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.identifier !== undefined
          ? { identifier: data.identifier }
          : {}),
        ...(data.folderIds !== undefined ? { folderIds: data.folderIds } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    ensureAffected(count, "Canal");
    const channel = assertFound(
      await tx.channel.findFirst({ where: { id } }),
      "Canal",
    );
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: channel.id,
      eventType: EVENT_TYPES.channelUpdated,
      title: `Canal « ${channel.name} » modifié`,
      actor: "user",
    });
    return channel;
  });
}

/**
 * Supprime un canal (Réglages → Canaux). HARD-DELETE assumé : les messages reçus
 * via ce canal — et leurs pièces jointes (→ trigger R2 → cron) — partent en
 * cascade. Tâches/actions/sujets rattachés survivent (FK en SetNull). Renvoie
 * l'`externalAccountId` (compte chez le fournisseur d'intégration) pour que
 * l'appelant puisse aussi supprimer ce compte côté Unipile — le domaine ne
 * connaît pas le transport.
 */
export async function deleteChannel(db: TenantDb, id: string) {
  const channel = assertFound(
    await db.channel.findFirst({ where: { id }, include: { config: true } }),
    "Canal",
  );
  const externalAccountId = channel.config?.externalAccountId ?? null;
  return db.$transaction(async (tx) => {
    // Journalisé AVANT la suppression (l'event n'a pas de FK vers le canal).
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: id,
      eventType: EVENT_TYPES.channelDeleted,
      title: `Canal « ${channel.name} » supprimé`,
      actor: "user",
    });
    const { count } = await tx.channel.deleteMany({ where: { id } });
    ensureAffected(count, "Canal");
    return { id, externalAccountId };
  });
}

/**
 * Crée ou met à jour la configuration technique (1-1) d'un Channel. Vérifie
 * d'abord l'appartenance tenant du canal, puis upsert manuel (la config est
 * scopée via channelId — on passe par find + create/updateMany).
 */
export async function upsertChannelConfig(
  db: TenantDb,
  channelId: string,
  input: ChannelConfigInput,
) {
  const data = channelConfigSchema.parse(input);
  // Garantit que le canal appartient au compte (sinon NOT_FOUND).
  assertFound(
    await db.channel.findFirst({ where: { id: channelId } }),
    "Canal",
  );

  const existing = await db.channelConfig.findFirst({ where: { channelId } });

  return db.$transaction(async (tx) => {
    let config;
    if (existing) {
      const { count } = await tx.channelConfig.updateMany({
        where: { channelId },
        data: {
          provider: data.provider,
          connectionData:
            data.connectionData === undefined
              ? undefined
              : ((data.connectionData ??
                  Prisma.DbNull) as Prisma.InputJsonValue),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.lastSyncAt !== undefined
            ? { lastSyncAt: data.lastSyncAt }
            : {}),
        },
      });
      ensureAffected(count, "Configuration de canal");
      config = assertFound(
        await tx.channelConfig.findFirst({ where: { channelId } }),
        "Configuration de canal",
      );
    } else {
      config = await tx.channelConfig.create({
        data: {
          channelId,
          provider: data.provider,
          connectionData: (data.connectionData ??
            Prisma.DbNull) as Prisma.InputJsonValue,
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.lastSyncAt !== undefined
            ? { lastSyncAt: data.lastSyncAt }
            : {}),
        } as Prisma.ChannelConfigUncheckedCreateInput,
      });
    }
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: channelId,
      eventType: EVENT_TYPES.channelConfigUpdated,
      title: "Configuration de canal mise à jour",
      actor: "system",
      metadata: { status: config.status },
    });
    return config;
  });
}

/**
 * Un message reçu PROUVE que le canal est connecté (M5.8). Le statut stocké
 * n'est qu'un souvenir de ce que le fournisseur a dit — une reconnexion
 * abandonnée, un webhook d'état perdu, et il ment. Appelée par l'ingestion :
 * un canal « en attente » ou « en erreur » qui livre un message repasse
 * « connecté » (`last_sync_at` daté du message). Un canal désactivé par
 * l'utilisateur, lui, ne se rallume pas tout seul. Une seule requête, sans
 * lecture préalable : à coût constant sur le chemin d'un webhook.
 */
export async function confirmChannelConnected(
  db: TenantDb,
  channelId: string,
  at: Date = new Date(),
): Promise<{ healed: boolean }> {
  const { count } = await db.channelConfig.updateMany({
    where: {
      channelId,
      status: { in: [ChannelConfigStatus.pending, ChannelConfigStatus.error] },
    },
    data: { status: ChannelConfigStatus.connected, lastSyncAt: at },
  });
  return { healed: count > 0 };
}

/** Met à jour le statut de connexion d'un canal (last_sync_at, erreurs). */
export async function setChannelConfigStatus(
  db: TenantDb,
  channelId: string,
  status: ChannelConfigStatus,
  lastSyncAt?: Date,
) {
  const { count } = await db.channelConfig.updateMany({
    where: { channelId },
    data: { status, ...(lastSyncAt ? { lastSyncAt } : {}) },
  });
  ensureAffected(count, "Configuration de canal");
  return { channelId, status };
}
