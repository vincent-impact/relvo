"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// SegTabs — segmented : conteneur blanc POSÉ (niveau 2, rayon 12), onglet actif
// en violet Relvo lui-même posé (ombre de contact), badges de compteur ronds.
// Direction « Instrument » (2026-09) : plus de pilule — les rayons sont
// plafonnés, et l'onglet actif a une épaisseur au lieu d'être un aplat. Variante `overlap` pour chevaucher le
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
  /**
   * Teinte du compteur. Par défaut, gris neutre : un simple dénombrement.
   * `relvo` : violet — « ce qui t'attend ici » (pastilles de Conversations),
   * qu'il s'agisse d'un stock à trier ou de ce que Relvo a rangé depuis le
   * dernier passage. Sur l'onglet actif, la teinte s'efface dans le violet.
   */
  countTone?: "neutral" | "relvo";
  /**
   * Point ROUGE « il y a du nouveau », posé sur l'icône (mode `iconOnly`). Signal
   * indépendant du compteur : le compteur dit COMBIEN d'éléments (homogène avec
   * les autres onglets), le point dit QU'il y a du non-lu.
   */
  dot?: boolean;
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
        "flex gap-1 rounded-xl bg-white p-[5px] shadow-surface-2",
        overlap && "relative z-[3] mx-4 -mt-[25px]",
        className,
      )}
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
              "flex flex-1 items-center justify-center gap-1.5 rounded-[9px] px-2 text-[14px] font-semibold whitespace-nowrap transition-colors",
              iconOnly ? "py-[11px]" : "py-[9px]",
              active
                ? "bg-relvo text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(20_18_40/0.2)]"
                : "text-(--text-tertiary) active:bg-(--surface-2)",
            )}
          >
            {iconOnly && Icon ? (
              <span className="relative">
                <Icon className="size-[19px]" strokeWidth={2.2} />
                {opt.dot ? (
                  <span
                    className={cn(
                      "absolute -top-[3px] -right-[3px] size-[9px] rounded-full bg-(--red-600) ring-2",
                      active ? "ring-relvo" : "ring-white",
                    )}
                  />
                ) : null}
              </span>
            ) : (
              opt.label
            )}
            {/* Un compteur à ZÉRO ne s'affiche pas : trois badges dont deux à
                « 0 » n'informent de rien et encombrent une barre déjà dense. */}
            {typeof opt.count === "number" && opt.count > 0 ? (
              <span
                className={cn(
                  "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 font-numeric text-[10.5px] font-bold",
                  active
                    ? "bg-white/30 text-white"
                    : opt.countTone === "relvo"
                      ? "bg-relvo text-white"
                      : "bg-(--surface-2) text-(--text-tertiary)",
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
