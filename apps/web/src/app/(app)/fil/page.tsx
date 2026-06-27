import { Suspense } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { FeedView } from "@/components/feed/feed-view";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import {
  cachedFilFeed,
  cachedFolderNames,
  cachedOpenCount,
} from "@/server/cached";
import { requireAccountId } from "@/server/auth-context";

// Mon fil (M9, Direction B) — hero violet COMPACT (plus de barre de recherche :
// elle vit dans /recherche via la loupe du header) + onglets de statut
// chevauchants + barre de filtres rapides (Urgent / Nouveaux / Domaines),
// filtrés côté client dans FeedView. 3 onglets de STATUT : Ouverts (swipe ←
// Ignorer · → Terminer), Terminés, Ignorés (récupérables).
//
// PERF (M9.19) : hero instantané + liste streamée (<Suspense>), servie depuis le
// cache serveur (cf. @/server/cached) en SubjectRowData[] plats.

async function FilFeed({ accountId }: { accountId: string }) {
  const [{ ouverts, termines, ignores, orphanCount }, folderNames] =
    await Promise.all([cachedFilFeed(accountId), cachedFolderNames(accountId)]);

  return (
    <FeedView
      ouverts={ouverts}
      termines={termines}
      ignores={ignores}
      orphanCount={orphanCount}
      folderNames={folderNames}
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
  const openCount = await cachedOpenCount(accountId);

  return (
    <Screen>
      <RelvoHeader
        title="Mon fil"
        subtitle={`${openCount} sujet${openCount > 1 ? "s" : ""} ouvert${openCount > 1 ? "s" : ""}`}
        className="pb-[30px]"
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
