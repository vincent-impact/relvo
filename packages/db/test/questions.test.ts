import { describe, expect, it } from "vitest";
import {
  answerQuestion,
  askQuestion,
  countOpenQuestions,
  createNote,
  createSubject,
  dismissQuestion,
  ensureOnboardingQuestions,
  ETAPES,
  EVENT_TYPES,
  listOpenQuestions,
  poserFinDeLecture,
  prisma,
  requestChannelCatchup,
  resolveMailboxStep,
  SCRIPT_PRISE_EN_MAIN,
  tenantDb,
  titreInstruction,
} from "../src/index";

// Les QUESTIONS DE RELVO (M18.9, 05 §11.12) : une cible par portée — tenue par
// la base —, les réponses proposées, la réponse qui applique sa destination par
// le domaine (secteurs du compte, instruction), l'écart qui ne repose jamais,
// et le script de la prise en main, idempotent et jamais bloquant.

async function makeAccount(
  email: string,
  sectors: ("food" | "construction")[] = [],
) {
  const account = await prisma.account.create({
    data: { email, firstName: "Mam's", lastName: "Crousty", sectors },
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

describe("poser une question", () => {
  it("une cible par portée, le compte sans cible ; la base refuse le reste", async () => {
    const { db } = await makeAccount("q-cible@test.fr");
    const sujet = await createSubject(db, { title: "Franchise Narbonne" });
    const q = await askQuestion(db, {
      scope: "subject",
      subjectId: sujet.id,
      text: "Narbonne est-il une franchise ?",
      proposedAnswers: [
        { key: "oui", label: "Oui" },
        { key: "non", label: "Non" },
      ],
    });
    expect(q.status).toBe("open");
    const compte = await askQuestion(db, {
      scope: "account",
      text: "Votre métier ?",
    });
    expect(compte.scope).toBe("account");
    await expect(
      askQuestion(db, { scope: "account", subjectId: sujet.id, text: "x" }),
    ).rejects.toThrow();
    await expect(
      askQuestion(db, { scope: "contact", text: "x" }),
    ).rejects.toThrow();
    // La contrainte en base, pas seulement le schéma.
    await expect(
      prisma.relvoQuestion.create({
        data: {
          accountId: q.accountId,
          scope: "account",
          subjectId: sujet.id,
          text: "hors portée",
        },
      }),
    ).rejects.toThrow();

    const ouvertes = await listOpenQuestions(db);
    expect(ouvertes.map((o) => o.text)).toEqual([
      "Narbonne est-il une franchise ?",
      "Votre métier ?",
    ]);
    expect(ouvertes[0]!.about).toEqual({
      kind: "subject",
      label: "Franchise Narbonne",
    });
    expect(ouvertes[0]!.proposedAnswers.map((p) => p.key)).toEqual([
      "oui",
      "non",
    ]);
    expect(await countOpenQuestions(db)).toBe(2);
  });
});

describe("répondre, écarter", () => {
  it("la réponse de l'étape « secteurs » pose les secteurs du compte, par le domaine, avec sa provenance", async () => {
    const { account, db } = await makeAccount("q-secteurs@test.fr");
    const q = await askQuestion(db, {
      scope: "account",
      text: "Votre métier ?",
      originStep: ETAPES.secteurs,
    });
    const { outcome } = await answerQuestion(
      db,
      q.id,
      { key: "food+construction", answer: "Les deux" },
      { source: "chat" },
    );
    expect(outcome).toEqual({
      kind: "sectors",
      sectors: ["food", "construction"],
    });
    const maj = await prisma.account.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(maj.sectors).toEqual(["food", "construction"]);
    const rep = await prisma.relvoQuestion.findUniqueOrThrow({
      where: { id: q.id },
    });
    expect(rep.status).toBe("answered");
    expect(rep.answer).toBe("Les deux");
    const events = await db.eventLog.findMany({
      select: { eventType: true, metadata: true },
    });
    const types = events.map((e) => e.eventType);
    expect(types).toContain(EVENT_TYPES.sectorsUpdated);
    expect(types).toContain(EVENT_TYPES.questionAnswered);
    expect(
      events.find((e) => e.eventType === EVENT_TYPES.questionAnswered)
        ?.metadata,
    ).toMatchObject({ source: "chat", outcome: "sectors" });
    // Une question fermée ne se répond pas deux fois.
    await expect(
      answerQuestion(db, q.id, { answer: "Encore" }),
    ).rejects.toThrow();
  });

  it("« un autre métier » s'écrit : les secteurs passent à `other` et le métier dit devient une instruction de Général", async () => {
    const { account, general, db } = await makeAccount(
      "q-autre-metier@test.fr",
    );
    const q = await askQuestion(db, {
      scope: "account",
      text: "Votre métier ?",
      originStep: ETAPES.secteurs,
    });
    const { outcome } = await answerQuestion(db, q.id, {
      key: "other",
      answer: "Paysagiste, entretien de jardins pour des copropriétés",
    });
    expect(outcome).toEqual({
      kind: "sectors",
      sectors: ["other"],
      metier: "Paysagiste, entretien de jardins pour des copropriétés",
    });
    const maj = await prisma.account.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(maj.sectors).toEqual(["other"]);
    const notes = await db.knowledgeDocument.findMany({
      where: { folderId: general.id, kind: "note" },
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]!.name).toBe("Mon métier");
    expect(notes[0]!.content).toContain("Paysagiste");
    // Le métier connu — même « autre » —, les domaines de tout métier se
    // proposent, avec un texte qui ne dit pas « votre métier ».
    await ensureOnboardingQuestions(db, account.id);
    const domaines = (await listOpenQuestions(db)).find(
      (o) => o.originStep === ETAPES.domainesTypiques,
    );
    expect(domaines).toBeDefined();
    expect(domaines!.text).not.toContain("votre métier");
    expect(domaines!.proposedAnswers.map((p) => p.key)).toEqual([
      "clients",
      "fournisseurs",
      "devis",
      "equipe",
      "administratif",
      "aucun",
    ]);
  });

  it("une réponse libre devient une instruction du domaine de la portée, sinon de « Général »", async () => {
    const { general, db } = await makeAccount("q-instruction@test.fr");
    const q = await askQuestion(db, {
      scope: "account",
      text: "Y a-t-il une règle que je dois toujours suivre ? Par exemple « … ».",
      originStep: ETAPES.premiereInstruction,
    });
    const { outcome } = await answerQuestion(db, q.id, {
      key: "autre",
      answer: "Les devis au-dessus de 5 000 € passent par moi.",
    });
    expect(outcome.kind).toBe("instruction");
    const notes = await db.knowledgeDocument.findMany({
      where: { folderId: general.id },
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]!.name).toBe(
      "Y a-t-il une règle que je dois toujours suivre",
    );
    expect(notes[0]!.content).toBe(
      "Les devis au-dessus de 5 000 € passent par moi.",
    );
    expect(titreInstruction("Narbonne est-il une franchise ?")).toBe(
      "Narbonne est-il une franchise",
    );
  });

  it("écarter ferme sans rien appliquer, et ne se repose pas", async () => {
    const { db } = await makeAccount("q-ecart@test.fr");
    const q = await askQuestion(db, {
      scope: "account",
      text: "Votre métier ?",
      originStep: ETAPES.secteurs,
    });
    await dismissQuestion(db, q.id, { source: "chat" });
    expect(await countOpenQuestions(db)).toBe(0);
    const encore = await askQuestion(db, {
      scope: "account",
      text: "Votre métier ?",
      originStep: ETAPES.secteurs,
    });
    // Pas de doublon d'une question OUVERTE : ici l'ancienne est écartée, donc
    // une nouvelle se pose — c'est `ensureOnboardingQuestions` qui, lui, ne
    // repose jamais une étape passée.
    expect(encore.id).not.toBe(q.id);
  });
});

describe("le script de la prise en main", () => {
  it("pose les étapes qui ont quelque chose à apprendre, une fois, jamais après une réponse ou un écart", async () => {
    const { account, db } = await makeAccount("q-script@test.fr");
    // Sans métier connu, les domaines typiques ne se proposent pas encore :
    // trois étapes sur les quatre du script, la boîte en dernier.
    expect(SCRIPT_PRISE_EN_MAIN).toHaveLength(4);
    expect(await ensureOnboardingQuestions(db, account.id)).toBe(3);
    expect(await ensureOnboardingQuestions(db, account.id)).toBe(0);
    const ouvertes = await listOpenQuestions(db);
    expect(ouvertes.map((o) => o.originStep)).toEqual([
      ETAPES.secteurs,
      ETAPES.premiereInstruction,
      ETAPES.premiereBoite,
    ]);
    expect(ouvertes[0]!.proposedAnswers.map((p) => p.key)).toContain(
      "food+construction",
    );
    expect(
      ouvertes[0]!.proposedAnswers.find((p) => p.key === "other")?.libre,
    ).toBe(true);
    expect(ouvertes[2]!.connecteBoite).toBe(true);
    expect(ouvertes[2]!.proposedAnswers.map((p) => p.key)).toEqual([
      "GOOGLE",
      "OUTLOOK",
      "MAIL",
    ]);

    await answerQuestion(db, ouvertes[0]!.id, {
      key: "food",
      answer: "La restauration",
    });
    await dismissQuestion(db, ouvertes[1]!.id);
    // Le métier connu, les domaines typiques se proposent — une fois —, et
    // AVANT la boîte : l'ordre du script, pas celui de la naissance.
    expect(await ensureOnboardingQuestions(db, account.id)).toBe(1);
    expect((await listOpenQuestions(db)).map((o) => o.originStep)).toEqual([
      ETAPES.domainesTypiques,
      ETAPES.premiereBoite,
    ]);
    expect(await ensureOnboardingQuestions(db, account.id)).toBe(0);
  });

  it("l'étape « première boîte » se ferme à la connexion, jamais au clic, et ne se repose pas à une boîte connectée", async () => {
    const { account, db } = await makeAccount("q-boite@test.fr", ["food"]);
    await ensureOnboardingQuestions(db, account.id);
    const boite = (await listOpenQuestions(db)).find(
      (o) => o.originStep === ETAPES.premiereBoite,
    );
    expect(boite).toBeDefined();
    const channel = await prisma.channel.create({
      data: {
        accountId: account.id,
        name: "Gmail",
        type: "email",
        identifier: "pro@test.fr",
      },
    });
    await prisma.channelConfig.create({
      data: {
        accountId: account.id,
        channelId: channel.id,
        provider: "unipile",
        externalAccountId: "acc_q_boite",
        status: "connected",
      },
    });
    expect(await resolveMailboxStep(db, "pro@test.fr")).toEqual({
      resolved: true,
    });
    const fermee = await prisma.relvoQuestion.findUniqueOrThrow({
      where: { id: boite!.id },
    });
    expect(fermee.status).toBe("answered");
    expect(fermee.answer).toContain("pro@test.fr");
    expect(await resolveMailboxStep(db, "pro@test.fr")).toEqual({
      resolved: false,
    });
    // Une boîte connectée : l'étape n'a plus rien à apprendre.
    const { account: a2, db: db2 } = await makeAccount("q-boite2@test.fr", [
      "food",
    ]);
    const c2 = await prisma.channel.create({
      data: {
        accountId: a2.id,
        name: "Gmail",
        type: "email",
        identifier: "deja@test.fr",
      },
    });
    await prisma.channelConfig.create({
      data: {
        accountId: a2.id,
        channelId: c2.id,
        provider: "unipile",
        externalAccountId: "acc_q_boite2",
        status: "connected",
      },
    });
    await ensureOnboardingQuestions(db2, a2.id);
    expect(
      (await listOpenQuestions(db2)).map((o) => o.originStep),
    ).not.toContain(ETAPES.premiereBoite);
  });

  it("un compte qui a déjà ses secteurs, un domaine et une instruction n'a rien à répondre", async () => {
    const { account, general, db } = await makeAccount(
      "q-script-rien@test.fr",
      ["food"],
    );
    await createNote(db, { folderId: general.id, name: "Règle", content: "x" });
    await db.folder.create({
      data: { name: "Fournisseurs", slug: "fournisseurs" },
    });
    // Une boîte pré-créée mais jamais connectée ne compte pas : l'étape se pose.
    const boite = await prisma.channel.create({
      data: {
        accountId: account.id,
        name: "Gmail",
        type: "email",
        identifier: "En attente de connexion…",
      },
    });
    await prisma.channelConfig.create({
      data: {
        accountId: account.id,
        channelId: boite.id,
        provider: "unipile",
        status: "pending",
      },
    });
    expect(await ensureOnboardingQuestions(db, account.id)).toBe(1);
    expect((await listOpenQuestions(db)).map((o) => o.originStep)).toEqual([
      ETAPES.premiereBoite,
    ]);
    // Connectée : plus rien à répondre.
    await prisma.channelConfig.updateMany({
      where: { channelId: boite.id },
      data: { externalAccountId: "acc_rien", status: "connected" },
    });
    await resolveMailboxStep(db, "rien@test.fr");
    expect(await ensureOnboardingQuestions(db, account.id)).toBe(0);
  });
});

describe("la fin de lecture (M13.2, 05 §11.11)", () => {
  async function lecture(db: ReturnType<typeof tenantDb>, accountId: string) {
    const channel = await prisma.channel.create({
      data: {
        accountId,
        name: "Boîte pro",
        type: "email",
        identifier: `pro-${accountId.slice(0, 8)}@test.fr`,
      },
    });
    const since = new Date(Date.now() - 14 * 86_400_000);
    const c = await requestChannelCatchup(db, { channelId: channel.id, since });
    await prisma.channelCatchup.update({
      where: { id: c.id },
      data: { status: "done", subjectsOpened: 6, conversationsIgnored: 14 },
    });
    return { channel, catchup: c, since };
  }

  it("se pose une fois par lecture, avec ses compteurs, jamais pour une lecture vide", async () => {
    const { account, db } = await makeAccount("q-fin@test.fr", ["food"]);
    const { catchup } = await lecture(db, account.id);
    expect(
      await poserFinDeLecture(db, {
        id: catchup.id,
        subjectsOpened: 0,
        conversationsIgnored: 3,
      }),
    ).toBeNull();
    const q = await poserFinDeLecture(db, {
      id: catchup.id,
      subjectsOpened: 6,
      conversationsIgnored: 14,
    });
    expect(q?.text).toBe(
      "J'ai fini de lire votre courrier : 6 affaires ouvertes, 14 messages mis de côté. Est-ce que ça ressemble à votre activité ?",
    );
    expect(q?.originStep).toBe(`${ETAPES.finDeLecture}/${catchup.id}`);
    const encore = await poserFinDeLecture(db, {
      id: catchup.id,
      subjectsOpened: 6,
      conversationsIgnored: 14,
    });
    expect(encore?.id).toBe(q?.id);
    const [ouverte] = await listOpenQuestions(db);
    expect(ouverte?.proposedAnswers.map((p) => p.key)).toEqual([
      "oui",
      "manque",
      "trop",
      "deux-semaines",
    ]);
    expect(
      ouverte?.proposedAnswers.find((p) => p.key === "manque")?.libre,
    ).toBe(true);
    // Une seule affaire, aucun message mis de côté : le singulier, sans virgule.
    const q1 = await poserFinDeLecture(db, {
      id: "00000000-0000-4000-8000-000000000001",
      subjectsOpened: 1,
      conversationsIgnored: 0,
    });
    expect(q1?.text).toContain(": 1 affaire ouverte. Est-ce");
  });

  it("« Oui » est noté ; « Il en manque » devient une instruction de Général ; « deux semaines de plus » demande la lecture suivante sur le même canal", async () => {
    const { account, general, db } = await makeAccount("q-fin-dest@test.fr", [
      "food",
    ]);
    const { channel, catchup, since } = await lecture(db, account.id);
    const poser = () =>
      poserFinDeLecture(db, {
        id: catchup.id,
        subjectsOpened: 2,
        conversationsIgnored: 0,
      });
    const q1 = (await poser())!;
    expect(
      (await answerQuestion(db, q1.id, { key: "oui", answer: "Oui, c'est ça" }))
        .outcome,
    ).toEqual({ kind: "noted" });

    await dismissQuestion(db, q1.id);
    await prisma.relvoQuestion.deleteMany({ where: { id: q1.id } });
    const q2 = (await poser())!;
    const r2 = await answerQuestion(db, q2.id, {
      key: "manque",
      answer: "Le devis de la chambre froide avec ClimaPro.",
    });
    expect(r2.outcome.kind).toBe("instruction");
    const notes = await db.knowledgeDocument.findMany({
      where: { folderId: general.id },
    });
    expect(notes.map((n) => n.name)).toEqual([
      "Ce qui manquait à la première lecture",
    ]);
    expect(notes[0]!.content).toBe(
      "Le devis de la chambre froide avec ClimaPro.",
    );

    await prisma.relvoQuestion.deleteMany({ where: { id: q2.id } });
    const q3 = (await poser())!;
    const r3 = await answerQuestion(db, q3.id, {
      key: "deux-semaines",
      answer: "Lisez deux semaines de plus",
    });
    expect(r3.outcome).toEqual({
      kind: "lecture-etendue",
      channelId: channel.id,
      since: new Date(since.getTime() - 14 * 86_400_000),
    });
  });
});
