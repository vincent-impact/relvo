import { describe, expect, it } from "vitest";
import {
  isNeverConnected,
  mailProviderOf,
  prepareChannelConnection,
  prisma,
  tenantDb,
} from "../src/index";

// Préparer la connexion d'un canal avant la page du fournisseur (PITFALLS
// #70) : un canal jamais connecté — l'utilisateur est revenu en arrière — se
// REPREND sous le nouveau choix, jamais un second à côté ; un canal connecté
// du même type est un conflit ; sinon le canal naît en attente, avec le
// fournisseur de messagerie choisi pour rouvrir la même page.

describe("prepareChannelConnection", () => {
  it("crée en attente, reprend l'orphelin, refuse à côté d'un canal connecté", async () => {
    const account = await prisma.account.create({
      data: { email: "prep@test.fr", firstName: "Test", lastName: "User" },
    });
    const db = tenantDb(account.id);

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

    // Connecté chez le fournisseur : plus un orphelin, et un second est refusé.
    await prisma.channelConfig.updateMany({
      where: { channelId: premiere.channel.id },
      data: { externalAccountId: "acc_prep", status: "connected" },
    });
    await expect(
      prepareChannelConnection(db, { type: "email", name: "Gmail" }),
    ).rejects.toThrow(/déjà connectée/);
    // Un autre type reste libre.
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
  });
});
