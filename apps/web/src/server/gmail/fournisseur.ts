// `@relvo/db/erreurs` et non `@relvo/db` : l'index instancie le client Prisma
// à l'import, et ce module se teste sans base.
import { DomainError } from "@relvo/db/erreurs";
import type { FournisseurCourrier } from "@/server/courrier/types";
import { jetonsDepuisDonnees } from "./jetons";
import { revoquer } from "./oauth";

// Le RELAIS GMAIL, derrière le contrat de la frontière (M24). La boîte se
// connecte et se reconnecte par le consentement de Relvo, ses jetons vivent
// chiffrés dans sa configuration, la suppression du canal révoque l'accès ; le
// courrier arrive par notification (`reception.ts`) et les pièces jointes se
// relisent par l'API. La lecture à la connexion et l'envoi arrivent aux
// tranches suivantes — d'ici là, ils le disent, ils ne se taisent pas.
//
// L'accès (`acces.ts`) et l'API se chargent à la demande : ce module reste
// importable sans base, par les tests de la frontière.

function pasEncore(quoi: string): never {
  throw new DomainError(
    "INVALID_STATE",
    `Le relais Gmail ne sait pas encore ${quoi} — bientôt disponible.`,
  );
}

export const fournisseurGmail: FournisseurCourrier = {
  nom: "gmail",

  async lireRecents() {
    return pasEncore("lire le courrier d'une boîte");
  },

  async lirePieceJointe({ externalAccountId }, { emailId, pieceId }) {
    const [{ jetonDAcces }, { lirePieceJointe }] = await Promise.all([
      import("./acces"),
      import("./api"),
    ]);
    const acces = await jetonDAcces(externalAccountId);
    const bytes = await lirePieceJointe(acces, emailId, pieceId);
    if (!bytes) {
      throw new DomainError(
        "NOT_FOUND",
        "Cette pièce jointe n'existe plus chez Google.",
      );
    }
    // Le type vient de la partie MIME, que le courrier porte déjà (`piece.mime`).
    return { bytes, contentType: null };
  },

  async envoyer() {
    return pasEncore("envoyer un e-mail");
  },

  /**
   * L'état d'une boîte du relais, c'est son ABONNEMENT aux changements : s'il
   * tient, la boîte est connectée ; s'il manque ou expire, on le repose ici
   * même — la page Canaux devient le second filet après le cron du matin — et
   * Google dit alors si l'accès vaut encore. Sans sujet Pub/Sub configuré, le
   * relais ne sait rien de plus que la base. Aucun appel à Google tant que
   * l'abonnement tient.
   */
  async etatDuCompte(externalAccountId) {
    const [
      { donneesDeLaBoite },
      { poserLAbonnement, sujetPubSub },
      { doitRenouveler },
    ] = await Promise.all([
      import("./donnees"),
      import("./abonnement"),
      import("./abonnement-regles"),
    ]);
    if (!sujetPubSub()) return null;
    const b = await donneesDeLaBoite(externalAccountId);
    if (!b) return null;
    if (!doitRenouveler(b.donnees.watchExpireA)) return "connected";
    try {
      await poserLAbonnement(externalAccountId);
      return "connected";
    } catch (err) {
      console.error(
        "[gmail] abonnement non posé depuis la page",
        { externalAccountId },
        err,
      );
      return "error";
    }
  },

  /** L'accès révoqué chez Google, à partir du jeton que la ligne supprimée portait. */
  async supprimerCompte(_externalAccountId, connectionData) {
    let jetons;
    try {
      jetons = jetonsDepuisDonnees(connectionData);
    } catch (err) {
      console.error("[gmail] jetons illisibles à la suppression", err);
      return false;
    }
    if (!jetons) return false;
    // Révoquer le jeton de rafraîchissement révoque tout l'accès accordé.
    return revoquer(jetons.rafraichissement);
  },
};
