import "server-only";
import { createAttachment, type TenantDb } from "@relvo/db";
import {
  buildObjectKey,
  MAX_FILE_SIZE_BYTES,
  getStorage,
} from "@relvo/storage";
import { fetchAttachment } from "./client";
import type { UnipileAttachmentRef } from "./types";

// Les PIÈCES JOINTES d'un e-mail (M5.4), stockées à l'ingestion — par le
// webhook au fil de l'eau, par le rattrapage la nuit (M7.19). Le fichier vit
// dans R2, source de vérité ; Unipile n'est qu'un transport. Une pièce jointe
// ratée ne fait jamais échouer l'ingestion du message.

export async function stockerPiecesJointes(
  db: TenantDb,
  args: {
    accountId: string;
    /** Compte Unipile (`account_id`) et identifiant de l'e-mail chez lui. */
    unipileAccountId: string;
    emailId: string;
    messageId: string;
    /** Le sujet qui a capté le message au rangement, s'il y en a un : la PJ en hérite. */
    subjectId: string | null;
    attachments: readonly UnipileAttachmentRef[];
  },
): Promise<number> {
  if (args.attachments.length === 0) return 0;
  const storage = getStorage();
  let stored = 0;
  for (const att of args.attachments) {
    try {
      const { bytes, contentType } = await fetchAttachment({
        accountId: args.unipileAccountId,
        emailId: args.emailId,
        attachmentId: att.id,
      });
      if (bytes.byteLength > MAX_FILE_SIZE_BYTES.attachments) continue; // garde-fou taille
      const key = buildObjectKey({
        accountId: args.accountId,
        scope: "attachments",
      });
      const mime = contentType ?? att.mime ?? att.content_type ?? null;
      await storage.put({
        key,
        body: bytes,
        contentType: mime ?? "application/octet-stream",
      });
      await createAttachment(db, {
        messageId: args.messageId,
        subjectId: args.subjectId,
        name: att.name ?? "piece-jointe",
        mimeType: mime,
        storageKey: key,
        fileSize: bytes.byteLength,
      });
      stored += 1;
    } catch (err) {
      console.error("[unipile] pièce jointe non stockée", att.id, err);
    }
  }
  return stored;
}
