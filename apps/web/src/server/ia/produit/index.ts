import { SOCLE_BATIMENT } from "./batiment";
import { SOCLE_FOOD } from "./food";
import { SOCLE_PRODUIT } from "./socle";

// Assemblage de la couche PRODUIT (`05 §10.1`) : le socle commun, puis un
// socle par secteur du compte, TOUJOURS dans le même ordre — l'ordre fait
// partie du préfixe mis en cache, un ordre instable casse le cache en silence.
//
// Les budgets sont tenus par un test (`test/ia-produit.test.ts`) : la couche
// est partagée entre tous les comptes d'un même secteur, c'est le gain de
// cache le plus sûr, à condition qu'elle ne grossisse pas sans qu'on le voie.

/** Miroir des secteurs d'`Account` (`02`). `autre` ne charge aucun socle. */
export type Secteur = "food" | "batiment" | "autre";

/** Ordre CANONIQUE des socles. Ne jamais dépendre de l'ordre reçu. */
const ORDRE: readonly Exclude<Secteur, "autre">[] = ["food", "batiment"];

const SOCLES: Record<Exclude<Secteur, "autre">, string> = {
  food: SOCLE_FOOD,
  batiment: SOCLE_BATIMENT,
};

/** Estimation grossière — ~3,5 caractères par jeton en français. Sert aux budgets, pas à la facture. */
export function estimerJetons(texte: string): number {
  return Math.ceil(texte.length / 3.5);
}

/** Budgets en jetons, par bloc. Dépassement = test rouge, pas dérive silencieuse. */
export const BUDGET_PRODUIT = {
  socle: 1_000,
  parSecteur: 1_100,
} as const;

export function coucheProduit(secteurs: readonly Secteur[]): string {
  const retenus = ORDRE.filter((s) => secteurs.includes(s));
  return [SOCLE_PRODUIT, ...retenus.map((s) => SOCLES[s])].join("\n\n");
}

export { SOCLE_BATIMENT, SOCLE_FOOD, SOCLE_PRODUIT };
