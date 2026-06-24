-- SubjectStatus : nouveau statut terminal « ignored »
-- (sujet écarté des ouverts, hors mémoire, purgeable, récupérable).
ALTER TYPE "SubjectStatus" ADD VALUE 'ignored';

-- Priority : passage à 2 niveaux d'urgence (normal / urgent).
-- Mapping des données existantes : critical → urgent ; high, low → normal.
ALTER TYPE "Priority" RENAME TO "Priority_old";
CREATE TYPE "Priority" AS ENUM ('normal', 'urgent');
ALTER TABLE "subjects" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "subjects"
  ALTER COLUMN "priority" TYPE "Priority"
  USING (
    CASE "priority"::text
      WHEN 'critical' THEN 'urgent'::"Priority"
      ELSE 'normal'::"Priority"
    END
  );
ALTER TABLE "subjects" ALTER COLUMN "priority" SET DEFAULT 'normal';
DROP TYPE "Priority_old";
