"use client";

import { useEffect } from "react";
import { useNavScroll } from "@/components/layout/nav-visibility";
import { cn } from "@/lib/utils";

// Conteneur scrollable d'un écran à onglets (Direction B). Une seule zone de
// scroll par page : le hero violet scrolle avec le contenu, et le dock Liquid
// Glass (ancré, absolu) le chevauche. Le padding-bas réserve la place du dock —
// ou, quand l'écran ancre un composer qui grandit (brouillon posé), la place
// que ce composer occupe (`bottomInset`, mesuré par l'appelant) : le fil doit
// rester lisible et scrollable jusqu'à son dernier message, on ne rédige pas
// une réponse sans pouvoir relire ce à quoi on répond.
// Pilote aussi le masquage de la tab bar au scroll (via le contexte de nav).

export function Screen({
  children,
  className,
  bottomInset = null,
}: {
  children: React.ReactNode;
  className?: string;
  /** Hauteur (px) de ce qui recouvre le bas de l'écran, quand ce n'est pas le dock. */
  bottomInset?: number | null;
}) {
  const { onScroll, reset } = useNavScroll();
  useEffect(() => reset(), [reset]);
  return (
    <main
      onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
      className="min-h-0 flex-1 overflow-y-auto bg-background"
    >
      <div
        className={cn(className)}
        style={{
          paddingBottom:
            bottomInset != null
              ? `${bottomInset + 12}px`
              : "calc(92px + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </div>
    </main>
  );
}
