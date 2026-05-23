-- Remove rawData column (was storing full RESO JSON per property — 80k rows × ~50KB = disk killer)
-- Agent attribution fields are promoted to proper columns instead
ALTER TABLE "Property" DROP COLUMN IF EXISTS "rawData";
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "listAgentName" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "listAgentLicense" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "listOfficeName" TEXT;
