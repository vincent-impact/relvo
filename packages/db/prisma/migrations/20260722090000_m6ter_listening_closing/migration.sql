-- M6ter — Écoute à deux bornes (2026-07-22)
--
-- Ajoute la BORNE DE FIN de l'écoute d'un sujet sur une conversation. Jusqu'ici,
-- `subject_conversations` ne portait que le DÉBUT (`anchor_message_id`) ; une
-- écoute WhatsApp doit aussi savoir où elle s'ARRÊTE (quand le sujet est
-- validé/fermé). Cf. invariant produit n°13bis.
--
-- Purement additive : une colonne nullable, AUCUN backfill. Les liens existants
-- restent à NULL — pour un lien email c'est définitif (le sujet EST le fil, il
-- n'a pas de fin), pour un lien WhatsApp encore ouvert c'est correct (l'écoute
-- n'a pas de fin tant que le sujet est ouvert). La borne se posera à la première
-- validation/fermeture postérieure à cette migration.

ALTER TABLE "subject_conversations" ADD COLUMN "closing_message_id" UUID;

ALTER TABLE "subject_conversations"
  ADD CONSTRAINT "subject_conversations_closing_message_id_fkey"
  FOREIGN KEY ("closing_message_id") REFERENCES "messages"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
