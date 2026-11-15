// Ce que l'arbre de la page Sujets ACCEPTE qu'on dépose, et où (M28.3) — la
// règle, pure, que le glisser-déposer consulte à chaque survol : une cible
// interdite n'est pas surlignée, et rien ne s'y dépose. Le domaine refuse de
// toute façon (`moveFolder`, `updateSubject`) ; ceci évite d'offrir un geste
// qui échouerait.

/** Ce qu'on tient : un sujet (et le dossier où il est), ou un dossier. */
export type Glisse =
  | { type: "sujet"; id: string; dossier: string | null }
  | { type: "dossier"; id: string };

/** Où l'on lâche : un dossier, la carte « Sans dossier », ou le premier niveau. */
export type Cible = string | "aucun" | "racine";

export type DossierArbre = {
  id: string;
  /** Le père ; celui d'un premier niveau est Général, absent de la liste. */
  parentId: string | null;
  /** Niveaux sous Général : 1 pour un premier niveau. */
  depth: number;
};

/** Combien de niveaux un dossier occupe, lui compris. */
function hauteur(dossiers: DossierArbre[], id: string): number {
  const fils = dossiers.filter((d) => d.parentId === id);
  return 1 + Math.max(0, ...fils.map((f) => hauteur(dossiers, f.id)));
}

function estDessous(
  dossiers: DossierArbre[],
  id: string,
  ancetre: string,
): boolean {
  const parId = new Map(dossiers.map((d) => [d.id, d]));
  let p = parId.get(id)?.parentId ?? null;
  while (p) {
    if (p === ancetre) return true;
    p = parId.get(p)?.parentId ?? null;
  }
  return false;
}

export function depotPermis(
  glisse: Glisse,
  cible: Cible,
  dossiers: DossierArbre[],
  profondeurMax: number,
): boolean {
  const parId = new Map(dossiers.map((d) => [d.id, d]));
  if (glisse.type === "sujet") {
    // Un sujet va dans un dossier ou hors de tout dossier — jamais « au
    // premier niveau », et jamais là où il est déjà.
    if (cible === "racine") return false;
    if (cible === "aucun") return glisse.dossier != null;
    return parId.has(cible) && cible !== glisse.dossier;
  }
  const moi = parId.get(glisse.id);
  if (!moi) return false;
  // Un dossier n'est jamais « sans dossier », ni dans lui-même.
  if (cible === "aucun" || cible === glisse.id) return false;
  const pere =
    moi.parentId && parId.has(moi.parentId) ? moi.parentId : "racine";
  if (cible === pere) return false;
  if (cible === "racine") return true;
  const dest = parId.get(cible);
  if (!dest) return false;
  if (estDessous(dossiers, cible, glisse.id)) return false;
  return dest.depth + hauteur(dossiers, glisse.id) <= profondeurMax;
}
