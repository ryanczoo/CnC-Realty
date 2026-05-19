# Transaction Management — Design Spec
**Date:** 2026-05-19  
**Phase:** 5A  
**Scope:** Listing Files + Transaction Files (SkySlope parity)

---

## Overview

CnC agents need a transaction management system that mirrors SkySlope: two distinct file types (Listings and Transactions), each with their own statuses, broker-configurable document checklists, a compliance review workflow, and an activity timeline. Listing files can be converted into Transaction files when an offer is accepted. The broker (Ryan) reviews all uploaded documents and approves or rejects them before a file can be closed.

---

## File Types

### Listing File
Opened when a CnC agent takes on a seller client and lists a property.

**Statuses (in order):**
| Status | Meaning |
|---|---|
| `INCOMPLETE` | Required file info not fully entered |
| `COMING_SOON` | Pre-market or temporarily on hold |
| `ACTIVE` | Listing is live, expiration date hasn't passed |
| `ACTIVE_UNDER_CONTRACT` | Listed property has an accepted offer |
| `EXPIRED` | Listing expiration date has passed |
| `WITHDRAWN` | Listing pulled by seller |
| `CANCELED` | Listing canceled |
| `CLOSED` | Property sold and closed |

### Transaction File
Opened when a deal is under contract — either converted from a Listing or created directly from a Lead (or from scratch for buyer-side deals).

**Statuses (in order):**
| Status | Meaning |
|---|---|
| `INCOMPLETE` | Required file info not fully entered |
| `PRE_CONTRACT` | Buyer agreement phase, before property is under contract |
| `PENDING` | Active transaction, closing date hasn't passed |
| `EXPIRED` | Closing date passed without the file being closed |
| `CLOSED` | Transaction has been closed |
| `ARCHIVED` | Closed transaction moved to archive |
| `CANCELED_PENDING` | Canceled but awaiting broker approval |
| `CANCELED_APPROVED` | Canceled and approved by broker |

---

## Listing → Transaction Conversion

When a listing receives an accepted offer, the agent clicks **"Convert to Transaction"** on the Listing file. This:
1. Creates a new Transaction file pre-populated with the property address, MLS#, listing price, and listing agent
2. Sets the Listing status to `ACTIVE_UNDER_CONTRACT`
3. Links the Transaction back to the originating Listing via `originatingListingId`
4. Agents then fill in the buyer info, key dates, and transaction-specific parties

---

## Data Models

### `ListingFile`
```
id, agentId, propertyAddress, city, state, zip, mlsNumber (optional),
listPrice, listingType (RESIDENTIAL_SALE | RESIDENTIAL_LEASE | COMMERCIAL),
status (ListingStatus enum), expirationDate, listDate,
commissionPercent, commissionNotes,
createdAt, updatedAt
```

### `TransactionFile`
```
id, agentId, originatingListingId (nullable),
originatingLeadId (nullable),
propertyAddress, city, state, zip, mlsNumber (optional),
transactionType (BUYER_SIDE | SELLER_SIDE | DUAL | LEASE),
status (TransactionStatus enum),
listPrice, salePrice,
offerDate, acceptanceDate, inspectionDeadline, appraisalDeadline,
loanApprovalDeadline, closeOfEscrow,
commissionGCI, commissionSplit, commissionNotes,
createdAt, updatedAt
```

### `FileParty`
People attached to a Listing or Transaction file.
```
id, fileType (LISTING | TRANSACTION), fileId,
role (BUYER | SELLER | LISTING_AGENT | BUYERS_AGENT | CO_AGENT |
      TITLE_ESCROW | LENDER | TRANSACTION_COORDINATOR | OTHER),
name, email, phone, company, licenseNumber (optional),
createdAt
```

### `ChecklistTemplate`
Broker-defined required document list per file type + transaction type. Managed in the admin panel.
```
id, name, fileType (LISTING | TRANSACTION),
transactionType (BUYER_SIDE | SELLER_SIDE | DUAL | LEASE | ALL),
listingType (RESIDENTIAL_SALE | RESIDENTIAL_LEASE | COMMERCIAL | ALL),
isActive, createdAt, updatedAt
```

### `ChecklistTemplateItem`
Individual document requirement within a template.
```
id, templateId, name, description (nullable), order, isRequired
```

### `FileDocument`
An uploaded document on a Listing or Transaction file.
```
id, fileType (LISTING | TRANSACTION), fileId,
checklistItemId (nullable — links to which checklist item this satisfies),
name, r2Key (Cloudflare R2 object key), r2Url,
uploadedByAgentId, uploadedAt,
reviewStatus (PENDING_REVIEW | APPROVED | REJECTED | NOT_SUBMITTED),
reviewedByAdminId (nullable), reviewedAt (nullable),
rejectionNote (nullable)
```

### `FileActivity`
Polymorphic activity log on any file.
```
id, fileType (LISTING | TRANSACTION), fileId,
actorId, actorRole (AGENT | ADMIN),
type (FILE_CREATED | STATUS_CHANGED | DOCUMENT_UPLOADED | DOCUMENT_APPROVED |
      DOCUMENT_REJECTED | SUBMITTED_FOR_REVIEW | PARTY_ADDED | NOTE_ADDED |
      CONVERTED_TO_TRANSACTION),
payload (JSON — e.g. { from: "ACTIVE", to: "PENDING" }),
note (nullable — free-text note from agent or broker),
createdAt
```

---

## Document Checklist System

### How It Works
1. Broker creates a `ChecklistTemplate` for each combination (e.g., "Buyer-Side Transaction", "Seller Listing — Residential") in the admin panel
2. When an agent creates a new file, the system applies the matching active template, creating a `FileChecklist` snapshot (so template changes don't break existing files)
3. The agent's file view shows their checklist with upload buttons per item
4. Documents not tied to a checklist item can still be uploaded as "Additional Documents"
5. Agents cannot submit for review until all `isRequired` checklist items have at least one `PENDING_REVIEW` or `APPROVED` document attached

### Checklist Snapshot on File Creation
When a file is created, copy the current template items into the file as `FileChecklistItem` rows. This decouples a file's requirements from future template edits.

```
FileChecklistItem: id, fileId, fileType, name, description, order, isRequired
```

A checklist item is considered **satisfied** when at least one `FileDocument` exists with `checklistItemId = item.id` and `reviewStatus != REJECTED`. This is derived — not stored — to avoid a bidirectional reference.

---

## Compliance Review Workflow

```
Agent uploads document
       ↓
Document status: PENDING_REVIEW
       ↓
Agent marks all required items uploaded → clicks "Submit for Review"
       ↓
File flagged as awaiting_review = true
Broker notified via email (noreply@cncrealtygroup.com)
       ↓
Broker opens Audit Queue in admin panel
Reviews each document:
  → Approve: status = APPROVED, activity logged
  → Reject: status = REJECTED, rejectionNote saved, agent notified via email
       ↓
If any rejected → agent re-uploads → resubmits
       ↓
All required docs APPROVED → broker can change file status to CLOSED
```

**Key rules:**
- Only the broker (ADMIN role) can approve or reject documents
- Only the broker can change file status to CLOSED, ARCHIVED, CANCELED_APPROVED
- Agents can change status within their allowed transitions (e.g., INCOMPLETE → PRE_CONTRACT, add parties, upload docs)
- A file cannot be closed until all `isRequired` checklist items are satisfied with an APPROVED document

---

## Notifications

| Event | Who gets notified | Channel |
|---|---|---|
| Agent submits file for review | Broker (Ryan) | Email to `info@cncrealtygroup.com` |
| Broker rejects a document | Agent | Email to agent's registered email |
| Broker approves all docs on a file | Agent | Email |
| File status changed to CLOSED | Agent | Email |
| File expiration approaching (3 days out) | Agent | Email |

All emails sent via SendGrid using `noreply@cncrealtygroup.com`.

---

## UI Pages & Components

### Agent-Facing (`/dashboard/`)

**`/dashboard/transactions`**
- Tab switcher: Listings | Transactions
- Card grid showing all agent's files with status badge, address, close date, checklist progress bar
- "New Listing" and "New Transaction" buttons

**`/dashboard/transactions/new-listing`**
- Multi-step form: Property Info → Parties → Commission → Review
- Applies matching checklist template on creation

**`/dashboard/transactions/new-transaction`**
- Multi-step form: Transaction Type → Property Info → Key Dates → Parties → Commission → Review
- Option to link to an existing lead

**`/dashboard/transactions/[fileType]/[id]`** (Listing or Transaction detail)
- **Header:** Address, status badge (with allowed status transitions as a dropdown), "Convert to Transaction" button (listings only)
- **Tabs:** Overview | Documents | Parties | Activity
- **Overview tab:** Key dates, commission fields, all editable inline
- **Documents tab:** Checklist with per-item upload buttons + status badges (Pending / Approved / Rejected). Rejected items show broker's note in red. "Additional Documents" section below. "Submit for Review" button (disabled until all required items have uploads)
- **Parties tab:** Table of all parties with add/edit/remove
- **Activity tab:** Chronological feed of all activity log entries + "Add Note" form

### Broker-Facing (`/admin/`)

**`/admin/transactions`**
- All files across all agents, filterable by status/agent/type/date
- "Audit Queue" highlighted section showing files awaiting review

**`/admin/transactions/[fileType]/[id]`**
- Same layout as agent view + broker controls:
  - Approve / Reject buttons on each document (reject opens note modal)
  - Status override dropdown (all statuses available)
  - "Close File" button (only enabled when all required docs approved)

**`/admin/settings/checklists`**
- Manage checklist templates: create/edit/archive templates, add/reorder/remove items, toggle isRequired per item

---

## File Storage (Cloudflare R2)

- R2 bucket: `cnc-realty-documents`
- Object key pattern: `transactions/{fileType}/{fileId}/{documentId}/{filename}`
- Upload flow: client requests a presigned PUT URL from `/api/upload-url`, uploads directly to R2, then calls `/api/documents` to register the `FileDocument` record
- Files are private (no public access); served via short-lived presigned GET URLs generated on demand
- Max file size: 50MB per document
- Allowed types: PDF, JPG, PNG, DOCX

---

## API Routes

```
POST   /api/listings                          Create listing file
GET    /api/listings                          Agent's listings (paginated)
GET    /api/listings/[id]                     Listing detail
PATCH  /api/listings/[id]                     Update listing (info, status, commission)
POST   /api/listings/[id]/convert             Convert listing → transaction
POST   /api/listings/[id]/submit-review       Submit listing for broker review
DELETE /api/listings/[id]                     Delete (INCOMPLETE only)

POST   /api/transactions                      Create transaction file
GET    /api/transactions                      Agent's transactions (paginated)
GET    /api/transactions/[id]                 Transaction detail
PATCH  /api/transactions/[id]                 Update transaction
POST   /api/transactions/[id]/submit-review   Submit for broker review

POST   /api/files/[fileType]/[id]/parties     Add party
PATCH  /api/files/[fileType]/[id]/parties/[partyId]
DELETE /api/files/[fileType]/[id]/parties/[partyId]

GET    /api/upload-url                        Get presigned R2 PUT URL
POST   /api/documents                         Register uploaded document
DELETE /api/documents/[id]                    Remove document (agent, pre-review only)
GET    /api/documents/[id]/download           Get presigned R2 GET URL (15-min TTL)

POST   /api/admin/documents/[id]/approve      Broker approves document
POST   /api/admin/documents/[id]/reject       Broker rejects document (body: { note })
GET    /api/admin/audit-queue                 All files awaiting review
PATCH  /api/admin/files/[fileType]/[id]/status Override file status

GET    /api/admin/checklist-templates         List templates
POST   /api/admin/checklist-templates         Create template
PATCH  /api/admin/checklist-templates/[id]    Update template
POST   /api/admin/checklist-templates/[id]/items  Add item
PATCH  /api/admin/checklist-templates/[id]/items/[itemId]
DELETE /api/admin/checklist-templates/[id]/items/[itemId]
```

---

## Prisma Schema Changes

New models to add to `packages/database/prisma/schema.prisma`:
- `ListingFile` + `ListingStatus` enum
- `TransactionFile` + `TransactionStatus` enum (update existing `Transaction` → rename to `TransactionFile`)
- `FileParty` + `FilePartyRole` enum
- `ChecklistTemplate` + `ChecklistTemplateItem`
- `FileChecklistItem` (snapshot)
- `FileDocument` + `DocumentReviewStatus` enum
- `FileActivity` + `FileActivityType` enum

The existing `Transaction` model in the schema will be **renamed** to `TransactionFile` to align with the two-file-type system. This requires a Prisma migration (`ALTER TABLE "Transaction" RENAME TO "TransactionFile"`) and a find-and-replace of all `prisma.transaction` → `prisma.transactionFile` references in existing Phase 3 dashboard code before any new code is written.

---

## Out of Scope (Phase 5A)

- E-signatures (agents use external tools, upload signed PDFs)
- Commission disbursement / accounting (SkySlope Books equivalent — Phase 6)
- Drip campaigns / email sequences (separate Phase 5 subsystem)
- Admin dashboard overview page (separate Phase 5 subsystem)
- Forms auto-population
- Mobile app
