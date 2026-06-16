-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN     "authorId" TEXT,
ADD COLUMN     "authorName" TEXT;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
