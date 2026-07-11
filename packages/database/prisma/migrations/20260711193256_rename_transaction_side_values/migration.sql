-- Rename existing enum values (safe for any row currently using them)
ALTER TYPE "TransactionSide" RENAME VALUE 'BUYER_SIDE' TO 'PURCHASE';
ALTER TYPE "TransactionSide" RENAME VALUE 'SELLER_SIDE' TO 'LISTING';
ALTER TYPE "TransactionSide" RENAME VALUE 'LEASE' TO 'LEASE_TENANT';

-- Add new enum values
ALTER TYPE "TransactionSide" ADD VALUE 'LEASE_LANDLORD';
ALTER TYPE "TransactionSide" ADD VALUE 'LEASE_DUAL';
ALTER TYPE "TransactionSide" ADD VALUE 'REFERRAL';

-- Migrate ChecklistTemplate.transactionSide — a loose String column, not enum-bound,
-- so it will NOT be renamed automatically by the ALTER TYPE statements above.
UPDATE "ChecklistTemplate" SET "transactionSide" = 'PURCHASE' WHERE "transactionSide" = 'BUYER_SIDE';
UPDATE "ChecklistTemplate" SET "transactionSide" = 'LISTING' WHERE "transactionSide" = 'SELLER_SIDE';
UPDATE "ChecklistTemplate" SET "transactionSide" = 'LEASE_TENANT' WHERE "transactionSide" = 'LEASE';
