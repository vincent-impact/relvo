"use server";

import {
  type ActionResult,
  type SendWhatsAppReplyInput,
  err,
  isDomainError,
  ok,
  prepareChannelConnection,
  sendWhatsAppReply,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { revalidateTenantData } from "@/server/cached";
import { domainAction } from "@/lib/action-result";
import { relireApresEnvoi } from "@/server/actions/email";
import {
  createWhatsAppHostedAuthLink,
  unipileWhatsAppSender,
} from "@/server/unipile";
import { urlsDeConnexion } from "@/server/unipile/retour";

// Server Actions M6 — connexion d'un compte WhatsApp (hosted auth QR Unipile) et
// envoi sortant dans un fil existant. Calque `actions/email.ts`.

/**
 * Démarre la connexion d'un compte WhatsApp : prépare un Channel `whatsapp` +
 * sa config `pending` — ou reprend celui qu'un retour en arrière a laissé sans
 * compte (PITFALLS #70) —, puis génère un lien de hosted auth Unipile (écran
 * QR code). Le client redirige vers l'URL renvoyée ; le webhook `notify`
 * finalisera la connexion (externalAccountId + statut connected), comme pour
 * l'email.
 */
export async function connectWhatsAppChannelAction(): Promise<
  ActionResult<{ url: string }>
> {
  const created = await domainAction((db) =>
    prepareChannelConnection(db, { type: "whatsapp", name: "WhatsApp" }),
  );
  if (!created.ok) return created;

  try {
    const url = await createWhatsAppHostedAuthLink({
      channelId: created.data.channel.id,
      ...urlsDeConnexion("canaux"),
    });
    if (!url) {
      return err(
        "INVALID_STATE",
        "Intégration WhatsApp non configurée (UNIPILE_DSN / UNIPILE_API_KEY).",
      );
    }
    revalidatePath("/canaux");
    revalidateTenantData();
    return ok({ url });
  } catch (error) {
    if (isDomainError(error)) return err(error.code, error.message);
    return err("INVALID_STATE", "La connexion WhatsApp a échoué.");
  }
}

/** Envoie une réponse WhatsApp dans un fil existant (déclenché par l'utilisateur). */
export async function sendWhatsAppReplyAction(
  input: SendWhatsAppReplyInput,
): Promise<ActionResult<{ id: string }>> {
  const result = await domainAction(async (db) => {
    const message = await sendWhatsAppReply(db, unipileWhatsAppSender, input);
    return { id: message.id };
  });
  if (result.ok) {
    revalidatePath(`/sujets/${input.subjectId}`);
    // Comme l'e-mail : Relvo relit le sujet après l'envoi, hors du chemin de
    // la réponse.
    await relireApresEnvoi(input.subjectId, result.data.id);
  }
  return result;
}
