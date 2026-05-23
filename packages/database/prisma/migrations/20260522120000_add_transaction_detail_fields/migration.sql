-- Add SkySlope-style transaction detail fields
ALTER TABLE "TransactionFile" ADD COLUMN "propertyType" TEXT;
ALTER TABLE "TransactionFile" ADD COLUMN "yearBuilt" INTEGER;
ALTER TABLE "TransactionFile" ADD COLUMN "escrowNumber" TEXT;
ALTER TABLE "TransactionFile" ADD COLUMN "saleCommissionPct" DOUBLE PRECISION;
ALTER TABLE "TransactionFile" ADD COLUMN "listingCommissionPct" DOUBLE PRECISION;
ALTER TABLE "TransactionFile" ADD COLUMN "otherDeductions" DOUBLE PRECISION;
