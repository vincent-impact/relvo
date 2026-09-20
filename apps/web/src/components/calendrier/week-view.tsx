"use client";

import { useState } from "react";
import { AgendaWeek } from "@/components/calendrier/agenda-week";
import {
  TaskKpiTabs,
  type TaskTab,
} from "@/components/calendrier/task-kpi-tabs";
import { TaskItem, type TaskItemData } from "@/components/subject/task-item";
import { ListPanel } from "@/components/shared/list-panel";

// La vue SEMAINE du Calendrier (ex-accueil « plan d'action ») — UNE SEULE barre
// qui fusionne la carte KPI et la barre de tri : trois menus chiffrés qui
// agissent comme onglets, lus de la même façon (TaskItem) :
//  - Aujourd'hui : semainier SLIDABLE (passé / futur) + tâches du jour, drag&drop.
//  - Rendez-vous : les tâches À L'HEURE des prochains jours, à plat, avec leur date.
//  - En retard   : toutes les tâches en retard, de la plus récente à la plus
//                  ancienne (à plat, avec leur date d'échéance).
// Chaque ligne porte le TITRE du sujet en clair (impératif produit).

export type TaskKpis = {
  rdv: number;
  today: number;
  overdue: number;
  untriaged: number;
};

export function WeekView({
  kpis,
  tasksByDay,
  rangeStartKey,
  rangeDays,
  todayKey,
  overdue,
  appointments,
}: {
  kpis: TaskKpis;
  tasksByDay: Record<string, TaskItemData[]>;
  rangeStartKey: string;
  rangeDays: number;
  todayKey: string;
  overdue: TaskItemData[];
  appointments: TaskItemData[];
}) {
  const [tab, setTab] = useState<TaskTab>("agenda");

  const counts: Record<TaskTab, number> = {
    agenda: kpis.today,
    rdv: kpis.rdv,
    retard: kpis.overdue,
  };

  return (
    <>
      <TaskKpiTabs active={tab} onChange={setTab} counts={counts} />

      {/* Espace sous la barre pour laisser respirer l'interface. */}
      <div className="pt-4" />

      {tab === "agenda" ? (
        <AgendaWeek
          initialTasksByDay={tasksByDay}
          rangeStartKey={rangeStartKey}
          rangeDays={rangeDays}
          todayKey={todayKey}
        />
      ) : null}

      {tab === "rdv" ? (
        appointments.length === 0 ? (
          <Empty>Aucun rendez-vous à venir.</Empty>
        ) : (
          <ListPanel className="mt-4">
            {appointments.map((t) => (
              <TaskItem key={t.id} task={t} flat meta="date" />
            ))}
          </ListPanel>
        )
      ) : null}

      {tab === "retard" ? (
        overdue.length === 0 ? (
          <Empty>Aucune tâche en retard ✦</Empty>
        ) : (
          <ListPanel className="mt-4">
            {overdue.map((t) => (
              <TaskItem key={t.id} task={t} flat meta="date" />
            ))}
          </ListPanel>
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
