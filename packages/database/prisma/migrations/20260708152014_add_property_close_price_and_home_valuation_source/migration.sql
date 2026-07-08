-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'HOME_VALUATION';

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "closeDate" TIMESTAMP(3),
ADD COLUMN     "closePrice" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Property_status_zip_closeDate_idx" ON "Property"("status", "zip", "closeDate");
