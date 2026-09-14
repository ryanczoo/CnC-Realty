-- AlterEnum
ALTER TYPE "ListingStatus" ADD VALUE 'PENDING_TRANSFER';

-- AlterEnum
ALTER TYPE "TransactionFileStatus" ADD VALUE 'PENDING_TRANSFER';

-- AlterTable
ALTER TABLE "AgentApplication" ADD COLUMN     "activeListingsCount" INTEGER,
ADD COLUMN     "activeSalesCount" INTEGER;
