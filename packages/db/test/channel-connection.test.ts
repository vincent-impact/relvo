import { describe, expect, it } from "vitest";
import {
  MAX_EMAIL_CHANNELS,
  completeChannelConnection,
  isDomainError,
  isNeverConnected,
  prepareChannelConnection,
  prisma,
  tenantDb,
} from "../src/index";

// Préparer la connexion d'un canal avant la page du fournisseur (PITFALLS
// #70) : un canal jamais connecté — l'utilisateur est revenu en arrière — se
// REPREND sous le nouveau choix, jamais un second à côté ; jusqu'à dix boîtes
// e-mail par compte et un seul WhatsApp (M24) ; sinon le canal naît en
// attente, avec le fournisseur derrière le canal.

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
      name: "Boîte e-mail",
    });
    expect(premiere.reprise).toBe(false);
    const cree = await db.channel.findFirstOrThrow({
      where: { id: premiere.channel.id },
      include: { config: true },
    });
    expect(cree.config?.status).toBe("pending");
    expect(cree.config?.provider).toBe("unipile");
    expect(isNeverConnected(cree)).toBe(true);

    // Revenu en arrière, l'utilisateur recommence — par le relais Gmail cette
    // fois : même canal, renommé, sous l'autre fournisseur.
    const reprise = await prepareChannelConnection(db, {
      type: "email",
      name: "Boîte Gmail",
      provider: "gmail",
    });
    expect(reprise.reprise).toBe(true);
    expect(reprise.channel.id).toBe(premiere.channel.id);
    expect(await db.channel.count({ where: { type: "email" } })).toBe(1);
    const repris = await db.channel.findFirstOrThrow({
      where: { id: premiere.channel.id },
      include: { config: true },
    });
    expect(repris.name).toBe("Boîte Gmail");
    expect(repris.config?.provider).toBe("gmail");

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
      name: "Boîte Gmail",
      provider: "gmail",
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

describe("completeChannelConnection", () => {
  it("relie la boîte au canal préparé, refuse la boîte déjà reliée, reconnecte la même", async () => {
    const { db } = await compte("fin-gmail@test.local");
    const { channel } = await prepareChannelConnection(db, {
      type: "email",
      name: "Boîte e-mail",
      provider: "gmail",
    });
    const relie = await completeChannelConnection(db, channel.id, {
      externalAccountId: "moi@tastycrousty.fr",
      identifier: "moi@tastycrousty.fr",
      connectionData: { jetons: { rafraichissement: "chiffré" } },
    });
    expect(relie.identifier).toBe("moi@tastycrousty.fr");
    expect(relie.name).toBe("moi@tastycrousty.fr");
    expect(relie.config?.status).toBe("connected");
    expect(relie.config?.externalAccountId).toBe("moi@tastycrousty.fr");
    expect(relie.config?.connectionData).toEqual({
      jetons: { rafraichissement: "chiffré" },
    });
    expect(isNeverConnected(relie)).toBe(false);

    // La même boîte sur une seconde ligne du même compte : un conflit, et la
    // seconde ligne reste à reprendre (#70).
    const { channel: seconde } = await prepareChannelConnection(db, {
      type: "email",
      name: "Boîte e-mail",
      provider: "gmail",
    });
    expect(seconde.id).not.toBe(channel.id);
    await expect(
      completeChannelConnection(db, seconde.id, {
        externalAccountId: "moi@tastycrousty.fr",
        identifier: "moi@tastycrousty.fr",
      }),
    ).rejects.toSatisfy(
      (e: unknown) => isDomainError(e) && e.code === "CONFLICT",
    );
    expect(
      isNeverConnected(
        (await db.channel.findFirst({
          where: { id: seconde.id },
          include: { config: true },
        }))!,
      ),
    ).toBe(true);

    // Et depuis un AUTRE compte : la boîte est prise, tous comptes confondus.
    const autre = await compte("fin-gmail-2@test.local");
    const { channel: ailleurs } = await prepareChannelConnection(autre.db, {
      type: "email",
      name: "Boîte e-mail",
      provider: "gmail",
    });
    await expect(
      completeChannelConnection(autre.db, ailleurs.id, {
        externalAccountId: "moi@tastycrousty.fr",
        identifier: "moi@tastycrousty.fr",
      }),
    ).rejects.toSatisfy(
      (e: unknown) => isDomainError(e) && e.code === "CONFLICT",
    );

    // Reconnecter la même boîte sur son canal : les données changent, rien d'autre.
    const reconnecte = await completeChannelConnection(db, channel.id, {
      externalAccountId: "moi@tastycrousty.fr",
      identifier: "moi@tastycrousty.fr",
      connectionData: { jetons: { rafraichissement: "nouveau" } },
    });
    expect(reconnecte.config?.connectionData).toEqual({
      jetons: { rafraichissement: "nouveau" },
    });
    // Une autre adresse sur ce canal, elle, est refusée.
    await expect(
      completeChannelConnection(db, channel.id, {
        externalAccountId: "autre@tastycrousty.fr",
        identifier: "autre@tastycrousty.fr",
      }),
    ).rejects.toSatisfy(
      (e: unknown) => isDomainError(e) && e.code === "CONFLICT",
    );
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
