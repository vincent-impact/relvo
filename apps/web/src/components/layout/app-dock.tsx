"use client";

import { usePathname } from "next/navigation";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";

// Le dock — la SEULE barre d'onglets, noire et flottante : décollée du bas et
// des bords de `--dock-marge`, au-dessus de la zone sûre iOS. Le padding-bas
// du <Screen> réserve sa hauteur et le débord du disque.
//
// Le dock cède la place sur le DÉTAIL d'une conversation (`/conversations/x`),
// où le composer de réponse ou les boutons « Ignorer » / « Ouvrir une affaire »
// prennent son ancrage. L'échange (`/relvo`) et les premiers pas (`/bienvenue`)
// vivent hors du groupe `(app)` et n'ont pas de dock. Les LISTES et les fiches
// (affaire, contact en carte de visite) gardent le dock.

export function AppDock() {
  const pathname = usePathname();
  if (/^\/conversations\/[^/]+$/.test(pathname)) return null;

  return (
    <div
      className="absolute inset-x-(--dock-marge) z-20"
      style={{
        bottom: "calc(var(--dock-marge) + env(safe-area-inset-bottom))",
      }}
    >
      <BottomTabBar />
    </div>
  );
}
