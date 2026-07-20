// Port d'envoi WhatsApp vu par le domaine (M6.5).
//
// Même principe que `email-port.ts` : le domaine ne dépend PAS du fournisseur
// (Unipile) ; il déclare le contrat minimal dont il a besoin, et le typage
// structurel fait qu'un adaptateur concret le satisfait sans rien importer.
//
// Différence avec l'email : WhatsApp répond DANS un fil existant, désigné par le
// `chatId` (le `chat_id` Unipile, stocké dans `Message.externalThreadId` à la
// réception). Le compte est implicite au chat côté Unipile — pas d'account_id à
// passer, contrairement à l'email (`sendMessage({ chat_id, text })`).

export type OutboundWhatsApp = {
  chatId: string;
  text: string;
};

export type WhatsAppSenderPort = {
  sendMessage(input: OutboundWhatsApp): Promise<{ messageId: string | null }>;
};

/**
 * Identité d'un fil WhatsApp telle que le domaine sait la lire (M6bis.7) : le
 * NOM du fil (le nom du groupe, absent du webhook) et son TYPE, celui-ci faisant
 * autorité — l'API expose un `Chat.type` explicite (0 = SINGLE, 1 = GROUP,
 * 2 = CHANNEL), là où le `is_group` du webhook n'a jamais été confirmé contre un
 * vrai payload.
 */
export type WhatsAppChatIdentity = {
  name: string | null;
  isGroup: boolean;
};

/**
 * Port de CONSULTATION d'un fil, pendant lecture du port d'envoi. Le domaine
 * déclare le contrat, l'adaptateur (`apps/web/src/server/unipile`) le satisfait
 * par typage structurel — `packages/db` continue d'ignorer jusqu'au nom
 * d'Unipile.
 *
 * Contrat BEST-EFFORT, et c'est structurel : `null` (ou une exception) signifie
 * seulement « je n'ai pas su lire ce fil ». L'ingestion doit se poursuivre.
 * Perdre un nom de groupe est un désagrément, perdre le message serait une faute.
 */
export type WhatsAppChatDirectoryPort = {
  getChatIdentity(chatId: string): Promise<WhatsAppChatIdentity | null>;
};
