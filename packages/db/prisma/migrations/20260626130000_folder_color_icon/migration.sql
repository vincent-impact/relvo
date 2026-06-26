-- Logo de domaine (Mémoire) : couleur + icône personnalisables par Folder.
-- Colonnes nullables ; un Folder sans valeur retombe sur le mapping par slug
-- (apps/web/src/lib/folders.ts). Aucune donnée à rétro-remplir.
ALTER TABLE "folders" ADD COLUMN "color" TEXT;
ALTER TABLE "folders" ADD COLUMN "icon" TEXT;
