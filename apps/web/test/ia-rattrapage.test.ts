import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { extract, RATTRAPAGE } from "@/server/ia";
import {
  estHistorique,
  fenetreDeRattrapage,
  motifDArret,
} from "@/server/ia/pipeline/rattrapage-regles";

// LE RATTRAPAGE EST TENU PAR UN TEST SUR SES RÈGLES PURES (M7.19, tranche 9) :
// la fenêtre lue, la reconnaissance d'un message d'historique, les plafonds
// qui l'arrêtent — messages, euros, nuits —, et le niveau de service « flex »
// qui atteint le fournisseur quand un appel part en lot.

describe("rattrapage — règles pures", () => {
  it("la fenêtre lue commence il y a autant de jours que la configuration", () => {
    const maintenant = new Date("2026-09-20T10:00:00Z");
    expect(fenetreDeRattrapage(maintenant, 30).toISOString()).toBe(
      "2026-08-21T10:00:00.000Z",
    );
    expect(RATTRAPAGE.fenetreJours).toBe(30);
  });

  it("un message bien plus vieux que le délai est de l'historique ; un message vivant, une date absente ou illisible ne le sont pas", () => {
    const t = new Date("2026-09-20T10:00:00Z").getTime();
    const delai = RATTRAPAGE.delaiWebhookMs;
    expect(estHistorique("2026-09-19T10:00:00Z", delai, t)).toBe(true);
    expect(estHistorique("2026-09-20T09:30:00Z", delai, t)).toBe(false);
    expect(estHistorique("2026-09-20T10:05:00Z", delai, t)).toBe(false);
    expect(estHistorique(null, delai, t)).toBe(false);
    expect(estHistorique("pas une date", delai, t)).toBe(false);
  });

  it("s'arrête au plafond de messages, d'euros, ou de nuits — et continue sinon", () => {
    const plafonds = { messages: 300, euros: 2, nuits: 3 };
    expect(
      motifDArret({ messagesTriaged: 12, costEur: 0.1, runs: 1 }, plafonds),
    ).toBeNull();
    expect(
      motifDArret({ messagesTriaged: 300, costEur: 0.4, runs: 1 }, plafonds),
    ).toBe("plafond-messages");
    expect(
      motifDArret({ messagesTriaged: 50, costEur: 2, runs: 1 }, plafonds),
    ).toBe("plafond-euros");
    expect(
      motifDArret({ messagesTriaged: 50, costEur: 0.5, runs: 4 }, plafonds),
    ).toBe("nuits-epuisees");
    // Les plafonds de la configuration sont ceux arrêtés avec le dirigeant.
    expect(RATTRAPAGE.plafondMessages).toBe(300);
    expect(RATTRAPAGE.plafondEuros).toBe(2);
    expect(
      motifDArret({
        messagesTriaged: RATTRAPAGE.plafondMessages,
        costEur: 0,
        runs: 1,
      }),
    ).toBe("plafond-messages");
  });
});

describe("rattrapage — appel en lot", () => {
  const usage = {
    inputTokens: {
      total: 10,
      noCache: 10,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: { total: 5, text: 5, reasoning: undefined },
  };
  const modele = () =>
    new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: '{"ok":true}' }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      }),
    });

  it("un appel en lot demande le niveau de service « flex », à côté de la clé de cache", async () => {
    const m = modele();
    await extract({
      sollicitation: "banc-essai",
      prompt: "x",
      schema: z.object({ ok: z.boolean() }),
      modele: m,
      reasoning: "low",
      cacheCle: "compte-1",
      lot: true,
    });
    const options = m.doGenerateCalls[0].providerOptions as {
      openai?: Record<string, unknown>;
    };
    expect(options.openai?.serviceTier).toBe("flex");
    expect(options.openai?.promptCacheKey).toBe("compte-1");
  });

  it("un appel ordinaire ne demande aucun niveau de service", async () => {
    const m = modele();
    await extract({
      sollicitation: "banc-essai",
      prompt: "x",
      schema: z.object({ ok: z.boolean() }),
      modele: m,
      reasoning: "low",
      cacheCle: "compte-1",
    });
    const options = m.doGenerateCalls[0].providerOptions as {
      openai?: Record<string, unknown>;
    };
    expect(options.openai?.serviceTier).toBeUndefined();
  });
});
