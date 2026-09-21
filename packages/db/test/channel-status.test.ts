import { describe, expect, it } from "vitest";
import {
  confirmChannelConnected,
  ingestInboundEmail,
  ingestInboundWhatsApp,
  prisma,
  tenantDb,
} from "../src/index";

// LE STATUT D'UN CANAL SE RÉPARE PAR LES FAITS (M5.8, PITFALLS #53) : un message
// reçu prouve la connexion. Un canal resté « en attente » (reconnexion
// abandonnée) ou « en erreur » (webhook d'état périmé) repasse « connecté » au
// premier message livré — et un canal désactivé par l'utilisateur, lui, reste
// désactivé.

async function makeChannel(
  email: string,
  type: "email" | "whatsapp",
  status: "pending" | "error" | "disabled" | "connected",
) {
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  const channel = await prisma.channel.create({
    data: { accountId: account.id, name: email, type, identifier: email },
  });
  await prisma.channelConfig.create({
    data: {
      accountId: account.id,
      channelId: channel.id,
      provider: "unipile",
      externalAccountId: `acc_${email}`,
      status,
    },
  });
  return { channel, db: tenantDb(account.id) };
}

async function statusOf(channelId: string) {
  const cfg = await prisma.channelConfig.findUnique({
    where: { channelId },
    select: { status: true, lastSyncAt: true },
  });
  return cfg!;
}

describe("le statut d'un canal se répare par les faits", () => {
  it("un e-mail reçu sur un canal « en attente » le passe « connecté » et date la synchro", async () => {
    const { channel, db } = await makeChannel(
      "pending@test.fr",
      "email",
      "pending",
    );
    const avant = new Date();

    const { created } = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "mail-1",
      senderRaw: "karim@sogood.fr",
      subjectLine: "Livraison",
      content: "Bonjour",
    });

    expect(created).toBe(true);
    const cfg = await statusOf(channel.id);
    expect(cfg.status).toBe("connected");
    expect(cfg.lastSyncAt!.getTime()).toBeGreaterThanOrEqual(
      avant.getTime() - 5,
    );
  });

  it("un message WhatsApp reçu sur un canal « en erreur » le passe « connecté »", async () => {
    const { channel, db } = await makeChannel(
      "+33600000001",
      "whatsapp",
      "error",
    );

    await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "wa-1",
      externalThreadId: "chat-1",
      senderRaw: "+33600000002",
      content: "Salut",
    });

    expect((await statusOf(channel.id)).status).toBe("connected");
  });

  it("un canal désactivé ne se rallume pas tout seul", async () => {
    const { channel, db } = await makeChannel(
      "off@test.fr",
      "email",
      "disabled",
    );

    await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "mail-off",
      senderRaw: "karim@sogood.fr",
      content: "Bonjour",
    });

    expect((await statusOf(channel.id)).status).toBe("disabled");
  });

  it("un webhook rejoué ne touche plus au statut — la confirmation n'est pas une écriture aveugle", async () => {
    const { channel, db } = await makeChannel(
      "replay@test.fr",
      "email",
      "connected",
    );
    const input = {
      channelId: channel.id,
      externalId: "mail-replay",
      senderRaw: "karim@sogood.fr",
      content: "Bonjour",
    };
    await ingestInboundEmail(db, input);
    const apres = await statusOf(channel.id);
    // Déjà connecté : rien à réparer, la date de synchro reste celle d'avant.
    expect(apres.status).toBe("connected");
    expect(apres.lastSyncAt).toBeNull();

    const { created } = await ingestInboundEmail(db, input);
    expect(created).toBe(false);
    expect((await confirmChannelConnected(db, channel.id)).healed).toBe(false);
  });
});
