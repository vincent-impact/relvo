import type { EmailSenderPort, WhatsAppSenderPort } from "@relvo/db";
import { sendEmail, sendWhatsAppMessage } from "./client";

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
