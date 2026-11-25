import type { Metadata } from "next";
import Link from "next/link";
import { countPendingFileDeletions, listAccountsForAdmin } from "@relvo/db";
import { depuis } from "@/components/admin/format";
import { Ligne } from "@/components/admin/ligne";
import { Dedoublonner } from "@/components/admin/dedoublonner";
import { RelireBucket } from "@/components/admin/relire-bucket";
import {
  CarteStockage,
  RepartitionDesPieces,
} from "@/components/admin/stockage";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { ListPanel } from "@/components/shared/list-panel";
import { ZoneHeading } from "@/components/shared/zone-heading";
import { compte, nombre, octets, partDe } from "@/lib/stockage";
import { partDuQuota, pourcentDuQuota } from "@/lib/medias";
import { NETTOYAGE_ACTIF } from "@/lib/nettoyage";
import { requireAdmin } from "@/server/admin";
import { passerLeNettoyage } from "@/server/nettoyage";
import { mesureDuStockage } from "@/server/stockage-mesure";

export const metadata: Metadata = { title: "Stockage — Backoffice Relvo" };
export const dynamic = "force-dynamic";
// La déduplication du stock (M25.8) part de cette page : elle relit le bucket
// chez le fournisseur puis passe compte par compte.
export const maxDuration = 300;

// LE STOCKAGE (M25.1) — où part l'espace, et si ce qui devait partir est
// parti. En tête, le poids contre le repère ; puis le bucket lu chez le
// fournisseur, rapproché de la base ; puis ce que la base sait des pièces —
// ce qui les tient, leur type, leur canal — et le poids de chaque compte.

export default async function StockagePage() {
  await requireAdmin();
  const now = new Date();
  const [mesure, comptes, enFile, nettoyage] = await Promise.all([
    mesureDuStockage(),
    listAccountsForAdmin({ now }),
    countPendingFileDeletions(),
    // Toujours une SIMULATION ici : la page ne nettoie rien, elle annonce.
    passerLeNettoyage({ budgetMs: 20_000, reel: false, now }),
  ]);
  const { bucket, pieces } = mesure;
  const total = pieces.total.octets;
  const parCompte = comptes
    .map((c) => ({
      id: c.id,
      nom: `${c.firstName} ${c.lastName}`.trim() || c.email,
      email: c.email,
      poids: pieces.parCompte[c.id] ?? { pieces: 0, octets: 0 },
    }))
    .filter((c) => c.poids.pieces > 0)
    .sort((a, b) => b.poids.octets - a.poids.octets);

  return (
    <Screen bottomInset={12} entree>
      <RelvoHeader
        title="Stockage"
        subtitle="où part l'espace, et ce qui devait partir"
        back="/admin"
        className="pb-9"
      />
      <div className="relative z-3 -mt-5 flex flex-col gap-5">
        <CarteStockage mesure={mesure} now={now} />

        <section>
          <ZoneHeading
            label="Le bucket"
            hint={
              bucket ? `lu ${depuis(new Date(bucket.luLe), now)}` : "illisible"
            }
          />
          {bucket ? (
            <ListPanel>
              <Ligne label="Fichiers stockés">
                {octets(bucket.total.octets)}
                <span className="font-light text-gris">
                  {" "}
                  · {compte(bucket.total.objets, "fichier", "fichiers")}
                </span>
              </Ligne>
              <Ligne label="Connus de la base">
                {octets(pieces.total.octets + mesure.connaissances.octets)}
                <span className="font-light text-gris">
                  {" "}
                  ·{" "}
                  {compte(
                    pieces.total.pieces + mesure.connaissances.fichiers,
                    "fichier",
                    "fichiers",
                  )}
                </span>
              </Ligne>
              <Ligne
                label="Sans propriétaire"
                tone={bucket.sansProprietaire.objets ? "urgent" : undefined}
              >
                {bucket.sansProprietaire.objets === 0
                  ? "aucun"
                  : `${octets(bucket.sansProprietaire.octets)} · ${compte(bucket.sansProprietaire.objets, "fichier", "fichiers")}`}
              </Ligne>
              <Ligne
                label="En attente d'effacement"
                tone={enFile ? "attente" : undefined}
              >
                {enFile === 0
                  ? "aucun"
                  : `${nombre(enFile)} en file · ${octets(bucket.enAttente.octets)} encore stockés`}
              </Ligne>
              <Ligne
                label="Absents du bucket"
                tone={bucket.manquants ? "urgent" : undefined}
              >
                {bucket.manquants === 0
                  ? "aucun"
                  : compte(bucket.manquants, "pièce", "pièces")}
              </Ligne>
              <Ligne label="Doublons dans un même compte">
                {bucket.doublons.objets === 0
                  ? "aucun"
                  : `${octets(bucket.doublons.octets)} · ${compte(bucket.doublons.objets, "fichier", "fichiers")}`}
              </Ligne>
              {bucket.horsComptes.objets ? (
                <Ligne label="Hors de tout compte" tone="attente">
                  {octets(bucket.horsComptes.octets)} ·{" "}
                  {compte(bucket.horsComptes.objets, "fichier", "fichiers")}
                </Ligne>
              ) : null}
              {pieces.sansTaille ? (
                <Ligne label="Pièces de taille inconnue" tone="attente">
                  {nombre(pieces.sansTaille)}
                </Ligne>
              ) : null}
            </ListPanel>
          ) : (
            <p className="px-4 text-[14px] font-light text-gris">
              Le fournisseur n&apos;a pas répondu : les poids ci-dessous sont
              ceux que la base connaît.
            </p>
          )}
          {/* La note sur toute la largeur, les gestes dessous : à deux boutons,
              la note se retrouvait serrée dans une colonne étroite. */}
          <div className="mt-3 flex flex-col gap-2.5 px-4">
            <p className="text-[12.5px] leading-[17px] font-light text-gris">
              {bucket && !bucket.complet
                ? "Le listing a été coupé à son plafond : ces totaux sont des minorants."
                : "« Sans propriétaire » : stocké, mais ni en base ni en file — ce qu'un effacement a laissé."}
            </p>
            <div className="flex items-center justify-end gap-2">
              {bucket?.complet && bucket.doublons.objets > 0 ? (
                <Dedoublonner
                  fichiers={bucket.doublons.objets}
                  poids={bucket.doublons.octets}
                />
              ) : null}
              <RelireBucket />
            </div>
          </div>
        </section>

        {/* Le nettoyage : ce que le prochain passage du matin retirerait —
            ou retirera, selon que l'interrupteur est armé. */}
        <section>
          <ZoneHeading
            label="Le nettoyage"
            hint={NETTOYAGE_ACTIF ? "chaque matin" : "à l'arrêt — simulation"}
          />
          <ListPanel>
            <Ligne label="Messages sans sujet, passé trente jours">
              {nombre(nettoyage.bilan.messages)}
            </Ligne>
            <Ligne label="Leurs pièces jointes">
              {octets(nettoyage.bilan.octets)}
              <span className="font-light text-gris">
                {" "}
                · {compte(nettoyage.bilan.pieces, "pièce", "pièces")}
              </span>
            </Ligne>
            <Ligne label="Conversations e-mail qui ne garderaient rien">
              {nombre(nettoyage.bilan.conversationsEmail)}
            </Ligne>
            <Ligne label="Sujets fermés depuis trente jours">
              {nombre(nettoyage.bilan.sujetsFermes)}
            </Ligne>
            <Ligne label="Comptes concernés">
              {nettoyage.comptesTouches}
              <span className="font-light text-gris">
                {" "}
                / {nettoyage.comptes}
              </span>
            </Ligne>
          </ListPanel>
          <p className="mt-3 px-4 text-[12.5px] leading-[17px] font-light text-gris">
            {NETTOYAGE_ACTIF
              ? "Ce que le passage de demain matin retirera. Ce qu'un sujet porte reste ; un sujet validé ne s'efface jamais."
              : "Ce que le nettoyage retirerait s'il était armé. Rien n'est effacé tant qu'il est à l'arrêt."}
          </p>
        </section>

        <RepartitionDesPieces mesure={mesure} />

        <section>
          <ZoneHeading label="Par compte" hint="du plus lourd au plus léger" />
          {parCompte.length ? (
            <ListPanel>
              {parCompte.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/comptes/${c.id}`}
                  data-list-row
                  className="flex items-center justify-between gap-3 border-b border-(--filet) px-4 py-2.5 active:bg-(--fond-puce)"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14.5px] font-medium text-noir">
                      {c.nom}
                    </div>
                    <div className="truncate text-[12.5px] font-normal text-gris">
                      {compte(c.poids.pieces, "fichier", "fichiers")}
                      {bucket?.parCompte[c.id]
                        ? ` · ${octets(bucket.parCompte[c.id]!.octets)} au bucket`
                        : ""}
                      {` · ${pourcentDuQuota(partDuQuota(c.poids.octets, mesure.quotaOctets))} % du quota`}
                    </div>
                  </div>
                  <span className="chiffre flex-none text-right text-[14px] font-normal text-noir">
                    {octets(c.poids.octets)}
                    <span className="font-light text-gris">
                      {" "}
                      · {partDe(c.poids.octets, total)}
                    </span>
                  </span>
                </Link>
              ))}
            </ListPanel>
          ) : (
            <p className="px-4 text-[14px] font-light text-gris">
              Aucune pièce stockée.
            </p>
          )}
        </section>
      </div>
    </Screen>
  );
}
