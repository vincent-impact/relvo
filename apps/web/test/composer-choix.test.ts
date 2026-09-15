import { describe, expect, it } from "vitest";
import {
  countChoices,
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
