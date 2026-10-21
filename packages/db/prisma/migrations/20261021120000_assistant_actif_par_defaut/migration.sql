-- Recette de l'alpha (2026-10-21) : l'assistant est ACTIF par défaut. Un compte
-- qui s'ouvre ne doit pas attendre qu'on trouve l'interrupteur dans les
-- préférences : le tri, la structuration et l'échange démarrent avec l'accès.
-- Les comptes existants ne sont pas touchés — un assistant coupé par un
-- administrateur reste coupé ; l'ouverture de l'accès (`activateAccount`)
-- allume l'assistant des comptes en attente.
ALTER TABLE "accounts" ALTER COLUMN "assistant_enabled" SET DEFAULT true;
