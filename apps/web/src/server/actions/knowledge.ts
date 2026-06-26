"use server";

import {
  type CreateNoteInput,
  type UpdateNoteInput,
  createNote,
  deleteNote,
  setNoteActive,
  updateNote,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";
import { revalidateTenantData } from "@/server/cached";

// Server Actions Knowledge — instructions (notes) d'un domaine de la Mémoire.

function revalidateKnowledge() {
  revalidatePath("/dossiers");
  revalidatePath("/dossiers/[id]", "page");
  revalidateTenantData();
}

export async function createNoteAction(input: CreateNoteInput) {
  const result = await domainAction((db) => createNote(db, input));
  if (result.ok) revalidateKnowledge();
  return result;
}

export async function updateNoteAction(id: string, input: UpdateNoteInput) {
  const result = await domainAction((db) => updateNote(db, id, input));
  if (result.ok) revalidateKnowledge();
  return result;
}

export async function setNoteActiveAction(id: string, active: boolean) {
  const result = await domainAction((db) => setNoteActive(db, id, active));
  if (result.ok) revalidateKnowledge();
  return result;
}

export async function deleteNoteAction(id: string) {
  const result = await domainAction((db) => deleteNote(db, id));
  if (result.ok) revalidateKnowledge();
  return result;
}
