import { Suspense } from "react";
import { after } from "next/server";
import { markHomeSeen, shouldAdvanceHomeSeen } from "@relvo/db";
import {
  ActivityPanel,
  AwaitingPanel,
  TodayPanel,
} from "@/components/home/brief-panels";
import { NewsPanel } from "@/components/home/news-panel";
import { carteDepuisRattrapage } from "@/components/shared/carte-vivante";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { PollRefresh } from "@/components/shared/poll-refresh";
import {
  cachedAgendaTasks,
  cachedAwaitingSubjects,
  cachedBriefActivity,
  cachedBriefNews,
  cachedBriefSuggestions,
  cachedChannelCount,
} from "@/server/cached";
import { getTenantDb, requireAccount } from "@/server/auth-context";
import { boiteEnMiseEnRoute, carteEnAttente } from "@/server/lecture-en-cours";
import { clePubliquePush } from "@/server/push/envoyer";
import { FUSEAU, calendrierParis, jourParis } from "@relvo/db/temps";

// Accueil — un BRIEF en quatre zones (01 §11, invariant 34), le premier tour de
// parole de Relvo rendu en cartes : les dernières nouvelles (dans le header),
// l'activité sur sept jours, les tâches du jour, les sujets en attente de
// l'utilisateur. Chaque zone est une porte vers une vue ; l'accueil ne duplique
// aucune vue et ne porte pas de barre d'indicateurs. La page des tâches est le
// Calendrier.
//
// ⚠️ Le brief est un CALCUL, jamais une génération (05 §11.12) : tout se compte
// dans le journal ou se déduit de règles écrites dans le domaine (`brief.ts`).
// Le modèle ne travaille qu'une fois l'échange ouvert.
//
// Le dernier passage sur l'accueil borne les nouvelles ; il n'avance qu'après
// une vraie absence (pas à chaque rechargement) et s'écrit APRÈS la réponse.

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function News({
  accountId,
  sinceISO,
  todayKey,
}: {
  accountId: string;
  sinceISO: string | null;
  todayKey: string;
}) {
  const [news, suggestions, channels, lecture] = await Promise.all([
    cachedBriefNews(accountId, sinceISO),
    cachedBriefSuggestions(accountId, todayKey),
    cachedChannelCount(accountId),
    lectureEnDirect(),
  ]);
  return (
    <NewsPanel
      news={news}
      suggestions={suggestions}
      hasChannels={channels > 0}
      lecture={lecture}
      clePublique={clePubliquePush()}
    />
  );
}

/**
 * La lecture du courrier EN CE MOMENT — lue en direct, hors cache : une
 * lecture avance toutes les quelques secondes, et le dirigeant doit voir
 * qu'elle tourne d'où qu'il soit (recette du 2026-10-21). Une boîte connectée
 * à l'instant, sans encore sa ligne, compte comme une lecture qui commence.
 */
async function lectureEnDirect() {
  const db = await getTenantDb();
  const enCours = await db.channelCatchup.findFirst({
    where: { status: { in: ["pending", "running"] } },
    orderBy: { requestedAt: "desc" },
    include: { channel: { select: { name: true } } },
  });
  if (enCours) return carteDepuisRattrapage(enCours, null);
  const boites = await db.channel.findMany({
    where: { type: "email", config: { externalAccountId: { not: null } } },
    include: {
      config: {
        select: { externalAccountId: true, updatedAt: true, provider: true },
      },
      catchups: { select: { id: true }, take: 1 },
    },
  });
  const enRoute = boites.find((b) => boiteEnMiseEnRoute(b));
  return enRoute ? carteEnAttente(null, enRoute.config?.provider) : null;
}

async function Brief({
  accountId,
  todayKey,
}: {
  accountId: string;
  todayKey: string;
}) {
  const dayStart = `${todayKey}T00:00:00.000Z`;
  const next = new Date(dayStart);
  next.setUTCDate(next.getUTCDate() + 1);
  const [activity, byDay, awaiting] = await Promise.all([
    cachedBriefActivity(accountId, todayKey),
    cachedAgendaTasks(accountId, dayStart, next.toISOString(), todayKey),
    cachedAwaitingSubjects(accountId),
  ]);
  // Les trois zones arrivent l'une après l'autre (`.apparait-liste`) : le
  // brief se pose, il ne surgit pas.
  return (
    <div className="apparait-liste space-y-4 pt-3">
      <ActivityPanel activity={activity} />
      <TodayPanel tasks={byDay[todayKey] ?? []} />
      <AwaitingPanel subjects={awaiting} todayKey={todayKey} />
    </div>
  );
}

// Les squelettes font la taille de ce qu'ils remplacent (mesurée sur le rendu
// de démonstration) : un squelette qui ment fait sauter la page.
function NewsSkeleton() {
  return (
    <div className="h-[142px] animate-pulse rounded-(--rayon-carte) bg-white/60" />
  );
}

function BriefSkeleton() {
  return (
    <div className="space-y-5 px-4 pt-4">
      {[96, 77, 158].map((h, i) => (
        <div
          key={i}
          className="animate-pulse rounded-(--rayon-carte) bg-white shadow-carte"
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

export default async function AccueilPage() {
  const account = await requireAccount();
  const now = new Date();
  // Le jour CIVIL FRANÇAIS, pas le jour UTC : entre minuit et deux heures du
  // matin, les deux diffèrent et l'accueil daterait tout de la veille
  // (`temps.ts`, PITFALLS #55). C'est aussi la clé de cache du jour.
  const todayKey = jourParis(now);

  // La borne des nouvelles = le passage PRÉCÉDENT ; l'avance se fait après la
  // réponse, seulement si l'absence a été assez longue.
  const since = account.homeSeenAt;
  if (shouldAdvanceHomeSeen(since, now)) {
    after(async () => {
      const db = await getTenantDb();
      await markHomeSeen(db, account.id, now);
    });
  }

  const dateLabel = cap(
    now.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: FUSEAU,
    }),
  );
  // Le salut connaît l'heure : « Bonjour » à 21 h sonne faux, et le brief se
  // relit aussi le soir, posé.
  const salut = calendrierParis(now).heures >= 18 ? "Bonsoir" : "Bonjour";

  return (
    <Screen>
      <PollRefresh />
      <RelvoHeader title={`${salut} ${account.firstName}`} eyebrow={dateLabel}>
        <Suspense fallback={<NewsSkeleton />}>
          <News
            accountId={account.id}
            sinceISO={since ? since.toISOString() : null}
            todayKey={todayKey}
          />
        </Suspense>
      </RelvoHeader>

      <Suspense fallback={<BriefSkeleton />}>
        <Brief accountId={account.id} todayKey={todayKey} />
      </Suspense>
    </Screen>
  );
}
