-- Descriptif utilisateur du sujet (onglet Informations). Additif, nullable, sans
-- backfill : distinct de `summary` (futur rapport d'activité Relvo).
ALTER TABLE "subjects" ADD COLUMN "description" TEXT;
