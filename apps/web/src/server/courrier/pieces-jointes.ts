import { createAttachment, type TenantDb } from "@relvo/db";
import {
  buildObjectKey,
  MAX_FILE_SIZE_BYTES,
  getStorage,
} from "@relvo/storage";
import type { FournisseurCourrier, PieceJointeRef } from "./types";

// Les PIÈCES JOINTES d'un e-mail (M5.4), stockées à l'ingestion — par le
// webhook au fil de l'eau, par la lecture à la connexion par tranches (M7.19),
// quel que soit le fournisseur (M24.6). Le fichier vit dans R2, source de
// vérité ; le fournisseur n'est qu'un transport. Une pièce jointe ratée ne
// fait jamais échouer l'ingestion du message.

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
  const storage = getStorage();
  let stored = 0;
  for (const piece of args.pieces) {
    try {
      const { bytes, contentType } = await args.fournisseur.lirePieceJointe(
        { externalAccountId: args.externalAccountId },
        { emailId: args.emailId, pieceId: piece.id },
      );
      if (bytes.byteLength > MAX_FILE_SIZE_BYTES.attachments) continue; // garde-fou taille
      const key = buildObjectKey({
        accountId: args.accountId,
        scope: "attachments",
      });
      const mime = contentType ?? piece.mime ?? null;
      await storage.put({
        key,
        body: bytes,
        contentType: mime ?? "application/octet-stream",
      });
      await createAttachment(db, {
        messageId: args.messageId,
        subjectId: args.subjectId,
        name: piece.name ?? "piece-jointe",
        mimeType: mime,
        storageKey: key,
        fileSize: bytes.byteLength,
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
