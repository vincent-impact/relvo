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
 * Les tiers TEXTE de `05 §10.5` — ceux qui raisonnent, se plafonnent en
 * jetons et se cachent. La transcription (M22) est un tier à part : elle se
 * tarife à la minute, n'a ni niveau de raisonnement ni plafond de jetons.
 */
export type TierTexte =
  | "classification"
  | "extraction"
  | "redaction"
  | "raisonnement";

/** Les tiers de `05 §10.5`, transcription comprise. */
export type Tier = TierTexte | "transcription";

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
export const NIVEAU_RETENU: Readonly<Record<TierTexte, NiveauRaisonnement>> = {
  classification: "none",
  extraction: "low",
  redaction: "low",
  raisonnement: "medium",
};

/**
 * Affectation par défaut, surchargée par l'environnement (cf. `.env.example`).
 * La transcription : le plus petit modèle qui écrit juste les noms du compte
 * (`backlog/benchmark-iag.md` §6.12, M22.1).
 */
const MODELE_PAR_DEFAUT: Readonly<Record<Tier, string>> = {
  classification: "gpt-5.6-luna",
  extraction: "gpt-5.6-luna",
  redaction: "gpt-5.6-luna",
  raisonnement: "gpt-5.6-terra",
  transcription: "gpt-4o-mini-transcribe",
};

const VARIABLE_PAR_TIER: Readonly<Record<Tier, string>> = {
  classification: "RELVO_IA_MODELE_CLASSIFICATION",
  extraction: "RELVO_IA_MODELE_EXTRACTION",
  redaction: "RELVO_IA_MODELE_REDACTION",
  raisonnement: "RELVO_IA_MODELE_RAISONNEMENT",
  transcription: "RELVO_IA_MODELE_TRANSCRIPTION",
};

/** Le modèle (identifiant OpenAI) affecté à un tier. */
export function modeleDuTier(
  tier: Tier,
  env: Record<string, string | undefined> = process.env,
): string {
  const surcharge = env[VARIABLE_PAR_TIER[tier]]?.trim();
  return surcharge || MODELE_PAR_DEFAUT[tier];
}

export const TIERS_TEXTE: readonly TierTexte[] = [
  "classification",
  "extraction",
  "redaction",
  "raisonnement",
];

export const TIERS: readonly Tier[] = [...TIERS_TEXTE, "transcription"];

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
  } satisfies Record<TierTexte, number>,
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
  } satisfies Record<TierTexte, number>,
  /** Allers-retours au modèle par tour d'échange (`05 §11.8`). */
  etapesParTour: 6,
} as const;

/**
 * La DICTÉE (M22) : ce que la route de transcription accepte, tranché avec le
 * dirigeant (`backlog/sprints/2026-10-m22-voix.md`). Une minute : une dictée
 * à Relvo est une demande, pas un mémo ; l'appareil s'arrête au plafond et
 * transcrit ce qu'il a. La taille borne le corps AVANT d'appeler le
 * fournisseur — une minute d'AAC iOS pèse moins d'un mégaoctet, deux
 * mégaoctets laissent de la marge à un débit plus gourmand ; la limite dure
 * est celle du corps d'une fonction (4,5 Mo). Sous une seconde, il n'y a rien
 * à transcrire : rien ne part.
 */
export const DICTEE = {
  dureeMaxS: 60,
  dureeMinS: 1,
  tailleMaxOctets: 2 * 1024 * 1024,
  /** Les conteneurs que `MediaRecorder` donne, dans l'ordre où l'appareil les essaie. */
  typesAudio: ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"],
  langue: "fr",
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
 * connexion d'un canal, le garde-fou d'un rattrapage — en messages et en
 * euros, loin au-dessus d'une boîte réelle — et le rythme des tranches.
 * Arrêté avec le dirigeant (`ecarts`, « La première lecture est large ») : la
 * première lecture convainc au premier usage, on ne la bride pas, on la
 * mesure au journal ; le garde-fou n'arrête qu'un emballement. En direct, le
 * tri est au niveau de service standard — le dirigeant regarde ; la nuit, le
 * filet reprend une ligne arrêtée au garde-fou au niveau « flex », à moitié
 * prix. Un message daté d'avant la demande d'un rattrapage ouvert est de
 * l'historique synchronisé : rangé, laissé à la tranche, jamais trié plein
 * tarif à la volée.
 */
export const RATTRAPAGE = {
  fenetreJours: 14,
  plafondMessages: 5_000,
  plafondEuros: 10,
  /** Tranches au plus sur une même ligne : un coupe-circuit de boucle, pas le mécanisme attendu. */
  tranchesMax: 120,
  /** Nuits au plus pour reprendre une ligne arrêtée au garde-fou. */
  nuitsMax: 3,
  /** Messages lus par page chez l'agrégateur. */
  pageImport: 50,
  /** Conversations triées par salve, entre deux points d'avancement. */
  salveTri: 10,
  /** Conversations triées en parallèle, une fois le cache chauffé par la première (#49). */
  parallele: 3,
  /** Sous cette durée depuis la demande, deux passes vides ne closent pas : l'agrégateur synchronise encore. */
  attenteSyncMs: 10 * 60 * 1000,
  /** Passes d'import vides consécutives pour clore une ligne. */
  passesVidesPourClore: 2,
  /** Entre deux passes d'import vides, dans la même tranche. */
  attenteImportMs: 60 * 1000,
  /** Durée maximale d'une tranche : au-delà, un verrou est celui d'une tranche morte. */
  trancheMaxMs: 5 * 60 * 1000,
  /** Une ligne ouverte sans tranche depuis ce délai est en panne : une page ou le filet la relance. */
  relanceApresMs: 6 * 60 * 1000,
} as const;

/**
 * Le TRI DE LA MESSAGERIE DIRECTE (M7, tranche 11 ; `05 §1.2`, §9.5) : une
 * conversation WhatsApp directe se trie par SALVE — l'interlocuteur écrit trois
 * messages en trente secondes, un tri sur le premier ne verrait qu'une ligne.
 * Le tri d'un message attend `attenteSalveMs` après la réponse du webhook,
 * puis ne se joue que si ce message est toujours le dernier entrant du fil ;
 * sinon il s'efface, et le webhook du message suivant portera le tri. L'affaire
 * ouverte écoute depuis le début de la salve : le plus ancien message orphelin
 * daté de moins de `fenetreSalveMs` avant le déclencheur — jamais un
 * bavardage d'il y a dix jours que le tri avait laissé sans affaire. Arrêté
 * avec le dirigeant (`ecarts`, « Le fil WhatsApp direct se trie à réception »).
 */
export const MESSAGERIE = {
  attenteSalveMs: 45 * 1000,
  fenetreSalveMs: 2 * 60 * 60 * 1000,
} as const;
