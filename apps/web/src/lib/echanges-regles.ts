// Les RÈGLES de la mémoire locale des échanges (M10.2, M10.3, M10.4 — 05 §11.2
// à §11.4), pures, tenues par un test : la reprise d'une session en deçà d'un
// court délai, la purge de l'historique, le titre de repli. Le stockage lui-même
// vit dans `echanges-store.ts` ; rien ici ne touche le navigateur.

/** En deçà de ce délai depuis le dernier tour, l'échange en cours se rouvre. */
export const SESSION_REPRISE_MS = 5 * 60 * 1000;
/** Échanges conservés sur l'appareil ; au-delà, les plus anciens sont purgés. */
export const HISTORIQUE_MAX = 10;
/** Longueur du titre d'un échange, de repli comme généré. */
export const TITRE_MAX = 60;

export type EchangeLocal<M = unknown> = {
  id: string;
  /** Généré à la fin du premier tour, sinon le repli. */
  titre: string | null;
  /** ISO 8601. */
  creeLe: string;
  /** ISO 8601 — le dernier tour, du dirigeant ou de Relvo. */
  dernierTourLe: string;
  /** La page d'origine du premier tour, pour la reprendre telle quelle. */
  page: string | null;
  messages: M[];
};

/** La règle des cinq minutes (05 §11.2). */
export function doitReprendre(
  dernierTourLe: string,
  now: number = Date.now(),
): boolean {
  const t = Date.parse(dernierTourLe);
  return Number.isFinite(t) && now - t >= 0 && now - t < SESSION_REPRISE_MS;
}

/** Les plus récents d'abord, bornés à `max` : ce qui dépasse est à supprimer. */
export function purger<T extends { dernierTourLe: string }>(
  echanges: readonly T[],
  max: number = HISTORIQUE_MAX,
): { gardes: T[]; supprimes: T[] } {
  const tries = [...echanges].sort((a, b) =>
    b.dernierTourLe.localeCompare(a.dernierTourLe),
  );
  return { gardes: tries.slice(0, max), supprimes: tries.slice(max) };
}

/** Le titre de repli : les premiers mots du premier tour, bornés. */
export function titreParDefaut(premierTexte: string): string {
  const texte = premierTexte.replace(/\s+/g, " ").trim();
  if (!texte) return "Échange";
  if (texte.length <= TITRE_MAX) return texte;
  const coupe = texte.slice(0, TITRE_MAX);
  const espace = coupe.lastIndexOf(" ");
  return `${(espace > TITRE_MAX / 2 ? coupe.slice(0, espace) : coupe).replace(/[\s,;:.!?]+$/, "")}…`;
}

/** Le titre rendu par le modèle, nettoyé et borné comme le repli. */
export function nettoyerTitre(titre: string): string {
  const t = titre
    .replace(/^["«\s]+|["»\s.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t ? titreParDefaut(t) : "Échange";
}
