import type { ChannelProvider } from "./channels";

// Port d'envoi email vu par le domaine (M5.6).
//
// Comme `storage-port.ts`, le domaine ne dépend PAS du fournisseur (Unipile) :
// il déclare le contrat minimal dont il a besoin, et le typage structurel fait
// qu'un adaptateur concret le satisfait sans rien importer. Deux bénéfices :
//   - les tests d'envoi tournent avec un faux sender (aucun credential) ;
//   - aucun couplage db → intégration réseau, donc pas de cycle.
//
// `externalAccountId` = l'identifiant du compte chez le fournisseur (Unipile
// `account_id`, l'adresse d'une boîte Gmail), résolu depuis ChannelConfig, et
// `provider` dit QUEL fournisseur (M24.1) : l'adaptateur de l'application
// choisit l'implémentation. C'est ce qui fait partir l'email DE la vraie
// adresse de l'utilisateur.

export type OutboundEmail = {
  /** Le fournisseur derrière le canal (M24.1) : c'est lui qui envoie. */
  provider: ChannelProvider;
  externalAccountId: string;
  to: { identifier: string; display_name?: string }[];
  subject: string;
  body: string;
  /**
   * Le message auquel on répond, tel que le fournisseur le nomme — le dernier
   * reçu de la conversation sur ce canal —, pour que la réponse parte DANS le
   * fil (M24.5 : `threadId`, `In-Reply-To`, `References`). Absent quand on
   * écrit le premier.
   */
  enReponseA?: { externalId: string; externalThreadId: string | null } | null;
};

export type EmailSenderPort = {
  sendEmail(input: OutboundEmail): Promise<{ emailId: string | null }>;
};
