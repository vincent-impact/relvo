import type {
  EmailSenderPort,
  WhatsAppChatDirectoryPort,
  WhatsAppSenderPort,
} from "@relvo/db";
import { getChatIdentity, sendEmail, sendWhatsAppMessage } from "./client";

// Point d'entrée du module Unipile (M5/M6). Réexporte le client + les adaptateurs
// qui satisfont les ports d'envoi du domaine (`EmailSenderPort`,
// `WhatsAppSenderPort`) — le domaine ne connaît qu'un contrat, jamais Unipile.

export * from "./client";
export * from "./signature";
export * from "./types";
export { toInboundEmail, toInboundWhatsApp } from "./map";

/** Adaptateur email : branche le port domaine sur le client Unipile concret. */
export const unipileEmailSender: EmailSenderPort = {
  sendEmail: ({ externalAccountId, to, subject, body }) =>
    sendEmail({ accountId: externalAccountId, to, subject, body }),
};

/** Adaptateur WhatsApp : réponse dans un fil existant (chat_id). */
export const unipileWhatsAppSender: WhatsAppSenderPort = {
  sendMessage: ({ chatId, text }) => sendWhatsAppMessage({ chatId, text }),
};

/**
 * Adaptateur d'annuaire de fils (M6bis.7) : c'est par lui que le domaine apprend
 * le nom d'un groupe WhatsApp, sans jamais savoir qu'Unipile existe. `getChatIdentity`
 * est déjà best-effort (renvoie `null` plutôt que de lever), le contrat du port l'est
 * aussi — l'ingestion continue quoi qu'il arrive.
 */
export const unipileChatDirectory: WhatsAppChatDirectoryPort = {
  getChatIdentity: (chatId) => getChatIdentity(chatId),
};
