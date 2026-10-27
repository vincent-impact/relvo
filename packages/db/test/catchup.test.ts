import { describe, expect, it } from "vitest";
import {
  ChannelType,
  EVENT_TYPES,
  applyTriageMatter,
  claimCatchupTranche,
  countCatchupCandidates,
  finishCatchup,
  getLatestChannelCatchup,
  getOpenCatchup,
  ingestInboundEmail,
  listCatchupCandidates,
  listDueCatchups,
  listKnownExternalIds,
  listOpenCatchups,
  prisma,
  recordCatchupProgress,
  recordTriageVerdict,
  releaseCatchupTranche,
  requestChannelCatchup,
  resumeCatchupAtNight,
  tenantDb,
} from "../src/index";

// M7 tranche 10 — le RATTRAPAGE du courrier récent, dès la connexion. Ce que
// le domaine tient : une demande par canal e-mail, idempotente ; UNE tranche
// à la fois par ligne (le verrou se prend par une mise à jour conditionnelle,
// une seule prise concurrente gagne, un verrou mort se reprend) ; les
// candidats au tri sont les conversations orphelines de la fenêtre au
// dernier message entrant, pas encore triées, du plus récent au plus ancien ;
// l'avancement s'additionne (passes vides, total des candidats, niveau de
// service) ; la clôture journalise le bilan ; une ligne arrêtée au garde-fou
// reste ouverte pour le webhook et se reprend la nuit, en lot ; le filet
// découvre les lignes dues hors tenant, sur les canaux connectés.

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
const MIN = 60_000;
const since = new Date(Date.now() - 14 * J);
const TRANCHE_MAX_MS = 5 * MIN;

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
    expect(c1.serviceLevel).toBe("standard");
    expect((await getLatestChannelCatchup(db, channel.id))?.id).toBe(c1.id);
    expect((await getOpenCatchup(db, channel.id))?.id).toBe(c1.id);
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
    expect(dus[0].requestedAt).toBeInstanceOf(Date);
  });
});

describe("le verrou d'une tranche", () => {
  it("se prend une fois : deux prises concurrentes, une seule gagne ; levé, il se reprend ; mort, il se reprend aussi", async () => {
    const { db, channel } = await makeAccount("g@test.fr");
    const c = await requestChannelCatchup(db, { channelId: channel.id, since });
    const [p1, p2] = await Promise.all([
      claimCatchupTranche(db, c.id, { trancheMaxMs: TRANCHE_MAX_MS }),
      claimCatchupTranche(db, c.id, { trancheMaxMs: TRANCHE_MAX_MS }),
    ]);
    const gagnants = [p1, p2].filter(Boolean);
    expect(gagnants).toHaveLength(1);
    expect(gagnants[0]!.status).toBe("running");
    expect(gagnants[0]!.runs).toBe(1);
    expect(gagnants[0]!.trancheStartedAt).not.toBeNull();
    expect(gagnants[0]!.startedAt).not.toBeNull();
    // Tenu : une troisième prise échoue.
    expect(
      await claimCatchupTranche(db, c.id, { trancheMaxMs: TRANCHE_MAX_MS }),
    ).toBeNull();
    // Levé : la suivante passe, une passe de plus, le début ne bouge pas.
    const avant = gagnants[0]!.startedAt!.getTime();
    const levee = await releaseCatchupTranche(db, c.id);
    expect(levee.trancheStartedAt).toBeNull();
    expect(levee.lastTrancheAt).not.toBeNull();
    const p3 = await claimCatchupTranche(db, c.id, {
      trancheMaxMs: TRANCHE_MAX_MS,
    });
    expect(p3?.runs).toBe(2);
    expect(p3?.startedAt?.getTime()).toBe(avant);
    // Mort : un verrou plus vieux que la durée d'une fonction se reprend.
    expect(
      await claimCatchupTranche(db, c.id, {
        trancheMaxMs: TRANCHE_MAX_MS,
        now: new Date(Date.now() + TRANCHE_MAX_MS + MIN),
      }),
    ).not.toBeNull();
    // Le début n'est journalisé qu'une fois.
    const journal = await db.eventLog.findMany({
      where: { eventType: EVENT_TYPES.catchupStarted },
    });
    expect(journal).toHaveLength(1);
  });
});

describe("les candidats au tri", () => {
  it("sont les conversations orphelines de la fenêtre, au dernier message entrant, pas encore triées — les plus récentes d'abord", async () => {
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
      il_y_a_jours: 20,
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
        conversationId: recent.message.conversationId,
        messageId: recent.message.id,
      },
      {
        conversationId: ancien.message.conversationId,
        messageId: ancien.message.id,
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
  it("additionne les compteurs, compte les passes vides et le total, et clôt avec le bilan au journal", async () => {
    const { db, channel } = await makeAccount("f@test.fr");
    const c = await requestChannelCatchup(db, { channelId: channel.id, since });
    await claimCatchupTranche(db, c.id, { trancheMaxMs: TRANCHE_MAX_MS });
    await recordCatchupProgress(db, c.id, { emptyRounds: "increment" });
    await recordCatchupProgress(db, c.id, { emptyRounds: "increment" });
    const vides = await recordCatchupProgress(db, c.id, {
      messagesImported: 40,
      emptyRounds: "reset",
    });
    expect(vides.emptyRounds).toBe(0);
    await recordCatchupProgress(db, c.id, {
      importDone: true,
      candidatesTotal: 12,
    });
    await recordCatchupProgress(db, c.id, {
      messagesTriaged: 10,
      subjectsOpened: 3,
      conversationsIgnored: 4,
      costEur: 0.05,
    });
    await releaseCatchupTranche(db, c.id);
    await claimCatchupTranche(db, c.id, { trancheMaxMs: TRANCHE_MAX_MS });
    await recordCatchupProgress(db, c.id, {
      messagesTriaged: 5,
      costEur: 0.02,
    });

    const fini = await finishCatchup(db, c.id, {
      status: "done",
      reason: "courrier-epuise",
    });
    expect(fini.status).toBe("done");
    expect(fini.runs).toBe(2);
    expect(fini.messagesImported).toBe(40);
    expect(fini.messagesTriaged).toBe(15);
    expect(fini.subjectsOpened).toBe(3);
    expect(fini.candidatesTotal).toBe(12);
    expect(fini.costEur).toBeCloseTo(0.07, 6);
    expect(fini.importDone).toBe(true);
    expect(fini.finishedAt).not.toBeNull();
    expect(fini.trancheStartedAt).toBeNull();

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
    expect(journal[1].title).toBe("Rattrapage du courrier récent terminé");
    expect(journal[1].description).toContain(
      "40 messages lus, 3 sujets ouverts",
    );
    // Close : plus ouverte, plus due ; une nouvelle demande en crée une autre.
    expect(await getOpenCatchup(db, channel.id)).toBeNull();
    expect(await listDueCatchups()).toEqual([]);
    const c2 = await requestChannelCatchup(db, {
      channelId: channel.id,
      since,
    });
    expect(c2.id).not.toBe(c.id);
  });

  it("une ligne arrêtée au garde-fou reste ouverte pour le webhook, se reprend la nuit en lot, et n'est plus due quand les nuits sont épuisées", async () => {
    const { db, channel } = await makeAccount("h@test.fr");
    const c = await requestChannelCatchup(db, { channelId: channel.id, since });
    await claimCatchupTranche(db, c.id, { trancheMaxMs: TRANCHE_MAX_MS });
    const capped = await finishCatchup(db, c.id, {
      status: "capped",
      reason: "plafond-euros",
    });
    expect(capped.status).toBe("capped");
    // Ouverte pour le webhook (l'historique reste à la nuit) et pour la page.
    expect((await getOpenCatchup(db, channel.id))?.id).toBe(c.id);
    expect((await listOpenCatchups(db)).map((l) => l.id)).toEqual([c.id]);
    // Due la nuit tant que des nuits restent.
    expect((await listDueCatchups({ nuitsMax: 3 })).map((d) => d.id)).toEqual([
      c.id,
    ]);
    const reprise = await resumeCatchupAtNight(db, c.id);
    expect(reprise.status).toBe("running");
    expect(reprise.serviceLevel).toBe("flex");
    expect(reprise.nightRuns).toBe(1);
    expect(reprise.stopReason).toBeNull();
    const journal = await db.eventLog.findMany({
      where: { eventType: EVENT_TYPES.catchupResumed },
    });
    expect(journal).toHaveLength(1);
    // Reprise sans effet sur une ligne qui n'est pas arrêtée.
    expect((await resumeCatchupAtNight(db, c.id)).nightRuns).toBe(1);
    // Nuits épuisées : close, ni ouverte ni due.
    await prisma.channelCatchup.update({
      where: { id: c.id },
      data: { nightRuns: 3 },
    });
    await finishCatchup(db, c.id, {
      status: "capped",
      reason: "plafond-euros",
    });
    expect((await listDueCatchups({ nuitsMax: 3 })).map((d) => d.id)).toEqual(
      [],
    );
    await finishCatchup(db, c.id, {
      status: "capped",
      reason: "nuits-epuisees",
    });
    expect(await getOpenCatchup(db, channel.id)).toBeNull();
    expect(await listDueCatchups()).toEqual([]);
  });
});
