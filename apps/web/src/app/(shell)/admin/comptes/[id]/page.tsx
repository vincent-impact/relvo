import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAccountForAdmin, getAccountJournal } from "@relvo/db";
import { AccountGestes } from "@/components/admin/account-gestes";
import { AccountJournal } from "@/components/admin/account-journal";
import { ActivateButton } from "@/components/admin/activate-button";
import { DeleteAccount } from "@/components/admin/delete-account";
import {
  dateCourte,
  depuis,
  eur,
  libelleFournisseur,
  libelleStatutCanal,
  LIBELLE_SECTEUR,
} from "@/components/admin/format";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { ListPanel } from "@/components/shared/list-panel";
import { ZoneHeading } from "@/components/shared/zone-heading";
import { requireAdmin } from "@/server/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Compte — Backoffice Relvo" };
export const dynamic = "force-dynamic";

// La fiche d'un compte, tranche 1 (M21.2, M21.4) : ce que la liste sait, en
// entier, et les gestes. Le journal de l'inférence rendu en page viendra en
// tranche 2 (M21.3).

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

export default async function CompteAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const now = new Date();
  const compte = await getAccountForAdmin(id, { now });
  if (!compte) notFound();
  const fiche = await getAccountJournal(compte.id, { now });
  const enAttente = compte.activatedAt === null;
  const nom = `${compte.firstName} ${compte.lastName}`.trim() || compte.email;
  const soiMeme = compte.id === admin.id;

  return (
    <Screen bottomInset={12} entree>
      <RelvoHeader
        title={nom}
        subtitle={compte.email}
        back="/admin"
        wrapTitle
        className="pb-9"
      />
      <div className="relative z-3 -mt-5 flex flex-col gap-5">
        {enAttente ? (
          <div className="mx-4 flex items-center gap-3 rounded-(--rayon-carte) border border-(--filet) bg-white px-4 py-3.5 shadow-carte">
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-normal text-noir">
                Demande en attente
              </div>
              <div className="mt-0.5 text-[13px] leading-[18px] font-light text-gris">
                Inscrit le {dateCourte(compte.createdAt)}. Ouvrir l&apos;accès
                lui envoie un e-mail.
              </div>
            </div>
            <ActivateButton accountId={compte.id} email={compte.email} />
          </div>
        ) : null}

        <section>
          <ZoneHeading label="Compte" />
          <ListPanel>
            <Ligne label="Créé le">{dateCourte(compte.createdAt)}</Ligne>
            <Ligne label="Accès">
              {compte.activatedAt
                ? `ouvert le ${dateCourte(compte.activatedAt)}`
                : "en attente"}
            </Ligne>
            <Ligne label="Rôle">{compte.role}</Ligne>
            <Ligne label="Secteurs">
              {compte.sectors.length
                ? compte.sectors.map((s) => LIBELLE_SECTEUR[s] ?? s).join(", ")
                : "—"}
            </Ligne>
            <Ligne label="Dernière activité">
              {depuis(compte.lastActivityAt, now)}
            </Ligne>
            <Ligne
              label="Assistant"
              tone={compte.assistantEnabled ? undefined : "urgent"}
            >
              {compte.assistantEnabled ? "actif" : "coupé"}
            </Ligne>
          </ListPanel>
        </section>

        <section>
          <ZoneHeading label="Inférence" hint="journal des sollicitations" />
          <ListPanel>
            <Ligne label="7 derniers jours">{eur(compte.coutEurCourt)}</Ligne>
            <Ligne label="30 derniers jours">
              {eur(compte.coutEurLong)}
              <span className="font-light text-gris">
                {" "}
                · {compte.appelsLong} appel{compte.appelsLong > 1 ? "s" : ""}
              </span>
            </Ligne>
          </ListPanel>
        </section>

        <section>
          <ZoneHeading label="Activité" />
          <ListPanel>
            <Ligne label="Sujets ouverts">{compte.openSubjects}</Ligne>
            <Ligne
              label="Questions ouvertes"
              tone={compte.openQuestions ? "attente" : undefined}
            >
              {compte.openQuestions}
            </Ligne>
            <Ligne label="Appareils abonnés au push">
              {compte.pushDevices}
            </Ligne>
          </ListPanel>
        </section>

        <section>
          <ZoneHeading
            label="Canaux"
            hint={
              compte.channels.length ? `${compte.channels.length}` : undefined
            }
          />
          {compte.channels.length ? (
            <ListPanel>
              {compte.channels.map((c) => (
                <div
                  key={c.id}
                  data-list-row
                  className="flex items-center justify-between gap-3 border-b border-(--filet) px-4 py-2.5 text-[14px]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-normal text-noir">
                      {c.name}
                    </div>
                    <div className="truncate text-[12.5px] font-light text-gris">
                      {c.type === "email" ? "e-mail" : c.type}
                      {c.provider ? ` · ${libelleFournisseur(c.provider)}` : ""}
                      {" · "}
                      {c.identifier}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "flex-none text-[12.5px] font-normal",
                      c.status === "connected" && "text-(--fait)",
                      c.status === "error" && "text-urgent",
                      c.status === "pending" && "text-(--attente)",
                      !c.status && "text-gris",
                    )}
                  >
                    {libelleStatutCanal(c.status)}
                  </span>
                </div>
              ))}
            </ListPanel>
          ) : (
            <p className="px-4 text-[14px] font-light text-gris">
              Aucun canal connecté.
            </p>
          )}
        </section>

        <AccountJournal fiche={fiche} now={now} />

        <section>
          <ZoneHeading label="Gestes" />
          {/* Projection explicite (PITFALLS #41) : jamais la ligne entière. */}
          <AccountGestes
            compte={{
              id: compte.id,
              email: compte.email,
              assistantEnabled: compte.assistantEnabled,
              isTest: compte.isTest,
              enAttente,
            }}
          />
          {soiMeme ? (
            <p className="mt-4 px-4 text-center text-[12.5px] font-light text-gris">
              C&apos;est votre compte : il ne se supprime pas d&apos;ici.
            </p>
          ) : (
            <DeleteAccount accountId={compte.id} email={compte.email} />
          )}
        </section>
      </div>
    </Screen>
  );
}
