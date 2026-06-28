"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { type TaskItemData } from "@/lib/task-item-data";
import { TaskModal } from "@/components/subject/task-modal";
import { completeTaskAction, reopenTaskAction } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

// TaskItem — présentation UNIQUE d'une tâche, partout (liste d'un sujet OU listes
// de l'Accueil). Contenu épuré : CASE À COCHER (gauche, distingue une tâche d'un
// sujet) + titre + sujet/interlocuteur (si « à plat ») + heure éventuelle. Le
// badge créateur a quitté la ligne (on le retrouve dans la modale). Cocher =
// terminer / décocher = remettre « à faire » (état fait : barré + fond gris).
// Tap sur la ligne (hors case) = modale d'édition. La date n'apparaît dans la
// ligne que hors vues groupées par jour (`showDate`, ex. liste d'un sujet).

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
  showDate = false,
}: {
  task: TaskItemData;
  /** true : liste à plat (Accueil) → montre le sujet + l'interlocuteur. */
  flat?: boolean;
  /** true : affiche la date dans la ligne (vues NON groupées par jour). */
  showDate?: boolean;
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

  // Méta de planification : heure si RDV ; date si demandée (vue non groupée).
  const label = dateLabel(task.startDate);
  const meta = showDate
    ? label
      ? `${label}${task.startTime ? ` · ${task.startTime}` : ""}`
      : null
    : (task.startTime ?? null);

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
          {meta ? (
            <div
              className={cn(
                "mt-1 text-[11.5px] font-semibold",
                task.overdue && !done ? "text-(--red-600)" : "text-[#a8a69d]",
              )}
            >
              {meta}
            </div>
          ) : showDate ? (
            <div className="mt-1 text-[11.5px] text-(--text-tertiary) italic">
              Sans date
            </div>
          ) : null}
        </div>
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
