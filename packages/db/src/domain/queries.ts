import { MessageStatus, Priority, TaskStatus } from "../generated/prisma/enums";
import { Actor, SubjectStatus } from "../generated/prisma/enums";
import type { TenantDb } from "../tenant";
import { cursorArgs, paginationSchema, toPage } from "./pagination";

// Requêtes d'agrégation (M3.13). Lectures seules : KPIs de l'Accueil, feed
// prioritaire, liste « Sans sujet ». Toutes scopées par le client tenant.

const CLOSED_STATUSES = [SubjectStatus.resolved, SubjectStatus.archived];
const FEED_PRIORITIES = [Priority.critical, Priority.high];

function dayBounds(now: Date): { start: Date; next: Date } {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start, next };
}

export type Kpis = {
  openSubjects: number;
  messagesToTriage: number;
  tasksToday: number;
  /** % de tâches proposées par Relvo (source_actor=ai), ou null si aucune tâche. */
  relvoAssistRate: number | null;
};

/**
 * KPIs du bandeau Accueil. `relvoAssistRate` = part des tâches non supprimées
 * créées par Relvo — proxy V1 de « l'aide de Relvo » (définition ajustable).
 */
export async function getKpis(
  db: TenantDb,
  opts: { now?: Date } = {},
): Promise<Kpis> {
  const now = opts.now ?? new Date();
  const { start, next } = dayBounds(now);

  const [openSubjects, messagesToTriage, tasksToday, aiTasks, totalTasks] =
    await Promise.all([
      db.subject.count({ where: { status: { notIn: CLOSED_STATUSES } } }),
      db.message.count({
        where: { subjectId: null, status: { not: MessageStatus.ignored } },
      }),
      db.task.count({
        where: {
          status: TaskStatus.open,
          startDate: { gte: start, lt: next },
        },
      }),
      db.task.count({
        where: { sourceActor: Actor.ai, status: { not: TaskStatus.deleted } },
      }),
      db.task.count({ where: { status: { not: TaskStatus.deleted } } }),
    ]);

  return {
    openSubjects,
    messagesToTriage,
    tasksToday,
    relvoAssistRate:
      totalTasks === 0 ? null : Math.round((aiTasks / totalTasks) * 100),
  };
}

/**
 * Feed prioritaire de l'Accueil : sujets `priority IN (critical, high)` non
 * clos, triés par priorité puis dernière activité. Paginé par curseur.
 */
export async function getPriorityFeed(
  db: TenantDb,
  opts: { cursor?: string; limit?: number } = {},
) {
  const { limit } = paginationSchema.parse(opts);
  const { _limit, ...args } = cursorArgs(opts);
  const rows = await db.subject.findMany({
    ...args,
    where: {
      priority: { in: FEED_PRIORITIES },
      status: { notIn: CLOSED_STATUSES },
    },
    orderBy: [{ priority: "desc" }, { lastActivityAt: "desc" }],
  });
  return toPage(rows, limit);
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
