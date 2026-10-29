import { describe, expect, it } from "vitest";
import {
  answerQuestion,
  createChannel,
  ensureOnboardingQuestions,
  estUneBoiteMigree,
  etapeDeMigration,
  EVENT_TYPES,
  isDomainError,
  listOpenQuestions,
  listPendingGmailMigrations,
  migrateChannelToGmail,
  prisma,
  proposeGmailMigration,
  tenantDb,
  upsertChannelConfig,
} from "../src/index";

// La MIGRATION d'une boîte de l'agrégateur vers le relais Gmail (M24.9) : elle
// se PROPOSE par une question de Relvo — la boîte continue par l'agrégateur
// tant que le geste n'est pas fait — ; au retour du consentement, le canal
// change de fournisseur en gardant son identité, la question se ferme, l'ancien
// compte est rendu pour être effacé chez l'agrégateur, et la trace de la
// migration dit qu'aucune lecture ne doit être redemandée.

async function compte(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  return { account, db: tenantDb(account.id) };
}

async function boiteDeLAgregateur(
  db: ReturnType<typeof tenantDb>,
  adresse: string,
  compteExterne: string,
) {
  const channel = await createChannel(db, {
    name: adresse,
    type: "email",
    identifier: adresse,
  });
  await upsertChannelConfig(db, channel.id, {
    provider: "unipile",
    status: "connected",
  });
  await prisma.channelConfig.updateMany({
    where: { channelId: channel.id },
    data: { externalAccountId: compteExterne },
  });
  return channel;
}

const JETONS = {
  jetons: { rafraichissement: "v1.x", acces: "v1.y", expireA: "2026-01-01" },
  perimetres: ["a"],
};

describe("proposeGmailMigration", () => {
  it("pose la question une fois, qui ouvre le consentement sur ce canal, et la page des canaux la connaît", async () => {
    const { db } = await compte("migration-propose@test.fr");
    const boite = await boiteDeLAgregateur(db, "pro@exemple.fr", "acc_1");

    const premiere = await proposeGmailMigration(db, boite.id);
    expect(premiere.deja).toBe(false);
    expect(premiere.question.originStep).toBe(etapeDeMigration(boite.id));
    expect(premiere.question.text).toContain("pro@exemple.fr");

    const seconde = await proposeGmailMigration(db, boite.id);
    expect(seconde.deja).toBe(true);
    expect(seconde.question.id).toBe(premiere.question.id);

    // Elle passe devant les étapes du script : c'est pour elle que le
    // dirigeant, prévenu, ouvre l'échange.
    await ensureOnboardingQuestions(
      db,
      (await db.account.findFirstOrThrow()).id,
    );
    const ouvertes = await listOpenQuestions(db);
    expect(ouvertes.length).toBeGreaterThan(1);
    expect(ouvertes[0]!.id).toBe(premiere.question.id);
    const q = ouvertes[0]!;
    expect(q.migreBoite).toBe(boite.id);
    expect(q.connecteBoite).toBe(false);
    expect(q.proposedAnswers.map((p) => p.key)).toEqual(["gmail"]);

    expect(await listPendingGmailMigrations(db)).toEqual([boite.id]);

    // Une réponse directe à la question ne bascule rien : elle est notée.
    const r = await answerQuestion(db, q.id, {
      key: "gmail",
      answer: "Relier avec Google maintenant",
    });
    expect(r.outcome.kind).toBe("noted");
    // La proposition reste connue de la page des canaux tant que la boîte
    // passe par l'agrégateur, question fermée ou pas.
    expect(await listPendingGmailMigrations(db)).toEqual([boite.id]);
  });

  it("refuse une boîte du relais, un WhatsApp, une boîte jamais connectée", async () => {
    const { db } = await compte("migration-refus@test.fr");
    const gmail = await createChannel(db, {
      name: "g@exemple.fr",
      type: "email",
      identifier: "g@exemple.fr",
    });
    await upsertChannelConfig(db, gmail.id, {
      provider: "gmail",
      status: "connected",
    });
    await prisma.channelConfig.updateMany({
      where: { channelId: gmail.id },
      data: { externalAccountId: "g@exemple.fr" },
    });
    await expect(proposeGmailMigration(db, gmail.id)).rejects.toSatisfy(
      (e) => isDomainError(e) && e.code === "INVALID_STATE",
    );

    const wa = await createChannel(db, {
      name: "WhatsApp",
      type: "whatsapp",
      identifier: "+33600000000",
    });
    await expect(proposeGmailMigration(db, wa.id)).rejects.toSatisfy(
      (e) => isDomainError(e) && e.code === "INVALID_STATE",
    );

    const orpheline = await createChannel(db, {
      name: "Boîte",
      type: "email",
      identifier: "En attente",
    });
    await upsertChannelConfig(db, orpheline.id, {
      provider: "unipile",
      status: "pending",
    });
    await expect(proposeGmailMigration(db, orpheline.id)).rejects.toSatisfy(
      (e) => isDomainError(e) && e.code === "INVALID_STATE",
    );
  });
});

describe("migrateChannelToGmail", () => {
  it("bascule le canal en gardant son identité, ferme la question, rend l'ancien compte, journalise", async () => {
    const { db } = await compte("migration-bascule@test.fr");
    const boite = await boiteDeLAgregateur(db, "Pro@Exemple.fr", "acc_2");
    const { question } = await proposeGmailMigration(db, boite.id);

    const r = await migrateChannelToGmail(db, boite.id, {
      externalAccountId: "pro@exemple.fr",
      connectionData: JETONS,
    });
    expect(r).toEqual({
      channelId: boite.id,
      adresse: "pro@exemple.fr",
      ancienCompte: "acc_2",
    });

    const apres = await db.channel.findFirstOrThrow({
      where: { id: boite.id },
      include: { config: true },
    });
    expect(apres.id).toBe(boite.id);
    expect(apres.identifier).toBe("pro@exemple.fr");
    expect(apres.config?.provider).toBe("gmail");
    expect(apres.config?.externalAccountId).toBe("pro@exemple.fr");
    expect(apres.config?.status).toBe("connected");
    const donnees = apres.config?.connectionData as Record<string, unknown>;
    expect(donnees.jetons).toEqual(JETONS.jetons);
    expect(donnees.migreDe).toMatchObject({
      fournisseur: "unipile",
      compte: "acc_2",
    });
    expect(estUneBoiteMigree(donnees)).toBe(true);
    expect(estUneBoiteMigree(JETONS)).toBe(false);
    expect(estUneBoiteMigree(null)).toBe(false);

    const q = await db.relvoQuestion.findFirstOrThrow({
      where: { id: question.id },
    });
    expect(q.status).toBe("answered");
    expect(q.answer).toContain("pro@exemple.fr");
    expect(await listPendingGmailMigrations(db)).toEqual([]);

    const events = await db.eventLog.findMany({
      where: {
        entityId: boite.id,
        eventType: EVENT_TYPES.channelConfigUpdated,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(events[0]?.title).toContain("passée au relais Gmail");
    expect(events[0]?.metadata).toMatchObject({
      migration: { de: "unipile", vers: "gmail", compte: "acc_2" },
    });
  });

  it("refuse une autre adresse que celle du canal, et une adresse déjà reliée", async () => {
    const { db } = await compte("migration-conflit@test.fr");
    const boite = await boiteDeLAgregateur(db, "pro@exemple.fr", "acc_3");
    await expect(
      migrateChannelToGmail(db, boite.id, {
        externalAccountId: "autre@exemple.fr",
        connectionData: JETONS,
      }),
    ).rejects.toSatisfy((e) => isDomainError(e) && e.code === "CONFLICT");

    // La même adresse déjà reliée au relais sur un autre canal.
    const deja = await createChannel(db, {
      name: "pro@exemple.fr",
      type: "email",
      identifier: "pro@exemple.fr",
    });
    await upsertChannelConfig(db, deja.id, {
      provider: "gmail",
      status: "connected",
    });
    await prisma.channelConfig.updateMany({
      where: { channelId: deja.id },
      data: { externalAccountId: "pro@exemple.fr" },
    });
    await expect(
      migrateChannelToGmail(db, boite.id, {
        externalAccountId: "pro@exemple.fr",
        connectionData: JETONS,
      }),
    ).rejects.toSatisfy((e) => isDomainError(e) && e.code === "CONFLICT");

    // Rien n'a bougé.
    const intacte = await db.channelConfig.findFirstOrThrow({
      where: { channelId: boite.id },
    });
    expect(intacte.provider).toBe("unipile");
    expect(intacte.externalAccountId).toBe("acc_3");
  });
});
