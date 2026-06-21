"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, Home, Mail, Settings } from "lucide-react";
import { useNavHidden } from "@/components/layout/nav-visibility";
import { cn } from "@/lib/utils";

// Barre d'onglets basse (mobile-first). Remplace la sidebar desktop.
// 4 entrées alignées sur la nav V1 (cf. ux-mobile-first §3 + CLAUDE.md).

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
  const hidden = useNavHidden();

  // Collapse animé (grille 1fr↔0fr) : le menu se replie vers le bas au scroll
  // descendant et libère l'espace, réapparaît au scroll montant.
  return (
    <div
      className={cn(
        "grid flex-none transition-[grid-template-rows] duration-300 ease-out",
        hidden ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
      )}
    >
      <nav
        className="flex items-stretch overflow-hidden border-t border-(--hairline) bg-white"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom) - 22px, 6px)",
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
                "flex flex-1 flex-col items-center justify-center gap-[3px] pt-2 pb-[9px] text-[11px] font-semibold",
                active ? "text-brand" : "text-(--text-tertiary)",
              )}
            >
              <Icon className="size-[23px]" strokeWidth={2} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
