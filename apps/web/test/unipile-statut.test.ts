import { describe, expect, it } from "vitest";
import {
  statutDepuisSources,
  statutDepuisUnipile,
} from "@/server/unipile/status";

// LE BADGE D'UN CANAL EST TENU PAR UNE TABLE (M5.8, PITFALLS #53) : le webhook
// d'état de compte et la page Canaux lisent la même correspondance. Un libellé
// inconnu ne fabrique jamais un état — il laisse celui qu'on a.

describe("statutDepuisUnipile", () => {
  it("les libellés de succès disent « connecté », quelle que soit la casse", () => {
    for (const l of [
      "OK",
      "ok",
      "CREATION_SUCCESS",
      "RECONNECTED",
      "SYNC_SUCCESS",
    ]) {
      expect(statutDepuisUnipile(l)).toBe("connected");
    }
  });

  it("identifiants, permissions, arrêt et suppression disent « erreur »", () => {
    for (const l of [
      "CREDENTIALS",
      "PERMISSIONS",
      "ERROR",
      "STOPPED",
      "DELETED",
      "DISCONNECTED",
    ]) {
      expect(statutDepuisUnipile(l)).toBe("error");
    }
  });

  it("une connexion en cours dit « en attente »", () => {
    expect(statutDepuisUnipile("CONNECTING")).toBe("pending");
  });

  it("un libellé vide ou inconnu ne devine rien", () => {
    expect(statutDepuisUnipile("")).toBeNull();
    expect(statutDepuisUnipile(null)).toBeNull();
    expect(statutDepuisUnipile(undefined)).toBeNull();
    expect(statutDepuisUnipile("SOMETHING_NEW")).toBeNull();
  });
});

describe("statutDepuisSources", () => {
  it("toutes les sources OK → connecté", () => {
    expect(statutDepuisSources([{ status: "OK" }])).toBe("connected");
    expect(statutDepuisSources([{ status: "OK" }, { status: "OK" }])).toBe(
      "connected",
    );
  });

  it("le pire l'emporte : une source en erreur suffit, une source qui se connecte suffit", () => {
    expect(
      statutDepuisSources([{ status: "OK" }, { status: "CREDENTIALS" }]),
    ).toBe("error");
    expect(
      statutDepuisSources([{ status: "OK" }, { status: "CONNECTING" }]),
    ).toBe("pending");
    expect(
      statutDepuisSources([{ status: "CONNECTING" }, { status: "ERROR" }]),
    ).toBe("error");
  });

  it("sans source lisible, on garde ce qu'on savait", () => {
    expect(statutDepuisSources([])).toBeNull();
    expect(statutDepuisSources(null)).toBeNull();
    expect(statutDepuisSources([{ status: "MYSTERY" }])).toBeNull();
    expect(
      statutDepuisSources([{ status: "OK" }, { status: "MYSTERY" }]),
    ).toBeNull();
  });
});
