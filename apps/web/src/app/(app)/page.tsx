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
// agenda semaine. Orientation, pas traitement (pas de ✕/✓ ici). Server Component.

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

export default async function AccueilPage() {
  const account = await requireAccount();
  const db = await getTenantDb();

  // Semaine en cours (lundi → dimanche, UTC pour rester cohérent avec le seed).
  const now = new Date();
  const monday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - ((now.getUTCDay() + 6) % 7),
    ),
  );
  const weekEnd = new Date(monday);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const [kpis, priorityPage, weekTasks] = await Promise.all([
    getKpis(db),
    getOpenFeed(db, { limit: 3 }),
    // Toutes les tâches datées de la semaine affichée (un évènement d'agenda =
    // une tâche avec une date). Lundi → dimanche, y compris jours passés.
    db.task.findMany({
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
    }),
  ]);

  const enriched = await enrichSubjects(db, priorityPage.items);
  const rows = enriched.map(toSubjectRowData);

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

  const todayLong = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const todayCap = todayLong.charAt(0).toUpperCase() + todayLong.slice(1);

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

  return (
    <Screen>
      <RelvoHeader
        title={`Bonjour ${account.firstName}`}
        subtitle={todayCap}
        className="pb-[46px]"
      >
        <BriefCarousel slides={briefSlides(kpis, enriched)} />
      </RelvoHeader>

      <MetricsCard metrics={metrics} />

      <SectionLabel title="Sujets prioritaires" href="/fil" />
      {rows.length === 0 ? (
        <p className="mx-4 rounded-2xl bg-white p-4 text-center text-[13.5px] text-(--text-tertiary)">
          Aucun sujet prioritaire. ✦
        </p>
      ) : (
        rows.map((row) => <SubjectRow key={row.id} data={row} />)
      )}

      <SectionLabel
        title="Agenda"
        href="/planning"
        linkLabel="Voir le mois →"
        dotColor="var(--amber-600)"
      />
      <AgendaWeek
        days={weekDays}
        eventsByDay={eventsByDay}
        initialKey={todayKey}
      />
    </Screen>
  );
}
