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

/** Miroir de l'énuméré `Sector` (Prisma). `other` ne charge aucun socle. */
export type Secteur = "food" | "construction" | "other";

/** Ordre CANONIQUE des socles. Ne jamais dépendre de l'ordre reçu. */
const ORDRE: readonly Exclude<Secteur, "other">[] = ["food", "construction"];

const SOCLES: Record<Exclude<Secteur, "other">, string> = {
  food: SOCLE_FOOD,
  construction: SOCLE_BATIMENT,
};

/** Estimation grossière — ~3,5 caractères par jeton en français. Sert aux budgets, pas à la facture. */
export function estimerJetons(texte: string): number {
  return Math.ceil(texte.length / 3.5);
}

/** Budgets en jetons, par bloc. Dépassement = test rouge, pas dérive silencieuse. */
// Le socle a grossi d'un bloc délibéré : la nature de l'avis, le cadre du
// message reçu (l'expéditeur est un tiers) et la règle du rattachement — ce
// qui a corrigé les premiers avis réels. Chaque jeton du socle est payé par
// tous les comptes : on ne relève ce budget qu'avec un motif de cette taille.
export const BUDGET_PRODUIT = {
  socle: 1_400,
  parSecteur: 1_100,
} as const;

export function coucheProduit(secteurs: readonly Secteur[]): string {
  const retenus = ORDRE.filter((s) => secteurs.includes(s));
  return [SOCLE_PRODUIT, ...retenus.map((s) => SOCLES[s])].join("\n\n");
}

export { SOCLE_BATIMENT, SOCLE_FOOD, SOCLE_PRODUIT };
