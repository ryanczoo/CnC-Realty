-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "actionPlanOptOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "campaignOptOut" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "propertyAlertOptOut" BOOLEAN NOT NULL DEFAULT false;

-- Carry existing opt-outs onto the category columns. Property alerts go to
-- User, campaigns and drips to Lead, so each side backfills only what it can
-- actually receive. actionPlanOptOut inherits the same value as campaignOptOut
-- because the old single flag suppressed both.
UPDATE "Lead" SET "campaignOptOut" = "emailOptOut", "actionPlanOptOut" = "emailOptOut";
UPDATE "User" SET "propertyAlertOptOut" = "emailOptOut";
