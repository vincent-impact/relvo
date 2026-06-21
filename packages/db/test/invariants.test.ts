import { describe, expect, it } from "vitest";
import {
  DomainError,
  SubjectStatus,
  createFolder,
  createMessage,
  createSubject,
  deleteFolder,
  getSubject,
  prisma,
  setTriageHint,
  tenantDb,
  updateSubjectStatus,
} from "../src/index";

// Tests d'invariants critiques (M3.14) : isolation tenant, Folder « Général »
// documentaire, transitions de statut, triage_hint réservé aux messages orphelins.

/** Crée un compte + son Folder « Général » et renvoie un client tenant scellé. */
async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  const general = await prisma.folder.create({
    data: {
      accountId: account.id,
      name: "Général",
      slug: "general",
      isDefault: true,
    },
  });
  return { account, db: tenantDb(account.id), generalId: general.id };
}

describe("Isolation tenant", () => {
  it("un compte ne lit pas les sujets d'un autre compte", async () => {
    const a = await makeAccount("a@test.fr");
    const b = await makeAccount("b@test.fr");
    const folderA = await createFolder(a.db, { name: "RH" });
    const subject = await createSubject(a.db, {
      title: "Sujet de A",
      folderId: folderA.id,
    });

    // B ne voit rien via une lecture scopée.
    expect(
      await b.db.subject.findFirst({ where: { id: subject.id } }),
    ).toBeNull();
    await expect(getSubject(b.db, subject.id)).rejects.toBeInstanceOf(
      DomainError,
    );

    // ... mais A le voit.
    expect((await getSubject(a.db, subject.id)).id).toBe(subject.id);
  });

  it("une mutation par id d'un autre tenant échoue (NOT_FOUND)", async () => {
    const a = await makeAccount("a2@test.fr");
    const b = await makeAccount("b2@test.fr");
    const subject = await createSubject(a.db, { title: "Sujet de A" });

    await expect(
      updateSubjectStatus(b.db, subject.id, SubjectStatus.acknowledged),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // L'état chez A est inchangé.
    expect((await getSubject(a.db, subject.id)).status).toBe(SubjectStatus.new);
  });
});

describe("Folder « Général » documentaire", () => {
  it("aucun sujet ne peut être rangé dans le Folder Général", async () => {
    const a = await makeAccount("c@test.fr");
    await expect(
      createSubject(a.db, { title: "Interdit", folderId: a.generalId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN_GENERAL_FOLDER" });
  });

  it("le Folder Général ne peut pas être supprimé", async () => {
    const a = await makeAccount("d@test.fr");
    await expect(deleteFolder(a.db, a.generalId)).rejects.toMatchObject({
      code: "FORBIDDEN_GENERAL_FOLDER",
    });
  });
});

describe("Transitions de statut", () => {
  it("rejette une transition interdite (archived → resolved)", async () => {
    const a = await makeAccount("e@test.fr");
    const subject = await createSubject(a.db, {
      title: "Sujet archivé",
      status: SubjectStatus.archived,
    });
    await expect(
      updateSubjectStatus(a.db, subject.id, SubjectStatus.resolved),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });

  it("autorise une transition valide (new → acknowledged)", async () => {
    const a = await makeAccount("f@test.fr");
    const subject = await createSubject(a.db, { title: "Sujet neuf" });
    const updated = await updateSubjectStatus(
      a.db,
      subject.id,
      SubjectStatus.acknowledged,
    );
    expect(updated.status).toBe(SubjectStatus.acknowledged);
  });
});

describe("triage_hint", () => {
  it("est refusé sur un message rattaché à un sujet", async () => {
    const a = await makeAccount("g@test.fr");
    const channel = await a.db.channel.create({
      data: { name: "Mail", type: "email", identifier: "x@test.fr" },
    });
    const subject = await createSubject(a.db, { title: "Sujet" });
    const message = await createMessage(a.db, {
      channelId: channel.id,
      direction: "incoming",
      subjectId: subject.id,
      content: "Bonjour",
    });
    await expect(
      setTriageHint(a.db, message.id, "ambiguous"),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});
