"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RELVO_LOGO_PATHS } from "@/components/layout/relvo-logo";
import { cn } from "@/lib/utils";

// Le bouton Relvo — centre du dock, SEUL objet coloré du dock et seul à en
// déborder (design-system/01-tokens, « Le bouton Relvo »). Un disque plat en
// dégradé de violet, les étoiles blanches, une ombre neutre : ce qui le
// désigne, c'est la couleur et le débordement, pas un relief. Sa matière vit
// ICI et nulle part ailleurs — si un second objet déborde du dock ou se met à
// briller, on perd « ce qui se détache, c'est Relvo ».
//
// Le badge porte le nombre de questions de Relvo en attente (`RelvoQuestion`,
// invariant 36) — branché par la tranche « Relvo parle en premier » ; d'ici là,
// il reste absent. Il est repoussé hors du bord pour ne jamais masquer les
// petites étoiles.
//
// Page-aware (invariant 26) : le bouton ouvre l'échange plein écran en
// transmettant la page d'origine (`?from=`) pour le chip de contexte, les
// prompts et le retour.

export function RelvoDockButton({
  pending = 0,
  className,
}: {
  /** Questions de Relvo en attente d'une réponse — 0 = pas de badge. */
  pending?: number;
  className?: string;
}) {
  const pathname = usePathname();
  const label =
    pending > 0
      ? `Parler à Relvo, ${pending} question${pending > 1 ? "s" : ""} en attente`
      : "Parler à Relvo";

  return (
    <Link
      href={`/relvo?from=${encodeURIComponent(pathname)}`}
      aria-label={label}
      className={cn(
        "relative grid size-(--disque-relvo) flex-none place-items-center rounded-full text-white shadow-disque transition-transform active:translate-y-px active:scale-[0.97]",
        className,
      )}
      style={{ background: "var(--degrade-disque)" }}
    >
      <svg viewBox="116 104 296 296" width="30" height="30" aria-hidden="true">
        <g fill="currentColor">
          {RELVO_LOGO_PATHS.stars.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </svg>
      {pending > 0 ? (
        <span className="chiffre absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-noir bg-urgent px-1 text-[10px] text-white">
          {pending}
        </span>
      ) : null}
    </Link>
  );
}
