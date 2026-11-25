-- M25.3 / M25.5 — « décider avant de télécharger ». Une pièce jointe peut ne
-- pas être stockée : c'est alors une RÉFÉRENCE (relue chez le fournisseur du
-- canal quand on l'ouvre, par `external_id`) ou une simple TRACE (autocollant,
-- GIF). Le déclencheur de la file de suppression ignore déjà une clé nulle
-- (`20260715170000_file_deletion_outbox`).
ALTER TABLE "attachments" ALTER COLUMN "storage_key" DROP NOT NULL;
ALTER TABLE "attachments" ADD COLUMN "external_id" TEXT;
ALTER TABLE "attachments" ADD COLUMN "thumbnail" TEXT;
ALTER TABLE "attachments" ADD COLUMN "unavailable_at" TIMESTAMP(3);
