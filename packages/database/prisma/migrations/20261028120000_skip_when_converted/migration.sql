-- AlterEnum
ALTER TYPE "FileActivityType" ADD VALUE 'REPRESENTATION_CHANGED';

-- AlterTable
ALTER TABLE "ChecklistTemplateItem" ADD COLUMN     "skipWhenConverted" BOOLEAN NOT NULL DEFAULT false;
