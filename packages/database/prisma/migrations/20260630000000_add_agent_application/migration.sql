-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('SALESPERSON', 'BROKER_ASSOCIATE');

-- CreateEnum
CREATE TYPE "CommissionEntity" AS ENUM ('PERSONAL', 'LLC', 'S_CORP', 'C_CORP');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "setupToken" TEXT,
ADD COLUMN     "setupTokenExpiry" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AgentApplication" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "dateOfBirth" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseType" "LicenseType" NOT NULL,
    "licenseExpDate" TEXT NOT NULL,
    "yearsLicensed" INTEGER NOT NULL,
    "formerBrokerage" TEXT NOT NULL,
    "boardOfRealtors" TEXT,
    "mlsId" TEXT,
    "hasActiveListings" BOOLEAN NOT NULL,
    "hasActiveSales" BOOLEAN NOT NULL,
    "commissionEntity" "CommissionEntity" NOT NULL,
    "hasDisciplinaryHistory" BOOLEAN NOT NULL,
    "disciplinaryExplain" TEXT,
    "hasInvestigationHistory" BOOLEAN NOT NULL,
    "investigationExplain" TEXT,
    "backgroundCheckConsent" BOOLEAN NOT NULL,
    "drePerJuryCert" BOOLEAN NOT NULL,
    "specialties" TEXT[],
    "bio" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "icaOpenedAt" TIMESTAMP(3) NOT NULL,
    "icaAgreedAt" TIMESTAMP(3) NOT NULL,
    "submissionIp" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "AgentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_setupToken_key" ON "User"("setupToken");
