"use client";

import { Progress } from "@/components/ui/progress";

// La jauge du plafond mensuel (M21.5) — un composant CLIENT, parce que le
// texte ARIA se calcule par une fonction : posée depuis un composant serveur,
// elle ne traverserait pas la frontière. Le texte est le nôtre, déterministe :
// le formatage du pourcentage par la locale diffère entre le serveur et le
// téléphone (« 0 % » contre « 0% ») et React le signalait en désaccord
// d'hydratation. Au-delà de 80 % du plafond, l'indicateur passe au rouge en
// redéfinissant localement le dégradé qu'il lit.

export function JaugePlafond({
  pct,
  urgent,
}: {
  pct: number;
  urgent: boolean;
}) {
  return (
    <Progress
      value={pct}
      aria-label="Part du plafond mensuel consommée"
      getAriaValueText={() => `${pct} %`}
      className="mt-2.5"
      style={
        urgent
          ? ({ "--degrade-relvo": "var(--urgent)" } as React.CSSProperties)
          : undefined
      }
    />
  );
}
