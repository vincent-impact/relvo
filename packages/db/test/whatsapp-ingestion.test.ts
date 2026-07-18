import { describe, expect, it } from "vitest";
import {
  MessageDirection,
  MessageStatus,
  createMessage,
  createSubject,
  ingestInboundWhatsApp,
  prisma,
  tenantDb,
} from "../src/index";

// Ingestion WhatsApp entrante (M6) — mêmes garanties que l'email, plus une
// spécificité : WhatsApp n'a PAS d'objet, donc le rattachement pré-M7 se fait sur
// le FIL (chat_id = externalThreadId), pas sur l'objet normalisé. On vérifie :
//   1. un message reçu devient un Message ORPHELIN (« Sans sujet ») ;
//   2. idempotence (channelId + externalId) ;
//   3. rattachement au sujet qui porte déjà un message du même chat_id ;
//   4. ignorance collante (un sujet `ignored` n'est jamais exhumé) ;
//   5. isolation par canal.

async function makeAccountWithChannel(email: string) {
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

describe("ingestInboundWhatsApp (M6)", () => {
  it("crée un Message orphelin (« Sans sujet »)", async () => {
    const { channel, db } = await makeAccountWithChannel("wa-in@test.fr");

    const { message, created } = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "unipile-wa-1",
      externalThreadId: "chat-abc",
      senderRaw: "33612345678@s.whatsapp.net",
      content: "Bonjour, c'est pour la commande.",
    });

    expect(created).toBe(true);
    expect(message.subjectId).toBeNull();
    expect(message.direction).toBe(MessageDirection.incoming);
    expect(message.status).toBe(MessageStatus.received);
    expect(message.externalId).toBe("unipile-wa-1");
    expect(message.externalThreadId).toBe("chat-abc");
    expect(message.senderRaw).toBe("33612345678@s.whatsapp.net");
    expect(message.receivedAt).not.toBeNull();
  });

  it("est idempotent : un webhook rejoué ne duplique pas le message", async () => {
    const { channel, db } = await makeAccountWithChannel("wa-dup@test.fr");
    const input = {
      channelId: channel.id,
      externalId: "unipile-wa-2",
      externalThreadId: "chat-dup",
      content: "Rappel",
    };

    const first = await ingestInboundWhatsApp(db, input);
    const second = await ingestInboundWhatsApp(db, input);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.message.id).toBe(first.message.id);
    expect(await db.message.count()).toBe(1);
  });

  it("isole par canal : même externalId sur deux canaux = deux messages", async () => {
    const { account, channel, db } =
      await makeAccountWithChannel("wa-iso@test.fr");
    const channel2 = await prisma.channel.create({
      data: {
        accountId: account.id,
        name: "WhatsApp 2",
        type: "whatsapp",
        identifier: "+33611111111",
      },
    });

    await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "shared-wa-id",
      content: "A",
    });
    const second = await ingestInboundWhatsApp(db, {
      channelId: channel2.id,
      externalId: "shared-wa-id",
      content: "B",
    });

    expect(second.created).toBe(true);
    expect(await db.message.count()).toBe(2);
  });
});

describe("rattachement WhatsApp pré-M7 (par fil / chat_id)", () => {
  /** Sème un sujet portant un message d'un fil (chat_id) donné. */
  async function seedSubjectWithChat(
    db: ReturnType<typeof tenantDb>,
    channelId: string,
    opts: { title: string; chatId: string; sender: string },
  ) {
    const subject = await createSubject(db, {
      title: opts.title,
      contactIds: [],
      createdByActor: "user",
    });
    await createMessage(db, {
      channelId,
      direction: MessageDirection.incoming,
      subjectId: subject.id,
      senderRaw: opts.sender,
      externalThreadId: opts.chatId,
      content: "Message initial",
      status: MessageStatus.linked,
    });
    return subject;
  }

  it("range le message dans le sujet quand le fil (chat_id) est déjà rattaché", async () => {
    const { channel, db } = await makeAccountWithChannel("wa-attach@test.fr");
    const subject = await seedSubjectWithChat(db, channel.id, {
      title: "Commande sauce",
      chatId: "chat-karim",
      sender: "33600000001@s.whatsapp.net",
    });

    const { message } = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "wa-reply-attach",
      externalThreadId: "chat-karim",
      senderRaw: "33600000001@s.whatsapp.net",
      content: "Merci, bien reçu.",
    });

    expect(message.subjectId).toBe(subject.id);
    expect(message.status).toBe(MessageStatus.linked);
  });

  it("laisse orphelin le premier message d'un fil inconnu", async () => {
    const { channel, db } = await makeAccountWithChannel("wa-new@test.fr");
    await seedSubjectWithChat(db, channel.id, {
      title: "Commande sauce",
      chatId: "chat-karim",
      sender: "33600000001@s.whatsapp.net",
    });

    const { message } = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "wa-other-chat",
      externalThreadId: "chat-nouveau",
      senderRaw: "33600000009@s.whatsapp.net",
      content: "Nouvelle discussion.",
    });

    expect(message.subjectId).toBeNull();
  });

  it("n'exhume pas un sujet ignoré même si le fil correspond (ignorance collante, invariant n°7)", async () => {
    const { channel, db } = await makeAccountWithChannel("wa-ignored@test.fr");
    const subject = await seedSubjectWithChat(db, channel.id, {
      title: "Groupe bavard",
      chatId: "chat-bavard",
      sender: "33600000002@s.whatsapp.net",
    });
    await db.subject.update({
      where: { id: subject.id },
      data: { status: "ignored" },
    });

    const { message } = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "wa-into-ignored",
      externalThreadId: "chat-bavard",
      senderRaw: "33600000002@s.whatsapp.net",
      content: "Encore un message.",
    });

    expect(message.subjectId).toBeNull();
  });
});
