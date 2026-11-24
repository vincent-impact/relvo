import { ConversationStatus } from "../generated/prisma/enums";
import { prisma } from "../index";
import type { TenantDb, Tx } from "../tenant";
import { EVENT_TYPES, logEvent } from "./events";

// LE STOCK DÉJÀ IGNORÉ (M25.12) — ignorer, c'est ne plus importer (M25.9),
// mais ce qu'une conversation avait reçu AVANT d'être ignorée est resté : ses
// pièces dans le stockage, la mise en forme de ses e-mails en base. Ce module
// le retire, une conversation à la fois, et dit d'abord ce qu'il retirerait.
//
// CE QUI PART : les pièces jointes et le HTML des messages d'une conversation
// IGNORÉE. CE QUI RESTE, toujours :
//   · le TEXTE de chaque message — il ne pèse rien, et c'est lui que Relvo et
//     la recherche lisent ;
//   · tout ce qu'un SUJET porte — un message couvert par un sujet, une pièce
//     rangée dans un sujet : c'est la mémoire du sujet, pas celle du fil ;
//   · le HTML d'un message qui n'a PAS de texte : le retirer viderait le message.
//
// Le fichier n'est pas touché ici : supprimer la ligne d'une pièce met sa clé
// dans la file de suppression (le déclencheur de M4.6), que le drainage vide.
// Les originaux restent chez l'expéditeur, dans la boîte ou sur le téléphone :
// réactiver une conversation ne les ramène pas dans Relvo.

/** Ce qu'une conversation ignorée porte de retirable. */
export type StockConversation = {
  conversationId: string;
  pieces: number;
  /** Poids des pièces, en octets (0 quand la taille n'est pas connue). */
  octets: number;
  messagesHtml: number;
  octetsHtml: number;
};

export type StockIgnore = Omit<StockConversation, "conversationId"> & {
  conversations: number;
};

/**
 * Ce que les conversations ignorées d'un compte portent de retirable — la
 * SIMULATION : rien n'est écrit. Les conversations qui n'ont rien à retirer
 * n'y figurent pas.
 */
export async function stockIgnoreDuCompte(
  accountId: string,
): Promise<StockConversation[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      conversation_id: string;
      pieces: number;
      octets: bigint;
      messages_html: number;
      octets_html: bigint;
    }>
  >`
    SELECT c.id AS conversation_id,
           COALESCE(p.pieces, 0)::int      AS pieces,
           COALESCE(p.octets, 0)::bigint   AS octets,
           COALESCE(h.messages, 0)::int    AS messages_html,
           COALESCE(h.octets, 0)::bigint   AS octets_html
    FROM conversations c
    LEFT JOIN LATERAL (
      SELECT count(*) AS pieces, sum(a.file_size) AS octets
      FROM attachments a
      JOIN messages m ON m.id = a.message_id
      WHERE m.conversation_id = c.id
        AND m.subject_id IS NULL
        AND a.subject_id IS NULL
    ) p ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS messages, sum(octet_length(m.content_html)) AS octets
      FROM messages m
      WHERE m.conversation_id = c.id
        AND m.subject_id IS NULL
        AND m.content_html IS NOT NULL
        AND m.content ~ '\\S'
    ) h ON true
    WHERE c.account_id = ${accountId}::uuid
      AND c.status = 'ignored'
      AND (COALESCE(p.pieces, 0) > 0 OR COALESCE(h.messages, 0) > 0)
    ORDER BY c.id
  `;
  return rows.map((r) => ({
    conversationId: r.conversation_id,
    pieces: r.pieces,
    octets: Number(r.octets),
    messagesHtml: r.messages_html,
    octetsHtml: Number(r.octets_html),
  }));
}

/** La somme d'un stock, pour le dire en une ligne. */
export function totalDuStock(stock: StockConversation[]): StockIgnore {
  return stock.reduce<StockIgnore>(
    (t, c) => ({
      conversations: t.conversations + 1,
      pieces: t.pieces + c.pieces,
      octets: t.octets + c.octets,
      messagesHtml: t.messagesHtml + c.messagesHtml,
      octetsHtml: t.octetsHtml + c.octetsHtml,
    }),
    { conversations: 0, pieces: 0, octets: 0, messagesHtml: 0, octetsHtml: 0 },
  );
}

/**
 * Retire d'UNE conversation ignorée ses pièces et la mise en forme de ses
 * e-mails, dans une transaction, et le journalise. Rend ce qui a été retiré,
 * ou null si la conversation n'est pas ignorée ou n'avait rien à retirer —
 * le geste se rejoue donc sans effet.
 */
export async function purgerConversationIgnoree(
  db: TenantDb,
  conversationId: string,
): Promise<{ pieces: number; octets: number; messagesHtml: number } | null> {
  return db.$transaction(async (tx) => {
    // L'état se relit DANS la transaction : une conversation réactivée entre
    // la simulation et le geste garde tout.
    const duFil = {
      subjectId: null,
      conversation: {
        is: { id: conversationId, status: ConversationStatus.ignored },
      },
    };
    const pieces = await tx.attachment.findMany({
      where: { subjectId: null, message: { is: duFil } },
      select: { id: true, fileSize: true },
    });
    const avecHtml = await tx.message.findMany({
      where: { ...duFil, contentHtml: { not: null } },
      select: { id: true, content: true },
    });
    // Un message sans texte garde son HTML : c'est tout ce qu'il a.
    const aAlleger = avecHtml
      .filter((m) => /\S/.test(m.content ?? ""))
      .map((m) => m.id);
    if (pieces.length === 0 && aAlleger.length === 0) return null;

    if (pieces.length > 0) {
      await tx.attachment.deleteMany({
        where: { id: { in: pieces.map((p) => p.id) } },
      });
    }
    if (aAlleger.length > 0) {
      await tx.message.updateMany({
        where: { id: { in: aAlleger } },
        data: { contentHtml: null },
      });
    }
    const bilan = {
      pieces: pieces.length,
      octets: pieces.reduce((s, p) => s + (p.fileSize ?? 0), 0),
      messagesHtml: aAlleger.length,
    };
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: conversationId,
      eventType: EVENT_TYPES.conversationStockPurged,
      title: "Pièces et mise en forme retirées d'une conversation ignorée",
      actor: "system",
      metadata: bilan,
    });
    return bilan;
  });
}
