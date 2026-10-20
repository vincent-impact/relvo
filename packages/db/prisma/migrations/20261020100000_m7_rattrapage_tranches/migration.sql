-- M7.19, tranche 10 : le rattrapage du courrier récent part DÈS LA CONNEXION,
-- par tranches enchaînées, verrouillées une à la fois ; la nuit n'est plus
-- qu'un filet. Migration ADDITIVE : aucune ligne existante ne change de sens
-- (`runs` compte désormais des tranches, pas des nuits — son contenu reste vrai).

-- CreateEnum
CREATE TYPE "ServiceLevel" AS ENUM ('standard', 'flex');

-- AlterTable
ALTER TABLE "channel_catchups" ADD COLUMN     "night_runs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tranche_started_at" TIMESTAMP(3),
ADD COLUMN     "last_tranche_at" TIMESTAMP(3),
ADD COLUMN     "empty_rounds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "candidates_total" INTEGER,
ADD COLUMN     "service_level" "ServiceLevel" NOT NULL DEFAULT 'standard';

-- Les lignes de la tranche 9 arrêtées « nuits épuisées » portent désormais le
-- motif des tranches : même sens (le coupe-circuit de reprise), un seul mot.
UPDATE "channel_catchups" SET "stop_reason" = 'tranches-epuisees' WHERE "stop_reason" = 'nuits-epuisees';
