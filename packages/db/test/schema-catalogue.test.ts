import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/index";

// LA LISTE DES CONTRAINTES HORS ORM EST TENUE PAR CE TEST (02, « Les
// contraintes que l'ORM ne sait pas exprimer »).
//
// Dans les DEUX sens : tout trigger ou contrainte de vérification cité dans le
// document existe en base ; tout trigger ou contrainte de vérification posé en
// base est cité dans le document. Le second sens est celui qu'aucune relecture
// n'attrape — sans lui, oublier le document ne coûte rien et se découvre trois
// semaines plus tard, quand quelqu'un code contre une contrainte fantôme.
//
// Le document porte un tableau dont la première colonne est le nom exact de
// l'objet en base, en code. C'est ce tableau qui est lu ; rien d'autre.
//
// ⚠️ Ne pas aller plus loin : pas de décompte, pas de phrase en français.

const DOC = resolve(
  import.meta.dirname,
  "../../../conception/02-modele-donnees.md",
);

function nomsCitesDansLeDocument(): Set<string> {
  const doc = readFileSync(DOC, "utf8");
  const section = doc.slice(
    doc.indexOf("## Les contraintes que l'ORM ne sait pas exprimer"),
    doc.indexOf("### Comment cette liste reste vraie"),
  );
  const noms = new Set<string>();
  for (const ligne of section.split("\n")) {
    const m = /^\|\s*`([a-z0-9_]+)`\s*\|/.exec(ligne);
    if (m) noms.add(m[1]);
  }
  return noms;
}

async function nomsPosesEnBase(): Promise<Set<string>> {
  const triggers = await prisma.$queryRaw<{ name: string }[]>`
    SELECT t.tgname AS name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname = 'public'`;
  const checks = await prisma.$queryRaw<{ name: string }[]>`
    SELECT c.conname AS name
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.contype = 'c' AND n.nspname = 'public'`;
  return new Set([...triggers, ...checks].map((r) => r.name));
}

describe("02 ↔ catalogue de la base (triggers et contraintes de vérification)", () => {
  it("tout ce que le document cite existe en base", async () => {
    const cites = nomsCitesDansLeDocument();
    const poses = await nomsPosesEnBase();
    expect(cites.size).toBeGreaterThan(0);
    for (const nom of cites)
      expect(poses, `cité mais absent en base : ${nom}`).toContain(nom);
  });

  it("tout ce qui est posé en base est cité dans le document", async () => {
    const cites = nomsCitesDansLeDocument();
    const poses = await nomsPosesEnBase();
    for (const nom of poses)
      expect(cites, `posé en base mais non cité dans 02 : ${nom}`).toContain(
        nom,
      );
  });
});
