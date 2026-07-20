import { describe, expect, it } from "vitest";
import {
  MessageDirection,
  MessageStatus,
  assignMessageToSubject,
  createMessage,
  createSubject,
  ingestInboundEmail,
  normalizeSubjectLine,
  prisma,
  tenantDb,
} from "../src/index";

// Ingestion email entrante (M5) — deux garanties qui portent tout le flux :
//   1. un email reçu devient un Message ORPHELIN (« Sans sujet ») ;
//   2. un webhook rejoué (même channelId + externalId) ne crée pas de doublon.
// Le mapper payload→entrée est testé côté apps/web (fonction pure) ; ici on
// vérifie le comportement en base, invérifiable en mock (contrainte unique).

async function makeAccountWithChannel(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  const channel = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "Boîte email",
      type: "email",
      identifier: email,
    },
  });
  return { account, channel, db: tenantDb(account.id) };
}

describe("ingestInboundEmail (M5)", () => {
  it("crée un Message orphelin (« Sans sujet »)", async () => {
    const { channel, db } = await makeAccountWithChannel("in@test.fr");

    const { message, created } = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "unipile-email-1",
      senderRaw: "karim@sogood.fr",
      subjectLine: "Livraison sauce blanche",
      content: "Bonjour, la livraison arrive jeudi.",
    });

    expect(created).toBe(true);
    expect(message.subjectId).toBeNull();
    expect(message.direction).toBe(MessageDirection.incoming);
    expect(message.status).toBe(MessageStatus.received);
    expect(message.externalId).toBe("unipile-email-1");
    expect(message.senderRaw).toBe("karim@sogood.fr");
    expect(message.receivedAt).not.toBeNull();
  });

  it("est idempotent : un webhook rejoué ne duplique pas le message", async () => {
    const { channel, db } = await makeAccountWithChannel("dup@test.fr");
    const input = {
      channelId: channel.id,
      externalId: "unipile-email-2",
      subjectLine: "Relance",
      content: "Rappel",
    };

    const first = await ingestInboundEmail(db, input);
    const second = await ingestInboundEmail(db, input);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.message.id).toBe(first.message.id);
    expect(await db.message.count()).toBe(1);
  });

  it("isole par canal : même externalId sur deux canaux = deux messages", async () => {
    const { account, channel, db } =
      await makeAccountWithChannel("iso@test.fr");
    const channel2 = await prisma.channel.create({
      data: {
        accountId: account.id,
        name: "Boîte 2",
        type: "email",
        identifier: "iso2@test.fr",
      },
    });

    await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "shared-id",
      content: "A",
    });
    const second = await ingestInboundEmail(db, {
      channelId: channel2.id,
      externalId: "shared-id",
      content: "B",
    });

    expect(second.created).toBe(true);
    expect(await db.message.count()).toBe(2);
  });
});

describe("rattachement automatique pré-M7 (interlocuteur + objet)", () => {
  /** Sème un sujet portant un message du même interlocuteur et du même objet. */
  async function seedSubjectWith(
    db: ReturnType<typeof tenantDb>,
    channelId: string,
    opts: { title: string; sender: string; subjectLine: string },
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
      subjectLine: opts.subjectLine,
      content: "Message initial",
      status: MessageStatus.linked,
    });
    return subject;
  }

  it("range l'email dans le sujet quand interlocuteur + objet correspondent (préfixe Re: ignoré)", async () => {
    const { channel, db } = await makeAccountWithChannel("attach@test.fr");
    const subject = await seedSubjectWith(db, channel.id, {
      title: "Livraison sauce blanche",
      sender: "karim@sogood.fr",
      subjectLine: "Livraison sauce blanche",
    });

    const { message } = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "reply-attach",
      senderRaw: "Karim@SoGood.fr", // casse différente : matching insensible
      subjectLine: "Re: Livraison sauce blanche",
      content: "Merci, bien reçu.",
    });

    expect(message.subjectId).toBe(subject.id);
    expect(message.status).toBe(MessageStatus.linked);
  });

  it("laisse orphelin si l'objet diffère (même interlocuteur)", async () => {
    const { channel, db } = await makeAccountWithChannel("obj@test.fr");
    await seedSubjectWith(db, channel.id, {
      title: "Livraison sauce blanche",
      sender: "karim@sogood.fr",
      subjectLine: "Livraison sauce blanche",
    });

    const { message } = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "other-object",
      senderRaw: "karim@sogood.fr",
      subjectLine: "Nouvelle commande emballages",
      content: "Autre sujet.",
    });

    expect(message.subjectId).toBeNull();
  });

  it("laisse orphelin si l'interlocuteur diffère (même objet)", async () => {
    const { channel, db } = await makeAccountWithChannel("who@test.fr");
    await seedSubjectWith(db, channel.id, {
      title: "Livraison sauce blanche",
      sender: "karim@sogood.fr",
      subjectLine: "Livraison sauce blanche",
    });

    const { message } = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "other-sender",
      senderRaw: "sophie@autre.fr",
      subjectLine: "Re: Livraison sauce blanche",
      content: "Je ne suis pas Karim.",
    });

    expect(message.subjectId).toBeNull();
  });

  it("n'exhume pas un sujet ignoré (ignorance collante, invariant n°7)", async () => {
    const { channel, db } = await makeAccountWithChannel("ignored@test.fr");
    const subject = await seedSubjectWith(db, channel.id, {
      title: "Groupe bavard",
      sender: "spam@groupe.fr",
      subjectLine: "Groupe bavard",
    });
    await db.subject.update({
      where: { id: subject.id },
      data: { status: "ignored" },
    });

    const { message } = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "into-ignored",
      senderRaw: "spam@groupe.fr",
      subjectLine: "Re: Groupe bavard",
      content: "Encore un message.",
    });

    expect(message.subjectId).toBeNull();
  });
});

describe("balayage des frères orphelins au rattachement (interlocuteur + objet)", () => {
  it("rattacher un orphelin embarque les autres orphelins de même interlocuteur + objet", async () => {
    const { channel, db } = await makeAccountWithChannel("sweep@test.fr");
    const a = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "sweep-a",
      senderRaw: "karim@sogood.fr",
      subjectLine: "Livraison sauce blanche",
      content: "Premier message.",
    });
    const b = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "sweep-b",
      senderRaw: "Karim@SoGood.fr", // casse différente : matching insensible
      subjectLine: "Re: Livraison sauce blanche",
      content: "Relance, même objet.",
    });
    // Objet différent (même interlocuteur) → ne doit pas suivre.
    const otherObj = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "sweep-other-obj",
      senderRaw: "karim@sogood.fr",
      subjectLine: "Facture avril",
      content: "Autre objet.",
    });
    // Interlocuteur différent (même objet) → ne doit pas suivre.
    const otherSender = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "sweep-other-sender",
      senderRaw: "sophie@autre.fr",
      subjectLine: "Livraison sauce blanche",
      content: "Autre expéditeur.",
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
    const objAfter = await db.message.findFirst({
      where: { id: otherObj.message.id },
    });
    const senderAfter = await db.message.findFirst({
      where: { id: otherSender.message.id },
    });
    expect(bAfter?.subjectId).toBe(subject.id);
    expect(bAfter?.status).toBe(MessageStatus.linked);
    expect(objAfter?.subjectId).toBeNull();
    expect(senderAfter?.subjectId).toBeNull();
  });
});

describe("normalizeSubjectLine", () => {
  it("retire les préfixes de réponse/transfert, même répétés et multilingues", () => {
    const base = "livraison sauce blanche";
    expect(normalizeSubjectLine("Livraison sauce blanche")).toBe(base);
    expect(normalizeSubjectLine("Re: Livraison sauce blanche")).toBe(base);
    expect(normalizeSubjectLine("RE: RE: Livraison sauce blanche")).toBe(base);
    expect(normalizeSubjectLine("Ré : Livraison sauce blanche")).toBe(base);
    expect(normalizeSubjectLine("Fwd: Livraison sauce blanche")).toBe(base);
    expect(normalizeSubjectLine("TR: Livraison sauce blanche")).toBe(base);
    expect(normalizeSubjectLine("Re[2]: Livraison sauce blanche")).toBe(base);
  });
});
