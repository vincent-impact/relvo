import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import {
  generateText,
  NoObjectGeneratedError,
  Output,
  stepCountIs,
  streamText,
  type FinishReason,
  type FlexibleSchema,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  type ToolSet,
} from "ai";
import {
  modeleDuTier,
  NIVEAUX_RAISONNEMENT,
  openaiBaseUrl,
  PLAFONDS,
  retentionCache,
  type NiveauRaisonnement,
  type Tier,
} from "./config";
import { estimerJetons } from "./produit";
import {
  estimerCout,
  tarifDuModele,
  TARIFS_VERSION,
  type Consommation,
  type MesureSollicitation,
} from "./tarifs";

// Client d'inférence (M7, tranche 0) — l'abstraction « mince » à quatre
// méthodes de `conception/05-ia.md` §11.8 : `classify`, `extract`, `draft`,
// `chat`. Par-dessus l'AI SDK, vers l'API OpenAI EN DIRECT (API Responses,
// point d'entrée en configuration) — sans passerelle, aucun intermédiaire,
// aucun coût hors OpenAI.
//
// Ce n'est PAS un routeur multi-fournisseurs : un modèle par tier, en
// configuration (`./config`). Ce que le client garantit, et que rien d'autre ne
// garantit :
//   1. Aucun appel ne part sans niveau de raisonnement EXPLICITE (`05 §10.5`).
//      Le type l'exige, et le runtime le revérifie — un `as any` ou un JSON lu
//      d'ailleurs ne doit pas pouvoir passer.
//   2. Chaque appel revient avec sa consommation normalisée (raisonnement
//      compté séparément) et son coût en euros, table de tarifs versionnée.
//   3. Les plafonds par appel (`05 §10.6`, tranche 8) : l'ENTRÉE est bornée
//      AVANT l'appel — un contexte qui déborde est refusé à zéro jeton — et la
//      SORTIE est bornée par tier ; une sortie tronquée ou non conforme est un
//      ÉCHEC EXPLICITE (`EchecSollicitation`) qui porte la mesure de l'appel,
//      pour que le coût d'un appel raté soit journalisé comme les autres.
//   4. Le cache de prompt est ADRESSÉ (`05 §10.5`, tranche 8) : une clé par
//      compte route les appels d'un même compte vers le même cache, et la
//      rétention est celle de la configuration. Le site d'appel dit ce qu'il
//      attend du cache (`prefixeStable`) ; la mesure le rend.
//   5. Un appel EN LOT (`lot`, tranche 9) passe au niveau de service « flex »
//      du fournisseur : moitié prix, latence libre. Réservé à ce qui n'attend
//      personne — le rattrapage du courrier récent.
//
// Comme le client Unipile, c'est une intégration de l'APPLICATION : rien ici
// n'appartient à `packages/`. La garde `server-only` est posée sur `./index`,
// l'entrée que l'application importe ; ce fichier reste importable par les
// scripts d'évaluation (`scripts/evaluation/`), qui tournent hors Next. Sans configuration (`inferenceDisponible()`
// faux), le pipeline ne tente rien — la conversation reste orpheline, mode
// nominal de la V1.

/**
 * Identifiant d'une sollicitation, tel qu'il sera consigné dans le journal
 * (`02`, conventions posées en tranche 2). Les codes courts du benchmark (A1,
 * A7, C1…) sont en commentaire : ce sont eux qui apparaissent dans
 * `benchmark-iag.md` et `scripts/cout-iag.py`.
 */
export type Sollicitation =
  | "tri" // A1–A6 : verdict sur une conversation orpheline
  | "structuration" // A2–A6 : situation, tâches, contact d'un sujet nouveau
  | "relecture" // A7 : message entrant sur un sujet suivi
  | "etiquette-piece-jointe" // A9
  | "brouillon" // B1
  | "resume-piece-jointe" // B2
  | "analyse-piece-jointe" // B3
  | "ingestion-connaissances" // B4
  | "echange" // C1
  | "titre-echange" // C2
  | "banc-essai"; // M7.17, hors production

type Entree = { system?: string } & (
  | { prompt: string; messages?: never }
  | { messages: ModelMessage[]; prompt?: never }
);

type OptionsCommunes = Entree & {
  sollicitation: Sollicitation;
  /** OBLIGATOIRE. Cf. `NIVEAU_RETENU` dans `./config` pour la valeur attendue par tier. */
  reasoning: NiveauRaisonnement;
  /** Surcharge du plafond par défaut du tier. */
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
  /**
   * Clé de cache du fournisseur (`05 §10.5`) : l'identifiant du compte. Les
   * appels d'un même compte partagent leur préfixe — Produit, Compte,
   * Domaine — et la clé les route vers le même cache. Sans clé, le
   * fournisseur route au hasard et le cache se gagne moins.
   */
  cacheCle?: string;
  /**
   * Jetons (estimés) du préfixe stable poussé — ce que le cache aurait dû
   * relire. Rendu tel quel dans la mesure, pour le journal (M7.13).
   */
  prefixeStable?: number;
  /**
   * Appel EN LOT (`05 §10.5`) : sans latence exigée, le niveau de service
   * « flex » du fournisseur — moitié prix, file d'attente possible. Le
   * rattrapage du courrier récent (M7.19) passe par là ; jamais un appel qui
   * fait attendre l'utilisateur.
   */
  lot?: boolean;
  /**
   * Jeu d'évaluation (M7.17) et tests uniquement : impose un modèle —
   * identifiant OpenAI pour comparer plusieurs modèles, ou modèle simulé de
   * `ai/test`. En production, le modèle vient du tier.
   */
  modele?: LanguageModel;
};

type OptionsObjet<T> = OptionsCommunes & {
  schema: FlexibleSchema<T>;
  nomSchema?: string;
};

export type ResultatIa<T> = {
  sortie: T;
  mesure: MesureSollicitation;
};

/**
 * Refus d'un appel sans niveau (ou avec un niveau hors gamme). Le message est
 * volontairement long : c'est une erreur de programmation, pas une erreur
 * d'exécution, et elle doit dire quoi corriger.
 */
export class NiveauRaisonnementManquant extends Error {
  constructor(sollicitation: string, recu: unknown) {
    super(
      `[ia] Sollicitation « ${sollicitation} » sans niveau de raisonnement explicite (reçu : ${JSON.stringify(recu)}). ` +
        `Le défaut de l'API est « medium », qui multiplie la facture par 2,2 (05 §10.5). ` +
        `Passer reasoning: ${NIVEAUX_RAISONNEMENT.map((n) => `"${n}"`).join(" | ")}.`,
    );
    this.name = "NiveauRaisonnementManquant";
  }
}

/**
 * Pourquoi une sollicitation a échoué SANS rien produire d'exploitable :
 *   • `entree-trop-longue` — refusée avant l'appel, zéro jeton ;
 *   • `plafond-sortie` — le modèle a atteint le plafond de jetons de sortie :
 *     la sortie est tronquée, on ne l'exploite pas ;
 *   • `sortie-non-conforme` — la sortie ne respecte pas le schéma (ce que le
 *     mode strict du fournisseur est censé empêcher : à surveiller).
 */
export type MotifEchec =
  | "entree-trop-longue"
  | "plafond-sortie"
  | "sortie-non-conforme";

/**
 * Un appel qui a échoué de façon PRÉVUE (M7.15, tranche 8). Porte la MESURE
 * de l'appel quand il a eu lieu — un appel dont la sortie est tronquée a coûté
 * ses jetons, et ce coût doit être journalisé comme les autres —, et null
 * quand il a été refusé avant de partir.
 */
export class EchecSollicitation extends Error {
  readonly motif: MotifEchec;
  readonly sollicitation: Sollicitation;
  readonly mesure: MesureSollicitation | null;
  constructor(args: {
    motif: MotifEchec;
    sollicitation: Sollicitation;
    detail: string;
    mesure: MesureSollicitation | null;
    cause?: unknown;
  }) {
    super(
      `[ia] Sollicitation « ${args.sollicitation} » : ${args.motif} — ${args.detail}`,
      args.cause instanceof Error ? { cause: args.cause } : undefined,
    );
    this.name = "EchecSollicitation";
    this.motif = args.motif;
    this.sollicitation = args.sollicitation;
    this.mesure = args.mesure;
  }
}

function exigerNiveau(
  sollicitation: string,
  niveau: unknown,
): NiveauRaisonnement {
  if (
    typeof niveau !== "string" ||
    !(NIVEAUX_RAISONNEMENT as readonly string[]).includes(niveau)
  ) {
    throw new NiveauRaisonnementManquant(sollicitation, niveau);
  }
  return niveau as NiveauRaisonnement;
}

// Fournisseur instancié au premier appel, jamais à l'import (même règle que le
// client Unipile et `getStorage()` : `next build` tourne sans les variables
// runtime). La clé vient d'`OPENAI_API_KEY`, lue par le SDK.
let fournisseur: OpenAIProvider | undefined;
function openai(): OpenAIProvider {
  return (fournisseur ??= createOpenAI({ baseURL: openaiBaseUrl() }));
}

/**
 * Résout le modèle d'un appel et vérifie qu'il a un tarif AVANT l'appel : un
 * modèle sans tarif rend le compteur aveugle, on préfère échouer à vide.
 * Un modèle simulé (objet) n'a pas de tarif ; son identifiant est repris tel
 * quel et son coût est nul — c'est le cas des tests, jamais de la production.
 */
function resoudreModele(
  tier: Tier,
  surcharge: LanguageModel | undefined,
): { modele: LanguageModel; id: string; tarife: boolean } {
  const modele = surcharge ?? modeleDuTier(tier);
  if (typeof modele === "string") {
    tarifDuModele(modele);
    return { modele: openai()(modele), id: modele, tarife: true };
  }
  return { modele, id: modele.modelId, tarife: false };
}

/** Le texte poussé au modèle — système et message(s) —, pour estimer l'entrée. */
function texteDeLEntree(options: Entree): string {
  const parts: string[] = [options.system ?? ""];
  if (options.messages !== undefined) {
    for (const m of options.messages) {
      if (typeof m.content === "string") parts.push(m.content);
      else {
        for (const p of m.content) {
          if (p.type === "text") parts.push(p.text);
        }
      }
    }
  } else {
    parts.push(options.prompt);
  }
  return parts.join("\n");
}

/** Jetons d'entrée estimés d'un appel — la même estimation que les budgets par couche. */
export function estimerEntree(options: Entree): number {
  return estimerJetons(texteDeLEntree(options));
}

/**
 * Le plafond d'ENTRÉE (`05 §10.6`), vérifié avant l'appel : refuser coûte zéro
 * jeton, appeler coûterait le contexte entier — et, au-delà du seuil de long
 * contexte du fournisseur, le double.
 */
function verifierEntree(tier: Tier, options: OptionsCommunes): void {
  const estime = estimerEntree(options);
  const plafond = PLAFONDS.jetonsEntree[tier];
  if (estime > plafond) {
    throw new EchecSollicitation({
      motif: "entree-trop-longue",
      sollicitation: options.sollicitation,
      detail: `${estime} jetons estimés pour un plafond de ${plafond} (tier ${tier})`,
      mesure: null,
    });
  }
}

/**
 * Les options fournisseur de l'appel : la clé de cache et sa rétention
 * (`05 §10.5`). Rien sans clé — un appel du banc d'essai ou d'un test n'a pas
 * de compte.
 */
function optionsFournisseur(options: OptionsCommunes) {
  if (!options.cacheCle && !options.lot) return undefined;
  return {
    openai: {
      ...(options.cacheCle
        ? {
            promptCacheKey: options.cacheCle,
            promptCacheRetention: retentionCache(),
          }
        : {}),
      ...(options.lot ? { serviceTier: "flex" as const } : {}),
    },
  };
}

/** Normalise l'usage du SDK en `Consommation` — les `undefined` deviennent 0. */
export function normaliserUsage(usage: LanguageModelUsage): Consommation {
  const inD = usage.inputTokenDetails;
  const outD = usage.outputTokenDetails;
  const cacheLecture = inD?.cacheReadTokens ?? 0;
  const cacheEcriture = inD?.cacheWriteTokens ?? 0;
  const entree =
    inD?.noCacheTokens ??
    Math.max(0, (usage.inputTokens ?? 0) - cacheLecture - cacheEcriture);
  return {
    entree,
    cacheLecture,
    cacheEcriture,
    sortie: usage.outputTokens ?? 0,
    raisonnement: outD?.reasoningTokens ?? 0,
  };
}

type Appel = {
  sollicitation: Sollicitation;
  tier: Tier;
  id: string;
  tarife: boolean;
  niveau: NiveauRaisonnement;
  debut: number;
  prefixeStable: number | null;
  lot: boolean;
};

function mesurer(
  appel: Appel,
  usage: LanguageModelUsage,
  reponseId: string | undefined,
): MesureSollicitation {
  const jetons = normaliserUsage(usage);
  return {
    sollicitation: appel.sollicitation,
    tier: appel.tier,
    modele: appel.id,
    niveau: appel.niveau,
    jetons,
    cout: appel.tarife
      ? estimerCout(appel.id, jetons, { lot: appel.lot })
      : { eur: 0, usd: 0, version: TARIFS_VERSION },
    dureeMs: Date.now() - appel.debut,
    reponseId,
    lot: appel.lot,
    prefixeStable: appel.prefixeStable,
  };
}

/** Prépare un appel : niveau exigé, modèle résolu et tarifé, entrée bornée. */
function preparer(tier: Tier, options: OptionsCommunes) {
  const niveau = exigerNiveau(options.sollicitation, options.reasoning);
  const { modele, id, tarife } = resoudreModele(tier, options.modele);
  verifierEntree(tier, options);
  const appel: Appel = {
    sollicitation: options.sollicitation,
    tier,
    id,
    tarife,
    niveau,
    debut: Date.now(),
    prefixeStable: options.prefixeStable ?? null,
    lot: options.lot ?? false,
  };
  return { modele, niveau, appel };
}

/** Une sortie tronquée n'est pas exploitée : c'est un échec, avec son coût. */
function exigerSortieComplete(
  appel: Appel,
  finishReason: FinishReason,
  mesure: MesureSollicitation,
): void {
  if (finishReason === "length") {
    throw new EchecSollicitation({
      motif: "plafond-sortie",
      sollicitation: appel.sollicitation,
      detail: `${mesure.jetons.sortie} jetons de sortie (dont ${mesure.jetons.raisonnement} de raisonnement), plafond du tier ${appel.tier} atteint`,
      mesure,
    });
  }
}

async function genererObjet<T>(
  tier: Tier,
  options: OptionsObjet<T>,
): Promise<ResultatIa<T>> {
  const { modele, niveau, appel } = preparer(tier, options);
  try {
    const { output, usage, response, finishReason } = await generateText({
      model: modele,
      reasoning: niveau,
      maxOutputTokens: options.maxOutputTokens ?? PLAFONDS.jetonsSortie[tier],
      abortSignal: options.abortSignal,
      providerOptions: optionsFournisseur(options),
      output: Output.object({
        schema: options.schema,
        name: options.nomSchema,
      }),
      ...entree(options),
    });
    const mesure = mesurer(appel, usage, response.id);
    exigerSortieComplete(appel, finishReason, mesure);
    return { sortie: output, mesure };
  } catch (err) {
    // Le SDK a bien reçu une réponse, mais pas un objet conforme : l'appel a
    // coûté ses jetons, la mesure voyage avec l'échec.
    if (NoObjectGeneratedError.isInstance(err)) {
      const mesure = err.usage
        ? mesurer(appel, err.usage, err.response?.id)
        : null;
      throw new EchecSollicitation({
        motif:
          err.finishReason === "length"
            ? "plafond-sortie"
            : "sortie-non-conforme",
        sollicitation: appel.sollicitation,
        detail: err.message.slice(0, 300),
        mesure,
        cause: err,
      });
    }
    throw err;
  }
}

function entree(options: Entree) {
  return options.messages !== undefined
    ? { system: options.system, messages: options.messages }
    : { system: options.system, prompt: options.prompt };
}

/**
 * Tier CLASSIFICATION — étiquette, titre, domaine : rapide, bon marché, sans
 * raisonnement. La sortie est structurée parce qu'une étiquette se stocke.
 */
export function classify<T>(options: OptionsObjet<T>): Promise<ResultatIa<T>> {
  return genererObjet("classification", options);
}

/**
 * Tier EXTRACTION STRUCTURÉE — tri, structuration, relecture : la conformité
 * au schéma est la seule exigence non négociable de la chaîne, ces sorties
 * écrivent en base sans revue humaine (`05 §10.5`). Ce tier n'est JAMAIS
 * dégradé par le disjoncteur (`05 §10.6`).
 */
export function extract<T>(options: OptionsObjet<T>): Promise<ResultatIa<T>> {
  return genererObjet("extraction", options);
}

/**
 * Tier RÉDACTION — brouillon, résumé : du texte, jamais envoyé seul (`05 §7.4`).
 * Avec un schéma, la rédaction rend un objet — c'est ainsi que le brouillon
 * porte ses CITATIONS (`05 §10.4`) : le texte et les sources dans la même
 * sortie, avec la même garantie de conformité que l'extraction.
 */
export function draft<T>(options: OptionsObjet<T>): Promise<ResultatIa<T>>;
export function draft(options: OptionsCommunes): Promise<ResultatIa<string>>;
export async function draft<T>(
  options: OptionsCommunes | OptionsObjet<T>,
): Promise<ResultatIa<T> | ResultatIa<string>> {
  if ("schema" in options && options.schema) {
    return genererObjet("redaction", options);
  }
  const { modele, niveau, appel } = preparer("redaction", options);
  const { text, usage, response, finishReason } = await generateText({
    model: modele,
    reasoning: niveau,
    maxOutputTokens: options.maxOutputTokens ?? PLAFONDS.jetonsSortie.redaction,
    abortSignal: options.abortSignal,
    providerOptions: optionsFournisseur(options),
    ...entree(options),
  });
  const mesure = mesurer(appel, usage, response.id);
  exigerSortieComplete(appel, finishReason, mesure);
  return { sortie: text, mesure };
}

/**
 * Tier RAISONNEMENT — l'échange avec Relvo (M10) : flux, outils, plafond
 * d'allers-retours par tour (`05 §11.8`). Le tier se décide PAR TOUR sur la
 * complexité de la demande ; un tour factuel passe en `tier: "extraction"`.
 * Retourne le résultat de flux du SDK tel quel — c'est M10 qui décidera de la
 * forme envoyée au client — plus une promesse de mesure, résolue à la fin du
 * flux, à consigner comme les autres.
 */
export function chat<TOOLS extends ToolSet>(
  options: OptionsCommunes & {
    tools?: TOOLS;
    tier?: Extract<Tier, "raisonnement" | "extraction">;
    maxEtapes?: number;
  },
) {
  const tier = options.tier ?? "raisonnement";
  const { modele, niveau, appel } = preparer(tier, options);
  const flux = streamText({
    model: modele,
    reasoning: niveau,
    tools: options.tools,
    stopWhen: stepCountIs(options.maxEtapes ?? PLAFONDS.etapesParTour),
    maxOutputTokens: options.maxOutputTokens ?? PLAFONDS.jetonsSortie[tier],
    abortSignal: options.abortSignal,
    providerOptions: optionsFournisseur(options),
    ...entree(options),
  });
  const mesure: Promise<MesureSollicitation> = Promise.all([
    flux.totalUsage,
    flux.response,
  ]).then(([usage, response]) => mesurer(appel, usage, response.id));
  return { flux, mesure };
}
