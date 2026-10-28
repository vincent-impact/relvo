import type { EmailSenderPort } from "@relvo/db";
import { fournisseurDe } from "./fournisseur";

// LE PORT D'ENVOI du domaine, implémenté par la frontière (M24.1) : le domaine
// dit depuis quel compte et par quel fournisseur l'e-mail part ; c'est ici que
// le fournisseur est choisi. `sendEmailReply` ne connaît que ce port.

export const courrierEmailSender: EmailSenderPort = {
  sendEmail: async (courrier) =>
    (await fournisseurDe(courrier.provider)).envoyer(courrier),
};
