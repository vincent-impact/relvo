-- L'interrupteur du tri devient l'interrupteur de l'ASSISTANT : il gouverne
-- tout ce que Relvo fait de lui-même sur un compte, pas seulement le tri.
-- RENAME, jamais un DROP + ADD : la colonne porte l'état des comptes.
ALTER TABLE "accounts" RENAME COLUMN "auto_triage_enabled" TO "assistant_enabled";
