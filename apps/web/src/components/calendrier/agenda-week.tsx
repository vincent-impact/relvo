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
  type Modifier,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { TaskItem } from "@/components/subject/task-item";
import type { TaskItemData } from "@/lib/task-item-data";
import { updateTaskAction } from "@/server/actions/tasks";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";
import { ListPanel } from "@/components/shared/list-panel";
import { ZoneHeading } from "@/components/shared/zone-heading";

// Semainier (Accueil, onglet « Agenda ») — RAIL de jours qui glisse librement de
// gauche à droite (scroll horizontal natif, sans chevrons), AUJOURD'HUI centré au
// chargement. Le rail couvre une fenêtre bornée autour d'aujourd'hui ; au-delà,
// l'utilisateur passe par la vue mois du Calendrier (/calendrier). Chaque jour porte un
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

function pointerCoords(e: Event): { x: number; y: number } | null {
  if (typeof TouchEvent !== "undefined" && e instanceof TouchEvent) {
    const t = e.touches[0] ?? e.changedTouches[0];
    return t ? { x: t.clientX, y: t.clientY } : null;
  }
  if ("clientX" in e) {
    const m = e as MouseEvent;
    return { x: m.clientX, y: m.clientY };
  }
  return null;
}

// Centre la MINIATURE de drag sur le curseur (et non sur le coin de la tâche
// saisie). Tient compte de la taille propre de l'overlay (≠ taille de la ligne).
const snapCenterToCursor: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  overlayNodeRect,
  transform,
}) => {
  const rect = overlayNodeRect ?? draggingNodeRect;
  if (!rect || !draggingNodeRect || !activatorEvent) return transform;
  const c = pointerCoords(activatorEvent);
  if (!c) return transform;
  return {
    ...transform,
    x: transform.x + c.x - draggingNodeRect.left - rect.width / 2,
    y: transform.y + c.y - draggingNodeRect.top - rect.height / 2,
  };
};

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
function DayTaskRow({
  task,
  onStatusChange,
}: {
  task: TaskItemData;
  onStatusChange: (id: string, status: "open" | "done") => void;
}) {
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
      <TaskItem task={task} flat meta="time" onStatusChange={onStatusChange} />
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

  // Re-synchronise avec le serveur après un `router.refresh` (ex. l'heure d'une
  // tâche modifiée via la modale doit apparaître SANS changer de page). Pattern
  // React « ajuster un state pendant le rendu » (pas d'effet → pas de setState en
  // effet). La référence de `initialTasksByDay` ne change qu'au refresh serveur,
  // donc l'état optimiste (drag / coche) n'est pas écrasé entre deux refresh.
  const [syncedFrom, setSyncedFrom] = useState(initialTasksByDay);
  if (initialTasksByDay !== syncedFrom) {
    setSyncedFrom(initialTasksByDay);
    setTasksByDay(initialTasksByDay);
  }

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
      // « En retard » dépend de la date : déplacer vers le futur/aujourd'hui doit
      // RETIRER le marqueur (fond rouge), le déplacer vers le passé le rétablir.
      const moved = { ...task, overdue: to < todayKey };
      const next = { ...map };
      next[from] = (next[from] ?? []).filter((t) => t.id !== id);
      next[to] = [...(next[to] ?? []), moved].sort((a, b) =>
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

  // Cocher / décocher une tâche met à jour son statut DANS l'état local du rail
  // → les badges (nb ouvertes par jour) se recalculent immédiatement, sans
  // attendre le router.refresh (qui ne réinjecte pas l'état seedé du composant).
  function setTaskStatus(id: string, status: "open" | "done") {
    setTasksByDay((m) => {
      const next: WeekData = {};
      for (const [k, list] of Object.entries(m)) {
        next[k] = list.map((t) => (t.id === id ? { ...t, status } : t));
      }
      return next;
    });
  }

  const active =
    activeId != null ? dayTasks.find((t) => t.id === activeId) : null;

  return (
    // Un `id` stable : sans lui, dnd-kit numérote ses attributs ARIA et le
    // serveur et le client ne tombent pas sur le même numéro (hydratation).
    <DndContext
      id="agenda-semaine"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="pt-0.5 pb-1.5">
        {/* Rail de jours — glisse librement (scroll horizontal), aujourd'hui
            centré. Chaque jour = zone de dépôt. */}
        <div
          ref={railRef}
          className="flex [scrollbar-width:none] gap-1 overflow-x-auto px-3 pt-1 pb-2 [&::-webkit-scrollbar]:hidden"
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

        <div className="pt-3">
          <ZoneHeading
            label={
              selectedDesc.isToday ? "Aujourd'hui" : selectedDesc.longLabel
            }
            hint={
              dayTasks.length > 0
                ? `${dayTasks.filter((t) => t.status !== "done").length} restante${dayTasks.filter((t) => t.status !== "done").length > 1 ? "s" : ""}`
                : undefined
            }
          />
        </div>
        {dayTasks.length === 0 ? (
          // Le même état vide que l'accueil : une carte, pas un texte nu.
          <div className="mx-4 rounded-(--rayon-carte) border border-(--filet) bg-white px-4 py-3.5 text-[14px] font-light text-gris shadow-carte">
            {selectedDesc.isToday
              ? "Rien de prévu aujourd'hui."
              : "Rien de prévu ce jour-là."}
          </div>
        ) : (
          <ListPanel>
            {dayTasks.map((t) => (
              <DayTaskRow key={t.id} task={t} onStatusChange={setTaskStatus} />
            ))}
          </ListPanel>
        )}
      </div>

      {/* Miniature de drag — TAILLE FIXE (indépendante du texte) : pastille de
          couleur du domaine + titre tronqué, heure À DROITE (cohérent avec la
          liste, sans couleur de domaine). */}
      <DragOverlay modifiers={[snapCenterToCursor]}>
        {active ? (
          <div className="flex w-[210px] items-center gap-2 rounded-(--rayon-sous-carte) border border-(--filet) bg-white px-3 py-2.5 shadow-carte">
            <span
              aria-hidden
              className="size-2.5 flex-none rounded-full"
              style={{
                background: folderVisual({ slug: active.folderSlug }).color,
              }}
            />
            <span className="min-w-0 flex-1 truncate text-[14px] font-normal text-noir">
              {active.title}
            </span>
            {active.startTime ? (
              <span className="chiffre flex-none text-[13px] text-gris">
                {active.startTime}
              </span>
            ) : null}
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
  // Le jour : la lettre au-dessus, le chiffre condensé, un point dessous quand
  // il porte des tâches (rouge si elles sont passées et ouvertes). Aujourd'hui
  // est un disque violet ; le jour sélectionné est cerclé — jamais rempli.
  return (
    <button
      ref={(node) => {
        setNodeRef(node);
        registerRef?.(node);
      }}
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className="flex w-12 flex-none flex-col items-center gap-1 pt-1 pb-1"
    >
      <span
        className={cn(
          "text-[11px] leading-3 font-medium tracking-[0.06em] uppercase",
          desc.isToday ? "text-relvo" : "text-gris",
        )}
      >
        {desc.weekday}
      </span>
      <span
        className={cn(
          "chiffre grid size-9 place-items-center rounded-full text-[18px] leading-none transition-shadow",
          desc.isToday ? "bg-relvo text-white" : "text-noir",
          isPast && !desc.isToday && "text-gris",
          (isSelected || isOver) && !desc.isToday && "cercle-actif",
          (isSelected || isOver) &&
            desc.isToday &&
            "ring-2 ring-relvo ring-offset-2 ring-offset-white",
        )}
      >
        {desc.day}
      </span>
      <span
        aria-label={
          openCount > 0
            ? `${openCount} tâche${openCount > 1 ? "s" : ""}`
            : undefined
        }
        className={cn(
          "size-1.5 rounded-full",
          openCount === 0
            ? "bg-transparent"
            : isPast
              ? "bg-urgent"
              : "bg-relvo",
        )}
      />
    </button>
  );
}
