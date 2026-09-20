"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, MessagesSquare, Package } from "lucide-react";
import { RelvoDockButton } from "@/components/layout/relvo-dock-button";
import { cn } from "@/lib/utils";

// Barre d'onglets basse — CINQ places, et rien de plus (invariant 35) :
// Accueil · Calendrier · Relvo · Sujets · Conversations. Relvo au centre, plus
// gros, sans libellé, en relief (RelvoDockButton) : c'est l'accès à l'échange,
// au même endroit sur toutes les pages, sous le pouce. Une entrée ne s'ajoute
// pas à la barre, elle en remplace une. Tout ce qu'on ouvre moins d'une fois
// par jour vit dans le menu latéral (SideMenu).
//
// Icônes : maison (Accueil), agenda (Calendrier), carton = projet (Sujets),
// bulles = conversations (mêmes que l'onglet Conversations d'un sujet).
//
// Place FIXE sur fond VIOLET : actif = blanc plein, inactif = blanc translucide.
// Direction « Instrument » : le verre est porté par l'utilitaire `.glass-relvo`
// (globals.css) — violet encre translucide + flou, avec un REPLI OPAQUE quand
// backdrop-filter n'existe pas. Le verre n'a de sens que parce que la liste
// défile dessous ; il reste réservé au chrome.

type Tab = {
  href: string;
  label: string;
  icon: typeof House;
  /** Préfixes de routes qui activent cet onglet (sous-pages incluses). */
  match: (path: string) => boolean;
};

const LEFT: Tab[] = [
  { href: "/", label: "Accueil", icon: House, match: (p) => p === "/" },
  {
    href: "/calendrier",
    label: "Calendrier",
    icon: CalendarDays,
    match: (p) => p.startsWith("/calendrier"),
  },
];

const RIGHT: Tab[] = [
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
          ne tient pas en 11px sur les téléphones étroits. */}
      <span className="max-w-full text-[10px] leading-none whitespace-nowrap">
        {tab.label}
      </span>
    </Link>
  );
}

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="glass-relvo flex flex-none items-stretch px-1"
      style={{
        // On rogne volontairement la safe-area iOS (~34px) : la reco laissait un
        // grand vide violet sous les libellés. On garde un minimum pour ne pas
        // coller au bord / à l'indicateur d'accueil.
        paddingBottom: "max(calc(env(safe-area-inset-bottom) - 16px), 6px)",
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.22)",
      }}
    >
      {LEFT.map((tab) => (
        <TabLink key={tab.href} tab={tab} pathname={pathname} />
      ))}
      {/* La place centrale, un peu plus large : le bouton déborde au-dessus de
          la barre (marge négative) — c'est ce qui le fait « objet posé ». */}
      <div className="flex flex-[1.1] items-start justify-center">
        <RelvoDockButton className="-mt-[26px]" />
      </div>
      {RIGHT.map((tab) => (
        <TabLink key={tab.href} tab={tab} pathname={pathname} />
      ))}
    </nav>
  );
}
