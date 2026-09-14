import { describe, expect, it } from "vitest";
import {
  Actor,
  ChannelType,
  ContactStatus,
  EVENT_TYPES,
  applyTriageMatter,
  createSubject,
  getTriageProjection,
  hasAiSolicitationForMessage,
  ingestInboundEmail,
  ingestInboundWhatsApp,
  isAutoTriageEnabled,
  logAiSolicitation,
  logTriageFailure,
  prisma,
  recordTriageVerdict,
  tenantDb,
} from "../src/index";

// M7 tranche 4 — ce que le TRI lit et écrit en base. Le pipeline (filtre,
// appel, décision) vit dans l'application et se teste sans base ; ici on
// verrouille les lectures et les écritures : la projection est explicite, le
// verdict ne conditionne rien, ouvrir ou rattacher passe par les primitives
// du domaine, le journal porte la proposition et le coût.

async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: {
      email,
      firstName: "Mam's",
      lastName: "Crousty",
      sectors: ["food"],
    },
  });
  const db = tenantDb(account.id);
  const general = await db.folder.create({
    data: { name: "Général", slug: "general", isDefault: true },
  });
  const fournisseurs = await db.folder.create({
    data: {
      name: "Fournisseurs",
      slug: "fournisseurs",
      description: "Achats et livraisons",
    },
  });
  await db.folder.create({
    data: { name: "Ancien", slug: "ancien", isActive: false },
  });
  const channel = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "Boîte email",
      type: ChannelType.email,
      identifier: email,
    },
  });
  return { account, db, general, fournisseurs, channel };
}

function mail(
  db: ReturnType<typeof tenantDb>,
  channelId: string,
  externalId: string,
  overrides: Partial<Parameters<typeof ingestInboundEmail>[1]> = {},
) {
  return ingestInboundEmail(db, {
    channelId,
    externalId,
    senderRaw: "karim@sogood.fr",
    senderName: "Karim Benali",
    subjectLine: "Rupture sauce blanche",
    content:
      "Bonjour, la sauce blanche est en rupture, on remplace par SB-210 ?",
    ...overrides,
  });
}

const mesure = {
  sollicitation: "tri",
  tier: "extraction",
  modele: "gpt-5.6-luna",
  niveau: "low",
  jetons: {
    entree: 700,
    cacheLecture: 1_800,
    cacheEcriture: 0,
    sortie: 120,
    raisonnement: 20,
  },
  cout: { eur: 0.00029, usd: 0.00032, version: "2026-09" },
  dureeMs: 2_400,
  reponseId: "resp_1",
};

describe("interrupteur par compte", () => {
  it("est faux par défaut, et se lit par compte", async () => {
    const { account, db } = await makeAccount("a@test.fr");
    expect(await isAutoTriageEnabled(db, account.id)).toBe(false);
    await prisma.account.update({
      where: { id: account.id },
      data: { autoTriageEnabled: true },
    });
    expect(await isAutoTriageEnabled(db, account.id)).toBe(true);
  });
});

describe("projection du tri", () => {
  it("charge le compte, les domaines, les sujets ouverts et le fil avec l'expéditeur", async () => {
    const { db, channel } = await makeAccount("b@test.fr");
    const ouvert = await createSubject(db, { title: "Bail — renouvellement" });
    await createSubject(db, { title: "Clos", status: "validated" });
    const { message: m1 } = await mail(db, channel.id, "e1", {
      receivedAt: new Date("2026-09-10T08:00:00Z"),
    });
    const { message: m2 } = await mail(db, channel.id, "e2", {
      content: "Relance : avez-vous vu mon message ?",
      receivedAt: new Date("2026-09-11T08:00:00Z"),
    });
    expect(m2.conversationId).toBe(m1.conversationId);

    const p = await getTriageProjection(db, m1.conversationId);
    expect(p.orpheline).toBe(true);
    expect(p.type).toBe("email_subject");
    expect(p.compte.entreprise).toBe("Mam's Crousty");
    expect(p.compte.secteurs).toEqual(["food"]);
    // Domaines actifs, « Général » compris (la couche le filtre) ; l'inactif non.
    expect(p.compte.domaines.map((d) => d.nom)).toEqual([
      "Fournisseurs",
      "Général",
    ]);
    expect(p.compte.domaines[0]?.description).toBe("Achats et livraisons");
    // Des titres de sujets OUVERTS, jamais les validés.
    expect(p.compte.sujetsOuverts).toEqual([
      { reference: ouvert.reference, titre: "Bail — renouvellement" },
    ]);
    expect(p.compte.instructionsGenerales).toEqual([]);
    expect(p.compte.etiquettes).toEqual([]);
    // Le fil, dans l'ordre, expéditeur nommé et adressé.
    expect(p.conversation.canal).toBe("email");
    expect(p.conversation.messages.map((m) => m.contenu)).toEqual([
      "Bonjour, la sauce blanche est en rupture, on remplace par SB-210 ?",
      "Relance : avez-vous vu mon message ?",
    ]);
    expect(p.conversation.messages[0]).toMatchObject({
      expediteur: "Karim Benali <karim@sogood.fr>",
      recuLe: "2026-09-10T08:00:00.000Z",
      objet: "Rupture sauce blanche",
      sens: "entrant",
    });
    expect(p.dernierEntrant).toMatchObject({
      id: m2.id,
      adresse: "karim@sogood.fr",
      nom: "Karim Benali",
      objet: "Rupture sauce blanche",
    });
  });

  it("n'est plus orpheline dès qu'un sujet écoute le fil, ni quand la source est ignorée", async () => {
    const { db, channel } = await makeAccount("c@test.fr");
    const { message } = await mail(db, channel.id, "e1");
    await applyTriageMatter(db, {
      conversationId: message.conversationId,
      messageId: message.id,
      title: "Rupture sauce blanche",
    });
    const p = await getTriageProjection(db, message.conversationId);
    expect(p.orpheline).toBe(false);

    const { message: m2 } = await mail(db, channel.id, "e2", {
      subjectLine: "Newsletter",
    });
    await db.conversation.updateMany({
      where: { id: m2.conversationId },
      data: { status: "ignored" },
    });
    const p2 = await getTriageProjection(db, m2.conversationId);
    expect(p2.orpheline).toBe(false);
    expect(p2.statut).toBe("ignored");
  });

  it("borne le fil au plus ancien et aux derniers messages", async () => {
    const { db, channel } = await makeAccount("d@test.fr");
    let conversationId = "";
    for (let i = 0; i < 15; i++) {
      const { message } = await mail(db, channel.id, `e${i}`, {
        content: `message ${i}`,
        receivedAt: new Date(Date.UTC(2026, 8, 1 + i)),
      });
      conversationId = message.conversationId;
    }
    const p = await getTriageProjection(db, conversationId);
    const contenus = p.conversation.messages.map((m) => m.contenu);
    expect(contenus[0]).toBe("message 0");
    expect(contenus.at(-1)).toBe("message 14");
    expect(contenus).toHaveLength(11);
  });
});

describe("verdict de tri", () => {
  it("écrit le dernier verdict sur la conversation et journalise la proposition", async () => {
    const { db, channel } = await makeAccount("e@test.fr");
    const { message } = await mail(db, channel.id, "e1");
    await recordTriageVerdict(db, {
      conversationId: message.conversationId,
      messageId: message.id,
      verdict: "noise",
      noiseReason: "advertising",
      confidence: "high",
      reason: "Promotion générique sans action attendue.",
      source: "model",
      proposal: { verdict: "bruit", titre: null },
    });
    const c = await db.conversation.findFirstOrThrow({
      where: { id: message.conversationId },
    });
    expect(c.triageVerdict).toBe("noise");
    expect(c.triageNoiseReason).toBe("advertising");
    expect(c.triageConfidence).toBe("high");
    expect(c.triageReason).toBe("Promotion générique sans action attendue.");
    expect(c.triagedAt).not.toBeNull();
    // Le verdict ne conditionne rien : toujours active, toujours orpheline.
    expect(c.status).toBe("active");

    const ev = await db.eventLog.findFirstOrThrow({
      where: { eventType: EVENT_TYPES.triageVerdict, messageId: message.id },
    });
    expect(ev.actor).toBe(Actor.ai);
    expect(ev.title).toBe("Tri : bruit — publicité (confiance haute)");
    expect(ev.metadata).toMatchObject({
      verdict: "noise",
      noiseReason: "advertising",
      source: "model",
      proposal: { verdict: "bruit" },
    });

    // Un second verdict REMPLACE le premier (le dernier fait foi, 02).
    await recordTriageVerdict(db, {
      conversationId: message.conversationId,
      messageId: message.id,
      verdict: "matter",
      noiseReason: "advertising", // ignorée : la catégorie ne va qu'avec « bruit »
      confidence: "medium",
      reason: "Une commande à valider.",
      source: "model",
    });
    const c2 = await db.conversation.findFirstOrThrow({
      where: { id: message.conversationId },
    });
    expect(c2.triageVerdict).toBe("matter");
    expect(c2.triageNoiseReason).toBeNull();
    expect(c2.triageConfidence).toBe("medium");
  });

  it("journalise un verdict déterministe sans appel", async () => {
    const { db, channel } = await makeAccount("f@test.fr");
    const { message } = await mail(db, channel.id, "e1", {
      senderRaw: "noreply@banque.fr",
    });
    await recordTriageVerdict(db, {
      conversationId: message.conversationId,
      messageId: message.id,
      verdict: "noise",
      noiseReason: "automatic",
      confidence: "high",
      reason: "Expéditeur sans réponse possible (noreply@…).",
      source: "deterministic",
      rule: "expediteur-sans-reponse",
    });
    const ev = await db.eventLog.findFirstOrThrow({
      where: { eventType: EVENT_TYPES.triageVerdict, messageId: message.id },
    });
    expect(ev.title).toBe("Tri : bruit — automatique (règle, sans appel)");
    expect(ev.metadata).toMatchObject({
      source: "deterministic",
      rule: "expediteur-sans-reponse",
    });
    expect(
      await db.eventLog.count({
        where: { eventType: EVENT_TYPES.iaSollicitation },
      }),
    ).toBe(0);
  });
});

describe("ouvrir ou rattacher depuis le tri", () => {
  it("ouvre un sujet par Relvo, classé par le nom du domaine, contact automatique, fil balayé", async () => {
    const { db, channel, fournisseurs } = await makeAccount("g@test.fr");
    const { message: m1 } = await mail(db, channel.id, "e1");
    const { message: m2 } = await mail(db, channel.id, "e2", {
      content: "Relance.",
    });

    const r = await applyTriageMatter(db, {
      conversationId: m1.conversationId,
      messageId: m2.id,
      title: "Rupture sauce blanche — remplacement SB-210",
      folderName: "fournisseurs", // la casse ne compte pas
      proposedFolder: "Approvisionnement", // ignoré : un domaine a été résolu
      priority: "urgent",
    });
    expect(r.action).toBe("opened");
    expect(r.folderId).toBe(fournisseurs.id);
    expect(r.proposedFolder).toBeNull();

    const subject = await db.subject.findFirstOrThrow({
      where: { id: r.subjectId },
    });
    expect(subject.title).toBe("Rupture sauce blanche — remplacement SB-210");
    expect(subject.createdByActor).toBe(Actor.ai);
    expect(subject.folderId).toBe(fournisseurs.id);
    expect(subject.priority).toBe("urgent");
    expect(subject.proposedFolder).toBeNull();
    expect(subject.contactIds).toHaveLength(1);

    // Le contact naît AUTOMATIQUE — « à compléter » (04 §10).
    const contact = await db.contact.findFirstOrThrow({
      where: { id: subject.contactIds[0] },
    });
    expect(contact.status).toBe(ContactStatus.auto);
    expect(contact.sourceActor).toBe(Actor.ai);
    expect(contact.email).toBe("karim@sogood.fr");
    expect(contact.lastName).toBe("Benali");

    // Le fil entier est balayé (le sujet EST le fil), et classé (05 §1.1 ter).
    const messages = await db.message.findMany({
      where: { conversationId: m1.conversationId },
    });
    expect(messages.every((m) => m.subjectId === r.subjectId)).toBe(true);
    expect(messages.every((m) => m.folderId === fournisseurs.id)).toBe(true);

    // Le journal porte la création par Relvo.
    const ev = await db.eventLog.findFirstOrThrow({
      where: { eventType: EVENT_TYPES.subjectCreated, subjectId: r.subjectId },
    });
    expect(ev.actor).toBe(Actor.ai);
  });

  it("ne classe jamais dans « Général » ni dans un domaine inconnu : sans domaine, avec le domaine proposé", async () => {
    const { db, channel } = await makeAccount("h@test.fr");
    const { message } = await mail(db, channel.id, "e1");
    const r = await applyTriageMatter(db, {
      conversationId: message.conversationId,
      messageId: message.id,
      title: "Contrôle d'hygiène",
      folderName: "Général",
      proposedFolder: "Réglementaire",
    });
    expect(r.folderId).toBeNull();
    expect(r.proposedFolder).toBe("Réglementaire");
    const subject = await db.subject.findFirstOrThrow({
      where: { id: r.subjectId },
    });
    expect(subject.folderId).toBeNull();
    expect(subject.proposedFolder).toBe("Réglementaire");

    const { message: m2 } = await mail(db, channel.id, "e2", {
      subjectLine: "Autre affaire",
    });
    const r2 = await applyTriageMatter(db, {
      conversationId: m2.conversationId,
      messageId: m2.id,
      folderName: "Ancien", // inactif
    });
    expect(r2.folderId).toBeNull();
    const s2 = await db.subject.findFirstOrThrow({
      where: { id: r2.subjectId },
    });
    // Sans titre proposé, l'objet du fil est le titre (cas e-mail).
    expect(s2.title).toBe("Autre affaire");
  });

  it("rattache au sujet ouvert que le fil prolonge, sinon ouvre", async () => {
    const { db, channel } = await makeAccount("i@test.fr");
    const existant = await createSubject(db, { title: "Retard livraison" });
    const valide = await createSubject(db, {
      title: "Ancien retard",
      status: "validated",
    });
    const { message } = await mail(db, channel.id, "e1", {
      subjectLine: "RE: palette bloquée",
    });

    const r = await applyTriageMatter(db, {
      conversationId: message.conversationId,
      messageId: message.id,
      title: "Palette bloquée",
      existingSubjectReference: existant.reference,
    });
    expect(r.action).toBe("attached");
    expect(r.subjectId).toBe(existant.id);
    expect(await db.subject.count()).toBe(2);
    const m = await db.message.findFirstOrThrow({ where: { id: message.id } });
    expect(m.subjectId).toBe(existant.id);
    const ev = await db.eventLog.findFirstOrThrow({
      where: {
        eventType: EVENT_TYPES.conversationAttached,
        subjectId: existant.id,
      },
    });
    expect(ev.actor).toBe(Actor.ai);

    // Une référence fermée ou inconnue n'est pas une erreur : on ouvre.
    const { message: m2 } = await mail(db, channel.id, "e2", {
      subjectLine: "Autre fil",
    });
    const r2 = await applyTriageMatter(db, {
      conversationId: m2.conversationId,
      messageId: m2.id,
      existingSubjectReference: valide.reference,
    });
    expect(r2.action).toBe("opened");
    expect(r2.subjectId).not.toBe(valide.id);
    const { message: m3 } = await mail(db, channel.id, "e3", {
      subjectLine: "Encore un fil",
    });
    const r3 = await applyTriageMatter(db, {
      conversationId: m3.conversationId,
      messageId: m3.id,
      existingSubjectReference: "SUB-99999",
    });
    expect(r3.action).toBe("opened");
  });

  it("refuse un fil qui n'est pas un e-mail", async () => {
    const { account, db } = await makeAccount("j@test.fr");
    const wa = await prisma.channel.create({
      data: {
        accountId: account.id,
        name: "WhatsApp",
        type: ChannelType.whatsapp,
        identifier: "+33600000000",
      },
    });
    const { message } = await ingestInboundWhatsApp(db, {
      channelId: wa.id,
      externalId: "w1",
      externalThreadId: "chat-1",
      senderRaw: "+33600000010",
      content: "Salut",
    });
    await expect(
      applyTriageMatter(db, {
        conversationId: message.conversationId,
        messageId: message.id,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("compteur et échec", () => {
  it("consigne chaque sollicitation avec ses jetons et son coût, et rend le message idempotent", async () => {
    const { db, channel } = await makeAccount("k@test.fr");
    const { message } = await mail(db, channel.id, "e1");
    expect(await hasAiSolicitationForMessage(db, message.id, "tri")).toBe(
      false,
    );
    await logAiSolicitation(db, {
      ...mesure,
      messageId: message.id,
      conversationId: message.conversationId,
    });
    expect(await hasAiSolicitationForMessage(db, message.id, "tri")).toBe(true);
    expect(
      await hasAiSolicitationForMessage(db, message.id, "structuration"),
    ).toBe(false);

    const ev = await db.eventLog.findFirstOrThrow({
      where: { eventType: EVENT_TYPES.iaSollicitation, messageId: message.id },
    });
    expect(ev.actor).toBe(Actor.ai);
    expect(ev.title).toBe("Sollicitation « tri » — gpt-5.6-luna");
    expect(ev.metadata).toMatchObject({
      sollicitation: "tri",
      tier: "extraction",
      niveau: "low",
      jetons: { entree: 700, cacheLecture: 1_800, raisonnement: 20 },
      cout: { eur: 0.00029, version: "2026-09" },
      dureeMs: 2_400,
    });
  });

  it("journalise un échec sans rien inventer", async () => {
    const { db, channel } = await makeAccount("l@test.fr");
    const { message } = await mail(db, channel.id, "e1");
    await logTriageFailure(db, {
      conversationId: message.conversationId,
      messageId: message.id,
      error: "fetch failed",
    });
    const ev = await db.eventLog.findFirstOrThrow({
      where: { eventType: EVENT_TYPES.triageFailed, messageId: message.id },
    });
    expect(ev.actor).toBe(Actor.system);
    expect(ev.description).toBe("fetch failed");
    expect(await db.subject.count()).toBe(0);
    const p = await getTriageProjection(db, message.conversationId);
    expect(p.orpheline).toBe(true);
  });
});
