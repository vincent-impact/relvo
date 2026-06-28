import Link from "next/link";
import { Clock, Flag } from "lucide-react";
import type { EnrichedTask } from "@relvo/db";
import { folderVisual } from "@/lib/folders";
import { formatTime } from "@/lib/display";
import { cn } from "@/lib/utils";

// TaskRow — une Tâche rendue comme une LIGNE d'action (Accueil, onglets En retard
// / À faire). Impératif produit : le **titre du sujet en clair** sous le titre de
// la tâche (pas seulement SUB-XXX). Pastille de domaine à gauche, drapeau urgent
// hérité du sujet à droite. Un tap → la fiche du sujet (onglet Tâches).

export type TaskRowData = {
  id: string;
  title: string;
  subjectId: string;
  subjectTitle: string;
  subjectReference: string;
  folderSlug: string | null;
  contactName: string | null;
  /** Urgence héritée du sujet. */
  urgent: boolean;
  /** Libellé de date (« ven. 12 juin »), ou null si sans date. */
  dateLabel: string | null;
  /** Heure (« 09:00 ») pour un RDV, ou null. */
  time: string | null;
  overdue: boolean;
};

/** Mappe une tâche enrichie (couche domaine) vers les props plates de TaskRow. */
export function toTaskRowData(e: EnrichedTask): TaskRowData {
  const start = e.task.startDate;
  return {
    id: e.task.id,
    title: e.task.title,
    subjectId: e.subjectId,
    subjectTitle: e.subjectTitle,
    subjectReference: e.subjectReference,
    folderSlug: e.folderSlug,
    contactName: e.contactName,
    urgent: e.urgent,
    dateLabel: start
      ? start.toLocaleDateString("fr-FR", {
          weekday: "short",
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        })
      : null,
    time: formatTime(e.task.startTime),
    overdue: e.overdue,
  };
}

export function TaskRow({ data }: { data: TaskRowData }) {
  const { color, icon: Icon } = folderVisual(data.folderSlug);

  // Méta de planification : « en retard » prime, sinon heure (RDV) ou date.
  const meta = data.overdue
    ? `En retard${data.dateLabel ? ` · ${data.dateLabel}` : ""}`
    : (data.time ?? data.dateLabel);

  const subjectLine = [data.subjectTitle, data.contactName]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="relative flex gap-3 border-b border-[#f1efeb] px-4 py-3.5">
      <span
        className="grid size-9 flex-none place-items-center self-start rounded-[11px] text-white"
        style={{ background: color }}
        title={data.folderSlug ?? undefined}
      >
        <Icon className="size-[17px]" strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 text-[15.5px] font-bold tracking-[-0.2px]">
            <Link
              href={`/sujets/${data.subjectId}?tab=taches`}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {data.title}
            </Link>
          </h3>
          {data.urgent ? (
            <Flag
              className="mt-0.5 size-[15px] flex-none text-(--red-600)"
              fill="currentColor"
              strokeWidth={0}
            />
          ) : null}
        </div>

        {subjectLine ? (
          <p className="mt-0.5 truncate text-[13px] leading-[1.4] text-[#86857d]">
            {subjectLine}
          </p>
        ) : null}

        {meta ? (
          <div
            className={cn(
              "mt-[7px] inline-flex items-center gap-1.5 text-[12px] font-bold",
              data.overdue ? "text-(--red-600)" : "text-(--text-secondary)",
            )}
          >
            <Clock className="size-[13px]" strokeWidth={2.2} />
            {meta}
          </div>
        ) : null}
      </div>
    </article>
  );
}
