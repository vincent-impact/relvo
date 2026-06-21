"use client";

import { cn } from "@/lib/utils";

// Contrôle segmenté (filtres de Mon fil, onglets de Sujet). Présentationnel et
// contrôlé : l'état vit dans le parent. Pilule horizontale scrollable, l'actif
// passe en blanc avec ombre (cf. .segmented du mockup).

export type SegmentedOption = { value: string; label: string };

export function SegmentedControl({
  options,
  value,
  onValueChange,
  className,
}: {
  options: SegmentedOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1.5 overflow-x-auto rounded-full bg-(--surface-2) p-1",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "flex-1 rounded-full px-3 py-[7px] text-[13px] font-semibold whitespace-nowrap transition-colors",
              active
                ? "bg-white text-(--text-primary) shadow-(--shadow-card)"
                : "text-(--text-secondary)",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
