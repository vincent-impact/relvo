import { z } from "zod";
import {
  AbsorptionStatus,
  Actor,
  ChannelType,
  KnowledgeKind,
  Priority,
  SubjectStatus,
  TaskKind,
  TaskStatus,
} from "../generated/prisma/enums";
import { MessageDirection } from "../generated/prisma/enums";
import type { Prisma, Subject, Task } from "../generated/prisma/client";
import type { TenantDb } from "../tenant";
import { cancelAction } from "./actions";
import type { Origine } from "./events";
import { deleteFolder, moveFolder } from "./folders";
import { createNote, deleteNote, updateNote } from "./knowledge";
import { getKpis } from "./queries";
import { formatSubjectReference } from "./reference";
import { createTask, deleteTask, reopenTask, updateTask } from "./tasks";
import {
  deleteSubject,
  updateSubject,
  updateSubjectPriority,
  updateSubjectStatus,
} from "./subjects";
import {
  loadAccountProjection,
  loadContactProjection,
  loadSubjectSheet,
  type StructurationContactProjection,
  type StructurationDomainProjection,
  type SubjectSheetProjection,
} from "./structuration";
import {
  dateNue,
  debutDuJourParis,
  horodatageParis,
  instantDebutJourParis,
  instantFinJourParis,
  jourParis,
} from "./temps";
import type { TriageAccountProjection } from "./triage";

// Domaine ÉCHANGE (M10) — ce que l'échange avec Relvo LIT en base pour parler
// au dirigeant depuis n'importe quelle page (05 §10.1, « l'échange charge le
// brief et la fiche de la page, et tire le reste par outils »). Les écritures
// de l'échange ne vivent pas ici : chaque outil appelle la fonction du domaine
// que l'écran appelle déjà (M10.8) — `createTask`, `updateSubjectStatus`…
//
// Mêmes règles que le tri et la structuration : des projections explicites,
// champ par champ, miroirs des types du module de contexte de l'application.
//
// LES RECHERCHES DE L'ÉCHANGE PRENNENT LES CRITÈRES QUE LE DIRIGEANT DIT — un
// jour, une personne, un domaine, un canal, un état —, jamais seulement un
// mot-clé (PITFALLS #68) : un outil à filtres figés pousse le modèle à inventer
// un mot (« 2026-10-19 », « email ») et à conclure qu'il n'y a rien. Chaque
// critère RÉDUIT ce qui remonte ; sans critère, les derniers éléments.

/** Miroir structurel de `BriefCompte` (application) : les compteurs du jour, pour l'échange seulement. */
export type BriefProjection = {
  sujetsOuverts: number;
  sujetsUrgents: { reference: string; titre: string; enAttente: boolean }[];
  tachesDuJour: number;
  tachesEnRetard: number;
  conversationsATrier: number;
  /** Messages reçus depuis minuit, heure française. */
  messagesRecusAujourdhui: number;
  /** Messages reçus sur les sept derniers jours. */
  messagesRecus7j: number;
};

export type EchangeProjection = {
  compte: TriageAccountProjection;
  /** Le domaine de l'affaire ouverte, avec ses connaissances lues ; null hors d'une fiche. */
  domaine: StructurationDomainProjection | null;
  brief: BriefProjection;
  /** La fiche de l'affaire ouverte (`/sujets/[id]`), ou null. */
  sujet: (SubjectSheetProjection["sujet"] & { id: string }) | null;
  /** La fiche du contact ouvert (`/contacts/[id]`), ou celui de l'affaire, ou null. */
  contact: StructurationContactProjection | null;
};

/** Sujets urgents poussés dans le brief : des titres, jamais des fiches. */
export const BRIEF_URGENT_MAX = 8;

/**
 * Le brief du compte, calculé par les indicateurs existants — jamais généré
 * (05 §10.1). Le même calcul que l'accueil et la page des affaires.
 */
export async function getBriefProjection(
  db: TenantDb,
  now: Date = new Date(),
): Promise<BriefProjection> {
  const [kpis, urgents, enRetard, recusAujourdhui, recus7j] = await Promise.all(
    [
      getKpis(db, { now }),
      db.subject.findMany({
        where: { status: SubjectStatus.open, priority: Priority.urgent },
        select: { reference: true, title: true, waitingForReply: true },
        orderBy: { lastActivityAt: "desc" },
        take: BRIEF_URGENT_MAX,
      }),
      db.task.count({
        where: {
          status: TaskStatus.open,
          startDate: { lt: debutDuJourParis(now) },
        },
      }),
      // « Reçu aujourd'hui » commence à minuit à Paris (PITFALLS #55), sur
      // l'horodatage de réception — pas sur l'instant d'ingestion.
      db.message.count({
        where: {
          direction: MessageDirection.incoming,
          receivedAt: { gte: instantDebutJourParis(jourParis(now)) },
        },
      }),
      db.message.count({
        where: {
          direction: MessageDirection.incoming,
          receivedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
        },
      }),
    ],
  );
  return {
    sujetsOuverts: kpis.openSubjects,
    sujetsUrgents: urgents.map((s) => ({
      reference: s.reference,
      titre: s.title,
      enAttente: s.waitingForReply,
    })),
    tachesDuJour: kpis.tasksToday,
    tachesEnRetard: enRetard,
    conversationsATrier: kpis.unsortedConversations,
    messagesRecusAujourdhui: recusAujourdhui,
    messagesRecus7j: recus7j,
  };
}

/**
 * Tout ce que le profil « échange » du contexte consomme, en une lecture :
 * le compte, le brief, et la fiche de la page d'origine — celle d'une affaire
 * (avec son domaine et son contact) ou celle d'un contact. Une page qui n'est
 * ni l'une ni l'autre ne charge que le compte et le brief.
 */
export async function getEchangeProjection(
  db: TenantDb,
  args: {
    accountId: string;
    subjectId?: string | null;
    contactId?: string | null;
    now?: Date;
  },
): Promise<EchangeProjection> {
  const now = args.now ?? new Date();
  if (args.subjectId) {
    const [sheet, brief] = await Promise.all([
      loadSubjectSheet(db, args.subjectId, { messages: 3 }),
      getBriefProjection(db, now),
    ]);
    return {
      compte: sheet.compte,
      domaine: sheet.domaine,
      brief,
      sujet: sheet.sujet,
      contact: sheet.contact,
    };
  }
  const [{ compte, domaine }, brief, contact] = await Promise.all([
    loadAccountProjection(db, args.accountId, null),
    getBriefProjection(db, now),
    args.contactId
      ? loadContactProjection(db, args.contactId)
      : Promise.resolve(null),
  ]);
  return { compte, domaine, brief, sujet: null, contact };
}

/**
 * Résout l'affaire que le dirigeant désigne dans l'échange : par sa référence
 * (« SUB-0142 », « 142 »), sinon par son titre, en cherchant d'abord parmi les
 * affaires ouvertes. Null si rien ne correspond — jamais une approximation
 * silencieuse : l'outil le dit, et le modèle demande.
 */
export async function resolveSubject(
  db: TenantDb,
  args: { reference?: string | null; titre?: string | null },
): Promise<{ id: string; reference: string; title: string } | null> {
  const select = { id: true, reference: true, title: true } as const;
  const ref = args.reference?.trim();
  if (ref) {
    const numero = ref.match(/(\d+)\s*$/)?.[1];
    const candidates = numero
      ? [ref.toUpperCase(), formatSubjectReference(Number(numero))]
      : [ref.toUpperCase()];
    const parRef = await db.subject.findFirst({
      where: { reference: { in: [...new Set(candidates)] } },
      select,
    });
    if (parRef) return parRef;
  }
  const titre = args.titre?.trim();
  if (titre) {
    const where = { title: { contains: titre, mode: "insensitive" as const } };
    return (
      (await db.subject.findFirst({
        where: { ...where, status: SubjectStatus.open },
        orderBy: { lastActivityAt: "desc" },
        select,
      })) ??
      (await db.subject.findFirst({
        where,
        orderBy: { lastActivityAt: "desc" },
        select,
      }))
    );
  }
  return null;
}

export type MessageTrouve = {
  id: string;
  conversationId: string;
  /** La conversation, telle que la liste la nomme. */
  conversation: string;
  subjectId: string | null;
  affaire: string | null;
  sens: "entrant" | "sortant";
  expediteur: string | null;
  /** Heure FRANÇAISE, « AAAA-MM-JJ HH:MM » : c'est ce que le modèle lit et ce qu'il répète (PITFALLS #55). */
  recuLe: string;
  objet: string | null;
  /** Les premiers mots du contenu, bornés. */
  extrait: string;
};

/** Messages rendus au plus par une recherche de l'échange. */
export const SEARCH_MESSAGES_MAX = 20;
/** Lus en base avant le tri par date de réception, puis coupés à `limite`. */
const SEARCH_MESSAGES_FETCH = 60;
const EXTRAIT_MAX = 240;

export type RechercheMessages = {
  /** Des mots de l'objet, du texte ou de l'expéditeur ; vide = pas de critère de texte. */
  recherche?: string | null;
  /** Bornes sur l'INSTANT de réception (ou d'envoi) — à calculer en heure française. */
  depuis?: Date | null;
  jusquA?: Date | null;
  /** Un nom ou une adresse d'expéditeur. */
  expediteur?: string | null;
  sens?: "entrant" | "sortant" | null;
  /** Le canal : e-mail ou WhatsApp. */
  canal?: "email" | "whatsapp" | null;
  /** Les messages d'UNE affaire. */
  subjectId?: string | null;
  /** true : seulement les messages reçus non lus. */
  nonLus?: boolean | null;
  limite?: number;
};

/** Les mots d'une recherche : chacun doit se trouver quelque part, pas la phrase entière. */
function motsDe(recherche: string | null | undefined): string[] {
  return (recherche ?? "")
    .trim()
    .split(/\s+/)
    .filter((m) => m.length > 1);
}

function contient(mot: string) {
  return { contains: mot, mode: "insensitive" as const };
}

/** L'instant d'un message : reçu, sinon envoyé, sinon ingéré. */
function instantDuMessage(m: {
  receivedAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}): Date {
  return m.receivedAt ?? m.sentAt ?? m.createdAt;
}

/**
 * La recherche de messages de l'échange (`search_messages`, 05 §11.6) :
 * mot à mot sur l'objet, le texte brut et l'expéditeur — pas de recherche
 * vectorielle (invariant 29) —, et des FILTRES que le modèle peut poser sans
 * inventer un mot-clé : une plage de jours, un expéditeur, un sens. Sans
 * aucun critère, les derniers messages. Les plus récents d'abord, par
 * instant de réception.
 */
export async function searchMessages(
  db: TenantDb,
  args: RechercheMessages,
): Promise<MessageTrouve[]> {
  // Chaque mot doit se trouver quelque part — objet, texte ou expéditeur —,
  // pas la phrase entière : « Karim sauce blanche » retrouve le message de
  // Karim qui parle de sauce blanche.
  const mots = motsDe(args.recherche);
  const take = Math.min(Math.max(args.limite ?? 10, 1), SEARCH_MESSAGES_MAX);
  const plage =
    args.depuis || args.jusquA
      ? {
          ...(args.depuis ? { gte: args.depuis } : {}),
          ...(args.jusquA ? { lte: args.jusquA } : {}),
        }
      : null;
  const expediteur = args.expediteur?.trim() || null;
  const rows = await db.message.findMany({
    where: {
      AND: [
        ...mots.map((mot) => ({
          OR: [
            { subjectLine: { contains: mot, mode: "insensitive" as const } },
            { content: { contains: mot, mode: "insensitive" as const } },
            { senderName: { contains: mot, mode: "insensitive" as const } },
          ],
        })),
        ...(expediteur
          ? [
              {
                OR: [
                  {
                    senderName: {
                      contains: expediteur,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    senderRaw: {
                      contains: expediteur,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            ]
          : []),
        ...(args.sens
          ? [
              {
                direction:
                  args.sens === "sortant"
                    ? MessageDirection.outgoing
                    : MessageDirection.incoming,
              },
            ]
          : []),
        ...(args.canal
          ? [
              {
                channel: {
                  is: {
                    type:
                      args.canal === "whatsapp"
                        ? ChannelType.whatsapp
                        : ChannelType.email,
                  },
                },
              },
            ]
          : []),
        ...(args.subjectId ? [{ subjectId: args.subjectId }] : []),
        ...(args.nonLus
          ? [{ readAt: null, direction: MessageDirection.incoming }]
          : []),
        // La plage porte sur l'instant du message : reçu, sinon envoyé, sinon ingéré.
        ...(plage
          ? [
              {
                OR: [
                  { receivedAt: plage },
                  { receivedAt: null, sentAt: plage },
                  { receivedAt: null, sentAt: null, createdAt: plage },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    take: SEARCH_MESSAGES_FETCH,
    select: {
      id: true,
      conversationId: true,
      subjectId: true,
      direction: true,
      senderName: true,
      senderRaw: true,
      createdAt: true,
      receivedAt: true,
      sentAt: true,
      subjectLine: true,
      content: true,
      conversation: { select: { title: true } },
      subject: { select: { title: true } },
    },
  });
  return rows
    .sort(
      (a, b) => instantDuMessage(b).getTime() - instantDuMessage(a).getTime(),
    )
    .slice(0, take)
    .map((m) => {
      const texte = (m.content ?? "").replace(/\s+/g, " ").trim();
      return {
        id: m.id,
        conversationId: m.conversationId,
        conversation: m.conversation.title,
        subjectId: m.subjectId,
        affaire: m.subject?.title ?? null,
        sens: m.direction === "outgoing" ? "sortant" : "entrant",
        expediteur: m.senderName ?? m.senderRaw,
        recuLe: horodatageParis(instantDuMessage(m)),
        objet: m.subjectLine,
        extrait:
          texte.length > EXTRAIT_MAX
            ? `${texte.slice(0, EXTRAIT_MAX)}…`
            : texte,
      };
    });
}

// ─────────────────────────────────────────────────────────────
// Les tâches, les affaires et la Mémoire, par critères (05 §11.6)
// ─────────────────────────────────────────────────────────────

/** Tâches rendues au plus par une recherche de l'échange. */
export const SEARCH_TASKS_MAX = 30;

export type RechercheTaches = {
  /** Des mots du titre ou de la description. */
  recherche?: string | null;
  /**
   * Des jours civils français « AAAA-MM-JJ », bornes incluses : sur
   * l'ÉCHÉANCE (date nue) d'une tâche ouverte, sur l'INSTANT où une tâche
   * faite a été cochée.
   */
  depuis?: string | null;
  jusquAu?: string | null;
  /** true : seulement les tâches sans échéance (flottantes). */
  sansDate?: boolean | null;
  /** true : les ouvertes dont l'échéance est passée, la plus récente d'abord. */
  enRetard?: boolean | null;
  type?: TaskKind | null;
  /** `ouvertes` (défaut) ou `faites`. */
  statut?: "ouvertes" | "faites" | null;
  subjectId?: string | null;
  limite?: number;
};

/**
 * Les tâches de l'échange (`list_tasks`) : une plage de jours que le modèle
 * calcule depuis la date du jour (« lundi », « la semaine prochaine »), les
 * tâches sans date — invisibles à tout filtre sur l'échéance —, un type, des
 * mots, les tâches faites. Les ouvertes se rendent par échéance, les
 * flottantes en dernier ; les faites, la plus récente d'abord.
 */
export async function searchTasks(
  db: TenantDb,
  args: RechercheTaches,
  now: Date = new Date(),
): Promise<Task[]> {
  const faites = args.statut === "faites";
  const take = Math.min(Math.max(args.limite ?? 20, 1), SEARCH_TASKS_MAX);
  const plage: Prisma.TaskWhereInput[] = [];
  if (args.depuis || args.jusquAu) {
    plage.push(
      faites
        ? {
            completedAt: {
              ...(args.depuis
                ? { gte: instantDebutJourParis(args.depuis) }
                : {}),
              ...(args.jusquAu
                ? { lte: instantFinJourParis(args.jusquAu) }
                : {}),
            },
          }
        : {
            startDate: {
              ...(args.depuis ? { gte: dateNue(args.depuis) } : {}),
              ...(args.jusquAu ? { lte: dateNue(args.jusquAu) } : {}),
            },
          },
    );
  }
  const enRetard = !faites && args.enRetard === true;
  const rows = await db.task.findMany({
    where: {
      status: faites ? TaskStatus.done : TaskStatus.open,
      ...(args.subjectId ? { subjectId: args.subjectId } : {}),
      ...(args.type ? { kind: args.type } : {}),
      AND: [
        ...motsDe(args.recherche).map((mot) => ({
          OR: [{ title: contient(mot) }, { description: contient(mot) }],
        })),
        ...plage,
        ...(!faites && args.sansDate ? [{ startDate: null }] : []),
        ...(enRetard ? [{ startDate: { lt: debutDuJourParis(now) } }] : []),
      ],
    },
    orderBy: faites
      ? [{ completedAt: "desc" }]
      : enRetard
        ? [{ startDate: "desc" }, { startTime: "desc" }]
        : [
            { startDate: { sort: "asc", nulls: "last" } },
            { startTime: { sort: "asc", nulls: "last" } },
            { createdAt: "desc" },
          ],
    take,
  });
  return rows;
}

/** Affaires rendues au plus par une recherche de l'échange. */
export const SEARCH_SUBJECTS_MAX = 20;

export type RechercheAffaires = {
  /** Des mots du titre, du descriptif, du résumé ou de la situation. */
  recherche?: string | null;
  /** `ouvertes` (défaut), `validees`, `fermees`, ou `toutes`. */
  statut?: "ouvertes" | "validees" | "fermees" | "toutes" | null;
  urgentes?: boolean | null;
  /** Celles qui attendent une réponse (marqueur « en attente »). */
  enAttente?: boolean | null;
  folderId?: string | null;
  contactId?: string | null;
  /** Des jours civils français, bornes incluses, sur la DERNIÈRE ACTIVITÉ. */
  depuis?: string | null;
  jusquAu?: string | null;
  limite?: number;
};

/**
 * Les affaires de l'échange (`list_subjects`) : par état, urgence, attente,
 * domaine, contact, mots, et par jours de dernière activité (« ce qui a bougé
 * cette semaine »). Les urgentes d'abord, puis la plus récente activité.
 */
export async function searchSubjects(
  db: TenantDb,
  args: RechercheAffaires,
): Promise<Subject[]> {
  const take = Math.min(Math.max(args.limite ?? 10, 1), SEARCH_SUBJECTS_MAX);
  const statut = args.statut ?? "ouvertes";
  const status =
    statut === "validees"
      ? SubjectStatus.validated
      : statut === "fermees"
        ? SubjectStatus.closed
        : statut === "toutes"
          ? undefined
          : SubjectStatus.open;
  return db.subject.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(args.urgentes ? { priority: Priority.urgent } : {}),
      ...(args.enAttente ? { waitingForReply: true } : {}),
      ...(args.folderId ? { folderId: args.folderId } : {}),
      ...(args.contactId ? { contactIds: { has: args.contactId } } : {}),
      ...(args.depuis || args.jusquAu
        ? {
            lastActivityAt: {
              ...(args.depuis
                ? { gte: instantDebutJourParis(args.depuis) }
                : {}),
              ...(args.jusquAu
                ? { lte: instantFinJourParis(args.jusquAu) }
                : {}),
            },
          }
        : {}),
      AND: motsDe(args.recherche).map((mot) => ({
        OR: [
          { title: contient(mot) },
          { description: contient(mot) },
          { summary: contient(mot) },
          { situationWhere: contient(mot) },
        ],
      })),
    },
    orderBy: [{ priority: "desc" }, { lastActivityAt: "desc" }],
    take,
  });
}

/** Connaissances rendues au plus par une recherche de l'échange. */
export const SEARCH_KNOWLEDGE_MAX = 20;
const EXTRAIT_MEMOIRE_MAX = 600;

export type RechercheMemoire = {
  /** Des mots du titre, du contenu, du résumé ou de l'étiquette. */
  recherche?: string | null;
  folderId?: string | null;
  /** `instructions` (les règles du dirigeant), `documents` (ce qu'il a déposé), ou les deux. */
  genre?: "instructions" | "documents" | null;
  limite?: number;
};

export type ConnaissanceTrouvee = {
  id: string;
  genre: "instruction" | "document";
  titre: string;
  domaine: string;
  folderId: string;
  /** false : l'instruction est désactivée, Relvo ne l'applique pas. */
  active: boolean;
  /** Le contenu d'une instruction (borné) ; le résumé de Relvo pour un document. */
  contenu: string | null;
  /** L'étiquette posée par Relvo sur un document, ou null. */
  etiquette: string | null;
};

/**
 * La Mémoire, par mots et par domaine (`search_knowledge`) : ce que le
 * contexte du tour ne porte qu'en partie — ses instructions sont plafonnées
 * et les documents d'un domaine ne s'y lisent que depuis une fiche. Une
 * instruction désactivée est rendue avec son état : le modèle ne l'applique
 * pas, mais il peut dire qu'elle existe.
 */
export async function searchKnowledge(
  db: TenantDb,
  args: RechercheMemoire,
): Promise<ConnaissanceTrouvee[]> {
  const take = Math.min(Math.max(args.limite ?? 10, 1), SEARCH_KNOWLEDGE_MAX);
  const rows = await db.knowledgeDocument.findMany({
    where: {
      folder: { is: { isActive: true } },
      ...(args.folderId ? { folderId: args.folderId } : {}),
      ...(args.genre === "instructions"
        ? { kind: KnowledgeKind.note }
        : args.genre === "documents"
          ? { kind: KnowledgeKind.file }
          : {}),
      AND: motsDe(args.recherche).map((mot) => ({
        OR: [
          { name: contient(mot) },
          { content: contient(mot) },
          { description: contient(mot) },
          { aiSummary: contient(mot) },
          { aiLabel: contient(mot) },
        ],
      })),
    },
    orderBy: [{ updatedAt: "desc" }],
    take,
    select: {
      id: true,
      kind: true,
      name: true,
      content: true,
      aiSummary: true,
      aiLabel: true,
      absorptionStatus: true,
      folderId: true,
      folder: { select: { name: true } },
    },
  });
  return rows.map((k) => {
    const note = k.kind === KnowledgeKind.note;
    const texte = (note ? k.content : k.aiSummary)?.replace(/\s+/g, " ").trim();
    return {
      id: k.id,
      genre: note ? "instruction" : "document",
      titre: k.name,
      domaine: k.folder.name,
      folderId: k.folderId,
      active: k.absorptionStatus === AbsorptionStatus.read,
      contenu: texte
        ? texte.length > EXTRAIT_MEMOIRE_MAX
          ? `${texte.slice(0, EXTRAIT_MEMOIRE_MAX)}…`
          : texte
        : null,
      etiquette: k.aiLabel,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// L'annulation d'un geste de l'échange (M10.10, 05 §11.6)
// ─────────────────────────────────────────────────────────────

const dateNueSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const heureNueSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .nullable();

/** Ce qu'il faut pour recréer ou remettre une tâche telle qu'elle était. */
export const tacheSnapshotSchema = z.object({
  subjectId: z.uuid().nullable(),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(5000).nullable(),
  kind: z.enum(TaskKind),
  startDate: dateNueSchema,
  startTime: heureNueSchema,
  endDate: dateNueSchema,
  endTime: heureNueSchema,
});
export type TacheSnapshot = z.infer<typeof tacheSnapshotSchema>;

const horodatage = z.string().datetime();

/**
 * Le DESCRIPTEUR D'ANNULATION que chaque bloc d'action du fil emporte : ce
 * qu'il faut pour défaire le geste par la même fonction du domaine que
 * l'écran, et l'instant du geste (`a`) — la fenêtre pendant laquelle le
 * bouton reste actif est tenue par l'écran, jamais ici : au-delà, le geste
 * reste réversible par les écrans habituels.
 */
export const annulationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tache"), id: z.uuid(), a: horodatage }),
  z.object({ type: z.literal("tache-cochee"), id: z.uuid(), a: horodatage }),
  z.object({
    type: z.literal("tache-modifiee"),
    id: z.uuid(),
    precedent: tacheSnapshotSchema,
    a: horodatage,
  }),
  z.object({
    type: z.literal("tache-supprimee"),
    precedent: tacheSnapshotSchema,
    a: horodatage,
  }),
  z.object({ type: z.literal("affaire"), id: z.uuid(), a: horodatage }),
  z.object({
    type: z.literal("statut"),
    id: z.uuid(),
    precedent: z.enum(SubjectStatus),
    a: horodatage,
  }),
  z.object({
    type: z.literal("priorite"),
    id: z.uuid(),
    precedent: z.enum(Priority),
    a: horodatage,
  }),
  z.object({
    type: z.literal("resume"),
    id: z.uuid(),
    precedent: z.string().nullable(),
    a: horodatage,
  }),
  z.object({ type: z.literal("brouillon"), actionId: z.uuid(), a: horodatage }),
  z.object({ type: z.literal("note"), id: z.uuid(), a: horodatage }),
  // Les dossiers (M23.7) : un dossier créé se retire, un dossier déplacé
  // revient sous son père, une affaire rangée retrouve son dossier.
  z.object({ type: z.literal("dossier"), id: z.uuid(), a: horodatage }),
  z.object({
    type: z.literal("dossier-deplace"),
    id: z.uuid(),
    precedent: z.uuid().nullable(),
    a: horodatage,
  }),
  z.object({
    type: z.literal("affaire-rangee"),
    id: z.uuid(),
    precedent: z.uuid().nullable(),
    a: horodatage,
  }),
  z.object({
    type: z.literal("note-modifiee"),
    id: z.uuid(),
    precedent: z.object({ name: z.string(), content: z.string().nullable() }),
    a: horodatage,
  }),
  z.object({
    type: z.literal("note-supprimee"),
    precedent: z.object({
      folderId: z.uuid(),
      name: z.string(),
      content: z.string().nullable(),
    }),
    a: horodatage,
  }),
]);
export type Annulation = z.infer<typeof annulationSchema>;

const CHAT: Origine = { source: "chat" };

function datesDuSnapshot(s: TacheSnapshot) {
  const heure = (d: string | null, h: string | null) =>
    d && h ? new Date(`${d}T${h}:00.000Z`) : null;
  return {
    startDate: s.startDate ? dateNue(s.startDate) : null,
    startTime: heure(s.startDate, s.startTime),
    endDate: s.endDate ? dateNue(s.endDate) : null,
    endTime: heure(s.endDate ?? s.startDate, s.endTime),
  };
}

/**
 * DÉFAIT un geste de l'échange, par la fonction du domaine que l'écran
 * appelle pour le même geste — journalisée avec la provenance `chat`. Une
 * tâche supprimée se recrée depuis son instantané (l'écran non plus ne sait
 * pas la ressusciter) ; une affaire ouverte dans l'échange se supprime.
 */
export async function defaireGeste(
  db: TenantDb,
  input: Annulation,
): Promise<{ fait: string }> {
  const g = annulationSchema.parse(input);
  switch (g.type) {
    case "tache":
      await deleteTask(db, g.id, CHAT);
      return { fait: "Tâche retirée." };
    case "tache-cochee":
      await reopenTask(db, g.id, CHAT);
      return { fait: "Tâche remise à faire." };
    case "tache-modifiee":
      await updateTask(
        db,
        g.id,
        {
          title: g.precedent.title,
          description: g.precedent.description,
          kind: g.precedent.kind,
          ...datesDuSnapshot(g.precedent),
        },
        CHAT,
      );
      return { fait: "Tâche remise comme avant." };
    case "tache-supprimee":
      await createTask(
        db,
        {
          subjectId: g.precedent.subjectId,
          title: g.precedent.title,
          description: g.precedent.description,
          kind: g.precedent.kind,
          sourceActor: Actor.user,
          ...datesDuSnapshot(g.precedent),
        },
        CHAT,
      );
      return { fait: "Tâche recréée." };
    case "affaire":
      await deleteSubject(db, g.id);
      return { fait: "Affaire retirée." };
    case "statut":
      await updateSubjectStatus(db, g.id, g.precedent, Actor.user, CHAT);
      return { fait: "État remis comme avant." };
    case "priorite":
      await updateSubjectPriority(db, g.id, g.precedent, Actor.user, CHAT);
      return { fait: "Priorité remise comme avant." };
    case "resume":
      await updateSubject(db, g.id, { summary: g.precedent }, CHAT);
      return { fait: "Résumé remis comme avant." };
    case "brouillon":
      await cancelAction(db, g.actionId, CHAT);
      return { fait: "Brouillon effacé." };
    case "note":
      await deleteNote(db, g.id, CHAT);
      return { fait: "Instruction retirée." };
    case "dossier":
      await deleteFolder(db, g.id);
      return { fait: "Dossier retiré." };
    case "dossier-deplace":
      await moveFolder(db, g.id, g.precedent, CHAT);
      return { fait: "Dossier remis à sa place." };
    case "affaire-rangee":
      await updateSubject(db, g.id, { folderId: g.precedent }, CHAT);
      return { fait: "Affaire remise dans son dossier." };
    case "note-modifiee":
      await updateNote(
        db,
        g.id,
        { name: g.precedent.name, content: g.precedent.content },
        CHAT,
      );
      return { fait: "Instruction remise comme avant." };
    case "note-supprimee":
      await createNote(
        db,
        {
          folderId: g.precedent.folderId,
          name: g.precedent.name,
          content: g.precedent.content,
        },
        CHAT,
      );
      return { fait: "Instruction recréée." };
  }
}
