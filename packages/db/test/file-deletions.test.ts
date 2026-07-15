import { describe, expect, it } from "vitest";
import { prisma, tenantDb } from "../src/index";
import { drainFileDeletions } from "../src/domain/file-deletions";

// Outbox de suppression de fichiers (M4.6).
//
// Ce qui est vérifié ici n'est PAS notre code TypeScript mais le comportement de
// PostgreSQL : le trigger se déclenche-t-il sur les lignes effacées par une
// CASCADE ? C'est l'hypothèse sur laquelle repose toute l'architecture, et elle
// est invérifiable en mock — d'où des tests contre une vraie base.

async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "T", lastName: "Est" },
  });
  const folder = await prisma.folder.create({
    data: {
      accountId: account.id,
      name: "Général",
      slug: "general",
      isDefault: true,
    },
  });
  return { account, folder };
}

function queuedKeys() {
  return prisma.pendingFileDeletion
    .findMany({ orderBy: { id: "asc" }, select: { storageKey: true } })
    .then((rows) => rows.map((r) => r.storageKey).sort());
}

describe("outbox de suppression de fichiers", () => {
  it("met la clé en file sur une suppression DIRECTE", async () => {
    const { account, folder } = await makeAccount("direct@test.fr");
    const doc = await prisma.knowledgeDocument.create({
      data: {
        accountId: account.id,
        folderId: folder.id,
        kind: "file",
        name: "x.pdf",
        storageKey: `accounts/${account.id}/knowledge/1/x.pdf`,
        createdByActor: "user",
      },
    });

    expect(await queuedKeys()).toEqual([]);
    await tenantDb(account.id).knowledgeDocument.deleteMany({
      where: { id: doc.id },
    });
    expect(await queuedKeys()).toEqual([
      `accounts/${account.id}/knowledge/1/x.pdf`,
    ]);
  });

  it("met la clé en file sur une CASCADE — ce que Prisma ne voit jamais", async () => {
    const { account, folder } = await makeAccount("cascade@test.fr");
    await prisma.knowledgeDocument.createMany({
      data: [
        {
          accountId: account.id,
          folderId: folder.id,
          kind: "file",
          name: "a.pdf",
          storageKey: `accounts/${account.id}/knowledge/1/a.pdf`,
          createdByActor: "user",
        },
        {
          accountId: account.id,
          folderId: folder.id,
          kind: "file",
          name: "b.pdf",
          storageKey: `accounts/${account.id}/knowledge/2/b.pdf`,
          createdByActor: "user",
        },
      ],
    });

    // On supprime le DOSSIER : les documents partent en cascade, côté PostgreSQL.
    // Prisma n'émet qu'un DELETE et ne voit passer aucun document.
    await prisma.folder.delete({ where: { id: folder.id } });

    expect(await queuedKeys()).toEqual([
      `accounts/${account.id}/knowledge/1/a.pdf`,
      `accounts/${account.id}/knowledge/2/b.pdf`,
    ]);
  });

  it("capte la cascade sur DEUX niveaux (compte → dossier → document)", async () => {
    const { account, folder } = await makeAccount("deep@test.fr");
    await prisma.knowledgeDocument.create({
      data: {
        accountId: account.id,
        folderId: folder.id,
        kind: "file",
        name: "deep.pdf",
        storageKey: `accounts/${account.id}/knowledge/1/deep.pdf`,
        createdByActor: "user",
      },
    });

    await prisma.account.delete({ where: { id: account.id } });
    expect(await queuedKeys()).toEqual([
      `accounts/${account.id}/knowledge/1/deep.pdf`,
    ]);
  });

  it("n'enfile rien pour une instruction (pas de fichier)", async () => {
    const { account, folder } = await makeAccount("note@test.fr");
    const note = await prisma.knowledgeDocument.create({
      data: {
        accountId: account.id,
        folderId: folder.id,
        kind: "note",
        name: "consigne",
        content: "texte",
        createdByActor: "user",
      },
    });
    await prisma.knowledgeDocument.delete({ where: { id: note.id } });
    expect(await queuedKeys()).toEqual([]);
  });

  it("annule la mise en file si la transaction est ROLLBACK", async () => {
    const { account, folder } = await makeAccount("rollback@test.fr");
    const doc = await prisma.knowledgeDocument.create({
      data: {
        accountId: account.id,
        folderId: folder.id,
        kind: "file",
        name: "r.pdf",
        storageKey: `accounts/${account.id}/knowledge/1/r.pdf`,
        createdByActor: "user",
      },
    });

    // C'est LA propriété qui fait tout l'intérêt du trigger sur un job applicatif :
    // Django a retiré la suppression synchrone en 1.3 précisément à cause des
    // « rolled-back transactions » qui détruisaient le fichier d'une ligne vivante.
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.knowledgeDocument.delete({ where: { id: doc.id } });
        throw new Error("annulation");
      }),
    ).rejects.toThrow("annulation");

    expect(await queuedKeys()).toEqual([]);
    expect(
      await prisma.knowledgeDocument.findUnique({ where: { id: doc.id } }),
    ).not.toBeNull();
  });
});

describe("drainFileDeletions", () => {
  it("supprime l'objet puis retire l'entrée de file", async () => {
    const { account, folder } = await makeAccount("drain@test.fr");
    const key = `accounts/${account.id}/knowledge/1/d.pdf`;
    const doc = await prisma.knowledgeDocument.create({
      data: {
        accountId: account.id,
        folderId: folder.id,
        kind: "file",
        name: "d.pdf",
        storageKey: key,
        createdByActor: "user",
      },
    });
    await prisma.knowledgeDocument.delete({ where: { id: doc.id } });

    const deleted: string[] = [];
    const result = await drainFileDeletions({
      delete: async (k) => void deleted.push(k),
    });

    expect(deleted).toEqual([key]);
    expect(result).toMatchObject({ deleted: 1, skipped: 0, failed: 0 });
    expect(await queuedKeys()).toEqual([]);
  });

  it("NE supprime PAS un fichier qu'une autre ligne référence encore", async () => {
    // Le scénario Django n°2 (« fields on different models referencing the same
    // file »), et notre reset démo : le compte est supprimé (clés en file), puis
    // les fixtures sont reposées sur les MÊMES clés déterministes. Sans ce
    // garde-fou, le drainage effacerait les fichiers fraîchement uploadés.
    const { account, folder } = await makeAccount("reuse@test.fr");
    const key = `accounts/${account.id}/knowledge/seed/fixture.pdf`;

    const first = await prisma.knowledgeDocument.create({
      data: {
        accountId: account.id,
        folderId: folder.id,
        kind: "file",
        name: "fixture.pdf",
        storageKey: key,
        createdByActor: "user",
      },
    });
    await prisma.knowledgeDocument.delete({ where: { id: first.id } });
    expect(await queuedKeys()).toEqual([key]);

    // Une nouvelle ligne reprend la même clé (le reseed).
    await prisma.knowledgeDocument.create({
      data: {
        accountId: account.id,
        folderId: folder.id,
        kind: "file",
        name: "fixture.pdf",
        storageKey: key,
        createdByActor: "user",
      },
    });

    const deleted: string[] = [];
    const result = await drainFileDeletions({
      delete: async (k) => void deleted.push(k),
    });

    expect(deleted).toEqual([]); // le fichier est intact
    expect(result).toMatchObject({ deleted: 0, skipped: 1 });
    expect(await queuedKeys()).toEqual([]); // mais l'entrée est purgée
  });

  it("garde l'entrée en file et journalise l'erreur si le stockage échoue", async () => {
    const { account, folder } = await makeAccount("fail@test.fr");
    const doc = await prisma.knowledgeDocument.create({
      data: {
        accountId: account.id,
        folderId: folder.id,
        kind: "file",
        name: "f.pdf",
        storageKey: `accounts/${account.id}/knowledge/1/f.pdf`,
        createdByActor: "user",
      },
    });
    await prisma.knowledgeDocument.delete({ where: { id: doc.id } });

    const result = await drainFileDeletions({
      delete: async () => {
        throw new Error("R2 injoignable");
      },
    });

    expect(result).toMatchObject({ deleted: 0, failed: 1 });

    // La fuite reste VISIBLE — c'est ce qui dispense d'un balayage.
    const [row] = await prisma.pendingFileDeletion.findMany();
    expect(row?.attempts).toBe(1);
    expect(row?.lastError).toMatch(/R2 injoignable/);
  });
});
