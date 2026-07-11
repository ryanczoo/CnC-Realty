# Core Transaction Type Overhaul — Design Spec

**Date:** 2026-07-11
**Status:** Ready for self-review and user approval
**Sub-project:** A of 4 (Core Transaction Type Overhaul → Checklist Template System → Transaction UX Features → Document & Data Management)

---

## Overview

Fixes a real, live bug (`SELLER_SIDE` mislabeled as "Referral / Other" in the New Transaction wizard) and closes the structural gap it sits on top of — CnC's `TransactionSide` enum has 4 values where zipForm's equivalent has 7, verified against 14 zipForm workflow screenshots and CnC's actual wizard code across several prior sessions. This is Sub-project A: the foundational piece. Checklist templates (Sub-project B) need the corrected 7-type list to exist before they can be built against it, so this ships first.

**Root cause of the bug:** `new-transaction/page.tsx`'s `SIDES` array (lines 13–18) maps the Prisma enum value `SELLER_SIDE` to the UI label "Referral / Other" — meaning every agent who has ever picked "Referral / Other" in this wizard has actually been recorded in the database as representing the seller. `SELLER_SIDE` should mean "Listing."

**What ships:**
- `TransactionSide` enum: 4 values → 7 values, with **3 renames** (not additions) and 3 new additions
- `DealPipeline` enum: 2 values → 4 values (adds a Tenant/Landlord split mirroring the existing Buyers/Sellers split)
- `DealStage` enum: 4 new additive values backing the 2 new lease pipelines' stage lists
- `FilePartyRole` enum: 1 new additive value (`REFERRAL_AGENT`) — no rename, no migration risk
- `TransactionFile.leasePrice` and other new nullable fields (Legal Description, Tax ID, Annual Taxes, School District, Zoning Class, Deposit, Offer/Expiration/Walkthrough/Possession dates — full list in §2b/§2c)
- New `FileCondition` model — replaces a JSON-blob approach for the free-form Conditions/Contingencies list, so individual conditions stay queryable for the Sub-project C Timeline tab
- Rewritten wizard `SIDES` array, Property-step fields, Offer-step fields, property type list
- Rewritten pipeline→side mapping in both conversion routes (`deals/[id]/convert` and `listings/[id]/convert`)
- Data migration for existing `ChecklistTemplate` rows (their `transactionSide` column is a loose `String`, not enum-bound, so renamed values silently orphan existing rows unless migrated)

**What is deferred (belongs to Sub-projects B/C/D, not this spec):**
- The 4 actual checklist templates and their content (Sub-project B)
- Phase-triggered checklists, party/field requirements on checklists, template bundling (Sub-project B)
- Timeline tab, relative due dates, template reuse, saved list views (Sub-project C)
- PDF merge, email-in upload, soft-delete/restore, parent/sub-transaction linking (Sub-project D)
- RentSpree toggle, "Use Wizard" toggle, cloud storage import, upload-only client link — all explicitly dropped from scope entirely, not deferred

---

## 1. Schema changes

**`packages/database/prisma/schema.prisma`**

### 1a. `TransactionSide` enum (line 109–114)

```prisma
enum TransactionSide {
  PURCHASE
  LISTING
  DUAL
  LEASE_TENANT
  LEASE_LANDLORD
  LEASE_DUAL
  REFERRAL
}
```

Mapping from old → new:
| Old value | New value | Change type |
|---|---|---|
| `BUYER_SIDE` | `PURCHASE` | rename |
| `SELLER_SIDE` | `LISTING` | rename |
| `DUAL` | `DUAL` | unchanged |
| `LEASE` | `LEASE_TENANT` | rename (existing lease rows become tenant-side by default — see §5 migration notes) |
| — | `LEASE_LANDLORD` | new |
| — | `LEASE_DUAL` | new |
| — | `REFERRAL` | new |

**This must NOT be done via a naive `prisma migrate dev` schema-diff.** Prisma's default diffing sees this as "drop 3 enum values, add 6 new ones," which Postgres will refuse if any existing row uses a dropped value (`ALTER TYPE ... DROP VALUE` isn't even valid syntax — Postgres has no native drop-value operation; a real diff-based approach would attempt to recreate the whole type and fail on any dependent row). The migration must be hand-authored SQL using `ALTER TYPE ... RENAME VALUE` for the 3 renames and `ALTER TYPE ... ADD VALUE` for the 3 additions — see §5.

### 1b. `DealPipeline` enum (line 116–119)

```prisma
enum DealPipeline {
  BUYERS
  SELLERS
  LEASE_TENANT
  LEASE_LANDLORD
}
```

Purely additive — no existing `Deal` row uses a value being removed, so this one *is* safe as a normal Prisma migration.

### 1c. `FilePartyRole` enum (line 131–141)

Add one value:
```prisma
enum FilePartyRole {
  BUYER
  SELLER
  LISTING_AGENT
  BUYERS_AGENT
  CO_AGENT
  TITLE_ESCROW
  LENDER
  TRANSACTION_COORDINATOR
  REFERRAL_AGENT
  OTHER
}
```
Additive only — safe as a normal migration. This is what backs item #9 (Referral Agent party field) on the normal wizard, so referrals to/from CnC on ordinary Purchase/Listing deals don't need the standalone `REFERRAL` transaction type.

### 1d. `TransactionFile.leasePrice` (after line 463, `salePrice`)

```prisma
leasePrice Float?
```
New nullable field — safe additive migration. Represents monthly rent for `LEASE_TENANT`/`LEASE_LANDLORD`/`LEASE_DUAL` transactions, parallel to how `listPrice`/`salePrice` work for the sale-side types.

---

## 2. New Transaction wizard

**`apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx`**

### 2a. `SIDES` array (lines 13–18) — full rewrite

```ts
const SIDES = [
  { value: "PURCHASE", label: "Purchase", desc: "Representing the buyer in a purchase transaction" },
  { value: "LISTING", label: "Listing", desc: "Representing the seller in a sale transaction" },
  { value: "DUAL", label: "Both Purchase & Listing", desc: "Dual agency — representing buyer and seller" },
  { value: "LEASE_TENANT", label: "Lease Tenant", desc: "Representing the tenant in a lease transaction" },
  { value: "LEASE_LANDLORD", label: "Lease Landlord", desc: "Representing the landlord in a lease transaction" },
  { value: "LEASE_DUAL", label: "Both Lease Tenant & Landlord", desc: "Dual agency — representing tenant and landlord" },
  { value: "REFERRAL", label: "Referral", desc: "Outbound referral to another agent or brokerage — no other role in this deal" },
] as const;
```

### 2b. Missing Property-step fields

Add to the `form` state object (currently lines 43–54) and their corresponding inputs in the Property step:
- `legalDescription: ""`
- `propertyIncludes: ""`
- `propertyExcludes: ""`
- `taxId: ""`
- `annualTaxes: ""`
- `schoolDistrict: ""`
- `zoningClass: ""`
- Photo upload — reuse the existing R2 upload pattern already used for document uploads elsewhere in the file-detail Documents tab; stores to R2, references saved on submit.

These need corresponding nullable columns on `TransactionFile` (all `String?` except `annualTaxes Float?`) — add alongside the `leasePrice` field in §1d.

### 2c. Missing Offer-step fields

Add to `form` state and the Details/Offer step:
- `deposit: ""` (`Float?` on schema)
- `offerDate: ""` (`DateTime?`)
- `offerExpirationDate: ""` (`DateTime?`)
- `finalWalkthroughDate: ""` (`DateTime?`)
- `possessionDate: ""` (`DateTime?`)
- Conditions/Contingencies — free-form repeatable list (name, due date, notes), same UI pattern as the existing `buyers`/`sellers` party arrays (`useState<Party[]>`). Needs a new `FileCondition` model (id, transactionFileId, name, dueDate, notes) rather than a JSON blob, so individual conditions can be queried/displayed on the Timeline tab in Sub-project C.

All Offer-step date fields must use the existing `<DateField>` component (already sitewide as of the 2026-07-10 session), not a native date input.

### 2d. `PROPERTY_TYPES` array (line 25)

```ts
const PROPERTY_TYPES = ["Single Family", "Condo", "Townhouse", "Multi-Family", "Commercial", "Land", "Industrial", "Farm and Ranch", "Manufactured Home", "Co-Op", "Other"];
```

### 2e. Referral Agent party field

Add a `REFERRAL_AGENT`-role party slot to the Parties step, alongside the existing `buyers`/`sellers`/`listingAgent`/`titleEscrow`/`loanOfficer` state — optional, not required, on every transaction type (not just `REFERRAL`). Uses the existing `Party` type and `emptyParty()` helper already in the file.

---

## 3. Deal Pipeline

### 3a. `apps/web/src/lib/deal-pipeline.ts`

```ts
export const PIPELINE_STAGES: Record<DealPipeline, DealStage[]> = {
  BUYERS: ["PRE_APPROVAL", "TOURING", "OFFER_SUBMITTED", "OFFER_ACCEPTED", "FALLEN_OUT"],
  SELLERS: ["LISTING_APPOINTMENT", "ACTIVE_LISTING", "OFFER_ACCEPTED", "FALLEN_OUT"],
  LEASE_TENANT: ["SEARCHING", "TOURING", "APPLICATION_SUBMITTED", "LEASE_SIGNED", "FALLEN_OUT"],
  LEASE_LANDLORD: ["LISTING_APPOINTMENT", "ACTIVE_LISTING", "APPLICATION_RECEIVED", "LEASE_SIGNED", "FALLEN_OUT"],
};

export const STAGE_LABELS: Record<DealStage, string> = {
  PRE_APPROVAL: "Pre-Approval",
  TOURING: "Touring",
  OFFER_SUBMITTED: "Offer Submitted",
  LISTING_APPOINTMENT: "Listing Appointment",
  ACTIVE_LISTING: "Active Listing",
  OFFER_ACCEPTED: "Offer Accepted",
  SEARCHING: "Searching",
  APPLICATION_SUBMITTED: "Application Submitted",
  APPLICATION_RECEIVED: "Application Received",
  LEASE_SIGNED: "Lease Signed",
  FALLEN_OUT: "Fallen Out",
};
```

`DealStage` enum in schema.prisma needs the 4 new values added (`SEARCHING`, `APPLICATION_SUBMITTED`, `APPLICATION_RECEIVED`, `LEASE_SIGNED`) — purely additive, safe migration. `isValidStageForPipeline`, `calcDaysInStage`, `formatDealPrice`, `formatCloseDate` are all pipeline/stage-agnostic and need no changes.

### 3b. Kanban board UI (`DealBoard.tsx`, `DealCard.tsx`, `NewDealModal.tsx`)

`NewDealModal.tsx`'s pipeline picker (currently `["BUYERS", "SELLERS"] as const` around line 133) needs the 2 new options added with the same button styling already established. `DealBoard.tsx` needs a way to switch between 4 pipelines instead of 2 (exact UI — tabs vs. dropdown — is an implementation-time decision, not a design-blocking one, since the existing 2-pipeline toggle pattern extends directly).

---

## 4. Conversion routes

### 4a. `apps/web/src/app/api/deals/[id]/convert/route.ts`

Replace the binary `isBuyers` check (lines 27, 37, 39) with a mapping table:

```ts
const SIDE_BY_PIPELINE: Record<string, string> = {
  BUYERS: "PURCHASE",
  SELLERS: "LISTING",
  LEASE_TENANT: "LEASE_TENANT",
  LEASE_LANDLORD: "LEASE_LANDLORD",
};
const PRICE_FIELD_BY_PIPELINE: Record<string, "salePrice" | "listPrice" | "leasePrice"> = {
  BUYERS: "salePrice",
  SELLERS: "listPrice",
  LEASE_TENANT: "leasePrice",
  LEASE_LANDLORD: "leasePrice",
};

const transactionSide = SIDE_BY_PIPELINE[deal.pipeline];
const priceField = PRICE_FIELD_BY_PIPELINE[deal.pipeline];

const tf = await prisma.transactionFile.create({
  data: {
    agentId: deal.agentId,
    originatingLeadId: deal.leadId,
    propertyAddress: deal.propertyAddress ?? "",
    city: "",
    state: "CA",
    zip: "",
    transactionSide,
    status: "INCOMPLETE",
    [priceField]: deal.price,
  },
});
```

The stage-gate (line 19: `deal.stage !== "OFFER_ACCEPTED"`) becomes pipeline-aware — each pipeline's terminal stage is looked up from `PIPELINE_STAGES[deal.pipeline]`'s last non-`FALLEN_OUT` entry, rather than a single hardcoded string:

```ts
const stages = PIPELINE_STAGES[deal.pipeline] ?? [];
const terminalStage = stages[stages.length - 2]; // last entry before FALLEN_OUT
if (deal.stage !== terminalStage) {
  return NextResponse.json({ error: `Deal must be in ${STAGE_LABELS[terminalStage]} stage to convert` }, { status: 400 });
}
```

`DUAL`, `LEASE_DUAL`, and `REFERRAL` remain unreachable through auto-convert, same as today's existing asymmetry (there's no `DUAL` conversion path currently either) — those three types are only ever created directly through the New Transaction wizard.

### 4b. `apps/web/src/app/api/listings/[id]/convert/route.ts`

Two hardcoded `"SELLER_SIDE"` literals (lines 18, 34) → `"LISTING"`. This route always converts a `ListingFile` (inherently seller-side) to a Transaction, so it's a direct one-line rename at each spot, not a mapping table — there's no pipeline ambiguity to resolve here.

---

## 5. Downstream literal-reference fixes and data migration

Full inventory of every file referencing the old 4 string literals (confirmed via repo-wide grep, not assumed):

| File | What changes |
|---|---|
| `new-transaction/page.tsx` | §2a above |
| `api/deals/[id]/convert/route.ts` | §4a above |
| `api/listings/[id]/convert/route.ts` | §4b above |
| `types/transaction.ts` (line 11) | `TransactionSide` union type → 7 new literal values |
| `components/agents/AgentTransactionsSection.tsx` (line 11, 28–31) | Has its **own duplicated** local type + role-label map (`BUYER_SIDE: "Buyer's Agent"`, etc.) rather than importing from `types/transaction.ts` — needs both the type and the label map updated to the exact 7-value mapping below. Worth considering importing the type from `types/transaction.ts` instead of re-declaring it, to prevent this exact class of drift from happening again. |
| `admin/settings/checklists/page.tsx` (lines 89–92) | Dropdown options → 7 new `<option>` values with updated labels |
| `__tests__/api/deals-convert.test.ts` (lines 76, 83, 93) | Test literals + the test name itself ("uses SELLER_SIDE for SELLERS pipeline" → reflects new mapping); new test cases added for the 2 lease pipelines |

**Exact role-label mapping** (used in `AgentTransactionsSection.tsx` and anywhere else a `TransactionSide` needs a human-readable role badge), following the zipForm-confirmed convention that lease sides mirror sale sides:

```ts
const ROLE_LABELS: Record<TransactionSide, string> = {
  PURCHASE: "Buyer's Agent",
  LISTING: "Listing Agent",
  DUAL: "Dual Agent",
  LEASE_TENANT: "Buyer's Agent",
  LEASE_LANDLORD: "Listing Agent",
  LEASE_DUAL: "Dual Agent",
  REFERRAL: "Referral Agent",
};
```

### Data migration — `ChecklistTemplate.transactionSide`

This column (schema line 530) is a plain `String @default("ALL")`, **not** bound to the Prisma enum — so unlike `TransactionFile.transactionSide`, Postgres won't stop you from renaming the enum out from under it, but any existing template row stored with the literal text `"SELLER_SIDE"`, `"BUYER_SIDE"`, or `"LEASE"` becomes silently orphaned (never matches any future template lookup again) unless explicitly migrated. The same hand-authored migration that renames the `TransactionSide` enum (§1a) must also include:

```sql
UPDATE "ChecklistTemplate" SET "transactionSide" = 'PURCHASE' WHERE "transactionSide" = 'BUYER_SIDE';
UPDATE "ChecklistTemplate" SET "transactionSide" = 'LISTING' WHERE "transactionSide" = 'SELLER_SIDE';
UPDATE "ChecklistTemplate" SET "transactionSide" = 'LEASE_TENANT' WHERE "transactionSide" = 'LEASE';
```

**Before writing the final migration, check actual row counts** in both `TransactionFile` and `ChecklistTemplate` for each old value (`SELECT "transactionSide", count(*) FROM ...`). Since CnC has not yet deployed to production (confirmed: Vercel deploy is still outstanding as of the 2026-07-08 session), the Railway DB is very likely to contain only test/seed data today, which meaningfully de-risks this migration — but this should be verified with a real query against the actual DB, not assumed, before the migration is written and run.

---

## 6. Testing

Extends the existing suite (currently 320/320 passing per the 2026-07-10 session) — new/updated cases:

- `apps/web/src/__tests__/api/deals-convert.test.ts` — update existing `BUYER_SIDE`/`SELLER_SIDE` assertions to `PURCHASE`/`LISTING`; add 2 new cases for `LEASE_TENANT`→`LEASE_TENANT` and `LEASE_LANDLORD`→`LEASE_LANDLORD` pipeline conversion, each asserting the correct price field (`leasePrice`) is populated; add a case confirming the stage-gate rejects a lease deal not yet at `LEASE_SIGNED`.
- New test file for `api/listings/[id]/convert/route.ts` if one doesn't already exist — confirm `"LISTING"` is written, not `"SELLER_SIDE"`.
- `apps/web/src/lib/deal-pipeline.ts` tests — extend for the 2 new pipelines' stage lists and labels.
- New Transaction wizard — confirm all 7 `SIDES` options render with correct labels, and that selecting each one submits the correct `transactionSide` value.

---

## 7. Migration and rollout order

Sequencing matters here because of the enum-rename risk in §1a/§5:

1. **First**, run the row-count check against the live DB (§5) to confirm the blast radius of the rename.
2. Write the hand-authored SQL migration (enum `RENAME VALUE` ×3, `ADD VALUE` ×3, plus the `ChecklistTemplate` data `UPDATE`s) — do **not** let `prisma migrate dev` auto-generate this one.
3. Update all 7 files in §5's table in the same commit as the migration, so there is never a deployed state where the DB has new enum values but code still writes old literals (or vice versa).
4. Additive-only schema changes (`DealPipeline`, `FilePartyRole`, `leasePrice`, `DealStage` additions, new `FileCondition` model) can ship in a separate, earlier or later migration with much lower risk, since nothing about them requires touching existing rows.

---

## Cost recap

No new third-party services, no new infrastructure. The real cost is care, not complexity: one enum rename touching 7 files + a hand-written SQL migration (higher risk than a typical additive migration, but fully scoped above), plus the wizard field additions which are routine `useState` + form input work matching patterns already used throughout `new-transaction/page.tsx`.
