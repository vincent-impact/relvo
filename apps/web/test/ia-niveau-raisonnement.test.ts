import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import {
  chat,
  classify,
  draft,
  extract,
  NiveauRaisonnementManquant,
} from "@/server/ia";

// AUCUN APPEL SANS NIVEAU DE RAISONNEMENT EXPLICITE (M7 tranche 0, 05 §10.5).
//
// Le défaut de l'API est « medium » : le laisser multiplie la facture par 2,2
// et allonge la latence au point de rendre l'échange inutilisable
// (benchmark-iag.md §6.1 bis). Le type l'exige déjà ; ce test vérifie que le
// RUNTIME le revérifie — un `as never`, une option lue d'un JSON ou une
// réécriture du client ne doivent pas pouvoir faire partir un appel sans
// niveau. Il vérifie aussi que le niveau passé est bien celui qui ATTEINT le
// modèle : un client qui accepterait le niveau puis l'oublierait passerait le
// premier test et raterait tout l'intérêt.

const usage = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

function modeleSimule(texte = '{"ok":true}') {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: texte }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

const schema = z.object({ ok: z.boolean() });

describe("client d'inférence — niveau de raisonnement", () => {
  it("refuse un appel sans niveau, sur les quatre méthodes", async () => {
    const base = {
      sollicitation: "banc-essai" as const,
      prompt: "x",
      modele: modeleSimule(),
    };
    const sans = base as never;
    const sansSchema = { ...base, schema } as never;
    await expect(classify(sansSchema)).rejects.toBeInstanceOf(
      NiveauRaisonnementManquant,
    );
    await expect(extract(sansSchema)).rejects.toBeInstanceOf(
      NiveauRaisonnementManquant,
    );
    await expect(draft(sans)).rejects.toBeInstanceOf(
      NiveauRaisonnementManquant,
    );
    expect(() => chat(sans)).toThrow(NiveauRaisonnementManquant);
  });

  it("refuse « provider-default » et les niveaux hors gamme", async () => {
    for (const reasoning of ["provider-default", "xhigh", "max", "", 2]) {
      await expect(
        extract({
          sollicitation: "banc-essai",
          prompt: "x",
          schema,
          modele: modeleSimule(),
          reasoning: reasoning as never,
        }),
      ).rejects.toBeInstanceOf(NiveauRaisonnementManquant);
    }
  });

  it("transmet le niveau tel quel au modèle", async () => {
    const modele = modeleSimule();
    const { sortie } = await extract({
      sollicitation: "banc-essai",
      prompt: "x",
      schema,
      modele,
      reasoning: "low",
    });
    expect(sortie).toEqual({ ok: true });
    expect(modele.doGenerateCalls).toHaveLength(1);
    expect(modele.doGenerateCalls[0].reasoning).toBe("low");
  });

  it("borne les jetons de sortie même quand le site d'appel n'en dit rien", async () => {
    const modele = modeleSimule("bonjour");
    await draft({
      sollicitation: "banc-essai",
      prompt: "x",
      modele,
      reasoning: "low",
    });
    expect(modele.doGenerateCalls[0].maxOutputTokens).toBeGreaterThan(0);
  });
});
