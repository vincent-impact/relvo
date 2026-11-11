import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  LIMITES_APERCU,
  estUnClasseur,
  franciser,
  lireClasseur,
} from "../src/classeur";

// Le lecteur de classeurs (recette R18). Les fichiers d'essai sont écrits par
// la bibliothèque elle-même, en mémoire : aucun binaire dans le dépôt.

function classeur(
  feuilles: Record<string, unknown[][]>,
  format: "xlsx" | "biff8" = "xlsx",
  cachees: string[] = [],
): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [nom, lignes] of Object.entries(feuilles)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lignes), nom);
  }
  wb.Workbook = {
    Sheets: wb.SheetNames.map((nom) => ({
      name: nom,
      Hidden: cachees.includes(nom) ? 1 : 0,
    })),
  };
  return new Uint8Array(
    XLSX.write(wb, { type: "array", bookType: format }) as ArrayBuffer,
  );
}

function lu(octets: Uint8Array, nom: string, limites = LIMITES_APERCU) {
  const r = lireClasseur(octets, { nom }, limites);
  if (!r.ok) throw new Error(`lecture refusée : ${r.raison}`);
  return r.classeur;
}

/** La première feuille d'un classeur lu — elle existe, la lecture a réussi. */
function f0(octets: Uint8Array, nom: string, limites = LIMITES_APERCU) {
  const feuille = lu(octets, nom, limites).feuilles[0];
  if (!feuille) throw new Error("aucune feuille");
  return feuille;
}

describe("estUnClasseur", () => {
  it("reconnaît un classeur à son nom, même typé en flux d'octets", () => {
    expect(
      estUnClasseur("TASTY CRA 2026.xlsx", "application/octet-stream"),
    ).toBe(true);
    expect(estUnClasseur("export.XLS", null)).toBe(true);
    expect(estUnClasseur("ventes.csv", "text/plain")).toBe(true);
  });

  it("se fie au type quand le nom n'a pas d'extension", () => {
    expect(estUnClasseur("releve", "text/csv; charset=utf-8")).toBe(true);
    expect(estUnClasseur("releve", "application/pdf")).toBe(false);
  });

  it("ne prend pas un autre document pour un classeur", () => {
    expect(estUnClasseur("devis.pdf", "application/vnd.ms-excel")).toBe(false);
    expect(estUnClasseur("contrat.docx", null)).toBe(false);
  });
});

describe("lireClasseur", () => {
  it("rend chaque feuille d'un xlsx, dans l'ordre, avec ses cellules", () => {
    const c = lu(
      classeur({
        Janvier: [
          ["Magasin", "CA"],
          ["Aubervilliers", 1234.5],
        ],
        Février: [["Magasin"], ["Matignon"]],
      }),
      "cra.xlsx",
    );
    expect(c.feuilles.map((f) => f.nom)).toEqual(["Janvier", "Février"]);
    expect(c.feuilles[0]?.lignes).toEqual([
      ["Magasin", "CA"],
      ["Aubervilliers", "1234,5"],
    ]);
    expect(c.feuilles[0]?.tronquee).toBe(false);
    expect(c.feuillesTotal).toBe(2);
  });

  it("lit l'ancien format xls", () => {
    const f = f0(
      classeur(
        {
          Stock: [
            ["Réf", "Qté"],
            ["A1", 3],
          ],
        },
        "biff8",
      ),
      "stock.xls",
    );
    expect(f.lignes).toEqual([
      ["Réf", "Qté"],
      ["A1", "3"],
    ]);
  });

  it("montre un csv tel qu'écrit : point-virgule, zéros de tête, accents", () => {
    const texte = "Code;Libellé;Montant\n00123;Crème fraîche;12,50\n";
    expect(
      lu(new TextEncoder().encode(texte), "tarifs.csv").feuilles,
    ).toHaveLength(1);
    expect(f0(new TextEncoder().encode(texte), "tarifs.csv").lignes).toEqual([
      ["Code", "Libellé", "Montant"],
      ["00123", "Crème fraîche", "12,50"],
    ]);
  });

  it("lit un csv en Windows-1252 sans écorcher les accents", () => {
    // « Libellé;Prévu » tel qu'un logiciel de comptabilité l'exporte.
    const octets = Uint8Array.from([
      0x4c, 0x69, 0x62, 0x65, 0x6c, 0x6c, 0xe9, 0x3b, 0x50, 0x72, 0xe9, 0x76,
      0x75, 0x0a, 0x61, 0x3b, 0x62, 0x0a,
    ]);
    expect(f0(octets, "compta.csv").lignes[0]).toEqual(["Libellé", "Prévu"]);
  });

  it("écrit les dates à la française", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([[new Date(Date.UTC(2026, 10, 3))]], {
      cellDates: false,
    });
    XLSX.utils.book_append_sheet(wb, ws, "Dates");
    const octets = new Uint8Array(
      XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer,
    );
    expect(f0(octets, "dates.xlsx").lignes[0]?.[0]).toMatch(
      /^0[23]\/11\/2026$/,
    );
  });

  it("passe les feuilles masquées", () => {
    const c = lu(
      classeur({ Visible: [["a"]], Calculs: [["b"]] }, "xlsx", ["Calculs"]),
      "c.xlsx",
    );
    expect(c.feuilles.map((f) => f.nom)).toEqual(["Visible"]);
  });

  it("coupe une feuille trop longue et dit ce qu'elle compte vraiment", () => {
    const lignes = Array.from({ length: 40 }, (_, i) => [`ligne ${i + 1}`, i]);
    const f = f0(classeur({ Longue: lignes }), "longue.xlsx", {
      ...LIMITES_APERCU,
      lignes: 10,
    });
    expect(f.lignes).toHaveLength(10);
    expect(f.lignesTotal).toBe(40);
    expect(f.tronquee).toBe(true);
  });

  it("coupe une feuille trop large et une cellule trop longue", () => {
    const f = f0(
      classeur({
        Large: [
          ["a", "b", "c", "d"],
          ["x".repeat(50), "", "", "z"],
        ],
      }),
      "large.xlsx",
      { ...LIMITES_APERCU, colonnes: 2, cellule: 10 },
    );
    expect(f.lignes).toEqual([
      ["a", "b"],
      [`${"x".repeat(10)}…`, ""],
    ]);
    expect(f.colonnesTotal).toBe(4);
    expect(f.tronquee).toBe(true);
  });

  it("s'arrête au volume accordé plutôt que de tout envoyer", () => {
    const lignes = Array.from({ length: 100 }, () => ["x".repeat(100)]);
    const f = f0(classeur({ Lourde: lignes }), "lourde.xlsx", {
      ...LIMITES_APERCU,
      volume: 1000,
    });
    expect(f.lignes.length).toBeLessThan(12);
    expect(f.tronquee).toBe(true);
  });

  it("retire les lignes et colonnes vides de la fin", () => {
    const garde = f0(
      classeur({
        F: [
          ["a", "", ""],
          ["", "", ""],
          ["", "", " "],
        ],
      }),
      "f.xlsx",
    );
    expect(garde.lignes[0]).toHaveLength(3);
    expect(
      f0(
        classeur({
          F: [
            ["a", null, null],
            [null, null, null],
          ],
        }),
        "f.xlsx",
      ).lignes,
    ).toEqual([["a"]]);
  });

  it("refuse sans lever ce qui n'est pas un classeur", () => {
    const bruit = Uint8Array.from({ length: 4096 }, (_, i) => (i * 37) % 256);
    expect(lireClasseur(bruit, { nom: "faux.xlsx" })).toEqual({
      ok: false,
      raison: "illisible",
    });
    // Une archive qui commence comme un xlsx et s'arrête net.
    const tronque = classeur({ F: [["a"]] }).subarray(0, 60);
    expect(lireClasseur(tronque, { nom: "casse.xlsx" })).toEqual({
      ok: false,
      raison: "illisible",
    });
  });

  it("dit qu'un fichier est vide", () => {
    expect(lireClasseur(new Uint8Array(), { nom: "vide.xlsx" })).toEqual({
      ok: false,
      raison: "vide",
    });
    expect(lireClasseur(classeur({ F: [[]] }), { nom: "vide.xlsx" })).toEqual({
      ok: false,
      raison: "vide",
    });
  });
});

describe("franciser", () => {
  it("rend les séparateurs français sans toucher à ce qui entoure le nombre", () => {
    expect(franciser("1,234.50")).toBe("1 234,50");
    expect(franciser("12.5%")).toBe("12,5%");
    expect(franciser("$1,234,567.00")).toBe("$1 234 567,00");
    expect(franciser("2026")).toBe("2026");
  });
});
