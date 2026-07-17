import { Suspense } from "react";
import { PollRefresh } from "@/components/shared/poll-refresh";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { FeedView } from "@/components/feed/feed-view";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { MetricsCard, type Metric } from "@/components/shared/metrics-card";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import { cachedFilFeed, cachedFolderNames, cachedKpis } from "@/server/cached";
import { requireAccountId } from "@/server/auth-context";

// Mon fil (Direction B) — page des SUJETS. Hero violet compact (loupe + « + »),
// barre KPI Sujets à cheval (Urgents / Nouveaux / Ouverts / Sans sujet — seule la
// dernière cellule est cliquable → pile « Messages sans sujet »), puis UNE barre
// de filtres rapides (Statut / Domaine / Urgent / Nouveau) filtrée côté client.
//
// PERF (M9.19) : hero + KPI instantanés ; liste streamée (<Suspense>), servie
// depuis le cache serveur en SubjectRowData[] plats.

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
  const kpis = await cachedKpis(accountId);

  // Barre KPI Sujets : 3 chiffres d'état (non cliquables) + « Sans sujet »
  // cliquable vers la pile des messages non rattachés (ex-callout du hero).
  const metrics: Metric[] = [
    {
      value: kpis.urgentSubjects,
      label: "Urgents",
      ...(kpis.urgentSubjects > 0 ? { tone: "urgent" as const } : {}),
    },
    { value: kpis.newSubjects, label: "Nouveaux" },
    { value: kpis.openSubjects, label: "Ouverts" },
    { value: kpis.messagesToTriage, label: "Sans sujet", href: "/messages" },
  ];

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

      <MetricsCard metrics={metrics} />

      <Suspense fallback={<RowsSkeleton count={5} />}>
        <FilFeed accountId={accountId} />
      </Suspense>
    </Screen>
  );
}
