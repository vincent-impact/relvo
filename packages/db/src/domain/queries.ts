import type { Subject } from "../generated/prisma/client";
import {
  ActionStatus,
  MessageDirection,
  MessageStatus,
  Priority,
  TaskStatus,
} from "../generated/prisma/enums";
import { Actor, SubjectStatus } from "../generated/prisma/enums";
import type { TenantDb } from "../tenant";
import { cursorArgs, paginationSchema, toPage } from "./pagination";

// Requêtes d'agrégation (M3.13). Lectures seules : KPIs de l'Accueil, fil des
// ouverts, liste « Sans sujet ». Toutes scopées par le client tenant.

// « Hors fil principal » : terminé, archivé (système) ET ignoré (écarté). Un
// sujet ignoré quitte les ouverts et n'alimente plus la mémoire (invariant n°7bis).
const CLOSED_STATUSES = [
  SubjectStatus.resolved,
  SubjectStatus.archived,
  SubjectStatus.ignored,
];

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
  openSubjects: number;
  /** Tâches ouvertes dont l'échéance est aujourd'hui. */
  tasksToday: number;
  /** Total des tâches ouvertes (contexte sous « Tâches aujourd'hui »). */
  openTasksTotal: number;
  /** Rendez-vous = tâches ouvertes horodatées (startTime) dans les 7 jours. */
  appointmentsWeek: number;
  /** Sujets créés dans les 7 derniers jours. */
  newSubjectsWeek: number;
  messagesToTriage: number;
  /** % de tâches proposées par Relvo (source_actor=ai), ou null si aucune tâche. */
  relvoAssistRate: number | null;
};

/**
 * KPIs du bandeau « Vue du jour » de l'Accueil, alignés sur la maquette mobile
 * (Sujets urgents / Tâches aujourd'hui / Rendez-vous / Nouveaux sujets).
 */
export async function getKpis(
  db: TenantDb,
  opts: { now?: Date } = {},
): Promise<Kpis> {
  const now = opts.now ?? new Date();
  const { start, next } = dayBounds(now);
  const weekAhead = new Date(start);
  weekAhead.setUTCDate(weekAhead.getUTCDate() + 7);
  const weekAgo = new Date(start);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);

  const [
    urgentSubjects,
    openSubjects,
    tasksToday,
    openTasksTotal,
    appointmentsWeek,
    newSubjectsWeek,
    messagesToTriage,
    aiTasks,
    totalTasks,
  ] = await Promise.all([
    db.subject.count({
      where: {
        priority: Priority.urgent,
        status: { notIn: CLOSED_STATUSES },
      },
    }),
    db.subject.count({ where: { status: { notIn: CLOSED_STATUSES } } }),
    db.task.count({
      where: {
        status: TaskStatus.open,
        startDate: { gte: start, lt: next },
      },
    }),
    db.task.count({ where: { status: TaskStatus.open } }),
    db.task.count({
      where: {
        status: TaskStatus.open,
        startTime: { not: null },
        startDate: { gte: start, lt: weekAhead },
      },
    }),
    db.subject.count({ where: { createdAt: { gte: weekAgo } } }),
    db.message.count({
      where: { subjectId: null, status: { not: MessageStatus.ignored } },
    }),
    db.task.count({
      where: { sourceActor: Actor.ai, status: { not: TaskStatus.deleted } },
    }),
    db.task.count({ where: { status: { not: TaskStatus.deleted } } }),
  ]);

  return {
    urgentSubjects,
    openSubjects,
    tasksToday,
    openTasksTotal,
    appointmentsWeek,
    newSubjectsWeek,
    messagesToTriage,
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
 * Fil des OUVERTS : tous les sujets non clos (new/acknowledged), **urgents en
 * tête** (priority desc) puis dernière activité. Sert l'onglet « Ouverts » du fil
 * et le brief Accueil (limit court → les plus prioritaires). Paginé par curseur.
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
  /** Slug du dossier de rattachement (rail coloré / icône de domaine), ou null. */
  folderSlug: string | null;
  /** Nom du dossier de rattachement, ou null. */
  folderName: string | null;
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
            select: { id: true, name: true },
          })
        : Promise.resolve([] as { id: string; name: string }[]),
      folderIds.length
        ? db.folder.findMany({
            where: { id: { in: folderIds } },
            select: { id: true, name: true, slug: true },
          })
        : Promise.resolve([] as { id: string; name: string; slug: string }[]),
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

  const nameById = new Map(contacts.map((c) => [c.id, c.name]));
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
      folderSlug: folder?.slug ?? null,
      folderName: folder?.name ?? null,
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

  const [contacts, messages, tasks, events, attachments, draft] =
    await Promise.all([
      subject.contactIds.length
        ? db.contact.findMany({
            where: { id: { in: subject.contactIds } },
            select: { id: true, name: true, company: true },
          })
        : Promise.resolve(
            [] as { id: string; name: string; company: string | null }[],
          ),
      db.message.findMany({
        where: { subjectId: id },
        orderBy: { createdAt: "asc" },
        include: {
          channel: { select: { type: true } },
          senderContact: { select: { name: true } },
          attachments: { select: { id: true, name: true, aiLabel: true } },
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

  return { subject, contacts, messages, tasks, events, attachments, draft };
}

/** Liste « Sans sujet » : messages non rattachés et non ignorés. */
export async function listOrphanMessages(
  db: TenantDb,
  opts: { cursor?: string; limit?: number } = {},
) {
  const { limit } = paginationSchema.parse(opts);
  const { _limit, ...args } = cursorArgs(opts);
  const rows = await db.message.findMany({
    ...args,
    where: { subjectId: null, status: { not: MessageStatus.ignored } },
    orderBy: { receivedAt: "desc" },
  });
  return toPage(rows, limit);
}
