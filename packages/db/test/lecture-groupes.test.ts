import { describe, expect, it } from "vitest";
import {
  ChannelType,
  EVENT_TYPES,
  applyTriageMatter,
  compterSujetsNesDesGroupes,
  getTriageProjection,
  ignoreConversation,
  ingestInboundWhatsApp,
  listGroupesALire,
  noterLectureSansSuite,
  prisma,
  recordTriageVerdict,
  rendreLectureGroupe,
  reserverLectureGroupe,
  tenantDb,
  upsertChannelConfig,
  validateSubject,
} from "../src/index";

// LA LECTURE DES GROUPES, DEUX FOIS PAR JOUR (M29.5). Ce que ce fichier tient :
// quels groupes sont à lire (jugés, actifs, sans sujet qui écoute, avec du
// neuf depuis le repère) ; le repère se réserve une seule fois et se rend ; la
// projection sur une fenêtre ne montre que ce qui est arrivé après le repère ;
// et une lecture sans suite se note sans écraser l'avis que porte le groupe.

const pause = (ms = 15) => new Promise((r) => setTimeout(r, ms));

let n = 0;
async function compte() {
  n += 1;
  const account = await prisma.account.create({
    data: {
      email: `groupes-${n}-${Date.now()}@relvo.test`,
      firstName: "Test",
      lastName: "User",
    },
  });
  const db = tenantDb(account.id);
  const canal = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "WhatsApp",
      type: ChannelType.whatsapp,
      identifier: "+33600000000",
    },
  });
  await upsertChannelConfig(db, canal.id, {
    provider: "unipile",
    status: "connected",
    lastSyncAt: new Date("2026-10-20T10:00:00Z"),
  });
  let i = 0;
  const dire = async (chat: string, content: string, groupe = true) => {
    i += 1;
    await pause();
    const { message } = await ingestInboundWhatsApp(db, {
      channelId: canal.id,
      externalId: `m-${n}-${i}`,
      externalThreadId: chat,
      isGroup: groupe,
      senderRaw: "+33600000010",
      senderName: "Karim",
      content,
    });
    return message;
  };
  const juger = async (
    message: { id: string; conversationId: string },
    avis: Partial<Parameters<typeof recordTriageVerdict>[1]> = {},
  ) => {
    await pause();
    return recordTriageVerdict(db, {
      conversationId: message.conversationId,
      messageId: message.id,
      verdict: "uncertain",
      nature: "professional",
      confidence: "high",
      reason: "Groupe de l'équipe.",
      source: "model",
      ...avis,
    });
  };
  return { accountId: account.id, db, dire, juger };
}

describe("lecture des groupes — quels groupes sont à lire", () => {
  it("un groupe jugé qui a parlé depuis ; ni un groupe jamais jugé, ni un fil direct, ni un groupe silencieux", async () => {
    const { accountId, dire, juger } = await compte();
    const equipe = await dire("chat-equipe", "Salut la team");
    const { triagedAt } = await juger(equipe);
    // Jugé, mais rien de neuf : pas à lire.
    expect(await listGroupesALire(accountId)).toEqual([]);

    await dire("chat-equipe", "La chambre froide fait du bruit");
    await dire("chat-inconnu", "Groupe jamais jugé");
    const direct = await dire("chat-bruno", "Bonjour", false);
    await juger(direct);
    await dire("chat-bruno", "Vous êtes là ?", false);

    const dus = await listGroupesALire(accountId);
    expect(dus).toEqual([
      {
        conversationId: equipe.conversationId,
        depuis: triagedAt,
        luJusqua: null,
      },
    ]);
  });

  it("ni un groupe ignoré, ni un groupe qu'un sujet écoute — jusqu'à ce que le sujet le libère", async () => {
    const { accountId, db, dire, juger } = await compte();
    const ignore = await dire("chat-foot", "Match jeudi");
    await juger(ignore);
    await dire("chat-foot", "Qui vient ?");
    await ignoreConversation(db, ignore.conversationId, {
      reason: "personal",
      actor: "ai",
    });

    const chantier = await dire("chat-chantier", "Le carrelage est arrivé");
    await juger(chantier);
    const demande = await dire("chat-chantier", "Il manque dix mètres carrés");
    expect((await listGroupesALire(accountId)).length).toBe(1);

    // Un sujet s'ouvre sur le groupe : il se suit en direct, plus par lot.
    const ouvert = await applyTriageMatter(db, {
      conversationId: chantier.conversationId,
      messageId: demande.id,
      title: "Carrelage manquant",
      anchorMessageId: demande.id,
    });
    await dire("chat-chantier", "Je rappelle le fournisseur");
    expect(await listGroupesALire(accountId)).toEqual([]);
    // C'est ce sujet-là que le garde-fou de la lecture compte : né d'un groupe, ouvert par Relvo.
    const hier = new Date(Date.now() - 86_400_000);
    expect(await compterSujetsNesDesGroupes(db, hier)).toBe(1);
    expect(
      await compterSujetsNesDesGroupes(db, new Date(Date.now() + 1000)),
    ).toBe(0);

    // Validé : le groupe est rendu aux lectures du jour, pour ce qui suit.
    await validateSubject(db, ouvert.subjectId);
    expect(await listGroupesALire(accountId)).toEqual([]);
    await dire("chat-chantier", "Autre chose : la benne est pleine");
    expect(
      (await listGroupesALire(accountId)).map((g) => g.conversationId),
    ).toEqual([chantier.conversationId]);
  });
});

describe("lecture des groupes — le repère", () => {
  it("se réserve une seule fois, fait sortir le groupe de la liste, et se rend sur un échec", async () => {
    const { accountId, db, dire, juger } = await compte();
    const premier = await dire("chat-equipe", "Salut");
    await juger(premier);
    const neuf = await dire("chat-equipe", "Le four est en panne");
    const [du] = await listGroupesALire(accountId);
    const reservation = {
      conversationId: du!.conversationId,
      de: du!.luJusqua,
      a: neuf.createdAt,
    };

    expect(await reserverLectureGroupe(db, reservation)).toBe(true);
    // Une seconde passe arrive sur le même groupe : elle s'efface.
    expect(await reserverLectureGroupe(db, reservation)).toBe(false);
    expect(await listGroupesALire(accountId)).toEqual([]);

    // L'appel a échoué : les messages restent à lire.
    await rendreLectureGroupe(db, reservation);
    expect((await listGroupesALire(accountId)).length).toBe(1);

    // Lu pour de bon : seul un message PLUS RÉCENT rend le groupe à lire.
    expect(await reserverLectureGroupe(db, reservation)).toBe(true);
    const suivant = await dire("chat-equipe", "Le dépanneur passe à 15 h");
    const [encore] = await listGroupesALire(accountId);
    expect(encore).toMatchObject({
      depuis: neuf.createdAt,
      luJusqua: neuf.createdAt,
    });

    // La fenêtre de la projection ne montre que ce qui suit le repère.
    const projection = await getTriageProjection(db, neuf.conversationId, {
      apres: encore!.depuis,
      plafond: 40,
    });
    expect(projection.conversation.messages.map((m) => m.id)).toEqual([
      suivant.id,
    ]);
    expect(projection.fenetre).toEqual({ jusqua: suivant.createdAt, omis: 0 });
  });

  it("la fenêtre garde les derniers messages et compte ceux que le plafond laisse", async () => {
    const { db, dire, juger } = await compte();
    const premier = await dire("chat-equipe", "Salut");
    const { triagedAt } = await juger(premier);
    await dire("chat-equipe", "un");
    const deux = await dire("chat-equipe", "deux");
    const trois = await dire("chat-equipe", "trois");
    const projection = await getTriageProjection(db, premier.conversationId, {
      apres: triagedAt,
      plafond: 2,
    });
    expect(projection.conversation.messages.map((m) => m.id)).toEqual([
      deux.id,
      trois.id,
    ]);
    expect(projection.fenetre).toEqual({ jusqua: trois.createdAt, omis: 1 });
    // Hors fenêtre, la projection n'en porte pas.
    expect(
      (await getTriageProjection(db, premier.conversationId)).fenetre,
    ).toBeNull();
  });
});

describe("lecture des groupes — une lecture sans suite", () => {
  it("se note au journal, remet la série à zéro, et laisse au groupe l'avis de son jugement", async () => {
    const { db, juger, dire } = await compte();
    const m = await dire("chat-equipe", "Bon appétit");
    await juger(m);
    const sur = { verdict: "noise", confidence: "high" } as const;
    expect((await juger(m, { ...sur, nature: "personal" })).noiseStreak).toBe(
      1,
    );
    expect((await juger(m, { ...sur, nature: "personal" })).noiseStreak).toBe(
      2,
    );

    // L'équipe s'organise sans le dirigeant : la série repart de zéro…
    await noterLectureSansSuite(db, {
      conversationId: m.conversationId,
      messageId: m.id,
      verdict: "noise",
      nature: "professional",
      confidence: "high",
      reason: "L'équipe règle le planning entre elle.",
    });
    const groupe = await db.conversation.findFirstOrThrow({
      where: { id: m.conversationId },
    });
    expect(groupe.noiseStreak).toBe(0);
    // … et l'avis du groupe reste celui d'avant la lecture.
    expect(groupe.triageNature).toBe("personal");
    expect((await getTriageProjection(db, m.conversationId)).natureConnue).toBe(
      "personal",
    );
    const journal = await db.eventLog.findFirstOrThrow({
      where: { eventType: EVENT_TYPES.groupRead, messageId: m.id },
    });
    expect(journal.description).toBe("L'équipe règle le planning entre elle.");
    expect((await juger(m, { ...sur, nature: "personal" })).noiseStreak).toBe(
      1,
    );
  });
});
