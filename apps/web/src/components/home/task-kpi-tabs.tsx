"use client";

import { cn } from "@/lib/utils";

// Barre KPI-ONGLETS de l'Accueil (2026-07-24) — fusion de l'ancienne carte KPI
// et de la barre de tri en UNE SEULE barre (même principe que la page Sujets) :
// trois menus, chacun affichant son compteur ET agissant comme onglet.
//   • Agenda   → nombre de tâches AUJOURD'HUI
//   • En retard → nombre de tâches en retard (chiffre rouge dès qu'il est > 0)
//   • À trier   → nombre de tâches sans date
// La cellule active se teinte de violet Relvo.

export type TaskTab = "agenda" | "retard" | "afaire";

const TABS: { key: TaskTab; label: string }[] = [
  { key: "agenda", label: "Aujourd'hui" },
  { key: "retard", label: "En retard" },
  { key: "afaire", label: "À trier" },
];

export function TaskKpiTabs({
  active,
  onChange,
  counts,
}: {
  active: TaskTab;
  onChange: (tab: TaskTab) => void;
  counts: Record<TaskTab, number>;
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
        // Le rouge signale le retard (comme « Urgents » sur Sujets) : dès qu'il
        // y a une tâche en retard, le chiffre est rouge, actif ou non.
        const lateSignal = t.key === "retard" && count > 0;
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
                lateSignal
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
