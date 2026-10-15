"use server";

import { revalidatePath } from "next/cache";
import {
  type Annulation,
  type AnswerQuestionInput,
  answerQuestion,
  defaireGeste,
  dismissQuestion,
} from "@relvo/db";
import { domainAction } from "@/lib/action-result";
import { revalidateTenantData } from "@/server/cached";

// Server Actions de l'ÉCHANGE avec Relvo : défaire un geste depuis son bloc
// dans le fil (M10.10), répondre à une question de Relvo ou l'écarter (M18.9).
// La logique vit dans le domaine ; ici la session, et le cache à invalider —
// le badge du bouton, l'accueil, le Calendrier, les affaires.

export async function annulerGesteAction(annulation: Annulation) {
  const result = await domainAction((db) => defaireGeste(db, annulation));
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/fil");
    revalidatePath("/calendrier");
    revalidatePath("/memoire");
    revalidatePath("/sujets/[id]", "page");
    revalidateTenantData();
  }
  return result;
}

const CHAT = { source: "chat" as const };

/** Répond à une question de Relvo depuis l'échange (05 §11.12) — la même fonction que la fiche. */
export async function repondreQuestionAction(
  id: string,
  input: AnswerQuestionInput,
) {
  const result = await domainAction((db) =>
    answerQuestion(db, id, input, CHAT),
  );
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/memoire");
    revalidatePath("/relvo");
    revalidateTenantData();
  }
  return result;
}

/** Écarte une question : jamais reposée. */
export async function ecarterQuestionAction(id: string) {
  const result = await domainAction((db) => dismissQuestion(db, id, CHAT));
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/relvo");
    revalidateTenantData();
  }
  return result;
}
