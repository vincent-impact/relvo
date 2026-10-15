import { Suspense } from "react";
import { PollRefresh } from "@/components/shared/poll-refresh";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { FeedView } from "@/components/feed/feed-view";
import { RelvoHeader, SKY_BTN } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import {
  IndicatorTabsSkeleton,
  RowsSkeleton,
} from "@/components/shared/screen-skeletons";
import {
  cachedChannelCount,
  cachedFilFeed,
  cachedFolders,
} from "@/server/cached";
import { requireAccountId } from "@/server/auth-context";

// Sujets — le ciel court (loupe et « + » à droite, puis le burger), la carte
// des INDICATEURS qui chevauche le ciel et agit comme sélecteur (le chiffre
// actif est cerclé), les puces de DOMAINE, puis la liste dans une carte.
//
// PERF (M9.19) : hero instantané ; liste + onglets streamés (<Suspense>), servis
// depuis le cache serveur en formes plates.

async function FilFeed({ accountId }: { accountId: string }) {
  const [{ ouverts, valides, fermes }, folders, channels] = await Promise.all([
    cachedFilFeed(accountId),
    cachedFolders(accountId),
    cachedChannelCount(accountId),
  ]);

  return (
    <div className="apparait">
      <FeedView
        ouverts={ouverts}
        valides={valides}
        fermes={fermes}
        folders={folders}
        hasChannels={channels > 0}
      />
    </div>
  );
}

export default async function FilPage() {
  const accountId = await requireAccountId();

  return (
    <Screen>
      <PollRefresh />
      <RelvoHeader
        title="Sujets"
        className="pb-[46px]"
        action={
          <>
            <Link
              href="/recherche"
              aria-label="Rechercher un sujet"
              className={SKY_BTN}
            >
              <Search className="size-4" strokeWidth={2.4} />
            </Link>
            <Link
              href="/sujets/nouveau"
              aria-label="Nouveau sujet"
              className={SKY_BTN}
            >
              <Plus className="size-4" strokeWidth={2.6} />
            </Link>
          </>
        }
      />

      {/* Le squelette a la silhouette du rendu : la carte d'indicateurs qui
          chevauche le ciel, puis une carte de lignes. */}
      <Suspense
        fallback={
          <>
            <IndicatorTabsSkeleton />
            <RowsSkeleton count={8} className="mt-[86px]" />
          </>
        }
      >
        <FilFeed accountId={accountId} />
      </Suspense>
    </Screen>
  );
}
