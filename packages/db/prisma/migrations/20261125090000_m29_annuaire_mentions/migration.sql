-- M29.1, M29.2 — l'annuaire des identifiants de messagerie, et le drapeau
-- « ce message mentionne le dirigeant » sur un message.
CREATE TABLE "messaging_identities" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "internal_id" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT,
    "is_self" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "messaging_identities_channel_id_internal_id_key" ON "messaging_identities"("channel_id", "internal_id");
CREATE INDEX "messaging_identities_account_id_phone_idx" ON "messaging_identities"("account_id", "phone");

ALTER TABLE "messaging_identities" ADD CONSTRAINT "messaging_identities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messaging_identities" ADD CONSTRAINT "messaging_identities_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages" ADD COLUMN "mentions_self" BOOLEAN NOT NULL DEFAULT false;
