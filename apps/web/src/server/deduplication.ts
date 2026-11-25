import "server-only";
import {
  type BilanDeDeduplication,
  type ObjetStocke,
  dedoublonnerLeCompte,
  listComptesANettoyer,
} from "@relvo/db";
import { getStorage } from "@relvo/storage";

// LA DÉDUPLICATION DU STOCK, CÔTÉ APPLICATION (M25.8) — pour le backoffice
// seulement, derrière `requireAdmin`. Les règles sont dans le domaine
// (`domain/deduplication.ts`) ; ce module lit le bucket chez le fournisseur
// (par le paquet de stockage, jamais autrement — PITFALLS #8) et passe compte
// par compte.
//
// ⚠️ Le bucket est relu À NEUF, jamais depuis la lecture gardée du backoffice :
// on ne fait pointer une pièce que vers un fichier qu'on vient de voir. Et un
// listing coupé à son plafond arrête tout : ce qu'on n'a pas vu ne se
// rapproche pas.

export type DeduplicationDuStock = {
  /** Faux : rien n'a été écrit, le bilan est celui d'une simulation. */
  reel: boolean;
  comptes: number;
  comptesTouches: number;
  echecs: number;
  bilan: BilanDeDeduplication;
};

export async function dedoublonnerLeStock(opts: {
  simuler: boolean;
}): Promise<DeduplicationDuStock> {
  const listing = await getStorage().list();
  if (!listing.complete) {
    throw new Error(
      "Le listing du bucket a été coupé à son plafond : la déduplication ne part pas sur une vue partielle.",
    );
  }
  const bucket = new Map<string, ObjetStocke>(
    listing.objects.map((o) => [o.key, { etag: o.etag, size: o.size }]),
  );
  const comptes = await listComptesANettoyer();
  const passage: DeduplicationDuStock = {
    reel: !opts.simuler,
    comptes: comptes.length,
    comptesTouches: 0,
    echecs: 0,
    bilan: {
      empreintesNotees: 0,
      piecesRepointees: 0,
      fichiersLiberes: 0,
      octetsLiberes: 0,
    },
  };
  for (const accountId of comptes) {
    try {
      const b = await dedoublonnerLeCompte(accountId, bucket, {
        simuler: opts.simuler,
      });
      if (b.fichiersLiberes > 0) passage.comptesTouches += 1;
      passage.bilan.empreintesNotees += b.empreintesNotees;
      passage.bilan.piecesRepointees += b.piecesRepointees;
      passage.bilan.fichiersLiberes += b.fichiersLiberes;
      passage.bilan.octetsLiberes += b.octetsLiberes;
    } catch (e) {
      // Un compte en erreur ne prive pas les autres : sa transaction est
      // annulée en entier, rien n'y est à moitié fait.
      passage.echecs += 1;
      console.error("[deduplication] compte non dédoublonné", { accountId }, e);
    }
  }
  return passage;
}
