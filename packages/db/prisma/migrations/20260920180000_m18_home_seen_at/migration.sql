-- M18 : dernier passage sur l'accueil, borne des « dernières nouvelles ».
ALTER TABLE "accounts" ADD COLUMN "home_seen_at" TIMESTAMP(3);
