import { Prisma } from "../generated/prisma/client";
import { prisma } from "../index";

// LA MESURE DU STOCKAGE (M25.1) — ce que la BASE sait de ce qui est stocké :
// le poids des pièces jointes par compte, par canal, par famille de type, et
// selon ce qui les tient (un sujet, rien, une conversation ignorée). C'est la
// moitié de la mesure : l'autre est le bucket lu chez le fournisseur, que
// l'application rapproche de celle-ci (`server/stockage-mesure.ts`) — ce que
// le bucket porte et que la base ne connaît plus est ce que la suppression a
// laissé derrière elle.
//
// Cross-tenant par construction, comme le reste du backoffice (`./admin`) : ces
// fonctions ne sont appelées que derrière `requireAdmin`. Elles ne rendent que
// des comptes et des clés, jamais un contenu.

/** La famille d'un type de fichier — ce que la politique des médias distingue (M25.3). */
export type FamilleDePiece = "video" | "image" | "audio" | "pdf" | "autre";

export type PoidsDesPieces = {
  accountId: string;
  canal: "email" | "whatsapp";
  famille: FamilleDePiece;
  /** La pièce, ou son message, appartient à un sujet. */
  rattachee: boolean;
  /** Sa conversation est ignorée : c'est ce que la purge retire (M25.12). */
  ignoree: boolean;
  /** FICHIERS stockés — un fichier que plusieurs pièces partagent compte une fois — et leur poids. */
  pieces: number;
  octets: number;
  /** Pièces stockées dont la taille n'est pas connue en base : leur poids n'est pas compté. */
  sansTaille: number;
  /**
   * Pièces gardées en RÉFÉRENCE (M25.3) : pas stockées, relisibles chez le
   * fournisseur — et le poids qu'il annonce, c'est-à-dire ce que le stockage
   * n'a pas eu à porter.
   */
  references: number;
  octetsAnnonces: number;
  /**
   * Pièces qui PARTAGENT le fichier d'une autre (M25.8) : stockées, mais leur
   * fichier est déjà compté — et le poids que la déduplication épargne ainsi.
   */
  partagees: number;
  octetsPartages: number;
};

/**
 * Le poids des pièces jointes, groupé par compte, canal, famille, et par ce
 * qui les tient. Une ligne par combinaison qui existe ; l'application en tire
 * les totaux qu'elle veut. `accountId` borne la mesure à un compte.
 */
export async function mesurerLesPieces(
  accountId?: string,
): Promise<PoidsDesPieces[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      account_id: string;
      canal: string;
      famille: FamilleDePiece;
      rattachee: boolean;
      ignoree: boolean;
      pieces: number;
      octets: bigint;
      sans_taille: number;
      refs: number;
      octets_annonces: bigint;
      partagees: number;
      octets_partages: bigint;
    }>
  >`
    WITH p AS (
      SELECT a.account_id, a.mime_type, a.file_size, a.storage_key, a.external_id,
             ch.type::text AS canal,
             (a.subject_id IS NOT NULL OR m.subject_id IS NOT NULL) AS rattachee,
             (c.status = 'ignored') AS ignoree,
             -- Un fichier que plusieurs pièces partagent (M25.8) ne pèse
             -- qu'UNE fois : il est compté chez celle qu'un sujet porte,
             -- sinon chez la plus ancienne.
             row_number() OVER (
               PARTITION BY a.account_id, COALESCE(a.storage_key, a.id::text)
               ORDER BY (a.subject_id IS NOT NULL OR m.subject_id IS NOT NULL) DESC,
                        a.created_at, a.id
             ) AS rang
      FROM attachments a
      JOIN messages m ON m.id = a.message_id
      JOIN conversations c ON c.id = m.conversation_id
      JOIN channels ch ON ch.id = m.channel_id
      ${accountId ? Prisma.sql`WHERE a.account_id = ${accountId}::uuid` : Prisma.empty}
    )
    SELECT account_id,
           canal,
           CASE
             WHEN mime_type LIKE 'video/%' THEN 'video'
             WHEN mime_type LIKE 'image/%' THEN 'image'
             WHEN mime_type LIKE 'audio/%' THEN 'audio'
             WHEN mime_type = 'application/pdf' THEN 'pdf'
             ELSE 'autre'
           END AS famille,
           rattachee,
           ignoree,
           (count(*) FILTER (WHERE storage_key IS NOT NULL AND rang = 1))::int AS pieces,
           COALESCE(sum(file_size) FILTER (WHERE storage_key IS NOT NULL AND rang = 1), 0)::bigint AS octets,
           (count(*) FILTER (WHERE storage_key IS NOT NULL AND rang = 1 AND file_size IS NULL))::int AS sans_taille,
           (count(*) FILTER (WHERE storage_key IS NULL AND external_id IS NOT NULL))::int AS refs,
           COALESCE(sum(file_size) FILTER (WHERE storage_key IS NULL AND external_id IS NOT NULL), 0)::bigint AS octets_annonces,
           (count(*) FILTER (WHERE storage_key IS NOT NULL AND rang > 1))::int AS partagees,
           COALESCE(sum(file_size) FILTER (WHERE storage_key IS NOT NULL AND rang > 1), 0)::bigint AS octets_partages
    FROM p
    GROUP BY 1, 2, 3, 4, 5
    ORDER BY 1, 2, 3, 4, 5
  `;
  return rows.map((r) => ({
    accountId: r.account_id,
    canal: r.canal === "email" ? "email" : "whatsapp",
    famille: r.famille,
    rattachee: r.rattachee,
    ignoree: r.ignoree,
    pieces: r.pieces,
    octets: Number(r.octets),
    sansTaille: r.sans_taille,
    references: r.refs,
    octetsAnnonces: Number(r.octets_annonces),
    partagees: r.partagees,
    octetsPartages: Number(r.octets_partages),
  }));
}

/** Les fichiers de connaissances déposés, par compte : peu nombreux, mais ils pèsent aussi. */
export async function mesurerLesConnaissances(
  accountId?: string,
): Promise<{ accountId: string; fichiers: number; octets: number }[]> {
  const rows = await prisma.knowledgeDocument.groupBy({
    by: ["accountId"],
    where: { storageKey: { not: null }, ...(accountId ? { accountId } : {}) },
    _count: { _all: true },
    _sum: { fileSize: true },
  });
  return rows.map((r) => ({
    accountId: r.accountId,
    fichiers: r._count._all,
    octets: r._sum.fileSize ?? 0,
  }));
}

/**
 * Toutes les clés que la base connaît — pièces jointes et connaissances — et
 * celles que la file de suppression attend d'effacer. C'est ce que
 * l'application rapproche du listing du bucket : une clé du bucket qui n'est
 * ni dans l'une ni dans l'autre n'a plus de propriétaire.
 */
export async function listClesDuStockage(): Promise<{
  connues: string[];
  enAttente: string[];
}> {
  const [pieces, connaissances, enAttente] = await Promise.all([
    prisma.attachment.findMany({
      where: { storageKey: { not: null } },
      select: { storageKey: true },
    }),
    prisma.knowledgeDocument.findMany({
      where: { storageKey: { not: null } },
      select: { storageKey: true },
    }),
    prisma.pendingFileDeletion.findMany({ select: { storageKey: true } }),
  ]);
  return {
    connues: [
      ...pieces.map((p) => p.storageKey!),
      ...connaissances.map((k) => k.storageKey!),
    ],
    enAttente: enAttente.map((e) => e.storageKey),
  };
}

/**
 * Ce qu'UN compte fait peser sur le stockage, en octets : ses pièces — un
 * fichier partagé compté une fois — et ses connaissances. C'est la mesure du
 * QUOTA (M25.7) : une requête, lue à chaque fois qu'une pièce va se stocker
 * d'elle-même.
 */
export async function poidsStockeDuCompte(accountId: string): Promise<number> {
  const [pieces] = await prisma.$queryRaw<Array<{ octets: bigint }>>`
    SELECT COALESCE(sum(taille), 0)::bigint AS octets
    FROM (
      SELECT max(file_size) AS taille
      FROM attachments
      WHERE account_id = ${accountId}::uuid AND storage_key IS NOT NULL
      GROUP BY storage_key
    ) f
  `;
  const connaissances = await prisma.knowledgeDocument.aggregate({
    where: { accountId, storageKey: { not: null } },
    _sum: { fileSize: true },
  });
  return Number(pieces?.octets ?? 0) + (connaissances._sum.fileSize ?? 0);
}
