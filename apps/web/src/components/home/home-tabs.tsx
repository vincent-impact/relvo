"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AgendaWeek,
  type AgendaEvent,
  type AgendaWeekDay,
} from "@/components/home/agenda-week";
import { MetricsCard, type Metric } from "@/components/shared/metrics-card";
import { SegTabs } from "@/components/shared/seg-tabs";
import { TaskRow, type TaskRowData } from "@/components/shared/task-row";

// Cœur de l'Accueil (Direction B) — page « plan d'action ». Barre KPI Tâches
// (RDV / Aujourd'hui / En retard / À trier, non cliquable) puis 3 onglets :
//  - Aujourd'hui : la vue agenda (semaine + jour sélectionné), lien vers le mois ;
//  - En retard   : tâches dont l'échéance est passée (tap → sujet) ;
//  - À faire     : tâches sans date.
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
  eventsByDay,
  todayKey,
  overdue,
  untriaged,
}: {
  kpis: TaskKpis;
  weekDays: AgendaWeekDay[];
  eventsByDay: Record<string, AgendaEvent[]>;
  todayKey: string;
  overdue: TaskRowData[];
  untriaged: TaskRowData[];
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

      <div className="px-4 pt-3">
        <SegTabs
          options={[
            {
              value: "aujourdhui",
              label: "Aujourd’hui",
              count: kpis.rdv + kpis.today,
            },
            { value: "retard", label: "En retard", count: kpis.overdue },
            { value: "afaire", label: "À faire", count: kpis.untriaged },
          ]}
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
        />
      </div>

      {tab === "aujourdhui" ? (
        <>
          <AgendaWeek
            days={weekDays}
            eventsByDay={eventsByDay}
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
        <TaskList rows={overdue} empty="Aucune tâche en retard. ✦" />
      ) : null}

      {tab === "afaire" ? (
        <TaskList rows={untriaged} empty="Aucune tâche à trier." />
      ) : null}
    </>
  );
}

function TaskList({ rows, empty }: { rows: TaskRowData[]; empty: string }) {
  if (rows.length === 0) {
    return (
      <p className="px-[22px] py-10 text-center text-[13.5px] text-(--text-tertiary)">
        {empty}
      </p>
    );
  }
  return (
    <div className="pt-1">
      {rows.map((row) => (
        <TaskRow key={row.id} data={row} />
      ))}
    </div>
  );
}
