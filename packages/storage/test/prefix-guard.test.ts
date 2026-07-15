import { S3Client } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StorageConfig } from "../src/config";
import { createR2Storage } from "../src/r2";

// Garde-fou de `deleteByPrefix` (M4.6).
//
// Un préfixe vide listerait — et donc effacerait — le bucket ENTIER, tous
// tenants confondus. Le refus doit intervenir AVANT le moindre appel réseau : on
// espionne donc `S3Client.send` pour vérifier qu'aucune commande ne part, et pas
// seulement qu'une exception est levée.

const CONFIG: StorageConfig = {
  accountId: "acc",
  accessKeyId: "key",
  secretAccessKey: "secret",
  bucket: "bucket-de-test",
  jurisdiction: "eu",
  endpoint: "https://acc.eu.r2.cloudflarestorage.com",
};

afterEach(() => vi.restoreAllMocks());

describe("deleteByPrefix", () => {
  it("refuse un préfixe vide sans émettre la moindre requête", async () => {
    // Rejette si appelé : le test échouerait aussi par ce biais.
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockRejectedValue(new Error("aucune requête ne devrait partir"));

    const storage = createR2Storage(CONFIG);

    for (const prefix of ["", "   "]) {
      await expect(storage.deleteByPrefix(prefix)).rejects.toThrow(
        /préfixe vide/,
      );
    }

    expect(send).not.toHaveBeenCalled();
  });

  it("liste puis supprime quand le préfixe est valide", async () => {
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockImplementation(async (command: unknown) => {
        const name = (command as { constructor: { name: string } }).constructor
          .name;
        if (name === "ListObjectsV2Command") {
          return {
            Contents: [{ Key: "accounts/a1/knowledge/x.pdf" }],
            IsTruncated: false,
          };
        }
        return {};
      });

    const storage = createR2Storage(CONFIG);
    await expect(storage.deleteByPrefix("accounts/a1/")).resolves.toBe(1);

    const commands = send.mock.calls.map(
      ([c]) => (c as { constructor: { name: string } }).constructor.name,
    );
    expect(commands).toEqual(["ListObjectsV2Command", "DeleteObjectsCommand"]);
  });

  it("ne supprime rien — et n'appelle pas DeleteObjects — sur un préfixe vide de tout objet", async () => {
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({ Contents: [], IsTruncated: false } as never);

    const storage = createR2Storage(CONFIG);
    await expect(storage.deleteByPrefix("accounts/inconnu/")).resolves.toBe(0);
    expect(send).toHaveBeenCalledTimes(1); // le List seul, pas de Delete à vide
  });

  it("pagine : sans la boucle, on n'effacerait qu'une partie du préfixe", async () => {
    let page = 0;
    vi.spyOn(S3Client.prototype, "send").mockImplementation(
      async (command: unknown) => {
        const name = (command as { constructor: { name: string } }).constructor
          .name;
        if (name !== "ListObjectsV2Command") return {};
        page += 1;
        return page === 1
          ? {
              Contents: [{ Key: "accounts/a1/1.pdf" }],
              IsTruncated: true,
              NextContinuationToken: "suite",
            }
          : { Contents: [{ Key: "accounts/a1/2.pdf" }], IsTruncated: false };
      },
    );

    const storage = createR2Storage(CONFIG);
    await expect(storage.deleteByPrefix("accounts/a1/")).resolves.toBe(2);
  });
});
