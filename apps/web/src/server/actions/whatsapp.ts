"use server";

import {
  type ActionResult,
  type SendWhatsAppReplyInput,
  createChannel,
  err,
  ok,
  sendWhatsAppReply,
  upsertChannelConfig,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";
import {
  appBaseUrl,
  createWhatsAppHostedAuthLink,
  unipileWhatsAppSender,
} from "@/server/unipile";

// Server Actions M6 — connexion d'un compte WhatsApp (hosted auth QR Unipile) et
// envoi sortant dans un fil existant. Calque `actions/email.ts`.

/**
 * Démarre la connexion d'un compte WhatsApp : pré-crée un Channel `whatsapp` + sa
 * config `pending`, puis génère un lien de hosted auth Unipile (écran QR code). Le
 * client redirige vers l'URL renvoyée ; le webhook `notify` finalisera la
 * connexion (externalAccountId + statut connected), comme pour l'email.
 */
export async function connectWhatsAppChannelAction(): Promise<
  ActionResult<{ url: string }>
> {
  const created = await domainAction(async (db) => {
    const channel = await createChannel(db, {
      name: "WhatsApp",
      type: "whatsapp",
      identifier: "En attente de connexion…",
    });
    await upsertChannelConfig(db, channel.id, {
      provider: "unipile",
      status: "pending",
    });
    return channel;
  });
  if (!created.ok) return created;

  const base = appBaseUrl();
  // Le callback notify_url ne porte pas le header custom d'Unipile → on le
  // sécurise par un token en query-string (même secret que les webhooks managés).
  const secret = process.env.UNIPILE_WEBHOOK_SECRET ?? "";
  const notifyUrl = `${base}/api/webhooks/unipile?secret=${encodeURIComponent(secret)}`;
  const url = await createWhatsAppHostedAuthLink({
    channelId: created.data.id,
    notifyUrl,
    successRedirectUrl: `${base}/parametres?tab=canaux&connected=1`,
    failureRedirectUrl: `${base}/parametres?tab=canaux&error=1`,
  });
  if (!url) {
    return err(
      "INVALID_STATE",
      "Intégration WhatsApp non configurée (UNIPILE_DSN / UNIPILE_API_KEY).",
    );
  }

  revalidatePath("/parametres");
  return ok({ url });
}

/** Envoie une réponse WhatsApp dans un fil existant (déclenché par l'utilisateur). */
export async function sendWhatsAppReplyAction(
  input: SendWhatsAppReplyInput,
): Promise<ActionResult<{ id: string }>> {
  const result = await domainAction(async (db) => {
    const message = await sendWhatsAppReply(db, unipileWhatsAppSender, input);
    return { id: message.id };
  });
  if (result.ok) revalidatePath(`/sujets/${input.subjectId}`);
  return result;
}
