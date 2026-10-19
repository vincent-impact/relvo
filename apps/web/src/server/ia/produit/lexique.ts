import type { Secteur } from "./index";

// Le LEXIQUE d'un secteur pour la dictée (M22.4) — les mots que le dirigeant
// prononce et qu'un modèle de transcription généraliste écrit mal : sigles,
// enseignes, termes de métier. Court, stable, par secteur ; il entre dans le
// prompt de transcription après les noms du compte, jamais dans le contexte
// des autres sollicitations (le socle du secteur, lui, est en prose).

export const LEXIQUE: Readonly<
  Record<Exclude<Secteur, "other">, readonly string[]>
> = {
  food: [
    "DLC",
    "DDM",
    "PLU",
    "HACCP",
    "Metro",
    "Transgourmet",
    "Promocash",
    "Brake",
    "Sysco",
    "chambre froide",
    "extracteur",
    "friteuse",
    "food truck",
    "Uber Eats",
    "Deliveroo",
    "URSSAF",
    "Kbis",
  ],
  construction: [
    "devis",
    "DPGF",
    "DOE",
    "PV de réception",
    "Qualibat",
    "RGE",
    "BTP",
    "Point P",
    "Cedeo",
    "Rexel",
    "Leroy Merlin",
    "chantier",
    "sous-traitant",
    "décennale",
    "retenue de garantie",
    "URSSAF",
    "Kbis",
  ],
};

/** Les mots des secteurs du compte, dans un ordre stable, sans doublon. */
export function lexiqueDe(secteurs: readonly Secteur[]): string[] {
  const mots: string[] = [];
  for (const s of ["food", "construction"] as const) {
    if (!secteurs.includes(s)) continue;
    for (const m of LEXIQUE[s]) if (!mots.includes(m)) mots.push(m);
  }
  return mots;
}
