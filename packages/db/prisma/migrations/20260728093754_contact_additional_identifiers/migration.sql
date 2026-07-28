-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "additional_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "additional_phones" TEXT[] DEFAULT ARRAY[]::TEXT[];
