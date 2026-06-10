import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import { ChannelConfigStatus, ChannelType } from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { assertFound } from "./errors";
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

export async function deleteChannel(db: TenantDb, id: string) {
  const { count } = await db.channel.deleteMany({ where: { id } });
  ensureAffected(count, "Canal");
  return { id };
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
