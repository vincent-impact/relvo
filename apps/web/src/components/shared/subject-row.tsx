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
// couleur), et à droite un chiffre condensé (non-lus ou tâches) avec ce qu'on
// attend dessous. Elle se lit DEBOUT, en voiture, sur un chantier (recette de
// l'alpha, R15, proposition C tranchée puis ramenée d'un cran à l'usage) : le
// titre en 18 px, graisse 500, sur deux lignes au plus — plus rien ne se coupe —, les chiffres en 22 px, et
// PAS de résumé : le contexte vit sur la fiche, la ligne sert à reconnaître.

export type SubjectRowData = {
  id: string;
  reference: string;
  title: string;
  /** Le résumé court — porté pour la fiche et l'échange, jamais écrit sur la ligne (R15). */
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
  return (
    <article
      data-list-row
      className={cn(
        "relative flex min-h-[70px] items-center gap-3 border-b border-(--filet) py-2.5 pr-3.5 pl-3.5",
        done && "bg-(--fond-enfonce)",
      )}
    >
      <span
        aria-hidden
        className={cn("bande-ligne", done && "opacity-40")}
        // Plus large et plus haute que sur une ligne de dossier : la ligne de
        // sujet est plus haute, la bande suit.
        style={{ background: color, width: 8, height: 48 }}
      />

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "domaine truncate text-[12.5px] leading-4",
            done && "opacity-60",
          )}
          style={{ color: text }}
        >
          {data.folderPath ??
            data.folderName ??
            data.folderSlug ??
            "Sans dossier"}
        </div>
        <h3
          className={cn(
            "line-clamp-2 text-[16px] leading-5 font-medium text-noir",
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
      </div>

      <div className="flex flex-none flex-col items-end gap-0.5 text-right">
        {data.unreadCount > 0 ? (
          <span className="chiffre grid h-[26px] min-w-[26px] place-items-center rounded-full bg-relvo px-2 text-[14px] text-white">
            {data.unreadCount}
          </span>
        ) : data.taskTotal > 0 && !done ? (
          <span className="chiffre text-[22px] leading-[24px] text-noir">
            {data.taskDone}/{data.taskTotal}
          </span>
        ) : null}
        {right ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[12.5px] leading-4",
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
