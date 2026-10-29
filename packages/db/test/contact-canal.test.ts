import { describe, expect, it } from "vitest";
import {
  canalPrioritaireDuContact,
  canauxPrioritairesDesContacts,
  createContact,
  createSubject,
  extendSubjectToConversation,
  ingestInboundEmail,
  prisma,
  tenantDb,
} from "../src/index";

// LE CANAL PAR LEQUEL UN CONTACT NOUS JOINT (M24.8) : déduit du dernier message
// reçu de lui, jamais saisi ; c'est la boîte qui lui écrit la première.

async function compte(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  return { account, db: tenantDb(account.id) };
}

async function boite(accountId: string, identifier: string, createdAt: Date) {
  const ch = await prisma.channel.create({
    data: { accountId, name: identifier, type: "email", identifier, createdAt },
  });
  await prisma.channelConfig.create({
    data: {
      accountId,
      channelId: ch.id,
      provider: "gmail",
      externalAccountId: identifier,
      status: "connected",
    },
  });
  return ch;
}

describe("canalPrioritaireDuContact", () => {
  it("est celui du dernier message reçu, et la boîte par défaut pour lui écrire", async () => {
    const { account, db } = await compte("canal-contact@test.local");
    const aub = await boite(
      account.id,
      "aubervilliers@test.local",
      new Date("2026-01-01"),
    );
    const mat = await boite(
      account.id,
      "matignon@test.local",
      new Date("2026-02-01"),
    );
    const karim = await createContact(db, {
      firstName: "Karim",
      lastName: "Benali",
      email: "karim@sogood.fr",
    });
    expect(await canalPrioritaireDuContact(db, karim.id)).toBeNull();

    await ingestInboundEmail(db, {
      channelId: aub.id,
      externalId: "m-1",
      senderRaw: "karim@sogood.fr",
      subjectLine: "Devis",
      content: "…",
      receivedAt: new Date("2026-10-01T10:00:00Z"),
    });
    await ingestInboundEmail(db, {
      channelId: mat.id,
      externalId: "m-2",
      senderRaw: "karim@sogood.fr",
      subjectLine: "Livraison",
      content: "…",
      receivedAt: new Date("2026-10-20T10:00:00Z"),
    });
    const canal = await canalPrioritaireDuContact(db, karim.id);
    expect(canal?.channelId).toBe(mat.id);
    expect(canal?.identifier).toBe("matignon@test.local");
    expect(
      await canauxPrioritairesDesContacts(db, [
        karim.id,
        "00000000-0000-4000-8000-000000000000",
      ]),
    ).toEqual({
      [karim.id]: mat.id,
    });

    // Écrire le premier à Karim depuis un sujet : la boîte de Matignon, sauf
    // si on en choisit une autre.
    const sujet = await createSubject(db, { title: "Nouveau chantier" });
    const parDefaut = await extendSubjectToConversation(db, {
      subjectId: sujet.id,
      contactId: karim.id,
      channelType: "email",
      subjectLine: "Chantier",
    });
    expect(parDefaut.conversation.channelId).toBe(mat.id);
    const choisie = await extendSubjectToConversation(db, {
      subjectId: sujet.id,
      contactId: karim.id,
      channelType: "email",
      subjectLine: "Chantier bis",
      channelId: aub.id,
    });
    expect(choisie.conversation.channelId).toBe(aub.id);
  });
});
