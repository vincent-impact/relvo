"use client";

import { IndicatorTabs } from "@/components/shared/indicator-tabs";

// Les indicateurs du Calendrier — trois lentilles sur les tâches, chacune
// affichant son compteur ET agissant comme onglet :
//   • Aujourd'hui → nombre de tâches du jour (sans heure)
//   • Rendez-vous → nombre de rendez-vous du jour (tâches à l'heure)
//   • En retard   → nombre de tâches en retard, en ROUGE dès qu'il est > 0,
//                   actif ou non : le retard se voit toujours.
// « À trier » a quitté cette barre avec M18 : c'est un filtre de Sujets et de
// Conversations, pas une lentille des tâches. La carte et son cerclage viennent
// d'IndicatorTabs.

export type TaskTab = "agenda" | "rdv" | "retard";

export function TaskKpiTabs({
  active,
  onChange,
  counts,
}: {
  active: TaskTab;
  onChange: (tab: TaskTab) => void;
  counts: Record<TaskTab, number>;
}) {
  return (
    <IndicatorTabs<TaskTab>
      value={active}
      onChange={onChange}
      tabs={[
        { key: "agenda", label: "aujourd'hui", count: counts.agenda },
        { key: "rdv", label: "rendez-vous", count: counts.rdv },
        {
          key: "retard",
          label: "en retard",
          count: counts.retard,
          tone: "urgent",
        },
      ]}
    />
  );
}
