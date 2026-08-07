-- CreateTable
CREATE TABLE "SyncProgress" (
    "id" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "nextLink" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncProgress_syncType_key" ON "SyncProgress"("syncType");
