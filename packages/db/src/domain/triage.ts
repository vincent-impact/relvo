import { z } from "zod";
import {
  Actor,
  ConversationStatus,
  ConversationType,
  IgnoreReason,
  MessageDirection,
  Priority,
  SubjectStatus,
  TriageConfidence,
  TriageVerdict,
} from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { findListeningSubjectForConversation } from "./conversations";
import { DomainError, assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { openSubjectOnConversation } from "./messages";
import { attachEmailConversationToSubject } from "./subject-conversations";

// Domaine TRI (M7, tranche 4) — ce que le pipeline LIT et ÉCRIT en base autour
// d'un verdict de tri. Le pipeline lui-même (filtre déterministe, appel au
// modèle, décision) vit dans l'application, unique consommateur de l'inférence ;
// ici ne vivent que les lectures et les écritures, testées contre la base.
//
// Trois règles tenues ici, et nulle part ailleurs :
//   1. Les PROJECTIONS poussées au modèle sont explicites, champ par champ —
//      jamais une entité Prisma (même réflexe que les types du module de
//      contexte, côté application). Un champ ajouté en base n'entre pas dans un
//      prompt par accident.
//   2. Ouvrir ou rattacher passe par les primitives du domaine —
//      `openSubjectOnConversation`, `attachEmailConversationToSubject` — jamais
//      par un chemin parallèle. Relvo n'a pas de raccourci.
//   3. Le journal est écrit à chaque sous-action (M7.14) et à chaque
//      sollicitation (M7.16), avec les clés de métadonnées posées ici, premier
//      écrivain (02, EventLog).

// L'interrupteur du compte (« l'assistant est-il actif ? ») vit dans
// `./accounts` : il gouverne plus que le tri.

// ─────────────────────────────────────────────────────────────
// La projection — ce que le tri a le droit de lire
// ─────────────────────────────────────────────────────────────

/** Miroir structurel de `CompteContexte` (application) : le tri ne charge ni instructions ni étiquettes. */
export type TriageAccountProjection = {
  entreprise: string;
  secteurs: ("food" | "construction" | "other")[];
  domaines: { nom: string; description: string | null }[];
  instructionsGenerales: { titre: string; contenu: string }[];
  etiquettes: string[];
  preferencesObservees: string | null;
  sujetsOuverts: { reference: string; titre: string }[];
};

/** Miroir structurel de `MessageContexte` (application). */
export type TriageMessageProjection = {
  expediteur: string;
  recuLe: string;
  objet: string | null;
  contenu: string;
  sens: "entrant" | "sortant";
};

export type TriageProjection = {
  /** Aucun sujet n'écoute ce fil, et il n'est pas en sourdine. */
  orpheline: boolean;
  statut: ConversationStatus;
  type: ConversationType;
  compte: TriageAccountProjection;
  conversation: {
    canal: "email" | "whatsapp";
    messages: TriageMessageProjection[];
  };
  /** Le dernier message ENTRANT, brut, pour le filtre déterministe du bruit. */
  dernierEntrant: {
    id: string;
    adresse: string | null;
    nom: string | null;
    objet: string | null;
    contenu: string;
  } | null;
};

/** Titres de sujets ouverts poussés au tri — des titres, jamais des fiches (05 §1.2). */
export const TRIAGE_OPEN_SUBJECTS_MAX = 40;
/** Messages chargés d'un fil : le plus ancien et les derniers ; la couche Situation borne encore. */
export const TRIAGE_LAST_MESSAGES = 10;

function displayContact(c: {
  firstName: string | null;
  lastName: string;
  company: string | null;
}): string {
  const nom = [c.firstName, c.lastName].filter(Boolean).join(" ");
  return c.company ? `${nom} (${c.company})` : nom;
}

/**
 * Charge tout ce que le profil « tri » du contexte consomme, depuis la base :
 * le compte (secteurs, domaines avec description, sujets ouverts récents
 * bornés), la conversation et ses messages avec nom et entreprise du contact.
 */
export async function getTriageProjection(
  db: TenantDb,
  conversationId: string,
): Promise<TriageProjection> {
  const conversation = assertFound(
    await db.conversation.findFirst({
      where: { id: conversationId },
      select: {
        id: true,
        accountId: true,
        type: true,
        status: true,
        title: true,
        participantsRaw: true,
        interlocutorRaw: true,
        contact: {
          select: { firstName: true, lastName: true, company: true },
        },
      },
    }),
    "Conversation",
  );

  const account = assertFound(
    await db.account.findUnique({
      where: { id: conversation.accountId },
      select: {
        firstName: true,
        lastName: true,
        sectors: true,
        observedPreferences: true,
      },
    }),
    "Compte",
  );

  const [folders, openSubjects, listening, oldest, latest] = await Promise.all([
    db.folder.findMany({
      where: { isActive: true },
      select: { name: true, description: true },
      orderBy: { name: "asc" },
    }),
    db.subject.findMany({
      where: { status: SubjectStatus.open },
      select: { reference: true, title: true },
      orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
      take: TRIAGE_OPEN_SUBJECTS_MAX,
    }),
    findListeningSubjectForConversation(db, conversationId),
    db.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 1,
      include: {
        senderContact: {
          select: { firstName: true, lastName: true, company: true },
        },
      },
    }),
    db.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: TRIAGE_LAST_MESSAGES,
      include: {
        senderContact: {
          select: { firstName: true, lastName: true, company: true },
        },
      },
    }),
  ]);

  // Le plus ancien et les derniers, sans doublon, dans l'ordre chronologique.
  const byId = new Map<string, (typeof latest)[number]>();
  for (const m of [...oldest, ...latest]) byId.set(m.id, m);
  const messages = [...byId.values()].sort((a, b) => {
    const d = a.createdAt.getTime() - b.createdAt.getTime();
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });

  // Interlocuteur du fil, pour nos messages sortants : le contact enregistré,
  // sinon le set d'adresses brutes, sinon l'identifiant brut.
  const interlocuteur = conversation.contact
    ? displayContact(conversation.contact)
    : conversation.participantsRaw.length
      ? conversation.participantsRaw.join(", ")
      : (conversation.interlocutorRaw ?? conversation.title);

  const projected: TriageMessageProjection[] = messages.map((m) => {
    const sortant = m.direction === MessageDirection.outgoing;
    const nom =
      m.senderName ??
      (m.senderContact ? displayContact(m.senderContact) : null);
    const expediteur = sortant
      ? interlocuteur
      : `${nom ?? ""}${nom && m.senderRaw ? " " : ""}${m.senderRaw ? `<${m.senderRaw}>` : ""}`.trim() ||
        "inconnu";
    return {
      expediteur,
      recuLe: (m.receivedAt ?? m.sentAt ?? m.createdAt).toISOString(),
      objet: m.subjectLine,
      contenu: m.content ?? "",
      sens: sortant ? "sortant" : "entrant",
    };
  });

  const lastIncoming = messages
    .filter((m) => m.direction === MessageDirection.incoming)
    .at(-1);

  return {
    orpheline:
      conversation.status === ConversationStatus.active && listening === null,
    statut: conversation.status,
    type: conversation.type,
    compte: {
      // Le compte ne porte pas de raison sociale : le nom du dirigeant tient
      // lieu d'identité tant que le profil n'en a pas.
      entreprise: `${account.firstName} ${account.lastName}`.trim(),
      secteurs: account.sectors,
      domaines: folders.map((f) => ({
        nom: f.name,
        description: f.description,
      })),
      instructionsGenerales: [],
      etiquettes: [],
      preferencesObservees: account.observedPreferences,
      sujetsOuverts: openSubjects.map((s) => ({
        reference: s.reference,
        titre: s.title,
      })),
    },
    conversation: {
      canal:
        conversation.type === ConversationType.email_subject
          ? "email"
          : "whatsapp",
      messages: projected,
    },
    dernierEntrant: lastIncoming
      ? {
          id: lastIncoming.id,
          adresse: lastIncoming.senderRaw,
          nom:
            lastIncoming.senderName ??
            (lastIncoming.senderContact
              ? displayContact(lastIncoming.senderContact)
              : null),
          objet: lastIncoming.subjectLine,
          contenu: lastIncoming.content ?? "",
        }
      : null,
  };
}

// ─────────────────────────────────────────────────────────────
// Le verdict — écrit sur la conversation, journalisé (M7.14)
// ─────────────────────────────────────────────────────────────

/** Catégories de bruit que le tri a le droit de poser (contrainte en base : jamais les deux autres). */
export const TRIAGE_NOISE_REASONS = [
  IgnoreReason.personal,
  IgnoreReason.advertising,
  IgnoreReason.automatic,
  IgnoreReason.prospecting,
  IgnoreReason.other,
] as const;

export const recordTriageVerdictSchema = z.object({
  conversationId: z.uuid(),
  /** Le message qui a déclenché le tri — porte l'entrée de journal. */
  messageId: z.uuid(),
  verdict: z.enum(TriageVerdict),
  /** Renseignée si et seulement si le verdict est « bruit » (contrainte en base). */
  noiseReason: z.enum(TRIAGE_NOISE_REASONS).optional().nullable(),
  confidence: z.enum(TriageConfidence),
  /** Une phrase, visible dans la liste à trier. */
  reason: z.string().trim().min(1).max(1000),
  /** D'où vient le verdict : du modèle, ou du filtre déterministe (zéro jeton). */
  source: z.enum(["model", "deterministic"]),
  /** La proposition d'origine, intégrale, conservée pour la boucle d'apprentissage (05 §9.1). */
  proposal: z.record(z.string(), z.unknown()).optional().nullable(),
  /** Nom de la règle déterministe qui a conclu, le cas échéant. */
  rule: z.string().trim().max(200).optional().nullable(),
});

export type RecordTriageVerdictInput = z.input<
  typeof recordTriageVerdictSchema
>;

const VERDICT_LABELS: Record<TriageVerdict, string> = {
  noise: "bruit",
  matter: "affaire",
  uncertain: "incertain",
};
const CONFIDENCE_LABELS: Record<TriageConfidence, string> = {
  high: "haute",
  medium: "moyenne",
  low: "basse",
};
const NOISE_LABELS: Record<IgnoreReason, string> = {
  personal: "personnel",
  advertising: "publicité",
  automatic: "automatique",
  prospecting: "prospection",
  not_my_role: "pas mon rôle",
  handled_elsewhere: "traité ailleurs",
  other: "autre",
};

/**
 * Dépose le verdict de tri sur la conversation (le DERNIER verdict, 02) et
 * journalise la proposition. Le verdict ne conditionne rien : la conversation
 * est rangée et lisible quel qu'il soit.
 */
export async function recordTriageVerdict(
  db: TenantDb,
  input: RecordTriageVerdictInput,
) {
  const data = recordTriageVerdictSchema.parse(input);
  const noiseReason =
    data.verdict === TriageVerdict.noise ? (data.noiseReason ?? null) : null;
  const now = new Date();
  return db.$transaction(async (tx) => {
    const { count } = await tx.conversation.updateMany({
      where: { id: data.conversationId },
      data: {
        triageVerdict: data.verdict,
        triageNoiseReason: noiseReason,
        triageConfidence: data.confidence,
        triageReason: data.reason,
        triagedAt: now,
      },
    });
    if (count === 0)
      throw new DomainError("NOT_FOUND", "Conversation introuvable.");
    const label =
      data.verdict === TriageVerdict.noise && noiseReason
        ? `${VERDICT_LABELS[data.verdict]} — ${NOISE_LABELS[noiseReason]}`
        : VERDICT_LABELS[data.verdict];
    await logEvent(tx as Tx, {
      entityType: "message",
      entityId: data.messageId,
      messageId: data.messageId,
      eventType: EVENT_TYPES.triageVerdict,
      title:
        data.source === "deterministic"
          ? `Tri : ${label} (règle, sans appel)`
          : `Tri : ${label} (confiance ${CONFIDENCE_LABELS[data.confidence]})`,
      description: data.reason,
      actor: Actor.ai,
      metadata: {
        conversationId: data.conversationId,
        verdict: data.verdict,
        noiseReason,
        confidence: data.confidence,
        reason: data.reason,
        source: data.source,
        rule: data.rule ?? null,
        proposal: data.proposal ?? null,
      },
    });
    return { triagedAt: now };
  });
}

// ─────────────────────────────────────────────────────────────
// Ouvrir ou rattacher — par les primitives du domaine, jamais à côté
// ─────────────────────────────────────────────────────────────

export const applyTriageMatterSchema = z.object({
  conversationId: z.uuid(),
  messageId: z.uuid(),
  /** Titre proposé ; à défaut, l'objet du fil (cas e-mail). */
  title: z.string().trim().min(1).max(200).optional().nullable(),
  /** Nom EXACT d'un domaine du compte, ou null. */
  folderName: z.string().trim().max(120).optional().nullable(),
  /** Nom libre quand aucun domaine ne convient (04 §10). */
  proposedFolder: z.string().trim().max(120).optional().nullable(),
  /** Référence d'un sujet ouvert que ce fil prolonge, ou null. */
  existingSubjectReference: z.string().trim().max(40).optional().nullable(),
  priority: z.enum(Priority).optional(),
});

export type ApplyTriageMatterInput = z.input<typeof applyTriageMatterSchema>;

export type ApplyTriageMatterResult = {
  action: "opened" | "attached";
  subjectId: string;
  reference: string;
  folderId: string | null;
  proposedFolder: string | null;
};

/**
 * Le tri a conclu « affaire » avec assez de confiance : ouvrir un sujet sur le
 * fil, ou le rattacher au sujet ouvert qu'il prolonge. E-MAIL SEULEMENT en
 * tranche 4 : le sujet EST le fil, ancre nulle (04 §3).
 *
 *   • Le domaine est résolu par son NOM, parmi les domaines actifs du compte —
 *     jamais « Général », purement documentaire (invariant n°17) : un nom
 *     inconnu ou refusé laisse le sujet sans domaine, avec le domaine proposé.
 *   • Le domaine résolu est posé sur les messages du fil (05 §1.1 ter) : c'est
 *     lui qui donne son domaine au sujet.
 *   • Un sujet existant introuvable ou fermé n'est pas une erreur : on ouvre.
 */
export async function applyTriageMatter(
  db: TenantDb,
  input: ApplyTriageMatterInput,
): Promise<ApplyTriageMatterResult> {
  const data = applyTriageMatterSchema.parse(input);

  const conversation = assertFound(
    await db.conversation.findFirst({
      where: { id: data.conversationId },
      select: { id: true, type: true },
    }),
    "Conversation",
  );
  if (conversation.type !== ConversationType.email_subject) {
    throw new DomainError(
      "VALIDATION",
      "Le tri automatique n'ouvre de sujet que sur un fil e-mail.",
    );
  }

  const folder = data.folderName
    ? await db.folder.findFirst({
        where: {
          isDefault: false,
          isActive: true,
          name: { equals: data.folderName, mode: "insensitive" },
        },
        select: { id: true },
      })
    : null;
  const folderId = folder?.id ?? null;
  const proposedFolder = folderId ? null : (data.proposedFolder ?? null);

  if (data.existingSubjectReference) {
    const existing = await db.subject.findFirst({
      where: {
        reference: data.existingSubjectReference,
        status: SubjectStatus.open,
      },
      select: { id: true, reference: true, folderId: true },
    });
    if (existing) {
      await attachEmailConversationToSubject(
        db,
        existing.id,
        conversation.id,
        Actor.ai,
      );
      await db.subject.updateMany({
        where: { id: existing.id },
        data: { lastActivityAt: new Date() },
      });
      return {
        action: "attached",
        subjectId: existing.id,
        reference: existing.reference,
        folderId: existing.folderId,
        proposedFolder: null,
      };
    }
  }

  if (folderId) {
    await db.message.updateMany({
      where: { conversationId: conversation.id, folderId: null },
      data: { folderId },
    });
  }

  const subject = await openSubjectOnConversation(db, {
    conversationId: conversation.id,
    anchorMessageId: null,
    title: data.title ?? undefined,
    folderId,
    createdByActor: Actor.ai,
    priority: data.priority,
  });

  if (proposedFolder) {
    await db.subject.updateMany({
      where: { id: subject.id },
      data: { proposedFolder },
    });
  }

  return {
    action: "opened",
    subjectId: subject.id,
    reference: subject.reference,
    folderId,
    proposedFolder,
  };
}

// ─────────────────────────────────────────────────────────────
// Le compteur — une entrée par sollicitation (M7.16), l'échec (M7.15)
// ─────────────────────────────────────────────────────────────

export const AI_SOLICITATION_METADATA_VERSION = 1;

export const logAiSolicitationSchema = z.object({
  sollicitation: z.string().trim().min(1).max(40),
  tier: z.string().trim().min(1).max(40),
  modele: z.string().trim().min(1).max(120),
  niveau: z.string().trim().min(1).max(20),
  jetons: z.object({
    entree: z.number().int().nonnegative(),
    cacheLecture: z.number().int().nonnegative(),
    cacheEcriture: z.number().int().nonnegative(),
    sortie: z.number().int().nonnegative(),
    raisonnement: z.number().int().nonnegative(),
  }),
  cout: z.object({
    eur: z.number().nonnegative(),
    usd: z.number().nonnegative(),
    version: z.string(),
  }),
  dureeMs: z.number().int().nonnegative(),
  reponseId: z.string().optional().nullable(),
  /** Le message qui a déclenché l'appel — clé de l'idempotence. */
  messageId: z.uuid().optional().nullable(),
  conversationId: z.uuid().optional().nullable(),
  subjectId: z.uuid().optional().nullable(),
});

export type LogAiSolicitationInput = z.input<typeof logAiSolicitationSchema>;

/**
 * Consigne un appel au modèle : sollicitation, tier, niveau de raisonnement,
 * jetons d'entrée / cache / sortie / raisonnement, coût converti en euros par la
 * table de tarifs versionnée (05 §10.6). C'est ce compteur qui alimentera le
 * disjoncteur (M14.5), pas la facture du fournisseur.
 */
export async function logAiSolicitation(
  db: TenantDb,
  input: LogAiSolicitationInput,
) {
  const data = logAiSolicitationSchema.parse(input);
  return logEvent(db as Tx, {
    entityType: "system",
    entityId: data.conversationId ?? data.subjectId ?? data.messageId ?? null,
    messageId: data.messageId ?? null,
    subjectId: data.subjectId ?? null,
    eventType: EVENT_TYPES.iaSollicitation,
    title: `Sollicitation « ${data.sollicitation} » — ${data.modele}`,
    description: `${data.cout.eur.toFixed(5)} € · ${data.dureeMs} ms`,
    actor: Actor.ai,
    metadata: {
      version: AI_SOLICITATION_METADATA_VERSION,
      sollicitation: data.sollicitation,
      tier: data.tier,
      modele: data.modele,
      niveau: data.niveau,
      jetons: data.jetons,
      cout: data.cout,
      dureeMs: data.dureeMs,
      reponseId: data.reponseId ?? null,
      conversationId: data.conversationId ?? null,
    },
  });
}

/**
 * Une sollicitation par message, jamais deux : vrai si un appel de cette
 * sollicitation a déjà été consigné pour ce message.
 */
export async function hasAiSolicitationForMessage(
  db: TenantDb,
  messageId: string,
  sollicitation: string,
): Promise<boolean> {
  const found = await db.eventLog.findFirst({
    where: {
      eventType: EVENT_TYPES.iaSollicitation,
      messageId,
      metadata: { path: ["sollicitation"], equals: sollicitation },
    },
    select: { id: true },
  });
  return found !== null;
}

/**
 * Le tri a échoué (modèle injoignable, sortie non conforme, erreur en base) :
 * la conversation reste orpheline, rien n'est inventé (M7.15). L'échec est
 * journalisé pour qu'on le voie — et pour qu'un message ne soit pas retenté à
 * l'infini si l'échec est structurel.
 */
export async function logTriageFailure(
  db: TenantDb,
  input: { conversationId: string; messageId: string; error: string },
) {
  return logEvent(db as Tx, {
    entityType: "message",
    entityId: input.messageId,
    messageId: input.messageId,
    eventType: EVENT_TYPES.triageFailed,
    title: "Tri interrompu — la conversation reste à trier",
    description: input.error.slice(0, 500),
    actor: Actor.system,
    metadata: { conversationId: input.conversationId },
  });
}
