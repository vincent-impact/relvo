import { describe, expect, it } from "vitest";
import {
  EVENT_TYPES,
  SubjectStatus,
  createSubject,
  prisma,
  revokeResolutionSuggestion,
  suggestResolution,
  tenantDb,
} from "../src/index";

// La suggestion de clôture est retirée par DEUX mains, et le journal doit dire
// laquelle : Relvo quand la situation évolue (05 §8.5), l'utilisateur quand il
// répond « pas encore » au bandeau de la fiche. Sans cette distinction, le
// journal attribuerait à l'agent une décision de l'utilisateur.
// Le sujet reste OUVERT dans les deux cas : retirer une suggestion n'est pas la
// refuser définitivement — Relvo peut la reproposer.

async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  const db = tenantDb(account.id);
  // Un domaine ordinaire : « Général » est documentaire et refuse tout sujet.
  const folder = await db.folder.create({
    data: { name: "Fournisseurs", slug: "fournisseurs" },
  });
  return { db, folderId: folder.id };
}

describe("retrait de la suggestion de clôture", () => {
  it("l'utilisateur écarte la suggestion : elle disparaît, le sujet reste ouvert, et le journal l'attribue à l'utilisateur", async () => {
    const { db, folderId } = await makeAccount(
      `resolution-user-${Date.now()}@test.fr`,
    );
    const subject = await createSubject(db, {
      title: "Devis friteuse",
      folderId,
    });
    await suggestResolution(db, subject.id);

    const retire = await revokeResolutionSuggestion(db, subject.id, {
      by: "user",
    });

    expect(retire).not.toBeNull();
    const apres = await db.subject.findFirstOrThrow({
      where: { id: subject.id },
    });
    expect(apres.resolutionSuggestedAt).toBeNull();
    expect(apres.status).toBe(SubjectStatus.open);

    const event = await db.eventLog.findFirstOrThrow({
      where: {
        subjectId: subject.id,
        eventType: EVENT_TYPES.resolutionRevoked,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(event.actor).toBe("user");
    expect(event.title).toContain(subject.reference);
    expect(event.title).not.toContain("Relvo");
  });

  it("Relvo retire la sienne : même effet, mais le journal reste à l'agent", async () => {
    const { db, folderId } = await makeAccount(
      `resolution-ai-${Date.now()}@test.fr`,
    );
    const subject = await createSubject(db, {
      title: "Sauce blanche",
      folderId,
    });
    await suggestResolution(db, subject.id);

    await revokeResolutionSuggestion(db, subject.id, {
      reason: "un message rouvre des questions",
    });

    const event = await db.eventLog.findFirstOrThrow({
      where: {
        subjectId: subject.id,
        eventType: EVENT_TYPES.resolutionRevoked,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(event.actor).toBe("ai");
    expect(event.title).toContain("Relvo");
  });

  it("sans suggestion en cours, ne fait rien et ne journalise rien", async () => {
    const { db, folderId } = await makeAccount(
      `resolution-noop-${Date.now()}@test.fr`,
    );
    const subject = await createSubject(db, {
      title: "Rien à retirer",
      folderId,
    });

    const retire = await revokeResolutionSuggestion(db, subject.id, {
      by: "user",
    });

    expect(retire).toBeNull();
    const events = await db.eventLog.findMany({
      where: {
        subjectId: subject.id,
        eventType: EVENT_TYPES.resolutionRevoked,
      },
    });
    expect(events).toHaveLength(0);
  });
});
