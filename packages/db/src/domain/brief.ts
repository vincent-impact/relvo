import {
  Actor,
  QuestionStatus,
  SubjectStatus,
  TaskKind,
  TaskStatus,
} from "../generated/prisma/enums";
import type { TenantDb } from "../tenant";
import { countUnsortedConversations } from "./conversations";
import { EVENT_TYPES } from "./events";

// Le brief de l'accueil (01 §11, invariant 34) — UN CALCUL, JAMAIS UNE
// GÉNÉRATION. Tout ce qui s'affiche sur l'accueil se compte dans le journal ou
// se déduit de règles écrites ici ; le modèle ne travaille qu'une fois
// l'échange ouvert. Quatre zones : les dernières nouvelles (ce que Relvo a fait
// depuis le dernier passage, et ce qu'il attend), l'activité sur sept jours, les
// tâches du jour (servies par les requêtes du Calendrier) et les sujets en
// attente de l'utilisateur.

/** Ce que Relvo a fait depuis le dernier passage — compté dans le journal. */
export type BriefNews = {
  /** Borne basse du comptage : le dernier passage sur l'accueil, ou null (jamais vu). */
  since: Date | null;
  messagesRead: number;
  subjectsOpened: number;
  tasksProposed: number;
  draftsPrepared: number;
  conversationsMuted: number;
};

/** Le flux de l'utilisateur sur sept jours — trois chiffres de l'accueil (invariant 37 : un flux, jamais mêlé au cumulatif). */
export type BriefActivity = {
  messagesReceived: number;
  subjectsClosed: number;
  tasksDone: number;
};

/**
 * Une suggestion des dernières nouvelles : une phrase qui ouvre l'échange avec
 * elle comme premier tour (05 §11.12). `kind: "question"` = une question de
 * Relvo en attente, qui passe toujours en premier.
 */
export type BriefSuggestion = {
  kind: "question" | "rule";
  text: string;
  /** Identifiant de la RelvoQuestion, pour une suggestion de nature question. */
  questionId?: string;
};

/** Un sujet qui attend l'utilisateur : une réponse à donner ou une décision à prendre. */
export type AwaitingSubject = {
  id: string;
  reference: string;
  title: string;
  urgent: boolean;
  /** Ce que le sujet attend : la nature de la tâche ouverte la plus pressante. */
  awaiting: "reply" | "decision";
  /** Échéance de cette tâche (date UTC), ou null. */
  dueDate: Date | null;
  /** Depuis quand le sujet attend : la date de création de la tâche. */
  since: Date;
  /** Interlocuteur principal du sujet (premier contact), pour l'avatar. */
  contactName: string | null;
};

/** Au plus deux suggestions sur l'accueil, la question en attente comprise. */
export const MAX_SUGGESTIONS = 2;

/** Au-delà de cette durée sans activité, un sujet en attente d'une réponse « traîne ». */
const STALE_REPLY_DAYS = 7;

/**
 * Une visite de l'accueil n'avance le dernier passage que si la précédente date
 * de plus de cette durée : recharger la page deux fois de suite ne doit pas
 * vider les nouvelles.
 */
export const HOME_VISIT_GAP_MINUTES = 30;

function daysAgo(now: Date, days: number): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export async function getBriefNews(
  db: TenantDb,
  since: Date | null,
): Promise<BriefNews> {
  const window = since ? { createdAt: { gt: since } } : {};
  const count = (eventType: string, actor?: Actor) =>
    db.eventLog.count({
      where: { ...window, eventType, ...(actor ? { actor } : {}) },
    });
  const [
    messagesRead,
    subjectsOpened,
    tasksProposed,
    draftsPrepared,
    conversationsMuted,
  ] = await Promise.all([
    count(EVENT_TYPES.messageIncomingReceived),
    count(EVENT_TYPES.subjectCreated, Actor.ai),
    count(EVENT_TYPES.taskCreatedByAi),
    count(EVENT_TYPES.actionDraftPrepared),
    count(EVENT_TYPES.conversationIgnored, Actor.ai),
  ]);
  return {
    since,
    messagesRead,
    subjectsOpened,
    tasksProposed,
    draftsPrepared,
    conversationsMuted,
  };
}

export async function getBriefActivity(
  db: TenantDb,
  now: Date = new Date(),
): Promise<BriefActivity> {
  const from = daysAgo(now, 7);
  const [messagesReceived, subjectsClosed, tasksDone] = await Promise.all([
    db.message.count({
      where: { direction: "incoming", receivedAt: { gte: from } },
    }),
    db.subject.count({
      where: {
        status: { in: [SubjectStatus.validated, SubjectStatus.closed] },
        closedAt: { gte: from },
      },
    }),
    db.task.count({
      where: { status: TaskStatus.done, completedAt: { gte: from } },
    }),
  ]);
  return { messagesReceived, subjectsClosed, tasksDone };
}

/**
 * Les suggestions par règles, dans l'ordre de priorité : la question de Relvo
 * en attente d'abord, puis ce que l'état du compte réclame. Jamais plus de
 * MAX_SUGGESTIONS : au-delà, l'accueil redevient une liste.
 */
export async function getBriefSuggestions(
  db: TenantDb,
  now: Date = new Date(),
): Promise<BriefSuggestion[]> {
  const { start } = dayStart(now);
  const [question, staleReplies, overdue, unsorted] = await Promise.all([
    db.relvoQuestion.findFirst({
      where: { status: QuestionStatus.open },
      orderBy: { askedAt: "asc" },
      select: { id: true, text: true },
    }),
    db.subject.count({
      where: {
        status: SubjectStatus.open,
        waitingForReply: true,
        lastActivityAt: { lt: daysAgo(now, STALE_REPLY_DAYS) },
      },
    }),
    db.task.count({
      where: { status: TaskStatus.open, startDate: { lt: start } },
    }),
    countUnsortedConversations(db),
  ]);

  const out: BriefSuggestion[] = [];
  if (question) {
    out.push({
      kind: "question",
      text: question.text,
      questionId: question.id,
    });
  }
  if (staleReplies > 0) {
    out.push({
      kind: "rule",
      text:
        staleReplies === 1
          ? "Un sujet attend une réponse depuis plus d'une semaine. On fait le point ?"
          : `${staleReplies} sujets attendent une réponse depuis plus d'une semaine. On fait le point ?`,
    });
  }
  if (overdue > 0) {
    out.push({
      kind: "rule",
      text:
        overdue === 1
          ? "Une tâche est en retard. On la replanifie ?"
          : `${overdue} tâches sont en retard. On les replanifie ?`,
    });
  }
  if (unsorted > 0) {
    out.push({
      kind: "rule",
      text:
        unsorted === 1
          ? "Une conversation sans sujet attend votre tri."
          : `${unsorted} conversations sans sujet attendent votre tri.`,
    });
  }
  return out.slice(0, MAX_SUGGESTIONS);
}

function dayStart(now: Date): { start: Date } {
  return {
    start: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ),
  };
}

/**
 * « En attente de vous » : les sujets ouverts qui portent une tâche ouverte de
 * nature réponse ou décision — ce que seul l'utilisateur peut faire. Une tâche
 * par sujet (la plus pressante : échéance la plus proche, puis la plus
 * ancienne) ; les sujets urgents d'abord.
 */
export async function getSubjectsAwaitingUser(
  db: TenantDb,
  opts: { limit?: number } = {},
): Promise<AwaitingSubject[]> {
  const limit = opts.limit ?? 5;
  const tasks = await db.task.findMany({
    where: {
      status: TaskStatus.open,
      kind: { in: [TaskKind.reply, TaskKind.decision] },
      subject: { is: { status: SubjectStatus.open } },
    },
    orderBy: [
      { startDate: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
    ],
    select: {
      kind: true,
      startDate: true,
      createdAt: true,
      subject: {
        select: {
          id: true,
          reference: true,
          title: true,
          priority: true,
          contactIds: true,
        },
      },
    },
  });

  const bySubject = new Map<string, (typeof tasks)[number]>();
  for (const t of tasks) {
    if (t.subject && !bySubject.has(t.subject.id))
      bySubject.set(t.subject.id, t);
  }
  const picked = [...bySubject.values()]
    .sort((a, b) => {
      const ua = a.subject!.priority === "urgent" ? 0 : 1;
      const ub = b.subject!.priority === "urgent" ? 0 : 1;
      return ua - ub;
    })
    .slice(0, limit);

  const contactIds = [
    ...new Set(
      picked
        .map((t) => t.subject!.contactIds[0])
        .filter((c): c is string => !!c),
    ),
  ];
  const contacts = contactIds.length
    ? await db.contact.findMany({
        where: { id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true, company: true },
      })
    : [];
  const nameOf = new Map(
    contacts.map((c) => [
      c.id,
      [c.firstName, c.lastName].filter(Boolean).join(" ") || c.company || null,
    ]),
  );

  return picked.map((t) => ({
    id: t.subject!.id,
    reference: t.subject!.reference,
    title: t.subject!.title,
    urgent: t.subject!.priority === "urgent",
    awaiting: t.kind === TaskKind.decision ? "decision" : "reply",
    dueDate: t.startDate,
    since: t.createdAt,
    contactName: nameOf.get(t.subject!.contactIds[0] ?? "") ?? null,
  }));
}

/** Faut-il avancer la borne ? Oui si jamais posée, ou si la dernière visite date de plus de HOME_VISIT_GAP_MINUTES. */
export function shouldAdvanceHomeSeen(
  since: Date | null,
  now: Date = new Date(),
): boolean {
  const gapMs = HOME_VISIT_GAP_MINUTES * 60 * 1000;
  return !since || now.getTime() - since.getTime() > gapMs;
}

/** Pose le dernier passage sur l'accueil. Une visite n'est pas une décision : rien n'est journalisé. */
export async function markHomeSeen(
  db: TenantDb,
  accountId: string,
  at: Date = new Date(),
): Promise<void> {
  await db.account.update({
    where: { id: accountId },
    data: { homeSeenAt: at },
  });
}

/**
 * Le passage sur l'accueil, en une fois : lit la borne courante et l'avance si
 * la dernière visite est assez ancienne. Retourne la borne à utiliser pour les
 * nouvelles de CETTE visite (celle d'avant l'avance).
 */
export async function visitHome(
  db: TenantDb,
  accountId: string,
  now: Date = new Date(),
): Promise<{ since: Date | null; advanced: boolean }> {
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { homeSeenAt: true },
  });
  const since = account?.homeSeenAt ?? null;
  const advanced = shouldAdvanceHomeSeen(since, now);
  if (advanced) await markHomeSeen(db, accountId, now);
  return { since, advanced };
}
