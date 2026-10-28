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
import { courrierEmailSender } from "@/server/courrier";
import type { RetourConnexion } from "@/server/courrier/retour";
import { demarrerConnexionGmail } from "@/server/gmail/connexion";
import { gmailConfigure } from "@/server/gmail/oauth";

// Server Actions M5/M24 — connexion d'une boîte e-mail et envoi sortant depuis
// la vraie adresse de l'utilisateur.

/**
 * Démarre la connexion d'une boîte e-mail — par le RELAIS GMAIL, et par lui
 * seul (M24.2 ; `ecarts`, « L'e-mail, c'est Gmail ») : prépare un canal
 * `email` de fournisseur `gmail` et sa configuration `pending` — ou REPREND
 * celui qu'un retour en arrière a laissé sans compte (PITFALLS #70), jamais un
 * second —, pose l'état du consentement et rend l'URL de Google. Le client y
 * redirige ; `/api/gmail/retour` finalise (adresse, jetons chiffrés, statut
 * connecté). `retour` : la page où l'utilisateur revient — Canaux, ou l'échange
 * quand c'est la prise en main qui demande la boîte (05 §11.11).
 */
export async function connectEmailChannelAction(
  retour: RetourConnexion = "canaux",
): Promise<ActionResult<{ url: string }>> {
  if (!gmailConfigure()) {
    return err(
      "INVALID_STATE",
      "Le relais Gmail n'est pas configuré (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET).",
    );
  }
  const created = await domainAction((db) =>
    prepareChannelConnection(db, {
      type: "email",
      name: "Boîte Gmail",
      provider: "gmail",
    }),
  );
  if (!created.ok) return created;

  try {
    const url = await demarrerConnexionGmail({
      channelId: created.data.channel.id,
      retour,
    });
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
    const message = await sendEmailReply(db, courrierEmailSender, input);
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
