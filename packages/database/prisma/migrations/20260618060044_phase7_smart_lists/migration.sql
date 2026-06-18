-- CreateTable
CREATE TABLE "SmartList" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmartList_agentId_idx" ON "SmartList"("agentId");

-- AddForeignKey
ALTER TABLE "SmartList" ADD CONSTRAINT "SmartList_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
