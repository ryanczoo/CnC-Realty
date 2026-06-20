-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "assignmentSeenAt" TIMESTAMP(3),
ADD COLUMN     "brokerageFed" BOOLEAN NOT NULL DEFAULT false;
