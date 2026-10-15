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
  prisma,
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
    expect(await ensureOnboardingQuestions(db, account.id)).toBe(
      SCRIPT_PRISE_EN_MAIN.length,
    );
    expect(await ensureOnboardingQuestions(db, account.id)).toBe(0);
    const ouvertes = await listOpenQuestions(db);
    expect(ouvertes.map((o) => o.originStep)).toEqual([
      ETAPES.secteurs,
      ETAPES.premiereInstruction,
    ]);
    expect(ouvertes[0]!.proposedAnswers.map((p) => p.key)).toContain(
      "food+construction",
    );

    await answerQuestion(db, ouvertes[0]!.id, {
      key: "food",
      answer: "La restauration",
    });
    await dismissQuestion(db, ouvertes[1]!.id);
    expect(await ensureOnboardingQuestions(db, account.id)).toBe(0);
    expect(await countOpenQuestions(db)).toBe(0);
  });

  it("un compte qui a déjà ses secteurs et une instruction n'a rien à répondre", async () => {
    const { account, general, db } = await makeAccount(
      "q-script-rien@test.fr",
      ["food"],
    );
    await createNote(db, { folderId: general.id, name: "Règle", content: "x" });
    expect(await ensureOnboardingQuestions(db, account.id)).toBe(0);
  });
});
