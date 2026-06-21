import { Calendar, Mail, SquareCheck, TriangleAlert } from "lucide-react";
import {
  enrichSubjects,
  getKpis,
  getPriorityFeed,
  getUpcomingTasks,
} from "@relvo/db";
import { AppBar, PageBody } from "@/components/layout/app-bar";
import { AgendaCard, type AgendaDay } from "@/components/shared/agenda-card";
import { KpiTile } from "@/components/shared/kpi-tile";
import { SectionLabel } from "@/components/shared/section-label";
import {
  SubjectCard,
  toSubjectCardData,
} from "@/components/shared/subject-card";
import { folderColor, formatDayLabel, formatTime } from "@/lib/display";
import { getTenantDb, requireAccount } from "@/server/auth-context";

// Accueil (M9.3) — brief du jour : KPIs « Vue du jour » + agenda 3 jours +
// 2-3 sujets prioritaires. Orientation, pas traitement (pas de ✕/✓ ici, cf.
// ux-mobile-first §4). Server Component branché sur le seed via la couche domaine.

export default async function AccueilPage() {
  const account = await requireAccount();
  const db = await getTenantDb();

  const [kpis, priorityPage, upcoming] = await Promise.all([
    getKpis(db),
    getPriorityFeed(db, { limit: 3 }),
    getUpcomingTasks(db, { days: 3 }),
  ]);

  const cards = (await enrichSubjects(db, priorityPage.items)).map(
    toSubjectCardData,
  );

  // Regroupe les tâches datées par jour (aujourd'hui + 2 jours).
  const now = new Date();
  const days: AgendaDay[] = Array.from({ length: 3 }, (_, i) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i),
    );
    const { weekday, day } = formatDayLabel(date);
    const items = upcoming
      .filter(
        (t) =>
          t.startDate &&
          t.startDate.getUTCFullYear() === date.getUTCFullYear() &&
          t.startDate.getUTCMonth() === date.getUTCMonth() &&
          t.startDate.getUTCDate() === date.getUTCDate(),
      )
      .map((t) => ({
        id: t.id,
        title: t.title,
        time: formatTime(t.startTime),
        color: folderColor(t.subject?.folder?.slug),
        href: t.subject ? `/sujets/${t.subject.id}` : "/planning",
      }));
    return { key: date.toISOString(), weekday, day, isToday: i === 0, items };
  });

  const today = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <AppBar
        title={`Bonjour ${account.firstName}`}
        subtitle={today.charAt(0).toUpperCase() + today.slice(1)}
      />
      <PageBody className="space-y-0">
        <SectionLabel title="Vue du jour" />
        <div className="grid grid-cols-2 gap-2.5">
          <KpiTile
            value={kpis.urgentSubjects}
            label="Sujets urgents"
            meta={`${kpis.openSubjects} sujet${kpis.openSubjects > 1 ? "s" : ""} ouvert${kpis.openSubjects > 1 ? "s" : ""}`}
            icon={TriangleAlert}
            tone="urgent"
          />
          <KpiTile
            value={kpis.tasksToday}
            label="Tâches aujourd'hui"
            meta={`${kpis.openTasksTotal} tâche${kpis.openTasksTotal > 1 ? "s" : ""} à faire`}
            icon={SquareCheck}
          />
          <KpiTile
            value={kpis.appointmentsWeek}
            label="Rendez-vous"
            meta="dans la semaine"
            icon={Calendar}
          />
          <KpiTile
            value={kpis.newSubjectsWeek}
            label="Nouveaux sujets"
            meta="créés cette semaine"
            icon={Mail}
          />
        </div>

        <SectionLabel
          title="Agenda"
          href="/planning"
          linkLabel="Voir le mois →"
        />
        <AgendaCard days={days} />

        <SectionLabel
          title="Sujets prioritaires"
          href="/fil"
          linkLabel="Voir tout →"
        />
        <div className="space-y-2.5">
          {cards.length === 0 ? (
            <p className="rounded-xl border border-(--border-light) bg-white p-4 text-center text-[13.5px] text-(--text-tertiary)">
              Aucun sujet prioritaire. ✦
            </p>
          ) : (
            cards.map((card) => <SubjectCard key={card.id} data={card} />)
          )}
        </div>
      </PageBody>
    </>
  );
}
