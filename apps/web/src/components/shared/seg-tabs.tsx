"use client";

import { type Picto } from "@/components/shared/picto";
import { cn } from "@/lib/utils";

// SegTabs — les ONGLETS d'une fiche (Sujet, Mémoire) : une carte blanche qui
// chevauche le bas du ciel (`overlap`), l'onglet actif SOULIGNÉ d'un trait
// violet — jamais rempli, le violet est la livrée, pas un état (design-system
// 01-tokens, « La sélection ») — et des compteurs ronds condensés. Présentationnel et contrôlé (l'état vit dans le parent).
// Sert aux filtres Mon fil, aux onglets Sujet et de domaine.
//
// Mode `iconOnly` (fiche Sujet, 2026-07-23) : l'icône et son mot dessous, pour
// tenir 4 entrées sur mobile. Le compteur est un BADGE posé SUR l'icône, dans
// son coin haut droit, comme sur un onglet de téléphone — à côté, il
// élargissait l'onglet et sortait de la carte à « 50 » (retour du dirigeant,
// 2026-10-15). Le point rouge du non-lu, lui, tient le coin haut gauche.

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
  icon?: Picto;
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
        "flex rounded-(--rayon-carte) border border-(--filet) bg-white px-1.5 py-1 shadow-carte",
        overlap && "relative z-3 mx-4 -mt-7.5",
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
              "relative flex flex-1 items-center justify-center gap-1.5 text-[14px] whitespace-nowrap transition-colors",
              iconOnly ? "px-1 py-2" : "px-2 py-2.5",
              active ? "font-medium text-relvo" : "font-normal text-gris",
              // L'onglet actif est SOULIGNÉ d'un trait violet, jamais rempli.
              active &&
                "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-relvo after:content-['']",
            )}
          >
            {iconOnly && Icon ? (
              // L'icône, et son mot dessous : quatre icônes sans mot se devinent,
              // elles ne se lisent pas. Le mot tient à 11 px, comme dans le dock.
              <span className="flex flex-col items-center gap-1">
                <span className="relative">
                  <Icon className="size-[20px]" />
                  {/* Un compteur à ZÉRO ne s'affiche pas : un badge « 0 »
                      n'informe de rien. */}
                  {typeof opt.count === "number" && opt.count > 0 ? (
                    <span
                      className={cn(
                        "chiffre absolute -top-1.5 left-[calc(100%-7px)] flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none text-white ring-2 ring-white",
                        opt.countTone === "relvo" || active
                          ? "bg-relvo"
                          : "bg-gris",
                      )}
                    >
                      {opt.count}
                    </span>
                  ) : null}
                  {opt.dot ? (
                    <span className="absolute -top-1 -left-1.5 size-[9px] rounded-full bg-urgent ring-2 ring-white" />
                  ) : null}
                </span>
                <span className="text-[11px] leading-none">{opt.label}</span>
              </span>
            ) : (
              opt.label
            )}
            {/* Un compteur à ZÉRO ne s'affiche pas : trois badges dont deux à
                « 0 » n'informent de rien et encombrent une barre déjà dense. */}
            {!iconOnly && typeof opt.count === "number" && opt.count > 0 ? (
              <span
                className={cn(
                  "chiffre inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px]",
                  opt.countTone === "relvo"
                    ? "bg-relvo text-white"
                    : active
                      ? "bg-relvo-pale text-relvo"
                      : "bg-(--fond-puce) text-gris",
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
