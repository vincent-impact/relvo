import { describe, expect, it } from "vitest";
import {
  createSubjectFromMessage,
  detachConversationFromSubject,
  ingestInboundEmail,
  prisma,
  tenantDb,
} from "../src/index";

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
