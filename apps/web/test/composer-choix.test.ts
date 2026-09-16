import { describe, expect, it } from "vitest";
import {
  applyChoice,
  choiceAt,
  countChoices,
  nextChoice,
  splitChoices,
} from "../src/components/shared/recipient-composer";

// Les CHOIX qu'un brouillon de Relvo laisse entre crochets (M7.7) : c'est ce
// que le composer surligne et ce qui bloque l'envoi tant qu'il en reste.

describe("les choix entre crochets d'un brouillon", () => {
  it("découpe le texte en segments, les choix marqués", () => {
    const segs = splitChoices(
      "Nous retenons le modèle [8 m³ / 12 m³].\nLe créneau [nous convient / ne nous convient pas].",
    );
    expect(segs).toEqual([
      { text: "Nous retenons le modèle ", choice: false },
      { text: "[8 m³ / 12 m³]", choice: true },
      { text: ".\nLe créneau ", choice: false },
      { text: "[nous convient / ne nous convient pas]", choice: true },
      { text: ".", choice: false },
    ]);
    expect(segs.map((s) => s.text).join("")).toBe(
      "Nous retenons le modèle [8 m³ / 12 m³].\nLe créneau [nous convient / ne nous convient pas].",
    );
  });

  it("compte les choix restants ; un crochet vide ou ouvert n'en est pas un", () => {
    expect(countChoices("Nous retenons le modèle [8 m³ / 12 m³].")).toBe(1);
    expect(countChoices("Nous retenons le 12 m³.")).toBe(0);
    expect(countChoices("[] et [ouvert")).toBe(0);
    expect(countChoices("[a]\n[b]")).toBe(2);
  });

  it("un choix ne court jamais sur deux lignes", () => {
    expect(countChoices("[8 m³\n/ 12 m³]")).toBe(0);
    expect(splitChoices("[8 m³\n/ 12 m³]")).toEqual([
      { text: "[8 m³\n/ 12 m³]", choice: false },
    ]);
  });
});

describe("trancher un choix d'un appui", () => {
  const texte =
    "Nous retenons le modèle [8 m³ / 12 m³].\nMerci de [à compléter].";

  it("trouve le choix sous le curseur, bornes comprises, avec ses options", () => {
    expect(choiceAt(texte, 0)).toBeNull();
    expect(choiceAt(texte, 24)).toEqual({
      start: 24,
      end: 38,
      options: ["8 m³", "12 m³"],
    });
    expect(choiceAt(texte, 38)?.start).toBe(24);
    expect(choiceAt(texte, 39)).toBeNull();
    // Un crochet sans « / » n'offre aucune option : seul « Réécrire » s'applique.
    expect(choiceAt(texte, 52)?.options).toEqual([]);
  });

  it("passe au prochain choix, et reboucle au premier", () => {
    expect(nextChoice(texte, 0)?.start).toBe(24);
    expect(nextChoice(texte, 25)?.start).toBe(49);
    expect(nextChoice(texte, 60)?.start).toBe(24);
    expect(nextChoice("aucun crochet", 0)).toBeNull();
  });

  it("remplace le segment par l'option retenue, ou le retire pour réécrire, le curseur juste après", () => {
    const c = choiceAt(texte, 30)!;
    expect(applyChoice(texte, c, "12 m³")).toEqual({
      text: "Nous retenons le modèle 12 m³.\nMerci de [à compléter].",
      caret: 29,
    });
    expect(applyChoice(texte, c, null)).toEqual({
      text: "Nous retenons le modèle .\nMerci de [à compléter].",
      caret: 24,
    });
  });
});
