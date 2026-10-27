"use client";

import type { FolderChip } from "@/server/cached";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

// Barre de filtre par DOSSIER des Sujets — une seule rangée de puces
// défilable : « Tous », puis les dossiers de premier niveau ; un dossier
// choisi filtre lui ET ce qu'il contient (M23.4), et ses propres dossiers
// viennent à sa droite pour affiner — on descend dans l'arbre puce après
// puce, et ses pères restent à gauche pour remonter. Filtrage instantané côté
// client. Une puce active est NOIRE pleine (le noir sert à ça : la sélection
// d'un filtre), jamais violette — le violet est la livrée et la voix de
// Relvo, pas un état.

// 36 px de haut (la puce du système), 44 px de frappe par le pseudo-élément.
const CHIP =
  "pressable relative inline-flex h-9 flex-none items-center gap-1.5 rounded-(--rayon-pilule) border px-3 text-[12px] whitespace-nowrap transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']";
const CHIP_IDLE = "border-(--filet) bg-white font-normal text-noir";
const CHIP_ON = "border-noir bg-noir font-medium text-white";

/** La chaîne des pères d'un dossier, du premier niveau au dossier lui-même. */
function chaine(folders: FolderChip[], id: string): FolderChip[] {
  const result: FolderChip[] = [];
  let courant = folders.find((f) => f.id === id) ?? null;
  while (courant) {
    result.unshift(courant);
    courant = courant.parentId
      ? (folders.find((f) => f.id === courant!.parentId) ?? null)
      : null;
  }
  return result;
}

export function FeedDomainBar({
  domain,
  onDomain,
  folders,
  present,
}: {
  /** Identifiant du dossier filtré, ou null (tous). */
  domain: string | null;
  onDomain: (id: string | null) => void;
  folders: FolderChip[];
  /** Les dossiers qui ont au moins un sujet dans l'onglet courant, eux ou
   *  leurs fils : une puce qui mène à une liste vide est une puce morte,
   *  elle ne s'affiche pas. */
  present: ReadonlySet<string>;
}) {
  const choisi = domain ? chaine(folders, domain) : [];
  const dessous = folders.filter(
    (f) => f.parentId === (domain ?? null) || (domain == null && f.depth === 1),
  );
  const shown = [
    ...choisi,
    ...dessous.filter((f) => present.has(f.id) && !choisi.includes(f)),
  ];
  return (
    <div
      role="group"
      aria-label="Dossiers"
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
        const active = domain === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onDomain(active ? (f.parentId ?? null) : f.id)}
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
