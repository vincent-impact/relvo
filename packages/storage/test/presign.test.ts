import { describe, expect, it } from "vitest";
import type { StorageConfig } from "../src/config";
import { createR2Storage } from "../src/r2";

// Propriétés de la signature (M4.3). Tests SANS réseau : la présignature est un
// calcul HMAC local, on inspecte l'URL produite.
//
// Ces deux propriétés dépendent de DÉFAUTS du SDK AWS qui ont déjà changé une
// fois (v3.729) et changeront encore. Elles cassent en silence : l'upload
// continue de fonctionner, seule la garantie disparaît. D'où ces tests.

const CONFIG: StorageConfig = {
  accountId: "acc",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  bucket: "bucket-de-test",
  jurisdiction: "eu",
  endpoint: "https://acc.eu.r2.cloudflarestorage.com",
};

async function presignedPutUrl() {
  const upload = await createR2Storage(CONFIG).presignUpload({
    key: "accounts/a1/knowledge/r/x.pdf",
    contentType: "application/pdf",
    contentLength: 1234,
  });
  return new URL(upload.url);
}

describe("URL d'upload pré-signée", () => {
  it("SIGNE le content-type — sinon l'allowlist MIME ne contraint rien", async () => {
    // Le presigner AWS met `content-type` dans ses `unsignableHeaders` par
    // défaut : sans `signableHeaders`, un PUT en `text/html` sur une URL signée
    // pour `application/pdf` est ACCEPTÉ (vérifié contre le vrai bucket le
    // 2026-07-15 : HTTP 200, et R2 stockait `text/html`).
    const signed = (await presignedPutUrl()).searchParams.get(
      "X-Amz-SignedHeaders",
    );
    expect(signed).toContain("content-type");
  });

  it("signe le content-length", async () => {
    const signed = (await presignedPutUrl()).searchParams.get(
      "X-Amz-SignedHeaders",
    );
    expect(signed).toContain("content-length");
  });

  it("n'embarque AUCUN paramètre de checksum", async () => {
    // Depuis la v3.729 le SDK injecte `x-amz-checksum-crc32` par défaut. À la
    // présignature il n'y a pas de corps → c'est le CRC32 du VIDE (`AAAAAA==`).
    // R2 liste ces en-têtes comme non implémentés et les ignore aujourd'hui ;
    // s'il les validait, tout upload non vide échouerait.
    const params = [...(await presignedPutUrl()).searchParams.keys()];
    expect(params.filter((p) => p.toLowerCase().includes("checksum"))).toEqual(
      [],
    );
  });
});

describe("URL de lecture pré-signée", () => {
  it("n'embarque aucun paramètre de checksum", async () => {
    const url = await createR2Storage(CONFIG).presignDownload({
      key: "accounts/a1/knowledge/r/x.pdf",
    });
    const params = [...new URL(url).searchParams.keys()];
    expect(params.filter((p) => p.toLowerCase().includes("checksum"))).toEqual(
      [],
    );
  });

  it("cible bien l'endpoint de juridiction EU", async () => {
    // Le SDK signe en style « virtual-hosted » : le bucket devient un
    // sous-domaine (`bucket.acc.eu.r2…`). Ce qui compte est le segment `.eu.`,
    // qui porte la résidence des données — pas la forme exacte de l'hôte.
    const url = await createR2Storage(CONFIG).presignDownload({
      key: "accounts/a1/knowledge/r/x.pdf",
    });
    expect(new URL(url).host).toBe(
      "bucket-de-test.acc.eu.r2.cloudflarestorage.com",
    );
  });
});
