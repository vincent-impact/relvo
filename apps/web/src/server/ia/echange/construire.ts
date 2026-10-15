import { convertToModelMessages, type ModelMessage } from "ai";
import { getEchangeProjection, type TenantDb } from "@relvo/db";
import {
  contexteEchange,
  prefixeStable,
  type ContexteEchange,
} from "../contexte";
import { injecterVolatil, lirePage } from "./conversions";
import {
  outilsRelvo,
  type ContexteOutils,
  type RelvoUIMessage,
} from "./outils";
import { tierDuTour, type TierTour } from "./tier";

// CONSTRUIRE un tour (M10) — tout ce qu'un tour envoie au modèle, SANS l'envoyer :
// la projection de la page, le contexte en préfixe caché (#49), les outils, les
// messages dans l'ordre, le tier choisi par tour. Partagé par la route
// (`tour.ts`, qui ajoute le flux et la mesure) et par le jeu d'évaluation
// (`scripts/evaluation/echanger.ts`), qui tourne hors Next : rien ici
// n'importe `server-only` ni `next/*`.

export type EntreeTour = {
  accountId: string;
  messages: RelvoUIMessage[];
  /** La page d'origine (`?from=`), ou null. */
  from: string | null;
  /** Discussion générale : la page n'est pas chargée (M10.5). */
  general: boolean;
};

export type TourConstruit = {
  contexte: ContexteEchange;
  outils: ReturnType<typeof outilsRelvo>;
  modelMessages: ModelMessage[];
  tier: TierTour;
  prefixeStable: number;
  /** Vrai dès qu'un outil a écrit — la route invalide alors le cache. */
  aEcrit: () => boolean;
  page: ReturnType<typeof lirePage>;
};

/** Le texte du dernier tour du dirigeant — ce sur quoi le tier se décide. */
export function dernierTexte(messages: RelvoUIMessage[]): string | null {
  const m = [...messages].reverse().find((x) => x.role === "user");
  if (!m) return null;
  const t = m.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
  return t || null;
}

export async function construireTour(
  db: TenantDb,
  entree: EntreeTour,
  options: {
    now?: Date;
    brouillon: ContexteOutils["brouillon"];
  },
): Promise<TourConstruit> {
  const now = options.now ?? new Date();
  const page = lirePage(entree.general ? null : entree.from);
  const projection = await getEchangeProjection(db, {
    accountId: entree.accountId,
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
    accountId: entree.accountId,
    now,
    subjectId: page.subjectId,
    brouillon: options.brouillon,
    onEcriture: () => {
      ecrit = true;
    },
  });

  const historique = await convertToModelMessages(entree.messages, {
    tools: outils,
    ignoreIncompleteToolCalls: true,
  });
  const modelMessages = injecterVolatil(
    [{ role: "user", content: contexte.prefixe }, ...historique],
    contexte.volatil,
  );

  return {
    contexte,
    outils,
    modelMessages,
    tier: tierDuTour(dernierTexte(entree.messages)),
    prefixeStable: prefixeStable(contexte),
    aEcrit: () => ecrit,
    page,
  };
}
