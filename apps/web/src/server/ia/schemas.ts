import { z } from "zod";

// Schémas de SORTIE des sollicitations (M7, tranche 1). Définis une fois, ici,
// et consommés par le pipeline comme par l'évaluation (`05 §11.8`).
//
// Contrainte du mode strict du fournisseur : tous les champs sont présents,
// aucun n'est « optionnel » — ce qui peut manquer est `null`. C'est aussi ce
// qui rend une sortie comparable d'un appel à l'autre.
//
// Les noms suivent `02-modele-donnees.md` : un avis en deux parts — l'ACTION
// à trois valeurs et la NATURE à quatre —, une confiance à trois niveaux
// (jamais un pourcentage — un modèle annonce mal ses probabilités), une raison
// en une phrase, une situation structurée en quatre champs.

/**
 * L'ACTION — ce que le fil demande au dirigeant. « a_traiter » : un sujet
 * s'ouvre ou se rattache. « a_considerer » : le dirigeant tranche, le fil
 * reste à trier. « rien_a_faire » : en confiance haute, la source est mise en
 * sourdine. Miroir de `TriageVerdict` (Prisma) : matter, uncertain, noise.
 */
export const ACTIONS = ["a_traiter", "a_considerer", "rien_a_faire"] as const;
export const CONFIANCES = ["haute", "moyenne", "basse"] as const;
export const PRIORITES = ["normal", "urgent"] as const;
/**
 * La NATURE — de quoi il s'agit, TOUJOURS posée, quelle que soit l'action.
 * Quatre valeurs, pas trente-six : c'est ce que l'utilisateur lit. Un domaine
 * ne se pose que sur « professionnel ». Miroir de `TriageNature` (Prisma).
 */
export const NATURES = [
  "professionnel",
  "publicite",
  "automatique",
  "personnel",
] as const;
/** Miroir de `TaskKind` (Prisma) — le schéma de sortie n'importe pas le client. */
export const TYPES_TACHE = [
  "decision",
  "reply",
  "check",
  "call",
  "inform",
  "follow_up",
  "other",
] as const;
/** Miroir de `ContactRole` (Prisma). */
export const ROLES_CONTACT = [
  "supplier",
  "customer",
  "employee",
  "administration",
  "partner",
  "other",
] as const;

const dateIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date au format AAAA-MM-JJ")
  .nullable();
const heure = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "heure au format HH:MM")
  .nullable();

/**
 * Sortie du TRI (`05 §1.1`, §1.1 ter, §1.2, §1.4) — un appel sur une
 * conversation orpheline. Rend une action et une nature, découvre le domaine,
 * repère un sujet ouvert que le fil prolonge — même sans action —, propose un
 * titre.
 */
export const SortieTri = z.object({
  action: z.enum(ACTIONS),
  nature: z.enum(NATURES),
  confiance: z.enum(CONFIANCES),
  /** Une phrase, visible dans la liste à trier. */
  raison: z.string(),
  /** Nom EXACT d'un domaine du compte, ou null si aucun ne convient ou si la nature n'est pas professionnelle. */
  domaine: z.string().nullable(),
  /** Nom libre quand aucun domaine existant ne convient (`04 §10`). */
  domaine_propose: z.string().nullable(),
  /** Référence d'un sujet ouvert du compte que ce fil prolonge — réponse, confirmation, accusé attendu —, sinon null. */
  sujet_existant: z.string().nullable(),
  /** Titre orienté métier si « a_traiter », sinon null. */
  titre: z.string().nullable(),
  priorite: z.enum(PRIORITES),
});
export type SortieTri = z.infer<typeof SortieTri>;

/**
 * Une DÉCISION que le message demande au dirigeant (`05 §3.1`) : portée par la
 * tâche qui se répond, affichée en formulaire dans le fil, jamais en crochets
 * dans le texte d'une réponse.
 */
export const DecisionProposee = z.object({
  question: z
    .string()
    .describe("La question, courte, telle qu'on la poserait au dirigeant."),
  precision: z
    .string()
    .nullable()
    .describe("Ce qui aide à décider — montant, délai, quantité — ou null."),
  options: z
    .array(z.string())
    .describe(
      "2 à 4 réponses possibles, complètes et courtes (« Oui, commandez », « Non »), la plus probable en premier.",
    ),
});
export type DecisionProposee = z.infer<typeof DecisionProposee>;

export const TacheProposee = z.object({
  titre: z.string(),
  type: z.enum(TYPES_TACHE),
  /** Échéance (`start_date`). Null si rien d'extractible — jamais inventée (`05 §2.5`). */
  date: dateIso,
  heure,
  date_fin: dateIso,
  heure_fin: heure,
  /** « le fournisseur demande un retour avant jeudi » (`05 §2.4`). */
  raison: z.string(),
  /** Référence du précédent ou du document d'où la tâche est déduite, sinon null. */
  provenance: z.string().nullable(),
  /** Les décisions que le message demande pour cette tâche ; vide si aucune (`05 §3.1`). */
  decisions: z
    .array(DecisionProposee)
    .describe(
      "Seulement sur une tâche qui se répond (reply, decision) et seulement si le message demande une décision au dirigeant ; vide sinon.",
    ),
});
export type TacheProposee = z.infer<typeof TacheProposee>;

/**
 * Sortie de la STRUCTURATION (`05 §1.3`–§1.6, §2, §9.3, §9.4) — second appel,
 * quand un sujet vient d'être ouvert et que son domaine est connu.
 */
export const SortieStructuration = z.object({
  situation: z.object({
    ou_on_en_est: z.string().describe("Une phrase."),
    prochaine_etape: z
      .string()
      .describe(
        "UNE ligne, sans date : l'action du dirigeant, ou ce qu'on attend d'un tiers (« En attente du devis de X »).",
      ),
    /** De qui on attend quoi ; null si on n'attend personne. */
    attente: z
      .string()
      .nullable()
      .describe("De qui on attend quoi, en quelques mots ; null sinon."),
    /** L'échéance qui compte, AAAA-MM-JJ, ou null. */
    echeance: dateIso,
  }),
  /** Résumé court, pour l'humain : de quoi il s'agit — jamais les tâches. */
  resume: z
    .string()
    .describe(
      "De quoi il s'agit, en une phrase (deux au plus). Jamais les actions à faire ni les dates.",
    ),
  /** Vide si le message est informatif (`05 §2.2`). */
  taches: z.array(TacheProposee),
  /** Null seulement si la fiche du contact est vérifiée, ou si la conversation est un groupe. */
  contact: z
    .object({
      prenom: z.string().nullable(),
      nom: z.string().nullable(),
      entreprise: z.string().nullable(),
      role: z.enum(ROLES_CONTACT),
      /** Lus dans la signature, tels quels ; null sinon. */
      telephone: z.string().nullable(),
      email: z.string().nullable(),
    })
    .nullable()
    .describe(
      "Identité et rôle de l'interlocuteur, déduits de la signature ou du message. Null seulement si sa fiche est vérifiée ou s'il s'agit d'un groupe.",
    ),
  /** Clés du registre du compte, uniquement. */
  etiquettes: z.array(z.string()),
  /** Au plus une étiquette hors registre par sujet (`05 §9.3`). */
  etiquette_nouvelle: z.string().nullable(),
  questions: z.array(
    z.object({
      portee: z.enum(["contact", "domaine", "sujet"]),
      texte: z.string(),
    }),
  ),
  domaine_propose: z.string().nullable(),
});
export type SortieStructuration = z.infer<typeof SortieStructuration>;

/**
 * Sortie de la RELECTURE (`05 §5.2`–§5.5, §8.4–§8.5) — un seul appel quand
 * un message arrive sur un sujet suivi — ou que le dirigeant en envoie un. Met à jour la situation et le
 * résumé, ajoute les tâches que le message rend nécessaires (aucune s'il est
 * informatif), recalibre la priorité, dit si le sujet attend un tiers et s'il
 * semble terminé. Relvo ne ferme jamais : il suggère (05 §7.2).
 */
export const SortieRelecture = z.object({
  situation: SortieStructuration.shape.situation,
  resume: SortieStructuration.shape.resume,
  /** Seulement les tâches NOUVELLES ; celles déjà ouvertes sont dans la fiche. Vide si le message est informatif. */
  taches: z.array(TacheProposee),
  /** Clés du registre à AJOUTER au sujet, uniquement. */
  etiquettes: z.array(z.string()),
  priorite: z.enum(PRIORITES),
  /** Le sujet attend un tiers — livraison promise, devis annoncé, retour attendu — sans action du dirigeant (`05 §5.3`). */
  en_attente: z.boolean(),
  /** L'affaire semble terminée : confirmation reçue, plus rien à faire, situation close naturellement (`05 §5.5`). */
  termine: z.boolean(),
  /** Tâches OUVERTES de la fiche que ce message rend sans objet (`05 §4.2`) — titre EXACT de la fiche, et pourquoi. Vide sinon. */
  taches_obsoletes: z.array(
    z.object({
      titre: z
        .string()
        .describe("Le titre EXACT d'une tâche ouverte de la fiche."),
      raison: z.string().describe("Pourquoi ce message la rend sans objet."),
    }),
  ),
  /** Tâches OUVERTES de la fiche que ce message montre ACCOMPLIES (`05 §4.2`) — livraison reçue, intervention faite, paiement confirmé — titre EXACT de la fiche, et ce qui le dit. Vide sinon. */
  taches_terminees: z.array(
    z.object({
      titre: z
        .string()
        .describe("Le titre EXACT d'une tâche ouverte de la fiche."),
      raison: z
        .string()
        .describe("Ce qui, dans ce message, dit qu'elle est faite."),
    }),
  ),
  /** Ce que ce message change, en une phrase — pour le journal. */
  raison: z.string(),
});
export type SortieRelecture = z.infer<typeof SortieRelecture>;
