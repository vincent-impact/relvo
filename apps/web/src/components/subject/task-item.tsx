"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { type TaskItemData } from "@/lib/task-item-data";
import { TaskModal } from "@/components/subject/task-modal";
import { completeTaskAction, reopenTaskAction } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

// TaskItem — présentation UNIQUE d'une tâche, partout. Gauche : CASE À COCHER
// (distingue une tâche d'un sujet). Centre : titre + sujet/interlocuteur (si « à
// plat »). DROITE : colonne ~22 % réservée à l'HEURE (RDV) et, selon le contexte
// (`meta`), à la DATE — pour repérer un RDV / une échéance en un coup d'œil :
//   meta="none"  → pas de colonne (ex. « À trier », sans date)
//   meta="time"  → heure (ou « — »)            (ex. agenda « Aujourd'hui »)
//   meta="date"  → date + heure                (ex. « En retard », liste d'un sujet)
// Cocher = terminer / décocher = remettre « à faire » (état fait : barré + gris).
// Tap sur la ligne = modale d'édition.

export type { TaskItemData };

function dateShortLabel(startDate: string | null): string | null {
  if (!startDate) return null;
  return new Date(`${startDate}T00:00:00.000Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function TaskItem({
  task,
  flat = false,
  meta = "none",
}: {
  task: TaskItemData;
  /** true : liste à plat (Accueil) → montre le sujet + l'interlocuteur. */
  flat?: boolean;
  /** Colonne droite heure/date : none | time (heure seule) | date (date+heure). */
  meta?: "none" | "time" | "date";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(task.status === "done");

  function toggle() {
    const next = !done;
    setDone(next); // optimiste
    startTransition(async () => {
      const res = next
        ? await completeTaskAction(task.id)
        : await reopenTaskAction(task.id);
      if (res.ok) router.refresh();
      else {
        toast.error(res.message);
        setDone(!next);
      }
    });
  }

  const subjectLine =
    flat && (task.subjectTitle || task.contactName)
      ? [task.subjectTitle, task.contactName].filter(Boolean).join(" · ")
      : "";

  const dateLine = meta === "date" ? dateShortLabel(task.startDate) : null;
  const timeLine = meta !== "none" ? (task.startTime ?? null) : null;
  const colEmpty = !dateLine && !timeLine;
  const late = task.overdue && !done;

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className={cn(
          "flex cursor-pointer items-start gap-3 border-b border-[#f1efeb] px-4 py-3.5",
          done && "bg-[#f5f3ef]",
        )}
      >
        {/* Case à cocher (gauche) — terminer / remettre à faire. */}
        <button
          type="button"
          aria-label={done ? "Remettre à faire" : "Marquer comme faite"}
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className={cn(
            "mt-px grid size-[22px] flex-none place-items-center rounded-md border-2 transition-colors",
            done
              ? "border-(--green-600) bg-(--green-600) text-white"
              : "border-(--border) text-transparent hover:border-(--green-600)",
            pending && "opacity-60",
          )}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </button>

        {/* Centre — titre + sujet/interlocuteur. */}
        <div className="min-w-0 flex-1">
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
        </div>

        {/* Droite — colonne heure / date (~22 %). */}
        {meta !== "none" ? (
          <div className="flex w-[78px] flex-none flex-col items-end self-center text-right leading-tight">
            {colEmpty ? (
              <span className="text-[14px] text-[#cfcdc6]">—</span>
            ) : (
              <>
                {dateLine ? (
                  <span
                    className={cn(
                      "text-[12px] font-semibold",
                      late ? "text-(--red-600)" : "text-[#86857d]",
                    )}
                  >
                    {dateLine}
                  </span>
                ) : null}
                {timeLine ? (
                  <span
                    className={cn(
                      "font-numeric text-[14px] font-bold",
                      late ? "text-(--red-600)" : "text-[#2a2832]",
                    )}
                  >
                    {timeLine}
                  </span>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>

      {open ? (
        <TaskModal
          open
          onOpenChange={setOpen}
          mode="edit"
          taskId={task.id}
          initial={{
            title: task.title,
            date: task.startDate,
            time: task.startTime,
            subjectId: task.subjectId,
            subjectTitle: task.subjectTitle,
            sourceActor: task.sourceActor,
          }}
        />
      ) : null}
    </>
  );
}
