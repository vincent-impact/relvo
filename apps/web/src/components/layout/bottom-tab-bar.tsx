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

  // Collapse animé (grille 1fr↔0fr) : la tab bar se replie vers le bas au scroll
  // descendant et libère l'espace, réapparaît au scroll montant. Verre givré
  // « Liquid Glass » : translucide blanc, laisse voir le contenu défiler dessous.
  return (
    <div
      className={cn(
        "grid flex-none transition-[grid-template-rows,opacity] duration-300 ease-out",
        hidden ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
      )}
    >
      <nav
        className="flex items-stretch overflow-hidden"
        style={{
          background: "var(--glass-tab)",
          backdropFilter: "blur(var(--blur-glass)) saturate(var(--sat-glass))",
          WebkitBackdropFilter:
            "blur(var(--blur-glass)) saturate(var(--sat-glass))",
          borderTop: "1px solid var(--glass-stroke)",
          boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.75)",
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
                active ? "text-relvo" : "text-[#b3b1ab]",
              )}
            >
              <Icon className="size-6" strokeWidth={2} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
