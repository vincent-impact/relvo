"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// SegTabs — segmented « Direction B » : pilule blanche ombrée, onglet actif en
// violet Relvo, badges de compteur ronds. Variante `overlap` pour chevaucher le
// bas du hero violet. Présentationnel et contrôlé (l'état vit dans le parent).
// Sert aux filtres Mon fil, aux onglets Sujet et aux onglets Réglages.
//
// Mode `iconOnly` (fiche Sujet, 2026-07-23) : on n'affiche QUE l'icône de chaque
// onglet pour tenir 4 entrées sur mobile sans rogner l'espace horizontal. Le
// libellé passe en `aria-label` ; le compteur reste une pastille collée à
// l'icône.

export type SegTabOption = {
  value: string;
  label: string;
  count?: number;
  /** Icône de l'onglet — requise en mode `iconOnly`. */
  icon?: LucideIcon;
};

export function SegTabs({
  options,
  value,
  onValueChange,
  overlap = false,
  iconOnly = false,
  className,
}: {
  options: SegTabOption[];
  value: string;
  onValueChange: (value: string) => void;
  overlap?: boolean;
  /** N'affiche que les icônes (gain d'espace horizontal — fiche Sujet). */
  iconOnly?: boolean;
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
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={iconOnly ? opt.label : undefined}
            title={iconOnly ? opt.label : undefined}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-[14px] font-bold whitespace-nowrap transition-colors",
              iconOnly ? "py-[11px]" : "py-[9px]",
              active ? "bg-relvo text-white" : "text-[#8a8980]",
            )}
          >
            {iconOnly && Icon ? (
              <Icon className="size-[19px]" strokeWidth={2.2} />
            ) : (
              opt.label
            )}
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
