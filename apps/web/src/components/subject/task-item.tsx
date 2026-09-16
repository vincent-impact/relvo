"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, Reply } from "lucide-react";
import { toast } from "sonner";
import { type TaskItemData } from "@/lib/task-item-data";
import { TaskModal } from "@/components/subject/task-modal";
import { completeTaskAction, reopenTaskAction } from "@/server/actions/tasks";
import { folderColor } from "@/lib/display";
import { cn } from "@/lib/utils";

// TaskItem — présentation UNIQUE d'une tâche, partout. Gauche : CASE À COCHER
// (distingue une tâche d'un sujet). Centre : titre + sujet/interlocuteur (si « à
// plat »). DROITE : colonne ~22 % réservée à l'HEURE (RDV) et, selon le contexte
// (`meta`), à la DATE — pour repérer un RDV / une échéance en un coup d'œil :
//   meta="none"  → pas de colonne (ex. « À trier », sans date)
//   meta="time"  → heure (ou « — »)            (ex. agenda « Aujourd'hui »)
//   meta="date"  → date + heure                (ex. « En retard », liste d'un sujet)
// Cocher = terminer / décocher = remettre « à faire » (état fait : barré + gris).
// Tap sur la ligne = modale d'édition. « Répondre » (M7.7) sur une tâche qui se
// règle par un message : ouvre le fil avec le brouillon de Relvo en rédaction.

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
  onStatusChange,
}: {
  task: TaskItemData;
  /** true : liste à plat (Accueil) → montre le sujet + l'interlocuteur. */
  flat?: boolean;
  /** Colonne droite heure/date : none | time (heure seule) | date (date+heure). */
  meta?: "none" | "time" | "date";
  /** Notifie le parent du changement de statut (optimiste) — ex. l'agenda met
   *  à jour ses badges sans attendre le router.refresh. */
  onStatusChange?: (id: string, status: "open" | "done") => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(task.status === "done");

  function toggle() {
    const next = !done;
    setDone(next); // optimiste
    onStatusChange?.(task.id, next ? "done" : "open");
    startTransition(async () => {
      const res = next
        ? await completeTaskAction(task.id)
        : await reopenTaskAction(task.id);
      if (res.ok) {
        toast.success(next ? "Tâche terminée" : "Tâche rouverte");
        router.refresh();
      } else {
        toast.error(res.message);
        setDone(!next);
        onStatusChange?.(task.id, next ? "open" : "done");
      }
    });
  }

  const showSubjectLine =
    flat && Boolean(task.subjectTitle || task.contactName);
  // Le sujet (sous le titre) est CLIQUABLE → fiche du sujet. `from` = page
  // courante pour que le bouton « Retour » y ramène (ex. l'écran Actions).
  const subjectHref =
    task.subjectId && task.subjectTitle
      ? `/sujets/${task.subjectId}?from=${encodeURIComponent(pathname)}`
      : null;

  // Répondre d'un appui : le fil de la tâche, avec le brouillon de Relvo.
  const replyHref =
    task.replyConversationId && !done
      ? `/conversations/${task.replyConversationId}?repondre=${task.id}&from=${encodeURIComponent(pathname)}`
      : null;

  // Les décisions portées par la tâche : à prendre (violet, l'appel de Relvo)
  // ou prises (« Décidé : Oui, commandez »).
  const decisions = task.decisions ?? [];
  const restantes = decisions.filter((d) => d.reponse === null).length;
  const aDecider = restantes > 0 && !done;
  const decisionsLine =
    decisions.length === 0
      ? null
      : aDecider
        ? `✦ ${restantes} décision${restantes > 1 ? "s" : ""} à prendre`
        : `Décidé : ${decisions.map((d) => d.reponse).join(" · ")}`;

  const dateLine = meta === "date" ? dateShortLabel(task.startDate) : null;
  const timeLine = meta !== "none" ? (task.startTime ?? null) : null;
  const colEmpty = !dateLine && !timeLine;
  const late = task.overdue && !done;

  return (
    <>
      <div
        data-list-row
        onClick={() => setOpen(true)}
        className={cn(
          "flex cursor-pointer items-start gap-2.5 border-b border-(--border-light) px-4 py-3.5 active:bg-(--surface-2)",
          done && "bg-(--surface)",
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
              : "border-[#d9d7d1] bg-white text-transparent shadow-pressed hover:border-(--green-600)",
            pending && "opacity-60",
          )}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </button>

        {/* Rail de couleur — domaine (Folder) hérité du sujet, entre la case et
            le texte (visible, contrairement au bord d'écran). */}
        <span
          aria-hidden
          className={cn(
            "my-0.5 w-[3px] flex-none self-stretch rounded-full",
            done && "opacity-40",
          )}
          style={{ background: folderColor(task.folderSlug) }}
        />

        {/* Centre — titre + sujet/interlocuteur. */}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "text-[15px] font-semibold",
              done && "text-[#a8a69d] line-through",
            )}
          >
            {/* Retard : le signal est un POINT rouge + la date en rouge, plus un
                aplat rose sur toute la ligne (la rareté est le signal). */}
            {late ? (
              <span
                aria-hidden
                className="mr-1.5 inline-block size-1.5 rounded-full bg-(--red-600) align-middle"
              />
            ) : null}
            {task.title}
          </div>
          {showSubjectLine ? (
            <p className="mt-0.5 truncate text-[13px] text-(--text-secondary)">
              {task.subjectTitle ? (
                subjectHref ? (
                  <Link
                    href={subjectHref}
                    onClick={(e) => e.stopPropagation()}
                    className="underline decoration-[#c9c7c0] underline-offset-2 hover:text-relvo hover:decoration-relvo"
                  >
                    {task.subjectTitle}
                  </Link>
                ) : (
                  task.subjectTitle
                )
              ) : null}
              {task.subjectTitle && task.contactName ? " · " : ""}
              {task.contactName}
            </p>
          ) : null}
          {/* Les décisions de la tâche (05 §3.1) : ce qu'il reste à décider,
              ou ce qui l'a été — la réponse reste lisible sur la tâche. */}
          {decisionsLine ? (
            <p
              className={cn(
                "mt-1 text-[12.5px] font-semibold",
                aDecider ? "text-relvo" : "text-(--text-secondary)",
              )}
            >
              {decisionsLine}
            </p>
          ) : null}
          {replyHref ? (
            <Link
              href={replyHref}
              onClick={(e) => e.stopPropagation()}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-relvo-bg px-2.5 py-1 text-[12.5px] font-bold text-relvo active:opacity-80"
            >
              <Reply className="size-[14px]" strokeWidth={2.4} />
              {aDecider ? "Décider et répondre" : "Répondre"}
            </Link>
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
                      late ? "text-(--red-600)" : "text-(--text-secondary)",
                    )}
                  >
                    {dateLine}
                  </span>
                ) : null}
                {timeLine ? (
                  <span
                    className={cn(
                      "font-numeric text-[14px] font-bold",
                      late ? "text-(--red-600)" : "text-(--text-primary)",
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
            subjectFolderSlug: task.folderSlug,
            sourceActor: task.sourceActor,
            relvo: task.relvo ?? null,
          }}
        />
      ) : null}
    </>
  );
}
