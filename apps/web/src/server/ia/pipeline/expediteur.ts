import type { ExpediteurContexte } from "../contexte";

// CE QUE L'EXPÉDITEUR DÉCIDE SANS APPEL (M7, `05 §9.5` cinquième dispositif,
// `05 §1.2`). Notre meilleure information n'est pas dans le message, elle est
// dans ce que la base sait de qui l'envoie. Deux règles, prudentes, PURES :
//
//   1. UNE SOURCE DÉJÀ ÉCARTÉE. Une adresse dont les fils ont été ignorés
//      plusieurs fois pour une même raison — publicité, automatique,
//      personnel — passe en sourdine sans appel, avec cette raison, et la
//      mention du nombre. Réversible d'un appui : réactiver un fil retire son
//      ignorance du compte, et la règle se désarme d'elle-même.
//   2. UN SEUL SUJET ATTEND SA RÉPONSE. Un contact CONNU, avec qui exactement
//      un sujet est ouvert, ce sujet marqué « en attente d'une réponse » et
//      actif récemment : son nouveau fil est ce qu'on attendait, il est
//      rattaché. La relecture (tranche 6) lira ce qu'il dit.
//
// Tout le reste va au modèle — avec le profil sous les yeux.

/** Ignorances pour une même raison à partir desquelles la source est écartée sans appel. */
export const SEUIL_SOURCE_ECARTEE = 3;
/** Un sujet en attente plus ancien que cela n'attend plus vraiment. */
export const FENETRE_ATTENTE_JOURS = 30;

/** Les raisons qui font une source à écarter — jamais celles que seul l'utilisateur connaît. */
const RAISONS_ECARTABLES = new Set([
  "advertising",
  "prospecting",
  "automatic",
  "personal",
]);

export type DecisionExpediteur =
  | { type: "ignorer"; raison: string; nombre: number }
  | { type: "rattacher"; reference: string; titre: string }
  | null;

export function deciderParExpediteur(
  e: ExpediteurContexte,
  maintenant: Date = new Date(),
): DecisionExpediteur {
  const ecartee = e.antecedentsTri.find(
    (a) => RAISONS_ECARTABLES.has(a.raison) && a.nombre >= SEUIL_SOURCE_ECARTEE,
  );
  if (ecartee) {
    return { type: "ignorer", raison: ecartee.raison, nombre: ecartee.nombre };
  }

  if (e.connu && e.sujetsEnCours.length === 1) {
    const [s] = e.sujetsEnCours;
    const recent =
      s.derniereActiviteLe !== null &&
      maintenant.getTime() - Date.parse(s.derniereActiviteLe) <=
        FENETRE_ATTENTE_JOURS * 86_400_000;
    if (s.enAttente && recent) {
      return { type: "rattacher", reference: s.reference, titre: s.titre };
    }
  }
  return null;
}

/** Nature de l'avis quand une source est écartée par ses antécédents. */
export const NATURE_DE_LA_RAISON: Record<
  string,
  "publicite" | "automatique" | "personnel"
> = {
  advertising: "publicite",
  prospecting: "publicite",
  automatic: "automatique",
  personal: "personnel",
};
