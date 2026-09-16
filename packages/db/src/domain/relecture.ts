import { z } from "zod";
import {
  Actor,
  Priority,
  SubjectStatus,
  TaskKind,
} from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { DomainError, assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import {
  SHEET_MESSAGE_INCLUDE,
  findPrecedents,
  loadSubjectSheet,
  projectSheetMessage,
  type PrecedentProjection,
  type StructurationSubjectProjection,
  type SubjectSheetProjection,
} from "./structuration";
import {
  revokeResolutionSuggestion,
  suggestResolution,
  updateSubjectPriority,
} from "./subjects";
import { createTask, taskMetadataSchema, taskProvenanceSchema } from "./tasks";

// Domaine RELECTURE (M7, tranche 6 — M7.9, M7.11) — ce que l'appel qui suit
// un message sur un sujet suivi — reçu, ou ENVOYÉ par le dirigeant — lit et
// écrit en base. Un seul appel par message ; c'est le poste le plus fréquent
// du pipeline (05 §1, §5.2).
//
// Mêmes règles que la structuration (`./structuration`) : projections
// explicites, écriture par les primitives, journal avec la proposition
// intégrale. Et deux règles propres à la relecture :
//   1. LA FICHE ET CE QUI VIENT D'ARRIVER SONT SÉPARÉS. La fiche porte la
//      situation structurée — la mémoire que Relvo relit, jamais l'historique
//      (05 §1.6) — et ses deux derniers messages ANTÉRIEURS ; le message qui
//      déclenche la relecture est poussé à part, en entier.
//   2. RELVO NE PILOTE PAS LE STATUT (05 §5.2). La réouverture d'un sujet
//      validé est mécanique et a déjà eu lieu (`createMessage`) ; la relecture
//      en est seulement informée. Elle SUGGÈRE la clôture ou la retire, pose
//      « En attente » quand un tiers est attendu sans qu'un envoi l'ait dit,
//      recalibre la priorité — jamais plus.

// ─────────────────────────────────────────────────────────────
// La projection — ce que la relecture a le droit de lire
// ─────────────────────────────────────────────────────────────

/** Messages ANTÉRIEURS poussés dans la fiche : le contexte frais est borné, c'est le poste le plus surveillé (05 §10.1). */
export const RELECTURE_SHEET_MESSAGES = 2;

export type RelectureProjection = SubjectSheetProjection & {
  accountId: string;
  precedents: PrecedentProjection[];
  /** Le message qui déclenche la relecture — reçu ou envoyé (`sens`) —, à part de la fiche. */
  nouveauxMessages: StructurationSubjectProjection["messages"];
  /** Le sujet était validé ou fermé et ce message l'a rouvert — mécaniquement, avant l'appel (05 §5.2). */
  rouvert: boolean;
};

/**
 * Charge ce que le profil « relecture » consomme : la fiche du sujet bornée
 * aux messages antérieurs au message déclencheur, le message lui-même à
 * part, les précédents, et le fait que le message ait rouvert le sujet.
 */
export async function getRelectureProjection(
  db: TenantDb,
  args: { subjectId: string; messageId: string },
): Promise<RelectureProjection> {
  const message = assertFound(
    await db.message.findFirst({
      where: { id: args.messageId },
      include: SHEET_MESSAGE_INCLUDE,
    }),
    "Message",
  );
  if (message.subjectId !== args.subjectId) {
    throw new DomainError(
      "VALIDATION",
      "Ce message n'appartient pas au sujet à relire.",
    );
  }

  const sheet = await loadSubjectSheet(db, args.subjectId, {
    messages: RELECTURE_SHEET_MESSAGES,
    messagesBefore: message.createdAt,
  });
  const [precedents, reouverture] = await Promise.all([
    findPrecedents(db, {
      accountId: sheet.accountId,
      subjectId: sheet.sujet.id,
      folderId: sheet.sujet.folderId,
      labels: sheet.sujet.etiquettes,
      titre: sheet.sujet.titre,
    }),
    // La réouverture mécanique est journalisée par `updateSubjectStatus`
    // juste après la création du message : c'est là qu'on la retrouve.
    db.eventLog.findFirst({
      where: {
        subjectId: args.subjectId,
        eventType: EVENT_TYPES.subjectStatusChanged,
        createdAt: { gte: message.createdAt },
        metadata: { path: ["to"], equals: SubjectStatus.open },
      },
      select: { id: true },
    }),
  ]);

  const interlocuteur = sheet.contact?.nom ?? "le contact";
  return {
    ...sheet,
    precedents,
    nouveauxMessages: [projectSheetMessage(message, interlocuteur)],
    rouvert: reouverture !== null,
  };
}

// ─────────────────────────────────────────────────────────────
// L'écriture — ce que la relecture a le droit d'écrire
// ─────────────────────────────────────────────────────────────

const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const heure = z.string().regex(/^\d{2}:\d{2}$/);

export const applyRelectureSchema = z.object({
  subjectId: z.uuid(),
  /** Le message relu, rattaché aux tâches et au journal. */
  messageId: z.uuid().optional().nullable(),
  situation: z.object({
    where: z.string().trim().max(500).nullable(),
    nextStep: z.string().trim().max(500).nullable(),
    waitingFor: z.string().trim().max(500).nullable(),
    deadline: dateIso.nullable(),
  }),
  /** Le résumé de Relvo, réécrit ; la description de l'utilisateur l'emporte à l'écran (02, Subject). */
  summary: z.string().trim().max(5000).nullable(),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(300),
        kind: z.enum(TaskKind),
        startDate: dateIso.nullable(),
        startTime: heure.nullable(),
        endDate: dateIso.nullable(),
        endTime: heure.nullable(),
        reason: z.string().trim().max(1000),
        provenance: taskProvenanceSchema.nullable(),
      }),
    )
    .max(10),
  /** Clés du registre, AJOUTÉES à celles du sujet ; ce qui n'y est pas est écarté ici, une seconde fois. */
  labels: z.array(z.string().trim().min(1).max(60)).max(10),
  /** La priorité recalibrée (05 §5.4) ; null pour ne pas y toucher. */
  priority: z.enum(Priority).nullable(),
  /** Vrai : Relvo pose « En attente » — un tiers est attendu sans qu'un envoi l'ait dit (05 §5.3). Faux ou null : il n'y touche pas. */
  waitingForReply: z.boolean().nullable(),
  /** Suggérer la clôture, la retirer, ou ne rien changer (05 §5.5, §8.5). */
  resolution: z.enum(["suggest", "revoke", "keep"]),
  /** Ce qui a changé, en une phrase — le titre du journal. */
  reason: z.string().trim().max(500).nullable(),
  /** La proposition d'origine, intégrale, pour la boucle d'apprentissage (05 §9.1). */
  proposal: z.record(z.string(), z.unknown()).nullable(),
});

export type ApplyRelectureInput = z.input<typeof applyRelectureSchema>;

export type ApplyRelectureResult = {
  taskIds: string[];
  labels: string[];
  priorityChanged: boolean;
  waitingForReplySet: boolean;
  resolution: "suggested" | "revoked" | "kept";
};

function utcDate(d: string | null): Date | null {
  return d ? new Date(`${d}T00:00:00.000Z`) : null;
}
function utcTime(d: string | null, t: string | null): Date | null {
  return d && t ? new Date(`${d}T${t}:00.000Z`) : null;
}

/**
 * Applique une relecture à un sujet OUVERT : situation et résumé réécrits,
 * tâches nouvelles par la primitive du domaine, étiquettes ajoutées,
 * priorité recalibrée, « En attente » posé si Relvo le dit, clôture suggérée
 * ou retirée. Une entrée de journal porte la proposition intégrale.
 *
 * Écrit en plusieurs requêtes, pas en une transaction : chaque primitive
 * transige, et un échec au milieu laisse un sujet partiellement relu mais
 * cohérent — le journal dit ce qui a été fait.
 */
export async function applyRelecture(
  db: TenantDb,
  input: ApplyRelectureInput,
): Promise<ApplyRelectureResult> {
  const data = applyRelectureSchema.parse(input);

  const subject = assertFound(
    await db.subject.findFirst({
      where: { id: data.subjectId },
      select: {
        id: true,
        reference: true,
        status: true,
        labels: true,
        priority: true,
        waitingForReply: true,
        resolutionSuggestedAt: true,
      },
    }),
    "Sujet",
  );
  if (subject.status !== SubjectStatus.open) {
    throw new DomainError(
      "INVALID_STATE",
      "La relecture ne s'applique qu'à un sujet ouvert.",
    );
  }

  const registre = await db.label.findMany({ select: { key: true } });
  const cles = new Set(registre.map((l) => l.key));
  const labels = [
    ...new Set([...subject.labels, ...data.labels.filter((k) => cles.has(k))]),
  ];

  const now = new Date();
  await db.subject.updateMany({
    where: { id: subject.id },
    data: {
      situationWhere: data.situation.where || null,
      situationNextStep: data.situation.nextStep || null,
      situationWaitingFor: data.situation.waitingFor || null,
      situationDeadline: utcDate(data.situation.deadline),
      situationUpdatedAt: now,
      ...(data.summary ? { summary: data.summary } : {}),
      labels,
      lastActivityAt: now,
    },
  });

  const taskIds: string[] = [];
  for (const t of data.tasks) {
    const task = await createTask(db, {
      subjectId: subject.id,
      messageId: data.messageId ?? null,
      title: t.title,
      sourceActor: Actor.ai,
      kind: t.kind,
      startDate: utcDate(t.startDate),
      startTime: utcTime(t.startDate, t.startTime),
      endDate: utcDate(t.endDate),
      endTime: utcTime(t.endDate ?? t.startDate, t.endTime),
      metadata: taskMetadataSchema.parse({
        raison: t.reason,
        provenance: t.provenance,
      }),
    });
    taskIds.push(task.id);
  }

  let priorityChanged = false;
  if (data.priority && data.priority !== subject.priority) {
    await updateSubjectPriority(db, subject.id, data.priority, Actor.ai, {
      messageId: data.messageId ?? null,
      reason: data.reason,
    });
    priorityChanged = true;
  }

  let waitingForReplySet = false;
  if (data.waitingForReply === true && !subject.waitingForReply) {
    await db.subject.updateMany({
      where: { id: subject.id },
      data: { waitingForReply: true },
    });
    await logEvent(db as Tx, {
      entityType: "subject",
      entityId: subject.id,
      subjectId: subject.id,
      messageId: data.messageId ?? null,
      eventType: EVENT_TYPES.waitingForReplySet,
      title: `En attente : ${data.situation.waitingFor ?? "un tiers doit revenir vers vous"}`,
      actor: Actor.ai,
    });
    waitingForReplySet = true;
  }

  let resolution: ApplyRelectureResult["resolution"] = "kept";
  if (data.resolution === "suggest") {
    await suggestResolution(db, subject.id, {
      messageId: data.messageId ?? null,
      reason: data.reason,
    });
    resolution = "suggested";
  } else if (data.resolution === "revoke" && subject.resolutionSuggestedAt) {
    await revokeResolutionSuggestion(db, subject.id, {
      messageId: data.messageId ?? null,
      reason: data.reason,
    });
    resolution = "revoked";
  }

  await logEvent(db as Tx, {
    entityType: "subject",
    entityId: subject.id,
    subjectId: subject.id,
    messageId: data.messageId ?? null,
    eventType: EVENT_TYPES.subjectReviewed,
    title:
      taskIds.length === 0
        ? "Relvo a relu le sujet"
        : `Relvo a relu le sujet : ${taskIds.length} tâche${taskIds.length > 1 ? "s" : ""} en plus`,
    description: data.reason ?? data.situation.where ?? null,
    actor: Actor.ai,
    metadata: {
      proposal: data.proposal ?? null,
      taskIds,
      labels,
      priorityChanged,
      waitingForReplySet,
      resolution,
    },
  });

  return { taskIds, labels, priorityChanged, waitingForReplySet, resolution };
}

/**
 * La relecture a échoué (modèle injoignable, sortie non conforme, erreur en
 * base) : le message est rangé, le sujet reste tel qu'il était, rien n'est
 * inventé (M7.15). Journalisé pour qu'on le voie.
 */
export async function logRelectureFailure(
  db: TenantDb,
  input: { subjectId: string; messageId: string; error: string },
) {
  return logEvent(db as Tx, {
    entityType: "subject",
    entityId: input.subjectId,
    subjectId: input.subjectId,
    messageId: input.messageId,
    eventType: EVENT_TYPES.relectureFailed,
    title: "Relecture interrompue — le sujet reste tel quel",
    description: input.error.slice(0, 500),
    actor: Actor.system,
  });
}
