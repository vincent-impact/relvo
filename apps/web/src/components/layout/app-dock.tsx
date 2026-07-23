"use client";

import { usePathname } from "next/navigation";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";

// Dock bas (Direction B) — désormais la SEULE barre d'onglets, violette et fixe,
// ancrée au bas du cadre. L'ancien composer Relvo persistant a été retiré :
// l'accès à Relvo vit en haut à droite du header (cf. RelvoHeaderButton). Le
// padding-bas du <Screen> réserve la hauteur de la barre.
//
// EXCEPTION (2026-07-23) : sur le DÉTAIL d'une conversation (`/conversations/x`),
// le dock cède la place aux boutons d'action « Ignorer » / « Ouvrir un sujet »
// (rendus par ConversationDetail, mêmes ancrage et hauteur). La LISTE
// (`/conversations`) garde le dock.

export function AppDock() {
  const pathname = usePathname();
  if (/^\/conversations\/[^/]+$/.test(pathname)) return null;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20"
      style={{ boxShadow: "var(--shadow-dock)" }}
    >
      <BottomTabBar />
    </div>
  );
}
