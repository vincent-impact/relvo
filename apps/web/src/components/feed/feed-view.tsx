"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { type Basket, FeedFilterBar } from "@/components/feed/feed-filter-bar";
import { IgnoredSubject } from "@/components/feed/ignored-subject";
import { SwipeableSubject } from "@/components/feed/swipeable-subject";
import {
  SubjectRow,
  type SubjectRowData,
} from "@/components/shared/subject-row";

// Vue complète de Mon fil (client) — UNE barre de filtres rapides + liste filtrée.
// Le filtrage est INSTANTANÉ (côté client) sur les lignes déjà chargées, 4
// dimensions cumulables : Statut (Ouvert/Terminé/Ignoré/Tous), Urgent, Nouveau,
// Domaine. Chaque ligne est rendue selon SON panier d'origine (swipe pour les
// ouverts, restauration pour les ignorés, barré pour les terminés) — y compris
// dans « Tous », où les trois familles cohabitent.

type Tagged = { row: SubjectRowData; basket: "ouvert" | "termine" | "ignore" };

export function FeedView({
  ouverts,
  termines,
  ignores,
  folderNames,
}: {
  ouverts: SubjectRowData[];
  termines: SubjectRowData[];
  ignores: SubjectRowData[];
  folderNames: Record<string, string>;
}) {
  // État initial des filtres lu depuis l'URL (KPI de l'Accueil → Mon fil filtré) :
  // ?urgent=1 · ?nouveau=1 · ?statut=ouvert|termine|ignore|tous · ?domaine=<slug>.
  const params = useSearchParams();
  const initialStatut = (() => {
    const s = params.get("statut");
    return s === "termine" || s === "ignore" || s === "tous" ? s : "ouvert";
  })();
  const [statut, setStatut] = useState<Basket>(initialStatut);
  const [urgent, setUrgent] = useState(params.get("urgent") === "1");
  const [nouveau, setNouveau] = useState(params.get("nouveau") === "1");
  const [domain, setDomain] = useState<string | null>(
    params.get("domaine") || null,
  );

  // Liste de base selon le statut sélectionné, chaque ligne taguée par panier.
  const base: Tagged[] = useMemo(() => {
    const o = ouverts.map((row) => ({ row, basket: "ouvert" as const }));
    const t = termines.map((row) => ({ row, basket: "termine" as const }));
    const i = ignores.map((row) => ({ row, basket: "ignore" as const }));
    if (statut === "ouvert") return o;
    if (statut === "termine") return t;
    if (statut === "ignore") return i;
    return [...o, ...t, ...i];
  }, [statut, ouverts, termines, ignores]);

  // Domaines réellement présents dans la liste de base (chips pertinentes).
  const availableDomains = useMemo(() => {
    const seen = new Set<string>();
    for (const { row } of base) if (row.folderSlug) seen.add(row.folderSlug);
    return [...seen].sort((a, b) =>
      (folderNames[a] ?? a).localeCompare(folderNames[b] ?? b),
    );
  }, [base, folderNames]);

  const filtered = base.filter(
    ({ row }) =>
      (!urgent || row.urgent) &&
      (!nouveau || row.isNew) &&
      (domain == null || row.folderSlug === domain),
  );

  const anyFilter = urgent || nouveau || domain != null || statut !== "ouvert";

  function renderRow({ row, basket }: Tagged) {
    if (basket === "ouvert") {
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
    if (basket === "ignore") {
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
      <FeedFilterBar
        statut={statut}
        onStatut={setStatut}
        urgent={urgent}
        onUrgent={() => setUrgent((u) => !u)}
        nouveau={nouveau}
        onNouveau={() => setNouveau((n) => !n)}
        domain={domain}
        onDomain={setDomain}
        domains={availableDomains}
        folderNames={folderNames}
      />

      {/* Compteur total de la sélection courante. */}
      <p className="px-4 pt-2 pb-1 text-[12.5px] font-semibold text-(--text-tertiary)">
        {filtered.length} sujet{filtered.length > 1 ? "s" : ""}
      </p>

      <div className="pt-0.5">
        {filtered.length === 0 ? (
          <p className="px-[22px] py-10 text-center text-[13.5px] text-(--text-tertiary)">
            {anyFilter
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
