"use client";

import { useState } from "react";
import { TaskItem } from "@/components/subject/task-item";
import type { TaskItemData } from "@/lib/task-item-data";
import { cn } from "@/lib/utils";

// Agenda semaine (Accueil, onglet « Aujourd'hui ») — bande horizontale de 7 jours
// cliquables, puis les TÂCHES du jour SÉLECTIONNÉ, rendues avec la MÊME ligne que
// partout (TaskItem). « aujourd'hui » = pastille violette pleine ; « jour
// sélectionné » = anneau violet. Plus tard, le clic sur un jour du calendrier
// (mois) affichera ses tâches de la même façon.

export type AgendaWeekDay = {
  key: string; // ISO date YYYY-MM-DD (UTC, cohérent avec le seed)
  weekday: string;
  day: number;
  longLabel: string; // « Lundi 16 juin » (capitalisé)
  isToday: boolean;
  hasEvents: boolean;
};

export function AgendaWeek({
  days,
  tasksByDay,
  initialKey,
}: {
  days: AgendaWeekDay[];
  tasksByDay: Record<string, TaskItemData[]>;
  initialKey: string;
}) {
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const selected = days.find((d) => d.key === selectedKey) ?? days[0];
  const tasks = tasksByDay[selectedKey] ?? [];

  return (
    <div className="pt-1 pb-0.5">
      <div className="flex [scrollbar-width:none] gap-[9px] overflow-x-auto px-[18px] pt-1 pb-1.5 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {days.map((d) => {
          const isSelected = d.key === selectedKey;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setSelectedKey(d.key)}
              aria-pressed={isSelected}
              className={cn(
                "w-[50px] flex-none rounded-[15px] pt-[9px] pb-2 text-center transition-shadow",
                d.isToday ? "bg-relvo" : "bg-[#f5f3ef]",
                isSelected &&
                  "ring-2 ring-relvo ring-offset-2 ring-offset-white",
              )}
            >
              <div
                className={cn(
                  "text-[11px] font-bold tracking-[0.3px] uppercase",
                  d.isToday ? "text-white/80" : "text-[#a8a69d]",
                )}
              >
                {d.weekday}
              </div>
              <div
                className={cn(
                  "mt-[3px] font-heading text-[20px] font-extrabold",
                  d.isToday ? "text-white" : "text-[#2a2832]",
                )}
              >
                {d.day}
              </div>
              <div
                className={cn(
                  "mx-auto mt-[5px] size-[5px] rounded-full",
                  !d.hasEvents
                    ? "bg-transparent"
                    : d.isToday
                      ? "bg-white"
                      : "bg-brand",
                )}
              />
            </button>
          );
        })}
      </div>

      <div className="mb-1 px-5 pt-3.5 text-[12.5px] font-bold tracking-[0.3px] text-[#a8a69d] uppercase">
        {selected.isToday ? "Aujourd'hui" : selected.longLabel}
      </div>
      {tasks.length === 0 ? (
        <p className="px-5 py-2 text-[13.5px] text-(--text-tertiary)">
          {selected.isToday
            ? "Rien de prévu aujourd'hui."
            : "Rien de prévu ce jour-là."}
        </p>
      ) : (
        tasks.map((t) => <TaskItem key={t.id} task={t} flat meta="time" />)
      )}
    </div>
  );
}
