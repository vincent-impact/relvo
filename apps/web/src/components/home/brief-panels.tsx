import Link from "next/link";
import { ChevronRight, Flag } from "lucide-react";
import { ListPanel } from "@/components/shared/list-panel";
import { ZoneHeading } from "@/components/shared/zone-heading";
import { TaskItem } from "@/components/subject/task-item";
import { initialsFor } from "@/lib/display";
import type { TaskItemData } from "@/lib/task-item-data";
import type { BriefActivity } from "@relvo/db";
import type { CachedAwaitingSubject } from "@/server/cached";

// Les trois zones du brief sous le header (01 §11, invariant 34) : l'activité
// des sept derniers jours en trois chiffres, les tâches du jour, les sujets en
// attente de l'utilisateur. Chaque zone est une PORTE vers une vue ; l'accueil
// ne duplique aucune vue et ne porte pas de barre d'indicateurs.

// ── Activité — trois chiffres, un flux (invariant 37) ────────────────────────

export function ActivityPanel({ activity }: { activity: BriefActivity }) {
  const cells = [
    { value: activity.messagesReceived, label: "messages reçus" },
    { value: activity.subjectsClosed, label: "sujets fermés" },
    { value: activity.tasksDone, label: "tâches faites" },
  ];
  return (
    <section>
      <ZoneHeading label="Activité" hint="7 derniers jours" />
      <Link
        href="/bilan"
        className="mx-4 grid grid-cols-3 rounded-[14px] border border-(--hairline) bg-white px-1.5 py-3 shadow-surface-1 active:bg-(--surface)"
      >
        {cells.map((c, i) => (
          <div
            key={c.label}
            className={
              i > 0
                ? "border-l border-(--border-light) text-center"
                : "text-center"
            }
          >
            <div className="font-numeric text-[22px] leading-none font-semibold tabular-nums">
              {c.value}
            </div>
            <div className="mt-1 text-[12px] text-(--text-secondary)">
              {c.label}
            </div>
          </div>
        ))}
      </Link>
    </section>
  );
}

// ── Aujourd'hui — les tâches du jour, mêmes lignes que le Calendrier ─────────

export function TodayPanel({ tasks }: { tasks: TaskItemData[] }) {
  const open = tasks.filter((t) => t.status !== "done");
  const late = open.filter((t) => t.overdue).length;
  const hint =
    tasks.length === 0
      ? "rien de prévu"
      : `${open.length} restante${open.length > 1 ? "s" : ""}${late > 0 ? ` · ${late} en retard` : ""}`;
  return (
    <section>
      <ZoneHeading label="Aujourd'hui" hint={hint} />
      {tasks.length === 0 ? (
        <Link
          href="/calendrier"
          className="mx-4 flex items-center justify-between rounded-[14px] border border-(--hairline) bg-white px-4 py-3.5 text-[13.5px] text-(--text-secondary) shadow-surface-1"
        >
          Rien de prévu aujourd&apos;hui.
          <ChevronRight className="size-4 text-(--text-tertiary)" />
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

function awaitingLabel(s: CachedAwaitingSubject, todayKey: string): string {
  const what =
    s.awaiting === "decision" ? "Décision à prendre" : "Réponse attendue";
  if (s.dueDate) {
    if (s.dueDate < todayKey) return `${what} · en retard`;
    if (s.dueDate === todayKey) return `${what} aujourd'hui`;
    const d = new Date(`${s.dueDate}T00:00:00.000Z`);
    return `${what} avant ${d.toLocaleDateString("fr-FR", { weekday: "long", timeZone: "UTC" })}`;
  }
  const days = Math.floor(
    (Date.now() - new Date(s.since).getTime()) / 86_400_000,
  );
  if (days <= 0) return `${what} depuis aujourd'hui`;
  if (days === 1) return `${what} depuis hier`;
  return `${what} depuis ${days} jours`;
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
      <ListPanel>
        {subjects.map((s) => {
          const initials =
            initialsFor(s.contactName) ?? s.title.charAt(0).toUpperCase();
          return (
            <Link
              key={s.id}
              data-list-row
              href={`/sujets/${s.id}?from=%2F`}
              className="flex items-center gap-3 border-b border-(--border-light) px-3.5 py-3 active:bg-(--surface)"
            >
              <span className="grid size-[30px] flex-none place-items-center rounded-full bg-(--amber-50) text-[12px] font-semibold text-(--amber-800)">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] leading-[1.25] font-medium">
                  {s.title}
                </div>
                <div className="mt-0.5 text-[12px] text-(--text-secondary)">
                  {awaitingLabel(s, todayKey)}
                </div>
              </div>
              {s.urgent ? (
                <Flag
                  className="size-4 flex-none text-(--red-600)"
                  fill="currentColor"
                  strokeWidth={2}
                  aria-label="Urgent"
                />
              ) : (
                <ChevronRight
                  className="size-4 flex-none text-(--text-tertiary)"
                  strokeWidth={2}
                />
              )}
            </Link>
          );
        })}
      </ListPanel>
    </section>
  );
}
