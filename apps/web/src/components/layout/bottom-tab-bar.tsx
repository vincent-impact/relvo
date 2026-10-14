"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarIcon,
  ConversationsIcon,
  HouseIcon,
  SubjectsIcon,
} from "@/components/layout/dock-icons";
import { RelvoDockButton } from "@/components/layout/relvo-dock-button";
import { cn } from "@/lib/utils";

// Le dock — CINQ places, et rien de plus (invariant 35) : Accueil · Calendrier ·
// Relvo · Sujets · Conversations. Une pilule NOIRE, flottante, décollée du bas
// et des bords (design-system/03-patterns, « Le cadre : le ciel en haut, le dock
// en bas »). Relvo au centre, sans libellé, un disque violet cerclé de noir qui
// déborde de la pilule en haut et en bas (RelvoDockButton) : c'est l'accès à
// l'échange, au même endroit sur toutes les pages, sous le pouce. Une entrée ne s'ajoute pas au dock, elle en
// remplace une. Tout ce qu'on ouvre moins d'une fois par jour vit dans le
// menu latéral (SideMenu).
//
// Icônes PLEINES (dock-icons). L'onglet actif se lit au blanc plein et à la
// graisse du libellé — jamais à un cerclage, réservé aux indicateurs.

type Tab = {
  href: string;
  label: string;
  icon: typeof HouseIcon;
  /** Préfixes de routes qui activent cet onglet (sous-pages incluses). */
  match: (path: string) => boolean;
};

const LEFT: Tab[] = [
  { href: "/", label: "Accueil", icon: HouseIcon, match: (p) => p === "/" },
  {
    href: "/calendrier",
    label: "Calendrier",
    icon: CalendarIcon,
    match: (p) => p.startsWith("/calendrier"),
  },
];

const RIGHT: Tab[] = [
  {
    href: "/fil",
    label: "Sujets",
    icon: SubjectsIcon,
    match: (p) => p.startsWith("/fil") || p.startsWith("/sujets"),
  },
  {
    href: "/conversations",
    label: "Conversations",
    icon: ConversationsIcon,
    match: (p) => p.startsWith("/conversations"),
  },
];

function TabLink({ tab, pathname }: { tab: Tab; pathname: string }) {
  const active = tab.match(pathname);
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-white transition-opacity",
        active ? "opacity-100" : "opacity-60",
      )}
    >
      <Icon />
      {/* Libellé sur UNE ligne, 10 px : « Conversations » (13 car.) ne tient
          pas plus gros sur les téléphones étroits. */}
      <span
        className={cn(
          "max-w-full text-[10px] leading-none tracking-[0.02em] whitespace-nowrap",
          active ? "font-medium" : "font-light",
        )}
      >
        {tab.label}
      </span>
    </Link>
  );
}

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="flex h-(--dock-h) items-stretch rounded-(--rayon-dock) bg-noir shadow-dock"
    >
      {LEFT.map((tab) => (
        <TabLink key={tab.href} tab={tab} pathname={pathname} />
      ))}
      {/* La place centrale : le disque dans l'axe de la pilule, plus grand
          qu'elle ; son anneau noir est le dock qui s'étire autour de lui. */}
      <div className="flex flex-1 items-center justify-center">
        <RelvoDockButton />
      </div>
      {RIGHT.map((tab) => (
        <TabLink key={tab.href} tab={tab} pathname={pathname} />
      ))}
    </nav>
  );
}
