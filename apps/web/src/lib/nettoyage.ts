// L'INTERRUPTEUR DU NETTOYAGE — module PUR, lu par le serveur comme par
// l'écran : tant qu'il est faux, le cron du matin ne fait que SIMULER le
// nettoyage (`server/nettoyage.ts`), et rien à l'écran ne promet ce qui n'a
// pas lieu — ni la mention en tête d'un fil, ni la date d'effacement d'un
// sujet fermé, ni le paragraphe de la politique de confidentialité.
//
// ⚠️ Le passer à `true` arme le premier passage réel : au cron du matin
// suivant, tout ce qui a dépassé trente jours sans sujet est effacé sur tous
// les comptes, sans retour. Il se décide en regardant la simulation
// (`pnpm --filter web nettoyage:simuler`, ou la page Stockage du backoffice).
// Dans le même commit : la date de mise à jour de la politique de
// confidentialité (`(public)/confidentialite`), dont un paragraphe change.

export const NETTOYAGE_ACTIF = false;
