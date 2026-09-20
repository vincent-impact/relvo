import { describe, expect, it } from "vitest";
import {
  EVENT_TYPES,
  MAX_SUGGESTIONS,
  createSubject,
  getBriefNews,
  getBriefSuggestions,
  getSubjectsAwaitingUser,
  logEvent,
  prisma,
  tenantDb,
  visitHome,
} from "../src/index";

// Le brief de l'accueil est un CALCUL (01 §11, invariant 34) : ce test tient
// les règles écrites dans `domain/brief.ts` — le comptage borné par le dernier
// passage, l'ordre et le plafond des suggestions, la sélection des sujets qui
// attendent l'utilisateur, et la fenêtre de visite qui n'avance pas à chaque
// rechargement.

async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  return { account, db: tenantDb(account.id) };
}

describe("dernières nouvelles", () => {
  it("compte dans le journal depuis le dernier passage, et rien avant", async () => {
    const { db } = await makeAccount("brief-nouvelles@test.fr");
    const subject = await createSubject(db, { title: "Sauce blanche" });
    const before = new Date("2026-09-19T20:00:00Z");
    const since = new Date("2026-09-20T06:00:00Z");

    const write = async (eventType: string, actor: "ai" | "user", at: Date) => {
      const e = await logEvent(db, {
        entityType: "subject",
        subjectId: subject.id,
        eventType,
        title: eventType,
        actor,
      });
      await db.eventLog.update({
        where: { id: e.id },
        data: { createdAt: at },
      });
    };

    await write(EVENT_TYPES.messageIncomingReceived, "ai", before); // hors fenêtre
    await write(
      EVENT_TYPES.messageIncomingReceived,
      "ai",
      new Date("2026-09-20T07:00:00Z"),
    );
    await write(
      EVENT_TYPES.messageIncomingReceived,
      "ai",
      new Date("2026-09-20T07:30:00Z"),
    );
    await write(
      EVENT_TYPES.subjectCreated,
      "ai",
      new Date("2026-09-20T07:31:00Z"),
    );
    await write(
      EVENT_TYPES.subjectCreated,
      "user",
      new Date("2026-09-20T07:32:00Z"),
    ); // pas Relvo
    await write(
      EVENT_TYPES.actionDraftPrepared,
      "ai",
      new Date("2026-09-20T07:40:00Z"),
    );

    const news = await getBriefNews(db, since);
    expect(news).toMatchObject({
      messagesRead: 2,
      subjectsOpened: 1,
      draftsPrepared: 1,
      tasksProposed: 0,
    });

    // Jamais passé : tout le journal compte.
    const all = await getBriefNews(db, null);
    expect(all.messagesRead).toBe(3);
  });
});

describe("suggestions par règles", () => {
  it("met la question de Relvo en premier et plafonne à deux", async () => {
    const { db } = await makeAccount("brief-suggestions@test.fr");
    const now = new Date("2026-09-20T10:00:00Z");
    const subject = await createSubject(db, { title: "Devis friteuse" });

    // Une tâche en retard, un sujet qui attend depuis dix jours, une question.
    await db.task.create({
      data: {
        subjectId: subject.id,
        title: "Relancer",
        sourceActor: "ai",
        startDate: new Date("2026-09-10T00:00:00Z"),
      },
    });
    await db.subject.update({
      where: { id: subject.id },
      data: {
        waitingForReply: true,
        lastActivityAt: new Date("2026-09-08T00:00:00Z"),
      },
    });
    await db.relvoQuestion.create({
      data: {
        scope: "subject",
        subjectId: subject.id,
        text: "Le devis de friteuse, je le range où ?",
      },
    });

    const suggestions = await getBriefSuggestions(db, now);
    expect(suggestions).toHaveLength(MAX_SUGGESTIONS);
    expect(suggestions[0]).toMatchObject({
      kind: "question",
      text: "Le devis de friteuse, je le range où ?",
    });
    expect(suggestions[1]!.text).toMatch(/attend une réponse/);
  });

  it("ne suggère rien quand rien ne le réclame", async () => {
    const { db } = await makeAccount("brief-rien@test.fr");
    expect(await getBriefSuggestions(db)).toEqual([]);
  });
});

describe("en attente de vous", () => {
  it("retient un sujet par tâche de réponse ou de décision, les urgents d'abord", async () => {
    const { db } = await makeAccount("brief-attente@test.fr");
    const calme = await createSubject(db, { title: "Bail de Sète" });
    const urgent = await createSubject(db, { title: "Sauce blanche" });
    const sansAttente = await createSubject(db, { title: "Menu d'hiver" });
    await db.subject.update({
      where: { id: urgent.id },
      data: { priority: "urgent" },
    });
    await db.task.createMany({
      data: [
        {
          accountId: urgent.accountId,
          subjectId: urgent.id,
          title: "Répondre à Karim",
          sourceActor: "ai",
          kind: "reply",
        },
        {
          accountId: calme.accountId,
          subjectId: calme.id,
          title: "Signer ou non",
          sourceActor: "ai",
          kind: "decision",
          startDate: new Date("2026-09-25T00:00:00Z"),
        },
        {
          accountId: calme.accountId,
          subjectId: calme.id,
          title: "Deuxième décision",
          sourceActor: "ai",
          kind: "decision",
        },
        {
          accountId: sansAttente.accountId,
          subjectId: sansAttente.id,
          title: "Vérifier les prix",
          sourceActor: "ai",
          kind: "check",
        },
      ],
    });

    const rows = await getSubjectsAwaitingUser(db);
    expect(rows.map((r) => r.title)).toEqual(["Sauce blanche", "Bail de Sète"]);
    expect(rows[0]).toMatchObject({ awaiting: "reply", urgent: true });
    expect(rows[1]).toMatchObject({ awaiting: "decision", urgent: false });
    expect(rows[1]!.dueDate?.toISOString().slice(0, 10)).toBe("2026-09-25");
  });
});

describe("passage sur l'accueil", () => {
  it("n'avance la borne qu'après une vraie absence", async () => {
    const { account, db } = await makeAccount("brief-visite@test.fr");
    const t0 = new Date("2026-09-20T08:00:00Z");
    const first = await visitHome(db, account.id, t0);
    expect(first).toEqual({ since: null, advanced: true });

    // Rechargement cinq minutes plus tard : la borne reste celle de 8 h.
    const reload = await visitHome(
      db,
      account.id,
      new Date("2026-09-20T08:05:00Z"),
    );
    expect(reload).toEqual({ since: t0, advanced: false });

    // Retour deux heures plus tard : les nouvelles se comptent depuis 8 h, puis la borne avance.
    const later = new Date("2026-09-20T10:00:00Z");
    const back = await visitHome(db, account.id, later);
    expect(back).toEqual({ since: t0, advanced: true });
    const stored = await prisma.account.findUnique({
      where: { id: account.id },
    });
    expect(stored?.homeSeenAt).toEqual(later);
  });
});
