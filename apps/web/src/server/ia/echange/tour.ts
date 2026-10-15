import "server-only";
import { after } from "next/server";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type ModelMessage,
} from "ai";
import {
  getEchangeProjection,
  isAssistantEnabled,
  logAiSolicitation,
  tenantDb,
} from "@relvo/db";
import { expireTenantData } from "@/server/cached";
import { chat, EchecSollicitation } from "../client";
import { inferenceDisponible, NIVEAU_RETENU } from "../config";
import { contexteEchange, prefixeStable } from "../contexte";
import { injecterVolatil, lirePage } from "./conversions";
import { outilsRelvo, type RelvoUIMessage } from "./outils";

// UN TOUR DE L'ÉCHANGE (M10.7, M10.12, M10.13, M10.14) — ce que la route fait
// d'un message du dirigeant :
//   1. Assistant actif, inférence joignable — sinon Relvo le dit dans le fil,
//      en langage client, jamais une erreur HTTP.
//   2. La projection de la page (`getEchangeProjection`) : compte, brief,
//      fiche de l'affaire ou du contact ouvert — sauf en discussion générale.
//   3. Le contexte assemblé pour le cache (PITFALLS.md #49) : Produit seule
//      en système ; Compte et Domaine en premier message ; l'historique tel
//      que l'interface le rejoue ; Instant et Situation avec le DERNIER
//      message, entre délimiteurs.
//   4. `chat()` : flux, outils, plafond d'étapes, niveau explicite, clé de
//      cache du compte.
//   5. La mesure consignée à la fin du flux (`logAiSolicitation`), dans
//      `after()` — un tour coûte ce qu'il coûte, qu'il ait abouti ou non.

export type EntreeTour = {
  accountId: string;
  messages: RelvoUIMessage[];
  /** La page d'origine (`?from=`), ou null. */
  from: string | null;
  /** Discussion générale : la page n'est pas chargée (M10.5). */
  general: boolean;
};

/** Une réponse de Relvo SANS appel au modèle — un fil, pas une erreur HTTP. */
export function reponseFixe(
  texte: string,
  messages?: RelvoUIMessage[],
): Response {
  const stream = createUIMessageStream<RelvoUIMessage>({
    originalMessages: messages,
    execute: ({ writer }) => {
      const id = "relvo-fixe";
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: texte });
      writer.write({ type: "text-end", id });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export const PHRASES = {
  indisponible:
    "Je ne peux pas répondre pour l'instant : l'assistant n'est pas configuré sur ce compte.",
  desactive:
    "L'assistant est désactivé dans vos préférences. Réactivez-le pour que je puisse vous répondre.",
  tropLong:
    "Cet échange est devenu trop long pour moi. Commencez-en un nouveau, je vous suis.",
  erreur: "Je n'ai pas pu répondre. Réessayez dans un instant.",
} as const;

export async function repondreAuTour(entree: EntreeTour): Promise<Response> {
  const { accountId, messages } = entree;
  const db = tenantDb(accountId);
  const now = new Date();

  if (!inferenceDisponible())
    return reponseFixe(PHRASES.indisponible, messages);
  if (!(await isAssistantEnabled(db, accountId))) {
    return reponseFixe(PHRASES.desactive, messages);
  }

  const page = lirePage(entree.general ? null : entree.from);
  const projection = await getEchangeProjection(db, {
    accountId,
    subjectId: page.subjectId,
    contactId: page.contactId,
    now,
  });
  const contexte = contexteEchange({
    compte: projection.compte,
    domaine: projection.domaine,
    brief: projection.brief,
    sujet: projection.sujet,
    contact: projection.contact,
    instant: {
      maintenant: now.toISOString(),
      page: entree.general ? null : page.page,
    },
  });

  let ecrit = false;
  const outils = outilsRelvo(db, {
    accountId,
    now,
    subjectId: page.subjectId,
    onEcriture: () => {
      ecrit = true;
    },
  });

  const historique = await convertToModelMessages(messages, {
    tools: outils,
    ignoreIncompleteToolCalls: true,
  });
  const modelMessages: ModelMessage[] = injecterVolatil(
    [{ role: "user", content: contexte.prefixe }, ...historique],
    contexte.volatil,
  );

  let tour: ReturnType<typeof chat<typeof outils>>;
  try {
    tour = chat({
      sollicitation: "echange",
      system: contexte.system,
      messages: modelMessages,
      tools: outils,
      reasoning: NIVEAU_RETENU.raisonnement,
      cacheCle: accountId,
      prefixeStable: prefixeStable(contexte),
    });
  } catch (err) {
    if (
      err instanceof EchecSollicitation &&
      err.motif === "entree-trop-longue"
    ) {
      console.warn("[ia] echange", { accountId, motif: err.motif });
      return reponseFixe(PHRASES.tropLong, messages);
    }
    throw err;
  }

  // Le flux est consommé jusqu'au bout même si le téléphone décroche : la
  // mesure, et les écritures des outils, ne dépendent pas de la connexion.
  tour.flux.consumeStream({ onError: () => undefined });
  after(async () => {
    try {
      const mesure = await tour.mesure;
      await logAiSolicitation(db, mesure);
      console.info("[ia] echange", {
        accountId,
        coutEur: mesure.cout.eur,
        cacheLecture: mesure.jetons.cacheLecture,
        dureeMs: mesure.dureeMs,
      });
    } catch (err) {
      console.error("[ia] echange — mesure non consignée", err);
    }
    if (ecrit) expireTenantData();
  });

  return tour.flux.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: false,
    onError: (err) => {
      console.error("[ia] echange — flux", err);
      return PHRASES.erreur;
    },
  });
}
