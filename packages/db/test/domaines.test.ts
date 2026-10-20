import { describe, expect, it } from "vitest";
import {
  answerQuestion,
  createFolderFromProposal,
  createSubject,
  deleteFolder,
  dismissQuestion,
  domainesTypiquesDe,
  ensureFolderProposalQuestions,
  ensureOnboardingQuestions,
  ETAPE_DOMAINE_PROPOSE,
  ETAPES,
  listFolderProposals,
  listOpenQuestions,
  nomProposeDe,
  prisma,
  tenantDb,
} from "../src/index";

// LES DOMAINES (M17.10, 05 §9.6, 04 §10) : les domaines typiques des secteurs
// se proposent à la prise en main, à plusieurs, et se créent par la fonction
// de la Mémoire ; les domaines proposés par le courrier se groupent par nom
// dès deux affaires, se tranchent une fois, se créent d'un geste avec leurs
// affaires rangées, et réapparaissent si le domaine est supprimé.

async function makeAccount(
  email: string,
  sectors: ("food" | "construction")[] = [],
) {
  const account = await prisma.account.create({
    data: { email, firstName: "Mam's", lastName: "Crousty", sectors },
  });
  await prisma.folder.create({
    data: {
      accountId: account.id,
      name: "Général",
      slug: "general",
      isDefault: true,
    },
  });
  return { account, db: tenantDb(account.id) };
}

describe("les domaines typiques", () => {
  it("sont ceux des secteurs, sans doublon, et ne se proposent qu'avec un métier connu et aucun domaine", async () => {
    expect(domainesTypiquesDe([]).length).toBe(0);
    expect(domainesTypiquesDe(["other"]).length).toBe(0);
    const les2 = domainesTypiquesDe(["food", "construction"]);
    expect(les2.map((d) => d.key)).toEqual([
      "fournisseurs",
      "equipe",
      "materiel",
      "clients",
      "administratif",
      "chantiers",
      "devis",
    ]);
    // Sans métier : le métier d'abord, pas les domaines.
    const sans = await makeAccount("dom-sans@test.fr");
    await ensureOnboardingQuestions(sans.db, sans.account.id);
    expect((await listOpenQuestions(sans.db)).map((q) => q.originStep)).toEqual(
      [ETAPES.secteurs, ETAPES.premiereInstruction],
    );
    // Métier connu, aucun domaine : la question, avec les domaines du secteur.
    const { account, db } = await makeAccount("dom-typiques@test.fr", ["food"]);
    await ensureOnboardingQuestions(db, account.id);
    const q = (await listOpenQuestions(db)).find(
      (x) => x.originStep === ETAPES.domainesTypiques,
    )!;
    expect(q.proposedAnswers.map((p) => p.key)).toEqual([
      "fournisseurs",
      "equipe",
      "materiel",
      "clients",
      "administratif",
      "aucun",
    ]);
    // Deux cochés : deux domaines créés, avec leur logo, par la Mémoire.
    const { outcome } = await answerQuestion(db, q.id, {
      key: "fournisseurs",
      keys: ["fournisseurs", "equipe"],
      answer: "Fournisseurs, Équipe",
    });
    expect(outcome).toEqual({
      kind: "folders",
      names: ["Fournisseurs", "Équipe"],
    });
    const folders = await db.folder.findMany({
      where: { isDefault: false },
      orderBy: { slug: "asc" },
    });
    expect(folders.map((f) => [f.slug, f.color, f.icon])).toEqual([
      ["equipe", "green", "users"],
      ["fournisseurs", "amber", "boxes"],
    ]);
    // Le script ne repose pas l'étape, et un compte qui a des domaines ne la voit pas.
    expect(await ensureOnboardingQuestions(db, account.id)).toBe(0);
    const avec = await makeAccount("dom-avec@test.fr", ["construction"]);
    await avec.db.folder.create({
      data: { name: "Chantiers", slug: "chantiers" },
    });
    await ensureOnboardingQuestions(avec.db, avec.account.id);
    expect(
      (await listOpenQuestions(avec.db)).map((q) => q.originStep),
    ).not.toContain(ETAPES.domainesTypiques);
  });

  it("« Aucun pour l'instant » ne crée rien", async () => {
    const { account, db } = await makeAccount("dom-aucun@test.fr", ["food"]);
    await ensureOnboardingQuestions(db, account.id);
    const q = (await listOpenQuestions(db)).find(
      (x) => x.originStep === ETAPES.domainesTypiques,
    )!;
    const { outcome } = await answerQuestion(db, q.id, {
      key: "aucun",
      keys: ["aucun"],
      answer: "Aucun pour l'instant",
    });
    expect(outcome).toEqual({ kind: "noted" });
    expect(await db.folder.count({ where: { isDefault: false } })).toBe(0);
  });
});

describe("les domaines proposés par le courrier", () => {
  async function affaire(
    db: ReturnType<typeof tenantDb>,
    title: string,
    proposedFolder: string | null,
  ) {
    const s = await createSubject(db, { title });
    await prisma.subject.update({
      where: { id: s.id },
      data: { proposedFolder },
    });
    return s;
  }

  it("se groupent par nom dès deux affaires sans domaine, la casse et les accents confondus, et ne reviennent pas une fois tranchés", async () => {
    const { db } = await makeAccount("dom-prop@test.fr", ["food"]);
    const a1 = await affaire(db, "Multirisque", "Assurances");
    const a2 = await affaire(db, "Auto flotte", "assurances");
    await affaire(db, "Seul", "Banque");
    await affaire(db, "Sans", null);
    const props = await listFolderProposals(db);
    expect(props).toEqual([
      {
        name: "Assurances",
        slug: "assurances",
        count: 2,
        subjectIds: [a1.id, a2.id],
      },
    ]);
    // Une question par proposition, idempotente.
    expect(await ensureFolderProposalQuestions(db)).toBe(1);
    expect(await ensureFolderProposalQuestions(db)).toBe(0);
    const [q] = await listOpenQuestions(db);
    expect(q?.originStep).toBe(`${ETAPE_DOMAINE_PROPOSE}/assurances`);
    expect(q?.text).toBe(
      "Plusieurs affaires parlent de « Assurances » (2). J'en fais un domaine et je les y range ?",
    );
    expect(nomProposeDe(q!.text)).toBe("Assurances");
    // « Non, pas celui-là » : notée, jamais reproposée.
    expect(
      (
        await answerQuestion(db, q!.id, {
          key: "non",
          answer: "Non, pas celui-là",
        })
      ).outcome,
    ).toEqual({ kind: "noted" });
    expect(await listFolderProposals(db)).toEqual([]);
    expect(await ensureFolderProposalQuestions(db)).toBe(0);
    // Une troisième affaire « Banque » : la proposition naît ; écartée, pareil.
    await affaire(db, "Prêt", "Banque");
    await ensureFolderProposalQuestions(db);
    const [qb] = await listOpenQuestions(db);
    await dismissQuestion(db, qb!.id);
    expect(await listFolderProposals(db)).toEqual([]);
  });

  it("« Oui, créez-le » crée le domaine et y range les affaires ; supprimer le domaine fait réapparaître la proposition", async () => {
    const { db } = await makeAccount("dom-oui@test.fr", ["food"]);
    const a1 = await affaire(db, "Multirisque", "Assurances");
    const a2 = await affaire(db, "Auto flotte", "Assurances");
    await ensureFolderProposalQuestions(db);
    const [q] = await listOpenQuestions(db);
    const { outcome } = await answerQuestion(
      db,
      q!.id,
      { key: "oui", answer: "Oui, créez-le" },
      { source: "chat" },
    );
    expect(outcome).toEqual({
      kind: "folder-created",
      name: "Assurances",
      reclassees: 2,
    });
    const folder = await db.folder.findFirstOrThrow({
      where: { slug: "assurances" },
    });
    const sujets = await db.subject.findMany({
      where: { id: { in: [a1.id, a2.id] } },
    });
    expect(sujets.every((s) => s.folderId === folder.id)).toBe(true);
    // La proposition reste sur l'affaire ; rangée, elle ne compte plus.
    expect(sujets.every((s) => s.proposedFolder === "Assurances")).toBe(true);
    expect(await listFolderProposals(db)).toEqual([]);
    // Supprimer le domaine : les affaires reperdent leur domaine, la
    // proposition redevient visible — mais la question, répondue, ne revient
    // pas : « jamais reproposé » vaut pour le geste, pas pour la Mémoire.
    await deleteFolder(db, folder.id);
    const apres = await db.subject.findMany({
      where: { id: { in: [a1.id, a2.id] } },
    });
    expect(apres.every((s) => s.folderId === null)).toBe(true);
    // Reprendre un domaine qui existe déjà : pas de doublon, affaires rangées.
    await db.folder.create({
      data: { name: "Assurances", slug: "assurances" },
    });
    const r = await createFolderFromProposal(db, { name: "assurances" });
    expect(r.reclassees).toBe(2);
    expect(await db.folder.count({ where: { slug: "assurances" } })).toBe(1);
  });
});
