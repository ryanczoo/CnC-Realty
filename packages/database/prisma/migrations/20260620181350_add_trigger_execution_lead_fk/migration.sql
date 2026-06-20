-- AddForeignKey
ALTER TABLE "TriggerExecution" ADD CONSTRAINT "TriggerExecution_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
