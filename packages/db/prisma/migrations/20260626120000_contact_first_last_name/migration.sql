-- Contact : remplace le champ unique `name` par `first_name` (optionnel) +
-- `last_name` (requis). Le nom de famille sert de clé de tri/section dans
-- l'annuaire. Backfill non destructif : on découpe le nom existant en
-- « tout sauf le dernier mot » (prénom) + « dernier mot » (nom de famille).
-- Un nom à un seul mot (ex. raison sociale) → first_name NULL, last_name = le nom.

ALTER TABLE "contacts" ADD COLUMN "first_name" TEXT;
ALTER TABLE "contacts" ADD COLUMN "last_name" TEXT;

UPDATE "contacts" SET
  "last_name" = (regexp_split_to_array(btrim("name"), '\s+'))[
    array_upper(regexp_split_to_array(btrim("name"), '\s+'), 1)
  ],
  "first_name" = NULLIF(
    btrim(regexp_replace(btrim("name"), '\s+\S+$', '')),
    btrim("name")
  );

ALTER TABLE "contacts" ALTER COLUMN "last_name" SET NOT NULL;
ALTER TABLE "contacts" DROP COLUMN "name";
