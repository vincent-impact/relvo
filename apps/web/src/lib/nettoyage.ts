// L'INTERRUPTEUR DU NETTOYAGE — module PUR, lu par le serveur comme par
// l'écran. Vrai : le cron du matin passe le nettoyage POUR DE BON
// (`server/nettoyage.ts`), et l'écran le dit — la mention en tête d'un fil, la
// date d'effacement d'un sujet fermé, le paragraphe de la politique de
// confidentialité.
//
// Le remettre à `false` arrête le passage réel — le cron ne fait plus que
// SIMULER — et retire du même coup tout ce que l'écran en promet : rien ne
// doit annoncer un effacement qui n'a pas lieu. Ce qui est déjà effacé ne
// revient pas. Dans le commit qui le bascule, dans un sens ou dans l'autre :
// la date de mise à jour de la politique de confidentialité
// (`(public)/confidentialite`), dont un paragraphe change.

export const NETTOYAGE_ACTIF = true;
