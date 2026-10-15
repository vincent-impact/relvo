import type { Annulation } from "@relvo/db";

// L'ANNULATION d'un geste de Relvo (M10.10, 05 §11.6), côté écran : la fenêtre
// pendant laquelle « Annuler » reste actif dans le fil. Elle est tenue par
// l'écran seulement — au-delà, le geste reste réversible par les écrans
// habituels, il n'y a donc rien à garder côté serveur. Le descripteur, et ce
// qu'il défait, vivent dans le domaine (`defaireGeste`).

/** Durée pendant laquelle « Annuler » reste actif dans le fil. */
export const FENETRE_ANNULATION_MS = 5 * 60 * 1000;

/** Le bouton reste actif tant que la fenêtre n'est pas passée. */
export function annulable(annulation: Annulation, now = Date.now()): boolean {
  const t = Date.parse(annulation.a);
  return Number.isFinite(t) && now - t < FENETRE_ANNULATION_MS;
}

export type { Annulation };
