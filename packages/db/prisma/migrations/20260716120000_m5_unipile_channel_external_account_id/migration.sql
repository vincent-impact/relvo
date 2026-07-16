-- M5 — Ingestion email via Unipile (backbone unifié email + WhatsApp).
--
-- 1) channel_configs.external_account_id : identifiant du compte chez le
--    fournisseur d'intégration (Unipile `account_id`, ex. `acc_imap_…`).
--    C'est la CLÉ de résolution du tenant dans le webhook Unipile, qui arrive
--    NON authentifié : on ne connaît pas encore l'accountId, on le retrouve via
--    ce champ (accès Prisma hors tenant, comme le cron M4.6). Unique global.
ALTER TABLE "channel_configs" ADD COLUMN "external_account_id" TEXT;

CREATE UNIQUE INDEX "channel_configs_external_account_id_key"
    ON "channel_configs" ("external_account_id");

-- 2) Idempotence des webhooks : un provider rejoue ses livraisons. Un même
--    (channel_id, external_id) ne peut créer qu'un seul Message. Postgres
--    autorise plusieurs NULL sur un index unique → les messages sans id externe
--    (créés en interne) ne sont pas contraints. La dédup applicative reste en
--    ceinture-bretelles côté route webhook (findFirst par external_id).
CREATE UNIQUE INDEX "messages_channel_id_external_id_key"
    ON "messages" ("channel_id", "external_id");
