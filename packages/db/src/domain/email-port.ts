// Port d'envoi email vu par le domaine (M5.6).
//
// Comme `storage-port.ts`, le domaine ne dépend PAS du fournisseur (Unipile) :
// il déclare le contrat minimal dont il a besoin, et le typage structurel fait
// qu'un adaptateur concret le satisfait sans rien importer. Deux bénéfices :
//   - les tests d'envoi tournent avec un faux sender (aucun credential) ;
//   - aucun couplage db → intégration réseau, donc pas de cycle.
//
// `externalAccountId` = l'identifiant du compte chez le fournisseur (Unipile
// `account_id`), résolu depuis ChannelConfig. C'est lui qui fait partir l'email
// DE la vraie adresse de l'utilisateur.

export type OutboundEmail = {
  externalAccountId: string;
  to: { identifier: string; display_name?: string }[];
  subject: string;
  body: string;
};

export type EmailSenderPort = {
  sendEmail(input: OutboundEmail): Promise<{ emailId: string | null }>;
};
