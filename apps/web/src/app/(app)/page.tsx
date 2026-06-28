import { Suspense } from "react";
import { HomeTabs } from "@/components/home/home-tabs";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { CreateTaskButton } from "@/components/subject/create-task-button";
import { Screen } from "@/components/layout/screen";
import { MetricsCardSkeleton } from "@/components/shared/screen-skeletons";
import {
  cachedAgendaTasks,
  cachedTaskFeed,
  cachedTaskKpis,
} from "@/server/cached";
import { requireAccount } from "@/server/auth-context";

// Accueil (Direction B) — « Actions du jour » : hero violet « Bonjour … » puis
// barre KPI Tâches et 2 onglets (Agenda / À trier). La page est dédiée aux TÂCHES
// (les actions extraites) ; l'état des SUJETS vit sur Sujets. Chaque ligne porte
// le titre du sujet en clair.
//
// PERF (M9.19) : shell instantané + zones streamées (<Suspense>), données servies
// depuis le cache serveur (cf. @/server/cached) en formes plates.

// Fenêtre du rail (jours), centrée sur aujourd'hui. Bornée : au-delà, on passe
// par le calendrier mensuel (/planning).
const RAIL_BACK = 21;
const RAIL_FWD = 21;

async function HomeTaskTabs({ accountId }: { accountId: string }) {
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
    <HomeTabs
      kpis={kpis}
      tasksByDay={tasksByDay}
      rangeStartKey={rangeStart.toISOString().slice(0, 10)}
      rangeDays={rangeDays}
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

  return (
    <Screen>
      <RelvoHeader
        title={`Bonjour ${account.firstName}`}
        subtitle="Actions du jour"
        className="pb-[46px]"
        action={<CreateTaskButton />}
      />

      <Suspense fallback={<TabsSkeleton />}>
        <HomeTaskTabs accountId={accountId} />
      </Suspense>
    </Screen>
  );
}
