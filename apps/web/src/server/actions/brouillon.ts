"use server";

import { type ActionResult, cancelAction, err, ok } from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";
import { getCurrentAccountId } from "@/server/auth-context";
import { preparerBrouillon } from "@/server/ia/pipeline/brouillon";
import { revalidateTenantData } from "@/server/cached";

// Server Actions du BROUILLON (M7.7). Le composer les appelle à l'appui sur
// « Répondre » depuis une tâche : rédiger (ou reprendre) le brouillon, ou
// l'effacer. L'envoi, lui, passe par les actions d'envoi existantes ; c'est
// `createMessage` qui coche la tâche (M7.10).

export async function prepareDraftAction(
  taskId: string,
  options: { regenerer?: boolean } = {},
): Promise<
  ActionResult<{ actionId: string; contenu: string; sources: string[] }>
> {
  const accountId = await getCurrentAccountId();
  if (!accountId) return err("UNAUTHORIZED", "Session requise.");
  const r = await preparerBrouillon({
    accountId,
    taskId,
    regenerer: options.regenerer,
  });
  if (r.issue === "redige" || r.issue === "reutilise") {
    return ok({ actionId: r.actionId, contenu: r.contenu, sources: r.sources });
  }
  if (r.issue === "desactive") {
    return err(
      "INVALID_STATE",
      "L'assistant Relvo est coupé sur ce compte (page Préférences du menu).",
    );
  }
  if (r.issue === "inference-indisponible") {
    return err("INVALID_STATE", "Relvo n'est pas joignable pour l'instant.");
  }
  if (r.issue === "decisions-en-attente") {
    return err(
      "INVALID_STATE",
      "Répondez d'abord aux décisions : Relvo rédige ensuite.",
    );
  }
  return err("INVALID_STATE", "Relvo n'a pas pu rédiger le brouillon.");
}

export async function clearDraftAction(actionId: string) {
  const result = await domainAction((db) => cancelAction(db, actionId));
  if (result.ok) {
    revalidatePath("/sujets/[id]", "page");
    revalidateTenantData();
  }
  return result;
}
