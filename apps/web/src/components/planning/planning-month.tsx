"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { updateTaskAction } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

// Vue mois draggable (M9.17) — chaque tâche datée est une puce déplaçable
// (dnd-kit) ; chaque jour est une zone de dépôt. Un drop réécrit la date de la
// tâche (updateTask startDate) avec mise à jour optimiste + rollback si échec.
// Tap (sans glissé) = ouverture du sujet (contrainte de distance).

export type PlanningCell = {
  key: string; // YYYY-MM-DD
  day: number;
  inMonth: boolean;
  isToday: boolean;
};

export type PlanningTask = {
  id: string;
  title: string;
  time: string | null;
  color: string;
  subjectId: string | null;
  dayKey: string;
};

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function Chip({ task, dragging }: { task: PlanningTask; dragging?: boolean }) {
  return (
    <span
      className={cn(
        "block truncate rounded-(--rayon-petit) px-1 py-0.5 text-[11px] font-medium text-white",
        dragging && "shadow-lg",
      )}
      style={{ background: task.color }}
      title={task.title}
    >
      {task.time ? `${task.time} ` : ""}
      {task.title}
    </span>
  );
}

function DraggableChip({
  task,
  onOpen,
}: {
  task: PlanningTask;
  onOpen: (t: PlanningTask) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={() => onOpen(task)}
      className={cn(
        "block w-full touch-pan-y text-left",
        isDragging && "opacity-30",
      )}
    >
      <Chip task={task} />
    </button>
  );
}

function DayCell({
  cell,
  tasks,
  onOpen,
}: {
  cell: PlanningCell;
  tasks: PlanningTask[];
  onOpen: (t: PlanningTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cell.key });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[64px] border-t border-(--filet) p-1 transition-colors",
        // Le dépôt se lit au fond enfoncé, jamais au violet pâle de Relvo.
        isOver && "bg-(--fond-enfonce)",
      )}
    >
      <div
        className={cn(
          "chiffre mb-1 flex size-[22px] items-center justify-center rounded-full text-[13px]",
          cell.isToday
            ? "bg-relvo text-white"
            : cell.inMonth
              ? "text-noir"
              : "text-gris",
        )}
      >
        {cell.day}
      </div>
      <div className="space-y-1">
        {tasks.slice(0, 3).map((t) => (
          <DraggableChip key={t.id} task={t} onOpen={onOpen} />
        ))}
        {tasks.length > 3 ? (
          <div className="px-1 text-[11px] font-medium text-gris">
            +{tasks.length - 3}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PlanningMonth({
  cells,
  tasks: initial,
}: {
  cells: PlanningCell[];
  tasks: PlanningTask[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    // Appui long, comme la semaine : un défilement qui part d'une puce ne
    // déplace pas la tâche.
    useSensor(PointerSensor, {
      activationConstraint: { delay: 240, tolerance: 8 },
    }),
  );

  const active = tasks.find((t) => t.id === activeId) ?? null;

  function onOpen(t: PlanningTask) {
    if (t.subjectId) router.push(`/sujets/${t.subjectId}`);
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const dayKey = e.over ? String(e.over.id) : null;
    if (!dayKey) return;
    const task = tasks.find((t) => t.id === id);
    if (!task || task.dayKey === dayKey) return;

    const prev = task.dayKey;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, dayKey } : t)));
    startTransition(async () => {
      const res = await updateTaskAction(id, {
        startDate: new Date(`${dayKey}T00:00:00.000Z`),
      });
      if (res.ok) {
        toast.success("Tâche déplacée");
        router.refresh();
      } else {
        toast.error(res.message);
        setTasks((ts) =>
          ts.map((t) => (t.id === id ? { ...t, dayKey: prev } : t)),
        );
      }
    });
  }

  return (
    // Un `id` stable : sans lui, dnd-kit numérote ses attributs ARIA et le
    // serveur et le client ne tombent pas sur le même numéro (hydratation).
    <DndContext
      id="planning-mois"
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="mt-3 grid grid-cols-7 px-2.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="libelle pb-2 text-center">
            {w}
          </div>
        ))}
        {cells.map((cell) => (
          <DayCell
            key={cell.key}
            cell={cell}
            onOpen={onOpen}
            tasks={tasks.filter((t) => t.dayKey === cell.key)}
          />
        ))}
      </div>
      <DragOverlay>
        {active ? (
          <div className="w-28">
            <Chip task={active} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
