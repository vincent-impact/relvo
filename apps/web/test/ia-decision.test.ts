import { describe, expect, it } from "vitest";
import {
  deciderTri,
  FRONTIERE_CONFIANCE,
  verdictEnBase,
} from "@/server/ia/pipeline/decision";
import type { SortieTri } from "@/server/ia/schemas";

// LA DÉCISION DU TRI (M7 tranche 4, 05 §1.1) : bruit et incertain n'écrivent
// que le verdict ; une affaire sous la frontière de confiance aussi ; au-dessus,
// ouverture ou rattachement. La frontière est UN endroit, testé.

const affaire: SortieTri = {
  verdict: "affaire",
  categorie_bruit: null,
  confiance: "haute",
  raison: "Le fournisseur attend une validation.",
  domaine: "Fournisseurs",
  domaine_propose: null,
  sujet_existant: null,
  titre: "Rupture sauce blanche",
  priorite: "normal",
};

describe("décision du tri", () => {
  it("la frontière par défaut est « moyenne » : haute et moyenne ouvrent, basse non", () => {
    expect(FRONTIERE_CONFIANCE).toBe("moyenne");
    expect(deciderTri(affaire).type).toBe("affaire");
    expect(deciderTri({ ...affaire, confiance: "moyenne" }).type).toBe(
      "affaire",
    );
    expect(deciderTri({ ...affaire, confiance: "basse" })).toEqual({
      type: "verdict-seul",
      motif: "sous-la-frontiere",
    });
    // Frontière relevée à « haute » : moyenne ne suffit plus.
    expect(deciderTri({ ...affaire, confiance: "moyenne" }, "haute")).toEqual({
      type: "verdict-seul",
      motif: "sous-la-frontiere",
    });
  });

  it("bruit et incertain n'écrivent que le verdict, quelle que soit la confiance", () => {
    expect(
      deciderTri({
        ...affaire,
        verdict: "bruit",
        categorie_bruit: "advertising",
      }),
    ).toEqual({ type: "verdict-seul", motif: "bruit" });
    expect(deciderTri({ ...affaire, verdict: "incertain" })).toEqual({
      type: "verdict-seul",
      motif: "incertain",
    });
  });

  it("porte ce que l'ouverture ou le rattachement a besoin de savoir, sans chaînes vides", () => {
    expect(
      deciderTri({
        ...affaire,
        sujet_existant: " SUB-00012 ",
        titre: "  ",
        domaine: "",
        domaine_propose: "Réglementaire",
        priorite: "urgent",
      }),
    ).toEqual({
      type: "affaire",
      sujetExistant: "SUB-00012",
      titre: null,
      domaine: null,
      domainePropose: "Réglementaire",
      priorite: "urgent",
    });
  });

  it("traduit la sortie vers les énumérés de la base, catégorie seulement sur « bruit »", () => {
    expect(verdictEnBase(affaire)).toEqual({
      verdict: "matter",
      confidence: "high",
      noiseReason: null,
      reason: "Le fournisseur attend une validation.",
    });
    expect(
      verdictEnBase({
        ...affaire,
        verdict: "bruit",
        categorie_bruit: "prospecting",
        confiance: "basse",
        raison: "  ",
      }),
    ).toEqual({
      verdict: "noise",
      confidence: "low",
      noiseReason: "prospecting",
      reason: "Sans raison donnée.",
    });
    // Le modèle a posé une catégorie sur une affaire : elle est ignorée.
    expect(
      verdictEnBase({ ...affaire, categorie_bruit: "other" }).noiseReason,
    ).toBeNull();
  });
});
