import { describe, expect, it } from "vitest";
import {
  EVENT_TYPES,
  createAttachment,
  createDocument,
  createFolder,
  createSubjectFromMessage,
  dedoublonnerLeCompte,
  deleteAttachment,
  drainFileDeletions,
  estUneEmpreinte,
  ingestInboundWhatsApp,
  mesurerLesPieces,
  noterPieceStockee,
  planDeDeduplication,
  poidsStockeDuCompte,
  prisma,
  tenantDb,
  trouverCleDeMemeContenu,
} from "../src/index";

// LA DÉDUPLICATION (M25.8). Ce que ce fichier tient : un même contenu n'a
// qu'UN fichier par compte — jamais d'un compte à l'autre ; le filet du matin
// rapproche ce qui s'est croisé à l'entrée, d'après les empreintes en base,
// sans toucher à ce dont il doute ; chaque pièce garde un fichier ; un fichier
// partagé ne part qu'avec sa DERNIÈRE pièce ; et il ne pèse qu'une fois, dans
// la mesure comme dans le quota.

const H1 = "0123456789abcdef0123456789abcdef";
const H2 = "fedcba9876543210fedcba9876543210";

let n = 0;
async function compte() {
  n += 1;
  const account = await prisma.account.create({
    data: {
      email: `dedup-${n}-${Date.now()}@relvo.test`,
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
async function message(c: Compte, chat = "fil") {
  m += 1;
  const { message } = await ingestInboundWhatsApp(c.db, {
    channelId: c.wa.id,
    externalId: `dd-${m}-${Math.random()}`,
    externalThreadId: `${chat}-${c.accountId}`,
    senderRaw: "+33612345678",
    content: "Voilà",
  });
  return message;
}

const cle = (c: Compte, nom: string) =>
  `accounts/${c.accountId}/attachments/${nom}`;

async function piece(
  c: Compte,
  messageId: string,
  nom: string,
  opts: { taille?: number; hash?: string | null; depuis?: Date } = {},
) {
  const a = await createAttachment(c.db, {
    messageId,
    name: nom,
    mimeType: "application/pdf",
    storageKey: cle(c, nom),
    fileSize: opts.taille ?? 1_000,
    contentHash: opts.hash ?? null,
  });
  if (opts.depuis) {
    await prisma.attachment.update({
      where: { id: a.id },
      data: { createdAt: opts.depuis },
    });
  }
  return a;
}

const clesDe = async (c: Compte) =>
  (
    await c.db.attachment.findMany({
      orderBy: { name: "asc" },
      select: { name: true, storageKey: true, contentHash: true },
    })
  ).map(
    (a) =>
      `${a.name}→${a.storageKey?.split("/").pop()}#${a.contentHash?.slice(0, 4) ?? "-"}`,
  );

describe("le plan de déduplication", () => {
  const p = (
    storageKey: string,
    jour: number,
    contentHash: string | null = H1,
    fileSize: number | null = 500,
  ) => ({
    storageKey,
    contentHash,
    fileSize,
    createdAt: new Date(2026, 0, jour),
  });

  it("garde la clé la plus ancienne de chaque contenu, et compte ce qui part", () => {
    const plan = planDeDeduplication([
      p("b", 2),
      p("a", 1),
      p("c", 3),
      p("c", 4),
      p("seul", 5, H2),
    ]);
    expect(plan.groupes).toEqual([
      { garde: "a", abandonnees: ["b", "c"], octets: 1_000 },
    ]);
    expect(plan.piecesRepointees).toBe(3);
    expect(plan.fichiersLiberes).toBe(2);
    expect(plan.octetsLiberes).toBe(1_000);
  });

  it("ne rapproche ni deux poids différents, ni une pièce sans empreinte, ni une empreinte composite", () => {
    const plan = planDeDeduplication([
      p("a", 1),
      p("b", 2, H1, 501),
      p("sans-1", 3, null),
      p("sans-2", 4, null),
      p("parts-1", 5, `${H1}-3`, 900),
      p("parts-2", 6, `${H1}-3`, 900),
      p("sans-poids", 7, H1, null),
    ]);
    expect(plan.groupes).toEqual([]);
  });

  it("laisse où elle est une clé dont les pièces ne disent pas la même chose", () => {
    const plan = planDeDeduplication([
      p("a", 1),
      p("douteuse", 2),
      p("douteuse", 3, H2),
      p("b", 4),
    ]);
    // « douteuse » a une pièce qui dit H1 et une qui dit H2 : elle ne bouge pas.
    expect(plan.groupes).toEqual([
      { garde: "a", abandonnees: ["b"], octets: 500 },
    ]);
  });

  it("reconnaît une empreinte", () => {
    expect(estUneEmpreinte(H1)).toBe(true);
    expect(estUneEmpreinte(`${H1}-2`)).toBe(false);
    expect(estUneEmpreinte(H1.toUpperCase())).toBe(false);
    expect(estUneEmpreinte(null)).toBe(false);
  });
});

describe("à l'entrée : le compte a-t-il déjà ce fichier ?", () => {
  it("rend la clé la plus ancienne du même contenu — même empreinte ET même poids, même compte", async () => {
    const c = await compte();
    const autre = await compte();
    const msg = await message(c);
    await piece(c, msg.id, "recent", {
      hash: H1,
      depuis: new Date(Date.now() - 1_000),
    });
    await piece(c, msg.id, "ancien", {
      hash: H1,
      depuis: new Date(Date.now() - 60_000),
    });
    await piece(autre, (await message(autre)).id, "ailleurs", { hash: H2 });

    expect(
      await trouverCleDeMemeContenu(c.db, { contentHash: H1, fileSize: 1_000 }),
    ).toBe(cle(c, "ancien"));
    // Un autre poids, une autre empreinte, un autre compte : rien.
    expect(
      await trouverCleDeMemeContenu(c.db, { contentHash: H1, fileSize: 999 }),
    ).toBeNull();
    expect(
      await trouverCleDeMemeContenu(c.db, { contentHash: H2, fileSize: 1_000 }),
    ).toBeNull();
    expect(
      await trouverCleDeMemeContenu(c.db, {
        contentHash: "pas-une-empreinte",
        fileSize: 1_000,
      }),
    ).toBeNull();
  });

  it("une référence complétée note son empreinte", async () => {
    const c = await compte();
    const msg = await message(c);
    const ref = await createAttachment(c.db, {
      messageId: msg.id,
      name: "photo",
      mimeType: "image/jpeg",
      externalId: "x",
    });
    await noterPieceStockee(c.db, ref.id, {
      storageKey: cle(c, "photo"),
      fileSize: 77,
      mimeType: "image/jpeg",
      contentHash: H2,
    });
    expect(
      await trouverCleDeMemeContenu(c.db, { contentHash: H2, fileSize: 77 }),
    ).toBe(cle(c, "photo"));
  });
});

describe("le filet : rapprocher ce qui s'est croisé à l'entrée", () => {
  // Trois exemplaires du même devis, entrés sans se voir ; un plan, seul de
  // son contenu ; une pièce d'avant les empreintes ; et un voisin qui a le
  // même devis.
  async function stock() {
    const c = await compte();
    const voisin = await compte();
    const msg = await message(c);
    const jour = (j: number) => new Date(Date.now() - j * 86_400_000);
    const devis = { taille: 4_000, hash: H1 };
    await piece(c, msg.id, "devis-1", { ...devis, depuis: jour(9) });
    await piece(c, msg.id, "devis-2", { ...devis, depuis: jour(5) });
    await piece(c, msg.id, "devis-3", { ...devis, depuis: jour(1) });
    await piece(c, msg.id, "plan", {
      taille: 9_000,
      hash: H2,
      depuis: jour(3),
    });
    await piece(c, msg.id, "sans-empreinte", {
      taille: 4_000,
      depuis: jour(2),
    });
    await piece(voisin, (await message(voisin)).id, "devis-voisin", devis);
    return { c, voisin };
  }

  it("fait pointer les doublons sur le plus ancien, met les autres en file — et laisse le voisin", async () => {
    const { c, voisin } = await stock();
    const enFileAvant = await prisma.pendingFileDeletion.count();
    expect(await dedoublonnerLeCompte(c.accountId)).toEqual({
      piecesRepointees: 2,
      fichiersLiberes: 2,
      octetsLiberes: 8_000,
    });
    expect(await clesDe(c)).toEqual([
      "devis-1→devis-1#0123",
      "devis-2→devis-1#0123",
      "devis-3→devis-1#0123",
      "plan→plan#fedc",
      "sans-empreinte→sans-empreinte#-",
    ]);
    expect(await clesDe(voisin)).toEqual(["devis-voisin→devis-voisin#0123"]);

    const enFile = await prisma.pendingFileDeletion.findMany({
      orderBy: { id: "desc" },
      take: 2,
      select: { storageKey: true },
    });
    expect(await prisma.pendingFileDeletion.count()).toBe(enFileAvant + 2);
    expect(enFile.map((e) => e.storageKey).sort()).toEqual([
      cle(c, "devis-2"),
      cle(c, "devis-3"),
    ]);
    expect(
      await c.db.eventLog.count({
        where: { eventType: EVENT_TYPES.deduplication },
      }),
    ).toBe(1);

    // Rejoué, il ne trouve plus rien — et n'écrit pas une seconde entrée.
    expect(await dedoublonnerLeCompte(c.accountId)).toEqual({
      piecesRepointees: 0,
      fichiersLiberes: 0,
      octetsLiberes: 0,
    });
    expect(
      await c.db.eventLog.count({
        where: { eventType: EVENT_TYPES.deduplication },
      }),
    ).toBe(1);
  });

  it("garde la clé que l'entrée rendrait : les suivants convergent vers la même", async () => {
    const { c } = await stock();
    const avant = await trouverCleDeMemeContenu(c.db, {
      contentHash: H1,
      fileSize: 4_000,
    });
    await dedoublonnerLeCompte(c.accountId);
    expect(avant).toBe(cle(c, "devis-1"));
    expect(await c.db.attachment.count({ where: { storageKey: avant } })).toBe(
      3,
    );
  });

  it("le fichier gardé ne part qu'avec sa dernière pièce", async () => {
    const { c } = await stock();
    await dedoublonnerLeCompte(c.accountId);
    const effaces: string[] = [];
    const storage = { delete: async (key: string) => void effaces.push(key) };
    await drainFileDeletions(storage, { budgetMs: 5_000 });
    // Les deux exemplaires abandonnés partent ; le gardé reste.
    expect(effaces.filter((k) => k.includes(c.accountId)).sort()).toEqual([
      cle(c, "devis-2"),
      cle(c, "devis-3"),
    ]);

    const [un, deux, trois] = await c.db.attachment.findMany({
      where: { storageKey: cle(c, "devis-1") },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    effaces.length = 0;
    await deleteAttachment(c.db, un!.id);
    await deleteAttachment(c.db, deux!.id);
    await drainFileDeletions(storage, { budgetMs: 5_000 });
    expect(effaces).not.toContain(cle(c, "devis-1"));
    await deleteAttachment(c.db, trois!.id);
    await drainFileDeletions(storage, { budgetMs: 5_000 });
    expect(effaces).toContain(cle(c, "devis-1"));
  });
});

describe("un fichier partagé ne pèse qu'une fois", () => {
  it("dans la mesure — compté chez la pièce qu'un sujet porte — et dans le quota", async () => {
    const c = await compte();
    const libre = await message(c, "libre");
    const porte = await message(c, "porte");
    await createSubjectFromMessage(c.db, porte.id, { title: "Chantier" });
    const partagee = cle(c, "commun");
    for (const messageId of [libre.id, porte.id, libre.id]) {
      await createAttachment(c.db, {
        messageId,
        name: "plan.pdf",
        mimeType: "application/pdf",
        storageKey: partagee,
        fileSize: 6_000,
        contentHash: H1,
      });
    }
    await piece(c, libre.id, "seul", { taille: 1_500 });

    const lignes = await mesurerLesPieces(c.accountId);
    const tenue = lignes.find((l) => l.rattachee)!;
    const libres = lignes.find((l) => !l.rattachee)!;
    expect(tenue).toMatchObject({ pieces: 1, octets: 6_000, partagees: 0 });
    expect(libres).toMatchObject({
      pieces: 1,
      octets: 1_500,
      partagees: 2,
      octetsPartages: 12_000,
    });
    expect(await poidsStockeDuCompte(c.accountId)).toBe(7_500);
  });

  it("le quota compte aussi les connaissances, et rien d'un autre compte", async () => {
    const c = await compte();
    const autre = await compte();
    await piece(c, (await message(c)).id, "a", { taille: 2_000 });
    await piece(autre, (await message(autre)).id, "b", { taille: 50_000 });
    await prisma.folder.create({
      data: {
        accountId: c.accountId,
        name: "Général",
        slug: "general",
        isDefault: true,
      },
    });
    const dossier = await createFolder(c.db, { name: "Fournisseurs" });
    await createDocument(c.db, {
      folderId: dossier.id,
      name: "Carte",
      mimeType: "application/pdf",
      storageKey: `accounts/${c.accountId}/knowledge/carte`,
      fileSize: 300,
    });
    expect(await poidsStockeDuCompte(c.accountId)).toBe(2_300);
  });
});
