import { describe, expect, it } from "vitest";
import { depotPermis, type DossierArbre } from "../src/lib/arbre-depot";

// Le glisser-déposer de l'arbre des sujets (M28.3) : ce que la règle permet,
// et les interdits du brief — un dossier dans lui-même ou ses descendants,
// au-delà de trois niveaux, un dossier dans « Sans dossier ».

// Clients › Franchises › Narbonne ; Fournisseurs › Matériel ; Équipe.
const G = "general";
const arbre: DossierArbre[] = [
  { id: "clients", parentId: G, depth: 1 },
  { id: "franchises", parentId: "clients", depth: 2 },
  { id: "narbonne", parentId: "franchises", depth: 3 },
  { id: "fournisseurs", parentId: G, depth: 1 },
  { id: "materiel", parentId: "fournisseurs", depth: 2 },
  { id: "equipe", parentId: G, depth: 1 },
];
const ok = (
  g: Parameters<typeof depotPermis>[0],
  c: Parameters<typeof depotPermis>[1],
) => depotPermis(g, c, arbre, 3);

describe("déposer un sujet", () => {
  const rangé = { type: "sujet" as const, id: "s1", dossier: "clients" };
  const libre = { type: "sujet" as const, id: "s2", dossier: null };

  it("va dans un autre dossier, à n'importe quel niveau", () => {
    expect(ok(rangé, "narbonne")).toBe(true);
    expect(ok(libre, "equipe")).toBe(true);
  });
  it("ne se dépose pas là où il est déjà", () => {
    expect(ok(rangé, "clients")).toBe(false);
    expect(ok(libre, "aucun")).toBe(false);
  });
  it("sort de son dossier vers « Sans dossier », jamais vers le premier niveau", () => {
    expect(ok(rangé, "aucun")).toBe(true);
    expect(ok(rangé, "racine")).toBe(false);
  });
  it("ne se dépose pas dans un dossier inconnu", () => {
    expect(ok(rangé, "fantome")).toBe(false);
  });
});

describe("déposer un dossier", () => {
  const d = (id: string) => ({ type: "dossier" as const, id });

  it("entre dans un autre dossier quand la profondeur le permet", () => {
    expect(ok(d("equipe"), "clients")).toBe(true);
    expect(ok(d("equipe"), "franchises")).toBe(true);
    expect(ok(d("materiel"), "equipe")).toBe(true);
  });
  it("n'entre ni dans lui-même ni dans un de ses descendants", () => {
    expect(ok(d("clients"), "clients")).toBe(false);
    expect(ok(d("clients"), "franchises")).toBe(false);
    expect(ok(d("clients"), "narbonne")).toBe(false);
  });
  it("ne dépasse pas trois niveaux, lui et ce qu'il contient", () => {
    // Équipe sous Narbonne serait un quatrième niveau.
    expect(ok(d("equipe"), "narbonne")).toBe(false);
    // Fournisseurs (deux niveaux) sous Franchises en ferait quatre.
    expect(ok(d("fournisseurs"), "franchises")).toBe(false);
    expect(ok(d("fournisseurs"), "equipe")).toBe(true);
  });
  it("n'est jamais « sans dossier »", () => {
    expect(ok(d("materiel"), "aucun")).toBe(false);
  });
  it("remonte au premier niveau, sauf s'il y est déjà", () => {
    expect(ok(d("narbonne"), "racine")).toBe(true);
    expect(ok(d("clients"), "racine")).toBe(false);
  });
  it("ne se dépose pas chez son père actuel", () => {
    expect(ok(d("franchises"), "clients")).toBe(false);
  });
});
