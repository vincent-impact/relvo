import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import {
  Actor,
  CompletionMode,
  SubjectStatus,
  TaskKind,
  TaskStatus,
} from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { DomainError, assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { ensureAffected } from "./helpers";
import { cursorArgs, paginationSchema, toPage } from "./pagination";
import { revokeResolutionSuggestion, suggestResolution } from "./subjects";

// Domaine Tasks (M3.9). Unité de travail DU sujet (pas de l'utilisateur).
// Dates asymétriques : start_* = deadline, end_* = durée (cf. 02-modele §9).
// Suppression = vrai effacement ; le journal conserve la tâche telle qu'elle
// avait été proposée (02, Task et EventLog).
//
// `metadata` porte la PROVENANCE d'une déduction de Relvo — le précédent, le
// document ou l'instruction sur lesquels il s'est appuyé — et sa RAISON en une
// phrase (M7.6, M7.18). C'est ce qui rend une tâche auditable d'un appui.

const actorEnum = z.enum(Actor);

/**
 * Provenance d'une tâche déduite (05 §2.1, §10.4) : un précédent (référence
 * d'un sujet validé), une instruction ou un document du domaine — nommés par
 * leur libellé lisible —, ou une source libre. Stockée telle quelle, lue par
 * la fiche : « d'après SUB-0042 · Ouverture magasin Béziers ».
 */
export const taskProvenanceSchema = z.object({
  type: z.enum(["precedent", "instruction", "document", "autre"]),
  /** Référence lisible (sujet) quand il y en a une, sinon null. */
  reference: z.string().trim().max(40).nullable(),
  libelle: z.string().trim().min(1).max(300),
});

/**
 * Une DÉCISION que le message demande au dirigeant, portée par la tâche qui se
 * répond (05 §3.1) : une question courte, ses options, et la réponse quand il
 * l'a donnée. Le formulaire de décisions de la conversation les affiche ; le
 * brouillon ne se rédige qu'une fois toutes répondues.
 */
export const taskDecisionSchema = z.object({
  id: z.string().trim().min(1).max(20),
  question: z.string().trim().min(1).max(200),
  /** Ce qui aide à décider : « 480 € HT, délai 3 jours ». */
  precision: z.string().trim().max(200).nullable(),
  options: z.array(z.string().trim().min(1).max(80)).min(2).max(4),
  /** La réponse du dirigeant — une option, ou un texte libre ; null tant qu'il n'a pas décidé. */
  reponse: z.string().trim().min(1).max(300).nullable(),
  /** ISO 8601. */
  repondueLe: z.string().nullable(),
});

export const taskMetadataSchema = z.object({
  /** « le fournisseur demande un retour avant jeudi » (05 §2.4). */
  raison: z.string().trim().max(1000),
  provenance: taskProvenanceSchema.nullable(),
  /** Les décisions que le message demande — absentes sur une tâche qui n'en appelle aucune. */
  decisions: z.array(taskDecisionSchema).max(3).optional(),
});

export type TaskProvenance = z.infer<typeof taskProvenanceSchema>;
export type TaskDecision = z.infer<typeof taskDecisionSchema>;
export type TaskMetadata = z.infer<typeof taskMetadataSchema>;

/** Les décisions d'une tâche, depuis sa colonne `metadata` — vide sans décision. */
export function readTaskDecisions(metadata: unknown): TaskDecision[] {
  return readTaskMetadata(metadata)?.decisions ?? [];
}

/**
 * Lit la raison et la provenance d'une tâche depuis sa colonne `metadata`,
 * sans faire confiance à sa forme (une tâche créée avant M7 n'en a pas).
 */
export function readTaskMetadata(metadata: unknown): TaskMetadata | null {
  const parsed = taskMetadataSchema.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}

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
    /** Raison et provenance d'une déduction (02, Task) — posées par Relvo, jamais par l'interface. */
    metadata: taskMetadataSchema.optional().nullable(),
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
        ...(data.metadata
          ? { metadata: data.metadata as Prisma.InputJsonValue }
          : {}),
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
      // Une tâche de Relvo dit pourquoi, et d'après quoi (M7.20).
      description: data.metadata?.raison || null,
      actor: data.sourceActor,
      metadata: data.metadata ?? null,
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
  /** Ce qui dit qu'elle est faite, et le message qui le dit — quand c'est Relvo qui coche (05 §4.2). */
  origine?: { reason?: string | null; messageId?: string | null },
) {
  const task = await db.$transaction(async (tx) => {
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
      messageId: origine?.messageId ?? null,
      eventType: EVENT_TYPES.taskCompleted,
      title:
        completedByActor === Actor.ai
          ? `Tâche cochée par Relvo : ${task.title}`
          : `Tâche cochée : ${task.title}`,
      description: origine?.reason ?? null,
      actor: completedByActor,
    });
    return task;
  });
  // Le geste du dirigeant, à la main : la dernière tâche cochée règle le sujet.
  // Relvo, lui, décide de la clôture dans sa relecture (05 §5.5).
  if (completedByActor === Actor.user && task.subjectId) {
    await settleSubjectAfterLastTask(db, task.subjectId, task);
  }
  return task;
}

/**
 * LA DERNIÈRE TÂCHE COCHÉE PAR LE DIRIGEANT RÈGLE LE SUJET — sans IA (04 §10).
 * Quand il coche la dernière tâche ouverte d'un sujet ouvert, plus rien ne
 * reste à faire : ce qu'on attendait d'un tiers est arrivé — c'est le plus
 * souvent cette tâche même, une livraison, une intervention —, l'attente se
 * lève, et Relvo propose la clôture. Journalisé, réversible : rouvrir une
 * tâche retire la suggestion (`reopenTask`). Un jugement du modèle n'y
 * apporterait rien : la tâche est reliée au statut.
 */
export async function settleSubjectAfterLastTask(
  db: TenantDb,
  subjectId: string,
  task: { id: string; title: string },
): Promise<{ waitingLifted: boolean; resolutionSuggested: boolean }> {
  const rien = { waitingLifted: false, resolutionSuggested: false };
  const subject = await db.subject.findFirst({
    where: { id: subjectId, status: SubjectStatus.open },
    select: { waitingForReply: true, resolutionSuggestedAt: true },
  });
  if (!subject) return rien;
  const restantes = await db.task.count({
    where: { subjectId, status: TaskStatus.open },
  });
  if (restantes > 0) return rien;

  let waitingLifted = false;
  if (subject.waitingForReply) {
    await db.subject.updateMany({
      where: { id: subjectId },
      data: { waitingForReply: false },
    });
    await logEvent(db as Tx, {
      entityType: "subject",
      entityId: subjectId,
      subjectId,
      taskId: task.id,
      eventType: EVENT_TYPES.waitingForReplyLifted,
      title: `Plus rien à attendre : « ${task.title} » est cochée`,
      actor: Actor.system,
    });
    waitingLifted = true;
  }
  let resolutionSuggested = false;
  if (!subject.resolutionSuggestedAt) {
    await suggestResolution(db, subjectId, {
      reason: `Plus rien à faire : « ${task.title} » était la dernière tâche.`,
    });
    resolutionSuggested = true;
  }
  return { waitingLifted, resolutionSuggested };
}

/**
 * Rouvre une tâche terminée (done → open) — geste « swipe gauche » symétrique de
 * la complétion. Réinitialise les champs de complétion. Idempotent si déjà open.
 */
export async function reopenTask(db: TenantDb, id: string) {
  const task = await db.$transaction(async (tx) => {
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
  // Une tâche rouverte : il reste à faire, la suggestion de clôture tombe.
  if (task.subjectId) {
    await revokeResolutionSuggestion(db, task.subjectId, {
      by: "user",
      reason: `Tâche rouverte : ${task.title}`,
    });
  }
  return task;
}

/**
 * Suppression DÉFINITIVE d'une tâche (vrai DELETE en base, pas de soft-delete).
 * Les FK `EventLog.taskId` et `Action.taskId` sont en `onDelete: SetNull` : la
 * ligne disparaît sans casser les journaux/actions existants. On consigne d'abord
 * l'évènement de suppression dans le journal du sujet (sans `taskId`, puisque la
 * tâche n'existe plus après le DELETE), pour garder une trace lisible.
 *
 * Le journal conserve la tâche TELLE QU'ELLE AVAIT ÉTÉ PROPOSÉE — source, type,
 * date, raison et provenance (02, EventLog ; 05 §9.1) : c'est ici, et nulle
 * part ailleurs, que l'original d'une tâche de Relvo survit. La fiche de clôture
 * d'un sujet validé y relit les tâches écartées.
 */
/**
 * Relvo RETIRE une tâche devenue sans objet (05 §4.2) — une intervention
 * annulée, une livraison remplacée par une autre. Seulement une tâche OUVERTE
 * que Relvo avait lui-même proposée : une tâche posée par le dirigeant n'est
 * jamais retirée par le modèle. La tâche passe `deleted` (elle disparaît des
 * listes) et le journal dit pourquoi ; rien n'est effacé en base.
 */
export async function retireTaskByAi(
  db: TenantDb,
  id: string,
  meta: { reason: string; messageId?: string | null },
) {
  return db.$transaction(async (tx) => {
    const task = assertFound(
      await tx.task.findFirst({ where: { id } }),
      "Tâche",
    );
    if (task.status !== TaskStatus.open) {
      throw new DomainError("INVALID_STATE", "Cette tâche n'est plus ouverte.");
    }
    if (task.sourceActor !== Actor.ai) {
      throw new DomainError(
        "INVALID_STATE",
        "Relvo ne retire pas une tâche posée par le dirigeant.",
      );
    }
    await tx.task.updateMany({
      where: { id },
      data: { status: TaskStatus.deleted },
    });
    await logEvent(tx as Tx, {
      entityType: "task",
      entityId: task.id,
      taskId: task.id,
      subjectId: task.subjectId,
      messageId: meta.messageId ?? null,
      eventType: EVENT_TYPES.taskRetiredByAi,
      title: `Tâche retirée par Relvo : ${task.title}`,
      description: meta.reason,
      actor: Actor.ai,
      metadata: {
        reason: meta.reason,
        proposal: {
          title: task.title,
          kind: task.kind,
          startDate: task.startDate?.toISOString().slice(0, 10) ?? null,
          metadata: readTaskMetadata(task.metadata),
        },
      },
    });
    return task;
  });
}

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
      metadata: {
        proposal: {
          title: task.title,
          sourceActor: task.sourceActor,
          kind: task.kind,
          startDate: task.startDate?.toISOString().slice(0, 10) ?? null,
          metadata: readTaskMetadata(task.metadata),
        },
      },
    });
    return task;
  });
}
