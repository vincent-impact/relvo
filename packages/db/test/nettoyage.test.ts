import { describe, expect, it } from "vitest";
import {
  EVENT_TYPES,
  applyTriageMatter,
  closeSubject,
  createAttachment,
  createTask,
  ignoreConversation,
  ingestInboundEmail,
  ingestInboundWhatsApp,
  listConversationItems,
  nettoyerLeCompte,
  prisma,
  recevoirEmailEntrant,
  recevoirWhatsAppEntrant,
  reopenSubject,
  simulerLeNettoyage,
  tenantDb,
  validateSubject,
} from "../src/index";

// LE NETTOYAGE. Ce que ce fichier tient : un message qu'aucun sujet ne porte
// expire à trente jours, texte et pièces, et rien de ce qu'un sujet porte ne
// part ; une conversation e-mail vidée disparaît, une conversation de
// messagerie reste ; un sujet fermé s'efface trente jours après, jamais un
// sujet validé ni rouvert ; la simulation annonce exactement ce que le passage
// retire ; et un message trop vieux ne revient pas par la réception.

const JOUR = 86_400_000;
const NOW = new Date("2026-11-25T08:00:00Z");
const ilYA = (jours: number) => new Date(NOW.getTime() - jours * JOUR);

let n = 0;
async function compte() {
  n += 1;
  const email = `nettoyage-${n}-${Date.now()}@relvo.test`;
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  const boite = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "Boîte",
      type: "email",
      identifier: email,
    },
  });
  const wa = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "WhatsApp",
      type: "whatsapp",
      identifier: "+33600000000",
    },
  });
  return { accountId: account.id, email, boite, wa, db: tenantDb(account.id) };
}
type Compte = Awaited<ReturnType<typeof compte>>;

let k = 0;
/** Un e-mail en base, daté — par la primitive d'ingestion : la réception, elle, refuserait un vieux message. */
async function courrier(c: Compte, objet: string, jours: number) {
  k += 1;
  const { message } = await ingestInboundEmail(c.db, {
    channelId: c.boite.id,
    externalId: `mail-${k}`,
    senderRaw: `${objet.toLowerCase().replace(/\W/g, "")}@exemple.fr`,
    recipients: [c.email],
    subjectLine: objet,
    content: `Texte de ${objet}`,
    receivedAt: ilYA(jours),
  });
  return message;
}

/** Un fil direct par interlocuteur : c'est le numéro qui fait la conversation. */
const NUMEROS = new Map<string, string>();
async function whatsapp(c: Compte, chat: string, jours: number) {
  k += 1;
  if (!NUMEROS.has(chat)) NUMEROS.set(chat, `+336${10000000 + NUMEROS.size}`);
  const { message } = await ingestInboundWhatsApp(c.db, {
    channelId: c.wa.id,
    externalId: `wa-${k}`,
    externalThreadId: chat,
    senderRaw: NUMEROS.get(chat)!,
    content: `Message ${k}`,
    receivedAt: ilYA(jours),
  });
  return message;
}

async function piece(c: Compte, messageId: string, octets: number) {
  k += 1;
  const storageKey = `accounts/${c.accountId}/attachments/nettoyage-${k}`;
  await createAttachment(c.db, {
    messageId,
    name: `piece-${k}.pdf`,
    mimeType: "application/pdf",
    storageKey,
    fileSize: octets,
  });
  return storageKey;
}

const enFile = () =>
  prisma.pendingFileDeletion
    .findMany()
    .then((rows) => rows.map((r) => r.storageKey));

const existe = async (messageId: string) =>
  (await prisma.message.count({ where: { id: messageId } })) === 1;

describe("l'expiration", () => {
  it("efface, texte et pièces, le message de plus de trente jours qu'aucun sujet ne porte — et lui seul", async () => {
    const c = await compte();
    const vieux = await courrier(c, "Promo", 40);
    const cleVieille = await piece(c, vieux.id, 1000);
    const recent = await courrier(c, "Relance", 29);
    const cleRecente = await piece(c, recent.id, 2000);
    // Vieux, mais porté par un sujet : il compte, il reste.
    const porte = await courrier(c, "Devis hotte", 90);
    const clePortee = await piece(c, porte.id, 4000);
    await applyTriageMatter(c.db, {
      conversationId: porte.conversationId,
      messageId: porte.id,
      title: "Devis hotte",
    });

    const annonce = await simulerLeNettoyage(c.db, NOW);
    expect(annonce).toEqual({
      sujetsFermes: 0,
      messages: 1,
      pieces: 1,
      octets: 1000,
      conversationsEmail: 1,
    });
    // La simulation n'a rien écrit.
    expect(await existe(vieux.id)).toBe(true);

    expect(await nettoyerLeCompte(c.db, c.accountId, NOW)).toEqual(annonce);
    expect(await existe(vieux.id)).toBe(false);
    expect(await existe(recent.id)).toBe(true);
    expect(await existe(porte.id)).toBe(true);
    // Le fichier part par la file de suppression, jamais par un appel au stockage.
    const file = await enFile();
    expect(file).toContain(cleVieille);
    expect(file).not.toContain(cleRecente);
    expect(file).not.toContain(clePortee);

    const journal = await c.db.eventLog.findFirstOrThrow({
      where: { eventType: EVENT_TYPES.nettoyage },
    });
    expect(journal.metadata).toMatchObject({ messages: 1, pieces: 1 });
    // Un second passage n'a plus rien à retirer, et ne journalise rien.
    expect(await nettoyerLeCompte(c.db, c.accountId, NOW)).toMatchObject({
      messages: 0,
      conversationsEmail: 0,
    });
    expect(
      await c.db.eventLog.count({
        where: { eventType: EVENT_TYPES.nettoyage },
      }),
    ).toBe(1);
  });

  it("garde le message dont une pièce est rangée dans un sujet", async () => {
    const c = await compte();
    const plan = await courrier(c, "Plans", 60);
    const autre = await courrier(c, "Chantier", 5);
    const { subjectId } = await applyTriageMatter(c.db, {
      conversationId: autre.conversationId,
      messageId: autre.id,
      title: "Chantier Dupont",
    });
    const cle = await piece(c, plan.id, 500);
    await prisma.attachment.updateMany({
      where: { storageKey: cle },
      data: { subjectId },
    });

    expect(await nettoyerLeCompte(c.db, c.accountId, NOW)).toMatchObject({
      messages: 0,
      pieces: 0,
    });
    expect(await existe(plan.id)).toBe(true);
  });

  it("une conversation e-mail vidée disparaît ; un fil de messagerie reste, hors de « à trier »", async () => {
    const c = await compte();
    const mail = await courrier(c, "Newsletter", 45);
    const fil = await whatsapp(c, "chat-bruno", 45);
    // Un fil qui garde un message récent : seul l'ancien part.
    const ancien = await whatsapp(c, "chat-lea", 50);
    const dernier = await whatsapp(c, "chat-lea", 2);

    expect(await nettoyerLeCompte(c.db, c.accountId, NOW)).toMatchObject({
      messages: 3,
      conversationsEmail: 1,
    });
    expect(
      await prisma.conversation.count({ where: { id: mail.conversationId } }),
    ).toBe(0);
    // Le fil de messagerie est toujours là, vide : il retient qui il est.
    const bruno = await prisma.conversation.findUniqueOrThrow({
      where: { id: fil.conversationId },
    });
    expect(bruno.lastMessageId).toBeNull();
    expect(await existe(ancien.id)).toBe(false);
    const aTrier = await listConversationItems(c.db, { filter: "unsorted" });
    expect(aTrier.items.map((i) => i.id)).toEqual([dernier.conversationId]);
  });

  it("une conversation qui perd son dernier message retrouve celui qui lui reste", async () => {
    const c = await compte();
    // Un fil de messagerie : un sujet écoute depuis le premier message…
    const demande = await whatsapp(c, "chat-client", 80);
    const { subjectId } = await applyTriageMatter(c.db, {
      conversationId: demande.conversationId,
      messageId: demande.id,
      title: "Commande traiteur",
      anchorMessageId: demande.id,
    });
    await validateSubject(c.db, subjectId);
    // … puis, le sujet validé, un message de plus, que rien ne porte.
    const bavardage = await whatsapp(c, "chat-client", 40);
    expect(bavardage.subjectId).toBeNull();

    await nettoyerLeCompte(c.db, c.accountId, NOW);
    expect(await existe(bavardage.id)).toBe(false);
    expect(await existe(demande.id)).toBe(true);
    const conv = await prisma.conversation.findUniqueOrThrow({
      where: { id: demande.conversationId },
    });
    expect(conv.lastMessageId).toBe(demande.id);
    expect(conv.lastMessageAt).toEqual(ilYA(80));
    // Son dernier message est porté par un sujet : elle est « suivie ».
    const suivies = await listConversationItems(c.db, { filter: "followed" });
    expect(suivies.items.map((i) => i.id)).toEqual([demande.conversationId]);
  });

  it("une conversation e-mail ignorée reste tant qu'elle refuse encore du courrier", async () => {
    const c = await compte();
    const muette = await courrier(c, "Pub mensuelle", 60);
    const oubliee = await courrier(c, "Pub ancienne", 60);
    await ignoreConversation(c.db, muette.conversationId, { actor: "ai" });
    await ignoreConversation(c.db, oubliee.conversationId, { actor: "ai" });
    // La première a refusé un courrier il y a trois jours : sa sourdine travaille.
    await prisma.conversation.update({
      where: { id: muette.conversationId },
      data: { unimportedCount: 1, unimportedLastAt: ilYA(3) },
    });

    expect(await nettoyerLeCompte(c.db, c.accountId, NOW)).toMatchObject({
      messages: 2,
      conversationsEmail: 1,
    });
    expect(
      await prisma.conversation.count({ where: { id: muette.conversationId } }),
    ).toBe(1);
    expect(
      await prisma.conversation.count({
        where: { id: oubliee.conversationId },
      }),
    ).toBe(0);
  });
});

describe("l'effacement des sujets fermés", () => {
  async function sujetSur(c: Compte, objet: string, jours: number) {
    const m = await courrier(c, objet, jours);
    const { subjectId } = await applyTriageMatter(c.db, {
      conversationId: m.conversationId,
      messageId: m.id,
      title: objet,
    });
    await createTask(c.db, { subjectId, title: `Tâche de ${objet}` });
    return { message: m, subjectId };
  }
  const fermeDepuis = (subjectId: string, jours: number) =>
    prisma.subject.update({
      where: { id: subjectId },
      data: { closedAt: ilYA(jours) },
    });

  it("un sujet fermé depuis plus de trente jours s'efface, et ses vieux messages avec lui", async () => {
    const c = await compte();
    const ecarte = await sujetSur(c, "Démarchage assurance", 70);
    await closeSubject(c.db, ecarte.subjectId);
    await fermeDepuis(ecarte.subjectId, 31);
    const cle = await piece(c, ecarte.message.id, 3000);

    const annonce = await simulerLeNettoyage(c.db, NOW);
    expect(annonce).toEqual({
      sujetsFermes: 1,
      messages: 1,
      pieces: 1,
      octets: 3000,
      conversationsEmail: 1,
    });
    expect(await nettoyerLeCompte(c.db, c.accountId, NOW)).toEqual(annonce);
    expect(
      await prisma.subject.count({ where: { id: ecarte.subjectId } }),
    ).toBe(0);
    expect(
      await prisma.task.count({ where: { subjectId: ecarte.subjectId } }),
    ).toBe(0);
    expect(await existe(ecarte.message.id)).toBe(false);
    expect(await enFile()).toContain(cle);
  });

  it("un message récent d'un sujet effacé redevient ordinaire : il reste, sans sujet", async () => {
    const c = await compte();
    const ecarte = await sujetSur(c, "Offre fournisseur", 10);
    await closeSubject(c.db, ecarte.subjectId);
    await fermeDepuis(ecarte.subjectId, 35);

    expect(await nettoyerLeCompte(c.db, c.accountId, NOW)).toMatchObject({
      sujetsFermes: 1,
      messages: 0,
      conversationsEmail: 0,
    });
    const m = await prisma.message.findUniqueOrThrow({
      where: { id: ecarte.message.id },
    });
    expect(m.subjectId).toBeNull();
  });

  it("ne touche ni un sujet fermé récemment, ni un sujet validé, ni un sujet rouvert", async () => {
    const c = await compte();
    const recent = await sujetSur(c, "Fermé hier", 70);
    await closeSubject(c.db, recent.subjectId);
    await fermeDepuis(recent.subjectId, 29);
    const valide = await sujetSur(c, "Validé il y a un an", 400);
    await validateSubject(c.db, valide.subjectId);
    await fermeDepuis(valide.subjectId, 365);
    const rouvert = await sujetSur(c, "Rouvert", 70);
    await closeSubject(c.db, rouvert.subjectId);
    await fermeDepuis(rouvert.subjectId, 60);
    await reopenSubject(c.db, rouvert.subjectId);

    expect(await nettoyerLeCompte(c.db, c.accountId, NOW)).toEqual({
      sujetsFermes: 0,
      messages: 0,
      pieces: 0,
      octets: 0,
      conversationsEmail: 0,
    });
    expect(await c.db.subject.count()).toBe(3);
    for (const s of [recent, valide, rouvert]) {
      expect(await existe(s.message.id)).toBe(true);
    }
  });
});

describe("la garde de la réception", () => {
  it("un message de plus de trente jours ne s'importe pas, et ne crée aucune conversation", async () => {
    const c = await compte();
    const vieux = await recevoirEmailEntrant(c.db, {
      channelId: c.boite.id,
      externalId: "rejoue-1",
      senderRaw: "ancien@exemple.fr",
      recipients: [c.email],
      subjectLine: "Vieille histoire",
      content: "Rejoué par le fournisseur",
      receivedAt: new Date(Date.now() - 31 * JOUR),
    });
    expect(vieux).toEqual({
      ecartee: true,
      motif: "trop-ancien",
      conversationId: null,
    });
    const fil = await recevoirWhatsAppEntrant(c.db, {
      channelId: c.wa.id,
      externalId: "rejoue-2",
      externalThreadId: "chat-historique",
      senderRaw: "+33612345678",
      content: "Historique",
      receivedAt: new Date(Date.now() - 400 * JOUR),
    });
    expect(fil.ecartee).toBe(true);
    expect(await c.db.conversation.count()).toBe(0);
    expect(await c.db.message.count()).toBe(0);

    // Un message récent, ou sans date, entre comme avant.
    const recent = await recevoirEmailEntrant(c.db, {
      channelId: c.boite.id,
      externalId: "vivant-1",
      senderRaw: "client@exemple.fr",
      recipients: [c.email],
      subjectLine: "Commande",
      content: "Bonjour",
      receivedAt: new Date(Date.now() - 29 * JOUR),
    });
    expect(recent.ecartee).toBe(false);
  });

  it("un vieux message déjà en base passe à l'idempotence, il n'est pas refusé", async () => {
    const c = await compte();
    const porte = await courrier(c, "Litige", 90);
    const rejoue = await recevoirEmailEntrant(c.db, {
      channelId: c.boite.id,
      externalId: porte.externalId!,
      senderRaw: "litige@exemple.fr",
      recipients: [c.email],
      subjectLine: "Litige",
      content: "Texte de Litige",
      receivedAt: ilYA(90),
    });
    expect(rejoue).toMatchObject({ ecartee: false, created: false });
  });
});
