import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import {
  draft,
  EchecSollicitation,
  estimerEntree,
  extract,
  PLAFONDS,
  retentionCache,
} from "@/server/ia";

// LES PLAFONDS PAR APPEL ET LE CACHE ADRESSÉ SONT TENUS PAR UN TEST (M7
// tranche 8, 05 §10.5–§10.6).
//
// Ce que le client garantit et que rien d'autre ne garantit : une entrée qui
// déborde est refusée AVANT l'appel — zéro jeton ; une sortie tronquée n'est
// jamais exploitée, et son coût voyage avec l'échec pour être journalisé ; une
// sortie non conforme au schéma est un échec nommé, avec son coût ; la clé de
// cache du compte et la rétention atteignent le fournisseur ; le préfixe
// stable annoncé par le site d'appel revient dans la mesure.

const usage = {
  inputTokens: {
    total: 2_000,
    noCache: 500,
    cacheRead: 1_500,
    cacheWrite: undefined,
  },
  outputTokens: { total: 40, text: 30, reasoning: 10 },
};

function modeleSimule(texte: string, finishReason: "stop" | "length" = "stop") {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: texte }],
      finishReason: { unified: finishReason, raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

const schema = z.object({ ok: z.boolean() });

describe("client d'inférence — plafonds par appel", () => {
  it("refuse une entrée au-delà du plafond du tier AVANT l'appel, à zéro jeton", async () => {
    const modele = modeleSimule('{"ok":true}');
    const prompt = "x".repeat(PLAFONDS.jetonsEntree.extraction * 3.5 + 100);
    expect(estimerEntree({ prompt })).toBeGreaterThan(
      PLAFONDS.jetonsEntree.extraction,
    );
    const erreur = await extract({
      sollicitation: "banc-essai",
      prompt,
      schema,
      modele,
      reasoning: "low",
    }).catch((e) => e);
    expect(erreur).toBeInstanceOf(EchecSollicitation);
    expect(erreur.motif).toBe("entree-trop-longue");
    expect(erreur.mesure).toBeNull();
    expect(modele.doGenerateCalls).toHaveLength(0);
  });

  it("une sortie tronquée au plafond est un échec qui porte son coût, sur l'objet comme sur le texte", async () => {
    const objet = await extract({
      sollicitation: "banc-essai",
      prompt: "x",
      schema,
      modele: modeleSimule('{"ok":tr', "length"),
      reasoning: "low",
    }).catch((e) => e);
    expect(objet).toBeInstanceOf(EchecSollicitation);
    expect(objet.motif).toBe("plafond-sortie");
    expect(objet.mesure?.jetons.sortie).toBe(40);
    expect(objet.mesure?.jetons.cacheLecture).toBe(1_500);

    const texte = await draft({
      sollicitation: "banc-essai",
      prompt: "x",
      modele: modeleSimule("Bonjour, je vous confirme que la", "length"),
      reasoning: "low",
    }).catch((e) => e);
    expect(texte).toBeInstanceOf(EchecSollicitation);
    expect(texte.motif).toBe("plafond-sortie");
    expect(texte.mesure?.jetons.raisonnement).toBe(10);
  });

  it("une sortie qui ne respecte pas le schéma est un échec nommé, avec son coût", async () => {
    const erreur = await extract({
      sollicitation: "banc-essai",
      prompt: "x",
      schema,
      modele: modeleSimule('{"autre":1}'),
      reasoning: "low",
    }).catch((e) => e);
    expect(erreur).toBeInstanceOf(EchecSollicitation);
    expect(erreur.motif).toBe("sortie-non-conforme");
    expect(erreur.mesure?.jetons.entree).toBe(500);
    expect(erreur.sollicitation).toBe("banc-essai");
  });

  it("le plafond de sortie est posé par tier, raisonnement compris", () => {
    expect(PLAFONDS.jetonsSortie.extraction).toBeLessThanOrEqual(3_000);
    expect(PLAFONDS.jetonsSortie.classification).toBeLessThan(
      PLAFONDS.jetonsSortie.extraction,
    );
    expect(PLAFONDS.jetonsEntree.extraction).toBeGreaterThan(
      PLAFONDS.jetonsSortie.extraction,
    );
  });
});

describe("client d'inférence — cache adressé et mesuré", () => {
  it("la clé de cache du compte et la rétention atteignent le fournisseur", async () => {
    const modele = modeleSimule('{"ok":true}');
    await extract({
      sollicitation: "banc-essai",
      prompt: "x",
      schema,
      modele,
      reasoning: "low",
      cacheCle: "compte-42",
    });
    const options = modele.doGenerateCalls[0].providerOptions as
      | { openai?: Record<string, unknown> }
      | undefined;
    expect(options?.openai?.promptCacheKey).toBe("compte-42");
    expect(options?.openai?.promptCacheRetention).toBe(retentionCache());
  });

  it("sans clé — banc d'essai, tests —, aucune option fournisseur ne part", async () => {
    const modele = modeleSimule('{"ok":true}');
    await extract({
      sollicitation: "banc-essai",
      prompt: "x",
      schema,
      modele,
      reasoning: "low",
    });
    expect(modele.doGenerateCalls[0].providerOptions).toBeUndefined();
  });

  it("la rétention vaut 24 h par défaut, et se surcharge par l'environnement", () => {
    expect(retentionCache({})).toBe("24h");
    expect(retentionCache({ RELVO_IA_CACHE_RETENTION: "in_memory" })).toBe(
      "in_memory",
    );
    expect(retentionCache({ RELVO_IA_CACHE_RETENTION: "n'importe quoi" })).toBe(
      "24h",
    );
  });

  it("le préfixe stable annoncé revient dans la mesure, à côté du cache lu", async () => {
    const { mesure } = await extract({
      sollicitation: "banc-essai",
      prompt: "x",
      schema,
      modele: modeleSimule('{"ok":true}'),
      reasoning: "low",
      prefixeStable: 1_800,
    });
    expect(mesure.prefixeStable).toBe(1_800);
    expect(mesure.jetons.cacheLecture).toBe(1_500);
    const sans = await draft({
      sollicitation: "banc-essai",
      prompt: "x",
      modele: modeleSimule("ok"),
      reasoning: "low",
    });
    expect(sans.mesure.prefixeStable).toBeNull();
  });

  it("la rédaction avec un schéma rend un objet — le brouillon porte ses citations", async () => {
    const { sortie } = await draft({
      sollicitation: "banc-essai",
      prompt: "x",
      schema: z.object({ texte: z.string(), sources: z.array(z.string()) }),
      modele: modeleSimule('{"texte":"Bonjour","sources":["Procédure"]}'),
      reasoning: "low",
    });
    expect(sortie).toEqual({ texte: "Bonjour", sources: ["Procédure"] });
  });
});
