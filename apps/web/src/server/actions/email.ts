"use server";

import {
  type ActionResult,
  type SendEmailReplyInput,
  err,
  isDomainError,
  ok,
  prepareChannelConnection,
  sendEmailReply,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { domainAction } from "@/lib/action-result";
import { revalidateTenantData } from "@/server/cached";
import { getCurrentAccountId } from "@/server/auth-context";
import { relireSujet } from "@/server/ia/pipeline/relecture";
import {
  createEmailHostedAuthLink,
  type MailProvider,
  unipileEmailSender,
} from "@/server/unipile";
import { type RetourConnexion, urlsDeConnexion } from "@/server/unipile/retour";

// Libellé de canal par provider (le vrai nom sera remplacé par l'adresse réelle
// une fois la connexion finalisée par le webhook `notify`).
const PROVIDER_LABEL: Record<MailProvider, string> = {
  GOOGLE: "Gmail",
  OUTLOOK: "Outlook",
  MAIL: "Boîte email (IMAP)",
};

// Server Actions M5 — connexion d'une boîte email (hosted auth Unipile) et envoi
// sortant depuis la vraie adresse de l'utilisateur.

/**
 * Démarre la connexion d'une boîte email : prépare un Channel `email` + sa
 * config `pending` — ou REPREND celui qu'un retour en arrière a laissé sans
 * compte (PITFALLS #70), jamais un second —, puis génère un lien de hosted
 * auth Unipile. Le client redirige vers l'URL renvoyée ; le webhook `notify`
 * finalisera la connexion (externalAccountId + statut connected + adresse
 * réelle). `retour` : la page où l'utilisateur revient — Canaux, ou l'échange
 * quand c'est la prise en main qui demande la boîte (05 §11.11).
 */
export async function connectEmailChannelAction(
  provider?: MailProvider,
  retour: RetourConnexion = "canaux",
): Promise<ActionResult<{ url: string }>> {
  const created = await domainAction((db) =>
    prepareChannelConnection(db, {
      type: "email",
      name: provider ? PROVIDER_LABEL[provider] : "Boîte email",
      mailProvider: provider,
    }),
  );
  if (!created.ok) return created;

  try {
    const url = await createEmailHostedAuthLink({
      channelId: created.data.channel.id,
      ...urlsDeConnexion(retour),
      provider,
    });
    if (!url) {
      return err(
        "INVALID_STATE",
        "Intégration email non configurée (UNIPILE_DSN / UNIPILE_API_KEY).",
      );
    }
    revalidatePath("/canaux");
    // Les états vides lisent le nombre de boîtes depuis le cache tenant
    // (M19.9) : une boîte reliée doit cesser d'être demandée tout de suite.
    revalidateTenantData();
    return ok({ url });
  } catch (error) {
    if (isDomainError(error)) return err(error.code, error.message);
    return err("INVALID_STATE", "La connexion de la boîte email a échoué.");
  }
}

/**
 * Envoie une réponse email (brouillon du composer déclenché par l'utilisateur).
 * La tâche de réponse et le marqueur « En attente » suivent mécaniquement
 * (`createMessage`) ; puis, APRÈS la réponse à l'écran, Relvo RELIT le sujet à
 * la lumière de ce qui vient de partir — c'est ce qui fait dire à la fiche
 * « En attente : … » plutôt que « valider le devis » une fois le devis validé.
 * L'échec de la relecture ne touche pas à l'envoi, déjà fait.
 */
export async function sendEmailReplyAction(
  input: SendEmailReplyInput,
): Promise<ActionResult<{ id: string }>> {
  const result = await domainAction(async (db) => {
    const message = await sendEmailReply(db, unipileEmailSender, input);
    return { id: message.id };
  });
  if (result.ok) {
    revalidatePath(`/sujets/${input.subjectId}`);
    await relireApresEnvoi(input.subjectId, result.data.id);
  }
  return result;
}

/** Relecture du sujet après un envoi, hors du chemin de la réponse (le compte se lit AVANT le différé). */
export async function relireApresEnvoi(subjectId: string, messageId: string) {
  const accountId = await getCurrentAccountId();
  if (!accountId) return;
  after(async () => {
    const resultat = await relireSujet({ accountId, subjectId, messageId });
    console.info("[ia] relecture après envoi", {
      accountId,
      messageId,
      ...resultat,
    });
  });
}
