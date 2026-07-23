import type { Subject, Task } from "../generated/prisma/client";
import {
  ActionStatus,
  MessageDirection,
  MessageStatus,
  Priority,
  TaskStatus,
} from "../generated/prisma/enums";
import { Actor, SubjectStatus } from "../generated/prisma/enums";
import type { TenantDb } from "../tenant";
import { contactDisplayName } from "./contacts";
import { countUnsortedConversations } from "./conversations";
import { cursorArgs, paginationSchema, toPage } from "./pagination";

// Requêtes d'agrégation (M3.13). Lectures seules : KPIs de l'Accueil, fil des
// ouverts. Toutes scopées par le client tenant.

// « Hors fil principal » : la fenêtre de travail est refermée — validée (travail
// fait) ou fermée (sujet écarté). Seul `open` alimente le fil et la mémoire.
const CLOSED_STATUSES = [SubjectStatus.validated, SubjectStatus.closed];

function dayBounds(now: Date): { start: Date; next: Date } {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start, next };
}

export type Kpis = {
  /** Sujets critiques non clos (drapeau urgent rare — invariant n°8). */
  urgentSubjects: number;
  /** Sujets non clos au statut `new` (jamais ouverts) → marqueur « Nouveaux ». */
  newSubjects: number;
  openSubjects: number;
  /** Tâches ouvertes dont l'échéance est aujourd'hui. */
  tasksToday: number;
  /** Total des tâches ouvertes (contexte sous « Tâches aujourd'hui »). */
  openTasksTotal: number;
  /**
   * KPI « Sans sujet » de la page Sujets — compte des CONVERSATIONS actives dont
   * le dernier message n'a pas de sujet (M6bis), et NON PLUS des messages :
   * c'est la conversation qui sollicite l'utilisateur, pas le message isolé.
   */
  unsortedConversations: number;
  /** Messages écartés par Relvo (status `ignored`) → KPI « Messages ignorés » (Sujets). */
  ignoredMessages: number;
  /** % de tâches proposées par Relvo (source_actor=ai), ou null si aucune tâche. */
  relvoAssistRate: number | null;
};

/**
 * KPIs du bandeau « Vue du jour » de l'Accueil (Urgents / Nouveaux / Ouverts /
 * Tâches aujourd'hui). Les rendez-vous ne sont plus un KPI (l'agenda s'en charge).
 */
export async function getKpis(
  db: TenantDb,
  opts: { now?: Date } = {},
): Promise<Kpis> {
  const now = opts.now ?? new Date();
  const { start, next } = dayBounds(now);

  const [
    urgentSubjects,
    newSubjects,
    openSubjects,
    tasksToday,
    openTasksTotal,
    unsortedConversations,
    aiTasks,
    totalTasks,
    ignoredMessages,
  ] = await Promise.all([
    db.subject.count({
      where: {
        priority: Priority.urgent,
        status: { notIn: CLOSED_STATUSES },
      },
    }),
    db.subject.count({
      // « Nouveaux » = sujets ouverts jamais consultés (marqueur dérivé).
      where: { status: { notIn: CLOSED_STATUSES }, lastOpenedAt: null },
    }),
    db.subject.count({ where: { status: { notIn: CLOSED_STATUSES } } }),
    db.task.count({
      where: {
        status: TaskStatus.open,
        startDate: { gte: start, lt: next },
      },
    }),
    db.task.count({ where: { status: TaskStatus.open } }),
    countUnsortedConversations(db),
    db.task.count({
      where: { sourceActor: Actor.ai, status: { not: TaskStatus.deleted } },
    }),
    db.task.count({ where: { status: { not: TaskStatus.deleted } } }),
    db.message.count({ where: { status: MessageStatus.ignored } }),
  ]);

  return {
    urgentSubjects,
    newSubjects,
    openSubjects,
    tasksToday,
    openTasksTotal,
    unsortedConversations,
    ignoredMessages,
    relvoAssistRate:
      totalTasks === 0 ? null : Math.round((aiTasks / totalTasks) * 100),
  };
}

/**
 * Tâches datées des `days` prochains jours (agenda de l'Accueil + Planning).
 * Renvoie la tâche + le sujet/dossier porteur (pour le code couleur par Dossier).
 */
export async function getUpcomingTasks(
  db: TenantDb,
  opts: { now?: Date; days?: number } = {},
) {
  const now = opts.now ?? new Date();
  const { start } = dayBounds(now);
  const horizon = new Date(start);
  horizon.setUTCDate(horizon.getUTCDate() + (opts.days ?? 3));

  return db.task.findMany({
    where: {
      status: { not: TaskStatus.deleted },
      startDate: { gte: start, lt: horizon },
    },
    orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      title: true,
      startDate: true,
      startTime: true,
      subject: {
        select: {
          id: true,
          reference: true,
          folder: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
}

/**
 * Fil des OUVERTS : tous les sujets non clos (`open`), **urgents en tête**
 * (priority desc) puis dernière activité. Sert l'onglet « Ouverts » du fil et le
 * brief Accueil (limit court → les plus prioritaires). Paginé par curseur.
 */
export async function getOpenFeed(
  db: TenantDb,
  opts: { cursor?: string; limit?: number } = {},
) {
  const { limit } = paginationSchema.parse(opts);
  const { _limit, ...args } = cursorArgs(opts);
  const rows = await db.subject.findMany({
    ...args,
    where: { status: { notIn: CLOSED_STATUSES } },
    orderBy: [{ priority: "desc" }, { lastActivityAt: "desc" }],
  });
  return toPage(rows, limit);
}

// ── Tâches (page Accueil = plan d'action) ────────────────────────────────────
// Quatre partitions DISJOINTES des tâches ouvertes, dérivées de start_date/time :
//   RDV       = aujourd'hui AVEC heure        (start_date = today, start_time ≠ null)
//   today     = aujourd'hui SANS heure        (start_date = today, start_time = null)
//   overdue   = échéance avant aujourd'hui    (start_date < today) — granularité JOUR
//   untriaged = sans date (« à trier »)       (start_date = null)

/** Les 4 compteurs de la barre KPI Tâches (Accueil). */
export async function getTaskKpis(db: TenantDb, now: Date = new Date()) {
  const { start, next } = dayBounds(now);
  const open = { status: TaskStatus.open };
  const [rdv, today, overdue, untriaged] = await Promise.all([
    db.task.count({
      where: {
        ...open,
        startDate: { gte: start, lt: next },
        startTime: { not: null },
      },
    }),
    db.task.count({
      where: { ...open, startDate: { gte: start, lt: next }, startTime: null },
    }),
    db.task.count({ where: { ...open, startDate: { lt: start } } }),
    db.task.count({ where: { ...open, startDate: null } }),
  ]);
  return { rdv, today, overdue, untriaged };
}

/** Tâches en retard (ouvertes, échéance avant aujourd'hui), plus anciennes d'abord. */
export async function getOverdueTasks(
  db: TenantDb,
  opts: { now?: Date; limit?: number } = {},
) {
  const { start } = dayBounds(opts.now ?? new Date());
  return db.task.findMany({
    where: { status: TaskStatus.open, startDate: { lt: start } },
    orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
    take: opts.limit ?? 50,
  });
}

/** Tâches « à trier » (ouvertes, sans date), les plus récentes d'abord. */
export async function getUntriagedTasks(
  db: TenantDb,
  opts: { limit?: number } = {},
) {
  return db.task.findMany({
    where: { status: TaskStatus.open, startDate: null },
    orderBy: [{ createdAt: "desc" }],
    take: opts.limit ?? 50,
  });
}

/**
 * Métadonnées d'affichage d'une tâche pour les listes de l'Accueil : le **titre
 * du sujet en clair** (impératif produit), le contact, le domaine, l'urgence
 * HÉRITÉE du sujet, et le marqueur dérivé « en retard ». Résolu en lot.
 */
export type EnrichedTask = {
  task: Task;
  /** Sujet rattaché, ou null (une tâche peut ne pas avoir de sujet). */
  subjectId: string | null;
  subjectTitle: string;
  subjectReference: string;
  /** Urgence héritée du sujet (le drapeau vit sur le Subject, pas la Task). */
  urgent: boolean;
  folderSlug: string | null;
  /** Premier contact rattaché au sujet, ou null. */
  contactName: string | null;
  /** Tâche datée dont l'échéance est passée (granularité jour). */
  overdue: boolean;
};

export async function enrichTasks(
  db: TenantDb,
  tasks: Task[],
  now: Date = new Date(),
): Promise<EnrichedTask[]> {
  if (tasks.length === 0) return [];
  const { start } = dayBounds(now);
  const subjectIds = [
    ...new Set(
      tasks.map((t) => t.subjectId).filter((id): id is string => id != null),
    ),
  ];
  const subjects = await db.subject.findMany({
    where: { id: { in: subjectIds } },
    select: {
      id: true,
      title: true,
      reference: true,
      priority: true,
      contactIds: true,
      folder: { select: { slug: true } },
    },
  });
  const subById = new Map(subjects.map((s) => [s.id, s]));
  const contactIds = [...new Set(subjects.flatMap((s) => s.contactIds))];
  const contacts = contactIds.length
    ? await db.contact.findMany({
        where: { id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const nameById = new Map(contacts.map((c) => [c.id, contactDisplayName(c)]));

  return tasks.map((task) => {
    const s = task.subjectId ? subById.get(task.subjectId) : undefined;
    const firstContactId = s?.contactIds[0];
    return {
      task,
      subjectId: task.subjectId,
      subjectTitle: s?.title ?? "",
      subjectReference: s?.reference ?? "",
      urgent: s?.priority === Priority.urgent,
      folderSlug: s?.folder?.slug ?? null,
      contactName: firstContactId
        ? (nameById.get(firstContactId) ?? null)
        : null,
      overdue: task.startDate != null && task.startDate < start,
    };
  });
}

/**
 * Métadonnées d'affichage d'un sujet (marqueurs cumulables dérivés). Calculées
 * en lot pour un ensemble de sujets — alimente la SubjectCard (feed, Accueil,
 * generative UI). Le formatage des dates relatives reste côté UI (locale).
 */
export type EnrichedSubject = {
  subject: Subject;
  /** Noms des contacts rattachés (résolus depuis contactIds). */
  contactNames: string[];
  /** Tâches ouvertes (tous acteurs) → marqueur « À faire ». */
  openTaskCount: number;
  /** Suggestions de Relvo en attente : tâches IA ouvertes + actions ouvertes. */
  suggestionCount: number;
  /** Messages entrants non lus (reçus après la dernière ouverture du sujet). */
  unreadCount: number;
  attachmentCount: number;
  /** Avancement 0..1 (tâches faites / total non supprimées), ou null si aucune. */
  progress: number | null;
  /** Nombre total de tâches (non supprimées) — dénominateur de la progress bar. */
  taskTotal: number;
  /** Tâches terminées — numérateur de la progress bar. */
  taskDone: number;
  /** Slug du dossier de rattachement (rail coloré / icône de domaine), ou null. */
  folderSlug: string | null;
  /** Nom du dossier de rattachement, ou null. */
  folderName: string | null;
  /** Clé de couleur STOCKÉE sur le dossier (logo personnalisé), ou null. */
  folderColor: string | null;
  /** Clé d'icône STOCKÉE sur le dossier, ou null. */
  folderIcon: string | null;
};

export async function enrichSubjects(
  db: TenantDb,
  subjects: Subject[],
): Promise<EnrichedSubject[]> {
  if (subjects.length === 0) return [];
  const ids = subjects.map((s) => s.id);
  const contactIds = [...new Set(subjects.flatMap((s) => s.contactIds))];
  const folderIds = [
    ...new Set(
      subjects.map((s) => s.folderId).filter((id): id is string => !!id),
    ),
  ];

  const [contacts, folders, tasks, openActions, attachments, incoming] =
    await Promise.all([
      contactIds.length
        ? db.contact.findMany({
            where: { id: { in: contactIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : Promise.resolve(
            [] as { id: string; firstName: string | null; lastName: string }[],
          ),
      folderIds.length
        ? db.folder.findMany({
            where: { id: { in: folderIds } },
            select: {
              id: true,
              name: true,
              slug: true,
              color: true,
              icon: true,
            },
          })
        : Promise.resolve(
            [] as {
              id: string;
              name: string;
              slug: string;
              color: string | null;
              icon: string | null;
            }[],
          ),
      db.task.findMany({
        where: { subjectId: { in: ids }, status: { not: TaskStatus.deleted } },
        select: { subjectId: true, status: true, sourceActor: true },
      }),
      db.action.findMany({
        where: { subjectId: { in: ids }, status: ActionStatus.open },
        select: { subjectId: true },
      }),
      db.attachment.findMany({
        where: { subjectId: { in: ids } },
        select: { subjectId: true },
      }),
      db.message.findMany({
        where: { subjectId: { in: ids }, direction: MessageDirection.incoming },
        select: { subjectId: true, receivedAt: true },
      }),
    ]);

  const nameById = new Map(contacts.map((c) => [c.id, contactDisplayName(c)]));
  const folderById = new Map(folders.map((f) => [f.id, f]));

  return subjects.map((subject) => {
    const folder = subject.folderId ? folderById.get(subject.folderId) : null;
    const subTasks = tasks.filter((t) => t.subjectId === subject.id);
    const openTasks = subTasks.filter((t) => t.status === TaskStatus.open);
    const aiOpenTasks = openTasks.filter((t) => t.sourceActor === Actor.ai);
    const doneTasks = subTasks.filter((t) => t.status === TaskStatus.done);
    const actionCount = openActions.filter(
      (a) => a.subjectId === subject.id,
    ).length;
    const opened = subject.lastOpenedAt?.getTime() ?? 0;
    const unreadCount = incoming.filter(
      (m) =>
        m.subjectId === subject.id && (m.receivedAt?.getTime() ?? 0) > opened,
    ).length;

    return {
      subject,
      contactNames: subject.contactIds
        .map((id) => nameById.get(id))
        .filter((n): n is string => Boolean(n)),
      openTaskCount: openTasks.length,
      suggestionCount: aiOpenTasks.length + actionCount,
      unreadCount,
      attachmentCount: attachments.filter((a) => a.subjectId === subject.id)
        .length,
      progress:
        subTasks.length === 0 ? null : doneTasks.length / subTasks.length,
      taskTotal: subTasks.length,
      taskDone: doneTasks.length,
      folderSlug: folder?.slug ?? null,
      folderName: folder?.name ?? null,
      folderColor: folder?.color ?? null,
      folderIcon: folder?.icon ?? null,
    };
  });
}

/**
 * Détail complet d'un sujet pour sa fiche (M9.5) : sujet + dossier + contacts +
 * messages (avec canal, expéditeur, pièces jointes) + tâches + journal + PJ +
 * brouillon Relvo en attente. Réutilisable par le worker M7. Renvoie null si
 * le sujet n'appartient pas au tenant (le client est déjà scopé).
 */
export async function getSubjectDetail(db: TenantDb, id: string) {
  const subject = await db.subject.findFirst({
    where: { id },
    include: { folder: { select: { id: true, name: true, slug: true } } },
  });
  if (!subject) return null;

  const [contactsRaw, messagesRaw, tasks, events, attachments, draft] =
    await Promise.all([
      subject.contactIds.length
        ? db.contact.findMany({
            where: { id: { in: subject.contactIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              company: true,
            },
          })
        : Promise.resolve(
            [] as {
              id: string;
              firstName: string | null;
              lastName: string;
              company: string | null;
            }[],
          ),
      db.message.findMany({
        where: { subjectId: id },
        orderBy: { createdAt: "asc" },
        include: {
          channel: { select: { type: true } },
          senderContact: { select: { firstName: true, lastName: true } },
          attachments: {
            select: { id: true, name: true, aiLabel: true, mimeType: true },
          },
        },
      }),
      db.task.findMany({
        where: { subjectId: id, status: { not: TaskStatus.deleted } },
        orderBy: [
          { status: "asc" },
          { startDate: "asc" },
          { createdAt: "asc" },
        ],
      }),
      db.eventLog.findMany({
        where: { subjectId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.attachment.findMany({
        where: { subjectId: id },
        orderBy: { createdAt: "desc" },
      }),
      db.action.findFirst({
        where: {
          subjectId: id,
          status: ActionStatus.open,
          type: "send_message",
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  // On recompose un `name` d'affichage (« Prénom Nom ») pour garder l'API stable
  // côté consommateurs (fiche sujet, bulles de messages) après la séparation
  // prénom/nom du modèle Contact.
  const contacts = contactsRaw.map((c) => ({
    id: c.id,
    name: contactDisplayName(c),
    company: c.company,
  }));
  const messages = messagesRaw.map((m) => ({
    ...m,
    senderContact: m.senderContact
      ? { name: contactDisplayName(m.senderContact) }
      : null,
  }));

  return { subject, contacts, messages, tasks, events, attachments, draft };
}
