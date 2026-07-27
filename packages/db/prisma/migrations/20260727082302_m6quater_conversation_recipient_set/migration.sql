-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "contact_ids" UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN     "participants_raw" TEXT[] DEFAULT ARRAY[]::TEXT[];
