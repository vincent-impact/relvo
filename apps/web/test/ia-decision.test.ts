import { describe, expect, it } from "vitest";
import {
  avisEnBase,
  deciderTri,
  FRONTIERE_CONFIANCE,
  FRONTIERE_IGNORANCE,
  deciderGroupe,
  deciderLectureGroupe,
  FRONTIERE_LECTURE_GROUPE,
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
      deciderTri({ ...aTraiter, confiance: "moyenne" }, { sujet: "haute" }),
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

  it("un indésirable n'ouvre jamais de sujet ; sûr et sans rien à faire, il se tait", () => {
    expect(deciderTri({ ...aTraiter, nature: "indesirable" })).toEqual({
      type: "avis-seul",
      motif: "indesirable",
    });
    expect(deciderTri({ ...rienAFaire, nature: "indesirable" })).toMatchObject({
      type: "ignorer",
      nature: "indesirable",
    });
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

describe("juger un groupe (M29.3)", () => {
  const groupe = (
    nature: SortieTri["nature"],
    confiance: SortieTri["confiance"],
    action: SortieTri["action"] = "a_traiter",
  ): SortieTri => ({
    ...aTraiter,
    action,
    nature,
    confiance,
    raison: "Le titre le dit.",
    titre: null,
    domaine: null,
    domaine_propose: null,
    sujet_existant: null,
  });

  it("hors du champ professionnel et sans aucun doute : ignoré", () => {
    for (const nature of [
      "personnel",
      "publicite",
      "automatique",
      "indesirable",
    ] as const) {
      const d = deciderGroupe(groupe(nature, "haute"));
      expect(d.type).toBe("ignorer");
      // L'action est reposée d'après la nature, quoi qu'ait dit le modèle.
      expect(d.avis.action).toBe("rien_a_faire");
    }
  });

  it("le moindre doute garde le groupe ; l'avis reste écrit", () => {
    expect(deciderGroupe(groupe("personnel", "moyenne"))).toMatchObject({
      type: "garder",
      avis: { action: "rien_a_faire", nature: "personnel" },
    });
    expect(deciderGroupe(groupe("personnel", "basse")).type).toBe("garder");
  });

  it("un groupe professionnel reste toujours, « à considérer »", () => {
    for (const confiance of ["haute", "moyenne", "basse"] as const) {
      expect(
        deciderGroupe(groupe("professionnel", confiance, "rien_a_faire")),
      ).toMatchObject({ type: "garder", avis: { action: "a_considerer" } });
    }
  });
});

describe("décision de la lecture du jour d'un groupe (M29.5)", () => {
  it("un sujet ne s'ouvre, et ne se rattache, qu'en confiance haute", () => {
    expect(FRONTIERE_LECTURE_GROUPE).toBe("haute");
    expect(deciderLectureGroupe(aTraiter).decision.type).toBe("ouvrir");
    // Le tri d'un fil direct ouvrirait ; la lecture d'un groupe, non.
    const moyen: SortieTri = { ...aTraiter, confiance: "moyenne" };
    expect(deciderTri(moyen).type).toBe("ouvrir");
    expect(deciderLectureGroupe(moyen).decision).toEqual({
      type: "avis-seul",
      motif: "sous-la-frontiere",
    });
    const prolonge: SortieTri = { ...aTraiter, sujet_existant: "S-0042" };
    expect(deciderLectureGroupe(prolonge).decision.type).toBe("rattacher");
    expect(
      deciderLectureGroupe({ ...prolonge, confiance: "moyenne" }).decision.type,
    ).toBe("avis-seul");
  });

  it("ne rattache que ce qui attend le dirigeant : un bavardage qui touche un sujet ouvert ne lui livre pas le groupe", () => {
    const echange: SortieTri = {
      ...rienAFaire,
      nature: "professionnel",
      sujet_existant: "S-0242",
      raison: "Échange de services réglé entre deux équipiers.",
    };
    // Sur un fil, le rattachement prime, quelle que soit l'action…
    expect(deciderTri(echange).type).toBe("rattacher");
    // … sur un groupe lu, non : rien n'attend le dirigeant, rien ne se rattache.
    expect(deciderLectureGroupe(echange)).toEqual({
      decision: { type: "avis-seul", motif: "rien-a-faire" },
      sansSuite: true,
    });
    expect(
      deciderLectureGroupe({ ...echange, action: "a_considerer" }).decision,
    ).toEqual({ type: "avis-seul", motif: "a-considerer" });
  });

  it("l'équipe qui s'organise sans le dirigeant ne dit rien du groupe : son avis ne bouge pas", () => {
    const entreEux: SortieTri = {
      ...rienAFaire,
      nature: "professionnel",
      raison: "L'équipe règle le planning entre elle.",
    };
    expect(deciderLectureGroupe(entreEux)).toEqual({
      decision: { type: "avis-seul", motif: "rien-a-faire" },
      sansSuite: true,
    });
    // Une affaire personnelle dans un groupe n'ouvre rien, et ne requalifie pas le groupe.
    expect(deciderLectureGroupe({ ...aTraiter, nature: "personnel" })).toEqual({
      decision: { type: "avis-seul", motif: "personnel" },
      sansSuite: true,
    });
  });

  it("hors du champ professionnel et sans doute, la lecture avance vers l'ignorance — jamais dans le doute", () => {
    for (const nature of [
      "personnel",
      "publicite",
      "automatique",
      "indesirable",
    ] as const) {
      const d = deciderLectureGroupe({ ...rienAFaire, nature });
      expect(d.decision.type).toBe("ignorer");
      expect(d.sansSuite).toBe(false);
    }
    expect(
      deciderLectureGroupe({
        ...rienAFaire,
        nature: "personnel",
        confiance: "moyenne",
      }),
    ).toEqual({
      decision: { type: "avis-seul", motif: "rien-a-faire" },
      sansSuite: true,
    });
  });

  it("un doute s'écrit sur le groupe : le dirigeant le voit dans la liste à trier", () => {
    expect(
      deciderLectureGroupe({ ...aTraiter, action: "a_considerer" }),
    ).toEqual({
      decision: { type: "avis-seul", motif: "a-considerer" },
      sansSuite: false,
    });
    expect(
      deciderLectureGroupe({ ...aTraiter, confiance: "moyenne" }).sansSuite,
    ).toBe(false);
    expect(deciderLectureGroupe(aTraiter).sansSuite).toBe(false);
  });
});
