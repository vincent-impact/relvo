import "server-only";
import { after } from "next/server";
import {
  additionnerBilans,
  bilanEstVide,
  bilanVide,
  drainFileDeletions,
  listComptesANettoyer,
  nettoyerLeCompte,
  simulerLeNettoyage,
  tenantDb,
  type BilanNettoyage,
} from "@relvo/db";
import { getStorage } from "@relvo/storage";
import { NETTOYAGE_ACTIF } from "@/lib/nettoyage";
import { expireTenantData } from "@/server/cached";

// LE NETTOYAGE, CÔTÉ APPLICATION (`@relvo/db`, `domain/nettoyage.ts` pour les
// règles). Deux choses vivent ici :
//
//   · le PASSAGE QUOTIDIEN, que le cron du matin lance : compte par compte,
//     effacer les sujets fermés depuis trente jours et ce qu'aucun sujet ne
//     porte depuis trente jours ; les fichiers partent ensuite par le drainage,
//     dans le même cron ;
//   · l'EFFACEMENT IMMÉDIAT des fichiers après une suppression délibérée (un
//     canal, un compte, une pièce) : la base est vidée dans le geste, et le
//     drainage est lancé aussitôt après la réponse — il n'attend pas le matin.
//
// ⚠️ `NETTOYAGE_ACTIF` (`lib/nettoyage.ts`) : tant qu'il est faux, le passage
// quotidien ne fait que SIMULER et écrit dans les traces ce qu'il retirerait.

export type PassageDuNettoyage = {
  /** Faux : rien n'a été écrit, le bilan est celui d'une simulation. */
  reel: boolean;
  comptes: number;
  /** Comptes où il y avait quelque chose à retirer. */
  comptesTouches: number;
  /** Comptes que le budget de temps a laissés au passage suivant. */
  restants: number;
  echecs: number;
  bilan: BilanNettoyage;
};

/**
 * Un passage du nettoyage sur tous les comptes, sous un budget de temps : un
 * compte commencé est fini, un compte non commencé attend le lendemain — rien
 * n'est perdu, ce qui a expiré le reste. `reel: false` simule.
 */
export async function passerLeNettoyage(opts: {
  budgetMs: number;
  reel?: boolean;
  now?: Date;
}): Promise<PassageDuNettoyage> {
  const debut = Date.now();
  const now = opts.now ?? new Date();
  const reel = opts.reel ?? NETTOYAGE_ACTIF;
  const comptes = await listComptesANettoyer();
  const passage: PassageDuNettoyage = {
    reel,
    comptes: comptes.length,
    comptesTouches: 0,
    restants: 0,
    echecs: 0,
    bilan: bilanVide(),
  };
  for (const accountId of comptes) {
    if (Date.now() - debut > opts.budgetMs) {
      passage.restants += 1;
      continue;
    }
    try {
      const db = tenantDb(accountId);
      const bilan = reel
        ? await nettoyerLeCompte(db, accountId, now)
        : await simulerLeNettoyage(db, now);
      if (!bilanEstVide(bilan)) passage.comptesTouches += 1;
      passage.bilan = additionnerBilans(passage.bilan, bilan);
    } catch (e) {
      // Un compte en erreur ne prive pas les autres de leur nettoyage.
      passage.echecs += 1;
      console.error("[nettoyage] compte non nettoyé", { accountId }, e);
    }
  }
  if (reel && passage.comptesTouches > 0) expireTenantData();
  return passage;
}

/**
 * Après une SUPPRESSION délibérée : efface tout de suite du stockage les
 * fichiers que la base vient de lâcher, sans attendre le cron du matin. Après
 * la réponse (`after`) — le geste n'attend pas le stockage ; ce que ce budget
 * ne finit pas, le matin le finit.
 */
export function effacerLesFichiersSupprimes(): void {
  after(async () => {
    try {
      const drainage = await drainFileDeletions(getStorage(), {
        budgetMs: 45_000,
      });
      console.info("[nettoyage] fichiers effacés après suppression", drainage);
    } catch (e) {
      console.error("[nettoyage] drainage après suppression interrompu", e);
    }
  });
}
