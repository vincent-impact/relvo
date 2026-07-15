-- M4 : `file_url` porte en réalité la CLÉ de l'objet dans le stockage (R2), pas
-- une URL — le bucket est privé et les URLs pré-signées expirent (7 j max chez
-- R2). Le nom induisait en erreur (risque d'un `<img src={fileUrl}>` qui pousse
-- à rendre le bucket public pour « réparer »).
--
-- RENAME et non DROP/ADD : Prisma proposait de recréer la colonne, ce qui aurait
-- perdu les valeurs existantes. Le renommage préserve les données en place.

ALTER TABLE "attachments" RENAME COLUMN "file_url" TO "storage_key";
ALTER TABLE "knowledge_documents" RENAME COLUMN "file_url" TO "storage_key";
