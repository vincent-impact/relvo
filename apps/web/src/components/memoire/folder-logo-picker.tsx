"use client";

import { FOLDER_COLORS, FOLDER_ICONS, folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

// Sélecteur de logo d'un domaine (M9.20) — aperçu live + palette curée (8
// couleurs) + jeu d'icônes (12). Contrôlé : partagé par la création et l'édition.

export function FolderLogoPicker({
  name,
  color,
  icon,
  onColor,
  onIcon,
}: {
  name: string;
  color: string;
  icon: string;
  onColor: (key: string) => void;
  onIcon: (key: string) => void;
}) {
  const visual = folderVisual({ color, icon });
  const PreviewIcon = visual.icon;

  return (
    <div>
      <div className="mb-5 flex items-center gap-3.5">
        <span
          className="grid size-16 flex-none place-items-center rounded-2xl text-white"
          style={{ background: visual.color }}
        >
          <PreviewIcon className="size-7" strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <div className="text-[17px] font-bold">
            {name.trim() || "Nouveau domaine"}
          </div>
          <div className="text-[13px] text-(--text-tertiary)">
            Un domaine de la mémoire de Relvo
          </div>
        </div>
      </div>

      <span className="mb-2 block text-[12.5px] font-semibold text-(--text-secondary)">
        Couleur
      </span>
      <div className="flex flex-wrap gap-2.5">
        {FOLDER_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-label={c.key}
            aria-pressed={color === c.key}
            onClick={() => onColor(c.key)}
            className={cn(
              "size-9 rounded-full ring-offset-2 transition",
              color === c.key && "ring-2 ring-(--text-primary)",
            )}
            style={{ background: c.value }}
          />
        ))}
      </div>

      <span className="mt-5 mb-2 block text-[12.5px] font-semibold text-(--text-secondary)">
        Icône
      </span>
      <div className="grid grid-cols-6 gap-2.5">
        {FOLDER_ICONS.map((i) => {
          const Icon = i.icon;
          const active = icon === i.key;
          return (
            <button
              key={i.key}
              type="button"
              aria-label={i.key}
              aria-pressed={active}
              onClick={() => onIcon(i.key)}
              className={cn(
                "grid aspect-square place-items-center rounded-xl border transition",
                active
                  ? "border-relvo bg-relvo-bg text-relvo"
                  : "border-(--border-light) text-(--text-secondary)",
              )}
            >
              <Icon className="size-[22px]" strokeWidth={2} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
