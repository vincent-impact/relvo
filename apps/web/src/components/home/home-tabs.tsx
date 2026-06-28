"use client";

import { useState } from "react";
import Link from "next/link";
import { AgendaWeek, type AgendaWeekDay } from "@/components/home/agenda-week";
import { TaskRangeGroups } from "@/components/home/task-range-groups";
import { MetricsCard, type Metric } from "@/components/shared/metrics-card";
import { SegTabs } from "@/components/shared/seg-tabs";
import { TaskItem, type TaskItemData } from "@/components/subject/task-item";

// Cœur de l'Accueil (Direction B) — page « plan d'action ». Barre KPI Tâches
// (RDV / Aujourd'hui / En retard / À trier, non cliquable) puis 3 onglets, qui
// lisent TOUS les tâches de la même façon (TaskItem) :
//  - Aujourd'hui : agenda (semaine + tâches du jour) + lien vers le mois ;
//  - En retard   : tâches échues, GROUPÉES par jour (Hier / 25 juin 2026 / …) ;
//  - À trier     : tâches sans date, à plat.
// Chaque ligne porte le TITRE du sujet en clair (impératif produit).

type Tab = "aujourdhui" | "retard" | "afaire";

export type TaskKpis = {
  rdv: number;
  today: number;
  overdue: number;
  untriaged: number;
};

export function HomeTabs({
  kpis,
  weekDays,
  tasksByDay,
  todayKey,
  overdue,
  untriaged,
}: {
  kpis: TaskKpis;
  weekDays: AgendaWeekDay[];
  tasksByDay: Record<string, TaskItemData[]>;
  todayKey: string;
  overdue: TaskItemData[];
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
            { value: "aujourdhui", label: "Aujourd’hui" },
            { value: "retard", label: "En retard" },
            { value: "afaire", label: "À trier" },
          ]}
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
        />
      </div>

      {tab === "aujourdhui" ? (
        <>
          <AgendaWeek
            days={weekDays}
            tasksByDay={tasksByDay}
            initialKey={todayKey}
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

      {tab === "retard" ? (
        overdue.length === 0 ? (
          <Empty>Aucune tâche en retard. ✦</Empty>
        ) : (
          <TaskRangeGroups tasks={overdue} todayKey={todayKey} />
        )
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
