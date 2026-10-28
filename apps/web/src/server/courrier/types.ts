import type {
  ChannelConfigStatus,
  ChannelProvider,
  IngestInboundEmailInput,
  IngestOutboundEmailInput,
  OutboundEmail,
} from "@relvo/db";

// LA FRONTIÈRE DU FOURNISSEUR DE COURRIER (M24.1).
//
// Un seul contrat de courrier entrant, un seul contrat d'envoi, deux
// implémentations : l'agrégateur (`server/unipile/`) et le relais Gmail
// (`server/gmail/`). Tout ce qui suit la réception — rangement, écoute, tri,
// relecture, pièces jointes, lecture à la connexion par tranches — est le même
// code quel que soit le fournisseur ; il ne voit que ces types.
//
// La forme PIVOT d'un courrier est celle du domaine : chaque fournisseur
// fabrique `IngestInboundEmailInput` ou `IngestOutboundEmailInput` depuis sa
// propre matière (un webhook, une ligne d'API), et dit la NATURE du courrier
// — reçu, envoyé, brouillon, écarté — d'après ce qu'il est (#69), jamais
// d'après l'événement qui l'apporte.
//
// Module PUR, sans `server-only` ni valeur de `@relvo/db` : les types seulement,
// pour que les tests unitaires et les scripts l'importent.

export type NatureDuCourrier = "recu" | "envoye" | "brouillon" | "ecarte";

/** Une pièce jointe telle que le fournisseur la nomme — à relire par lui. */
export type PieceJointeRef = {
  id: string;
  name: string | null;
  mime: string | null;
  size: number | null;
};

/** Un courrier lu chez le fournisseur, prêt pour le domaine. */
export type CourrierEntrant =
  | {
      nature: "recu";
      externalId: string;
      /** La date du courrier (ISO), pour reconnaître l'historique d'une lecture ouverte. */
      date: string | null;
      entrant: IngestInboundEmailInput;
      pieces: PieceJointeRef[];
      /** Les en-têtes, clés en minuscules, si le fournisseur les porte. */
      entetes?: Record<string, string>;
    }
  | {
      nature: "envoye";
      externalId: string;
      date: string | null;
      sortant: IngestOutboundEmailInput;
      pieces: PieceJointeRef[];
    }
  | CourrierLaisse<"brouillon">
  | CourrierLaisse<"ecarte">;

/** Un courrier qui n'entre pas — un brouillon, un indésirable, la corbeille. */
export type CourrierLaisse<N extends "brouillon" | "ecarte"> = {
  nature: N;
  externalId: string;
  date: string | null;
  /** Ce qui l'a écarté, pour la réponse du webhook. */
  motif: string | null;
};

/** Une boîte, vue de la frontière : ce qu'il faut pour lire chez le fournisseur et ranger chez nous. */
export type Boite = {
  accountId: string;
  channelId: string;
  /** L'identifiant du compte chez le fournisseur (`ChannelConfig.externalAccountId`). */
  externalAccountId: string;
  /** Nos adresses — celle de la boîte, celle du compte — pour reconnaître un envoi qui ne dit pas son nom. */
  nosAdresses: readonly (string | null | undefined)[];
};

/** Une ligne de liste chez le fournisseur : l'identifiant d'abord, le courrier entier à la demande. */
export type ResumeCourrier = {
  externalId: string;
  lire(): Promise<CourrierEntrant | null>;
};

/**
 * Ce qu'un fournisseur sait faire d'une boîte. Chaque méthode est BEST-EFFORT
 * côté réseau et dit son échec par sa valeur (`null`, `false`) ou par une
 * exception que l'appelant traite ; aucune ne touche la base.
 */
export interface FournisseurCourrier {
  readonly nom: ChannelProvider;
  /** Les e-mails REÇUS depuis une date, page par page (la lecture à la connexion, M7.19). */
  lireRecents(
    boite: Boite,
    args: { after: Date; cursor: string | null; limit: number },
  ): Promise<{ items: ResumeCourrier[]; cursor: string | null }>;
  /** Les octets d'une pièce jointe, pour la ranger dans le stockage. */
  lirePieceJointe(
    boite: Pick<Boite, "externalAccountId">,
    args: { emailId: string; pieceId: string },
  ): Promise<{ bytes: Uint8Array; contentType: string | null }>;
  /** Un e-mail depuis la boîte — le port d'envoi du domaine, implémenté. */
  envoyer(courrier: OutboundEmail): Promise<{ emailId: string | null }>;
  /** L'état du compte chez le fournisseur ; `null` quand il ne le dit pas (#53). */
  etatDuCompte(externalAccountId: string): Promise<ChannelConfigStatus | null>;
  /**
   * Retire la boîte chez le fournisseur (suppression d'un canal, d'un compte).
   * Les données de connexion de la ligne supprimée l'accompagnent : le relais
   * Gmail y lit le jeton à révoquer, l'agrégateur n'en a pas besoin.
   */
  supprimerCompte(
    externalAccountId: string,
    connectionData?: unknown,
  ): Promise<boolean>;
}
