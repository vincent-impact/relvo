import { describe, expect, it } from "vitest";
import {
  cheminDe,
  createContact,
  createFolder,
  createNote,
  createSubject,
  deleteFolder,
  folderChain,
  folderSubtreeIds,
  loadAccountProjection,
  loadFolderTree,
  moveFolder,
  premierNiveauDe,
  prisma,
  PROFONDEUR_MAX,
  tenantDb,
} from "../src/index";

// L'ARBRE DES DOSSIERS (M23.1, M23.2) : un dossier a un père, Général est la
// racine, la profondeur est bornée ICI — par ce test, pas par la vigilance —,
// le slug est unique par père ; la couche Domaine hérite de toute la chaîne,
// racine en premier ; supprimer un dossier remonte ce qu'il contenait chez le
// père, et jamais une affaire dans Général (invariant 17).

async function makeAccount(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Mam's", lastName: "Crousty", sectors: ["food"] },
  });
  const general = await prisma.folder.create({
    data: {
      accountId: account.id,
      name: "Général",
      slug: "general",
      isDefault: true,
    },
  });
  return { account, general, db: tenantDb(account.id) };
}

/** Général › Clients › Franchises › Narbonne, et Fournisseurs à côté. */
async function arbre(email: string) {
  const a = await makeAccount(email);
  const clients = await createFolder(a.db, { name: "Clients" });
  const franchises = await createFolder(a.db, {
    name: "Franchises",
    parentId: clients.id,
  });
  const narbonne = await createFolder(a.db, {
    name: "Narbonne",
    parentId: franchises.id,
  });
  const fournisseurs = await createFolder(a.db, { name: "Fournisseurs" });
  return { ...a, clients, franchises, narbonne, fournisseurs };
}

describe("l'arbre des dossiers", () => {
  it("un dossier sans père va sous Général ; la chaîne et le chemin se lisent de la racine au dossier", async () => {
    const { db, general, clients, franchises, narbonne } = await arbre(
      "arbre-chaine@test.fr",
    );
    expect(clients.parentId).toBe(general.id);
    expect((await folderChain(db, narbonne.id)).map((f) => f.name)).toEqual([
      "Général",
      "Clients",
      "Franchises",
      "Narbonne",
    ]);
    const tree = await loadFolderTree(db);
    expect(cheminDe(tree, narbonne.id)).toBe("Clients › Franchises › Narbonne");
    expect(cheminDe(tree, general.id)).toBe("");
    // Le premier niveau : celui dont le Calendrier prend la couleur.
    expect(premierNiveauDe(tree, narbonne.id)?.id).toBe(clients.id);
    expect(premierNiveauDe(tree, general.id)).toBeNull();
    // La portée d'un dossier : lui et ses fils, jamais un frère.
    expect((await folderSubtreeIds(db, clients.id)).sort()).toEqual(
      [clients.id, franchises.id, narbonne.id].sort(),
    );
  });

  it("trois niveaux sous Général, pas plus — à la création comme au déplacement", async () => {
    const { db, narbonne, clients, fournisseurs } = await arbre(
      "arbre-profondeur@test.fr",
    );
    expect(PROFONDEUR_MAX).toBe(3);
    await expect(
      createFolder(db, { name: "Trop profond", parentId: narbonne.id }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    // Déplacer Clients (hauteur 2) sous Fournisseurs (niveau 1) ferait 4 niveaux.
    await expect(
      moveFolder(db, clients.id, fournisseurs.id),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    // Déplacer Fournisseurs (feuille) sous Narbonne (niveau 3) aussi.
    await expect(
      moveFolder(db, fournisseurs.id, narbonne.id),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("le slug est unique par père : deux « Montpellier » sous deux pères, jamais deux sous le même", async () => {
    const { db, franchises, fournisseurs } = await arbre("arbre-slug@test.fr");
    const m1 = await createFolder(db, {
      name: "Montpellier",
      parentId: franchises.id,
    });
    const m2 = await createFolder(db, {
      name: "Montpellier",
      parentId: fournisseurs.id,
    });
    expect(m1.slug).toBe(m2.slug);
    await expect(
      createFolder(db, { name: "montpellier", parentId: franchises.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // Un déplacement vers un père qui a déjà ce slug est refusé aussi.
    await expect(moveFolder(db, m1.id, fournisseurs.id)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("un dossier se déplace avec ses fils ; jamais la racine, jamais dans lui-même ni dans un de ses fils", async () => {
    const { db, general, clients, franchises, narbonne, fournisseurs } =
      await arbre("arbre-deplacer@test.fr");
    await moveFolder(db, franchises.id, fournisseurs.id);
    expect((await folderChain(db, narbonne.id)).map((f) => f.name)).toEqual([
      "Général",
      "Fournisseurs",
      "Franchises",
      "Narbonne",
    ]);
    await expect(moveFolder(db, general.id, clients.id)).rejects.toMatchObject({
      code: "FORBIDDEN_GENERAL_FOLDER",
    });
    await expect(
      moveFolder(db, fournisseurs.id, narbonne.id),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      moveFolder(db, fournisseurs.id, fournisseurs.id),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    // Sans père : retour sous Général, journalisé.
    await moveFolder(db, franchises.id, null);
    expect((await folderChain(db, franchises.id)).map((f) => f.name)).toEqual([
      "Général",
      "Franchises",
    ]);
    expect(
      await db.eventLog.count({ where: { eventType: "folder_moved" } }),
    ).toBe(2);
  });

  it("la base refuse un dossier sans père qui n'est pas Général", async () => {
    const { account } = await makeAccount("arbre-contrainte@test.fr");
    await expect(
      prisma.folder.create({
        data: { accountId: account.id, name: "Orphelin", slug: "orphelin" },
      }),
    ).rejects.toThrow(/folders_parent_requis/);
  });
});

describe("l'héritage de la chaîne (couche Domaine)", () => {
  it("une affaire rangée dans un fils lit tout ce qu'ont ses pères, racine en premier, le plus précis en dernier", async () => {
    const {
      db,
      account,
      general,
      clients,
      franchises,
      narbonne,
      fournisseurs,
    } = await arbre("heritage@test.fr");
    await createNote(db, {
      folderId: general.id,
      name: "Ton",
      content: "Vouvoyer.",
    });
    await createNote(db, {
      folderId: narbonne.id,
      name: "Loyer",
      content: "Le loyer de Narbonne se paie le 5.",
    });
    await createNote(db, {
      folderId: clients.id,
      name: "Relances",
      content: "Relancer un client après 7 jours.",
    });
    await createNote(db, {
      folderId: franchises.id,
      name: "Redevance",
      content: "La redevance est de 5 %.",
    });
    await createNote(db, {
      folderId: fournisseurs.id,
      name: "Bons",
      content: "Toujours vérifier le bon de livraison.",
    });
    await prisma.knowledgeDocument.create({
      data: {
        accountId: account.id,
        folderId: clients.id,
        kind: "file",
        name: "Contrat type.pdf",
        absorptionStatus: "read",
        aiLabel: "contrat",
        createdByActor: "user",
      },
    });

    const sous = await loadAccountProjection(db, account.id, narbonne.id);
    expect(sous.compte.instructionsGenerales.map((i) => i.titre)).toEqual([
      "Ton",
    ]);
    expect(sous.domaine?.nom).toBe("Narbonne");
    expect(sous.domaine?.chemin).toEqual(["Clients", "Franchises", "Narbonne"]);
    expect(sous.domaine?.instructions.map((i) => [i.dossier, i.titre])).toEqual(
      [
        ["Clients", "Relances"],
        ["Franchises", "Redevance"],
        ["Narbonne", "Loyer"],
      ],
    );
    expect(sous.domaine?.documents.map((d) => [d.dossier, d.nom])).toEqual([
      ["Clients", "Contrat type.pdf"],
    ]);

    // Un père ne lit pas ses fils, et jamais un frère.
    const haut = await loadAccountProjection(db, account.id, clients.id);
    expect(haut.domaine?.chemin).toEqual(["Clients"]);
    expect(haut.domaine?.instructions.map((i) => i.titre)).toEqual([
      "Relances",
    ]);
    const aCote = await loadAccountProjection(db, account.id, fournisseurs.id);
    expect(aCote.domaine?.instructions.map((i) => i.titre)).toEqual(["Bons"]);

    // Sans dossier : Général seulement.
    const sans = await loadAccountProjection(db, account.id, null);
    expect(sans.domaine).toBeNull();
    expect(sans.compte.instructionsGenerales.map((i) => i.titre)).toEqual([
      "Ton",
    ]);
  });
});

describe("supprimer un dossier remonte ce qu'il contenait chez le père", () => {
  it("ses dossiers, ses instructions, ses affaires, ses contacts et ses canaux passent au père ; un slug déjà pris se suffixe", async () => {
    const { db, account, clients, franchises, narbonne } =
      await arbre("suppr-pere@test.fr");
    // Un frère de Franchises qui porte déjà le slug « narbonne ».
    const doublon = await createFolder(db, {
      name: "Narbonne",
      parentId: clients.id,
    });
    const note = await createNote(db, {
      folderId: franchises.id,
      name: "Redevance",
      content: "5 %.",
    });
    const affaire = await createSubject(db, {
      title: "Ouverture Béziers",
      folderId: franchises.id,
    });
    const contact = await createContact(db, {
      lastName: "Franchisé",
      defaultFolderId: franchises.id,
    });
    const canal = await prisma.channel.create({
      data: {
        accountId: account.id,
        name: "Boîte",
        type: "email",
        identifier: "suppr-pere@test.fr",
        folderIds: [franchises.id, clients.id],
      },
    });

    await deleteFolder(db, franchises.id);

    expect(
      await db.folder.findFirst({ where: { id: franchises.id } }),
    ).toBeNull();
    const remonte = await db.folder.findFirstOrThrow({
      where: { id: narbonne.id },
    });
    expect(remonte.parentId).toBe(clients.id);
    expect(remonte.slug).toBe("narbonne-2");
    expect(
      (await db.folder.findFirstOrThrow({ where: { id: doublon.id } })).slug,
    ).toBe("narbonne");
    expect(
      (await db.knowledgeDocument.findFirstOrThrow({ where: { id: note.id } }))
        .folderId,
    ).toBe(clients.id);
    expect(
      (await db.subject.findFirstOrThrow({ where: { id: affaire.id } }))
        .folderId,
    ).toBe(clients.id);
    expect(
      (await db.contact.findFirstOrThrow({ where: { id: contact.id } }))
        .defaultFolderId,
    ).toBe(clients.id);
    expect(
      (await db.channel.findFirstOrThrow({ where: { id: canal.id } }))
        .folderIds,
    ).toEqual([clients.id]);
    const journal = await db.eventLog.findFirst({
      where: { eventType: "folder_deleted" },
    });
    expect(journal?.metadata).toMatchObject({
      parentId: clients.id,
      remontes: {
        dossiers: 1,
        connaissances: 1,
        affaires: 1,
        contacts: 1,
        canaux: 1,
      },
    });
  });

  it("quand le père est Général, les instructions y remontent et les affaires redeviennent « sans dossier »", async () => {
    const { db, general, clients, franchises } = await arbre(
      "suppr-general@test.fr",
    );
    const note = await createNote(db, {
      folderId: clients.id,
      name: "Relances",
      content: "7 jours.",
    });
    const affaire = await createSubject(db, {
      title: "Devis Dupont",
      folderId: clients.id,
    });
    await deleteFolder(db, clients.id);
    expect(
      (await db.knowledgeDocument.findFirstOrThrow({ where: { id: note.id } }))
        .folderId,
    ).toBe(general.id);
    expect(
      (await db.subject.findFirstOrThrow({ where: { id: affaire.id } }))
        .folderId,
    ).toBeNull();
    expect(
      (await db.folder.findFirstOrThrow({ where: { id: franchises.id } }))
        .parentId,
    ).toBe(general.id);
    await expect(deleteFolder(db, general.id)).rejects.toMatchObject({
      code: "FORBIDDEN_GENERAL_FOLDER",
    });
  });
});
