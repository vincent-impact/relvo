import { createAttachment, type TenantDb } from "@relvo/db";
import { MAX_FILE_SIZE_BYTES } from "@relvo/storage";
import { estUneImageIncorporee } from "@/lib/medias";
import { deposerUnePiece } from "@/server/depot";
import type { FournisseurCourrier, PieceJointeRef } from "./types";

// Les PIÈCES JOINTES d'un e-mail (M5.4), stockées à l'ingestion — par le
// webhook au fil de l'eau, par la lecture à la connexion par tranches (M7.19),
// quel que soit le fournisseur (M24.6). Le fichier vit dans R2, source de
// vérité ; le fournisseur n'est qu'un transport. Une pièce jointe ratée ne
// fait jamais échouer l'ingestion du message.
//
// Une pièce d'e-mail est un document : elle se stocke toujours — sauf les
// images INCORPORÉES au corps et légères (logo de signature, pixel de suivi),
// qui ne sont pas des pièces et ne sont jamais lues (M25.3).

export async function stockerPiecesJointes(
  db: TenantDb,
  args: {
    fournisseur: FournisseurCourrier;
    accountId: string;
    /** Le compte chez le fournisseur et l'identifiant de l'e-mail chez lui. */
    externalAccountId: string;
    emailId: string;
    messageId: string;
    /** Le sujet qui a capté le message au rangement, s'il y en a un : la PJ en hérite. */
    subjectId: string | null;
    pieces: readonly PieceJointeRef[];
  },
): Promise<number> {
  if (args.pieces.length === 0) return 0;
  let stored = 0;
  for (const piece of args.pieces) {
    if (estUneImageIncorporee(piece)) continue;
    try {
      const { bytes, contentType } = await args.fournisseur.lirePieceJointe(
        { externalAccountId: args.externalAccountId },
        { emailId: args.emailId, pieceId: piece.id },
      );
      if (bytes.byteLength > MAX_FILE_SIZE_BYTES.attachments) continue; // garde-fou taille
      const mime = contentType ?? piece.mime ?? null;
      // Le dépôt dédoublonne (M25.8) : le PDF rejoint à chaque réponse d'un
      // fil n'est stocké qu'une fois, chaque message garde sa pièce.
      const depot = await deposerUnePiece(db, args.accountId, bytes, mime);
      await createAttachment(db, {
        messageId: args.messageId,
        subjectId: args.subjectId,
        name: piece.name ?? "piece-jointe",
        mimeType: mime,
        storageKey: depot.key,
        fileSize: depot.octets,
        contentHash: depot.empreinte,
      });
      stored += 1;
    } catch (err) {
      console.error(
        `[${args.fournisseur.nom}] pièce jointe non stockée`,
        piece.id,
        err,
      );
    }
  }
  return stored;
}
