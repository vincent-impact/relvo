"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Clock, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { type TaskItemData } from "@/lib/task-item-data";
import { ActorPill } from "@/components/shared/actor-pill";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  completeTaskAction,
  deleteTaskAction,
  reopenTaskAction,
  updateTaskAction,
} from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

// TaskItem — présentation UNIQUE d'une tâche, partout (liste d'un sujet OU liste
// à plat de l'Accueil). Contenu : titre, (sujet + interlocuteur si « à plat »),
// badge créateur (Relvo/Moi) et date. Gestes alignés sur les sujets :
//   - swipe → DROITE = Terminer (vert)        → completeTaskAction
//   - swipe ← GAUCHE = remettre « à faire »   → reopenTaskAction
//   - tap (sans glissé)                        → modale d'édition (titre/date/suppr.)
// L'état « fait » garde son graphisme : titre barré + fond gris. Pas de case à
// cocher (le swipe la remplace, cohérent avec les sujets).

const THRESHOLD = 80;

export type { TaskItemData };

function dateLabel(startDate: string | null): string | null {
  if (!startDate) return null;
  return new Date(`${startDate}T00:00:00.000Z`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function TaskItem({
  task,
  flat = false,
}: {
  task: TaskItemData;
  /** true : liste à plat (Accueil) → montre le sujet + l'interlocuteur. */
  flat?: boolean;
}) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(task.status === "done");
  const [dir, setDir] = useState(0); // -1 rouvrir · 0 repos · 1 terminer

  // Édition (modale).
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(task.startDate ?? "");
  const [time, setTime] = useState(task.startTime ?? "");

  const g = useRef({
    sx: 0,
    sy: 0,
    dx: 0,
    active: false,
    decided: false,
    horiz: false,
    moved: false,
  });

  function setX(x: number, animate = false) {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform .2s ease" : "none";
    el.style.transform = `translateX(${x}px)`;
  }

  function commit(
    action: () => Promise<{ ok: true } | { ok: false; message: string }>,
    optimisticDone: boolean,
    okMsg: string,
  ) {
    setDone(optimisticDone); // feedback immédiat (barré+gris ou non)
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        toast.success(okMsg);
        router.refresh();
      } else {
        toast.error(res.message);
        setDone(!optimisticDone);
      }
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    const s = g.current;
    s.sx = e.clientX;
    s.sy = e.clientY;
    s.dx = 0;
    s.active = true;
    s.decided = false;
    s.horiz = false;
    s.moved = false;
    cardRef.current?.setPointerCapture?.(e.pointerId);
    setX(0);
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = g.current;
    if (!s.active) return;
    const mx = e.clientX - s.sx;
    const my = e.clientY - s.sy;
    if (!s.decided && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      s.decided = true;
      s.horiz = Math.abs(mx) > Math.abs(my);
    }
    if (s.decided && s.horiz) {
      s.moved = true;
      s.dx = mx;
      const nextDir = mx > 0 ? 1 : mx < 0 ? -1 : 0;
      if (nextDir !== dir) setDir(nextDir);
      setX(mx);
    }
  }

  function onPointerEnd() {
    const s = g.current;
    if (!s.active) return;
    s.active = false;
    if (s.horiz && s.dx > THRESHOLD) {
      setX(0, true);
      setDir(0);
      commit(() => completeTaskAction(task.id), true, "Tâche terminée");
    } else if (s.horiz && s.dx < -THRESHOLD) {
      setX(0, true);
      setDir(0);
      commit(() => reopenTaskAction(task.id), false, "Tâche à faire");
    } else {
      setDir(0);
      setX(0, true);
    }
  }

  function onClick() {
    if (g.current.moved) {
      g.current.moved = false;
      return;
    }
    setOpen(true);
  }

  function save() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Le titre est requis.");
      return;
    }
    const startDate = date ? new Date(`${date}T00:00:00.000Z`) : null;
    const startTime = date && time ? new Date(`${date}T${time}:00.000Z`) : null;
    startTransition(async () => {
      const res = await updateTaskAction(task.id, {
        title: trimmed,
        startDate,
        startTime,
      });
      if (res.ok) {
        toast.success("Tâche mise à jour");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteTaskAction(task.id);
      if (res.ok) {
        toast.success("Tâche supprimée");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  const label = dateLabel(task.startDate);
  const subjectLine = flat
    ? [task.subjectTitle, task.contactName].filter(Boolean).join(" · ")
    : "";

  return (
    <>
      <div className="relative overflow-hidden">
        {/* Fond Terminer (vert) — glisser à droite, libellé à gauche. */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-start gap-2 bg-(--green-600) pl-6 text-white",
            dir < 0 && "hidden",
          )}
        >
          <Check className="size-[22px]" strokeWidth={2.4} />
          <span className="text-[11px] font-bold tracking-[0.3px]">
            Terminer
          </span>
        </div>
        {/* Fond À faire (gris) — glisser à gauche, libellé à droite. */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-end gap-2 bg-[#8a8980] pr-6 text-white",
            dir >= 0 && "hidden",
          )}
        >
          <span className="text-[11px] font-bold tracking-[0.3px]">
            À faire
          </span>
          <RotateCcw className="size-[20px]" strokeWidth={2.2} />
        </div>

        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClick={onClick}
          className={cn(
            "relative flow-root cursor-pointer touch-pan-y border-b border-[#f1efeb]",
            done ? "bg-[#f5f3ef]" : "bg-white",
          )}
        >
          <div className="px-4 py-3.5">
            <div
              className={cn(
                "text-[15px] font-semibold",
                done && "text-[#a8a69d] line-through",
              )}
            >
              {task.title}
            </div>

            {subjectLine ? (
              <p className="mt-0.5 truncate text-[13px] text-[#86857d]">
                {subjectLine}
              </p>
            ) : null}

            <div className="mt-1.5 flex items-center gap-2">
              <ActorPill actor={task.sourceActor} />
              {label ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11.5px] font-semibold",
                    task.overdue && !done
                      ? "text-(--red-600)"
                      : "text-[#a8a69d]",
                  )}
                >
                  <CalendarDays className="size-3" strokeWidth={2} />
                  {label}
                  {task.startTime ? ` · ${task.startTime}` : ""}
                </span>
              ) : (
                <span className="text-[11.5px] text-(--text-tertiary) italic">
                  Sans date
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-4 p-5">
          <DialogHeader>
            <DialogTitle>Modifier la tâche</DialogTitle>
          </DialogHeader>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Intitulé de la tâche"
            className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[15px] font-semibold outline-none focus:border-relvo"
          />

          <div className="flex gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-(--border) px-3 py-2.5">
              <CalendarDays
                className="size-4 flex-none text-(--text-tertiary)"
                strokeWidth={2}
              />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
              />
            </label>
            <label
              className={cn(
                "flex items-center gap-2 rounded-xl border border-(--border) px-3 py-2.5",
                !date && "opacity-50",
              )}
            >
              <Clock
                className="size-4 flex-none text-(--text-tertiary)"
                strokeWidth={2}
              />
              <input
                type="time"
                value={time}
                disabled={!date}
                onChange={(e) => setTime(e.target.value)}
                className="w-[72px] bg-transparent text-[14px] outline-none"
              />
            </label>
          </div>
          {date ? (
            <button
              type="button"
              onClick={() => {
                setDate("");
                setTime("");
              }}
              className="-mt-1 self-start text-[12.5px] font-semibold text-(--text-tertiary)"
            >
              Retirer la date
            </button>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="flex-1 rounded-xl bg-relvo py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              aria-label="Supprimer la tâche"
              className="grid size-[42px] flex-none place-items-center rounded-xl border border-(--red-200) text-(--red-600) disabled:opacity-60"
            >
              <Trash2 className="size-[18px]" strokeWidth={2} />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
