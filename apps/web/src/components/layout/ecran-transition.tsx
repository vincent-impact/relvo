/// <reference types="react/canary" />
import { ViewTransition } from "react";

// La TRANSITION D'ÉCRAN (M28.4, demandée par le dirigeant à l'essai) : ouvrir
// une fiche la fait ENTRER DE LA DROITE par-dessus la page qu'on quitte, et le
// retour la fait REPARTIR vers la droite, la page d'avant réapparaissant
// dessous. Le bouton retour prend son sens : il défait le geste d'entrée.
//
// Ce sont les transitions de vue du navigateur, pilotées par React : chaque
// écran s'enveloppe ici, et c'est la NAVIGATION qui dit le sens — un lien ou un
// `router.push` porte `ECRAN_POUSSE` (on entre), la flèche retour porte
// `ECRAN_RETOUR`. Sans type, rien ne s'anime : un onglet du dock, un retour au
// geste du système, un premier chargement restent immédiats. Sans support du
// navigateur, la page change comme avant.
//
// Les classes nommées ici sont dessinées dans `globals.css` (« Transition
// d'écran »). Activé par `experimental.viewTransition` (`next.config.ts`).

/** Le type d'une navigation qui POUSSE un écran : il entre de la droite. */
export const ECRAN_POUSSE = "ecran-pousse";
/** Le type d'une navigation de RETOUR : l'écran repart vers la droite. */
export const ECRAN_RETOUR = "ecran-retour";

const ENTREE = {
  [ECRAN_POUSSE]: "ecran-entre",
  [ECRAN_RETOUR]: "ecran-dessous",
  default: "none",
};
const SORTIE = {
  [ECRAN_POUSSE]: "ecran-dessous",
  [ECRAN_RETOUR]: "ecran-sort",
  default: "none",
};

export function EcranTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={ENTREE} exit={SORTIE} default="none">
      {children}
    </ViewTransition>
  );
}
