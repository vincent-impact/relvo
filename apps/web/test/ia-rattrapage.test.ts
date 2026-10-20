import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { extract, RATTRAPAGE } from "@/server/ia";
import {
  estEnPanne,
  estHistorique,
  fenetreDeRattrapage,
  motifDArret,
  peutClore,
} from "@/server/ia/pipeline/rattrapage-regles";

// LE RATTRAPAGE EST TENU PAR UN TEST SUR SES RÈGLES PURES (M7.19, tranche 10) :
// la fenêtre lue, la reconnaissance d'un message d'historique par la date de
// la demande, le garde-fou qui l'arrête — messages, euros, tranches —, la
// clôture sur courrier épuisé, la panne d'une ligne, et le niveau de service
// « flex » qui n'atteint le fournisseur que la nuit, en lot.

const T = (iso: string) => new Date(iso);

describe("rattrapage — règles pures", () => {
  it("la fenêtre lue commence il y a autant de jours que la configuration", () => {
    const maintenant = T("2026-10-20T10:00:00Z");
    expect(fenetreDeRattrapage(maintenant, 14).toISOString()).toBe(
      "2026-10-06T10:00:00.000Z",
    );
    expect(RATTRAPAGE.fenetreJours).toBe(14);
  });

  it("un message daté d'avant la demande de rattrapage est de l'historique ; daté d'après, absent ou illisible, c'est du courrier vivant", () => {
    const demande = T("2026-10-20T10:00:00Z");
    expect(estHistorique("2026-10-19T10:00:00Z", demande)).toBe(true);
    expect(estHistorique("2026-10-20T09:59:59Z", demande)).toBe(true);
    expect(estHistorique("2026-10-20T10:00:01Z", demande)).toBe(false);
    expect(estHistorique(null, demande)).toBe(false);
    expect(estHistorique("pas une date", demande)).toBe(false);
  });

  it("s'arrête au garde-fou de messages, d'euros, ou de tranches — et continue sinon", () => {
    const plafonds = { messages: 5000, euros: 10, tranches: 120 };
    expect(
      motifDArret({ messagesTriaged: 12, costEur: 0.1, runs: 1 }, plafonds),
    ).toBeNull();
    expect(
      motifDArret({ messagesTriaged: 5000, costEur: 0.4, runs: 1 }, plafonds),
    ).toBe("plafond-messages");
    expect(
      motifDArret({ messagesTriaged: 50, costEur: 10, runs: 1 }, plafonds),
    ).toBe("plafond-euros");
    expect(
      motifDArret({ messagesTriaged: 50, costEur: 0.5, runs: 121 }, plafonds),
    ).toBe("tranches-epuisees");
    // Le garde-fou de la configuration est celui arrêté avec le dirigeant :
    // loin au-dessus d'une boîte réelle, il n'arrête qu'un emballement.
    expect(RATTRAPAGE.plafondMessages).toBe(5000);
    expect(RATTRAPAGE.plafondEuros).toBe(10);
    expect(RATTRAPAGE.tranchesMax).toBe(120);
    expect(
      motifDArret({
        messagesTriaged: RATTRAPAGE.plafondMessages,
        costEur: 0,
        runs: 1,
      }),
    ).toBe("plafond-messages");
  });

  it("ne clôt « courrier épuisé » qu'après deux passes vides, dix minutes depuis la demande, et plus aucun candidat", () => {
    const requestedAt = T("2026-10-20T10:00:00Z");
    const regles = { passesVides: 2, attenteSyncMs: 10 * 60 * 1000 };
    const a = T("2026-10-20T10:11:00Z");
    expect(
      peutClore({ emptyRounds: 2, requestedAt, restants: 0 }, a, regles),
    ).toBe(true);
    // Une seule passe vide : l'agrégateur synchronise peut-être encore.
    expect(
      peutClore({ emptyRounds: 1, requestedAt, restants: 0 }, a, regles),
    ).toBe(false);
    // Trop tôt après la demande, même avec deux passes vides.
    const tot = T("2026-10-20T10:05:00Z");
    expect(
      peutClore({ emptyRounds: 2, requestedAt, restants: 0 }, tot, regles),
    ).toBe(false);
    // Des candidats restent : on trie avant de clore.
    expect(
      peutClore({ emptyRounds: 3, requestedAt, restants: 4 }, a, regles),
    ).toBe(false);
    expect(RATTRAPAGE.passesVidesPourClore).toBe(2);
    expect(RATTRAPAGE.attenteSyncMs).toBe(10 * 60 * 1000);
  });

  it("une ligne ouverte sans tranche vivante depuis le délai de relance est en panne ; une tranche vivante, une ligne close ou une ligne fraîche ne le sont pas", () => {
    const regles = {
      relanceApresMs: 6 * 60 * 1000,
      trancheMaxMs: 5 * 60 * 1000,
    };
    const now = T("2026-10-20T10:20:00Z");
    const base = { status: "running", requestedAt: T("2026-10-20T10:00:00Z") };
    // Dernière tranche il y a dix minutes, aucun verrou : en panne.
    expect(
      estEnPanne(
        {
          ...base,
          trancheStartedAt: null,
          lastTrancheAt: T("2026-10-20T10:10:00Z"),
        },
        now,
        regles,
      ),
    ).toBe(true);
    // Une tranche vivante (verrou récent) : non.
    expect(
      estEnPanne(
        {
          ...base,
          trancheStartedAt: T("2026-10-20T10:18:00Z"),
          lastTrancheAt: null,
        },
        now,
        regles,
      ),
    ).toBe(false);
    // Un verrou mort (plus vieux que la durée d'une fonction) : en panne.
    expect(
      estEnPanne(
        {
          ...base,
          trancheStartedAt: T("2026-10-20T10:05:00Z"),
          lastTrancheAt: null,
        },
        now,
        regles,
      ),
    ).toBe(true);
    // Jamais de tranche : la demande fait foi.
    expect(
      estEnPanne(
        {
          ...base,
          status: "pending",
          trancheStartedAt: null,
          lastTrancheAt: null,
        },
        now,
        regles,
      ),
    ).toBe(true);
    expect(
      estEnPanne(
        {
          ...base,
          status: "pending",
          trancheStartedAt: null,
          lastTrancheAt: null,
        },
        T("2026-10-20T10:03:00Z"),
        regles,
      ),
    ).toBe(false);
    // Une ligne close n'est jamais en panne.
    expect(
      estEnPanne(
        {
          ...base,
          status: "done",
          trancheStartedAt: null,
          lastTrancheAt: null,
        },
        now,
        regles,
      ),
    ).toBe(false);
    expect(RATTRAPAGE.relanceApresMs).toBeGreaterThan(RATTRAPAGE.trancheMaxMs);
  });
});

describe("rattrapage — niveau de service", () => {
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

  it("un appel de nuit, en lot, demande le niveau de service « flex », à côté de la clé de cache", async () => {
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

  it("un appel en direct — le dirigeant regarde — ne demande aucun niveau de service", async () => {
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
