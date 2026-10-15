"use client";

import type { FolderChip } from "@/server/cached";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

// Barre de filtre par DOMAINE de Sujets — une seule rangée de puces défilable :
// « Tous » + une puce par domaine, avec le carré de sa couleur de bande.
// Filtrage instantané côté client. Une puce active est NOIRE pleine (le noir
// sert à ça : la sélection d'un filtre), jamais violette — le violet est la
// livrée et la voix de Relvo, pas un état.

// 36 px de haut (la puce du système), 44 px de frappe par le pseudo-élément.
const CHIP =
  "pressable relative inline-flex h-9 flex-none items-center gap-1.5 rounded-(--rayon-pilule) border px-3 text-[12px] whitespace-nowrap transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']";
const CHIP_IDLE = "border-(--filet) bg-white font-normal text-noir";
const CHIP_ON = "border-noir bg-noir font-medium text-white";

export function FeedDomainBar({
  domain,
  onDomain,
  folders,
  present,
}: {
  /** Slug du domaine filtré, ou null (tous). */
  domain: string | null;
  onDomain: (slug: string | null) => void;
  folders: FolderChip[];
  /** Les domaines qui ont au moins un sujet dans l'onglet courant : une puce
   *  qui mène à une liste vide est une puce morte, elle ne s'affiche pas. */
  present: ReadonlySet<string>;
}) {
  const shown = folders.filter((f) => present.has(f.slug) || f.slug === domain);
  return (
    <div
      role="group"
      aria-label="Domaines"
      className="flex [scrollbar-width:none] gap-2 overflow-x-auto overscroll-x-contain px-4 pt-3 pb-0.5 [&::-webkit-scrollbar]:hidden"
    >
      <button
        type="button"
        onClick={() => onDomain(null)}
        aria-pressed={domain == null}
        className={cn(CHIP, domain == null ? CHIP_ON : CHIP_IDLE)}
      >
        Tous
      </button>

      {shown.map((f) => {
        const { color } = folderVisual({ slug: f.slug, color: f.color });
        const active = domain === f.slug;
        return (
          <button
            key={f.slug}
            type="button"
            onClick={() => onDomain(active ? null : f.slug)}
            aria-pressed={active}
            className={cn(CHIP, active ? CHIP_ON : CHIP_IDLE)}
          >
            <i
              aria-hidden
              className="size-2 flex-none rounded-[2px]"
              style={{ background: color }}
            />
            {f.name}
          </button>
        );
      })}
    </div>
  );
}
