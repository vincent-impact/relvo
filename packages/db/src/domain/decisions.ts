import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import { TaskStatus } from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { REPLYABLE_TASK_KINDS, resolveReplyTargets } from "./brouillon";
import { assertFound, DomainError } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import {
  readTaskDecisions,
  readTaskMetadata,
  taskMetadataSchema,
  type TaskDecision,
} from "./tasks";

// Domaine DÉCISIONS (M7, retour du troisième essai réel — 05 §3.1) : ce qu'un
// message demande au dirigeant devient un FORMULAIRE, pas un choix entre
// crochets dans le texte de la réponse. Les décisions vivent sur la tâche qui
// se répond (métadonnées, aucune table) : questions + envoi = une seule tâche.
//
//   • Répondre à une décision est un geste de l'utilisateur, journalisé — le
//     journal retiendra ce qu'il a décidé et quand, même s'il n'y va jamais.
//   • Le brouillon (`preparerBrouillon`) ne se rédige qu'une fois toutes les
//     décisions répondues ; le composer reste libre : écrire soi-même et
//     envoyer coche la tâche par correspondance, décisions répondues ou non.
//   • « Changer » = répondre à nouveau : la dernière réponse l'emporte.

export const answerTaskDecisionSchema = z.object({
  taskId: z.uuid(),
  decisionId: z.string().trim().min(1).max(20),
  reponse: z.string().trim().min(1).max(300),
});
export type AnswerTaskDecisionInput = z.infer<typeof answerTaskDecisionSchema>;

export type DecisionTask = {
  id: string;
  title: string;
  subjectId: string;
  /** Le message qui a fait naître la tâche — là où le formulaire se pose dans le fil. */
  messageId: string | null;
  /** Ouverte : le formulaire ; terminée : ce qui a été décidé reste lisible. */
  status: "open" | "done";
  decisions: TaskDecision[];
};

/** Vrai si toutes les décisions ont une réponse (et qu'il y en a au moins une). */
export function decisionsToutesRepondues(
  decisions: readonly TaskDecision[],
): boolean {
  return decisions.length > 0 && decisions.every((d) => d.reponse !== null);
}

/**
 * Enregistre la réponse du dirigeant à une décision de la tâche, et le
 * journalise. Refuse une tâche qui n'est plus ouverte ou une décision inconnue.
 */
export async function answerTaskDecision(
  db: TenantDb,
  input: AnswerTaskDecisionInput,
): Promise<DecisionTask> {
  const data = answerTaskDecisionSchema.parse(input);
  return db.$transaction(async (tx) => {
    const task = assertFound(
      await tx.task.findFirst({
        where: { id: data.taskId },
        select: {
          id: true,
          title: true,
          subjectId: true,
          status: true,
          metadata: true,
        },
      }),
      "Tâche",
    );
    if (task.status !== TaskStatus.open) {
      throw new DomainError("INVALID_STATE", "Cette tâche n'est plus ouverte.");
    }
    const metadata = readTaskMetadata(task.metadata);
    const decision = metadata?.decisions?.find((d) => d.id === data.decisionId);
    if (!metadata || !decision) {
      throw new DomainError(
        "NOT_FOUND",
        "Cette décision n'existe pas sur la tâche.",
      );
    }
    const decisions = metadata.decisions!.map((d) =>
      d.id === decision.id
        ? { ...d, reponse: data.reponse, repondueLe: new Date().toISOString() }
        : d,
    );
    const next = taskMetadataSchema.parse({ ...metadata, decisions });
    await tx.task.update({
      where: { id: task.id },
      data: { metadata: next as Prisma.InputJsonValue },
    });
    await logEvent(tx as Tx, {
      entityType: "task",
      entityId: task.id,
      taskId: task.id,
      subjectId: task.subjectId,
      eventType: EVENT_TYPES.taskDecisionAnswered,
      title: `Décision : ${decision.question} → ${data.reponse}`,
      actor: "user",
      metadata: {
        decisionId: decision.id,
        question: decision.question,
        reponse: data.reponse,
        precedente: decision.reponse,
      },
    });
    return {
      id: task.id,
      title: task.title,
      subjectId: task.subjectId ?? "",
      messageId: null,
      status: "open",
      decisions,
    };
  });
}

/**
 * Les tâches qui se répondent dans ce fil et portent des décisions : les
 * OUVERTES — le formulaire — et les TERMINÉES dont une décision a été prise —
 * ce qui a été décidé reste lisible dans le fil, comme une interaction avec
 * Relvo (retour du 2026-09-18). Résolu comme « Répondre » le fait : le fil du
 * message d'origine, sinon le fil écouté.
 */
export async function listDecisionTasksForConversation(
  db: TenantDb,
  conversationId: string,
): Promise<DecisionTask[]> {
  const listenings = await db.subjectConversation.findMany({
    where: { conversationId },
    select: { subjectId: true },
  });
  const subjectIds = [...new Set(listenings.map((l) => l.subjectId))];
  if (subjectIds.length === 0) return [];
  const tasks = await db.task.findMany({
    where: {
      subjectId: { in: subjectIds },
      status: { in: [TaskStatus.open, TaskStatus.done] },
      kind: { in: [...REPLYABLE_TASK_KINDS] },
    },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      subjectId: true,
      messageId: true,
      kind: true,
      status: true,
      metadata: true,
    },
  });
  const withDecisions = tasks.filter((t) => {
    const d = readTaskDecisions(t.metadata);
    return t.status === TaskStatus.open
      ? d.length > 0
      : d.some((x) => x.reponse !== null);
  });
  if (withDecisions.length === 0) return [];
  // `resolveReplyTargets` ne résout que les tâches ouvertes ; une tâche
  // terminée se rattache à son message d'origine, ou au fil écouté.
  const targets = await resolveReplyTargets(
    db,
    withDecisions.map((t) => ({ ...t, status: TaskStatus.open })),
  );
  return withDecisions
    .filter((t) => targets.get(t.id) === conversationId)
    .map((t) => ({
      id: t.id,
      title: t.title,
      subjectId: t.subjectId as string,
      messageId: t.messageId,
      status:
        t.status === TaskStatus.done ? ("done" as const) : ("open" as const),
      decisions: readTaskDecisions(t.metadata),
    }));
}
