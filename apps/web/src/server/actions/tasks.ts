"use server";

import {
  type CreateTaskInput,
  type UpdateTaskInput,
  completeTask,
  createTask,
  deleteTask,
  updateTask,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";

// Server Actions Tasks (M3.9).

function revalidateTasks() {
  revalidatePath("/");
  revalidatePath("/fil");
  revalidatePath("/planning");
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

export async function deleteTaskAction(id: string) {
  const result = await domainAction((db) => deleteTask(db, id));
  if (result.ok) revalidateTasks();
  return result;
}
