-- Dernier passage de l'utilisateur sur les onglets « Suivies » et « Ignorées » :
-- les pastilles comptent ce que Relvo y a rangé depuis. Null = jamais passé.
ALTER TABLE "accounts" ADD COLUMN "followed_seen_at" TIMESTAMP(3);
ALTER TABLE "accounts" ADD COLUMN "ignored_seen_at" TIMESTAMP(3);
