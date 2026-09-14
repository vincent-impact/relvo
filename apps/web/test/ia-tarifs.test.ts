import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  estimerCout,
  modeleDuTier,
  normaliserUsage,
  TARIFS,
  TARIFS_VERSION,
  TIERS,
  USD_PAR_EUR,
} from "@/server/ia";

// LA TABLE DE TARIFS VERSIONNÉE (M7 tranche 0, 05 §10.6).
//
// « Mesurer en euros survit à un changement de modèle ; mesurer en jetons
// non. » Ce que ce test tient :
//   - tout modèle affecté à un tier a un tarif (sinon le compteur est aveugle) ;
//   - le taux de change du code est celui du modèle de coût
//     (`scripts/cout-iag.py`) — deux valeurs qui divergent, c'est deux
//     factures prévisionnelles différentes pour le même appel ;
//   - les jetons de raisonnement sont facturés au tarif de SORTIE et comptés
//     séparément — c'est le compteur qui révèle un niveau qui a dérivé.

describe("table de tarifs", () => {
  it("couvre tous les modèles affectés à un tier", () => {
    for (const tier of TIERS) {
      const modele = modeleDuTier(tier, {});
      expect(TARIFS[modele], `tier ${tier} → ${modele}`).toBeDefined();
    }
  });

  it("partage son taux de change avec scripts/cout-iag.py", () => {
    const script = readFileSync(
      resolve(import.meta.dirname, "../../../scripts/cout-iag.py"),
      "utf8",
    );
    const m = /USD_PER_EUR\s*=\s*([0-9.]+)/.exec(script);
    expect(m, "USD_PER_EUR introuvable dans cout-iag.py").not.toBeNull();
    expect(Number(m![1])).toBe(USD_PAR_EUR);
  });

  it("convertit un appel type en euros, raisonnement au tarif de sortie", () => {
    // 4 000 jetons frais + 6 000 en cache, 600 de sortie dont 300 de raisonnement
    // (profil « A2–A6 ouverture » à effort low, benchmark §6.1 bis).
    const cout = estimerCout("gpt-5.6-luna", {
      entree: 4000,
      cacheLecture: 6000,
      cacheEcriture: 0,
      sortie: 600,
      raisonnement: 300,
    });
    const usdAttendu = (4000 * 0.2 + 6000 * 0.02 + 600 * 1.2) / 1e6;
    expect(cout.usd).toBeCloseTo(usdAttendu, 12);
    expect(cout.eur).toBeCloseTo(usdAttendu / USD_PAR_EUR, 12);
    expect(cout.version).toBe(TARIFS_VERSION);

    // Le même appel sans raisonnement coûte 300 jetons de sortie de moins.
    const sans = estimerCout("gpt-5.6-luna", {
      entree: 4000,
      cacheLecture: 6000,
      cacheEcriture: 0,
      sortie: 300,
      raisonnement: 0,
    });
    expect(cout.usd - sans.usd).toBeCloseTo((300 * 1.2) / 1e6, 12);
  });

  it("refuse un modèle sans tarif plutôt que de compter zéro", () => {
    expect(() =>
      estimerCout("gpt-7-inconnu", {
        entree: 1,
        cacheLecture: 0,
        cacheEcriture: 0,
        sortie: 1,
        raisonnement: 0,
      }),
    ).toThrow(/Aucun tarif/);
  });

  it("normalise l'usage du SDK en comptant le raisonnement à part", () => {
    const conso = normaliserUsage({
      inputTokens: 10_000,
      inputTokenDetails: {
        noCacheTokens: 4_000,
        cacheReadTokens: 6_000,
        cacheWriteTokens: undefined,
      },
      outputTokens: 600,
      outputTokenDetails: { textTokens: 300, reasoningTokens: 300 },
      totalTokens: 10_600,
    });
    expect(conso).toEqual({
      entree: 4_000,
      cacheLecture: 6_000,
      cacheEcriture: 0,
      sortie: 600,
      raisonnement: 300,
    });
  });
});
