import { describe, expect, it } from "vitest";
import {
  cleDeLaQuestion,
  compterEchangesEnAttente,
  ETAPES,
  etapeDeMigration,
  regrouperEchangesRelvo,
  titreDeQuestion,
  type QuestionPourEchange,
} from "../src/index";

// Les ÉCHANGES DE RELVO (05 §11.12) : chaque chose que Relvo a à dire est un
// échange à part, regroupé par son origine ; la clé se lit sur la question
// seule, le badge compte les échanges, pas les questions.

const t0 = new Date("2026-11-01T08:00:00Z");
const plus = (min: number) => new Date(t0.getTime() + min * 60_000);

function q(
  partial: Partial<QuestionPourEchange> & { id: string; text: string },
): QuestionPourEchange {
  return {
    status: "open",
    answer: null,
    originStep: null,
    subjectId: null,
    originSubjectId: null,
    askedAt: t0,
    answeredAt: null,
    ...partial,
  };
}

describe("la clé d'un échange de Relvo", () => {
  it("se lit sur la question seule", () => {
    expect(
      cleDeLaQuestion({
        id: "a",
        originStep: ETAPES.secteurs,
        subjectId: null,
        originSubjectId: null,
      }),
    ).toBe("prise-en-main");
    expect(
      cleDeLaQuestion({
        id: "b",
        originStep: `${ETAPES.finDeLecture}/catchup-1`,
        subjectId: null,
        originSubjectId: null,
      }),
    ).toBe("lecture:catchup-1");
    expect(
      cleDeLaQuestion({
        id: "c",
        originStep: "domaine-propose/kiloutou",
        subjectId: null,
        originSubjectId: null,
      }),
    ).toBe("dossiers");
    expect(
      cleDeLaQuestion({
        id: "d",
        originStep: etapeDeMigration("canal-9"),
        subjectId: null,
        originSubjectId: null,
      }),
    ).toBe("boite:canal-9");
    expect(
      cleDeLaQuestion({
        id: "e",
        originStep: null,
        subjectId: null,
        originSubjectId: "sujet-3",
      }),
    ).toBe("sujet:sujet-3");
    expect(
      cleDeLaQuestion({
        id: "f",
        originStep: null,
        subjectId: null,
        originSubjectId: null,
      }),
    ).toBe("question:f");
  });
});

describe("regrouper les échanges de Relvo", () => {
  it("une ligne par chose à dire, dans l'ordre où on les ouvre", () => {
    const echanges = regrouperEchangesRelvo({
      questions: [
        q({
          id: "narbonne",
          text: "Narbonne est-il une franchise ?",
          originSubjectId: "sujet-1",
          subjectTitle: "Devis Kiloutou",
          askedAt: plus(1),
        }),
        q({
          id: "regle",
          text: "Une règle ?",
          originStep: ETAPES.premiereInstruction,
          askedAt: plus(2),
        }),
        q({
          id: "boite",
          text: "Une boîte ?",
          originStep: ETAPES.premiereBoite,
          askedAt: plus(3),
        }),
        q({
          id: "metier",
          text: "Votre métier ?",
          originStep: ETAPES.secteurs,
          status: "answered",
          answer: "Restauration rapide",
          answeredAt: plus(1),
        }),
        q({
          id: "kiloutou",
          text: "Un dossier Kiloutou ?",
          originStep: "domaine-propose/kiloutou",
          askedAt: plus(4),
        }),
        q({
          id: "migration",
          text: "Relier à nouveau ?",
          originStep: etapeDeMigration("canal-9"),
          askedAt: plus(5),
        }),
      ],
      lectures: [
        {
          id: "catchup-1",
          channelName: "vincent@tastycrousty.fr",
          status: "running",
          messagesImported: 41,
          subjectsOpened: 3,
          requestedAt: plus(2),
        },
      ],
      boites: { "canal-9": "contact@tastycrousty.fr" },
    });
    expect(echanges.map((e) => e.cle)).toEqual([
      "boite:canal-9",
      "prise-en-main",
      "lecture:catchup-1",
      "dossiers",
      "sujet:sujet-1",
    ]);
    const prise = echanges[1]!;
    expect(prise.titre).toBe("Prise en main");
    expect(prise.sousTitre).toBe(
      "Il reste 2 étapes · la boîte à lire en dernier",
    );
    expect(prise.ouvertes).toEqual(["regle", "boite"]);
    expect(prise.passees).toEqual(["metier"]);
    expect(echanges[0]!.titre).toBe("Votre boîte contact@tastycrousty.fr");
    expect(echanges[2]!.sousTitre).toBe(
      "En cours · 3 sujets ouverts, 41 messages lus",
    );
    const sujet = echanges[4]!;
    expect(sujet.titre).toBe("Narbonne est-il une franchise ?");
    expect(sujet.sousTitre).toBe("Une question sur le sujet Devis Kiloutou");
    expect(sujet.subjectId).toBe("sujet-1");
  });

  it("une lecture vivante porte sa question de fin ; une lecture finie sans question disparaît", () => {
    const echanges = regrouperEchangesRelvo({
      questions: [
        q({
          id: "fin",
          text: "Ça ressemble ?",
          originStep: `${ETAPES.finDeLecture}/catchup-1`,
        }),
      ],
      lectures: [
        {
          id: "catchup-1",
          channelName: "boîte",
          status: "done",
          messagesImported: 10,
          subjectsOpened: 2,
          requestedAt: t0,
        },
        {
          id: "catchup-2",
          channelName: "autre",
          status: "done",
          messagesImported: 0,
          subjectsOpened: 0,
          requestedAt: t0,
        },
      ],
    });
    expect(echanges.map((e) => e.cle)).toEqual([
      "lecture:catchup-1",
      "lecture:catchup-2",
    ]);
    expect(echanges[0]!.ouvertes).toEqual(["fin"]);
  });

  it("une chose finie ne se montre plus", () => {
    const echanges = regrouperEchangesRelvo({
      questions: [
        q({
          id: "metier",
          text: "Votre métier ?",
          originStep: ETAPES.secteurs,
          status: "answered",
          answer: "Food",
        }),
      ],
      lectures: [],
    });
    expect(echanges).toEqual([]);
  });

  it("le badge compte les échanges, pas les questions", () => {
    expect(
      compterEchangesEnAttente([
        {
          id: "a",
          originStep: ETAPES.secteurs,
          subjectId: null,
          originSubjectId: null,
        },
        {
          id: "b",
          originStep: ETAPES.premiereBoite,
          subjectId: null,
          originSubjectId: null,
        },
        { id: "c", originStep: null, subjectId: "s1", originSubjectId: null },
      ]),
    ).toBe(2);
  });

  it("un titre se borne au dernier mot entier", () => {
    expect(titreDeQuestion("Narbonne est-il une franchise ?")).toBe(
      "Narbonne est-il une franchise ?",
    );
    expect(titreDeQuestion("a ".repeat(60).trim(), 20)).toMatch(/…$/);
  });
});
