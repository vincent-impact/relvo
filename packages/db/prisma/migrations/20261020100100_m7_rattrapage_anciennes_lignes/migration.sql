-- M7.19, tranche 10 : une ligne arrêtée au plafond devient REPRENABLE la nuit
-- (`night_runs` sous le maximum). Les lignes de la tranche 9 déjà arrêtées au
-- plafond ont eu leurs nuits sous l'ancien mécanisme : on le dit, pour que le
-- déploiement ne relance aucune lecture sur un compte réel — seule une
-- nouvelle connexion de boîte démarre une lecture.
UPDATE "channel_catchups"
SET "night_runs" = 3
WHERE "status" = 'capped' AND "night_runs" = 0;
