import { describe, expect, it } from "vitest";
import {
  avisEnBase,
  deciderTri,
  FRONTIERE_CONFIANCE,
  FRONTIERE_IGNORANCE,
} from "@/server/ia/pipeline/decision";
import type { SortieTri } from "@/server/ia/schemas";

// LA DÉCISION DU TRI (M7 tranche 4, 05 §1.1, §1.2 et §9.5) : le rattachement
// prime, quelle que soit l'action ; « à traiter » ouvre au-dessus de la
// frontière ; « rien à faire » en confiance haute fait taire ; « à considérer »
// n'écrit que l'avis. Les deux frontières sont UN endroit, testé.

const aTraiter: SortieTri = {
  action: "a_traiter",
  nature: "professionnel",
  confiance: "haute",
  raison: "Le fournisseur attend une validation.",
  domaine: "Fournisseurs",
  domaine_propose: null,
  sujet_existant: null,
  titre: "Rupture sauce blanche",
  priorite: "normal",
};

const rienAFaire: SortieTri = {
  ...aTraiter,
  action: "rien_a_faire",
  nature: "publicite",
  raison: "Promotion générique sans action attendue.",
  domaine: null,
  titre: null,
};

describe("décision du tri", () => {
  it("le rattachement prime : un accusé attendu par un sujet ouvert le rejoint, même sans rien à faire", () => {
    expect(
      deciderTri({
        ...rienAFaire,
        nature: "automatique",
        sujet_existant: " SUB-0103 ",
      }),
    ).toEqual({
      type: "rattacher",
      sujetExistant: "SUB-0103",
      domaine: null,
      domainePropose: null,
      priorite: "normal",
    });
    // « À traiter » aussi, évidemment ; et « à considérer ».
    expect(deciderTri({ ...aTraiter, sujet_existant: "SUB-0142" }).type).toBe(
      "rattacher",
    );
    expect(
      deciderTri({
        ...aTraiter,
        action: "a_considerer",
        sujet_existant: "SUB-0142",
      }).type,
    ).toBe("rattacher");
  });

  it("mais jamais une publicité ni un fil personnel, ni sous la frontière", () => {
    expect(deciderTri({ ...rienAFaire, sujet_existant: "SUB-0142" }).type).toBe(
      "ignorer",
    );
    expect(
      deciderTri({
        ...aTraiter,
        nature: "personnel",
        sujet_existant: "SUB-0142",
      }),
    ).toEqual({ type: "avis-seul", motif: "personnel" });
    expect(
      deciderTri({
        ...aTraiter,
        confiance: "basse",
        sujet_existant: "SUB-0142",
      }),
    ).toEqual({ type: "avis-seul", motif: "sous-la-frontiere" });
  });

  it("la frontière d'ouverture par défaut est « moyenne » : haute et moyenne ouvrent, basse non", () => {
    expect(FRONTIERE_CONFIANCE).toBe("moyenne");
    expect(deciderTri(aTraiter)).toEqual({
      type: "ouvrir",
      titre: "Rupture sauce blanche",
      domaine: "Fournisseurs",
      domainePropose: null,
      priorite: "normal",
    });
    expect(deciderTri({ ...aTraiter, confiance: "moyenne" }).type).toBe(
      "ouvrir",
    );
    expect(deciderTri({ ...aTraiter, confiance: "basse" })).toEqual({
      type: "avis-seul",
      motif: "sous-la-frontiere",
    });
    // Frontière relevée à « haute » : moyenne ne suffit plus.
    expect(
      deciderTri({ ...aTraiter, confiance: "moyenne" }, { affaire: "haute" }),
    ).toEqual({ type: "avis-seul", motif: "sous-la-frontiere" });
  });

  it("un fil personnel n'ouvre jamais rien ; une publicité ou un automate « à traiter », si", () => {
    expect(deciderTri({ ...aTraiter, nature: "personnel" })).toEqual({
      type: "avis-seul",
      motif: "personnel",
    });
    expect(
      deciderTri({ ...aTraiter, nature: "publicite", domaine: null }).type,
    ).toBe("ouvrir");
    expect(deciderTri({ ...aTraiter, nature: "automatique" }).type).toBe(
      "ouvrir",
    );
  });

  it("un « rien à faire » en confiance haute fait taire la source, avec sa nature et sa raison", () => {
    expect(FRONTIERE_IGNORANCE).toBe("haute");
    expect(deciderTri(rienAFaire)).toEqual({
      type: "ignorer",
      nature: "publicite",
      raison: "Promotion générique sans action attendue.",
    });
    // Sans raison, une phrase de repli ; la nature professionnelle se tait aussi.
    expect(
      deciderTri({ ...rienAFaire, nature: "professionnel", raison: " " }),
    ).toEqual({
      type: "ignorer",
      nature: "professionnel",
      raison: "Sans raison donnée.",
    });
  });

  it("un « rien à faire » en confiance moyenne ou basse n'écrit que l'avis, à l'utilisateur de trancher", () => {
    expect(deciderTri({ ...rienAFaire, confiance: "moyenne" })).toEqual({
      type: "avis-seul",
      motif: "rien-a-faire",
    });
    expect(deciderTri({ ...rienAFaire, confiance: "basse" })).toEqual({
      type: "avis-seul",
      motif: "rien-a-faire",
    });
    // Frontière abaissée à « moyenne » : moyenne fait taire aussi.
    expect(
      deciderTri(
        { ...rienAFaire, confiance: "moyenne" },
        { ignorance: "moyenne" },
      ).type,
    ).toBe("ignorer");
  });

  it("« à considérer » n'écrit que l'avis, quelle que soit la confiance", () => {
    expect(deciderTri({ ...aTraiter, action: "a_considerer" })).toEqual({
      type: "avis-seul",
      motif: "a-considerer",
    });
  });

  it("porte ce que l'ouverture a besoin de savoir, sans chaînes vides", () => {
    expect(
      deciderTri({
        ...aTraiter,
        titre: "  ",
        domaine: "",
        domaine_propose: "Réglementaire",
        priorite: "urgent",
      }),
    ).toEqual({
      type: "ouvrir",
      titre: null,
      domaine: null,
      domainePropose: "Réglementaire",
      priorite: "urgent",
    });
  });

  it("traduit l'avis vers les énumérés de la base, la nature toujours posée", () => {
    expect(avisEnBase(aTraiter)).toEqual({
      verdict: "matter",
      nature: "professional",
      confidence: "high",
      reason: "Le fournisseur attend une validation.",
    });
    expect(
      avisEnBase({
        ...rienAFaire,
        action: "a_considerer",
        nature: "automatique",
        confiance: "basse",
        raison: "  ",
      }),
    ).toEqual({
      verdict: "uncertain",
      nature: "automatic",
      confidence: "low",
      reason: "Sans raison donnée.",
    });
  });
});
