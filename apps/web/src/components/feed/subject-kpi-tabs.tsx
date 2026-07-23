"use client";

import { cn } from "@/lib/utils";

// Barre KPI-ONGLETS de Sujets (2026-07-23) — la carte à chiffres devient un
// SÉLECTEUR : chaque cellule (Urgents · Nouveaux · Ouverts · Validés) porte son
// compteur ET agit comme un onglet. La cellule active se teinte de violet Relvo.
// « Fermés » n'a plus d'accès direct ici (récupérable ailleurs, plus tard).
//
// Le rouge reste réservé au SIGNAL d'urgence (rareté) : le chiffre « Urgents »
// est rouge dès qu'il est > 0, actif ou non.

export type SubjectTab = "urgents" | "nouveaux" | "ouverts" | "valides";

const TABS: { key: SubjectTab; label: string }[] = [
  { key: "urgents", label: "Urgents" },
  { key: "nouveaux", label: "Nouveaux" },
  { key: "ouverts", label: "Ouverts" },
  { key: "valides", label: "Validés" },
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
      className="relative z-[3] mx-4 -mt-[30px] flex gap-1 rounded-[22px] bg-white px-1.5 py-2"
      style={{ boxShadow: "var(--shadow-metrics)" }}
      role="tablist"
    >
      {TABS.map((t) => {
        const isActive = t.key === active;
        const count = counts[t.key];
        const urgentSignal = t.key === "urgents" && count > 0;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className={cn(
              "flex flex-1 flex-col items-center gap-[3px] rounded-[15px] px-1 py-1.5 transition-colors",
              isActive ? "bg-relvo-bg" : "active:bg-(--surface-2)",
            )}
          >
            <span
              className={cn(
                "flex h-[30px] items-center font-numeric text-[23px] font-bold tracking-[-1px]",
                urgentSignal
                  ? "text-(--red-600)"
                  : isActive
                    ? "text-relvo"
                    : "text-[#1c1a22]",
              )}
            >
              {count}
            </span>
            <span
              className={cn(
                "text-center text-[11.5px] leading-[1.2] font-semibold",
                isActive ? "text-relvo" : "text-[#9a988f]",
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
