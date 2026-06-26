"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActorPill } from "@/components/shared/actor-pill";
import { TaskCheckbox } from "@/components/subject/task-checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteTaskAction, updateTaskAction } from "@/server/actions/tasks";
import { formatTaskDate } from "@/lib/display";
import { cn } from "@/lib/utils";
import type { Actor } from "@relvo/db";

// Tâche de la fiche Sujet — ligne (case à cocher + titre + meta) tappable qui
// ouvre une modale d'édition (titre + DATE/heure + suppression). Relvo peut se
// tromper de date, ou l'utilisateur repousser une tâche en retard : l'édition de
// la date est donc centrale (la date = deadline, alimente l'agenda).

export type EditableTask = {
  id: string;
  title: string;
  startDate: Date | null;
  startTime: Date | null;
  status: string;
  sourceActor: Actor;
};

const toDateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const toTimeInput = (d: Date | null) =>
  d ? d.toISOString().slice(11, 16) : "";

export function TaskItem({ task }: { task: EditableTask }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(toDateInput(task.startDate));
  const [time, setTime] = useState(toTimeInput(task.startTime));
  const done = task.status === "done";

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

  return (
    <>
      <div className="mx-[14px] flex items-start gap-3 border-b border-[#f1efeb] px-[18px] py-[13px]">
        <TaskCheckbox taskId={task.id} done={done} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-w-0 flex-1 text-left"
        >
          <div
            className={cn(
              "text-[14.5px] font-semibold",
              done && "text-[#a8a69d] line-through",
            )}
          >
            {task.title}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <ActorPill actor={task.sourceActor} />
            {formatTaskDate(task.startDate, task.startTime) ? (
              <span className="inline-flex items-center gap-1 text-[11.5px] text-[#a8a69d]">
                <CalendarDays className="size-3" strokeWidth={2} />
                {formatTaskDate(task.startDate, task.startTime)}
              </span>
            ) : (
              <span className="text-[11.5px] text-(--text-tertiary) italic">
                Sans date
              </span>
            )}
          </div>
        </button>
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
