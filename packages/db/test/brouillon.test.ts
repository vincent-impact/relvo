import { describe, expect, it } from "vitest";
import {
  Actor,
  ChannelType,
  EVENT_TYPES,
  applyTriageMatter,
  createDraftReply,
  createTask,
  getDraftProjection,
  ingestInboundEmail,
  logTriageFailure,
  prisma,
  readDraftSources,
  resolveReplyTargets,
  sendEmailReply,
  tenantDb,
} from "../src/index";

// M7 tranche 7 — le BROUILLON et la CORRESPONDANCE À L'ENVOI. Ce que le
// brouillon lit (la fiche, la tâche, le fil cible, un brouillon déjà ouvert),
// et ce qu'un envoi fait aux tâches SANS appel : les tâches de réponse et la
// tâche du brouillon cochées par correspondance, le brouillon exécuté,
// l'attente posée ; un entrant lève l'attente.

let envois = 0;
const FAKE_EMAIL_SENDER = {
  sendEmail: async () => ({ emailId: `out-${++envois}` }),
};

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

async function sujetAvecTaches(
  db: ReturnType<typeof tenantDb>,
  channelId: string,
) {
  const { message } = await ingestInboundEmail(db, {
    channelId,
    externalId: `e-${Math.random()}`,
    senderRaw: "laurent@froid.fr",
    senderName: "Laurent Mercier",
    subjectLine: "Devis chambre froide",
    content:
      "Deux options : 8 ou 12 m³. Pouvez-vous confirmer avant vendredi ?",
    receivedAt: new Date("2026-09-15T13:00:00Z"),
  });
  const applied = await applyTriageMatter(db, {
    conversationId: message.conversationId,
    messageId: message.id,
    title: "Remplacement de la chambre froide",
  });
  const repondre = await createTask(db, {
    subjectId: applied.subjectId,
    messageId: message.id,
    title: "Confirmer le rendez-vous",
    sourceActor: Actor.ai,
    kind: "reply",
    metadata: { raison: "Le fournisseur le demande.", provenance: null },
  });
  const decider = await createTask(db, {
    subjectId: applied.subjectId,
    messageId: null,
    title: "Choisir le volume",
    sourceActor: Actor.ai,
    kind: "decision",
  });
  const verifier = await createTask(db, {
    subjectId: applied.subjectId,
    title: "Vérifier la place en réserve",
    sourceActor: Actor.user,
    kind: "check",
  });
  return { message, subjectId: applied.subjectId, repondre, decider, verifier };
}

describe("où une tâche se répond", () => {
  it("résout le fil du message d'origine, sinon le fil écouté ; jamais pour une vérification ni une tâche cochée", async () => {
    const { db, channel } = await makeAccount("a@test.fr");
    const { message, repondre, decider, verifier } = await sujetAvecTaches(
      db,
      channel.id,
    );
    const targets = await resolveReplyTargets(db, [
      repondre,
      decider,
      verifier,
    ]);
    expect(targets.get(repondre.id)).toBe(message.conversationId);
    // Sans message d'origine : le fil que le sujet écoute.
    expect(targets.get(decider.id)).toBe(message.conversationId);
    expect(targets.has(verifier.id)).toBe(false);

    await db.task.updateMany({
      where: { id: repondre.id },
      data: { status: "done" },
    });
    const apres = await resolveReplyTargets(db, [
      { ...repondre, status: "done" },
    ]);
    expect(apres.size).toBe(0);
  });
});

describe("projection du brouillon", () => {
  it("charge la fiche, la tâche, le fil cible et le brouillon déjà ouvert", async () => {
    const { db, channel } = await makeAccount("b@test.fr");
    const { message, subjectId, repondre, verifier } = await sujetAvecTaches(
      db,
      channel.id,
    );
    const p = await getDraftProjection(db, repondre.id);
    expect(p.sujet.id).toBe(subjectId);
    expect(p.sujet.titre).toBe("Remplacement de la chambre froide");
    expect(p.tache).toMatchObject({
      id: repondre.id,
      titre: "Confirmer le rendez-vous",
      type: "reply",
      source: "relvo",
    });
    expect(p.cible).toEqual({
      conversationId: message.conversationId,
      canal: "email",
      channelId: channel.id,
      destinataires: ["laurent@froid.fr"],
    });
    expect(p.contact?.nom).toBe("Laurent Mercier");
    expect(p.sujet.messages).toHaveLength(1);
    expect(p.brouillonOuvert).toBeNull();

    const draft = await createDraftReply(db, {
      subjectId,
      taskId: repondre.id,
      to: "laurent@froid.fr",
      channel: "email",
      content: "Bonjour Laurent, le créneau me convient.",
      conversationId: message.conversationId,
    });
    const p2 = await getDraftProjection(db, repondre.id);
    expect(p2.brouillonOuvert).toEqual({
      id: draft.id,
      contenu: "Bonjour Laurent, le créneau me convient.",
      sources: [],
    });

    await expect(getDraftProjection(db, verifier.id)).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });
});

describe("correspondance à l'envoi", () => {
  it("un envoi coche la tâche du brouillon et les tâches de réponse, exécute le brouillon, pose l'attente ; un entrant la lève", async () => {
    const { db, channel } = await makeAccount("c@test.fr");
    const { message, subjectId, repondre, decider, verifier } =
      await sujetAvecTaches(db, channel.id);
    const draft = await createDraftReply(db, {
      subjectId,
      taskId: decider.id,
      to: "laurent@froid.fr",
      channel: "email",
      content: "Nous partons sur le 12 m³.",
      conversationId: message.conversationId,
    });

    const out = await sendEmailReply(db, FAKE_EMAIL_SENDER, {
      subjectId,
      channelId: channel.id,
      to: [{ identifier: "laurent@froid.fr" }],
      subject: "Re: Devis chambre froide",
      body: "Nous partons sur le 12 m³, et le créneau me convient.",
    });
    expect(out.conversationId).toBe(message.conversationId);

    const tasks = await db.task.findMany({
      where: { subjectId },
      orderBy: { title: "asc" },
    });
    const byId = new Map(tasks.map((t) => [t.id, t]));
    // La tâche du brouillon (décision) et la tâche de réponse : cochées par
    // correspondance, par le système ; la vérification reste ouverte.
    expect(byId.get(decider.id)).toMatchObject({
      status: "done",
      completionMode: "message_match",
      completedByActor: Actor.system,
    });
    expect(byId.get(repondre.id)).toMatchObject({
      status: "done",
      completionMode: "message_match",
    });
    expect(byId.get(verifier.id)).toMatchObject({ status: "open" });

    const action = await db.action.findFirstOrThrow({
      where: { id: draft.id },
    });
    expect(action.status).toBe("done");
    expect(action.messageId).toBe(out.id);
    expect(action.executedByActor).toBe(Actor.user);

    // Une tâche reste ouverte : pas d'attente.
    let s = await db.subject.findFirstOrThrow({ where: { id: subjectId } });
    expect(s.waitingForReply).toBe(false);

    const events = await db.eventLog.findMany({
      where: { subjectId, eventType: EVENT_TYPES.taskCompleted },
    });
    expect(events.map((e) => e.title).sort()).toEqual([
      "Tâche réglée par votre message : Choisir le volume",
      "Tâche réglée par votre message : Confirmer le rendez-vous",
    ]);
    expect(
      await db.eventLog.count({
        where: { subjectId, eventType: EVENT_TYPES.actionSendMessageDone },
      }),
    ).toBe(1);

    // Plus aucune tâche ouverte → le second envoi pose l'attente.
    await db.task.updateMany({
      where: { id: verifier.id },
      data: { status: "done" },
    });
    await sendEmailReply(db, FAKE_EMAIL_SENDER, {
      subjectId,
      channelId: channel.id,
      to: [{ identifier: "laurent@froid.fr" }],
      subject: "Re: Devis chambre froide",
      body: "Et merci pour la reprise de l'ancienne.",
    });
    s = await db.subject.findFirstOrThrow({ where: { id: subjectId } });
    expect(s.waitingForReply).toBe(true);

    // La réponse du fournisseur arrive dans le fil : l'attente est levée.
    await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "e-reponse",
      senderRaw: "laurent@froid.fr",
      senderName: "Laurent Mercier",
      subjectLine: "Re: Devis chambre froide",
      content: "Parfait, je vous confirme mardi 10h.",
      receivedAt: new Date("2026-09-16T08:00:00Z"),
    });
    s = await db.subject.findFirstOrThrow({ where: { id: subjectId } });
    expect(s.waitingForReply).toBe(false);
  });
});

describe("l'objet de la réponse", () => {
  it("vient du FIL de départ, pas du titre du sujet : la réponse reste dans la même conversation", async () => {
    const { db, channel } = await makeAccount("d@test.fr");
    // Le sujet s'intitule autrement que l'e-mail : « Remplacement de la chambre
    // froide » pour un objet « Devis chambre froide ».
    const { message, subjectId } = await sujetAvecTaches(db, channel.id);

    const out = await sendEmailReply(db, FAKE_EMAIL_SENDER, {
      subjectId,
      channelId: channel.id,
      conversationId: message.conversationId,
      to: [{ identifier: "laurent@froid.fr" }],
      body: "Nous partons sur le 12 m³.",
    });
    expect(out.subjectLine).toBe("Re: Devis chambre froide");
    expect(out.conversationId).toBe(message.conversationId);
    expect(await db.conversation.count()).toBe(1);

    // Sans fil ni objet : refusé avant tout envoi.
    await expect(
      sendEmailReply(db, FAKE_EMAIL_SENDER, {
        subjectId,
        channelId: channel.id,
        to: [{ identifier: "laurent@froid.fr" }],
        body: "…",
      }),
    ).rejects.toThrow();
  });
});

// LES CITATIONS DU BROUILLON (M7.12, tranche 8 — 05 §10.4) : les sources sur
// lesquelles Relvo s'est appuyé vivent dans le payload de l'Action, sont
// journalisées avec le brouillon, et reviennent avec le brouillon réutilisé.
describe("les sources du brouillon", () => {
  it("sont stockées dans le payload, journalisées, et relues par la projection", async () => {
    const { db, channel } = await makeAccount("sources@test.fr");
    const { message, subjectId, repondre } = await sujetAvecTaches(
      db,
      channel.id,
    );
    const sources = [
      {
        type: "instruction" as const,
        reference: null,
        libelle: "Procédure fournisseurs v3",
      },
      {
        type: "precedent" as const,
        reference: "SUB-0042",
        libelle: "Ouverture magasin Béziers",
      },
    ];
    const action = await createDraftReply(db, {
      subjectId,
      taskId: repondre.id,
      to: "laurent@froid.fr",
      channel: "email",
      content: "Bonjour, nous confirmons le rendez-vous.",
      conversationId: message.conversationId,
      sources,
    });
    expect(readDraftSources(action.payload)).toEqual(sources);

    const journal = await db.eventLog.findFirst({
      where: {
        actionId: action.id,
        eventType: EVENT_TYPES.actionDraftPrepared,
      },
    });
    expect(journal?.description).toBe(
      "D'après Procédure fournisseurs v3, Ouverture magasin Béziers",
    );
    expect((journal?.metadata as { sources: unknown }).sources).toEqual(
      sources,
    );

    const p = await getDraftProjection(db, repondre.id);
    expect(p.brouillonOuvert?.id).toBe(action.id);
    expect(p.brouillonOuvert?.sources).toEqual(sources);
  });

  it("un brouillon sans source — ou d'avant la tranche 8 — en a zéro, jamais une erreur", async () => {
    const { db, channel } = await makeAccount("sans-sources@test.fr");
    const { message, subjectId, repondre } = await sujetAvecTaches(
      db,
      channel.id,
    );
    const action = await createDraftReply(db, {
      subjectId,
      taskId: repondre.id,
      to: "laurent@froid.fr",
      content: "Bonjour.",
      conversationId: message.conversationId,
    });
    expect(readDraftSources(action.payload)).toEqual([]);
    expect(readDraftSources({ content: "ancien brouillon" })).toEqual([]);
    expect(readDraftSources(null)).toEqual([]);
    const p = await getDraftProjection(db, repondre.id);
    expect(p.brouillonOuvert?.sources).toEqual([]);
  });

  it("un échec prévu du pipeline dit son motif dans le journal (tranche 8)", async () => {
    const { db, channel } = await makeAccount("motif@test.fr");
    const { message } = await sujetAvecTaches(db, channel.id);
    await logTriageFailure(db, {
      conversationId: message.conversationId,
      messageId: message.id,
      error: "plafond atteint",
      cause: "plafond-sortie",
    });
    const echec = await db.eventLog.findFirst({
      where: { eventType: EVENT_TYPES.triageFailed, messageId: message.id },
    });
    expect((echec?.metadata as { cause: string }).cause).toBe("plafond-sortie");
  });
});
