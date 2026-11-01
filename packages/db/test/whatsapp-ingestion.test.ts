import { describe, expect, it } from "vitest";
import {
  MessageDirection,
  MessageStatus,
  SubjectStatus,
  assignMessageToSubject,
  createMessage,
  createSubject,
  createSubjectFromMessage,
  createTask,
  ingestInboundWhatsApp,
  ingestOutboundWhatsApp,
  listerConversationsFantomes,
  prisma,
  reparerConversationsFantomes,
  sendWhatsAppReply,
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

// M7 tranche 11 — une réponse envoyée DEPUIS LE TÉLÉPHONE du dirigeant entre
// dans Relvo comme un envoi : même conversation directe, rattachée à le sujet
// qui l'écoute, la tâche de réponse cochée par correspondance ; nos propres
// envois (déjà en base sous le même identifiant) ne sont jamais dupliqués ;
// un fil inconnu n'est pas inventé.
describe("ingestOutboundWhatsApp — la réponse envoyée depuis le téléphone", () => {
  it("rejoint la conversation directe et le sujet qui l'écoute, et coche la tâche de réponse", async () => {
    const { channel, db } = await makeAccountWithChannel("wa-out@test.fr");
    const { message: entrant } = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "in-1",
      externalThreadId: "chat-ilies",
      senderRaw: "+33611223344",
      senderName: "Ilies Cadeau",
      content: "On se voit vendredi ?",
    });
    const subject = await createSubjectFromMessage(db, entrant.id);
    const tache = await createTask(db, {
      subjectId: subject.id,
      title: "Répondre à Ilies pour fixer l'échange",
      kind: "reply",
    });

    const { message, created } = await ingestOutboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "out-phone-1",
      externalThreadId: "chat-ilies",
      content: "Vendredi 14h au Conseil régional, ça marche",
    });
    expect(created).toBe(true);
    expect(message?.direction).toBe(MessageDirection.outgoing);
    expect(message?.conversationId).toBe(entrant.conversationId);
    expect(message?.subjectId).toBe(subject.id);
    expect(message?.recipientContactId).toBe(subject.contactIds[0]);
    // Une seule conversation directe, pas une seconde « où l'on se parle tout seul ».
    expect(await db.conversation.count()).toBe(1);
    // La tâche de réponse est cochée par correspondance (05 §4.1), et
    // le sujet attend la réponse.
    const t = await db.task.findFirstOrThrow({ where: { id: tache.id } });
    expect(t.status).toBe("done");
    const s = await db.subject.findFirstOrThrow({ where: { id: subject.id } });
    expect(s.waitingForReply).toBe(true);
  });

  it("ne duplique jamais l'écho d'un envoi fait depuis Relvo, ni un rejeu", async () => {
    const { channel, db } = await makeAccountWithChannel("wa-echo@test.fr");
    const { message: entrant } = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "in-1",
      externalThreadId: "chat-ilies",
      senderRaw: "+33611223344",
      content: "Bonjour",
    });
    const subject = await createSubjectFromMessage(db, entrant.id);
    // Un envoi depuis Relvo : en base sous l'identifiant que l'agrégateur rend.
    await createMessage(db, {
      channelId: channel.id,
      direction: MessageDirection.outgoing,
      subjectId: subject.id,
      recipientContactId: subject.contactIds[0],
      externalId: "sent-by-relvo",
      externalThreadId: "chat-ilies",
      content: "Oui",
    });
    const echo = await ingestOutboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "sent-by-relvo",
      externalThreadId: "chat-ilies",
      content: "Oui",
    });
    expect(echo.created).toBe(false);
    expect(echo.message?.externalId).toBe("sent-by-relvo");
    const once = await ingestOutboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "out-phone-2",
      externalThreadId: "chat-ilies",
      content: "À vendredi",
    });
    const twice = await ingestOutboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "out-phone-2",
      externalThreadId: "chat-ilies",
      content: "À vendredi",
    });
    expect(once.created).toBe(true);
    expect(twice.created).toBe(false);
    expect(await db.message.count()).toBe(3);
  });

  it("n'invente rien sur un fil inconnu, et reste orphelin sans écoute", async () => {
    const { channel, db } = await makeAccountWithChannel("wa-unk@test.fr");
    const inconnu = await ingestOutboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "out-phone-3",
      externalThreadId: "chat-jamais-vu",
      content: "Bonjour, c'est Mam's",
    });
    expect(inconnu).toEqual({ message: null, created: false });
    expect(await db.message.count()).toBe(0);

    const { message: entrant } = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "in-1",
      externalThreadId: "chat-lea",
      senderRaw: "+33677777777",
      content: "Vous êtes ouverts dimanche ?",
    });
    const sortant = await ingestOutboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "out-phone-4",
      externalThreadId: "chat-lea",
      content: "Oui, jusqu'à 22h",
    });
    expect(sortant.created).toBe(true);
    expect(sortant.message?.conversationId).toBe(entrant.conversationId);
    expect(sortant.message?.subjectId).toBeNull();
  });
});

// Un faux agrégateur : rend un identifiant par envoi, comme Unipile.
function fauxEnvoyeur() {
  let n = 0;
  return { sendMessage: async () => ({ messageId: `sent-${++n}` }) };
}

async function connecter(accountId: string, channelId: string) {
  await prisma.channelConfig.create({
    data: {
      accountId,
      channelId,
      provider: "unipile",
      externalAccountId: `unipile-${channelId}`,
      status: "connected",
    },
  });
}

describe("sendWhatsAppReply — la réponse envoyée depuis Relvo (PITFALLS #75)", () => {
  it("retombe dans la conversation DIRECTE du fil, sans contact passé par l'écran", async () => {
    const { account, channel, db } =
      await makeAccountWithChannel("wa-reply@test.fr");
    await connecter(account.id, channel.id);
    const { message: entrant } = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "in-1",
      externalThreadId: "chat-hamou",
      // La forme brute de l'agrégateur, qui ne ressemble pas au téléphone du contact.
      senderRaw: "33611223344@s.whatsapp.net",
      senderName: "Hamou",
      content: "Le devis est prêt ?",
    });
    const subject = await createSubjectFromMessage(db, entrant.id);

    const envoye = await sendWhatsAppReply(db, fauxEnvoyeur(), {
      subjectId: subject.id,
      channelId: channel.id,
      chatId: "chat-hamou",
      body: "Oui, je vous l'envoie ce soir.",
    });
    expect(envoye.conversationId).toBe(entrant.conversationId);
    expect(envoye.subjectId).toBe(subject.id);
    expect(envoye.recipientContactId).toBe(subject.contactIds[0]);
    expect(await db.conversation.count()).toBe(1);
    // L'écho de l'agrégateur ne duplique rien.
    const echo = await ingestOutboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "sent-1",
      externalThreadId: "chat-hamou",
      content: "Oui, je vous l'envoie ce soir.",
    });
    expect(echo.created).toBe(false);
    expect(await db.message.count()).toBe(2);
  });

  it("retombe dans le GROUPE quand le fil est un groupe", async () => {
    const { account, channel, db } = await makeAccountWithChannel(
      "wa-reply-grp@test.fr",
    );
    await connecter(account.id, channel.id);
    const { message: entrant } = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "in-g1",
      externalThreadId: "chat-equipe",
      senderRaw: "33611223344@s.whatsapp.net",
      senderName: "Karim",
      isGroup: true,
      content: "Qui ouvre demain ?",
    });
    const subject = await createSubjectFromMessage(db, entrant.id);
    const envoye = await sendWhatsAppReply(db, fauxEnvoyeur(), {
      subjectId: subject.id,
      channelId: channel.id,
      chatId: "chat-equipe",
      body: "Moi.",
    });
    expect(envoye.conversationId).toBe(entrant.conversationId);
    expect(envoye.isGroup).toBe(true);
    expect(await db.conversation.count()).toBe(1);
  });

  it("réparation : une conversation fantôme se fond dans celle du fil, écoutes comprises", async () => {
    const { channel, db } = await makeAccountWithChannel("wa-fantome@test.fr");
    const { message: entrant } = await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "in-f1",
      externalThreadId: "chat-lila",
      senderRaw: "33699999999@s.whatsapp.net",
      senderName: "Lila",
      content: "Bonjour",
    });
    const subject = await createSubjectFromMessage(db, entrant.id);
    // Le fantôme, tel que l'ancien code le fabriquait : un sortant sans
    // interlocuteur, rangé sous la clé de fil.
    const fantome = await createMessage(db, {
      channelId: channel.id,
      direction: MessageDirection.outgoing,
      subjectId: subject.id,
      externalId: "sent-old",
      externalThreadId: "chat-lila",
      content: "Bonjour Lila",
    });
    expect(fantome.conversationId).not.toBe(entrant.conversationId);
    await db.subjectConversation.create({
      data: { subjectId: subject.id, conversationId: fantome.conversationId },
    });
    expect(await db.conversation.count()).toBe(2);

    const avant = await listerConversationsFantomes(db);
    expect(avant).toHaveLength(1);
    expect(avant[0].cibleId).toBe(entrant.conversationId);
    expect(avant[0].messages).toBe(1);

    const fondues = await reparerConversationsFantomes(db);
    expect(fondues).toHaveLength(1);
    expect(await db.conversation.count()).toBe(1);
    const deplace = await db.message.findFirstOrThrow({
      where: { id: fantome.id },
    });
    expect(deplace.conversationId).toBe(entrant.conversationId);
    const cible = await db.conversation.findFirstOrThrow({
      where: { id: entrant.conversationId },
    });
    expect(cible.lastMessageId).toBe(fantome.id);
    // L'écoute du sujet existait déjà sur la vraie conversation : une seule reste.
    expect(
      await db.subjectConversation.count({
        where: { subjectId: subject.id },
      }),
    ).toBe(1);
    // Une seconde passe ne fait rien.
    expect(await reparerConversationsFantomes(db)).toHaveLength(0);
  });
});

// Le fil porte ENCORE un fantôme (le dirigeant a choisi de ne pas réécrire
// l'historique) : la réponse ne doit pas y retomber — ni depuis Relvo, ni
// depuis le téléphone.
async function filAvecFantome(email: string) {
  const { account, channel, db } = await makeAccountWithChannel(email);
  await connecter(account.id, channel.id);
  const { message: entrant } = await ingestInboundWhatsApp(db, {
    channelId: channel.id,
    externalId: "in-p1",
    externalThreadId: "chat-sami",
    senderRaw: "33677777777@s.whatsapp.net",
    senderName: "Sami",
    content: "On se voit demain ?",
  });
  const subject = await createSubjectFromMessage(db, entrant.id);
  const fantome = await createMessage(db, {
    channelId: channel.id,
    direction: MessageDirection.outgoing,
    subjectId: subject.id,
    externalId: "sent-old",
    externalThreadId: "chat-sami",
    content: "Oui",
  });
  expect(fantome.conversationId).not.toBe(entrant.conversationId);
  expect(await db.conversation.count()).toBe(2);
  // La vraie conversation continue de vivre APRÈS le fantôme : chaque message
  // reçu la met à jour. C'est ce qui, en production, faisait rendre le
  // fantôme par une recherche « la première qui vient ».
  for (let i = 2; i <= 4; i++) {
    await ingestInboundWhatsApp(db, {
      channelId: channel.id,
      externalId: `in-p${i}`,
      externalThreadId: "chat-sami",
      senderRaw: "33677777777@s.whatsapp.net",
      senderName: "Sami",
      content: `Message ${i}`,
    });
  }
  return { channel, db, entrant, subject, fantome };
}

describe("un fil qui porte encore une conversation fantôme (PITFALLS #75)", () => {
  it("la réponse envoyée depuis Relvo retombe dans la vraie conversation, désignée par l'écran", async () => {
    const { channel, db, entrant, subject } = await filAvecFantome(
      "wa-fantome-ecran@test.fr",
    );
    const envoye = await sendWhatsAppReply(db, fauxEnvoyeur(), {
      subjectId: subject.id,
      channelId: channel.id,
      chatId: "chat-sami",
      conversationId: entrant.conversationId,
      body: "À 10 h.",
    });
    expect(envoye.conversationId).toBe(entrant.conversationId);
    expect(await db.conversation.count()).toBe(2);
  });

  it("…et même sans conversation désignée, le fantôme n'est jamais choisi", async () => {
    const { channel, db, entrant, subject } = await filAvecFantome(
      "wa-fantome-fil@test.fr",
    );
    const envoye = await sendWhatsAppReply(db, fauxEnvoyeur(), {
      subjectId: subject.id,
      channelId: channel.id,
      chatId: "chat-sami",
      body: "À 10 h.",
    });
    expect(envoye.conversationId).toBe(entrant.conversationId);
    expect(envoye.recipientContactId).toBe(subject.contactIds[0]);
    expect(await db.conversation.count()).toBe(2);
  });

  it("la réponse écrite depuis le téléphone retombe aussi dans la vraie conversation", async () => {
    const { channel, db, entrant } = await filAvecFantome(
      "wa-fantome-tel@test.fr",
    );
    const { message, created } = await ingestOutboundWhatsApp(db, {
      channelId: channel.id,
      externalId: "sent-phone",
      externalThreadId: "chat-sami",
      content: "Je confirme.",
    });
    expect(created).toBe(true);
    expect(message?.conversationId).toBe(entrant.conversationId);
    expect(await db.conversation.count()).toBe(2);
  });
});
