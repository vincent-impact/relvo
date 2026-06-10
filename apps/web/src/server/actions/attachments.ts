"use server";

import {
  type CreateAttachmentInput,
  createAttachment,
  deleteAttachment,
  setAiAnalysis,
  setAiLabel,
  setAiSummary,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";

// Server Actions Attachments (M3.10). La création vient surtout de l'ingestion
// (worker) ; les setters IA sont idempotents (cache par niveau).

export async function createAttachmentAction(input: CreateAttachmentInput) {
  const result = await domainAction((db) => createAttachment(db, input));
  if (result.ok) revalidatePath("/fil");
  return result;
}

export async function setAttachmentLabelAction(id: string, label: string) {
  return domainAction((db) => setAiLabel(db, id, label));
}

export async function setAttachmentSummaryAction(id: string, summary: string) {
  return domainAction((db) => setAiSummary(db, id, summary));
}

export async function setAttachmentAnalysisAction(
  id: string,
  analysis: string,
) {
  return domainAction((db) => setAiAnalysis(db, id, analysis));
}

export async function deleteAttachmentAction(id: string) {
  return domainAction((db) => deleteAttachment(db, id));
}
