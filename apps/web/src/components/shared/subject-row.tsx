import Link from "next/link";
import { Flag, Hourglass, Sparkles, SquareCheck } from "lucide-react";
import type { EnrichedSubject } from "@relvo/db";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

// SubjectRow — un Sujet rendu comme une LIGNE (Direction B), pas une carte
// flottante : rail coloré par domaine + icône teintée, référence, drapeau urgent
// éventuel, titre, résumé, tags marqueurs, pastille bleue de non-lus. La variante
// urgente lave toute la ligne en rouge (rare = signal).

export type SubjectRowData = {
  id: string;
  reference: string;
  title: string;
  summary?: string | null;
  folderSlug?: string | null;
  urgent: boolean;
  /** Statut `new` (jamais ouvert) → badge bleu « Nouveau », perdu à l'ouverture. */
  isNew: boolean;
  openTaskCount: number;
  suggestionCount: number;
  unreadCount: number;
  waitingForReply: boolean;
};

type TagTone = "amber" | "relvo" | "grey";

const TAG_TONE: Record<TagTone, string> = {
  amber: "bg-(--amber-50) text-(--amber-800)",
  relvo: "bg-relvo-bg text-relvo",
  grey: "bg-[#f0eeea] text-[#86857d]",
};

function Tag({
  tone,
  icon: Icon,
  children,
}: {
  tone: TagTone;
  icon?: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-[9px] py-[3px] text-[11.5px] font-bold whitespace-nowrap",
        TAG_TONE[tone],
      )}
    >
      {Icon ? <Icon className="size-3" strokeWidth={2.2} /> : null}
      {children}
    </span>
  );
}

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

  return (
    <article
      className={cn(
        "relative flex gap-3",
        urgent
          ? "mx-3 my-1 rounded-2xl bg-[#fdf1f1] p-3.5"
          : "mx-3.5 border-b border-[#f1efeb] p-3.5",
        done && "opacity-60",
      )}
    >
      {data.unreadCount > 0 ? (
        <span className="absolute top-3.5 right-4 inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-brand px-1.5 text-[12px] font-bold text-white">
          {data.unreadCount}
        </span>
      ) : null}

      {!urgent ? (
        <span
          className="w-1 flex-none self-stretch rounded-full"
          style={{ background: color }}
        />
      ) : null}

      <span
        className="grid size-10 flex-none place-items-center self-start rounded-xl text-white"
        style={{ background: urgent ? "var(--red-600)" : color }}
      >
        <Icon className="size-[19px]" strokeWidth={1.9} />
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
          <div className="mt-[9px] flex flex-wrap items-center gap-[7px]">
            {data.openTaskCount > 0 ? (
              <Tag tone="amber" icon={SquareCheck}>
                À faire · {data.openTaskCount}
              </Tag>
            ) : null}
            {data.waitingForReply ? (
              <Tag tone="grey" icon={Hourglass}>
                En attente
              </Tag>
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
    isNew: e.subject.status === "new",
    openTaskCount: e.openTaskCount,
    suggestionCount: e.suggestionCount,
    unreadCount: e.unreadCount,
    waitingForReply: e.subject.waitingForReply,
  };
}
