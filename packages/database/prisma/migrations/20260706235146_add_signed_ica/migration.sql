-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "signedIcaKey" TEXT;

-- AlterTable
ALTER TABLE "AgentApplication" ADD COLUMN     "icaVersion" TEXT,
ADD COLUMN     "signedIcaKey" TEXT,
ADD COLUMN     "signedName" TEXT;
