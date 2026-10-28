"use server";

import { revalidatePath } from "next/cache";
import {
  type Annulation,
  type AnswerQuestionInput,
  BOITES_PROPOSEES,
  answerQuestion,
  defaireGeste,
  dismissQuestion,
  requestChannelCatchup,
} from "@relvo/db";
import { domainAction } from "@/lib/action-result";
import { connectEmailChannelAction } from "@/server/actions/email";
import { getTenantDb } from "@/server/auth-context";
import { revalidateTenantData } from "@/server/cached";
import { lancerTranche } from "@/server/ia/pipeline/rattrapage";

// Server Actions de l'ÉCHANGE avec Relvo : défaire un geste depuis son bloc
// dans le fil (M10.10), répondre à une question de Relvo ou l'écarter (M18.9).
// La logique vit dans le domaine ; ici la session, et le cache à invalider —
// le badge du bouton, l'accueil, le Calendrier, les sujets.

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
  if (result.ok && result.data.outcome.kind === "lecture-etendue") {
    // « Lisez deux semaines de plus » (05 §11.11) : la lecture suivante sur
    // le même canal, même mécanique ; la carte vivante repart dans l'échange.
    const { channelId, since } = result.data.outcome;
    const db = await getTenantDb();
    const catchup = await requestChannelCatchup(db, { channelId, since });
    await lancerTranche(catchup.id).catch((e) =>
      console.error("[ia] lecture étendue non lancée", e),
    );
  }
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/memoire");
    revalidatePath("/relvo");
    revalidateTenantData();
  }
  return result;
}

/**
 * La boîte confiée à la dernière étape de la prise en main (05 §11.11) : la
 * connexion ordinaire d'un canal — Gmail, par le relais (M24.2) —, avec retour
 * dans l'échange, c'est là que la lecture se suit. La question n'est PAS
 * répondue ici : c'est la connexion qui la ferme (`/api/gmail/retour`),
 * revenir en arrière la laisse ouverte.
 */
export async function connecterBoiteDepuisEchangeAction(choix: string) {
  if (!BOITES_PROPOSEES.some((b) => b.key === choix)) {
    return {
      ok: false as const,
      code: "VALIDATION" as const,
      message: "Boîte inconnue.",
    };
  }
  return connectEmailChannelAction("relvo");
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
