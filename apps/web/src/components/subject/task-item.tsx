"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { ArrowBendUpLeft } from "@/components/shared/picto";
import { toast } from "sonner";
import { type TaskItemData } from "@/lib/task-item-data";
import { TaskModal } from "@/components/subject/task-modal";
import { completeTaskAction, reopenTaskAction } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

// TaskItem — présentation UNIQUE d'une tâche, partout. Gauche : CASE À COCHER
// ronde (distingue une tâche d'un sujet). Pas de bande de domaine : le sujet
// est écrit sous le titre, et une tâche n'en porte pas deux fois la couleur
// (design-system/02-composants, « une bande par carte ou par ligne »). Centre : titre + sujet/interlocuteur (si « à
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
          "flex cursor-pointer items-start gap-3 border-b border-(--filet) px-3.5 py-3 active:bg-(--fond-puce)",
          done && "bg-(--fond-enfonce)",
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
            "mt-px grid size-[22px] flex-none place-items-center rounded-full border-2 transition-colors",
            done
              ? "border-relvo bg-relvo text-white"
              : "border-(--gris-clair) bg-white text-transparent hover:border-relvo",
            pending && "opacity-60",
          )}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </button>

        {/* Centre — titre + sujet/interlocuteur. */}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "text-[14.5px] leading-[18px] font-normal",
              done && "text-gris line-through",
            )}
          >
            {/* Retard : le signal est un POINT rouge + la date en rouge, plus un
                aplat rose sur toute la ligne (la rareté est le signal). */}
            {late ? (
              <span
                aria-hidden
                className="mr-1.5 inline-block size-2 rounded-full bg-urgent align-middle"
              />
            ) : null}
            {task.title}
          </div>
          {showSubjectLine ? (
            <p className="mt-0.5 truncate text-[12px] font-light text-gris">
              {task.subjectTitle ? (
                subjectHref ? (
                  <Link
                    href={subjectHref}
                    onClick={(e) => e.stopPropagation()}
                    className="underline decoration-(--gris-clair) underline-offset-2 hover:text-relvo hover:decoration-relvo"
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
                "mt-1 text-[12.5px] font-medium",
                aDecider ? "text-relvo" : "text-gris",
              )}
            >
              {decisionsLine}
            </p>
          ) : null}
          {replyHref ? (
            <Link
              href={replyHref}
              onClick={(e) => e.stopPropagation()}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-(--rayon-pilule) bg-relvo-pale px-2.5 py-1 text-[12px] font-medium text-relvo active:opacity-80"
            >
              <ArrowBendUpLeft className="size-[14px]" />
              {aDecider ? "Décider et répondre" : "Répondre"}
            </Link>
          ) : null}
        </div>

        {/* Droite — colonne heure / date (~22 %). */}
        {meta !== "none" ? (
          <div className="flex w-[78px] flex-none flex-col items-end self-center text-right leading-tight">
            {colEmpty ? (
              <span className="text-[14px] text-(--gris-clair)">—</span>
            ) : (
              <>
                {dateLine ? (
                  <span
                    className={cn(
                      "chiffre text-[13px]",
                      late
                        ? "text-urgent line-through decoration-2"
                        : "text-gris",
                    )}
                  >
                    {dateLine}
                  </span>
                ) : null}
                {timeLine ? (
                  <span
                    className={cn(
                      "chiffre text-[19px] leading-[22px]",
                      late
                        ? "text-urgent line-through decoration-2"
                        : "text-noir",
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
