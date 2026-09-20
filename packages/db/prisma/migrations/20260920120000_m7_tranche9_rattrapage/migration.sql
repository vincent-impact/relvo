-- Le rattrapage du courrier récent d'un canal (M7.19, tranche 9) : une ligne
-- par rattrapage demandé — la fenêtre lue, l'avancement, ce que Relvo en a
-- fait, le coût, et pourquoi ça s'est arrêté. Demandé à la connexion d'un
-- canal e-mail, exécuté la nuit par le cron, repris tant que la ligne n'est
-- pas close.
CREATE TYPE "CatchupStatus" AS ENUM ('pending', 'running', 'done', 'capped', 'failed');

CREATE TABLE "channel_catchups" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "status" "CatchupStatus" NOT NULL DEFAULT 'pending',
    "since" TIMESTAMP(3) NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "runs" INTEGER NOT NULL DEFAULT 0,
    "import_done" BOOLEAN NOT NULL DEFAULT false,
    "messages_imported" INTEGER NOT NULL DEFAULT 0,
    "messages_triaged" INTEGER NOT NULL DEFAULT 0,
    "subjects_opened" INTEGER NOT NULL DEFAULT 0,
    "conversations_ignored" INTEGER NOT NULL DEFAULT 0,
    "cost_eur" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stop_reason" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_catchups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "channel_catchups_account_id_idx" ON "channel_catchups"("account_id");
CREATE INDEX "channel_catchups_channel_id_requested_at_idx" ON "channel_catchups"("channel_id", "requested_at");
CREATE INDEX "channel_catchups_status_idx" ON "channel_catchups"("status");

ALTER TABLE "channel_catchups" ADD CONSTRAINT "channel_catchups_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_catchups" ADD CONSTRAINT "channel_catchups_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
