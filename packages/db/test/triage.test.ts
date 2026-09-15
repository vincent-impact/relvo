import { describe, expect, it } from "vitest";
import {
  Actor,
  ChannelType,
  ContactStatus,
  EVENT_TYPES,
  applyTriageMatter,
  createSubject,
  getConversationBadges,
  getTriageProjection,
  hasAiSolicitationForMessage,
  ignoreConversation,
  ingestInboundEmail,
  ingestInboundWhatsApp,
  isAssistantEnabled,
  listConversationItems,
  logAiSolicitation,
  logTriageFailure,
  openSubjectOnConversation,
  markConversationFilterSeen,
  prisma,
  reactivateConversation,
  recordTriageVerdict,
  setAssistantEnabled,
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

describe("assistant actif sur le compte", () => {
  it("est coupé par défaut, s'active et se coupe par la méthode du domaine, journalisé", async () => {
    const { account, db } = await makeAccount("a@test.fr");
    expect(await isAssistantEnabled(db, account.id)).toBe(false);

    expect(await setAssistantEnabled(db, account.id, true)).toEqual({
      assistantEnabled: true,
      changed: true,
    });
    expect(await isAssistantEnabled(db, account.id)).toBe(true);
    // Idempotent : aucun événement en double.
    expect(await setAssistantEnabled(db, account.id, true)).toEqual({
      assistantEnabled: true,
      changed: false,
    });

    expect(
      await setAssistantEnabled(db, account.id, false, Actor.system),
    ).toMatchObject({ assistantEnabled: false, changed: true });
    expect(await isAssistantEnabled(db, account.id)).toBe(false);

    const events = await db.eventLog.findMany({
      where: {
        eventType: {
          in: [EVENT_TYPES.assistantEnabled, EVENT_TYPES.assistantDisabled],
        },
      },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((e) => [e.eventType, e.actor])).toEqual([
      [EVENT_TYPES.assistantEnabled, Actor.user],
      [EVENT_TYPES.assistantDisabled, Actor.system],
    ]);
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
    // Le dirigeant est nommé comme tel, jamais comme « l'entreprise » ; la
    // messagerie sur laquelle le fil est arrivé est donnée.
    expect(p.compte.dirigeant).toBe("Mam's Crousty");
    expect(p.compte.entreprise).toBeNull();
    expect(p.compte.messageries).toEqual(["b@test.fr"]);
    expect(p.compte.secteurs).toEqual(["food"]);
    // Domaines actifs, « Général » compris (la couche le filtre) ; l'inactif non.
    expect(p.compte.domaines.map((d) => d.nom)).toEqual([
      "Fournisseurs",
      "Général",
    ]);
    expect(p.compte.domaines[0]?.description).toBe("Achats et livraisons");
    // Des titres de sujets OUVERTS, jamais les validés.
    expect(p.compte.sujetsOuverts).toEqual([
      {
        reference: ouvert.reference,
        titre: "Bail — renouvellement",
        enAttente: false,
      },
    ]);
    expect(p.compte.instructionsGenerales).toEqual([]);
    expect(p.compte.etiquettes).toEqual([]);
    // L'expéditeur : adresse inconnue du carnet, rien d'autre à dire.
    expect(p.expediteur).toMatchObject({
      adresse: "karim@sogood.fr",
      connu: false,
      sujetsParSesFils: 0,
      antecedentsTri: [],
      sujetsEnCours: [],
    });
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
      nature: "advertising",
      confidence: "high",
      reason: "Promotion générique sans action attendue.",
      source: "model",
      proposal: { action: "rien_a_faire", titre: null },
    });
    const c = await db.conversation.findFirstOrThrow({
      where: { id: message.conversationId },
    });
    expect(c.triageVerdict).toBe("noise");
    expect(c.triageNature).toBe("advertising");
    expect(c.triageConfidence).toBe("high");
    expect(c.triageReason).toBe("Promotion générique sans action attendue.");
    expect(c.triagedAt).not.toBeNull();
    // Le verdict ne conditionne rien : toujours active, toujours orpheline.
    expect(c.status).toBe("active");

    const ev = await db.eventLog.findFirstOrThrow({
      where: { eventType: EVENT_TYPES.triageVerdict, messageId: message.id },
    });
    expect(ev.actor).toBe(Actor.ai);
    expect(ev.title).toBe("Tri : rien à faire · publicité (confiance haute)");
    expect(ev.metadata).toMatchObject({
      verdict: "noise",
      nature: "advertising",
      source: "model",
      proposal: { action: "rien_a_faire" },
    });

    // Un second verdict REMPLACE le premier (le dernier fait foi, 02).
    await recordTriageVerdict(db, {
      conversationId: message.conversationId,
      messageId: message.id,
      verdict: "matter",
      nature: "professional", // la nature est toujours posée, quelle que soit l'action
      confidence: "medium",
      reason: "Une commande à valider.",
      source: "model",
    });
    const c2 = await db.conversation.findFirstOrThrow({
      where: { id: message.conversationId },
    });
    expect(c2.triageVerdict).toBe("matter");
    expect(c2.triageNature).toBe("professional");
    expect(c2.triageConfidence).toBe("medium");
  });

  it("journalise un verdict déterministe sans appel", async () => {
    const { db, channel } = await makeAccount("f@test.fr");
    const { message } = await mail(db, channel.id, "e1", {
      senderRaw: "promo@grossiste.fr",
    });
    await recordTriageVerdict(db, {
      conversationId: message.conversationId,
      messageId: message.id,
      verdict: "noise",
      nature: "advertising",
      confidence: "high",
      reason: "Envoi en masse : l'e-mail porte un en-tête de désabonnement.",
      source: "deterministic",
      rule: "en-tete-desabonnement",
    });
    const ev = await db.eventLog.findFirstOrThrow({
      where: { eventType: EVENT_TYPES.triageVerdict, messageId: message.id },
    });
    expect(ev.title).toBe("Tri : rien à faire · publicité (règle, sans appel)");
    expect(ev.metadata).toMatchObject({
      source: "deterministic",
      rule: "en-tete-desabonnement",
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

describe("profil de l'expéditeur", () => {
  it("sait, sans appel, ce que ses fils ont produit, ce qu'on en a écarté, et ce qui l'attend", async () => {
    const { db, channel, fournisseurs } = await makeAccount("p@test.fr");
    const karim = await db.contact.create({
      data: {
        firstName: "Karim",
        lastName: "Benali",
        email: "karim@sogood.fr",
        company: "SoGood",
        role: "supplier",
        sourceActor: Actor.user,
      },
    });
    // Deux fils passés : un sujet validé, un sujet ouvert en attente de sa réponse.
    const a = await mail(db, channel.id, "k1", { subjectLine: "Palettes" });
    await openSubjectOnConversation(db, {
      conversationId: a.message.conversationId,
      title: "Palettes de juin",
      folderId: fournisseurs.id,
    });
    const valide = await db.subject.findFirstOrThrow({
      where: { title: "Palettes de juin" },
    });
    await db.subject.update({
      where: { id: valide.id },
      data: { status: "validated" },
    });
    const b = await mail(db, channel.id, "k2", { subjectLine: "Sauce" });
    await openSubjectOnConversation(db, {
      conversationId: b.message.conversationId,
      title: "Rupture sauce blanche",
      folderId: fournisseurs.id,
    });
    const ouvert = await db.subject.findFirstOrThrow({
      where: { title: "Rupture sauce blanche" },
    });
    await db.subject.update({
      where: { id: ouvert.id },
      data: { waitingForReply: true, lastActivityAt: new Date() },
    });
    // Un fil ignoré, d'une autre adresse : il ne compte pas pour Karim.
    const autre = await mail(db, channel.id, "x1", {
      senderRaw: "promo@grossiste.fr",
      senderName: null,
    });
    await ignoreConversation(db, autre.message.conversationId, {
      reason: "advertising",
    });

    // Le fil à trier, de Karim.
    const c = await mail(db, channel.id, "k3", { subjectLine: "RE: palette" });
    const p = await getTriageProjection(db, c.message.conversationId);
    expect(p.expediteur).toMatchObject({
      connu: true,
      nom: "Karim Benali",
      entreprise: "SoGood",
      role: "supplier",
      sujetsParSesFils: 2,
      sujetsValides: 1,
      domaineHabituel: "Fournisseurs",
      antecedentsTri: [],
    });
    expect(p.expediteur.sujetsEnCours).toEqual([
      {
        reference: ouvert.reference,
        titre: "Rupture sauce blanche",
        enAttente: true,
        derniereActiviteLe: expect.any(String),
      },
    ]);
    expect(karim.id).toBeTruthy();
    // Les sujets poussés au tri : ceux de Karim d'abord, puis les autres ouverts.
    expect(p.compte.sujetsOuverts[0]).toEqual({
      reference: ouvert.reference,
      titre: "Rupture sauce blanche",
      enAttente: true,
    });

    // L'adresse inconnue, elle, porte son antécédent.
    const d = await mail(db, channel.id, "x2", {
      senderRaw: "promo@grossiste.fr",
      senderName: null,
      subjectLine: "Promo",
    });
    const q = await getTriageProjection(db, d.message.conversationId);
    expect(q.expediteur).toMatchObject({
      connu: false,
      antecedentsTri: [{ raison: "advertising", nombre: 1 }],
      sujetsEnCours: [],
    });
  });
});

describe("faire taire une source, et les pastilles", () => {
  it("Relvo ignore un fil avec sa catégorie pour raison ; réactiver efface la raison, pas le verdict", async () => {
    const { db, channel } = await makeAccount("m@test.fr");
    const { message } = await mail(db, channel.id, "e1", {
      senderRaw: "promo@grossiste.fr",
    });
    await recordTriageVerdict(db, {
      conversationId: message.conversationId,
      messageId: message.id,
      verdict: "noise",
      nature: "advertising",
      confidence: "high",
      reason: "Promotion générique.",
      source: "model",
    });
    const ignored = await ignoreConversation(db, message.conversationId, {
      reason: "advertising",
      note: "Promotion générique.",
      actor: Actor.ai,
    });
    expect(ignored.status).toBe("ignored");
    expect(ignored.ignoredByActor).toBe(Actor.ai);

    const c = await db.conversation.findFirstOrThrow({
      where: { id: message.conversationId },
    });
    expect(c.ignoreReason).toBe("advertising");
    expect(c.ignoreNote).toBe("Promotion générique.");
    expect(c.ignoredByActor).toBe(Actor.ai);
    // Sortie de « Sans sujet », visible dans « Ignorées » avec son auteur.
    const unsorted = await listConversationItems(db, { filter: "unsorted" });
    expect(unsorted.items).toHaveLength(0);
    const ignoredList = await listConversationItems(db, { filter: "ignored" });
    expect(ignoredList.items[0]).toMatchObject({
      ignore: { reason: "advertising", by: Actor.ai },
      triage: { verdict: "noise", nature: "advertising" },
    });
    const ev = await db.eventLog.findFirstOrThrow({
      where: { eventType: EVENT_TYPES.conversationIgnored },
    });
    expect(ev.actor).toBe(Actor.ai);
    expect(ev.title).toContain("par Relvo");

    // L'utilisateur se dédit : la raison s'efface, le verdict de Relvo reste.
    await reactivateConversation(db, message.conversationId);
    const c2 = await db.conversation.findFirstOrThrow({
      where: { id: message.conversationId },
    });
    expect(c2.status).toBe("active");
    expect(c2.ignoreReason).toBeNull();
    expect(c2.ignoredByActor).toBeNull();
    expect(c2.triageVerdict).toBe("noise");
  });

  it("le geste de l'utilisateur reste porté par lui, sans raison obligatoire", async () => {
    const { db, channel } = await makeAccount("n@test.fr");
    const { message } = await mail(db, channel.id, "e1");
    await ignoreConversation(db, message.conversationId);
    const c = await db.conversation.findFirstOrThrow({
      where: { id: message.conversationId },
    });
    expect(c.ignoredByActor).toBe(Actor.user);
    expect(c.ignoreReason).toBeNull();
  });

  it("les pastilles : « Sans sujet » est un stock, « Suivies » et « Ignorées » un flux depuis le dernier passage", async () => {
    const { db, account, channel } = await makeAccount("o@test.fr");
    const existant = await createSubject(db, { title: "Retard livraison" });

    // 1. ignorée par Relvo
    const a = await mail(db, channel.id, "a", { subjectLine: "Promo" });
    await recordTriageVerdict(db, {
      conversationId: a.message.conversationId,
      messageId: a.message.id,
      verdict: "noise",
      nature: "advertising",
      confidence: "high",
      reason: "Promo.",
      source: "model",
    });
    await ignoreConversation(db, a.message.conversationId, {
      reason: "advertising",
      actor: Actor.ai,
    });
    // 2. ouverte en sujet
    const b = await mail(db, channel.id, "b", { subjectLine: "Rupture" });
    await recordTriageVerdict(db, {
      conversationId: b.message.conversationId,
      messageId: b.message.id,
      verdict: "matter",
      confidence: "high",
      reason: "Une validation attendue.",
      source: "model",
    });
    await applyTriageMatter(db, {
      conversationId: b.message.conversationId,
      messageId: b.message.id,
      title: "Rupture",
    });
    // 3. rattachée
    const c = await mail(db, channel.id, "c", { subjectLine: "RE: palette" });
    await recordTriageVerdict(db, {
      conversationId: c.message.conversationId,
      messageId: c.message.id,
      verdict: "matter",
      confidence: "high",
      reason: "Prolonge le retard.",
      source: "model",
    });
    await applyTriageMatter(db, {
      conversationId: c.message.conversationId,
      messageId: c.message.id,
      existingSubjectReference: existant.reference,
    });
    // 4. laissée à trier (incertain)
    const d = await mail(db, channel.id, "d", { subjectLine: "Question" });
    await recordTriageVerdict(db, {
      conversationId: d.message.conversationId,
      messageId: d.message.id,
      verdict: "uncertain",
      confidence: "low",
      reason: "Pas clair.",
      source: "model",
    });
    // 5. jamais lue par Relvo
    await mail(db, channel.id, "e", { subjectLine: "Non lue" });
    // 6. ignorée par l'utilisateur, hors du compte de Relvo
    const f = await mail(db, channel.id, "f", { subjectLine: "Perso" });
    await ignoreConversation(db, f.message.conversationId);

    // Jamais passé : tout ce que Relvo a rangé est nouveau. Le stock compte
    // TOUTES les conversations sans sujet, lues ou non (d, e) ; le geste de
    // l'utilisateur (f) ne compte pas dans « Ignorées ».
    expect(await getConversationBadges(db, account.id)).toEqual({
      unsorted: 2,
      followed: 2,
      ignored: 1,
    });

    // L'onglet « Suivies » vu : son flux tombe, le reste ne bouge pas.
    await markConversationFilterSeen(db, account.id, "followed");
    expect(await getConversationBadges(db, account.id)).toEqual({
      unsorted: 2,
      followed: 0,
      ignored: 1,
    });
    await markConversationFilterSeen(db, account.id, "ignored");
    expect(await getConversationBadges(db, account.id)).toMatchObject({
      followed: 0,
      ignored: 0,
    });

    // Relvo range un nouveau fil après le passage : le flux repart de 1. Trier
    // à la main le stock ne touche pas les flux.
    const g = await mail(db, channel.id, "g", { subjectLine: "Pub" });
    await recordTriageVerdict(db, {
      conversationId: g.message.conversationId,
      messageId: g.message.id,
      verdict: "noise",
      nature: "advertising",
      confidence: "high",
      reason: "Promotion.",
      source: "model",
    });
    await ignoreConversation(db, g.message.conversationId, {
      reason: "advertising",
      note: "Promotion.",
      actor: "ai",
    });
    await ignoreConversation(db, d.message.conversationId);
    expect(await getConversationBadges(db, account.id)).toEqual({
      unsorted: 1,
      followed: 0,
      ignored: 1,
    });
  });
});
