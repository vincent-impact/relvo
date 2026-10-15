import "server-only";
import { after } from "next/server";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { isAssistantEnabled, logAiSolicitation, tenantDb } from "@relvo/db";
import { expireTenantData } from "@/server/cached";
import { chat, EchecSollicitation } from "../client";
import { inferenceDisponible, NIVEAU_RETENU } from "../config";
import { preparerBrouillon } from "../pipeline/brouillon";
import { construireTour, type EntreeTour } from "./construire";
import type { MetaRelvo, RelvoUIMessage } from "./outils";
import { arretDuTour } from "./tier";

// UN TOUR DE L'ÉCHANGE (M10.7, M10.11 à M10.15) — ce que la route fait d'un
// message du dirigeant :
//   1. Assistant actif, inférence joignable — sinon Relvo le dit dans le fil,
//      en langage client, jamais une erreur HTTP.
//   2. Le tour construit (`construire.ts`) : projection de la page, contexte
//      en préfixe caché (#49), outils, historique rejoué, tier choisi par tour.
//   3. `chat()` : flux, outils, plafond d'étapes, niveau explicite du tier,
//      clé de cache du compte.
//   4. La mesure consignée à la fin du flux (`logAiSolicitation`), dans
//      `after()` — un tour coûte ce qu'il coûte, qu'il ait abouti ou non.
//   5. Ce qui arrête un tour avant la fin — le plafond d'étapes, la sortie
//      trop longue — voyage en métadonnée du message : le fil le dit.

export type { EntreeTour };

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

  const tour = await construireTour(db, entree, {
    now,
    brouillon: (taskId) => preparerBrouillon({ accountId, taskId }),
  });

  let appel: ReturnType<typeof chat<typeof tour.outils>>;
  try {
    appel = chat({
      sollicitation: "echange",
      system: tour.contexte.system,
      messages: tour.modelMessages,
      tools: tour.outils,
      tier: tour.tier,
      reasoning: NIVEAU_RETENU[tour.tier],
      cacheCle: accountId,
      prefixeStable: tour.prefixeStable,
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
  appel.flux.consumeStream({ onError: () => undefined });
  after(async () => {
    try {
      const mesure = await appel.mesure;
      await logAiSolicitation(db, mesure);
      console.info("[ia] echange", {
        accountId,
        tier: tour.tier,
        coutEur: mesure.cout.eur,
        cacheLecture: mesure.jetons.cacheLecture,
        dureeMs: mesure.dureeMs,
      });
    } catch (err) {
      console.error("[ia] echange — mesure non consignée", err);
    }
    if (tour.aEcrit()) expireTenantData();
  });

  return appel.flux.toUIMessageStreamResponse<RelvoUIMessage>({
    originalMessages: messages,
    sendReasoning: false,
    messageMetadata: ({ part }): MetaRelvo | undefined => {
      if (part.type === "start") return { tier: tour.tier };
      if (part.type === "finish") {
        const arret = arretDuTour(part.finishReason);
        return arret ? { tier: tour.tier, arret } : { tier: tour.tier };
      }
      return undefined;
    },
    onError: (err) => {
      console.error("[ia] echange — flux", err);
      return PHRASES.erreur;
    },
  });
}
