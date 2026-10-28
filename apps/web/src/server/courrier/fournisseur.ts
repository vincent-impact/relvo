import type { ChannelProvider } from "@relvo/db";
import type { FournisseurCourrier } from "./types";

// QUEL fournisseur pour ce canal (M24.1) : `ChannelConfig.provider`, lu en
// base, désigne l'implémentation. Les implémentations se déclarent ici, une
// fois ; tout le reste de l'application passe par `fournisseurDe` et ne
// connaît ni Unipile ni Google.
//
// Les implémentations sont chargées à la demande : importer l'agrégateur
// instancie son client, et un script ou un test qui ne s'en sert pas n'a pas
// à le payer.

type Chargeur = () => Promise<FournisseurCourrier>;

const CHARGEURS: Record<ChannelProvider, Chargeur> = {
  unipile: async () =>
    (await import("@/server/unipile/fournisseur")).fournisseurUnipile,
  // Le relais Gmail (M24.2 à M24.6) arrive tranche par tranche : ce qu'il ne
  // sait pas encore faire, il le dit.
  gmail: async () =>
    (await import("@/server/gmail/fournisseur")).fournisseurGmail,
};

const cache = new Map<ChannelProvider, Promise<FournisseurCourrier>>();

export function estUnFournisseur(raw: unknown): raw is ChannelProvider {
  return typeof raw === "string" && raw in CHARGEURS;
}

/**
 * Le fournisseur d'un canal. `raw` est ce que la base garde — tenu par une
 * contrainte de vérification, donc toujours l'un des deux ; un `null` (canal
 * sans configuration, jeu de démonstration) retombe sur l'agrégateur.
 */
export function fournisseurDe(
  raw: string | null | undefined,
): Promise<FournisseurCourrier> {
  const nom: ChannelProvider = estUnFournisseur(raw) ? raw : "unipile";
  let p = cache.get(nom);
  if (!p) {
    p = CHARGEURS[nom]();
    cache.set(nom, p);
  }
  return p;
}

/** Pour les tests : remplace une implémentation par une doublure. */
export function _poserFournisseurPourTest(
  nom: ChannelProvider,
  f: FournisseurCourrier | null,
): void {
  if (f) cache.set(nom, Promise.resolve(f));
  else cache.delete(nom);
}
