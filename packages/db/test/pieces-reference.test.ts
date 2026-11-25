import { describe, expect, it } from "vitest";
import {
  EVENT_TYPES,
  createAttachment,
  createSubject,
  createSubjectFromMessage,
  deleteAttachment,
  etatDePiece,
  getConversationThread,
  getPieceARelire,
  getSubjectDetail,
  ingestInboundWhatsApp,
  listClesDuStockage,
  listPiecesACompleter,
  mesurerLesPieces,
  noterPieceIndisponible,
  noterPieceStockee,
  nettoyerLeCompte,
  prisma,
  simulerLeNettoyage,
  tenantDb,
} from "../src/index";

// UNE PIÈCE N'EST PAS TOUJOURS STOCKÉE (M25.3, M25.5). Ce que ce fichier
// tient : une pièce entre comme fichier, comme RÉFÉRENCE ou comme TRACE ; une
// référence devient un fichier une fois, pas deux ; ce qu'un sujet porte est
// ce que la complétion va chercher — sous le plafond de sa famille, et jamais
// ce que la source ne sert plus ; la mesure et la file de suppression ne
// comptent que ce qui est stocké ; et un fil montre l'état de chaque pièce
// sans jamais rendre sa clé.

const PLAFONDS = {
  video: 64_000_000,
  image: 10_000_000,
  audio: 5_000_000,
  autre: 20_000_000,
};

let n = 0;
async function compte() {
  n += 1;
  const account = await prisma.account.create({
    data: {
      email: `reference-${n}-${Date.now()}@relvo.test`,
      firstName: "Test",
      lastName: "User",
    },
  });
  const wa = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "WhatsApp",
      type: "whatsapp",
      identifier: "+33600000000",
    },
  });
  return { accountId: account.id, wa, db: tenantDb(account.id) };
}
type Compte = Awaited<ReturnType<typeof compte>>;

let m = 0;
async function message(c: Compte, chat = "fil-1") {
  m += 1;
  const { message } = await ingestInboundWhatsApp(c.db, {
    channelId: c.wa.id,
    externalId: `msg-${m}-${Math.random()}`,
    externalThreadId: `${chat}-${c.accountId}`,
    senderRaw: "+33612345678",
    content: "Regarde",
  });
  return message;
}

describe("l'état d'une pièce", () => {
  it("se lit de sa clé, de sa source et de ce que la source a répondu", () => {
    const rien = { storageKey: null, externalId: null, unavailableAt: null };
    expect(etatDePiece({ ...rien, storageKey: "k" })).toBe("stockee");
    expect(etatDePiece({ ...rien, externalId: "a" })).toBe("reference");
    expect(
      etatDePiece({ ...rien, externalId: "a", unavailableAt: new Date() }),
    ).toBe("indisponible");
    expect(etatDePiece(rien)).toBe("trace");
    // Stockée l'emporte : ce que la source a pu dire depuis n'y change rien.
    expect(
      etatDePiece({
        storageKey: "k",
        externalId: "a",
        unavailableAt: new Date(),
      }),
    ).toBe("stockee");
  });
});

describe("une pièce gardée en référence", () => {
  it("entre sans clé, avec sa source, son poids annoncé et sa vignette", async () => {
    const c = await compte();
    const msg = await message(c);
    const ref = await createAttachment(c.db, {
      messageId: msg.id,
      name: "vidéo",
      mimeType: "video/mp4",
      externalId: "att-1",
      fileSize: 4_455_888,
      thumbnail: "/9j/4AAQ",
    });
    expect(ref.storageKey).toBeNull();
    expect(etatDePiece(ref)).toBe("reference");

    const relire = await getPieceARelire(c.db, ref.id);
    expect(relire).toMatchObject({
      accountId: c.accountId,
      externalId: "att-1",
      messageExternalId: msg.externalId,
      storageKey: null,
    });

    // Le fil la montre avec son état, jamais avec sa clé.
    const fil = await getConversationThread(c.db, msg.conversationId);
    const [piece] = fil!.messages[0]!.attachments;
    expect(piece).toEqual({
      id: ref.id,
      name: "vidéo",
      label: null,
      mimeType: "video/mp4",
      etat: "reference",
      vignette: "/9j/4AAQ",
      taille: 4_455_888,
    });
  });

  it("devient un fichier une fois — la seconde lecture perd", async () => {
    const c = await compte();
    const msg = await message(c);
    const ref = await createAttachment(c.db, {
      messageId: msg.id,
      name: "photo",
      mimeType: "image/jpeg",
      externalId: "att-2",
      fileSize: 70_000,
    });
    const premiere = await noterPieceStockee(c.db, ref.id, {
      storageKey: `accounts/${c.accountId}/attachments/a`,
      fileSize: 70_180,
      mimeType: "image/jpeg",
    });
    expect(premiere).toEqual({
      gagne: true,
      storageKey: `accounts/${c.accountId}/attachments/a`,
    });
    const seconde = await noterPieceStockee(c.db, ref.id, {
      storageKey: `accounts/${c.accountId}/attachments/b`,
      fileSize: 70_180,
      mimeType: "image/jpeg",
    });
    expect(seconde).toEqual({
      gagne: false,
      storageKey: `accounts/${c.accountId}/attachments/a`,
    });
    const apres = await getPieceARelire(c.db, ref.id);
    expect(apres?.fileSize).toBe(70_180);
    const journal = await c.db.eventLog.count({
      where: { entityId: ref.id, eventType: EVENT_TYPES.attachmentStored },
    });
    expect(journal).toBe(1);
  });

  it("que la source ne sert plus est notée, une seule fois, et le reste jusqu'à ce qu'elle revienne", async () => {
    const c = await compte();
    const msg = await message(c);
    const ref = await createAttachment(c.db, {
      messageId: msg.id,
      name: "photo",
      mimeType: "image/jpeg",
      externalId: "att-3",
    });
    await noterPieceIndisponible(c.db, ref.id);
    await noterPieceIndisponible(c.db, ref.id);
    expect(etatDePiece((await getPieceARelire(c.db, ref.id))!)).toBe(
      "indisponible",
    );
    expect(
      await c.db.eventLog.count({
        where: {
          entityId: ref.id,
          eventType: EVENT_TYPES.attachmentUnavailable,
        },
      }),
    ).toBe(1);
    // Une lecture qui aboutit quand même efface la note.
    await noterPieceStockee(c.db, ref.id, {
      storageKey: `accounts/${c.accountId}/attachments/c`,
      fileSize: 10,
      mimeType: null,
    });
    const apres = await getPieceARelire(c.db, ref.id);
    expect(apres?.unavailableAt).toBeNull();
    expect(apres?.mimeType).toBe("image/jpeg");
  });

  it("ne met rien en file de suppression quand elle part", async () => {
    const c = await compte();
    const msg = await message(c);
    const ref = await createAttachment(c.db, {
      messageId: msg.id,
      name: "vidéo",
      mimeType: "video/mp4",
      externalId: "att-4",
    });
    const trace = await createAttachment(c.db, {
      messageId: msg.id,
      name: "autocollant",
      mimeType: "image/webp",
    });
    const avant = await prisma.pendingFileDeletion.count();
    await deleteAttachment(c.db, ref.id);
    await deleteAttachment(c.db, trace.id);
    expect(await prisma.pendingFileDeletion.count()).toBe(avant);
  });
});

describe("ce que la complétion va chercher", () => {
  it("les références qu'un sujet porte — pas les autres, pas les traces, pas ce qui est stocké", async () => {
    const c = await compte();
    const libre = await message(c, "libre");
    const porte = await message(c, "porte");
    await createSubjectFromMessage(c.db, porte.id, { title: "Chantier" });

    await createAttachment(c.db, {
      messageId: libre.id,
      name: "photo",
      mimeType: "image/jpeg",
      externalId: "libre-1",
    });
    const attendue = await createAttachment(c.db, {
      messageId: porte.id,
      name: "photo",
      mimeType: "image/jpeg",
      externalId: "porte-1",
      fileSize: 80_000,
    });
    await createAttachment(c.db, {
      messageId: porte.id,
      name: "autocollant",
      mimeType: "image/webp",
    });
    await createAttachment(c.db, {
      messageId: porte.id,
      name: "plan.pdf",
      mimeType: "application/pdf",
      storageKey: `accounts/${c.accountId}/attachments/plan`,
      externalId: "porte-2",
    });

    const a = await listPiecesACompleter({
      accountId: c.accountId,
      plafonds: PLAFONDS,
      limite: 50,
    });
    expect(a.map((p) => p.id)).toEqual([attendue.id]);
    expect(a[0]).toMatchObject({
      externalId: "porte-1",
      messageExternalId: porte.externalId,
    });
  });

  it("laisse ce qui dépasse le plafond de sa famille, et ce que la source ne sert plus", async () => {
    const c = await compte();
    const msg = await message(c);
    await createSubjectFromMessage(c.db, msg.id, { title: "Sinistre" });
    const ref = (
      name: string,
      mimeType: string | null,
      fileSize: number | null,
    ) =>
      createAttachment(c.db, {
        messageId: msg.id,
        name,
        mimeType,
        externalId: `x-${name}`,
        fileSize,
      });
    await ref("photo trop lourde", "image/jpeg", PLAFONDS.image + 1);
    await ref("vocal trop long", "audio/ogg", PLAFONDS.audio + 1);
    await ref("archive trop lourde", "application/zip", PLAFONDS.autre + 1);
    const video = await ref("vidéo", "video/mp4", PLAFONDS.image + 1);
    const sansType = await ref("sans type", null, null);
    const perdue = await ref("perdue", "image/jpeg", 10);
    await noterPieceIndisponible(c.db, perdue.id);

    const a = await listPiecesACompleter({
      accountId: c.accountId,
      plafonds: PLAFONDS,
      limite: 50,
    });
    expect(a.map((p) => p.name).sort()).toEqual(["sans type", "vidéo"]);
    expect(a.map((p) => p.id).sort()).toEqual([video.id, sansType.id].sort());
  });

  it("sans compte, rend les références de tous — le filet des crons", async () => {
    const un = await compte();
    const deux = await compte();
    for (const c of [un, deux]) {
      const msg = await message(c);
      await createSubjectFromMessage(c.db, msg.id, { title: "Sujet" });
      await createAttachment(c.db, {
        messageId: msg.id,
        name: "photo",
        mimeType: "image/jpeg",
        externalId: `tous-${c.accountId}`,
      });
    }
    const tous = await listPiecesACompleter({
      plafonds: PLAFONDS,
      limite: 500,
    });
    const comptes = new Set(tous.map((p) => p.accountId));
    expect(comptes.has(un.accountId)).toBe(true);
    expect(comptes.has(deux.accountId)).toBe(true);
  });
});

describe("ce qui n'est pas stocké ne pèse pas", () => {
  it("la mesure compte les références à part, et la base ne rend que des clés", async () => {
    const c = await compte();
    const msg = await message(c);
    await createAttachment(c.db, {
      messageId: msg.id,
      name: "photo",
      mimeType: "image/jpeg",
      storageKey: `accounts/${c.accountId}/attachments/stockee`,
      fileSize: 1_000,
    });
    await createAttachment(c.db, {
      messageId: msg.id,
      name: "photo",
      mimeType: "image/jpeg",
      externalId: "ref-mesure",
      fileSize: 5_000,
    });
    await createAttachment(c.db, {
      messageId: msg.id,
      name: "autocollant",
      mimeType: "image/webp",
    });

    const lignes = await mesurerLesPieces(c.accountId);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({
      famille: "image",
      pieces: 1,
      octets: 1_000,
      sansTaille: 0,
      references: 1,
      octetsAnnonces: 5_000,
    });

    const { connues } = await listClesDuStockage();
    const lesMiennes = connues.filter((k) => k.includes(c.accountId));
    expect(lesMiennes).toEqual([`accounts/${c.accountId}/attachments/stockee`]);
    expect(connues.every((k) => typeof k === "string")).toBe(true);
  });

  it("une trace n'est pas un document du sujet", async () => {
    const c = await compte();
    const msg = await message(c);
    const sujet = await createSubject(c.db, { title: "Planning" });
    await c.db.message.updateMany({
      where: { id: msg.id },
      data: { subjectId: sujet.id },
    });
    await createAttachment(c.db, {
      messageId: msg.id,
      name: "GIF",
      mimeType: "video/mp4",
    });
    const ref = await createAttachment(c.db, {
      messageId: msg.id,
      name: "planning.pdf",
      mimeType: "application/pdf",
      externalId: "ref-doc",
    });
    const detail = await getSubjectDetail(c.db, sujet.id);
    expect(detail!.attachments.map((a) => a.id)).toEqual([ref.id]);
  });

  it("le nettoyage emporte une référence avec son message, sans la compter dans ce qu'il rend", async () => {
    const c = await compte();
    const { message: vieux } = await ingestInboundWhatsApp(c.db, {
      channelId: c.wa.id,
      externalId: `vieux-${Math.random()}`,
      externalThreadId: `vieux-${c.accountId}`,
      senderRaw: "+33612345678",
      content: "Il y a longtemps",
      receivedAt: new Date(Date.now() - 45 * 86_400_000),
    });
    await createAttachment(c.db, {
      messageId: vieux.id,
      name: "photo",
      mimeType: "image/jpeg",
      storageKey: `accounts/${c.accountId}/attachments/vieille`,
      fileSize: 2_000,
    });
    const ref = await createAttachment(c.db, {
      messageId: vieux.id,
      name: "vidéo",
      mimeType: "video/mp4",
      externalId: "ref-vieille",
      fileSize: 9_000_000,
    });
    const prevu = await simulerLeNettoyage(c.db);
    expect(prevu).toMatchObject({ messages: 1, pieces: 1, octets: 2_000 });
    const fait = await nettoyerLeCompte(c.db, c.accountId);
    expect(fait).toMatchObject({ messages: 1, pieces: 1, octets: 2_000 });
    expect(await getPieceARelire(c.db, ref.id)).toBeNull();
  });
});
