"use client";

import { IndicatorTabs } from "@/components/shared/indicator-tabs";

// Les indicateurs de Sujets — UN SEUL AXE : le STATUT (Ouverts · Validés ·
// Fermés). Les anciens onglets « Urgents » et « Nouveaux » ont été retirés : ce
// sont des MARQUEURS, pas des états, et la liste les distingue déjà (« Urgent · »
// en rouge devant le titre). La carte et son cerclage viennent d'IndicatorTabs.

export type SubjectTab = "ouverts" | "valides" | "fermes";

export function SubjectKpiTabs({
  active,
  onChange,
  counts,
}: {
  active: SubjectTab;
  onChange: (tab: SubjectTab) => void;
  counts: Record<SubjectTab, number>;
}) {
  return (
    <IndicatorTabs<SubjectTab>
      value={active}
      onChange={onChange}
      tabs={[
        { key: "ouverts", label: "ouverts", count: counts.ouverts },
        { key: "valides", label: "validés", count: counts.valides },
        { key: "fermes", label: "fermés", count: counts.fermes },
      ]}
    />
  );
}
