# Core Transaction Type Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the live `SELLER_SIDE`/"Referral-Other" mislabel bug and close the 4-vs-7 `TransactionSide` gap versus zipForm, plus the `DealPipeline` lease split, referral-agent party role, and every downstream file this rename touches.

**Architecture:** Additive schema changes ship first and independently (low risk). The `TransactionSide` enum rename is isolated into its own task that also updates every consuming file in the same commit, so there is never a state where the DB enum and the code's literal strings disagree. Wizard/UI feature work and the `deals/convert` route's full lease-aware rewrite ship last, once the schema underneath them exists.

**Tech Stack:** Next.js 14 / TypeScript / Prisma / PostgreSQL (Railway), Vitest.

**Source spec:** `docs/superpowers/specs/2026-07-11-core-transaction-type-overhaul-design.md` — read this first for the *why* behind each change; this plan covers the *how*, in order, with exact code.

## Global Constraints

- Final `TransactionSide` values, exact spelling: `PURCHASE`, `LISTING`, `DUAL`, `LEASE_TENANT`, `LEASE_LANDLORD`, `LEASE_DUAL`, `REFERRAL`.
- Final `DealPipeline` values: `BUYERS`, `SELLERS`, `LEASE_TENANT`, `LEASE_LANDLORD`.
- Role-label mapping (used verbatim wherever a `TransactionSide` needs a human-readable label): `PURCHASE`→"Buyer's Agent", `LISTING`→"Listing Agent", `DUAL`→"Dual Agent", `LEASE_TENANT`→"Buyer's Agent", `LEASE_LANDLORD`→"Listing Agent", `LEASE_DUAL`→"Dual Agent", `REFERRAL`→"Referral Agent".
- The `TransactionSide` Postgres enum rename must use hand-authored SQL (`ALTER TYPE ... RENAME VALUE` / `ADD VALUE`), never an auto-generated `prisma migrate dev` diff — Postgres cannot drop an enum value that's in use, and Prisma's default diffing would attempt exactly that.
- All new date inputs use the existing `<DateField>` component (`@/components/ui/DateField`), never a native `<input type="date">`.
- All new file uploads (Property-step photo) reuse the existing Cloudflare R2 upload pattern already used elsewhere in the Documents tab — do not introduce a second storage mechanism.
- Every task that touches `schema.prisma` ends with `pnpm --filter @cnc/database exec prisma generate` (kill any running dev server first — Windows holds a lock on the query-engine DLL) and `pnpm --filter web exec tsc --noEmit` to confirm no new compile errors.

---

## Task 1: Additive schema changes

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Test: `apps/web/src/__tests__/lib/file-condition.test.ts` (new)

**Interfaces:**
- Produces: `DealPipeline.LEASE_TENANT`, `DealPipeline.LEASE_LANDLORD`; `DealStage.SEARCHING`, `DealStage.APPLICATION_SUBMITTED`, `DealStage.APPLICATION_RECEIVED`, `DealStage.LEASE_SIGNED`; `FilePartyRole.REFERRAL_AGENT`; `TransactionFile.leasePrice`, `.legalDescription`, `.propertyIncludes`, `.propertyExcludes`, `.taxId`, `.annualTaxes`, `.schoolDistrict`, `.zoningClass`, `.deposit`, `.offerDate2` — see exact field list in Step 1; new model `FileCondition { id, transactionFileId, name, dueDate, notes, createdAt }`.

This task is pure additive schema surface with no consuming logic yet (that arrives in Tasks 3–7), so there's no meaningful unit to TDD against in isolation — the same way a database index isn't unit-tested on its own. The verification here is: migration applies cleanly, Prisma Client generates the new types, and a real row can be created using the new fields. `FileCondition` is the one new *model* (not just fields), so it gets one real test exercising a Prisma query against it, written first and watched to fail for the right reason (model doesn't exist yet).

- [ ] **Step 1: Edit schema.prisma**

Add to `DealPipeline` (currently lines 116–119):
```prisma
enum DealPipeline {
  BUYERS
  SELLERS
  LEASE_TENANT
  LEASE_LANDLORD
}
```

Add to `DealStage` (find the existing enum in schema.prisma and add these 4 values to it, keeping existing values untouched):
```prisma
enum DealStage {
  PRE_APPROVAL
  TOURING
  OFFER_SUBMITTED
  LISTING_APPOINTMENT
  ACTIVE_LISTING
  OFFER_ACCEPTED
  SEARCHING
  APPLICATION_SUBMITTED
  APPLICATION_RECEIVED
  LEASE_SIGNED
  FALLEN_OUT
}
```

Add to `FilePartyRole` (currently lines 131–141):
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

Add new fields to `TransactionFile` (after `salePrice` on line 463):
```prisma
  leasePrice        Float?
  legalDescription  String?
  propertyIncludes  String?
  propertyExcludes  String?
  taxId             String?
  annualTaxes       Float?
  schoolDistrict    String?
  zoningClass       String?
  photoKey          String?
  deposit           Float?
  offerExpirationDate   DateTime?
  finalWalkthroughDate  DateTime?
  possessionDate        DateTime?
```
(`offerDate` and `acceptanceDate` already exist on the model — do not duplicate them.)

Add the `conditions FileCondition[]` relation field to `TransactionFile`'s relation block (alongside `parties`, `checklistItems`, etc.), and the new model itself:
```prisma
model FileCondition {
  id                String   @id @default(cuid())
  transactionFileId String
  name              String
  dueDate           DateTime?
  notes             String?
  createdAt         DateTime @default(now())

  transactionFile TransactionFile @relation(fields: [transactionFileId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Write the failing test for `FileCondition`**

```ts
// apps/web/src/__tests__/lib/file-condition.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

describe("FileCondition model", () => {
  let agentId: string;
  let transactionFileId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: `fc-test-${Date.now()}@test.com`, role: "AGENT" } });
    const agent = await prisma.agent.create({ data: { userId: user.id, slug: `fc-test-${Date.now()}` } });
    agentId = agent.id;
    const tf = await prisma.transactionFile.create({
      data: { agentId, propertyAddress: "1 Test St", city: "Test", zip: "00000", transactionSide: "BUYER_SIDE", status: "INCOMPLETE" },
    });
    transactionFileId = tf.id;
  });

  afterAll(async () => {
    await prisma.transactionFile.delete({ where: { id: transactionFileId } });
    await prisma.agent.delete({ where: { id: agentId } });
  });

  it("creates and links a condition to a transaction file", async () => {
    const condition = await prisma.fileCondition.create({
      data: { transactionFileId, name: "Inspection Contingency", dueDate: new Date("2026-08-01"), notes: "17 days after acceptance" },
    });
    expect(condition.name).toBe("Inspection Contingency");

    const withConditions = await prisma.transactionFile.findUnique({
      where: { id: transactionFileId },
      include: { conditions: true },
    });
    expect(withConditions?.conditions).toHaveLength(1);
  });
});
```

Note: this test still uses `transactionSide: "BUYER_SIDE"` (the pre-rename value) — that's intentional, Task 1 runs *before* Task 2's rename, so the old enum value is still what's live in the DB at this point.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web test file-condition -- --run`
Expected: FAIL — `Property 'fileCondition' does not exist on type 'PrismaClient'` (model doesn't exist in the generated client yet).

- [ ] **Step 4: Run the migration**

```bash
pnpm --filter @cnc/database exec prisma migrate dev --name add_lease_pipeline_referral_role_condition_model
pnpm --filter @cnc/database exec prisma generate
```
This is a fully additive migration (new enum values, new nullable columns, new model) — safe to let Prisma auto-generate.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web test file-condition -- --run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations apps/web/src/__tests__/lib/file-condition.test.ts
git commit -m "feat: additive schema for lease pipelines, referral party role, and file conditions"
```

---

## Task 2: TransactionSide enum rename + all consuming files

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create (hand-authored): `packages/database/prisma/migrations/<timestamp>_rename_transaction_side_values/migration.sql`
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx`
- Modify: `apps/web/src/types/transaction.ts`
- Modify: `apps/web/src/components/agents/AgentTransactionsSection.tsx`
- Modify: `apps/web/src/app/(dashboard)/admin/settings/checklists/page.tsx`
- Modify: `apps/web/src/app/api/listings/[id]/convert/route.ts`
- Modify: `apps/web/src/app/api/deals/[id]/convert/route.ts` (mechanical rename only — full lease-aware rewrite is Task 7)
- Modify: `apps/web/src/__tests__/api/deals-convert.test.ts`
- Test (new): `apps/web/src/__tests__/lib/transaction-sides.test.ts`

**Interfaces:**
- Consumes: nothing new from Task 1 (this task is independent of it).
- Produces: `SIDES` array exported from `new-transaction/page.tsx` as `export const SIDES = [...]` (was a local unexported const) so it's directly unit-testable; `TransactionSide` union type in `types/transaction.ts` now has 7 members; `ROLE_LABELS` exported from `types/transaction.ts` for reuse.

This is the highest-risk task in the plan — do not split it across multiple commits. Every file that references the 4 old string literals must change together, or the app won't compile between commits.

- [ ] **Step 1: Row-count check against the live DB (before writing the migration)**

```bash
pnpm --filter @cnc/database exec prisma studio
```
In Studio (or via a one-off script using `prisma`), run the equivalent of:
```sql
SELECT "transactionSide", count(*) FROM "TransactionFile" GROUP BY "transactionSide";
SELECT "transactionSide", count(*) FROM "ChecklistTemplate" GROUP BY "transactionSide";
```
Record the counts. If either table has real rows using `BUYER_SIDE`, `SELLER_SIDE`, or `LEASE`, note it — the migration in Step 3 already handles the data correctly regardless of count, this is a sanity check, not a blocker.

- [ ] **Step 2: Write the failing test for the new `SIDES`/`TransactionSide` values**

```ts
// apps/web/src/__tests__/lib/transaction-sides.test.ts
import { describe, it, expect } from "vitest";
import { SIDES } from "@/app/(dashboard)/dashboard/transactions/new-transaction/page";
import { ROLE_LABELS } from "@/types/transaction";

describe("TransactionSide values", () => {
  it("SIDES has all 7 types with correct values", () => {
    const values = SIDES.map((s) => s.value);
    expect(values).toEqual(["PURCHASE", "LISTING", "DUAL", "LEASE_TENANT", "LEASE_LANDLORD", "LEASE_DUAL", "REFERRAL"]);
  });

  it("SIDES no longer contains the old mislabeled Referral/Other option", () => {
    const referralOther = SIDES.find((s) => s.label === "Referral / Other");
    expect(referralOther).toBeUndefined();
  });

  it("ROLE_LABELS maps every side to the correct role label", () => {
    expect(ROLE_LABELS.PURCHASE).toBe("Buyer's Agent");
    expect(ROLE_LABELS.LISTING).toBe("Listing Agent");
    expect(ROLE_LABELS.DUAL).toBe("Dual Agent");
    expect(ROLE_LABELS.LEASE_TENANT).toBe("Buyer's Agent");
    expect(ROLE_LABELS.LEASE_LANDLORD).toBe("Listing Agent");
    expect(ROLE_LABELS.LEASE_DUAL).toBe("Dual Agent");
    expect(ROLE_LABELS.REFERRAL).toBe("Referral Agent");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web test transaction-sides -- --run`
Expected: FAIL — `SIDES` is not exported (compile error) and `ROLE_LABELS` doesn't exist yet.

- [ ] **Step 4: Edit schema.prisma enum**

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

- [ ] **Step 5: Create the migration folder and hand-write the SQL**

```bash
pnpm --filter @cnc/database exec prisma migrate dev --name rename_transaction_side_values --create-only
```
This generates an empty/incorrect auto-diff — **replace its contents entirely** with:

```sql
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
```

Then apply it:
```bash
pnpm --filter @cnc/database exec prisma migrate dev
pnpm --filter @cnc/database exec prisma generate
```

- [ ] **Step 6: Rewrite `types/transaction.ts`**

```ts
export type ListingType = "RESIDENTIAL_SALE" | "RESIDENTIAL_LEASE" | "COMMERCIAL";
export type TransactionSide = "PURCHASE" | "LISTING" | "DUAL" | "LEASE_TENANT" | "LEASE_LANDLORD" | "LEASE_DUAL" | "REFERRAL";

export const ROLE_LABELS: Record<TransactionSide, string> = {
  PURCHASE: "Buyer's Agent",
  LISTING: "Listing Agent",
  DUAL: "Dual Agent",
  LEASE_TENANT: "Buyer's Agent",
  LEASE_LANDLORD: "Listing Agent",
  LEASE_DUAL: "Dual Agent",
  REFERRAL: "Referral Agent",
};
```
(Keep every other existing export in this file untouched — only the `TransactionSide` type changes, and `ROLE_LABELS` is new.)

- [ ] **Step 7: Rewrite `new-transaction/page.tsx`'s `SIDES` array**

Change line 13's `const SIDES = [` to `export const SIDES = [`, and replace the array contents:
```ts
export const SIDES = [
  { value: "PURCHASE", label: "Purchase", desc: "Representing the buyer in a purchase transaction" },
  { value: "LISTING", label: "Listing", desc: "Representing the seller in a sale transaction" },
  { value: "DUAL", label: "Both Purchase & Listing", desc: "Dual agency — representing buyer and seller" },
  { value: "LEASE_TENANT", label: "Lease Tenant", desc: "Representing the tenant in a lease transaction" },
  { value: "LEASE_LANDLORD", label: "Lease Landlord", desc: "Representing the landlord in a lease transaction" },
  { value: "LEASE_DUAL", label: "Both Lease Tenant & Landlord", desc: "Dual agency — representing tenant and landlord" },
  { value: "REFERRAL", label: "Referral", desc: "Outbound referral to another agent or brokerage — no other role in this deal" },
] as const;
```

- [ ] **Step 8: Update `AgentTransactionsSection.tsx`**

Replace the local type (line 11) and label map (lines 28–31):
```ts
transactionSide: "PURCHASE" | "LISTING" | "DUAL" | "LEASE_TENANT" | "LEASE_LANDLORD" | "LEASE_DUAL" | "REFERRAL";
```
```ts
PURCHASE: "Buyer's Agent",
LISTING: "Listing Agent",
DUAL: "Dual Agent",
LEASE_TENANT: "Buyer's Agent",
LEASE_LANDLORD: "Listing Agent",
LEASE_DUAL: "Dual Agent",
REFERRAL: "Referral Agent",
```

- [ ] **Step 9: Update `admin/settings/checklists/page.tsx` dropdown**

Replace lines 89–92:
```tsx
<option value="PURCHASE">Purchase</option>
<option value="LISTING">Listing</option>
<option value="DUAL">Dual Agency</option>
<option value="LEASE_TENANT">Lease Tenant</option>
<option value="LEASE_LANDLORD">Lease Landlord</option>
<option value="LEASE_DUAL">Lease Dual Agency</option>
<option value="REFERRAL">Referral</option>
```

- [ ] **Step 10: Update `api/listings/[id]/convert/route.ts`**

Line 18: `{ transactionSide: "SELLER_SIDE" }` → `{ transactionSide: "LISTING" }`
Line 34: `transactionSide: "SELLER_SIDE",` → `transactionSide: "LISTING",`

- [ ] **Step 11: Mechanical rename in `api/deals/[id]/convert/route.ts`**

This is the *minimal* fix only — keep existing binary behavior identical, just with renamed literals (the full lease-aware rewrite is Task 7):
```ts
const isBuyers = deal.pipeline === "BUYERS";
// ...
transactionSide: isBuyers ? "PURCHASE" : "LISTING",
```

- [ ] **Step 12: Update `deals-convert.test.ts`**

Rename the existing 2 test cases' literals: `"BUYER_SIDE"` → `"PURCHASE"` (line 76), `"SELLER_SIDE"` → `"LISTING"` (line 93), and rename the test description on line 83 from `"uses SELLER_SIDE for SELLERS pipeline"` to `"uses LISTING for SELLERS pipeline"`.

- [ ] **Step 13: Run test to verify Step 2's test now passes**

Run: `pnpm --filter web test transaction-sides -- --run`
Expected: PASS

- [ ] **Step 14: Run the full suite and typecheck**

```bash
pnpm --filter web test -- --run
pnpm --filter web exec tsc --noEmit
```
Expected: all tests pass, no new TypeScript errors.

- [ ] **Step 15: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations \
  apps/web/src/app/\(dashboard\)/dashboard/transactions/new-transaction/page.tsx \
  apps/web/src/types/transaction.ts \
  apps/web/src/components/agents/AgentTransactionsSection.tsx \
  "apps/web/src/app/(dashboard)/admin/settings/checklists/page.tsx" \
  apps/web/src/app/api/listings/\[id\]/convert/route.ts \
  apps/web/src/app/api/deals/\[id\]/convert/route.ts \
  apps/web/src/__tests__/api/deals-convert.test.ts \
  apps/web/src/__tests__/lib/transaction-sides.test.ts
git commit -m "fix: rename TransactionSide enum values (SELLER_SIDE was mislabeled Referral/Other) and add 3 new types"
```

---

## Task 3: Deal Pipeline stage lists + Kanban UI

**Files:**
- Modify: `apps/web/src/lib/deal-pipeline.ts`
- Modify: `apps/web/src/components/deals/NewDealModal.tsx`
- Test: `apps/web/src/__tests__/lib/deal-pipeline.test.ts`

**Interfaces:**
- Consumes: `DealPipeline.LEASE_TENANT`/`.LEASE_LANDLORD` and `DealStage.SEARCHING`/`.APPLICATION_SUBMITTED`/`.APPLICATION_RECEIVED`/`.LEASE_SIGNED` (from Task 1).
- Produces: `PIPELINE_STAGES` and `STAGE_LABELS` covering all 4 pipelines — Task 7 depends on this.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/__tests__/lib/deal-pipeline.test.ts (add to existing file)
import { PIPELINE_STAGES, STAGE_LABELS, isValidStageForPipeline } from "@/lib/deal-pipeline";

describe("lease pipelines", () => {
  it("LEASE_TENANT has the correct stage list", () => {
    expect(PIPELINE_STAGES.LEASE_TENANT).toEqual(["SEARCHING", "TOURING", "APPLICATION_SUBMITTED", "LEASE_SIGNED", "FALLEN_OUT"]);
  });

  it("LEASE_LANDLORD has the correct stage list", () => {
    expect(PIPELINE_STAGES.LEASE_LANDLORD).toEqual(["LISTING_APPOINTMENT", "ACTIVE_LISTING", "APPLICATION_RECEIVED", "LEASE_SIGNED", "FALLEN_OUT"]);
  });

  it("labels every new stage", () => {
    expect(STAGE_LABELS.SEARCHING).toBe("Searching");
    expect(STAGE_LABELS.APPLICATION_SUBMITTED).toBe("Application Submitted");
    expect(STAGE_LABELS.APPLICATION_RECEIVED).toBe("Application Received");
    expect(STAGE_LABELS.LEASE_SIGNED).toBe("Lease Signed");
  });

  it("isValidStageForPipeline rejects a buyer stage on a lease tenant pipeline", () => {
    expect(isValidStageForPipeline("PRE_APPROVAL", "LEASE_TENANT")).toBe(false);
    expect(isValidStageForPipeline("SEARCHING", "LEASE_TENANT")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test deal-pipeline -- --run`
Expected: FAIL — `PIPELINE_STAGES.LEASE_TENANT` is `undefined`.

- [ ] **Step 3: Update `deal-pipeline.ts`**

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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test deal-pipeline -- --run`
Expected: PASS

- [ ] **Step 5: Update `NewDealModal.tsx` pipeline picker**

Find the existing `(["BUYERS", "SELLERS"] as const)` picker (around line 133) and its button-rendering `.map`. Change to:
```tsx
{(["BUYERS", "SELLERS", "LEASE_TENANT", "LEASE_LANDLORD"] as const).map((p) => (
  <button
    key={p}
    onClick={() => setPipeline(p)}
    className={`flex-1 rounded-lg border px-3 py-2 font-sans text-sm transition-colors ${
      pipeline === p
        ? "border-[#9E8C61] bg-[#9E8C61]/10 font-medium text-[#9E8C61]"
        : "border-[#1B1B1B]/20 text-[#1B1B1B]/60 hover:border-[#1B1B1B]/40"
    }`}
  >
    {p === "BUYERS" ? "Buyers" : p === "SELLERS" ? "Sellers" : p === "LEASE_TENANT" ? "Lease Tenant" : "Lease Landlord"}
  </button>
))}
```
Update the `pipeline` state type from `"BUYERS" | "SELLERS"` to `"BUYERS" | "SELLERS" | "LEASE_TENANT" | "LEASE_LANDLORD"` (both in the `useState` generic and the `Props` type's `initialPipeline?`).
Update `firstStage` logic (currently `pipeline === "BUYERS" ? "PRE_APPROVAL" : "LISTING_APPOINTMENT"`) to read the first entry of `PIPELINE_STAGES[pipeline]` instead of a hardcoded ternary, so it stays correct for all 4 pipelines:
```ts
const firstStage = PIPELINE_STAGES[pipeline][0];
```

- [ ] **Step 6: Run full test suite**

Run: `pnpm --filter web test -- --run`
Expected: all pass, no regressions in existing deal/pipeline tests.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/deal-pipeline.ts apps/web/src/components/deals/NewDealModal.tsx apps/web/src/__tests__/lib/deal-pipeline.test.ts
git commit -m "feat: add Lease Tenant and Lease Landlord deal pipelines"
```

---

## Task 4: New Transaction wizard — Property-step fields

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx`
- Modify: `apps/web/src/app/api/transactions/route.ts` (accept the new fields on create)
- Test: `apps/web/src/__tests__/api/transactions.test.ts`

**Interfaces:**
- Consumes: `TransactionFile.legalDescription/.propertyIncludes/.propertyExcludes/.taxId/.annualTaxes/.schoolDistrict/.zoningClass/.photoKey` (Task 1).

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/__tests__/api/transactions.test.ts (add a case to the existing POST describe block)
it("persists the new Property-step fields", async () => {
  const res = await POST(makeRequest({
    transactionSide: "PURCHASE",
    propertyAddress: "1 Test St", city: "Test", zip: "00000",
    legalDescription: "Lot 4, Block 2, Tract 12345",
    propertyIncludes: "Refrigerator, washer/dryer",
    propertyExcludes: "Wall-mounted TV brackets",
    taxId: "1234-567-890",
    annualTaxes: 8500,
    schoolDistrict: "Pasadena Unified",
    zoningClass: "R-1",
  }));
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.legalDescription).toBe("Lot 4, Block 2, Tract 12345");
  expect(body.annualTaxes).toBe(8500);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test transactions -- --run`
Expected: FAIL — fields not in the create payload, response won't include them (or will be `undefined`).

- [ ] **Step 3: Update `api/transactions/route.ts` POST handler**

Add the 7 new fields to the destructured request body and the `prisma.transactionFile.create({ data: { ... } })` call, following the exact same pattern already used for `escrowNumber`/`propertyType`/`yearBuilt` in that same handler (nullable pass-through, no transformation needed except `annualTaxes: annualTaxes ? Number(annualTaxes) : null`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test transactions -- --run`
Expected: PASS

- [ ] **Step 5: Add the fields to the wizard's Property step**

In `new-transaction/page.tsx`, add to the `form` state object (alongside `propertyType`, `mlsNumber`, etc.):
```ts
legalDescription: "", propertyIncludes: "", propertyExcludes: "",
taxId: "", annualTaxes: "", schoolDistrict: "", zoningClass: "",
```
Add corresponding `<input>`/`<textarea>` elements to the Property step's JSX, following the exact styling pattern already used for the adjacent `mlsNumber`/`yearBuilt` inputs in that step (same `className` pattern: `rounded-lg border border-[#1B1B1B]/20 bg-[#F2F0EF] px-3 py-2 font-sans text-sm`).

For the photo upload: add a file `<input type="file" accept="image/*">` that on change uploads to R2 via the same endpoint/pattern used by the Documents tab's uploader (locate it via `grep -r "r2" apps/web/src/components` if the exact shared helper name isn't immediately visible in this file), storing the returned key into `form.photoKey`.

Update the `PROPERTY_TYPES` array (line 25):
```ts
const PROPERTY_TYPES = ["Single Family", "Condo", "Townhouse", "Multi-Family", "Commercial", "Land", "Industrial", "Farm and Ranch", "Manufactured Home", "Co-Op", "Other"];
```

- [ ] **Step 6: Manual smoke test**

Run `pnpm --filter web dev`, open `/dashboard/transactions/new-transaction`, fill out the Property step including the new fields, submit, and confirm the created file's data (via Prisma Studio or the file detail page's Overview tab) shows the new values.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/dashboard/transactions/new-transaction/page.tsx apps/web/src/app/api/transactions/route.ts apps/web/src/__tests__/api/transactions.test.ts
git commit -m "feat: add missing Property-step fields to New Transaction wizard"
```

---

## Task 5: New Transaction wizard — Offer-step fields + Conditions list

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx`
- Modify: `apps/web/src/app/api/transactions/route.ts`
- Create: `apps/web/src/app/api/transactions/[id]/conditions/route.ts`
- Test: `apps/web/src/__tests__/api/transaction-conditions.test.ts`

**Interfaces:**
- Consumes: `TransactionFile.deposit/.offerExpirationDate/.finalWalkthroughDate/.possessionDate`, `FileCondition` model (Task 1).
- Produces: `POST /api/transactions/[id]/conditions` — creates a `FileCondition`; `GET` — lists them for a transaction.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/__tests__/api/transaction-conditions.test.ts
import { describe, it, expect, vi } from "vitest";
import { POST, GET } from "@/app/api/transactions/[id]/conditions/route";
// ... mock session/prisma following the exact pattern in apps/web/src/__tests__/api/drip-steps.test.ts (nearest analogous nested-resource route)

it("creates a condition under a transaction file", async () => {
  // arrange: mocked owning agent session, mocked transactionFile.findUnique returning an owned file
  const res = await POST(makeRequest({ name: "Inspection Contingency", dueDate: "2026-08-01", notes: "17 days after acceptance" }), { params: { id: "tf1" } });
  expect(res.status).toBe(201);
});

it("returns 403 when the requester doesn't own the transaction file", async () => {
  // arrange: mocked session for a different agent
  const res = await POST(makeRequest({ name: "x" }), { params: { id: "tf1" } });
  expect(res.status).toBe(403);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test transaction-conditions -- --run`
Expected: FAIL — route file doesn't exist.

- [ ] **Step 3: Implement the route**

```ts
// apps/web/src/app/api/transactions/[id]/conditions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

async function assertOwnership(id: string, agentId: string | null, role: string) {
  const file = await prisma.transactionFile.findUnique({ where: { id } });
  if (!file) return null;
  if (role !== "ADMIN" && file.agentId !== agentId) return undefined;
  return file;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;
  const file = await assertOwnership(params.id, session.user.agentId, session.user.role);
  if (file === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (file === undefined) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const conditions = await prisma.fileCondition.findMany({ where: { transactionFileId: params.id }, orderBy: { dueDate: "asc" } });
  return NextResponse.json(conditions);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;
  const file = await assertOwnership(params.id, session.user.agentId, session.user.role);
  if (file === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (file === undefined) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const condition = await prisma.fileCondition.create({
    data: {
      transactionFileId: params.id,
      name: body.name,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      notes: body.notes ?? null,
    },
  });
  return NextResponse.json(condition, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test transaction-conditions -- --run`
Expected: PASS

- [ ] **Step 5: Add Offer-step fields and Conditions UI to the wizard**

Add to `form` state: `deposit: "", offerExpirationDate: "", finalWalkthroughDate: "", possessionDate: ""`. Add corresponding `<input>` fields (deposit as a number input matching the existing `listPrice`/`salePrice` styling) and `<DateField>` instances (matching the existing `acceptanceDate`/`closeOfEscrow` `DateFieldRow` helper already in this file) to the Details/Offer step.

Add a `conditions` array to component state (`useState<{ name: string; dueDate: string; notes: string }[]>([])`) with add/remove controls, following the exact same repeatable-list UI pattern already used for the `buyers`/`sellers` party arrays in this file (an "Add Condition" button pushing an empty entry, each entry rendered with its own remove button). On submit, after the transaction file is created, `POST` each condition to `/api/transactions/{id}/conditions` via `Promise.all`.

- [ ] **Step 6: Manual smoke test**

Create a transaction through the wizard including 2 conditions, confirm both appear via `GET /api/transactions/{id}/conditions`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/dashboard/transactions/new-transaction/page.tsx \
  apps/web/src/app/api/transactions/route.ts \
  apps/web/src/app/api/transactions/\[id\]/conditions/route.ts \
  apps/web/src/__tests__/api/transaction-conditions.test.ts
git commit -m "feat: add missing Offer-step fields and Conditions/Contingencies list to New Transaction wizard"
```

---

## Task 6: Referral Agent party field

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx`
- Test: covered by the existing transaction-creation test suite (extend `transactions.test.ts`)

**Interfaces:**
- Consumes: `FilePartyRole.REFERRAL_AGENT` (Task 1).

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/__tests__/api/transactions.test.ts (add a case)
it("creates a REFERRAL_AGENT party when provided", async () => {
  const res = await POST(makeRequest({
    transactionSide: "PURCHASE", propertyAddress: "1 Test St", city: "Test", zip: "00000",
    referralAgent: { name: "Jane Outbound", email: "jane@otherbrokerage.com", company: "Other Realty" },
  }));
  const body = await res.json();
  const party = await prisma.fileParty.findFirst({ where: { transactionFileId: body.id, role: "REFERRAL_AGENT" } });
  expect(party?.name).toBe("Jane Outbound");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test transactions -- --run`
Expected: FAIL — no `referralAgent` handling in the route yet.

- [ ] **Step 3: Implement**

In `api/transactions/route.ts`'s POST handler, following the exact pattern already used for `titleEscrow`/`loanOfficer` optional party creation: if `referralAgent?.name` is present, include a `FileParty` create with `role: "REFERRAL_AGENT"` in the same nested-create block.

In `new-transaction/page.tsx`, add a `referralAgent` state (`useState<Party>(emptyParty())`) and an optional, collapsed-by-default "Add Referral Agent" section on the Parties step (a toggle button that reveals the same `Party` fields already used for `listingAgent`), on every transaction type — not gated to `REFERRAL` only.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test transactions -- --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/dashboard/transactions/new-transaction/page.tsx apps/web/src/app/api/transactions/route.ts apps/web/src/__tests__/api/transactions.test.ts
git commit -m "feat: add optional Referral Agent party field to New Transaction wizard"
```

---

## Task 7: `deals/[id]/convert` full lease-aware rewrite

**Files:**
- Modify: `apps/web/src/app/api/deals/[id]/convert/route.ts`
- Modify: `apps/web/src/__tests__/api/deals-convert.test.ts`

**Interfaces:**
- Consumes: `PIPELINE_STAGES`/`STAGE_LABELS` (Task 3), renamed `TransactionSide` values (Task 2), `TransactionFile.leasePrice` (Task 1).

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/src/__tests__/api/deals-convert.test.ts (add cases)
it("converts a LEASE_TENANT deal to a LEASE_TENANT transaction with leasePrice set", async () => {
  // arrange: mocked deal with pipeline: "LEASE_TENANT", stage: "LEASE_SIGNED", price: 2800
  const res = await POST(makeRequest(), { params: { id: "d1" } });
  expect(res.status).toBe(201);
  expect(prisma.transactionFile.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ transactionSide: "LEASE_TENANT", leasePrice: 2800 }) })
  );
});

it("converts a LEASE_LANDLORD deal to a LEASE_LANDLORD transaction with leasePrice set", async () => {
  // arrange: mocked deal with pipeline: "LEASE_LANDLORD", stage: "LEASE_SIGNED", price: 3200
  const res = await POST(makeRequest(), { params: { id: "d2" } });
  expect(res.status).toBe(201);
  expect(prisma.transactionFile.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ transactionSide: "LEASE_LANDLORD", leasePrice: 3200 }) })
  );
});

it("rejects converting a LEASE_TENANT deal that hasn't reached LEASE_SIGNED", async () => {
  // arrange: mocked deal with pipeline: "LEASE_TENANT", stage: "TOURING"
  const res = await POST(makeRequest(), { params: { id: "d3" } });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test deals-convert -- --run`
Expected: FAIL — current route only knows `BUYERS`/`SELLERS`, has no lease-pipeline branch, and the stage-gate only recognizes `"OFFER_ACCEPTED"`.

- [ ] **Step 3: Implement the mapping table and pipeline-aware stage-gate**

```ts
import { PIPELINE_STAGES } from "@/lib/deal-pipeline";

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

// Replace the existing stage-gate check with:
const stages = PIPELINE_STAGES[deal.pipeline as keyof typeof PIPELINE_STAGES] ?? [];
const terminalStage = stages[stages.length - 2]; // last entry before FALLEN_OUT
if (deal.stage !== terminalStage) {
  return NextResponse.json({ error: `Deal must be in the final stage to convert` }, { status: 400 });
}

// Replace the transaction-file create call's relevant fields with:
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test deals-convert -- --run`
Expected: PASS — all 5 cases (2 original + 3 new) green.

- [ ] **Step 5: Run the full suite and typecheck**

```bash
pnpm --filter web test -- --run
pnpm --filter web exec tsc --noEmit
```
Expected: all pass, zero new TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/deals/\[id\]/convert/route.ts apps/web/src/__tests__/api/deals-convert.test.ts
git commit -m "feat: deals/convert supports lease tenant/landlord pipelines with dynamic price field mapping"
```

---

## Task 8: Kanban UI pipeline-aware terminal-stage trigger

**Added post-hoc:** the final whole-branch review (after Task 7) found that `DealDrawer.tsx`, `DealCard.tsx`, and `DealBoard.tsx` all hardcode checks against the literal `"OFFER_ACCEPTED"` stage to trigger the convert-to-transaction UI and "accepted" styling. This meant a `LEASE_TENANT`/`LEASE_LANDLORD` deal reaching `LEASE_SIGNED` had no UI path to invoke Task 7's now-lease-aware `deals/convert` route. This task closes that gap.

**Files:**
- Modify: `apps/web/src/lib/deal-pipeline.ts`
- Modify: `apps/web/src/components/deals/DealCard.tsx`
- Modify: `apps/web/src/components/deals/DealDrawer.tsx`
- Modify: `apps/web/src/components/deals/DealBoard.tsx`
- Test: `apps/web/src/__tests__/lib/deal-pipeline.test.ts`

**Interfaces:**
- Produces: `isTerminalStage(pipeline: DealPipeline, stage: DealStage): boolean` — exported from `deal-pipeline.ts`, using the same `PIPELINE_STAGES[pipeline][length-2]` formula the `deals/convert` route (Task 7) already uses, so both can never drift apart again.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/__tests__/lib/deal-pipeline.test.ts (add to existing file)
import { isTerminalStage } from "@/lib/deal-pipeline";

describe("isTerminalStage", () => {
  it("BUYERS: OFFER_ACCEPTED is terminal, TOURING is not", () => {
    expect(isTerminalStage("BUYERS", "OFFER_ACCEPTED")).toBe(true);
    expect(isTerminalStage("BUYERS", "TOURING")).toBe(false);
  });
  it("SELLERS: OFFER_ACCEPTED is terminal", () => {
    expect(isTerminalStage("SELLERS", "OFFER_ACCEPTED")).toBe(true);
  });
  it("LEASE_TENANT: LEASE_SIGNED is terminal, SEARCHING is not", () => {
    expect(isTerminalStage("LEASE_TENANT", "LEASE_SIGNED")).toBe(true);
    expect(isTerminalStage("LEASE_TENANT", "SEARCHING")).toBe(false);
  });
  it("LEASE_LANDLORD: LEASE_SIGNED is terminal", () => {
    expect(isTerminalStage("LEASE_LANDLORD", "LEASE_SIGNED")).toBe(true);
  });
  it("FALLEN_OUT is never terminal for any pipeline", () => {
    expect(isTerminalStage("BUYERS", "FALLEN_OUT")).toBe(false);
    expect(isTerminalStage("LEASE_TENANT", "FALLEN_OUT")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test deal-pipeline -- --run`
Expected: FAIL — `isTerminalStage` is not exported yet.

- [ ] **Step 3: Add `isTerminalStage` to `deal-pipeline.ts`**

```ts
export function isTerminalStage(pipeline: DealPipeline, stage: DealStage): boolean {
  const stages = PIPELINE_STAGES[pipeline];
  return stages[stages.length - 2] === stage;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test deal-pipeline -- --run`
Expected: PASS

- [ ] **Step 5: Update `DealCard.tsx`**

Replace line 16:
```ts
const isAccepted = isTerminalStage(deal.pipeline, deal.stage);
```
Add `isTerminalStage` to the existing `@/lib/deal-pipeline` import.

- [ ] **Step 6: Update `DealDrawer.tsx`**

Replace line 73's condition:
```ts
if (isTerminalStage(deal.pipeline, stage) && !isTerminalStage(deal.pipeline, prevStage)) {
  setShowConvertPrompt(true);
}
```
Replace line 150's condition:
```tsx
{isTerminalStage(deal.pipeline, deal.stage) && !hasLinkedFile && !showConvertPrompt && (
```
Add `isTerminalStage` to the existing `@/lib/deal-pipeline` import.

Also update the convert-prompt copy at line 130 so it isn't sale-specific wording on a lease deal — replace the hardcoded `"Offer accepted! Ready to open a Transaction File?"` with a label derived from the deal's own terminal stage:
```tsx
<p className="mb-3 font-sans text-sm text-[#1B1B1B]">
  {STAGE_LABELS[deal.stage as keyof typeof STAGE_LABELS]}! Ready to open a Transaction File?
</p>
```
(`STAGE_LABELS` is already imported in this file.)

- [ ] **Step 7: Update `DealBoard.tsx`**

Replace line 82's condition:
```ts
if (isTerminalStage(pipeline, newStage as DealStage) && onOfferAccepted) {
```
Add `isTerminalStage` to the existing `@/lib/deal-pipeline` import. Leave the `onOfferAccepted` prop name and its type signature unchanged — it's an internal callback name, not user-facing, and renaming it would touch every caller for no functional benefit.

- [ ] **Step 8: Run full suite and typecheck**

```bash
pnpm --filter web test -- --run
pnpm --filter web exec tsc --noEmit
```
Expected: all pass, no new TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/deal-pipeline.ts apps/web/src/components/deals/DealCard.tsx apps/web/src/components/deals/DealDrawer.tsx apps/web/src/components/deals/DealBoard.tsx apps/web/src/__tests__/lib/deal-pipeline.test.ts
git commit -m "fix: make Kanban convert-trigger pipeline-aware so lease deals can convert to transactions"
```

---

## Task 9: Wizard captures leasePrice instead of forcing salePrice for lease/referral sides

**Added post-hoc:** the final whole-branch review also found that the New Transaction wizard's Details step (`canAdvance` at step 2) unconditionally requires `form.salePrice` and never captures the `leasePrice` field Task 1 added to the schema. A lease or referral file created manually through the wizard (not via `deals/convert`) is forced into a "Sale / Purchase Price" field and would have its rent stored under the wrong column. This task is narrowly scoped to fixing price *capture and storage*, not to redesigning commission math for lease deals — that is explicitly out of scope here.

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx`
- Modify: `apps/web/src/app/api/transactions/route.ts`
- Test: `apps/web/src/__tests__/api/transactions.test.ts`

**Interfaces:**
- Consumes: `TransactionFile.leasePrice` (already exists, Task 1).

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/__tests__/api/transactions.test.ts (add a case)
it("persists leasePrice (not salePrice) for a LEASE_TENANT transaction", async () => {
  const res = await POST(makeRequest({
    transactionSide: "LEASE_TENANT", propertyAddress: "1 Test St", city: "Test", zip: "00000",
    leasePrice: "2800",
  }));
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.leasePrice).toBe(2800);
  expect(body.salePrice).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test transactions -- --run`
Expected: FAIL — `leasePrice` isn't in the route's create payload yet.

- [ ] **Step 3: Update `api/transactions/route.ts`**

Add `leasePrice` alongside the existing `listPrice`/`salePrice` destructuring and create call, using the identical nullable pass-through pattern:
```ts
leasePrice: leasePrice ? parseFloat(leasePrice) : null,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test transactions -- --run`
Expected: PASS

- [ ] **Step 5: Update the wizard**

Add `leasePrice: ""` to the `form` state object (alongside `listPrice`/`salePrice`/`deposit`).

Add a derived constant near the top of the component body, alongside the existing `salePrice` derived constant (line 82):
```ts
const isLeaseSide = ["LEASE_TENANT", "LEASE_LANDLORD", "LEASE_DUAL"].includes(form.transactionSide);
```

Update `canAdvance`'s step-2 check (currently `if (step === 2) return !!form.salePrice;`) to:
```ts
if (step === 2) return isLeaseSide ? !!form.leasePrice : !!form.salePrice;
```
Add `form.leasePrice` to the `useMemo` dependency array alongside `form.salePrice`.

In the Details step's price fields (around the existing "List Price" / "Sale / Purchase Price *" `Field` pair), conditionally render: when `isLeaseSide`, show a single field instead of the List/Sale pair:
```tsx
{isLeaseSide ? (
  <Field label="Lease Price (Monthly Rent) *" type="number" value={form.leasePrice} onChange={(v) => set("leasePrice", v)} placeholder="$" />
) : (
  <>
    <Field label="List Price" type="number" value={form.listPrice} onChange={(v) => set("listPrice", v)} placeholder="$" />
    <Field label="Sale / Purchase Price *" type="number" value={form.salePrice} onChange={(v) => set("salePrice", v)} placeholder="$" />
  </>
)}
```

Add a Review-step row for lease price, following the exact existing conditional pattern used for `form.salePrice`'s review row:
```tsx
{form.leasePrice && <ReviewRow label="Lease Price" value={`$${Number(form.leasePrice).toLocaleString()}`} />}
```

Do not modify the commission calculation section (the `salePrice`-derived GCI math) — that remains explicitly out of scope for this task, since redesigning how commission is calculated for lease deals is a separate product decision, not a price-storage bug.

- [ ] **Step 6: Manual smoke test**

Run `pnpm --filter web dev`, open `/dashboard/transactions/new-transaction`, select "Lease Tenant" as the type, confirm the Details step shows "Lease Price (Monthly Rent) *" instead of the List/Sale Price pair, submit, and confirm the created file's `leasePrice` (not `salePrice`) is populated.

- [ ] **Step 7: Run full suite and typecheck**

```bash
pnpm --filter web test -- --run
pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx" apps/web/src/app/api/transactions/route.ts apps/web/src/__tests__/api/transactions.test.ts
git commit -m "fix: New Transaction wizard captures leasePrice instead of forcing salePrice for lease/referral sides"
```

---

## Task 10: Expose Lease Tenant/Lease Landlord as selectable pipeline-page tabs

**Added post-hoc:** Task 8's implementer discovered that `apps/web/src/app/(dashboard)/dashboard/pipeline/page.tsx` hardcodes its tab type as `"BUYERS" | "SELLERS"` and only renders 2 tab buttons — there is no way to select or view a `LEASE_TENANT`/`LEASE_LANDLORD` pipeline board anywhere in the dashboard UI, even though the backend (Task 7), Kanban trigger logic (Task 8), and wizard (Tasks 3, 9) are all already lease-aware. This is the last layer needed to make the lease pipeline feature reachable end-to-end.

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/pipeline/page.tsx`
- Test: `apps/web/src/__tests__/app/pipeline-page.test.tsx` (new, if no existing test file covers this page — check first; if one exists, extend it instead)

**Interfaces:**
- Consumes: `DealBoard`'s `pipeline` prop (already typed as the full `DealPipeline` enum since Task 3) and `NewDealModal`'s `initialPipeline` prop (same).

This task also refactors the page's 2 parallel `buyerDeals`/`sellerDeals` state variables into a single `Record<PipelineTab, DealRow[]>` — with 4 pipelines, keeping 4 parallel state variables and 4-way duplicated branches in `fetchDeals`/`handleDrawerSaved`/`handleDrawerDeleted`/`handleModalSaved` would be significantly more error-prone than the existing 2-way version already is. This is a targeted improvement to code this task must modify anyway, not a speculative refactor.

- [ ] **Step 1: Write the failing test**

Check first whether `apps/web/src/__tests__/app/pipeline-page.test.tsx` or similar already exists (`grep -rl "PipelinePage" apps/web/src/__tests__`). If none exists, this is the first test for this page — write a minimal one covering the new behavior:

```tsx
// apps/web/src/__tests__/app/pipeline-page.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PipelinePage from "@/app/(dashboard)/dashboard/pipeline/page";

// Mock next/navigation's useSearchParams/useRouter and global fetch following
// the pattern already used in other client-page tests in this repo (grep for
// "useSearchParams" mocks in apps/web/src/__tests__ if one exists as a
// reference; otherwise a minimal vi.mock of "next/navigation" returning a
// static searchParams/router is sufficient here).

describe("PipelinePage tabs", () => {
  it("renders all 4 pipeline tabs", () => {
    render(<PipelinePage />);
    expect(screen.getByText("Buyers")).toBeInTheDocument();
    expect(screen.getByText("Sellers")).toBeInTheDocument();
    expect(screen.getByText("Lease Tenant")).toBeInTheDocument();
    expect(screen.getByText("Lease Landlord")).toBeInTheDocument();
  });
});
```

If mocking this client page's `useSearchParams`/`fetch`/`useRouter` turns out to be disproportionately heavy compared to the rest of this repo's test suite (check a couple of existing `(dashboard)` page tests for the established pattern first), it's acceptable to report `DONE_WITH_CONCERNS` on the test step specifically and rely on the manual smoke test in Step 4 instead — note this rather than spending excessive effort forcing a test pattern this codebase doesn't already have for client pages of this shape.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test pipeline-page -- --run`
Expected: FAIL — only 2 tab labels exist today.

- [ ] **Step 3: Rewrite the page**

Replace the file's pipeline-related state and logic with:

```ts
const PIPELINES = ["BUYERS", "SELLERS", "LEASE_TENANT", "LEASE_LANDLORD"] as const;
type PipelineTab = (typeof PIPELINES)[number];

const TAB_LABELS: Record<PipelineTab, string> = {
  BUYERS: "Buyers",
  SELLERS: "Sellers",
  LEASE_TENANT: "Lease Tenant",
  LEASE_LANDLORD: "Lease Landlord",
};
```

Replace the `tab` line:
```ts
const tab = (searchParams.get("pipeline") as PipelineTab) ?? "BUYERS";
```

Replace `buyerDeals`/`sellerDeals` state with:
```ts
const [dealsByPipeline, setDealsByPipeline] = useState<Record<PipelineTab, DealRow[]>>({
  BUYERS: [], SELLERS: [], LEASE_TENANT: [], LEASE_LANDLORD: [],
});
```

Replace `fetchDeals`:
```ts
const fetchDeals = useCallback(async () => {
  setLoading(true);
  const responses = await Promise.all(PIPELINES.map((p) => fetch(`/api/deals?pipeline=${p}`)));
  const results = await Promise.all(responses.map((r) => (r.ok ? r.json() : [])));
  setDealsByPipeline(Object.fromEntries(PIPELINES.map((p, i) => [p, results[i]])) as Record<PipelineTab, DealRow[]>);
  setLoading(false);
}, []);
```

Replace `setTab`:
```ts
function setTab(p: PipelineTab) {
  router.push(`/dashboard/pipeline?pipeline=${p}`);
}
```

Replace `handleDrawerSaved`:
```ts
function handleDrawerSaved(updated: DealRow) {
  setDealsByPipeline((prev) => {
    const next = { ...prev };
    for (const p of PIPELINES) next[p] = prev[p].map((d) => (d.id === updated.id ? updated : d));
    return next;
  });
  setSelectedDeal(updated);
}
```

Replace `handleDrawerDeleted`:
```ts
function handleDrawerDeleted(dealId: string) {
  setDealsByPipeline((prev) => {
    const next = { ...prev };
    for (const p of PIPELINES) next[p] = prev[p].filter((d) => d.id !== dealId);
    return next;
  });
  setDrawerOpen(false);
  setSelectedDeal(null);
}
```

Replace `handleModalSaved`:
```ts
function handleModalSaved(deal: DealRow) {
  setDealsByPipeline((prev) => ({ ...prev, [deal.pipeline]: [...prev[deal.pipeline], deal] }));
}
```

Replace `currentDeals`:
```ts
const currentDeals = dealsByPipeline[tab];
```

Replace the tab-buttons JSX (the `{(["BUYERS", "SELLERS"] as const).map(...)}` block):
```tsx
{PIPELINES.map((p) => (
  <button
    key={p}
    onClick={() => setTab(p)}
    className={`rounded-lg px-5 py-2 font-sans text-sm transition-colors ${
      tab === p
        ? "bg-white font-medium text-[#1B1B1B] shadow-sm"
        : "text-[#1B1B1B]/50 hover:text-[#1B1B1B]"
    }`}
  >
    {TAB_LABELS[p]}
  </button>
))}
```

Everything else in the file (imports, `handleCardClick`, `handleConverted`, the `DealBoard`/`DealDrawer`/`NewDealModal` JSX at the bottom) is unchanged — `pipeline={tab}` and `initialPipeline={tab}` already accept the full 4-value type.

- [ ] **Step 4: Manual smoke test**

Run `pnpm --filter web dev`, open `/dashboard/pipeline`, confirm all 4 tabs render and clicking "Lease Tenant"/"Lease Landlord" switches the board (even if empty) without errors.

- [ ] **Step 5: Run full suite and typecheck**

```bash
pnpm --filter web test -- --run
pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/pipeline/page.tsx" apps/web/src/__tests__/app/pipeline-page.test.tsx
git commit -m "feat: expose Lease Tenant and Lease Landlord as selectable pipeline-page tabs"
```

---

## Self-Review Notes

- **Spec coverage:** all 9 items from the design spec's "What ships" list map to a task — schema (Task 1 + part of Task 2), enum rename + literal fixes (Task 2), pipeline stages + Kanban (Task 3), Property fields (Task 4), Offer fields + conditions (Task 5), referral party (Task 6), convert route rewrite (Task 7).
- **Type consistency:** `SIDES`/`ROLE_LABELS`/`PIPELINE_STAGES` value spellings cross-checked against the Global Constraints block and used identically across Tasks 2, 3, and 7.
- **No placeholders:** every step above has real code, not a description of code.
