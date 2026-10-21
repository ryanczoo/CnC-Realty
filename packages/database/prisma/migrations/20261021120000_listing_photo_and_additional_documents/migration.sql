-- Additive only: a nullable column and a defaulted boolean, no table rewrite.
-- Safe for the live code, which never reads either column.
ALTER TABLE "ListingFile" ADD COLUMN "photoKey" TEXT;
ALTER TABLE "FileDocument" ADD COLUMN "isAdditional" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: not on a checklist item and never removed from one = added through
-- the Checklist tab's Additional Documents. Removed ones stay "Unattached".
UPDATE "FileDocument" d SET "isAdditional" = true
WHERE d."checklistItemId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "FileActivity" a
    WHERE a."type" = 'DOCUMENT_REMOVED' AND a."payload"->>'documentId' = d."id"
  );
