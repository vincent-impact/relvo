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
