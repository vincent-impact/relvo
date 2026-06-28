import { Suspense } from "react";
import type { Kpis } from "@relvo/db";
import {
  BriefCarousel,
  type BriefSlide,
} from "@/components/home/brief-carousel";
import { HomeTabs } from "@/components/home/home-tabs";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { CreateTaskButton } from "@/components/subject/create-task-button";
import { Screen } from "@/components/layout/screen";
import { MetricsCardSkeleton } from "@/components/shared/screen-skeletons";
import type { SubjectRowData } from "@/components/shared/subject-row";
import {
  cachedAgendaTasks,
  cachedKpis,
  cachedPriorityRows,
  cachedTaskFeed,
  cachedTaskKpis,
} from "@/server/cached";
import { requireAccount } from "@/server/auth-context";

// Accueil (Direction B) — « plan d'action » : hero violet « Bonjour … » + brief
// parlé, puis barre KPI Tâches et 3 onglets (Aujourd'hui / En retard / À faire).
// La page est dédiée aux TÂCHES (les actions extraites) ; l'état des SUJETS vit
// sur Mon fil. Chaque ligne porte le titre du sujet en clair.
//
// PERF (M9.19) : shell instantané + zones streamées (<Suspense>), données servies
// depuis le cache serveur (cf. @/server/cached) en formes plates.

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

async function HomeTaskTabs({ accountId }: { accountId: string }) {
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
  const todayKey = now.toISOString().slice(0, 10);

  const [kpis, tasksByDay, feed] = await Promise.all([
    cachedTaskKpis(accountId, todayKey),
    cachedAgendaTasks(
      accountId,
      monday.toISOString(),
      weekEnd.toISOString(),
      todayKey,
    ),
    cachedTaskFeed(accountId, todayKey),
  ]);

  return (
    <HomeTabs
      kpis={kpis}
      tasksByDay={tasksByDay}
      anchorMondayKey={monday.toISOString().slice(0, 10)}
      todayKey={todayKey}
      untriaged={feed.untriaged}
    />
  );
}

// ── Squelette de chargement (KPI + onglets) ──────────────────────────────────

function TabsSkeleton() {
  return (
    <>
      <MetricsCardSkeleton />
      <div className="px-4 pt-3">
        <div className="h-[52px] animate-pulse rounded-full bg-white" />
      </div>
      <div className="space-y-2 px-4 pt-4">
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AccueilPage() {
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
        action={<CreateTaskButton />}
      >
        <Suspense fallback={<BriefSkeleton />}>
          <HeroBrief accountId={accountId} />
        </Suspense>
      </RelvoHeader>

      <Suspense fallback={<TabsSkeleton />}>
        <HomeTaskTabs accountId={accountId} />
      </Suspense>
    </Screen>
  );
}

function BriefSkeleton() {
  return (
    <div className="mt-4 px-[22px]">
      <div className="h-[92px] animate-pulse rounded-[18px] bg-white/12" />
    </div>
  );
}
