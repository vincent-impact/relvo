import { describe, expect, it } from "vitest";
import {
  MAX_EMAIL_CHANNELS,
  isNeverConnected,
  mailProviderOf,
  prepareChannelConnection,
  prisma,
  tenantDb,
} from "../src/index";

// Préparer la connexion d'un canal avant la page du fournisseur (PITFALLS
// #70) : un canal jamais connecté — l'utilisateur est revenu en arrière — se
// REPREND sous le nouveau choix, jamais un second à côté ; jusqu'à dix boîtes
// e-mail par compte et un seul WhatsApp (M24) ; sinon le canal naît en
// attente, avec le fournisseur derrière le canal et le fournisseur de
// messagerie choisi pour rouvrir la même page.

async function compte(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  return { account, db: tenantDb(account.id) };
}

async function connecter(channelId: string, externalAccountId: string) {
  await prisma.channelConfig.updateMany({
    where: { channelId },
    data: { externalAccountId, status: "connected" },
  });
}

describe("prepareChannelConnection", () => {
  it("crée en attente, reprend l'orphelin, et une seconde boîte vit à côté d'une boîte connectée", async () => {
    const { db } = await compte("prep@test.fr");

    const premiere = await prepareChannelConnection(db, {
      type: "email",
      name: "Gmail",
      mailProvider: "GOOGLE",
    });
    expect(premiere.reprise).toBe(false);
    const cree = await db.channel.findFirstOrThrow({
      where: { id: premiere.channel.id },
      include: { config: true },
    });
    expect(cree.config?.status).toBe("pending");
    expect(cree.config?.provider).toBe("unipile");
    expect(isNeverConnected(cree)).toBe(true);
    expect(mailProviderOf(cree.config)).toBe("GOOGLE");

    // Revenu en arrière, l'utilisateur choisit Outlook : même canal, renommé.
    const reprise = await prepareChannelConnection(db, {
      type: "email",
      name: "Outlook",
      mailProvider: "OUTLOOK",
    });
    expect(reprise.reprise).toBe(true);
    expect(reprise.channel.id).toBe(premiere.channel.id);
    expect(await db.channel.count({ where: { type: "email" } })).toBe(1);
    const repris = await db.channel.findFirstOrThrow({
      where: { id: premiere.channel.id },
      include: { config: true },
    });
    expect(repris.name).toBe("Outlook");
    expect(mailProviderOf(repris.config)).toBe("OUTLOOK");

    // Connectée chez le fournisseur : plus un orphelin — et une SECONDE boîte
    // se prépare à côté (M24), sous le relais Gmail cette fois.
    await connecter(premiere.channel.id, "acc_prep");
    const seconde = await prepareChannelConnection(db, {
      type: "email",
      name: "Gmail",
      provider: "gmail",
    });
    expect(seconde.reprise).toBe(false);
    expect(seconde.channel.id).not.toBe(premiere.channel.id);
    const secondeRow = await db.channel.findFirstOrThrow({
      where: { id: seconde.channel.id },
      include: { config: true },
    });
    expect(secondeRow.config?.provider).toBe("gmail");
    expect(await db.channel.count({ where: { type: "email" } })).toBe(2);

    // Un orphelin se reprend même quand des boîtes connectées existent.
    const encore = await prepareChannelConnection(db, {
      type: "email",
      name: "Une autre boîte",
      mailProvider: "MAIL",
    });
    expect(encore.reprise).toBe(true);
    expect(encore.channel.id).toBe(seconde.channel.id);
    expect(await db.channel.count({ where: { type: "email" } })).toBe(2);

    // WhatsApp reste unique.
    const wa = await prepareChannelConnection(db, {
      type: "whatsapp",
      name: "WhatsApp",
    });
    expect(wa.reprise).toBe(false);
    const waRow = await db.channel.findFirstOrThrow({
      where: { id: wa.channel.id },
      include: { config: true },
    });
    expect(mailProviderOf(waRow.config)).toBeNull();
    await connecter(wa.channel.id, "acc_wa");
    await expect(
      prepareChannelConnection(db, { type: "whatsapp", name: "WhatsApp" }),
    ).rejects.toThrow(/WhatsApp est déjà connecté/);
  });

  it("refuse la onzième boîte e-mail, pas la dixième", async () => {
    const { db } = await compte("dix@test.fr");
    for (let i = 0; i < MAX_EMAIL_CHANNELS; i++) {
      const c = await prepareChannelConnection(db, {
        type: "email",
        name: `Boîte ${i + 1}`,
      });
      expect(c.reprise).toBe(false);
      await connecter(c.channel.id, `acc_dix_${i}`);
    }
    expect(await db.channel.count({ where: { type: "email" } })).toBe(
      MAX_EMAIL_CHANNELS,
    );
    await expect(
      prepareChannelConnection(db, { type: "email", name: "Onzième" }),
    ).rejects.toThrow(/Dix boîtes e-mail/);
  });
});

describe("le fournisseur derrière un canal", () => {
  it("n'est que l'agrégateur ou le relais Gmail — la base le tient", async () => {
    const { db } = await compte("fournisseur@test.fr");
    const c = await prepareChannelConnection(db, {
      type: "email",
      name: "Boîte",
    });
    await expect(
      prisma.channelConfig.updateMany({
        where: { channelId: c.channel.id },
        data: { provider: "pigeon" },
      }),
    ).rejects.toThrow(/channel_configs_provider_check/);
  });
});
