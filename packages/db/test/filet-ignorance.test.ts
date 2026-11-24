import { describe, expect, it } from "vitest";
import {
  CLE_ECHANGE_IGNOREES,
  CLE_VOIR_IGNOREES,
  answerQuestion,
  cleDeLaQuestion,
  ignoreConversation,
  listConversationItems,
  natureDeLaCle,
  phraseDuReleve,
  poserReleveIgnorees,
  prisma,
  reactivateConversation,
  recevoirEmailEntrant,
  recordTriageVerdict,
  regrouperEchangesRelvo,
  releveDesIgnorees,
  tenantDb,
} from "../src/index";

// LE FILET D'UN FAUX VERDICT (M25.11). Ignorer n'importe plus rien : ce
// fichier tient ce qui empêche une erreur de Relvo de passer inaperçue — la
// série d'avis qu'il lui faut, le relevé de ce qu'il a ignoré, et le filtre
// qui le retrouve dans la liste.

let n = 0;
async function compte() {
  n += 1;
  const email = `filet-${n}-${Date.now()}@relvo.test`;
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  const channel = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "Boîte",
      type: "email",
      identifier: email,
    },
  });
  return { email, channelId: channel.id, db: tenantDb(account.id) };
}

type Db = ReturnType<typeof tenantDb>;
let k = 0;
async function fil(db: Db, channelId: string, email: string, objet: string) {
  k += 1;
  const r = await recevoirEmailEntrant(db, {
    channelId,
    externalId: `f${k}`,
    senderRaw: `exp${k}@exemple.fr`,
    recipients: [email],
    subjectLine: objet,
    content: "…",
  });
  if (r.ecartee) throw new Error("devait entrer");
  return r.message;
}

const avis = (
  db: Db,
  m: { id: string; conversationId: string },
  verdict: "noise" | "matter",
  confidence: "high" | "medium" = "high",
) =>
  recordTriageVerdict(db, {
    conversationId: m.conversationId,
    messageId: m.id,
    verdict,
    nature: verdict === "noise" ? "advertising" : "professional",
    confidence,
    reason: "…",
    source: "model",
  });

describe("la série de « rien à faire » sûrs", () => {
  it("s'allonge d'un avis sûr à l'autre, et tout autre avis la remet à zéro", async () => {
    const { db, channelId, email } = await compte();
    const m = await fil(db, channelId, email, "Promo");
    expect((await avis(db, m, "noise")).noiseStreak).toBe(1);
    expect((await avis(db, m, "noise")).noiseStreak).toBe(2);
    // Un « rien à faire » dont Relvo n'est pas sûr ne compte pas : il casse la série.
    expect((await avis(db, m, "noise", "medium")).noiseStreak).toBe(0);
    expect((await avis(db, m, "noise")).noiseStreak).toBe(1);
    expect((await avis(db, m, "matter")).noiseStreak).toBe(0);
  });

  it("réactiver une conversation la remet à zéro : il faudra de nouveau plusieurs avis", async () => {
    const { db, channelId, email } = await compte();
    const m = await fil(db, channelId, email, "Promo");
    await avis(db, m, "noise");
    await avis(db, m, "noise");
    await avis(db, m, "noise");
    await ignoreConversation(db, m.conversationId, {
      reason: "advertising",
      actor: "ai",
    });
    await reactivateConversation(db, m.conversationId);
    expect((await avis(db, m, "noise")).noiseStreak).toBe(1);
  });
});

describe("le relevé de ce que Relvo a ignoré", () => {
  it("compte par raison ce qui est ENCORE ignoré par Relvo, depuis la date", async () => {
    const { db, channelId, email } = await compte();
    const pub1 = await fil(db, channelId, email, "Promo A");
    const pub2 = await fil(db, channelId, email, "Promo B");
    const perso = await fil(db, channelId, email, "Dimanche");
    const reprise = await fil(db, channelId, email, "Promo C");
    const parMoi = await fil(db, channelId, email, "Lettre");
    const depuis = new Date(Date.now() - 60_000);
    for (const m of [pub1, pub2, reprise]) {
      await ignoreConversation(db, m.conversationId, {
        reason: "advertising",
        actor: "ai",
      });
    }
    await ignoreConversation(db, perso.conversationId, {
      reason: "personal",
      actor: "ai",
    });
    // Ignorée par le dirigeant : ce n'est pas un verdict de Relvo.
    await ignoreConversation(db, parMoi.conversationId, { reason: "other" });
    // Reprise par le dirigeant : elle n'est plus au relevé.
    await reactivateConversation(db, reprise.conversationId);

    const releve = await releveDesIgnorees(db, depuis);
    expect(releve).toEqual({
      total: 3,
      parRaison: [
        { reason: "advertising", count: 2 },
        { reason: "personal", count: 1 },
      ],
    });
    expect(phraseDuReleve(releve)).toBe(
      "Cette semaine, j'ai mis de côté 3 conversations : 2 publicités, 1 conversation personnelle. Je n'importe plus leurs messages. Est-ce que c'est juste ?",
    );
    // Rien avant la date : rien à dire.
    expect(await releveDesIgnorees(db, new Date(Date.now() + 60_000))).toEqual({
      total: 0,
      parRaison: [],
    });
  });

  it("ne se pose pas quand il n'y a rien, ni deux fois dans la même semaine", async () => {
    const { db, channelId, email } = await compte();
    expect(await poserReleveIgnorees(db)).toBeNull();

    const m = await fil(db, channelId, email, "Promo");
    await ignoreConversation(db, m.conversationId, {
      reason: "advertising",
      actor: "ai",
    });
    const q = await poserReleveIgnorees(db);
    expect(q?.text).toMatch(
      /^Cette semaine, j'ai mis de côté 1 conversation : 1 publicité\./,
    );
    expect(q?.originStep).toMatch(/^releve-ignorees\/\d{4}-\d{2}-\d{2}$/);
    // Posé une fois : ni ouvert ni répondu, il ne se repose pas cette semaine.
    expect(await poserReleveIgnorees(db)).toBeNull();
    await answerQuestion(db, q!.id, { key: "ok", answer: "C'est bien ça" });
    expect(await poserReleveIgnorees(db)).toBeNull();
    // Huit jours plus tard, sans rien de nouveau dans la fenêtre : toujours rien.
    const dansHuitJours = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect(await poserReleveIgnorees(db, dansHuitJours)).toBeNull();
  });

  it("« voir la liste » mène aux conversations ignorées ; « c'est bien ça » est noté", async () => {
    const { db, channelId, email } = await compte();
    const m = await fil(db, channelId, email, "Promo");
    await ignoreConversation(db, m.conversationId, {
      reason: "advertising",
      actor: "ai",
    });
    const q = await poserReleveIgnorees(db);
    const r = await answerQuestion(db, q!.id, {
      key: CLE_VOIR_IGNOREES,
      answer: "Voir la liste",
    });
    expect(r.outcome).toEqual({ kind: "ignorees-a-revoir" });
    // Rien n'a été écrit en instruction : un relevé ne change rien par lui-même.
    expect(await db.knowledgeDocument.count()).toBe(0);
  });

  it("tous les relevés vivent dans un seul échange de Relvo", () => {
    const q = {
      id: "q1",
      originStep: "releve-ignorees/2026-11-30",
      subjectId: null,
      originSubjectId: null,
    };
    expect(cleDeLaQuestion(q)).toBe(CLE_ECHANGE_IGNOREES);
    expect(
      cleDeLaQuestion({ ...q, originStep: "releve-ignorees/2026-12-07" }),
    ).toBe(CLE_ECHANGE_IGNOREES);
    expect(natureDeLaCle(CLE_ECHANGE_IGNOREES)).toBe("releve");
    const [echange] = regrouperEchangesRelvo({
      questions: [
        {
          ...q,
          text: "Cette semaine, j'ai mis de côté 3 conversations…",
          status: "open",
          answer: null,
          askedAt: new Date("2026-11-30T06:00:00Z"),
          answeredAt: null,
        },
      ],
      lectures: [],
    });
    expect(echange).toMatchObject({
      cle: CLE_ECHANGE_IGNOREES,
      nature: "releve",
      titre: "Ce que j'ai mis de côté",
      ouvertes: ["q1"],
    });
  });
});

describe("retrouver une conversation ignorée", () => {
  it("la liste se filtre par qui a ignoré et par raison", async () => {
    const { db, channelId, email } = await compte();
    const pub = await fil(db, channelId, email, "Promo");
    const perso = await fil(db, channelId, email, "Dimanche");
    const parMoi = await fil(db, channelId, email, "Lettre");
    await ignoreConversation(db, pub.conversationId, {
      reason: "advertising",
      actor: "ai",
    });
    await ignoreConversation(db, perso.conversationId, {
      reason: "personal",
      actor: "ai",
    });
    await ignoreConversation(db, parMoi.conversationId, { reason: "personal" });

    const ids = async (ignored?: Parameters<typeof listConversationItems>[1]) =>
      (await listConversationItems(db, { filter: "ignored", ...ignored })).items
        .map((c) => c.id)
        .sort();
    expect(await ids()).toHaveLength(3);
    expect(await ids({ ignored: { by: "ai" } })).toEqual(
      [pub.conversationId, perso.conversationId].sort(),
    );
    expect(await ids({ ignored: { reason: "personal" } })).toEqual(
      [perso.conversationId, parMoi.conversationId].sort(),
    );
    expect(await ids({ ignored: { by: "ai", reason: "personal" } })).toEqual([
      perso.conversationId,
    ]);
  });
});
