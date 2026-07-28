"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  MessagesSquare,
  Package,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Barre d'onglets basse (mobile-first). Remplace la sidebar desktop.
// 5 entrées : Actions (tâches) · Sujets · Conversations · Contacts · Réglages.
// « Conversations » (ex-« Messages », 2026-07-28) rend visible la chaîne de
// transformation Relvo — Actions ← Sujets ← Conversations : les conversations
// comptent tant qu'aucune IA ne fait le tri. « Contacts » a remplacé « Mémoire »
// dans la nav (2026-07-28) : la Mémoire est devenue l'onglet « Domaines » des
// Réglages. Icônes : agenda (Actions), carton = projet (Sujets), bulles =
// conversations (mêmes que l'onglet Conversations d'un sujet), deux personnes
// (Contacts), engrenage (Réglages).
//
// Place FIXE (plus d'auto-masquage au scroll, décision 2026-06-27) sur fond
// VIOLET, exactement comme l'ancien composer : actif = blanc plein, inactif =
// blanc translucide. L'accès à Relvo a quitté le bas pour le header (haut-droite).

type Tab = {
  href: string;
  label: string;
  icon: typeof Users;
  /** Préfixes de routes qui activent cet onglet (sous-pages incluses). */
  match: (path: string) => boolean;
};

const TABS: Tab[] = [
  {
    href: "/",
    label: "Actions",
    icon: CalendarDays,
    match: (p) => p === "/",
  },
  {
    href: "/fil",
    label: "Sujets",
    icon: Package,
    match: (p) => p.startsWith("/fil") || p.startsWith("/sujets"),
  },
  {
    href: "/conversations",
    label: "Conversations",
    icon: MessagesSquare,
    match: (p) => p.startsWith("/conversations") || p.startsWith("/messages"),
  },
  {
    href: "/contacts",
    label: "Contacts",
    icon: Users,
    match: (p) => p.startsWith("/contacts"),
  },
  {
    href: "/parametres",
    label: "Réglages",
    icon: Settings,
    match: (p) => p.startsWith("/parametres"),
  },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-none items-stretch"
      style={{
        // On rogne volontairement la safe-area iOS (~34px) : la reco laissait un
        // grand vide violet sous les libellés. On garde un minimum pour ne pas
        // coller au bord / à l'indicateur d'accueil (décision 2026-06-27).
        paddingBottom: "max(calc(env(safe-area-inset-bottom) - 16px), 6px)",
        background:
          "linear-gradient(180deg, var(--glass-relvo-1), var(--glass-relvo-2))",
        backdropFilter: "blur(28px) saturate(170%)",
        WebkitBackdropFilter: "blur(28px) saturate(170%)",
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.22)",
      }}
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] px-0.5 pt-2.5 pb-1.5 font-semibold transition-colors",
              active ? "text-white" : "text-white/55",
            )}
          >
            <Icon
              className="size-6"
              strokeWidth={active ? 2.4 : 2}
              fill={active ? "currentColor" : "none"}
              fillOpacity={active ? 0.16 : 0}
            />
            {/* Libellé sur UNE ligne, taille réduite : « Conversations » (13 car.)
                ne tient pas en 11px sur les téléphones étroits (5 onglets). */}
            <span className="max-w-full text-[10px] leading-none whitespace-nowrap">
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
