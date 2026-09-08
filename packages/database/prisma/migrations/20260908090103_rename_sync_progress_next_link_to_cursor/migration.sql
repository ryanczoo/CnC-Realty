/*
  Warnings:

  - You are about to drop the column `nextLink` on the `SyncProgress` table. All the data in the column will be lost.
  - Added the required column `cursor` to the `SyncProgress` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SyncProgress" DROP COLUMN "nextLink",
ADD COLUMN     "cursor" TEXT NOT NULL;
