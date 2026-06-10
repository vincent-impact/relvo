import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import { ActionStatus, ActionType, Actor } from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { ensureAffected } from "./helpers";

// Domaine Actions (M3.11). Une Action trace une opération concrète (typiquement
// l'envoi d'un message). Le brouillon préparé par Relvo vit dans `payload`
// (destinataire, canal, contenu) avec status=open ; il n'est pas un message tant
// qu'il n'est pas envoyé (cf. invariant n°9).

export const createActionSchema = z.object({
  subjectId: z.uuid(),
  taskId: z.uuid().optional().nullable(),
  messageId: z.uuid().optional().nullable(),
  type: z.enum(ActionType).optional(),
  title: z.string().trim().min(1).max(300),
  payload: z.record(z.string(), z.unknown()).optional().nullable(),
});

/** Payload d'un brouillon de réponse send_message. */
export const draftReplySchema = z.object({
  subjectId: z.uuid(),
  taskId: z.uuid().optional().nullable(),
  to: z.string().trim().min(1).max(320),
  channel: z.string().trim().max(40).optional(),
  content: z.string(),
  title: z.string().trim().max(300).optional(),
});

export type CreateActionInput = z.infer<typeof createActionSchema>;
export type DraftReplyInput = z.infer<typeof draftReplySchema>;

export function listActions(
  db: TenantDb,
  opts: { subjectId?: string; taskId?: string; status?: ActionStatus } = {},
) {
  return db.action.findMany({
    where: {
      ...(opts.subjectId ? { subjectId: opts.subjectId } : {}),
      ...(opts.taskId ? { taskId: opts.taskId } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAction(db: TenantDb, id: string) {
  return assertFound(await db.action.findFirst({ where: { id } }), "Action");
}

export async function createAction(db: TenantDb, input: CreateActionInput) {
  const data = createActionSchema.parse(input);
  return db.$transaction(async (tx) => {
    assertFound(
      await tx.subject.findFirst({ where: { id: data.subjectId } }),
      "Sujet",
    );
    const action = await tx.action.create({
      data: {
        subjectId: data.subjectId,
        taskId: data.taskId ?? null,
        messageId: data.messageId ?? null,
        type: data.type ?? ActionType.other,
        title: data.title,
        payload: (data.payload ?? Prisma.DbNull) as Prisma.InputJsonValue,
      } as Prisma.ActionUncheckedCreateInput,
    });
    return action;
  });
}

/**
 * Prépare un brouillon de réponse (Action send_message, status=open). Le
 * brouillon atterrit ensuite dans le composer ; il n'est jamais envoyé d'office.
 */
export async function createDraftReply(db: TenantDb, input: DraftReplyInput) {
  const data = draftReplySchema.parse(input);
  return db.$transaction(async (tx) => {
    assertFound(
      await tx.subject.findFirst({ where: { id: data.subjectId } }),
      "Sujet",
    );
    const action = await tx.action.create({
      data: {
        subjectId: data.subjectId,
        taskId: data.taskId ?? null,
        type: ActionType.send_message,
        title: data.title ?? "Brouillon de réponse",
        status: ActionStatus.open,
        payload: {
          to: data.to,
          channel: data.channel ?? null,
          content: data.content,
        } as Prisma.InputJsonValue,
      } as Prisma.ActionUncheckedCreateInput,
    });
    await logEvent(tx as Tx, {
      entityType: "action",
      entityId: action.id,
      actionId: action.id,
      subjectId: action.subjectId,
      taskId: action.taskId,
      eventType: EVENT_TYPES.actionDraftPrepared,
      title: "Brouillon de réponse préparé",
      actor: "ai",
    });
    return action;
  });
}

/** Met à jour le contenu d'un brouillon (édition avant envoi). */
export async function updateActionPayload(
  db: TenantDb,
  id: string,
  payload: Record<string, unknown>,
) {
  const { count } = await db.action.updateMany({
    where: { id },
    data: { payload: payload as Prisma.InputJsonValue },
  });
  ensureAffected(count, "Action");
  return getAction(db, id);
}

/** Marque une action exécutée (ex : message effectivement envoyé). */
export async function markActionDone(
  db: TenantDb,
  id: string,
  executedByActor: Actor = Actor.user,
) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.action.updateMany({
      where: { id },
      data: {
        status: ActionStatus.done,
        executedByActor,
        executedAt: new Date(),
      },
    });
    ensureAffected(count, "Action");
    const action = assertFound(
      await tx.action.findFirst({ where: { id } }),
      "Action",
    );
    await tx.subject.updateMany({
      where: { id: action.subjectId },
      data: { lastActivityAt: new Date() },
    });
    await logEvent(tx as Tx, {
      entityType: "action",
      entityId: action.id,
      actionId: action.id,
      subjectId: action.subjectId,
      taskId: action.taskId,
      eventType:
        action.type === ActionType.send_message
          ? EVENT_TYPES.actionSendMessageDone
          : "action_done",
      title: `Action exécutée : ${action.title}`,
      actor: executedByActor,
    });
    return action;
  });
}

export async function cancelAction(db: TenantDb, id: string) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.action.updateMany({
      where: { id },
      data: { status: ActionStatus.cancelled },
    });
    ensureAffected(count, "Action");
    const action = assertFound(
      await tx.action.findFirst({ where: { id } }),
      "Action",
    );
    await logEvent(tx as Tx, {
      entityType: "action",
      entityId: action.id,
      actionId: action.id,
      subjectId: action.subjectId,
      eventType: EVENT_TYPES.actionCancelled,
      title: `Action annulée : ${action.title}`,
      actor: "user",
    });
    return action;
  });
}
