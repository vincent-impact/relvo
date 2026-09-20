import { describe, expect, it } from "vitest";
import {
  ChannelType,
  EVENT_TYPES,
  applyTriageMatter,
  countCatchupCandidates,
  finishCatchup,
  getLatestChannelCatchup,
  ingestInboundEmail,
  listCatchupCandidates,
  listDueCatchups,
  listKnownExternalIds,
  prisma,
  recordCatchupProgress,
  recordTriageVerdict,
  requestChannelCatchup,
  startCatchupRun,
  tenantDb,
} from "../src/index";

// M7 tranche 9 — le RATTRAPAGE du courrier récent. Ce que le domaine tient :
// une demande par canal e-mail, idempotente ; les candidats au tri sont les
// conversations orphelines de la fenêtre au dernier message entrant, pas
// encore triées ; l'avancement s'additionne ; la clôture journalise le bilan ;
// les rattrapages dus se découvrent hors tenant, sur les canaux connectés.

async function makeAccount(email: string, type: ChannelType = "email") {
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
      type,
      identifier: email,
    },
  });
  await prisma.channelConfig.create({
    data: {
      accountId: account.id,
      channelId: channel.id,
      provider: "unipile",
      status: "connected",
      externalAccountId: `acc-${email}`,
    },
  });
  return { account, db, channel };
}

const J = 86_400_000;
const since = new Date(Date.now() - 30 * J);

async function mail(
  db: ReturnType<typeof tenantDb>,
  channelId: string,
  args: { id: string; from: string; subject: string; il_y_a_jours: number },
) {
  return ingestInboundEmail(db, {
    channelId,
    externalId: args.id,
    senderRaw: args.from,
    subjectLine: args.subject,
    content: `Contenu de ${args.subject}`,
    receivedAt: new Date(Date.now() - args.il_y_a_jours * J),
  });
}

describe("la demande de rattrapage", () => {
  it("naît une fois par canal e-mail, se retrouve, et refuse une messagerie", async () => {
    const { db, channel } = await makeAccount("a@test.fr");
    const c1 = await requestChannelCatchup(db, {
      channelId: channel.id,
      since,
    });
    const c2 = await requestChannelCatchup(db, {
      channelId: channel.id,
      since,
    });
    expect(c2.id).toBe(c1.id);
    expect(c1.status).toBe("pending");
    expect((await getLatestChannelCatchup(db, channel.id))?.id).toBe(c1.id);
    const journal = await db.eventLog.findMany({
      where: { eventType: EVENT_TYPES.catchupRequested },
    });
    expect(journal).toHaveLength(1);

    const wa = await makeAccount("b@test.fr", "whatsapp");
    await expect(
      requestChannelCatchup(wa.db, { channelId: wa.channel.id, since }),
    ).rejects.toThrow(/e-mail/);
  });

  it("se découvre hors tenant, sur les canaux connectés seulement", async () => {
    const a = await makeAccount("c@test.fr");
    const b = await makeAccount("d@test.fr");
    await requestChannelCatchup(a.db, { channelId: a.channel.id, since });
    await requestChannelCatchup(b.db, { channelId: b.channel.id, since });
    await prisma.channelConfig.updateMany({
      where: { channelId: b.channel.id },
      data: { status: "error" },
    });
    const dus = await listDueCatchups();
    expect(dus.map((d) => d.channelId)).toEqual([a.channel.id]);
    expect(dus[0].accountId).toBe(a.account.id);
    expect(dus[0].channel.config?.externalAccountId).toBe("acc-c@test.fr");
  });
});

describe("les candidats au tri", () => {
  it("sont les conversations orphelines de la fenêtre, au dernier message entrant, pas encore triées — les plus anciennes d'abord", async () => {
    const { db, channel } = await makeAccount("e@test.fr");
    const recent = await mail(db, channel.id, {
      id: "m1",
      from: "k@sogood.fr",
      subject: "Rupture sauce",
      il_y_a_jours: 2,
    });
    const ancien = await mail(db, channel.id, {
      id: "m2",
      from: "l@froid.fr",
      subject: "Devis",
      il_y_a_jours: 10,
    });
    // Hors fenêtre : ignoré.
    await mail(db, channel.id, {
      id: "m3",
      from: "x@vieux.fr",
      subject: "Vieux",
      il_y_a_jours: 45,
    });
    // Déjà triée : ignorée.
    const triee = await mail(db, channel.id, {
      id: "m4",
      from: "y@triee.fr",
      subject: "Triée",
      il_y_a_jours: 3,
    });
    await recordTriageVerdict(db, {
      conversationId: triee.message.conversationId,
      messageId: triee.message.id,
      verdict: "noise",
      nature: "advertising",
      confidence: "high",
      reason: "pub",
      source: "deterministic",
      rule: "test",
    });
    // Rattachée à un sujet : plus orpheline.
    const suivie = await mail(db, channel.id, {
      id: "m5",
      from: "z@suivie.fr",
      subject: "Suivie",
      il_y_a_jours: 4,
    });
    await applyTriageMatter(db, {
      conversationId: suivie.message.conversationId,
      messageId: suivie.message.id,
      title: "Suivie",
    });

    const candidats = await listCatchupCandidates(db, {
      channelId: channel.id,
      since,
      limit: 10,
    });
    expect(candidats).toEqual([
      {
        conversationId: ancien.message.conversationId,
        messageId: ancien.message.id,
      },
      {
        conversationId: recent.message.conversationId,
        messageId: recent.message.id,
      },
    ]);
    expect(
      await countCatchupCandidates(db, { channelId: channel.id, since }),
    ).toBe(2);
    expect(
      await listKnownExternalIds(db, {
        channelId: channel.id,
        externalIds: ["m1", "m9", "m5"],
      }),
    ).toEqual(new Set(["m1", "m5"]));
  });
});

describe("l'avancement et la clôture", () => {
  it("additionne les compteurs, compte les nuits, et clôt avec le bilan au journal", async () => {
    const { db, channel } = await makeAccount("f@test.fr");
    const c = await requestChannelCatchup(db, { channelId: channel.id, since });
    const r1 = await startCatchupRun(db, c.id);
    expect(r1.status).toBe("running");
    expect(r1.runs).toBe(1);
    expect(r1.startedAt).not.toBeNull();
    await recordCatchupProgress(db, c.id, {
      messagesImported: 40,
      importDone: true,
    });
    await recordCatchupProgress(db, c.id, {
      messagesTriaged: 10,
      subjectsOpened: 3,
      conversationsIgnored: 4,
      costEur: 0.05,
    });
    const r2 = await startCatchupRun(db, c.id);
    expect(r2.runs).toBe(2);
    expect(r2.startedAt?.getTime()).toBe(r1.startedAt?.getTime());
    await recordCatchupProgress(db, c.id, {
      messagesTriaged: 5,
      costEur: 0.02,
    });

    const fini = await finishCatchup(db, c.id, {
      status: "capped",
      reason: "plafond-euros",
    });
    expect(fini.status).toBe("capped");
    expect(fini.messagesImported).toBe(40);
    expect(fini.messagesTriaged).toBe(15);
    expect(fini.subjectsOpened).toBe(3);
    expect(fini.costEur).toBeCloseTo(0.07, 6);
    expect(fini.importDone).toBe(true);
    expect(fini.finishedAt).not.toBeNull();

    const journal = await db.eventLog.findMany({
      where: {
        eventType: {
          in: [EVENT_TYPES.catchupStarted, EVENT_TYPES.catchupFinished],
        },
      },
      orderBy: { createdAt: "asc" },
    });
    expect(journal.map((e) => e.eventType)).toEqual([
      EVENT_TYPES.catchupStarted,
      EVENT_TYPES.catchupFinished,
    ]);
    expect(journal[1].title).toBe("Rattrapage arrêté au plafond");
    expect(journal[1].description).toContain(
      "40 messages lus, 3 sujets ouverts",
    );
    expect((journal[1].metadata as { reason: string }).reason).toBe(
      "plafond-euros",
    );
    // Clos : plus dû ; une nouvelle demande en crée un autre.
    expect(await listDueCatchups()).toEqual([]);
    const c2 = await requestChannelCatchup(db, {
      channelId: channel.id,
      since,
    });
    expect(c2.id).not.toBe(c.id);
  });
});
