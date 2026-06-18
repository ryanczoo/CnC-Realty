# Sub-project 3: Deal Pipeline — Design Spec

**Date:** 2026-06-18
**Phase:** 7 (CRM Expansion)
**Sub-project:** 3 of 8
**Status:** Approved — ready for implementation planning

---

## Overview

The Deal Pipeline is a lightweight Kanban board that tracks active real estate deals from first contact through offer accepted. It bridges the gap between the Lead CRM (where prospects live) and the TransactionFile system (where in-contract work happens). Agents work in the pipeline until an offer is accepted, at which point the deal graduates into a TransactionFile and exits the pipeline. Agents never have to maintain two systems in parallel for the same client.

**Depends on:** Sub-projects 1 & 2 (Lead model with tags, status, Smart Lists).

**What ships:**
- `Deal` schema + migration
- Two pipelines: Buyers and Sellers, each with their own stage progression
- Kanban board UI with drag-and-drop stage movement
- Deal card with key fields visible at a glance
- Deal detail drawer (edit fields, notes, stage history)
- New Deal modal (from pipeline board or lead profile)
- Deals section on lead profile page
- `/api/deals/[id]/convert` endpoint that creates a TransactionFile pre-filled from deal data
- Pipeline link in dashboard sidebar nav

**What is deferred:**
- Commission tracking on deals (lives in TransactionFile)
- Shared/team deals (agent-scoped only for now)
- Deal activity log / history thread (notes field covers MVP needs)
- Sub-project 6 (Lead Pool) integration

---

## Section 1: Data Model

### 1.1 New `Deal` model

```prisma
model Deal {
  id                String       @id @default(cuid())
  agentId           String
  leadId            String
  pipeline          DealPipeline
  stage             DealStage
  propertyAddress   String?
  price             Float?
  expectedCloseDate DateTime?
  notes             String?
  transactionFileId String?      @unique
  stageUpdatedAt    DateTime     @default(now())
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  agent           Agent            @relation(fields: [agentId], references: [id])
  lead            Lead             @relation(fields: [leadId], references: [id])
  transactionFile TransactionFile? @relation(fields: [transactionFileId], references: [id])

  @@index([agentId])
  @@index([leadId])
}

enum DealPipeline {
  BUYERS
  SELLERS
}

enum DealStage {
  // Buyers pipeline
  PRE_APPROVAL
  TOURING
  OFFER_SUBMITTED
  // Sellers pipeline
  LISTING_APPOINTMENT
  ACTIVE_LISTING
  // Shared (both pipelines)
  OFFER_ACCEPTED
  FALLEN_OUT
}
```

Add back-relations:
- `Lead`: `deals Deal[]`
- `TransactionFile`: `deal Deal?`

### 1.2 Stage progression

**Buyers pipeline:** PRE_APPROVAL → TOURING → OFFER_SUBMITTED → OFFER_ACCEPTED | FALLEN_OUT

**Sellers pipeline:** LISTING_APPOINTMENT → ACTIVE_LISTING → OFFER_ACCEPTED | FALLEN_OUT

OFFER_ACCEPTED and FALLEN_OUT are terminal stages shared by both pipelines. A deal in OFFER_ACCEPTED triggers the TransactionFile handoff flow. FALLEN_OUT is a dead-end — deal is over.

### 1.3 Field notes

- `propertyAddress` and `price` are optional — agents may create a deal before the property is confirmed
- `price` is the offer price (buyers) or list price (sellers)
- `transactionFileId` is `@unique` — one deal maps to at most one TransactionFile
- `notes` is a free-text field; agents use it to log offer back-and-forth, updates, and negotiation details
- `stageUpdatedAt` is set to `now()` only when `stage` changes in a PATCH — used to calculate `daysInStage` accurately regardless of other field edits
- Stages from the wrong pipeline (e.g. LISTING_APPOINTMENT on a BUYERS deal) are rejected by the API with a 400

---

## Section 2: UI Layout

### 2.1 Navigation

Add **"Pipeline"** to the dashboard sidebar nav between Leads and Transactions.

### 2.2 Pipeline page

`/dashboard/pipeline`

Two tabs at top: **Buyers** | **Sellers**. Each tab renders a `DealBoard` component for that pipeline.

The board is a horizontally scrollable row of stage columns. Each column has:
- Stage name as header
- Deal count badge (e.g. "3")
- Scrollable list of `DealCard` components
- Drag target to receive cards dropped from other columns

**Buyers board columns:** Pre-Approval | Touring | Offer Submitted | Offer Accepted | Fallen Out

**Sellers board columns:** Listing Appointment | Active Listing | Offer Accepted | Fallen Out

A **"+ New Deal"** button in the top-right opens `NewDealModal`.

### 2.3 Deal card

Each card on the board shows:
- Lead name (links to `/dashboard/leads/[id]`)
- Property address (or "No address yet" if null)
- Price (formatted as "$850k" / "$1.2M", or "—" if null)
- Expected close date (formatted as "Jul 15" or "—" if null)
- Days in current stage (e.g. "Day 4") — calculated from `stageUpdatedAt`

Active card color: white card, gold left border (`border-l-2 border-[#9E8C61]`) for deals in OFFER_ACCEPTED awaiting TransactionFile creation.

### 2.4 Deal drawer

Clicking a card opens a slide-in drawer from the right with:
- Editable fields: lead (read-only link), property address, price, expected close date, pipeline (read-only), stage (dropdown)
- Notes textarea (free text)
- Stage badge showing current stage + days in stage
- **"Create Transaction File"** button — visible when stage is OFFER_ACCEPTED and `transactionFileId` is null
- **"View Transaction File →"** link — visible when `transactionFileId` is set
- Delete button (with confirmation)
- Save / Cancel buttons

When agent moves stage to OFFER_ACCEPTED via the dropdown, a prompt appears: "Offer accepted! Ready to open a Transaction File?" with **"Create Transaction File"** and **"Not yet"** buttons. If dismissed, the drawer permanently shows the "Create Transaction File" button so agents can always come back to it.

### 2.5 New Deal modal

Triggered by "+ New Deal" on the pipeline board OR "+ Create Deal" on the lead profile.

Fields:
- Lead search (typeahead, required) — pre-filled when opened from lead profile
- Pipeline (Buyers / Sellers toggle, required)
- Property address (optional)
- Price (optional)
- Expected close date (optional)

Save creates the deal and navigates to its card on the board.

### 2.6 Lead profile — Deals section

On `/dashboard/leads/[id]`, add a **"Deals"** section below the existing lead detail. Shows:
- List of deals linked to this lead (pipeline, stage, address, price)
- Each deal name/row links to the pipeline board with the deal drawer open
- **"+ Create Deal"** button (opens NewDealModal pre-filled with this lead)
- Empty state: "No active deals"

---

## Section 3: API Routes

### 3.1 Deal CRUD

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/deals` | AGENT | List calling agent's deals. Accepts `?pipeline=BUYERS\|SELLERS` filter. ADMIN sees all deals. |
| POST | `/api/deals` | AGENT | Create a deal. Validates stage belongs to the specified pipeline. |
| GET | `/api/deals/[id]` | AGENT | Get single deal with lead name and transactionFile link. Ownership enforced. |
| PATCH | `/api/deals/[id]` | AGENT | Update stage, fields, or notes. Validates stage/pipeline compatibility. Ownership enforced. |
| DELETE | `/api/deals/[id]` | AGENT | Delete a deal. Returns 204. Ownership enforced. |

POST/PATCH body:
```ts
{
  leadId?: string;
  pipeline?: "BUYERS" | "SELLERS";
  stage?: DealStage;
  propertyAddress?: string | null;
  price?: number | null;
  expectedCloseDate?: string | null; // ISO date
  notes?: string | null;
}
```

GET `/api/deals` response shape:
```ts
{
  id: string;
  leadId: string;
  leadName: string; // firstName + lastName
  pipeline: "BUYERS" | "SELLERS";
  stage: DealStage;
  propertyAddress: string | null;
  price: number | null;
  expectedCloseDate: string | null;
  notes: string | null;
  transactionFileId: string | null;
  daysInStage: number; // calculated server-side from updatedAt
  createdAt: string;
  updatedAt: string;
}[]
```

### 3.2 TransactionFile handoff

```
POST /api/deals/[id]/convert
```

Auth: AGENT (ownership enforced)

Validates:
- Deal stage is OFFER_ACCEPTED
- Deal does not already have a transactionFileId

Creates a `TransactionFile` pre-filled with:
- `agentId` from deal
- `originatingLeadId` from deal.leadId
- `propertyAddress` from deal.propertyAddress (or empty string if null)
- `city`: empty string, `state`: "CA", `zip`: empty string — agent completes in wizard
- `salePrice` (BUYERS) or `listPrice` (SELLERS) from deal.price
- `transactionSide`: BUYER_SIDE (BUYERS pipeline) or SELLER_SIDE (SELLERS pipeline)
- `status`: INCOMPLETE (agent completes the wizard)

Then sets `deal.transactionFileId` to the new file's id.

Returns: `{ transactionFileId: string }` so the frontend can redirect to `/dashboard/transactions/[id]`.

### 3.3 Stage validation

Valid stages per pipeline:
```ts
const PIPELINE_STAGES = {
  BUYERS: ["PRE_APPROVAL", "TOURING", "OFFER_SUBMITTED", "OFFER_ACCEPTED", "FALLEN_OUT"],
  SELLERS: ["LISTING_APPOINTMENT", "ACTIVE_LISTING", "OFFER_ACCEPTED", "FALLEN_OUT"],
};
```

POST and PATCH validate that the provided `stage` is in `PIPELINE_STAGES[pipeline]`. Returns 400 if not.

---

## Section 4: Drag and Drop

Stage movement on the board is done by dragging a card from one column and dropping it into another. Implementation uses the browser's native HTML5 drag-and-drop API (no external library) — cards get `draggable`, columns get `onDragOver` + `onDrop` handlers.

On drop: optimistic UI update moves the card immediately, then fires `PATCH /api/deals/[id]` with the new stage. If the API call fails, the card snaps back and an error toast is shown.

If the new stage is OFFER_ACCEPTED, the prompt ("Ready to create a Transaction File?") appears after the card settles.

---

## Section 5: Files Changed / Created

**Schema:**
- `packages/database/prisma/schema.prisma` — add `Deal` model, `DealPipeline` and `DealStage` enums, back-relations on `Lead` and `TransactionFile`
- New migration

**API routes:**
- `apps/web/src/app/api/deals/route.ts` — GET (list) + POST (create)
- `apps/web/src/app/api/deals/[id]/route.ts` — GET + PATCH + DELETE
- `apps/web/src/app/api/deals/[id]/convert/route.ts` — POST (TransactionFile handoff)

**Components:**
- `apps/web/src/components/deals/DealBoard.tsx` — Kanban board for one pipeline
- `apps/web/src/components/deals/DealCard.tsx` — draggable deal card
- `apps/web/src/components/deals/DealDrawer.tsx` — slide-in detail/edit drawer
- `apps/web/src/components/deals/NewDealModal.tsx` — create deal modal with lead search

**Pages:**
- `apps/web/src/app/(dashboard)/dashboard/pipeline/page.tsx` — Pipeline page (Buyers/Sellers tabs)
- `apps/web/src/app/(dashboard)/dashboard/leads/[id]/page.tsx` — add Deals section

**Nav:**
- `apps/web/src/components/dashboard/Sidebar.tsx` (or equivalent) — add Pipeline nav link

---

## Decisions Made

| Decision | Choice | Reason |
|---|---|---|
| New model vs extend TransactionFile | New `Deal` model | TransactionFile is a compliance-heavy model; conflating it with a lightweight pipeline tracker creates maintenance problems |
| Stage enums | Single `DealStage` enum, validated per pipeline | Simpler than two separate enums; validation at API layer enforces correctness |
| Notes | Single text field on Deal | MVP — agents log counters, offer updates, listing details; a full activity thread can be added in a future sub-project |
| Drag and drop | Native HTML5 API | No external dependency; sufficient for a single-user board with modest card counts |
| Countering stage | Omitted — handled via notes | Too transient for a stage; consistent with FUB's approach |
| "Coming Soon" stage (sellers) | Omitted — handled via notes in Listing Appointment | Reduces agent overhead; consistent with FUB's approach |
| "Offer Received" stage (sellers) | Omitted — handled via notes in Active Listing | Multiple offers would make a single stage confusing |
| Deal creation entry points | Both pipeline board and lead profile | Maximum convenience for agents regardless of where they're working |
| TransactionFile handoff | Prompt on OFFER_ACCEPTED + persistent button | Non-destructive: agent can dismiss the prompt and return to create the file later |
| Commission on deal card | Omitted — lives in TransactionFile | Commission isn't finalized at offer stage; avoids premature data entry |
