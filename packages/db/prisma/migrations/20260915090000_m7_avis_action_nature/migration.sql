-- L'avis de tri parle en deux parts : une ACTION (à traiter, à considérer,
-- rien à faire — l'énuméré `TriageVerdict` reste) et une NATURE, toujours posée
-- (professionnel, publicité, automatique, personnel). La « catégorie du bruit »
-- dans le vocabulaire des raisons d'ignorance disparaît, et sa contrainte avec.
ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_triage_noise_reason_check";

CREATE TYPE "TriageNature" AS ENUM ('professional', 'advertising', 'automatic', 'personal');

ALTER TABLE "conversations" ADD COLUMN "triage_nature" "TriageNature";

-- Reprise des avis déjà rendus : la sorte de bruit devient une nature ;
-- « prospection » est de la publicité ; « autre », faute de mieux, est
-- professionnel — comme toute affaire.
UPDATE "conversations" SET "triage_nature" = CASE "triage_noise_reason"
  WHEN 'advertising' THEN 'advertising'::"TriageNature"
  WHEN 'prospecting' THEN 'advertising'::"TriageNature"
  WHEN 'automatic'   THEN 'automatic'::"TriageNature"
  WHEN 'personal'    THEN 'personal'::"TriageNature"
  ELSE 'professional'::"TriageNature"
END
WHERE "triage_verdict" IS NOT NULL;

ALTER TABLE "conversations" DROP COLUMN "triage_noise_reason";
