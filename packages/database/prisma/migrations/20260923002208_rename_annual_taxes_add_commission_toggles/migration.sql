/*
  Warnings:

  - You are about to drop the column `annualTaxes` on the `TransactionFile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TransactionFile" DROP COLUMN "annualTaxes",
ADD COLUMN     "agentRelativeSale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "brokerProvidedLead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "numberOfParcels" INTEGER;
