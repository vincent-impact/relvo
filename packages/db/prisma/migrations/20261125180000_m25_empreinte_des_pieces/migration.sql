-- M25.8 — la déduplication. L'empreinte du contenu stocké : deux pièces d'un
-- même compte de même empreinte et de même poids partagent une clé d'objet.
-- La file de suppression épargne déjà une clé qu'une autre ligne référence
-- encore (`encoreReferencees`, `domain/file-deletions.ts`).
ALTER TABLE "attachments" ADD COLUMN "content_hash" TEXT;
CREATE INDEX "attachments_account_id_content_hash_idx" ON "attachments"("account_id", "content_hash");
