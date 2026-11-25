import { describe, expect, it } from "vitest";
import {
  createAttachment,
  createSubject,
  ignoreConversation,
  ingestInboundWhatsApp,
  listClesDuStockage,
  mesurerLesPieces,
  prisma,
  recevoirEmailEntrant,
  tenantDb,
} from "../src/index";

// LA MESURE DU STOCKAGE (M25.1). Ce que ce fichier tient : le poids des pièces
// se lit par compte, par canal, par famille de type et par ce qui les tient —
// un sujet, rien, une conversation ignorée ; une pièce sans taille est comptée
// à part ; et les clés que la base connaît, comme celles que la file attend
// d'effacer, sont rendues pour être rapprochées du bucket.

let n = 0;
async function compte() {
  n += 1;
  const email = `mesure-${n}-${Date.now()}@relvo.test`;
  const account = await prisma.account.create({
    data: { email, firstName: "Test", lastName: "User" },
  });
  const boite = await prisma.channel.create({
    data: {
      accountId: account.id,
      name: "Boîte",
      type: "email",
      identifier: email,
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
  return { accountId: account.id, email, boite, wa, db: tenantDb(account.id) };
}
type Compte = Awaited<ReturnType<typeof compte>>;

let k = 0;
async function piece(
  c: Compte,
  messageId: string,
  mimeType: string,
  fileSize: number | null,
) {
  k += 1;
  const storageKey = `accounts/${c.accountId}/attachments/mesure-${k}`;
  await createAttachment(c.db, {
    messageId,
    name: `piece-${k}`,
    mimeType,
    storageKey,
    fileSize: fileSize ?? undefined,
  });
  return storageKey;
}

async function courrier(c: Compte, objet: string) {
  const recu = await recevoirEmailEntrant(c.db, {
    channelId: c.boite.id,
    externalId: `${objet}-${Math.random()}`,
    senderRaw: `${objet.toLowerCase().replace(/\W/g, "")}@exemple.fr`,
    recipients: [c.email],
    subjectLine: objet,
    content: `Texte de ${objet}`,
  });
  if (recu.ecartee) throw new Error("fil écarté");
  return recu.message;
}

async function whatsapp(c: Compte, chat: string) {
  const { message } = await ingestInboundWhatsApp(c.db, {
    channelId: c.wa.id,
    externalId: `${chat}-${Math.random()}`,
    externalThreadId: chat,
    senderRaw: "+33612345678",
    content: "Regarde",
  });
  return message;
}

describe("mesurer les pièces", () => {
  it("groupe par canal, par famille et par ce qui tient la pièce", async () => {
    const c = await compte();
    const autre = await compte();

    // WhatsApp, sans sujet : une vidéo et deux photos.
    const chantier = await whatsapp(c, "chat-chantier");
    await piece(c, chantier.id, "video/mp4", 5_000_000);
    await piece(c, chantier.id, "image/jpeg", 300_000);
    await piece(c, chantier.id, "image/png", 200_000);
    // E-mail porté par un sujet : un PDF.
    const devis = await courrier(c, "Devis");
    const sujet = await createSubject(c.db, { title: "Devis hotte" });
    await prisma.message.update({
      where: { id: devis.id },
      data: { subjectId: sujet.id },
    });
    await piece(c, devis.id, "application/pdf", 80_000);
    // E-mail ignoré : un classeur, et une pièce dont la taille est inconnue.
    const promo = await courrier(c, "Promo");
    await piece(
      c,
      promo.id,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      40_000,
    );
    await piece(c, promo.id, "audio/ogg", null);
    await ignoreConversation(c.db, promo.conversationId);
    // Un autre compte : il ne se mêle pas au premier.
    const ailleurs = await courrier(autre, "Facture");
    await piece(autre, ailleurs.id, "application/pdf", 999);

    const lignes = await mesurerLesPieces(c.accountId);
    expect(lignes.every((l) => l.accountId === c.accountId)).toBe(true);
    const cle = (l: (typeof lignes)[number]) =>
      `${l.canal}/${l.famille}/${l.rattachee ? "sujet" : l.ignoree ? "ignoree" : "libre"}`;
    expect(
      Object.fromEntries(lignes.map((l) => [cle(l), [l.pieces, l.octets]])),
    ).toEqual({
      "whatsapp/video/libre": [1, 5_000_000],
      "whatsapp/image/libre": [2, 500_000],
      "email/pdf/sujet": [1, 80_000],
      "email/autre/ignoree": [1, 40_000],
      "email/audio/ignoree": [1, 0],
    });
    expect(lignes.find((l) => l.famille === "audio")?.sansTaille).toBe(1);

    // Sans compte : tous, dont l'autre.
    const tous = await mesurerLesPieces();
    expect(tous.find((l) => l.accountId === autre.accountId)).toMatchObject({
      canal: "email",
      famille: "pdf",
      octets: 999,
    });
  });
});

describe("les clés du stockage", () => {
  it("rend ce que la base connaît, et ce que la file attend d'effacer", async () => {
    const c = await compte();
    const promo = await courrier(c, "Promo");
    const gardee = await courrier(c, "Devis");
    const aPurger = await piece(c, promo.id, "image/jpeg", 1000);
    const aGarder = await piece(c, gardee.id, "application/pdf", 2000);

    let cles = await listClesDuStockage();
    expect(cles.connues).toEqual(expect.arrayContaining([aPurger, aGarder]));
    expect(cles.enAttente).not.toContain(aPurger);

    // Supprimer la pièce retire sa ligne : la clé passe de « connue » à
    // « en attente », jusqu'à ce que le drainage efface le fichier.
    await prisma.attachment.deleteMany({ where: { storageKey: aPurger } });
    cles = await listClesDuStockage();
    expect(cles.connues).toContain(aGarder);
    expect(cles.connues).not.toContain(aPurger);
    expect(cles.enAttente).toContain(aPurger);
  });
});
