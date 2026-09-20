// Table de tarifs VERSIONNÉE — jetons → euros (M7, tranche 0).
//
// « La mesure est en euros, pas en jetons » (`05 §10.6`) : chaque sollicitation
// consigne son coût converti au moment de l'appel, ce qui survit à un changement
// de modèle ou de tarif. La version de la table est consignée avec le coût pour
// qu'un chiffre puisse toujours être rejoué.
//
// Prix relevés sur la page tarifaire d'OpenAI, consignés dans
// `backlog/benchmark-iag.md` §2.
// Le taux de change vient de `scripts/cout-iag.py` — les deux DOIVENT bouger
// ensemble, c'est ce que le test de tarifs vérifie.

import type { NiveauRaisonnement, Tier } from "./config";

/** Date du relevé. À incrémenter à CHAQUE changement de prix ou de taux. */
export const TARIFS_VERSION = "2026-09-20";

/**
 * Remise du niveau de service « flex » (appel EN LOT, `05 §10.5`) : entrée,
 * cache et sortie à moitié prix, contre une latence libre. Relevée sur la page
 * tarifaire du fournisseur avec les prix ci-dessous.
 */
export const FACTEUR_LOT = 0.5;

/** BCE, 11/09/2026 — même valeur que `scripts/cout-iag.py`. */
export const USD_PAR_EUR = 1.1592;

/** USD par MILLION de jetons. */
export type Tarif = {
  entree: number;
  /** Lecture d'un préfixe déjà en cache. */
  cacheLecture: number;
  /**
   * Écriture en cache. Chez OpenAI le cache est implicite et l'écriture n'a pas
   * de surcoût : les jetons écrits sont facturés au tarif d'entrée normal.
   */
  cacheEcriture: number;
  /** Sortie — les jetons de RAISONNEMENT sont facturés à ce tarif. */
  sortie: number;
  /**
   * Au-delà de ce nombre de jetons d'entrée, les tarifs sont multipliés
   * (×2 en entrée, ×1,5 en sortie chez OpenAI). Relvo n'a aucune raison d'y
   * arriver ; le plafond est là pour que le compteur reste juste si ça arrive.
   */
  longContexte?: { seuil: number; entree: number; sortie: number };
};

const LONG_CONTEXTE_OPENAI = { seuil: 272_000, entree: 2, sortie: 1.5 };

export const TARIFS: Readonly<Record<string, Tarif>> = {
  "gpt-5.6-luna": {
    entree: 0.2,
    cacheLecture: 0.02,
    cacheEcriture: 0.2,
    sortie: 1.2,
    longContexte: LONG_CONTEXTE_OPENAI,
  },
  "gpt-5.6-terra": {
    entree: 2.0,
    cacheLecture: 0.2,
    cacheEcriture: 2.0,
    sortie: 12.0,
    longContexte: LONG_CONTEXTE_OPENAI,
  },
};

/**
 * Consommation d'un appel, normalisée. Les jetons de raisonnement sont
 * COMPTÉS SÉPARÉMENT (`05 §10.5`) : c'est le compteur qui révèle un site
 * d'appel dont le niveau a dérivé, avant la facture. `sortie` les INCLUT
 * (c'est le total facturé au tarif de sortie) ; `raisonnement` en est la part.
 */
export type Consommation = {
  entree: number;
  cacheLecture: number;
  cacheEcriture: number;
  sortie: number;
  raisonnement: number;
};

export type Cout = {
  eur: number;
  usd: number;
  version: typeof TARIFS_VERSION;
};

export function tarifDuModele(modele: string): Tarif {
  const tarif = TARIFS[modele];
  if (!tarif) {
    throw new Error(
      `[ia] Aucun tarif pour le modèle « ${modele} » (table ${TARIFS_VERSION}). ` +
        "Un modèle sans tarif rend le compteur aveugle : ajouter la ligne dans " +
        "src/server/ia/tarifs.ts AVANT de l'affecter à un tier.",
    );
  }
  return tarif;
}

/** Coût d'un appel. Pur, sans arrondi : l'arrondi est un choix d'affichage. Un appel en lot vaut sa remise. */
export function estimerCout(
  modele: string,
  conso: Consommation,
  options: { lot?: boolean } = {},
): Cout {
  const t = tarifDuModele(modele);
  const totalEntree = conso.entree + conso.cacheLecture + conso.cacheEcriture;
  const long = t.longContexte && totalEntree > t.longContexte.seuil;
  const remise = options.lot ? FACTEUR_LOT : 1;
  const kEntree = (long ? t.longContexte!.entree : 1) * remise;
  const kSortie = (long ? t.longContexte!.sortie : 1) * remise;
  const usd =
    (conso.entree * t.entree * kEntree +
      conso.cacheLecture * t.cacheLecture * kEntree +
      conso.cacheEcriture * t.cacheEcriture * kEntree +
      conso.sortie * t.sortie * kSortie) /
    1_000_000;
  return { usd, eur: usd / USD_PAR_EUR, version: TARIFS_VERSION };
}

/**
 * Ce qu'une sollicitation consigne dans le journal (`02`, conventions
 * d'`EventLog` posées en tranche 2). Défini ici pour que le pipeline et le banc
 * d'essai écrivent la même chose.
 */
export type MesureSollicitation = {
  sollicitation: string;
  tier: Tier;
  modele: string;
  niveau: NiveauRaisonnement;
  jetons: Consommation;
  cout: Cout;
  dureeMs: number;
  /** Identifiant de réponse OpenAI, pour retrouver l'appel dans les journaux du fournisseur. */
  reponseId?: string;
  /** Appel EN LOT — niveau de service « flex », coût remisé (`FACTEUR_LOT`). */
  lot?: boolean;
  /**
   * Jetons (estimés) du PRÉFIXE STABLE poussé — ce que le cache de prompt
   * aurait dû relire : couche Produit, couche Compte, couche Domaine (05
   * §10.1). Confronté à `jetons.cacheLecture`, c'est ce qui rend un cache
   * silencieusement cassé visible dans le journal (M7.13). Null quand le site
   * d'appel ne l'a pas mesuré.
   */
  prefixeStable?: number | null;
};
