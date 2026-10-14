"use client";

import { cn } from "@/lib/utils";

// IndicatorTabs — LA carte d'indicateurs qui agit comme SÉLECTEUR : Sujets,
// Calendrier, Conversations, Contacts. Chaque cellule porte son compteur ET
// agit comme un onglet. L'indicateur actif est un chiffre CERCLÉ, à distance de
// son libellé (design-system/01-tokens, « La sélection — un cerclage ») ; jamais
// un remplissage, qui ferait un aplat et effacerait un chiffre rouge. La carte
// chevauche le bas du ciel, qui fond derrière elle (`overlap`).
//
// Un compteur à zéro ne s'affiche pas (02-composants) : la cellule reste, son
// chiffre devient un tiret. `tone: "urgent"` rend le chiffre rouge dès qu'il
// est supérieur à zéro, actif ou non — le retard se voit toujours.
// `count: undefined` = pas de chiffre à montrer sur cette cellule (un flux
// déjà vu), le libellé seul.

export type IndicatorTab<K extends string> = {
  key: K;
  label: string;
  count: number | undefined;
  tone?: "neutre" | "urgent";
};

export function IndicatorTabs<K extends string>({
  tabs,
  value,
  onChange,
  overlap = true,
  className,
}: {
  tabs: IndicatorTab<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Chevauche le bas du ciel (la page réserve `pb-[46px]` dans le header). */
  overlap?: boolean;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex rounded-(--rayon-carte) border border-(--filet) bg-white px-1.5 py-2.5 shadow-carte",
        overlap && "relative z-3 mx-4 -mt-7.5",
        className,
      )}
    >
      {tabs.map((t) => {
        const isActive = t.key === value;
        const n = t.count;
        const urgent = t.tone === "urgent" && (n ?? 0) > 0;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className="flex flex-1 flex-col items-center gap-2.5 px-1 pt-1.5 pb-1"
          >
            <span
              className={cn(
                "chiffre grid size-12.5 place-items-center rounded-full text-[28px] leading-none",
                isActive && "cercle-actif",
                urgent && "text-urgent!",
                !isActive && !urgent && "text-noir",
                n === 0 && !isActive && !urgent && "text-(--gris-clair)",
              )}
            >
              {n === undefined ? "" : n === 0 ? "–" : n}
            </span>
            <span
              className={cn(
                "text-center text-[12px] leading-none",
                isActive ? "font-medium text-relvo" : "font-light text-gris",
              )}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
