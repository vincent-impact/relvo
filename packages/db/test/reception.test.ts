import { describe, expect, it } from "vitest";
import {
  ConversationStatus,
  attachConversationToSubject,
  createSubject,
  ignoreConversation,
  prisma,
  reactivateConversation,
  recevoirEmailEntrant,
  recevoirEmailSortant,
  recevoirWhatsAppEntrant,
  recevoirWhatsAppSortant,
  tenantDb,
} from "../src/index";

// LA RÉCEPTION (M25.9) — « ignorer, c'est ne plus importer ». Ce que ce
// fichier tient : une conversation ignorée ne reçoit plus AUCUN message, reçu
// ou écrit par le dirigeant, e-mail ou messagerie ; elle en garde le compte,
// sans contenu ; et tout le reste entre comme avant.

let n = 0;
async function compte(type: "email" | "whatsapp") {
  n += 1;
  const email = `reception-${n}-${Date.now()}@relvo.test`;
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  const channel = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: type === "email" ? "Boîte" : "WhatsApp",
      type,
      identifier: type === "email" ? email : "+33600000000",
    },
  });
  return { email, channelId: channel.id, db: tenantDb(account.id) };
}

const conversationDe = (db: ReturnType<typeof tenantDb>, id: string) =>
  db.conversation.findFirstOrThrow({ where: { id } });

describe("recevoir un e-mail", () => {
  it("un fil actif entre comme avant", async () => {
    const { db, channelId, email } = await compte("email");
    const recu = await recevoirEmailEntrant(db, {
      channelId,
      externalId: "m1",
      senderRaw: "karim@fournisseur.fr",
      recipients: [email],
      subjectLine: "Devis sauce",
      content: "Voici le devis.",
    });
    expect(recu.ecartee).toBe(false);
    if (recu.ecartee) return;
    expect(recu.created).toBe(true);
    expect(recu.message.content).toBe("Voici le devis.");
  });

  it("un fil ignoré n'importe plus rien, et compte ce qu'il laisse passer", async () => {
    const { db, channelId, email } = await compte("email");
    const premier = await recevoirEmailEntrant(db, {
      channelId,
      externalId: "m1",
      senderRaw: "promo@enseigne.fr",
      recipients: [email],
      subjectLine: "Offre de la semaine",
      content: "Moins vingt pour cent.",
    });
    if (premier.ecartee) throw new Error("le premier message devait entrer");
    const conversationId = premier.message.conversationId;
    await ignoreConversation(db, conversationId, { reason: "advertising" });

    const quand = new Date("2026-11-20T09:00:00Z");
    const suite = await recevoirEmailEntrant(db, {
      channelId,
      externalId: "m2",
      senderRaw: "promo@enseigne.fr",
      recipients: [email],
      subjectLine: "RE: Offre de la semaine",
      content: "Dernier jour.",
      contentHtml: "<p>Dernier jour.</p>",
      receivedAt: quand,
    });
    expect(suite).toEqual({ ecartee: true, conversationId });
    expect(await db.message.count({ where: { conversationId } })).toBe(1);

    // Une seconde livraison du même webhook ne compte pas deux fois.
    await recevoirEmailEntrant(db, {
      channelId,
      externalId: "m2",
      senderRaw: "promo@enseigne.fr",
      recipients: [email],
      subjectLine: "RE: Offre de la semaine",
      receivedAt: quand,
    });
    const plusTard = new Date("2026-11-21T09:00:00Z");
    await recevoirEmailEntrant(db, {
      channelId,
      externalId: "m3",
      senderRaw: "promo@enseigne.fr",
      recipients: [email],
      subjectLine: "Offre de la semaine",
      receivedAt: plusTard,
    });

    const c = await conversationDe(db, conversationId);
    expect(c.unimportedCount).toBe(2);
    expect(c.unimportedSince).toEqual(quand);
    expect(c.unimportedLastAt).toEqual(plusTard);
    // Le dernier message connu de Relvo n'a pas bougé : le fil n'est plus à jour.
    expect(c.lastMessageId).toBe(premier.message.id);
  });

  it("un autre objet du même expéditeur est un fil nouveau : il entre, le temps d'être jugé", async () => {
    const { db, channelId, email } = await compte("email");
    const premier = await recevoirEmailEntrant(db, {
      channelId,
      externalId: "m1",
      senderRaw: "promo@enseigne.fr",
      recipients: [email],
      subjectLine: "Offre de la semaine",
    });
    if (premier.ecartee) throw new Error("devait entrer");
    await ignoreConversation(db, premier.message.conversationId);
    const autre = await recevoirEmailEntrant(db, {
      channelId,
      externalId: "m2",
      senderRaw: "promo@enseigne.fr",
      recipients: [email],
      subjectLine: "Votre facture",
    });
    expect(autre.ecartee).toBe(false);
  });

  it("un message déjà importé avant l'ignorance ne se compte pas : l'idempotence répond", async () => {
    const { db, channelId, email } = await compte("email");
    const entree = {
      channelId,
      externalId: "m1",
      senderRaw: "promo@enseigne.fr",
      recipients: [email],
      subjectLine: "Offre",
    };
    const premier = await recevoirEmailEntrant(db, entree);
    if (premier.ecartee) throw new Error("devait entrer");
    await ignoreConversation(db, premier.message.conversationId);
    const rejoue = await recevoirEmailEntrant(db, entree);
    expect(rejoue.ecartee).toBe(false);
    if (rejoue.ecartee) return;
    expect(rejoue.created).toBe(false);
    const c = await conversationDe(db, premier.message.conversationId);
    expect(c.unimportedCount).toBe(0);
  });

  it("la réponse du dirigeant depuis son client de messagerie n'entre pas non plus", async () => {
    const { db, channelId, email } = await compte("email");
    const premier = await recevoirEmailEntrant(db, {
      channelId,
      externalId: "m1",
      senderRaw: "cousin@famille.fr",
      recipients: [email],
      subjectLine: "Dimanche",
    });
    if (premier.ecartee) throw new Error("devait entrer");
    const conversationId = premier.message.conversationId;
    await ignoreConversation(db, conversationId, { reason: "personal" });
    const envoi = await recevoirEmailSortant(db, {
      channelId,
      externalId: "s1",
      origin: "external",
      recipients: ["cousin@famille.fr"],
      subjectLine: "Re: Dimanche",
      content: "On vient.",
    });
    expect(envoi).toEqual({ ecartee: true, conversationId });
    expect(await db.message.count({ where: { conversationId } })).toBe(1);
  });

  it("réactiver remet le compte à zéro, et le fil se remet à recevoir", async () => {
    const { db, channelId, email } = await compte("email");
    const premier = await recevoirEmailEntrant(db, {
      channelId,
      externalId: "m1",
      senderRaw: "client@exemple.fr",
      recipients: [email],
      subjectLine: "Commande",
    });
    if (premier.ecartee) throw new Error("devait entrer");
    const conversationId = premier.message.conversationId;
    await ignoreConversation(db, conversationId);
    await recevoirEmailEntrant(db, {
      channelId,
      externalId: "m2",
      senderRaw: "client@exemple.fr",
      recipients: [email],
      subjectLine: "Commande",
    });
    await reactivateConversation(db, conversationId);
    const c = await conversationDe(db, conversationId);
    expect(c.status).toBe(ConversationStatus.active);
    expect(c.unimportedCount).toBe(0);
    expect(c.unimportedSince).toBeNull();
    const suite = await recevoirEmailEntrant(db, {
      channelId,
      externalId: "m3",
      senderRaw: "client@exemple.fr",
      recipients: [email],
      subjectLine: "Commande",
    });
    expect(suite.ecartee).toBe(false);
  });
});

describe("recevoir un message de messagerie", () => {
  it("un fil direct ignoré n'importe ni ce qu'il reçoit ni ce que le dirigeant y écrit", async () => {
    const { db, channelId } = await compte("whatsapp");
    const premier = await recevoirWhatsAppEntrant(db, {
      channelId,
      externalId: "w1",
      externalThreadId: "chat-1",
      senderRaw: "+33611111111",
      senderName: "Maman",
      content: "Tu viens dimanche ?",
    });
    if (premier.ecartee) throw new Error("devait entrer");
    const conversationId = premier.message.conversationId;
    await ignoreConversation(db, conversationId, { reason: "personal" });

    const recu = await recevoirWhatsAppEntrant(db, {
      channelId,
      externalId: "w2",
      externalThreadId: "chat-1",
      senderRaw: "+33611111111",
      content: "Alors ?",
    });
    expect(recu).toEqual({ ecartee: true, conversationId });
    const ecrit = await recevoirWhatsAppSortant(db, {
      channelId,
      externalId: "w3",
      externalThreadId: "chat-1",
      content: "Oui.",
    });
    expect(ecrit).toEqual({ ecartee: true, conversationId });

    expect(await db.message.count({ where: { conversationId } })).toBe(1);
    expect((await conversationDe(db, conversationId)).unimportedCount).toBe(2);
  });

  it("un groupe ignoré n'importe plus rien ; un autre fil du même canal entre", async () => {
    const { db, channelId } = await compte("whatsapp");
    const premier = await recevoirWhatsAppEntrant(db, {
      channelId,
      externalId: "g1",
      externalThreadId: "groupe-foot",
      senderRaw: "+33622222222",
      isGroup: true,
      content: "Qui joue jeudi ?",
    });
    if (premier.ecartee) throw new Error("devait entrer");
    await ignoreConversation(db, premier.message.conversationId, {
      reason: "personal",
    });
    const suite = await recevoirWhatsAppEntrant(db, {
      channelId,
      externalId: "g2",
      externalThreadId: "groupe-foot",
      senderRaw: "+33633333333",
      isGroup: true,
      content: "Moi.",
    });
    expect(suite.ecartee).toBe(true);
    const ailleurs = await recevoirWhatsAppEntrant(db, {
      channelId,
      externalId: "d1",
      externalThreadId: "chat-client",
      senderRaw: "+33644444444",
      content: "Bonjour, un devis ?",
    });
    expect(ailleurs.ecartee).toBe(false);
  });
});

describe("rattacher une conversation ignorée à un sujet", () => {
  it("la réactive : le fil se remet à recevoir, et le sujet l'écoute", async () => {
    const { db, channelId } = await compte("whatsapp");
    const premier = await recevoirWhatsAppEntrant(db, {
      channelId,
      externalId: "w1",
      externalThreadId: "chat-9",
      senderRaw: "+33655555555",
      content: "Bonjour.",
    });
    if (premier.ecartee) throw new Error("devait entrer");
    const conversationId = premier.message.conversationId;
    await ignoreConversation(db, conversationId);
    await recevoirWhatsAppEntrant(db, {
      channelId,
      externalId: "w2",
      externalThreadId: "chat-9",
      senderRaw: "+33655555555",
      content: "Vous avez reçu mon devis ?",
    });

    const sujet = await createSubject(db, { title: "Devis" });
    await attachConversationToSubject(db, {
      subjectId: sujet.id,
      conversationId,
    });
    const c = await conversationDe(db, conversationId);
    expect(c.status).toBe(ConversationStatus.active);
    expect(c.unimportedCount).toBe(0);

    const suite = await recevoirWhatsAppEntrant(db, {
      channelId,
      externalId: "w3",
      externalThreadId: "chat-9",
      senderRaw: "+33655555555",
      content: "Je relance.",
    });
    expect(suite.ecartee).toBe(false);
    if (suite.ecartee) return;
    expect(suite.message.subjectId).toBe(sujet.id);
  });
});
