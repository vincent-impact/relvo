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
  isNeverConnected,
  mailProviderOf,
  ok,
  updateChannel,
  upsertChannelConfig,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { revalidateTenantData } from "@/server/cached";
import { domainAction } from "@/lib/action-result";
import { fournisseurDe } from "@/server/courrier";
import {
  createEmailHostedAuthLink,
  createReconnectHostedAuthLink,
  createWhatsAppHostedAuthLink,
  type MailProvider,
} from "@/server/unipile";
import { urlsDeConnexion } from "@/server/unipile/retour";

// Server Actions Channels (M3.6) — onglet Paramètres → Canaux (M5/M6).

function revalidateChannels() {
  revalidatePath("/canaux");
  // Les états vides lisent le nombre de boîtes depuis le cache tenant (M19.9).
  revalidateTenantData();
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
    // le compte chez son fournisseur s'il y en avait un (best-effort, hors
    // transaction) — l'agrégateur ou le relais Gmail, par le même contrat.
    if (result.data.externalAccountId) {
      const fournisseur = await fournisseurDe(result.data.provider);
      await fournisseur.supprimerCompte(result.data.externalAccountId);
    }
    revalidateChannels();
  }
  return result;
}

/**
 * Reconnecte un canal EXISTANT (M6quater) — ré-authentifie le même compte Unipile
 * sans rien supprimer. Résout l'`externalAccountId`, puis renvoie le lien de
 * hosted auth (mode reconnect). Le client redirige ; le webhook `notify`
 * finalise (statut connected). Fonctionne pour email ET WhatsApp (le mode
 * reconnect infère le provider du compte).
 *
 * ⚠️ Le statut stocké n'est PAS touché ici. Il l'était (« en attente ») avant
 * même que l'utilisateur ait vu la page Unipile : un bêta-testeur qui prenait
 * l'icône pour un « rafraîchir » et refermait la page laissait son canal
 * « En attente » pour toujours, courrier livré ou pas (PITFALLS #53). Seul le
 * fournisseur — notify, webhook d'état, ou la réconciliation de la page — dit
 * l'état d'un compte.
 */
export async function reconnectChannelAction(
  channelId: string,
): Promise<ActionResult<{ url: string }>> {
  const found = await domainAction(async (db) => {
    const channel = await db.channel.findFirst({
      where: { id: channelId },
      include: {
        config: { select: { externalAccountId: true, provider: true } },
      },
    });
    if (!channel) throw new DomainError("NOT_FOUND", "Canal introuvable.");
    const externalAccountId = channel.config?.externalAccountId;
    if (!externalAccountId) {
      throw new DomainError(
        "INVALID_STATE",
        "Ce canal n'a jamais été connecté — utilisez « Connecter ».",
      );
    }
    // La page de reconnexion est celle du fournisseur : celle de l'agrégateur
    // ici ; le relais Gmail rouvre son consentement (M24.2).
    if (channel.config?.provider === "gmail") {
      throw new DomainError(
        "INVALID_STATE",
        "Cette boîte Gmail se reconnecte par Google — bientôt disponible.",
      );
    }
    return { externalAccountId };
  });
  if (!found.ok) return found;

  try {
    const url = await createReconnectHostedAuthLink({
      channelId,
      accountId: found.data.externalAccountId,
      ...urlsDeConnexion("canaux"),
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

const MAIL_PROVIDERS: readonly MailProvider[] = ["GOOGLE", "OUTLOOK", "MAIL"];

/**
 * REPREND la connexion d'un canal JAMAIS CONNECTÉ (PITFALLS #70) : l'utilisateur
 * est revenu en arrière de la page du fournisseur, le canal est resté « en
 * attente » sans compte externe. On rouvre la page du fournisseur sur le MÊME
 * canal, avec le fournisseur de messagerie choisi la première fois s'il est
 * connu — sinon Unipile propose les siens. Rien n'est supprimé, rien n'est
 * créé ; le webhook `notify` finalise comme pour une première connexion.
 */
export async function reprendreConnexionAction(
  channelId: string,
): Promise<ActionResult<{ url: string }>> {
  const found = await domainAction(async (db) => {
    const channel = await db.channel.findFirst({
      where: { id: channelId },
      include: { config: true },
    });
    if (!channel) throw new DomainError("NOT_FOUND", "Canal introuvable.");
    if (!isNeverConnected(channel)) {
      throw new DomainError(
        "INVALID_STATE",
        "Ce canal est déjà connecté — utilisez « Reconnecter ».",
      );
    }
    const stocke = mailProviderOf(channel.config);
    const mailProvider = MAIL_PROVIDERS.find((p) => p === stocke);
    return { type: channel.type, mailProvider };
  });
  if (!found.ok) return found;

  try {
    const urls = urlsDeConnexion("canaux");
    const url =
      found.data.type === "whatsapp"
        ? await createWhatsAppHostedAuthLink({ channelId, ...urls })
        : await createEmailHostedAuthLink({
            channelId,
            ...urls,
            provider: found.data.mailProvider,
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
    if (isDomainError(error)) return err(error.code, error.message);
    return err("INVALID_STATE", "La connexion du canal a échoué.");
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
