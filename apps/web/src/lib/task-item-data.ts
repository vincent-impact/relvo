import type { Actor, EnrichedTask } from "@relvo/db";

// Forme PLATE d'une tâche pour TaskItem — isolée dans un module serveur-safe (pas
// de "use client") car le mapper `toTaskItemData` est appelé côté serveur (cache,
// cf. @/server/cached). Importer une VALEUR depuis un module client la
// transformerait en référence client non exécutable sur le serveur.

export type TaskItemData = {
  id: string;
  title: string;
  /** Date d'échéance « YYYY-MM-DD », ou null. */
  startDate: string | null;
  /** Heure « HH:MM », ou null. */
  startTime: string | null;
  status: string;
  sourceActor: Actor;
  overdue?: boolean;
  /** Sujet rattaché (modale : afficher/changer), ou null. */
  subjectId?: string | null;
  /** Contexte « à plat » (hors fiche sujet) : titre du sujet + interlocuteur. */
  subjectTitle?: string | null;
  contactName?: string | null;
};

/** Mappe une tâche enrichie (couche domaine) vers la forme plate de TaskItem. */
export function toTaskItemData(e: EnrichedTask): TaskItemData {
  return {
    id: e.task.id,
    title: e.task.title,
    startDate: e.task.startDate
      ? e.task.startDate.toISOString().slice(0, 10)
      : null,
    startTime: e.task.startTime
      ? e.task.startTime.toISOString().slice(11, 16)
      : null,
    status: e.task.status,
    sourceActor: e.task.sourceActor,
    overdue: e.overdue,
    subjectId: e.subjectId,
    subjectTitle: e.subjectTitle,
    contactName: e.contactName,
  };
}
