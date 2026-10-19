-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "activated_at" TIMESTAMP(3),
ADD COLUMN     "is_test" BOOLEAN NOT NULL DEFAULT false;

-- Les comptes qui existent ont déjà leur accès : la porte de l'alpha (M21.6) ne
-- vaut que pour les inscriptions à venir. Sans ce rattrapage, tout compte en
-- place se retrouverait « en attente de validation » au déploiement.
UPDATE "accounts" SET "activated_at" = "created_at" WHERE "activated_at" IS NULL;
