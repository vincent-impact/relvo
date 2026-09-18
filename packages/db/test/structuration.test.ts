import { describe, expect, it } from "vitest";
import {
  Actor,
  ChannelType,
  EVENT_TYPES,
  applyStructuration,
  applyTriageMatter,
  completeContact,
  createNote,
  createSubject,
  createTask,
  deleteTask,
  getStructurationProjection,
  hasAiSolicitationForSubject,
  ingestInboundEmail,
  logAiSolicitation,
  logStructurationFailure,
  prisma,
  readTaskMetadata,
  setNoteActive,
  tenantDb,
  titleSearchQuery,
} from "../src/index";

// M7 tranche 5 — ce que la STRUCTURATION lit et écrit en base. Le pipeline
// (contexte, appel, retenue de la proposition) vit dans l'application et se
// teste sans base ; ici on verrouille : la projection charge les
// connaissances lues et le registre, les précédents viennent du même domaine
// et se classent par proximité de titre, l'écriture passe par les primitives,
// une tâche porte sa raison et sa provenance, un contact vérifié n'est jamais
// réécrit, le journal porte la proposition.

async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Mam's", lastName: "Crousty", sectors: ["food"] },
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
  const rh = await db.folder.create({ data: { name: "RH", slug: "rh" } });
  const channel = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "Boîte email",
      type: ChannelType.email,
      identifier: email,
    },
  });
  return { account, db, general, fournisseurs, rh, channel };
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
      "Bonjour, la sauce blanche est en rupture, on remplace par SB-210 ? Retour avant jeudi.",
    receivedAt: new Date("2026-09-10T08:00:00Z"),
    ...overrides,
  });
}

/** Un sujet ouvert par le tri sur un fil e-mail — l'état de départ de la structuration. */
async function sujetOuvertParRelvo(
  db: ReturnType<typeof tenantDb>,
  channelId: string,
  folderName: string | null = "Fournisseurs",
) {
  const { message } = await mail(db, channelId, `e-${Math.random()}`);
  const applied = await applyTriageMatter(db, {
    conversationId: message.conversationId,
    messageId: message.id,
    title: "Rupture sauce blanche — remplacement proposé",
    folderName,
    proposedFolder: folderName ? null : "Approvisionnement",
  });
  return {
    message,
    subjectId: applied.subjectId,
    reference: applied.reference,
  };
}

describe("titleSearchQuery", () => {
  it("garde les mots de trois lettres et plus, dédoublonnés, joints par OU", () => {
    expect(titleSearchQuery("Rupture sauce blanche — sauce SB-210 à 9h")).toBe(
      "rupture | sauce | blanche | 210",
    );
    expect(titleSearchQuery("RE: à la")).toBeNull();
  });
});

describe("projection de la structuration", () => {
  it("charge les connaissances lues, le registre, la fiche du sujet, son contact et ses précédents classés", async () => {
    const { db, general, fournisseurs, rh, channel } =
      await makeAccount("a@test.fr");

    // Connaissances : une instruction générale lue, une écartée ; une
    // instruction et un document dans le domaine ; une instruction ailleurs.
    await createNote(db, {
      folderId: general.id,
      name: "Ton des réponses",
      content: "Tutoyer les fournisseurs habituels.",
    });
    const ecartee = await createNote(db, {
      folderId: general.id,
      name: "Ancienne consigne",
      content: "Périmée.",
    });
    await setNoteActive(db, ecartee.id, false);
    await createNote(db, {
      folderId: fournisseurs.id,
      name: "Remplacements",
      content: "Toujours demander le bon de livraison prévisionnel.",
    });
    await db.knowledgeDocument.create({
      data: {
        folderId: fournisseurs.id,
        kind: "file",
        name: "Contrat SoGood.pdf",
        aiLabel: "contrat",
        aiSummary: "Contrat cadre, délais de livraison 48 h.",
        createdByActor: Actor.user,
      },
    });
    await createNote(db, { folderId: rh.id, name: "Plannings", content: "…" });

    // Registre d'étiquettes : une active, une candidate — les deux sont poussées.
    await db.label.createMany({
      data: [
        {
          key: "retard-livraison",
          label: "Retard de livraison",
          origin: "sector",
          status: "active",
        },
        {
          key: "contrat",
          label: "Contrat",
          origin: "relvo",
          status: "candidate",
        },
      ],
    });

    // Précédents : deux validés dans le domaine (un proche par le titre, un
    // non), un validé ailleurs, un ouvert dans le domaine.
    const proche = await createSubject(db, {
      title: "Rupture sauce blanche — avoir obtenu",
      folderId: fournisseurs.id,
      status: "validated",
    });
    const loin = await createSubject(db, {
      title: "Bail commercial",
      folderId: fournisseurs.id,
      status: "validated",
    });
    await createSubject(db, {
      title: "Rupture sauce blanche chez un autre",
      folderId: rh.id,
      status: "validated",
    });
    await createSubject(db, {
      title: "Rupture sauce blanche en cours",
      folderId: fournisseurs.id,
    });
    // Le précédent proche a une tâche réalisée et une tâche de Relvo écartée.
    const faite = await createTask(db, {
      subjectId: proche.id,
      title: "Répondre au fournisseur",
      sourceActor: Actor.ai,
      kind: "reply",
    });
    await db.task.updateMany({
      where: { id: faite.id },
      data: { status: "done", completedAt: new Date("2026-06-02T00:00:00Z") },
    });
    const ecarteeTache = await createTask(db, {
      subjectId: proche.id,
      title: "Appeler le magasin",
      sourceActor: Actor.ai,
      kind: "call",
      metadata: { raison: "Le magasin doit être prévenu.", provenance: null },
    });
    await deleteTask(db, ecarteeTache.id);
    const posee = await createTask(db, {
      subjectId: proche.id,
      title: "Ma tâche à moi",
      sourceActor: Actor.user,
    });
    await deleteTask(db, posee.id);

    const { subjectId, reference } = await sujetOuvertParRelvo(db, channel.id);
    const p = await getStructurationProjection(db, subjectId);

    // Le compte : instructions générales LUES, registre entier, pas de liste
    // de sujets ouverts (la structuration n'en a pas besoin).
    expect(p.compte.dirigeant).toBe("Mam's Crousty");
    expect(p.compte.instructionsGenerales).toEqual([
      {
        titre: "Ton des réponses",
        contenu: "Tutoyer les fournisseurs habituels.",
      },
    ]);
    expect(p.compte.etiquettes).toEqual(["contrat", "retard-livraison"]);
    expect(p.compte.sujetsOuverts).toEqual([]);

    // Le domaine : ses instructions et ses documents, rien des autres domaines.
    expect(p.domaine).toMatchObject({
      nom: "Fournisseurs",
      description: "Achats et livraisons",
      instructions: [
        {
          titre: "Remplacements",
          contenu: "Toujours demander le bon de livraison prévisionnel.",
        },
      ],
      documents: [
        {
          nom: "Contrat SoGood.pdf",
          etiquette: "contrat",
          resume: "Contrat cadre, délais de livraison 48 h.",
        },
      ],
    });

    // La fiche du sujet : ce que le tri a posé, le fil, le contact reconnu.
    expect(p.sujet).toMatchObject({
      reference,
      titre: "Rupture sauce blanche — remplacement proposé",
      domaine: "Fournisseurs",
      statut: "ouvert",
      priorite: "normal",
      enAttente: false,
      situation: {
        ouOnEnEst: null,
        prochaineEtape: null,
        attente: null,
        echeance: null,
      },
      resume: null,
      taches: [],
      contacts: [{ nom: "Karim Benali", entreprise: null, role: null }],
    });
    expect(p.sujet.messages).toHaveLength(1);
    expect(p.sujet.messages[0]).toMatchObject({
      expediteur: "Karim Benali <karim@sogood.fr>",
      objet: "Rupture sauce blanche",
      sens: "entrant",
      piecesJointes: [],
    });

    // Le contact : automatique (créé par le tri), sans passé.
    expect(p.contact).toMatchObject({
      statut: "auto",
      nom: "Karim Benali",
      role: null,
      sujetsOuverts: [],
      derniersValides: [],
      antecedentsTri: [],
    });

    // Les précédents : les validés DU DOMAINE, tous les titres ; la fiche de
    // clôture pour le proche seulement, avec ses tâches réalisées et écartées.
    expect(p.precedents.map((x) => x.reference).sort()).toEqual(
      [proche.reference, loin.reference].sort(),
    );
    const fiche = p.precedents.find((x) => x.reference === proche.reference)!;
    expect(fiche.clos).toMatchObject({
      titre: "Rupture sauce blanche — avoir obtenu",
      domaine: "Fournisseurs",
      tachesRealisees: [
        { titre: "Répondre au fournisseur", source: "relvo", terminee: true },
      ],
      tachesEcartees: [{ titre: "Appeler le magasin" }],
    });
    expect(
      p.precedents.find((x) => x.reference === loin.reference)!.clos,
    ).toBeNull();
  });

  it("sans domaine ni étiquette, aucun précédent ; sans contact, pas de fiche contact", async () => {
    const { db, fournisseurs, channel } = await makeAccount("b@test.fr");
    await createSubject(db, {
      title: "Rupture sauce blanche — réglée",
      folderId: fournisseurs.id,
      status: "validated",
    });
    const { subjectId } = await sujetOuvertParRelvo(db, channel.id, null);
    const p = await getStructurationProjection(db, subjectId);
    expect(p.domaine).toBeNull();
    expect(p.sujet.proposedFolder).toBe("Approvisionnement");
    expect(p.precedents).toEqual([]);

    await db.subject.updateMany({
      where: { id: subjectId },
      data: { contactIds: [] },
    });
    const p2 = await getStructurationProjection(db, subjectId);
    expect(p2.contact).toBeNull();
    expect(p2.sujet.contacts).toEqual([]);
  });
});

describe("écriture de la structuration", () => {
  it("écrit la situation, le résumé, les tâches avec raison et provenance, complète le contact automatique, journalise la proposition", async () => {
    const { db, channel } = await makeAccount("c@test.fr");
    await db.label.create({
      data: {
        key: "retard-livraison",
        label: "Retard de livraison",
        origin: "sector",
        status: "active",
      },
    });
    const { message, subjectId } = await sujetOuvertParRelvo(db, channel.id);

    const proposal = { situation: { ou_on_en_est: "…" }, taches: [] };
    const r = await applyStructuration(db, {
      subjectId,
      messageId: message.id,
      situation: {
        where: "Le fournisseur propose la SB-210 en remplacement.",
        nextStep: "Accepter ou refuser le remplacement.",
        waitingFor: "Réponse du dirigeant.",
        deadline: "2026-09-11",
      },
      summary: "Rupture annoncée, remplacement proposé, retour avant jeudi.",
      tasks: [
        {
          title: "Valider le remplacement par la SB-210",
          kind: "decision",
          startDate: "2026-09-11",
          startTime: null,
          endDate: null,
          endTime: null,
          reason: "Le fournisseur demande un retour avant jeudi.",
          provenance: null,
        },
        {
          title: "Demander le bon de livraison prévisionnel",
          kind: "check",
          startDate: "2026-09-11",
          startTime: "14:00",
          endDate: null,
          endTime: "16:00",
          reason: "L'instruction du domaine l'exige.",
          provenance: {
            type: "instruction",
            reference: null,
            libelle: "Remplacements",
          },
        },
      ],
      contact: {
        firstName: "Karim",
        lastName: "Benali",
        company: "SoGood Distribution",
        role: "supplier",
      },
      labels: ["retard-livraison", "inconnue"],
      proposedFolder: "Approvisionnement",
      proposal,
    });

    expect(r.taskIds).toHaveLength(2);
    expect(r.labels).toEqual(["retard-livraison"]);
    expect(r.contact).toEqual({
      id: expect.any(String),
      fields: ["company", "role"],
    });
    // Le sujet a un domaine : la proposition de domaine est ignorée.
    expect(r.proposedFolder).toBeNull();

    const s = await db.subject.findFirstOrThrow({ where: { id: subjectId } });
    expect(s.situationWhere).toBe(
      "Le fournisseur propose la SB-210 en remplacement.",
    );
    expect(s.situationNextStep).toBe("Accepter ou refuser le remplacement.");
    expect(s.situationWaitingFor).toBe("Réponse du dirigeant.");
    expect(s.situationDeadline?.toISOString().slice(0, 10)).toBe("2026-09-11");
    expect(s.situationUpdatedAt).not.toBeNull();
    expect(s.summary).toBe(
      "Rupture annoncée, remplacement proposé, retour avant jeudi.",
    );
    expect(s.labels).toEqual(["retard-livraison"]);
    expect(s.proposedFolder).toBeNull();

    const tasks = await db.task.findMany({
      where: { subjectId },
      orderBy: { title: "asc" },
    });
    expect(tasks.map((t) => [t.title, t.kind, t.sourceActor])).toEqual([
      ["Demander le bon de livraison prévisionnel", "check", Actor.ai],
      ["Valider le remplacement par la SB-210", "decision", Actor.ai],
    ]);
    expect(tasks[0]!.messageId).toBe(message.id);
    expect(tasks[0]!.startTime?.toISOString().slice(11, 16)).toBe("14:00");
    expect(tasks[0]!.endTime?.toISOString().slice(11, 16)).toBe("16:00");
    expect(readTaskMetadata(tasks[0]!.metadata)).toEqual({
      raison: "L'instruction du domaine l'exige.",
      provenance: {
        type: "instruction",
        reference: null,
        libelle: "Remplacements",
      },
    });
    expect(readTaskMetadata(tasks[1]!.metadata)).toEqual({
      raison: "Le fournisseur demande un retour avant jeudi.",
      provenance: null,
    });

    // Le contact automatique est complété par Relvo, journalisé.
    const contact = await db.contact.findFirstOrThrow({
      where: { id: r.contact!.id },
    });
    expect(contact).toMatchObject({
      firstName: "Karim",
      lastName: "Benali",
      company: "SoGood Distribution",
      role: "supplier",
      status: "auto",
    });

    // Le journal : une entrée par tâche (raison en description, provenance en
    // métadonnée), le contact complété, la proposition intégrale.
    const events = await db.eventLog.findMany({
      where: { subjectId },
      orderBy: { createdAt: "asc" },
    });
    const creees = events.filter(
      (e) => e.eventType === EVENT_TYPES.taskCreatedByAi,
    );
    expect(creees).toHaveLength(2);
    expect(creees.map((e) => e.description).sort()).toEqual([
      "L'instruction du domaine l'exige.",
      "Le fournisseur demande un retour avant jeudi.",
    ]);
    const structure = events.find(
      (e) => e.eventType === EVENT_TYPES.subjectStructured,
    )!;
    expect(structure.actor).toBe(Actor.ai);
    expect(structure.title).toBe("Relvo a structuré le sujet : 2 tâches");
    expect(structure.messageId).toBe(message.id);
    expect(structure.metadata).toMatchObject({
      proposal,
      labels: ["retard-livraison"],
      contact: { fields: ["company", "role"] },
    });
    const complete = await db.eventLog.findFirstOrThrow({
      where: { eventType: EVENT_TYPES.contactUpdated, actor: Actor.ai },
    });
    expect(complete.title).toBe("Contact « Karim Benali » complété par Relvo");
  });

  it("aucune tâche quand le message est informatif : la situation seule, et le journal le dit", async () => {
    const { db, channel } = await makeAccount("d@test.fr");
    const { subjectId } = await sujetOuvertParRelvo(db, channel.id, null);
    const r = await applyStructuration(db, {
      subjectId,
      situation: {
        where: "Le virement est confirmé.",
        nextStep: null,
        waitingFor: null,
        deadline: null,
      },
      summary: null,
      tasks: [],
      contact: null,
      labels: [],
      proposedFolder: "Banque",
      proposal: null,
    });
    expect(r.taskIds).toEqual([]);
    // Sans domaine, mais le tri avait déjà posé une proposition : on la garde.
    expect(r.proposedFolder).toBeNull();
    expect(await db.task.count({ where: { subjectId } })).toBe(0);
    const ev = await db.eventLog.findFirstOrThrow({
      where: { subjectId, eventType: EVENT_TYPES.subjectStructured },
    });
    expect(ev.title).toBe("Relvo a lu le sujet : rien à faire pour l'instant");
  });

  it("pose le domaine proposé quand le sujet n'en a ni un, ni une proposition", async () => {
    const { db, channel } = await makeAccount("e@test.fr");
    const { message } = await mail(db, channel.id, "e1");
    const applied = await applyTriageMatter(db, {
      conversationId: message.conversationId,
      messageId: message.id,
      title: "Virement",
    });
    const r = await applyStructuration(db, {
      subjectId: applied.subjectId,
      situation: {
        where: null,
        nextStep: null,
        waitingFor: null,
        deadline: null,
      },
      summary: null,
      tasks: [],
      contact: null,
      labels: [],
      proposedFolder: "Banque",
      proposal: null,
    });
    expect(r.proposedFolder).toBe("Banque");
    const s = await db.subject.findFirstOrThrow({
      where: { id: applied.subjectId },
    });
    expect(s.proposedFolder).toBe("Banque");
  });

  it("un contact vérifié n'est jamais réécrit : le rôle seulement, s'il est vide", async () => {
    const { db, channel } = await makeAccount("f@test.fr");
    const { subjectId } = await sujetOuvertParRelvo(db, channel.id);
    const s = await db.subject.findFirstOrThrow({ where: { id: subjectId } });
    await completeContact(db, s.contactIds[0]!, { company: "SoGood" });

    const r = await applyStructuration(db, {
      subjectId,
      situation: {
        where: null,
        nextStep: null,
        waitingFor: null,
        deadline: null,
      },
      summary: null,
      tasks: [],
      contact: {
        firstName: "K.",
        lastName: "Ben Ali",
        company: "Autre société",
        role: "supplier",
      },
      labels: [],
      proposedFolder: null,
      proposal: null,
    });
    expect(r.contact).toEqual({ id: s.contactIds[0], fields: ["role"] });
    const c = await db.contact.findFirstOrThrow({
      where: { id: s.contactIds[0] },
    });
    expect(c).toMatchObject({
      firstName: "Karim",
      lastName: "Benali",
      company: "SoGood",
      role: "supplier",
      status: "complete",
    });

    // Un rôle déjà écrit sur une fiche vérifiée ne bouge plus.
    const r2 = await applyStructuration(db, {
      subjectId,
      situation: {
        where: null,
        nextStep: null,
        waitingFor: null,
        deadline: null,
      },
      summary: null,
      tasks: [],
      contact: {
        firstName: null,
        lastName: null,
        company: null,
        role: "customer",
      },
      labels: [],
      proposedFolder: null,
      proposal: null,
    });
    expect(r2.contact).toBeNull();
  });

  it("refuse un sujet qui n'est plus ouvert", async () => {
    const { db, channel } = await makeAccount("g@test.fr");
    const { subjectId } = await sujetOuvertParRelvo(db, channel.id);
    await db.subject.updateMany({
      where: { id: subjectId },
      data: { status: "validated" },
    });
    await expect(
      applyStructuration(db, {
        subjectId,
        situation: {
          where: null,
          nextStep: null,
          waitingFor: null,
          deadline: null,
        },
        summary: null,
        tasks: [],
        contact: null,
        labels: [],
        proposedFolder: null,
        proposal: null,
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("une structuration par sujet : la sollicitation consignée porte le sujet, et l'échec est journalisé", async () => {
    const { db, channel } = await makeAccount("h@test.fr");
    const { message, subjectId } = await sujetOuvertParRelvo(db, channel.id);
    expect(
      await hasAiSolicitationForSubject(db, subjectId, "structuration"),
    ).toBe(false);
    await logAiSolicitation(db, {
      sollicitation: "structuration",
      tier: "extraction",
      modele: "gpt-5.6-luna",
      niveau: "low",
      jetons: {
        entree: 1_500,
        cacheLecture: 1_800,
        cacheEcriture: 0,
        sortie: 400,
        raisonnement: 60,
      },
      cout: { eur: 0.0006, usd: 0.0007, version: "2026-09" },
      dureeMs: 4_000,
      subjectId,
      messageId: message.id,
    });
    expect(
      await hasAiSolicitationForSubject(db, subjectId, "structuration"),
    ).toBe(true);
    expect(await hasAiSolicitationForSubject(db, subjectId, "tri")).toBe(false);

    await logStructurationFailure(db, {
      subjectId,
      messageId: message.id,
      error: "sortie non conforme",
    });
    const ev = await db.eventLog.findFirstOrThrow({
      where: { subjectId, eventType: EVENT_TYPES.structurationFailed },
    });
    expect(ev.actor).toBe(Actor.system);
    expect(ev.description).toBe("sortie non conforme");
  });
});

describe("un contact au nom provisoire (05 §1.3)", () => {
  it("se complète depuis la signature quel que soit son statut, et l'adresse qui tenait lieu de nom devient son e-mail", async () => {
    const { db, channel } = await makeAccount("prov@test.fr");
    // Un expéditeur sans nom d'affichage : l'adresse tient lieu de nom.
    const { message } = await mail(db, channel.id, "e-prov", {
      senderRaw: "vinz.chollet@gmail.com",
      senderName: null,
      content:
        "Devis à 480 € HT.\n\nSophie Garnier\nMaintenance Sud — 06 12 34 56 78",
    });
    const applied = await applyTriageMatter(db, {
      conversationId: message.conversationId,
      messageId: message.id,
      title: "Validation devis thermostat",
      folderName: "Fournisseurs",
      proposedFolder: null,
    });
    const sujet = await db.subject.findFirstOrThrow({
      where: { id: applied.subjectId },
      select: { contactIds: true },
    });
    const avant = await db.contact.findFirstOrThrow({
      where: { id: sujet.contactIds[0]! },
    });
    expect(avant.lastName).toBe("vinz.chollet@gmail.com");
    expect(avant.email).toBe("vinz.chollet@gmail.com");
    // Même vérifiée à la main, une fiche dont le nom est une adresse reste à compléter.
    await db.contact.updateMany({
      where: { id: avant.id },
      data: { status: "complete", email: null },
    });
    const projection = await getStructurationProjection(db, applied.subjectId);
    expect(projection.contact?.nomProvisoire).toBe(true);

    const r = await applyStructuration(db, {
      subjectId: applied.subjectId,
      messageId: message.id,
      situation: {
        where: "x",
        nextStep: "y",
        waitingFor: null,
        deadline: null,
      },
      summary: null,
      tasks: [],
      contact: {
        firstName: "Sophie",
        lastName: "Garnier",
        company: "Maintenance Sud",
        role: "supplier",
        phone: "06 12 34 56 78",
        email: null,
      },
      labels: [],
      proposedFolder: null,
      proposal: null,
    });
    expect(r.contact?.fields).toEqual([
      "email",
      "lastName",
      "firstName",
      "company",
      "role",
      "phone",
    ]);
    const apres = await db.contact.findFirstOrThrow({
      where: { id: avant.id },
    });
    expect(apres).toMatchObject({
      firstName: "Sophie",
      lastName: "Garnier",
      company: "Maintenance Sud",
      phone: "06 12 34 56 78",
      email: "vinz.chollet@gmail.com",
      status: "complete",
    });
    expect(
      (await getStructurationProjection(db, applied.subjectId)).contact
        ?.nomProvisoire,
    ).toBe(false);
  });
});
