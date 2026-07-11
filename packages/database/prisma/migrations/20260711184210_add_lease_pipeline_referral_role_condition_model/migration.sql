-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DealPipeline" ADD VALUE 'LEASE_TENANT';
ALTER TYPE "DealPipeline" ADD VALUE 'LEASE_LANDLORD';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DealStage" ADD VALUE 'SEARCHING';
ALTER TYPE "DealStage" ADD VALUE 'APPLICATION_SUBMITTED';
ALTER TYPE "DealStage" ADD VALUE 'APPLICATION_RECEIVED';
ALTER TYPE "DealStage" ADD VALUE 'LEASE_SIGNED';

-- AlterEnum
ALTER TYPE "FilePartyRole" ADD VALUE 'REFERRAL_AGENT';

-- AlterTable
ALTER TABLE "TransactionFile" ADD COLUMN     "annualTaxes" DOUBLE PRECISION,
ADD COLUMN     "deposit" DOUBLE PRECISION,
ADD COLUMN     "finalWalkthroughDate" TIMESTAMP(3),
ADD COLUMN     "leasePrice" DOUBLE PRECISION,
ADD COLUMN     "legalDescription" TEXT,
ADD COLUMN     "offerExpirationDate" TIMESTAMP(3),
ADD COLUMN     "photoKey" TEXT,
ADD COLUMN     "possessionDate" TIMESTAMP(3),
ADD COLUMN     "propertyExcludes" TEXT,
ADD COLUMN     "propertyIncludes" TEXT,
ADD COLUMN     "schoolDistrict" TEXT,
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "zoningClass" TEXT;

-- CreateTable
CREATE TABLE "FileCondition" (
    "id" TEXT NOT NULL,
    "transactionFileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileCondition_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FileCondition" ADD CONSTRAINT "FileCondition_transactionFileId_fkey" FOREIGN KEY ("transactionFileId") REFERENCES "TransactionFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
