import { describe, expect, it } from "vitest";
import {
  ChannelType,
  ConversationStatus,
  ConversationType,
  assignMessageToSubject,
  conversationIdentity,
  countUnsortedConversations,
  createSubject,
  createSubjectFromMessage,
  detachMessage,
  getConversationThread,
  ignoreConversation,
  ingestInboundEmail,
  ingestInboundWhatsApp,
  listConversationItems,
  markConversationRead,
  prisma,
  reactivateConversation,
  resolveConversation,
  tenantDb,
} from "../src/index";

// Domaine Conversations (M6bis) — la couche de transport entre Message et
// Subject. Deux choses se testent ici, et elles sont de nature différente :
//
//   1. le TRI déterministe à la réception (clé canonique, find-or-create) ;
//   2. la FENÊTRE (`SubjectConversation`) : quels messages d'une conversation
//      appartiennent à un sujet, et jusqu'à quand.
//
// La 2e est ce qui a motivé le refactor : un fil WhatsApp direct porte plusieurs
// sujets à la fois, il fallait donc pouvoir les entrelacer sans que rattacher un
// message emporte tout le fil.

async function makeAccountWithChannels(email: string) {
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  const emailChannel = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "Boîte email",
      type: ChannelType.email,
      identifier: email,
    },
  });
  const waChannel = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "WhatsApp",
      type: ChannelType.whatsapp,
      identifier: "+33600000000",
    },
  });
  return { account, emailChannel, waChannel, db: tenantDb(account.id) };
}

// ─────────────────────────────────────────────────────────────
// 1. Clé canonique — fonction PURE, aucun accès base
// ─────────────────────────────────────────────────────────────

describe("conversationIdentity (clé canonique)", () => {
  const CHANNEL_ID = "00000000-0000-4000-8000-000000000001";

  it("email : préfixe Re: et casse ignorés → même clé", () => {
    const first = conversationIdentity({
      channelId: CHANNEL_ID,
      channelType: ChannelType.email,
      interlocutorRaw: "karim@sogood.fr",
      subjectLine: "Livraison sauce blanche",
    });
    const reply = conversationIdentity({
      channelId: CHANNEL_ID,
      channelType: ChannelType.email,
      interlocutorRaw: "Karim@SoGood.fr",
      subjectLine: "Re: Livraison  sauce blanche",
    });

    expect(first.type).toBe(ConversationType.email_subject);
    expect(first.key).toBe("email:karim@sogood.fr:livraison sauce blanche");
    // C'est TOUT l'enjeu : une réponse doit rejoindre le fil de son message de
    // départ, quelles que soient la casse et les décorations du client mail.
    expect(reply.key).toBe(first.key);
  });

  it("groupe WhatsApp : la clé porte le chat_id, pas l'expéditeur", () => {
    const identity = conversationIdentity({
      channelId: CHANNEL_ID,
      channelType: ChannelType.whatsapp,
      interlocutorRaw: "33600000020@s.whatsapp.net",
      externalThreadId: "group-xyz@g.us",
      isGroup: true,
      groupTitle: "Équipe Narbonne",
    });

    expect(identity.type).toBe(ConversationType.whatsapp_group);
    expect(identity.key).toBe("wa-group:group-xyz@g.us");
    expect(identity.title).toBe("Équipe Narbonne");
    // Un groupe n'a pas d'interlocuteur : il EST l'interlocuteur. Retenir
    // l'expéditeur du 1er message le ferait passer pour un fil direct avec lui.
    expect(identity.interlocutorRaw).toBeNull();
  });

  it("WhatsApp direct : la clé porte le numéro, pas le fil", () => {
    const identity = conversationIdentity({
      channelId: CHANNEL_ID,
      channelType: ChannelType.whatsapp,
      interlocutorRaw: "33612345678@s.whatsapp.net",
      externalThreadId: "chat-abc",
      isGroup: false,
    });

    expect(identity.type).toBe(ConversationType.whatsapp_direct);
    // Une SEULE conversation directe par contact, pour toujours — le chat_id
    // peut changer, le numéro non.
    expect(identity.key).toBe("wa-direct:33612345678@s.whatsapp.net");
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Find-or-create
// ─────────────────────────────────────────────────────────────

describe("resolveConversation", () => {
  it("est idempotent : deux appels de même clé → une seule conversation", async () => {
    const { emailChannel, db } =
      await makeAccountWithChannels("conv-idem@test.fr");
    const input = {
      channelId: emailChannel.id,
      channelType: ChannelType.email,
      interlocutorRaw: "karim@sogood.fr",
      subjectLine: "Livraison sauce blanche",
    };

    const first = await resolveConversation(db, input);
    const second = await resolveConversation(db, {
      ...input,
      // Une réponse : autre libellé d'objet, MÊME conversation.
      subjectLine: "Re: Livraison sauce blanche",
    });

    expect(second.id).toBe(first.id);
    expect(await db.conversation.count()).toBe(1);
  });

  it("un groupe WhatsApp n'a JAMAIS de contactId, même si on en propose un", async () => {
    const { waChannel, db } = await makeAccountWithChannels("conv-grp@test.fr");
    const contact = await db.contact.create({
      data: { firstName: "Karim", lastName: "Benali", sourceActor: "user" },
    });

    const created = await resolveConversation(db, {
      channelId: waChannel.id,
      channelType: ChannelType.whatsapp,
      interlocutorRaw: "33600000020@s.whatsapp.net",
      contactId: contact.id,
      externalThreadId: "group-xyz@g.us",
      isGroup: true,
    });
    expect(created.type).toBe(ConversationType.whatsapp_group);
    expect(created.contactId).toBeNull();

    // Ni à la création, ni plus tard par enrichissement.
    const again = await resolveConversation(db, {
      channelId: waChannel.id,
      channelType: ChannelType.whatsapp,
      interlocutorRaw: "33600000021@s.whatsapp.net",
      contactId: contact.id,
      externalThreadId: "group-xyz@g.us",
      isGroup: true,
    });
    expect(again.id).toBe(created.id);
    expect(again.contactId).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// 2bis. Nom et type d'un fil WhatsApp (M6bis.7)
// ─────────────────────────────────────────────────────────────

describe("nom de groupe WhatsApp (port d'annuaire)", () => {
  /** Faux annuaire : compte ses appels — c'est le vrai sujet du test. */
  function fakeDirectory(identity: { name: string | null; isGroup: boolean }) {
    const calls: string[] = [];
    return {
      calls,
      port: {
        async getChatIdentity(chatId: string) {
          calls.push(chatId);
          return identity;
        },
      },
    };
  }

  it("le nom récupéré remplace le placeholder, et un 2e message ne le rappelle pas", async () => {
    const { waChannel, db } = await makeAccountWithChannels("wa-grp@test.fr");
    const directory = fakeDirectory({ name: "Équipe Narbonne", isGroup: true });

    const first = await ingestInboundWhatsApp(
      db,
      {
        channelId: waChannel.id,
        externalId: "wa-grp-1",
        externalThreadId: "group-narbonne@g.us",
        senderRaw: "33600000020@s.whatsapp.net",
        // Le webhook ne dit RIEN de fiable : c'est `Chat.type` qui tranche.
        isGroup: false,
        content: "Le congélateur refait des siennes",
      },
      directory.port,
    );

    const created = await db.conversation.findFirstOrThrow({
      where: { id: first.message.conversationId },
    });
    expect(created.type).toBe(ConversationType.whatsapp_group);
    expect(created.title).toBe("Équipe Narbonne");
    expect(directory.calls).toEqual(["group-narbonne@g.us"]);

    // 2e message du MÊME fil : le nom est déjà connu → aucun appel réseau. C'est
    // la contrainte de conception, pas un détail de performance.
    await ingestInboundWhatsApp(
      db,
      {
        channelId: waChannel.id,
        externalId: "wa-grp-2",
        externalThreadId: "group-narbonne@g.us",
        senderRaw: "33600000021@s.whatsapp.net",
        isGroup: true,
        content: "J'appelle le technicien",
      },
      directory.port,
    );
    expect(directory.calls).toHaveLength(1);
  });

  it("un nom déjà obtenu n'est jamais écrasé par un nom plus récent", async () => {
    const { waChannel, db } = await makeAccountWithChannels("wa-grp2@test.fr");

    await resolveConversation(db, {
      channelId: waChannel.id,
      channelType: ChannelType.whatsapp,
      externalThreadId: "group-xyz@g.us",
      isGroup: true,
      groupTitle: "Équipe Narbonne",
    });

    const again = await resolveConversation(db, {
      channelId: waChannel.id,
      channelType: ChannelType.whatsapp,
      externalThreadId: "group-xyz@g.us",
      isGroup: true,
      groupTitle: "Autre nom",
    });
    // L'utilisateur a pu voir ce nom s'afficher : on ne le lui change pas sous
    // les yeux au gré d'un aller-retour réseau.
    expect(again.title).toBe("Équipe Narbonne");
  });

  it("annuaire en panne : le message est ingéré quand même", async () => {
    const { waChannel, db } = await makeAccountWithChannels("wa-grp3@test.fr");
    const port = {
      async getChatIdentity(): Promise<null> {
        throw new Error("Unipile indisponible");
      },
    };

    const { message, created } = await ingestInboundWhatsApp(
      db,
      {
        channelId: waChannel.id,
        externalId: "wa-grp-ko",
        externalThreadId: "group-ko@g.us",
        senderRaw: "33600000022@s.whatsapp.net",
        isGroup: true,
        content: "Livraison décalée",
      },
      port,
    );

    expect(created).toBe(true);
    const conversation = await db.conversation.findFirstOrThrow({
      where: { id: message.conversationId },
    });
    // Perdre le nom du groupe est un désagrément ; perdre le message serait une
    // faute. On retombe sur l'indice du webhook et le titre placeholder.
    expect(conversation.type).toBe(ConversationType.whatsapp_group);
    expect(conversation.title).toBe("Groupe WhatsApp");
  });
});

// ─────────────────────────────────────────────────────────────
// 3. La fenêtre — ouverture, entrelacement, glissement d'ancre
// ─────────────────────────────────────────────────────────────

describe("fenêtre de sujet sur une conversation (SubjectConversation)", () => {
  /** Ingère un message WhatsApp du même interlocuteur → même conversation. */
  function sendWa(
    db: ReturnType<typeof tenantDb>,
    channelId: string,
    externalId: string,
    content: string,
  ) {
    return ingestInboundWhatsApp(db, {
      channelId,
      externalId,
      externalThreadId: "chat-karim",
      senderRaw: "33600000010@s.whatsapp.net",
      content,
    });
  }

  it("ouvrir un sujet depuis le 2e message laisse le 1er hors du sujet", async () => {
    const { waChannel, db } = await makeAccountWithChannels("win-open@test.fr");
    const m1 = await sendWa(db, waChannel.id, "wa-1", "Bonjour");
    const m2 = await sendWa(db, waChannel.id, "wa-2", "Où en est la sauce ?");
    const m3 = await sendWa(db, waChannel.id, "wa-3", "Il m'en faut 40 bidons");
    expect(m1.message.conversationId).toBe(m3.message.conversationId);

    const subject = await createSubjectFromMessage(db, m2.message.id);

    const after = async (id: string) =>
      (await db.message.findFirst({ where: { id } }))?.subjectId ?? null;
    // La fenêtre s'ouvre À PARTIR de l'ancre : ce qui précède ne fait pas partie
    // du sujet — le fil existait avant que le sujet n'existe.
    expect(await after(m1.message.id)).toBeNull();
    expect(await after(m2.message.id)).toBe(subject.id);
    expect(await after(m3.message.id)).toBe(subject.id);

    const window = await db.subjectConversation.findFirst({
      where: { subjectId: subject.id },
    });
    expect(window?.anchorMessageId).toBe(m2.message.id);
  });

  it("entrelacement : rattacher un message au sujet A ne déplace pas la fenêtre du sujet B", async () => {
    const { waChannel, db } = await makeAccountWithChannels("win-mix@test.fr");

    // Fil direct de Karim : on y ouvre le sujet B (« sauce blanche »).
    const m1 = await sendWa(db, waChannel.id, "wa-b1", "La sauce blanche ?");
    const subjectB = await createSubjectFromMessage(db, m1.message.id);

    // Message suivant : capté par la fenêtre B (règle d'ancrage).
    const m2 = await sendWa(
      db,
      waChannel.id,
      "wa-b2",
      "Et la facture emballages",
    );
    expect(m2.message.subjectId).toBe(subjectB.id);

    // L'utilisateur corrige : ce message-là parlait d'un AUTRE sujet.
    const subjectA = await createSubject(db, {
      title: "Facture emballages",
      contactIds: [],
      createdByActor: "user",
    });
    await assignMessageToSubject(db, m2.message.id, subjectA.id);

    const m2After = await db.message.findFirst({
      where: { id: m2.message.id },
    });
    expect(m2After?.subjectId).toBe(subjectA.id);

    // La fenêtre active reste celle de B : rattacher un message est une
    // correction à la marge, pas une redirection du fil.
    const windows = await db.subjectConversation.findMany({
      where: { conversationId: m2.message.conversationId },
    });
    expect(windows).toHaveLength(1);
    expect(windows[0]?.subjectId).toBe(subjectB.id);
    expect(windows[0]?.anchorMessageId).toBe(m1.message.id);

    // Et la suite du fil retourne bien en B.
    const m3 = await sendWa(
      db,
      waChannel.id,
      "wa-b3",
      "Toujours pour la sauce",
    );
    expect(m3.message.subjectId).toBe(subjectB.id);
  });

  it("détacher l'ancre la fait glisser au message suivant ; détacher le dernier referme la fenêtre", async () => {
    const { waChannel, db } =
      await makeAccountWithChannels("win-anchor@test.fr");
    const m1 = await sendWa(db, waChannel.id, "wa-a1", "Premier");
    const subject = await createSubjectFromMessage(db, m1.message.id);
    const m2 = await sendWa(db, waChannel.id, "wa-a2", "Deuxième");
    expect(m2.message.subjectId).toBe(subject.id);

    // L'ancre part → la fenêtre ne peut pas rester accrochée à un message qui
    // n'appartient plus au sujet : elle glisse au suivant.
    await detachMessage(db, m1.message.id);
    const slid = await db.subjectConversation.findFirst({
      where: { subjectId: subject.id },
    });
    expect(slid?.anchorMessageId).toBe(m2.message.id);

    // Plus aucun message du sujet dans la conversation → la fenêtre disparaît,
    // et le fil redevient libre.
    await detachMessage(db, m2.message.id);
    expect(
      await db.subjectConversation.count({ where: { subjectId: subject.id } }),
    ).toBe(0);

    const m3 = await sendWa(db, waChannel.id, "wa-a3", "Troisième");
    expect(m3.message.subjectId).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// 4. KPI « Sans sujet » + ignorance
// ─────────────────────────────────────────────────────────────

describe("countUnsortedConversations (KPI « Sans sujet »)", () => {
  it("ne compte QUE les conversations dont le DERNIER message est sans sujet", async () => {
    const { emailChannel, db } =
      await makeAccountWithChannels("kpi-last@test.fr");
    const first = await ingestInboundEmail(db, {
      channelId: emailChannel.id,
      externalId: "kpi-1",
      senderRaw: "karim@sogood.fr",
      subjectLine: "Livraison sauce blanche",
      content: "Bonjour",
    });
    const second = await ingestInboundEmail(db, {
      channelId: emailChannel.id,
      externalId: "kpi-2",
      senderRaw: "karim@sogood.fr",
      subjectLine: "Re: Livraison sauce blanche",
      content: "Je relance",
    });
    expect(await countUnsortedConversations(db)).toBe(1);

    // ⚠️ EMAIL (M6ter) — le sujet EST le fil : ouvrir un sujet depuis N'IMPORTE
    // quel message d'un fil email balaie le fil ENTIER, amont compris. Le 1er
    // message rejoint donc le sujet lui aussi (fini le balayage partiel qui n'en
    // rattachait qu'un). Et la conversation sort du KPI « Sans sujet ».
    const subject = await createSubjectFromMessage(db, second.message.id);
    expect(
      (await db.message.findFirst({ where: { id: first.message.id } }))
        ?.subjectId,
    ).toBe(subject.id);
    expect(await countUnsortedConversations(db)).toBe(0);
  });

  it("ignorer une conversation la sort du KPI, la réactiver l'y remet", async () => {
    const { waChannel, db } = await makeAccountWithChannels("kpi-ign@test.fr");
    const { message } = await ingestInboundWhatsApp(db, {
      channelId: waChannel.id,
      externalId: "wa-bavard",
      externalThreadId: "group-bavard@g.us",
      senderRaw: "33600000030@s.whatsapp.net",
      isGroup: true,
      content: "🎉🎉🎉",
    });
    expect(await countUnsortedConversations(db)).toBe(1);

    // Remède au « groupe WhatsApp bavard » : Relvo cesse de le trier, mais les
    // messages continuent d'arriver et d'être stockés.
    const ignored = await ignoreConversation(db, message.conversationId);
    expect(ignored.status).toBe(ConversationStatus.ignored);
    expect(await countUnsortedConversations(db)).toBe(0);

    await reactivateConversation(db, message.conversationId);
    expect(await countUnsortedConversations(db)).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. Surface de tri /conversations — projection de liste et fil du cordon
// ─────────────────────────────────────────────────────────────

describe("liste et fil de la page /conversations", () => {
  it("liste : aperçu du dernier message, non-lus comptés et remontés en tête", async () => {
    const { emailChannel, waChannel, db } =
      await makeAccountWithChannels("ui-list@test.fr");

    // Conversation LA PLUS RÉCENTE, mais entièrement lue.
    const lue = await ingestInboundEmail(db, {
      channelId: emailChannel.id,
      externalId: "ui-lu-1",
      senderRaw: "sophie@tastycrousty.fr",
      subjectLine: "Congé maternité",
      content: "Bonjour, je vous confirme les dates.",
    });

    // Conversation plus ANCIENNE mais non lue : c'est elle qui doit passer
    // devant — le non-lu prime sur l'activité (M6bis.8).
    const nonLue = await ingestInboundWhatsApp(db, {
      channelId: waChannel.id,
      externalId: "ui-nonlu-1",
      externalThreadId: "chat-karim",
      senderRaw: "33600000010@s.whatsapp.net",
      content: "Où en est la   sauce ?",
    });
    await markConversationRead(db, lue.message.conversationId);
    // On force l'antériorité du fil non lu APRÈS coup : l'ingestion horodate
    // toutes les lignes à la même seconde dans un test.
    await prisma.conversation.update({
      where: { id: nonLue.message.conversationId },
      data: { lastMessageAt: new Date(Date.now() - 3_600_000) },
    });

    const page = await listConversationItems(db, { filter: "all" });
    expect(page.items.map((c) => c.id)).toEqual([
      nonLue.message.conversationId,
      lue.message.conversationId,
    ]);
    const [premier, second] = page.items;
    expect(premier!.unreadCount).toBe(1);
    // L'aperçu aplatit les blancs — une ligne de liste ne doit jamais hériter
    // de la mise en forme du corps du message.
    expect(premier!.preview).toBe("Où en est la sauce ?");
    expect(premier!.channelType).toBe(ChannelType.whatsapp);
    expect(second!.unreadCount).toBe(0);
    expect(second!.lastMessageSorted).toBe(false);

    // Filtre canal : le fil e-mail sort de la liste WhatsApp.
    const wa = await listConversationItems(db, {
      filter: "all",
      channelType: ChannelType.whatsapp,
    });
    expect(wa.items).toHaveLength(1);
  });

  it("fil : ordre chronologique et sujet par message (matière du cordon)", async () => {
    const { waChannel, db } = await makeAccountWithChannels("ui-fil@test.fr");
    const m1 = await ingestInboundWhatsApp(db, {
      channelId: waChannel.id,
      externalId: "fil-1",
      externalThreadId: "chat-karim",
      senderRaw: "33600000010@s.whatsapp.net",
      content: "Bonjour",
    });
    const m2 = await ingestInboundWhatsApp(db, {
      channelId: waChannel.id,
      externalId: "fil-2",
      externalThreadId: "chat-karim",
      senderRaw: "33600000010@s.whatsapp.net",
      content: "Où en est la sauce ?",
    });

    await createSubjectFromMessage(db, m2.message.id);

    const thread = await getConversationThread(db, m2.message.conversationId);
    // Chronologique (l'inverse de la pile /messages) : le plus ANCIEN d'abord.
    expect(thread.messages.map((m) => m.id)).toEqual([
      m1.message.id,
      m2.message.id,
    ]);
    // Le cordon se BRISE ici : un point creux (sans sujet) puis un point coloré.
    expect(thread.messages[0]!.subject).toBeNull();
    expect(thread.messages[1]!.subject?.id).toBeTruthy();
    expect(thread.channelType).toBe(ChannelType.whatsapp);
  });
});
