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
  ingestInboundEmail,
  ingestOutboundEmail,
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

  // ⚠️ ASYMÉTRIE M6ter (invariant n°7) — un fil d'email EST un sujet : fermer ne
  // pose AUCUNE borne de fin sur un lien email (contrairement à WhatsApp). Un
  // nouvel email de même objet + même interlocuteur REJOINT le sujet et le
  // ROUVRE. Le seul geste qui fait taire un fil email est `ignoreConversation`.
  it("un email de même objet ROUVRE un sujet fermé et le rejoint", async () => {
    const { channel, db } = await makeAccountWithChannel("closed@test.fr");
    const { subject } = await openWindowOn(db, channel.id, {
      externalId: "anchor-closed",
      sender: "karim@sogood.fr",
      subjectLine: "Livraison sauce blanche",
    });
    await updateSubjectStatus(db, subject.id, SubjectStatus.closed);

    const { message } = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "into-closed",
      senderRaw: "karim@sogood.fr",
      subjectLine: "Re: Livraison sauce blanche",
      content: "Encore un message.",
    });

    // Le message rejoint le sujet…
    expect(message.subjectId).toBe(subject.id);
    // …et le sujet est repassé en OUVERT, sa date de clôture effacée.
    const reopened = await db.subject.findFirst({ where: { id: subject.id } });
    expect(reopened?.status).toBe(SubjectStatus.open);
    expect(reopened?.closedAt).toBeNull();
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

// Un e-mail envoyé DEPUIS UN CLIENT DE MESSAGERIE (M7, suite de la tranche 11) :
// l'agrégateur le rejoue en `mail_sent`. Il entre comme un envoi — même
// conversation, le sujet qui l'écoute, la tâche de réponse cochée — ; l'écho
// d'un envoi depuis Relvo, en base sous sa référence de suivi, ne se duplique
// jamais ; un e-mail que le dirigeant écrit le premier ouvre sa conversation.
describe("ingestOutboundEmail — l'e-mail envoyé depuis un client de messagerie", () => {
  it("rejoint la conversation du fil et le sujet qui l'écoute, et coche la tâche de réponse", async () => {
    const { channel, db } = await makeAccountWithChannel("out@test.fr");
    const { message: entrant } = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "in-1",
      senderRaw: "karim@sogood.fr",
      senderName: "Karim Benali",
      recipients: ["out@test.fr"],
      subjectLine: "Rupture sauce blanche",
      content: "On vous remplace la SB-200 par la SB-210 ?",
    });
    const subject = await createSubjectFromMessage(db, entrant.id);
    const tache = await createTask(db, {
      subjectId: subject.id,
      title: "Répondre à Karim sur le remplacement",
      kind: "reply",
    });

    const { message, created } = await ingestOutboundEmail(db, {
      channelId: channel.id,
      externalId: "sent-gmail-1",
      origin: "external",
      recipients: ["karim@sogood.fr"],
      subjectLine: "Re: Rupture sauce blanche",
      content: "OK pour la SB-210, livrez-la jeudi.",
    });
    expect(created).toBe(true);
    expect(message?.direction).toBe(MessageDirection.outgoing);
    expect(message?.status).toBe(MessageStatus.sent);
    expect(message?.conversationId).toBe(entrant.conversationId);
    expect(message?.subjectId).toBe(subject.id);
    expect(message?.recipientContactId).toBe(subject.contactIds[0]);
    expect(await db.conversation.count()).toBe(1);
    const t = await db.task.findFirstOrThrow({ where: { id: tache.id } });
    expect(t.status).toBe("done");
    const s = await db.subject.findFirstOrThrow({ where: { id: subject.id } });
    expect(s.waitingForReply).toBe(true);
  });

  it("ne duplique jamais l'écho d'un envoi fait depuis Relvo, ni un rejeu, ni un envoi de l'agrégateur inconnu", async () => {
    const { channel, db } = await makeAccountWithChannel("echo@test.fr");
    const { message: entrant } = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "in-1",
      senderRaw: "karim@sogood.fr",
      recipients: ["echo@test.fr"],
      subjectLine: "Rupture sauce blanche",
      content: "Bonjour",
    });
    const subject = await createSubjectFromMessage(db, entrant.id);
    // Un envoi depuis Relvo : en base sous la référence de suivi de l'agrégateur.
    await createMessage(db, {
      channelId: channel.id,
      direction: MessageDirection.outgoing,
      subjectId: subject.id,
      recipientContactId: subject.contactIds[0],
      recipients: ["karim@sogood.fr"],
      externalId: "tracking-relvo",
      subjectLine: "Re: Rupture sauce blanche",
      content: "Oui",
    });
    const echo = await ingestOutboundEmail(db, {
      channelId: channel.id,
      externalId: "email-id-of-echo",
      trackingId: "tracking-relvo",
      origin: "unipile",
      recipients: ["karim@sogood.fr"],
      subjectLine: "Re: Rupture sauce blanche",
      content: "Oui",
    });
    expect(echo.created).toBe(false);
    expect(echo.message?.externalId).toBe("tracking-relvo");
    // Parti par l'agrégateur sans que Relvo le connaisse : rien n'est inventé.
    const inconnu = await ingestOutboundEmail(db, {
      channelId: channel.id,
      externalId: "email-id-unknown",
      trackingId: "tracking-unknown",
      origin: "unipile",
      recipients: ["karim@sogood.fr"],
      subjectLine: "Re: Rupture sauce blanche",
      content: "?",
    });
    expect(inconnu.created).toBe(false);
    expect(inconnu.message).toBeNull();
    const once = await ingestOutboundEmail(db, {
      channelId: channel.id,
      externalId: "sent-gmail-2",
      origin: "external",
      recipients: ["karim@sogood.fr"],
      subjectLine: "Re: Rupture sauce blanche",
      content: "À jeudi",
    });
    const twice = await ingestOutboundEmail(db, {
      channelId: channel.id,
      externalId: "sent-gmail-2",
      origin: "external",
      recipients: ["karim@sogood.fr"],
      subjectLine: "Re: Rupture sauce blanche",
      content: "À jeudi",
    });
    expect(once.created).toBe(true);
    expect(twice.created).toBe(false);
    expect(await db.message.count()).toBe(3);
  });

  it("un e-mail que le dirigeant écrit le premier ouvre sa conversation, orpheline", async () => {
    const { channel, db } = await makeAccountWithChannel("first@test.fr");
    const { message, created } = await ingestOutboundEmail(db, {
      channelId: channel.id,
      externalId: "sent-gmail-3",
      origin: "external",
      recipients: ["plombier@exemple.fr", "first@test.fr"],
      subjectLine: "Fuite en cuisine",
      content: "Bonjour, pouvez-vous passer cette semaine ?",
    });
    expect(created).toBe(true);
    expect(message?.subjectId).toBeNull();
    expect(message?.status).toBe(MessageStatus.sent);
    const conversation = await db.conversation.findFirstOrThrow({
      where: { id: message!.conversationId },
    });
    // Notre propre adresse ne fait jamais partie du set : la réponse du
    // plombier retombera dans cette même conversation.
    expect(conversation.participantsRaw).toEqual(["plombier@exemple.fr"]);
    expect(conversation.interlocutorRaw).toBe("plombier@exemple.fr");
    // La réponse arrive : même conversation, le fil est entier pour le tri.
    const { message: reponse } = await ingestInboundEmail(db, {
      channelId: channel.id,
      externalId: "in-plombier",
      senderRaw: "plombier@exemple.fr",
      recipients: ["first@test.fr"],
      subjectLine: "Re: Fuite en cuisine",
      content: "Jeudi 9h ?",
    });
    expect(reponse.conversationId).toBe(message!.conversationId);
  });
});
