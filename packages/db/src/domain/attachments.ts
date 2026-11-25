import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import { Actor } from "../generated/prisma/enums";
import { prisma } from "../index";
import type { TenantDb, Tx } from "../tenant";
import { assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { ensureAffected } from "./helpers";

// Domaine Attachments (M3.10). Métadonnées IA à 3 niveaux (label/summary/
// analysis), chacune horodatée comme flag de cache : jamais d'appel double pour
// un même niveau (M8.4). En V1 seul le niveau 1 (label Haiku) est produit.
//
// UNE PIÈCE N'EST PAS TOUJOURS STOCKÉE (M25.3, M25.5 — « décider avant de
// télécharger »). Relvo garde en plein format ce qu'un sujet porte ; le reste
// est une RÉFÉRENCE : la ligne existe, avec son nom, son type, son poids
// annoncé et la vignette que le réseau joint au message, mais le fichier reste
// chez le fournisseur du canal, où `externalId` permet d'aller le relire quand
// on l'ouvre ou quand un sujet prend le message. `etatDePiece` dit où en est
// une pièce ; l'application décide (`lib/medias.ts`) et va chercher
// (`server/medias.ts`) — le domaine ne connaît ni fournisseur ni stockage.

/**
 * Où en est une pièce :
 *   stockee      → son fichier est dans le stockage ;
 *   reference    → pas stockée, mais relisible chez le fournisseur du canal ;
 *   indisponible → pas stockée, et le fournisseur ne la sert plus ;
 *   trace        → rien à aller chercher (un autocollant, un GIF) : elle dit
 *                  seulement qu'il y en avait un.
 */
export type EtatDePiece = "stockee" | "reference" | "indisponible" | "trace";

export function etatDePiece(p: {
  storageKey: string | null;
  externalId: string | null;
  unavailableAt: Date | null;
}): EtatDePiece {
  if (p.storageKey) return "stockee";
  if (!p.externalId) return "trace";
  return p.unavailableAt ? "indisponible" : "reference";
}

/** Ce qu'une projection lit d'une pièce pour la montrer dans un fil. */
export const PIECE_DE_FIL_SELECT = {
  id: true,
  name: true,
  aiLabel: true,
  mimeType: true,
  storageKey: true,
  externalId: true,
  unavailableAt: true,
  thumbnail: true,
  fileSize: true,
} as const;

/** Une pièce telle qu'un fil la montre — jamais sa clé de stockage. */
export type PieceDeFil = {
  id: string;
  name: string;
  label: string | null;
  mimeType: string | null;
  etat: EtatDePiece;
  /** La vignette du réseau (JPEG, base64), pour ce qui n'est pas stocké. */
  vignette: string | null;
  /** En octets ; annoncé par le fournisseur tant que la pièce n'est pas stockée. */
  taille: number | null;
};

export function pieceDeFil(a: {
  id: string;
  name: string;
  aiLabel: string | null;
  mimeType: string | null;
  storageKey: string | null;
  externalId: string | null;
  unavailableAt: Date | null;
  thumbnail: string | null;
  fileSize: number | null;
}): PieceDeFil {
  return {
    id: a.id,
    name: a.name,
    label: a.aiLabel,
    mimeType: a.mimeType,
    etat: etatDePiece(a),
    vignette: a.thumbnail,
    taille: a.fileSize,
  };
}

/**
 * Tout sauf une TRACE : ce qui compte comme un document d'un sujet. Un
 * autocollant noté dans un fil n'est pas une pièce du dossier.
 */
export const PAS_UNE_TRACE: Prisma.AttachmentWhereInput = {
  NOT: { storageKey: null, externalId: null },
};

/** Une vignette tient en quelques kilo-octets ; au-delà, ce n'en est pas une. */
export const VIGNETTE_MAX_CARACTERES = 40_000;

export const createAttachmentSchema = z.object({
  messageId: z.uuid(),
  subjectId: z.uuid().optional().nullable(),
  name: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().max(255).optional().nullable(),
  // Clé de l'objet dans le stockage (R2), jamais une URL : le bucket est privé,
  // les URLs pré-signées expirent. Signer à la demande via `@relvo/storage`.
  // Absente : la pièce est une référence, ou une trace (M25.3).
  storageKey: z.string().trim().min(1).max(1024).optional().nullable(),
  /** L'identifiant de la pièce chez le fournisseur du canal. */
  externalId: z.string().trim().min(1).max(1024).optional().nullable(),
  thumbnail: z.string().max(VIGNETTE_MAX_CARACTERES).optional().nullable(),
  fileSize: z.number().int().nonnegative().optional().nullable(),
});

export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;

export function listAttachments(
  db: TenantDb,
  opts: { messageId?: string; subjectId?: string } = {},
) {
  return db.attachment.findMany({
    where: {
      ...(opts.messageId ? { messageId: opts.messageId } : {}),
      // Les pièces d'un sujet sont celles de ses messages (par référence).
      ...(opts.subjectId
        ? { message: { is: { subjectId: opts.subjectId } } }
        : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAttachment(db: TenantDb, id: string) {
  return assertFound(
    await db.attachment.findFirst({ where: { id } }),
    "Pièce jointe",
  );
}

export async function createAttachment(
  db: TenantDb,
  input: CreateAttachmentInput,
  actor: Actor = Actor.contact,
) {
  const data = createAttachmentSchema.parse(input);
  return db.$transaction(async (tx) => {
    const attachment = await tx.attachment.create({
      data: {
        messageId: data.messageId,
        subjectId: data.subjectId ?? null,
        name: data.name,
        mimeType: data.mimeType ?? null,
        storageKey: data.storageKey ?? null,
        externalId: data.externalId ?? null,
        thumbnail: data.thumbnail ?? null,
        fileSize: data.fileSize ?? null,
      } as Prisma.AttachmentUncheckedCreateInput,
    });
    await logEvent(tx as Tx, {
      entityType: "attachment",
      entityId: attachment.id,
      messageId: attachment.messageId,
      subjectId: attachment.subjectId,
      eventType: EVENT_TYPES.attachmentCreated,
      title: `Pièce jointe reçue : ${attachment.name}`,
      actor,
      // Ce que Relvo en a fait à la réception : stockée, gardée en référence,
      // ou simplement notée.
      metadata: { etat: etatDePiece(attachment) },
    });
    return attachment;
  });
}

// ── Une référence qui se complète (M25.5) ────────────────────────────────────

/** Ce qu'il faut pour aller relire une pièce chez le fournisseur de son canal. */
export type PieceARelire = {
  id: string;
  accountId: string;
  name: string;
  mimeType: string | null;
  fileSize: number | null;
  storageKey: string | null;
  externalId: string | null;
  unavailableAt: Date | null;
  /** L'identifiant du MESSAGE chez le fournisseur : la pièce se relit par lui. */
  messageExternalId: string | null;
};

const PIECE_A_RELIRE_SELECT = {
  id: true,
  accountId: true,
  name: true,
  mimeType: true,
  fileSize: true,
  storageKey: true,
  externalId: true,
  unavailableAt: true,
  message: { select: { externalId: true } },
} as const;

function pieceARelire(
  a: Prisma.AttachmentGetPayload<{ select: typeof PIECE_A_RELIRE_SELECT }>,
): PieceARelire {
  const { message, ...reste } = a;
  return { ...reste, messageExternalId: message.externalId };
}

/** Une pièce du compte, avec de quoi la relire à la source ; `null` si elle n'existe pas. */
export async function getPieceARelire(
  db: TenantDb,
  id: string,
): Promise<PieceARelire | null> {
  const a = await db.attachment.findFirst({
    where: { id },
    select: PIECE_A_RELIRE_SELECT,
  });
  return a ? pieceARelire(a) : null;
}

/**
 * La référence est devenue un fichier : sa clé, son poids réel, son type.
 * Écrit SEULEMENT si la pièce n'était pas déjà stockée — deux lectures
 * simultanées de la même pièce n'en gardent qu'une ; `gagne: false` dit à
 * l'appelant que son fichier est de trop, et rend la clé qui a gagné.
 */
export async function noterPieceStockee(
  db: TenantDb,
  id: string,
  fichier: { storageKey: string; fileSize: number; mimeType: string | null },
): Promise<{ gagne: boolean; storageKey: string }> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.attachment.updateMany({
      where: { id, storageKey: null },
      data: {
        storageKey: fichier.storageKey,
        fileSize: fichier.fileSize,
        unavailableAt: null,
        ...(fichier.mimeType ? { mimeType: fichier.mimeType } : {}),
      },
    });
    const piece = assertFound(
      await tx.attachment.findFirst({
        where: { id },
        select: {
          id: true,
          name: true,
          storageKey: true,
          messageId: true,
          subjectId: true,
        },
      }),
      "Pièce jointe",
    );
    if (count > 0) {
      await logEvent(tx as Tx, {
        entityType: "attachment",
        entityId: piece.id,
        messageId: piece.messageId,
        subjectId: piece.subjectId,
        eventType: EVENT_TYPES.attachmentStored,
        title: `Pièce jointe relue à la source : ${piece.name}`,
        actor: Actor.system,
        metadata: { octets: fichier.fileSize },
      });
    }
    return { gagne: count > 0, storageKey: piece.storageKey! };
  });
}

/** Le fournisseur ne sert plus cette pièce : on ne le redemandera pas. */
export async function noterPieceIndisponible(db: TenantDb, id: string) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.attachment.updateMany({
      where: { id, storageKey: null, unavailableAt: null },
      data: { unavailableAt: new Date() },
    });
    if (count === 0) return;
    const piece = await tx.attachment.findFirst({
      where: { id },
      select: { id: true, name: true, messageId: true, subjectId: true },
    });
    if (!piece) return;
    await logEvent(tx as Tx, {
      entityType: "attachment",
      entityId: piece.id,
      messageId: piece.messageId,
      subjectId: piece.subjectId,
      eventType: EVENT_TYPES.attachmentUnavailable,
      title: `Pièce jointe plus servie par le fournisseur : ${piece.name}`,
      actor: Actor.system,
    });
  });
}

/** Le poids au-delà duquel une pièce ne se complète pas d'elle-même, par famille de type. */
export type PlafondsDeCompletion = {
  video: number;
  image: number;
  audio: number;
  autre: number;
};

/**
 * Les références qu'un SUJET porte et qui ne sont pas encore stockées — ce
 * que la complétion va chercher (M25.5 : le plein format pour ce qu'un sujet
 * porte). Les plus récentes d'abord ; une pièce plus lourde que le plafond de
 * sa famille, ou que le fournisseur ne sert plus, n'y est pas : elle reste
 * une référence, qui s'ouvre à la demande.
 *
 * Cross-tenant quand `accountId` manque : c'est le filet des crons.
 */
export async function listPiecesACompleter(opts: {
  accountId?: string;
  plafonds: PlafondsDeCompletion;
  limite: number;
}): Promise<PieceARelire[]> {
  const sous = (max: number): Prisma.AttachmentWhereInput => ({
    OR: [{ fileSize: null }, { fileSize: { lte: max } }],
  });
  const famille = (prefixe: string): Prisma.AttachmentWhereInput => ({
    mimeType: { startsWith: prefixe },
  });
  const rows = await prisma.attachment.findMany({
    where: {
      ...(opts.accountId ? { accountId: opts.accountId } : {}),
      storageKey: null,
      externalId: { not: null },
      unavailableAt: null,
      message: { is: { externalId: { not: null } } },
      AND: [
        {
          OR: [
            { subjectId: { not: null } },
            { message: { is: { subjectId: { not: null } } } },
          ],
        },
        {
          OR: [
            { AND: [famille("video/"), sous(opts.plafonds.video)] },
            { AND: [famille("image/"), sous(opts.plafonds.image)] },
            { AND: [famille("audio/"), sous(opts.plafonds.audio)] },
            {
              AND: [
                {
                  OR: [
                    { mimeType: null },
                    {
                      NOT: [
                        famille("video/"),
                        famille("image/"),
                        famille("audio/"),
                      ],
                    },
                  ],
                },
                sous(opts.plafonds.autre),
              ],
            },
          ],
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: opts.limite,
    select: PIECE_A_RELIRE_SELECT,
  });
  return rows.map(pieceARelire);
}

// ── Métadonnées IA (idempotentes : no-op si le niveau est déjà en cache) ─────

export async function setAiLabel(db: TenantDb, id: string, label: string) {
  const current = await getAttachment(db, id);
  if (current.aiLabelAt) return current; // déjà étiqueté (cache)
  return db.$transaction(async (tx) => {
    const { count } = await tx.attachment.updateMany({
      where: { id },
      data: { aiLabel: label, aiLabelAt: new Date() },
    });
    ensureAffected(count, "Pièce jointe");
    const updated = assertFound(
      await tx.attachment.findFirst({ where: { id } }),
      "Pièce jointe",
    );
    await logEvent(tx as Tx, {
      entityType: "attachment",
      entityId: updated.id,
      subjectId: updated.subjectId,
      eventType: EVENT_TYPES.attachmentLabeled,
      title: `Pièce jointe étiquetée : ${label}`,
      actor: "ai",
    });
    return updated;
  });
}

export async function setAiSummary(db: TenantDb, id: string, summary: string) {
  const current = await getAttachment(db, id);
  if (current.aiSummaryAt) return current; // déjà résumé (cache)
  const { count } = await db.attachment.updateMany({
    where: { id },
    data: { aiSummary: summary, aiSummaryAt: new Date() },
  });
  ensureAffected(count, "Pièce jointe");
  return getAttachment(db, id);
}

export async function setAiAnalysis(
  db: TenantDb,
  id: string,
  analysis: string,
) {
  const current = await getAttachment(db, id);
  if (current.aiAnalysisAt) return current; // déjà analysé (cache)
  const { count } = await db.attachment.updateMany({
    where: { id },
    data: { aiAnalysis: analysis, aiAnalysisAt: new Date() },
  });
  ensureAffected(count, "Pièce jointe");
  return getAttachment(db, id);
}

/**
 * Supprime une pièce jointe. Le FICHIER est effacé par ailleurs (M4.6).
 *
 * Rien à faire ici : un trigger PostgreSQL met `storage_key` dans l'outbox
 * `pending_file_deletions`, dans cette transaction même, et un worker draine
 * hors transaction. Le domaine n'a donc aucune notion de stockage — c'est ce
 * qui rend l'oubli impossible, y compris pour les suppressions en CASCADE que
 * ce code ne voit jamais passer.
 */
export async function deleteAttachment(db: TenantDb, id: string) {
  const { count } = await db.attachment.deleteMany({ where: { id } });
  ensureAffected(count, "Pièce jointe");
  return { id };
}
