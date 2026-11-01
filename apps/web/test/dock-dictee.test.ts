import { describe, expect, it } from "vitest";
import { SEUIL_MAINTIEN_MS, urlEchangeDicte } from "@/lib/echanges-regles";

// Maintenir le disque du dock pour parler (M22.8, R10) : ce que relâcher ouvre.

describe("la dictée depuis le dock", () => {
  it("ouvre un NOUVEL échange, la dictée en premier tour, la page d'origine gardée", () => {
    const url = urlEchangeDicte(
      "  Ouvre un sujet pour le devis Kiloutou ",
      "/fil",
    );
    expect(url).toBe(
      "/relvo?nouveau=1&dicte=Ouvre+un+sujet+pour+le+devis+Kiloutou&from=%2Ffil",
    );
  });

  it("sans page d'origine, pas de retour ; sans texte, nulle part", () => {
    expect(urlEchangeDicte("Bonjour", null)).toBe(
      "/relvo?nouveau=1&dicte=Bonjour",
    );
    expect(urlEchangeDicte("   ", "/")).toBeNull();
  });

  it("un appui plus court que le seuil est un tap, pas une dictée", () => {
    expect(SEUIL_MAINTIEN_MS).toBeGreaterThan(150);
    expect(SEUIL_MAINTIEN_MS).toBeLessThan(400);
  });
});
