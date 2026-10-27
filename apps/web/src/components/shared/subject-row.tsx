import Link from "next/link";
import type { EnrichedSubject } from "@relvo/db";
import { RELVO_LOGO_PATHS } from "@/components/layout/relvo-logo";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

// SubjectRow — LA ligne de sujet, le composant le plus important du produit
// (design-system/00-brief-da §7). Son anatomie, direction « Lettrage
// d'artisan » : la BANDE de son domaine sur la tranche gauche, le nom du
// domaine en capitales condensées de la même couleur, le titre (précédé de
// « Urgent · » en rouge quand la priorité l'est — l'état se lit au mot et à la
// couleur), une ligne fine qui dit où en est le sujet, et à droite un chiffre
// condensé (non-lus ou tâches) avec ce qu'on attend dessous. Pas de résumé :
// la ligne doit laisser neuf sujets visibles, le résumé vit sur la fiche.

export type SubjectRowData = {
  id: string;
  reference: string;
  title: string;
  summary?: string | null;
  /** Les clés de logo du PREMIER NIVEAU du dossier (M23.4) — la bande. */
  folderSlug?: string | null;
  folderName?: string | null;
  /** Le chemin lisible (« Clients › Narbonne ») — ce que la ligne écrit. */
  folderPath?: string | null;
  folderColor?: string | null;
  folderIcon?: string | null;
  /** La chaîne du dossier, Général exclu : la ligne répond au filtre d'un père. */
  folderChainIds?: string[];
  urgent: boolean;
  /** Marqueur DÉRIVÉ « Nouveau » (jamais ouvert). */
  isNew: boolean;
  /** Tâches terminées / total → progression. */
  taskDone: number;
  taskTotal: number;
  /** Suggestions Relvo en attente — utilisé par le brief de l'Accueil (pas la ligne). */
  suggestionCount: number;
  unreadCount: number;
  waitingForReply: boolean;
  /** Relvo suggère de valider le sujet ; le geste reste au swipe (05 §5.5). */
  resolutionSuggested: boolean;
};

// La ligne fine sous le titre ne redit rien de la colonne droite (le compte de
// tâches y est en condensé, l'attente y est écrite) : elle porte le résumé
// court du sujet quand il existe, sinon rien — jamais une référence, personne
// ne reconnaît un sujet à son code.
function statusLine(d: SubjectRowData): string | null {
  return d.summary?.trim() || null;
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
  const { color, text } = folderVisual({
    slug: data.folderSlug,
    color: data.folderColor,
    icon: data.folderIcon,
  });
  const done = tone === "done";
  const urgent = data.urgent && !done;
  const isNew = data.isNew && !done;
  // Ce que la colonne droite dit sous le chiffre : seulement l'EXCEPTION —
  // Relvo qui parle (violet, signé) ou un tiers qu'on attend. L'état par
  // défaut (« à vous », des tâches ouvertes) ne se nomme pas : sous sept lignes
  // sur neuf, il n'était plus un signal mais du bruit.
  const right: { kind: "relvo" | "neutre"; label: string } | null = done
    ? null
    : data.resolutionSuggested
      ? { kind: "relvo", label: "à valider" }
      : isNew
        ? { kind: "relvo", label: "nouveau" }
        : data.waitingForReply
          ? { kind: "neutre", label: "attend" }
          : null;
  const line = statusLine(data);

  return (
    <article
      data-list-row
      className={cn(
        "relative flex h-[58px] items-center gap-2.5 border-b border-(--filet) pr-3.5 pl-3.5",
        done && "bg-(--fond-enfonce)",
      )}
    >
      <span
        aria-hidden
        className={cn("bande-ligne", done && "opacity-40")}
        style={{ background: color }}
      />

      <div className="min-w-0 flex-1">
        <div
          className={cn("domaine truncate", done && "opacity-60")}
          style={{ color: text }}
        >
          {data.folderPath ??
            data.folderName ??
            data.folderSlug ??
            "Sans dossier"}
        </div>
        <h3
          className={cn(
            "truncate text-[14.5px] leading-[18px] font-normal text-noir",
            done && "text-gris line-through",
          )}
        >
          {urgent ? (
            <span className="font-medium text-urgent">Urgent · </span>
          ) : null}
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
        {line ? (
          <p className="truncate text-[12px] leading-[14px] font-normal text-gris">
            {line}
          </p>
        ) : null}
      </div>

      <div className="flex flex-none flex-col items-end gap-0.5 text-right">
        {data.unreadCount > 0 ? (
          <span className="chiffre grid h-[22px] min-w-[22px] place-items-center rounded-full bg-relvo px-1.5 text-[12px] text-white">
            {data.unreadCount}
          </span>
        ) : data.taskTotal > 0 && !done ? (
          <span className="chiffre text-[16px] leading-[18px] text-noir">
            {data.taskDone}/{data.taskTotal}
          </span>
        ) : null}
        {right ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] leading-3.5",
              right.kind === "relvo"
                ? "font-medium text-relvo"
                : "font-normal text-gris",
            )}
          >
            {right.kind === "relvo" ? (
              <svg
                viewBox="116 104 296 296"
                width="10"
                height="10"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d={RELVO_LOGO_PATHS.stars[0]} />
              </svg>
            ) : null}
            {right.label}
          </span>
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
    folderName: e.folderName,
    folderPath: e.folderPath,
    folderColor: e.folderColor,
    folderIcon: e.folderIcon,
    folderChainIds: e.folderChainIds,
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
    resolutionSuggested:
      e.subject.resolutionSuggestedAt != null && e.subject.status === "open",
  };
}
