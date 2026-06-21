import Link from "next/link";
import { Clock, Paperclip, User } from "lucide-react";
import type { EnrichedSubject, Priority, SubjectStatus } from "@relvo/db";
import { formatRelative } from "@/lib/display";
import { cn } from "@/lib/utils";
import {
  StatusBadge,
  SuggestBadge,
  TodoBadge,
  UnreadCount,
  UrgentFlag,
  WaitingBadge,
} from "./badges";

// Carte-sujet partagée (feed Mon fil, Accueil, et plus tard generative UI dans
// le chat). Présentationnelle : tous les marqueurs sont passés en props (dérivés
// côté page). Lien étiré sur toute la carte vers la fiche sujet.

export type SubjectCardData = {
  id: string;
  reference: string;
  title: string;
  summary?: string | null;
  priority: Priority;
  status: SubjectStatus;
  waitingForReply: boolean;
  /** Tâches ouvertes > 0 → marqueur « À faire ». */
  openTaskCount: number;
  /** Suggestions de Relvo non acquittées → « ✦ N suggérées ». */
  suggestionCount: number;
  /** Messages non lus → pastille de coin. */
  unreadCount: number;
  contactName?: string | null;
  attachmentCount: number;
  /** Libellé relatif de dernière activité (« 35 min », « hier »…). */
  lastActivityLabel?: string | null;
  /** Avancement 0..1 (tâches faites / total) — barre de progression. */
  progress?: number | null;
};

export function SubjectCard({
  data,
  tone = "default",
  showSummary = true,
  linkable = true,
}: {
  data: SubjectCardData;
  tone?: "default" | "low" | "done";
  showSummary?: boolean;
  /** false : titre en texte simple (le parent gère tap/swipe, ex. feed swipable). */
  linkable?: boolean;
}) {
  const urgent = data.priority === "critical";

  return (
    <article
      className={cn(
        "relative flex flex-col gap-2.5 rounded-xl border border-(--border-light) p-3.5 shadow-(--shadow-card)",
        tone === "done" ? "bg-(--surface)" : "bg-white",
      )}
    >
      <UnreadCount count={data.unreadCount} corner />

      <div className="flex flex-wrap items-center gap-x-[7px] gap-y-1">
        <span className="text-[11.5px] font-bold tracking-[0.3px] text-(--text-tertiary)">
          {data.reference}
        </span>
        {urgent ? <UrgentFlag /> : null}
        <StatusBadge status={data.status} />
        {tone !== "done" && data.openTaskCount > 0 ? <TodoBadge /> : null}
        {tone !== "done" && data.waitingForReply ? <WaitingBadge /> : null}
      </div>

      <h3 className="text-[15.5px] leading-snug font-bold tracking-[-0.2px]">
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

      {showSummary && data.summary ? (
        <p className="text-[13.5px] text-(--text-secondary)">{data.summary}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-(--text-tertiary)">
        {data.contactName ? (
          <span className="inline-flex items-center gap-1">
            <User className="size-3.5" strokeWidth={2} />
            {data.contactName}
          </span>
        ) : null}
        {data.attachmentCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Paperclip className="size-3.5" strokeWidth={2} />
            {data.attachmentCount}
          </span>
        ) : null}
        {data.lastActivityLabel ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" strokeWidth={2} />
            {data.lastActivityLabel}
          </span>
        ) : null}
        <SuggestBadge count={data.suggestionCount} />
      </div>

      {typeof data.progress === "number" ? (
        <div className="h-[5px] overflow-hidden rounded-[3px] bg-(--surface-2)">
          <div
            className="h-full bg-brand"
            style={{ width: `${Math.round(data.progress * 100)}%` }}
          />
        </div>
      ) : null}
    </article>
  );
}

/** Mappe un sujet enrichi (couche domaine) vers les props de la SubjectCard. */
export function toSubjectCardData(e: EnrichedSubject): SubjectCardData {
  return {
    id: e.subject.id,
    reference: e.subject.reference,
    title: e.subject.title,
    summary: e.subject.summary,
    priority: e.subject.priority,
    status: e.subject.status,
    waitingForReply: e.subject.waitingForReply,
    openTaskCount: e.openTaskCount,
    suggestionCount: e.suggestionCount,
    unreadCount: e.unreadCount,
    contactName: e.contactNames[0] ?? null,
    attachmentCount: e.attachmentCount,
    lastActivityLabel: formatRelative(e.subject.lastActivityAt),
    progress: e.progress,
  };
}
