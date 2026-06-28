-- Une tâche peut désormais ne PAS avoir de sujet (créée depuis l'Accueil,
-- ou détachée). subject_id devient nullable ; la FK reste en cascade (supprimer
-- un sujet supprime ses tâches rattachées ; les tâches sans sujet sont indépendantes).
ALTER TABLE "tasks" ALTER COLUMN "subject_id" DROP NOT NULL;
