"use server";

import {
  type ActionResult,
  type SendEmailReplyInput,
  createChannel,
  err,
  ok,
  sendEmailReply,
  upsertChannelConfig,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";
import {
  appBaseUrl,
  createEmailHostedAuthLink,
  unipileEmailSender,
} from "@/server/unipile";

// Server Actions M5 — connexion d'une boîte email (hosted auth Unipile) et envoi
// sortant depuis la vraie adresse de l'utilisateur.

/**
 * Démarre la connexion d'une boîte email : pré-crée un Channel `email` + sa
 * config `pending`, puis génère un lien de hosted auth Unipile. Le client
 * redirige vers l'URL renvoyée ; le webhook `notify` finalisera la connexion
 * (externalAccountId + statut connected + adresse réelle).
 */
export async function connectEmailChannelAction(): Promise<
  ActionResult<{ url: string }>
> {
  const created = await domainAction(async (db) => {
    const channel = await createChannel(db, {
      name: "Boîte email",
      type: "email",
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
  const url = await createEmailHostedAuthLink({
    channelId: created.data.id,
    notifyUrl,
    successRedirectUrl: `${base}/parametres?tab=canaux&connected=1`,
    failureRedirectUrl: `${base}/parametres?tab=canaux&error=1`,
  });
  if (!url) {
    return err(
      "INVALID_STATE",
      "Intégration email non configurée (UNIPILE_DSN / UNIPILE_API_KEY).",
    );
  }

  revalidatePath("/parametres");
  return ok({ url });
}

/** Envoie une réponse email (brouillon du composer déclenché par l'utilisateur). */
export async function sendEmailReplyAction(
  input: SendEmailReplyInput,
): Promise<ActionResult<{ id: string }>> {
  const result = await domainAction(async (db) => {
    const message = await sendEmailReply(db, unipileEmailSender, input);
    return { id: message.id };
  });
  if (result.ok) revalidatePath(`/sujets/${input.subjectId}`);
  return result;
}
