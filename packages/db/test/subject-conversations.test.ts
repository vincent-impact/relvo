import { describe, expect, it } from "vitest";
import {
  ChannelType,
  ConversationType,
  attachConversationToSubject,
  closeSubject,
  createSubjectFromMessage,
  detachConversationFromSubject,
  ensureSubjectAnchors,
  extendSubjectToConversation,
  ignoreConversation,
  ingestInboundEmail,
  ingestInboundWhatsApp,
  listIgnorableConversations,
  listSubjectConversations,
  prisma,
  tenantDb,
} from "../src/index";

// M6bis.12 — étendre un sujet à une SECONDE conversation (cas S), plus la
// proposition d'ignorance enchaînée à une fermeture (cas Q, M6bis.11).
//
// Le vrai sujet de ce fichier est l'ASYMÉTRIE email / WhatsApp : un seul geste
// côté interface, deux mécaniques dessous. Un email crée une conversation (nouvel
// objet = nouvelle clé) ; un WhatsApp direct rattache l'existante, parce qu'il ne
// peut en exister qu'UNE par contact, pour toujours. Les tests ci-dessous
// vérifient les deux moitiés — et surtout qu'on ne fabrique jamais un second fil
// direct pour un contact déjà connu.

async function makeAccountWithChannels(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  const emailChannel = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "Boîte email",
      type: ChannelType.email,
      identifier: email,
    },
  });
  const waChannel = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "WhatsApp",
      type: ChannelType.whatsapp,
      identifier: "+33600000000",
    },
  });
  return { account, emailChannel, waChannel, db: tenantDb(account.id) };
}

/** Sujet ouvert depuis un message WhatsApp direct — le point de départ du cas S. */
async function subjectFromWhatsApp(fixtureEmail: string) {
  const ctx = await makeAccountWithChannels(fixtureEmail);
  const first = await ingestInboundWhatsApp(ctx.db, {
    channelId: ctx.waChannel.id,
    externalId: "wa-1",
    externalThreadId: "chat-karim",
    senderRaw: "33600000010@s.whatsapp.net",
    content: "Retard sur la sauce blanche",
  });
  const subject = await createSubjectFromMessage(ctx.db, first.message.id);
  return { ...ctx, subject, firstMessage: first.message };
}

// ─────────────────────────────────────────────────────────────
// 1. Cas S — l'asymétrie
// ─────────────────────────────────────────────────────────────

describe("extendSubjectToConversation (cas S)", () => {
  it("email : CRÉE une conversation, dont l'objet est le titre du sujet", async () => {
    const { db, subject } = await subjectFromWhatsApp("cas-s-mail@test.fr");
    const contact = await db.contact.create({
      data: {
        firstName: "Karim",
        lastName: "Benali",
        email: "karim@sogood.fr",
        sourceActor: "user",
      },
    });

    const res = await extendSubjectToConversation(db, {
      subjectId: subject.id,
      contactId: contact.id,
      channelType: ChannelType.email,
    });

    expect(res.created).toBe(true);
    expect(res.conversation.type).toBe(ConversationType.email_subject);
    // L'objet PRÉ-REMPLI par le titre du sujet est ce qui fera retomber la
    // réponse (« Re: <titre> ») sur la même clé, donc dans ce sujet.
    expect(res.conversation.key).toBe(
      `email:karim@sogood.fr:${subject.title.toLowerCase()}`,
    );

    // Le sujet porte maintenant DEUX conversations : c'est à ce niveau que se
    // fait la réunification entre canaux.
    const links = await listSubjectConversations(db, subject.id);
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.channelType).sort()).toEqual([
      ChannelType.email,
      ChannelType.whatsapp,
    ]);

    // Et l'interlocuteur devient un contact du sujet (→ select du composer).
    const after = await db.subject.findFirst({ where: { id: subject.id } });
    expect(after?.contactIds).toContain(contact.id);
  });

  it("la réponse du fournisseur retombe dans la conversation créée, donc dans le sujet", async () => {
    const { db, emailChannel, subject } = await subjectFromWhatsApp(
      "cas-s-reply@test.fr",
    );
    const contact = await db.contact.create({
      data: {
        firstName: "Karim",
        lastName: "Benali",
        email: "karim@sogood.fr",
        sourceActor: "user",
      },
    });
    const res = await extendSubjectToConversation(db, {
      subjectId: subject.id,
      contactId: contact.id,
      channelType: ChannelType.email,
    });

    const reply = await ingestInboundEmail(db, {
      channelId: emailChannel.id,
      externalId: "mail-1",
      senderRaw: "karim@sogood.fr",
      subjectLine: `Re: ${subject.title}`,
      content: "Je vous livre jeudi.",
    });

    expect(reply.message.conversationId).toBe(res.conversation.id);
    // Règle d'ancrage : la conversation porte une fenêtre ouverte → le message
    // y revient tout seul, sans IA.
    expect(reply.message.subjectId).toBe(subject.id);
  });

  it("WhatsApp direct : RATTACHE le fil existant au lieu d'en créer un second", async () => {
    const { db, waChannel, subject, firstMessage } =
      await subjectFromWhatsApp("cas-s-wa@test.fr");

    // Un autre sujet, ouvert manuellement, veut joindre le MÊME contact par
    // WhatsApp : le fil direct existe déjà (il porte le premier sujet).
    // On ferme d'abord le sujet initial pour libérer la conversation.
    await closeSubject(db, subject.id);
    const second = await ingestInboundEmail(db, {
      channelId: (
        await prisma.channel.findFirstOrThrow({
          where: { accountId: waChannel.accountId, type: ChannelType.email },
        })
      ).id,
      externalId: "mail-x",
      senderRaw: "compta@sogood.fr",
      subjectLine: "Facture emballages",
      content: "Voir pièce jointe",
    });
    const subjectB = await createSubjectFromMessage(db, second.message.id);

    const contact = await db.contact.create({
      data: {
        firstName: "Karim",
        lastName: "Benali",
        // Numéro tel que l'ingestion WhatsApp l'a vu — cas favorable.
        phone: "33600000010@s.whatsapp.net",
        sourceActor: "user",
      },
    });

    const before = await db.conversation.count({
      where: { type: ConversationType.whatsapp_direct },
    });
    const res = await extendSubjectToConversation(db, {
      subjectId: subjectB.id,
      contactId: contact.id,
      channelType: ChannelType.whatsapp,
    });
    const after = await db.conversation.count({
      where: { type: ConversationType.whatsapp_direct },
    });

    // Une SEULE conversation directe par contact, pour toujours.
    expect(res.created).toBe(false);
    expect(after).toBe(before);
    expect(res.conversation.id).toBe(firstMessage.conversationId);
  });

  it("WhatsApp direct : retrouve le fil par le CONTACT même si le numéro saisi diffère", async () => {
    const { db, waChannel, subject } = await subjectFromWhatsApp(
      "cas-s-wa-alias@test.fr",
    );
    // Le fil est déjà associé au contact (enrichissement à l'ouverture du sujet
    // ou saisie manuelle), mais l'utilisateur a saisi le numéro « proprement ».
    const contact = await db.contact.create({
      data: {
        firstName: "Karim",
        lastName: "Benali",
        phone: "+33 6 00 00 00 10",
        sourceActor: "user",
      },
    });
    await db.conversation.updateMany({
      where: { type: ConversationType.whatsapp_direct },
      data: { contactId: contact.id },
    });
    await closeSubject(db, subject.id);

    const mail = await ingestInboundEmail(db, {
      channelId: (
        await prisma.channel.findFirstOrThrow({
          where: { accountId: waChannel.accountId, type: ChannelType.email },
        })
      ).id,
      externalId: "mail-y",
      senderRaw: "compta@sogood.fr",
      subjectLine: "Autre affaire",
      content: "…",
    });
    const subjectB = await createSubjectFromMessage(db, mail.message.id);

    const res = await extendSubjectToConversation(db, {
      subjectId: subjectB.id,
      contactId: contact.id,
      channelType: ChannelType.whatsapp,
    });

    // Sans la recherche par contactId, on aurait fabriqué un SECOND fil direct
    // (clé « wa-direct:+33 6 00 00 00 10 ») — ce que le modèle interdit.
    expect(res.created).toBe(false);
    expect(
      await db.conversation.count({
        where: { type: ConversationType.whatsapp_direct },
      }),
    ).toBe(1);
  });

  it("refuse d'étendre un sujet fermé, et un contact sans identifiant sur ce canal", async () => {
    const { db, subject } = await subjectFromWhatsApp("cas-s-refus@test.fr");
    const sansEmail = await db.contact.create({
      data: { firstName: "Jean", lastName: "Morel", sourceActor: "user" },
    });

    await expect(
      extendSubjectToConversation(db, {
        subjectId: subject.id,
        contactId: sansEmail.id,
        channelType: ChannelType.email,
      }),
    ).rejects.toThrow(/adresse email/i);

    await closeSubject(db, subject.id);
    const avecEmail = await db.contact.create({
      data: {
        firstName: "Karim",
        lastName: "Benali",
        email: "karim@sogood.fr",
        sourceActor: "user",
      },
    });
    await expect(
      extendSubjectToConversation(db, {
        subjectId: subject.id,
        contactId: avecEmail.id,
        channelType: ChannelType.email,
      }),
    ).rejects.toThrow(/ouvert/i);
  });

  it("WhatsApp openExistingOnly : refuse quand aucun fil direct n'existe (item 4)", async () => {
    // Sujet email tout neuf — aucune conversation WhatsApp dans le compte.
    const { db, emailChannel } = await makeAccountWithChannels(
      "cas-s-wa-open-only@test.fr",
    );
    const mail = await ingestInboundEmail(db, {
      channelId: emailChannel.id,
      externalId: "mail-open-only",
      senderRaw: "compta@sogood.fr",
      subjectLine: "Nouveau",
      content: "…",
    });
    const subject = await createSubjectFromMessage(db, mail.message.id);
    const contact = await db.contact.create({
      data: {
        firstName: "Karim",
        lastName: "Benali",
        phone: "+33 6 00 00 00 99",
        sourceActor: "user",
      },
    });

    // « Ouvrir l'existant seulement » sans fil existant → refus (démarrer un
    // nouveau fil WhatsApp est reporté), et surtout AUCUN fil direct fabriqué.
    await expect(
      extendSubjectToConversation(db, {
        subjectId: subject.id,
        contactId: contact.id,
        channelType: ChannelType.whatsapp,
        openExistingOnly: true,
      }),
    ).rejects.toThrow(/WhatsApp en cours/i);
    expect(
      await db.conversation.count({
        where: { type: ConversationType.whatsapp_direct },
      }),
    ).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Règle V1 : au plus un sujet ouvert par conversation
// ─────────────────────────────────────────────────────────────

describe("attachConversationToSubject", () => {
  it("est idempotent et AUTORISE plusieurs sujets à écouter le même fil (garde levée 2026-07-24)", async () => {
    const { db, subject, firstMessage } = await subjectFromWhatsApp(
      "attach-rule@test.fr",
    );

    // Ré-attacher la même paire ne duplique rien.
    await attachConversationToSubject(db, {
      subjectId: subject.id,
      conversationId: firstMessage.conversationId,
    });
    expect(
      await db.subjectConversation.count({ where: { subjectId: subject.id } }),
    ).toBe(1);

    // Un SECOND sujet ouvert peut désormais écouter la même conversation :
    // 0, 1 ou plusieurs sujets par fil (plus de garde CONFLICT).
    const other = await db.subject.create({
      data: {
        reference: "SUB-90001",
        title: "Autre affaire",
        createdByActor: "user",
      },
    });
    await attachConversationToSubject(db, {
      subjectId: other.id,
      conversationId: firstMessage.conversationId,
    });
    expect(await listSubjectConversations(db, other.id)).toHaveLength(1);
    expect(
      await db.subjectConversation.count({
        where: { conversationId: firstMessage.conversationId },
      }),
    ).toBe(2);
  });

  it("detach retire la fenêtre du sujet sans toucher à la conversation", async () => {
    const { db, subject, firstMessage } = await subjectFromWhatsApp(
      "attach-detach@test.fr",
    );
    await detachConversationFromSubject(
      db,
      subject.id,
      firstMessage.conversationId,
    );
    expect(await listSubjectConversations(db, subject.id)).toHaveLength(0);
    expect(
      await db.conversation.count({
        where: { id: firstMessage.conversationId },
      }),
    ).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. L'ancre posée après coup
// ─────────────────────────────────────────────────────────────

describe("ensureSubjectAnchors", () => {
  // ⚠️ M6ter — un lien EMAIL n'est JAMAIS ancré : le sujet EST le fil, ancre
  // nulle = tout le fil. L'appartenance d'un email au sujet passe par le lien
  // PERMANENT (règle d'ancrage à la réception), pas par une borne de début.
  // `ensureSubjectAnchors` ne pose donc d'ancre que sur les écoutes WhatsApp.
  it("ne pose AUCUNE ancre sur une conversation email étendue (le fil entier appartient au sujet)", async () => {
    const { db, emailChannel, subject } = await subjectFromWhatsApp(
      "anchor-late@test.fr",
    );
    const contact = await db.contact.create({
      data: {
        firstName: "Karim",
        lastName: "Benali",
        email: "karim@sogood.fr",
        sourceActor: "user",
      },
    });
    const res = await extendSubjectToConversation(db, {
      subjectId: subject.id,
      contactId: contact.id,
      channelType: ChannelType.email,
    });

    // Au rattachement, ancre nulle (le premier message n'existe pas encore).
    const links = await listSubjectConversations(db, subject.id);
    expect(
      links.find((l) => l.conversationId === res.conversation.id)
        ?.anchorMessageId,
    ).toBeNull();

    const reply = await ingestInboundEmail(db, {
      channelId: emailChannel.id,
      externalId: "mail-anchor",
      senderRaw: "karim@sogood.fr",
      subjectLine: `Re: ${subject.title}`,
      content: "Bien reçu",
    });

    // Le message rejoint bien le sujet — via le lien permanent, pas une ancre.
    expect(reply.message.subjectId).toBe(subject.id);

    // Et l'ancre du lien email RESTE nulle : rien à poser (email ≠ WhatsApp).
    const { anchored } = await ensureSubjectAnchors(db, subject.id);
    expect(anchored).toBe(0);
    const after = await listSubjectConversations(db, subject.id);
    expect(
      after.find((l) => l.conversationId === res.conversation.id)
        ?.anchorMessageId,
    ).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// 4. Cas Q — la proposition d'ignorance enchaînée à la fermeture
// ─────────────────────────────────────────────────────────────

describe("listIgnorableConversations (cas Q)", () => {
  it("ne propose que les conversations encore actives du sujet", async () => {
    const { db, subject, firstMessage } =
      await subjectFromWhatsApp("cas-q@test.fr");

    // Fermer un sujet ne tarit pas la source : la conversation reste active et
    // resollicitera l'utilisateur au prochain message → d'où la proposition.
    await closeSubject(db, subject.id);
    const proposals = await listIgnorableConversations(db, subject.id);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.id).toBe(firstMessage.conversationId);

    // Une fois ignorée, plus rien à proposer (on ne redemande jamais).
    await ignoreConversation(db, firstMessage.conversationId);
    expect(await listIgnorableConversations(db, subject.id)).toHaveLength(0);
  });
});
