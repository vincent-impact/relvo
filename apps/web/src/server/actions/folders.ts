"use server";

import {
  type CreateFolderInput,
  type UpdateFolderInput,
  createFolder,
  deleteFolder,
  updateFolder,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";
import { revalidateTenantData } from "@/server/cached";

// Server Actions Folders (M3.4).

function revalidateFolders() {
  revalidatePath("/dossiers");
  revalidatePath("/dossiers/[id]", "page");
  revalidateTenantData();
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
