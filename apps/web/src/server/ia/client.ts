import "server-only";
import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import {
  generateText,
  Output,
  stepCountIs,
  streamText,
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
  type NiveauRaisonnement,
  type Tier,
} from "./config";
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
//   3. Les jetons de sortie sont bornés par défaut (`05 §10.6`).
//
// Comme le client Unipile, c'est une intégration de l'APPLICATION : rien ici
// n'appartient à `packages/`. Sans configuration (`inferenceDisponible()`
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
   * Jeu d'évaluation (M7.17) et tests uniquement : impose un modèle —
   * identifiant OpenAI pour comparer plusieurs modèles, ou modèle simulé de
   * `ai/test`. En production, le modèle vient du tier.
   */
  modele?: LanguageModel;
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

function mesurer(args: {
  sollicitation: Sollicitation;
  tier: Tier;
  id: string;
  tarife: boolean;
  niveau: NiveauRaisonnement;
  usage: LanguageModelUsage;
  debut: number;
  reponseId: string | undefined;
}): MesureSollicitation {
  const jetons = normaliserUsage(args.usage);
  return {
    sollicitation: args.sollicitation,
    tier: args.tier,
    modele: args.id,
    niveau: args.niveau,
    jetons,
    cout: args.tarife
      ? estimerCout(args.id, jetons)
      : { eur: 0, usd: 0, version: TARIFS_VERSION },
    dureeMs: Date.now() - args.debut,
    reponseId: args.reponseId,
  };
}

async function genererObjet<T>(
  tier: Tier,
  options: OptionsCommunes & { schema: FlexibleSchema<T>; nomSchema?: string },
): Promise<ResultatIa<T>> {
  const niveau = exigerNiveau(options.sollicitation, options.reasoning);
  const { modele, id, tarife } = resoudreModele(tier, options.modele);
  const debut = Date.now();
  const { output, usage, response } = await generateText({
    model: modele,
    reasoning: niveau,
    maxOutputTokens: options.maxOutputTokens ?? PLAFONDS.jetonsSortie[tier],
    abortSignal: options.abortSignal,
    output: Output.object({ schema: options.schema, name: options.nomSchema }),
    ...entree(options),
  });
  return {
    sortie: output,
    mesure: mesurer({
      sollicitation: options.sollicitation,
      tier,
      id,
      tarife,
      niveau,
      usage,
      debut,
      reponseId: response.id,
    }),
  };
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
export function classify<T>(
  options: OptionsCommunes & { schema: FlexibleSchema<T>; nomSchema?: string },
): Promise<ResultatIa<T>> {
  return genererObjet("classification", options);
}

/**
 * Tier EXTRACTION STRUCTURÉE — tri, structuration, relecture : la conformité
 * au schéma est la seule exigence non négociable de la chaîne, ces sorties
 * écrivent en base sans revue humaine (`05 §10.5`). Ce tier n'est JAMAIS
 * dégradé par le disjoncteur (`05 §10.6`).
 */
export function extract<T>(
  options: OptionsCommunes & { schema: FlexibleSchema<T>; nomSchema?: string },
): Promise<ResultatIa<T>> {
  return genererObjet("extraction", options);
}

/** Tier RÉDACTION — brouillon, résumé : du texte, jamais envoyé seul (`05 §7.4`). */
export async function draft(
  options: OptionsCommunes,
): Promise<ResultatIa<string>> {
  const niveau = exigerNiveau(options.sollicitation, options.reasoning);
  const { modele, id, tarife } = resoudreModele("redaction", options.modele);
  const debut = Date.now();
  const { text, usage, response } = await generateText({
    model: modele,
    reasoning: niveau,
    maxOutputTokens: options.maxOutputTokens ?? PLAFONDS.jetonsSortie.redaction,
    abortSignal: options.abortSignal,
    ...entree(options),
  });
  return {
    sortie: text,
    mesure: mesurer({
      sollicitation: options.sollicitation,
      tier: "redaction",
      id,
      tarife,
      niveau,
      usage,
      debut,
      reponseId: response.id,
    }),
  };
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
  const niveau = exigerNiveau(options.sollicitation, options.reasoning);
  const { modele, id, tarife } = resoudreModele(tier, options.modele);
  const debut = Date.now();
  const flux = streamText({
    model: modele,
    reasoning: niveau,
    tools: options.tools,
    stopWhen: stepCountIs(options.maxEtapes ?? PLAFONDS.etapesParTour),
    maxOutputTokens: options.maxOutputTokens ?? PLAFONDS.jetonsSortie[tier],
    abortSignal: options.abortSignal,
    ...entree(options),
  });
  const mesure: Promise<MesureSollicitation> = Promise.all([
    flux.totalUsage,
    flux.response,
  ]).then(([usage, response]) =>
    mesurer({
      sollicitation: options.sollicitation,
      tier,
      id,
      tarife,
      niveau,
      usage,
      debut,
      reponseId: response.id,
    }),
  );
  return { flux, mesure };
}
