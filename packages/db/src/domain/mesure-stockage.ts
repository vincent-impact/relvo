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
  pieces: number;
  octets: number;
  /** Pièces dont la taille n'est pas connue en base : leur poids n'est pas compté. */
  sansTaille: number;
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
    }>
  >`
    SELECT a.account_id,
           ch.type::text AS canal,
           CASE
             WHEN a.mime_type LIKE 'video/%' THEN 'video'
             WHEN a.mime_type LIKE 'image/%' THEN 'image'
             WHEN a.mime_type LIKE 'audio/%' THEN 'audio'
             WHEN a.mime_type = 'application/pdf' THEN 'pdf'
             ELSE 'autre'
           END AS famille,
           (a.subject_id IS NOT NULL OR m.subject_id IS NOT NULL) AS rattachee,
           (c.status = 'ignored') AS ignoree,
           count(*)::int AS pieces,
           COALESCE(sum(a.file_size), 0)::bigint AS octets,
           (count(*) FILTER (WHERE a.file_size IS NULL))::int AS sans_taille
    FROM attachments a
    JOIN messages m ON m.id = a.message_id
    JOIN conversations c ON c.id = m.conversation_id
    JOIN channels ch ON ch.id = m.channel_id
    ${accountId ? Prisma.sql`WHERE a.account_id = ${accountId}::uuid` : Prisma.empty}
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
    prisma.attachment.findMany({ select: { storageKey: true } }),
    prisma.knowledgeDocument.findMany({
      where: { storageKey: { not: null } },
      select: { storageKey: true },
    }),
    prisma.pendingFileDeletion.findMany({ select: { storageKey: true } }),
  ]);
  return {
    connues: [
      ...pieces.map((p) => p.storageKey),
      ...connaissances.map((k) => k.storageKey!),
    ],
    enAttente: enAttente.map((e) => e.storageKey),
  };
}
