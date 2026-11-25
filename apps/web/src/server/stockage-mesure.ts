import "server-only";
import { unstable_cache } from "next/cache";
import {
  listClesDuStockage,
  mesurerLesConnaissances,
  mesurerLesPieces,
} from "@relvo/db";
import { getStorage, ownerOfObjectKey } from "@relvo/storage";
import { quotaDuCompte } from "@/server/depot";
import {
  REPERE_STOCKAGE_GO,
  rapprocherLeBucket,
  resumerLesPieces,
  type EtatDuBucket,
  type ResumeDesPieces,
} from "@/lib/stockage";

// LA MESURE DU STOCKAGE, ASSEMBLÉE (M25.1) — pour le backoffice seulement,
// derrière `requireAdmin`. Deux lectures, rapprochées :
//
//   · la BASE dit ce que les pièces pèsent, par compte, canal, type, et ce qui
//     les tient (`mesurerLesPieces`) — instantané, à chaque rendu ;
//   · le BUCKET, lu chez le fournisseur par le paquet de stockage (`list`),
//     dit ce qui est réellement stocké et facturé. Le lister coûte une requête
//     par millier d'objets : il est gardé un quart d'heure, et le backoffice
//     dit quand il a été lu. « Relire » le périme.
//
// Ce que le bucket porte et que la base ne connaît plus — ni en pièce, ni en
// file de suppression — est ce qu'un effacement a laissé : zéro est la preuve
// que la file vide le bucket (S16). Aucun accès direct au stockage : tout passe
// par `@relvo/storage` (PITFALLS #8).

export const TAG_BUCKET = "admin-bucket";

const lireLeBucket = unstable_cache(
  async (): Promise<EtatDuBucket> => {
    const [listing, cles] = await Promise.all([
      getStorage().list(),
      listClesDuStockage(),
    ]);
    return rapprocherLeBucket({
      objets: listing.objects,
      complet: listing.complete,
      connues: cles.connues,
      enAttente: cles.enAttente,
      compteDe: (key) => ownerOfObjectKey(key)?.accountId ?? null,
      luLe: new Date(),
    });
  },
  ["admin-bucket-v2"],
  { revalidate: 15 * 60, tags: [TAG_BUCKET] },
);

/** L'état du bucket, ou `null` quand le fournisseur ne répond pas — le backoffice le dit, il ne tombe pas. */
export async function etatDuBucket(): Promise<EtatDuBucket | null> {
  try {
    return await lireLeBucket();
  } catch (e) {
    console.error("[admin] bucket illisible", e);
    return null;
  }
}

/** Le repère du stockage, en octets : une configuration (`STOCKAGE_REPERE_GO`), par défaut le palier offert. */
export function repereDuStockage(): number {
  const go = Number(process.env.STOCKAGE_REPERE_GO) || REPERE_STOCKAGE_GO;
  return go * 1024 ** 3;
}

export type MesureDuStockage = {
  pieces: ResumeDesPieces;
  connaissances: { fichiers: number; octets: number };
  bucket: EtatDuBucket | null;
  repereOctets: number;
  /** Le quota d'UN compte (M25.7), en octets. */
  quotaOctets: number;
};

/** Toute la mesure — de tous les comptes, ou d'un seul. Le bucket, lui, est toujours lu en entier. */
export async function mesureDuStockage(
  accountId?: string,
): Promise<MesureDuStockage> {
  const [lignes, connaissances, bucket] = await Promise.all([
    mesurerLesPieces(accountId),
    mesurerLesConnaissances(accountId),
    etatDuBucket(),
  ]);
  return {
    pieces: resumerLesPieces(lignes),
    connaissances: connaissances.reduce(
      (s, k) => ({
        fichiers: s.fichiers + k.fichiers,
        octets: s.octets + k.octets,
      }),
      { fichiers: 0, octets: 0 },
    ),
    bucket,
    repereOctets: repereDuStockage(),
    quotaOctets: quotaDuCompte(),
  };
}
