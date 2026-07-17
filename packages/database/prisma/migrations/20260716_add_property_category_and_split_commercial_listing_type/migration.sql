-- CreateEnum PropertyCategory
CREATE TYPE "PropertyCategory" AS ENUM ('RESIDENTIAL', 'COMMERCIAL');

-- AlterEnum ListingType - migrate from old enum to new enum
-- Cast the column to text temporarily, drop the old type, create the new type, and cast back
ALTER TABLE "ListingFile" ALTER COLUMN "listingType" TYPE text;
DROP TYPE "ListingType";
CREATE TYPE "ListingType" AS ENUM ('RESIDENTIAL_SALE', 'RESIDENTIAL_LEASE', 'COMMERCIAL_SALE', 'COMMERCIAL_LEASE');
ALTER TABLE "ListingFile" ALTER COLUMN "listingType" TYPE "ListingType" USING "listingType"::"ListingType";
ALTER TABLE "ListingFile" ALTER COLUMN "listingType" SET DEFAULT 'RESIDENTIAL_SALE'::"ListingType";

-- AddColumn to TransactionFile
ALTER TABLE "TransactionFile" ADD COLUMN "propertyCategory" "PropertyCategory" NOT NULL DEFAULT 'RESIDENTIAL';

-- AddColumn to ChecklistTemplate
ALTER TABLE "ChecklistTemplate" ADD COLUMN "propertyCategory" TEXT NOT NULL DEFAULT 'ALL';
