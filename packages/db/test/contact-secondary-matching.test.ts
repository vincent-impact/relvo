import { describe, expect, it } from "vitest";
import {
  createContact,
  ingestInboundEmail,
  ingestInboundWhatsApp,
  prisma,
  tenantDb,
} from "../src/index";

// Rattachement des messages entrants aux coordonnées SECONDAIRES d'un contact
// (2026-07-28). Un contact peut porter plusieurs e-mails/numéros ; un message
// venu d'une adresse ou d'un numéro secondaire doit résoudre le MÊME contact
// (senderContactId), pas tomber orphelin ni créer un doublon.

async function makeAccount(email: string, type: "email" | "whatsapp") {
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  const channel = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: type === "email" ? "Boîte email" : "WhatsApp",
      type,
      identifier: type === "email" ? email : "+33600000000",
    },
  });
  return { account, channel, db: tenantDb(account.id) };
}

describe("rattachement sur coordonnée secondaire", () => {
  it("email : un entrant d'une adresse SECONDAIRE résout le contact", async () => {
    const { db, channel } = await makeAccount("sec-mail@test.fr", "email");
    const contact = await createContact(db, {
      lastName: "Benali",
      firstName: "Karim",
      email: "karim@sogood.fr",
      additionalEmails: ["karim.perso@gmail.com"],
      sourceActor: "user",
    });

    // Casse différente de celle saisie → on vérifie l'insensibilité.
    const { message } = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "sec-email-1",
      senderRaw: "Karim.Perso@Gmail.com",
      subjectLine: "Devis",
      content: "Voici le devis.",
    });

    expect(message.senderContactId).toBe(contact.id);
  });

  it("whatsapp : un entrant d'un numéro SECONDAIRE résout le contact", async () => {
    const { db, channel } = await makeAccount("sec-wa@test.fr", "whatsapp");
    const contact = await createContact(db, {
      lastName: "Benali",
      firstName: "Karim",
      phone: "+33612345678",
      additionalPhones: ["+33699998888"],
      sourceActor: "user",
    });

    const { message } = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "sec-wa-1",
      externalThreadId: "chat-sec",
      senderRaw: "+33699998888",
      content: "C'est Karim sur mon autre numéro.",
    });

    expect(message.senderContactId).toBe(contact.id);
  });

  it("email : les adresses secondaires sont stockées en minuscules", async () => {
    const { db } = await makeAccount("norm-mail@test.fr", "email");
    const contact = await createContact(db, {
      lastName: "Blanchard",
      additionalEmails: ["Sophie.RH@Exemple.FR"],
      sourceActor: "user",
    });
    const stored = await db.contact.findFirstOrThrow({
      where: { id: contact.id },
      select: { additionalEmails: true },
    });
    expect(stored.additionalEmails).toEqual(["sophie.rh@exemple.fr"]);
  });
});
