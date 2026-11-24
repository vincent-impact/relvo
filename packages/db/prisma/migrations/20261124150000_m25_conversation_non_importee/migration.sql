-- M25.9 — une conversation ignorée n'importe plus ses messages. Elle garde le
-- COMPTE de ce qu'elle n'a pas importé, sans aucun contenu : combien, depuis
-- quand, le dernier, et l'identifiant externe du dernier (une seconde livraison
-- du même webhook ne compte pas deux fois).
ALTER TABLE "conversations"
  ADD COLUMN "unimported_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "unimported_since" TIMESTAMP(3),
  ADD COLUMN "unimported_last_at" TIMESTAMP(3),
  ADD COLUMN "unimported_last_external_id" TEXT;
