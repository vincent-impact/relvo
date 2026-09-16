import { describe, expect, it } from "vitest";
import {
  applyChoice,
  choiceAt,
  countByKind,
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
      { text: "Nous retenons le modèle ", choice: false, start: 0 },
      { text: "[8 m³ / 12 m³]", choice: true, start: 24 },
      { text: ".\nLe créneau ", choice: false, start: 38 },
      {
        text: "[nous convient / ne nous convient pas]",
        choice: true,
        start: 51,
      },
      { text: ".", choice: false, start: 89 },
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
      { text: "[8 m³\n/ 12 m³]", choice: false, start: 0 },
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
      kind: "choix",
      options: ["8 m³", "12 m³"],
      garder: null,
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

describe("les notes conditionnelles — « [Si … : …] » — ne sont pas des choix", () => {
  const texte =
    "Nous [validons / ne validons pas] le devis.\n\n[Si validé : vous pouvez lancer la commande de la pièce.]\n\nBien cordialement,";

  it("se comptent à part : elles bloquent l'envoi mais ne se proposent pas comme options", () => {
    expect(countByKind(texte)).toEqual({ choix: 1, notes: 1 });
    expect(countChoices(texte)).toBe(2);
    expect(countByKind("[si oui, on y va] et [SI besoin : appelez]")).toEqual({
      choix: 0,
      notes: 2,
    });
    // « Silence » n'est pas une condition.
    expect(countByKind("[Silence radio / Réponse reçue]").choix).toBe(1);
  });

  it("portent la phrase à garder, sans leur condition, en capitale", () => {
    const note = choiceAt(texte, 50)!;
    expect(note.kind).toBe("note");
    expect(note.options).toEqual([]);
    expect(note.garder).toBe("Vous pouvez lancer la commande de la pièce.");
    expect(choiceAt("[si oui, on y va]", 3)?.garder).toBe("On y va");
    expect(choiceAt("[Si besoin]", 3)?.garder).toBe("Si besoin");
  });

  it("se gardent en phrase, ou se retirent avec leur ligne — sans laisser de trou", () => {
    const note = choiceAt(texte, 50)!;
    expect(applyChoice(texte, note, note.garder).text).toBe(
      "Nous [validons / ne validons pas] le devis.\n\nVous pouvez lancer la commande de la pièce.\n\nBien cordialement,",
    );
    expect(applyChoice(texte, note, null)).toEqual({
      text: "Nous [validons / ne validons pas] le devis.\n\nBien cordialement,",
      caret: 45,
    });
    // En fin de texte : la ligne part avec ses sauts.
    const fin = "Bonjour.\n\n[Si validé : lancez.]";
    const n = choiceAt(fin, 12)!;
    expect(applyChoice(fin, n, null).text).toBe("Bonjour.");
    // Au milieu d'une ligne : seul le crochet part.
    const milieu = "Merci [si possible : vite] et bonne journée.";
    expect(applyChoice(milieu, choiceAt(milieu, 8)!, null).text).toBe(
      "Merci  et bonne journée.",
    );
  });
});
