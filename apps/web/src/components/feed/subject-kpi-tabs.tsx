"use client";

import { cn } from "@/lib/utils";

// Barre KPI-ONGLETS de Sujets — la carte à chiffres est un SÉLECTEUR : chaque
// cellule porte son compteur ET agit comme un onglet, violet PLEIN à l'état
// actif (même idiome que les segmented et les chips ; chiffres Geist tabulaires).
//
// UN SEUL AXE : le STATUT (Ouverts · Validés · Fermés) — décision 2026-07-24.
// Les anciens onglets « Urgents » et « Nouveaux » ont été retirés : ce sont des
// MARQUEURS, pas des états (sous-ensembles des Ouverts), et la liste les
// distingue déjà (fond rouge + drapeau, fond bleu + badge « Nouveau », urgents
// remontés en tête). « La rareté est le signal » : une ligne rouge parle plus
// qu'un onglet affichant « 1 ».

export type SubjectTab = "ouverts" | "valides" | "fermes";

const TABS: { key: SubjectTab; label: string }[] = [
  { key: "ouverts", label: "Ouverts" },
  { key: "valides", label: "Validés" },
  { key: "fermes", label: "Fermés" },
];

export function SubjectKpiTabs({
  active,
  onChange,
  counts,
}: {
  active: SubjectTab;
  onChange: (tab: SubjectTab) => void;
  counts: Record<SubjectTab, number>;
}) {
  return (
    <div
      className="relative z-[3] mx-4 -mt-[30px] flex gap-1 rounded-[14px] bg-white px-1.5 py-2 shadow-surface-2"
      role="tablist"
    >
      {TABS.map((t) => {
        const isActive = t.key === active;
        const count = counts[t.key];
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className={cn(
              "flex flex-1 flex-col items-center gap-[3px] rounded-[10px] px-1 py-1.5 transition-colors",
              isActive
                ? "bg-relvo shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(20_18_40/0.2)]"
                : "active:bg-(--surface-2)",
            )}
          >
            <span
              className={cn(
                "flex h-[30px] items-center text-[22px] font-semibold tracking-[-0.02em] tabular-nums",
                isActive ? "text-white" : "text-(--text-primary)",
              )}
            >
              {count}
            </span>
            <span
              className={cn(
                "text-center text-[11.5px] leading-[1.2] font-semibold",
                isActive ? "text-white" : "text-(--text-secondary)",
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
