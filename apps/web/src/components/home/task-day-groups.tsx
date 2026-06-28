"use client";

import { TaskItem } from "@/components/subject/task-item";
import type { TaskItemData } from "@/lib/task-item-data";

// Liste de tâches GROUPÉE par jour (en-tête de date + tâches), même ligne que
// partout (TaskItem). Sert l'onglet « En retard » (jours passés, du plus récent
// au plus ancien : Hier, 25 juin 2026, …) et, plus tard, la vue d'un jour du
// calendrier. Les tâches sont supposées dater (startDate non null).

function dayKeyOffset(dayKey: string, deltaDays: number): string {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function headerLabel(dayKey: string, todayKey: string): string {
  if (dayKey === todayKey) return "Aujourd'hui";
  if (dayKey === dayKeyOffset(todayKey, -1)) return "Hier";
  const long = new Date(`${dayKey}T00:00:00.000Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return long.charAt(0).toUpperCase() + long.slice(1);
}

export function TaskDayGroups({
  tasks,
  todayKey,
  order = "desc",
}: {
  tasks: TaskItemData[];
  todayKey: string;
  /** Ordre des jours : desc (Hier d'abord) pour « En retard ». */
  order?: "asc" | "desc";
}) {
  const byDay = new Map<string, TaskItemData[]>();
  for (const t of tasks) {
    const key = t.startDate ?? "";
    if (!key) continue;
    (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(t);
  }
  const keys = [...byDay.keys()].sort((a, b) =>
    order === "desc" ? b.localeCompare(a) : a.localeCompare(b),
  );

  return (
    <>
      {keys.map((key) => (
        <section key={key}>
          <h3 className="px-5 pt-3.5 pb-1 text-[12.5px] font-bold tracking-[0.3px] text-[#a8a69d] uppercase">
            {headerLabel(key, todayKey)}
          </h3>
          {byDay.get(key)!.map((t) => (
            <TaskItem key={t.id} task={t} flat />
          ))}
        </section>
      ))}
    </>
  );
}
