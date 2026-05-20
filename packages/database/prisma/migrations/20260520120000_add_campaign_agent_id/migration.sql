-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "agentId" TEXT;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
