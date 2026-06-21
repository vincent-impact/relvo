import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import { Actor, Priority, SubjectStatus } from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { DomainError, assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { ensureAffected } from "./helpers";
import { cursorArgs, paginationSchema, toPage } from "./pagination";
import { nextSubjectReference } from "./reference";

// Domaine Subjects (M3.7) — entité centrale. CRUD + transitions de statut
// validées + dépriorisation (« Ignorer ») + acquittement implicite. Invariant :
// folder_id ne pointe jamais le Folder « Général » (documentaire transversal).

// Cycle de vie à 4 valeurs (cf. invariant produit n°7) : new → acknowledged →
// resolved → archived. `acknowledged` est l'état actif invisible (acquittement).
// Le passage vers le même statut est un no-op toléré. `archived` est système et
// quasi-terminal (réouverture possible vers `acknowledged` uniquement).
const TRANSITIONS: Record<SubjectStatus, SubjectStatus[]> = {
  new: ["acknowledged", "resolved", "archived"],
  acknowledged: ["new", "resolved", "archived"],
  resolved: ["acknowledged", "archived"],
  archived: ["acknowledged"],
};

const PRIORITY_LADDER: Priority[] = [
  Priority.low,
  Priority.high,
  Priority.critical,
];

const actorEnum = z.enum(Actor);

export const createSubjectSchema = z.object({
  /** Override optionnel de la référence (seed/import) ; sinon auto SUB-NNNNN. */
  reference: z.string().trim().max(40).optional(),
  title: z.string().trim().min(1, "Titre requis").max(200),
  summary: z.string().trim().max(5000).optional().nullable(),
  folderId: z.uuid().optional().nullable(),
  contactIds: z.array(z.uuid()).optional().default([]),
  status: z.enum(SubjectStatus).optional(),
  priority: z.enum(Priority).optional(),
  waitingForReply: z.boolean().optional().default(false),
  sourceChannelId: z.uuid().optional().nullable(),
  createdByActor: actorEnum.default(Actor.user),
});

export const updateSubjectSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().max(5000).optional().nullable(),
  folderId: z.uuid().optional().nullable(),
  contactIds: z.array(z.uuid()).optional(),
});

export type CreateSubjectInput = z.input<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;

/** Lève FORBIDDEN_GENERAL_FOLDER si le folder cible est le « Général ». */
async function assertFolderAssignable(db: Tx, folderId: string) {
  const folder = assertFound(
    await db.folder.findFirst({ where: { id: folderId } }),
    "Dossier",
  );
  if (folder.isDefault) {
    throw new DomainError(
      "FORBIDDEN_GENERAL_FOLDER",
      "Le dossier « Général » est documentaire : aucun sujet ne peut y être rangé.",
    );
  }
}

export async function listSubjects(
  db: TenantDb,
  opts: {
    status?: SubjectStatus;
    folderId?: string | null;
    priority?: Priority;
    cursor?: string;
    limit?: number;
  } = {},
) {
  const { limit } = paginationSchema.parse(opts);
  const { _limit, ...args } = cursorArgs(opts);
  const rows = await db.subject.findMany({
    ...args,
    where: {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.folderId !== undefined ? { folderId: opts.folderId } : {}),
      ...(opts.priority ? { priority: opts.priority } : {}),
    },
    orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
  });
  return toPage(rows, limit);
}

export async function getSubject(db: TenantDb, id: string) {
  return assertFound(await db.subject.findFirst({ where: { id } }), "Sujet");
}

export async function createSubject(db: TenantDb, input: CreateSubjectInput) {
  const data = createSubjectSchema.parse(input);
  return db.$transaction(async (tx) => {
    if (data.folderId) await assertFolderAssignable(tx as Tx, data.folderId);

    const now = new Date();
    const reference = data.reference ?? (await nextSubjectReference(tx as Tx));
    const subject = await tx.subject.create({
      data: {
        reference,
        title: data.title,
        summary: data.summary ?? null,
        folderId: data.folderId ?? null,
        contactIds: data.contactIds,
        ...(data.status ? { status: data.status } : {}),
        ...(data.priority ? { priority: data.priority } : {}),
        waitingForReply: data.waitingForReply,
        sourceChannelId: data.sourceChannelId ?? null,
        createdByActor: data.createdByActor,
        openedAt: now,
        lastActivityAt: now,
      } as Prisma.SubjectUncheckedCreateInput,
    });
    await logEvent(tx as Tx, {
      entityType: "subject",
      entityId: subject.id,
      subjectId: subject.id,
      eventType: EVENT_TYPES.subjectCreated,
      title: `Sujet ${subject.reference} créé`,
      description: subject.title,
      actor: data.createdByActor,
    });
    return subject;
  });
}

export async function updateSubject(
  db: TenantDb,
  id: string,
  input: UpdateSubjectInput,
) {
  const data = updateSubjectSchema.parse(input);
  return db.$transaction(async (tx) => {
    if (data.folderId) await assertFolderAssignable(tx as Tx, data.folderId);
    const { count } = await tx.subject.updateMany({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        ...(data.folderId !== undefined ? { folderId: data.folderId } : {}),
        ...(data.contactIds !== undefined
          ? { contactIds: data.contactIds }
          : {}),
        lastActivityAt: new Date(),
      },
    });
    ensureAffected(count, "Sujet");
    const subject = assertFound(
      await tx.subject.findFirst({ where: { id } }),
      "Sujet",
    );
    await logEvent(tx as Tx, {
      entityType: "subject",
      entityId: subject.id,
      subjectId: subject.id,
      eventType: EVENT_TYPES.subjectUpdated,
      title: `Sujet ${subject.reference} modifié`,
      actor: "user",
    });
    return subject;
  });
}

export async function updateSubjectStatus(
  db: TenantDb,
  id: string,
  status: SubjectStatus,
  actor: Actor = Actor.user,
) {
  return db.$transaction(async (tx) => {
    const current = assertFound(
      await tx.subject.findFirst({ where: { id } }),
      "Sujet",
    );
    if (current.status === status) return current; // no-op idempotent
    if (!TRANSITIONS[current.status].includes(status)) {
      throw new DomainError(
        "INVALID_STATUS_TRANSITION",
        `Transition de statut interdite : ${current.status} → ${status}.`,
      );
    }
    const now = new Date();
    const { count } = await tx.subject.updateMany({
      where: { id },
      data: {
        status,
        lastActivityAt: now,
        ...(status === SubjectStatus.resolved ? { resolvedAt: now } : {}),
        // Sortie de l'état résolu : on efface la date de résolution.
        ...(current.status === SubjectStatus.resolved &&
        status !== SubjectStatus.archived
          ? { resolvedAt: null }
          : {}),
      },
    });
    ensureAffected(count, "Sujet");
    const subject = assertFound(
      await tx.subject.findFirst({ where: { id } }),
      "Sujet",
    );
    const eventType =
      status === SubjectStatus.resolved
        ? EVENT_TYPES.subjectResolved
        : status === SubjectStatus.archived
          ? EVENT_TYPES.subjectArchived
          : EVENT_TYPES.subjectStatusChanged;
    await logEvent(tx as Tx, {
      entityType: "subject",
      entityId: subject.id,
      subjectId: subject.id,
      eventType,
      title: `Sujet ${subject.reference} : ${current.status} → ${status}`,
      actor,
      metadata: { from: current.status, to: status },
    });
    return subject;
  });
}

export function resolveSubject(
  db: TenantDb,
  id: string,
  actor: Actor = Actor.user,
) {
  return updateSubjectStatus(db, id, SubjectStatus.resolved, actor);
}

export function archiveSubject(
  db: TenantDb,
  id: string,
  actor: Actor = Actor.user,
) {
  return updateSubjectStatus(db, id, SubjectStatus.archived, actor);
}

export async function updateSubjectPriority(
  db: TenantDb,
  id: string,
  priority: Priority,
  actor: Actor = Actor.user,
  meta?: Record<string, unknown>,
) {
  return db.$transaction(async (tx) => {
    const current = assertFound(
      await tx.subject.findFirst({ where: { id } }),
      "Sujet",
    );
    const { count } = await tx.subject.updateMany({
      where: { id },
      data: { priority, lastActivityAt: new Date() },
    });
    ensureAffected(count, "Sujet");
    const subject = assertFound(
      await tx.subject.findFirst({ where: { id } }),
      "Sujet",
    );
    await logEvent(tx as Tx, {
      entityType: "subject",
      entityId: subject.id,
      subjectId: subject.id,
      eventType: EVENT_TYPES.subjectPriorityChanged,
      title: `Sujet ${subject.reference} : priorité ${current.priority} → ${priority}`,
      actor,
      metadata: { from: current.priority, to: priority, ...meta },
    });
    return subject;
  });
}

/**
 * Action « Ignorer » du feed (cas feed prioritaire) : rétrograde la priorité
 * d'un cran (critical→high→low). Sans effet si déjà `low`.
 */
export async function ignoreSubject(db: TenantDb, id: string) {
  const current = assertFound(
    await db.subject.findFirst({ where: { id } }),
    "Sujet",
  );
  const idx = PRIORITY_LADDER.indexOf(current.priority);
  if (idx <= 0) return current; // déjà low : rien à dégrader
  const next = PRIORITY_LADDER[idx - 1]!;
  return updateSubjectPriority(db, id, next, Actor.user, {
    delta: -1,
    source: "feed_ignore",
  });
}

/**
 * Acquittement implicite : ouvrir la fiche d'un sujet (cf. invariant n°10).
 * Met à jour `lastOpenedAt` et, si le sujet était `new`, le fait passer à
 * `acknowledged` (état actif invisible) — ce qui retire le badge « Nouveau ».
 */
export async function openSubject(db: TenantDb, id: string) {
  return db.$transaction(async (tx) => {
    const current = assertFound(
      await tx.subject.findFirst({ where: { id } }),
      "Sujet",
    );
    const { count } = await tx.subject.updateMany({
      where: { id },
      data: {
        lastOpenedAt: new Date(),
        ...(current.status === SubjectStatus.new
          ? { status: SubjectStatus.acknowledged }
          : {}),
      },
    });
    ensureAffected(count, "Sujet");
    const subject = assertFound(
      await tx.subject.findFirst({ where: { id } }),
      "Sujet",
    );
    await logEvent(tx as Tx, {
      entityType: "subject",
      entityId: subject.id,
      subjectId: subject.id,
      eventType: EVENT_TYPES.subjectOpened,
      title: `Sujet ${subject.reference} ouvert`,
      actor: "user",
    });
    return subject;
  });
}

/** Relvo propose la clôture (resolution_suggested_at). */
export async function suggestResolution(db: TenantDb, id: string) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.subject.updateMany({
      where: { id },
      data: { resolutionSuggestedAt: new Date() },
    });
    ensureAffected(count, "Sujet");
    const subject = assertFound(
      await tx.subject.findFirst({ where: { id } }),
      "Sujet",
    );
    await logEvent(tx as Tx, {
      entityType: "subject",
      entityId: subject.id,
      subjectId: subject.id,
      eventType: EVENT_TYPES.resolutionSuggested,
      title: `Résolution suggérée pour ${subject.reference}`,
      actor: "ai",
    });
    return subject;
  });
}

export async function deleteSubject(db: TenantDb, id: string) {
  const { count } = await db.subject.deleteMany({ where: { id } });
  ensureAffected(count, "Sujet");
  return { id };
}
