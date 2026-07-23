"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FeedDomainBar } from "@/components/feed/feed-domain-bar";
import {
  SubjectKpiTabs,
  type SubjectTab,
} from "@/components/feed/subject-kpi-tabs";
import { SwipeableSubject } from "@/components/feed/swipeable-subject";
import {
  SubjectRow,
  type SubjectRowData,
} from "@/components/shared/subject-row";
import type { FolderChip } from "@/server/cached";

// Vue complète de Sujets (client) — la carte KPI est devenue une BARRE D'ONGLETS
// chiffrée (Urgents · Nouveaux · Ouverts · Validés), et la barre de filtres ne
// propose plus que les DOMAINES (chips icône + couleur, défilables). Tout est
// instantané côté client sur les lignes déjà chargées.
//
// Onglets : Urgents/Nouveaux/Ouverts sont trois lentilles sur les sujets OUVERTS
// (urgents ⊂ ouverts, nouveaux ⊂ ouverts) ; Validés est la famille terminale
// récupérable. « Fermés » n'a plus d'accès direct ici.

type Tagged = { row: SubjectRowData; basket: "ouvert" | "valide" };

// Onglet initial déduit de l'URL (KPI de l'Accueil → Sujets filtré).
function initialTab(params: URLSearchParams): SubjectTab {
  if (params.get("urgent") === "1") return "urgents";
  if (params.get("nouveau") === "1") return "nouveaux";
  if (params.get("statut") === "valide") return "valides";
  return "ouverts";
}

export function FeedView({
  ouverts,
  valides,
  folders,
}: {
  ouverts: SubjectRowData[];
  valides: SubjectRowData[];
  folders: FolderChip[];
}) {
  const params = useSearchParams();
  const [tab, setTab] = useState<SubjectTab>(() => initialTab(params));
  const [domain, setDomain] = useState<string | null>(
    params.get("domaine") || null,
  );

  const counts: Record<SubjectTab, number> = useMemo(
    () => ({
      urgents: ouverts.filter((r) => r.urgent).length,
      nouveaux: ouverts.filter((r) => r.isNew).length,
      ouverts: ouverts.length,
      valides: valides.length,
    }),
    [ouverts, valides],
  );

  // Liste de base selon l'onglet, chaque ligne taguée par panier (rendu adapté).
  const base: Tagged[] = useMemo(() => {
    if (tab === "valides")
      return valides.map((row) => ({ row, basket: "valide" as const }));
    const open = ouverts
      .filter(
        (r) =>
          tab === "ouverts" ||
          (tab === "urgents" && r.urgent) ||
          (tab === "nouveaux" && r.isNew),
      )
      .map((row) => ({ row, basket: "ouvert" as const }));
    return open;
  }, [tab, ouverts, valides]);

  const filtered = base.filter(
    ({ row }) => domain == null || row.folderSlug === domain,
  );

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
    return <SubjectRow key={row.id} data={row} tone="done" />;
  }

  return (
    <>
      <SubjectKpiTabs active={tab} onChange={setTab} counts={counts} />

      <FeedDomainBar domain={domain} onDomain={setDomain} folders={folders} />

      {/* Compteur total de la sélection courante. */}
      <p className="px-4 pt-2 pb-1 text-[12.5px] font-semibold text-(--text-tertiary)">
        {filtered.length} sujet{filtered.length > 1 ? "s" : ""}
      </p>

      <div className="pt-0.5">
        {filtered.length === 0 ? (
          <p className="px-[22px] py-10 text-center text-[13.5px] text-(--text-tertiary)">
            {domain != null
              ? "Aucun sujet ne correspond à ce domaine."
              : "Rien ici pour le moment."}
          </p>
        ) : (
          filtered.map(renderRow)
        )}
      </div>
    </>
  );
}
