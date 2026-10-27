"use client";

import { useState } from "react";
import { SegTabs, type SegTabOption } from "@/components/shared/seg-tabs";

// Onglets de Mon fil (Ouverts / Validés / Fermés). Les trois listes sont
// rendues côté serveur et passées en props ; on n'affiche que l'active. La barre
// SegTabs chevauche le bas du hero violet (variante overlap). La note d'agent
// éventuelle reste visible au-dessus des panneaux.

export function FeedTabs({
  options,
  panes,
  note,
  defaultValue,
  overlap = true,
}: {
  options: SegTabOption[];
  panes: Record<string, React.ReactNode>;
  note?: React.ReactNode;
  /** Onglet actif initial (défaut : premier de la liste). */
  defaultValue?: string;
  /** false : une zone précède les onglets (les sous-domaines d'un dossier), la carte ne chevauche plus le ciel. */
  overlap?: boolean;
}) {
  const [tab, setTab] = useState(defaultValue ?? options[0]?.value ?? "");
  return (
    <>
      <SegTabs
        options={options}
        value={tab}
        onValueChange={setTab}
        overlap={overlap}
        className={overlap ? undefined : "mx-4 mt-5"}
      />
      {note}
      <div>{panes[tab]}</div>
    </>
  );
}
