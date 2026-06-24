"use client";

import { useState } from "react";
import { SegTabs, type SegTabOption } from "@/components/shared/seg-tabs";

// Onglets de Mon fil (Priorité / Ouverts / Terminés). Les trois listes sont
// rendues côté serveur et passées en props ; on n'affiche que l'active. La barre
// SegTabs chevauche le bas du hero violet (variante overlap). La note d'agent
// éventuelle reste visible au-dessus des panneaux.

export function FeedTabs({
  options,
  panes,
  note,
  defaultValue,
}: {
  options: SegTabOption[];
  panes: Record<string, React.ReactNode>;
  note?: React.ReactNode;
  /** Onglet actif initial (défaut : premier de la liste). */
  defaultValue?: string;
}) {
  const [tab, setTab] = useState(defaultValue ?? options[0]?.value ?? "");
  return (
    <>
      <SegTabs options={options} value={tab} onValueChange={setTab} overlap />
      {note}
      <div>{panes[tab]}</div>
    </>
  );
}
