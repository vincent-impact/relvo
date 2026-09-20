import { Progress } from "@/components/ui/progress";
import { DemoNotice } from "@/components/shared/demo-notice";
import { USAGE_DEMO } from "@/lib/demo-bilan";

// Usage — la part du plafond mensuel d'inférence consommée, en POURCENTAGE,
// jamais en euros (invariant 38) : l'utilisateur n'a pas à savoir ce qu'on lui
// alloue. Le plafond est celui de M14.5 (seuil par compte) ; d'ici là, la
// valeur est une démonstration, et la page le dit.

export function UsagePane() {
  const percent = USAGE_DEMO.percent;
  return (
    <div className="space-y-4 pt-5">
      <DemoNotice>
        Valeur de démonstration : le compteur réel arrivera avec le plafond par
        compte.
      </DemoNotice>
      <div className="mx-4 rounded-[14px] border border-(--hairline) bg-white px-4 py-4 shadow-surface-1">
        <div className="flex items-baseline justify-between">
          <span className="text-[14.5px] font-medium">Ce mois-ci</span>
          <span className="font-numeric text-[22px] font-semibold text-relvo tabular-nums">
            {percent} %
          </span>
        </div>
        <Progress
          value={percent}
          aria-label="Part du plafond mensuel consommée"
          className="mt-3"
        />
        <p className="mt-3 text-[12.5px] leading-[1.4] text-(--text-secondary)">
          La part de votre plafond mensuel que Relvo a consommée pour lire,
          trier et rédiger. Au plafond, Relvo ne s&apos;arrête pas de ranger :
          il cesse seulement de solliciter le modèle jusqu&apos;au mois suivant.
        </p>
      </div>
    </div>
  );
}
