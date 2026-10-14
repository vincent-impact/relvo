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

export function ActivityPanel({ activity }: { activity: BriefActivity }) {
  const cells = [
    { value: activity.messagesReceived, label: "messages reçus" },
    { value: activity.subjectsClosed, label: "sujets fermés" },
    { value: activity.tasksDone, label: "tâches faites" },
  ];
  return (
    <section aria-label="Activité">
      <Link
        href="/bilan"
        className="mx-4 block rounded-(--rayon-carte) border border-(--filet) bg-white px-3.5 pt-3 pb-2.5 shadow-carte active:bg-(--fond-enfonce)"
      >
        <div className="libelle">Activité · 7 jours</div>
        <div className="mt-1 flex">
          {cells.map((c, i) => (
            <div
              key={c.label}
              className={
                i > 0 ? "flex-1 border-l border-(--filet) pl-3" : "flex-1"
              }
            >
              <div className="chiffre text-[34px] leading-9 text-noir">
                {c.value}
              </div>
              <div className="mt-px text-[12px] font-light text-gris">
                {c.label}
              </div>
            </div>
          ))}
        </div>
      </Link>
    </section>
  );
}

// ── Aujourd'hui — les tâches du jour, mêmes lignes que le Calendrier ─────────

export function TodayPanel({ tasks }: { tasks: TaskItemData[] }) {
  const open = tasks.filter((t) => t.status !== "done");
  const late = open.filter((t) => t.overdue).length;
  const hint =
    tasks.length === 0 ? (
      "rien de prévu"
    ) : (
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
          className="mx-4 flex items-center justify-between rounded-(--rayon-carte) border border-(--filet) bg-white px-4 py-3.5 text-[13.5px] font-light text-gris shadow-carte"
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

function awaitingDue(s: CachedAwaitingSubject, todayKey: string): string {
  if (s.dueDate) {
    if (s.dueDate === todayKey) return "Avant ce soir.";
    if (s.dueDate < todayKey) return "L'échéance est passée.";
    const d = new Date(`${s.dueDate}T00:00:00.000Z`);
    return `Avant ${d.toLocaleDateString("fr-FR", { weekday: "long", timeZone: "UTC" })}.`;
  }
  return s.awaiting === "decision"
    ? "Décision à prendre."
    : "Réponse attendue.";
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
  return (
    <section>
      <ZoneHeading
        label="En attente de vous"
        hint={`${subjects.length} sujet${subjects.length > 1 ? "s" : ""}`}
      />
      <div
        className="flex snap-x snap-mandatory [scrollbar-width:none] gap-3 overflow-x-auto px-4 pt-0.5 pb-2.5 [&::-webkit-scrollbar]:hidden"
        style={{ scrollPaddingLeft: 16 }}
      >
        {subjects.map((s) => {
          const { color, text } = folderVisual({
            slug: s.folderSlug,
            color: s.folderColor,
          });
          const state = awaitingState(s, todayKey);
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
              <div className="min-w-0 flex-1 px-3 py-2.5">
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
                <h3 className="mt-0.5 truncate font-heading text-[18px] leading-[22px] font-semibold tracking-[-0.01em] text-noir">
                  {s.title}
                </h3>
                <div className="mt-px truncate text-[12px] leading-[15px] text-gris">
                  {[s.contactName, s.contactCompany]
                    .filter(Boolean)
                    .join(" · ") || s.reference}
                </div>
                <div className="mt-1 truncate text-[13px] leading-[17px] font-light text-noir">
                  {awaitingDue(s, todayKey)}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  {s.awaiting === "decision" ? (
                    <span className="inline-flex h-[22px] items-center gap-1.5 rounded-(--rayon-pilule) bg-(--fond-puce) px-2.5 text-[11px] font-medium text-noir">
                      Trancher
                    </span>
                  ) : (
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
                  )}
                  <span className="text-[11px] font-light text-gris">
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
