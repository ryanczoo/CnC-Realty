-- CreateEnum
CREATE TYPE "DealPipeline" AS ENUM ('BUYERS', 'SELLERS');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('PRE_APPROVAL', 'TOURING', 'OFFER_SUBMITTED', 'LISTING_APPOINTMENT', 'ACTIVE_LISTING', 'OFFER_ACCEPTED', 'FALLEN_OUT');

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "pipeline" "DealPipeline" NOT NULL,
    "stage" "DealStage" NOT NULL,
    "propertyAddress" TEXT,
    "price" DOUBLE PRECISION,
    "expectedCloseDate" TIMESTAMP(3),
    "notes" TEXT,
    "transactionFileId" TEXT,
    "stageUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deal_transactionFileId_key" ON "Deal"("transactionFileId");

-- CreateIndex
CREATE INDEX "Deal_agentId_idx" ON "Deal"("agentId");

-- CreateIndex
CREATE INDEX "Deal_leadId_idx" ON "Deal"("leadId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_transactionFileId_fkey" FOREIGN KEY ("transactionFileId") REFERENCES "TransactionFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
