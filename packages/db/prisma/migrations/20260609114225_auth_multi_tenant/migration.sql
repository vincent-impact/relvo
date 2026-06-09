-- CreateEnum
CREATE TYPE "VerificationTokenType" AS ENUM ('email_verification', 'password_reset');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "email_verified" TIMESTAMP(3),
ADD COLUMN     "google_id" TEXT,
ADD COLUMN     "image" TEXT,
ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" "VerificationTokenType" NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE INDEX "verification_tokens_identifier_idx" ON "verification_tokens"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_google_id_key" ON "accounts"("google_id");

