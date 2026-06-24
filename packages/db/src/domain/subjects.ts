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

// Cycle de vie (cf. invariant produit n°7) : new → acknowledged → resolved →
// archived, + `ignored` (disposition « écarté »). `acknowledged` est l'état actif
// invisible (acquittement). Le passage vers le même statut est un no-op toléré.
// `archived` est système et quasi-terminal. `ignored` : sujet écarté des ouverts,
// hors mémoire, purgeable — récupérable vers `acknowledged` (« désignorer »).
const TRANSITIONS: Record<SubjectStatus, SubjectStatus[]> = {
  new: ["acknowledged", "resolved", "archived", "ignored"],
  acknowledged: ["new", "resolved", "archived", "ignored"],
  resolved: ["acknowledged", "archived", "ignored"],
  archived: ["acknowledged"],
  ignored: ["acknowledged"],
};

// Libellés FR pour le journal de bord (fidèles à l'UI) — un événement doit dire
// CE QUI a changé et de quelle valeur vers quelle valeur, jamais un « modifié »
// opaque. Le domaine ne dépend pas de l'UI : ces maps y sont donc dupliquées.
const STATUS_LABELS: Record<SubjectStatus, string> = {
  new: "Nouveau",
  acknowledged: "En cours",
  resolved: "Terminé",
  archived: "Archivé",
  ignored: "Ignoré",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgent",
  normal: "Normal",
};

/** Nom lisible d'un dossier (ou « Aucun ») pour les libellés de journal. */
async function folderLabel(tx: Tx, folderId: string | null): Promise<string> {
  if (!folderId) return "Aucun";
  const folder = await tx.folder.findFirst({
    where: { id: folderId },
    select: { name: true },
  });
  return folder?.name ?? "Aucun";
}

type SubjectChange = {
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Décrit, champ par champ, ce qui a changé entre l'état courant d'un sujet et
 * l'input d'`updateSubject` — pour produire des entrées de journal explicites
 * (« Dossier modifié : Business → Fournisseurs »). Retourne [] si rien ne bouge.
 */
async function describeSubjectChanges(
  tx: Tx,
  current: {
    title: string;
    summary: string | null;
    folderId: string | null;
    contactIds: string[];
  },
  data: UpdateSubjectInput,
): Promise<SubjectChange[]> {
  const changes: SubjectChange[] = [];

  if (data.title !== undefined && data.title !== current.title) {
    changes.push({
      title: `Nom modifié : « ${current.title} » → « ${data.title} »`,
      metadata: { field: "title", from: current.title, to: data.title },
    });
  }

  if (
    data.folderId !== undefined &&
    (data.folderId ?? null) !== (current.folderId ?? null)
  ) {
    const from = await folderLabel(tx, current.folderId);
    const to = await folderLabel(tx, data.folderId ?? null);
    changes.push({
      title: `Dossier modifié : ${from} → ${to}`,
      metadata: {
        field: "folder",
        from: current.folderId,
        to: data.folderId ?? null,
      },
    });
  }

  if (
    data.summary !== undefined &&
    (data.summary ?? null) !== (current.summary ?? null)
  ) {
    changes.push({
      title: current.summary ? "Résumé modifié" : "Résumé ajouté",
      description: data.summary ?? null,
      metadata: { field: "summary" },
    });
  }

  if (data.contactIds !== undefined) {
    const added = data.contactIds.filter(
      (x) => !current.contactIds.includes(x),
    );
    const removed = current.contactIds.filter(
      (x) => !data.contactIds!.includes(x),
    );
    if (added.length || removed.length) {
      const rows = await tx.contact.findMany({
        where: { id: { in: [...added, ...removed] } },
        select: { id: true, name: true },
      });
      const nameOf = (id: string) =>
        rows.find((r) => r.id === id)?.name ?? "Contact inconnu";
      if (added.length) {
        const names = added.map(nameOf).join(", ");
        changes.push({
          title: `Destinataire${added.length > 1 ? "s" : ""} ajouté${added.length > 1 ? "s" : ""} : ${names}`,
          metadata: { field: "contacts", added },
        });
      }
      if (removed.length) {
        const names = removed.map(nameOf).join(", ");
        changes.push({
          title: `Destinataire${removed.length > 1 ? "s" : ""} retiré${removed.length > 1 ? "s" : ""} : ${names}`,
          metadata: { field: "contacts", removed },
        });
      }
    }
  }

  return changes;
}

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
    const current = assertFound(
      await tx.subject.findFirst({ where: { id } }),
      "Sujet",
    );

    // On calcule les changements AVANT d'écraser les valeurs, pour pouvoir
    // journaliser chaque champ avec son ancienne et sa nouvelle valeur.
    const changes = await describeSubjectChanges(tx as Tx, current, data);

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

    // Un événement explicite par champ modifié. Aucun changement réel → aucun
    // log (on ne pollue pas le journal avec un « modifié » vide).
    for (const change of changes) {
      await logEvent(tx as Tx, {
        entityType: "subject",
        entityId: subject.id,
        subjectId: subject.id,
        eventType: EVENT_TYPES.subjectUpdated,
        title: change.title,
        description: change.description ?? null,
        actor: "user",
        metadata: change.metadata,
      });
    }
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
      title: `État : ${STATUS_LABELS[current.status]} → ${STATUS_LABELS[status]}`,
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
    if (current.priority === priority) return current; // no-op : pas de log
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
      title: `Priorité : ${PRIORITY_LABELS[current.priority]} → ${PRIORITY_LABELS[priority]}`,
      actor,
      metadata: { from: current.priority, to: priority, ...meta },
    });
    return subject;
  });
}

/**
 * Action « Ignorer » : écarte le sujet en posant le statut `ignored`. Décisif et
 * DURABLE — contrairement à une simple dépriorisation, le sujet quitte les
 * ouverts, n'alimente plus la mémoire et devient purgeable. L'« ignorance » est
 * collante : un nouveau message rattaché ne doit pas la lever (cf. pipeline
 * worker). Récupérable via `unignoreSubject` (onglet Ignorés).
 */
export function ignoreSubject(
  db: TenantDb,
  id: string,
  actor: Actor = Actor.user,
) {
  return updateSubjectStatus(db, id, SubjectStatus.ignored, actor);
}

/** « Désignorer » : remet un sujet ignoré dans le fil (→ acknowledged). */
export function unignoreSubject(
  db: TenantDb,
  id: string,
  actor: Actor = Actor.user,
) {
  return updateSubjectStatus(db, id, SubjectStatus.acknowledged, actor);
}

/**
 * Purge des sujets ignorés inactifs depuis `olderThanDays` (15 j par défaut) —
 * comme les messages sans sujet. Sur INACTIVITÉ (lastActivityAt), pas en absolu :
 * un fil bavard ignoré ne doit pas être purgé puis recréé. Destiné à un job
 * planifié (worker/cron) ; NON branché automatiquement en V1.
 */
export async function purgeIgnoredSubjects(
  db: TenantDb,
  olderThanDays = 15,
): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
  const { count } = await db.subject.deleteMany({
    where: { status: SubjectStatus.ignored, lastActivityAt: { lt: cutoff } },
  });
  return { deleted: count };
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
    // Lecture des messages : ouvrir le sujet vaut lecture de ses messages reçus
    // encore non-lus (seul moyen d'« interagir » avec un message). Les orphelins
    // n'ont pas de sujet → restent non-lus jusqu'au tri.
    await tx.message.updateMany({
      where: { subjectId: id, direction: "incoming", readAt: null },
      data: { readAt: new Date() },
    });
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
