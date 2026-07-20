import { describe, expect, it } from "vitest";
import {
  MessageDirection,
  MessageStatus,
  SubjectStatus,
  assignMessageToSubject,
  createSubject,
  createSubjectFromMessage,
  ingestInboundWhatsApp,
  prisma,
  tenantDb,
  updateSubjectStatus,
} from "../src/index";

// Ingestion WhatsApp entrante (M6/M6bis) — mêmes garanties que l'email, plus une
// spécificité : WhatsApp n'a PAS d'objet, donc l'identité de la conversation
// tient au FIL (`wa-group:<chat_id>`) ou au numéro (`wa-direct:<numéro>`), pas à
// un objet normalisé. On vérifie :
//   1. un message reçu hors de toute fenêtre reste « Sans sujet » ;
//   2. idempotence (channelId + externalId) ;
//   3. règle d'ancrage : la fenêtre ouverte capte la suite du fil ;
//   4. un sujet FERMÉ ne capte plus rien ;
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

describe("règle d'ancrage à la réception (WhatsApp)", () => {
  /** Ingère un 1er message d'un fil PUIS ouvre une fenêtre de sujet dessus. */
  async function openWindowOnChat(
    db: ReturnType<typeof tenantDb>,
    channelId: string,
    opts: { externalId: string; chatId: string; sender: string },
  ) {
    const { message } = await ingestInboundWhatsApp(db, {
      channelId,
      externalId: opts.externalId,
      externalThreadId: opts.chatId,
      senderRaw: opts.sender,
      content: "Message initial",
    });
    expect(message.subjectId).toBeNull();
    return { message, subject: await createSubjectFromMessage(db, message.id) };
  }

  it("la suite du fil tombe dans le sujet de la fenêtre ouverte", async () => {
    const { channel, db } = await makeAccountWithChannel("wa-attach@test.fr");
    const { subject } = await openWindowOnChat(db, channel.id, {
      externalId: "wa-anchor",
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

  it("laisse sans sujet le premier message d'un fil inconnu", async () => {
    const { channel, db } = await makeAccountWithChannel("wa-new@test.fr");
    await openWindowOnChat(db, channel.id, {
      externalId: "wa-anchor-2",
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

  // Remède au « groupe WhatsApp bavard » côté sujet : la fenêtre refermée ne
  // capte plus rien. (L'autre remède, plus radical, est d'ignorer la
  // conversation elle-même — cf. conversations.test.ts.)
  it("un sujet fermé ne capte plus les nouveaux messages du fil", async () => {
    const { channel, db } = await makeAccountWithChannel("wa-closed@test.fr");
    const { subject } = await openWindowOnChat(db, channel.id, {
      externalId: "wa-anchor-closed",
      chatId: "chat-bavard",
      sender: "33600000002@s.whatsapp.net",
    });
    await updateSubjectStatus(db, subject.id, SubjectStatus.closed);

    const { message } = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "wa-into-closed",
      externalThreadId: "chat-bavard",
      senderRaw: "33600000002@s.whatsapp.net",
      content: "Encore un message.",
    });

    expect(message.subjectId).toBeNull();
  });
});

// Le balayage des « frères orphelins » est SUPPRIMÉ (M6bis) : dans un fil
// WhatsApp direct où l'on parle tour à tour de la sauce blanche et de la facture
// emballages, rattacher un message emportait tout le fil. On teste le contraire.
describe("assignMessageToSubject ne touche qu'un message (WhatsApp)", () => {
  it("rattacher un message laisse les autres messages du fil intacts", async () => {
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
    expect(a.message.conversationId).toBe(b.message.conversationId);
    expect(a.message.subjectId).toBeNull();
    expect(b.message.subjectId).toBeNull();

    const subject = await createSubject(db, {
      title: "Commande sauce",
      contactIds: [],
      createdByActor: "user",
    });
    await assignMessageToSubject(db, a.message.id, subject.id);

    const aAfter = await db.message.findFirst({ where: { id: a.message.id } });
    const bAfter = await db.message.findFirst({ where: { id: b.message.id } });
    expect(aAfter?.subjectId).toBe(subject.id);
    expect(aAfter?.status).toBe(MessageStatus.linked);
    // Le voisin du même fil ne suit PAS, et aucune fenêtre n'est ouverte.
    expect(bAfter?.subjectId).toBeNull();
    expect(await db.subjectConversation.count()).toBe(0);
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
