/*
  Warnings:

  - You are about to drop the `Document` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Transaction` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('INCOMPLETE', 'COMING_SOON', 'ACTIVE', 'ACTIVE_UNDER_CONTRACT', 'EXPIRED', 'WITHDRAWN', 'CANCELED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TransactionFileStatus" AS ENUM ('INCOMPLETE', 'PRE_CONTRACT', 'PENDING', 'EXPIRED', 'CLOSED', 'ARCHIVED', 'CANCELED_PENDING', 'CANCELED_APPROVED');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('LISTING', 'TRANSACTION');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('RESIDENTIAL_SALE', 'RESIDENTIAL_LEASE', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "TransactionSide" AS ENUM ('BUYER_SIDE', 'SELLER_SIDE', 'DUAL', 'LEASE');

-- CreateEnum
CREATE TYPE "FilePartyRole" AS ENUM ('BUYER', 'SELLER', 'LISTING_AGENT', 'BUYERS_AGENT', 'CO_AGENT', 'TITLE_ESCROW', 'LENDER', 'TRANSACTION_COORDINATOR', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'NOT_SUBMITTED');

-- CreateEnum
CREATE TYPE "FileActivityType" AS ENUM ('FILE_CREATED', 'STATUS_CHANGED', 'DOCUMENT_UPLOADED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED', 'SUBMITTED_FOR_REVIEW', 'PARTY_ADDED', 'NOTE_ADDED', 'CONVERTED_TO_TRANSACTION');

-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_agentId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_leadId_fkey";

-- DropTable
DROP TABLE "Document";

-- DropTable
DROP TABLE "Transaction";

-- DropEnum
DROP TYPE "TransactionStatus";

-- CreateTable
CREATE TABLE "ListingFile" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "propertyAddress" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'CA',
    "zip" TEXT NOT NULL,
    "mlsNumber" TEXT,
    "listPrice" DOUBLE PRECISION NOT NULL,
    "listingType" "ListingType" NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "expirationDate" TIMESTAMP(3),
    "listDate" TIMESTAMP(3),
    "commissionPercent" DOUBLE PRECISION,
    "commissionNotes" TEXT,
    "awaitingReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionFile" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "originatingListingId" TEXT,
    "originatingLeadId" TEXT,
    "propertyAddress" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'CA',
    "zip" TEXT NOT NULL,
    "mlsNumber" TEXT,
    "transactionSide" "TransactionSide" NOT NULL,
    "status" "TransactionFileStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "listPrice" DOUBLE PRECISION,
    "salePrice" DOUBLE PRECISION,
    "offerDate" TIMESTAMP(3),
    "acceptanceDate" TIMESTAMP(3),
    "inspectionDeadline" TIMESTAMP(3),
    "appraisalDeadline" TIMESTAMP(3),
    "loanApprovalDeadline" TIMESTAMP(3),
    "closeOfEscrow" TIMESTAMP(3),
    "commissionGCI" DOUBLE PRECISION,
    "commissionSplit" DOUBLE PRECISION,
    "commissionNotes" TEXT,
    "awaitingReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileParty" (
    "id" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "listingFileId" TEXT,
    "transactionFileId" TEXT,
    "role" "FilePartyRole" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "licenseNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "transactionSide" TEXT NOT NULL DEFAULT 'ALL',
    "listingType" TEXT NOT NULL DEFAULT 'ALL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileChecklistItem" (
    "id" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "listingFileId" TEXT,
    "transactionFileId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FileChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileDocument" (
    "id" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "listingFileId" TEXT,
    "transactionFileId" TEXT,
    "checklistItemId" TEXT,
    "name" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "r2Url" TEXT NOT NULL,
    "uploadedByAgentId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewStatus" "DocumentReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,

    CONSTRAINT "FileDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileActivity" (
    "id" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "listingFileId" TEXT,
    "transactionFileId" TEXT,
    "actorId" TEXT NOT NULL,
    "actorRole" "UserRole" NOT NULL,
    "type" "FileActivityType" NOT NULL,
    "payload" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileActivity_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "TransactionFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingFile" ADD CONSTRAINT "ListingFile_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFile" ADD CONSTRAINT "TransactionFile_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFile" ADD CONSTRAINT "TransactionFile_originatingListingId_fkey" FOREIGN KEY ("originatingListingId") REFERENCES "ListingFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFile" ADD CONSTRAINT "TransactionFile_originatingLeadId_fkey" FOREIGN KEY ("originatingLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileParty" ADD CONSTRAINT "FileParty_listingFileId_fkey" FOREIGN KEY ("listingFileId") REFERENCES "ListingFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileParty" ADD CONSTRAINT "FileParty_transactionFileId_fkey" FOREIGN KEY ("transactionFileId") REFERENCES "TransactionFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileChecklistItem" ADD CONSTRAINT "FileChecklistItem_listingFileId_fkey" FOREIGN KEY ("listingFileId") REFERENCES "ListingFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileChecklistItem" ADD CONSTRAINT "FileChecklistItem_transactionFileId_fkey" FOREIGN KEY ("transactionFileId") REFERENCES "TransactionFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileDocument" ADD CONSTRAINT "FileDocument_listingFileId_fkey" FOREIGN KEY ("listingFileId") REFERENCES "ListingFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileDocument" ADD CONSTRAINT "FileDocument_transactionFileId_fkey" FOREIGN KEY ("transactionFileId") REFERENCES "TransactionFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileDocument" ADD CONSTRAINT "FileDocument_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "FileChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileDocument" ADD CONSTRAINT "FileDocument_uploadedByAgentId_fkey" FOREIGN KEY ("uploadedByAgentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileDocument" ADD CONSTRAINT "FileDocument_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileActivity" ADD CONSTRAINT "FileActivity_listingFileId_fkey" FOREIGN KEY ("listingFileId") REFERENCES "ListingFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileActivity" ADD CONSTRAINT "FileActivity_transactionFileId_fkey" FOREIGN KEY ("transactionFileId") REFERENCES "TransactionFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileActivity" ADD CONSTRAINT "FileActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
