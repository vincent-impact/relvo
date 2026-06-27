-- SubjectStatus : « new » n'est plus un statut. « Nouveau » devient un marqueur
-- DÉRIVÉ (lastOpenedAt null = sujet jamais ouvert), au même titre que « Urgent »
-- (priority) ou « À faire » (tâches ouvertes). On retire la valeur de l'enum.

-- 1. Backfill : un sujet « acknowledged » jamais ouvert deviendrait « Nouveau »
--    à tort → on lui pose un lastOpenedAt (dernière activité, sinon ouverture/
--    création) pour le garder « vu ».
UPDATE "subjects"
  SET "last_opened_at" = COALESCE("last_activity_at", "opened_at", "created_at")
  WHERE "status" = 'acknowledged' AND "last_opened_at" IS NULL;

-- 2. Les sujets encore « new » passent « acknowledged » en GARDANT lastOpenedAt
--    NULL (jamais ouverts → restent « Nouveau » via la règle dérivée).
UPDATE "subjects" SET "status" = 'acknowledged' WHERE "status" = 'new';

-- 3. Recréer l'enum sans « new » + recaler le défaut sur « acknowledged ».
ALTER TYPE "SubjectStatus" RENAME TO "SubjectStatus_old";
CREATE TYPE "SubjectStatus" AS ENUM ('acknowledged', 'resolved', 'archived', 'ignored');
ALTER TABLE "subjects" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "subjects"
  ALTER COLUMN "status" TYPE "SubjectStatus"
  USING ("status"::text::"SubjectStatus");
ALTER TABLE "subjects" ALTER COLUMN "status" SET DEFAULT 'acknowledged';
DROP TYPE "SubjectStatus_old";
