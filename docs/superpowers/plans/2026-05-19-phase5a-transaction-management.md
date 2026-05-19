# Phase 5A Transaction Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a SkySlope-equivalent transaction management system with ListingFile + TransactionFile types, broker-configurable document checklists, Cloudflare R2 document storage, and a compliance review workflow.

**Architecture:** Two polymorphic file types share documents, parties, checklist items, and activity log via nullable foreign keys. Status machines are enforced server-side. Broker reviews documents via an Audit Queue and can close files only when all required checklist items have an APPROVED document.

**Tech Stack:** Next.js 14 App Router, Prisma + PostgreSQL (Railway), Cloudflare R2 (AWS SDK v3), SendGrid, shadcn/ui, Tailwind CSS, Vitest.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/database/prisma/schema.prisma` | Modify | Add all new models + rename Transaction→TransactionFile |
| `apps/web/src/lib/r2.ts` | Create | R2 presigned URL helpers |
| `apps/web/src/types/transaction.ts` | Create | Shared TS enums + interfaces |
| `apps/web/src/lib/transaction-helpers.ts` | Create | Status transition guards, checklist progress |
| `apps/web/src/lib/email/transaction-emails.ts` | Create | 5 notification email functions |
| `apps/web/src/app/api/listings/route.ts` | Create | POST create + GET list |
| `apps/web/src/app/api/listings/[id]/route.ts` | Create | GET + PATCH + DELETE |
| `apps/web/src/app/api/listings/[id]/convert/route.ts` | Create | POST convert → transaction |
| `apps/web/src/app/api/listings/[id]/submit-review/route.ts` | Create | POST submit for review |
| `apps/web/src/app/api/transactions/route.ts` | Create | POST create + GET list |
| `apps/web/src/app/api/transactions/[id]/route.ts` | Create | GET + PATCH |
| `apps/web/src/app/api/transactions/[id]/submit-review/route.ts` | Create | POST submit for review |
| `apps/web/src/app/api/files/[fileType]/[id]/parties/route.ts` | Create | POST add party |
| `apps/web/src/app/api/files/[fileType]/[id]/parties/[partyId]/route.ts` | Create | PATCH + DELETE |
| `apps/web/src/app/api/upload-url/route.ts` | Create | GET presigned PUT URL |
| `apps/web/src/app/api/documents/route.ts` | Create | POST register document |
| `apps/web/src/app/api/documents/[id]/route.ts` | Create | DELETE document |
| `apps/web/src/app/api/documents/[id]/download/route.ts` | Create | GET presigned download URL |
| `apps/web/src/app/api/admin/documents/[id]/approve/route.ts` | Create | POST approve |
| `apps/web/src/app/api/admin/documents/[id]/reject/route.ts` | Create | POST reject |
| `apps/web/src/app/api/admin/audit-queue/route.ts` | Create | GET files awaiting review |
| `apps/web/src/app/api/admin/files/[fileType]/[id]/status/route.ts` | Create | PATCH status override |
| `apps/web/src/app/api/admin/checklist-templates/route.ts` | Create | GET + POST templates |
| `apps/web/src/app/api/admin/checklist-templates/[id]/route.ts` | Create | PATCH update |
| `apps/web/src/app/api/admin/checklist-templates/[id]/items/route.ts` | Create | POST add item |
| `apps/web/src/app/api/admin/checklist-templates/[id]/items/[itemId]/route.ts` | Create | PATCH + DELETE |
| `apps/web/src/app/(dashboard)/layout.tsx` | Modify | Add Transactions to sidebar nav |
| `apps/web/src/components/transactions/StatusBadge.tsx` | Create | Colored status chip |
| `apps/web/src/components/transactions/FileCard.tsx` | Create | Card for files grid |
| `apps/web/src/components/transactions/ChecklistPanel.tsx` | Create | Per-item upload rows |
| `apps/web/src/components/transactions/PartiesTable.tsx` | Create | Parties with add/edit/remove |
| `apps/web/src/components/transactions/ActivityFeed.tsx` | Create | Chronological activity log |
| `apps/web/src/components/transactions/DocumentReviewCard.tsx` | Create | Admin approve/reject per doc |
| `apps/web/src/components/transactions/ChecklistTemplateEditor.tsx` | Create | Admin template item manager |
| `apps/web/src/app/(dashboard)/dashboard/transactions/page.tsx` | Create | Listings/Transactions tab switcher |
| `apps/web/src/app/(dashboard)/dashboard/transactions/new-listing/page.tsx` | Create | Multi-step listing creation form |
| `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx` | Create | Multi-step transaction creation form |
| `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx` | Create | Agent file detail (4 tabs) |
| `apps/web/src/app/(dashboard)/admin/transactions/page.tsx` | Create | Admin all-files + audit queue |
| `apps/web/src/app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx` | Create | Admin detail + broker controls |
| `apps/web/src/app/(dashboard)/admin/settings/checklists/page.tsx` | Create | Checklist template manager |

---

## Task 1: Install Dependencies + Vitest Setup

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`

- [ ] **Step 1: Install R2 SDK and Vitest**

```powershell
cd apps/web
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
pnpm add -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Create vitest config**

```typescript
// apps/web/vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Add test script to package.json**

In `apps/web/package.json`, add to `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 4: Verify setup**

```powershell
pnpm --filter web test
```
Expected: `No test files found`

- [ ] **Step 5: Commit**

```powershell
git add apps/web/package.json apps/web/vitest.config.ts
git commit -m "chore: add Vitest + AWS SDK v3 for Phase 5A"
```

---

## Task 2: Prisma Schema Migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Update schema.prisma**

Replace the `TransactionStatus` enum and `Transaction` model, update related models, and add all new models. Make the following changes to `packages/database/prisma/schema.prisma`:

**Remove** the old `TransactionStatus` enum block entirely.

**Remove** the old `Document` model entirely.

**Update** the `Agent` model: replace `transactions Transaction[]` with:
```prisma
  listingFiles     ListingFile[]
  transactionFiles TransactionFile[]
```

**Update** the `Lead` model: replace `transactions Transaction[]` with:
```prisma
  transactionFiles TransactionFile[]
```

**Update** the `Activity` model relation: replace `transaction Transaction?` with:
```prisma
  transaction TransactionFile? @relation(fields: [transactionId], references: [id], onDelete: Cascade)
```

**Add** these new enums after the existing enums:
```prisma
enum ListingStatus {
  INCOMPLETE
  COMING_SOON
  ACTIVE
  ACTIVE_UNDER_CONTRACT
  EXPIRED
  WITHDRAWN
  CANCELED
  CLOSED
}

enum TransactionFileStatus {
  INCOMPLETE
  PRE_CONTRACT
  PENDING
  EXPIRED
  CLOSED
  ARCHIVED
  CANCELED_PENDING
  CANCELED_APPROVED
}

enum FileType {
  LISTING
  TRANSACTION
}

enum ListingType {
  RESIDENTIAL_SALE
  RESIDENTIAL_LEASE
  COMMERCIAL
}

enum TransactionSide {
  BUYER_SIDE
  SELLER_SIDE
  DUAL
  LEASE
}

enum FilePartyRole {
  BUYER
  SELLER
  LISTING_AGENT
  BUYERS_AGENT
  CO_AGENT
  TITLE_ESCROW
  LENDER
  TRANSACTION_COORDINATOR
  OTHER
}

enum DocumentReviewStatus {
  PENDING_REVIEW
  APPROVED
  REJECTED
  NOT_SUBMITTED
}

enum FileActivityType {
  FILE_CREATED
  STATUS_CHANGED
  DOCUMENT_UPLOADED
  DOCUMENT_APPROVED
  DOCUMENT_REJECTED
  SUBMITTED_FOR_REVIEW
  PARTY_ADDED
  NOTE_ADDED
  CONVERTED_TO_TRANSACTION
}
```

**Replace** the old `Transaction` model with `TransactionFile` and add all new models:
```prisma
model ListingFile {
  id                String        @id @default(cuid())
  agentId           String
  propertyAddress   String
  city              String
  state             String        @default("CA")
  zip               String
  mlsNumber         String?
  listPrice         Float
  listingType       ListingType
  status            ListingStatus @default(INCOMPLETE)
  expirationDate    DateTime?
  listDate          DateTime?
  commissionPercent Float?
  commissionNotes   String?
  awaitingReview    Boolean       @default(false)
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  agent              Agent               @relation(fields: [agentId], references: [id])
  convertedFiles     TransactionFile[]
  parties            FileParty[]
  checklistItems     FileChecklistItem[]
  documents          FileDocument[]
  activities         FileActivity[]
}

model TransactionFile {
  id                   String                @id @default(cuid())
  agentId              String
  originatingListingId String?
  originatingLeadId    String?
  propertyAddress      String
  city                 String
  state                String                @default("CA")
  zip                  String
  mlsNumber            String?
  transactionSide      TransactionSide
  status               TransactionFileStatus @default(INCOMPLETE)
  listPrice            Float?
  salePrice            Float?
  offerDate            DateTime?
  acceptanceDate       DateTime?
  inspectionDeadline   DateTime?
  appraisalDeadline    DateTime?
  loanApprovalDeadline DateTime?
  closeOfEscrow        DateTime?
  commissionGCI        Float?
  commissionSplit      Float?
  commissionNotes      String?
  awaitingReview       Boolean               @default(false)
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt

  agent              Agent             @relation(fields: [agentId], references: [id])
  originatingListing ListingFile?      @relation(fields: [originatingListingId], references: [id])
  originatingLead    Lead?             @relation(fields: [originatingLeadId], references: [id])
  parties            FileParty[]
  checklistItems     FileChecklistItem[]
  documents          FileDocument[]
  activities         FileActivity[]
  crmActivities      Activity[]
}

model FileParty {
  id                String        @id @default(cuid())
  fileType          FileType
  listingFileId     String?
  transactionFileId String?
  role              FilePartyRole
  name              String
  email             String?
  phone             String?
  company           String?
  licenseNumber     String?
  createdAt         DateTime      @default(now())

  listingFile     ListingFile?     @relation(fields: [listingFileId], references: [id], onDelete: Cascade)
  transactionFile TransactionFile? @relation(fields: [transactionFileId], references: [id], onDelete: Cascade)
}

model ChecklistTemplate {
  id              String   @id @default(cuid())
  name            String
  fileType        FileType
  transactionSide String   @default("ALL")
  listingType     String   @default("ALL")
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  items ChecklistTemplateItem[]
}

model ChecklistTemplateItem {
  id          String  @id @default(cuid())
  templateId  String
  name        String
  description String?
  order       Int
  isRequired  Boolean @default(true)

  template ChecklistTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
}

model FileChecklistItem {
  id                String   @id @default(cuid())
  fileType          FileType
  listingFileId     String?
  transactionFileId String?
  name              String
  description       String?
  order             Int
  isRequired        Boolean  @default(true)

  listingFile     ListingFile?     @relation(fields: [listingFileId], references: [id], onDelete: Cascade)
  transactionFile TransactionFile? @relation(fields: [transactionFileId], references: [id], onDelete: Cascade)
  documents       FileDocument[]
}

model FileDocument {
  id                String               @id @default(cuid())
  fileType          FileType
  listingFileId     String?
  transactionFileId String?
  checklistItemId   String?
  name              String
  r2Key             String
  r2Url             String
  uploadedByAgentId String
  uploadedAt        DateTime             @default(now())
  reviewStatus      DocumentReviewStatus @default(PENDING_REVIEW)
  reviewedByAdminId String?
  reviewedAt        DateTime?
  rejectionNote     String?

  listingFile     ListingFile?       @relation(fields: [listingFileId], references: [id], onDelete: Cascade)
  transactionFile TransactionFile?   @relation(fields: [transactionFileId], references: [id], onDelete: Cascade)
  checklistItem   FileChecklistItem? @relation(fields: [checklistItemId], references: [id])
  uploadedBy      User               @relation("DocumentUploader", fields: [uploadedByAgentId], references: [id])
  reviewedBy      User?              @relation("DocumentReviewer", fields: [reviewedByAdminId], references: [id])
}

model FileActivity {
  id                String          @id @default(cuid())
  fileType          FileType
  listingFileId     String?
  transactionFileId String?
  actorId           String
  actorRole         UserRole
  type              FileActivityType
  payload           Json?
  note              String?
  createdAt         DateTime        @default(now())

  listingFile     ListingFile?     @relation(fields: [listingFileId], references: [id], onDelete: Cascade)
  transactionFile TransactionFile? @relation(fields: [transactionFileId], references: [id], onDelete: Cascade)
  actor           User             @relation("FileActivityActor", fields: [actorId], references: [id])
}
```

**Add** these new relation fields to the `User` model:
```prisma
  uploadedDocuments  FileDocument[]  @relation("DocumentUploader")
  reviewedDocuments  FileDocument[]  @relation("DocumentReviewer")
  fileActivities     FileActivity[]  @relation("FileActivityActor")
```

- [ ] **Step 2: Generate migration with custom SQL**

```powershell
pnpm --filter @cnc/database exec prisma migrate dev --create-only --name phase5a_transaction_management
```

This creates a file at `packages/database/prisma/migrations/<timestamp>_phase5a_transaction_management/migration.sql`. Open it and **prepend** these lines before any other SQL Prisma generated:

```sql
-- Rename Transaction table to TransactionFile (preserves all existing rows)
ALTER TABLE "Transaction" RENAME TO "TransactionFile";
ALTER INDEX "Transaction_pkey" RENAME TO "TransactionFile_pkey";
ALTER TABLE "Activity" RENAME COLUMN "transactionId" TO "transactionId";
```

Then ensure the rest of the Prisma-generated SQL does NOT include `DROP TABLE "Transaction"` or `CREATE TABLE "TransactionFile"` (remove those lines if present, since the rename handles it). Keep all `CREATE TABLE` statements for the new models.

- [ ] **Step 3: Apply the migration**

```powershell
pnpm --filter @cnc/database exec prisma migrate dev
```

Expected: `The following migration(s) have been applied: phase5a_transaction_management`

- [ ] **Step 4: Regenerate Prisma client**

```powershell
pnpm --filter @cnc/database exec prisma generate
```

- [ ] **Step 5: Verify types compile**

```powershell
pnpm --filter web build
```

Expected: Build passes with no type errors referencing `prisma.transaction` (there were none before).

- [ ] **Step 6: Commit**

```powershell
git add packages/database/prisma/
git commit -m "feat(db): Phase 5A schema — ListingFile, TransactionFile, checklists, documents, file activities"
```

---

## Task 3: R2 Client + Environment Variables

**Files:**
- Create: `apps/web/src/lib/r2.ts`
- Modify: `apps/web/.env.local` (manual — not committed)

- [ ] **Step 1: Add R2 env vars to .env.local**

Add these to `apps/web/.env.local` (get values from Cloudflare R2 dashboard):
```
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET=cnc-realty-documents
```

Create the R2 bucket named `cnc-realty-documents` in the Cloudflare dashboard with default settings (no public access).

- [ ] **Step 2: Create r2.ts**

```typescript
// apps/web/src/lib/r2.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.R2_BUCKET ?? "cnc-realty-documents";

// Returns a presigned PUT URL valid for 5 minutes
export async function getPresignedPutUrl(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 }
  );
}

// Returns a presigned GET URL valid for 15 minutes
export async function getPresignedGetUrl(key: string): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn: 900 }
  );
}

export async function deleteR2Object(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

export function buildR2Key(
  fileType: "listing" | "transaction",
  fileId: string,
  documentId: string,
  filename: string
): string {
  return `transactions/${fileType}/${fileId}/${documentId}/${filename}`;
}
```

- [ ] **Step 3: Commit**

```powershell
git add apps/web/src/lib/r2.ts
git commit -m "feat: Cloudflare R2 client with presigned URL helpers"
```

---

## Task 4: Shared Types + Business Logic Helpers

**Files:**
- Create: `apps/web/src/types/transaction.ts`
- Create: `apps/web/src/lib/transaction-helpers.ts`
- Create: `apps/web/src/lib/__tests__/transaction-helpers.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/src/lib/__tests__/transaction-helpers.test.ts
import { describe, it, expect } from "vitest";
import {
  canTransitionListing,
  canTransitionTransaction,
  getChecklistProgress,
} from "../transaction-helpers";
import type { FileChecklistItemWithDocs } from "@/types/transaction";

describe("canTransitionListing", () => {
  it("allows INCOMPLETE → ACTIVE", () => {
    expect(canTransitionListing("INCOMPLETE", "ACTIVE", "AGENT")).toBe(true);
  });
  it("blocks ACTIVE → CLOSED by agent", () => {
    expect(canTransitionListing("ACTIVE", "CLOSED", "AGENT")).toBe(false);
  });
  it("allows ACTIVE → CLOSED by admin", () => {
    expect(canTransitionListing("ACTIVE", "CLOSED", "ADMIN")).toBe(true);
  });
  it("blocks invalid transition CLOSED → ACTIVE", () => {
    expect(canTransitionListing("CLOSED", "ACTIVE", "ADMIN")).toBe(false);
  });
});

describe("canTransitionTransaction", () => {
  it("allows INCOMPLETE → PRE_CONTRACT by agent", () => {
    expect(canTransitionTransaction("INCOMPLETE", "PRE_CONTRACT", "AGENT")).toBe(true);
  });
  it("blocks PENDING → CLOSED by agent", () => {
    expect(canTransitionTransaction("PENDING", "CLOSED", "AGENT")).toBe(false);
  });
  it("allows PENDING → CLOSED by admin", () => {
    expect(canTransitionTransaction("PENDING", "CLOSED", "ADMIN")).toBe(true);
  });
});

describe("getChecklistProgress", () => {
  const makeItem = (isRequired: boolean, reviewStatus: string | null): FileChecklistItemWithDocs => ({
    id: "1",
    name: "Test",
    isRequired,
    documents: reviewStatus ? [{ reviewStatus } as any] : [],
  });

  it("returns 0/0 when no required items", () => {
    const result = getChecklistProgress([makeItem(false, "APPROVED")]);
    expect(result).toEqual({ satisfied: 0, required: 0 });
  });
  it("counts satisfied when doc is APPROVED", () => {
    const result = getChecklistProgress([makeItem(true, "APPROVED"), makeItem(true, null)]);
    expect(result).toEqual({ satisfied: 1, required: 2 });
  });
  it("counts PENDING_REVIEW as satisfied for submit eligibility", () => {
    const result = getChecklistProgress([makeItem(true, "PENDING_REVIEW")]);
    expect(result).toEqual({ satisfied: 1, required: 1 });
  });
  it("does not count REJECTED as satisfied", () => {
    const result = getChecklistProgress([makeItem(true, "REJECTED")]);
    expect(result).toEqual({ satisfied: 0, required: 1 });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```powershell
pnpm --filter web test
```
Expected: FAIL — `Cannot find module '../transaction-helpers'`

- [ ] **Step 3: Create transaction.ts types**

```typescript
// apps/web/src/types/transaction.ts
export type ListingStatus =
  | "INCOMPLETE" | "COMING_SOON" | "ACTIVE" | "ACTIVE_UNDER_CONTRACT"
  | "EXPIRED" | "WITHDRAWN" | "CANCELED" | "CLOSED";

export type TransactionFileStatus =
  | "INCOMPLETE" | "PRE_CONTRACT" | "PENDING" | "EXPIRED"
  | "CLOSED" | "ARCHIVED" | "CANCELED_PENDING" | "CANCELED_APPROVED";

export type FileType = "LISTING" | "TRANSACTION";
export type ListingType = "RESIDENTIAL_SALE" | "RESIDENTIAL_LEASE" | "COMMERCIAL";
export type TransactionSide = "BUYER_SIDE" | "SELLER_SIDE" | "DUAL" | "LEASE";
export type FilePartyRole =
  | "BUYER" | "SELLER" | "LISTING_AGENT" | "BUYERS_AGENT" | "CO_AGENT"
  | "TITLE_ESCROW" | "LENDER" | "TRANSACTION_COORDINATOR" | "OTHER";
export type DocumentReviewStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "NOT_SUBMITTED";
export type FileActivityType =
  | "FILE_CREATED" | "STATUS_CHANGED" | "DOCUMENT_UPLOADED" | "DOCUMENT_APPROVED"
  | "DOCUMENT_REJECTED" | "SUBMITTED_FOR_REVIEW" | "PARTY_ADDED" | "NOTE_ADDED"
  | "CONVERTED_TO_TRANSACTION";

export type ActorRole = "AGENT" | "ADMIN";

export interface FileChecklistItemWithDocs {
  id: string;
  name: string;
  description?: string | null;
  order?: number;
  isRequired: boolean;
  documents: { reviewStatus: DocumentReviewStatus }[];
}

export interface ChecklistProgress {
  satisfied: number;
  required: number;
}

export interface ListingFileDetail {
  id: string;
  agentId: string;
  propertyAddress: string;
  city: string;
  state: string;
  zip: string;
  mlsNumber: string | null;
  listPrice: number;
  listingType: ListingType;
  status: ListingStatus;
  expirationDate: string | null;
  listDate: string | null;
  commissionPercent: number | null;
  commissionNotes: string | null;
  awaitingReview: boolean;
  createdAt: string;
  updatedAt: string;
  parties: FilePartyRecord[];
  checklistItems: FileChecklistItemWithDocs[];
  documents: FileDocumentRecord[];
  activities: FileActivityRecord[];
}

export interface TransactionFileDetail {
  id: string;
  agentId: string;
  originatingListingId: string | null;
  originatingLeadId: string | null;
  propertyAddress: string;
  city: string;
  state: string;
  zip: string;
  mlsNumber: string | null;
  transactionSide: TransactionSide;
  status: TransactionFileStatus;
  listPrice: number | null;
  salePrice: number | null;
  offerDate: string | null;
  acceptanceDate: string | null;
  inspectionDeadline: string | null;
  appraisalDeadline: string | null;
  loanApprovalDeadline: string | null;
  closeOfEscrow: string | null;
  commissionGCI: number | null;
  commissionSplit: number | null;
  commissionNotes: string | null;
  awaitingReview: boolean;
  createdAt: string;
  updatedAt: string;
  parties: FilePartyRecord[];
  checklistItems: FileChecklistItemWithDocs[];
  documents: FileDocumentRecord[];
  activities: FileActivityRecord[];
}

export interface FilePartyRecord {
  id: string;
  role: FilePartyRole;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  licenseNumber: string | null;
}

export interface FileDocumentRecord {
  id: string;
  checklistItemId: string | null;
  name: string;
  r2Url: string;
  uploadedAt: string;
  reviewStatus: DocumentReviewStatus;
  rejectionNote: string | null;
}

export interface FileActivityRecord {
  id: string;
  actorId: string;
  actorRole: ActorRole;
  type: FileActivityType;
  payload: Record<string, unknown> | null;
  note: string | null;
  createdAt: string;
  actor: { name: string | null; email: string };
}
```

- [ ] **Step 4: Create transaction-helpers.ts**

```typescript
// apps/web/src/lib/transaction-helpers.ts
import type {
  ListingStatus,
  TransactionFileStatus,
  ActorRole,
  FileChecklistItemWithDocs,
  ChecklistProgress,
} from "@/types/transaction";

// Which statuses agents can set (admins can set any valid transition)
const AGENT_LISTING_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  INCOMPLETE:            ["COMING_SOON", "ACTIVE"],
  COMING_SOON:           ["ACTIVE", "WITHDRAWN", "CANCELED"],
  ACTIVE:                ["COMING_SOON", "ACTIVE_UNDER_CONTRACT", "EXPIRED", "WITHDRAWN", "CANCELED"],
  ACTIVE_UNDER_CONTRACT: ["ACTIVE", "WITHDRAWN", "CANCELED"],
  EXPIRED:               ["ACTIVE"],
  WITHDRAWN:             [],
  CANCELED:              [],
  CLOSED:                [],
};

const ADMIN_LISTING_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  INCOMPLETE:            ["COMING_SOON", "ACTIVE", "CANCELED"],
  COMING_SOON:           ["ACTIVE", "WITHDRAWN", "CANCELED"],
  ACTIVE:                ["COMING_SOON", "ACTIVE_UNDER_CONTRACT", "EXPIRED", "WITHDRAWN", "CANCELED", "CLOSED"],
  ACTIVE_UNDER_CONTRACT: ["ACTIVE", "CLOSED", "WITHDRAWN", "CANCELED"],
  EXPIRED:               ["ACTIVE", "CLOSED", "CANCELED"],
  WITHDRAWN:             ["ACTIVE", "CANCELED"],
  CANCELED:              [],
  CLOSED:                [],
};

const AGENT_TX_TRANSITIONS: Record<TransactionFileStatus, TransactionFileStatus[]> = {
  INCOMPLETE:        ["PRE_CONTRACT", "PENDING"],
  PRE_CONTRACT:      ["PENDING", "CANCELED_PENDING"],
  PENDING:           ["CANCELED_PENDING"],
  EXPIRED:           [],
  CLOSED:            [],
  ARCHIVED:          [],
  CANCELED_PENDING:  [],
  CANCELED_APPROVED: [],
};

const ADMIN_TX_TRANSITIONS: Record<TransactionFileStatus, TransactionFileStatus[]> = {
  INCOMPLETE:        ["PRE_CONTRACT", "PENDING", "CANCELED_APPROVED"],
  PRE_CONTRACT:      ["PENDING", "CANCELED_PENDING", "CANCELED_APPROVED"],
  PENDING:           ["CLOSED", "EXPIRED", "CANCELED_PENDING", "CANCELED_APPROVED"],
  EXPIRED:           ["PENDING", "CLOSED", "CANCELED_APPROVED"],
  CLOSED:            ["ARCHIVED"],
  ARCHIVED:          [],
  CANCELED_PENDING:  ["PENDING", "CANCELED_APPROVED"],
  CANCELED_APPROVED: [],
};

export function canTransitionListing(
  from: ListingStatus,
  to: ListingStatus,
  role: ActorRole
): boolean {
  const table = role === "ADMIN" ? ADMIN_LISTING_TRANSITIONS : AGENT_LISTING_TRANSITIONS;
  return table[from]?.includes(to) ?? false;
}

export function canTransitionTransaction(
  from: TransactionFileStatus,
  to: TransactionFileStatus,
  role: ActorRole
): boolean {
  const table = role === "ADMIN" ? ADMIN_TX_TRANSITIONS : AGENT_TX_TRANSITIONS;
  return table[from]?.includes(to) ?? false;
}

// An item is satisfied when it has at least one non-REJECTED document
export function isItemSatisfied(item: FileChecklistItemWithDocs): boolean {
  return item.documents.some(
    (d) => d.reviewStatus === "APPROVED" || d.reviewStatus === "PENDING_REVIEW"
  );
}

// Returns progress for submit-eligibility (PENDING_REVIEW counts as satisfied)
export function getChecklistProgress(items: FileChecklistItemWithDocs[]): ChecklistProgress {
  const required = items.filter((i) => i.isRequired);
  const satisfied = required.filter(isItemSatisfied);
  return { satisfied: satisfied.length, required: required.length };
}

// Returns true only when all required items have an APPROVED (not just PENDING_REVIEW) document
export function isReadyToClose(items: FileChecklistItemWithDocs[]): boolean {
  return items
    .filter((i) => i.isRequired)
    .every((i) => i.documents.some((d) => d.reviewStatus === "APPROVED"));
}
```

- [ ] **Step 5: Run tests — expect pass**

```powershell
pnpm --filter web test
```
Expected: `Tests 10 passed`

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/types/transaction.ts apps/web/src/lib/transaction-helpers.ts apps/web/src/lib/__tests__/transaction-helpers.test.ts
git commit -m "feat: transaction types, status transition helpers, and tests"
```

---

## Task 5: Email Notification Templates

**Files:**
- Create: `apps/web/src/lib/email/transaction-emails.ts`

- [ ] **Step 1: Create transaction-emails.ts**

```typescript
// apps/web/src/lib/email/transaction-emails.ts
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const FROM = "noreply@cncrealtygroup.com";
const BROKER_EMAIL = "info@cncrealtygroup.com";

export async function sendSubmitForReview(opts: {
  fileType: "Listing" | "Transaction";
  address: string;
  agentName: string;
  fileId: string;
}): Promise<void> {
  await sgMail.send({
    to: BROKER_EMAIL,
    from: FROM,
    subject: `[CnC] ${opts.fileType} File Ready for Review — ${opts.address}`,
    text: `${opts.agentName} has submitted a ${opts.fileType.toLowerCase()} file for compliance review.\n\nProperty: ${opts.address}\n\nReview at: https://cncrealtygroup.com/admin/transactions/${opts.fileType.toLowerCase()}/${opts.fileId}`,
  });
}

export async function sendDocumentRejected(opts: {
  agentEmail: string;
  agentName: string;
  documentName: string;
  address: string;
  rejectionNote: string;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  await sgMail.send({
    to: opts.agentEmail,
    from: FROM,
    subject: `[CnC] Document Rejected — ${opts.address}`,
    text: `Hi ${opts.agentName},\n\nThe document "${opts.documentName}" on your file for ${opts.address} was rejected by the broker.\n\nReason: ${opts.rejectionNote}\n\nPlease re-upload at: https://cncrealtygroup.com/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
}

export async function sendAllDocsApproved(opts: {
  agentEmail: string;
  agentName: string;
  address: string;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  await sgMail.send({
    to: opts.agentEmail,
    from: FROM,
    subject: `[CnC] All Documents Approved — ${opts.address}`,
    text: `Hi ${opts.agentName},\n\nAll required documents for ${opts.address} have been approved. The broker can now close this file.\n\nView file: https://cncrealtygroup.com/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
}

export async function sendFileClosed(opts: {
  agentEmail: string;
  agentName: string;
  address: string;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  await sgMail.send({
    to: opts.agentEmail,
    from: FROM,
    subject: `[CnC] File Closed — ${opts.address}`,
    text: `Hi ${opts.agentName},\n\nYour file for ${opts.address} has been marked as CLOSED by the broker. Congratulations!\n\nView file: https://cncrealtygroup.com/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
}

export async function sendFileExpirationWarning(opts: {
  agentEmail: string;
  agentName: string;
  address: string;
  expiresInDays: number;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  await sgMail.send({
    to: opts.agentEmail,
    from: FROM,
    subject: `[CnC] File Expiring Soon — ${opts.address}`,
    text: `Hi ${opts.agentName},\n\nYour file for ${opts.address} expires in ${opts.expiresInDays} day(s). Please take action.\n\nView file: https://cncrealtygroup.com/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
}
```

- [ ] **Step 2: Commit**

```powershell
git add apps/web/src/lib/email/transaction-emails.ts
git commit -m "feat: transaction notification email templates"
```

---

## Task 6: Listing API Routes

**Files:**
- Create: `apps/web/src/app/api/listings/route.ts`
- Create: `apps/web/src/app/api/listings/[id]/route.ts`
- Create: `apps/web/src/app/api/listings/[id]/convert/route.ts`
- Create: `apps/web/src/app/api/listings/[id]/submit-review/route.ts`

- [ ] **Step 1: Create listings list/create route**

```typescript
// apps/web/src/app/api/listings/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const listings = await prisma.listingFile.findMany({
    where: { agentId: agent.id },
    orderBy: { createdAt: "desc" },
    include: { checklistItems: { include: { documents: true } } },
  });

  return NextResponse.json({ listings });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const body = await req.json();
  const { propertyAddress, city, state, zip, mlsNumber, listPrice, listingType, expirationDate, listDate, commissionPercent, commissionNotes } = body;

  if (!propertyAddress || !city || !zip || !listPrice || !listingType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Find active matching template and snapshot its items
  const template = await prisma.checklistTemplate.findFirst({
    where: {
      fileType: "LISTING",
      isActive: true,
      OR: [{ listingType: listingType }, { listingType: "ALL" }],
    },
    include: { items: { orderBy: { order: "asc" } } },
  });

  const listing = await prisma.listingFile.create({
    data: {
      agentId: agent.id,
      propertyAddress, city, state: state ?? "CA", zip,
      mlsNumber: mlsNumber ?? null,
      listPrice: parseFloat(listPrice),
      listingType,
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      listDate: listDate ? new Date(listDate) : null,
      commissionPercent: commissionPercent ? parseFloat(commissionPercent) : null,
      commissionNotes: commissionNotes ?? null,
      checklistItems: template ? {
        create: template.items.map((item) => ({
          fileType: "LISTING",
          name: item.name,
          description: item.description,
          order: item.order,
          isRequired: item.isRequired,
        })),
      } : undefined,
      activities: {
        create: {
          fileType: "LISTING",
          actorId: session.user.id,
          actorRole: "AGENT",
          type: "FILE_CREATED",
        },
      },
    },
  });

  return NextResponse.json({ listing }, { status: 201 });
}
```

- [ ] **Step 2: Create listing detail route**

```typescript
// apps/web/src/app/api/listings/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canTransitionListing } from "@/lib/transaction-helpers";
import { sendFileClosed } from "@/lib/email/transaction-emails";

const INCLUDE = {
  parties: true,
  checklistItems: { include: { documents: true }, orderBy: { order: "asc" as const } },
  documents: { orderBy: { uploadedAt: "desc" as const } },
  activities: { include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" as const } },
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listingFile.findUnique({ where: { id: params.id }, include: INCLUDE });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && listing.agentId !== agent?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ listing });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listingFile.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && listing.agentId !== agent?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const role = isAdmin ? "ADMIN" : "AGENT";

  if (body.status && body.status !== listing.status) {
    if (!canTransitionListing(listing.status, body.status, role)) {
      return NextResponse.json({ error: `Cannot transition from ${listing.status} to ${body.status}` }, { status: 400 });
    }
  }

  const updated = await prisma.listingFile.update({
    where: { id: params.id },
    data: {
      ...(body.propertyAddress !== undefined && { propertyAddress: body.propertyAddress }),
      ...(body.city !== undefined && { city: body.city }),
      ...(body.zip !== undefined && { zip: body.zip }),
      ...(body.listPrice !== undefined && { listPrice: parseFloat(body.listPrice) }),
      ...(body.mlsNumber !== undefined && { mlsNumber: body.mlsNumber }),
      ...(body.expirationDate !== undefined && { expirationDate: body.expirationDate ? new Date(body.expirationDate) : null }),
      ...(body.listDate !== undefined && { listDate: body.listDate ? new Date(body.listDate) : null }),
      ...(body.commissionPercent !== undefined && { commissionPercent: body.commissionPercent ? parseFloat(body.commissionPercent) : null }),
      ...(body.commissionNotes !== undefined && { commissionNotes: body.commissionNotes }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  if (body.status && body.status !== listing.status) {
    await prisma.fileActivity.create({
      data: {
        fileType: "LISTING",
        listingFileId: params.id,
        actorId: session.user.id,
        actorRole: role,
        type: "STATUS_CHANGED",
        payload: { from: listing.status, to: body.status },
      },
    });

    if (body.status === "CLOSED") {
      const agentUser = await prisma.user.findUnique({ where: { id: listing.agentId ? undefined : undefined }, include: { agent: true } });
      // Find agent user from agent record
      const agentRecord = await prisma.agent.findUnique({ where: { id: listing.agentId }, include: { user: true } });
      if (agentRecord?.user) {
        await sendFileClosed({ agentEmail: agentRecord.user.email, agentName: agentRecord.user.name ?? "Agent", address: listing.propertyAddress, fileType: "listing", fileId: params.id });
      }
    }
  }

  return NextResponse.json({ listing: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listingFile.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (listing.status !== "INCOMPLETE") {
    return NextResponse.json({ error: "Only INCOMPLETE files can be deleted" }, { status: 400 });
  }

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (listing.agentId !== agent?.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.listingFile.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create convert route**

```typescript
// apps/web/src/app/api/listings/[id]/convert/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listingFile.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (listing.agentId !== agent?.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find template for SELLER_SIDE transaction
  const template = await prisma.checklistTemplate.findFirst({
    where: { fileType: "TRANSACTION", isActive: true, OR: [{ transactionSide: "SELLER_SIDE" }, { transactionSide: "ALL" }] },
    include: { items: { orderBy: { order: "asc" } } },
  });

  const [txFile] = await prisma.$transaction([
    prisma.transactionFile.create({
      data: {
        agentId: listing.agentId,
        originatingListingId: listing.id,
        propertyAddress: listing.propertyAddress,
        city: listing.city,
        state: listing.state,
        zip: listing.zip,
        mlsNumber: listing.mlsNumber,
        transactionSide: "SELLER_SIDE",
        listPrice: listing.listPrice,
        checklistItems: template ? {
          create: template.items.map((item) => ({
            fileType: "TRANSACTION",
            name: item.name,
            description: item.description,
            order: item.order,
            isRequired: item.isRequired,
          })),
        } : undefined,
        activities: {
          create: {
            fileType: "TRANSACTION",
            actorId: session.user.id,
            actorRole: session.user.role === "ADMIN" ? "ADMIN" : "AGENT",
            type: "FILE_CREATED",
            payload: { convertedFromListingId: listing.id },
          },
        },
      },
    }),
    prisma.listingFile.update({
      where: { id: listing.id },
      data: { status: "ACTIVE_UNDER_CONTRACT" },
    }),
  ]);

  await prisma.fileActivity.create({
    data: {
      fileType: "LISTING",
      listingFileId: listing.id,
      actorId: session.user.id,
      actorRole: session.user.role === "ADMIN" ? "ADMIN" : "AGENT",
      type: "CONVERTED_TO_TRANSACTION",
      payload: { transactionFileId: txFile.id },
    },
  });

  return NextResponse.json({ transactionFile: txFile }, { status: 201 });
}
```

- [ ] **Step 4: Create submit-review route**

```typescript
// apps/web/src/app/api/listings/[id]/submit-review/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getChecklistProgress } from "@/lib/transaction-helpers";
import { sendSubmitForReview } from "@/lib/email/transaction-emails";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listingFile.findUnique({
    where: { id: params.id },
    include: { checklistItems: { include: { documents: true } }, agent: { include: { user: true } } },
  });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (listing.agentId !== agent?.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { satisfied, required } = getChecklistProgress(listing.checklistItems);
  if (satisfied < required) {
    return NextResponse.json({ error: `${required - satisfied} required checklist item(s) still need documents` }, { status: 400 });
  }

  await prisma.listingFile.update({ where: { id: params.id }, data: { awaitingReview: true } });
  await prisma.fileActivity.create({
    data: { fileType: "LISTING", listingFileId: params.id, actorId: session.user.id, actorRole: "AGENT", type: "SUBMITTED_FOR_REVIEW" },
  });

  await sendSubmitForReview({
    fileType: "Listing",
    address: listing.propertyAddress,
    agentName: listing.agent.user.name ?? "Agent",
    fileId: params.id,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Test listing creation**

Start dev server: `pnpm --filter web dev`

```powershell
$body = '{"propertyAddress":"123 Main St","city":"Los Angeles","zip":"90001","listPrice":750000,"listingType":"RESIDENTIAL_SALE"}'
Invoke-RestMethod -Uri "http://localhost:3000/api/listings" -Method POST -Body $body -ContentType "application/json" -WebSession $session
```
Expected: `{ listing: { id: "...", status: "INCOMPLETE", ... } }`

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/app/api/listings/
git commit -m "feat: listing API routes (CRUD + convert + submit-review)"
```

---

## Task 7: Transaction API Routes

**Files:**
- Create: `apps/web/src/app/api/transactions/route.ts`
- Create: `apps/web/src/app/api/transactions/[id]/route.ts`
- Create: `apps/web/src/app/api/transactions/[id]/submit-review/route.ts`

- [ ] **Step 1: Create transactions list/create route**

```typescript
// apps/web/src/app/api/transactions/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const transactions = await prisma.transactionFile.findMany({
    where: { agentId: agent.id },
    orderBy: { createdAt: "desc" },
    include: { checklistItems: { include: { documents: true } } },
  });

  return NextResponse.json({ transactions });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const body = await req.json();
  const { propertyAddress, city, state, zip, mlsNumber, transactionSide, listPrice, salePrice, offerDate, acceptanceDate, inspectionDeadline, appraisalDeadline, loanApprovalDeadline, closeOfEscrow, commissionGCI, commissionSplit, commissionNotes, originatingLeadId } = body;

  if (!propertyAddress || !city || !zip || !transactionSide) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const template = await prisma.checklistTemplate.findFirst({
    where: { fileType: "TRANSACTION", isActive: true, OR: [{ transactionSide }, { transactionSide: "ALL" }] },
    include: { items: { orderBy: { order: "asc" } } },
  });

  const tx = await prisma.transactionFile.create({
    data: {
      agentId: agent.id,
      propertyAddress, city, state: state ?? "CA", zip,
      mlsNumber: mlsNumber ?? null,
      transactionSide,
      originatingLeadId: originatingLeadId ?? null,
      listPrice: listPrice ? parseFloat(listPrice) : null,
      salePrice: salePrice ? parseFloat(salePrice) : null,
      offerDate: offerDate ? new Date(offerDate) : null,
      acceptanceDate: acceptanceDate ? new Date(acceptanceDate) : null,
      inspectionDeadline: inspectionDeadline ? new Date(inspectionDeadline) : null,
      appraisalDeadline: appraisalDeadline ? new Date(appraisalDeadline) : null,
      loanApprovalDeadline: loanApprovalDeadline ? new Date(loanApprovalDeadline) : null,
      closeOfEscrow: closeOfEscrow ? new Date(closeOfEscrow) : null,
      commissionGCI: commissionGCI ? parseFloat(commissionGCI) : null,
      commissionSplit: commissionSplit ? parseFloat(commissionSplit) : null,
      commissionNotes: commissionNotes ?? null,
      checklistItems: template ? {
        create: template.items.map((item) => ({
          fileType: "TRANSACTION",
          name: item.name,
          description: item.description,
          order: item.order,
          isRequired: item.isRequired,
        })),
      } : undefined,
      activities: { create: { fileType: "TRANSACTION", actorId: session.user.id, actorRole: "AGENT", type: "FILE_CREATED" } },
    },
  });

  return NextResponse.json({ transaction: tx }, { status: 201 });
}
```

- [ ] **Step 2: Create transaction detail route**

```typescript
// apps/web/src/app/api/transactions/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canTransitionTransaction } from "@/lib/transaction-helpers";
import { sendFileClosed } from "@/lib/email/transaction-emails";

const INCLUDE = {
  parties: true,
  checklistItems: { include: { documents: true }, orderBy: { order: "asc" as const } },
  documents: { orderBy: { uploadedAt: "desc" as const } },
  activities: { include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" as const } },
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tx = await prisma.transactionFile.findUnique({ where: { id: params.id }, include: INCLUDE });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (session.user.role !== "ADMIN" && tx.agentId !== agent?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ transaction: tx });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tx = await prisma.transactionFile.findUnique({ where: { id: params.id } });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && tx.agentId !== agent?.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const role = isAdmin ? "ADMIN" : "AGENT";

  if (body.status && body.status !== tx.status) {
    if (!canTransitionTransaction(tx.status, body.status, role)) {
      return NextResponse.json({ error: `Cannot transition from ${tx.status} to ${body.status}` }, { status: 400 });
    }
  }

  const updated = await prisma.transactionFile.update({
    where: { id: params.id },
    data: {
      ...(body.propertyAddress !== undefined && { propertyAddress: body.propertyAddress }),
      ...(body.salePrice !== undefined && { salePrice: body.salePrice ? parseFloat(body.salePrice) : null }),
      ...(body.closeOfEscrow !== undefined && { closeOfEscrow: body.closeOfEscrow ? new Date(body.closeOfEscrow) : null }),
      ...(body.inspectionDeadline !== undefined && { inspectionDeadline: body.inspectionDeadline ? new Date(body.inspectionDeadline) : null }),
      ...(body.appraisalDeadline !== undefined && { appraisalDeadline: body.appraisalDeadline ? new Date(body.appraisalDeadline) : null }),
      ...(body.loanApprovalDeadline !== undefined && { loanApprovalDeadline: body.loanApprovalDeadline ? new Date(body.loanApprovalDeadline) : null }),
      ...(body.commissionGCI !== undefined && { commissionGCI: body.commissionGCI ? parseFloat(body.commissionGCI) : null }),
      ...(body.commissionSplit !== undefined && { commissionSplit: body.commissionSplit ? parseFloat(body.commissionSplit) : null }),
      ...(body.commissionNotes !== undefined && { commissionNotes: body.commissionNotes }),
      ...(body.status !== undefined && { status: body.status }),
    },
  });

  if (body.status && body.status !== tx.status) {
    await prisma.fileActivity.create({
      data: { fileType: "TRANSACTION", transactionFileId: params.id, actorId: session.user.id, actorRole: role, type: "STATUS_CHANGED", payload: { from: tx.status, to: body.status } },
    });
    if (body.status === "CLOSED") {
      const agentRecord = await prisma.agent.findUnique({ where: { id: tx.agentId }, include: { user: true } });
      if (agentRecord?.user) {
        await sendFileClosed({ agentEmail: agentRecord.user.email, agentName: agentRecord.user.name ?? "Agent", address: tx.propertyAddress, fileType: "transaction", fileId: params.id });
      }
    }
  }

  return NextResponse.json({ transaction: updated });
}
```

- [ ] **Step 3: Create submit-review route**

```typescript
// apps/web/src/app/api/transactions/[id]/submit-review/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getChecklistProgress } from "@/lib/transaction-helpers";
import { sendSubmitForReview } from "@/lib/email/transaction-emails";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tx = await prisma.transactionFile.findUnique({
    where: { id: params.id },
    include: { checklistItems: { include: { documents: true } }, agent: { include: { user: true } } },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  if (tx.agentId !== agent?.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { satisfied, required } = getChecklistProgress(tx.checklistItems);
  if (satisfied < required) {
    return NextResponse.json({ error: `${required - satisfied} required checklist item(s) still need documents` }, { status: 400 });
  }

  await prisma.transactionFile.update({ where: { id: params.id }, data: { awaitingReview: true } });
  await prisma.fileActivity.create({
    data: { fileType: "TRANSACTION", transactionFileId: params.id, actorId: session.user.id, actorRole: "AGENT", type: "SUBMITTED_FOR_REVIEW" },
  });

  await sendSubmitForReview({ fileType: "Transaction", address: tx.propertyAddress, agentName: tx.agent.user.name ?? "Agent", fileId: params.id });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Commit**

```powershell
git add apps/web/src/app/api/transactions/
git commit -m "feat: transaction API routes (CRUD + submit-review)"
```

---

## Task 8: File Parties API

**Files:**
- Create: `apps/web/src/app/api/files/[fileType]/[id]/parties/route.ts`
- Create: `apps/web/src/app/api/files/[fileType]/[id]/parties/[partyId]/route.ts`

- [ ] **Step 1: Create parties route**

```typescript
// apps/web/src/app/api/files/[fileType]/[id]/parties/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getFileAndVerifyAccess(fileType: string, fileId: string, userId: string, userRole: string) {
  if (fileType === "listing") {
    const file = await prisma.listingFile.findUnique({ where: { id: fileId } });
    if (!file) return null;
    if (userRole !== "ADMIN") {
      const agent = await prisma.agent.findUnique({ where: { userId } });
      if (file.agentId !== agent?.id) return null;
    }
    return file;
  } else {
    const file = await prisma.transactionFile.findUnique({ where: { id: fileId } });
    if (!file) return null;
    if (userRole !== "ADMIN") {
      const agent = await prisma.agent.findUnique({ where: { userId } });
      if (file.agentId !== agent?.id) return null;
    }
    return file;
  }
}

export async function POST(req: Request, { params }: { params: { fileType: string; id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const file = await getFileAndVerifyAccess(params.fileType, params.id, session.user.id, session.user.role);
  if (!file) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });

  const body = await req.json();
  const { role, name, email, phone, company, licenseNumber } = body;
  if (!role || !name) return NextResponse.json({ error: "role and name are required" }, { status: 400 });

  const isListing = params.fileType === "listing";
  const party = await prisma.fileParty.create({
    data: {
      fileType: isListing ? "LISTING" : "TRANSACTION",
      listingFileId: isListing ? params.id : null,
      transactionFileId: isListing ? null : params.id,
      role, name,
      email: email ?? null,
      phone: phone ?? null,
      company: company ?? null,
      licenseNumber: licenseNumber ?? null,
    },
  });

  await prisma.fileActivity.create({
    data: {
      fileType: isListing ? "LISTING" : "TRANSACTION",
      listingFileId: isListing ? params.id : null,
      transactionFileId: isListing ? null : params.id,
      actorId: session.user.id,
      actorRole: session.user.role === "ADMIN" ? "ADMIN" : "AGENT",
      type: "PARTY_ADDED",
      payload: { partyId: party.id, role, name },
    },
  });

  return NextResponse.json({ party }, { status: 201 });
}
```

- [ ] **Step 2: Create party detail route**

```typescript
// apps/web/src/app/api/files/[fileType]/[id]/parties/[partyId]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { fileType: string; id: string; partyId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const party = await prisma.fileParty.findUnique({ where: { id: params.partyId } });
  if (!party) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.fileParty.update({
    where: { id: params.partyId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.company !== undefined && { company: body.company }),
      ...(body.licenseNumber !== undefined && { licenseNumber: body.licenseNumber }),
    },
  });

  return NextResponse.json({ party: updated });
}

export async function DELETE(_req: Request, { params }: { params: { fileType: string; id: string; partyId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.fileParty.delete({ where: { id: params.partyId } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```powershell
git add apps/web/src/app/api/files/
git commit -m "feat: file parties API (add/edit/remove)"
```

---

## Task 9: Documents API (Upload + Download)

**Files:**
- Create: `apps/web/src/app/api/upload-url/route.ts`
- Create: `apps/web/src/app/api/documents/route.ts`
- Create: `apps/web/src/app/api/documents/[id]/route.ts`
- Create: `apps/web/src/app/api/documents/[id]/download/route.ts`

- [ ] **Step 1: Create upload-url route**

```typescript
// apps/web/src/app/api/upload-url/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPresignedPutUrl, buildR2Key } from "@/lib/r2";
import { cuid } from "@paralleldrive/cuid2";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fileType = searchParams.get("fileType") as "listing" | "transaction" | null;
  const fileId = searchParams.get("fileId");
  const filename = searchParams.get("filename");
  const contentType = searchParams.get("contentType");
  const size = Number(searchParams.get("size") ?? 0);

  if (!fileType || !fileId || !filename || !contentType) {
    return NextResponse.json({ error: "fileType, fileId, filename, and contentType are required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "File type not allowed. Use PDF, JPG, PNG, or DOCX." }, { status: 400 });
  }
  if (size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds 50MB limit" }, { status: 400 });
  }

  const documentId = cuid();
  const key = buildR2Key(fileType, fileId, documentId, filename);
  const uploadUrl = await getPresignedPutUrl(key, contentType);

  return NextResponse.json({ uploadUrl, key, documentId });
}
```

Note: install `@paralleldrive/cuid2`: `pnpm add @paralleldrive/cuid2`

- [ ] **Step 2: Create documents register route**

```typescript
// apps/web/src/app/api/documents/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { fileType, fileId, checklistItemId, name, r2Key, r2Url, documentId } = body;

  if (!fileType || !fileId || !name || !r2Key || !r2Url) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const isListing = fileType === "LISTING";

  const doc = await prisma.fileDocument.create({
    data: {
      id: documentId ?? undefined,
      fileType,
      listingFileId: isListing ? fileId : null,
      transactionFileId: isListing ? null : fileId,
      checklistItemId: checklistItemId ?? null,
      name,
      r2Key,
      r2Url,
      uploadedByAgentId: session.user.id,
      reviewStatus: "PENDING_REVIEW",
    },
  });

  await prisma.fileActivity.create({
    data: {
      fileType,
      listingFileId: isListing ? fileId : null,
      transactionFileId: isListing ? null : fileId,
      actorId: session.user.id,
      actorRole: session.user.role === "ADMIN" ? "ADMIN" : "AGENT",
      type: "DOCUMENT_UPLOADED",
      payload: { documentId: doc.id, name },
    },
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}
```

- [ ] **Step 3: Create document delete + download routes**

```typescript
// apps/web/src/app/api/documents/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object } from "@/lib/r2";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.fileDocument.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (doc.reviewStatus !== "PENDING_REVIEW" && doc.reviewStatus !== "NOT_SUBMITTED") {
    return NextResponse.json({ error: "Cannot delete a reviewed document" }, { status: 400 });
  }
  if (doc.uploadedByAgentId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteR2Object(doc.r2Key);
  await prisma.fileDocument.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
```

```typescript
// apps/web/src/app/api/documents/[id]/download/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPresignedGetUrl } from "@/lib/r2";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.fileDocument.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = await getPresignedGetUrl(doc.r2Key);
  return NextResponse.json({ url });
}
```

- [ ] **Step 4: Install cuid2 and commit**

```powershell
pnpm add @paralleldrive/cuid2
git add apps/web/src/app/api/upload-url/ apps/web/src/app/api/documents/
git commit -m "feat: document upload (R2 presigned PUT) + download + register + delete API"
```

---

## Task 10: Admin Document Review API

**Files:**
- Create: `apps/web/src/app/api/admin/documents/[id]/approve/route.ts`
- Create: `apps/web/src/app/api/admin/documents/[id]/reject/route.ts`
- Create: `apps/web/src/app/api/admin/audit-queue/route.ts`
- Create: `apps/web/src/app/api/admin/files/[fileType]/[id]/status/route.ts`

- [ ] **Step 1: Create approve route**

```typescript
// apps/web/src/app/api/admin/documents/[id]/approve/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isReadyToClose } from "@/lib/transaction-helpers";
import { sendAllDocsApproved } from "@/lib/email/transaction-emails";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await prisma.fileDocument.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.fileDocument.update({
    where: { id: params.id },
    data: { reviewStatus: "APPROVED", reviewedByAdminId: session.user.id, reviewedAt: new Date() },
  });

  await prisma.fileActivity.create({
    data: {
      fileType: doc.fileType,
      listingFileId: doc.listingFileId,
      transactionFileId: doc.transactionFileId,
      actorId: session.user.id,
      actorRole: "ADMIN",
      type: "DOCUMENT_APPROVED",
      payload: { documentId: doc.id, name: doc.name },
    },
  });

  // Check if all required docs are now approved → notify agent
  const fileId = doc.listingFileId ?? doc.transactionFileId!;
  const isListing = doc.fileType === "LISTING";

  const checklistItems = await prisma.fileChecklistItem.findMany({
    where: isListing ? { listingFileId: fileId } : { transactionFileId: fileId },
    include: { documents: true },
  });

  if (isReadyToClose(checklistItems)) {
    const fileRecord = isListing
      ? await prisma.listingFile.findUnique({ where: { id: fileId }, include: { agent: { include: { user: true } } } })
      : await prisma.transactionFile.findUnique({ where: { id: fileId }, include: { agent: { include: { user: true } } } });

    if (fileRecord?.agent?.user) {
      await sendAllDocsApproved({
        agentEmail: fileRecord.agent.user.email,
        agentName: fileRecord.agent.user.name ?? "Agent",
        address: fileRecord.propertyAddress,
        fileType: isListing ? "listing" : "transaction",
        fileId,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create reject route**

```typescript
// apps/web/src/app/api/admin/documents/[id]/reject/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendDocumentRejected } from "@/lib/email/transaction-emails";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { note } = await req.json();
  if (!note?.trim()) return NextResponse.json({ error: "Rejection note is required" }, { status: 400 });

  const doc = await prisma.fileDocument.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.fileDocument.update({
    where: { id: params.id },
    data: { reviewStatus: "REJECTED", rejectionNote: note, reviewedByAdminId: session.user.id, reviewedAt: new Date() },
  });

  await prisma.fileActivity.create({
    data: {
      fileType: doc.fileType,
      listingFileId: doc.listingFileId,
      transactionFileId: doc.transactionFileId,
      actorId: session.user.id,
      actorRole: "ADMIN",
      type: "DOCUMENT_REJECTED",
      payload: { documentId: doc.id, name: doc.name, note },
    },
  });

  const fileId = doc.listingFileId ?? doc.transactionFileId!;
  const isListing = doc.fileType === "LISTING";
  const fileRecord = isListing
    ? await prisma.listingFile.findUnique({ where: { id: fileId }, include: { agent: { include: { user: true } } } })
    : await prisma.transactionFile.findUnique({ where: { id: fileId }, include: { agent: { include: { user: true } } } });

  if (fileRecord?.agent?.user) {
    await sendDocumentRejected({
      agentEmail: fileRecord.agent.user.email,
      agentName: fileRecord.agent.user.name ?? "Agent",
      documentName: doc.name,
      address: fileRecord.propertyAddress,
      rejectionNote: note,
      fileType: isListing ? "listing" : "transaction",
      fileId,
    });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create audit-queue route**

```typescript
// apps/web/src/app/api/admin/audit-queue/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [listings, transactions] = await Promise.all([
    prisma.listingFile.findMany({
      where: { awaitingReview: true },
      include: { agent: { include: { user: { select: { name: true, email: true } } } }, documents: { where: { reviewStatus: "PENDING_REVIEW" } } },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.transactionFile.findMany({
      where: { awaitingReview: true },
      include: { agent: { include: { user: { select: { name: true, email: true } } } }, documents: { where: { reviewStatus: "PENDING_REVIEW" } } },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  return NextResponse.json({ listings, transactions });
}
```

- [ ] **Step 4: Create admin status override route**

```typescript
// apps/web/src/app/api/admin/files/[fileType]/[id]/status/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canTransitionListing, canTransitionTransaction, isReadyToClose } from "@/lib/transaction-helpers";

export async function PATCH(req: Request, { params }: { params: { fileType: string; id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status } = await req.json();
  if (!status) return NextResponse.json({ error: "status is required" }, { status: 400 });

  const isListing = params.fileType === "listing";

  if (isListing) {
    const file = await prisma.listingFile.findUnique({
      where: { id: params.id },
      include: { checklistItems: { include: { documents: true } } },
    });
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!canTransitionListing(file.status, status, "ADMIN")) {
      return NextResponse.json({ error: `Cannot transition from ${file.status} to ${status}` }, { status: 400 });
    }
    if (status === "CLOSED" && !isReadyToClose(file.checklistItems)) {
      return NextResponse.json({ error: "Cannot close: not all required documents are approved" }, { status: 400 });
    }

    await prisma.listingFile.update({ where: { id: params.id }, data: { status, awaitingReview: false } });
  } else {
    const file = await prisma.transactionFile.findUnique({
      where: { id: params.id },
      include: { checklistItems: { include: { documents: true } } },
    });
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!canTransitionTransaction(file.status, status, "ADMIN")) {
      return NextResponse.json({ error: `Cannot transition from ${file.status} to ${status}` }, { status: 400 });
    }
    if (status === "CLOSED" && !isReadyToClose(file.checklistItems)) {
      return NextResponse.json({ error: "Cannot close: not all required documents are approved" }, { status: 400 });
    }

    await prisma.transactionFile.update({ where: { id: params.id }, data: { status, awaitingReview: false } });
  }

  await prisma.fileActivity.create({
    data: {
      fileType: isListing ? "LISTING" : "TRANSACTION",
      listingFileId: isListing ? params.id : null,
      transactionFileId: isListing ? null : params.id,
      actorId: session.user.id,
      actorRole: "ADMIN",
      type: "STATUS_CHANGED",
      payload: { to: status },
    },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/app/api/admin/
git commit -m "feat: admin document review API (approve/reject/audit-queue/status-override)"
```

---

## Task 11: Admin Checklist Templates API

**Files:**
- Create: `apps/web/src/app/api/admin/checklist-templates/route.ts`
- Create: `apps/web/src/app/api/admin/checklist-templates/[id]/route.ts`
- Create: `apps/web/src/app/api/admin/checklist-templates/[id]/items/route.ts`
- Create: `apps/web/src/app/api/admin/checklist-templates/[id]/items/[itemId]/route.ts`

- [ ] **Step 1: Create templates list/create route**

```typescript
// apps/web/src/app/api/admin/checklist-templates/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function adminGuard(session: any) {
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const err = adminGuard(session);
  if (err) return err;

  const templates = await prisma.checklistTemplate.findMany({
    include: { items: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const err = adminGuard(session);
  if (err) return err;

  const { name, fileType, transactionSide, listingType } = await req.json();
  if (!name || !fileType) return NextResponse.json({ error: "name and fileType are required" }, { status: 400 });

  const template = await prisma.checklistTemplate.create({
    data: { name, fileType, transactionSide: transactionSide ?? "ALL", listingType: listingType ?? "ALL" },
  });

  return NextResponse.json({ template }, { status: 201 });
}
```

- [ ] **Step 2: Create template update route**

```typescript
// apps/web/src/app/api/admin/checklist-templates/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const template = await prisma.checklistTemplate.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.transactionSide !== undefined && { transactionSide: body.transactionSide }),
      ...(body.listingType !== undefined && { listingType: body.listingType }),
    },
    include: { items: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ template });
}
```

- [ ] **Step 3: Create template items routes**

```typescript
// apps/web/src/app/api/admin/checklist-templates/[id]/items/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description, order, isRequired } = await req.json();
  if (!name || order === undefined) return NextResponse.json({ error: "name and order required" }, { status: 400 });

  const item = await prisma.checklistTemplateItem.create({
    data: { templateId: params.id, name, description: description ?? null, order, isRequired: isRequired ?? true },
  });

  return NextResponse.json({ item }, { status: 201 });
}
```

```typescript
// apps/web/src/app/api/admin/checklist-templates/[id]/items/[itemId]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string; itemId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const item = await prisma.checklistTemplateItem.update({
    where: { id: params.itemId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.order !== undefined && { order: body.order }),
      ...(body.isRequired !== undefined && { isRequired: body.isRequired }),
    },
  });

  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: { params: { id: string; itemId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.checklistTemplateItem.delete({ where: { id: params.itemId } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Seed a default checklist template**

Add to `packages/database/prisma/seed.ts` (or run once manually in psql):

```typescript
// In seed.ts, add after existing seeds:
const listingTemplate = await prisma.checklistTemplate.upsert({
  where: { id: "default-listing-residential" },
  update: {},
  create: {
    id: "default-listing-residential",
    name: "Residential Sale Listing",
    fileType: "LISTING",
    listingType: "RESIDENTIAL_SALE",
    items: {
      create: [
        { name: "Listing Agreement", order: 1, isRequired: true },
        { name: "Seller's Disclosure (TDS)", order: 2, isRequired: true },
        { name: "Natural Hazard Disclosure", order: 3, isRequired: true },
        { name: "Agency Disclosure", order: 4, isRequired: true },
        { name: "Lead Paint Disclosure (if pre-1978)", order: 5, isRequired: false },
      ],
    },
  },
});

const txTemplate = await prisma.checklistTemplate.upsert({
  where: { id: "default-tx-buyer" },
  update: {},
  create: {
    id: "default-tx-buyer",
    name: "Buyer-Side Transaction",
    fileType: "TRANSACTION",
    transactionSide: "BUYER_SIDE",
    items: {
      create: [
        { name: "Buyer Representation Agreement", order: 1, isRequired: true },
        { name: "Purchase Agreement (RPA)", order: 2, isRequired: true },
        { name: "Agency Disclosure", order: 3, isRequired: true },
        { name: "Loan Approval Letter", order: 4, isRequired: true },
        { name: "Inspection Report", order: 5, isRequired: false },
        { name: "Final Walkthrough Verification", order: 6, isRequired: true },
        { name: "Closing Disclosure (CD)", order: 7, isRequired: true },
      ],
    },
  },
});
```

Run: `pnpm --filter @cnc/database exec ts-node prisma/seed.ts`

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/app/api/admin/checklist-templates/
git commit -m "feat: admin checklist templates API (CRUD templates + items) + default seed"
```

---

---

## Task 12: Dashboard Sidebar + Transactions Route Group

**Files:**
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`
- Create: `apps/web/src/app/(dashboard)/dashboard/transactions/` (directory)

- [ ] **Step 1: Add Transactions to sidebar nav**

In `apps/web/src/app/(dashboard)/layout.tsx`, update the `NAV` array:

```typescript
const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/transactions", label: "Transactions" },
];
```

Also add admin nav items by reading the session role:

```typescript
const isAdmin = (session.user as any).role === "ADMIN";

const ADMIN_NAV = [
  { href: "/admin/transactions", label: "All Files" },
  { href: "/admin/settings/checklists", label: "Checklists" },
];
```

Add below the main nav links, conditionally rendered:

```tsx
{isAdmin && (
  <>
    <p className="mt-6 px-3 text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/40">Admin</p>
    {ADMIN_NAV.map(({ href, label }) => (
      <Link key={href} href={href} className="rounded-lg px-3 py-2 font-sans text-sm font-light text-[#1B1B1B]/60 transition-colors hover:bg-[#F2F0EF] hover:text-[#1B1B1B]">
        {label}
      </Link>
    ))}
  </>
)}
```

- [ ] **Step 2: Test nav renders**

Run `pnpm --filter web dev`, log in as agent at `/dashboard` — confirm "Transactions" appears in sidebar. Log in as ADMIN — confirm Admin section with "All Files" and "Checklists" also appears.

- [ ] **Step 3: Commit**

```powershell
git add apps/web/src/app/(dashboard)/layout.tsx
git commit -m "feat: add Transactions + Admin nav to dashboard sidebar"
```

---

## Task 13: StatusBadge + FileCard Components

**Files:**
- Create: `apps/web/src/components/transactions/StatusBadge.tsx`
- Create: `apps/web/src/components/transactions/FileCard.tsx`

- [ ] **Step 1: Create StatusBadge**

```typescript
// apps/web/src/components/transactions/StatusBadge.tsx
import type { ListingStatus, TransactionFileStatus } from "@/types/transaction";

type Status = ListingStatus | TransactionFileStatus;

const COLORS: Record<string, string> = {
  INCOMPLETE:            "bg-zinc-100 text-zinc-500",
  COMING_SOON:           "bg-blue-100 text-blue-700",
  ACTIVE:                "bg-green-100 text-green-700",
  ACTIVE_UNDER_CONTRACT: "bg-yellow-100 text-yellow-700",
  PRE_CONTRACT:          "bg-blue-100 text-blue-700",
  PENDING:               "bg-orange-100 text-orange-700",
  EXPIRED:               "bg-red-100 text-red-600",
  WITHDRAWN:             "bg-zinc-100 text-zinc-500",
  CANCELED:              "bg-red-100 text-red-600",
  CANCELED_PENDING:      "bg-red-100 text-red-500",
  CANCELED_APPROVED:     "bg-red-200 text-red-700",
  CLOSED:                "bg-[#1B1B1B] text-white",
  ARCHIVED:              "bg-zinc-200 text-zinc-600",
};

const LABELS: Record<string, string> = {
  INCOMPLETE:            "Incomplete",
  COMING_SOON:           "Coming Soon",
  ACTIVE:                "Active",
  ACTIVE_UNDER_CONTRACT: "Under Contract",
  PRE_CONTRACT:          "Pre-Contract",
  PENDING:               "Pending",
  EXPIRED:               "Expired",
  WITHDRAWN:             "Withdrawn",
  CANCELED:              "Canceled",
  CANCELED_PENDING:      "Cancel Pending",
  CANCELED_APPROVED:     "Canceled",
  CLOSED:                "Closed",
  ARCHIVED:              "Archived",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[status] ?? "bg-zinc-100 text-zinc-500"}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
```

- [ ] **Step 2: Create FileCard**

```typescript
// apps/web/src/components/transactions/FileCard.tsx
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { getChecklistProgress } from "@/lib/transaction-helpers";
import type { FileChecklistItemWithDocs, ListingStatus, TransactionFileStatus } from "@/types/transaction";

interface Props {
  id: string;
  fileType: "listing" | "transaction";
  address: string;
  city: string;
  status: ListingStatus | TransactionFileStatus;
  closeDate?: string | null;
  listPrice?: number | null;
  checklistItems: FileChecklistItemWithDocs[];
  awaitingReview: boolean;
}

export function FileCard({ id, fileType, address, city, status, closeDate, listPrice, checklistItems, awaitingReview }: Props) {
  const { satisfied, required } = getChecklistProgress(checklistItems);
  const pct = required > 0 ? Math.round((satisfied / required) * 100) : 0;

  return (
    <Link
      href={`/dashboard/transactions/${fileType}/${id}`}
      className="flex flex-col gap-3 rounded-xl border border-[#1B1B1B]/10 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-[#1B1B1B] line-clamp-1">{address}</p>
          <p className="text-sm text-[#1B1B1B]/50">{city}, CA</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {listPrice && (
        <p className="text-sm font-medium text-[#1B1B1B]">${listPrice.toLocaleString()}</p>
      )}

      {closeDate && (
        <p className="text-xs text-[#1B1B1B]/50">COE: {new Date(closeDate).toLocaleDateString()}</p>
      )}

      {required > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-[#1B1B1B]/50">
            <span>Checklist</span>
            <span>{satisfied}/{required}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#F2F0EF]">
            <div className="h-1.5 rounded-full bg-[#9E8C61] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {awaitingReview && (
        <span className="self-start rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
          Awaiting Review
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step 3: Commit**

```powershell
git add apps/web/src/components/transactions/StatusBadge.tsx apps/web/src/components/transactions/FileCard.tsx
git commit -m "feat: StatusBadge and FileCard transaction components"
```

---

## Task 14: ChecklistPanel + PartiesTable + ActivityFeed

**Files:**
- Create: `apps/web/src/components/transactions/ChecklistPanel.tsx`
- Create: `apps/web/src/components/transactions/PartiesTable.tsx`
- Create: `apps/web/src/components/transactions/ActivityFeed.tsx`

- [ ] **Step 1: Create ChecklistPanel**

```typescript
// apps/web/src/components/transactions/ChecklistPanel.tsx
"use client";
import { useRef, useState } from "react";
import { CheckCircle, XCircle, Clock, Upload, AlertCircle } from "lucide-react";
import type { FileChecklistItemWithDocs, DocumentReviewStatus } from "@/types/transaction";

interface Props {
  fileType: "LISTING" | "TRANSACTION";
  fileId: string;
  items: FileChecklistItemWithDocs[];
  onUploaded: () => void;
}

const STATUS_ICONS: Record<DocumentReviewStatus, React.ReactNode> = {
  APPROVED:      <CheckCircle className="h-4 w-4 text-green-600" />,
  REJECTED:      <XCircle className="h-4 w-4 text-red-500" />,
  PENDING_REVIEW: <Clock className="h-4 w-4 text-yellow-600" />,
  NOT_SUBMITTED:  <AlertCircle className="h-4 w-4 text-zinc-400" />,
};

export function ChecklistPanel({ fileType, fileId, items, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

  async function handleUpload(itemId: string | null, file: File) {
    setUploadingItemId(itemId ?? "additional");

    // 1. Get presigned PUT URL
    const params = new URLSearchParams({
      fileType: fileType === "LISTING" ? "listing" : "transaction",
      fileId,
      filename: file.name,
      contentType: file.type,
      size: String(file.size),
    });
    const { uploadUrl, key, documentId } = await fetch(`/api/upload-url?${params}`).then((r) => r.json());

    // 2. Upload directly to R2
    await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

    // 3. Register the document
    await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileType,
        fileId,
        checklistItemId: itemId,
        name: file.name,
        r2Key: key,
        r2Url: `https://${process.env.NEXT_PUBLIC_R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.NEXT_PUBLIC_R2_BUCKET}/${key}`,
        documentId,
      }),
    });

    setUploadingItemId(null);
    onUploaded();
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const topDoc = item.documents[0];
        const status: DocumentReviewStatus = topDoc?.reviewStatus ?? "NOT_SUBMITTED";

        return (
          <div key={item.id} className="flex items-center gap-3 rounded-lg border border-[#1B1B1B]/10 bg-white p-3">
            <span className="shrink-0">{STATUS_ICONS[status]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#1B1B1B]">
                {item.name}
                {item.isRequired && <span className="ml-1 text-red-500">*</span>}
              </p>
              {status === "REJECTED" && topDoc?.reviewStatus === "REJECTED" && (
                <p className="text-xs text-red-500">Rejected — please re-upload</p>
              )}
            </div>
            <label className={`shrink-0 cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${uploadingItemId === item.id ? "bg-zinc-100 text-zinc-400" : "bg-[#1B1B1B] text-white hover:bg-[#1B1B1B]/80"}`}>
              {uploadingItemId === item.id ? "Uploading…" : <><Upload className="mr-1 inline h-3 w-3" />Upload</>}
              <input
                type="file"
                className="sr-only"
                accept=".pdf,.jpg,.jpeg,.png,.docx"
                disabled={uploadingItemId !== null}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(item.id, f); }}
              />
            </label>
          </div>
        );
      })}

      <div className="mt-4 border-t border-[#1B1B1B]/10 pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/40">Additional Documents</p>
        <label className="cursor-pointer rounded-full border border-[#1B1B1B]/20 px-3 py-1.5 text-xs font-medium text-[#1B1B1B]/60 hover:border-[#1B1B1B]/40 hover:text-[#1B1B1B]">
          <Upload className="mr-1 inline h-3 w-3" />Add Document
          <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(null, f); }} />
        </label>
      </div>
    </div>
  );
}
```

Note: add `NEXT_PUBLIC_R2_ACCOUNT_ID` and `NEXT_PUBLIC_R2_BUCKET` to `.env.local` for the client-side R2 URL construction.

- [ ] **Step 2: Create PartiesTable**

```typescript
// apps/web/src/components/transactions/PartiesTable.tsx
"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { FilePartyRecord, FilePartyRole } from "@/types/transaction";

const ROLE_LABELS: Record<FilePartyRole, string> = {
  BUYER: "Buyer", SELLER: "Seller", LISTING_AGENT: "Listing Agent",
  BUYERS_AGENT: "Buyer's Agent", CO_AGENT: "Co-Agent",
  TITLE_ESCROW: "Title/Escrow", LENDER: "Lender",
  TRANSACTION_COORDINATOR: "TC", OTHER: "Other",
};

interface Props {
  fileType: "listing" | "transaction";
  fileId: string;
  parties: FilePartyRecord[];
  onChanged: () => void;
}

export function PartiesTable({ fileType, fileId, parties, onChanged }: Props) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ role: "BUYER" as FilePartyRole, name: "", email: "", phone: "", company: "", licenseNumber: "" });

  async function addParty() {
    await fetch(`/api/files/${fileType}/${fileId}/parties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setAdding(false);
    setForm({ role: "BUYER", name: "", email: "", phone: "", company: "", licenseNumber: "" });
    onChanged();
  }

  async function removeParty(partyId: string) {
    await fetch(`/api/files/${fileType}/${fileId}/parties/${partyId}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1B1B1B]/10 text-left text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/40">
            <th className="pb-2">Role</th><th className="pb-2">Name</th><th className="pb-2">Email</th><th className="pb-2">Phone</th><th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {parties.map((p) => (
            <tr key={p.id} className="border-b border-[#1B1B1B]/5">
              <td className="py-2 text-[#1B1B1B]/60">{ROLE_LABELS[p.role]}</td>
              <td className="py-2 font-medium text-[#1B1B1B]">{p.name}</td>
              <td className="py-2 text-[#1B1B1B]/60">{p.email ?? "—"}</td>
              <td className="py-2 text-[#1B1B1B]/60">{p.phone ?? "—"}</td>
              <td className="py-2 text-right">
                <button onClick={() => removeParty(p.id)} className="text-[#1B1B1B]/30 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {adding ? (
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-[#1B1B1B]/10 p-4">
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as FilePartyRole }))} className="col-span-2 rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm">
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {(["name", "email", "phone", "company", "licenseNumber"] as const).map((field) => (
            <input key={field} placeholder={field.charAt(0).toUpperCase() + field.slice(1)} value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm" />
          ))}
          <div className="col-span-2 flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="rounded-lg px-4 py-2 text-sm text-[#1B1B1B]/50 hover:text-[#1B1B1B]">Cancel</button>
            <button onClick={addParty} className="rounded-lg bg-[#1B1B1B] px-4 py-2 text-sm text-white">Add Party</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-3 flex items-center gap-1.5 text-sm text-[#1B1B1B]/50 hover:text-[#1B1B1B]">
          <Plus className="h-4 w-4" /> Add Party
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create ActivityFeed**

```typescript
// apps/web/src/components/transactions/ActivityFeed.tsx
"use client";
import { useState } from "react";
import type { FileActivityRecord, FileActivityType } from "@/types/transaction";

const TYPE_LABELS: Record<FileActivityType, string> = {
  FILE_CREATED:           "File created",
  STATUS_CHANGED:         "Status changed",
  DOCUMENT_UPLOADED:      "Document uploaded",
  DOCUMENT_APPROVED:      "Document approved",
  DOCUMENT_REJECTED:      "Document rejected",
  SUBMITTED_FOR_REVIEW:   "Submitted for review",
  PARTY_ADDED:            "Party added",
  NOTE_ADDED:             "Note added",
  CONVERTED_TO_TRANSACTION: "Converted to transaction",
};

interface Props {
  fileType: "listing" | "transaction";
  fileId: string;
  activities: FileActivityRecord[];
  onNoteAdded: () => void;
}

export function ActivityFeed({ fileType, fileId, activities, onNoteAdded }: Props) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function addNote() {
    if (!note.trim()) return;
    setSaving(true);
    await fetch(`/api/${fileType === "listing" ? "listings" : "transactions"}/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // Note: we'll POST to a /note sub-route; for simplicity add via activity directly
    });
    // POST note activity directly
    await fetch(`/api/files/${fileType}/${fileId}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setNote("");
    setSaving(false);
    onNoteAdded();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {activities.map((a) => (
          <div key={a.id} className="flex gap-3">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#9E8C61]" />
            <div className="flex-1">
              <p className="text-sm text-[#1B1B1B]">
                <span className="font-medium">{a.actor.name ?? a.actor.email}</span>
                {" "}
                {TYPE_LABELS[a.type]}
                {a.type === "STATUS_CHANGED" && a.payload && (
                  <span className="text-[#1B1B1B]/50"> · {(a.payload as any).from} → {(a.payload as any).to}</span>
                )}
              </p>
              {a.note && <p className="mt-0.5 text-sm text-[#1B1B1B]/60">{a.note}</p>}
              <p className="text-xs text-[#1B1B1B]/40">{new Date(a.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-[#1B1B1B]/10 pt-4">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note…"
          rows={3}
          className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
        />
        <div className="mt-2 flex justify-end">
          <button onClick={addNote} disabled={saving || !note.trim()} className="rounded-full bg-[#1B1B1B] px-4 py-1.5 text-sm text-white disabled:opacity-40">
            {saving ? "Saving…" : "Add Note"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

Also add the note API route:
```typescript
// apps/web/src/app/api/files/[fileType]/[id]/note/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { fileType: string; id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { note } = await req.json();
  if (!note?.trim()) return NextResponse.json({ error: "note is required" }, { status: 400 });

  const isListing = params.fileType === "listing";
  await prisma.fileActivity.create({
    data: {
      fileType: isListing ? "LISTING" : "TRANSACTION",
      listingFileId: isListing ? params.id : null,
      transactionFileId: isListing ? null : params.id,
      actorId: session.user.id,
      actorRole: session.user.role === "ADMIN" ? "ADMIN" : "AGENT",
      type: "NOTE_ADDED",
      note,
    },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Commit**

```powershell
git add apps/web/src/components/transactions/ apps/web/src/app/api/files/
git commit -m "feat: ChecklistPanel, PartiesTable, ActivityFeed components + note API"
```

---

## Task 15: DocumentReviewCard + ChecklistTemplateEditor (Admin Components)

**Files:**
- Create: `apps/web/src/components/transactions/DocumentReviewCard.tsx`
- Create: `apps/web/src/components/transactions/ChecklistTemplateEditor.tsx`

- [ ] **Step 1: Create DocumentReviewCard**

```typescript
// apps/web/src/components/transactions/DocumentReviewCard.tsx
"use client";
import { useState } from "react";
import { CheckCircle, XCircle, ExternalLink } from "lucide-react";
import type { FileDocumentRecord } from "@/types/transaction";

interface Props {
  document: FileDocumentRecord;
  onReviewed: () => void;
}

export function DocumentReviewCard({ document: doc, onReviewed }: Props) {
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function getDownloadUrl() {
    const { url } = await fetch(`/api/documents/${doc.id}/download`).then((r) => r.json());
    window.open(url, "_blank");
  }

  async function approve() {
    setLoading(true);
    await fetch(`/api/admin/documents/${doc.id}/approve`, { method: "POST" });
    setLoading(false);
    onReviewed();
  }

  async function reject() {
    if (!rejectNote.trim()) return;
    setLoading(true);
    await fetch(`/api/admin/documents/${doc.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: rejectNote }),
    });
    setLoading(false);
    setShowRejectForm(false);
    onReviewed();
  }

  const statusColor = { APPROVED: "text-green-600", REJECTED: "text-red-500", PENDING_REVIEW: "text-yellow-600", NOT_SUBMITTED: "text-zinc-400" }[doc.reviewStatus];

  return (
    <div className="rounded-lg border border-[#1B1B1B]/10 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[#1B1B1B]">{doc.name}</p>
          <p className="text-xs text-[#1B1B1B]/40">{new Date(doc.uploadedAt).toLocaleString()}</p>
          {doc.rejectionNote && <p className="mt-1 text-xs text-red-500">Note: {doc.rejectionNote}</p>}
        </div>
        <span className={`text-sm font-medium ${statusColor}`}>{doc.reviewStatus.replace("_", " ")}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={getDownloadUrl} className="flex items-center gap-1 rounded-full border border-[#1B1B1B]/20 px-3 py-1 text-xs text-[#1B1B1B]/60 hover:border-[#1B1B1B]/40">
          <ExternalLink className="h-3 w-3" /> View
        </button>
        {doc.reviewStatus === "PENDING_REVIEW" && (
          <>
            <button onClick={approve} disabled={loading} className="flex items-center gap-1 rounded-full bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50">
              <CheckCircle className="h-3 w-3" /> Approve
            </button>
            <button onClick={() => setShowRejectForm((v) => !v)} className="flex items-center gap-1 rounded-full bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600">
              <XCircle className="h-3 w-3" /> Reject
            </button>
          </>
        )}
      </div>

      {showRejectForm && (
        <div className="mt-3 space-y-2">
          <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Rejection reason (required)" rows={2} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowRejectForm(false)} className="text-sm text-[#1B1B1B]/50">Cancel</button>
            <button onClick={reject} disabled={loading || !rejectNote.trim()} className="rounded-full bg-red-500 px-4 py-1.5 text-sm text-white disabled:opacity-40">
              {loading ? "Saving…" : "Confirm Reject"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create ChecklistTemplateEditor**

```typescript
// apps/web/src/components/transactions/ChecklistTemplateEditor.tsx
"use client";
import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";

interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  order: number;
  isRequired: boolean;
}

interface Props {
  templateId: string;
  items: TemplateItem[];
  onChanged: () => void;
}

export function ChecklistTemplateEditor({ templateId, items, onChanged }: Props) {
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", description: "", isRequired: true });

  async function addItem() {
    if (!newItem.name.trim()) return;
    await fetch(`/api/admin/checklist-templates/${templateId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newItem, order: items.length + 1 }),
    });
    setNewItem({ name: "", description: "", isRequired: true });
    setAdding(false);
    onChanged();
  }

  async function deleteItem(itemId: string) {
    await fetch(`/api/admin/checklist-templates/${templateId}/items/${itemId}`, { method: "DELETE" });
    onChanged();
  }

  async function toggleRequired(itemId: string, current: boolean) {
    await fetch(`/api/admin/checklist-templates/${templateId}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRequired: !current }),
    });
    onChanged();
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2.5">
          <GripVertical className="h-4 w-4 shrink-0 text-[#1B1B1B]/20" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[#1B1B1B]">{item.name}</p>
            {item.description && <p className="text-xs text-[#1B1B1B]/50">{item.description}</p>}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-[#1B1B1B]/50">
            <input type="checkbox" checked={item.isRequired} onChange={() => toggleRequired(item.id, item.isRequired)} className="h-3.5 w-3.5 rounded" />
            Required
          </label>
          <button onClick={() => deleteItem(item.id)} className="text-[#1B1B1B]/30 hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="rounded-lg border border-[#1B1B1B]/10 p-3 space-y-2">
          <input value={newItem.name} onChange={(e) => setNewItem((n) => ({ ...n, name: e.target.value }))} placeholder="Document name" className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm" />
          <input value={newItem.description} onChange={(e) => setNewItem((n) => ({ ...n, description: e.target.value }))} placeholder="Description (optional)" className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm" />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-[#1B1B1B]/60">
              <input type="checkbox" checked={newItem.isRequired} onChange={(e) => setNewItem((n) => ({ ...n, isRequired: e.target.checked }))} /> Required
            </label>
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="text-sm text-[#1B1B1B]/50">Cancel</button>
              <button onClick={addItem} className="rounded-full bg-[#1B1B1B] px-4 py-1.5 text-sm text-white">Add</button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-sm text-[#1B1B1B]/50 hover:text-[#1B1B1B]">
          <Plus className="h-4 w-4" /> Add Item
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```powershell
git add apps/web/src/components/transactions/DocumentReviewCard.tsx apps/web/src/components/transactions/ChecklistTemplateEditor.tsx
git commit -m "feat: DocumentReviewCard and ChecklistTemplateEditor admin components"
```

---

## Task 16: Files List Page (`/dashboard/transactions`)

**Files:**
- Create: `apps/web/src/app/(dashboard)/dashboard/transactions/page.tsx`

- [ ] **Step 1: Create files list page**

```typescript
// apps/web/src/app/(dashboard)/dashboard/transactions/page.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { FileCard } from "@/components/transactions/FileCard";

type Tab = "listings" | "transactions";

export default function TransactionsPage() {
  const [tab, setTab] = useState<Tab>("listings");
  const [listings, setListings] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/listings").then((r) => r.json()),
      fetch("/api/transactions").then((r) => r.json()),
    ]).then(([l, t]) => {
      setListings(l.listings ?? []);
      setTransactions(t.transactions ?? []);
      setLoading(false);
    });
  }, []);

  const items = tab === "listings" ? listings : transactions;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-light text-[#1B1B1B]">Transactions</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/transactions/new-listing" className="flex items-center gap-1.5 rounded-full border border-[#1B1B1B]/20 px-4 py-2 text-sm text-[#1B1B1B]/60 hover:border-[#1B1B1B]/40 hover:text-[#1B1B1B]">
            <Plus className="h-4 w-4" /> New Listing
          </Link>
          <Link href="/dashboard/transactions/new-transaction" className="flex items-center gap-1.5 rounded-full bg-[#1B1B1B] px-4 py-2 text-sm text-white">
            <Plus className="h-4 w-4" /> New Transaction
          </Link>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="mb-6 flex gap-1 rounded-xl bg-[#F2F0EF] p-1 w-fit">
        {(["listings", "transactions"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${tab === t ? "bg-white text-[#1B1B1B] shadow-sm" : "text-[#1B1B1B]/50 hover:text-[#1B1B1B]"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-[#F2F0EF]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1B1B1B]/20 py-16 text-center">
          <p className="text-[#1B1B1B]/40">No {tab} yet</p>
          <Link href={`/dashboard/transactions/new-${tab === "listings" ? "listing" : "transaction"}`} className="mt-3 rounded-full bg-[#1B1B1B] px-4 py-2 text-sm text-white">
            Create your first {tab === "listings" ? "listing" : "transaction"}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <FileCard
              key={item.id}
              id={item.id}
              fileType={tab === "listings" ? "listing" : "transaction"}
              address={item.propertyAddress}
              city={item.city}
              status={item.status}
              closeDate={item.closeOfEscrow ?? item.expirationDate}
              listPrice={item.listPrice}
              checklistItems={item.checklistItems ?? []}
              awaitingReview={item.awaitingReview}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify page renders**

Navigate to `http://localhost:3000/dashboard/transactions` while logged in. Confirm tabs switch and empty state shows with "New Listing" / "New Transaction" buttons.

- [ ] **Step 3: Commit**

```powershell
git add apps/web/src/app/(dashboard)/dashboard/transactions/page.tsx
git commit -m "feat: transactions list page with Listings/Transactions tab switcher"
```

---

## Task 17: New Listing Form

**Files:**
- Create: `apps/web/src/app/(dashboard)/dashboard/transactions/new-listing/page.tsx`

- [ ] **Step 1: Create multi-step listing form**

```typescript
// apps/web/src/app/(dashboard)/dashboard/transactions/new-listing/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STEPS = ["Property Info", "Commission", "Review"] as const;

export default function NewListingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    propertyAddress: "", city: "", state: "CA", zip: "",
    mlsNumber: "", listPrice: "", listingType: "RESIDENTIAL_SALE",
    expirationDate: "", listDate: "",
    commissionPercent: "", commissionNotes: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit() {
    setSaving(true);
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const { listing } = await res.json();
      router.push(`/dashboard/transactions/listing/${listing.id}`);
    }
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/transactions" className="text-sm text-[#1B1B1B]/50 hover:text-[#1B1B1B]">← Back</Link>
        <h1 className="text-xl font-light text-[#1B1B1B]">New Listing</h1>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${i <= step ? "bg-[#1B1B1B] text-white" : "bg-[#F2F0EF] text-[#1B1B1B]/40"}`}>{i + 1}</div>
            <span className={`text-sm ${i === step ? "text-[#1B1B1B]" : "text-[#1B1B1B]/40"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="h-px w-8 bg-[#1B1B1B]/10" />}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-6 space-y-4">
        {step === 0 && (
          <>
            <Field label="Property Address *" value={form.propertyAddress} onChange={(v) => set("propertyAddress", v)} />
            <div className="grid grid-cols-3 gap-3">
              <Field label="City *" value={form.city} onChange={(v) => set("city", v)} />
              <Field label="State" value={form.state} onChange={(v) => set("state", v)} />
              <Field label="ZIP *" value={form.zip} onChange={(v) => set("zip", v)} />
            </div>
            <Field label="MLS Number" value={form.mlsNumber} onChange={(v) => set("mlsNumber", v)} />
            <Field label="List Price *" type="number" value={form.listPrice} onChange={(v) => set("listPrice", v)} />
            <div>
              <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">Listing Type *</label>
              <select value={form.listingType} onChange={(e) => set("listingType", e.target.value)} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm">
                <option value="RESIDENTIAL_SALE">Residential Sale</option>
                <option value="RESIDENTIAL_LEASE">Residential Lease</option>
                <option value="COMMERCIAL">Commercial</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="List Date" type="date" value={form.listDate} onChange={(v) => set("listDate", v)} />
              <Field label="Expiration Date" type="date" value={form.expirationDate} onChange={(v) => set("expirationDate", v)} />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Commission %" type="number" value={form.commissionPercent} onChange={(v) => set("commissionPercent", v)} />
            <div>
              <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">Commission Notes</label>
              <textarea value={form.commissionNotes} onChange={(e) => set("commissionNotes", e.target.value)} rows={3} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm" />
            </div>
          </>
        )}

        {step === 2 && (
          <div className="space-y-2 text-sm">
            <ReviewRow label="Address" value={`${form.propertyAddress}, ${form.city}, ${form.state} ${form.zip}`} />
            <ReviewRow label="List Price" value={form.listPrice ? `$${Number(form.listPrice).toLocaleString()}` : "—"} />
            <ReviewRow label="Type" value={form.listingType} />
            <ReviewRow label="Expiration" value={form.expirationDate || "—"} />
            <ReviewRow label="Commission" value={form.commissionPercent ? `${form.commissionPercent}%` : "—"} />
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        {step > 0 ? (
          <button onClick={() => setStep((s) => s - 1)} className="rounded-full border border-[#1B1B1B]/20 px-5 py-2 text-sm text-[#1B1B1B]/60">Back</button>
        ) : <div />}
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep((s) => s + 1)} className="rounded-full bg-[#1B1B1B] px-5 py-2 text-sm text-white">Next →</button>
        ) : (
          <button onClick={submit} disabled={saving} className="rounded-full bg-[#9E8C61] px-5 py-2 text-sm text-white disabled:opacity-50">
            {saving ? "Creating…" : "Create Listing"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30" />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-[#1B1B1B]/5 pb-2">
      <span className="text-[#1B1B1B]/50">{label}</span>
      <span className="font-medium text-[#1B1B1B]">{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add apps/web/src/app/(dashboard)/dashboard/transactions/new-listing/
git commit -m "feat: new listing multi-step form"
```

---

## Task 18: New Transaction Form

**Files:**
- Create: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx`

- [ ] **Step 1: Create multi-step transaction form**

```typescript
// apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STEPS = ["Transaction Type", "Property Info", "Key Dates", "Commission", "Review"] as const;

export default function NewTransactionPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    transactionSide: "BUYER_SIDE",
    propertyAddress: "", city: "", state: "CA", zip: "", mlsNumber: "",
    listPrice: "", salePrice: "",
    offerDate: "", acceptanceDate: "", inspectionDeadline: "",
    appraisalDeadline: "", loanApprovalDeadline: "", closeOfEscrow: "",
    commissionGCI: "", commissionSplit: "", commissionNotes: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit() {
    setSaving(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const { transaction } = await res.json();
      router.push(`/dashboard/transactions/transaction/${transaction.id}`);
    }
    setSaving(false);
  }

  const SIDES = [
    { value: "BUYER_SIDE", label: "Buyer-Side" },
    { value: "SELLER_SIDE", label: "Seller-Side" },
    { value: "DUAL", label: "Dual Agency" },
    { value: "LEASE", label: "Lease" },
  ];

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/transactions" className="text-sm text-[#1B1B1B]/50 hover:text-[#1B1B1B]">← Back</Link>
        <h1 className="text-xl font-light text-[#1B1B1B]">New Transaction</h1>
      </div>

      <div className="mb-8 flex gap-2 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${i <= step ? "bg-[#1B1B1B] text-white" : "bg-[#F2F0EF] text-[#1B1B1B]/40"}`}>{i + 1}</div>
            <span className={`text-sm ${i === step ? "text-[#1B1B1B]" : "text-[#1B1B1B]/40"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-[#1B1B1B]/10" />}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-6 space-y-4">
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {SIDES.map(({ value, label }) => (
              <button key={value} onClick={() => set("transactionSide", value)} className={`rounded-xl border-2 p-4 text-left transition-colors ${form.transactionSide === value ? "border-[#9E8C61] bg-[#9E8C61]/5" : "border-[#1B1B1B]/10 hover:border-[#1B1B1B]/30"}`}>
                <p className="font-medium text-[#1B1B1B]">{label}</p>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <>
            <Field label="Property Address *" value={form.propertyAddress} onChange={(v) => set("propertyAddress", v)} />
            <div className="grid grid-cols-3 gap-3">
              <Field label="City *" value={form.city} onChange={(v) => set("city", v)} />
              <Field label="State" value={form.state} onChange={(v) => set("state", v)} />
              <Field label="ZIP *" value={form.zip} onChange={(v) => set("zip", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="MLS Number" value={form.mlsNumber} onChange={(v) => set("mlsNumber", v)} />
              <Field label="List Price" type="number" value={form.listPrice} onChange={(v) => set("listPrice", v)} />
            </div>
            <Field label="Sale Price" type="number" value={form.salePrice} onChange={(v) => set("salePrice", v)} />
          </>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { field: "offerDate", label: "Offer Date" },
              { field: "acceptanceDate", label: "Acceptance Date" },
              { field: "inspectionDeadline", label: "Inspection Deadline" },
              { field: "appraisalDeadline", label: "Appraisal Deadline" },
              { field: "loanApprovalDeadline", label: "Loan Approval" },
              { field: "closeOfEscrow", label: "Close of Escrow" },
            ].map(({ field, label }) => (
              <Field key={field} label={label} type="date" value={(form as any)[field]} onChange={(v) => set(field, v)} />
            ))}
          </div>
        )}

        {step === 3 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="GCI ($)" type="number" value={form.commissionGCI} onChange={(v) => set("commissionGCI", v)} />
              <Field label="Split %" type="number" value={form.commissionSplit} onChange={(v) => set("commissionSplit", v)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">Commission Notes</label>
              <textarea value={form.commissionNotes} onChange={(e) => set("commissionNotes", e.target.value)} rows={3} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm" />
            </div>
          </>
        )}

        {step === 4 && (
          <div className="space-y-2 text-sm">
            <ReviewRow label="Type" value={form.transactionSide} />
            <ReviewRow label="Address" value={`${form.propertyAddress}, ${form.city}`} />
            <ReviewRow label="Sale Price" value={form.salePrice ? `$${Number(form.salePrice).toLocaleString()}` : "—"} />
            <ReviewRow label="COE" value={form.closeOfEscrow || "—"} />
            <ReviewRow label="GCI" value={form.commissionGCI ? `$${Number(form.commissionGCI).toLocaleString()}` : "—"} />
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        {step > 0 ? (
          <button onClick={() => setStep((s) => s - 1)} className="rounded-full border border-[#1B1B1B]/20 px-5 py-2 text-sm text-[#1B1B1B]/60">Back</button>
        ) : <div />}
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep((s) => s + 1)} className="rounded-full bg-[#1B1B1B] px-5 py-2 text-sm text-white">Next →</button>
        ) : (
          <button onClick={submit} disabled={saving} className="rounded-full bg-[#9E8C61] px-5 py-2 text-sm text-white disabled:opacity-50">
            {saving ? "Creating…" : "Create Transaction"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30" />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-[#1B1B1B]/5 pb-2">
      <span className="text-[#1B1B1B]/50">{label}</span>
      <span className="font-medium text-[#1B1B1B]">{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/
git commit -m "feat: new transaction multi-step form"
```

---

## Task 19: File Detail Page (Agent)

**Files:**
- Create: `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx`

- [ ] **Step 1: Create agent file detail page**

```typescript
// apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/transactions/StatusBadge";
import { ChecklistPanel } from "@/components/transactions/ChecklistPanel";
import { PartiesTable } from "@/components/transactions/PartiesTable";
import { ActivityFeed } from "@/components/transactions/ActivityFeed";
import { getChecklistProgress } from "@/lib/transaction-helpers";
import type { ListingFileDetail, TransactionFileDetail } from "@/types/transaction";

type Tab = "overview" | "documents" | "parties" | "activity";

export default function FileDetailPage() {
  const { fileType, id } = useParams<{ fileType: string; id: string }>();
  const isListing = fileType === "listing";
  const [data, setData] = useState<ListingFileDetail | TransactionFileDetail | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/${isListing ? "listings" : "transactions"}/${id}`)
      .then((r) => r.json())
      .then((d) => setData(d.listing ?? d.transaction));
  }, [id, isListing]);

  useEffect(() => { load(); }, [load]);

  async function submitForReview() {
    setSubmitting(true);
    const res = await fetch(`/api/${isListing ? "listings" : "transactions"}/${id}/submit-review`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) { alert(body.error); }
    else { load(); }
    setSubmitting(false);
  }

  async function convertToTransaction() {
    const res = await fetch(`/api/listings/${id}/convert`, { method: "POST" });
    const body = await res.json();
    if (res.ok) {
      window.location.href = `/dashboard/transactions/transaction/${body.transactionFile.id}`;
    }
  }

  if (!data) return <div className="animate-pulse h-48 rounded-xl bg-[#F2F0EF]" />;

  const { satisfied, required } = getChecklistProgress(data.checklistItems);
  const canSubmit = satisfied >= required && required > 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/transactions" className="text-sm text-[#1B1B1B]/50 hover:text-[#1B1B1B]">← Back</Link>
          <h1 className="mt-1 text-2xl font-light text-[#1B1B1B]">{data.propertyAddress}</h1>
          <p className="text-sm text-[#1B1B1B]/50">{data.city}, CA {data.zip}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={data.status} />
          {isListing && data.status === "ACTIVE" && (
            <button onClick={convertToTransaction} className="rounded-full border border-[#9E8C61] px-3 py-1 text-xs text-[#9E8C61] hover:bg-[#9E8C61]/5">
              Convert to Transaction →
            </button>
          )}
          {!data.awaitingReview && canSubmit && (
            <button onClick={submitForReview} disabled={submitting} className="rounded-full bg-[#1B1B1B] px-4 py-1.5 text-sm text-white disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit for Review"}
            </button>
          )}
          {data.awaitingReview && (
            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">Awaiting Broker Review</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-[#1B1B1B]/10">
        {(["overview", "documents", "parties", "activity"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? "border-b-2 border-[#1B1B1B] text-[#1B1B1B]" : "text-[#1B1B1B]/50 hover:text-[#1B1B1B]"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5">
            <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/40">File Details</h2>
            <dl className="space-y-3 text-sm">
              <DetailRow label="List Price" value={data.listPrice ? `$${data.listPrice.toLocaleString()}` : "—"} />
              {!isListing && (
                <>
                  <DetailRow label="Sale Price" value={(data as TransactionFileDetail).salePrice ? `$${(data as TransactionFileDetail).salePrice!.toLocaleString()}` : "—"} />
                  <DetailRow label="Close of Escrow" value={(data as TransactionFileDetail).closeOfEscrow ? new Date((data as TransactionFileDetail).closeOfEscrow!).toLocaleDateString() : "—"} />
                  <DetailRow label="Inspection Deadline" value={(data as TransactionFileDetail).inspectionDeadline ? new Date((data as TransactionFileDetail).inspectionDeadline!).toLocaleDateString() : "—"} />
                  <DetailRow label="Appraisal Deadline" value={(data as TransactionFileDetail).appraisalDeadline ? new Date((data as TransactionFileDetail).appraisalDeadline!).toLocaleDateString() : "—"} />
                  <DetailRow label="Loan Approval" value={(data as TransactionFileDetail).loanApprovalDeadline ? new Date((data as TransactionFileDetail).loanApprovalDeadline!).toLocaleDateString() : "—"} />
                </>
              )}
              {isListing && (
                <>
                  <DetailRow label="List Date" value={(data as ListingFileDetail).listDate ? new Date((data as ListingFileDetail).listDate!).toLocaleDateString() : "—"} />
                  <DetailRow label="Expiration" value={(data as ListingFileDetail).expirationDate ? new Date((data as ListingFileDetail).expirationDate!).toLocaleDateString() : "—"} />
                  <DetailRow label="Commission" value={(data as ListingFileDetail).commissionPercent ? `${(data as ListingFileDetail).commissionPercent}%` : "—"} />
                </>
              )}
            </dl>
          </div>

          <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5">
            <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/40">Checklist Progress</h2>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-[#1B1B1B]/60">{satisfied} of {required} required items complete</span>
              <span className="font-medium text-[#1B1B1B]">{required > 0 ? Math.round((satisfied / required) * 100) : 0}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#F2F0EF]">
              <div className="h-2 rounded-full bg-[#9E8C61]" style={{ width: `${required > 0 ? Math.round((satisfied / required) * 100) : 0}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Documents tab */}
      {tab === "documents" && (
        <ChecklistPanel
          fileType={isListing ? "LISTING" : "TRANSACTION"}
          fileId={id}
          items={data.checklistItems}
          onUploaded={load}
        />
      )}

      {/* Parties tab */}
      {tab === "parties" && (
        <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5">
          <PartiesTable
            fileType={isListing ? "listing" : "transaction"}
            fileId={id}
            parties={data.parties}
            onChanged={load}
          />
        </div>
      )}

      {/* Activity tab */}
      {tab === "activity" && (
        <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5">
          <ActivityFeed
            fileType={isListing ? "listing" : "transaction"}
            fileId={id}
            activities={data.activities}
            onNoteAdded={load}
          />
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[#1B1B1B]/50">{label}</dt>
      <dd className="font-medium text-[#1B1B1B]">{value}</dd>
    </div>
  );
}
```

- [ ] **Step 2: Test full flow**

1. Create a new listing at `/dashboard/transactions/new-listing`
2. Open the file detail → confirm Overview tab shows key fields
3. Go to Documents tab → upload a PDF → confirm it appears with "Pending Review" status
4. Go to Parties tab → add a party → confirm it appears in the table
5. Go to Activity tab → add a note → confirm it appears in the feed

- [ ] **Step 3: Commit**

```powershell
git add apps/web/src/app/(dashboard)/dashboard/transactions/
git commit -m "feat: agent file detail page with Overview/Documents/Parties/Activity tabs"
```

---

## Task 20: Admin Transactions Page + Audit Queue

**Files:**
- Create: `apps/web/src/app/(dashboard)/admin/transactions/page.tsx`

- [ ] **Step 1: Create admin transactions page**

```typescript
// apps/web/src/app/(dashboard)/admin/transactions/page.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileCard } from "@/components/transactions/FileCard";
import { AlertCircle } from "lucide-react";

export default function AdminTransactionsPage() {
  const [auditQueue, setAuditQueue] = useState<{ listings: any[]; transactions: any[] }>({ listings: [], transactions: [] });
  const [allListings, setAllListings] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [tab, setTab] = useState<"queue" | "listings" | "transactions">("queue");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/audit-queue").then((r) => r.json()),
      // Admin needs an all-listings endpoint — for now use the same /api/listings but broker sees all
      fetch("/api/listings").then((r) => r.json()),
      fetch("/api/transactions").then((r) => r.json()),
    ]).then(([queue, l, t]) => {
      setAuditQueue(queue);
      setAllListings(l.listings ?? []);
      setAllTransactions(t.transactions ?? []);
      setLoading(false);
    });
  }, []);

  const queueCount = (auditQueue.listings?.length ?? 0) + (auditQueue.transactions?.length ?? 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-light text-[#1B1B1B]">All Files</h1>
        <p className="text-sm text-[#1B1B1B]/50">All agent listings and transactions</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-[#F2F0EF] p-1 w-fit">
        <button onClick={() => setTab("queue")} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${tab === "queue" ? "bg-white text-[#1B1B1B] shadow-sm" : "text-[#1B1B1B]/50"}`}>
          <AlertCircle className="h-3.5 w-3.5 text-yellow-600" />
          Audit Queue {queueCount > 0 && <span className="ml-1 rounded-full bg-yellow-500 px-1.5 py-0.5 text-xs text-white">{queueCount}</span>}
        </button>
        <button onClick={() => setTab("listings")} className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${tab === "listings" ? "bg-white text-[#1B1B1B] shadow-sm" : "text-[#1B1B1B]/50"}`}>Listings</button>
        <button onClick={() => setTab("transactions")} className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${tab === "transactions" ? "bg-white text-[#1B1B1B] shadow-sm" : "text-[#1B1B1B]/50"}`}>Transactions</button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-[#F2F0EF]" />)}
        </div>
      ) : (
        <>
          {tab === "queue" && (
            <div>
              {queueCount === 0 ? (
                <div className="rounded-xl border border-dashed border-[#1B1B1B]/20 py-16 text-center">
                  <p className="text-[#1B1B1B]/40">No files awaiting review</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {[...auditQueue.listings.map((f: any) => ({ ...f, _type: "listing" })), ...auditQueue.transactions.map((f: any) => ({ ...f, _type: "transaction" }))].map((file) => (
                    <Link key={file.id} href={`/admin/transactions/${file._type}/${file.id}`}>
                      <FileCard id={file.id} fileType={file._type} address={file.propertyAddress} city={file.city} status={file.status} listPrice={file.listPrice} checklistItems={file.checklistItems ?? []} awaitingReview={true} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "listings" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {allListings.map((f: any) => (
                <Link key={f.id} href={`/admin/transactions/listing/${f.id}`}>
                  <FileCard id={f.id} fileType="listing" address={f.propertyAddress} city={f.city} status={f.status} listPrice={f.listPrice} checklistItems={f.checklistItems ?? []} awaitingReview={f.awaitingReview} />
                </Link>
              ))}
            </div>
          )}

          {tab === "transactions" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {allTransactions.map((f: any) => (
                <Link key={f.id} href={`/admin/transactions/transaction/${f.id}`}>
                  <FileCard id={f.id} fileType="transaction" address={f.propertyAddress} city={f.city} status={f.status} listPrice={f.listPrice} checklistItems={f.checklistItems ?? []} awaitingReview={f.awaitingReview} />
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add apps/web/src/app/(dashboard)/admin/transactions/page.tsx
git commit -m "feat: admin transactions page with audit queue + all-files view"
```

---

## Task 21: Admin File Detail Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx`

- [ ] **Step 1: Create admin file detail page**

```typescript
// apps/web/src/app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/transactions/StatusBadge";
import { DocumentReviewCard } from "@/components/transactions/DocumentReviewCard";
import { PartiesTable } from "@/components/transactions/PartiesTable";
import { ActivityFeed } from "@/components/transactions/ActivityFeed";
import { isReadyToClose } from "@/lib/transaction-helpers";
import type { ListingFileDetail, TransactionFileDetail, ListingStatus, TransactionFileStatus } from "@/types/transaction";

type Tab = "documents" | "parties" | "activity";

const LISTING_STATUSES: ListingStatus[] = ["INCOMPLETE", "COMING_SOON", "ACTIVE", "ACTIVE_UNDER_CONTRACT", "EXPIRED", "WITHDRAWN", "CANCELED", "CLOSED"];
const TX_STATUSES: TransactionFileStatus[] = ["INCOMPLETE", "PRE_CONTRACT", "PENDING", "EXPIRED", "CLOSED", "ARCHIVED", "CANCELED_PENDING", "CANCELED_APPROVED"];

export default function AdminFileDetailPage() {
  const { fileType, id } = useParams<{ fileType: string; id: string }>();
  const isListing = fileType === "listing";
  const [data, setData] = useState<ListingFileDetail | TransactionFileDetail | null>(null);
  const [tab, setTab] = useState<Tab>("documents");
  const [statusOverride, setStatusOverride] = useState("");
  const [changing, setChanging] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/${isListing ? "listings" : "transactions"}/${id}`)
      .then((r) => r.json())
      .then((d) => setData(d.listing ?? d.transaction));
  }, [id, isListing]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus() {
    if (!statusOverride) return;
    setChanging(true);
    const res = await fetch(`/api/admin/files/${fileType}/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusOverride }),
    });
    const body = await res.json();
    if (!res.ok) { alert(body.error); }
    else { load(); setStatusOverride(""); }
    setChanging(false);
  }

  if (!data) return <div className="animate-pulse h-48 rounded-xl bg-[#F2F0EF]" />;

  const readyToClose = isReadyToClose(data.checklistItems);
  const allDocs = data.documents;
  const pendingDocs = allDocs.filter((d) => d.reviewStatus === "PENDING_REVIEW");
  const statusList = isListing ? LISTING_STATUSES : TX_STATUSES;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/transactions" className="text-sm text-[#1B1B1B]/50 hover:text-[#1B1B1B]">← Back to All Files</Link>
          <h1 className="mt-1 text-2xl font-light text-[#1B1B1B]">{data.propertyAddress}</h1>
          <p className="text-sm text-[#1B1B1B]/50">{data.city}, CA</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={data.status} />
          {data.awaitingReview && (
            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">Awaiting Review</span>
          )}
        </div>
      </div>

      {/* Broker status override */}
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#9E8C61]/30 bg-[#9E8C61]/5 p-4">
        <p className="text-sm font-medium text-[#1B1B1B]">Broker Controls</p>
        <select value={statusOverride} onChange={(e) => setStatusOverride(e.target.value)} className="rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-1.5 text-sm">
          <option value="">Change status…</option>
          {statusList.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={changeStatus} disabled={!statusOverride || changing || (!readyToClose && statusOverride === "CLOSED")} className="rounded-full bg-[#1B1B1B] px-4 py-1.5 text-sm text-white disabled:opacity-40">
          {changing ? "Saving…" : "Apply"}
        </button>
        {!readyToClose && statusOverride === "CLOSED" && (
          <p className="text-xs text-red-500">Cannot close: required docs not all approved</p>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-[#1B1B1B]/10">
        {(["documents", "parties", "activity"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium capitalize ${tab === t ? "border-b-2 border-[#1B1B1B] text-[#1B1B1B]" : "text-[#1B1B1B]/50"}`}>
            {t}
            {t === "documents" && pendingDocs.length > 0 && (
              <span className="rounded-full bg-yellow-500 px-1.5 py-0.5 text-xs text-white">{pendingDocs.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "documents" && (
        <div className="space-y-3">
          {allDocs.length === 0 && <p className="text-sm text-[#1B1B1B]/40">No documents uploaded yet.</p>}
          {allDocs.map((doc) => (
            <DocumentReviewCard key={doc.id} document={doc} onReviewed={load} />
          ))}
        </div>
      )}

      {tab === "parties" && (
        <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5">
          <PartiesTable fileType={isListing ? "listing" : "transaction"} fileId={id} parties={data.parties} onChanged={load} />
        </div>
      )}

      {tab === "activity" && (
        <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5">
          <ActivityFeed fileType={isListing ? "listing" : "transaction"} fileId={id} activities={data.activities} onNoteAdded={load} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add apps/web/src/app/(dashboard)/admin/transactions/
git commit -m "feat: admin file detail page with document review + status override + broker controls"
```

---

## Task 22: Admin Checklist Settings Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/admin/settings/checklists/page.tsx`

- [ ] **Step 1: Create checklist template manager page**

```typescript
// apps/web/src/app/(dashboard)/admin/settings/checklists/page.tsx
"use client";
import { useEffect, useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { ChecklistTemplateEditor } from "@/components/transactions/ChecklistTemplateEditor";

interface Template {
  id: string;
  name: string;
  fileType: string;
  transactionSide: string;
  listingType: string;
  isActive: boolean;
  items: any[];
}

export default function ChecklistsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", fileType: "LISTING", transactionSide: "ALL", listingType: "ALL" });

  function load() {
    fetch("/api/admin/checklist-templates").then((r) => r.json()).then((d) => setTemplates(d.templates ?? []));
  }

  useEffect(() => { load(); }, []);

  async function createTemplate() {
    await fetch("/api/admin/checklist-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTemplate),
    });
    setAdding(false);
    setNewTemplate({ name: "", fileType: "LISTING", transactionSide: "ALL", listingType: "ALL" });
    load();
  }

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/admin/checklist-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-[#1B1B1B]">Checklist Templates</h1>
          <p className="text-sm text-[#1B1B1B]/50">Define required documents for each file type</p>
        </div>
        <button onClick={() => setAdding((v) => !v)} className="flex items-center gap-1.5 rounded-full bg-[#1B1B1B] px-4 py-2 text-sm text-white">
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      {adding && (
        <div className="mb-6 rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-4">
          <h2 className="font-medium text-[#1B1B1B]">New Template</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">Name *</label>
              <input value={newTemplate.name} onChange={(e) => setNewTemplate((n) => ({ ...n, name: e.target.value }))} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">File Type</label>
              <select value={newTemplate.fileType} onChange={(e) => setNewTemplate((n) => ({ ...n, fileType: e.target.value }))} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm">
                <option value="LISTING">Listing</option>
                <option value="TRANSACTION">Transaction</option>
              </select>
            </div>
            {newTemplate.fileType === "TRANSACTION" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">Transaction Side</label>
                <select value={newTemplate.transactionSide} onChange={(e) => setNewTemplate((n) => ({ ...n, transactionSide: e.target.value }))} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm">
                  <option value="ALL">All</option>
                  <option value="BUYER_SIDE">Buyer-Side</option>
                  <option value="SELLER_SIDE">Seller-Side</option>
                  <option value="DUAL">Dual</option>
                  <option value="LEASE">Lease</option>
                </select>
              </div>
            )}
            {newTemplate.fileType === "LISTING" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">Listing Type</label>
                <select value={newTemplate.listingType} onChange={(e) => setNewTemplate((n) => ({ ...n, listingType: e.target.value }))} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm">
                  <option value="ALL">All</option>
                  <option value="RESIDENTIAL_SALE">Residential Sale</option>
                  <option value="RESIDENTIAL_LEASE">Residential Lease</option>
                  <option value="COMMERCIAL">Commercial</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-sm text-[#1B1B1B]/50">Cancel</button>
            <button onClick={createTemplate} className="rounded-full bg-[#1B1B1B] px-4 py-1.5 text-sm text-white">Create</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-[#1B1B1B]/10 bg-white">
            <div className="flex items-center gap-4 p-4">
              <button onClick={() => setExpanded(expanded === t.id ? null : t.id)} className="flex flex-1 items-center gap-3 text-left">
                <ChevronDown className={`h-4 w-4 shrink-0 text-[#1B1B1B]/40 transition-transform ${expanded === t.id ? "rotate-180" : ""}`} />
                <div>
                  <p className="font-medium text-[#1B1B1B]">{t.name}</p>
                  <p className="text-xs text-[#1B1B1B]/50">{t.fileType} · {t.transactionSide !== "ALL" ? t.transactionSide : t.listingType} · {t.items.length} items</p>
                </div>
              </button>
              <label className="flex items-center gap-2 text-sm text-[#1B1B1B]/50">
                <input type="checkbox" checked={t.isActive} onChange={() => toggleActive(t.id, t.isActive)} className="h-4 w-4 rounded" />
                Active
              </label>
            </div>
            {expanded === t.id && (
              <div className="border-t border-[#1B1B1B]/10 p-4">
                <ChecklistTemplateEditor templateId={t.id} items={t.items} onChanged={load} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test admin checklist flow**

1. Log in as ADMIN, navigate to `/admin/settings/checklists`
2. Create a new template, add 3 items, toggle one as not required
3. Deactivate the template → confirm it shows as inactive
4. Create a new listing file → confirm checklist items are NOT applied (inactive template)
5. Re-activate → create another listing → confirm items ARE applied

- [ ] **Step 3: Final Phase 5A commit**

```powershell
git add apps/web/src/app/(dashboard)/admin/
git commit -m "feat: admin checklist settings page — Phase 5A complete"
```

---

## Post-Implementation Checklist

After all tasks are committed, verify end-to-end:

- [ ] Agent logs in → `/dashboard/transactions` shows empty state with "New Listing" and "New Transaction" buttons
- [ ] Agent creates a listing → file detail opens, checklist shows required documents
- [ ] Agent uploads a PDF to a checklist item → status shows "Pending Review"
- [ ] Agent clicks "Submit for Review" → broker receives email at `info@cncrealtygroup.com`
- [ ] Admin logs in → `/admin/transactions` shows Audit Queue with the submitted file
- [ ] Admin opens file → rejects a document → agent receives rejection email
- [ ] Agent re-uploads → resubmits
- [ ] Admin approves all docs → agent receives "All Docs Approved" email
- [ ] Admin changes status to CLOSED → agent receives "File Closed" email
- [ ] Listing → "Convert to Transaction" → new TransactionFile created, listing status → ACTIVE_UNDER_CONTRACT
- [ ] Admin creates a checklist template at `/admin/settings/checklists` → new files use it automatically
- [ ] `pnpm --filter web test` → 10 tests pass

---

## Environment Variables Required

Add to `apps/web/.env.local` (and to Vercel/Railway environment settings before deploying):

```
R2_ACCOUNT_ID=<cloudflare_account_id>
R2_ACCESS_KEY_ID=<r2_access_key>
R2_SECRET_ACCESS_KEY=<r2_secret>
R2_BUCKET=cnc-realty-documents
NEXT_PUBLIC_R2_ACCOUNT_ID=<cloudflare_account_id>
NEXT_PUBLIC_R2_BUCKET=cnc-realty-documents
```

