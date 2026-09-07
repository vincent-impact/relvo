"use client";

import { useState } from "react";

// Les DEUX onglets de la page de suivi (M15.4). Seul îlot interactif d'une page
// par ailleurs entièrement statique : les panneaux sont rendus au build et
// passés en `children`, ce composant ne fait que basculer leur visibilité.
//
// Pourquoi deux onglets et pas une page unique : les deux questions du client
// n'ont pas le même rythme. « Où en est mon projet ? » bouge quand un chantier
// s'ouvre ou se ferme ; « qu'est-ce qui a changé ? » bouge à chaque mise en
// ligne. Les mélanger produit une page que personne ne sait lire.

export function SuiviTabs({
  classes,
  avancement,
  journal,
}: {
  /** Classes du module CSS de la page — le style vit avec la page, pas ici. */
  classes: { tabs: string };
  avancement: React.ReactNode;
  journal: React.ReactNode;
}) {
  const [actif, setActif] = useState<"avancement" | "journal">("avancement");

  const onglets = [
    { id: "avancement", label: "Avancement" },
    { id: "journal", label: "Journal des versions" },
  ] as const;

  return (
    <>
      <div className={classes.tabs} role="tablist">
        {onglets.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            id={`t-${o.id}`}
            aria-controls={`p-${o.id}`}
            aria-selected={actif === o.id}
            onClick={() => setActif(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <section
        id="p-avancement"
        role="tabpanel"
        aria-labelledby="t-avancement"
        hidden={actif !== "avancement"}
      >
        {avancement}
      </section>
      <section
        id="p-journal"
        role="tabpanel"
        aria-labelledby="t-journal"
        hidden={actif !== "journal"}
      >
        {journal}
      </section>
    </>
  );
}
