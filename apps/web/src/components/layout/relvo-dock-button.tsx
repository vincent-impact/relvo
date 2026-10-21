"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RELVO_LOGO_PATHS } from "@/components/layout/relvo-logo";
import { cn } from "@/lib/utils";

// Le bouton Relvo — centre du dock, SEUL objet coloré du dock (design-system/
// 01-tokens, « Le bouton Relvo »). Un disque plat en dégradé de violet, les
// étoiles blanches, plus grand que la pilule : il en déborde en haut et en bas,
// dans son axe, et la pilule se SOULÈVE autour de lui en courbe douce, comme un
// tissu tendu (DockFabric, bottom-tab-bar) — il est DANS la barre, pas posé
// dessus. Ce qui le désigne, c'est la couleur, pas un relief ni une ombre. Sa
// matière vit ICI et nulle part ailleurs — si un second objet du dock se colore
// ou se met à briller, on perd « ce qui se détache, c'est Relvo ».
//
// Le badge porte le nombre de questions de Relvo en attente (`RelvoQuestion`,
// invariant 36), compté par le layout de l'application (M18.9, livré par M10).
// Il est repoussé hors du bord pour ne jamais masquer les petites étoiles.
//
// Page-aware (invariant 26) : le bouton ouvre l'échange plein écran en
// transmettant la page d'origine (`?from=`) pour le chip de contexte, les
// prompts et le retour.
//
// Quand Relvo LIT le courrier (rattrapage en cours), les étoiles RESPIRENT
// (`.respire`, le seul mouvement qui dit « Relvo travaille ») : le travail se
// voit d'où qu'on soit, sans ouvrir la page des canaux. Le disque, lui, ne
// change pas — c'est sa couleur qui le désigne, pas un mouvement.

export function RelvoDockButton({
  pending = 0,
  reading = false,
  className,
}: {
  /** Questions de Relvo en attente d'une réponse — 0 = pas de badge. */
  pending?: number;
  /** Relvo lit le courrier en ce moment : les étoiles respirent. */
  reading?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const label = [
    pending > 0
      ? `Parler à Relvo, ${pending} question${pending > 1 ? "s" : ""} en attente`
      : "Parler à Relvo",
    reading ? "Relvo lit votre courrier" : null,
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <Link
      href={`/relvo?from=${encodeURIComponent(pathname)}`}
      aria-label={label}
      className={cn(
        "relative grid size-(--disque-relvo) flex-none place-items-center rounded-full text-white transition-transform duration-(--dur-presse) active:translate-y-px active:scale-[0.97]",
        className,
      )}
      style={{ background: "var(--degrade-disque)" }}
    >
      <svg viewBox="116 104 296 296" width="30" height="30" aria-hidden="true">
        <g fill="currentColor" className={cn(reading && "respire")}>
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
