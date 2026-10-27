import { describe, expect, it } from "vitest";
import {
  createDocument,
  createFolder,
  loadAccountProjection,
  prisma,
  tenantDb,
} from "../src/index";

// Une connaissance DÉPOSÉE par le dirigeant (M27.5) : inscrite dans son
// dossier, à lire — elle n'entre pas dans les prompts tant que Relvo ne l'a
// pas lue (M11), et le journal dit le dépôt.

async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Mam's", lastName: "Crousty", sectors: ["food"] },
  });
  await prisma.folder.create({
    data: {
      accountId: account.id,
      name: "Général",
      slug: "general",
      isDefault: true,
    },
  });
  return { account, db: tenantDb(account.id) };
}

describe("une connaissance déposée", () => {
  it("s'inscrit dans son dossier, à lire, hors des prompts, journalisée", async () => {
    const { account, db } = await makeAccount("connaissance-1@test.relvo");
    const fournisseurs = await createFolder(db, { name: "Fournisseurs" });

    const doc = await createDocument(db, {
      folderId: fournisseurs.id,
      name: "Tarifs Metro — octobre.pdf",
      mimeType: "application/pdf",
      storageKey: `accounts/${account.id}/knowledge/abc`,
      fileSize: 12_345,
    });
    expect(doc.kind).toBe("file");
    expect(doc.absorptionStatus).toBe("pending");
    expect(doc.createdByActor).toBe("user");

    // Pas encore lue : la couche Domaine ne la cite pas.
    const projection = await loadAccountProjection(
      db,
      account.id,
      fournisseurs.id,
    );
    expect(projection.domaine?.documents.map((d) => d.nom) ?? []).not.toContain(
      "Tarifs Metro — octobre.pdf",
    );

    const journal = await db.eventLog.findMany({
      where: { entityId: doc.id },
      orderBy: { createdAt: "asc" },
    });
    expect(journal.map((e) => e.title)).toContain(
      "Connaissance « Tarifs Metro — octobre.pdf » déposée",
    );
  });

  it("refuse une clé vide ou une taille nulle", async () => {
    const { db } = await makeAccount("connaissance-2@test.relvo");
    const dossier = await createFolder(db, { name: "Juridique" });
    await expect(
      createDocument(db, {
        folderId: dossier.id,
        name: "x.pdf",
        mimeType: "application/pdf",
        storageKey: "",
        fileSize: 0,
      }),
    ).rejects.toThrow();
  });
});
