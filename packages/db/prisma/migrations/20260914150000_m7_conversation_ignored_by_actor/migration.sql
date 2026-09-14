-- Qui a fait taire la source : l'utilisateur, ou Relvo (verdict « bruit » en
-- confiance haute). Les conversations déjà ignorées l'ont été par l'utilisateur.
ALTER TABLE "conversations" ADD COLUMN "ignored_by_actor" "Actor";
UPDATE "conversations" SET "ignored_by_actor" = 'user' WHERE "status" = 'ignored';
