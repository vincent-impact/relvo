import { Suspense } from "react";
import Link from "next/link";
import { Inbox, Plus, Search } from "lucide-react";
import { FeedView } from "@/components/feed/feed-view";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import {
  cachedFilFeed,
  cachedFolderNames,
  cachedOrphanCount,
} from "@/server/cached";
import { requireAccountId } from "@/server/auth-context";

// Mon fil (M9, Direction B) — hero violet COMPACT (loupe + « + » à droite ; le
// callout « messages sans intérêt » vit DANS le hero) puis UNE barre de filtres
// rapides (Statut / Urgent / Nouveau / Domaine) filtrée côté client dans FeedView.
//
// PERF (M9.19) : hero instantané + liste streamée (<Suspense>), servie depuis le
// cache serveur (cf. @/server/cached) en SubjectRowData[] plats.

async function FilFeed({ accountId }: { accountId: string }) {
  const [{ ouverts, termines, ignores }, folderNames] = await Promise.all([
    cachedFilFeed(accountId),
    cachedFolderNames(accountId),
  ]);

  return (
    <FeedView
      ouverts={ouverts}
      termines={termines}
      ignores={ignores}
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
  const orphanCount = await cachedOrphanCount(accountId);

  return (
    <Screen>
      <RelvoHeader
        title="Mon fil"
        className="pb-[26px]"
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
      >
        {orphanCount > 0 ? (
          <Link
            href="/messages"
            className="mx-[22px] mt-3.5 flex items-center gap-3 rounded-2xl px-3.5 py-2.5 active:opacity-90"
            style={{
              background: "rgb(255 255 255 / 0.12)",
              boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.18)",
            }}
          >
            <span className="grid size-8 flex-none place-items-center rounded-xl bg-white/15">
              <Inbox className="size-[17px]" strokeWidth={2} />
            </span>
            <p className="flex-1 text-[13px] leading-[1.35] text-white/90">
              <b className="font-bold text-white">{orphanCount}</b> message
              {orphanCount > 1 ? "s" : ""} reçu{orphanCount > 1 ? "s" : ""} sans
              sujet.
            </p>
            <span className="text-[12.5px] font-bold whitespace-nowrap text-white">
              Voir →
            </span>
          </Link>
        ) : null}
      </RelvoHeader>

      <Suspense fallback={<RowsSkeleton count={5} />}>
        <FilFeed accountId={accountId} />
      </Suspense>
    </Screen>
  );
}
