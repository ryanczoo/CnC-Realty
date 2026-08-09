-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "emailOptOut" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");
