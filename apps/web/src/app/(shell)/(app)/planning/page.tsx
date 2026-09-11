import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import {
  PlanningMonth,
  type PlanningCell,
  type PlanningTask,
} from "@/components/planning/planning-month";
import { folderColor, formatTime } from "@/lib/display";
import { getTenantDb } from "@/server/auth-context";

// Planning (M9.8 + M9.17, Direction B) — vue mois pleine largeur, tâches datées
// colorées par Dossier, navigation mois précédent / aujourd'hui / suivant, et
// drag-and-drop des tâches d'un jour à l'autre (dnd-kit, dans PlanningMonth).
//
// PERF (M9.19, point 2) : le hero (mois) + la barre de navigation (calculs purs)
// s'affichent instantanément ; la grille (tâches en base) stream dans un
// <Suspense>.

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

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
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
        back="/"
        title="Planning"
        subtitle={`${MONTHS[month0]} ${year}`}
        className="pb-9"
      />

      <div className="flex items-center justify-between px-4 pt-4">
        <Link
          href={`/planning?m=${ymKey(prevYear, (month0 - 1 + 12) % 12)}`}
          aria-label="Mois précédent"
          className="grid size-9 place-items-center rounded-full bg-(--surface) text-(--text-secondary)"
        >
          <ChevronLeft className="size-5" strokeWidth={2} />
        </Link>
        <Link
          href="/planning"
          className="rounded-full bg-relvo-bg px-3.5 py-1.5 text-[13px] font-bold text-relvo"
        >
          Aujourd’hui
        </Link>
        <Link
          href={`/planning?m=${ymKey(nextYear, (month0 + 1) % 12)}`}
          aria-label="Mois suivant"
          className="grid size-9 place-items-center rounded-full bg-(--surface) text-(--text-secondary)"
        >
          <ChevronRight className="size-5" strokeWidth={2} />
        </Link>
      </div>

      <Suspense key={`${year}-${month0}`} fallback={<GridSkeleton />}>
        <PlanningGrid year={year} month0={month0} />
      </Suspense>
    </Screen>
  );
}
