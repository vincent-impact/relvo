"use client";

import { TaskItem } from "@/components/subject/task-item";
import type { TaskItemData } from "@/lib/task-item-data";

// Tâches en retard GROUPÉES par PLAGE d'ancienneté (et non par jour) : « 7
// derniers jours », « 30 derniers jours », « Plus de 30 jours ». Chaque ligne
// (TaskItem, meta="date") porte sa propre date — la section couvrant plusieurs
// jours. Tâches supposées datées (startDate non null).

const BUCKETS = [
  { label: "7 derniers jours", max: 7 },
  { label: "30 derniers jours", max: 30 },
  { label: "Plus de 30 jours", max: Infinity },
] as const;

function daysBetween(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T00:00:00.000Z`).getTime();
  const to = new Date(`${toKey}T00:00:00.000Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function TaskRangeGroups({
  tasks,
  todayKey,
}: {
  tasks: TaskItemData[];
  todayKey: string;
}) {
  // Répartit dans les plages (par ancienneté), tâches triées du + récent au + ancien.
  const sorted = [...tasks].sort((a, b) =>
    (b.startDate ?? "").localeCompare(a.startDate ?? ""),
  );
  const groups = BUCKETS.map((b) => ({ ...b, items: [] as TaskItemData[] }));
  for (const t of sorted) {
    if (!t.startDate) continue;
    const age = daysBetween(t.startDate, todayKey);
    const bucket =
      groups.find((g) => age <= g.max) ?? groups[groups.length - 1];
    bucket.items.push(t);
  }

  return (
    <>
      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <section key={g.label}>
            <h3 className="px-5 pt-3.5 pb-1 text-[12.5px] font-bold tracking-[0.3px] text-[#a8a69d] uppercase">
              {g.label}
            </h3>
            {g.items.map((t) => (
              <TaskItem key={t.id} task={t} flat meta="date" />
            ))}
          </section>
        ))}
    </>
  );
}
