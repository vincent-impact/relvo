import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ListPanel } from "@/components/shared/list-panel";
import { ZoneHeading } from "@/components/shared/zone-heading";
import {
  FAMILLES,
  LIBELLE_FAMILLE,
  compte,
  niveauDuStockage,
  nombre,
  octets,
  partDe,
  type Poids,
} from "@/lib/stockage";
import {
  mesureDuStockage,
  type MesureDuStockage,
} from "@/server/stockage-mesure";
import { cn } from "@/lib/utils";
import { depuis } from "./format";
import { JaugePlafond } from "./jauge-plafond";
import { Ligne } from "./ligne";

// LE STOCKAGE AU BACKOFFICE (M25.1) — trois vues d'une même mesure
// (`server/stockage-mesure.ts`) : la carte de la vue d'ensemble (le poids
// contre le repère, en alerte comme le plafond de l'inférence), le détail de
// la page Stockage, et la section d'une fiche de compte. Le poids affiché en
// tête est celui du BUCKET — ce que le fournisseur stocke et facture ; à
// défaut de pouvoir le lire, celui que la base connaît, et la carte le dit.
//
// Lister le bucket prend quelques secondes quand la lecture gardée a expiré :
// sur la vue d'ensemble et la fiche d'un compte, le stockage ARRIVE APRÈS le
// reste de la page (`…EnDirect`, sous un `Suspense`) — il ne la retient pas.

const CADRE =
  "mx-4 block overflow-hidden rounded-(--rayon-carte) border border-(--filet) bg-white shadow-carte";

/** Ce qui tient la place pendant que le bucket se lit. */
export function StockageEnLecture() {
  return (
    <div className={CADRE}>
      <p className="px-4 py-3.5 text-[14px] font-light text-gris">
        Lecture du stockage…
      </p>
    </div>
  );
}

/** La carte de la vue d'ensemble, qui va chercher sa mesure elle-même. */
export async function CarteStockageEnDirect({ now }: { now: Date }) {
  return <CarteStockage mesure={await mesureDuStockage()} now={now} lien />;
}

/** La section d'une fiche de compte, qui va chercher sa mesure elle-même. */
export async function StockageDuCompteEnDirect({
  accountId,
}: {
  accountId: string;
}) {
  return (
    <StockageDuCompte
      accountId={accountId}
      mesure={await mesureDuStockage(accountId)}
    />
  );
}

/** « 1 234 pièces · 2,3 Go » */
function poids(p: Poids, mot: [string, string] = ["pièce", "pièces"]) {
  return (
    <>
      {octets(p.octets)}
      <span className="font-light text-gris">
        {" "}
        · {compte(p.pieces, mot[0], mot[1])}
      </span>
    </>
  );
}

/** « 2,3 Go · 28 % » */
function poidsEtPart(p: Poids, total: number) {
  return (
    <>
      {octets(p.octets)}
      <span className="font-light text-gris"> · {partDe(p.octets, total)}</span>
    </>
  );
}

/** La carte « poids contre repère », avec sa jauge. `lien` la rend cliquable vers le détail. */
export function CarteStockage({
  mesure,
  now,
  lien,
}: {
  mesure: MesureDuStockage;
  now: Date;
  lien?: boolean;
}) {
  const { bucket, pieces, connaissances, repereOctets } = mesure;
  const stocke =
    bucket?.total.octets ?? pieces.total.octets + connaissances.octets;
  const niveau = niveauDuStockage(stocke, repereOctets);
  const carte = (
    <div className="px-4 pt-3.5 pb-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-light text-gris">
          Stockage, contre le repère
        </span>
        <span
          className={cn(
            "chiffre text-[15px] font-medium",
            niveau.alerte ? "text-urgent" : "text-noir",
          )}
        >
          {octets(stocke)}
          <span className="font-light text-gris">
            {" "}
            / {octets(repereOctets)}
          </span>
        </span>
      </div>
      <JaugePlafond
        pct={niveau.pct}
        urgent={niveau.alerte}
        label="Part du repère de stockage occupée"
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-3 text-[12px] leading-4 font-normal text-gris">
        <span>{niveau.pct} % du repère</span>
        {bucket ? (
          <>
            <span>{compte(bucket.total.objets, "fichier", "fichiers")}</span>
            <span
              className={cn(
                bucket.sansProprietaire.objets > 0 && "text-urgent",
              )}
            >
              {nombre(bucket.sansProprietaire.objets)} sans propriétaire
            </span>
            <span>lu {depuis(new Date(bucket.luLe), now)}</span>
          </>
        ) : (
          <span className="text-(--attente)">
            bucket illisible — poids d&apos;après la base
          </span>
        )}
        {lien ? (
          <span className="ml-auto flex items-center gap-0.5 text-relvo">
            Détail
            <ChevronRight className="size-3.5" />
          </span>
        ) : null}
      </div>
    </div>
  );
  return lien ? (
    <Link href="/admin/stockage" className={cn(CADRE, "active:opacity-80")}>
      {carte}
    </Link>
  ) : (
    <div className={CADRE}>{carte}</div>
  );
}

/** Ce qui tient les pièces, par type, par canal — commun à la page Stockage et à la fiche d'un compte. */
export function RepartitionDesPieces({ mesure }: { mesure: MesureDuStockage }) {
  const { pieces, connaissances } = mesure;
  const total = pieces.total.octets;
  return (
    <>
      <section>
        <ZoneHeading label="Ce qui tient les pièces" hint="d'après la base" />
        <ListPanel>
          <Ligne label="Portées par un sujet">
            {poidsEtPart(pieces.tenues, total)}
          </Ligne>
          <Ligne label="Sans sujet">{poidsEtPart(pieces.libres, total)}</Ligne>
          <Ligne
            label="Dans une conversation ignorée"
            tone={pieces.ignorees.pieces ? "attente" : undefined}
          >
            {poidsEtPart(pieces.ignorees, total)}
          </Ligne>
        </ListPanel>
        {/* Ce que « décider avant de télécharger » a épargné (M25.3) : hors
            des totaux ci-dessus, puisque rien n'en est stocké. */}
        <p className="mt-3 px-4 text-[12.5px] leading-[17px] font-light text-gris">
          {pieces.references.pieces
            ? `${compte(pieces.references.pieces, "pièce gardée", "pièces gardées")} en référence, non stockées : ${octets(pieces.references.octets)} annoncés par leur source.`
            : "Aucune pièce gardée en référence pour l'instant : tout ce qui est compté ici est stocké."}
        </p>
      </section>

      <section>
        <ZoneHeading label="Par type" />
        <ListPanel>
          {FAMILLES.map((f) => (
            <Ligne key={f} label={LIBELLE_FAMILLE[f]}>
              {poidsEtPart(pieces.parFamille[f], total)}
            </Ligne>
          ))}
        </ListPanel>
      </section>

      <section>
        <ZoneHeading label="Par canal" />
        <ListPanel>
          <Ligne label="WhatsApp">
            {poidsEtPart(pieces.parCanal.whatsapp, total)}
          </Ligne>
          <Ligne label="E-mail">
            {poidsEtPart(pieces.parCanal.email, total)}
          </Ligne>
          <Ligne label="Connaissances déposées">
            {poids(
              { pieces: connaissances.fichiers, octets: connaissances.octets },
              ["fichier", "fichiers"],
            )}
          </Ligne>
        </ListPanel>
      </section>
    </>
  );
}

/** La section « Stockage » d'une fiche de compte : son poids, ce que le bucket porte pour lui, et où il part. */
export function StockageDuCompte({
  accountId,
  mesure,
}: {
  accountId: string;
  mesure: MesureDuStockage;
}) {
  const { pieces, connaissances, bucket } = mesure;
  const total = pieces.total.octets;
  const auBucket = bucket?.parCompte[accountId];
  const plusLourdes = FAMILLES.filter((f) => pieces.parFamille[f].pieces > 0)
    .sort((a, b) => pieces.parFamille[b].octets - pieces.parFamille[a].octets)
    .slice(0, 3);
  return (
    <section>
      <ZoneHeading label="Stockage" hint="pièces et connaissances" />
      <ListPanel>
        <Ligne label="Pièces jointes">{poids(pieces.total)}</Ligne>
        <Ligne label="Dans le bucket">
          {bucket ? (
            <>
              {octets(auBucket?.octets ?? 0)}
              <span className="font-light text-gris">
                {" "}
                · {compte(auBucket?.objets ?? 0, "fichier", "fichiers")}
              </span>
            </>
          ) : (
            "illisible"
          )}
        </Ligne>
        <Ligne label="Sans sujet">{poidsEtPart(pieces.libres, total)}</Ligne>
        <Ligne
          label="Dans une conversation ignorée"
          tone={pieces.ignorees.pieces ? "attente" : undefined}
        >
          {poidsEtPart(pieces.ignorees, total)}
        </Ligne>
        <Ligne label="WhatsApp · e-mail">
          {octets(pieces.parCanal.whatsapp.octets)}
          <span className="font-light text-gris"> · </span>
          {octets(pieces.parCanal.email.octets)}
        </Ligne>
        <Ligne label="Les plus lourds">
          {plusLourdes.length
            ? plusLourdes
                .map(
                  (f) =>
                    `${LIBELLE_FAMILLE[f]} ${octets(pieces.parFamille[f].octets)}`,
                )
                .join(" · ")
            : "—"}
        </Ligne>
        {connaissances.fichiers ? (
          <Ligne label="Connaissances déposées">
            {poids(
              { pieces: connaissances.fichiers, octets: connaissances.octets },
              ["fichier", "fichiers"],
            )}
          </Ligne>
        ) : null}
      </ListPanel>
    </section>
  );
}
