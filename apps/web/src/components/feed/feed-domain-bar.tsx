"use client";

import type { FolderChip } from "@/server/cached";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

// Barre de filtre par DOMAINE de Sujets (2026-07-23) — remplace l'ancienne barre
// à 4 dimensions. Une seule rangée de chips défilable horizontalement : « Tous »
// + un chip par domaine (icône + couleur du domaine). Filtrage instantané côté
// client. Chip active = remplie de la couleur du domaine ; inactive = blanche à
// icône colorée.

const CHIP =
  "inline-flex h-9 flex-none items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors active:scale-95";

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
          domain == null
            ? "border-transparent bg-(--text-primary) text-white"
            : "border-(--border) bg-white text-(--text-secondary)",
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
            className={cn(
              CHIP,
              active
                ? "border-transparent text-white"
                : "border-(--border) bg-white text-(--text-secondary)",
            )}
            style={
              active
                ? { background: viz.color, borderColor: viz.color }
                : undefined
            }
          >
            <Icon
              className="size-[15px] flex-none"
              strokeWidth={2.2}
              style={active ? undefined : { color: viz.color }}
            />
            {f.name}
          </button>
        );
      })}
    </div>
  );
}
