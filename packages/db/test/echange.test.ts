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
  prisma,
  reopenTask,
  resolveSubject,
  searchMessages,
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
      // Un ordre certain : les horodatages se suivent d'un jour.
      await prisma.message.update({
        where: { id: message.id },
        data: { createdAt: new Date(Date.UTC(2026, 9, 10 + i)) },
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
    expect(await searchMessages(db, { recherche: "   " })).toEqual([]);
    expect(
      await searchMessages(db, { recherche: "karim", limite: 2 }),
    ).toHaveLength(2);
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
