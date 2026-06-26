import { Suspense } from "react";
import Link from "next/link";
import { Inbox, Plus, Search } from "lucide-react";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { IgnoredSubject } from "@/components/feed/ignored-subject";
import { SwipeableSubject } from "@/components/feed/swipeable-subject";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import {
  SubjectRow,
  type SubjectRowData,
} from "@/components/shared/subject-row";
import { cachedFilFeed, cachedOpenCount } from "@/server/cached";
import { requireAccountId } from "@/server/auth-context";

// Mon fil (M9.4, Direction B) — traitement des sujets. Hero violet + champ de
// recherche, SegTabs chevauchant. 3 onglets, paniers de STATUT : Ouverts (urgents
// en tête, swipe ← Ignorer · → Terminer), Terminés, Ignorés (récupérables).
//
// PERF (M9.19) : hero instantané + 3 paniers streamés (<Suspense>), servis depuis
// le cache serveur (cf. @/server/cached) en SubjectRowData[] plats.

function FeedList({
  items,
  variant,
}: {
  items: SubjectRowData[];
  variant: "swipe" | "done" | "ignored";
}) {
  if (items.length === 0) {
    return (
      <p className="px-[22px] py-10 text-center text-[13.5px] text-(--text-tertiary)">
        Rien ici pour le moment.
      </p>
    );
  }
  return (
    <div className="pt-1">
      {items.map((row) => {
        if (variant === "swipe") {
          return (
            <SwipeableSubject
              key={row.id}
              subjectId={row.id}
              canIgnore
              rounded={false}
            >
              <SubjectRow data={row} linkable={false} />
            </SwipeableSubject>
          );
        }
        if (variant === "ignored") {
          return (
            <IgnoredSubject key={row.id} subjectId={row.id}>
              <SubjectRow data={row} tone="done" />
            </IgnoredSubject>
          );
        }
        return <SubjectRow key={row.id} data={row} tone="done" />;
      })}
    </div>
  );
}

async function FilFeed({ accountId }: { accountId: string }) {
  const { ouverts, termines, ignores, orphanCount } =
    await cachedFilFeed(accountId);

  return (
    <FeedTabs
      options={[
        { value: "ouverts", label: "Ouverts", count: ouverts.length },
        { value: "termines", label: "Terminés", count: termines.length },
        { value: "ignores", label: "Ignorés", count: ignores.length },
      ]}
      note={
        orphanCount > 0 ? (
          <Link
            href="/messages"
            className="mx-4 mt-4 mb-1 flex items-center gap-3 rounded-2xl border border-(--purple-100) bg-relvo-bg px-3.5 py-3 active:opacity-90"
          >
            <span className="grid size-9 flex-none place-items-center rounded-xl bg-relvo text-white">
              <Inbox className="size-[18px]" strokeWidth={2} />
            </span>
            <p className="flex-1 text-[13.5px] leading-[1.4] text-[#3a3550]">
              <b className="font-bold">{orphanCount}</b> message
              {orphanCount > 1 ? "s" : ""} reçu{orphanCount > 1 ? "s" : ""} sans
              intérêt.
            </p>
            <span className="text-[12.5px] font-bold whitespace-nowrap text-relvo">
              Voir →
            </span>
          </Link>
        ) : null
      }
      panes={{
        ouverts: <FeedList items={ouverts} variant="swipe" />,
        termines: <FeedList items={termines} variant="done" />,
        ignores: <FeedList items={ignores} variant="ignored" />,
      }}
    />
  );
}

export default async function FilPage() {
  const accountId = await requireAccountId();
  const openCount = await cachedOpenCount(accountId);

  return (
    <Screen>
      <RelvoHeader
        title="Mon fil"
        subtitle={`${openCount} sujet${openCount > 1 ? "s" : ""} ouvert${openCount > 1 ? "s" : ""}`}
        className="pb-[38px]"
        action={
          <Link
            href="/sujets/nouveau"
            aria-label="Nouveau sujet"
            className="grid size-[42px] flex-none place-items-center rounded-full text-white active:scale-95"
            style={{
              background: "rgb(255 255 255 / 0.15)",
              boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.3)",
            }}
          >
            <Plus className="size-[22px]" strokeWidth={2.2} />
          </Link>
        }
      >
        <Link
          href="/recherche"
          className="mx-[22px] mt-4 flex items-center gap-2.5 rounded-full px-[15px] py-2.5 text-[15px] text-white/85"
          style={{
            background: "rgb(255 255 255 / 0.16)",
            border: "1px solid rgb(255 255 255 / 0.24)",
            boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.16)",
          }}
        >
          <Search className="size-[18px]" strokeWidth={2} />
          Rechercher un sujet…
        </Link>
      </RelvoHeader>

      <Suspense fallback={<RowsSkeleton count={5} />}>
        <FilFeed accountId={accountId} />
      </Suspense>
    </Screen>
  );
}
