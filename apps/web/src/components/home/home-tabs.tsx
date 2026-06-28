"use client";

import { useState } from "react";
import Link from "next/link";
import { AgendaWeek } from "@/components/home/agenda-week";
import { MetricsCard, type Metric } from "@/components/shared/metrics-card";
import { SegTabs } from "@/components/shared/seg-tabs";
import { TaskItem, type TaskItemData } from "@/components/subject/task-item";

// Cœur de l'Accueil (Direction B) — page « plan d'action ». Barre KPI Tâches
// (RDV / Aujourd'hui / En retard / À trier, non cliquable) puis 2 onglets, qui
// lisent les tâches de la même façon (TaskItem) :
//  - Agenda   : semainier SLIDABLE (passé / futur) + tâches du jour sélectionné,
//               drag&drop d'une tâche d'un jour à l'autre. Les tâches en retard
//               se retrouvent en slidant vers les jours passés (badges rouges) —
//               plus d'onglet « En retard » dédié.
//  - À trier  : tâches sans date, à plat.
// Chaque ligne porte le TITRE du sujet en clair (impératif produit).

type Tab = "aujourdhui" | "afaire";

export type TaskKpis = {
  rdv: number;
  today: number;
  overdue: number;
  untriaged: number;
};

export function HomeTabs({
  kpis,
  tasksByDay,
  anchorMondayKey,
  todayKey,
  untriaged,
}: {
  kpis: TaskKpis;
  tasksByDay: Record<string, TaskItemData[]>;
  anchorMondayKey: string;
  todayKey: string;
  untriaged: TaskItemData[];
}) {
  const [tab, setTab] = useState<Tab>("aujourdhui");

  const metrics: Metric[] = [
    { value: kpis.rdv, label: "RDV" },
    { value: kpis.today, label: "Aujourd’hui" },
    {
      value: kpis.overdue,
      label: "En retard",
      ...(kpis.overdue > 0 ? { tone: "urgent" as const } : {}),
    },
    { value: kpis.untriaged, label: "À trier" },
  ];

  return (
    <>
      <MetricsCard metrics={metrics} />

      {/* Onglets SANS compteurs (les KPI au-dessus jouent ce rôle), + espace
          sous la barre pour laisser respirer l'interface. */}
      <div className="px-4 pt-3 pb-4">
        <SegTabs
          options={[
            { value: "aujourdhui", label: "Agenda" },
            { value: "afaire", label: "À trier" },
          ]}
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
        />
      </div>

      {tab === "aujourdhui" ? (
        <>
          <AgendaWeek
            initialTasksByDay={tasksByDay}
            anchorMondayKey={anchorMondayKey}
            todayKey={todayKey}
          />
          <div className="px-5 pt-1 pb-2">
            <Link
              href="/planning"
              className="text-[13px] font-bold text-relvo active:opacity-70"
            >
              Voir le mois →
            </Link>
          </div>
        </>
      ) : null}

      {tab === "afaire" ? (
        untriaged.length === 0 ? (
          <Empty>Aucune tâche à trier.</Empty>
        ) : (
          <div>
            {untriaged.map((t) => (
              <TaskItem key={t.id} task={t} flat />
            ))}
          </div>
        )
      ) : null}
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-[22px] py-10 text-center text-[13.5px] text-(--text-tertiary)">
      {children}
    </p>
  );
}
