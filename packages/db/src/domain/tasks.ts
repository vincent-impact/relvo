import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import {
  Actor,
  CompletionMode,
  TaskKind,
  TaskStatus,
} from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { DomainError, assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { ensureAffected } from "./helpers";
import { cursorArgs, paginationSchema, toPage } from "./pagination";

// Domaine Tasks (M3.9). Unité de travail DU sujet (pas de l'utilisateur).
// Dates asymétriques : start_* = deadline, end_* = durée (cf. 02-modele §9).
// Suppression = soft delete (status=deleted), pas d'effacement physique.

const actorEnum = z.enum(Actor);

const dateFields = {
  startDate: z.date().optional().nullable(),
  startTime: z.date().optional().nullable(),
  endDate: z.date().optional().nullable(),
  endTime: z.date().optional().nullable(),
};

export const createTaskSchema = z
  .object({
    // Une tâche peut ne pas avoir de sujet (créée depuis l'Accueil « Actions »).
    subjectId: z.uuid().optional().nullable(),
    messageId: z.uuid().optional().nullable(),
    title: z.string().trim().min(1, "Titre requis").max(300),
    description: z.string().trim().max(5000).optional().nullable(),
    sourceActor: actorEnum.default(Actor.user),
    kind: z.enum(TaskKind).optional(),
    completionMode: z.enum(CompletionMode).optional(),
    ...dateFields,
  })
  .refine((d) => !(d.endDate && !d.startDate), {
    message: "end_date nécessite start_date (la deadline vit dans start_date).",
    path: ["endDate"],
  });

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    kind: z.enum(TaskKind).optional(),
    completionMode: z.enum(CompletionMode).optional(),
    // Réassignation : un uuid pour (r)attacher, null pour détacher le sujet.
    subjectId: z.uuid().optional().nullable(),
    ...dateFields,
  })
  .refine((d) => !(d.endDate && d.startDate === null), {
    message: "end_date nécessite start_date.",
    path: ["endDate"],
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export async function listTasks(
  db: TenantDb,
  opts: {
    subjectId?: string;
    status?: TaskStatus;
    cursor?: string;
    limit?: number;
  } = {},
) {
  const { limit } = paginationSchema.parse(opts);
  const { _limit, ...args } = cursorArgs(opts);
  const rows = await db.task.findMany({
    ...args,
    where: {
      ...(opts.subjectId ? { subjectId: opts.subjectId } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
  });
  return toPage(rows, limit);
}

export async function getTask(db: TenantDb, id: string) {
  return assertFound(await db.task.findFirst({ where: { id } }), "Tâche");
}

export async function createTask(db: TenantDb, input: CreateTaskInput) {
  const data = createTaskSchema.parse(input);
  return db.$transaction(async (tx) => {
    if (data.subjectId) {
      assertFound(
        await tx.subject.findFirst({ where: { id: data.subjectId } }),
        "Sujet",
      );
    }
    const task = await tx.task.create({
      data: {
        subjectId: data.subjectId ?? null,
        messageId: data.messageId ?? null,
        title: data.title,
        description: data.description ?? null,
        sourceActor: data.sourceActor,
        ...(data.kind ? { kind: data.kind } : {}),
        ...(data.completionMode ? { completionMode: data.completionMode } : {}),
        startDate: data.startDate ?? null,
        startTime: data.startTime ?? null,
        endDate: data.endDate ?? null,
        endTime: data.endTime ?? null,
      } as Prisma.TaskUncheckedCreateInput,
    });
    if (data.subjectId) {
      await tx.subject.updateMany({
        where: { id: data.subjectId },
        data: { lastActivityAt: new Date() },
      });
    }
    await logEvent(tx as Tx, {
      entityType: "task",
      entityId: task.id,
      taskId: task.id,
      subjectId: task.subjectId,
      eventType:
        data.sourceActor === Actor.ai
          ? EVENT_TYPES.taskCreatedByAi
          : EVENT_TYPES.taskCreatedByUser,
      title: `Tâche créée : ${task.title}`,
      actor: data.sourceActor,
    });
    return task;
  });
}

export async function updateTask(
  db: TenantDb,
  id: string,
  input: UpdateTaskInput,
) {
  const data = updateTaskSchema.parse(input);
  return db.$transaction(async (tx) => {
    // Réassignation de sujet : valider la cible si on (r)attache.
    if (data.subjectId) {
      assertFound(
        await tx.subject.findFirst({ where: { id: data.subjectId } }),
        "Sujet",
      );
    }
    const { count } = await tx.task.updateMany({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.kind !== undefined ? { kind: data.kind } : {}),
        ...(data.completionMode !== undefined
          ? { completionMode: data.completionMode }
          : {}),
        ...(data.subjectId !== undefined ? { subjectId: data.subjectId } : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
        ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
        ...(data.endTime !== undefined ? { endTime: data.endTime } : {}),
      },
    });
    ensureAffected(count, "Tâche");
    const task = assertFound(
      await tx.task.findFirst({ where: { id } }),
      "Tâche",
    );
    await logEvent(tx as Tx, {
      entityType: "task",
      entityId: task.id,
      taskId: task.id,
      subjectId: task.subjectId,
      eventType: EVENT_TYPES.taskUpdated,
      title: `Tâche modifiée : ${task.title}`,
      actor: "user",
    });
    return task;
  });
}

/**
 * Coche une tâche. `completedByActor` = qui l'a cochée (user manuel, ai via
 * Relvo, system automatique). `completionMode` reflète l'origine (manual,
 * message_match, action_match) et peut être ajusté.
 */
export async function completeTask(
  db: TenantDb,
  id: string,
  completedByActor: Actor = Actor.user,
  completionMode?: CompletionMode,
) {
  return db.$transaction(async (tx) => {
    const current = assertFound(
      await tx.task.findFirst({ where: { id } }),
      "Tâche",
    );
    if (current.status === TaskStatus.deleted) {
      throw new DomainError(
        "INVALID_STATE",
        "Une tâche supprimée ne peut pas être cochée.",
      );
    }
    const { count } = await tx.task.updateMany({
      where: { id },
      data: {
        status: TaskStatus.done,
        completedAt: new Date(),
        completedByActor,
        ...(completionMode ? { completionMode } : {}),
      },
    });
    ensureAffected(count, "Tâche");
    const task = assertFound(
      await tx.task.findFirst({ where: { id } }),
      "Tâche",
    );
    if (task.subjectId) {
      await tx.subject.updateMany({
        where: { id: task.subjectId },
        data: { lastActivityAt: new Date() },
      });
    }
    await logEvent(tx as Tx, {
      entityType: "task",
      entityId: task.id,
      taskId: task.id,
      subjectId: task.subjectId,
      eventType: EVENT_TYPES.taskCompleted,
      title: `Tâche cochée : ${task.title}`,
      actor: completedByActor,
    });
    return task;
  });
}

/**
 * Rouvre une tâche terminée (done → open) — geste « swipe gauche » symétrique de
 * la complétion. Réinitialise les champs de complétion. Idempotent si déjà open.
 */
export async function reopenTask(db: TenantDb, id: string) {
  return db.$transaction(async (tx) => {
    const current = assertFound(
      await tx.task.findFirst({ where: { id } }),
      "Tâche",
    );
    if (current.status === TaskStatus.deleted) {
      throw new DomainError(
        "INVALID_STATE",
        "Une tâche supprimée ne peut pas être rouverte.",
      );
    }
    if (current.status === TaskStatus.open) return current; // no-op idempotent
    const { count } = await tx.task.updateMany({
      where: { id },
      data: {
        status: TaskStatus.open,
        completedAt: null,
        completedByActor: null,
      },
    });
    ensureAffected(count, "Tâche");
    const task = assertFound(
      await tx.task.findFirst({ where: { id } }),
      "Tâche",
    );
    if (task.subjectId) {
      await tx.subject.updateMany({
        where: { id: task.subjectId },
        data: { lastActivityAt: new Date() },
      });
    }
    await logEvent(tx as Tx, {
      entityType: "task",
      entityId: task.id,
      taskId: task.id,
      subjectId: task.subjectId,
      eventType: EVENT_TYPES.taskReopened,
      title: `Tâche rouverte : ${task.title}`,
      actor: Actor.user,
    });
    return task;
  });
}

/**
 * Suppression DÉFINITIVE d'une tâche (vrai DELETE en base, pas de soft-delete).
 * Les FK `EventLog.taskId` et `Action.taskId` sont en `onDelete: SetNull` : la
 * ligne disparaît sans casser les journaux/actions existants. On consigne d'abord
 * l'évènement de suppression dans le journal du sujet (sans `taskId`, puisque la
 * tâche n'existe plus après le DELETE), pour garder une trace lisible.
 */
export async function deleteTask(db: TenantDb, id: string) {
  return db.$transaction(async (tx) => {
    const task = assertFound(
      await tx.task.findFirst({ where: { id } }),
      "Tâche",
    );
    const { count } = await tx.task.deleteMany({ where: { id } });
    ensureAffected(count, "Tâche");
    if (task.subjectId) {
      await tx.subject.updateMany({
        where: { id: task.subjectId },
        data: { lastActivityAt: new Date() },
      });
    }
    await logEvent(tx as Tx, {
      entityType: "task",
      entityId: task.id,
      subjectId: task.subjectId,
      eventType: EVENT_TYPES.taskDeleted,
      title: `Tâche supprimée : ${task.title}`,
      actor: "user",
    });
    return task;
  });
}
