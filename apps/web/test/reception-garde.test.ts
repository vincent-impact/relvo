import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// « IGNORER, C'EST NE PLUS IMPORTER » (M25.9) — l'inventaire tenu par un test.
//
// La règle vit dans le domaine (`recevoir…`, `domain/reception.ts`) : c'est
// elle qui refuse le message d'une conversation ignorée. Les primitives
// `ingest…` persistent sans rien demander — pour les graines et les tests.
// Un point d'entrée de l'application qui les appellerait directement
// recommencerait à importer ce que le dirigeant a dit ne plus vouloir, sans
// qu'aucun test du domaine ne le voie. D'où celui-ci : AUCUN fichier de
// l'application n'appelle une primitive d'ingestion.

const SRC = resolve(import.meta.dirname, "../src");
const PRIMITIVES =
  /\b(ingestInboundEmail|ingestOutboundEmail|ingestInboundWhatsApp|ingestOutboundWhatsApp)\s*\(/;

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((nom) => {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) {
      return nom === "generated" ? [] : fichiers(chemin);
    }
    return /\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

describe("la réception passe par la garde du domaine", () => {
  it("aucun fichier de l'application n'appelle une primitive d'ingestion", () => {
    const fautifs = fichiers(SRC)
      .filter((f) => PRIMITIVES.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f));
    expect(fautifs).toEqual([]);
  });

  it("les deux points d'entrée appellent bien la garde", () => {
    const lire = (f: string) => readFileSync(join(SRC, f), "utf8");
    expect(lire("server/courrier/reception.ts")).toMatch(
      /recevoirEmailEntrant\(/,
    );
    expect(lire("server/courrier/reception.ts")).toMatch(
      /recevoirEmailSortant\(/,
    );
    expect(lire("app/api/webhooks/unipile/route.ts")).toMatch(
      /recevoirWhatsAppEntrant\(/,
    );
    expect(lire("app/api/webhooks/unipile/route.ts")).toMatch(
      /recevoirWhatsAppSortant\(/,
    );
  });
});
