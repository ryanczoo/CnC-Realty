-- AlterEnum
ALTER TYPE "FileActivityType" ADD VALUE 'COMMISSION_CHANGE_APPROVED';
ALTER TYPE "FileActivityType" ADD VALUE 'COMMISSION_CHANGE_REJECTED';

-- AlterTable
ALTER TABLE "ListingFile" ADD COLUMN     "pendingCommission" JSONB,
ADD COLUMN     "reviewSubmittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TransactionFile" ADD COLUMN     "pendingCommission" JSONB,
ADD COLUMN     "reviewSubmittedAt" TIMESTAMP(3);

-- Backfill: earliest submit-for-review activity per file
UPDATE "ListingFile" f SET "reviewSubmittedAt" = a.min FROM (SELECT "listingFileId", MIN("createdAt") AS min FROM "FileActivity" WHERE type = 'SUBMITTED_FOR_REVIEW' AND "listingFileId" IS NOT NULL GROUP BY 1) a WHERE a."listingFileId" = f.id;
UPDATE "TransactionFile" f SET "reviewSubmittedAt" = a.min FROM (SELECT "transactionFileId", MIN("createdAt") AS min FROM "FileActivity" WHERE type = 'SUBMITTED_FOR_REVIEW' AND "transactionFileId" IS NOT NULL GROUP BY 1) a WHERE a."transactionFileId" = f.id;
