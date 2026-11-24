// LES MOTS DU TROU (M25.10) — ce qu'une conversation n'a pas importé pendant
// qu'elle était ignorée, et ce que Relvo a retrouvé à son retour. Fonctions
// pures, côté client comme côté serveur : les dates arrivent déjà formatées.

/** Ce qu'une conversation porte de non importé, prêt à afficher. */
export type TrouData = {
  count: number;
  /** « 3 nov. », ou null si la date n'est pas connue. */
  since: string | null;
};

const messages = (n: number) => (n > 1 ? `${n} messages` : "1 message");

/** Sur une ligne de liste : court, à la suite de la raison. */
export function compteCourt(trou: TrouData): string {
  return trou.count > 1 ? `${trou.count} non importés` : "1 non importé";
}

/** En tête du fil d'une conversation ignorée. */
export function compteLong(trou: TrouData): string {
  const quoi =
    trou.count > 1
      ? `${trou.count} messages n'ont pas été importés`
      : "1 message n'a pas été importé";
  if (!trou.since) return `${quoi}.`;
  // « 3 nov. » porte déjà son point : pas deux.
  const point = trou.since.endsWith(".") ? "" : ".";
  return `${quoi} depuis le ${trou.since}${point}`;
}

/** En tête du fil d'une conversation ACTIVE dont le trou n'a pas été relu. */
export function trouARelire(trou: TrouData): string {
  const quoi =
    trou.count > 1
      ? `${trou.count} messages reçus pendant que cette conversation était ignorée ne sont pas dans Relvo`
      : "1 message reçu pendant que cette conversation était ignorée n'est pas dans Relvo";
  return `${quoi}.`;
}

/** Ce que la relecture a donné — la phrase du toast, après le geste. */
export function phraseDuRetour(retour: {
  attendus: number;
  retrouves: number;
  complet: boolean;
}): string {
  if (!retour.complet) {
    return retour.retrouves > 0
      ? `${messages(retour.retrouves)} retrouvé${retour.retrouves > 1 ? "s" : ""}. La lecture n'est pas terminée : rouvrez la conversation pour la reprendre.`
      : "Les messages reçus entre-temps n'ont pas pu être relus. Rouvrez la conversation pour réessayer.";
  }
  if (retour.retrouves >= retour.attendus) {
    return `${messages(retour.retrouves)} retrouvé${retour.retrouves > 1 ? "s" : ""}.`;
  }
  const manque = retour.attendus - retour.retrouves;
  const reste =
    manque > 1 ? `${manque} n'ont pas pu l'être` : "1 n'a pas pu l'être";
  return retour.retrouves > 0
    ? `${messages(retour.retrouves)} retrouvé${retour.retrouves > 1 ? "s" : ""} sur ${retour.attendus} ; ${reste} (une photo, un vocal ou un message supprimé).`
    : `Aucun des ${messages(retour.attendus)} n'a pu être retrouvé (photos, vocaux ou messages supprimés).`;
}
