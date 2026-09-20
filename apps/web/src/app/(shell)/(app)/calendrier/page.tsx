import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import {
  VueSwitch,
  type CalendrierVue,
} from "@/components/calendrier/vue-switch";
import { WeekView } from "@/components/calendrier/week-view";
import {
  PlanningMonth,
  type PlanningCell,
  type PlanningTask,
} from "@/components/planning/planning-month";
import { CreateTaskButton } from "@/components/subject/create-task-button";
import { MetricsCardSkeleton } from "@/components/shared/screen-skeletons";
import { folderColor, formatTime } from "@/lib/display";
import {
  cachedAgendaTasks,
  cachedTaskFeed,
  cachedTaskKpis,
} from "@/server/cached";
import { getTenantDb, requireAccountId } from "@/server/auth-context";

// Calendrier — LA page des tâches (invariant 34), sous un segmented Semaine /
// Mois posé dans le header. La vue vit dans l'URL (`?vue=mois`, `?m=AAAA-MM`).
//  • Semaine : la barre d'indicateurs des tâches (Aujourd'hui · Rendez-vous ·
//    En retard) et le semainier slidable avec drag-and-drop (ex-accueil).
//  • Mois : la grille pleine largeur, tâches datées colorées par domaine,
//    drag-and-drop d'un jour à l'autre (ex-/planning).
//
// PERF : le hero s'affiche instantanément ; le contenu (tâches en base) stream
// dans un <Suspense>, servi depuis le cache serveur en formes plates.

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function ymKey(y: number, m0: number) {
  return `${y}-${String(m0 + 1).padStart(2, "0")}`;
}

// ── Semaine ──────────────────────────────────────────────────────────────────

// Fenêtre du rail (jours), centrée sur aujourd'hui. Bornée : au-delà, on passe
// par la vue mois.
const RAIL_BACK = 21;
const RAIL_FWD = 21;

async function WeekTabs({ accountId }: { accountId: string }) {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const rangeStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - RAIL_BACK,
    ),
  );
  const rangeDays = RAIL_BACK + 1 + RAIL_FWD;
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + rangeDays);

  const [kpis, tasksByDay, feed] = await Promise.all([
    cachedTaskKpis(accountId, todayKey),
    cachedAgendaTasks(
      accountId,
      rangeStart.toISOString(),
      rangeEnd.toISOString(),
      todayKey,
    ),
    cachedTaskFeed(accountId, todayKey),
  ]);

  return (
    <WeekView
      kpis={kpis}
      tasksByDay={tasksByDay}
      rangeStartKey={rangeStart.toISOString().slice(0, 10)}
      rangeDays={rangeDays}
      todayKey={todayKey}
      overdue={feed.overdue}
      appointments={feed.appointments}
    />
  );
}

function WeekSkeleton() {
  return (
    <>
      <MetricsCardSkeleton />
      <div className="space-y-2 px-4 pt-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[68px] animate-pulse rounded-2xl bg-white"
            style={{ boxShadow: "var(--shadow-card)" }}
          />
        ))}
      </div>
    </>
  );
}

/** « Semaine du 15 septembre » — le lundi de la semaine courante. */
function weekLabel(now: Date): string {
  const monday = new Date(now);
  const offset = (now.getUTCDay() + 6) % 7;
  monday.setUTCDate(now.getUTCDate() - offset);
  const label = monday.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return `Semaine du ${label}`;
}

// ── Mois ─────────────────────────────────────────────────────────────────────

async function PlanningGrid({
  year,
  month0,
}: {
  year: number;
  month0: number;
}) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(year, month0, 1));
  const monthEnd = new Date(Date.UTC(year, month0 + 1, 1));
  // Grille alignée lundi (6 semaines = 42 cellules).
  const offset = (monthStart.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(year, month0, 1 - offset));

  const db = await getTenantDb();
  const tasks = await db.task.findMany({
    where: {
      startDate: { gte: monthStart, lt: monthEnd },
      status: { not: "deleted" },
    },
    orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
    include: {
      subject: { select: { id: true, folder: { select: { slug: true } } } },
    },
  });

  const planningTasks: PlanningTask[] = tasks
    .filter((t) => t.startDate)
    .map((t) => ({
      id: t.id,
      title: t.title,
      time: formatTime(t.startTime),
      color: folderColor(t.subject?.folder?.slug),
      subjectId: t.subject?.id ?? null,
      dayKey: t.startDate!.toISOString().slice(0, 10),
    }));

  const cells: PlanningCell[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(
      Date.UTC(
        gridStart.getUTCFullYear(),
        gridStart.getUTCMonth(),
        gridStart.getUTCDate() + i,
      ),
    );
    const key = d.toISOString().slice(0, 10);
    return {
      key,
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month0,
      isToday: key === now.toISOString().slice(0, 10),
    };
  });

  return (
    <>
      <PlanningMonth cells={cells} tasks={planningTasks} />
      <p className="px-5 pt-3 text-[12px] text-(--text-tertiary)">
        Glissez une tâche d’un jour à l’autre pour la replanifier.
      </p>
    </>
  );
}

function GridSkeleton() {
  return (
    <div className="px-4 pt-4">
      <div className="h-[320px] animate-pulse rounded-2xl bg-white" />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function CalendrierPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string; m?: string }>;
}) {
  const accountId = await requireAccountId();
  const { vue: vueParam, m } = await searchParams;
  const vue: CalendrierVue = vueParam === "mois" ? "mois" : "semaine";
  const now = new Date();

  // Mois affiché (UTC, cohérent avec le seed). Défaut : mois courant.
  let year = now.getUTCFullYear();
  let month0 = now.getUTCMonth();
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [yy, mm] = m.split("-").map(Number);
    year = yy;
    month0 = mm - 1;
  }
  const prevYear = month0 - 1 < 0 ? year - 1 : year;
  const nextYear = month0 + 1 > 11 ? year + 1 : year;

  return (
    <Screen>
      <RelvoHeader
        title="Calendrier"
        subtitle={vue === "mois" ? `${MONTHS[month0]} ${year}` : weekLabel(now)}
        className={vue === "mois" ? "pb-6" : "pb-[46px]"}
        action={<CreateTaskButton />}
      >
        <div className="px-[18px] pt-3.5">
          <VueSwitch vue={vue} />
        </div>
      </RelvoHeader>

      {vue === "mois" ? (
        <>
          <div className="flex items-center justify-between px-4 pt-4">
            <Link
              href={`/calendrier?vue=mois&m=${ymKey(prevYear, (month0 - 1 + 12) % 12)}`}
              aria-label="Mois précédent"
              className="grid size-9 place-items-center rounded-full bg-(--surface) text-(--text-secondary)"
            >
              <ChevronLeft className="size-5" strokeWidth={2} />
            </Link>
            <Link
              href="/calendrier?vue=mois"
              className="rounded-full bg-relvo-bg px-3.5 py-1.5 text-[13px] font-bold text-relvo"
            >
              Aujourd’hui
            </Link>
            <Link
              href={`/calendrier?vue=mois&m=${ymKey(nextYear, (month0 + 1) % 12)}`}
              aria-label="Mois suivant"
              className="grid size-9 place-items-center rounded-full bg-(--surface) text-(--text-secondary)"
            >
              <ChevronRight className="size-5" strokeWidth={2} />
            </Link>
          </div>
          <Suspense key={`${year}-${month0}`} fallback={<GridSkeleton />}>
            <PlanningGrid year={year} month0={month0} />
          </Suspense>
        </>
      ) : (
        <Suspense fallback={<WeekSkeleton />}>
          <WeekTabs accountId={accountId} />
        </Suspense>
      )}
    </Screen>
  );
}
