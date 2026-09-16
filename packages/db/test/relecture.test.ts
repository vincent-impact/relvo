import { describe, expect, it } from "vitest";
import {
  Actor,
  ChannelType,
  EVENT_TYPES,
  applyRelecture,
  applyStructuration,
  applyTriageMatter,
  createSubject,
  createTask,
  getRelectureProjection,
  hasAiSolicitationForMessage,
  ingestInboundEmail,
  logAiSolicitation,
  logRelectureFailure,
  prisma,
  readTaskMetadata,
  suggestResolution,
  tenantDb,
  validateSubject,
} from "../src/index";

// M7 tranche 6 — ce que la RELECTURE lit et écrit en base. Le pipeline
// (contexte, appel, retenue) vit dans l'application et se teste sans base ;
// ici on verrouille : la projection sépare la fiche (messages ANTÉRIEURS) du
// message qui déclenche, et sait qu'il a rouvert le sujet ; l'écriture
// passe par les primitives, ajoute sans écraser, recalibre la priorité par
// la méthode journalisée, pose « En attente », suggère ou retire la clôture,
// refuse un sujet qui n'est pas ouvert, et journalise la proposition.

async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Mam's", lastName: "Crousty", sectors: ["food"] },
  });
  const db = tenantDb(account.id);
  await db.folder.create({
    data: { name: "Général", slug: "general", isDefault: true },
  });
  const fournisseurs = await db.folder.create({
    data: { name: "Fournisseurs", slug: "fournisseurs" },
  });
  const channel = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "Boîte email",
      type: ChannelType.email,
      identifier: email,
    },
  });
  return { account, db, fournisseurs, channel };
}

function mail(
  db: ReturnType<typeof tenantDb>,
  channelId: string,
  externalId: string,
  overrides: Partial<Parameters<typeof ingestInboundEmail>[1]> = {},
) {
  return ingestInboundEmail(db, {
    channelId,
    externalId,
    senderRaw: "karim@sogood.fr",
    senderName: "Karim Benali",
    subjectLine: "Rupture sauce blanche",
    content:
      "Bonjour, la sauce blanche est en rupture, on remplace par SB-210 ? Retour avant jeudi.",
    receivedAt: new Date("2026-09-10T08:00:00Z"),
    ...overrides,
  });
}

/** Un sujet ouvert et structuré par Relvo sur un fil e-mail, puis un second message qui arrive dessus. */
async function sujetSuivi(db: ReturnType<typeof tenantDb>, channelId: string) {
  const { message: premier } = await mail(db, channelId, "e-1");
  const applied = await applyTriageMatter(db, {
    conversationId: premier.conversationId,
    messageId: premier.id,
    title: "Rupture sauce blanche — remplacement proposé",
    folderName: "Fournisseurs",
    proposedFolder: null,
  });
  await applyStructuration(db, {
    subjectId: applied.subjectId,
    messageId: premier.id,
    situation: {
      where: "Le fournisseur propose la SB-210.",
      nextStep: "Accepter ou refuser.",
      waitingFor: "Réponse du dirigeant.",
      deadline: "2026-09-11",
    },
    summary: "Rupture annoncée, remplacement proposé.",
    tasks: [
      {
        title: "Valider le remplacement par la SB-210",
        kind: "decision",
        startDate: "2026-09-11",
        startTime: null,
        endDate: null,
        endTime: null,
        reason: "Retour demandé avant jeudi.",
        provenance: null,
      },
    ],
    contact: null,
    labels: [],
    proposedFolder: null,
    proposal: null,
  });
  return {
    premier,
    subjectId: applied.subjectId,
    reference: applied.reference,
  };
}

describe("projection de la relecture", () => {
  it("borne la fiche aux messages ANTÉRIEURS au message relu, pousse celui-ci à part, et sait s'il a rouvert le sujet", async () => {
    const { db, channel } = await makeAccount("a@test.fr");
    const { premier, subjectId } = await sujetSuivi(db, channel.id);
    const { message: deuxieme } = await mail(db, channel.id, "e-2", {
      content: "On attend votre retour pour la SB-210.",
      receivedAt: new Date("2026-09-10T09:00:00Z"),
    });
    const { message: troisieme } = await mail(db, channel.id, "e-3", {
      content: "C'est bon, on vous livre la SB-210 jeudi. Merci !",
      receivedAt: new Date("2026-09-10T10:00:00Z"),
    });
    expect(deuxieme.subjectId).toBe(subjectId);
    expect(troisieme.subjectId).toBe(subjectId);

    const p = await getRelectureProjection(db, {
      subjectId,
      messageId: troisieme.id,
    });
    expect(p.sujet.statut).toBe("ouvert");
    expect(p.sujet.situation.ouOnEnEst).toBe(
      "Le fournisseur propose la SB-210.",
    );
    expect(p.sujet.taches.map((t) => t.titre)).toEqual([
      "Valider le remplacement par la SB-210",
    ]);
    expect(p.sujet.resolutionSuggeree).toBe(false);
    expect(p.sujet.messages.map((m) => m.contenu)).toEqual([
      expect.stringContaining("on remplace par SB-210"),
      "On attend votre retour pour la SB-210.",
    ]);
    expect(p.nouveauxMessages).toHaveLength(1);
    expect(p.nouveauxMessages[0]).toMatchObject({
      expediteur: "Karim Benali <karim@sogood.fr>",
      contenu: "C'est bon, on vous livre la SB-210 jeudi. Merci !",
      sens: "entrant",
    });
    expect(p.rouvert).toBe(false);
    expect(p.precedents).toEqual([]);

    // Le premier message n'est pas « nouveau » pour la relecture du troisième.
    expect(
      p.sujet.messages.some(
        (m) => m.recuLe === premier.receivedAt?.toISOString(),
      ),
    ).toBe(true);
  });

  it("constate la réouverture mécanique d'un sujet validé par le message qui arrive", async () => {
    const { db, channel } = await makeAccount("b@test.fr");
    const { subjectId } = await sujetSuivi(db, channel.id);
    await validateSubject(db, subjectId);
    const { message } = await mail(db, channel.id, "e-2", {
      content: "Finalement la SB-210 est aussi en rupture, on fait quoi ?",
      receivedAt: new Date("2026-09-12T08:00:00Z"),
    });
    expect(message.subjectId).toBe(subjectId);
    const s = await db.subject.findFirstOrThrow({ where: { id: subjectId } });
    expect(s.status).toBe("open");

    const p = await getRelectureProjection(db, {
      subjectId,
      messageId: message.id,
    });
    expect(p.rouvert).toBe(true);
    expect(p.sujet.statut).toBe("ouvert");
  });

  it("refuse un message qui n'appartient pas au sujet", async () => {
    const { db, channel } = await makeAccount("c@test.fr");
    const { subjectId } = await sujetSuivi(db, channel.id);
    const { message } = await mail(db, channel.id, "e-x", {
      senderRaw: "autre@exemple.fr",
      subjectLine: "Autre chose",
    });
    expect(message.subjectId).toBeNull();
    await expect(
      getRelectureProjection(db, { subjectId, messageId: message.id }),
    ).rejects.toThrow(/n'appartient pas/);
  });
});

describe("écriture de la relecture", () => {
  it("réécrit la situation et le résumé, ajoute les tâches et les étiquettes sans rien écraser, recalibre la priorité, pose « En attente », journalise la proposition", async () => {
    const { db, channel } = await makeAccount("d@test.fr");
    await db.label.createMany({
      data: [
        {
          key: "retard-livraison",
          label: "Retard",
          origin: "sector",
          status: "active",
        },
        {
          key: "contrat",
          label: "Contrat",
          origin: "sector",
          status: "active",
        },
      ],
    });
    const { subjectId } = await sujetSuivi(db, channel.id);
    await db.subject.updateMany({
      where: { id: subjectId },
      data: { labels: ["contrat"] },
    });
    const { message } = await mail(db, channel.id, "e-2", {
      content: "URGENT : la SB-210 part demain matin, livraison jeudi 8 h.",
    });

    const proposal = { sortie: { termine: false }, ecarts: [] };
    const r = await applyRelecture(db, {
      subjectId,
      messageId: message.id,
      situation: {
        where: "La SB-210 part demain, livraison jeudi.",
        nextStep: "Réceptionner la livraison.",
        waitingFor: "Livraison SoGood jeudi 8 h.",
        deadline: "2026-09-17",
      },
      summary: "Rupture de sauce blanche, remplacée par la SB-210.",
      tasks: [
        {
          title: "Réceptionner la SB-210",
          kind: "check",
          startDate: "2026-09-17",
          startTime: "08:00",
          endDate: null,
          endTime: null,
          reason: "Le fournisseur annonce la livraison jeudi 8 h.",
          provenance: null,
        },
      ],
      labels: ["retard-livraison", "inconnue"],
      priority: "urgent",
      waitingForReply: true,
      resolution: "keep",
      reason: "Le fournisseur confirme la livraison.",
      proposal,
    });
    expect(r).toEqual({
      taskIds: [expect.any(String)],
      labels: ["contrat", "retard-livraison"],
      priorityChanged: true,
      waitingForReplySet: true,
      resolution: "kept",
    });

    const s = await db.subject.findFirstOrThrow({ where: { id: subjectId } });
    expect(s.situationWhere).toBe("La SB-210 part demain, livraison jeudi.");
    expect(s.situationWaitingFor).toBe("Livraison SoGood jeudi 8 h.");
    expect(s.situationDeadline?.toISOString().slice(0, 10)).toBe("2026-09-17");
    expect(s.summary).toBe(
      "Rupture de sauce blanche, remplacée par la SB-210.",
    );
    expect(s.labels).toEqual(["contrat", "retard-livraison"]);
    expect(s.priority).toBe("urgent");
    expect(s.waitingForReply).toBe(true);
    expect(s.resolutionSuggestedAt).toBeNull();

    // L'ancienne tâche est toujours là ; la nouvelle porte sa raison et le message.
    const tasks = await db.task.findMany({
      where: { subjectId },
      orderBy: { title: "asc" },
    });
    expect(tasks.map((t) => t.title)).toEqual([
      "Réceptionner la SB-210",
      "Valider le remplacement par la SB-210",
    ]);
    expect(tasks[0]!.messageId).toBe(message.id);
    expect(tasks[0]!.sourceActor).toBe(Actor.ai);
    expect(readTaskMetadata(tasks[0]!.metadata)?.raison).toBe(
      "Le fournisseur annonce la livraison jeudi 8 h.",
    );

    // Le journal : priorité par la méthode journalisée, l'attente posée par
    // Relvo, et l'entrée de relecture avec la proposition intégrale.
    const events = await db.eventLog.findMany({
      where: { subjectId },
      orderBy: { createdAt: "asc" },
    });
    const types = events.map((e) => e.eventType);
    expect(types).toContain(EVENT_TYPES.subjectPriorityChanged);
    expect(types).toContain(EVENT_TYPES.waitingForReplySet);
    expect(types).toContain(EVENT_TYPES.taskCreatedByAi);
    const relu = events.find(
      (e) => e.eventType === EVENT_TYPES.subjectReviewed,
    )!;
    expect(relu.actor).toBe(Actor.ai);
    expect(relu.messageId).toBe(message.id);
    expect(relu.title).toBe("Relvo a relu le sujet : 1 tâche en plus");
    expect(relu.description).toBe("Le fournisseur confirme la livraison.");
    expect(relu.metadata).toMatchObject({
      proposal,
      taskIds: r.taskIds,
      priorityChanged: true,
      waitingForReplySet: true,
      resolution: "kept",
    });
    const prio = events.find(
      (e) => e.eventType === EVENT_TYPES.subjectPriorityChanged,
    )!;
    expect(prio.actor).toBe(Actor.ai);
    expect(prio.metadata).toMatchObject({ from: "normal", to: "urgent" });
  });

  it("suggère la clôture, puis la retire quand la situation évolue ; ne touche ni la priorité ni l'attente quand on ne lui dit rien", async () => {
    const { db, channel } = await makeAccount("e@test.fr");
    const { subjectId } = await sujetSuivi(db, channel.id);
    await db.subject.updateMany({
      where: { id: subjectId },
      data: { waitingForReply: true },
    });
    const { message: m1 } = await mail(db, channel.id, "e-2", {
      content: "Reçu, merci, tout est réglé.",
    });
    const base = {
      subjectId,
      situation: {
        where: "Réglé.",
        nextStep: null,
        waitingFor: null,
        deadline: null,
      },
      summary: null,
      tasks: [],
      labels: [],
      priority: null,
      waitingForReply: null,
      reason: null,
      proposal: null,
    } as const;

    const r1 = await applyRelecture(db, {
      ...base,
      messageId: m1.id,
      resolution: "suggest",
      reason: "Le fournisseur confirme que tout est réglé.",
    });
    expect(r1).toMatchObject({
      resolution: "suggested",
      priorityChanged: false,
      waitingForReplySet: false,
    });
    let s = await db.subject.findFirstOrThrow({ where: { id: subjectId } });
    expect(s.resolutionSuggestedAt).not.toBeNull();
    expect(s.priority).toBe("normal");
    // L'entrant a levé l'attente mécaniquement ; la relecture ne l'a pas reposée.
    expect(s.waitingForReply).toBe(false);
    // Le résumé d'avant survit à un résumé nul.
    expect(s.summary).toBe("Rupture annoncée, remplacement proposé.");

    const { message: m2 } = await mail(db, channel.id, "e-3", {
      content: "En fait il manque deux cartons.",
    });
    const r2 = await applyRelecture(db, {
      ...base,
      messageId: m2.id,
      resolution: "revoke",
      reason: "Il manque deux cartons.",
    });
    expect(r2.resolution).toBe("revoked");
    s = await db.subject.findFirstOrThrow({ where: { id: subjectId } });
    expect(s.resolutionSuggestedAt).toBeNull();

    // Retirer sans suggestion en cours ne fait rien et ne journalise rien.
    const r3 = await applyRelecture(db, {
      ...base,
      messageId: m2.id,
      resolution: "revoke",
    });
    expect(r3.resolution).toBe("kept");

    const events = await db.eventLog.findMany({
      where: { subjectId },
      orderBy: { createdAt: "asc" },
    });
    expect(
      events.filter((e) => e.eventType === EVENT_TYPES.resolutionSuggested),
    ).toHaveLength(1);
    expect(
      events.filter((e) => e.eventType === EVENT_TYPES.resolutionRevoked),
    ).toHaveLength(1);
    expect(
      events.filter((e) => e.eventType === EVENT_TYPES.subjectReviewed),
    ).toHaveLength(3);
  });

  it("refuse un sujet qui n'est pas ouvert", async () => {
    const { db, fournisseurs } = await makeAccount("f@test.fr");
    const valide = await createSubject(db, {
      title: "Bail",
      folderId: fournisseurs.id,
      status: "validated",
    });
    await expect(
      applyRelecture(db, {
        subjectId: valide.id,
        situation: {
          where: null,
          nextStep: null,
          waitingFor: null,
          deadline: null,
        },
        summary: null,
        tasks: [],
        labels: [],
        priority: null,
        waitingForReply: null,
        resolution: "keep",
        reason: null,
        proposal: null,
      }),
    ).rejects.toThrow(/sujet ouvert/);
  });

  it("une relecture par message : l'idempotence se lit dans le journal des sollicitations, et l'échec se journalise sans rien écrire", async () => {
    const { db, channel } = await makeAccount("g@test.fr");
    const { subjectId } = await sujetSuivi(db, channel.id);
    const { message } = await mail(db, channel.id, "e-2");
    expect(await hasAiSolicitationForMessage(db, message.id, "relecture")).toBe(
      false,
    );
    await logAiSolicitation(db, {
      sollicitation: "relecture",
      tier: "extraction",
      modele: "gpt-test",
      niveau: "low",
      jetons: {
        entree: 10,
        cacheLecture: 0,
        cacheEcriture: 0,
        sortie: 5,
        raisonnement: 0,
      },
      cout: { eur: 0.00001, usd: 0.00001, version: "test" },
      dureeMs: 12,
      subjectId,
      messageId: message.id,
    });
    expect(await hasAiSolicitationForMessage(db, message.id, "relecture")).toBe(
      true,
    );
    expect(await hasAiSolicitationForMessage(db, message.id, "tri")).toBe(
      false,
    );

    await logRelectureFailure(db, {
      subjectId,
      messageId: message.id,
      error: "boom",
    });
    const echec = await db.eventLog.findFirstOrThrow({
      where: { eventType: EVENT_TYPES.relectureFailed },
    });
    expect(echec.subjectId).toBe(subjectId);
    expect(echec.messageId).toBe(message.id);
    expect(echec.actor).toBe(Actor.system);
    const s = await db.subject.findFirstOrThrow({ where: { id: subjectId } });
    expect(s.situationWhere).toBe("Le fournisseur propose la SB-210.");
    const taches = await createTask(db, { subjectId, title: "x" }).then(() =>
      db.task.count({ where: { subjectId } }),
    );
    expect(taches).toBe(2);
  });
});
