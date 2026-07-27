"use server";

import {
  type ActionResult,
  type ChannelConfigInput,
  type CreateChannelInput,
  type UpdateChannelInput,
  DomainError,
  createChannel,
  deleteChannel,
  err,
  isDomainError,
  ok,
  updateChannel,
  upsertChannelConfig,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";
import {
  appBaseUrl,
  createReconnectHostedAuthLink,
  deleteUnipileAccount,
} from "@/server/unipile";

// Server Actions Channels (M3.6) — onglet Paramètres → Canaux (M5/M6).

function revalidateChannels() {
  revalidatePath("/parametres");
}

export async function createChannelAction(input: CreateChannelInput) {
  const result = await domainAction((db) => createChannel(db, input));
  if (result.ok) revalidateChannels();
  return result;
}

export async function updateChannelAction(
  id: string,
  input: UpdateChannelInput,
) {
  const result = await domainAction((db) => updateChannel(db, id, input));
  if (result.ok) revalidateChannels();
  return result;
}

export async function deleteChannelAction(id: string) {
  const result = await domainAction((db) => deleteChannel(db, id));
  if (result.ok) {
    // Le canal (et ses messages) ont été supprimés en base ; on déconnecte aussi
    // le compte chez Unipile s'il y en avait un (best-effort, hors transaction).
    if (result.data.externalAccountId) {
      await deleteUnipileAccount(result.data.externalAccountId);
    }
    revalidateChannels();
  }
  return result;
}

/**
 * Reconnecte un canal EXISTANT (M6quater) — ré-authentifie le même compte Unipile
 * sans rien supprimer. Résout l'`externalAccountId`, repasse le canal en attente,
 * puis renvoie le lien de hosted auth (mode reconnect). Le client redirige ; le
 * webhook `notify` finalise (statut connected). Fonctionne pour email ET WhatsApp
 * (le mode reconnect infère le provider du compte).
 */
export async function reconnectChannelAction(
  channelId: string,
): Promise<ActionResult<{ url: string }>> {
  const found = await domainAction(async (db) => {
    const channel = await db.channel.findFirst({
      where: { id: channelId },
      include: { config: { select: { externalAccountId: true } } },
    });
    if (!channel) throw new DomainError("NOT_FOUND", "Canal introuvable.");
    const externalAccountId = channel.config?.externalAccountId;
    if (!externalAccountId) {
      throw new DomainError(
        "INVALID_STATE",
        "Ce canal n'a jamais été connecté — utilisez « Connecter ».",
      );
    }
    // Le temps de la reconnexion, le canal repasse « en attente ».
    await db.channelConfig.updateMany({
      where: { channelId },
      data: { status: "pending" },
    });
    return { externalAccountId };
  });
  if (!found.ok) return found;

  const base = appBaseUrl();
  const secret = process.env.UNIPILE_WEBHOOK_SECRET ?? "";
  const notifyUrl = `${base}/api/webhooks/unipile?secret=${encodeURIComponent(secret)}`;
  try {
    const url = await createReconnectHostedAuthLink({
      channelId,
      accountId: found.data.externalAccountId,
      notifyUrl,
      successRedirectUrl: `${base}/parametres?tab=canaux&connected=1`,
      failureRedirectUrl: `${base}/parametres?tab=canaux&error=1`,
    });
    if (!url) {
      return err(
        "INVALID_STATE",
        "Intégration non configurée (UNIPILE_DSN / UNIPILE_API_KEY).",
      );
    }
    revalidateChannels();
    return ok({ url });
  } catch (error) {
    // Erreur remontée du fournisseur (ex. 401 identifiants Unipile) → toast, pas 500.
    if (isDomainError(error)) return err(error.code, error.message);
    return err("INVALID_STATE", "La reconnexion du canal a échoué.");
  }
}

export async function upsertChannelConfigAction(
  channelId: string,
  input: ChannelConfigInput,
) {
  const result = await domainAction((db) =>
    upsertChannelConfig(db, channelId, input),
  );
  if (result.ok) revalidateChannels();
  return result;
}
