import { Suspense } from "react";
import type { Kpis } from "@relvo/db";
import { AgendaWeek, type AgendaWeekDay } from "@/components/home/agenda-week";
import {
  BriefCarousel,
  type BriefSlide,
} from "@/components/home/brief-carousel";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { MetricsCard, type Metric } from "@/components/shared/metrics-card";
import { MetricsCardSkeleton } from "@/components/shared/screen-skeletons";
import { SectionLabel } from "@/components/shared/section-label";
import {
  SubjectRow,
  type SubjectRowData,
} from "@/components/shared/subject-row";
import { formatDayLabel } from "@/lib/display";
import {
  cachedAgendaEvents,
  cachedKpis,
  cachedPriorityRows,
} from "@/server/cached";
import { requireAccount } from "@/server/auth-context";

// Accueil (M9.3, Direction B) — brief du jour : hero violet « Bonjour … » +
// brief carousel + carte métriques à cheval + sujets prioritaires (lignes) +
// agenda semaine. Orientation, pas traitement (pas de ✕/✓ ici).
//
// PERF (M9.19) : shell instantané + zones streamées (<Suspense>, point 2), et
// données servies depuis le cache serveur (point 3, cf. @/server/cached) — KPIs,
// sujets prioritaires et agenda en formes plates (SubjectRowData / nombres).

function sameUTCDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function briefSlides(kpis: Kpis, rows: SubjectRowData[]): BriefSlide[] {
  const slides: BriefSlide[] = [];
  const suggestions = rows.reduce((n, r) => n + r.suggestionCount, 0);
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

  const waiting = rows.find((r) => r.waitingForReply);
  if (waiting) {
    slides.push({
      icon: "watch",
      label: "À surveiller",
      body: (
        <>
          <span className="font-bold text-white">{waiting.title}</span> —
          j’attends une réponse externe avant de poursuivre.
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

// ── Zones de données streamées (servies depuis le cache serveur) ─────────────

async function HeroBrief({ accountId }: { accountId: string }) {
  const [kpis, rows] = await Promise.all([
    cachedKpis(accountId),
    cachedPriorityRows(accountId),
  ]);
  return <BriefCarousel slides={briefSlides(kpis, rows)} />;
}

async function HomeMetrics({ accountId }: { accountId: string }) {
  const kpis = await cachedKpis(accountId);
  // Ordre fixé (Urgents, Nouveaux, Ouverts, Tâches) — RDV retiré, l'agenda s'en
  // charge. « Nouveaux » = statut new (et non créés < 7 j) → décrémente dès
  // qu'on ouvre un sujet ; « Ouverts » = tous les sujets non clos.
  const metrics: Metric[] = [
    {
      value: kpis.urgentSubjects,
      label: "Urgents",
      ...(kpis.urgentSubjects > 0 ? { tone: "urgent" as const } : {}),
    },
    { value: kpis.newSubjects, label: "Nouveaux" },
    { value: kpis.openSubjects, label: "Ouverts" },
    { value: kpis.tasksToday, label: "Tâches" },
  ];
  return <MetricsCard metrics={metrics} />;
}

async function HomeSubjects({ accountId }: { accountId: string }) {
  const rows = await cachedPriorityRows(accountId);
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

async function HomeAgenda({ accountId }: { accountId: string }) {
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

  const eventsByDay = await cachedAgendaEvents(
    accountId,
    monday.toISOString(),
    weekEnd.toISOString(),
  );

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

function SubjectsSkeleton() {
  return (
    <div className="space-y-2 px-4 pt-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[76px] animate-pulse rounded-2xl bg-white"
          style={{ boxShadow: "var(--shadow-card)" }}
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
  const accountId = account.id;

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
          <HeroBrief accountId={accountId} />
        </Suspense>
      </RelvoHeader>

      <Suspense fallback={<MetricsCardSkeleton />}>
        <HomeMetrics accountId={accountId} />
      </Suspense>

      <SectionLabel title="Sujets prioritaires" href="/fil" />
      <Suspense fallback={<SubjectsSkeleton />}>
        <HomeSubjects accountId={accountId} />
      </Suspense>

      <SectionLabel
        title="Agenda"
        href="/planning"
        linkLabel="Voir le mois →"
        dotColor="var(--amber-600)"
      />
      <Suspense fallback={<AgendaSkeleton />}>
        <HomeAgenda accountId={accountId} />
      </Suspense>
    </Screen>
  );
}
