-- CreateTable
CREATE TABLE "FileTask" (
    "id" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "listingFileId" TEXT,
    "transactionFileId" TEXT,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "assigneeName" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileTask_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FileTask" ADD CONSTRAINT "FileTask_listingFileId_fkey" FOREIGN KEY ("listingFileId") REFERENCES "ListingFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileTask" ADD CONSTRAINT "FileTask_transactionFileId_fkey" FOREIGN KEY ("transactionFileId") REFERENCES "TransactionFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
