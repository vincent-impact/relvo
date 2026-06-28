"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
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
import { updateTaskAction } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

// Semainier (Accueil, onglet « Agenda ») — RAIL de jours qui glisse librement de
// gauche à droite (scroll horizontal natif, sans chevrons), AUJOURD'HUI centré au
// chargement. Le rail couvre une fenêtre bornée autour d'aujourd'hui ; au-delà,
// l'utilisateur passe par le calendrier mensuel (/planning). Chaque jour porte un
// badge (ROUGE = nb en retard pour les jours passés, BLEU = nb à faire pour
// aujourd'hui/futur) et est une ZONE DE DÉPÔT. Sous le rail, les tâches du jour
// SÉLECTIONNÉ (mêmes lignes que partout, TaskItem). On DÉPLACE une tâche d'un jour
// à l'autre par LONG-PRESS → drag (dnd-kit) ; c'est la POSITION DU CURSEUR qui
// désigne la cellule de dépôt (collision `pointerWithin`).

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

function describeDay(key: string, todayKey: string): DayDesc {
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
  rangeStartKey,
  rangeDays,
  todayKey,
}: {
  initialTasksByDay: WeekData;
  rangeStartKey: string; // 1er jour de la fenêtre (UTC)
  rangeDays: number; // nb de jours couverts par le rail
  todayKey: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [tasksByDay, setTasksByDay] = useState<WeekData>(initialTasksByDay);
  const [selected, setSelected] = useState(todayKey);
  const [activeId, setActiveId] = useState<string | null>(null);

  const days = Array.from({ length: rangeDays }, (_, i) =>
    describeDay(keyPlusDays(rangeStartKey, i), todayKey),
  );
  const selectedDesc =
    days.find((d) => d.key === selected) ??
    days.find((d) => d.isToday) ??
    days[0];
  const dayTasks = tasksByDay[selectedDesc.key] ?? [];

  // Centre AUJOURD'HUI dans le rail au montage (effet DOM, pas de setState).
  const railRef = useRef<HTMLDivElement | null>(null);
  const todayRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const rail = railRef.current;
    const cell = todayRef.current;
    if (rail && cell) {
      rail.scrollLeft =
        cell.offsetLeft - rail.clientWidth / 2 + cell.clientWidth / 2;
    }
  }, []);

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
    const fromKey = selectedDesc.key;
    if (!dropKey || dropKey === fromKey) return;

    const task = (tasksByDay[fromKey] ?? []).find((t) => t.id === id);
    if (!task) return;

    const move = (map: WeekData, to: string, from: string): WeekData => {
      const next = { ...map };
      next[from] = (next[from] ?? []).filter((t) => t.id !== id);
      next[to] = [...(next[to] ?? []), task].sort((a, b) =>
        (a.startTime ?? "").localeCompare(b.startTime ?? ""),
      );
      return next;
    };

    setTasksByDay((m) => move(m, dropKey, fromKey)); // optimiste
    startTransition(async () => {
      const res = await updateTaskAction(id, {
        startDate: new Date(`${dropKey}T00:00:00.000Z`),
      });
      if (res.ok) {
        toast.success("Tâche déplacée");
        router.refresh();
      } else {
        toast.error(res.message);
        setTasksByDay((m) => move(m, fromKey, dropKey)); // rollback
      }
    });
  }

  const active =
    activeId != null ? dayTasks.find((t) => t.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="pt-1 pb-0.5">
        {/* Rail de jours — glisse librement (scroll horizontal), aujourd'hui
            centré. Chaque jour = zone de dépôt. */}
        <div
          ref={railRef}
          className="flex [scrollbar-width:none] gap-[9px] overflow-x-auto px-[18px] pt-2 pb-1.5 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {days.map((d) => (
            <DayCell
              key={d.key}
              desc={d}
              isSelected={d.key === selectedDesc.key}
              isPast={d.key < todayKey}
              openCount={
                (tasksByDay[d.key] ?? []).filter((t) => t.status !== "done")
                  .length
              }
              onSelect={() => setSelected(d.key)}
              registerRef={
                d.isToday
                  ? (n) => {
                      todayRef.current = n;
                    }
                  : undefined
              }
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

// ── Jour du rail (zone de dépôt + badge) ─────────────────────────────────────
function DayCell({
  desc,
  isSelected,
  isPast,
  openCount,
  onSelect,
  registerRef,
}: {
  desc: DayDesc;
  isSelected: boolean;
  isPast: boolean;
  openCount: number;
  onSelect: () => void;
  registerRef?: (node: HTMLElement | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: desc.key });
  return (
    <button
      ref={(node) => {
        setNodeRef(node);
        registerRef?.(node);
      }}
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
