"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { type Basket, FeedFilterBar } from "@/components/feed/feed-filter-bar";
import { ClosedSubject } from "@/components/feed/closed-subject";
import { SwipeableSubject } from "@/components/feed/swipeable-subject";
import {
  SubjectRow,
  type SubjectRowData,
} from "@/components/shared/subject-row";

// Vue complète de Mon fil (client) — UNE barre de filtres rapides + liste filtrée.
// Le filtrage est INSTANTANÉ (côté client) sur les lignes déjà chargées, 4
// dimensions cumulables : Statut (Ouvert/Validé/Fermé/Tous), Urgent, Nouveau,
// Domaine. Chaque ligne est rendue selon SON panier d'origine (swipe pour les
// ouverts, réouverture pour les fermés, barré pour les validés) — y compris
// dans « Tous », où les trois familles cohabitent.

type Tagged = { row: SubjectRowData; basket: "ouvert" | "valide" | "ferme" };

export function FeedView({
  ouverts,
  valides,
  fermes,
  folderNames,
}: {
  ouverts: SubjectRowData[];
  valides: SubjectRowData[];
  fermes: SubjectRowData[];
  folderNames: Record<string, string>;
}) {
  // État initial des filtres lu depuis l'URL (KPI de l'Accueil → Mon fil filtré) :
  // ?urgent=1 · ?nouveau=1 · ?statut=ouvert|valide|ferme|tous · ?domaine=<slug>.
  const params = useSearchParams();
  const initialStatut = (() => {
    const s = params.get("statut");
    return s === "valide" || s === "ferme" || s === "tous" ? s : "ouvert";
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
    const v = valides.map((row) => ({ row, basket: "valide" as const }));
    const f = fermes.map((row) => ({ row, basket: "ferme" as const }));
    if (statut === "ouvert") return o;
    if (statut === "valide") return v;
    if (statut === "ferme") return f;
    return [...o, ...v, ...f];
  }, [statut, ouverts, valides, fermes]);

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
          canClose
          rounded={false}
        >
          <SubjectRow data={row} linkable={false} />
        </SwipeableSubject>
      );
    }
    if (basket === "ferme") {
      return (
        <ClosedSubject key={row.id} subjectId={row.id}>
          <SubjectRow data={row} tone="done" />
        </ClosedSubject>
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
