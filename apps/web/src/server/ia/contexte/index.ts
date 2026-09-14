// Assemblage du contexte (M7.3) — le module que le pipeline (M7) et l'échange
// (M10) consomment tous les deux. Cinq couches, trois fiches, une fiche de
// clôture, l'hygiène du message, un profil par sollicitation avec ses budgets.
export * from "./couches";
export * from "./fiches";
export * from "./hygiene";
export * from "./instant";
export * from "./profils";
export * from "./types";
