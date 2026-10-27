-- M23.1 — L'ARBRE DES DOSSIERS. Un dossier a un père ; « Général » (is_default)
-- est la racine, et les domaines existants deviennent ses fils, à plat : rien
-- ne bouge pour l'utilisateur. Le slug devient unique PAR PÈRE, plus par compte.

-- Un compte sans « Général » (il ne devrait pas en exister : le compte le crée
-- à l'ouverture) en reçoit un, sinon la contrainte ci-dessous refuserait ses
-- dossiers.
INSERT INTO "folders" ("id", "account_id", "name", "slug", "description", "is_default", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), a."id", 'Général', 'general',
       'Connaissances transversales chargées dans le contexte de toutes les affaires.',
       true, true, now(), now()
FROM "accounts" a
WHERE NOT EXISTS (SELECT 1 FROM "folders" f WHERE f."account_id" = a."id" AND f."is_default");

-- DropIndex
DROP INDEX "folders_account_id_slug_key";

-- AlterTable
ALTER TABLE "folders" ADD COLUMN     "parent_id" UUID;

-- Les domaines existants passent sous Général.
UPDATE "folders" f
SET "parent_id" = g."id"
FROM "folders" g
WHERE g."account_id" = f."account_id" AND g."is_default" AND NOT f."is_default" AND f."parent_id" IS NULL;

-- CreateIndex
CREATE INDEX "folders_parent_id_idx" ON "folders"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "folders_account_id_parent_id_slug_key" ON "folders"("account_id", "parent_id", "slug");

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seule la racine n'a pas de père (02, « Les contraintes que l'ORM ne sait pas
-- exprimer »).
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_requis" CHECK ("is_default" OR "parent_id" IS NOT NULL);
