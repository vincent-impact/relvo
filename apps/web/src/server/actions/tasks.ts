"use server";

import {
  type AnswerTaskDecisionInput,
  type CreateTaskInput,
  type UpdateTaskInput,
  answerTaskDecision,
  completeTask,
  createTask,
  deleteTask,
  reopenTask,
  updateTask,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";
import { revalidateTenantData } from "@/server/cached";

// Server Actions Tasks (M3.9).

function revalidateTasks() {
  revalidatePath("/");
  revalidatePath("/fil");
  revalidatePath("/planning");
  revalidatePath("/sujets/[id]", "page"); // onglet Tâches de la fiche Sujet
  revalidateTenantData();
}

export async function createTaskAction(input: CreateTaskInput) {
  const result = await domainAction((db) => createTask(db, input));
  if (result.ok) revalidateTasks();
  return result;
}

export async function updateTaskAction(id: string, input: UpdateTaskInput) {
  const result = await domainAction((db) => updateTask(db, id, input));
  if (result.ok) revalidateTasks();
  return result;
}

export async function completeTaskAction(id: string) {
  const result = await domainAction((db) => completeTask(db, id));
  if (result.ok) revalidateTasks();
  return result;
}

export async function reopenTaskAction(id: string) {
  const result = await domainAction((db) => reopenTask(db, id));
  if (result.ok) revalidateTasks();
  return result;
}

export async function deleteTaskAction(id: string) {
  const result = await domainAction((db) => deleteTask(db, id));
  if (result.ok) revalidateTasks();
  return result;
}

/**
 * Répond à une décision portée par une tâche (05 §3.1) — depuis le formulaire
 * de la conversation. Journalisé par le domaine ; « Changer » repasse ici.
 */
export async function answerTaskDecisionAction(input: AnswerTaskDecisionInput) {
  const result = await domainAction((db) => answerTaskDecision(db, input));
  if (result.ok) {
    revalidateTasks();
    revalidatePath("/conversations/[id]", "page");
  }
  return result;
}
