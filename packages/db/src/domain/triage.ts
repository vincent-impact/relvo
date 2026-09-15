import { z } from "zod";
import {
  Actor,
  ConversationStatus,
  ConversationType,
  ChannelType,
  IgnoreReason,
  MessageDirection,
  Priority,
  SubjectStatus,
  TriageConfidence,
  TriageNature,
  TriageVerdict,
} from "../generated/prisma/enums";
import type { Prisma } from "../generated/prisma/client";
import type { TenantDb, Tx } from "../tenant";
import {
  countUnsortedConversations,
  findListeningSubjectForConversation,
} from "./conversations";
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
  /** Le dirigeant, nommé comme tel — jamais présenté comme « l'entreprise ». */
  dirigeant: string;
  /** Raison sociale ; le compte n'en porte pas encore. */
  entreprise: string | null;
  /** Adresses des canaux e-mail actifs : ce sur quoi le fil a été REÇU. */
  messageries: string[];
  secteurs: ("food" | "construction" | "other")[];
  domaines: { nom: string; description: string | null }[];
  instructionsGenerales: { titre: string; contenu: string }[];
  etiquettes: string[];
  preferencesObservees: string | null;
  /** Sujets ouverts récents, avec le marqueur « en attente d'une réponse » : c'est ce qui fait reconnaître un accusé. */
  sujetsOuverts: { reference: string; titre: string; enAttente: boolean }[];
};

/** Miroir structurel de `MessageContexte` (application). */
export type TriageMessageProjection = {
  expediteur: string;
  recuLe: string;
  objet: string | null;
  contenu: string;
  sens: "entrant" | "sortant";
};

/**
 * Le PROFIL DE L'EXPÉDITEUR — miroir structurel d'`ExpediteurContexte`
 * (application). Tout ce que la base sait de lui, SANS appel : c'est notre
 * meilleure information, et elle décide avant le modèle quand elle le peut
 * (05 §9.5), rétrécit ce qu'on lui montre, et pèse dans son avis.
 */
export type TriageSenderProfile = {
  adresse: string | null;
  /** Un contact du carnet porte cette adresse. */
  connu: boolean;
  nom: string | null;
  entreprise: string | null;
  /** Valeur de `ContactRole`, ou null. */
  role: string | null;
  /** Sujets nés de ses fils, tous statuts confondus. */
  sujetsParSesFils: number;
  sujetsValides: number;
  /** Le domaine le plus fréquent de ses sujets. */
  domaineHabituel: string | null;
  /** Ses conversations ignorées, par raison — l'antécédent qui fait taire une source (05 §9.5). */
  antecedentsTri: { raison: IgnoreReason; nombre: number }[];
  /** Ses sujets OUVERTS, avec l'attente : c'est ce qui fait rattacher sans appel. */
  sujetsEnCours: {
    reference: string;
    titre: string;
    enAttente: boolean;
    /** ISO 8601, ou null. */
    derniereActiviteLe: string | null;
  }[];
  /** Ses derniers sujets VALIDÉS — la fiche contact de la structuration les montre (05 §10.1). */
  sujetsValidesRecents: { reference: string; titre: string }[];
};

/** Derniers sujets validés d'un expéditeur poussés dans sa fiche. */
export const SENDER_VALIDATED_SUBJECTS_MAX = 5;

export type TriageProjection = {
  /** Aucun sujet n'écoute ce fil, et il n'est pas en sourdine. */
  orpheline: boolean;
  statut: ConversationStatus;
  type: ConversationType;
  compte: TriageAccountProjection;
  expediteur: TriageSenderProfile;
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

/**
 * Titres de sujets ouverts poussés au tri — des titres, jamais des fiches
 * (05 §1.2). La liste est CHOISIE, pas tronquée : les sujets ouverts avec
 * l'expéditeur, puis ceux qui attendent une réponse, puis les plus récents
 * jusqu'à ce plafond. Moins de jetons, et la bonne chance de rattacher au bon.
 */
export const TRIAGE_OPEN_SUBJECTS_MAX = 20;
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

/** Où-clause « les conversations de cet expéditeur », par contact si connu, sinon par adresse. */
function senderConversationsWhere(
  contactId: string | null,
  adresse: string | null,
): Prisma.ConversationWhereInput | null {
  if (contactId) {
    return { OR: [{ contactId }, { contactIds: { has: contactId } }] };
  }
  const a = adresse?.trim().toLowerCase();
  if (!a) return null;
  return {
    OR: [
      { interlocutorRaw: { equals: a, mode: "insensitive" } },
      { participantsRaw: { has: a } },
    ],
  };
}

/**
 * Le profil de l'expéditeur, en UNE requête sur ses conversations (la
 * courante exclue, quand il y en a une) : sujets nés de ses fils, domaine
 * habituel, ignorances par raison, sujets ouverts avec lui et leur attente,
 * derniers sujets validés. Sert au tri (par le fil) et à la structuration
 * (par le contact du sujet).
 */
export async function getSenderProfile(
  db: TenantDb,
  args: {
    /** Le fil en cours de tri, exclu du décompte ; null hors tri. */
    conversationId: string | null;
    contactId: string | null;
    adresse: string | null;
    contact?: {
      firstName: string | null;
      lastName: string;
      company: string | null;
      role: string | null;
    } | null;
  },
): Promise<TriageSenderProfile> {
  const where = senderConversationsWhere(args.contactId, args.adresse);
  const base: TriageSenderProfile = {
    adresse: args.adresse,
    connu: args.contactId !== null,
    nom: args.contact ? displayContactName(args.contact) : null,
    entreprise: args.contact?.company ?? null,
    role: args.contact?.role ?? null,
    sujetsParSesFils: 0,
    sujetsValides: 0,
    domaineHabituel: null,
    antecedentsTri: [],
    sujetsEnCours: [],
    sujetsValidesRecents: [],
  };
  if (!where) return base;

  const conversations = await db.conversation.findMany({
    where: args.conversationId
      ? { AND: [where, { id: { not: args.conversationId } }] }
      : where,
    select: {
      status: true,
      ignoreReason: true,
      subjects: {
        select: {
          subject: {
            select: {
              id: true,
              reference: true,
              title: true,
              status: true,
              waitingForReply: true,
              lastActivityAt: true,
              folder: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const parRaison = new Map<IgnoreReason, number>();
  const sujets = new Map<
    string,
    (typeof conversations)[number]["subjects"][number]["subject"]
  >();
  for (const c of conversations) {
    if (c.status === ConversationStatus.ignored && c.ignoreReason) {
      parRaison.set(c.ignoreReason, (parRaison.get(c.ignoreReason) ?? 0) + 1);
    }
    for (const l of c.subjects) sujets.set(l.subject.id, l.subject);
  }
  const parDomaine = new Map<string, number>();
  for (const s of sujets.values()) {
    if (s.folder)
      parDomaine.set(s.folder.name, (parDomaine.get(s.folder.name) ?? 0) + 1);
  }
  const domaineHabituel =
    [...parDomaine.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"),
    )[0]?.[0] ?? null;

  return {
    ...base,
    sujetsParSesFils: sujets.size,
    sujetsValides: [...sujets.values()].filter(
      (s) => s.status === SubjectStatus.validated,
    ).length,
    domaineHabituel,
    antecedentsTri: [...parRaison.entries()]
      .map(([raison, nombre]) => ({ raison, nombre }))
      .sort((a, b) => b.nombre - a.nombre || a.raison.localeCompare(b.raison)),
    sujetsEnCours: [...sujets.values()]
      .filter((s) => s.status === SubjectStatus.open)
      .sort((a, b) => a.reference.localeCompare(b.reference))
      .map((s) => ({
        reference: s.reference,
        titre: s.title,
        enAttente: s.waitingForReply,
        derniereActiviteLe: s.lastActivityAt?.toISOString() ?? null,
      })),
    sujetsValidesRecents: [...sujets.values()]
      .filter((s) => s.status === SubjectStatus.validated)
      .sort(
        (a, b) =>
          (b.lastActivityAt?.getTime() ?? 0) -
            (a.lastActivityAt?.getTime() ?? 0) ||
          b.reference.localeCompare(a.reference),
      )
      .slice(0, SENDER_VALIDATED_SUBJECTS_MAX)
      .map((s) => ({ reference: s.reference, titre: s.title })),
  };
}

function displayContactName(c: {
  firstName: string | null;
  lastName: string;
}): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
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

  const [folders, openSubjects, mailboxes, listening, oldest, latest] =
    await Promise.all([
      db.folder.findMany({
        where: { isActive: true },
        select: { name: true, description: true },
        orderBy: { name: "asc" },
      }),
      db.subject.findMany({
        where: { status: SubjectStatus.open },
        select: { reference: true, title: true, waitingForReply: true },
        orderBy: [
          { waitingForReply: "desc" },
          { lastActivityAt: "desc" },
          { createdAt: "desc" },
        ],
        take: TRIAGE_OPEN_SUBJECTS_MAX,
      }),
      db.channel.findMany({
        where: { type: ChannelType.email, isActive: true },
        select: { identifier: true },
        orderBy: { identifier: "asc" },
      }),
      findListeningSubjectForConversation(db, conversationId),
      db.message.findMany({
        where: { conversationId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 1,
        include: {
          senderContact: {
            select: {
              firstName: true,
              lastName: true,
              company: true,
              role: true,
            },
          },
        },
      }),
      db.message.findMany({
        where: { conversationId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: TRIAGE_LAST_MESSAGES,
        include: {
          senderContact: {
            select: {
              firstName: true,
              lastName: true,
              company: true,
              role: true,
            },
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

  const expediteur = await getSenderProfile(db, {
    conversationId,
    contactId: lastIncoming?.senderContactId ?? null,
    adresse: lastIncoming?.senderRaw ?? null,
    contact: lastIncoming?.senderContact
      ? {
          firstName: lastIncoming.senderContact.firstName,
          lastName: lastIncoming.senderContact.lastName,
          company: lastIncoming.senderContact.company,
          role: lastIncoming.senderContact.role,
        }
      : null,
  });

  // Les sujets poussés au tri : ceux de l'expéditeur d'abord, puis ceux qui
  // attendent une réponse, puis les plus récents — sans doublon, plafonnés.
  const sujetsOuverts = new Map<
    string,
    { reference: string; titre: string; enAttente: boolean }
  >();
  for (const s of expediteur.sujetsEnCours) {
    sujetsOuverts.set(s.reference, {
      reference: s.reference,
      titre: s.titre,
      enAttente: s.enAttente,
    });
  }
  for (const s of openSubjects) {
    if (sujetsOuverts.size >= TRIAGE_OPEN_SUBJECTS_MAX) break;
    if (!sujetsOuverts.has(s.reference)) {
      sujetsOuverts.set(s.reference, {
        reference: s.reference,
        titre: s.title,
        enAttente: s.waitingForReply,
      });
    }
  }

  return {
    orpheline:
      conversation.status === ConversationStatus.active && listening === null,
    statut: conversation.status,
    type: conversation.type,
    compte: {
      dirigeant: `${account.firstName} ${account.lastName}`.trim(),
      // Le compte ne porte pas encore de raison sociale.
      entreprise: null,
      messageries: mailboxes.map((c) => c.identifier),
      secteurs: account.sectors,
      domaines: folders.map((f) => ({
        nom: f.name,
        description: f.description,
      })),
      instructionsGenerales: [],
      etiquettes: [],
      preferencesObservees: account.observedPreferences,
      sujetsOuverts: [...sujetsOuverts.values()],
    },
    expediteur,
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
/**
 * La raison d'ignorance qui dérive de la NATURE de l'avis, quand c'est Relvo
 * qui fait taire : c'est ce que l'utilisateur lit dans « Ignorées ».
 */
export const IGNORE_REASON_OF_NATURE: Record<TriageNature, IgnoreReason> = {
  advertising: IgnoreReason.advertising,
  automatic: IgnoreReason.automatic,
  personal: IgnoreReason.personal,
  professional: IgnoreReason.other,
};

export const recordTriageVerdictSchema = z.object({
  conversationId: z.uuid(),
  /** Le message qui a déclenché le tri — porte l'entrée de journal. */
  messageId: z.uuid(),
  /** L'ACTION : à traiter (matter), à considérer (uncertain), rien à faire (noise). */
  verdict: z.enum(TriageVerdict),
  /** La NATURE, toujours posée par le modèle ; le filtre déterministe ne connaît que la publicité. */
  nature: z.enum(TriageNature).optional().nullable(),
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
  noise: "rien à faire",
  matter: "à traiter",
  uncertain: "à considérer",
};
const CONFIDENCE_LABELS: Record<TriageConfidence, string> = {
  high: "haute",
  medium: "moyenne",
  low: "basse",
};
const NATURE_LABELS: Record<TriageNature, string> = {
  professional: "professionnel",
  advertising: "publicité",
  automatic: "automatique",
  personal: "personnel",
};

/**
 * Dépose l'avis de tri sur la conversation (le DERNIER avis, 02) et journalise
 * la proposition. L'avis ne conditionne rien : la conversation est rangée et
 * lisible quel qu'il soit.
 */
export async function recordTriageVerdict(
  db: TenantDb,
  input: RecordTriageVerdictInput,
) {
  const data = recordTriageVerdictSchema.parse(input);
  const nature = data.nature ?? null;
  const now = new Date();
  return db.$transaction(async (tx) => {
    const { count } = await tx.conversation.updateMany({
      where: { id: data.conversationId },
      data: {
        triageVerdict: data.verdict,
        triageNature: nature,
        triageConfidence: data.confidence,
        triageReason: data.reason,
        triagedAt: now,
      },
    });
    if (count === 0)
      throw new DomainError("NOT_FOUND", "Conversation introuvable.");
    const label = nature
      ? `${VERDICT_LABELS[data.verdict]} · ${NATURE_LABELS[nature]}`
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
        nature,
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
 * Une structuration par sujet, jamais deux : vrai si un appel de cette
 * sollicitation a déjà été consigné pour ce sujet.
 */
export async function hasAiSolicitationForSubject(
  db: TenantDb,
  subjectId: string,
  sollicitation: string,
): Promise<boolean> {
  const found = await db.eventLog.findFirst({
    where: {
      eventType: EVENT_TYPES.iaSollicitation,
      subjectId,
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

// ─────────────────────────────────────────────────────────────
// Les pastilles — ce que Relvo a fait en l'absence de l'utilisateur
// ─────────────────────────────────────────────────────────────

/** Les deux onglets de Conversations qui se « voient » : un flux, pas un stock. */
export type SeenConversationFilter = "followed" | "ignored";

export type ConversationBadges = {
  /** STOCK : toutes les conversations sans sujet — se vide en triant. */
  unsorted: number;
  /** FLUX : sujets ouverts ou rattachements par Relvo depuis le dernier passage. */
  followed: number;
  /** FLUX : conversations que Relvo a fait taire depuis le dernier passage. */
  ignored: number;
};

/**
 * Les trois pastilles du sélecteur de Conversations. Une seule règle de
 * lecture : le chiffre dit CE QUI ATTEND l'utilisateur ici. Sur « Sans sujet »
 * c'est un travail, le résidu de Relvo — le chiffre ne tombe que quand le tri
 * est fait. Sur « Suivies » et « Ignorées » c'est un coup d'œil sur ce que
 * Relvo a rangé — le chiffre tombe quand l'onglet a été vu. Un geste de
 * l'utilisateur ne bouge jamais les deux flux : ils ne comptent que Relvo.
 */
export async function getConversationBadges(
  db: TenantDb,
  accountId: string,
): Promise<ConversationBadges> {
  const seen = await db.account.findUnique({
    where: { id: accountId },
    select: { followedSeenAt: true, ignoredSeenAt: true },
  });
  const followedSince = seen?.followedSeenAt ?? undefined;
  const ignoredSince = seen?.ignoredSeenAt ?? undefined;
  const [unsorted, opened, attached, ignored] = await Promise.all([
    countUnsortedConversations(db),
    db.subject.count({
      where: {
        createdByActor: Actor.ai,
        ...(followedSince ? { createdAt: { gt: followedSince } } : {}),
      },
    }),
    db.eventLog.count({
      where: {
        eventType: EVENT_TYPES.conversationAttached,
        actor: Actor.ai,
        ...(followedSince ? { createdAt: { gt: followedSince } } : {}),
      },
    }),
    db.conversation.count({
      where: {
        status: ConversationStatus.ignored,
        ignoredByActor: Actor.ai,
        ...(ignoredSince ? { triagedAt: { gt: ignoredSince } } : {}),
      },
    }),
  ]);
  return { unsorted, followed: opened + attached, ignored };
}

/**
 * L'utilisateur a vu l'onglet : la pastille tombe. Une visite n'est pas une
 * décision — rien n'est journalisé. `Account` n'est pas scopé par le client
 * tenant, d'où l'identifiant explicite.
 */
export async function markConversationFilterSeen(
  db: TenantDb,
  accountId: string,
  filter: SeenConversationFilter,
  at: Date = new Date(),
): Promise<void> {
  await db.account.update({
    where: { id: accountId },
    data:
      filter === "followed" ? { followedSeenAt: at } : { ignoredSeenAt: at },
  });
}
