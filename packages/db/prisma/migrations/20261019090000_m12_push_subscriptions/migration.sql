-- M12.7 / M12.9 — les abonnements push : un appareil qui reçoit les
-- notifications de Relvo (le brief du matin, une question qui s'ouvre).
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "last_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

CREATE INDEX "push_subscriptions_account_id_idx" ON "push_subscriptions"("account_id");

ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
