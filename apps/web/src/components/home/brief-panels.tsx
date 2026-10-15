import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { RELVO_LOGO_PATHS } from "@/components/layout/relvo-logo";
import { ListPanel } from "@/components/shared/list-panel";
import { ZoneHeading } from "@/components/shared/zone-heading";
import { TaskItem } from "@/components/subject/task-item";
import { folderVisual } from "@/lib/folders";
import type { TaskItemData } from "@/lib/task-item-data";
import type { BriefActivity } from "@relvo/db";
import type { CachedAwaitingSubject } from "@/server/cached";

// Les trois zones du brief sous le ciel (01 §11, invariant 34) : l'activité
// des sept derniers jours en trois gros chiffres, les tâches du jour, les
// sujets en attente de l'utilisateur en cartes à feuilleter. Chaque zone est
// une PORTE vers une vue ; l'accueil ne duplique aucune vue et ne porte pas de
// barre d'indicateurs.

// ── Activité — trois chiffres, un flux (invariant 37) ────────────────────────
// La zone est nommée comme les deux autres, par un ZoneHeading : une seule
// grammaire d'en-tête sur l'écran. Le chiffre est au corps d'un INDICATEUR
// (28 px, le même que les cellules de Sujets ou du Calendrier), jamais plus
// gros que le prénom : ce qui attend le dirigeant prime sur ce qui s'est passé,
// et la taille des caractères doit le dire aussi. La carte est une porte vers
// le Bilan : le chevron le montre.

export function ActivityPanel({ activity }: { activity: BriefActivity }) {
  const cells = [
    { value: activity.messagesReceived, label: "messages reçus" },
    { value: activity.subjectsClosed, label: "affaires fermées" },
    { value: activity.tasksDone, label: "tâches faites" },
  ];
  return (
    <section aria-label="Activité">
      <ZoneHeading label="Activité" hint="7 derniers jours" />
      <Link
        href="/bilan"
        className="mx-4 flex items-center rounded-(--rayon-carte) border border-(--filet) bg-white py-2.5 pr-3 pl-3.5 shadow-carte active:bg-(--fond-enfonce)"
      >
        {cells.map((c, i) => (
          <div
            key={c.label}
            className={
              i > 0 ? "flex-1 border-l border-(--filet) pl-3" : "flex-1"
            }
          >
            {/* Un indicateur à zéro écrit « 0 », en gris clair (02-composants). */}
            <div
              className={`chiffre text-[28px] leading-8 ${c.value === 0 ? "text-(--gris-clair)" : "text-noir"}`}
            >
              {c.value}
            </div>
            <div className="mt-px text-[12px] leading-4 font-normal text-gris">
              {c.label}
            </div>
          </div>
        ))}
        <ChevronRight className="size-4 flex-none text-(--gris-clair)" />
      </Link>
    </section>
  );
}

// ── Aujourd'hui — les tâches du jour, mêmes lignes que le Calendrier ─────────

export function TodayPanel({ tasks }: { tasks: TaskItemData[] }) {
  const open = tasks.filter((t) => t.status !== "done");
  const late = open.filter((t) => t.overdue).length;
  // À vide, le qualificatif se tait : la carte-invite juste dessous dit déjà
  // « rien de prévu », et c'est elle la porte vers le Calendrier.
  const hint =
    tasks.length === 0 ? undefined : (
      <>
        {open.length} restante{open.length > 1 ? "s" : ""}
        {late > 0 ? (
          <>
            {" · "}
            <span className="font-medium text-urgent">{late} en retard</span>
          </>
        ) : null}
      </>
    );
  return (
    <section>
      <ZoneHeading label="Aujourd'hui" hint={hint} />
      {tasks.length === 0 ? (
        <Link
          href="/calendrier"
          className="mx-4 flex items-center justify-between rounded-(--rayon-carte) border border-(--filet) bg-white px-4 py-3.5 text-[14px] font-light text-gris shadow-carte active:bg-(--fond-enfonce)"
        >
          Rien de prévu aujourd&apos;hui.
          <ChevronRight className="size-4 text-(--gris-clair)" />
        </Link>
      ) : (
        <ListPanel>
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} flat meta="time" />
          ))}
        </ListPanel>
      )}
    </section>
  );
}

// ── En attente de vous — une réponse à donner, une décision à prendre ────────
// Des cartes à feuilleter, une par sujet : la bande de son domaine sur la
// tranche, le contact, l'enjeu, depuis quand, et le geste. La seule exception
// voulue à « une liste = une carte » (design-system/02-composants).
//
// Chaque chose n'y est dite qu'une fois : l'état en haut à droite (« Décision »,
// « Réponse », pastille à la forme) dit la nature de l'attente, donc la ligne
// d'échéance ne parle que quand il y a une date, et il n'y a pas de puce
// « Trancher » qui la redirait. La seule puce est « Répondre », le geste que
// Relvo prépare. La référence d'un sujet ne remplace jamais un contact : un
// dirigeant ne reconnaît pas un sujet à son code.

/** Au plus cinq cartes ; la requête en demande une de plus pour savoir s'il y en a d'autres. */
const MAX_AWAITING = 5;

function awaitingState(
  s: CachedAwaitingSubject,
  todayKey: string,
): { label: string; tone: "urgent" | "attente" } {
  const what = s.awaiting === "decision" ? "Décision" : "Réponse";
  if (s.urgent) return { label: "Urgent", tone: "urgent" };
  if (s.dueDate && s.dueDate < todayKey)
    return { label: `${what} · en retard`, tone: "urgent" };
  return { label: what, tone: "attente" };
}

/** La phrase d'échéance — seulement quand il y en a une. */
function awaitingDue(dueDate: string, todayKey: string): string {
  if (dueDate === todayKey) return "Avant ce soir.";
  if (dueDate < todayKey) return "L'échéance est passée.";
  const d = new Date(`${dueDate}T00:00:00.000Z`);
  return `Avant ${d.toLocaleDateString("fr-FR", { weekday: "long", timeZone: "UTC" })}.`;
}

function awaitingSince(s: CachedAwaitingSubject): string {
  const days = Math.floor(
    (Date.now() - new Date(s.since).getTime()) / 86_400_000,
  );
  if (days <= 0) {
    const hours = Math.max(
      1,
      Math.floor((Date.now() - new Date(s.since).getTime()) / 3_600_000),
    );
    return `depuis ${hours} h`;
  }
  return `depuis ${days} j`;
}

export function AwaitingPanel({
  subjects,
  todayKey,
}: {
  subjects: CachedAwaitingSubject[];
  todayKey: string;
}) {
  if (subjects.length === 0) return null;
  const shown = subjects.slice(0, MAX_AWAITING);
  const more = subjects.length > MAX_AWAITING;
  return (
    <section>
      <ZoneHeading
        label="En attente de vous"
        hint={
          more
            ? `les ${MAX_AWAITING} plus pressants`
            : `${shown.length} affaire${shown.length > 1 ? "s" : ""}`
        }
      />
      <div
        className="flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto px-4 pt-0.5 pb-2.5 [&::-webkit-scrollbar]:hidden"
        style={{ scrollPaddingLeft: 16 }}
      >
        {shown.map((s) => {
          const { color, text } = folderVisual({
            slug: s.folderSlug,
            color: s.folderColor,
          });
          const state = awaitingState(s, todayKey);
          const who = [s.contactName, s.contactCompany]
            .filter(Boolean)
            .join(" · ");
          return (
            <Link
              key={s.id}
              href={`/sujets/${s.id}?from=%2F`}
              className="flex w-[300px] flex-none snap-start overflow-hidden rounded-(--rayon-carte) border border-(--filet) bg-white shadow-carte active:bg-(--fond-enfonce)"
            >
              <span
                aria-hidden
                className="bande-carte"
                style={{ background: color }}
              />
              <div className="flex min-w-0 flex-1 flex-col px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="domaine truncate" style={{ color: text }}>
                    {s.folderName ?? "Sans domaine"}
                  </span>
                  <span
                    className={
                      state.tone === "urgent"
                        ? "flex flex-none items-center gap-1.5 text-[11px] font-medium tracking-[0.06em] text-urgent uppercase"
                        : "flex flex-none items-center gap-1.5 text-[11px] font-medium tracking-[0.06em] text-attente-texte uppercase"
                    }
                  >
                    {state.tone === "urgent" ? (
                      <i className="size-2 rounded-full bg-urgent" />
                    ) : (
                      <i className="size-2 rounded-full border-2 border-(--attente)" />
                    )}
                    {state.label}
                  </span>
                </div>
                {/* Deux lignes au plus : un titre coupé à la moitié ne se lit pas debout. */}
                <h3 className="mt-0.5 line-clamp-2 font-heading text-[18px] leading-[22px] font-semibold tracking-[-0.01em] text-noir">
                  {s.title}
                </h3>
                {who ? (
                  <div className="mt-px truncate text-[12px] leading-[15px] text-gris">
                    {who}
                  </div>
                ) : null}
                {s.dueDate ? (
                  <div className="mt-1 truncate text-[14px] leading-[18px] font-light text-noir">
                    {awaitingDue(s.dueDate, todayKey)}
                  </div>
                ) : null}
                <div className="mt-auto flex items-center justify-between pt-2">
                  {s.awaiting === "reply" ? (
                    <span
                      className="inline-flex h-[22px] items-center gap-1.5 rounded-(--rayon-pilule) px-2.5 text-[11px] font-medium text-white"
                      style={{ background: "var(--degrade-relvo)" }}
                    >
                      <svg
                        viewBox="116 104 296 296"
                        width="11"
                        height="11"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d={RELVO_LOGO_PATHS.stars[0]} />
                      </svg>
                      Répondre
                    </span>
                  ) : null}
                  <span className="ml-auto text-[11px] text-gris">
                    {awaitingSince(s)}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
