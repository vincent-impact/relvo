import type { Boite, FournisseurCourrier } from "@/server/courrier/types";
import {
  deleteUnipileAccount,
  fetchAttachment,
  getAccount,
  getEmail,
  listInboxEmails,
  sendEmail,
} from "./client";
import { courrierDepuisUnipile } from "./courrier";
import { apiMailToWebhook, doitRelireEmail } from "./map";

// L'AGRÉGATEUR, derrière le contrat de la frontière (M24.1). Il garde WhatsApp
// et les boîtes qui ne sont pas Gmail ; pour l'e-mail, c'est l'une des deux
// implémentations de `FournisseurCourrier`, et rien de ce module n'est connu
// au-delà de `server/unipile/`.

export const fournisseurUnipile: FournisseurCourrier = {
  nom: "unipile",

  async lireRecents(boite: Boite, { after, cursor, limit }) {
    const page = await listInboxEmails({
      accountId: boite.externalAccountId,
      after,
      cursor,
      limit,
    });
    return {
      cursor: page.cursor,
      items: page.items.map((item) => ({
        externalId: item.id,
        // La liste ne porte pas toujours le corps, ni le détail des pièces
        // jointes qu'elle annonce : on relit alors l'e-mail entier.
        lire: async () => {
          const complet = doitRelireEmail(item)
            ? await getEmail(item.id)
            : item;
          if (!complet) return null;
          return courrierDepuisUnipile(
            apiMailToWebhook({
              ...complet,
              account_id: complet.account_id || boite.externalAccountId,
            }),
            boite,
          );
        },
      })),
    };
  },

  lirePieceJointe({ externalAccountId }, { emailId, pieceId }) {
    return fetchAttachment({
      accountId: externalAccountId,
      emailId,
      attachmentId: pieceId,
    });
  },

  envoyer({ externalAccountId, to, subject, body }) {
    return sendEmail({ accountId: externalAccountId, to, subject, body });
  },

  async etatDuCompte(externalAccountId) {
    return (await getAccount(externalAccountId))?.status ?? null;
  },

  supprimerCompte(externalAccountId) {
    return deleteUnipileAccount(externalAccountId);
  },
};
