// Configuration de l'inférence (M7, tranche 0) — le SEUL endroit du code qui
// nomme un modèle.
//
// `conception/05-ia.md` §10.5 définit des TIERS par ce qu'ils exigent, jamais
// par un nom de modèle ; l'affectation concrète modèle ↔ tier est une donnée de
// configuration, et le raisonnement qui l'a fixée vit dans
// `backlog/benchmark-iag.md` §6.1 (pile 100 % OpenAI, entrée de gamme partout
// sauf sur le raisonnement). Changer de modèle = changer une variable
// d'environnement, jamais un site d'appel.
//
// Les identifiants sont ceux de l'API OpenAI, appelée EN DIRECT (pas de
// passerelle : `backlog/ecarts-et-propositions.md`, « Pas de passerelle
// d'inférence »).

/**
 * Les tiers de `05 §10.5`. La transcription (messages vocaux) n'a pas de tier
 * ici : son fournisseur reste à benchmarker (`ecarts-et-propositions.md`,
 * « Benchmarker la transcription vocale et la vision »).
 */
export type Tier =
  | "classification"
  | "extraction"
  | "redaction"
  | "raisonnement";

/**
 * Niveau de raisonnement — POSÉ EXPLICITEMENT à chaque site d'appel, jamais
 * laissé au défaut (`05 §10.5`, `benchmark-iag.md` §6.1 bis) : le défaut de
 * l'API est `medium`, qui multiplie la facture par 2,2 et dégrade la latence.
 * Les valeurs `xhigh` / `max` du fournisseur sont volontairement absentes :
 * aucun poste de Relvo ne les justifie.
 */
export type NiveauRaisonnement = "none" | "low" | "medium" | "high";

export const NIVEAUX_RAISONNEMENT: readonly NiveauRaisonnement[] = [
  "none",
  "low",
  "medium",
  "high",
];

/**
 * Niveau retenu par tier (`benchmark-iag.md` §6.1 bis). Ce n'est PAS un défaut
 * appliqué en silence : c'est la valeur que les sites d'appel sont censés
 * passer, et que le banc d'essai fait varier. Le client refuse un appel sans
 * niveau.
 */
export const NIVEAU_RETENU: Readonly<Record<Tier, NiveauRaisonnement>> = {
  classification: "none",
  extraction: "low",
  redaction: "low",
  raisonnement: "medium",
};

/** Affectation par défaut, surchargée par l'environnement (cf. `.env.example`). */
const MODELE_PAR_DEFAUT: Readonly<Record<Tier, string>> = {
  classification: "gpt-5.6-luna",
  extraction: "gpt-5.6-luna",
  redaction: "gpt-5.6-luna",
  raisonnement: "gpt-5.6-terra",
};

const VARIABLE_PAR_TIER: Readonly<Record<Tier, string>> = {
  classification: "RELVO_IA_MODELE_CLASSIFICATION",
  extraction: "RELVO_IA_MODELE_EXTRACTION",
  redaction: "RELVO_IA_MODELE_REDACTION",
  raisonnement: "RELVO_IA_MODELE_RAISONNEMENT",
};

/** Le modèle (identifiant OpenAI) affecté à un tier. */
export function modeleDuTier(
  tier: Tier,
  env: Record<string, string | undefined> = process.env,
): string {
  const surcharge = env[VARIABLE_PAR_TIER[tier]]?.trim();
  return surcharge || MODELE_PAR_DEFAUT[tier];
}

export const TIERS: readonly Tier[] = [
  "classification",
  "extraction",
  "redaction",
  "raisonnement",
];

/**
 * Plafonds par appel (`05 §10.6`, « par appel et par tour ») — jetons de sortie
 * bornés par défaut, surchargeables par site d'appel ; nombre d'allers-retours
 * d'outils borné par tour d'échange.
 */
export const PLAFONDS = {
  /**
   * Jetons de SORTIE, raisonnement compris — c'est ainsi que le fournisseur
   * compte. Atteindre le plafond est un ÉCHEC explicite (`EchecSollicitation`,
   * motif « plafond-sortie »), jamais une sortie tronquée exploitée : une
   * structuration coupée en plein JSON n'écrit rien, un brouillon coupé en
   * pleine phrase n'est pas posé dans le composer.
   */
  jetonsSortie: {
    classification: 200,
    extraction: 3_000,
    redaction: 1_500,
    raisonnement: 4_000,
  } satisfies Record<Tier, number>,
  /**
   * Jetons d'ENTRÉE (estimés, `estimerJetons`) — vérifiés AVANT l'appel, donc
   * à zéro jeton : un contexte qui déborde est refusé et journalisé, pas payé.
   * Ces plafonds sont larges par rapport aux budgets par couche (`BUDGETS`,
   * tenus par un test sur une fixture pire que la réalité) : ils attrapent ce
   * que les budgets ne voient pas — un compte aux instructions démesurées, un
   * fil hors norme —, pas le cas nominal.
   */
  jetonsEntree: {
    classification: 8_000,
    extraction: 24_000,
    redaction: 24_000,
    raisonnement: 60_000,
  } satisfies Record<Tier, number>,
  /** Allers-retours au modèle par tour d'échange (`05 §11.8`). */
  etapesParTour: 6,
} as const;

/**
 * Rétention du cache de prompt chez le fournisseur (`05 §10.5`). « in_memory »
 * est le défaut du fournisseur, quelques minutes d'inactivité ; « 24h » garde
 * le préfixe stable d'un compte — couche Produit, couche Compte, couche
 * Domaine — d'un message au suivant, ce qui est le rythme réel d'une boîte
 * e-mail. Surchargeable par `RELVO_IA_CACHE_RETENTION` ; vide = « 24h ».
 */
export type RetentionCache = "in_memory" | "24h";

export function retentionCache(
  env: Record<string, string | undefined> = process.env,
): RetentionCache {
  const v = env.RELVO_IA_CACHE_RETENTION?.trim();
  return v === "in_memory" ? "in_memory" : "24h";
}

/**
 * Point d'entrée de l'API. Par défaut le point d'entrée standard : le projet
 * OpenAI de Relvo est « Global ». La résidence européenne n'est pas en
 * libre-service chez OpenAI (accord commercial + avenant de rétention) ; le
 * jour où elle est accordée, le projet se recrée et `OPENAI_BASE_URL` passe à
 * `https://eu.api.openai.com/v1` — sans toucher au code.
 */
export const OPENAI_BASE_URL_PAR_DEFAUT = "https://api.openai.com/v1";

export function openaiBaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.OPENAI_BASE_URL?.trim() || OPENAI_BASE_URL_PAR_DEFAUT;
}

/**
 * L'inférence est-elle joignable ? Sans `OPENAI_API_KEY`, le pipeline ne
 * tente rien : la conversation reste orpheline (`05 §10.6`, mode nominal de
 * la V1), et on économise l'aller-retour réseau qui finirait en 401.
 */
export function inferenceDisponible(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.OPENAI_API_KEY?.trim());
}

/**
 * Le RATTRAPAGE du courrier récent (M7.19, `05 §9.6`) : la fenêtre lue à la
 * connexion d'un canal, et les plafonds durs d'un rattrapage — en messages et
 * en euros —, au-delà desquels Relvo s'arrête et le dit. Arrêté avec le
 * dirigeant (`ecarts`, « Le rattrapage du courrier récent ») : trente jours
 * suffisent à voir les affaires en cours ; trois cents messages et deux euros
 * tiennent dans le plafond mensuel d'un compte même à plusieurs canaux. Le
 * tri du rattrapage passe au niveau de service « flex » du fournisseur —
 * moitié prix, sans latence exigée. Un message plus vieux que
 * `delaiWebhookMs` arrivant par le webhook est un message d'historique : il
 * est rangé mais laissé au rattrapage, jamais trié plein tarif à la volée.
 */
export const RATTRAPAGE = {
  fenetreJours: 30,
  plafondMessages: 300,
  plafondEuros: 2,
  /** Nuits au plus sur un même rattrapage : au-delà, ce qui reste est laissé à la main. */
  nuitsMax: 3,
  /** Un webhook plus ancien que ça est de l'historique synchronisé, pas du courrier vivant. */
  delaiWebhookMs: 6 * 60 * 60 * 1000,
  /** Messages lus par page chez l'agrégateur. */
  pageImport: 50,
  /** Conversations triées par salve, entre deux points d'avancement. */
  salveTri: 10,
} as const;
