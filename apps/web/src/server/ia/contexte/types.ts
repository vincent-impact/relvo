import type { Secteur } from "../produit";

// Types d'ENTRÉE du module de contexte (M7.3). Ce sont des projections
// EXPLICITES, champ par champ, jamais des entités Prisma : ce qui entre dans un
// prompt est décidé ici, et un champ ajouté en base n'y entre pas par accident
// (même réflexe que PITFALLS.md #41, côté modèle). Les chargeurs qui remplissent
// ces types depuis la base arrivent avec l'orchestration (tranche 4).
//
// Conventions : dates en ISO 8601 (chaîne), identifiants techniques absents —
// une référence lisible (`SUB-0142`) suffit au modèle et aux outils.

export type CompteContexte = {
  /** Le dirigeant, nommé comme tel — jamais présenté comme « l'entreprise ». */
  dirigeant: string;
  /** Raison sociale, quand le compte en porte une. */
  entreprise: string | null;
  /** Adresses des messageries connectées : ce sur quoi un fil a été REÇU. */
  messageries: readonly string[];
  secteurs: readonly Secteur[];
  /** Domaines du compte, « Général » compris (filtré par couche selon l'usage). */
  domaines: readonly DomaineResume[];
  /** Instructions de « Général » — transversales, chargées pour tous les sujets. */
  instructionsGenerales: readonly InstructionContexte[];
  /** Registre des étiquettes actives (clés). */
  etiquettes: readonly string[];
  /** Préférences observées, recalculées depuis le journal (`02`, Account). */
  preferencesObservees: string | null;
  /** Titres des sujets ouverts récents, tous contacts confondus (`05 §1.2`). */
  sujetsOuverts: readonly SujetResume[];
};

export type DomaineResume = { nom: string; description: string | null };

export type SujetResume = {
  reference: string;
  titre: string;
  /** Le sujet attend une réponse : c'est ce qui fait reconnaître un accusé ou une confirmation (`05 §1.2`). */
  enAttente?: boolean;
};

export type InstructionContexte = { titre: string; contenu: string };

export type DocumentContexte = {
  nom: string;
  /** Étiquette posée par Relvo à la réception, si le nom n'est pas parlant. */
  etiquette: string | null;
  /** Résumé de Relvo, quand il existe — jamais le fichier entier ici. */
  resume: string | null;
};

/** Couche Domaine : instructions et documents du domaine concerné. */
export type DomaineContexte = {
  nom: string;
  description: string | null;
  instructions: readonly InstructionContexte[];
  documents: readonly DocumentContexte[];
};

export type MessageContexte = {
  /** « Nom <adresse> » ou identifiant brut, tel que reçu. */
  expediteur: string;
  /** ISO 8601. */
  recuLe: string;
  objet: string | null;
  contenu: string;
  sens?: "entrant" | "sortant";
  piecesJointes?: readonly { nom: string; etiquette: string | null }[];
};

/**
 * Le PROFIL DE L'EXPÉDITEUR d'un fil à trier — calculé par le domaine, sans
 * appel (`05 §9.5`). Miroir structurel de `TriageSenderProfile` (paquet db).
 */
export type ExpediteurContexte = {
  adresse: string | null;
  connu: boolean;
  nom: string | null;
  entreprise: string | null;
  role: string | null;
  sujetsParSesFils: number;
  sujetsValides: number;
  domaineHabituel: string | null;
  antecedentsTri: readonly { raison: string; nombre: number }[];
  sujetsEnCours: readonly {
    reference: string;
    titre: string;
    enAttente: boolean;
    derniereActiviteLe: string | null;
  }[];
};

export type ConversationContexte = {
  canal: "email" | "whatsapp";
  messages: readonly MessageContexte[];
  /** Ce que la base sait de l'expéditeur — pèse dans l'avis sans qu'on écrive de règle. */
  expediteur?: ExpediteurContexte;
  /** Indices techniques d'automate relevés sans appel (`pipeline/bruit`), en clair — jamais une conclusion. */
  signaux?: readonly string[];
};

export type TacheContexte = {
  titre: string;
  type: string;
  /** AAAA-MM-JJ ou null. */
  date: string | null;
  source: "relvo" | "moi";
  terminee?: boolean;
  /** ISO 8601, pour ordonner une fiche de clôture. */
  termineeLe?: string | null;
};

export type ContactResume = {
  nom: string;
  entreprise: string | null;
  role: string | null;
};

/** Fiche SUJET (`05 §10.1`) — ce que Relvo relit, jamais l'historique. */
export type SujetContexte = {
  reference: string;
  titre: string;
  domaine: string | null;
  etiquettes: readonly string[];
  statut: "ouvert" | "validé" | "fermé";
  priorite: "normal" | "urgent";
  enAttente: boolean;
  /** Relvo a suggéré la clôture et l'utilisateur n'a pas encore tranché (`05 §5.5`). */
  resolutionSuggeree?: boolean;
  /** ISO 8601. */
  ouvertLe: string;
  situation: {
    ouOnEnEst: string | null;
    prochaineEtape: string | null;
    attente: string | null;
    /** AAAA-MM-JJ. */
    echeance: string | null;
  };
  resume: string | null;
  taches: readonly TacheContexte[];
  contacts: readonly ContactResume[];
  /** Ordonnés par horodatage croissant ; la fiche n'en garde que les derniers. */
  messages: readonly MessageContexte[];
};

/** Fiche CONTACT (`05 §10.1`). */
export type ContactContexte = {
  nom: string;
  /** Fiche automatique, créée par Relvo à l'ouverture : nom, entreprise et rôle sont à déduire du message. */
  aCompleter?: boolean;
  /** Signature du dernier message entrant — l'hygiène la retire du fil, la fiche la garde pour compléter le contact. */
  signature?: string | null;
  entreprise: string | null;
  role: string | null;
  noteRelvo: string | null;
  domaineHabituel: string | null;
  /** Délai de réponse constaté, en jours, dérivé des messages ; null si inconnu. */
  delaiReponseJours: number | null;
  sujetsOuverts: readonly SujetResume[];
  derniersValides: readonly SujetResume[];
  /** Antécédents de tri : raisons d'ignorance déjà posées sur ses fils, avec leur nombre. */
  antecedentsTri: readonly { raison: string; nombre: number }[];
};

/** Brief du COMPTE — pour l'échange, jamais pour le pipeline (`05 §10.1`). */
export type BriefCompte = {
  sujetsOuverts: number;
  sujetsUrgents: readonly SujetResume[];
  tachesDuJour: number;
  tachesEnRetard: number;
  conversationsATrier: number;
};

/** Ce qu'il faut pour fabriquer une fiche de CLÔTURE — sans appel au modèle. */
export type SujetClos = {
  reference: string;
  titre: string;
  domaine: string | null;
  etiquettes: readonly string[];
  /** ISO 8601. */
  ouvertLe: string;
  /** ISO 8601. */
  valideLe: string;
  situationFinale: SujetContexte["situation"];
  resume: string | null;
  tachesRealisees: readonly TacheContexte[];
  /** Tâches proposées par Relvo que l'utilisateur a écartées — du journal. */
  tachesEcartees: readonly { titre: string }[];
};

export type Precedent = {
  reference: string;
  titre: string;
  fiche: string | null;
};

export type InstantContexte = {
  /** ISO 8601 — l'instant de l'appel, ou l'horodatage du message pour l'évaluation. */
  maintenant: string;
  /** Page d'origine, pour l'échange seulement. */
  page?: string | null;
};
