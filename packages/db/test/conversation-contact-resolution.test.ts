import { describe, expect, it } from "vitest";
import {
  createContact,
  getConversationThread,
  ingestInboundWhatsApp,
  prisma,
  tenantDb,
} from "../src/index";

// Résolution d'appartenance au READ TIME (2026-07-28). `conversation.contactId`
// est figé à la création du fil ; un contact enregistré APRÈS (saisie manuelle)
// n'était pas reconnu → l'avatar proposait de le « créer » avec des infos
// périmées. Le thread doit désormais reconnaître le contact à la lecture.

async function makeWhatsApp(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  const channel = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "WhatsApp",
      type: "whatsapp",
      identifier: "+33600000000",
    },
  });
  return { account, channel, db: tenantDb(account.id) };
}

describe("résolution read-time du contact d'une conversation", () => {
  it("reconnaît un contact enregistré APRÈS le message (thread direct)", async () => {
    const { db, channel } = await makeWhatsApp("resolve-wa@test.fr");
    const { message } = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "rt-1",
      externalThreadId: "chat-rt",
      senderRaw: "+33677889900",
      senderName: "Fred (profil WhatsApp)",
      content: "Salut",
    });
    const conversationId = message.conversationId!;

    // Au moment du message : aucun contact → interlocuteur non rattaché.
    let thread = await getConversationThread(db, conversationId);
    expect(thread.participants[0]?.contactId).toBeNull();

    // On enregistre le contact APRÈS coup (même numéro).
    const contact = await createContact(db, {
      lastName: "Tardivon",
      firstName: "Frédéric",
      phone: "+33677889900",
      sourceActor: "user",
    });

    // Le thread reconnaît le contact et affiche son nom à jour.
    thread = await getConversationThread(db, conversationId);
    expect(thread.contactId).toBe(contact.id);
    expect(thread.participants[0]?.contactId).toBe(contact.id);
    expect(thread.interlocutorName).toBe("Frédéric Tardivon");
  });
});
