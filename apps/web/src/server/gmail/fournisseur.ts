// `@relvo/db/erreurs` et non `@relvo/db` : l'index instancie le client Prisma
// à l'import, et ce module se teste sans base.
import { DomainError } from "@relvo/db/erreurs";
import type { FournisseurCourrier } from "@/server/courrier/types";
import { jetonsDepuisDonnees } from "./jetons";
import { revoquer } from "./oauth";

// Le RELAIS GMAIL, derrière le contrat de la frontière (M24). Tranche 3 : la
// boîte se connecte et se reconnecte par le consentement de Relvo, ses jetons
// vivent chiffrés dans sa configuration, et la suppression du canal révoque
// l'accès. La lecture, les pièces jointes et l'envoi arrivent aux tranches
// suivantes — d'ici là, ils le disent, ils ne se taisent pas.

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

  async lirePieceJointe() {
    return pasEncore("lire une pièce jointe");
  },

  async envoyer() {
    return pasEncore("envoyer un e-mail");
  },

  /**
   * Le relais n'interroge pas Google pour dire l'état d'une boîte : il
   * l'apprend quand un jeton se rafraîchit (tranche 4), et l'écrit alors. Sans
   * réponse ici, la page garde ce qu'elle sait — jamais un appel par canal à
   * chaque affichage.
   */
  async etatDuCompte() {
    return null;
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
