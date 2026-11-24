import { describe, expect, it } from "vitest";
import {
  EVENT_TYPES,
  createAttachment,
  createSubject,
  ignoreConversation,
  prisma,
  purgerConversationIgnoree,
  reactivateConversation,
  recevoirEmailEntrant,
  stockIgnoreDuCompte,
  tenantDb,
  totalDuStock,
} from "../src/index";

// LE STOCK DÉJÀ IGNORÉ (M25.12). Ce que ce fichier tient : la purge ne retire
// que les pièces et la mise en forme des conversations IGNORÉES ; elle laisse
// le texte, tout ce qu'un sujet porte, et le HTML d'un message sans texte ; la
// simulation annonce exactement ce que le geste retire ; et le fichier part
// par la file de suppression, jamais par un appel au stockage.

let n = 0;
async function compte() {
  n += 1;
  const email = `stock-${n}-${Date.now()}@relvo.test`;
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
  return {
    accountId: account.id,
    email,
    channelId: channel.id,
    db: tenantDb(account.id),
  };
}

type Compte = Awaited<ReturnType<typeof compte>>;

/** Un e-mail reçu, avec sa mise en forme et, au besoin, des pièces. */
async function courrier(
  c: Compte,
  objet: string,
  opts: { texte?: string; pieces?: number[] } = {},
) {
  const recu = await recevoirEmailEntrant(c.db, {
    channelId: c.channelId,
    externalId: `${objet}-${Math.random()}`,
    senderRaw: `${objet.toLowerCase().replace(/\W/g, "")}@exemple.fr`,
    recipients: [c.email],
    subjectLine: objet,
    content: opts.texte ?? `Texte de ${objet}`,
    contentHtml: `<p><b>${objet}</b> mis en forme</p>`,
  });
  if (recu.ecartee) throw new Error("fil écarté");
  for (const [i, taille] of (opts.pieces ?? []).entries()) {
    await createAttachment(c.db, {
      messageId: recu.message.id,
      name: `piece-${i}.pdf`,
      storageKey: `accounts/${c.accountId}/${recu.message.id}/${i}.pdf`,
      fileSize: taille,
    });
  }
  return {
    messageId: recu.message.id,
    conversationId: recu.message.conversationId,
  };
}

const fileDAttente = () =>
  prisma.pendingFileDeletion
    .findMany({ orderBy: { id: "asc" } })
    .then((rows) => rows.map((r) => r.storageKey));

describe("mesurer le stock ignoré", () => {
  it("ne compte que les conversations ignorées, et rien de ce qui doit rester", async () => {
    const c = await compte();
    const pub = await courrier(c, "Promo", { pieces: [1000, 2000] });
    const vivant = await courrier(c, "Devis", { pieces: [5000] });
    const sansTexte = await courrier(c, "Image seule", { texte: "  " });
    await ignoreConversation(c.db, pub.conversationId, { actor: "ai" });
    await ignoreConversation(c.db, sansTexte.conversationId);

    const stock = await stockIgnoreDuCompte(c.accountId);
    // La conversation active n'y est pas ; celle dont le seul message n'a pas
    // de texte non plus — son HTML est tout ce qu'elle a.
    expect(stock.map((s) => s.conversationId)).toEqual([pub.conversationId]);
    expect(totalDuStock(stock)).toMatchObject({
      conversations: 1,
      pieces: 2,
      octets: 3000,
      messagesHtml: 1,
    });
    expect(stock[0].octetsHtml).toBeGreaterThan(0);
    expect(vivant.conversationId).not.toBe(pub.conversationId);
  });

  it("laisse ce qu'un sujet porte : le message couvert, la pièce rangée", async () => {
    const c = await compte();
    const fil = await courrier(c, "Litige", { pieces: [700] });
    const sujet = await createSubject(c.db, { title: "Litige fournisseur" });
    await prisma.message.update({
      where: { id: fil.messageId },
      data: { subjectId: sujet.id },
    });
    await ignoreConversation(c.db, fil.conversationId);

    expect(await stockIgnoreDuCompte(c.accountId)).toEqual([]);
    expect(
      await purgerConversationIgnoree(c.db, fil.conversationId),
    ).toBeNull();
    expect(
      await prisma.attachment.count({ where: { messageId: fil.messageId } }),
    ).toBe(1);
  });
});

describe("purger une conversation ignorée", () => {
  it("retire les pièces et le HTML, garde le texte, met les clés en file et le journalise", async () => {
    const c = await compte();
    const pub = await courrier(c, "Promo", { pieces: [1000, 2000] });
    await ignoreConversation(c.db, pub.conversationId, { actor: "ai" });
    const [annonce] = await stockIgnoreDuCompte(c.accountId);

    const bilan = await purgerConversationIgnoree(c.db, pub.conversationId);

    // Le geste retire exactement ce que la simulation annonçait.
    expect(bilan).toEqual({
      pieces: annonce.pieces,
      octets: annonce.octets,
      messagesHtml: annonce.messagesHtml,
    });
    const message = await prisma.message.findUniqueOrThrow({
      where: { id: pub.messageId },
    });
    expect(message.contentHtml).toBeNull();
    expect(message.content).toBe("Texte de Promo");
    expect(
      await prisma.attachment.count({ where: { messageId: pub.messageId } }),
    ).toBe(0);
    // Le fichier part par la file de suppression (M4.6), jamais d'ici.
    expect(await fileDAttente()).toEqual([
      `accounts/${c.accountId}/${pub.messageId}/0.pdf`,
      `accounts/${c.accountId}/${pub.messageId}/1.pdf`,
    ]);
    const journal = await prisma.eventLog.findFirstOrThrow({
      where: {
        entityId: pub.conversationId,
        eventType: EVENT_TYPES.conversationStockPurged,
      },
    });
    expect(journal.metadata).toEqual({
      pieces: 2,
      octets: 3000,
      messagesHtml: 1,
    });

    // Rejoué, le geste ne fait plus rien — et la simulation ne voit plus rien.
    expect(
      await purgerConversationIgnoree(c.db, pub.conversationId),
    ).toBeNull();
    expect(await stockIgnoreDuCompte(c.accountId)).toEqual([]);
  });

  it("ne touche pas une conversation réactivée entre la simulation et le geste", async () => {
    const c = await compte();
    const fil = await courrier(c, "Faux verdict", { pieces: [900] });
    await ignoreConversation(c.db, fil.conversationId, { actor: "ai" });
    expect(await stockIgnoreDuCompte(c.accountId)).toHaveLength(1);
    await reactivateConversation(c.db, fil.conversationId);

    expect(
      await purgerConversationIgnoree(c.db, fil.conversationId),
    ).toBeNull();
    expect(
      await prisma.attachment.count({ where: { messageId: fil.messageId } }),
    ).toBe(1);
    expect(
      (await prisma.message.findUniqueOrThrow({ where: { id: fil.messageId } }))
        .contentHtml,
    ).not.toBeNull();
  });

  it("ne voit que le compte demandé", async () => {
    const a = await compte();
    const b = await compte();
    const chezA = await courrier(a, "Promo A", { pieces: [100] });
    await ignoreConversation(a.db, chezA.conversationId);

    expect(await stockIgnoreDuCompte(b.accountId)).toEqual([]);
    expect(
      await purgerConversationIgnoree(b.db, chezA.conversationId),
    ).toBeNull();
    expect(
      await prisma.attachment.count({ where: { messageId: chezA.messageId } }),
    ).toBe(1);
  });
});
