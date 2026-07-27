import { describe, expect, it } from "vitest";
import {
  createMessage,
  createSubjectFromMessage,
  detachConversationFromSubject,
  ingestInboundEmail,
  ingestInboundWhatsApp,
  prisma,
  sendEmailReply,
  stopListeningOnConversation,
  tenantDb,
} from "../src/index";

// Faux port d'envoi e-mail : aucun credential, aucun réseau (cf. email-port.ts).
const FAKE_EMAIL_SENDER = {
  sendEmail: async () => ({ emailId: "out-1" }),
};

/** Marque un canal comme CONNECTÉ (externalAccountId requis par l'envoi). */
async function connectChannel(
  accountId: string,
  channelId: string,
  externalAccountId: string,
) {
  await prisma.channelConfig.create({
    data: {
      accountId,
      channelId,
      provider: "unipile",
      status: "connected",
      externalAccountId,
    },
  });
}

// M6quater — la clé d'une conversation e-mail est `email:<objet>:<set trié de
// destinataires>` (notre propre adresse retirée). Conséquences testées ici :
//   1. un reply-all de N'IMPORTE quel participant retombe sur la MÊME conversation ;
//   2. une réponse « à nous seuls » (set réduit) crée une NOUVELLE conversation,
//      rattachée AUTOMATIQUEMENT au sujet si l'expéditeur est dans son set (in-set) ;
//   3. une adresse HORS du set reste orpheline (Cas X, rattachement manuel) ;
//   4. détacher un fil e-mail RETIRE le subjectId de ses messages (rattrapage d'erreur).

const ME = "moi@tastycrousty.fr";
const KARIM = "karim@sogood.fr";
const SOPHIE = "sophie@sogood.fr";
const STRANGER = "inconnu@ailleurs.com";

async function makeAccountWithChannel(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  const channel = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "Boîte",
      type: "email",
      identifier: email,
    },
  });
  return { account, channel, db: tenantDb(account.id) };
}

describe("clé e-mail par SET de destinataires (M6quater)", () => {
  it("un reply-all retombe sur la MÊME conversation, quel que soit l'expéditeur", async () => {
    const { channel, db } = await makeAccountWithChannel(ME);

    // Karim écrit au groupe [nous, Sophie].
    const a = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "m1",
      senderRaw: KARIM,
      recipients: [ME, SOPHIE],
      subjectLine: "Commande palettes",
      content: "Bonjour à tous",
    });
    // Le set exclut NOTRE adresse ; trié.
    const conv = await db.conversation.findFirstOrThrow({
      where: { id: a.message.conversationId },
    });
    expect(conv.participantsRaw).toEqual([KARIM, SOPHIE]);
    expect(conv.key).toBe(`email:commande palettes:${KARIM},${SOPHIE}`);

    // Sophie répond à tous [nous, Karim] : set trié identique → même clé.
    const b = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "m2",
      senderRaw: SOPHIE,
      recipients: [ME, KARIM],
      subjectLine: "Re: Commande palettes",
      content: "Bien reçu",
    });
    expect(b.message.conversationId).toBe(a.message.conversationId);
    expect(await db.conversation.count()).toBe(1);
  });

  it("une réponse « à nous seuls » d'un destinataire connu → nouvelle conversation, rattachée au sujet (IN-SET)", async () => {
    const { channel, db } = await makeAccountWithChannel(ME);

    // Fil de groupe [Karim, Sophie], dont on fait un sujet.
    const group = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "g1",
      senderRaw: KARIM,
      recipients: [ME, SOPHIE],
      subjectLine: "Commande palettes",
      content: "Bonjour",
    });
    const subject = await createSubjectFromMessage(db, group.message.id);

    // Sophie répond À NOUS SEULS (même objet) → set {sophie} ≠ {karim,sophie}.
    const solo = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "s1",
      senderRaw: SOPHIE,
      recipients: [ME],
      subjectLine: "Re: Commande palettes",
      content: "Juste pour toi",
    });

    // Nouvelle conversation, MAIS rangée automatiquement dans le sujet.
    expect(solo.message.conversationId).not.toBe(group.message.conversationId);
    expect(solo.message.subjectId).toBe(subject.id);
    // Le lien d'écoute existe → un prochain message de ce fil y retombe seul.
    const link = await db.subjectConversation.findFirst({
      where: {
        subjectId: subject.id,
        conversationId: solo.message.conversationId,
      },
    });
    expect(link).not.toBeNull();
  });

  it("une adresse HORS du set reste ORPHELINE (Cas X, rattachement manuel)", async () => {
    const { channel, db } = await makeAccountWithChannel(ME);

    const group = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "g2",
      senderRaw: KARIM,
      recipients: [ME, SOPHIE],
      subjectLine: "Commande palettes",
      content: "Bonjour",
    });
    await createSubjectFromMessage(db, group.message.id);

    // Un inconnu écrit sur le même objet → hors du set {karim,sophie}.
    const stranger = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "x1",
      senderRaw: STRANGER,
      recipients: [ME],
      subjectLine: "Re: Commande palettes",
      content: "Bonjour, moi aussi",
    });

    expect(stranger.message.subjectId).toBeNull();
    expect(stranger.message.conversationId).not.toBe(
      group.message.conversationId,
    );
  });
});

describe("envoi e-mail — reply-all reste dans la MÊME conversation (M6quater)", () => {
  it("répondre au SET complet d'un groupe ne fragmente pas le fil", async () => {
    const { account, channel, db } = await makeAccountWithChannel(ME);
    await connectChannel(account.id, channel.id, "acc-mail-1");

    // Fil de groupe [Karim, Sophie], dont on fait un sujet.
    const group = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "grp",
      senderRaw: KARIM,
      recipients: [ME, SOPHIE],
      subjectLine: "Commande palettes",
      content: "Bonjour à tous",
    });
    const subject = await createSubjectFromMessage(db, group.message.id);

    // Réponse au SET complet → clé recalculée identique → même conversation.
    const out = await sendEmailReply(db, FAKE_EMAIL_SENDER, {
      subjectId: subject.id,
      channelId: channel.id,
      to: [{ identifier: KARIM }, { identifier: SOPHIE }],
      subject: "Re: Commande palettes",
      body: "Bien noté",
    });

    expect(out.conversationId).toBe(group.message.conversationId);
    expect(out.subjectId).toBe(subject.id);
    // Aucun fil fantôme : toujours une seule conversation e-mail.
    expect(await db.conversation.count()).toBe(1);
  });
});

describe("arrêter l'écoute d'un fil de messagerie (M6quater)", () => {
  it("pose la borne de fin sur le dernier message, sans détruire la liaison", async () => {
    const account = await prisma.account.create({
      data: { email: "wa-stop@test.fr", firstName: "Test", lastName: "User" },
    });
    const wa = await prisma.channel.create({
      data: {
        accountId: account.id,
        name: "WhatsApp",
        type: "whatsapp",
        identifier: "+33600000000",
      },
    });
    const db = tenantDb(account.id);

    const m1 = await ingestInboundWhatsApp(db, {
      channelId: wa.id,
      externalId: "w1",
      externalThreadId: "chat-x",
      senderRaw: "33600000010@s.whatsapp.net",
      content: "Salut",
    });
    const subject = await createSubjectFromMessage(db, m1.message.id);
    const conversationId = m1.message.conversationId;

    await stopListeningOnConversation(db, subject.id, conversationId);

    // La liaison SUBSISTE (le passé reste rattaché) ; seule la borne de fin est posée.
    const link = await db.subjectConversation.findFirst({
      where: { subjectId: subject.id, conversationId },
    });
    expect(link).not.toBeNull();
    expect(link?.closingMessageId).toBe(m1.message.id);
    // Un fil e-mail n'a PAS de borne de fin : arrêter l'écoute le refuse.
    await expect(
      stopListeningOnConversation(
        db,
        subject.id,
        "00000000-0000-0000-0000-000000000000",
      ),
    ).rejects.toThrow();
  });
});

describe("« je discute tout seul » — self retiré du set même si le canal n'a pas la bonne adresse (M6quater)", () => {
  it("entrant (To = nous) + sortant tombent dans LA MÊME conversation", async () => {
    // Canal dont l'identifiant N'EST PAS l'adresse réelle (placeholder de
    // connexion) : « nous » doit quand même être reconnu via account.email,
    // sinon notre adresse fuite dans le set des entrants et le fil se scinde.
    const account = await prisma.account.create({
      data: { email: ME, firstName: "Test", lastName: "User" },
    });
    const channel = await prisma.channel.create({
      data: {
        accountId: account.id,
        name: "Boîte",
        type: "email",
        identifier: "En attente de connexion…",
      },
    });
    const contact = await prisma.contact.create({
      data: {
        accountId: account.id,
        firstName: "Vinz",
        lastName: "Chollet",
        email: KARIM,
        sourceActor: "user",
      },
    });
    const db = tenantDb(account.id);

    // Entrant de Karim, adressé à NOUS (ME dans le To).
    const inc = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "solo-in",
      senderRaw: KARIM,
      recipients: [ME],
      subjectLine: "Devis",
      content: "Voici le devis",
    });
    // Sortant vers Karim.
    const out = await createMessage(db, {
      channelId: channel.id,
      direction: "outgoing",
      recipientContactId: contact.id,
      recipients: [KARIM],
      subjectLine: "Re: Devis",
      content: "Merci",
    });

    expect(out.conversationId).toBe(inc.message.conversationId);
    expect(await db.conversation.count()).toBe(1);
    const conv = await db.conversation.findFirstOrThrow();
    // Notre adresse ne figure JAMAIS dans le set.
    expect(conv.participantsRaw).toEqual([KARIM]);
  });
});

describe("détachement d'un fil e-mail (M6quater)", () => {
  it("retire le subjectId de ses messages et supprime le lien, sans détruire la conversation", async () => {
    const { channel, db } = await makeAccountWithChannel(ME);

    const first = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "d1",
      senderRaw: KARIM,
      recipients: [ME],
      subjectLine: "Facture",
      content: "Voici la facture",
    });
    const subject = await createSubjectFromMessage(db, first.message.id);
    const conversationId = first.message.conversationId;

    // Rattaché après ouverture (balayage du fil entier).
    expect(
      (await db.message.findFirstOrThrow({ where: { id: first.message.id } }))
        .subjectId,
    ).toBe(subject.id);

    await detachConversationFromSubject(db, subject.id, conversationId);

    // Messages orphelins de nouveau ; conversation intacte ; plus aucun lien.
    expect(
      (await db.message.findFirstOrThrow({ where: { id: first.message.id } }))
        .subjectId,
    ).toBeNull();
    expect(await db.conversation.count({ where: { id: conversationId } })).toBe(
      1,
    );
    expect(
      await db.subjectConversation.count({ where: { subjectId: subject.id } }),
    ).toBe(0);
  });
});
