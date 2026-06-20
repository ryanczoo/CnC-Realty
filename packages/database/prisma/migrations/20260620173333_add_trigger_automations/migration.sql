-- CreateEnum
CREATE TYPE "TriggerActionType" AS ENUM ('ENROLL_PLAN', 'SEND_EMAIL');

-- CreateTable
CREATE TABLE "Trigger" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "statusTrigger" "LeadStatus" NOT NULL,
    "actionType" "TriggerActionType" NOT NULL,
    "actionPlanId" TEXT,
    "emailSubject" TEXT,
    "emailBody" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriggerExecution" (
    "id" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TriggerExecution_triggerId_leadId_key" ON "TriggerExecution"("triggerId", "leadId");

-- AddForeignKey
ALTER TABLE "Trigger" ADD CONSTRAINT "Trigger_actionPlanId_fkey" FOREIGN KEY ("actionPlanId") REFERENCES "ActionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerExecution" ADD CONSTRAINT "TriggerExecution_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "Trigger"("id") ON DELETE CASCADE ON UPDATE CASCADE;
