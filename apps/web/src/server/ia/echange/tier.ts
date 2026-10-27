// Le TIER PAR TOUR (M10.11, 05 §10.5, §11.8) — « une question factuelle n'a pas
// à payer le prix d'un raisonnement ». Des règles écrites, pures, tenues par
// un test ; jamais un appel de plus pour décider. Mesurées au journal avant
// d'être affinées : le tier voyage dans la mesure de chaque tour.
//
// Factuel = court, une lecture — un compte, une liste, « où en est », « qui » —
// sans verbe d'action ni de rédaction. Tout le reste — un geste à poser, un
// résumé à écrire, une question longue ou composée — passe en raisonnement.

export type TierTour = "extraction" | "raisonnement";

/** Au-delà, un tour n'est plus une question factuelle. */
export const LONGUEUR_FACTUELLE_MAX = 110;

/** Ce qui ouvre une question de lecture. */
// ⚠️ Pas de `\b` après un mot accentué : pour JavaScript, « ù » n'est pas une
// lettre, et « où\b » ne trouve jamais « où en est ». La frontière est écrite.
const FIN_DE_MOT = "(?=[\\s?,:!;.\\-–]|$)";
const DEBUTS_FACTUELS = [
  new RegExp(
    "^(combien|quelles?|quels?|qui|où|quand|qu['’]est[- ]ce|est[- ]ce|y a[- ]t[- ]il|ai[- ]je|dois[- ]je|montre|liste|donne|affiche|cherche|retrouve|trouve)" +
      FIN_DE_MOT,
    "i",
  ),
  new RegExp(
    "^(mes|les)\\s+(affaires|tâches|taches|contacts|urgences|rendez[- ]vous|messages)" +
      FIN_DE_MOT,
    "i",
  ),
];

/** Un geste ou une rédaction : le modèle agit ou écrit, il raisonne. */
const VERBES_ACTION =
  /\b(cr[ée]e[rsz]?|ajoute[rsz]?|pose[rsz]?|pr[ée]pare[rsz]?|r[ée]dige[rsz]?|[ée]cri[st]|marque[rsz]?|valide[rsz]?|ferme[rsz]?|r[ée]gl[ée]e?[rsz]?|supprime[rsz]?|retire[rsz]?|modifie[rsz]?|d[ée]place[rsz]?|mets|range[rsz]?|classe[rsz]?|d[ée]cale[rsz]?|reporte[rsz]?|coche[rsz]?|termine[rsz]?|retiens|note[rsz]?|r[ée]ponds?|relance[rsz]?|annule[rsz]?|change[rsz]?|ouvre[rsz]?|programme[rsz]?|planifie[rsz]?|rappelle[rsz]?|envoie[rsz]?|r[ée]sume[rsz]?|explique[rsz]?|analyse[rsz]?|compare[rsz]?|propose[rsz]?|conseille[rsz]?|que faire|qu['’]en penses)\b/i;

/**
 * Le tier d'un tour, depuis le texte du dirigeant. Un tour sans texte — un
 * tour de suite après un outil — garde le raisonnement.
 */
export function tierDuTour(texte: string | null | undefined): TierTour {
  const t = (texte ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "raisonnement";
  if (t.length > LONGUEUR_FACTUELLE_MAX) return "raisonnement";
  if (VERBES_ACTION.test(t)) return "raisonnement";
  // Deux questions en une, ou une condition : on raisonne.
  if (
    (t.match(/\?/g) ?? []).length > 1 ||
    /\b(si|sinon|puis|ensuite|et après)\b/i.test(t)
  ) {
    return "raisonnement";
  }
  return DEBUTS_FACTUELS.some((re) => re.test(t))
    ? "extraction"
    : "raisonnement";
}

/** Pourquoi un tour s'est arrêté avant la fin, en mot — pour le fil et la mesure. */
export type ArretTour = "plafond" | "longueur";

export function arretDuTour(
  finishReason: string | undefined | null,
): ArretTour | null {
  if (finishReason === "tool-calls") return "plafond";
  if (finishReason === "length") return "longueur";
  return null;
}
