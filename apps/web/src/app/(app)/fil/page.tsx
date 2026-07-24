import { Suspense } from "react";
import { PollRefresh } from "@/components/shared/poll-refresh";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { FeedView } from "@/components/feed/feed-view";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import { cachedFilFeed, cachedFolders } from "@/server/cached";
import { requireAccountId } from "@/server/auth-context";

// Sujets (Direction B) — hero violet compact (loupe + « + »), puis une BARRE
// KPI-ONGLETS chiffrée (Urgents · Nouveaux · Ouverts · Validés) qui agit comme
// sélecteur, et une barre de filtres par DOMAINE (chips icône + couleur). Le KPI
// « Sans sujet » a quitté cette page : les conversations ont désormais leur
// propre onglet « Messages » dans la barre de navigation (2026-07-23).
//
// PERF (M9.19) : hero instantané ; liste + onglets streamés (<Suspense>), servis
// depuis le cache serveur en formes plates.

async function FilFeed({ accountId }: { accountId: string }) {
  const [{ ouverts, valides, fermes }, folders] = await Promise.all([
    cachedFilFeed(accountId),
    cachedFolders(accountId),
  ]);

  return (
    <FeedView
      ouverts={ouverts}
      valides={valides}
      fermes={fermes}
      folders={folders}
    />
  );
}

const HEADER_BTN =
  "grid size-[42px] flex-none place-items-center rounded-full text-white active:scale-95";
const HEADER_BTN_STYLE = {
  background: "rgb(255 255 255 / 0.15)",
  boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.3)",
};

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
              className={HEADER_BTN}
              style={HEADER_BTN_STYLE}
            >
              <Search className="size-[20px]" strokeWidth={2.2} />
            </Link>
            <Link
              href="/sujets/nouveau"
              aria-label="Nouveau sujet"
              className={HEADER_BTN}
              style={HEADER_BTN_STYLE}
            >
              <Plus className="size-[22px]" strokeWidth={2.2} />
            </Link>
          </>
        }
      />

      <Suspense fallback={<RowsSkeleton count={5} />}>
        <FilFeed accountId={accountId} />
      </Suspense>
    </Screen>
  );
}
