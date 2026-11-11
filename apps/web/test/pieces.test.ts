import { describe, expect, it } from "vitest";
import {
  adresseDePiece,
  estUnNombre,
  familleDeFichier,
  formatPoids,
  genreDePiece,
  lettreDeColonne,
  libelleDeType,
  phraseSansApercu,
} from "@/lib/pieces";

// Ce que l'écran décide d'une pièce avant de l'ouvrir (recette R18).

describe("genreDePiece — le geste qu'une pièce appelle", () => {
  it("garde l'image et le PDF sur leurs chemins d'avant", () => {
    expect(genreDePiece("photo.jpg", "image/jpeg")).toBe("image");
    expect(genreDePiece("devis.pdf", "application/pdf")).toBe("pdf");
    // Un PDF mal typé par la messagerie reste un PDF.
    expect(genreDePiece("devis.PDF", "application/octet-stream")).toBe("pdf");
  });

  it("ouvre un classeur dans l'application, quel que soit le type annoncé", () => {
    expect(
      genreDePiece("TASTY CRA 2026.xlsx", "application/octet-stream"),
    ).toBe("classeur");
    expect(genreDePiece("stock.xls", "application/vnd.ms-excel")).toBe(
      "classeur",
    );
    expect(genreDePiece("ventes.csv", "text/csv")).toBe("classeur");
  });

  it("n'envoie jamais le reste au navigateur", () => {
    for (const [nom, type] of [
      [
        "contrat.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      ["note vocale.ogg", "audio/ogg"],
      ["chantier.mp4", "video/mp4"],
      ["archive.zip", "application/zip"],
      ["sans-extension", null],
    ] as const) {
      expect(genreDePiece(nom, type)).toBe("autre");
    }
  });
});

describe("ce que l'écran du fichier écrit", () => {
  it("dit le type en clair, jamais un type MIME", () => {
    expect(libelleDeType("cra.xlsx", null)).toBe("Classeur Excel");
    expect(libelleDeType("contrat.docx", null)).toBe("Document Word");
    expect(libelleDeType("note", "audio/ogg")).toBe("Enregistrement audio");
    expect(libelleDeType("plan.rvt", "application/octet-stream")).toBe(
      "Fichier RVT",
    );
    expect(libelleDeType("sans-extension", null)).toBe("Fichier");
  });

  it("dit le poids à la française", () => {
    expect(formatPoids(840)).toBe("840 octets");
    expect(formatPoids(12_400)).toBe("12 Ko");
    expect(formatPoids(1_240_000)).toBe("1,2 Mo");
    expect(formatPoids(3_000_000)).toBe("3 Mo");
    expect(formatPoids(48_600_000)).toBe("49 Mo");
  });

  it("nomme toujours la raison d'un aperçu absent", () => {
    expect(phraseSansApercu("autre", null)).toMatch(/n'affiche pas ce type/);
    expect(phraseSansApercu("classeur", "protege")).toMatch(/mot de passe/);
    expect(phraseSansApercu("classeur", "trop_lourd")).toMatch(/trop lourd/);
    expect(phraseSansApercu("classeur", "reseau")).toMatch(
      /n'a pas pu être chargé/,
    );
    expect(phraseSansApercu("classeur", "illisible")).toMatch(
      /n'a pas pu être affiché/,
    );
    expect(phraseSansApercu("autre", "absent")).toMatch(/plus disponible/);
  });
});

describe("le tableau", () => {
  it("nomme les colonnes comme un tableur", () => {
    expect([0, 25, 26, 27, 701, 702].map(lettreDeColonne)).toEqual([
      "A",
      "Z",
      "AA",
      "AB",
      "ZZ",
      "AAA",
    ]);
  });

  it("aligne à droite ce qui se lit comme un nombre", () => {
    for (const t of ["12", "1 234,50", "-3,5", "12,5 %", "1 200 €"]) {
      expect(estUnNombre(t), t).toBe(true);
    }
    for (const t of [
      "",
      "Aubervilliers",
      "12 rue de Paris",
      "03/11/2026",
      "A12",
    ]) {
      expect(estUnNombre(t), t).toBe(false);
    }
  });
});

describe("adresseDePiece", () => {
  it("choisit la route à la source, jamais une clé de stockage", () => {
    expect(adresseDePiece("attachment", "a1")).toBe("/api/attachments/a1");
    expect(adresseDePiece("document", "d1")).toBe("/api/documents/d1");
  });
});

describe("familleDeFichier — l'icône et la couleur d'un fichier", () => {
  it("reconnaît les quatre familles colorées à leur nom", () => {
    expect(familleDeFichier("devis.pdf", null)).toBe("pdf");
    expect(familleDeFichier("Cockpit_Financier.xlsx", null)).toBe("tableur");
    expect(familleDeFichier("ventes.csv", null)).toBe("tableur");
    expect(familleDeFichier("contrat.docx", null)).toBe("document");
    expect(familleDeFichier("offre.pptx", null)).toBe("presentation");
  });

  it("fait passer le nom avant un type trop large", () => {
    expect(familleDeFichier("devis.PDF", "application/octet-stream")).toBe(
      "pdf",
    );
    expect(familleDeFichier("photo.jpg", "application/octet-stream")).toBe(
      "image",
    );
  });

  it("se fie au type quand le nom ne dit rien", () => {
    expect(familleDeFichier("piece-jointe", "application/pdf")).toBe("pdf");
    expect(familleDeFichier("note", "audio/ogg")).toBe("son");
    expect(familleDeFichier("clip", "video/mp4")).toBe("video");
    expect(familleDeFichier("piece-jointe", null)).toBe("autre");
  });
});
