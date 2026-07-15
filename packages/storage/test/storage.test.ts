import { describe, expect, it } from "vitest";
import { loadStorageConfig } from "../src/config";
import {
  accountPrefix,
  buildObjectKey,
  keyBelongsToAccount,
} from "../src/keys";
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
    // silencieusement sur l'endpoint global.
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

  it("rejette une juridiction inconnue au lieu de la concaténer", () => {
    expect(() =>
      loadStorageConfig({ ...ENV, R2_JURISDICTION: "fr" }),
    ).toThrow();
  });
});

describe("keys", () => {
  it("préfixe toute clé par le compte", () => {
    const key = buildObjectKey({
      accountId: "a1",
      scope: "knowledge",
      filename: "contrat.pdf",
      random: "r1",
    });
    expect(key).toBe("accounts/a1/knowledge/r1/contrat.pdf");
  });

  it("neutralise accents, espaces et casse du nom de fichier", () => {
    const key = buildObjectKey({
      accountId: "a1",
      scope: "attachments",
      filename: "Facture Été 2026.PDF",
      random: "r1",
    });
    expect(key).toBe("accounts/a1/attachments/r1/facture-ete-2026.pdf");
  });

  it("ne laisse pas un nom de fichier s'échapper du préfixe du compte", () => {
    const key = buildObjectKey({
      accountId: "a1",
      scope: "knowledge",
      filename: "../../a2/secret.pdf",
      random: "r1",
    });
    expect(key).toBe("accounts/a1/knowledge/r1/a2-secret.pdf");
    expect(keyBelongsToAccount(key, "a1")).toBe(true);
  });

  it("garde une clé valide quand le nom n'a aucun caractère sûr", () => {
    const key = buildObjectKey({
      accountId: "a1",
      scope: "knowledge",
      filename: "🙂🙂🙂",
      random: "r1",
    });
    expect(key).toBe("accounts/a1/knowledge/r1/fichier");
  });

  it("détecte une clé appartenant à un autre compte", () => {
    expect(keyBelongsToAccount("accounts/a2/knowledge/r/x.pdf", "a1")).toBe(
      false,
    );
  });

  it("ne se laisse pas berner par un compte en préfixe d'un autre", () => {
    // `accounts/a1` ne doit pas matcher le compte `a`.
    expect(keyBelongsToAccount("accounts/a1/knowledge/r/x.pdf", "a")).toBe(
      false,
    );
  });
});

describe("accountPrefix", () => {
  it("couvre toutes les clés du compte, et elles seules", () => {
    const prefix = accountPrefix("a1");
    expect(prefix).toBe("accounts/a1/");
    expect(
      buildObjectKey({
        accountId: "a1",
        scope: "knowledge",
        filename: "x.pdf",
      }),
    ).toMatch(new RegExp(`^${prefix}`));
    expect(
      buildObjectKey({
        accountId: "a2",
        scope: "knowledge",
        filename: "x.pdf",
      }),
    ).not.toMatch(new RegExp(`^${prefix}`));
  });

  it("refuse un accountId vide plutôt que de renvoyer `accounts//`", () => {
    // `accounts//` ne matcherait rien chez R2, mais un jour quelqu'un
    // construira un préfixe de purge à la main : autant lever ici.
    expect(() => accountPrefix("")).toThrow();
    expect(() => accountPrefix("   ")).toThrow();
  });
});

describe("validation", () => {
  const knowledge = buildUploadRequestSchema("knowledge");

  it("accepte un PDF de taille normale", () => {
    const result = knowledge.safeParse({
      filename: "contrat.pdf",
      contentType: "application/pdf",
      contentLength: 2_000_000,
    });
    expect(result.success).toBe(true);
  });

  it("refuse un type non autorisé pour le scope", () => {
    // La vidéo est acceptée en pièce jointe, jamais en Connaissances.
    expect(
      knowledge.safeParse({
        filename: "clip.mp4",
        contentType: "video/mp4",
        contentLength: 1000,
      }).success,
    ).toBe(false);

    expect(
      buildUploadRequestSchema("attachments").safeParse({
        filename: "clip.mp4",
        contentType: "video/mp4",
        contentLength: 1000,
      }).success,
    ).toBe(true);
  });

  it("refuse un fichier au-dessus du plafond du scope", () => {
    expect(
      knowledge.safeParse({
        filename: "gros.pdf",
        contentType: "application/pdf",
        contentLength: 33 * 1024 * 1024,
      }).success,
    ).toBe(false);
  });

  it("refuse une extension dangereuse déguisée en MIME autorisé", () => {
    // Le Content-Type est déclaratif : le navigateur peut mentir.
    expect(
      knowledge.safeParse({
        filename: "payload.svg",
        contentType: "image/png",
        contentLength: 1000,
      }).success,
    ).toBe(false);
  });

  it("refuse un nom de fichier contenant un chemin", () => {
    expect(
      knowledge.safeParse({
        filename: "../../etc/passwd.pdf",
        contentType: "application/pdf",
        contentLength: 1000,
      }).success,
    ).toBe(false);
  });

  it("refuse une taille nulle ou négative", () => {
    for (const contentLength of [0, -1]) {
      expect(
        knowledge.safeParse({
          filename: "vide.pdf",
          contentType: "application/pdf",
          contentLength,
        }).success,
      ).toBe(false);
    }
  });
});
