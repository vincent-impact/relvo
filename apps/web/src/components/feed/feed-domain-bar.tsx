"use client";

import type { FolderChip } from "@/server/cached";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

// Barre de filtre par DOMAINE de Sujets (2026-07-23) — remplace l'ancienne barre
// à 4 dimensions. Une seule rangée de chips défilable horizontalement : « Tous »
// + un chip par domaine (icône + couleur du domaine). Filtrage instantané côté
// client. Chip active = remplie de la couleur du domaine ; inactive = blanche à
// icône colorée.

// Direction « Instrument » : un chip est un BOUTON — rayon 10, posé (filet de
// lumière + ombre de contact), enfoncé au toucher — plus une pilule à part.
// MONOCHROME, comme tous les sélecteurs (segmented, canaux) : blanc au repos,
// violet Relvo sélectionné. La couleur du domaine reste portée par la tuile de
// chaque ligne — ici elle ferait un deuxième vocabulaire de sélection.
const CHIP =
  "pressable inline-flex h-9 flex-none items-center gap-1.5 rounded-[10px] border px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors";
const CHIP_IDLE =
  "border-(--hairline) bg-white text-(--text-secondary) shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_1px_2px_rgb(20_18_40/0.05)]";
const CHIP_ON =
  "border-transparent text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(20_18_40/0.18)]";

export function FeedDomainBar({
  domain,
  onDomain,
  folders,
}: {
  /** Slug du domaine filtré, ou null (tous). */
  domain: string | null;
  onDomain: (slug: string | null) => void;
  folders: FolderChip[];
}) {
  return (
    <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto overscroll-x-contain px-4 pt-3.5 pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {/* Tous — aucun filtre de domaine. */}
      <button
        type="button"
        onClick={() => onDomain(null)}
        aria-pressed={domain == null}
        className={cn(
          CHIP,
          domain == null ? cn(CHIP_ON, "bg-relvo") : CHIP_IDLE,
        )}
      >
        Tous
      </button>

      {folders.map((f) => {
        const viz = folderVisual({
          slug: f.slug,
          color: f.color,
          icon: f.icon,
        });
        const active = domain === f.slug;
        const Icon = viz.icon;
        return (
          <button
            key={f.slug}
            type="button"
            onClick={() => onDomain(active ? null : f.slug)}
            aria-pressed={active}
            className={cn(CHIP, active ? cn(CHIP_ON, "bg-relvo") : CHIP_IDLE)}
          >
            <Icon className="size-[15px] flex-none" strokeWidth={2.2} />
            {f.name}
          </button>
        );
      })}
    </div>
  );
}
