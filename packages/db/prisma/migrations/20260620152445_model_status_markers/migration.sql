-- Refonte modèle Subject/Mémoire (2026-06-18) : statut 4 valeurs + marqueurs
-- cumulables, priorité 3 valeurs, absorption des documents.
-- Migration écrite à la main : Postgres n'autorise pas le retrait de valeurs
-- d'un enum encore utilisé → recréation du type avec mapping des données.

-- ─────────────────────────────────────────────────────────────
-- 1. Nouveaux marqueurs / colonnes (avant la conversion des enums)
-- ─────────────────────────────────────────────────────────────

-- Marqueur « En attente » sur Subject.
ALTER TABLE "subjects" ADD COLUMN "waiting_for_reply" BOOLEAN NOT NULL DEFAULT false;

-- L'ancien statut `waiting` devient le marqueur waiting_for_reply (avant son drop).
UPDATE "subjects" SET "waiting_for_reply" = true WHERE "status"::text = 'waiting';

-- Absorption des KnowledgeDocument (kind=file).
CREATE TYPE "AbsorptionStatus" AS ENUM ('read', 'ignored');
ALTER TABLE "knowledge_documents"
  ADD COLUMN "absorption_status" "AbsorptionStatus" NOT NULL DEFAULT 'read';

-- ─────────────────────────────────────────────────────────────
-- 2. SubjectStatus : new, to_do, waiting, unread, resolved, archived
--    → new, acknowledged, resolved, archived
--    (to_do | waiting | unread → acknowledged ; les autres inchangés)
-- ─────────────────────────────────────────────────────────────

ALTER TYPE "SubjectStatus" RENAME TO "SubjectStatus_old";
CREATE TYPE "SubjectStatus" AS ENUM ('new', 'acknowledged', 'resolved', 'archived');

ALTER TABLE "subjects" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "subjects" ALTER COLUMN "status" TYPE "SubjectStatus" USING (
  CASE "status"::text
    WHEN 'to_do'   THEN 'acknowledged'
    WHEN 'waiting' THEN 'acknowledged'
    WHEN 'unread'  THEN 'acknowledged'
    ELSE "status"::text
  END
)::"SubjectStatus";
ALTER TABLE "subjects" ALTER COLUMN "status" SET DEFAULT 'new';

DROP TYPE "SubjectStatus_old";

-- ─────────────────────────────────────────────────────────────
-- 3. Priority : low, medium, high, critical → low, high, critical
--    (medium → low ; les autres inchangés)
-- ─────────────────────────────────────────────────────────────

ALTER TYPE "Priority" RENAME TO "Priority_old";
CREATE TYPE "Priority" AS ENUM ('low', 'high', 'critical');

ALTER TABLE "subjects" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "subjects" ALTER COLUMN "priority" TYPE "Priority" USING (
  CASE "priority"::text
    WHEN 'medium' THEN 'low'
    ELSE "priority"::text
  END
)::"Priority";
ALTER TABLE "subjects" ALTER COLUMN "priority" SET DEFAULT 'low';

DROP TYPE "Priority_old";
