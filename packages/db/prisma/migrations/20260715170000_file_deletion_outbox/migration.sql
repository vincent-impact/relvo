-- M4.6 — Outbox de suppression de fichiers (transactional outbox).
--
-- PROBLÈME : `ON DELETE CASCADE` s'exécute dans PostgreSQL. Prisma n'en voit
-- rien — position officielle de l'équipe : « Referential actions are actually
-- defined and executed at the database level, not at the Prisma Client level.
-- This is why the Prisma Client middleware doesn't pick them up. »
-- Supprimer un dossier efface donc ses documents en base et abandonne leurs
-- fichiers dans R2, sans que le code applicatif ne puisse s'en apercevoir.
--
-- SOLUTION : un trigger. La doc PostgreSQL le garantit (trigger-definition) :
-- « If a foreign key constraint specifies referential actions […] those actions
-- are performed via ordinary SQL UPDATE or DELETE commands on the referencing
-- table. In particular, any triggers that exist on the referencing table will be
-- fired for those changes. »
--
-- La mise en file se fait donc DANS la transaction de suppression : un ROLLBACK
-- annule aussi l'entrée de file. Un worker draine ensuite et appelle R2 — hors
-- transaction, car il ne faut jamais faire d'I/O réseau dans une transaction DB
-- (c'est la règle explicite de Rails ActiveStorage, et la raison pour laquelle
-- Django a retiré la suppression synchrone en 1.3 : « This opened the door to
-- several data-loss scenarios, including rolled-back transactions »).
--
-- ⚠️ TRUNCATE ne déclenche PAS les triggers ON DELETE (doc PostgreSQL). Sans
-- effet ici : le seul TRUNCATE du projet vit dans les tests, contre une base qui
-- ne référence aucun fichier réel.

CREATE TABLE "pending_file_deletions" (
    "id"          BIGSERIAL PRIMARY KEY,
    "storage_key" TEXT NOT NULL,
    "enqueued_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "attempts"    INTEGER NOT NULL DEFAULT 0,
    "last_error"  TEXT
);

-- Le worker prend les plus anciennes d'abord.
CREATE INDEX "pending_file_deletions_enqueued_at_idx"
    ON "pending_file_deletions" ("enqueued_at");

CREATE FUNCTION "enqueue_file_deletion"() RETURNS trigger AS $$
BEGIN
  -- `storage_key` est nullable sur knowledge_documents (une ligne peut exister
  -- avant son upload) : rien à supprimer dans ce cas.
  IF OLD."storage_key" IS NOT NULL THEN
    INSERT INTO "pending_file_deletions" ("storage_key") VALUES (OLD."storage_key");
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Un trigger par table porteuse d'un `storage_key`. Toute future table qui en
-- gagnera un devra en poser un aussi — c'est le seul point de vigilance qui
-- reste, et il est explicite plutôt que diffus dans le code applicatif.
CREATE TRIGGER "attachments_enqueue_file_deletion"
    AFTER DELETE ON "attachments"
    FOR EACH ROW EXECUTE FUNCTION "enqueue_file_deletion"();

CREATE TRIGGER "knowledge_documents_enqueue_file_deletion"
    AFTER DELETE ON "knowledge_documents"
    FOR EACH ROW EXECUTE FUNCTION "enqueue_file_deletion"();
