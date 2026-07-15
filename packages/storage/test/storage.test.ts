import { describe, expect, it } from "vitest";
import { loadStorageConfig } from "../src/config";
import { buildObjectKey } from "../src/keys";
import { buildUploadRequestSchema } from "../src/validation";

const ENV = {
  R2_ACCOUNT_ID: "acc123",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: "relvo-files",
};

describe("config", () => {
  it("cible l'endpoint de juridiction EU par défaut (résidence RGPD)", () => {
    // Le défaut compte : un oubli de R2_JURISDICTION ne doit pas basculer
    // silencieusement sur l'endpoint global. Le `.eu.` n'est pas cosmétique —
    // c'est lui qui garantit la résidence des données en UE.
    expect(loadStorageConfig(ENV).endpoint).toBe(
      "https://acc123.eu.r2.cloudflarestorage.com",
    );
  });

  it("retire le segment de juridiction quand elle vaut `none`", () => {
    const config = loadStorageConfig({ ...ENV, R2_JURISDICTION: "none" });
    expect(config.endpoint).toBe("https://acc123.r2.cloudflarestorage.com");
  });

  it("nomme les variables manquantes plutôt que de lever un message opaque", () => {
    expect(() => loadStorageConfig({ R2_ACCOUNT_ID: "acc123" })).toThrow(
      /R2_ACCESS_KEY_ID/,
    );
  });
});

describe("buildObjectKey", () => {
  it("préfixe par le compte et rend la clé non devinable", () => {
    expect(
      buildObjectKey({ accountId: "a1", scope: "knowledge", random: "r1" }),
    ).toBe("accounts/a1/knowledge/r1");
  });

  it("génère un identifiant unique par appel", () => {
    // R2 ne versionne pas : deux fichiers sur la même clé, le second écrase le
    // premier en silence.
    const a = buildObjectKey({ accountId: "a1", scope: "knowledge" });
    const b = buildObjectKey({ accountId: "a1", scope: "knowledge" });
    expect(a).not.toBe(b);
  });
});

describe("validation", () => {
  const knowledge = buildUploadRequestSchema("knowledge");

  it("accepte un PDF de taille normale", () => {
    expect(
      knowledge.safeParse({
        contentType: "application/pdf",
        contentLength: 2_000_000,
      }).success,
    ).toBe(true);
  });

  it("refuse un type non autorisé pour le scope", () => {
    // La vidéo est acceptée en pièce jointe, jamais en Connaissances.
    expect(
      knowledge.safeParse({ contentType: "video/mp4", contentLength: 1000 })
        .success,
    ).toBe(false);

    expect(
      buildUploadRequestSchema("attachments").safeParse({
        contentType: "video/mp4",
        contentLength: 1000,
      }).success,
    ).toBe(true);
  });

  it("refuse un fichier au-dessus du plafond du scope", () => {
    expect(
      knowledge.safeParse({
        contentType: "application/pdf",
        contentLength: 33 * 1024 * 1024,
      }).success,
    ).toBe(false);
  });
});
