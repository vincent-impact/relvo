import Link from "next/link";
import { Flag, Hourglass, SquareCheck } from "lucide-react";
import type { EnrichedSubject } from "@relvo/db";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

// SubjectRow — un Sujet rendu comme une LIGNE de liste façon e-mail (Direction
// B simplifiée) : icône teintée par domaine, référence + badges (Urgent / Nouveau),
// titre, résumé, progression des tâches. Pas de rail latéral ni de carte arrondie.
// Le FOND distingue l'état : rouge pâle = urgent, bleu pâle = non vu (new).

export type SubjectRowData = {
  id: string;
  reference: string;
  title: string;
  summary?: string | null;
  folderSlug?: string | null;
  urgent: boolean;
  /** Marqueur DÉRIVÉ « Nouveau » (jamais ouvert) → fond bleu + badge « Nouveau ». */
  isNew: boolean;
  /** Tâches terminées / total → progression (barre x/y). */
  taskDone: number;
  taskTotal: number;
  /** Suggestions Relvo en attente — utilisé par le brief de l'Accueil (pas la card). */
  suggestionCount: number;
  unreadCount: number;
  waitingForReply: boolean;
};

export function SubjectRow({
  data,
  tone = "default",
  linkable = true,
}: {
  data: SubjectRowData;
  tone?: "default" | "done";
  /** false : le parent gère le tap/swipe (feed swipable) — pas de lien étiré. */
  linkable?: boolean;
}) {
  const { color, icon: Icon } = folderVisual(data.folderSlug);
  const urgent = data.urgent && tone !== "done";
  const isNew = data.isNew && tone !== "done";
  const done = tone === "done";
  const pct =
    data.taskTotal > 0 ? Math.round((data.taskDone / data.taskTotal) * 100) : 0;
  const allDone = data.taskTotal > 0 && data.taskDone >= data.taskTotal;

  return (
    <article
      className={cn(
        "relative flex gap-3 border-b border-[#f1efeb] px-4 py-3.5",
        urgent ? "bg-[#fdf1f1]" : isNew ? "bg-(--blue-50)" : null,
        done && "opacity-60",
      )}
    >
      {data.unreadCount > 0 ? (
        <span className="absolute top-3.5 right-4 inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-brand px-1.5 text-[12px] font-bold text-white">
          {data.unreadCount}
        </span>
      ) : null}

      {/* Icône du domaine à gauche (tuile colorée, légèrement réduite). */}
      <span
        className="grid size-9 flex-none place-items-center self-start rounded-[11px] text-white"
        style={{ background: color }}
        title={data.folderSlug ?? undefined}
      >
        <Icon className="size-[17px]" strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-numeric text-[11.5px] font-semibold tracking-[0.3px] text-[#b3b1ab]">
            {data.reference}
          </span>
          {urgent ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-(--red-600) px-[9px] py-[3px] text-[11px] font-bold text-white">
              <Flag className="size-3" fill="currentColor" strokeWidth={0} />
              Urgent
            </span>
          ) : null}
          {isNew ? (
            <span className="inline-flex items-center rounded-full bg-brand px-[9px] py-[3px] text-[11px] font-bold text-white">
              Nouveau
            </span>
          ) : null}
        </div>

        <h3
          className={cn(
            "mt-1 text-[16.5px] font-bold tracking-[-0.2px]",
            done && "line-through",
          )}
        >
          {linkable ? (
            <Link
              href={`/sujets/${data.id}`}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {data.title}
            </Link>
          ) : (
            data.title
          )}
        </h3>

        {data.summary ? (
          <p className="mt-1 text-[13.5px] leading-[1.4] text-[#86857d]">
            {data.summary}
          </p>
        ) : null}

        {!done ? (
          <div className="mt-[9px] flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {data.taskTotal > 0 ? (
              <div className="inline-flex items-center gap-1.5">
                <SquareCheck
                  className={cn(
                    "size-[15px] flex-none",
                    allDone ? "text-(--green-600)" : "text-(--text-tertiary)",
                  )}
                  strokeWidth={2.2}
                />
                <span className="relative block h-1.5 w-16 overflow-hidden rounded-full bg-[#e7e5e0]">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-(--green-600) transition-[width]"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="font-numeric text-[11.5px] font-bold text-(--text-secondary)">
                  {data.taskDone}/{data.taskTotal}
                </span>
              </div>
            ) : null}
            {data.waitingForReply ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f0eeea] px-[9px] py-[3px] text-[11.5px] font-bold whitespace-nowrap text-[#86857d]">
                <Hourglass className="size-3" strokeWidth={2.2} />
                En attente
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** Mappe un sujet enrichi (couche domaine) vers les props de la SubjectRow. */
export function toSubjectRowData(e: EnrichedSubject): SubjectRowData {
  return {
    id: e.subject.id,
    reference: e.subject.reference,
    title: e.subject.title,
    summary: e.subject.summary,
    folderSlug: e.folderSlug,
    urgent: e.subject.priority === "urgent",
    // « Nouveau » = sujet ouvert jamais consulté (marqueur dérivé de lastOpenedAt).
    isNew:
      e.subject.lastOpenedAt == null &&
      !["validated", "closed"].includes(e.subject.status),
    taskDone: e.taskDone,
    taskTotal: e.taskTotal,
    suggestionCount: e.suggestionCount,
    unreadCount: e.unreadCount,
    waitingForReply: e.subject.waitingForReply,
  };
}
