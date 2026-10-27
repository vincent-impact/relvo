"use server";

import {
  type CreateDocumentInput,
  type CreateNoteInput,
  type UpdateNoteInput,
  createDocument,
  createNote,
  deleteNote,
  setNoteActive,
  updateNote,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { getStorage } from "@relvo/storage";
import { getCurrentAccountId } from "@/server/auth-context";
import { domainAction } from "@/lib/action-result";
import { revalidateTenantData } from "@/server/cached";

// Server Actions Knowledge — instructions (notes) d'un domaine de la Mémoire.

function revalidateKnowledge() {
  revalidatePath("/memoire");
  revalidatePath("/memoire/[id]", "page");
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

/**
 * Inscrit dans un dossier une connaissance que le navigateur vient d'envoyer au
 * stockage (M27.5). Deux gardes : la clé est bien celle d'un objet DU COMPTE
 * (le préfixe que `api/uploads` signe), et l'objet existe, à la taille
 * annoncée — on n'inscrit jamais un fichier qu'on n'a pas.
 */
export async function deposerConnaissanceAction(input: CreateDocumentInput) {
  const accountId = await getCurrentAccountId();
  if (!accountId) return { ok: false as const, message: "Non authentifié." };
  if (!input.storageKey.startsWith(`accounts/${accountId}/knowledge/`)) {
    return { ok: false as const, message: "Fichier refusé." };
  }
  const objet = await getStorage().head(input.storageKey);
  if (!objet) {
    return {
      ok: false as const,
      message: "Le fichier n’est pas arrivé. Réessayez.",
    };
  }
  const result = await domainAction((db) =>
    createDocument(db, { ...input, fileSize: objet.size }),
  );
  if (result.ok) revalidateKnowledge();
  return result;
}
