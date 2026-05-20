-- AlterTable: add profile fields to Agent
ALTER TABLE "Agent" ADD COLUMN "displayName"  TEXT;
ALTER TABLE "Agent" ADD COLUMN "licenseState" TEXT DEFAULT 'CA';
ALTER TABLE "Agent" ADD COLUMN "yearsExp"     INTEGER;
ALTER TABLE "Agent" ADD COLUMN "specialties"  TEXT[] DEFAULT ARRAY[]::TEXT[];
