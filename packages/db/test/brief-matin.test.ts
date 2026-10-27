import { describe, expect, it } from "vitest";
import {
  askQuestion,
  createSubject,
  createTask,
  getMorningCounters,
  prisma,
  tenantDb,
  updateSubjectPriority,
} from "../src/index";

// LES COMPTEURS DU MATIN (M12.7) : un calcul, les mêmes règles que l'accueil
// — un sujet qui attend compte une fois, la décision l'emporte sur la réponse ;
// les tâches du jour et en retard se lisent en heure de Paris ; une question
// ouverte compte, une question répondue non.

async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Mam's", lastName: "Crousty" },
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

describe("getMorningCounters", () => {
  it("compte ce que le matin dit, et rien d'autre", async () => {
    const { account, db } = await makeAccount("matin@test.fr");
    // Le 19 octobre 2026 à 8 h, heure de Paris (6 h UTC).
    const now = new Date("2026-10-19T06:00:00.000Z");

    const sauce = await createSubject(db, { title: "Rupture sauce blanche" });
    const huile = await createSubject(db, { title: "Achat groupé huile" });
    const devis = await createSubject(db, { title: "Devis climatisation" });
    await updateSubjectPriority(db, sauce.id, "urgent");

    // Sauce : une réponse ET une décision → compte UNE fois, en décision.
    await createTask(db, {
      subjectId: sauce.id,
      title: "Répondre à Karim",
      kind: "reply",
      sourceActor: "user",
    });
    await createTask(db, {
      subjectId: sauce.id,
      title: "Valider la SB-210",
      kind: "decision",
      sourceActor: "user",
    });
    // Huile : une réponse.
    await createTask(db, {
      subjectId: huile.id,
      title: "Répondre à Rachid",
      kind: "reply",
      sourceActor: "user",
    });
    // Devis : une réponse, mais la tâche est cochée → n'attend plus.
    const faite = await createTask(db, {
      subjectId: devis.id,
      title: "Répondre à ClimaPro",
      kind: "reply",
      sourceActor: "user",
    });
    await db.task.updateMany({
      where: { id: faite.id },
      data: { status: "done" },
    });

    // Aujourd'hui (date nue du 19) : un rendez-vous et une tâche datée ; hier : en retard ; demain : rien.
    await createTask(db, {
      subjectId: sauce.id,
      title: "Technicien",
      kind: "other",
      sourceActor: "user",
      startDate: new Date("2026-10-19T00:00:00.000Z"),
      startTime: new Date("2026-10-19T08:00:00.000Z"),
    });
    await createTask(db, {
      subjectId: huile.id,
      title: "Compter le stock",
      kind: "check",
      sourceActor: "user",
      startDate: new Date("2026-10-19T00:00:00.000Z"),
    });
    await createTask(db, {
      subjectId: huile.id,
      title: "Relancer PackPlus",
      kind: "follow_up",
      sourceActor: "user",
      startDate: new Date("2026-10-18T00:00:00.000Z"),
    });
    await createTask(db, {
      subjectId: huile.id,
      title: "Plus tard",
      kind: "other",
      sourceActor: "user",
      startDate: new Date("2026-10-20T00:00:00.000Z"),
    });

    await askQuestion(db, {
      scope: "subject",
      subjectId: sauce.id,
      text: "Le devis, même sujet ?",
    });

    expect(await getMorningCounters(db, now)).toEqual({
      awaitingReplies: 1,
      awaitingDecisions: 1,
      urgentSubjects: 1,
      tasksToday: 2,
      overdueTasks: 1,
      openQuestions: 1,
    });
  });

  it("un compte vide compte zéro partout", async () => {
    const { db } = await makeAccount("matin-vide@test.fr");
    const c = await getMorningCounters(
      db,
      new Date("2026-10-19T06:00:00.000Z"),
    );
    expect(Object.values(c).every((v) => v === 0)).toBe(true);
  });
});
