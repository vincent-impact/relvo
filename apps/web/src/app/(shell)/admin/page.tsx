import type { Metadata } from "next";
import Link from "next/link";
import { getAdminOverview, listAccountsForAdmin } from "@relvo/db";
import { AccountRow } from "@/components/admin/account-row";
import { eur } from "@/components/admin/format";
import { Overview } from "@/components/admin/overview";
import { RelvoHeader, SKY_BTN } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { ListPanel } from "@/components/shared/list-panel";
import { House } from "@/components/shared/picto";
import { ZoneHeading } from "@/components/shared/zone-heading";

export const metadata: Metadata = { title: "Backoffice — Relvo" };
export const dynamic = "force-dynamic";

// La liste des comptes (M21.2) — ce que l'administrateur voit en premier :
// les demandes à ouvrir en tête (le geste du jour J), puis les comptes, les
// tests à part. Chaque chiffre vient d'une fonction du produit, lue compte par
// compte ; le total du mois attendra la vue d'ensemble (M21.5).

export default async function AdminPage() {
  const now = new Date();
  // Le plafond de la clé du fournisseur, tel que réglé chez lui : une
  // configuration, jamais un chiffre inventé par le domaine.
  const plafondEur = Number(process.env.OPENAI_PLAFOND_MENSUEL_EUR) || 100;
  const [comptes, vue] = await Promise.all([
    listAccountsForAdmin({ now }),
    getAdminOverview({ now, plafondEur }),
  ]);
  const enAttente = comptes.filter((c) => c.activatedAt === null);
  const actifs = comptes
    .filter((c) => c.activatedAt !== null && !c.isTest)
    .sort(
      (a, b) =>
        (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0),
    );
  const tests = comptes.filter((c) => c.activatedAt !== null && c.isTest);
  const coutLong = comptes.reduce((s, c) => s + c.coutEurLong, 0);
  const coutCourt = comptes.reduce((s, c) => s + c.coutEurCourt, 0);

  return (
    <Screen bottomInset={12}>
      <RelvoHeader
        title="Backoffice"
        subtitle={`${comptes.length} compte${comptes.length > 1 ? "s" : ""} · inférence ${eur(coutCourt)} / 7 j · ${eur(coutLong)} / 30 j`}
        action={
          <Link
            href="/"
            aria-label="Retour à l'application"
            className={SKY_BTN}
          >
            <House className="size-[18px]" />
          </Link>
        }
        className="pb-9"
      />
      <div className="relative z-3 -mt-5 flex flex-col gap-5">
        <Overview vue={vue} />
        {enAttente.length ? (
          <section>
            <ZoneHeading
              label="À ouvrir"
              hint={`${enAttente.length} demande${enAttente.length > 1 ? "s" : ""}`}
            />
            <ListPanel>
              {enAttente.map((c) => (
                <AccountRow key={c.id} compte={c} now={now} />
              ))}
            </ListPanel>
          </section>
        ) : null}

        <section>
          <ZoneHeading
            label="Comptes"
            hint={actifs.length ? "par dernière activité" : undefined}
          />
          {actifs.length ? (
            <ListPanel>
              {actifs.map((c) => (
                <AccountRow key={c.id} compte={c} now={now} />
              ))}
            </ListPanel>
          ) : (
            <p className="px-4 text-[14px] font-light text-gris">
              Aucun compte ouvert.
            </p>
          )}
        </section>

        <section>
          <ZoneHeading label="Essais" hint="pour l'administrateur" />
          <ListPanel>
            <Link
              href="/admin/dictee"
              data-list-row
              className="flex items-baseline justify-between gap-3 border-b border-(--filet) px-4 py-3 text-[14.5px] font-medium text-noir active:bg-(--fond-puce)"
            >
              Essai de dictée
              <span className="text-[12px] font-light text-gris">
                le micro, la transcription, la mesure
              </span>
            </Link>
          </ListPanel>
        </section>

        {tests.length ? (
          <section>
            <ZoneHeading label="Comptes test" hint={`${tests.length}`} />
            <ListPanel>
              {tests.map((c) => (
                <AccountRow key={c.id} compte={c} now={now} />
              ))}
            </ListPanel>
          </section>
        ) : null}
      </div>
    </Screen>
  );
}
