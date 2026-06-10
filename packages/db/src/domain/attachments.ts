import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import { Actor } from "../generated/prisma/enums";
import type { TenantDb, Tx } from "../tenant";
import { assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { ensureAffected } from "./helpers";

// Domaine Attachments (M3.10). Métadonnées IA à 3 niveaux (label/summary/
// analysis), chacune horodatée comme flag de cache : jamais d'appel double pour
// un même niveau (M8.4). En V1 seul le niveau 1 (label Haiku) est produit.

export const createAttachmentSchema = z.object({
  messageId: z.uuid(),
  subjectId: z.uuid().optional().nullable(),
  name: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().max(255).optional().nullable(),
  fileUrl: z.string().trim().min(1).max(2000),
  fileSize: z.number().int().nonnegative().optional().nullable(),
});

export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;

export function listAttachments(
  db: TenantDb,
  opts: { messageId?: string; subjectId?: string } = {},
) {
  return db.attachment.findMany({
    where: {
      ...(opts.messageId ? { messageId: opts.messageId } : {}),
      ...(opts.subjectId ? { subjectId: opts.subjectId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAttachment(db: TenantDb, id: string) {
  return assertFound(
    await db.attachment.findFirst({ where: { id } }),
    "Pièce jointe",
  );
}

export async function createAttachment(
  db: TenantDb,
  input: CreateAttachmentInput,
  actor: Actor = Actor.contact,
) {
  const data = createAttachmentSchema.parse(input);
  return db.$transaction(async (tx) => {
    const attachment = await tx.attachment.create({
      data: {
        messageId: data.messageId,
        subjectId: data.subjectId ?? null,
        name: data.name,
        mimeType: data.mimeType ?? null,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize ?? null,
      } as Prisma.AttachmentUncheckedCreateInput,
    });
    await logEvent(tx as Tx, {
      entityType: "attachment",
      entityId: attachment.id,
      messageId: attachment.messageId,
      subjectId: attachment.subjectId,
      eventType: EVENT_TYPES.attachmentCreated,
      title: `Pièce jointe reçue : ${attachment.name}`,
      actor,
    });
    return attachment;
  });
}

// ── Métadonnées IA (idempotentes : no-op si le niveau est déjà en cache) ─────

export async function setAiLabel(db: TenantDb, id: string, label: string) {
  const current = await getAttachment(db, id);
  if (current.aiLabelAt) return current; // déjà étiqueté (cache)
  return db.$transaction(async (tx) => {
    const { count } = await tx.attachment.updateMany({
      where: { id },
      data: { aiLabel: label, aiLabelAt: new Date() },
    });
    ensureAffected(count, "Pièce jointe");
    const updated = assertFound(
      await tx.attachment.findFirst({ where: { id } }),
      "Pièce jointe",
    );
    await logEvent(tx as Tx, {
      entityType: "attachment",
      entityId: updated.id,
      subjectId: updated.subjectId,
      eventType: EVENT_TYPES.attachmentLabeled,
      title: `Pièce jointe étiquetée : ${label}`,
      actor: "ai",
    });
    return updated;
  });
}

export async function setAiSummary(db: TenantDb, id: string, summary: string) {
  const current = await getAttachment(db, id);
  if (current.aiSummaryAt) return current; // déjà résumé (cache)
  const { count } = await db.attachment.updateMany({
    where: { id },
    data: { aiSummary: summary, aiSummaryAt: new Date() },
  });
  ensureAffected(count, "Pièce jointe");
  return getAttachment(db, id);
}

export async function setAiAnalysis(
  db: TenantDb,
  id: string,
  analysis: string,
) {
  const current = await getAttachment(db, id);
  if (current.aiAnalysisAt) return current; // déjà analysé (cache)
  const { count } = await db.attachment.updateMany({
    where: { id },
    data: { aiAnalysis: analysis, aiAnalysisAt: new Date() },
  });
  ensureAffected(count, "Pièce jointe");
  return getAttachment(db, id);
}

export async function deleteAttachment(db: TenantDb, id: string) {
  const { count } = await db.attachment.deleteMany({ where: { id } });
  ensureAffected(count, "Pièce jointe");
  return { id };
}
