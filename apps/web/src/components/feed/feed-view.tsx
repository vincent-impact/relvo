"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { FeedFilterBar } from "@/components/feed/feed-filter-bar";
import { IgnoredSubject } from "@/components/feed/ignored-subject";
import { SwipeableSubject } from "@/components/feed/swipeable-subject";
import { SegTabs } from "@/components/shared/seg-tabs";
import {
  SubjectRow,
  type SubjectRowData,
} from "@/components/shared/subject-row";

// Vue complète de Mon fil (client) — onglets de statut + barre de filtres rapides
// + liste filtrée. Le filtrage est INSTANTANÉ (côté client) sur les lignes déjà
// chargées : Urgent / Nouveaux / Domaines, cumulables (ET entre dimensions, OR
// entre domaines). Les onglets restent la dimension « statut » (Ouverts/Terminés/
// Ignorés), avec leurs comportements propres (swipe, restauration).

type Basket = "ouverts" | "termines" | "ignores";

export function FeedView({
  ouverts,
  termines,
  ignores,
  orphanCount,
  folderNames,
}: {
  ouverts: SubjectRowData[];
  termines: SubjectRowData[];
  ignores: SubjectRowData[];
  orphanCount: number;
  folderNames: Record<string, string>;
}) {
  const [tab, setTab] = useState<Basket>("ouverts");
  const [urgent, setUrgent] = useState(false);
  const [nouveaux, setNouveaux] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);

  const current =
    tab === "ouverts" ? ouverts : tab === "termines" ? termines : ignores;

  // Domaines réellement présents dans l'onglet courant (chips pertinentes).
  const availableDomains = useMemo(() => {
    const seen = new Set<string>();
    for (const r of current) if (r.folderSlug) seen.add(r.folderSlug);
    return [...seen].sort((a, b) =>
      (folderNames[a] ?? a).localeCompare(folderNames[b] ?? b),
    );
  }, [current, folderNames]);

  const anyActive = urgent || nouveaux || domains.length > 0;

  const filtered = current.filter(
    (r) =>
      (!urgent || r.urgent) &&
      (!nouveaux || r.isNew) &&
      (domains.length === 0 ||
        (r.folderSlug != null && domains.includes(r.folderSlug))),
  );

  function reset() {
    setUrgent(false);
    setNouveaux(false);
    setDomains([]);
  }

  function toggleDomain(slug: string) {
    setDomains((d) =>
      d.includes(slug) ? d.filter((x) => x !== slug) : [...d, slug],
    );
  }

  function renderRow(row: SubjectRowData) {
    if (tab === "ouverts") {
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
    if (tab === "ignores") {
      return (
        <IgnoredSubject key={row.id} subjectId={row.id}>
          <SubjectRow data={row} tone="done" />
        </IgnoredSubject>
      );
    }
    return <SubjectRow key={row.id} data={row} tone="done" />;
  }

  return (
    <>
      <SegTabs
        options={[
          { value: "ouverts", label: "Ouverts", count: ouverts.length },
          { value: "termines", label: "Terminés", count: termines.length },
          { value: "ignores", label: "Ignorés", count: ignores.length },
        ]}
        value={tab}
        onValueChange={(v) => setTab(v as Basket)}
        overlap
      />

      <FeedFilterBar
        urgent={urgent}
        onUrgent={() => setUrgent((u) => !u)}
        nouveaux={nouveaux}
        onNouveaux={() => setNouveaux((n) => !n)}
        domains={availableDomains}
        selectedDomains={domains}
        onToggleDomain={toggleDomain}
        folderNames={folderNames}
        anyActive={anyActive}
        onReset={reset}
      />

      {orphanCount > 0 ? (
        <Link
          href="/messages"
          className="mx-4 mt-3 mb-1 flex items-center gap-3 rounded-2xl border border-(--purple-100) bg-relvo-bg px-3.5 py-3 active:opacity-90"
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
      ) : null}

      <div className="pt-1">
        {filtered.length === 0 ? (
          <p className="px-[22px] py-10 text-center text-[13.5px] text-(--text-tertiary)">
            {anyActive
              ? "Aucun sujet ne correspond à ces filtres."
              : "Rien ici pour le moment."}
          </p>
        ) : (
          filtered.map(renderRow)
        )}
      </div>
    </>
  );
}
