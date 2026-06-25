import { Suspense, cache } from "react";
import {
  type EnrichedSubject,
  enrichSubjects,
  getKpis,
  getOpenFeed,
} from "@relvo/db";
import {
  AgendaWeek,
  type AgendaEvent,
  type AgendaWeekDay,
} from "@/components/home/agenda-week";
import {
  BriefCarousel,
  type BriefSlide,
} from "@/components/home/brief-carousel";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { MetricsCard, type Metric } from "@/components/shared/metrics-card";
import { SectionLabel } from "@/components/shared/section-label";
import { SubjectRow, toSubjectRowData } from "@/components/shared/subject-row";
import { folderColor, formatDayLabel, formatTime } from "@/lib/display";
import { getTenantDb, requireAccount } from "@/server/auth-context";

// Accueil (M9.3, Direction B) — brief du jour : hero violet « Bonjour … » +
// brief carousel + carte métriques à cheval + sujets prioritaires (lignes) +
// agenda semaine. Orientation, pas traitement (pas de ✕/✓ ici).
//
// PERF (M9.19, point 2) : le shell (« Bonjour », date, labels de section)
// s'affiche INSTANTANÉMENT ; chaque zone de données stream ensuite dans sa
// propre frontière <Suspense>. Les fetchers partagés (KPIs, sujets prioritaires)
// sont mémoïsés par requête via cache() — appelés depuis deux frontières sans
// dédoubler les requêtes DB.

// ── Fetchers mémoïsés (partagés entre frontières Suspense) ──────────────────

const fetchKpis = cache(async () => {
  const db = await getTenantDb();
  return getKpis(db);
});

const fetchPriority = cache(async (): Promise<EnrichedSubject[]> => {
  const db = await getTenantDb();
  const page = await getOpenFeed(db, { limit: 3 });
  return enrichSubjects(db, page.items);
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function sameUTCDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function briefSlides(
  kpis: Awaited<ReturnType<typeof getKpis>>,
  enriched: EnrichedSubject[],
): BriefSlide[] {
  const slides: BriefSlide[] = [];
  const suggestions = enriched.reduce((n, e) => n + e.suggestionCount, 0);
  slides.push({
    icon: "spark",
    label: "Votre brief du jour",
    body: (
      <>
        <b>
          {kpis.urgentSubjects} sujet{kpis.urgentSubjects > 1 ? "s" : ""} urgent
          {kpis.urgentSubjects > 1 ? "s" : ""}
        </b>{" "}
        et {kpis.tasksToday} tâche{kpis.tasksToday > 1 ? "s" : ""} pour
        aujourd’hui.
        {suggestions > 0 ? (
          <>
            {" "}
            J’ai préparé{" "}
            <span className="font-bold text-white">
              {suggestions} suggestion{suggestions > 1 ? "s" : ""}
            </span>
            , prêtes à valider.
          </>
        ) : null}
      </>
    ),
  });

  const waiting = enriched.find((e) => e.subject.waitingForReply);
  if (waiting) {
    slides.push({
      icon: "watch",
      label: "À surveiller",
      body: (
        <>
          <span className="font-bold text-white">{waiting.subject.title}</span>{" "}
          — j’attends une réponse externe avant de poursuivre.
        </>
      ),
    });
  }

  slides.push({
    icon: "good",
    label: "Bonne nouvelle",
    body: (
      <>
        <span className="font-bold text-white">{kpis.relvoAssistRate}%</span> de
        vos sujets gérés avec mon aide cette semaine.
      </>
    ),
  });
  return slides;
}

// ── Zones de données streamées ───────────────────────────────────────────────

async function HeroBrief() {
  const [kpis, enriched] = await Promise.all([fetchKpis(), fetchPriority()]);
  return <BriefCarousel slides={briefSlides(kpis, enriched)} />;
}

async function HomeMetrics() {
  const kpis = await fetchKpis();
  const metrics: Metric[] = [
    {
      value: kpis.urgentSubjects,
      label: "Urgents",
      ...(kpis.urgentSubjects > 0 ? { tone: "urgent" as const } : {}),
    },
    { value: kpis.tasksToday, label: "Tâches" },
    { value: kpis.appointmentsWeek, label: "RDV" },
    { value: kpis.newSubjectsWeek, label: "Nouveaux" },
  ];
  return <MetricsCard metrics={metrics} />;
}

async function HomeSubjects() {
  const enriched = await fetchPriority();
  const rows = enriched.map(toSubjectRowData);
  if (rows.length === 0) {
    return (
      <p className="mx-4 rounded-2xl bg-white p-4 text-center text-[13.5px] text-(--text-tertiary)">
        Aucun sujet prioritaire. ✦
      </p>
    );
  }
  return (
    <>
      {rows.map((row) => (
        <SubjectRow key={row.id} data={row} />
      ))}
    </>
  );
}

async function HomeAgenda() {
  const db = await getTenantDb();
  const now = new Date();
  // Semaine en cours (lundi → dimanche, UTC pour rester cohérent avec le seed).
  const monday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - ((now.getUTCDay() + 6) % 7),
    ),
  );
  const weekEnd = new Date(monday);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const weekTasks = await db.task.findMany({
    where: {
      status: { not: "deleted" },
      startDate: { gte: monday, lt: weekEnd },
    },
    orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      title: true,
      startDate: true,
      startTime: true,
      subject: {
        select: {
          id: true,
          reference: true,
          folder: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  // Évènements regroupés par jour (clé = date ISO YYYY-MM-DD).
  const eventsByDay: Record<string, AgendaEvent[]> = {};
  for (const t of weekTasks) {
    if (!t.startDate) continue;
    const dayKey = t.startDate.toISOString().slice(0, 10);
    (eventsByDay[dayKey] ??= []).push({
      id: t.id,
      time: formatTime(t.startTime),
      color: folderColor(t.subject?.folder?.slug),
      title: t.title,
      sublabel: t.subject
        ? `${t.subject.reference}${t.subject.folder ? ` · ${t.subject.folder.name}` : ""}`
        : null,
      href: t.subject ? `/sujets/${t.subject.id}?tab=taches` : "/planning",
    });
  }

  const todayKey = now.toISOString().slice(0, 10);
  const weekDays: AgendaWeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(
      Date.UTC(
        monday.getUTCFullYear(),
        monday.getUTCMonth(),
        monday.getUTCDate() + i,
      ),
    );
    const key = date.toISOString().slice(0, 10);
    const { weekday, day } = formatDayLabel(date);
    const long = date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
    return {
      key,
      weekday,
      day,
      longLabel: long.charAt(0).toUpperCase() + long.slice(1),
      isToday: sameUTCDay(date, now),
      hasEvents: (eventsByDay[key]?.length ?? 0) > 0,
    };
  });

  return (
    <AgendaWeek
      days={weekDays}
      eventsByDay={eventsByDay}
      initialKey={todayKey}
    />
  );
}

// ── Squelettes de chargement (dimensionnés pour éviter le décalage) ──────────

function BriefSkeleton() {
  return (
    <div className="mt-4 px-[22px]">
      <div className="h-[92px] animate-pulse rounded-[18px] bg-white/12" />
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div
      className="relative z-[3] mx-4 -mt-[30px] flex rounded-[22px] bg-white px-1 py-3.5"
      style={{ boxShadow: "var(--shadow-metrics)" }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="contents">
          {i > 0 ? (
            <span className="my-1.5 w-px self-stretch bg-[#f1efeb]" />
          ) : null}
          <div className="flex flex-1 flex-col items-center gap-[7px] px-1">
            <div className="h-[46px] w-10 animate-pulse rounded-lg bg-(--surface)" />
            <div className="h-3 w-12 rounded bg-(--surface)" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SubjectsSkeleton() {
  return (
    <div className="space-y-2 px-4 pt-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[76px] animate-pulse rounded-2xl bg-white"
          style={{ boxShadow: "var(--shadow-metrics)" }}
        />
      ))}
    </div>
  );
}

function AgendaSkeleton() {
  return (
    <div className="px-4 pt-1">
      <div className="h-[200px] animate-pulse rounded-2xl bg-white" />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AccueilPage() {
  // Seul await du shell : le compte (session, mis en cache) pour le « Bonjour ».
  const account = await requireAccount();

  const todayLong = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const todayCap = todayLong.charAt(0).toUpperCase() + todayLong.slice(1);

  return (
    <Screen>
      <RelvoHeader
        title={`Bonjour ${account.firstName}`}
        subtitle={todayCap}
        className="pb-[46px]"
      >
        <Suspense fallback={<BriefSkeleton />}>
          <HeroBrief />
        </Suspense>
      </RelvoHeader>

      <Suspense fallback={<MetricsSkeleton />}>
        <HomeMetrics />
      </Suspense>

      <SectionLabel title="Sujets prioritaires" href="/fil" />
      <Suspense fallback={<SubjectsSkeleton />}>
        <HomeSubjects />
      </Suspense>

      <SectionLabel
        title="Agenda"
        href="/planning"
        linkLabel="Voir le mois →"
        dotColor="var(--amber-600)"
      />
      <Suspense fallback={<AgendaSkeleton />}>
        <HomeAgenda />
      </Suspense>
    </Screen>
  );
}
