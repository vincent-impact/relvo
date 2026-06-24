"use client";

import { cn } from "@/lib/utils";

// SegTabs — segmented « Direction B » : pilule blanche ombrée, onglet actif en
// violet Relvo, badges de compteur ronds. Variante `overlap` pour chevaucher le
// bas du hero violet. Présentationnel et contrôlé (l'état vit dans le parent).
// Sert aux filtres Mon fil, aux onglets Sujet et aux onglets Réglages.

export type SegTabOption = { value: string; label: string; count?: number };

export function SegTabs({
  options,
  value,
  onValueChange,
  overlap = false,
  className,
}: {
  options: SegTabOption[];
  value: string;
  onValueChange: (value: string) => void;
  overlap?: boolean;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1.5 rounded-full bg-white p-1.5",
        overlap && "relative z-[3] mx-4 -mt-[25px]",
        className,
      )}
      style={{ boxShadow: "0 8px 24px rgb(28 22 60 / 0.14)" }}
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
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-[9px] text-[14px] font-bold whitespace-nowrap transition-colors",
              active ? "bg-relvo text-white" : "text-[#8a8980]",
            )}
          >
            {opt.label}
            {typeof opt.count === "number" ? (
              <span
                className={cn(
                  "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-extrabold",
                  active
                    ? "bg-white/30 text-white"
                    : "bg-[#eceae6] text-[#8a8980]",
                )}
              >
                {opt.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
