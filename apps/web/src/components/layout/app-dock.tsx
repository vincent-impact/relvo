"use client";

import { usePathname } from "next/navigation";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";

// Dock bas — la SEULE barre d'onglets, violette et fixe, ancrée au bas du
// cadre, Relvo en relief au centre. Le padding-bas du <Screen> réserve sa
// hauteur (et le débord du bouton central).
//
// EXCEPTION (2026-07-23) : sur le DÉTAIL d'une conversation (`/conversations/x`),
// le dock cède la place aux boutons d'action « Ignorer » / « Ouvrir un sujet »
// ou au composer de réponse (rendus par ConversationDetail, mêmes ancrage et
// hauteur). La LISTE (`/conversations`) garde le dock.
//
// EXCEPTION (2026-07-28) : idem sur le DÉTAIL d'un contact (`/contacts/<id>`,
// hors `/contacts/nouveau`) — « Modifier » / « Supprimer » remplacent la barre
// d'onglets (rendus par ContactDetail). La LISTE (`/contacts`) garde le dock.

export function AppDock() {
  const pathname = usePathname();
  if (/^\/conversations\/[^/]+$/.test(pathname)) return null;
  if (/^\/contacts\/(?!nouveau$)[^/]+$/.test(pathname)) return null;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20"
      style={{ boxShadow: "var(--shadow-dock)" }}
    >
      <BottomTabBar />
    </div>
  );
}
