"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, Inbox, ListChecks, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

// Barre d'onglets basse (mobile-first). Remplace la sidebar desktop.
// 4 entrées : Actions (tâches), Sujets, Mémoire, Réglages. « Accueil » est
// devenu « Actions » (page des tâches) et « Mon fil » est devenu « Sujets »
// (décision 2026-06-28). Contacts a quitté le dock → onglet des Réglages.
//
// Place FIXE (plus d'auto-masquage au scroll, décision 2026-06-27) sur fond
// VIOLET, exactement comme l'ancien composer : actif = blanc plein, inactif =
// blanc translucide. L'accès à Relvo a quitté le bas pour le header (haut-droite).

type Tab = {
  href: string;
  label: string;
  icon: typeof Brain;
  /** Préfixes de routes qui activent cet onglet (sous-pages incluses). */
  match: (path: string) => boolean;
};

const TABS: Tab[] = [
  {
    href: "/",
    label: "Actions",
    icon: ListChecks,
    match: (p) => p === "/",
  },
  {
    href: "/fil",
    label: "Sujets",
    icon: Inbox,
    match: (p) => p.startsWith("/fil") || p.startsWith("/sujets"),
  },
  {
    href: "/dossiers",
    label: "Mémoire",
    icon: Brain,
    match: (p) => p.startsWith("/dossiers"),
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
              "flex flex-1 flex-col items-center justify-center gap-[3px] pt-2.5 pb-1.5 text-[11px] font-semibold transition-colors",
              active ? "text-white" : "text-white/55",
            )}
          >
            <Icon
              className="size-6"
              strokeWidth={active ? 2.4 : 2}
              fill={active ? "currentColor" : "none"}
              fillOpacity={active ? 0.16 : 0}
            />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
