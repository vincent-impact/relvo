-- M19.9 — la trace « diapositives de première connexion vues », sur le compte
-- (modèle de home_seen_at). Additive : la seule migration que M19 s'accorde.
ALTER TABLE "accounts" ADD COLUMN "welcome_seen_at" TIMESTAMP(3);
