import {
  readTaskDecisions,
  readTaskMetadata,
  type Actor,
  type EnrichedTask,
} from "@relvo/db";

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
  /** Slug du domaine (Folder) hérité du sujet → rail de couleur. */
  folderSlug?: string | null;
  /** Pourquoi Relvo propose cette tâche, et d'après quoi (M7.20) — null pour une tâche de l'utilisateur ou sans raison. */
  relvo?: RelvoTaskInfo | null;
  /** Le fil dans lequel la tâche se répond d'un appui (M7.7) — ouvre le composer avec le brouillon de Relvo. */
  replyConversationId?: string | null;
  /** Les décisions que la tâche porte (05 §3.1) : ce qui reste à décider, ce qui l'est. */
  decisions?: TaskDecisionInfo[];
};

export type TaskDecisionInfo = { question: string; reponse: string | null };

/** Les décisions d'une tâche, en clair, depuis sa colonne `metadata`. */
export function taskDecisionsInfo(metadata: unknown): TaskDecisionInfo[] {
  return readTaskDecisions(metadata).map((d) => ({
    question: d.question,
    reponse: d.reponse,
  }));
}

export type RelvoTaskInfo = {
  /** « le fournisseur demande un retour avant jeudi ». */
  raison: string | null;
  /** « D'après SUB-0042 · Ouverture magasin Béziers », ou null. */
  provenance: string | null;
};

/**
 * La raison et la provenance d'une tâche, en clair, depuis sa colonne
 * `metadata` (02, Task). Une tâche sans les deux rend null : rien à montrer.
 */
export function relvoTaskInfo(metadata: unknown): RelvoTaskInfo | null {
  const m = readTaskMetadata(metadata);
  if (!m) return null;
  const p = m.provenance;
  const provenance = !p
    ? null
    : p.type === "precedent"
      ? `D'après ${p.reference} · ${p.libelle}`
      : p.type === "instruction"
        ? `D'après l'instruction « ${p.libelle} »`
        : p.type === "document"
          ? `D'après le document « ${p.libelle} »`
          : `D'après ${p.libelle}`;
  const raison = m.raison.trim() || null;
  return raison || provenance ? { raison, provenance } : null;
}

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
    folderSlug: e.folderSlug,
    relvo: relvoTaskInfo(e.task.metadata),
    replyConversationId: e.replyConversationId,
    decisions: taskDecisionsInfo(e.task.metadata),
  };
}
