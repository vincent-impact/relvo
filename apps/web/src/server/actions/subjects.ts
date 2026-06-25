"use server";

import {
  type CreateSubjectInput,
  type Priority,
  type SubjectStatus,
  type UpdateSubjectInput,
  createSubject,
  deleteSubject,
  ignoreSubject,
  openSubject,
  resolveSubject,
  suggestResolution,
  unignoreSubject,
  updateSubject,
  updateSubjectPriority,
  updateSubjectStatus,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";

// Server Actions Subjects (M3.7) — fines enveloppes « use server » de la couche
// domaine. Elles injectent le client tenant et renvoient un ActionResult.

// Un sujet s'affiche sur plusieurs surfaces : Accueil, fil, sa fiche, les listes
// par dossier, la recherche. On les invalide toutes (le pattern [id] purge toutes
// les fiches/dossiers, sans connaître l'id concerné) pour rester cohérent dès que
// le cache client (staleTimes) garde les pages quelques secondes.
function revalidateSubjects() {
  revalidatePath("/");
  revalidatePath("/fil");
  revalidatePath("/sujets/[id]", "page");
  revalidatePath("/dossiers/[id]", "page");
  revalidatePath("/recherche");
}

export async function createSubjectAction(input: CreateSubjectInput) {
  const result = await domainAction((db) => createSubject(db, input));
  if (result.ok) revalidateSubjects();
  return result;
}

export async function updateSubjectAction(
  id: string,
  input: UpdateSubjectInput,
) {
  const result = await domainAction((db) => updateSubject(db, id, input));
  if (result.ok) revalidateSubjects();
  return result;
}

export async function setSubjectStatusAction(
  id: string,
  status: SubjectStatus,
) {
  const result = await domainAction((db) =>
    updateSubjectStatus(db, id, status),
  );
  if (result.ok) revalidateSubjects();
  return result;
}

export async function setSubjectPriorityAction(id: string, priority: Priority) {
  const result = await domainAction((db) =>
    updateSubjectPriority(db, id, priority),
  );
  if (result.ok) revalidateSubjects();
  return result;
}

export async function ignoreSubjectAction(id: string) {
  const result = await domainAction((db) => ignoreSubject(db, id));
  if (result.ok) revalidateSubjects();
  return result;
}

export async function resolveSubjectAction(id: string) {
  const result = await domainAction((db) => resolveSubject(db, id));
  if (result.ok) revalidateSubjects();
  return result;
}

export async function unignoreSubjectAction(id: string) {
  const result = await domainAction((db) => unignoreSubject(db, id));
  if (result.ok) revalidateSubjects();
  return result;
}

export async function openSubjectAction(id: string) {
  // Acquittement implicite : pas de revalidation lourde, juste la mise à jour.
  return domainAction((db) => openSubject(db, id));
}

export async function suggestResolutionAction(id: string) {
  const result = await domainAction((db) => suggestResolution(db, id));
  if (result.ok) revalidateSubjects();
  return result;
}

export async function deleteSubjectAction(id: string) {
  const result = await domainAction((db) => deleteSubject(db, id));
  if (result.ok) revalidateSubjects();
  return result;
}
