"use server";

import {
  type CreateFolderInput,
  type UpdateFolderInput,
  createFolder,
  deleteFolder,
  moveFolder,
  updateFolder,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";
import { revalidateTenantData } from "@/server/cached";

// Server Actions Folders (M3.4, M23.3 : l'arbre).

function revalidateFolders() {
  revalidatePath("/memoire");
  revalidatePath("/memoire/[id]", "page");
  // Le chemin d'un dossier s'écrit sur chaque ligne d'affaire : tout le
  // tenant se relit.
  revalidateTenantData();
}

/** Range un dossier — avec tout ce qu'il contient — sous un autre père ; `null` = sous Général. */
export async function moveFolderAction(id: string, parentId: string | null) {
  const result = await domainAction((db) => moveFolder(db, id, parentId));
  if (result.ok) revalidateFolders();
  return result;
}

export async function createFolderAction(input: CreateFolderInput) {
  const result = await domainAction((db) => createFolder(db, input));
  if (result.ok) revalidateFolders();
  return result;
}

export async function updateFolderAction(id: string, input: UpdateFolderInput) {
  const result = await domainAction((db) => updateFolder(db, id, input));
  if (result.ok) revalidateFolders();
  return result;
}

export async function deleteFolderAction(id: string) {
  const result = await domainAction((db) => deleteFolder(db, id));
  if (result.ok) revalidateFolders();
  return result;
}
