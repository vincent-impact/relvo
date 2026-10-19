import { describe, expect, it } from "vitest";
import {
  completeTask,
  createContact,
  createNote,
  createSubject,
  createTask,
  defaireGeste,
  deleteNote,
  deleteTask,
  EVENT_TYPES,
  getEchangeProjection,
  ingestInboundEmail,
  ingestInboundWhatsApp,
  prisma,
  reopenTask,
  resolveSubject,
  getBriefProjection,
  instantDebutJourParis,
  instantFinJourParis,
  searchKnowledge,
  searchMessages,
  searchSubjects,
  searchTasks,
  setNoteActive,
  tenantDb,
  updateNote,
  updateSubject,
  updateSubjectPriority,
  updateSubjectStatus,
  updateTask,
} from "../src/index";

// Ce que l'échange avec Relvo LIT en base (M10) : le compte et le brief depuis
// n'importe quelle page, la fiche de l'affaire ou du contact ouvert, et la
// résolution d'une affaire désignée par sa référence ou son titre — jamais
// une approximation silencieuse.

async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: {
      email,
      firstName: "Mam's",
      lastName: "Crousty",
      sectors: ["food"],
    },
  });
  return { account, db: tenantDb(account.id) };
}

describe("projection de l'échange", () => {
  it("hors d'une fiche : le compte, le brief calculé, ni affaire ni domaine", async () => {
    const { account, db } = await makeAccount("echange-brief@test.fr");
    const urgent = await createSubject(db, { title: "Panne four" });
    await updateSubjectPriority(db, urgent.id, "urgent");
    await createSubject(db, { title: "Devis ClimaPro" });
    await createTask(db, {
      subjectId: urgent.id,
      title: "Rappeler le réparateur",
      startDate: new Date("2026-10-10T00:00:00.000Z"),
    });

    const p = await getEchangeProjection(db, {
      accountId: account.id,
      now: new Date("2026-10-15T10:00:00.000Z"),
    });
    expect(p.compte.dirigeant).toBe("Mam's Crousty");
    expect(p.compte.secteurs).toEqual(["food"]);
    expect(p.sujet).toBeNull();
    expect(p.domaine).toBeNull();
    expect(p.contact).toBeNull();
    expect(p.brief.sujetsOuverts).toBe(2);
    expect(p.brief.sujetsUrgents.map((s) => s.titre)).toEqual(["Panne four"]);
    expect(p.brief.tachesEnRetard).toBe(1);
  });

  it("sur une affaire : sa fiche, son domaine, son contact ; sur un contact : sa fiche", async () => {
    const { account, db } = await makeAccount("echange-fiche@test.fr");
    const contact = await createContact(db, {
      firstName: "Karim",
      lastName: "Benali",
      company: "ClimaPro",
    });
    const sujet = await createSubject(db, {
      title: "Retard livraison sauce blanche",
      contactIds: [contact.id],
    });

    const surAffaire = await getEchangeProjection(db, {
      accountId: account.id,
      subjectId: sujet.id,
    });
    expect(surAffaire.sujet?.reference).toBe(sujet.reference);
    expect(surAffaire.sujet?.id).toBe(sujet.id);
    expect(surAffaire.contact?.nom).toBe("Karim Benali");
    expect(surAffaire.brief.sujetsOuverts).toBe(1);

    const surContact = await getEchangeProjection(db, {
      accountId: account.id,
      contactId: contact.id,
    });
    expect(surContact.sujet).toBeNull();
    expect(surContact.contact?.entreprise).toBe("ClimaPro");
    expect(surContact.contact?.nom).toBe("Karim Benali");
    expect(surAffaire.sujet?.contacts.map((c) => c.nom)).toEqual([
      "Karim Benali",
    ]);
  });
});

describe("l'affaire que le dirigeant désigne", () => {
  it("par sa référence, entière ou en numéro ; par son titre, les ouvertes d'abord ; sinon rien", async () => {
    const { db } = await makeAccount("echange-resolve@test.fr");
    const a = await createSubject(db, { title: "Devis isolation Narbonne" });
    const b = await createSubject(db, { title: "Devis isolation Béziers" });
    await prisma.subject.update({
      where: { id: b.id },
      data: { status: "validated" },
    });

    expect((await resolveSubject(db, { reference: a.reference }))?.id).toBe(
      a.id,
    );
    expect((await resolveSubject(db, { reference: "sub-0002" }))?.id).toBe(
      b.id,
    );
    expect((await resolveSubject(db, { reference: "2" }))?.id).toBe(b.id);
    expect((await resolveSubject(db, { titre: "isolation" }))?.id).toBe(a.id);
    expect((await resolveSubject(db, { titre: "béziers" }))?.id).toBe(b.id);
    expect(await resolveSubject(db, { titre: "plomberie" })).toBeNull();
    expect(await resolveSubject(db, { reference: "SUB-9999" })).toBeNull();
    expect(await resolveSubject(db, {})).toBeNull();
  });
});

describe("la provenance d'un geste demandé dans l'échange (M10.13)", () => {
  it("chaque écriture du domaine porte `source: chat` dans son journal quand l'échange la demande", async () => {
    const { db } = await makeAccount("echange-origine@test.fr");
    const chat = { source: "chat" as const };
    const sujet = await createSubject(db, { title: "Devis ClimaPro" }, chat);
    await updateSubject(db, sujet.id, { summary: "Un devis à relire." }, chat);
    await updateSubjectPriority(db, sujet.id, "urgent", "user", chat);
    const tache = await createTask(
      db,
      { subjectId: sujet.id, title: "Relire le devis" },
      chat,
    );
    await updateTask(db, tache.id, { title: "Relire le devis ClimaPro" }, chat);
    await completeTask(db, tache.id, "user", undefined, chat);
    await reopenTask(db, tache.id, chat);
    await deleteTask(db, tache.id, chat);
    await updateSubjectStatus(db, sujet.id, "validated", "user", chat);
    const general = await prisma.folder.create({
      data: {
        accountId: (
          await prisma.account.findUniqueOrThrow({
            where: { email: "echange-origine@test.fr" },
          })
        ).id,
        name: "Général",
        slug: "general",
        isDefault: true,
      },
    });
    const note = await createNote(
      db,
      { folderId: general.id, name: "Délais fournisseurs", content: "48 h." },
      chat,
    );
    await updateNote(db, note.id, { content: "72 h." }, chat);
    await deleteNote(db, note.id, chat);

    const events = await db.eventLog.findMany({
      orderBy: { createdAt: "asc" },
      select: { eventType: true, metadata: true },
    });
    const types = events
      .filter(
        (e) => (e.metadata as { source?: string } | null)?.source === "chat",
      )
      .map((e) => e.eventType);
    for (const attendu of [
      EVENT_TYPES.subjectCreated,
      EVENT_TYPES.subjectUpdated,
      EVENT_TYPES.subjectPriorityChanged,
      EVENT_TYPES.taskCreatedByUser,
      EVENT_TYPES.taskUpdated,
      EVENT_TYPES.taskCompleted,
      EVENT_TYPES.taskReopened,
      EVENT_TYPES.taskDeleted,
      EVENT_TYPES.subjectValidated,
      EVENT_TYPES.knowledgeCreated,
      EVENT_TYPES.knowledgeUpdated,
      EVENT_TYPES.knowledgeDeleted,
    ]) {
      expect(types, attendu).toContain(attendu);
    }
  });

  it("sans origine, rien n'est ajouté à la métadonnée — l'écran ne change pas", async () => {
    const { db } = await makeAccount("echange-sans-origine@test.fr");
    const sujet = await createSubject(db, { title: "Sans origine" });
    await createTask(db, { subjectId: sujet.id, title: "Une tâche" });
    const events = await db.eventLog.findMany({ select: { metadata: true } });
    for (const e of events) {
      expect(
        (e.metadata as { source?: string } | null)?.source,
      ).toBeUndefined();
    }
  });
});

describe("la recherche de messages de l'échange", () => {
  it("cherche dans l'objet, le texte et l'expéditeur, bornée, les plus récents d'abord", async () => {
    const { account, db } = await makeAccount("echange-recherche@test.fr");
    const channel = await prisma.channel.create({
      data: {
        accountId: account.id,
        name: "Boîte email",
        type: "email",
        identifier: "contact@tastycrousty.fr",
      },
    });
    const textes = [
      "Première livraison décalée",
      "Relance livraison",
      "Autre chose",
    ];
    for (const [i, texte] of textes.entries()) {
      const { message } = await ingestInboundEmail(db, {
        channelId: channel.id,
        externalId: `mail-${i}`,
        senderRaw: "karim@sogood.fr",
        senderName: "Karim Benali",
        subjectLine: i === 2 ? "Divers" : "Livraison sauce blanche",
        content: texte,
      });
      // Un ordre certain : les réceptions se suivent d'un jour, à minuit UTC —
      // soit deux heures du matin à Paris, en octobre.
      await prisma.message.update({
        where: { id: message.id },
        data: {
          createdAt: new Date(Date.UTC(2026, 9, 10 + i)),
          receivedAt: new Date(Date.UTC(2026, 9, 10 + i)),
        },
      });
    }
    const trouves = await searchMessages(db, { recherche: "livraison" });
    expect(trouves.map((m) => m.extrait)).toEqual([
      "Relance livraison",
      "Première livraison décalée",
    ]);
    expect(trouves[0]!.conversation).toContain("Livraison sauce blanche");
    expect(trouves[0]!.expediteur).toBe("Karim Benali");
    expect(await searchMessages(db, { recherche: "karim" })).toHaveLength(3);
    // Mot à mot : l'expéditeur ET un mot du texte, pas la phrase entière.
    expect(
      await searchMessages(db, { recherche: "Karim relance" }),
    ).toHaveLength(1);
    expect(
      await searchMessages(db, { recherche: "Karim camion" }),
    ).toHaveLength(0);
    expect(
      await searchMessages(db, { recherche: "karim", limite: 2 }),
    ).toHaveLength(2);

    // L'horodatage rendu est à l'heure FRANÇAISE (PITFALLS #55) : minuit UTC
    // le 12 octobre, c'est 02:00 à Paris.
    expect(trouves[0]!.recuLe).toBe("2026-10-11 02:00");

    // Sans aucun critère : les derniers messages, les plus récents d'abord.
    const tous = await searchMessages(db, {});
    expect(tous.map((m) => m.extrait)).toEqual([
      "Autre chose",
      "Relance livraison",
      "Première livraison décalée",
    ]);
    expect(await searchMessages(db, { recherche: "   " })).toHaveLength(3);

    // Une plage de jours français, posée par ses bornes.
    expect(
      await searchMessages(db, {
        depuis: instantDebutJourParis("2026-10-11"),
      }),
    ).toHaveLength(2);
    expect(
      await searchMessages(db, {
        jusquA: instantFinJourParis("2026-10-10"),
      }),
    ).toHaveLength(1);
    expect(
      await searchMessages(db, {
        depuis: instantDebutJourParis("2026-10-11"),
        jusquA: instantFinJourParis("2026-10-11"),
      }),
    ).toHaveLength(1);
    expect(
      await searchMessages(db, {
        depuis: instantDebutJourParis("2026-10-13"),
      }),
    ).toHaveLength(0);

    // L'expéditeur, par son nom ou son adresse ; le sens.
    expect(await searchMessages(db, { expediteur: "sogood" })).toHaveLength(3);
    expect(await searchMessages(db, { expediteur: "Benali" })).toHaveLength(3);
    expect(await searchMessages(db, { expediteur: "inconnu" })).toHaveLength(0);
    expect(await searchMessages(db, { sens: "entrant" })).toHaveLength(3);
    expect(await searchMessages(db, { sens: "sortant" })).toHaveLength(0);
  });

  it("se filtre par canal, par affaire et sur les non-lus", async () => {
    const { account, db } = await makeAccount("echange-canal@test.fr");
    const email = await prisma.channel.create({
      data: {
        accountId: account.id,
        name: "Boîte email",
        type: "email",
        identifier: "contact@tastycrousty.fr",
      },
    });
    const whatsapp = await prisma.channel.create({
      data: {
        accountId: account.id,
        name: "WhatsApp",
        type: "whatsapp",
        identifier: "+33600000000",
      },
    });
    const { message: mail } = await ingestInboundEmail(db, {
      channelId: email.id,
      externalId: "mail-canal",
      senderRaw: "karim@sogood.fr",
      senderName: "Karim Benali",
      subjectLine: "Livraison",
      content: "Par e-mail.",
    });
    await ingestInboundWhatsApp(db, {
      channelId: whatsapp.id,
      externalId: "wa-canal",
      externalThreadId: "chat-karim",
      senderRaw: "+33611111111",
      senderName: "Karim Benali",
      content: "Par WhatsApp.",
    });
    expect(
      (await searchMessages(db, { canal: "whatsapp" })).map((m) => m.extrait),
    ).toEqual(["Par WhatsApp."]);
    expect(
      (await searchMessages(db, { canal: "email" })).map((m) => m.extrait),
    ).toEqual(["Par e-mail."]);

    // Les messages d'UNE affaire : ceux que sa fenêtre couvre.
    const sujet = await createSubject(db, { title: "Livraison Sogood" });
    await prisma.message.update({
      where: { id: mail.id },
      data: { subjectId: sujet.id },
    });
    expect(
      (await searchMessages(db, { subjectId: sujet.id })).map((m) => m.extrait),
    ).toEqual(["Par e-mail."]);

    // Les non-lus : reçus, jamais ouverts.
    expect(await searchMessages(db, { nonLus: true })).toHaveLength(2);
    await prisma.message.update({
      where: { id: mail.id },
      data: { readAt: new Date() },
    });
    expect(
      (await searchMessages(db, { nonLus: true })).map((m) => m.extrait),
    ).toEqual(["Par WhatsApp."]);
  });

  it("le brief compte les messages reçus depuis minuit à Paris, et sur sept jours", async () => {
    const { account, db } = await makeAccount("echange-brief-messages@test.fr");
    const channel = await prisma.channel.create({
      data: {
        accountId: account.id,
        name: "Boîte email",
        type: "email",
        identifier: "contact@tastycrousty.fr",
      },
    });
    // « Maintenant » : le 19 octobre 2026 à 10 h 58 à Paris (08:58 UTC).
    const now = new Date("2026-10-19T08:58:00.000Z");
    const recus = [
      new Date("2026-10-19T06:58:00.000Z"), // 08:58 à Paris — aujourd'hui
      new Date("2026-10-18T22:30:00.000Z"), // 00:30 à Paris le 19 — aujourd'hui
      new Date("2026-10-18T21:30:00.000Z"), // 23:30 à Paris le 18 — hier
      new Date("2026-10-05T10:00:00.000Z"), // il y a deux semaines
    ];
    for (const [i, receivedAt] of recus.entries()) {
      const { message } = await ingestInboundEmail(db, {
        channelId: channel.id,
        externalId: `brief-${i}`,
        senderRaw: "carole@telegrafik.eu",
        senderName: "Carole Garat",
        subjectLine: "Point",
        content: `Message ${i}`,
      });
      await prisma.message.update({
        where: { id: message.id },
        data: { receivedAt },
      });
    }
    const brief = await getBriefProjection(db, now);
    expect(brief.messagesRecusAujourdhui).toBe(2);
    expect(brief.messagesRecus7j).toBe(3);
  });
});

describe("les tâches de l'échange, par critères", () => {
  it("par jours sur l'échéance, sans date, en retard, par type et par mots ; les faites sur le jour où elles l'ont été", async () => {
    const { db } = await makeAccount("echange-taches@test.fr");
    // Lundi 19 octobre 2026, 10 h 58 à Paris.
    const now = new Date("2026-10-19T08:58:00.000Z");
    const jour = (j: string) => new Date(`${j}T00:00:00.000Z`);
    const sujet = await createSubject(db, { title: "Chambre froide" });
    const lundi = await createTask(db, {
      subjectId: sujet.id,
      title: "Rappeler Karim",
      kind: "call",
      startDate: jour("2026-10-19"),
    });
    await createTask(db, {
      subjectId: sujet.id,
      title: "Relancer le devis",
      kind: "follow_up",
      startDate: jour("2026-10-22"),
    });
    await createTask(db, {
      title: "Vérifier le camion",
      kind: "check",
      startDate: jour("2026-10-26"),
    });
    await createTask(db, {
      title: "Payer la facture",
      startDate: jour("2026-10-15"),
    });
    const flottante = await createTask(db, { title: "Trouver un plombier" });

    const titres = async (args: Parameters<typeof searchTasks>[1]) =>
      (await searchTasks(db, args, now)).map((t) => t.title);

    // Un jour, une plage : sur l'échéance, bornes incluses.
    expect(
      await titres({ depuis: "2026-10-19", jusquAu: "2026-10-19" }),
    ).toEqual(["Rappeler Karim"]);
    expect(
      await titres({ depuis: "2026-10-19", jusquAu: "2026-10-25" }),
    ).toEqual(["Rappeler Karim", "Relancer le devis"]);
    expect(await titres({ depuis: "2026-10-26" })).toEqual([
      "Vérifier le camion",
    ]);
    // Sans critère : toutes les ouvertes par échéance, la flottante en dernier.
    expect(await titres({})).toEqual([
      "Payer la facture",
      "Rappeler Karim",
      "Relancer le devis",
      "Vérifier le camion",
      "Trouver un plombier",
    ]);
    // Les sans-date, invisibles à tout filtre sur l'échéance.
    expect(await titres({ sansDate: true })).toEqual(["Trouver un plombier"]);
    expect(await titres({ enRetard: true })).toEqual(["Payer la facture"]);
    expect(await titres({ type: "call" })).toEqual(["Rappeler Karim"]);
    expect(await titres({ recherche: "devis" })).toEqual(["Relancer le devis"]);
    expect(await titres({ subjectId: sujet.id })).toHaveLength(2);
    expect(await titres({ recherche: "karim", limite: 1 })).toEqual([
      "Rappeler Karim",
    ]);

    // « Qu'est-ce que j'ai fait hier ? » : les faites, sur l'INSTANT où elles
    // ont été cochées — le 18 à 23 h 30 à Paris, c'est encore hier.
    await completeTask(db, lundi.id);
    await completeTask(db, flottante.id);
    await prisma.task.update({
      where: { id: lundi.id },
      data: { completedAt: new Date("2026-10-18T21:30:00.000Z") },
    });
    await prisma.task.update({
      where: { id: flottante.id },
      data: { completedAt: new Date("2026-10-19T07:00:00.000Z") },
    });
    expect(
      await titres({
        statut: "faites",
        depuis: "2026-10-18",
        jusquAu: "2026-10-18",
      }),
    ).toEqual(["Rappeler Karim"]);
    expect(await titres({ statut: "faites" })).toEqual([
      "Trouver un plombier",
      "Rappeler Karim",
    ]);
    expect(await titres({})).toHaveLength(3);
  });
});

describe("les affaires de l'échange, par critères", () => {
  it("par état, urgence, attente, domaine, contact, mots et jours de dernière activité", async () => {
    const { account, db } = await makeAccount("echange-affaires@test.fr");
    const cuisine = await prisma.folder.create({
      data: { accountId: account.id, name: "Cuisine", slug: "cuisine" },
    });
    const karim = await createContact(db, {
      firstName: "Karim",
      lastName: "Benali",
      company: "Sogood",
    });
    const sauce = await createSubject(db, {
      title: "Sauce blanche",
      folderId: cuisine.id,
      contactIds: [karim.id],
      priority: "urgent",
    });
    const renfort = await createSubject(db, {
      title: "Renfort samedi soir",
      waitingForReply: true,
      description: "Un extra pour le service.",
    });
    const close = await createSubject(db, { title: "Ancien devis" });
    await updateSubjectStatus(db, close.id, "validated", "user");
    const activite = async (id: string, at: string) =>
      prisma.subject.update({
        where: { id },
        data: { lastActivityAt: new Date(at) },
      });
    await activite(sauce.id, "2026-10-19T07:00:00.000Z");
    await activite(renfort.id, "2026-10-12T07:00:00.000Z");
    await activite(close.id, "2026-10-01T07:00:00.000Z");

    const titres = async (args: Parameters<typeof searchSubjects>[1]) =>
      (await searchSubjects(db, args)).map((s) => s.title);

    expect(await titres({})).toEqual(["Sauce blanche", "Renfort samedi soir"]);
    expect(await titres({ urgentes: true })).toEqual(["Sauce blanche"]);
    expect(await titres({ enAttente: true })).toEqual(["Renfort samedi soir"]);
    expect(await titres({ statut: "validees" })).toEqual(["Ancien devis"]);
    expect(await titres({ statut: "toutes" })).toHaveLength(3);
    expect(await titres({ folderId: cuisine.id })).toEqual(["Sauce blanche"]);
    expect(await titres({ contactId: karim.id })).toEqual(["Sauce blanche"]);
    // Des mots, dans le titre ou le descriptif.
    expect(await titres({ recherche: "extra service" })).toEqual([
      "Renfort samedi soir",
    ]);
    // « Ce qui a bougé cette semaine » : la dernière activité, en jours français.
    expect(await titres({ depuis: "2026-10-19" })).toEqual(["Sauce blanche"]);
    expect(
      await titres({ depuis: "2026-10-12", jusquAu: "2026-10-18" }),
    ).toEqual(["Renfort samedi soir"]);
  });
});

describe("la Mémoire de l'échange, par critères", () => {
  it("instructions et documents, par mots et par domaine ; une instruction désactivée est rendue avec son état", async () => {
    const { account, db } = await makeAccount("echange-memoire@test.fr");
    const general = await prisma.folder.create({
      data: {
        accountId: account.id,
        name: "Général",
        slug: "general",
        isDefault: true,
      },
    });
    const cuisine = await prisma.folder.create({
      data: { accountId: account.id, name: "Cuisine", slug: "cuisine" },
    });
    const livraisons = await createNote(db, {
      folderId: general.id,
      name: "Livraisons du lundi",
      content: "Les livraisons du lundi se font avant 9h.",
    });
    await createNote(db, {
      folderId: cuisine.id,
      name: "Ton avec les fournisseurs",
      content: "Toujours vouvoyer.",
    });
    await prisma.knowledgeDocument.create({
      data: {
        accountId: account.id,
        folderId: cuisine.id,
        kind: "file",
        name: "Fiche technique sauce blanche.pdf",
        aiLabel: "fiche technique",
        aiSummary: "Les proportions de la sauce blanche et sa conservation.",
        createdByActor: "user",
      },
    });

    const titres = async (args: Parameters<typeof searchKnowledge>[1]) =>
      (await searchKnowledge(db, args)).map((k) => k.titre);

    expect(await titres({})).toHaveLength(3);
    expect(await titres({ recherche: "livraison" })).toEqual([
      "Livraisons du lundi",
    ]);
    // Un mot du résumé de Relvo retrouve un document.
    expect(await titres({ recherche: "conservation" })).toEqual([
      "Fiche technique sauce blanche.pdf",
    ]);
    expect(
      await titres({ folderId: cuisine.id, genre: "instructions" }),
    ).toEqual(["Ton avec les fournisseurs"]);
    expect(await titres({ genre: "documents" })).toHaveLength(1);
    const [doc] = await searchKnowledge(db, { genre: "documents" });
    expect(doc).toMatchObject({
      genre: "document",
      domaine: "Cuisine",
      etiquette: "fiche technique",
      contenu: "Les proportions de la sauce blanche et sa conservation.",
    });

    await setNoteActive(db, livraisons.id, false);
    const [note] = await searchKnowledge(db, { recherche: "livraison" });
    expect(note).toMatchObject({
      genre: "instruction",
      active: false,
      contenu: "Les livraisons du lundi se font avant 9h.",
    });
  });
});

describe("défaire un geste de l'échange (M10.10)", () => {
  it("chaque geste se défait par la fonction du domaine de l'écran, et le dit", async () => {
    const { account, db } = await makeAccount("echange-defaire@test.fr");
    const a = "2026-10-15T20:00:00.000Z";
    const sujet = await createSubject(db, { title: "Devis isolation" });

    // Une tâche créée → retirée.
    const t1 = await createTask(db, { subjectId: sujet.id, title: "Relancer" });
    expect(await defaireGeste(db, { type: "tache", id: t1.id, a })).toEqual({
      fait: "Tâche retirée.",
    });
    expect(await db.task.findFirst({ where: { id: t1.id } })).toBeNull();

    // Une tâche cochée → remise à faire.
    const t2 = await createTask(db, { subjectId: sujet.id, title: "Vérifier" });
    await completeTask(db, t2.id);
    await defaireGeste(db, { type: "tache-cochee", id: t2.id, a });
    expect((await db.task.findFirst({ where: { id: t2.id } }))?.status).toBe(
      "open",
    );

    // Une tâche modifiée → remise comme avant, heure nue comprise.
    await defaireGeste(db, {
      type: "tache-modifiee",
      id: t2.id,
      precedent: {
        subjectId: sujet.id,
        title: "Vérifier le devis",
        description: null,
        kind: "check",
        startDate: "2026-10-16",
        startTime: "10:00",
        endDate: null,
        endTime: null,
      },
      a,
    });
    const t2b = await db.task.findFirst({ where: { id: t2.id } });
    expect(t2b?.title).toBe("Vérifier le devis");
    // `start_time` est une colonne TIME : la base ne garde que l'heure, nue.
    expect(t2b?.startTime?.toISOString().slice(11, 16)).toBe("10:00");
    expect(t2b?.startDate?.toISOString()).toBe("2026-10-16T00:00:00.000Z");

    // Une tâche supprimée → recréée depuis l'instantané.
    await defaireGeste(db, {
      type: "tache-supprimee",
      precedent: {
        subjectId: sujet.id,
        title: "Rappeler le plombier",
        description: null,
        kind: "call",
        startDate: "2026-10-19",
        startTime: null,
        endDate: null,
        endTime: null,
      },
      a,
    });
    expect(
      await db.task.findFirst({ where: { title: "Rappeler le plombier" } }),
    ).not.toBeNull();

    // L'état, la priorité, le résumé d'une affaire → remis comme avant.
    await updateSubjectStatus(db, sujet.id, "validated");
    await defaireGeste(db, {
      type: "statut",
      id: sujet.id,
      precedent: "open",
      a,
    });
    await updateSubjectPriority(db, sujet.id, "urgent");
    await defaireGeste(db, {
      type: "priorite",
      id: sujet.id,
      precedent: "normal",
      a,
    });
    await updateSubject(db, sujet.id, { summary: "Nouveau résumé" });
    await defaireGeste(db, {
      type: "resume",
      id: sujet.id,
      precedent: "Ancien",
      a,
    });
    const s = await db.subject.findFirst({ where: { id: sujet.id } });
    expect([s?.status, s?.priority, s?.summary]).toEqual([
      "open",
      "normal",
      "Ancien",
    ]);

    // Une instruction créée → retirée ; supprimée → recréée.
    const general = await prisma.folder.create({
      data: {
        accountId: account.id,
        name: "Général",
        slug: "general",
        isDefault: true,
      },
    });
    const n = await createNote(db, {
      folderId: general.id,
      name: "Règle",
      content: "A",
    });
    await defaireGeste(db, { type: "note", id: n.id, a });
    expect(
      await db.knowledgeDocument.findFirst({ where: { id: n.id } }),
    ).toBeNull();
    await defaireGeste(db, {
      type: "note-supprimee",
      precedent: { folderId: general.id, name: "Règle", content: "A" },
      a,
    });
    expect(await db.knowledgeDocument.count({ where: { name: "Règle" } })).toBe(
      1,
    );

    // Une affaire ouverte dans l'échange → retirée.
    const s2 = await createSubject(db, { title: "Ouverte par erreur" });
    await defaireGeste(db, { type: "affaire", id: s2.id, a });
    expect(await db.subject.findFirst({ where: { id: s2.id } })).toBeNull();

    // Chaque défaite est journalisée avec sa provenance.
    const chat = await db.eventLog.count({
      where: { metadata: { path: ["source"], equals: "chat" } },
    });
    expect(chat).toBeGreaterThanOrEqual(9);
  });

  it("refuse un descripteur mal formé plutôt que de défaire autre chose", async () => {
    const { db } = await makeAccount("echange-defaire-refus@test.fr");
    await expect(
      defaireGeste(db, {
        type: "tache",
        id: "pas-un-uuid",
        a: "hier",
      } as never),
    ).rejects.toThrow();
  });
});
