import "server-only";
import {
  type BilanDeDeduplication,
  dedoublonnerLeCompte,
  listComptesANettoyer,
} from "@relvo/db";

// LE FILET DE LA DÉDUPLICATION, CÔTÉ APPLICATION (M25.8) — le cron du matin
// le passe, compte par compte. Les règles sont dans le domaine
// (`domain/deduplication.ts`) : un fichier est dédoublonné à l'entrée, ce
// passage ne rattrape que ce qui s'est croisé. Il ne lit que la base ; les
// fichiers qu'il lâche partent au drainage qui le suit dans le même cron.

export type PassageDeLaDeduplication = {
  comptes: number;
  /** Comptes où il y avait quelque chose à rapprocher. */
  comptesTouches: number;
  echecs: number;
  bilan: BilanDeDeduplication;
};

export async function passerLaDeduplication(): Promise<PassageDeLaDeduplication> {
  const comptes = await listComptesANettoyer();
  const passage: PassageDeLaDeduplication = {
    comptes: comptes.length,
    comptesTouches: 0,
    echecs: 0,
    bilan: { piecesRepointees: 0, fichiersLiberes: 0, octetsLiberes: 0 },
  };
  for (const accountId of comptes) {
    try {
      const b = await dedoublonnerLeCompte(accountId);
      if (b.fichiersLiberes > 0) passage.comptesTouches += 1;
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
