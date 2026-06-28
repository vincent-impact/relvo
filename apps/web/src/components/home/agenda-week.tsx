"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { TaskItem } from "@/components/subject/task-item";
import type { TaskItemData } from "@/lib/task-item-data";
import { loadAgendaWeekAction } from "@/server/actions/agenda";
import { updateTaskAction } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

// Semainier (Accueil, onglet « Agenda ») — bande de 7 jours SLIDABLE (swipe ou
// chevrons) vers le passé / le futur. Chaque jour porte un badge : ROUGE = nb de
// tâches en retard (jours passés), BLEU = nb de tâches à faire (jour courant +
// futurs). Sous la bande, les tâches du jour SÉLECTIONNÉ (mêmes lignes que
// partout, TaskItem). On peut DÉPLACER une tâche d'un jour à l'autre en la
// MAINTENANT appuyée un instant (long-press → drag, dnd-kit) puis en la lâchant
// sur un autre jour de la bande — réécrit la date (updateTask), optimiste.
// Le drag se fait DANS la semaine visible ; pour replanifier plus loin, on slide
// d'abord, ou on passe par le mois (/planning).

type WeekData = Record<string, TaskItemData[]>;

function keyPlusDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type DayDesc = {
  key: string;
  weekday: string;
  day: number;
  longLabel: string;
  isToday: boolean;
};

function describeWeek(mondayKey: string, todayKey: string): DayDesc[] {
  return Array.from({ length: 7 }, (_, i) => {
    const key = keyPlusDays(mondayKey, i);
    const date = new Date(`${key}T00:00:00.000Z`);
    return {
      key,
      weekday: date
        .toLocaleDateString("fr-FR", { weekday: "short", timeZone: "UTC" })
        .replace(".", ""),
      day: date.getUTCDate(),
      longLabel: cap(
        date.toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        }),
      ),
      isToday: key === todayKey,
    };
  });
}

function weekRangeLabel(days: DayDesc[]): string {
  const first = new Date(`${days[0].key}T00:00:00.000Z`);
  const last = new Date(`${days[6].key}T00:00:00.000Z`);
  const dayNum = (d: Date) => d.getUTCDate();
  const monthShort = (d: Date) =>
    d.toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" });
  const sameMonth = first.getUTCMonth() === last.getUTCMonth();
  return sameMonth
    ? `${dayNum(first)}–${dayNum(last)} ${monthShort(last)}`
    : `${dayNum(first)} ${monthShort(first)} – ${dayNum(last)} ${monthShort(last)}`;
}

// ── Ligne de tâche déplaçable (long-press) ───────────────────────────────────
function DayTaskRow({ task }: { task: TaskItemData }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn("touch-pan-y", isDragging && "opacity-30")}
    >
      <TaskItem task={task} flat meta="time" />
    </div>
  );
}

export function AgendaWeek({
  initialTasksByDay,
  anchorMondayKey,
  todayKey,
}: {
  initialTasksByDay: WeekData;
  anchorMondayKey: string; // lundi (UTC) de la semaine en cours
  todayKey: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [offset, setOffset] = useState(0);
  const [weeks, setWeeks] = useState<Record<number, WeekData>>({
    0: initialTasksByDay,
  });
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [activeId, setActiveId] = useState<string | null>(null);

  const mondayKey = keyPlusDays(anchorMondayKey, offset * 7);
  const days = describeWeek(mondayKey, todayKey);
  const tasksByDay = weeks[offset] ?? {};

  // Jour sélectionné effectif : on garde le choix s'il est dans la semaine
  // affichée, sinon on retombe sur « aujourd'hui » (si visible) ou le 1er jour.
  const weekKeys = days.map((d) => d.key);
  const selected = weekKeys.includes(selectedKey)
    ? selectedKey
    : weekKeys.includes(todayKey)
      ? todayKey
      : weekKeys[0];
  const selectedDesc = days.find((d) => d.key === selected) ?? days[0];
  const dayTasks = tasksByDay[selected] ?? [];

  // Navigation de semaine — déclenchée UNIQUEMENT par une action utilisateur
  // (chevrons / swipe). Charge la semaine cible si elle n'est pas déjà en cache
  // local (seedée pour offset 0). Pas d'effet → pas de setState synchrone en effet.
  function goToOffset(next: number) {
    setOffset(next);
    if (weeks[next]) return;
    setLoading(true);
    const mKey = keyPlusDays(anchorMondayKey, next * 7);
    loadAgendaWeekAction(
      `${mKey}T00:00:00.000Z`,
      `${keyPlusDays(mKey, 7)}T00:00:00.000Z`,
      todayKey,
    )
      .then((data) => setWeeks((w) => ({ ...w, [next]: data })))
      .finally(() => setLoading(false));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 240, tolerance: 8 },
    }),
  );

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    setActiveId(null);
    const dropKey = e.over ? String(e.over.id) : null;
    if (!dropKey || dropKey === selected) return;

    const task = (weeks[offset]?.[selected] ?? []).find((t) => t.id === id);
    if (!task) return;

    // Déplacement optimiste dans la semaine visible.
    setWeeks((w) => {
      const week = { ...(w[offset] ?? {}) };
      week[selected] = (week[selected] ?? []).filter((t) => t.id !== id);
      week[dropKey] = [...(week[dropKey] ?? []), task].sort((a, b) =>
        (a.startTime ?? "").localeCompare(b.startTime ?? ""),
      );
      return { ...w, [offset]: week };
    });

    startTransition(async () => {
      const res = await updateTaskAction(id, {
        startDate: new Date(`${dropKey}T00:00:00.000Z`),
      });
      if (res.ok) {
        toast.success("Tâche déplacée");
        router.refresh();
      } else {
        toast.error(res.message);
        // Rollback.
        setWeeks((w) => {
          const week = { ...(w[offset] ?? {}) };
          week[dropKey] = (week[dropKey] ?? []).filter((t) => t.id !== id);
          week[selected] = [...(week[selected] ?? []), task].sort((a, b) =>
            (a.startTime ?? "").localeCompare(b.startTime ?? ""),
          );
          return { ...w, [offset]: week };
        });
      }
    });
  }

  // ── Swipe horizontal pour changer de semaine ───────────────────────────────
  const touch = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start || activeId) return; // jamais pendant un drag
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      goToOffset(offset + (dx < 0 ? 1 : -1));
    }
  }

  const active =
    activeId != null ? dayTasks.find((t) => t.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="pt-1 pb-0.5">
        {/* Navigation de semaine (chevrons + plage). */}
        <div className="flex items-center justify-between px-[18px] pt-1">
          <button
            type="button"
            aria-label="Semaine précédente"
            onClick={() => goToOffset(offset - 1)}
            className="grid size-8 place-items-center rounded-full text-(--text-secondary) active:bg-(--surface)"
          >
            <ChevronLeft className="size-[18px]" strokeWidth={2.2} />
          </button>
          <span className="text-[13px] font-bold text-(--text-secondary)">
            {weekRangeLabel(days)}
            {offset === 0 ? (
              <span className="ml-1.5 text-relvo">· cette semaine</span>
            ) : null}
          </span>
          <button
            type="button"
            aria-label="Semaine suivante"
            onClick={() => goToOffset(offset + 1)}
            className="grid size-8 place-items-center rounded-full text-(--text-secondary) active:bg-(--surface)"
          >
            <ChevronRight className="size-[18px]" strokeWidth={2.2} />
          </button>
        </div>

        {/* Bande de 7 jours (jours = zones de dépôt). Swipe = change de semaine. */}
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className={cn(
            "flex gap-[9px] px-[18px] pt-1.5 pb-1.5 transition-opacity",
            loading && "opacity-50",
          )}
        >
          {days.map((d) => (
            <DayCell
              key={d.key}
              desc={d}
              isSelected={d.key === selected}
              isPast={d.key < todayKey}
              openCount={
                (tasksByDay[d.key] ?? []).filter((t) => t.status !== "done")
                  .length
              }
              onSelect={() => setSelectedKey(d.key)}
            />
          ))}
        </div>

        <div className="mb-1 px-5 pt-3.5 text-[12.5px] font-bold tracking-[0.3px] text-[#a8a69d] uppercase">
          {selectedDesc.isToday ? "Aujourd'hui" : selectedDesc.longLabel}
        </div>
        {dayTasks.length === 0 ? (
          <p className="px-5 py-2 text-[13.5px] text-(--text-tertiary)">
            {selectedDesc.isToday
              ? "Rien de prévu aujourd'hui."
              : "Rien de prévu ce jour-là."}
          </p>
        ) : (
          dayTasks.map((t) => <DayTaskRow key={t.id} task={t} />)
        )}
      </div>

      <DragOverlay>
        {active ? (
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-lg ring-1 ring-(--border)">
            {active.startTime ? (
              <span className="font-numeric text-[13px] font-bold text-relvo">
                {active.startTime}
              </span>
            ) : null}
            <span className="truncate text-[14px] font-semibold text-(--text-primary)">
              {active.title}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── Jour de la bande (zone de dépôt + badge) ─────────────────────────────────
function DayCell({
  desc,
  isSelected,
  isPast,
  openCount,
  onSelect,
}: {
  desc: DayDesc;
  isSelected: boolean;
  isPast: boolean;
  openCount: number;
  onSelect: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: desc.key });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        "relative w-[50px] flex-none rounded-[15px] pt-[9px] pb-2 text-center transition-shadow",
        desc.isToday ? "bg-relvo" : "bg-[#f5f3ef]",
        isSelected && "ring-2 ring-relvo ring-offset-2 ring-offset-white",
        isOver && "ring-2 ring-relvo ring-offset-2 ring-offset-white",
      )}
    >
      {openCount > 0 ? (
        <span
          className={cn(
            "absolute -top-1.5 -right-1.5 grid size-[18px] place-items-center rounded-full text-[10.5px] font-extrabold text-white ring-2 ring-white",
            isPast ? "bg-(--red-600)" : "bg-relvo",
          )}
        >
          {openCount}
        </span>
      ) : null}
      <div
        className={cn(
          "text-[11px] font-bold tracking-[0.3px] uppercase",
          desc.isToday ? "text-white/80" : "text-[#a8a69d]",
        )}
      >
        {desc.weekday}
      </div>
      <div
        className={cn(
          "mt-[3px] font-heading text-[20px] font-extrabold",
          desc.isToday ? "text-white" : "text-[#2a2832]",
        )}
      >
        {desc.day}
      </div>
    </button>
  );
}
