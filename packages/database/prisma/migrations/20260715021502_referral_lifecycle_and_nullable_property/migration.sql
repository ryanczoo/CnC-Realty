-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionFileStatus" ADD VALUE 'REFERRAL_SUCCESSFUL';
ALTER TYPE "TransactionFileStatus" ADD VALUE 'REFERRAL_UNSUCCESSFUL';
ALTER TYPE "TransactionFileStatus" ADD VALUE 'REFERRAL_BROKER_REVIEW';

-- AlterTable
ALTER TABLE "TransactionFile" ADD COLUMN     "dateReferred" TIMESTAMP(3),
ADD COLUMN     "referralAmountReceived" DOUBLE PRECISION,
ADD COLUMN     "referralCncFee" DOUBLE PRECISION,
ADD COLUMN     "referredToAgentName" TEXT,
ADD COLUMN     "referredToBrokerageName" TEXT,
ADD COLUMN     "referredToContactEmail" TEXT,
ADD COLUMN     "referredToContactPhone" TEXT,
ALTER COLUMN "propertyAddress" DROP NOT NULL,
ALTER COLUMN "city" DROP NOT NULL,
ALTER COLUMN "zip" DROP NOT NULL;
