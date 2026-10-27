"use client";

import { useId } from "react";
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
// en bas »). Relvo au centre, sans libellé, un disque violet qui déborde de la
// pilule en haut et en bas, et autour duquel la pilule se soulève en courbe
// douce, comme un tissu tendu (DockFabric) : c'est l'accès à l'échange, au même
// endroit sur toutes les pages, sous le pouce. Une entrée ne s'ajoute pas au dock, elle en
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
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-white transition-opacity",
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

// La silhouette du dock : la pilule noire, soulevée autour du disque central,
// en UN SEUL SVG qui porte sa propre ombre. La pilule est un rectangle arrondi
// à 100 % de la largeur ; au centre, un SVG imbriqué posé à `x="50%"` porte la
// pièce de largeur fixe qui dessine la courbe — un plat, une montée douce
// (cubique), un sommet qui épouse le disque, et la descente symétrique ; la
// même chose en bas. Les deux formes, de la même couleur, sont réunies dans un
// groupe filtré : l'ombre (`feDropShadow`, la valeur du jeton `--ombre-dock`)
// est celle de leur UNION et suit la silhouette, pas le rectangle.
//
// ⚠️ Pourquoi pas un `filter: drop-shadow` CSS sur la barre : sur iOS, ce filtre
// crée une couche rectangulaire englobant la barre et son ombre, redessinée
// entière à chaque changement d'un enfant — l'opacité des onglets, le disque
// qui se contracte au toucher, le repli au défilement. Pendant ce redessin,
// WebKit montre le rectangle de la couche avant son contenu : une zone blanche
// ou grise sous le dock, qui scintille. Ici, le SVG est statique : rastérisé
// une fois, jamais repeint par les onglets.
//
// Le dessin est calé sur `--dock-h` (54), `--dock-etire` (10) et `--rayon-dock`
// (32) : HAUTEUR, ETIRE et RAYON ici doivent valoir la même chose que les tokens.
const LARGEUR = 132; // la pièce centrale
const HAUTEUR = 54; // = --dock-h
const ETIRE = 10; // = --dock-etire
const RAYON = 32; // = --rayon-dock (borné à la demi-hauteur par le SVG)
const PLAT = 10; // le plat avant la montée, de chaque côté
// L'ombre : `--ombre-dock` = 0 10px 24px à 28 %. En SVG, le flou de 24 px est
// un écart-type de 12 ; la marge laisse la place à l'ombre sous la pilule.
const OMBRE_DY = 10;
const OMBRE_FLOU = 12;
const OMBRE_OPACITE = 0.28;
const MARGE = OMBRE_DY + OMBRE_FLOU * 3;

function cheminTissu() {
  const h = HAUTEUR + 2 * ETIRE;
  const m = LARGEUR / 2;
  const x1 = PLAT;
  const x2 = LARGEUR - PLAT;
  // Montée douce de (x1, ETIRE) au sommet (m, 0), tangente horizontale aux deux
  // bouts ; les points de contrôle tirent la courbe vers le disque.
  const haut = `M 0 ${ETIRE} L ${x1} ${ETIRE} C ${x1 + 30} ${ETIRE} ${m - 22} 0 ${m} 0 C ${m + 22} 0 ${x2 - 30} ${ETIRE} ${x2} ${ETIRE} L ${LARGEUR} ${ETIRE}`;
  const bas = `L ${LARGEUR} ${h - ETIRE} L ${x2} ${h - ETIRE} C ${x2 - 30} ${h - ETIRE} ${m + 22} ${h} ${m} ${h} C ${m - 22} ${h} ${x1 + 30} ${h - ETIRE} ${x1} ${h - ETIRE} L 0 ${h - ETIRE} Z`;
  return `${haut} ${bas}`;
}

function DockFabric() {
  const h = HAUTEUR + 2 * ETIRE;
  const filtre = useId();
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute left-0 w-full overflow-visible text-noir"
      style={{ top: `calc(-1 * var(--dock-etire))`, height: h }}
      height={h}
      // L'ombre déborde du cadre du SVG : la région du filtre et `overflow`
      // visible la laissent s'étendre sous la pilule.
    >
      <defs>
        <filter
          id={filtre}
          x="-10%"
          y="-50%"
          width="120%"
          height={`${100 + (2 * MARGE * 100) / h}%`}
        >
          <feDropShadow
            dx="0"
            dy={OMBRE_DY}
            stdDeviation={OMBRE_FLOU}
            floodColor="currentColor"
            floodOpacity={OMBRE_OPACITE}
          />
        </filter>
      </defs>
      <g filter={`url(#${filtre})`} className="fill-noir">
        <rect x="0" y={ETIRE} width="100%" height={HAUTEUR} rx={RAYON} />
        <svg x="50%" y="0" overflow="visible">
          <path transform={`translate(${-LARGEUR / 2} 0)`} d={cheminTissu()} />
        </svg>
      </g>
    </svg>
  );
}

export function BottomTabBar({
  pendingQuestions = 0,
  reading = false,
}: {
  pendingQuestions?: number;
  /** Relvo lit le courrier : le disque respire. */
  reading?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="relative flex h-(--dock-h) items-stretch"
    >
      <DockFabric />
      {LEFT.map((tab) => (
        <TabLink key={tab.href} tab={tab} pathname={pathname} />
      ))}
      {/* La place centrale : le disque dans l'axe de la pilule, plus grand
          qu'elle ; la pilule se soulève autour de lui (DockFabric). */}
      <div className="relative flex flex-1 items-center justify-center">
        <RelvoDockButton pending={pendingQuestions} reading={reading} />
      </div>
      {RIGHT.map((tab) => (
        <TabLink key={tab.href} tab={tab} pathname={pathname} />
      ))}
    </nav>
  );
}
