import {
  ActionStatus,
  ActionType,
  Actor,
  CompletionMode,
  TaskKind,
  TaskStatus,
} from "../generated/prisma/enums";
import type { Tx } from "../tenant";
import { EVENT_TYPES, logEvent } from "./events";

// Domaine CORRESPONDANCE À L'ENVOI (M7.10, 04 §10, 05 §4.1) — ce qu'un message
// écrit dans un sujet fait aux tâches et au marqueur « En attente », SANS
// appel au modèle. Appelé dans la transaction de `createMessage`, pour tous
// les points d'entrée (envoi e-mail, envoi messagerie, ingestion) — jamais
// ailleurs. Volontairement sans dépendance vers le reste du domaine : c'est
// `messages.ts` qui l'importe, et `messages.ts` est importé par presque tout.
//
//   • Sortant : les brouillons ouverts du sujet passent « exécutés » — la
//     tâche de chacun est cochée, quel que soit son type, c'est le message qui
//     la règle ; toute tâche de RÉPONSE encore ouverte est cochée par
//     correspondance ; « En attente » se pose s'il ne reste aucune tâche.
//   • Entrant : « En attente » se lève.

// ─────────────────────────────────────────────────────────────
// L'envoi — ce qu'un message sortant fait aux tâches, sans appel
// ─────────────────────────────────────────────────────────────

export type OutgoingMatchResult = {
  completedTaskIds: string[];
  doneActionIds: string[];
  waitingForReply: boolean;
};

/**
 * Un message SORTANT vient d'être écrit dans un sujet (04 §10, 05 §4.1) :
 *   1. les brouillons ouverts du sujet passent « exécutés » — la tâche de
 *      chacun est cochée, quel que soit son type : c'est le message qui la
 *      règle ;
 *   2. toute tâche de RÉPONSE encore ouverte du sujet est cochée par
 *      correspondance ;
 *   3. le marqueur « En attente » se pose s'il ne reste aucune tâche ouverte.
 * Appelé dans la transaction de `createMessage`, jamais ailleurs.
 */
export async function applyOutgoingMatch(
  tx: Tx,
  args: { subjectId: string; messageId: string },
): Promise<OutgoingMatchResult> {
  const now = new Date();
  const drafts = await tx.action.findMany({
    where: {
      subjectId: args.subjectId,
      type: ActionType.send_message,
      status: ActionStatus.open,
    },
    select: { id: true, taskId: true, title: true },
  });
  const doneActionIds: string[] = [];
  for (const d of drafts) {
    await tx.action.updateMany({
      where: { id: d.id },
      data: {
        status: ActionStatus.done,
        executedByActor: Actor.user,
        executedAt: now,
        messageId: args.messageId,
      },
    });
    doneActionIds.push(d.id);
    await logEvent(tx, {
      entityType: "action",
      entityId: d.id,
      actionId: d.id,
      subjectId: args.subjectId,
      taskId: d.taskId,
      messageId: args.messageId,
      eventType: EVENT_TYPES.actionSendMessageDone,
      title: `Message envoyé : ${d.title}`,
      actor: Actor.user,
    });
  }

  const draftTaskIds = drafts
    .map((d) => d.taskId)
    .filter((id): id is string => !!id);
  const toComplete = await tx.task.findMany({
    where: {
      subjectId: args.subjectId,
      status: TaskStatus.open,
      OR: [{ kind: TaskKind.reply }, { id: { in: draftTaskIds } }],
    },
    select: { id: true, title: true },
  });
  const completedTaskIds: string[] = [];
  for (const t of toComplete) {
    await tx.task.updateMany({
      where: { id: t.id },
      data: {
        status: TaskStatus.done,
        completedAt: now,
        completedByActor: Actor.system,
        completionMode: CompletionMode.message_match,
      },
    });
    completedTaskIds.push(t.id);
    await logEvent(tx, {
      entityType: "task",
      entityId: t.id,
      taskId: t.id,
      subjectId: args.subjectId,
      messageId: args.messageId,
      eventType: EVENT_TYPES.taskCompleted,
      title: `Tâche réglée par votre message : ${t.title}`,
      actor: Actor.system,
      metadata: { completionMode: CompletionMode.message_match },
    });
  }

  const remaining = await tx.task.count({
    where: { subjectId: args.subjectId, status: TaskStatus.open },
  });
  const waitingForReply = remaining === 0;
  await tx.subject.updateMany({
    where: { id: args.subjectId },
    data: { waitingForReply, lastActivityAt: now },
  });
  return { completedTaskIds, doneActionIds, waitingForReply };
}

/** Un message ENTRANT arrive sur un sujet : l'attente est levée (04 §9). */
export async function applyIncomingMatch(
  tx: Tx,
  args: { subjectId: string },
): Promise<void> {
  await tx.subject.updateMany({
    where: { id: args.subjectId, waitingForReply: true },
    data: { waitingForReply: false },
  });
}
