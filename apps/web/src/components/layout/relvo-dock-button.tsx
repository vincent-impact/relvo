"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RELVO_LOGO_PATHS } from "@/components/layout/relvo-logo";
import { cn } from "@/lib/utils";

// Le bouton Relvo — centre de la barre d'onglets, SEUL objet en relief du
// produit (design-system/01-tokens, « Le relief — réservé au bouton Relvo »).
// Sa matière vit ICI et nulle part ailleurs : disque nacré en dégradé radial,
// reflet en demi-lune, anneau violet et filet blanc, étoiles en dégradé avec
// ombre portée et éclat. Si une tuile ou un panneau en hérite « pour
// l'harmonie », on perd « ce qui brille, c'est Relvo ».
//
// Les étoiles sont légèrement RÉDUITES dans le disque et le badge est repoussé
// HORS du bord : masquées par le badge, la grande étoile seule se lit comme un
// orifice. Le badge porte le nombre de questions de Relvo en attente
// (`RelvoQuestion`, invariant 36) — branché par la tranche « Relvo parle en
// premier » ; d'ici là, il reste absent.
//
// Page-aware (invariant 26) : le bouton ouvre l'échange plein écran en
// transmettant la page d'origine (`?from=`) pour le chip de contexte, les
// prompts et le retour.

export function RelvoDockButton({
  pending = 0,
  size = 66,
  className,
}: {
  /** Questions de Relvo en attente d'une réponse — 0 = pas de badge. */
  pending?: number;
  size?: number;
  className?: string;
}) {
  const pathname = usePathname();
  const uid = useId();
  const gradId = `${uid}-g`;
  const shadowId = `${uid}-s`;
  const clipId = `${uid}-c`;
  const mark = Math.round(size * 0.58);
  const label =
    pending > 0
      ? `Parler à Relvo, ${pending} question${pending > 1 ? "s" : ""} en attente`
      : "Parler à Relvo";

  return (
    <Link
      href={`/relvo?from=${encodeURIComponent(pathname)}`}
      aria-label={label}
      className={cn(
        "relative block flex-none transition-transform active:translate-y-px active:scale-[0.97]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden
        className="absolute inset-0 grid place-items-center overflow-hidden rounded-full"
        style={{
          background:
            "radial-gradient(circle at 38% 26%, #ffffff 0%, #f4f3f9 46%, #d6d3e8 100%)",
          border: "3px solid var(--relvo)",
          boxShadow:
            "inset 0 1px 0 rgb(255 255 255 / 0.95), inset 0 -4px 8px rgb(74 63 181 / 0.26), inset 0 0 0 1px rgb(255 255 255 / 0.65), 0 1px 2px rgb(20 18 40 / 0.28), 0 10px 22px rgb(20 18 40 / 0.34)",
        }}
      >
        {/* Reflet en demi-lune : la lumière vient du haut. */}
        <span
          className="absolute rounded-full"
          style={{
            top: 2,
            left: "12%",
            width: "76%",
            height: "42%",
            background:
              "linear-gradient(to bottom, rgb(255 255 255 / 0.95), rgb(255 255 255 / 0))",
          }}
        />
        <svg
          viewBox="116 104 296 296"
          width={mark}
          height={mark}
          className="relative"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8b80ea" />
              <stop offset="0.55" stopColor="#4a3fb5" />
              <stop offset="1" stopColor="#2f2782" />
            </linearGradient>
            <filter id={shadowId} x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow
                dx="0"
                dy="4"
                stdDeviation="3"
                floodColor="#1c1640"
                floodOpacity="0.42"
              />
            </filter>
            <clipPath id={clipId}>
              <rect x="116" y="104" width="296" height="140" />
            </clipPath>
          </defs>
          <g filter={`url(#${shadowId})`} fill={`url(#${gradId})`}>
            {RELVO_LOGO_PATHS.stars.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          {/* Éclat : la moitié haute de la grande étoile, voilée de blanc. */}
          <path
            clipPath={`url(#${clipId})`}
            fill="#fff"
            opacity="0.28"
            d={RELVO_LOGO_PATHS.stars[0]}
          />
        </svg>
      </span>
      {pending > 0 ? (
        <span
          className="absolute -top-2 -right-2 grid h-[22px] min-w-[22px] place-items-center rounded-full px-[5px] font-mono text-[12px] font-semibold text-white tabular-nums"
          style={{
            background: "linear-gradient(to bottom, #f0506c, #d1213f)",
            border: "2px solid #fafafa",
            boxShadow: "0 2px 4px rgb(20 18 40 / 0.3)",
          }}
        >
          {pending}
        </span>
      ) : null}
    </Link>
  );
}
