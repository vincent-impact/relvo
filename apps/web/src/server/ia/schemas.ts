import { z } from "zod";

// Schémas de SORTIE des sollicitations (M7, tranche 1). Définis une fois, ici,
// et consommés par le pipeline comme par l'évaluation (`05 §11.8`).
//
// Contrainte du mode strict du fournisseur : tous les champs sont présents,
// aucun n'est « optionnel » — ce qui peut manquer est `null`. C'est aussi ce
// qui rend une sortie comparable d'un appel à l'autre.
//
// Les noms suivent `02-modele-donnees.md` : verdict à trois valeurs, confiance
// à trois niveaux (jamais un pourcentage — un modèle annonce mal ses
// probabilités), raison en une phrase, situation structurée en quatre champs.

export const VERDICTS = ["bruit", "affaire", "incertain"] as const;
export const CONFIANCES = ["haute", "moyenne", "basse"] as const;
export const PRIORITES = ["normal", "urgent"] as const;
/**
 * Catégorie d'un verdict « bruit » — sous-ensemble de l'énuméré `IgnoreReason`
 * (Prisma), les RAISONS D'IGNORANCE de `02` : ce que le tri conclut est
 * exactement ce que l'utilisateur confirme d'un geste, et la liste à trier se
 * regroupe dessus. `personal` = hors du champ professionnel ; `advertising` =
 * envois de masse ; `automatic` = notifications, accusés de réception, alertes
 * de plateformes ; `prospecting` = démarchage non sollicité ; `other` =
 * informatif sans suite. Une contrainte en base interdit les deux autres
 * raisons au tri.
 */
export const CATEGORIES_BRUIT = [
  "personal",
  "advertising",
  "automatic",
  "prospecting",
  "other",
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
 * conversation orpheline. Décide bruit / affaire / incertain, découvre le
 * domaine, repère une affaire déjà suivie, propose un titre.
 */
export const SortieTri = z.object({
  verdict: z.enum(VERDICTS),
  /** Renseignée si et seulement si le verdict est « bruit ». */
  categorie_bruit: z.enum(CATEGORIES_BRUIT).nullable(),
  confiance: z.enum(CONFIANCES),
  /** Une phrase, visible dans la liste à trier. */
  raison: z.string(),
  /** Nom EXACT d'un domaine du compte, ou null si aucun ne convient. */
  domaine: z.string().nullable(),
  /** Nom libre quand aucun domaine existant ne convient (`04 §10`). */
  domaine_propose: z.string().nullable(),
  /** Référence d'un sujet ouvert du compte que ce fil prolonge, sinon null. */
  sujet_existant: z.string().nullable(),
  /** Titre orienté métier si affaire, sinon null. */
  titre: z.string().nullable(),
  priorite: z.enum(PRIORITES),
});
export type SortieTri = z.infer<typeof SortieTri>;

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
});
export type TacheProposee = z.infer<typeof TacheProposee>;

/**
 * Sortie de la STRUCTURATION (`05 §1.3`–§1.6, §2, §9.3, §9.4) — second appel,
 * quand un sujet vient d'être ouvert et que son domaine est connu.
 */
export const SortieStructuration = z.object({
  situation: z.object({
    ou_on_en_est: z.string(),
    prochaine_etape: z.string(),
    /** De qui on attend quoi ; null si on n'attend personne. */
    attente: z.string().nullable(),
    /** L'échéance qui compte, AAAA-MM-JJ, ou null. */
    echeance: dateIso,
  }),
  /** Résumé libre de quelques lignes, pour l'humain. */
  resume: z.string(),
  /** Vide si le message est informatif (`05 §2.2`). */
  taches: z.array(TacheProposee),
  /** Null si l'interlocuteur est connu, ou si la conversation est un groupe. */
  contact: z
    .object({
      prenom: z.string().nullable(),
      nom: z.string().nullable(),
      entreprise: z.string().nullable(),
      role: z.enum(ROLES_CONTACT),
    })
    .nullable(),
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
