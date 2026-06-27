"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, Home, Mail, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

// Barre d'onglets basse (mobile-first). Remplace la sidebar desktop.
// 5 entrées alignées sur la nav V1 (cf. ux-mobile-first §3 + CLAUDE.md).
// Contacts est une destination de premier rang (3e onglet) en vue de l'usage
// Équipe à venir — pas un sous-menu de Réglages (décision 2026-06-26).
//
// Place FIXE (plus d'auto-masquage au scroll, décision 2026-06-27) sur fond
// VIOLET, exactement comme l'ancien composer : actif = blanc plein, inactif =
// blanc translucide. L'accès à Relvo a quitté le bas pour le header (haut-droite).

type Tab = {
  href: string;
  label: string;
  icon: typeof Home;
  /** Préfixes de routes qui activent cet onglet (sous-pages incluses). */
  match: (path: string) => boolean;
};

const TABS: Tab[] = [
  {
    href: "/",
    label: "Accueil",
    icon: Home,
    match: (p) => p === "/",
  },
  {
    href: "/fil",
    label: "Mon fil",
    icon: Mail,
    match: (p) => p.startsWith("/fil") || p.startsWith("/sujets"),
  },
  {
    href: "/contacts",
    label: "Contacts",
    icon: Users,
    match: (p) => p.startsWith("/contacts"),
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
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
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
