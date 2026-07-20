import { describe, expect, it } from "vitest";
import {
  MessageDirection,
  MessageStatus,
  SubjectStatus,
  assignMessageToSubject,
  createSubject,
  createSubjectFromMessage,
  ingestInboundEmail,
  normalizeSubjectLine,
  prisma,
  tenantDb,
  updateSubjectStatus,
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

// Règle d'ancrage (M6bis) — remplace l'ancienne heuristique « même interlocuteur
// ET même objet qu'un message du sujet ». Ce n'est plus le SUJET qu'on cherche à
// la réception mais la CONVERSATION (email:<interlocuteur>:<objet normalisé>) :
// si elle porte une fenêtre de sujet OUVERTE, le message y tombe tout seul.
describe("règle d'ancrage à la réception (email)", () => {
  /** Ingère un 1er email PUIS ouvre une fenêtre de sujet dessus. */
  async function openWindowOn(
    db: ReturnType<typeof tenantDb>,
    channelId: string,
    opts: { externalId: string; sender: string; subjectLine: string },
  ) {
    const { message } = await ingestInboundEmail(db, {
      channelId,
      externalId: opts.externalId,
      senderRaw: opts.sender,
      subjectLine: opts.subjectLine,
      content: "Message initial",
    });
    // Aucune fenêtre encore ouverte → le 1er message est bien sans sujet.
    expect(message.subjectId).toBeNull();
    return { message, subject: await createSubjectFromMessage(db, message.id) };
  }

  it("la réponse tombe dans le sujet de la fenêtre ouverte (préfixe Re: et casse ignorés)", async () => {
    const { channel, db } = await makeAccountWithChannel("attach@test.fr");
    const { subject } = await openWindowOn(db, channel.id, {
      externalId: "anchor-mail",
      sender: "karim@sogood.fr",
      subjectLine: "Livraison sauce blanche",
    });

    const { message } = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "reply-attach",
      senderRaw: "Karim@SoGood.fr", // casse différente : même clé de conversation
      subjectLine: "Re: Livraison sauce blanche",
      content: "Merci, bien reçu.",
    });

    expect(message.subjectId).toBe(subject.id);
    expect(message.status).toBe(MessageStatus.linked);
  });

  it("reste sans sujet si l'objet diffère (autre conversation, même interlocuteur)", async () => {
    const { channel, db } = await makeAccountWithChannel("obj@test.fr");
    await openWindowOn(db, channel.id, {
      externalId: "anchor-obj",
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

  it("reste sans sujet si l'interlocuteur diffère (autre conversation, même objet)", async () => {
    const { channel, db } = await makeAccountWithChannel("who@test.fr");
    await openWindowOn(db, channel.id, {
      externalId: "anchor-who",
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

  // Fermer un sujet, c'est REFERMER la fenêtre : la conversation continue de
  // vivre (rien n'est perdu) mais ses nouveaux messages ne sont plus captés.
  it("un sujet fermé ne capte plus les nouveaux messages de sa conversation", async () => {
    const { channel, db } = await makeAccountWithChannel("closed@test.fr");
    const { subject } = await openWindowOn(db, channel.id, {
      externalId: "anchor-closed",
      sender: "spam@groupe.fr",
      subjectLine: "Groupe bavard",
    });
    await updateSubjectStatus(db, subject.id, SubjectStatus.closed);

    const { message } = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "into-closed",
      senderRaw: "spam@groupe.fr",
      subjectLine: "Re: Groupe bavard",
      content: "Encore un message.",
    });

    expect(message.subjectId).toBeNull();
  });
});

// Le « balayage des frères orphelins » est SUPPRIMÉ avec M6bis : il emportait
// tout un fil au premier rattachement, ce qui rendait impossibles les sujets
// entrelacés. On teste donc explicitement le contraire.
describe("assignMessageToSubject ne touche qu'un message (email)", () => {
  it("rattacher un message laisse les autres messages de la conversation intacts", async () => {
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
      senderRaw: "Karim@SoGood.fr", // casse différente : MÊME conversation
      subjectLine: "Re: Livraison sauce blanche",
      content: "Relance, même objet.",
    });
    expect(a.message.conversationId).toBe(b.message.conversationId);
    expect(a.message.subjectId).toBeNull();
    expect(b.message.subjectId).toBeNull();

    // `createSubject` (et non `createSubjectFromMessage`) : aucune fenêtre n'est
    // ouverte ici, on ne teste que le rattachement d'un message isolé.
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
    // Le voisin ne suit PAS — et aucune fenêtre n'a été ouverte au passage.
    expect(bAfter?.subjectId).toBeNull();
    expect(await db.subjectConversation.count()).toBe(0);
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
