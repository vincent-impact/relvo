"use server";

import {
  type CreateSubjectInput,
  type Priority,
  type SubjectStatus,
  type UpdateSubjectInput,
  closeSubject,
  createSubject,
  listIgnorableConversations,
  deleteSubject,
  openSubject,
  reopenSubject,
  suggestResolution,
  updateSubject,
  updateSubjectPriority,
  updateSubjectStatus,
  validateSubject,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";
import { revalidateTenantData } from "@/server/cached";

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
  revalidateTenantData();
}

export async function createSubjectAction(input: CreateSubjectInput) {
  const result = await domainAction((db) => createSubject(db, input));
  if (result.ok) revalidateSubjects();
  return result;
}

/** Options légères pour le sélecteur de sujet (modale de tâche) — sujets ouverts. */
export async function listSubjectOptionsAction() {
  return domainAction(async (db) => {
    const subjects = await db.subject.findMany({
      where: { status: { notIn: ["validated", "closed"] } },
      orderBy: [{ lastActivityAt: "desc" }],
      select: {
        id: true,
        reference: true,
        title: true,
        folder: { select: { slug: true } },
      },
      take: 100,
    });
    return subjects.map((s) => ({
      id: s.id,
      reference: s.reference,
      title: s.title,
      folderSlug: s.folder?.slug ?? null,
    }));
  });
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

/**
 * Fermer un sujet (cas Q) — et rapporter les conversations qu'il portait ENCORE
 * ACTIVES, pour que l'appelant puisse enchaîner « souhaitez-vous aussi ignorer
 * la conversation ? ».
 *
 * Fermer une fenêtre ne tarit pas la source : sans ignorance, le fil redevient
 * orphelin et resollicitera l'utilisateur au message suivant. C'est le cœur du
 * dispositif anti-« groupe WhatsApp bavard » — d'où le fait que la proposition
 * soit portée par l'action de fermeture elle-même, et non par un écran à part.
 */
export async function closeSubjectAction(id: string) {
  const result = await domainAction(async (db) => {
    const subject = await closeSubject(db, id);
    const ignorable = await listIgnorableConversations(db, id);
    return { subject, ignorable };
  });
  if (result.ok) revalidateSubjects();
  return result;
}

export async function validateSubjectAction(id: string) {
  const result = await domainAction((db) => validateSubject(db, id));
  if (result.ok) revalidateSubjects();
  return result;
}

export async function reopenSubjectAction(id: string) {
  const result = await domainAction((db) => reopenSubject(db, id));
  if (result.ok) revalidateSubjects();
  return result;
}

export async function openSubjectAction(id: string) {
  // Acquittement implicite. On ne revalide que si l'ouverture a EU un effet
  // (marqueur « Nouveau » levé, ou messages passés en lus) : sinon, ré-ouvrir un
  // sujet déjà vu garderait inutilement les caches froids. Cela rend les KPIs
  // de l'Accueil (« Nouveaux », « Ouverts ») et les pastilles du fil cohérents
  // en temps réel — un sujet ouvert quitte le compteur « Nouveaux ».
  const result = await domainAction((db) => openSubject(db, id));
  if (result.ok && (result.data.statusChanged || result.data.messagesRead)) {
    revalidateTenantData();
    revalidatePath("/");
    revalidatePath("/fil");
  }
  return result;
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
