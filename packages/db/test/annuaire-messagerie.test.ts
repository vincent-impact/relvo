import { describe, expect, it } from "vitest";
import {
  EXTRAIT_CITE_MAX,
  MENTION_VOUS,
  annuaireDesMentions,
  avecLaCitation,
  cleIdentite,
  ecrireMentions,
  estUnEnvoiDuDirigeant,
  extraitCite,
  getConversationThread,
  getTriageProjection,
  idsDesMentions,
  listConversationItems,
  mentionneLeDirigeant,
  noterIdentites,
  noterReponseAuDirigeant,
  prisma,
  recevoirWhatsAppEntrant,
  recevoirWhatsAppSortant,
  resoudreMentions,
  tenantDb,
} from "../src/index";

// L'ANNUAIRE DES IDENTIFIANTS ET LES MENTIONS (M29.1, M29.2). Ce que ce fichier
// tient : une mention se lit par un nom sans que le texte stocké change ;
// l'annuaire ne désapprend rien ; « on vous mentionne » se décide sans modèle,
// sur le canal où le message arrive ; et la liste le montre tant que le
// message n'est pas lu.

const LID_EYA = "265338952376336";
const LID_MOI = "190000000000001";

let n = 0;
async function compte() {
  n += 1;
  const account = await prisma.account.create({
    data: {
      email: `annuaire-${n}-${Date.now()}@relvo.test`,
      firstName: "Test",
      lastName: "User",
    },
  });
  const canal = (nom: string) =>
    prisma.channel.create({
      data: {
        accountId: account.id,
        name: nom,
        type: "whatsapp",
        identifier: `+3360000000${n}`,
      },
    });
  return {
    db: tenantDb(account.id),
    channelId: (await canal("WhatsApp")).id,
    autreCanal: canal,
  };
}

describe("lire une mention", () => {
  it("repère les identifiants d'un texte, et la clé d'un identifiant brut", () => {
    expect(
      idsDesMentions(
        `@${LID_EYA} peux-tu voir avec @33612345678 ? @${LID_EYA}`,
      ),
    ).toEqual([LID_EYA, "33612345678"]);
    // Une adresse, un « @ » suivi de peu de chiffres : pas des mentions.
    expect(idsDesMentions("écris à contact@exemple.fr, tarif @12")).toEqual([]);
    expect(cleIdentite(`${LID_EYA}@lid`)).toBe(LID_EYA);
    expect(cleIdentite("33612345678@s.whatsapp.net")).toBe("33612345678");
    expect(cleIdentite("+33 6 12 34 56 78")).toBe("33612345678");
    expect(cleIdentite("groupe")).toBeNull();
  });

  it("écrit le nom, « @vous » pour le dirigeant, le numéro à défaut, et laisse l'inconnu", () => {
    const annuaire = new Map([
      [LID_EYA, { name: "Dahmani Eya", phone: null, isSelf: false }],
      [LID_MOI, { name: "Moi", phone: null, isSelf: true }],
      ["200000000000002", { name: null, phone: "33611111111", isSelf: false }],
    ]);
    expect(
      ecrireMentions(
        `@${LID_EYA} et @${LID_MOI}, voyez avec @200000000000002 et @300000000000003`,
        annuaire,
      ),
    ).toBe(
      `@Dahmani Eya et ${MENTION_VOUS}, voyez avec @+33611111111 et @300000000000003`,
    );
    expect(mentionneLeDirigeant(`ok @${LID_MOI}`, annuaire)).toBe(true);
    expect(mentionneLeDirigeant(`ok @${LID_EYA}`, annuaire)).toBe(false);
  });
});

describe("tenir l'annuaire", () => {
  it("apprend, complète, et ne désapprend rien", async () => {
    const { db, channelId } = await compte();
    await noterIdentites(db, channelId, [
      {
        internalId: `${LID_EYA}@lid`,
        phone: "+33612345678",
        name: "Dahmani Eya",
      },
      { internalId: null, name: "Sans identifiant" },
    ]);
    // Une source plus pauvre n'efface ni le nom ni le numéro ; « c'est moi » reste.
    await noterIdentites(db, channelId, [{ internalId: LID_EYA }]);
    await noterIdentites(db, channelId, [
      { internalId: LID_MOI, isSelf: true },
    ]);
    await noterIdentites(db, channelId, [
      { internalId: LID_MOI, name: "Vincent" },
    ]);

    const annuaire = await annuaireDesMentions(db, [
      LID_EYA,
      LID_MOI,
      "33612345678",
    ]);
    expect(annuaire.get(LID_EYA)).toEqual({
      name: "Dahmani Eya",
      phone: "33612345678",
      isSelf: false,
    });
    // Une mention écrite par le numéro se résout aussi.
    expect(annuaire.get("33612345678")?.name).toBe("Dahmani Eya");
    expect(annuaire.get(LID_MOI)).toMatchObject({
      name: "Vincent",
      isSelf: true,
    });
    expect(await prisma.messagingIdentity.count()).toBe(2);
  });

  it("un identifiant cherché et introuvable est noté sans nom, puis appris", async () => {
    const { db, channelId } = await compte();
    const avant = await resoudreMentions(db, [`@${LID_EYA} ?`]);
    expect(avant).toEqual({ textes: [`@${LID_EYA} ?`], inconnus: [LID_EYA] });

    await noterIdentites(db, channelId, [{ internalId: LID_EYA }]);
    // Connu sans nom : plus « inconnu », on ne le redemande pas au fournisseur.
    expect((await resoudreMentions(db, [`@${LID_EYA} ?`])).inconnus).toEqual(
      [],
    );

    await noterIdentites(db, channelId, [{ internalId: LID_EYA, name: "Eya" }]);
    expect(
      (await resoudreMentions(db, [`@${LID_EYA} ?`, null])).textes,
    ).toEqual(["@Eya ?", null]);
  });

  it("« c'est moi » se juge sur le canal du message ; le nom vaut pour tout le compte", async () => {
    const { db, channelId, autreCanal } = await compte();
    const second = (await autreCanal("WhatsApp bis")).id;
    await noterIdentites(db, channelId, [
      { internalId: LID_MOI, name: "Vincent", isSelf: true },
    ]);
    expect(
      (await annuaireDesMentions(db, [LID_MOI], { channelId })).get(LID_MOI)
        ?.isSelf,
    ).toBe(true);
    // Sur l'autre canal, cet identifiant n'est pas connu : ce n'est pas « moi ».
    expect(
      (await annuaireDesMentions(db, [LID_MOI], { channelId: second })).size,
    ).toBe(0);
    // À l'affichage, tous canaux : « @vous ».
    expect((await resoudreMentions(db, [`@${LID_MOI}`])).textes).toEqual([
      MENTION_VOUS,
    ]);
  });
});

describe("un groupe où l'on mentionne le dirigeant", () => {
  it("le fil et l'aperçu se lisent par les noms ; la liste le marque tant qu'il n'est pas lu", async () => {
    const { db, channelId } = await compte();
    await noterIdentites(db, channelId, [
      { internalId: LID_MOI, isSelf: true },
      { internalId: LID_EYA, name: "Dahmani Eya" },
    ]);
    const recu = await recevoirWhatsAppEntrant(db, {
      channelId,
      externalId: "g1",
      externalThreadId: "chat-equipe",
      senderRaw: "+33612345678",
      senderName: "Dahmani Eya",
      isGroup: true,
      content: `@${LID_MOI} tu valides le planning ? cc @400000000000004`,
      mentionsSelf: true,
    });
    if (recu.ecartee) throw new Error("groupe écarté");
    const id = recu.message.conversationId;

    const ligne = (await listConversationItems(db)).items.find(
      (c) => c.id === id,
    );
    expect(ligne).toMatchObject({
      mentioned: true,
      preview: `${MENTION_VOUS} tu valides le planning ? cc @400000000000004`,
    });

    const fil = await getConversationThread(db, id);
    expect(fil.messages[0]?.content).toBe(
      `${MENTION_VOUS} tu valides le planning ? cc @400000000000004`,
    );
    expect(fil.unknownMentions).toEqual(["400000000000004"]);
    // Le texte stocké, lui, n'a pas bougé.
    expect(
      (
        await prisma.message.findUniqueOrThrow({
          where: { id: recu.message.id },
        })
      ).content,
    ).toContain(`@${LID_MOI}`);

    // Relvo, lui aussi, lit des noms : c'est « @vous » qui lui dit que le
    // dirigeant est interpellé (M29.4).
    const projection = await getTriageProjection(db, id);
    expect(projection.conversation.messages[0]?.contenu).toContain(
      MENTION_VOUS,
    );
    expect(projection.dernierEntrant?.contenu).toContain(MENTION_VOUS);

    await prisma.message.update({
      where: { id: recu.message.id },
      data: { readAt: new Date() },
    });
    expect(
      (await listConversationItems(db)).items.find((c) => c.id === id)
        ?.mentioned,
    ).toBe(false);
  });
});

// LA RÉPONSE AU DIRIGEANT (M29.7) : dans un groupe, citer un message du
// dirigeant pour y répondre vaut mention. Ce que ces tests tiennent : l'extrait
// est borné ; la tête s'écrit à la lecture, à la lettre (le contexte du modèle
// la reconnaît ainsi) ; le message noté est marqué comme une mention, pour la
// liste, le fil et Relvo ; et « un envoi du dirigeant » se reconnaît à ce que
// Relvo a vu partir.
describe("un groupe où l'on répond au dirigeant", () => {
  it("l'extrait cité tient en une ligne, bornée", () => {
    expect(extraitCite("  Tu peux\n m'envoyer   le devis ? ")).toBe(
      "Tu peux m'envoyer le devis ?",
    );
    expect(extraitCite(null)).toBe("");
    const long = extraitCite("a".repeat(EXTRAIT_CITE_MAX + 50));
    expect(long).toHaveLength(EXTRAIT_CITE_MAX);
    expect(long.endsWith("…")).toBe(true);
  });

  it("la tête s'écrit à la lecture — et seulement quand on répond au dirigeant", () => {
    expect(avecLaCitation("Oui, demain", "Tu peux m'envoyer le devis ?")).toBe(
      "↪ En réponse à @vous (« Tu peux m'envoyer le devis ? »)\nOui, demain",
    );
    // Le message cité n'avait pas de texte (une photo) ; la réponse non plus.
    expect(avecLaCitation("Reçu", "")).toBe("↪ En réponse à @vous\nReçu");
    expect(avecLaCitation(null, "")).toBe("↪ En réponse à @vous");
    expect(avecLaCitation("Bonjour", null)).toBe("Bonjour");
    expect(avecLaCitation(null, undefined)).toBe("");
  });

  it("le message noté vaut mention : la liste le marque, le fil et Relvo lisent ce qu'il cite", async () => {
    const { db, channelId } = await compte();
    const recu = await recevoirWhatsAppEntrant(db, {
      channelId,
      externalId: "r1",
      externalThreadId: "chat-chantier",
      senderRaw: "+33612345678",
      senderName: "Dahmani Eya",
      isGroup: true,
      content: "Oui, je te l'envoie ce soir",
    });
    if (recu.ecartee) throw new Error("groupe écarté");
    const id = recu.message.conversationId;
    expect(
      (await listConversationItems(db)).items.find((c) => c.id === id)
        ?.mentioned,
    ).toBe(false);

    expect(
      await noterReponseAuDirigeant(
        db,
        recu.message.id,
        "Tu peux m'envoyer\nle devis ?",
      ),
    ).toBe(true);
    // Une seconde fois : déjà noté, rien ne bouge.
    expect(await noterReponseAuDirigeant(db, recu.message.id, "Autre")).toBe(
      false,
    );

    const stocke = await prisma.message.findUniqueOrThrow({
      where: { id: recu.message.id },
    });
    expect(stocke).toMatchObject({
      mentionsSelf: true,
      quotedSelfText: "Tu peux m'envoyer le devis ?",
      // Le texte stocké, lui, n'a pas bougé.
      content: "Oui, je te l'envoie ce soir",
    });
    expect(
      (await listConversationItems(db)).items.find((c) => c.id === id)
        ?.mentioned,
    ).toBe(true);

    const lu =
      "↪ En réponse à @vous (« Tu peux m'envoyer le devis ? »)\nOui, je te l'envoie ce soir";
    expect((await getConversationThread(db, id)).messages[0]?.content).toBe(lu);
    const projection = await getTriageProjection(db, id);
    expect(projection.conversation.messages[0]?.contenu).toBe(lu);
    expect(projection.dernierEntrant?.contenu).toBe(lu);
  });

  it("un envoi du dirigeant se reconnaît à ce que Relvo a vu partir ; son propre message ne se note pas", async () => {
    const { db, channelId } = await compte();
    const recu = await recevoirWhatsAppEntrant(db, {
      channelId,
      externalId: "e-entrant",
      externalThreadId: "chat-equipe-2",
      senderRaw: "+33612345678",
      isGroup: true,
      content: "On démarre à quelle heure ?",
    });
    if (recu.ecartee) throw new Error("groupe écarté");
    const envoi = await recevoirWhatsAppSortant(db, {
      channelId,
      externalId: "e-sortant",
      externalThreadId: "chat-equipe-2",
      content: "7 h sur place",
    });
    if (envoi.ecartee || !envoi.message) throw new Error("envoi non entré");

    expect(await estUnEnvoiDuDirigeant(db, "e-sortant")).toBe(true);
    expect(await estUnEnvoiDuDirigeant(db, "e-entrant")).toBe(false);
    expect(await estUnEnvoiDuDirigeant(db, "inconnu")).toBe(false);
    expect(await estUnEnvoiDuDirigeant(db, null)).toBe(false);

    // Le dirigeant qui se cite lui-même ne se mentionne pas.
    expect(await noterReponseAuDirigeant(db, envoi.message.id, "x")).toBe(
      false,
    );
  });
});
