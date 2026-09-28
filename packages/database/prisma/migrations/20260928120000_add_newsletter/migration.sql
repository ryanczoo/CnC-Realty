-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'NEWSLETTER';

-- CreateEnum
CREATE TYPE "CampaignAudience" AS ENUM ('SELECTED_LEADS', 'NEWSLETTER');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "newsletterSubscribedAt" TIMESTAMP(3),
ADD COLUMN "newsletterOptOut" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "audience" "CampaignAudience" NOT NULL DEFAULT 'SELECTED_LEADS';
