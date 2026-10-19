import { describe, expect, it } from "vitest";
import {
  EVENT_TYPES,
  hasPushSubscription,
  listPushAccounts,
  listPushSubscriptions,
  prisma,
  recordPushSent,
  removePushSubscription,
  savePushSubscription,
  tenantDb,
  wasPushSentSince,
} from "../src/index";

// LES ABONNEMENTS PUSH (M12.7, M12.9) : un appareil abonné une fois, un
// appareil qui change de compte change de main, le retrait journalisé avec son
// motif, le cron qui trouve ses comptes, et le journal qui tient « un brief par
// jour ».

async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Mam's", lastName: "Crousty" },
  });
  return { account, db: tenantDb(account.id) };
}

const appareil = (endpoint: string) => ({
  endpoint,
  keys: {
    p256dh: "p256dh-" + endpoint.slice(-4),
    auth: "auth-" + endpoint.slice(-4),
  },
  userAgent: "Mozilla/5.0 (iPhone)",
});

describe("s'abonner, se désabonner", () => {
  it("le même appareil renvoyé rafraîchit ses clés sans ligne ni événement de plus", async () => {
    const { account, db } = await makeAccount("push-idem@test.fr");
    const endpoint = "https://push.example/sub/aaaa0001";
    const a = await savePushSubscription(db, account.id, appareil(endpoint));
    expect(a.created).toBe(true);
    const b = await savePushSubscription(db, account.id, {
      ...appareil(endpoint),
      keys: { p256dh: "nouvelle", auth: "nouvelle-auth" },
    });
    expect(b).toEqual({ id: a.id, created: false });
    const lignes = await listPushSubscriptions(db);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({
      endpoint,
      p256dh: "nouvelle",
      auth: "nouvelle-auth",
    });
    const events = await db.eventLog.count({
      where: { eventType: EVENT_TYPES.pushSubscribed },
    });
    expect(events).toBe(1);
    expect(await hasPushSubscription(db)).toBe(true);
  });

  it("un appareil qui change de compte change de main : l'ancienne ligne tombe", async () => {
    const a = await makeAccount("push-a@test.fr");
    const b = await makeAccount("push-b@test.fr");
    const endpoint = "https://push.example/sub/bbbb0002";
    await savePushSubscription(a.db, a.account.id, appareil(endpoint));
    await savePushSubscription(b.db, b.account.id, appareil(endpoint));
    expect(await listPushSubscriptions(a.db)).toHaveLength(0);
    expect(await listPushSubscriptions(b.db)).toHaveLength(1);
    expect(await hasPushSubscription(a.db)).toBe(false);
  });

  it("le retrait dit son motif — l'utilisateur, ou le service de push — et ne touche pas les autres comptes", async () => {
    const a = await makeAccount("push-retrait@test.fr");
    const b = await makeAccount("push-retrait-b@test.fr");
    const e1 = "https://push.example/sub/cccc0003";
    const e2 = "https://push.example/sub/cccc0004";
    await savePushSubscription(a.db, a.account.id, appareil(e1));
    await savePushSubscription(b.db, b.account.id, appareil(e2));
    // Le compte A ne peut pas retirer l'appareil du compte B.
    expect(await removePushSubscription(a.db, a.account.id, e2)).toBe(false);
    expect(
      await removePushSubscription(a.db, a.account.id, e1, "service"),
    ).toBe(true);
    expect(await removePushSubscription(a.db, a.account.id, e1)).toBe(false);
    const ev = await a.db.eventLog.findFirst({
      where: { eventType: EVENT_TYPES.pushUnsubscribed },
    });
    expect(ev?.actor).toBe("system");
    expect(ev?.metadata).toMatchObject({ motif: "service" });
    expect(await listPushSubscriptions(b.db)).toHaveLength(1);
  });
});

describe("le cron et le journal", () => {
  it("les comptes abonnés, une fois chacun, et pas les autres", async () => {
    const a = await makeAccount("push-cron-a@test.fr");
    const b = await makeAccount("push-cron-b@test.fr");
    const c = await makeAccount("push-cron-c@test.fr");
    await savePushSubscription(
      a.db,
      a.account.id,
      appareil("https://push.example/sub/dddd0005"),
    );
    await savePushSubscription(
      a.db,
      a.account.id,
      appareil("https://push.example/sub/dddd0006"),
    );
    await savePushSubscription(
      b.db,
      b.account.id,
      appareil("https://push.example/sub/dddd0007"),
    );
    const comptes = await listPushAccounts();
    expect(comptes.filter((id) => id === a.account.id)).toHaveLength(1);
    expect(comptes).toContain(b.account.id);
    expect(comptes).not.toContain(c.account.id);
  });

  it("un envoi date les appareils servis et laisse une ligne au journal ; « déjà parti aujourd'hui » se lit dedans", async () => {
    const { account, db } = await makeAccount("push-journal@test.fr");
    const { id } = await savePushSubscription(
      db,
      account.id,
      appareil("https://push.example/sub/eeee0008"),
    );
    const matin = new Date("2026-10-19T05:00:00.000Z");
    expect(await wasPushSentSince(db, "brief", matin)).toBe(false);
    await recordPushSent(db, account.id, {
      kind: "brief",
      subscriptionIds: [id],
      title: "2 réponses attendues · 1 urgence",
      at: new Date("2026-10-19T06:05:00.000Z"),
    });
    const [ligne] = await listPushSubscriptions(db);
    const brute = await db.pushSubscription.findFirst({
      where: { id: ligne!.id },
    });
    expect(brute?.lastSentAt?.toISOString()).toBe("2026-10-19T06:05:00.000Z");
    expect(await wasPushSentSince(db, "brief", matin)).toBe(true);
    expect(await wasPushSentSince(db, "question", matin)).toBe(false);
  });
});
