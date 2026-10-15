"use client";

import { useEffect } from "react";
import { useNavScroll } from "@/components/layout/nav-visibility";
import { cn } from "@/lib/utils";

// Conteneur scrollable d'un écran à onglets. Une seule zone de scroll par
// page : le ciel scrolle avec le contenu, et le dock flottant (ancré, absolu)
// le chevauche. Le padding-bas réserve la place du dock et de son disque — ou,
// quand l'écran ancre un composer qui grandit (brouillon posé), la place que ce
// composer occupe (`bottomInset`, mesuré par l'appelant) : le fil doit rester
// lisible et scrollable jusqu'à son dernier message, on ne rédige pas une
// réponse sans pouvoir relire ce à quoi on répond.
//
// `entree` : un écran POUSSÉ (fiche, création, recherche) entre de la droite
// (`.entre-ecran`, 01-tokens « Le mouvement ») ; un onglet du dock, lui, ne
// s'anime pas — on le touche trente fois par jour.

export function Screen({
  children,
  className,
  bottomInset = null,
  entree = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Hauteur (px) de ce qui recouvre le bas de l'écran, quand ce n'est pas le dock. */
  bottomInset?: number | null;
  /** Écran poussé : il entre de la droite. */
  entree?: boolean;
}) {
  const { onScroll, reset } = useNavScroll();
  useEffect(() => reset(), [reset]);
  return (
    <main
      onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
      // `overflow-x-hidden` : l'entrée de la droite déborde de 16 px pendant
      // un quart de seconde, et un conteneur en `auto` offrirait ce débord au
      // défilement.
      className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-background"
    >
      <div
        className={cn(entree && "entre-ecran", className)}
        style={{
          paddingBottom:
            bottomInset != null
              ? `${bottomInset + 12}px`
              : "calc(var(--tab-h) + 20px + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </div>
    </main>
  );
}
