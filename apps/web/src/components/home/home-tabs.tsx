"use client";

import { useState } from "react";
import Link from "next/link";
import { AgendaWeek } from "@/components/home/agenda-week";
import { TaskKpiTabs, type TaskTab } from "@/components/home/task-kpi-tabs";
import { TaskItem, type TaskItemData } from "@/components/subject/task-item";

// Cœur de l'Accueil (Direction B) — page « plan d'action ». UNE SEULE barre
// (2026-07-24) qui fusionne l'ancienne carte KPI et la barre de tri : trois
// menus chiffrés qui agissent comme onglets, lus de la même façon (TaskItem) :
//  - Agenda    : semainier SLIDABLE (passé / futur) + tâches du jour, drag&drop.
//  - En retard : toutes les tâches en retard, de la plus récente à la plus
//                ancienne (à plat, avec leur date d'échéance).
//  - À trier   : tâches sans date, à plat.
// Chaque ligne porte le TITRE du sujet en clair (impératif produit).

export type TaskKpis = {
  rdv: number;
  today: number;
  overdue: number;
  untriaged: number;
};

export function HomeTabs({
  kpis,
  tasksByDay,
  rangeStartKey,
  rangeDays,
  todayKey,
  overdue,
  untriaged,
}: {
  kpis: TaskKpis;
  tasksByDay: Record<string, TaskItemData[]>;
  rangeStartKey: string;
  rangeDays: number;
  todayKey: string;
  overdue: TaskItemData[];
  untriaged: TaskItemData[];
}) {
  const [tab, setTab] = useState<TaskTab>("agenda");

  const counts: Record<TaskTab, number> = {
    agenda: kpis.today,
    retard: kpis.overdue,
    afaire: kpis.untriaged,
  };

  return (
    <>
      <TaskKpiTabs active={tab} onChange={setTab} counts={counts} />

      {/* Espace sous la barre pour laisser respirer l'interface. */}
      <div className="pt-4" />

      {tab === "agenda" ? (
        <>
          <AgendaWeek
            initialTasksByDay={tasksByDay}
            rangeStartKey={rangeStartKey}
            rangeDays={rangeDays}
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

      {tab === "retard" ? (
        overdue.length === 0 ? (
          <Empty>Aucune tâche en retard ✦</Empty>
        ) : (
          <div>
            {overdue.map((t) => (
              <TaskItem key={t.id} task={t} flat meta="date" />
            ))}
          </div>
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
