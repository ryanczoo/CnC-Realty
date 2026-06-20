-- CreateEnum
CREATE TYPE "PlanStepType" AS ENUM ('EMAIL', 'TASK');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PausedReason" AS ENUM ('REPLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "PlanStepStatus" AS ENUM ('PENDING', 'DONE', 'SKIPPED', 'PAUSED');

-- CreateTable
CREATE TABLE "ActionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionPlanStep" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "stepType" "PlanStepType" NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "taskTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionPlanStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadPlanEnrollment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" TIMESTAMP(3),
    "pausedReason" "PausedReason",
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LeadPlanEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadPlanStep" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "stepType" "PlanStepType" NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "taskTitle" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "PlanStepStatus" NOT NULL DEFAULT 'PENDING',
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "LeadPlanStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadPlanStep_status_dueAt_idx" ON "LeadPlanStep"("status", "dueAt");

-- AddForeignKey
ALTER TABLE "ActionPlanStep" ADD CONSTRAINT "ActionPlanStep_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ActionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadPlanEnrollment" ADD CONSTRAINT "LeadPlanEnrollment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadPlanEnrollment" ADD CONSTRAINT "LeadPlanEnrollment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ActionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadPlanEnrollment" ADD CONSTRAINT "LeadPlanEnrollment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadPlanStep" ADD CONSTRAINT "LeadPlanStep_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "LeadPlanEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
