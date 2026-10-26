-- AlterEnum
ALTER TYPE "FileActivityType" ADD VALUE 'CHECKLIST_UPDATED';

-- AlterTable
ALTER TABLE "ListingFile" ADD COLUMN     "propertyType" TEXT,
ADD COLUMN     "yearBuilt" INTEGER;

-- AlterTable
ALTER TABLE "ChecklistTemplateItem" ADD COLUMN     "builtBefore" INTEGER;

-- AlterTable
ALTER TABLE "FileChecklistItem" ADD COLUMN     "builtBefore" INTEGER;
