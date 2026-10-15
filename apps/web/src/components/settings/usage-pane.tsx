import { Progress } from "@/components/ui/progress";
import { DemoNotice } from "@/components/shared/demo-notice";
import { USAGE_DEMO } from "@/lib/demo-bilan";

// L'Usage — un pourcentage, jamais un euro (invariant 38). Le chiffre est au
// corps d'un indicateur (28 px), jamais plus gros que le titre de page ; la
// seule phrase qui reste est celle qui change ce que l'utilisateur craint.

export function UsagePane() {
  const percent = USAGE_DEMO.percent;
  return (
    <div className="relative z-3 -mt-5 space-y-3">
      <div className="mx-4 rounded-(--rayon-carte) border border-(--filet) bg-white px-4 pt-3.5 pb-4 shadow-carte">
        <div className="flex items-baseline justify-between">
          <span className="libelle">Ce mois-ci</span>
          <span className="chiffre text-[28px] leading-8 text-relvo">
            {percent} %
          </span>
        </div>
        {/* `locale` fixée : sans elle, le serveur (en-US, « 32% ») et le
            téléphone (fr-FR, « 32 % ») n'écrivent pas le même texte ARIA, et
            React s'en plaint à chaque chargement. */}
        <Progress
          value={percent}
          locale="fr-FR"
          aria-label="Part du plafond mensuel consommée"
          className="mt-3"
        />
        <p className="mt-3 text-[14px] leading-5 font-light text-noir">
          Au plafond, Relvo continue de ranger : il cesse seulement de lire et
          de rédiger jusqu’au mois suivant.
        </p>
      </div>
      <DemoNotice>
        Valeur de démonstration : le compteur réel arrivera avec le plafond par
        compte.
      </DemoNotice>
    </div>
  );
}
