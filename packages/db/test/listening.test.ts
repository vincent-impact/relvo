import { describe, expect, it } from "vitest";
import {
  ChannelType,
  SubjectStatus,
  attachEmailConversationToSubject,
  closeSubject,
  createSubject,
  createSubjectFromConversation,
  createSubjectFromMessage,
  ignoreConversation,
  ingestInboundEmail,
  ingestInboundWhatsApp,
  prisma,
  reactivateConversation,
  reopenSubject,
  tenantDb,
  validateSubject,
} from "../src/index";

// M6ter — l'ÉCOUTE d'un sujet sur une conversation, à deux bornes. Ce fichier
// verrouille l'asymétrie centrale (invariant n°13bis) :
//
//   • email    → le sujet EST le fil : ouvrir balaie TOUT (amont compris), aucune
//     borne, un nouvel email ROUVRE. Le seul geste qui le fait taire est
//     `ignoreConversation`.
//   • WhatsApp → écoute bornée : ancre au message, borne de fin à la clôture, un
//     swipe droite sur un message plus ancien REMONTE l'ancre.

async function makeAccount(email: string) {
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

function mailInto(
  db: ReturnType<typeof tenantDb>,
  channelId: string,
  externalId: string,
  content: string,
  subjectLine = "Livraison sauce blanche",
) {
  return ingestInboundEmail(db, {
    channelId,
    externalId,
    senderRaw: "karim@sogood.fr",
    subjectLine,
    content,
  });
}

function waInto(
  db: ReturnType<typeof tenantDb>,
  channelId: string,
  externalId: string,
  content: string,
) {
  return ingestInboundWhatsApp(db, {
    channelId,
    externalId,
    externalThreadId: "chat-karim",
    senderRaw: "33600000010@s.whatsapp.net",
    content,
  });
}

// ─────────────────────────────────────────────────────────────
// Email — le sujet EST le fil
// ─────────────────────────────────────────────────────────────

describe("email : ouvrir un sujet balaie le fil ENTIER", () => {
  it("les SIX messages d'un fil rejoignent le sujet (fin du balayage partiel)", async () => {
    const { db, emailChannel } = await makeAccount("mail-sweep@test.fr");
    const msgs = [];
    for (let i = 1; i <= 6; i++) {
      const m = await mailInto(
        db,
        emailChannel.id,
        `m-${i}`,
        `Message ${i}`,
        i === 1 ? "Livraison sauce blanche" : "Re: Livraison sauce blanche",
      );
      msgs.push(m.message);
    }
    const conversationId = msgs[0]!.conversationId;

    const subject = await createSubjectFromConversation(db, conversationId);

    for (const m of msgs) {
      const after = await db.message.findFirst({ where: { id: m.id } });
      expect(after?.subjectId).toBe(subject.id);
    }
    // Un lien email n'a JAMAIS d'ancre : le sujet EST le fil.
    const link = await db.subjectConversation.findFirst({
      where: { subjectId: subject.id },
    });
    expect(link?.anchorMessageId).toBeNull();
    expect(link?.closingMessageId).toBeNull();
  });

  it("ouvrir depuis un message du milieu balaie AUSSI tout le fil (email)", async () => {
    const { db, emailChannel } = await makeAccount("mail-mid@test.fr");
    const a = await mailInto(db, emailChannel.id, "a", "1");
    const b = await mailInto(
      db,
      emailChannel.id,
      "b",
      "2",
      "Re: Livraison sauce blanche",
    );

    // Entrée par message, mais canal email → délègue au fil entier.
    const subject = await createSubjectFromMessage(db, b.message.id);

    const aAfter = await db.message.findFirst({ where: { id: a.message.id } });
    expect(aAfter?.subjectId).toBe(subject.id);
  });

  it("rattacher un fil email à un sujet existant balaie tout le fil", async () => {
    const { db, emailChannel } = await makeAccount("mail-attach@test.fr");
    const a = await mailInto(db, emailChannel.id, "at-1", "1");
    const b = await mailInto(
      db,
      emailChannel.id,
      "at-2",
      "2",
      "Re: Livraison sauce blanche",
    );
    const subject = await createSubject(db, {
      title: "Sujet existant",
      contactIds: [],
      createdByActor: "user",
    });

    await attachEmailConversationToSubject(
      db,
      subject.id,
      a.message.conversationId,
    );

    for (const m of [a, b]) {
      const after = await db.message.findFirst({ where: { id: m.message.id } });
      expect(after?.subjectId).toBe(subject.id);
    }
  });

  it("ignorer un fil email le fait taire : un nouvel email ne ROUVRE plus", async () => {
    const { db, emailChannel } = await makeAccount("mail-ignore@test.fr");
    const first = await mailInto(db, emailChannel.id, "i1", "Bonjour");
    const subject = await createSubjectFromConversation(
      db,
      first.message.conversationId,
    );
    await closeSubject(db, subject.id);
    await ignoreConversation(db, first.message.conversationId);

    const reply = await mailInto(
      db,
      emailChannel.id,
      "i2",
      "Relance",
      "Re: Livraison sauce blanche",
    );
    // La source est en sourdine → orphelin, et le sujet reste fermé.
    expect(reply.message.subjectId).toBeNull();
    const still = await db.subject.findFirst({ where: { id: subject.id } });
    expect(still?.status).toBe(SubjectStatus.closed);
  });
});

// ─────────────────────────────────────────────────────────────
// WhatsApp — écoute bornée, remontée d'ancre
// ─────────────────────────────────────────────────────────────

describe("WhatsApp : remontée d'ancre par swipe droite sur un message plus ancien", () => {
  it("un swipe sur un message AVANT l'ancre la fait remonter, sans créer de 2e sujet", async () => {
    const { db, waChannel } = await makeAccount("wa-climb@test.fr");
    const m1 = await waInto(db, waChannel.id, "c1", "Bonjour");
    const m2 = await waInto(db, waChannel.id, "c2", "La sauce ?");
    const m3 = await waInto(db, waChannel.id, "c3", "40 bidons");

    // Ouverture ancrée sur m2 : m1 reste dehors.
    const subject = await createSubjectFromMessage(db, m2.message.id);
    expect(
      (await db.message.findFirst({ where: { id: m1.message.id } }))?.subjectId,
    ).toBeNull();

    // Swipe droite sur m1 (plus ancien) → l'écoute REMONTE jusqu'à lui.
    const same = await createSubjectFromMessage(db, m1.message.id);
    expect(same.id).toBe(subject.id); // pas un second sujet

    expect(
      (await db.message.findFirst({ where: { id: m1.message.id } }))?.subjectId,
    ).toBe(subject.id);
    const link = await db.subjectConversation.findFirst({
      where: { subjectId: subject.id },
    });
    expect(link?.anchorMessageId).toBe(m1.message.id);
    // Un seul sujet, une seule écoute sur le fil.
    expect(
      await db.subjectConversation.count({
        where: { conversationId: m3.message.conversationId },
      }),
    ).toBe(1);
  });

  it("un swipe sur un message DÉJÀ couvert est sans effet", async () => {
    const { db, waChannel } = await makeAccount("wa-noop@test.fr");
    const m1 = await waInto(db, waChannel.id, "n1", "Bonjour");
    const m2 = await waInto(db, waChannel.id, "n2", "La suite");
    const subject = await createSubjectFromMessage(db, m1.message.id);
    // Ouvrir sur m1 (ancre nulle en amont) balaie m1 ET m2 : relire en base.
    const m2Swept = await db.message.findFirst({
      where: { id: m2.message.id },
    });
    expect(m2Swept?.subjectId).toBe(subject.id);

    const same = await createSubjectFromMessage(db, m2.message.id);
    expect(same.id).toBe(subject.id);
  });
});

describe("WhatsApp : bornes de fin posées au statut", () => {
  it("valider POSE la borne (= dernier couvert) ; le message suivant retombe orphelin ; rouvrir REPREND", async () => {
    const { db, waChannel } = await makeAccount("wa-close@test.fr");
    const m1 = await waInto(db, waChannel.id, "k1", "Bonjour");
    const m2 = await waInto(db, waChannel.id, "k2", "Encore");
    const subject = await createSubjectFromMessage(db, m1.message.id);
    // m2 (ingéré avant le sujet) est balayé à l'ouverture : relire en base.
    const m2Swept = await db.message.findFirst({
      where: { id: m2.message.id },
    });
    expect(m2Swept?.subjectId).toBe(subject.id);

    await validateSubject(db, subject.id);
    const link = await db.subjectConversation.findFirst({
      where: { subjectId: subject.id },
    });
    // La borne de fin = le dernier message couvert (m2).
    expect(link?.closingMessageId).toBe(m2.message.id);

    // Écoute arrêtée → le message suivant est orphelin.
    const m3 = await waInto(db, waChannel.id, "k3", "Après coup");
    expect(m3.message.subjectId).toBeNull();

    // Rouvrir efface la borne → l'écoute reprend.
    await reopenSubject(db, subject.id);
    const resumed = await db.subjectConversation.findFirst({
      where: { subjectId: subject.id },
    });
    expect(resumed?.closingMessageId).toBeNull();
    const m4 = await waInto(db, waChannel.id, "k4", "Ça repart");
    expect(m4.message.subjectId).toBe(subject.id);
  });

  it("ignorer un fil WhatsApp est une PAUSE : orphelin sans borne, réactiver reprend", async () => {
    const { db, waChannel } = await makeAccount("wa-pause@test.fr");
    const m1 = await waInto(db, waChannel.id, "p1", "Bonjour");
    const subject = await createSubjectFromMessage(db, m1.message.id);

    await ignoreConversation(db, m1.message.conversationId);
    const m2 = await waInto(db, waChannel.id, "p2", "Pendant la sourdine");
    expect(m2.message.subjectId).toBeNull();
    // PAUSE : aucune borne posée, le sujet reste ouvert.
    const link = await db.subjectConversation.findFirst({
      where: { subjectId: subject.id },
    });
    expect(link?.closingMessageId).toBeNull();
    const stillOpen = await db.subject.findFirst({ where: { id: subject.id } });
    expect(stillOpen?.status).toBe(SubjectStatus.open);

    await reactivateConversation(db, m1.message.conversationId);
    const m3 = await waInto(db, waChannel.id, "p3", "De retour");
    expect(m3.message.subjectId).toBe(subject.id);
  });
});
