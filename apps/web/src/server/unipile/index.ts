import type { EmailSenderPort } from "@relvo/db";
import { sendEmail } from "./client";

// Point d'entrée du module Unipile (M5). Réexporte le client + l'adaptateur qui
// satisfait le port d'envoi du domaine (`EmailSenderPort`) — le domaine ne
// connaît qu'un contrat, jamais Unipile.

export * from "./client";
export * from "./signature";
export * from "./types";
export { toInboundEmail } from "./map";

/** Adaptateur : branche le port domaine sur le client Unipile concret. */
export const unipileEmailSender: EmailSenderPort = {
  sendEmail: ({ externalAccountId, to, subject, body }) =>
    sendEmail({ accountId: externalAccountId, to, subject, body }),
};
