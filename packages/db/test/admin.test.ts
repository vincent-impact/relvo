import { describe, expect, it } from "vitest";
import {
  Actor,
  EVENT_TYPES,
  MessageDirection,
  activateAccount,
  askQuestion,
  createMessage,
  createSubject,
  deleteAccount,
  getAccountForAdmin,
  getAccountJournal,
  getAdminOverview,
  listAccountsForAdmin,
  listAiFailures,
  logAiFailure,
  logAiSolicitation,
  prisma,
  savePushSubscription,
  setAccountRole,
  setAccountTest,
  setAssistantEnabled,
  tenantDb,
} from "../src/index";

// L'ADMINISTRATION (M21) : trois gestes journalisés sur le compte visé, la
// liste qui lit les mêmes fonctions que le produit, et la suppression —
// définitive — qui laisse sa trace sur le compte de l'administrateur et ses
// clés de fichiers dans l'outbox.

async function makeAccount(email: string, extra: Record<string, unknown> = {}) {
  const account = await prisma.account.create({
    data: { email, firstName: "Mam's", lastName: "Crousty", ...extra },
  });
  return { account, db: tenantDb(account.id) };
}

async function events(accountId: string, eventType: string) {
  return prisma.eventLog.findMany({
    where: { accountId, eventType },
    orderBy: { createdAt: "asc" },
  });
}

const sollicitation = {
  sollicitation: "tri",
  tier: "extraction",
  modele: "gpt-5.6-luna",
  niveau: "low",
  jetons: {
    entree: 500,
    cacheLecture: 0,
    cacheEcriture: 0,
    sortie: 80,
    raisonnement: 0,
  },
  dureeMs: 900,
};

describe("les gestes d'administration sur un compte", () => {
  it("setAccountRole change le rôle, le journalise (de → vers) et ne réécrit pas le même", async () => {
    const { account, db } = await makeAccount("role@test.fr");
    const a = await setAccountRole(db, account.id, "admin");
    expect(a).toEqual({ role: "admin", changed: true });
    const b = await setAccountRole(db, account.id, "admin");
    expect(b.changed).toBe(false);
    const logs = await events(account.id, EVENT_TYPES.roleChanged);
    expect(logs).toHaveLength(1);
    expect(logs[0].actor).toBe(Actor.system);
    expect(logs[0].metadata).toEqual({ de: "ceo", vers: "admin" });
    const relu = await prisma.account.findUnique({ where: { id: account.id } });
    expect(relu?.role).toBe("admin");
  });

  it("setAccountTest pose et retire la marque, une entrée par changement", async () => {
    const { account, db } = await makeAccount("test@test.fr");
    expect((await setAccountTest(db, account.id, true)).changed).toBe(true);
    expect((await setAccountTest(db, account.id, true)).changed).toBe(false);
    expect((await setAccountTest(db, account.id, false)).changed).toBe(true);
    expect(
      await events(account.id, EVENT_TYPES.accountTestMarked),
    ).toHaveLength(1);
    expect(
      await events(account.id, EVENT_TYPES.accountTestUnmarked),
    ).toHaveLength(1);
  });

  it("activateAccount ouvre l'accès une seule fois, et allume l'assistant", async () => {
    const { account, db } = await makeAccount("attente@test.fr");
    expect(account.activatedAt).toBeNull();
    const at = new Date("2026-10-21T08:00:00Z");
    // Un compte en attente dont l'assistant a été coupé avant l'ouverture.
    await prisma.account.update({
      where: { id: account.id },
      data: { assistantEnabled: false },
    });
    const a = await activateAccount(db, account.id, at);
    expect(a).toEqual({ activatedAt: at, changed: true });
    expect(
      (await prisma.account.findUniqueOrThrow({ where: { id: account.id } }))
        .assistantEnabled,
    ).toBe(true);
    const b = await activateAccount(db, account.id, new Date());
    expect(b.changed).toBe(false);
    expect(b.activatedAt).toEqual(at);
    expect(await events(account.id, EVENT_TYPES.accountActivated)).toHaveLength(
      1,
    );
  });

  it("setAssistantEnabled par l'administrateur porte l'acteur system et le motif", async () => {
    const { account, db } = await makeAccount("coupe@test.fr", {
      assistantEnabled: true,
    });
    await setAssistantEnabled(db, account.id, false, Actor.system, {
      motif: "  coût anormal ",
    });
    const logs = await events(account.id, EVENT_TYPES.assistantDisabled);
    expect(logs).toHaveLength(1);
    expect(logs[0].actor).toBe(Actor.system);
    expect(logs[0].metadata).toEqual({ motif: "coût anormal" });
    // Sans motif, pas de métadonnée vide.
    await setAssistantEnabled(db, account.id, true, Actor.system, {
      motif: "",
    });
    const on = await events(account.id, EVENT_TYPES.assistantEnabled);
    expect(on[0].metadata).toBeNull();
  });
});

describe("listAccountsForAdmin — la liste lit les fonctions du produit", () => {
  it("rend par compte ses canaux, ses compteurs et ses coûts sur deux fenêtres", async () => {
    const now = new Date("2026-10-21T12:00:00Z");
    const { account: a, db } = await makeAccount("actif@test.fr", {
      activatedAt: now,
      sectors: ["food"],
    });
    const { account: b } = await makeAccount("vide@test.fr");

    const channel = await prisma.channel.create({
      data: {
        accountId: a.id,
        name: "Gmail",
        type: "email",
        identifier: "actif@test.fr",
      },
    });
    await prisma.channelConfig.create({
      data: {
        accountId: a.id,
        channelId: channel.id,
        provider: "unipile",
        externalAccountId: "acc_actif",
        status: "connected",
      },
    });
    await createSubject(db, {
      title: "Ouverte",
      contactIds: [],
      createdByActor: "user",
    });
    const fermee = await createSubject(db, {
      title: "Fermée",
      contactIds: [],
      createdByActor: "user",
    });
    await db.subject.updateMany({
      where: { id: fermee.id },
      data: { status: "closed" },
    });
    await askQuestion(db, { scope: "account", text: "Vos secteurs ?" });
    await savePushSubscription(db, a.id, {
      endpoint: "https://push.example/a1",
      keys: { p256dh: "p", auth: "s" },
    });
    // Deux sollicitations : une récente, une d'il y a vingt jours.
    const recente = await logAiSolicitation(db, {
      ...sollicitation,
      cout: { eur: 0.002, usd: 0.0023, version: "v" },
    });
    const ancienne = await logAiSolicitation(db, {
      ...sollicitation,
      cout: { eur: 0.005, usd: 0.0058, version: "v" },
    });
    await prisma.eventLog.update({
      where: { id: recente.id },
      data: { createdAt: new Date("2026-10-20T10:00:00Z") },
    });
    await prisma.eventLog.update({
      where: { id: ancienne.id },
      data: { createdAt: new Date("2026-10-01T10:00:00Z") },
    });
    // Le dernier geste de l'utilisateur, posé à une date connue.
    await prisma.eventLog.updateMany({
      where: { accountId: a.id, actor: Actor.user },
      data: { createdAt: new Date("2026-10-19T09:30:00Z") },
    });

    const rows = await listAccountsForAdmin({ now });
    expect(rows.map((r) => r.email).sort()).toEqual([
      "actif@test.fr",
      "vide@test.fr",
    ]);

    const actif = rows.find((r) => r.id === a.id)!;
    expect(actif.activatedAt).toEqual(now);
    expect(actif.sectors).toEqual(["food"]);
    expect(actif.channels).toEqual([
      expect.objectContaining({
        name: "Gmail",
        type: "email",
        status: "connected",
        externalAccountId: "acc_actif",
      }),
    ]);
    expect(actif.openSubjects).toBe(1);
    expect(actif.openQuestions).toBe(1);
    expect(actif.pushDevices).toBe(1);
    expect(actif.appelsLong).toBe(2);
    expect(actif.coutEurCourt).toBeCloseTo(0.002, 6);
    expect(actif.coutEurLong).toBeCloseTo(0.007, 6);
    expect(actif.lastActivityAt).toEqual(new Date("2026-10-19T09:30:00Z"));

    const vide = rows.find((r) => r.id === b.id)!;
    expect(vide.activatedAt).toBeNull();
    expect(vide.channels).toEqual([]);
    expect(vide.openSubjects).toBe(0);
    expect(vide.openQuestions).toBe(0);
    expect(vide.pushDevices).toBe(0);
    expect(vide.coutEurLong).toBe(0);
    expect(vide.lastActivityAt).toBeNull();

    // La fiche d'un compte rend la même ligne.
    const fiche = await getAccountForAdmin(a.id, { now });
    expect(fiche).toEqual(actif);
    expect(
      await getAccountForAdmin("00000000-0000-4000-8000-000000000bad"),
    ).toBe(null);
  });
});

describe("deleteAccount — définitif, tracé chez l'administrateur", () => {
  it("efface tout le tenant, enfile ses clés de fichiers, journalise sur le compte de l'admin", async () => {
    const { account: admin, db: adminDb } = await makeAccount("admin@test.fr", {
      role: "admin",
    });
    const { account: cible, db } = await makeAccount("cible@test.fr");
    const channel = await prisma.channel.create({
      data: {
        accountId: cible.id,
        name: "Gmail",
        type: "email",
        identifier: "cible@test.fr",
      },
    });
    await prisma.channelConfig.create({
      data: {
        accountId: cible.id,
        channelId: channel.id,
        provider: "unipile",
        externalAccountId: "acc_cible",
        status: "connected",
      },
    });
    const folder = await prisma.folder.create({
      data: {
        accountId: cible.id,
        name: "Général",
        slug: "general",
        isDefault: true,
      },
    });
    const subject = await createSubject(db, {
      title: "Chantier",
      contactIds: [],
      createdByActor: "user",
    });
    const message = await createMessage(db, {
      channelId: channel.id,
      direction: MessageDirection.incoming,
      subjectId: subject.id,
      senderRaw: "karim@sogood.fr",
      content: "Devis en pièce jointe",
      status: "linked",
    });
    await prisma.attachment.create({
      data: {
        accountId: cible.id,
        messageId: message.id,
        name: "devis.pdf",
        storageKey: `accounts/${cible.id}/attachments/1/devis.pdf`,
      },
    });
    await prisma.knowledgeDocument.create({
      data: {
        accountId: cible.id,
        folderId: folder.id,
        kind: "file",
        name: "charte.pdf",
        storageKey: `accounts/${cible.id}/knowledge/1/charte.pdf`,
        createdByActor: "user",
      },
    });

    const res = await deleteAccount(adminDb, {
      targetId: cible.id,
      unipile: { deconnectes: ["acc_cible"], echecs: [] },
    });
    expect(res).toEqual({ email: "cible@test.fr", channels: 1 });

    // Plus une ligne du tenant, dans aucune table.
    expect(await prisma.account.count({ where: { id: cible.id } })).toBe(0);
    for (const table of [
      prisma.channel,
      prisma.channelConfig,
      prisma.subject,
      prisma.message,
      prisma.attachment,
      prisma.knowledgeDocument,
      prisma.folder,
      prisma.eventLog,
    ] as const) {
      expect(
        await (table as { count: (a: unknown) => Promise<number> }).count({
          where: { accountId: cible.id },
        }),
      ).toBe(0);
    }
    // Les deux clés de fichiers attendent le drainage.
    const outbox = await prisma.pendingFileDeletion.findMany({
      select: { storageKey: true },
    });
    expect(outbox.map((r) => r.storageKey).sort()).toEqual([
      `accounts/${cible.id}/attachments/1/devis.pdf`,
      `accounts/${cible.id}/knowledge/1/charte.pdf`,
    ]);
    // La trace survit sur le compte de l'administrateur.
    const logs = await events(admin.id, EVENT_TYPES.accountDeleted);
    expect(logs).toHaveLength(1);
    expect(logs[0].actor).toBe(Actor.user);
    expect(logs[0].metadata).toEqual(
      expect.objectContaining({
        accountId: cible.id,
        email: "cible@test.fr",
        canaux: 1,
        unipile: { deconnectes: ["acc_cible"], echecs: [] },
      }),
    );
    // L'administrateur, lui, est toujours là.
    expect(await prisma.account.count({ where: { id: admin.id } })).toBe(1);
  });

  it("refuse un compte inconnu", async () => {
    const { db: adminDb } = await makeAccount("admin2@test.fr", {
      role: "admin",
    });
    await expect(
      deleteAccount(adminDb, {
        targetId: "00000000-0000-4000-8000-000000000bad",
        unipile: { deconnectes: [], echecs: [] },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("la fiche d'un compte — le journal rendu (M21.3)", () => {
  it("rend la synthèse par sollicitation, les échecs, le journal récent, les rattrapages et les questions", async () => {
    const now = new Date("2026-10-21T12:00:00Z");
    const { account, db } = await makeAccount("fiche@test.fr");
    await logAiSolicitation(db, {
      ...sollicitation,
      cout: { eur: 0.001, usd: 0.0012, version: "v" },
    });
    await logAiSolicitation(db, {
      ...sollicitation,
      sollicitation: "echange",
      tier: "raisonnement",
      cout: { eur: 0.01, usd: 0.012, version: "v" },
    });
    await logAiFailure(db, {
      sollicitation: "echange",
      motif: "entree-trop-longue",
      detail: "le contexte dépasse le plafond",
      tier: "raisonnement",
    });
    await askQuestion(db, { scope: "account", text: "Vos secteurs ?" });
    const channel = await prisma.channel.create({
      data: {
        accountId: account.id,
        name: "Gmail",
        type: "email",
        identifier: "fiche@test.fr",
      },
    });
    await prisma.channelCatchup.create({
      data: {
        accountId: account.id,
        channelId: channel.id,
        status: "failed",
        since: new Date("2026-10-01T00:00:00Z"),
        lastError: "boîte injoignable",
      },
    });

    const fiche = await getAccountJournal(account.id, { now });
    expect(fiche.synthese.map((s) => s.sollicitation)).toEqual([
      "echange",
      "tri",
    ]);
    expect(fiche.synthese[0].coutEur).toBeCloseTo(0.01, 6);
    expect(fiche.nonMesures).toBe(2);
    expect(fiche.echecs).toHaveLength(1);
    expect(fiche.echecs[0]).toMatchObject({
      sollicitation: "echange",
      motif: "entree-trop-longue",
      detail: "le contexte dépasse le plafond",
      tier: "raisonnement",
    });
    expect(fiche.questions.map((q) => q.text)).toEqual(["Vos secteurs ?"]);
    expect(fiche.rattrapages).toEqual([
      expect.objectContaining({
        channelName: "Gmail",
        status: "failed",
        lastError: "boîte injoignable",
      }),
    ]);
    // Le journal récent, du plus récent au plus ancien, toutes entrées confondues.
    expect(fiche.journal.length).toBeGreaterThanOrEqual(4);
    expect(fiche.journal[0].at.getTime()).toBeGreaterThanOrEqual(
      fiche.journal[fiche.journal.length - 1].at.getTime(),
    );
    expect(fiche.journal.map((e) => e.eventType)).toContain(
      EVENT_TYPES.iaEchec,
    );
  });

  it("listAiFailures borne par la date et la limite", async () => {
    const { db } = await makeAccount("echecs@test.fr");
    for (let i = 0; i < 3; i++) {
      await logAiFailure(db, {
        sollicitation: "echange",
        motif: "inconnu",
        detail: `n°${i}`,
      });
    }
    expect(
      await listAiFailures(db, { since: new Date(0), limit: 2 }),
    ).toHaveLength(2);
    expect(
      await listAiFailures(db, {
        since: new Date(Date.now() + 60_000),
      }),
    ).toEqual([]);
  });
});

describe("la vue d'ensemble (M21.5)", () => {
  it("additionne le mois en cours sur tous les comptes et compte actifs, attentes, échecs", async () => {
    const now = new Date("2026-10-21T12:00:00Z");
    const { account: a, db: dbA } = await makeAccount("vue-a@test.fr", {
      activatedAt: now,
    });
    const { db: dbB } = await makeAccount("vue-b@test.fr", {
      activatedAt: now,
    });
    await makeAccount("vue-attente@test.fr");

    const dansLeMois = await logAiSolicitation(dbA, {
      ...sollicitation,
      cout: { eur: 0.5, usd: 0.58, version: "v" },
    });
    const moisDernier = await logAiSolicitation(dbA, {
      ...sollicitation,
      cout: { eur: 9, usd: 10, version: "v" },
    });
    await logAiSolicitation(dbB, {
      ...sollicitation,
      cout: { eur: 0.25, usd: 0.29, version: "v" },
    });
    await prisma.eventLog.update({
      where: { id: dansLeMois.id },
      data: { createdAt: new Date("2026-10-02T10:00:00Z") },
    });
    await prisma.eventLog.update({
      where: { id: moisDernier.id },
      data: { createdAt: new Date("2026-09-29T10:00:00Z") },
    });
    await logAiFailure(dbA, {
      sollicitation: "echange",
      motif: "plafond-sortie",
      detail: "",
    });
    // A a agi il y a deux jours ; B jamais.
    await prisma.eventLog.create({
      data: {
        accountId: a.id,
        entityType: "system",
        eventType: "task_completed",
        title: "Tâche faite",
        actor: Actor.user,
        createdAt: new Date("2026-10-19T08:00:00Z"),
      },
    });

    const vue = await getAdminOverview({ now, plafondEur: 100 });
    expect(vue.moisDepuis.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(vue.coutMoisEur).toBeCloseTo(0.75, 6);
    expect(vue.appelsMois).toBe(2);
    expect(vue.plafondEur).toBe(100);
    expect(vue.comptes).toBe(3);
    expect(vue.comptesEnAttente).toBe(1);
    expect(vue.comptesActifs7j).toBe(1);
    expect(vue.echecs7j[EVENT_TYPES.iaEchec]).toBe(1);
    expect(vue.echecs7j[EVENT_TYPES.triageFailed]).toBe(0);
    expect(vue.outboxEnAttente).toBe(0);
    expect(vue.rattrapagesEnEchec).toBe(0);
  });
});
