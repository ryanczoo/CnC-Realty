-- AlterTable
ALTER TABLE "Agent" ALTER COLUMN "specialties" DROP DEFAULT;

-- CreateTable
CREATE TABLE "DripStep" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DripStep_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DripStep" ADD CONSTRAINT "DripStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
