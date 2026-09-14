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
  jetonsSortie: {
    classification: 200,
    extraction: 2_000,
    redaction: 1_500,
    raisonnement: 4_000,
  } satisfies Record<Tier, number>,
  /** Allers-retours au modèle par tour d'échange (`05 §11.8`). */
  etapesParTour: 6,
} as const;

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
