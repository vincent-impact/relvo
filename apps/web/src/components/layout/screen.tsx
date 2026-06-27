"use client";

import { useEffect } from "react";
import { useNavScroll } from "@/components/layout/nav-visibility";
import { cn } from "@/lib/utils";

// Conteneur scrollable d'un écran à onglets (Direction B). Une seule zone de
// scroll par page : le hero violet scrolle avec le contenu, et le dock Liquid
// Glass (ancré, absolu) le chevauche. Le padding-bas réserve la place du dock.
// Pilote aussi le masquage de la tab bar au scroll (via le contexte de nav).

export function Screen({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { onScroll, reset } = useNavScroll();
  useEffect(() => reset(), [reset]);
  return (
    <main
      onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white"
    >
      <div
        className={cn(className)}
        style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
    </main>
  );
}
