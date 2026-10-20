import { RATTRAPAGE } from "../config";
import type { CatchupStopReason } from "@relvo/db";

// Les RÈGLES du rattrapage (M7.19), pures et testées sans base : la fenêtre
// lue, la reconnaissance d'un message d'historique, le motif d'arrêt, la
// clôture sur courrier épuisé, la panne d'une ligne. Le webhook, le pipeline,
// les pages et le filet les partagent ; aucun ne les redéfinit.

/**
 * Un message daté d'AVANT la demande d'un rattrapage ouvert sur le canal est de
 * l'historique synchronisé par l'agrégateur, pas du courrier vivant : rangé,
 * laissé à la tranche. Une date absente ou illisible est du courrier vivant.
 */
export function estHistorique(
  dateIso: string | null | undefined,
  requestedAt: Date,
): boolean {
  if (!dateIso) return false;
  const t = new Date(dateIso).getTime();
  if (Number.isNaN(t)) return false;
  return t < requestedAt.getTime();
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
 * endroit, pure, testée : garde-fou en messages, en euros, en tranches.
 * Null : on continue.
 */
export function motifDArret(
  etat: EtatRattrapage,
  plafonds: {
    messages: number;
    euros: number;
    tranches: number;
  } = {
    messages: RATTRAPAGE.plafondMessages,
    euros: RATTRAPAGE.plafondEuros,
    tranches: RATTRAPAGE.tranchesMax,
  },
): Exclude<
  CatchupStopReason,
  "courrier-epuise" | "erreur" | "nuits-epuisees"
> | null {
  if (etat.messagesTriaged >= plafonds.messages) return "plafond-messages";
  if (etat.costEur >= plafonds.euros) return "plafond-euros";
  if (etat.runs > plafonds.tranches) return "tranches-epuisees";
  return null;
}

/**
 * La ligne peut-elle se clore « courrier épuisé » ? Il faut que l'import ait
 * rendu assez de passes VIDES de suite, que la demande soit assez ANCIENNE —
 * l'agrégateur synchronise l'historique en un temps qu'on ne connaît pas —,
 * et qu'aucun candidat ne reste à trier.
 */
export function peutClore(
  etat: {
    emptyRounds: number;
    requestedAt: Date;
    restants: number;
  },
  maintenant: Date = new Date(),
  regles: { passesVides: number; attenteSyncMs: number } = {
    passesVides: RATTRAPAGE.passesVidesPourClore,
    attenteSyncMs: RATTRAPAGE.attenteSyncMs,
  },
): boolean {
  if (etat.restants > 0) return false;
  if (etat.emptyRounds < regles.passesVides) return false;
  return (
    maintenant.getTime() - etat.requestedAt.getTime() >= regles.attenteSyncMs
  );
}

/**
 * Une ligne ouverte est EN PANNE quand aucune tranche ne la tient (verrou
 * absent ou mort) et que sa dernière tranche — ou sa demande, s'il n'y en a
 * jamais eu — date de plus du délai de relance : une page qui la voit, ou le
 * filet, relance une tranche.
 */
export function estEnPanne(
  ligne: {
    status: string;
    trancheStartedAt: Date | null;
    lastTrancheAt: Date | null;
    requestedAt: Date;
  },
  maintenant: Date = new Date(),
  regles: { relanceApresMs: number; trancheMaxMs: number } = {
    relanceApresMs: RATTRAPAGE.relanceApresMs,
    trancheMaxMs: RATTRAPAGE.trancheMaxMs,
  },
): boolean {
  if (ligne.status !== "pending" && ligne.status !== "running") return false;
  const t = maintenant.getTime();
  if (
    ligne.trancheStartedAt &&
    t - ligne.trancheStartedAt.getTime() < regles.trancheMaxMs
  ) {
    return false;
  }
  const dernier = (ligne.lastTrancheAt ?? ligne.requestedAt).getTime();
  return t - dernier >= regles.relanceApresMs;
}
