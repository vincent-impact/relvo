import { describe, expect, it } from "vitest";
import {
  deciderTri,
  FRONTIERE_CONFIANCE,
  FRONTIERE_IGNORANCE,
  verdictEnBase,
} from "@/server/ia/pipeline/decision";
import type { SortieTri } from "@/server/ia/schemas";

// LA DÉCISION DU TRI (M7 tranche 4, 05 §1.1 et §9.5) : incertain n'écrit que
// le verdict ; une affaire sous la frontière de confiance aussi ; au-dessus,
// ouverture ou rattachement ; un bruit en confiance haute fait taire la source,
// en dessous il attend le geste. Les deux frontières sont UN endroit, testé.

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

const bruit: SortieTri = {
  ...affaire,
  verdict: "bruit",
  categorie_bruit: "advertising",
  raison: "Promotion générique sans action attendue.",
  domaine: null,
  titre: null,
};

describe("décision du tri", () => {
  it("la frontière d'affaire par défaut est « moyenne » : haute et moyenne ouvrent, basse non", () => {
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
    expect(
      deciderTri({ ...affaire, confiance: "moyenne" }, { affaire: "haute" }),
    ).toEqual({ type: "verdict-seul", motif: "sous-la-frontiere" });
  });

  it("un bruit en confiance haute fait taire la source, avec sa catégorie et sa raison", () => {
    expect(FRONTIERE_IGNORANCE).toBe("haute");
    expect(deciderTri(bruit)).toEqual({
      type: "ignorer",
      categorie: "advertising",
      raison: "Promotion générique sans action attendue.",
    });
    // Sans catégorie, « autre » ; sans raison, une phrase de repli.
    expect(
      deciderTri({ ...bruit, categorie_bruit: null, raison: " " }),
    ).toEqual({
      type: "ignorer",
      categorie: "other",
      raison: "Sans raison donnée.",
    });
  });

  it("un bruit en confiance moyenne ou basse n'écrit que le verdict, à l'utilisateur de trancher", () => {
    expect(deciderTri({ ...bruit, confiance: "moyenne" })).toEqual({
      type: "verdict-seul",
      motif: "bruit",
    });
    expect(deciderTri({ ...bruit, confiance: "basse" })).toEqual({
      type: "verdict-seul",
      motif: "bruit",
    });
    // Frontière abaissée à « moyenne » : moyenne fait taire aussi.
    expect(
      deciderTri({ ...bruit, confiance: "moyenne" }, { ignorance: "moyenne" })
        .type,
    ).toBe("ignorer");
  });

  it("incertain n'écrit que le verdict, quelle que soit la confiance", () => {
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
        ...bruit,
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
