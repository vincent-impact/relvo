import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import {
  AbsorptionStatus,
  Actor,
  KnowledgeKind,
} from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { ensureAffected } from "./helpers";

// Domaine Knowledge — INSTRUCTIONS (kind=note) : consignes Markdown que Relvo
// consulte. V1 : seul l'utilisateur les édite (invariant n°20). L'état
// d'absorption sert d'interrupteur d'activation : `read` = active (injectée dans
// les prompts), `ignored` = désactivée (écartée du contexte).
//
// DOCUMENTS (kind=file) : l'upload arrive en M11 ; la suppression vit ici. Le
// fichier dans R2 est effacé par l'outbox alimentée par trigger (M4.6), pas par
// ce code — cf. `deleteDocument`.

export const createNoteSchema = z.object({
  folderId: z.uuid(),
  name: z.string().trim().min(1, "Titre requis").max(120),
  content: z.string().trim().max(20_000).optional().nullable(),
});

export const updateNoteSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  content: z.string().trim().max(20_000).optional().nullable(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export async function createNote(db: TenantDb, input: CreateNoteInput) {
  const data = createNoteSchema.parse(input);
  return db.$transaction(async (tx) => {
    const note = await tx.knowledgeDocument.create({
      data: {
        folderId: data.folderId,
        kind: KnowledgeKind.note,
        name: data.name,
        content: data.content ?? null,
        absorptionStatus: AbsorptionStatus.read,
        createdByActor: Actor.user,
      } as Prisma.KnowledgeDocumentUncheckedCreateInput,
    });
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: note.id,
      eventType: EVENT_TYPES.knowledgeCreated,
      title: `Instruction « ${note.name} » créée`,
      actor: "user",
    });
    return note;
  });
}

export async function updateNote(
  db: TenantDb,
  id: string,
  input: UpdateNoteInput,
) {
  const data = updateNoteSchema.parse(input);
  return db.$transaction(async (tx) => {
    const { count } = await tx.knowledgeDocument.updateMany({
      where: { id, kind: KnowledgeKind.note },
      data: {
        updatedByActor: Actor.user,
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
      },
    });
    ensureAffected(count, "Instruction");
    const note = assertFound(
      await tx.knowledgeDocument.findFirst({ where: { id } }),
      "Instruction",
    );
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: note.id,
      eventType: EVENT_TYPES.knowledgeUpdated,
      title: `Instruction « ${note.name} » modifiée`,
      actor: "user",
    });
    return note;
  });
}

/**
 * Active/désactive une instruction (interrupteur d'absorption). `active=true` →
 * `read` (Relvo l'applique) ; `false` → `ignored` (écartée du contexte).
 */
export async function setNoteActive(db: TenantDb, id: string, active: boolean) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.knowledgeDocument.updateMany({
      where: { id, kind: KnowledgeKind.note },
      data: {
        absorptionStatus: active
          ? AbsorptionStatus.read
          : AbsorptionStatus.ignored,
        updatedByActor: Actor.user,
      },
    });
    ensureAffected(count, "Instruction");
    const note = assertFound(
      await tx.knowledgeDocument.findFirst({ where: { id } }),
      "Instruction",
    );
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: note.id,
      eventType: active
        ? EVENT_TYPES.knowledgeActivated
        : EVENT_TYPES.knowledgeDeactivated,
      title: `Instruction « ${note.name} » ${active ? "activée" : "désactivée"}`,
      actor: "user",
    });
    return note;
  });
}

export async function deleteNote(db: TenantDb, id: string) {
  const { count } = await db.knowledgeDocument.deleteMany({
    where: { id, kind: KnowledgeKind.note },
  });
  ensureAffected(count, "Instruction");
  return { id };
}

/**
 * Supprime un DOCUMENT (kind=file). Le FICHIER est effacé par ailleurs (M4.6) :
 * un trigger PostgreSQL met sa clé dans l'outbox `pending_file_deletions`, un
 * worker draine hors transaction.
 *
 * Distinct de `deleteNote` uniquement par le `kind` — l'instruction est du texte
 * inline, le document a un objet, mais ni l'un ni l'autre n'a à s'en occuper.
 *
 * NB : `anthropic_file_id` pointe vers la copie d'inférence chez Anthropic. Elle
 * n'est pas nettoyée ici — ça viendra avec M11, qui l'y aura poussée.
 */
export async function deleteDocument(db: TenantDb, id: string) {
  const { count } = await db.knowledgeDocument.deleteMany({
    where: { id, kind: KnowledgeKind.file },
  });
  ensureAffected(count, "Document");
  return { id };
}
