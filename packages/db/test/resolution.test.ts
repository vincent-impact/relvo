import { describe, expect, it } from "vitest";
import {
  Actor,
  EVENT_TYPES,
  SubjectStatus,
  completeTask,
  createSubject,
  createTask,
  prisma,
  reopenTask,
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

// LA DERNIÈRE TÂCHE COCHÉE PAR LE DIRIGEANT RÈGLE LE SUJET, sans IA (04 §10) :
// l'attente se lève, Relvo propose la clôture ; rouvrir la tâche la retire.
describe("la dernière tâche cochée à la main", () => {
  it("lève l'attente et suggère la clôture quand plus rien ne reste ; pas avant ; rouvrir retire la suggestion", async () => {
    const { db, folderId } = await makeAccount(
      `derniere-tache-${Date.now()}@test.fr`,
    );
    const subject = await createSubject(db, {
      title: "Réparation friteuse",
      folderId,
      waitingForReply: true,
    });
    const livraison = await createTask(db, {
      subjectId: subject.id,
      title: "Livraison de la friteuse neuve",
      sourceActor: Actor.ai,
      kind: "check",
    });
    const prevenir = await createTask(db, {
      subjectId: subject.id,
      title: "Prévenir l'équipe",
      sourceActor: Actor.user,
      kind: "inform",
    });

    // Une tâche cochée, une autre reste : rien ne bouge.
    await completeTask(db, prevenir.id);
    let s = await db.subject.findFirstOrThrow({ where: { id: subject.id } });
    expect(s.waitingForReply).toBe(true);
    expect(s.resolutionSuggestedAt).toBeNull();

    // La dernière : l'attente tombe, la clôture est proposée, journalisé.
    await completeTask(db, livraison.id);
    s = await db.subject.findFirstOrThrow({ where: { id: subject.id } });
    expect(s.waitingForReply).toBe(false);
    expect(s.resolutionSuggestedAt).not.toBeNull();
    expect(s.status).toBe(SubjectStatus.open);
    const levee = await db.eventLog.findFirstOrThrow({
      where: {
        subjectId: subject.id,
        eventType: EVENT_TYPES.waitingForReplyLifted,
      },
    });
    expect(levee.title).toBe(
      "Plus rien à attendre : « Livraison de la friteuse neuve » est cochée",
    );
    expect(levee.taskId).toBe(livraison.id);
    const suggeree = await db.eventLog.findFirstOrThrow({
      where: {
        subjectId: subject.id,
        eventType: EVENT_TYPES.resolutionSuggested,
      },
    });
    expect(suggeree.description).toBe(
      "Plus rien à faire : « Livraison de la friteuse neuve » était la dernière tâche.",
    );

    // Rouvrir : la suggestion tombe, l'attente ne revient pas.
    await reopenTask(db, livraison.id);
    s = await db.subject.findFirstOrThrow({ where: { id: subject.id } });
    expect(s.resolutionSuggestedAt).toBeNull();
    expect(s.waitingForReply).toBe(false);
    const retiree = await db.eventLog.findFirstOrThrow({
      where: {
        subjectId: subject.id,
        eventType: EVENT_TYPES.resolutionRevoked,
      },
    });
    expect(retiree.description).toBe(
      "Tâche rouverte : Livraison de la friteuse neuve",
    );
  });

  it("Relvo qui coche ne déclenche pas la mécanique : c'est sa relecture qui décide", async () => {
    const { db, folderId } = await makeAccount(
      `relvo-coche-${Date.now()}@test.fr`,
    );
    const subject = await createSubject(db, {
      title: "Devis",
      folderId,
      waitingForReply: true,
    });
    const t = await createTask(db, {
      subjectId: subject.id,
      title: "Recevoir le devis",
      sourceActor: Actor.ai,
      kind: "check",
    });
    await completeTask(db, t.id, Actor.ai, "message_match");
    const s = await db.subject.findFirstOrThrow({ where: { id: subject.id } });
    expect(s.waitingForReply).toBe(true);
    expect(s.resolutionSuggestedAt).toBeNull();
  });
});
