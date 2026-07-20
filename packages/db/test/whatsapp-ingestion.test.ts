import { describe, expect, it } from "vitest";
import {
  MessageDirection,
  MessageStatus,
  assignMessageToSubject,
  createMessage,
  createSubject,
  createSubjectFromMessage,
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
      senderRaw: "+33612345678",
      senderName: "Leroy Frederique",
      content: "Bonjour, c'est pour la commande.",
    });

    expect(created).toBe(true);
    expect(message.subjectId).toBeNull();
    expect(message.direction).toBe(MessageDirection.incoming);
    expect(message.status).toBe(MessageStatus.received);
    expect(message.externalId).toBe("unipile-wa-1");
    expect(message.externalThreadId).toBe("chat-abc");
    expect(message.senderRaw).toBe("+33612345678");
    // Nom de profil conservé → label lisible avant la création du contact.
    expect(message.senderName).toBe("Leroy Frederique");
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

describe("balayage des frères orphelins au rattachement (par fil / chat_id)", () => {
  it("rattacher un orphelin embarque les autres orphelins du même fil", async () => {
    const { channel, db } = await makeAccountWithChannel("wa-sweep@test.fr");
    const a = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "wa-sweep-a",
      externalThreadId: "chat-sweep",
      senderRaw: "33600000010@s.whatsapp.net",
      content: "Premier message du fil.",
    });
    const b = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "wa-sweep-b",
      externalThreadId: "chat-sweep",
      senderRaw: "33600000010@s.whatsapp.net",
      content: "Deuxième message, même fil.",
    });
    // Un orphelin d'un AUTRE fil ne doit pas être embarqué.
    const other = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "wa-sweep-other",
      externalThreadId: "chat-autre",
      senderRaw: "33600000099@s.whatsapp.net",
      content: "Fil différent.",
    });
    expect(a.message.subjectId).toBeNull();
    expect(b.message.subjectId).toBeNull();

    const subject = await createSubject(db, {
      title: "Commande sauce",
      contactIds: [],
      createdByActor: "user",
    });
    await assignMessageToSubject(db, a.message.id, subject.id);

    const bAfter = await db.message.findFirst({ where: { id: b.message.id } });
    const otherAfter = await db.message.findFirst({
      where: { id: other.message.id },
    });
    expect(bAfter?.subjectId).toBe(subject.id);
    expect(bAfter?.status).toBe(MessageStatus.linked);
    expect(otherAfter?.subjectId).toBeNull();
  });
});

describe("sujet issu d'un groupe WhatsApp (1 groupe = 1 sujet, invariant n°12)", () => {
  it("un message de groupe → aucun contact enregistré, sujet sans interlocuteur", async () => {
    const { channel, db } = await makeAccountWithChannel("wa-group@test.fr");
    const { message } = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "wa-group-1",
      externalThreadId: "group-xyz@g.us",
      senderRaw: "33600000020@s.whatsapp.net",
      senderName: "Karim Benali",
      isGroup: true,
      content: "Salut l'équipe !",
    });
    expect(message.isGroup).toBe(true);

    const subject = await createSubjectFromMessage(db, message.id);

    // Le groupe est l'interlocuteur → pas de contact matérialisé en masse.
    expect(subject.contactIds).toEqual([]);
    expect(await db.contact.count()).toBe(0);
    // Le message reste rattaché ET conserve son expéditeur brut (attribution).
    const linked = await db.message.findFirst({ where: { id: message.id } });
    expect(linked?.subjectId).toBe(subject.id);
    expect(linked?.senderContactId).toBeNull();
  });

  it("un message 1:1 (non-groupe) matérialise bien le contact interlocuteur", async () => {
    const { channel, db } = await makeAccountWithChannel("wa-solo@test.fr");
    const { message } = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "wa-solo-1",
      externalThreadId: "chat-solo",
      senderRaw: "33600000021@s.whatsapp.net",
      senderName: "Sophie Blanchard",
      isGroup: false,
      content: "Bonjour",
    });

    const subject = await createSubjectFromMessage(db, message.id);

    expect(subject.contactIds).toHaveLength(1);
    expect(await db.contact.count()).toBe(1);
  });
});
