import { RATTRAPAGE } from "../config";
import type { CatchupStopReason } from "@relvo/db";

// Les RÈGLES du rattrapage (M7.19), pures et testées sans base : la fenêtre
// lue, la reconnaissance d'un message d'historique, le motif d'arrêt. Le
// webhook et le pipeline les partagent ; ni l'un ni l'autre ne les redéfinit.

/** Un message plus vieux que le délai est de l'historique synchronisé, pas du courrier vivant. */
export function estHistorique(
  dateIso: string | null | undefined,
  delaiMs: number,
  maintenant: number = Date.now(),
): boolean {
  if (!dateIso) return false;
  const t = new Date(dateIso).getTime();
  if (Number.isNaN(t)) return false;
  return maintenant - t > delaiMs;
}

/** Le début de la fenêtre lue à la connexion. */
export function fenetreDeRattrapage(
  maintenant: Date = new Date(),
  jours: number = RATTRAPAGE.fenetreJours,
): Date {
  return new Date(maintenant.getTime() - jours * 86_400_000);
}

export type EtatRattrapage = {
  messagesTriaged: number;
  costEur: number;
  runs: number;
};

/**
 * Décide si le rattrapage doit s'arrêter, et pourquoi — la règle en un seul
 * endroit, pure, testée : plafond de messages, plafond d'euros, nuits épuisées.
 * Null : on continue.
 */
export function motifDArret(
  etat: EtatRattrapage,
  plafonds: {
    messages: number;
    euros: number;
    nuits: number;
  } = {
    messages: RATTRAPAGE.plafondMessages,
    euros: RATTRAPAGE.plafondEuros,
    nuits: RATTRAPAGE.nuitsMax,
  },
): Exclude<CatchupStopReason, "courrier-epuise" | "erreur"> | null {
  if (etat.messagesTriaged >= plafonds.messages) return "plafond-messages";
  if (etat.costEur >= plafonds.euros) return "plafond-euros";
  if (etat.runs > plafonds.nuits) return "nuits-epuisees";
  return null;
}
