import { describe, expect, it } from "vitest";
import {
  Actor,
  ChannelType,
  EVENT_TYPES,
  answerTaskDecision,
  applyTriageMatter,
  createTask,
  decisionsToutesRepondues,
  getDraftProjection,
  ingestInboundEmail,
  listDecisionTasksForConversation,
  prisma,
  readTaskDecisions,
  tenantDb,
} from "../src/index";

// Les DÉCISIONS d'un message (05 §3.1) : portées par la tâche qui se répond,
// listées pour le formulaire du fil, répondues par le dirigeant et
// journalisées, lues par le brouillon.

async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Mam's", lastName: "Crousty", sectors: ["food"] },
  });
  const db = tenantDb(account.id);
  await db.folder.create({
    data: { name: "Général", slug: "general", isDefault: true },
  });
  const channel = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "Boîte email",
      type: ChannelType.email,
      identifier: email,
    },
  });
  await prisma.channelConfig.create({
    data: {
      accountId: account.id,
      channelId: channel.id,
      provider: "unipile",
      status: "connected",
      externalAccountId: "acc-1",
    },
  });
  return { account, db, channel };
}

const DECISIONS = [
  {
    id: "d1",
    question: "Lancer le remplacement du thermostat ?",
    precision: "480 € HT, délai 3 jours",
    options: ["Oui, commandez", "Non"],
    reponse: null,
    repondueLe: null,
  },
  {
    id: "d2",
    question: "Créneau d'intervention",
    precision: null,
    options: ["Jeudi matin", "Vendredi"],
    reponse: null,
    repondueLe: null,
  },
];

async function sujetAvecDecision(
  db: ReturnType<typeof tenantDb>,
  channelId: string,
) {
  const { message } = await ingestInboundEmail(db, {
    channelId,
    externalId: `e-${Math.random()}`,
    senderRaw: "julien@froidservice.fr",
    senderName: "Julien Roca",
    subjectLine: "Intervention dépannage friteuse",
    content: "Le remplacement revient à 480 € HT. Souhaitez-vous qu'on lance ?",
    receivedAt: new Date("2026-09-16T09:00:00Z"),
  });
  const applied = await applyTriageMatter(db, {
    conversationId: message.conversationId,
    messageId: message.id,
    title: "Dépannage friteuse à Pérols",
  });
  const repondre = await createTask(db, {
    subjectId: applied.subjectId,
    messageId: message.id,
    title: "Valider le devis de remplacement",
    sourceActor: Actor.ai,
    kind: "reply",
    metadata: {
      raison: "Le dépanneur attend une décision.",
      provenance: null,
      decisions: DECISIONS,
    },
  });
  const sansDecision = await createTask(db, {
    subjectId: applied.subjectId,
    messageId: message.id,
    title: "Remercier pour le diagnostic",
    sourceActor: Actor.ai,
    kind: "reply",
    metadata: { raison: "Politesse.", provenance: null },
  });
  return { message, subjectId: applied.subjectId, repondre, sansDecision };
}

describe("les décisions d'une tâche", () => {
  it("se listent pour le fil où la tâche se répond, et seulement les tâches qui en portent", async () => {
    const { db, channel } = await makeAccount("d1@test.fr");
    const { message, repondre } = await sujetAvecDecision(db, channel.id);
    const listees = await listDecisionTasksForConversation(
      db,
      message.conversationId,
    );
    expect(listees.map((t) => t.id)).toEqual([repondre.id]);
    expect(listees[0].decisions.map((d) => d.question)).toEqual([
      "Lancer le remplacement du thermostat ?",
      "Créneau d'intervention",
    ]);
    expect(decisionsToutesRepondues(listees[0].decisions)).toBe(false);
    expect(
      await listDecisionTasksForConversation(
        db,
        "00000000-0000-0000-0000-000000000000",
      ),
    ).toEqual([]);
  });

  it("se répondent une à une, la réponse est journalisée, la dernière l'emporte, et le brouillon la lit", async () => {
    const { db, channel } = await makeAccount("d2@test.fr");
    const { repondre } = await sujetAvecDecision(db, channel.id);

    const apres = await answerTaskDecision(db, {
      taskId: repondre.id,
      decisionId: "d1",
      reponse: "Oui, commandez",
    });
    expect(apres.decisions[0].reponse).toBe("Oui, commandez");
    expect(apres.decisions[0].repondueLe).not.toBeNull();
    expect(apres.decisions[1].reponse).toBeNull();
    expect(decisionsToutesRepondues(apres.decisions)).toBe(false);

    // « Changer » : on répond à nouveau, et la réponse libre est admise.
    await answerTaskDecision(db, {
      taskId: repondre.id,
      decisionId: "d1",
      reponse: "Non",
    });
    const fin = await answerTaskDecision(db, {
      taskId: repondre.id,
      decisionId: "d2",
      reponse: "Lundi après 14 h",
    });
    expect(fin.decisions.map((d) => d.reponse)).toEqual([
      "Non",
      "Lundi après 14 h",
    ]);
    expect(decisionsToutesRepondues(fin.decisions)).toBe(true);

    const enBase = await db.task.findFirstOrThrow({
      where: { id: repondre.id },
      select: { metadata: true },
    });
    expect(readTaskDecisions(enBase.metadata).map((d) => d.reponse)).toEqual([
      "Non",
      "Lundi après 14 h",
    ]);

    const journal = await db.eventLog.findMany({
      where: {
        taskId: repondre.id,
        eventType: EVENT_TYPES.taskDecisionAnswered,
      },
      orderBy: { createdAt: "asc" },
    });
    expect(journal).toHaveLength(3);
    expect(journal[0].title).toBe(
      "Décision : Lancer le remplacement du thermostat ? → Oui, commandez",
    );
    expect(journal[0].actor).toBe("user");
    expect(journal[1].metadata).toMatchObject({
      decisionId: "d1",
      reponse: "Non",
      precedente: "Oui, commandez",
    });

    // Le brouillon voit les décisions et leurs réponses.
    const projection = await getDraftProjection(db, repondre.id);
    expect(projection.tache.decisions).toEqual([
      { question: "Lancer le remplacement du thermostat ?", reponse: "Non" },
      { question: "Créneau d'intervention", reponse: "Lundi après 14 h" },
    ]);
  });

  it("refuse une décision inconnue, et une tâche qui n'est plus ouverte", async () => {
    const { db, channel } = await makeAccount("d3@test.fr");
    const { repondre, sansDecision } = await sujetAvecDecision(db, channel.id);
    await expect(
      answerTaskDecision(db, {
        taskId: repondre.id,
        decisionId: "d9",
        reponse: "Oui",
      }),
    ).rejects.toThrow(/n'existe pas/);
    await expect(
      answerTaskDecision(db, {
        taskId: sansDecision.id,
        decisionId: "d1",
        reponse: "Oui",
      }),
    ).rejects.toThrow(/n'existe pas/);
    await db.task.updateMany({
      where: { id: repondre.id },
      data: { status: "done" },
    });
    await expect(
      answerTaskDecision(db, {
        taskId: repondre.id,
        decisionId: "d1",
        reponse: "Oui",
      }),
    ).rejects.toThrow(/plus ouverte/);
  });
});
