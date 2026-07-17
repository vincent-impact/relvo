-- Suppression d'un canal (Réglages → Canaux) : hard-delete assumé. On passe la
-- FK messages.channel_id de RESTRICT à CASCADE pour que supprimer un canal
-- efface ses messages (et, en cascade, ses pièces jointes → le trigger R2 met
-- leurs storage_key dans l'outbox pending_file_deletions, drainé par le cron).
-- Les tâches/actions/sujets rattachés SURVIVENT (leurs FK vers message sont en
-- SetNull ; Subject.source_channel_id est déjà SetNull).
ALTER TABLE "messages" DROP CONSTRAINT "messages_channel_id_fkey";
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "channels"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
