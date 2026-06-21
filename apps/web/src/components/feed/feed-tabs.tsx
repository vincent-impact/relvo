"use client";

import { useState } from "react";
import {
  SegmentedControl,
  type SegmentedOption,
} from "@/components/shared/segmented-control";

// Onglets de Mon fil (Priorité / Ouverts / Terminés). Les trois listes sont
// rendues côté serveur et passées en props ; on n'affiche que l'active.

export function FeedTabs({
  options,
  panes,
}: {
  options: SegmentedOption[];
  panes: Record<string, React.ReactNode>;
}) {
  const [tab, setTab] = useState(options[0]?.value ?? "");
  return (
    <div className="space-y-3">
      <SegmentedControl options={options} value={tab} onValueChange={setTab} />
      <div>{panes[tab]}</div>
    </div>
  );
}
