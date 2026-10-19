import type { AdminOverview } from "@relvo/db";
import { ListPanel } from "@/components/shared/list-panel";
import { ZoneHeading } from "@/components/shared/zone-heading";
import { cn } from "@/lib/utils";
import { eur } from "./format";
import { JaugePlafond } from "./jauge-plafond";

// La vue d'ensemble (M21.5) en tête du backoffice : le coût du mois contre le
// plafond de la clé, les appels et les silencieux, les comptes actifs, les
// échecs des sept derniers jours, l'outbox. Les sondes que les routes
// logguaient déjà, enfin lisibles sans `vercel logs`.

const LIBELLE_ECHEC: Record<string, string> = {
  triage_failed: "tris",
  structuration_failed: "structurations",
  relecture_failed: "relectures",
  ia_echec: "tours de l'échange",
};

function Ligne({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "urgent" | "attente";
}) {
  return (
    <div
      data-list-row
      className="flex items-baseline justify-between gap-3 border-b border-(--filet) px-4 py-2.5 text-[14px]"
    >
      <span className="font-light text-gris">{label}</span>
      <span
        className={cn(
          "chiffre text-right font-normal text-noir",
          tone === "urgent" && "text-urgent",
          tone === "attente" && "text-(--attente)",
        )}
      >
        {children}
      </span>
    </div>
  );
}

export function Overview({ vue }: { vue: AdminOverview }) {
  const part = vue.plafondEur > 0 ? vue.coutMoisEur / vue.plafondEur : 0;
  const pct = Math.min(100, Math.round(part * 100));
  const echecsTotal = Object.values(vue.echecs7j).reduce((s, n) => s + n, 0);
  const mois = vue.moisDepuis.toLocaleDateString("fr-FR", {
    month: "long",
    timeZone: "Europe/Paris",
  });

  return (
    <section>
      <ZoneHeading label="Ce mois-ci" hint={mois} />
      <div className="mx-4 overflow-hidden rounded-(--rayon-carte) border border-(--filet) bg-white shadow-carte">
        <div className="px-4 pt-3.5 pb-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[14px] font-light text-gris">
              Inférence, contre le plafond de la clé
            </span>
            <span
              className={cn(
                "chiffre text-[15px] font-medium",
                part >= 0.8 ? "text-urgent" : "text-noir",
              )}
            >
              {eur(vue.coutMoisEur)}
              <span className="font-light text-gris">
                {" "}
                / {eur(vue.plafondEur)}
              </span>
            </span>
          </div>
          <JaugePlafond pct={pct} urgent={part >= 0.8} />
          <div className="mt-2 flex flex-wrap gap-x-3 text-[12px] leading-4 font-normal text-gris">
            <span>
              {vue.appelsMois} appel{vue.appelsMois > 1 ? "s" : ""}
            </span>
            <span className={cn(vue.silencieuxMois && "text-(--attente)")}>
              {vue.silencieuxMois} silencieux
            </span>
            <span>{pct} % du plafond</span>
          </div>
        </div>
      </div>

      <ZoneHeading label="Sept derniers jours" className="mt-5" />
      <ListPanel>
        <Ligne label="Comptes actifs">
          {vue.comptesActifs7j}
          <span className="font-light text-gris"> / {vue.comptes}</span>
        </Ligne>
        <Ligne
          label="Demandes en attente"
          tone={vue.comptesEnAttente ? "attente" : undefined}
        >
          {vue.comptesEnAttente}
        </Ligne>
        <Ligne label="Échecs" tone={echecsTotal ? "urgent" : undefined}>
          {echecsTotal === 0
            ? "aucun"
            : Object.entries(vue.echecs7j)
                .filter(([, n]) => n > 0)
                .map(([t, n]) => `${n} ${LIBELLE_ECHEC[t] ?? t}`)
                .join(" · ")}
        </Ligne>
        <Ligne
          label="Fichiers en attente d'effacement"
          tone={vue.outboxEnAttente ? "attente" : undefined}
        >
          {vue.outboxEnAttente}
        </Ligne>
        <Ligne
          label="Rattrapages en échec"
          tone={vue.rattrapagesEnEchec ? "urgent" : undefined}
        >
          {vue.rattrapagesEnEchec}
        </Ligne>
      </ListPanel>
    </section>
  );
}
