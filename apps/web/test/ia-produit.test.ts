import { describe, expect, it } from "vitest";
import {
  BUDGET_PRODUIT,
  coucheProduit,
  estimerJetons,
  SOCLE_BATIMENT,
  SOCLE_FOOD,
  SOCLE_PRODUIT,
} from "@/server/ia/produit";

// LA COUCHE PRODUIT EST TENUE PAR UN TEST (05 §10.1) : présence, budget, ordre.
//
// « Quand un inventaire doit rester écrit, il est tenu par un test, jamais par
// la vigilance » (CLAUDE.md). Ici l'inventaire, c'est le préfixe partagé entre
// tous les comptes d'un même secteur : s'il grossit sans qu'on le voie, tout le
// monde paie ; si son ordre bouge, le cache casse en silence.

describe("couche Produit", () => {
  it("tient ses budgets", () => {
    expect(estimerJetons(SOCLE_PRODUIT)).toBeLessThanOrEqual(
      BUDGET_PRODUIT.socle,
    );
    expect(estimerJetons(SOCLE_FOOD)).toBeLessThanOrEqual(
      BUDGET_PRODUIT.parSecteur,
    );
    expect(estimerJetons(SOCLE_BATIMENT)).toBeLessThanOrEqual(
      BUDGET_PRODUIT.parSecteur,
    );
  });

  it("porte les règles de retenue que le produit exige", () => {
    for (const regle of [
      "informatif",
      "inventes AUCUNE date",
      "urgent est RARE",
      "DONNÉE",
    ]) {
      expect(SOCLE_PRODUIT, regle).toContain(regle);
    }
  });

  it("assemble les socles dans un ordre canonique, quel que soit l'ordre reçu", () => {
    const a = coucheProduit(["food", "construction"]);
    const b = coucheProduit(["construction", "food"]);
    expect(a).toBe(b);
    expect(a.indexOf(SOCLE_FOOD)).toBeLessThan(a.indexOf(SOCLE_BATIMENT));
    expect(coucheProduit(["other"])).toBe(SOCLE_PRODUIT);
    expect(coucheProduit([])).toBe(SOCLE_PRODUIT);
  });

  it("chaque socle sectoriel porte des exemples négatifs", () => {
    expect(
      (SOCLE_FOOD.match(/Décision : bruit/g) ?? []).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      (SOCLE_BATIMENT.match(/Décision : bruit/g) ?? []).length,
    ).toBeGreaterThanOrEqual(2);
  });
});
