# Commercial Listing & Transaction Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Commercial listings and transactions the same complete checklist coverage residential already has, without breaking anything currently working for the 6 residential transaction sides.

**Architecture:** Split `ListingType.COMMERCIAL` into `COMMERCIAL_SALE`/`COMMERCIAL_LEASE` (mirrors the existing residential split). Add a new `propertyCategory` field to `TransactionFile` (a new `PropertyCategory` enum: `RESIDENTIAL`/`COMMERCIAL`) and to `ChecklistTemplate` (a string, default `"ALL"`, matching that model's existing `transactionSide`/`listingType` fields) — this is deliberately *not* 6 new duplicate `TransactionSide` values; the existing status-transition tables are already identical across all 6 non-Referral sides, so property type only needs to affect which checklist applies, nothing else. Checklist-matching queries in `transactions/route.ts` and `listings/[id]/convert/route.ts` get extended to filter on `propertyCategory` too — done in the same task as backfilling the 6 existing templates to `propertyCategory: "RESIDENTIAL"`, since doing one without the other creates an ambiguous double-match that would silently corrupt existing residential checklists.

**Tech Stack:** Next.js 14 App Router, Prisma (Postgres/Neon), Vitest, TypeScript.

## Global Constraints

- Every existing residential `TransactionSide`/`ListingType` behavior must be unaffected — verified via regression tests in Task 4 and Task 5, not just new-behavior tests.
- Checklist item content for the 8 new templates is exactly as specified in `docs/superpowers/specs/2026-07-16-commercial-listing-transaction-support-design.md` §3 — copy verbatim, do not improvise additional items.
- All new checklist template IDs use the `seed-commercial-*` prefix (parallel to the existing `seed-*` convention in `packages/database/prisma/seed.ts`).
- Follow the existing test-mocking convention exactly (`vi.mock("next-auth", ...)`, `vi.mock("@/lib/prisma", ...)`) — do not introduce a different testing approach.

---

### Task 1: Schema migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma:106-110` (ListingType enum), `:460-513` (TransactionFile model), `:571-582` (ChecklistTemplate model)

**Interfaces:**
- Produces: `ListingType` enum values `RESIDENTIAL_SALE | RESIDENTIAL_LEASE | COMMERCIAL_SALE | COMMERCIAL_LEASE`; new `PropertyCategory` enum (`RESIDENTIAL | COMMERCIAL`); `TransactionFile.propertyCategory: PropertyCategory` (default `RESIDENTIAL`); `ChecklistTemplate.propertyCategory: String` (default `"ALL"`) — all consumed by every later task.

- [ ] **Step 1: Confirm no existing rows use the bare `COMMERCIAL` value (already verified once during spec research, re-verify fresh before migrating)**

Run from `packages/database`:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const count = await prisma.listingFile.count({ where: { listingType: 'COMMERCIAL' } });
  console.log('Rows with listingType=COMMERCIAL:', count);
  await prisma.\$disconnect();
})();
"
```
Expected: `Rows with listingType=COMMERCIAL: 0`. If non-zero, STOP — this plan assumes zero rows and does not include a data-migration step for existing `COMMERCIAL` rows.

- [ ] **Step 2: Edit the schema**

In `packages/database/prisma/schema.prisma`, replace the `ListingType` enum (currently lines 106-110):
```prisma
enum ListingType {
  RESIDENTIAL_SALE
  RESIDENTIAL_LEASE
  COMMERCIAL_SALE
  COMMERCIAL_LEASE
}
```

Add a new enum directly after it:
```prisma
enum PropertyCategory {
  RESIDENTIAL
  COMMERCIAL
}
```

In the `TransactionFile` model, add this field directly after `transactionSide TransactionSide` (currently line 473):
```prisma
  propertyCategory     PropertyCategory      @default(RESIDENTIAL)
```

In the `ChecklistTemplate` model, add this field directly after `transactionSide String @default("ALL")`:
```prisma
  propertyCategory String   @default("ALL")
```
(Read the current exact `ChecklistTemplate` block first with `grep -n "model ChecklistTemplate" -A 15 packages/database/prisma/schema.prisma` to place it correctly relative to the existing `transactionSide`/`listingType` fields — insert immediately after `listingType`.)

- [ ] **Step 3: Run the migration**

From `packages/database`:
```bash
npx prisma migrate dev --name add_property_category_and_split_commercial_listing_type
```
Expected: migration created and applied with no errors, Prisma Client regenerated.

- [ ] **Step 4: Verify the Prisma Client picked up the new types**

```bash
npx tsc --noEmit -p ../../apps/web
```
Expected: no new type errors introduced by this change (pre-existing unrelated errors from elsewhere in the codebase are fine — confirm any errors shown are NOT in files this plan touches).

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat: split commercial listing type, add propertyCategory to TransactionFile and ChecklistTemplate"
```

---

### Task 2: Update `apps/web/src/types/transaction.ts`

**Files:**
- Modify: `apps/web/src/types/transaction.ts:11` (ListingType union), add `PropertyCategory` type, `:73-` (`TransactionFileDetail` interface)

**Interfaces:**
- Consumes: `PropertyCategory` enum from Task 1 (conceptually — this file hand-declares string unions rather than importing from Prisma, matching its existing pattern for `ListingType`/`TransactionSide`)
- Produces: `PropertyCategory` type (`"RESIDENTIAL" | "COMMERCIAL"`), updated `ListingType` type, `TransactionFileDetail.propertyCategory` field — consumed by Task 9 and Task 10's UI code

- [ ] **Step 1: Edit the file**

Change line 11 from:
```typescript
export type ListingType = "RESIDENTIAL_SALE" | "RESIDENTIAL_LEASE" | "COMMERCIAL";
```
to:
```typescript
export type ListingType = "RESIDENTIAL_SALE" | "RESIDENTIAL_LEASE" | "COMMERCIAL_SALE" | "COMMERCIAL_LEASE";
export type PropertyCategory = "RESIDENTIAL" | "COMMERCIAL";
```

In the `TransactionFileDetail` interface, add directly after `transactionSide: TransactionSide;` (currently line 86):
```typescript
  propertyCategory: PropertyCategory;
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no new errors from this file. (This will likely surface downstream errors in files not yet updated — e.g., anywhere still constructing a `TransactionFileDetail`-shaped object without `propertyCategory`. That's expected until later tasks land; note any such errors here but don't fix them yet if they belong to a later task's file.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/types/transaction.ts
git commit -m "feat: add PropertyCategory type and split ListingType union"
```

---

### Task 3: Seed data — backfill existing templates, add 8 new commercial templates

**Files:**
- Modify: `packages/database/prisma/seed.ts` (entire `upsertTemplate` helper + template item constants + the `Promise.all` call list)

**Interfaces:**
- Consumes: `ChecklistTemplate.propertyCategory` field from Task 1
- Produces: 17 total `ChecklistTemplate` rows in the seeded DB (9 existing + 8 new), all Transaction-side rows carrying an explicit `propertyCategory` (`"RESIDENTIAL"` or `"COMMERCIAL"`, never left on the `"ALL"` default) — consumed by Task 4 and Task 5's matching-query tests

- [ ] **Step 1: Add the 8 new item-content constants**

In `packages/database/prisma/seed.ts`, add these after the existing `REFERRAL_ITEMS` constant (currently ends at line 85):

```typescript
const COMMERCIAL_SALE_LISTING_ITEMS = [
  { name: "CLA — Commercial/Residential Income and Vacant Land Listing Agreement", description: "Exclusive commercial listing contract", isRequired: true, order: 1 },
  { name: "CSPQ — Commercial Seller Property Questionnaire", description: "C.A.R. commercial seller disclosure questionnaire", isRequired: true, order: 2 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Applies to commercial too, not residential-only. Govt. Code §8589.3", isRequired: true, order: 3 },
];

const COMMERCIAL_LEASE_LISTING_ITEMS = [
  { name: "CLA — Commercial/Residential Income and Vacant Land Listing Agreement", description: "C.A.R. uses this form for commercial lease listings too", isRequired: true, order: 1 },
  { name: "CL — Commercial Lease Agreement", description: "The executed lease, once signed", isRequired: true, order: 2 },
  { name: "CASp Disclosure", description: "Accessibility inspection status disclosure, legally required on every commercial lease. Civil Code §1938 (AB 2093)", isRequired: true, order: 3 },
  { name: "Prop 65 Warning", description: "Required only if the property contains chemicals known to the State of California to cause cancer or reproductive harm. Health & Safety Code §25249.6", isRequired: false, order: 4 },
];

const COMMERCIAL_PURCHASE_ITEMS = [
  { name: "CPA — Commercial Property Purchase Agreement & Joint Escrow Instructions", description: "The purchase contract", isRequired: true, order: 1 },
  { name: "CSPQ — Commercial Seller Property Questionnaire", description: "Received from seller", isRequired: true, order: 2 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Received from seller/vendor. Govt. Code §8589.3", isRequired: true, order: 3 },
];

const COMMERCIAL_LISTING_TX_ITEMS = [
  { name: "CPA — Commercial Property Purchase Agreement & Joint Escrow Instructions", description: "Fully executed purchase contract", isRequired: true, order: 1 },
  { name: "CSPQ — Commercial Seller Property Questionnaire", description: "C.A.R. commercial seller disclosure questionnaire", isRequired: true, order: 2 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Govt. Code §8589.3", isRequired: true, order: 3 },
];

const COMMERCIAL_DUAL_ITEMS = [
  { name: "CPA — Commercial Property Purchase Agreement & Joint Escrow Instructions", description: "The purchase contract", isRequired: true, order: 1 },
  { name: "CSPQ — Commercial Seller Property Questionnaire", description: "C.A.R. commercial seller disclosure questionnaire", isRequired: true, order: 2 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Govt. Code §8589.3", isRequired: true, order: 3 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Civil Code §2079.13-2079.24", isRequired: true, order: 4 },
];

const COMMERCIAL_LEASE_TENANT_ITEMS = [
  { name: "CL — Commercial Lease Agreement", description: "The lease contract", isRequired: true, order: 1 },
  { name: "CASp Disclosure", description: "Accessibility inspection status disclosure, legally required on every commercial lease. Civil Code §1938 (AB 2093)", isRequired: true, order: 2 },
  { name: "Prop 65 Warning", description: "Required only if the property contains listed chemicals. Health & Safety Code §25249.6", isRequired: false, order: 3 },
];

const COMMERCIAL_LEASE_LANDLORD_ITEMS = [
  { name: "CL — Commercial Lease Agreement", description: "The lease contract", isRequired: true, order: 1 },
  { name: "CASp Disclosure", description: "Accessibility inspection status disclosure, legally required on every commercial lease. Civil Code §1938 (AB 2093)", isRequired: true, order: 2 },
  { name: "Prop 65 Warning", description: "Required only if the property contains listed chemicals. Health & Safety Code §25249.6", isRequired: false, order: 3 },
];

const COMMERCIAL_LEASE_DUAL_ITEMS = [
  { name: "CL — Commercial Lease Agreement", description: "The lease contract", isRequired: true, order: 1 },
  { name: "CASp Disclosure", description: "Accessibility inspection status disclosure, legally required on every commercial lease. Civil Code §1938 (AB 2093)", isRequired: true, order: 2 },
  { name: "Prop 65 Warning", description: "Required only if the property contains listed chemicals. Health & Safety Code §25249.6", isRequired: false, order: 3 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Civil Code §2079.13-2079.24", isRequired: true, order: 4 },
];
```

- [ ] **Step 2: Update `upsertTemplate` to accept `propertyCategory`**

Replace the `upsertTemplate` function (currently lines 125-139):
```typescript
  async function upsertTemplate(
    id: string,
    name: string,
    fileType: "LISTING" | "TRANSACTION",
    listingType: string,
    transactionSide: string,
    propertyCategory: string,
    items: { name: string; description: string; isRequired: boolean; order: number }[]
  ) {
    await prisma.checklistTemplateItem.deleteMany({ where: { templateId: id } });
    return prisma.checklistTemplate.upsert({
      where: { id },
      update: { name, fileType, listingType, transactionSide, propertyCategory, items: { create: items } },
      create: { id, name, fileType, listingType, transactionSide, propertyCategory, isActive: true, items: { create: items } },
    });
  }
```

- [ ] **Step 3: Update the `Promise.all` call list**

Replace the existing call list (currently lines 141-151) — every existing `TRANSACTION`-fileType call gets an explicit `"RESIDENTIAL"` `propertyCategory` argument added (the two `LISTING`-fileType calls get `"ALL"`, since Listing-side matching doesn't use this field — see Task 1), and 8 new calls are added:

```typescript
  const templates = await Promise.all([
    upsertTemplate("seed-res-sale-listing", "Residential Sale — Listing Forms (Pre-Contract)", "LISTING", "RESIDENTIAL_SALE", "ALL", "ALL", RESIDENTIAL_SALE_LISTING_ITEMS),
    upsertTemplate("seed-res-sale-buyer", "Purchase Forms", "TRANSACTION", "ALL", "PURCHASE", "RESIDENTIAL", RESIDENTIAL_SALE_BUYER_ITEMS),
    upsertTemplate("seed-res-sale-seller", "Listing Forms", "TRANSACTION", "ALL", "LISTING", "RESIDENTIAL", RESIDENTIAL_SALE_SELLER_ITEMS),
    upsertTemplate("seed-res-lease", "Residential Lease — Landlord Listing Forms (Pre-Contract)", "LISTING", "RESIDENTIAL_LEASE", "ALL", "ALL", RESIDENTIAL_LEASE_LISTING_ITEMS),
    upsertTemplate("seed-res-lease-tenant", "Lease Tenant Forms", "TRANSACTION", "ALL", "LEASE_TENANT", "RESIDENTIAL", RESIDENTIAL_LEASE_TENANT_ITEMS),
    upsertTemplate("seed-res-lease-landlord", "Lease Landlord Forms", "TRANSACTION", "ALL", "LEASE_LANDLORD", "RESIDENTIAL", RESIDENTIAL_LEASE_LANDLORD_ITEMS),
    upsertTemplate("seed-dual-agency", "Dual Agency Forms", "TRANSACTION", "ALL", "DUAL", "RESIDENTIAL", DUAL_AGENCY_ITEMS),
    upsertTemplate("seed-lease-dual-agency", "Lease Dual Agency Forms", "TRANSACTION", "ALL", "LEASE_DUAL", "RESIDENTIAL", LEASE_DUAL_AGENCY_ITEMS),
    upsertTemplate("seed-referral", "Referral Forms", "TRANSACTION", "ALL", "REFERRAL", "ALL", REFERRAL_ITEMS),
    upsertTemplate("seed-commercial-sale-listing", "Commercial Sale — Listing Forms (Pre-Contract)", "LISTING", "COMMERCIAL_SALE", "ALL", "ALL", COMMERCIAL_SALE_LISTING_ITEMS),
    upsertTemplate("seed-commercial-lease-listing", "Commercial Lease — Landlord Listing Forms (Pre-Contract)", "LISTING", "COMMERCIAL_LEASE", "ALL", "ALL", COMMERCIAL_LEASE_LISTING_ITEMS),
    upsertTemplate("seed-commercial-purchase", "Commercial Purchase Forms", "TRANSACTION", "ALL", "PURCHASE", "COMMERCIAL", COMMERCIAL_PURCHASE_ITEMS),
    upsertTemplate("seed-commercial-listing-tx", "Commercial Listing Forms", "TRANSACTION", "ALL", "LISTING", "COMMERCIAL", COMMERCIAL_LISTING_TX_ITEMS),
    upsertTemplate("seed-commercial-dual", "Commercial Dual Agency Forms", "TRANSACTION", "ALL", "DUAL", "COMMERCIAL", COMMERCIAL_DUAL_ITEMS),
    upsertTemplate("seed-commercial-lease-tenant", "Commercial Lease Tenant Forms", "TRANSACTION", "ALL", "LEASE_TENANT", "COMMERCIAL", COMMERCIAL_LEASE_TENANT_ITEMS),
    upsertTemplate("seed-commercial-lease-landlord", "Commercial Lease Landlord Forms", "TRANSACTION", "ALL", "LEASE_LANDLORD", "COMMERCIAL", COMMERCIAL_LEASE_LANDLORD_ITEMS),
    upsertTemplate("seed-commercial-lease-dual", "Commercial Lease Dual Agency Forms", "TRANSACTION", "ALL", "LEASE_DUAL", "COMMERCIAL", COMMERCIAL_LEASE_DUAL_ITEMS),
  ]);
```

Note the `seed-res-sale-listing` and `seed-res-lease` (the two existing `LISTING`-fileType rows) and their two new commercial counterparts all pass `"ALL"` for `propertyCategory` — that field is irrelevant on the `LISTING` side, which already distinguishes commercial vs. residential entirely through `listingType`.

- [ ] **Step 4: Run the seed script against the real dev DB**

```bash
cd packages/database && npx prisma db seed
```
Expected output line: `Created/updated 17 checklist templates: ...` listing all 17 names.

- [ ] **Step 5: Verify directly against the DB — this is the "test" for this task (seed data has no unit-test equivalent in this codebase; verified live, matching how every existing checklist template was verified throughout this project)**

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const count = await prisma.checklistTemplate.count();
  console.log('Total templates:', count);
  const stale = await prisma.checklistTemplate.count({ where: { fileType: 'TRANSACTION', transactionSide: { not: 'REFERRAL' }, propertyCategory: 'ALL' } });
  console.log('Non-referral TRANSACTION templates still on propertyCategory=ALL (should be 0):', stale);
  await prisma.\$disconnect();
})();
"
```
Expected: `Total templates: 17` and `...should be 0): 0`.

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/seed.ts
git commit -m "feat: seed 8 commercial checklist templates, backfill propertyCategory on existing 6"
```

---

### Task 4: `transactions/route.ts` — match on `propertyCategory`, with regression coverage

**Files:**
- Modify: `apps/web/src/app/api/transactions/route.ts:29-65`
- Test: `apps/web/src/__tests__/api/transactions.test.ts`

**Interfaces:**
- Consumes: `ChecklistTemplate.propertyCategory` (Task 1, seeded in Task 3)
- Produces: `POST /api/transactions` now accepts `propertyCategory` in the request body and matches the checklist template on both `transactionSide` and `propertyCategory`

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/__tests__/api/transactions.test.ts` (append inside a new `describe` block, after the existing ones — check the existing file's closing brace location first with `tail -20 apps/web/src/__tests__/api/transactions.test.ts`):

```typescript
describe("POST /api/transactions — propertyCategory checklist matching", () => {
  beforeEach(() => vi.clearAllMocks());

  it("matches the checklist template using both transactionSide and propertyCategory", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: "a1" } } as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tx1" } as any);

    await POST(makeRequest({
      transactionSide: "PURCHASE", propertyCategory: "COMMERCIAL",
      propertyAddress: "1 Biz Park Dr", city: "Irvine", zip: "92618",
    }));

    expect(prisma.checklistTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ transactionSide: "PURCHASE" }, { transactionSide: "ALL" }],
          AND: [{ OR: [{ propertyCategory: "COMMERCIAL" }, { propertyCategory: "ALL" }] }],
        }),
      })
    );
  });

  it("defaults propertyCategory to RESIDENTIAL when not provided (regression guard)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: "a1" } } as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tx2" } as any);

    await POST(makeRequest({
      transactionSide: "PURCHASE",
      propertyAddress: "123 Main St", city: "LA", zip: "90001",
    }));

    expect(prisma.checklistTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ OR: [{ propertyCategory: "RESIDENTIAL" }, { propertyCategory: "ALL" }] }],
        }),
      })
    );
  });

  it("persists propertyCategory on the created TransactionFile", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: "a1" } } as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tx3" } as any);

    await POST(makeRequest({
      transactionSide: "PURCHASE", propertyCategory: "COMMERCIAL",
      propertyAddress: "1 Biz Park Dr", city: "Irvine", zip: "92618",
    }));

    expect(prisma.transactionFile.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ propertyCategory: "COMMERCIAL" }) })
    );
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd apps/web && npx vitest run src/__tests__/api/transactions.test.ts
```
Expected: the 3 new tests FAIL (the `AND` clause and `propertyCategory` field don't exist in the route yet). Confirm the failures are about missing `AND`/`propertyCategory`, not a typo in the test itself.

- [ ] **Step 3: Implement**

In `apps/web/src/app/api/transactions/route.ts`, add `propertyCategory` to the destructured body (line 30, alongside `transactionSide, stage,`):
```typescript
    transactionSide, propertyCategory, stage,
```

Replace the checklist lookup (currently lines 62-65):
```typescript
  const category = propertyCategory === "COMMERCIAL" ? "COMMERCIAL" : "RESIDENTIAL";
  const template = await prisma.checklistTemplate.findFirst({
    where: {
      fileType: "TRANSACTION",
      isActive: true,
      OR: [{ transactionSide }, { transactionSide: "ALL" }],
      AND: [{ OR: [{ propertyCategory: category }, { propertyCategory: "ALL" }] }],
    },
    include: { items: { orderBy: { order: "asc" } } },
  });
```

Add `propertyCategory: category,` to the `transactionFile.create` data block, directly after `transactionSide,` (currently line 87):
```typescript
        transactionSide,
        propertyCategory: category,
```

- [ ] **Step 4: Run to verify they pass**

```bash
cd apps/web && npx vitest run src/__tests__/api/transactions.test.ts
```
Expected: all tests in the file PASS, including the pre-existing ones (regression check).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/transactions/route.ts apps/web/src/__tests__/api/transactions.test.ts
git commit -m "feat: match transaction checklist templates on propertyCategory too"
```

---

### Task 5: `listings/[id]/convert/route.ts` — derive `propertyCategory`, extend side derivation

**Files:**
- Modify: `apps/web/src/app/api/listings/[id]/convert/route.ts:17-22, 27-46`
- Test: `apps/web/src/__tests__/api/listings-convert.test.ts`

**Interfaces:**
- Consumes: `ListingFile.listingType` now includes `COMMERCIAL_SALE`/`COMMERCIAL_LEASE` (Task 1)
- Produces: converting a `COMMERCIAL_SALE` listing creates a `TransactionFile` with `transactionSide: "LISTING", propertyCategory: "COMMERCIAL"`; converting a `COMMERCIAL_LEASE` listing creates one with `transactionSide: "LEASE_LANDLORD", propertyCategory: "COMMERCIAL"`

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/__tests__/api/listings-convert.test.ts`, after the existing `describe` block's last test (before its closing `});`):

```typescript
const COMMERCIAL_SALE_LISTING = {
  ...SALE_LISTING, id: "l3", listingType: "COMMERCIAL_SALE",
};

const COMMERCIAL_LEASE_LISTING = {
  ...SALE_LISTING, id: "l4", listingType: "COMMERCIAL_LEASE",
};

describe("POST /api/listings/[id]/convert — commercial propertyCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(((arr: any[]) => Promise.all(arr)) as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({} as any);
  });

  it("converts a COMMERCIAL_SALE listing to transactionSide LISTING, propertyCategory COMMERCIAL", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(COMMERCIAL_SALE_LISTING as any);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tf4" } as any);

    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "l3" } });
    expect(res.status).toBe(201);
    expect(prisma.transactionFile.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transactionSide: "LISTING", propertyCategory: "COMMERCIAL" }) })
    );
  });

  it("converts a COMMERCIAL_LEASE listing to transactionSide LEASE_LANDLORD, propertyCategory COMMERCIAL", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(COMMERCIAL_LEASE_LISTING as any);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tf5" } as any);

    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "l4" } });
    expect(res.status).toBe(201);
    expect(prisma.transactionFile.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transactionSide: "LEASE_LANDLORD", propertyCategory: "COMMERCIAL" }) })
    );
  });

  it("still converts RESIDENTIAL_SALE to propertyCategory RESIDENTIAL (regression guard)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(SALE_LISTING as any);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tf6" } as any);

    await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "l1" } });
    expect(prisma.transactionFile.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transactionSide: "LISTING", propertyCategory: "RESIDENTIAL" }) })
    );
  });

  it("looks up the checklist template using both transactionSide and propertyCategory", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(COMMERCIAL_LEASE_LISTING as any);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tf7" } as any);

    await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "l4" } });
    expect(prisma.checklistTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ transactionSide: "LEASE_LANDLORD" }, { transactionSide: "ALL" }],
          AND: [{ OR: [{ propertyCategory: "COMMERCIAL" }, { propertyCategory: "ALL" }] }],
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd apps/web && npx vitest run src/__tests__/api/listings-convert.test.ts
```
Expected: the 4 new tests FAIL (route doesn't yet derive `propertyCategory` or handle `COMMERCIAL_SALE`/`COMMERCIAL_LEASE`).

- [ ] **Step 3: Implement**

In `apps/web/src/app/api/listings/[id]/convert/route.ts`, replace lines 17-22:
```typescript
  const transactionSide = listing.listingType === "RESIDENTIAL_LEASE" || listing.listingType === "COMMERCIAL_LEASE"
    ? "LEASE_LANDLORD"
    : "LISTING";
  const propertyCategory = listing.listingType.startsWith("COMMERCIAL") ? "COMMERCIAL" : "RESIDENTIAL";

  const template = await prisma.checklistTemplate.findFirst({
    where: {
      fileType: "TRANSACTION",
      isActive: true,
      OR: [{ transactionSide }, { transactionSide: "ALL" }],
      AND: [{ OR: [{ propertyCategory }, { propertyCategory: "ALL" }] }],
    },
    include: { items: { orderBy: { order: "asc" } } },
  });
```

Add `propertyCategory,` to the `transactionFile.create` data block, directly after `transactionSide,` (currently line 36):
```typescript
        transactionSide,
        propertyCategory,
```

- [ ] **Step 4: Run to verify they pass**

```bash
cd apps/web && npx vitest run src/__tests__/api/listings-convert.test.ts
```
Expected: all tests PASS, including the 5 pre-existing ones.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/listings/[id]/convert/route.ts apps/web/src/__tests__/api/listings-convert.test.ts
git commit -m "feat: derive propertyCategory on listing-to-transaction conversion, handle commercial sides"
```

---

### Task 6: `deals/[id]/convert/route.ts` — fix the missing checklist attach

**Files:**
- Modify: `apps/web/src/app/api/deals/[id]/convert/route.ts:1-59`
- Test: `apps/web/src/__tests__/api/deals-convert.test.ts`

**Interfaces:**
- Consumes: `ChecklistTemplate.findFirst` matching pattern established in Task 4/5
- Produces: converting a Deal to a Transaction now attaches the matching residential checklist (Deal Pipeline has no commercial concept yet — out of scope per the design spec, defaults to `propertyCategory: "RESIDENTIAL"`)

- [ ] **Step 1: Write the failing test**

First, update the mock in `apps/web/src/__tests__/api/deals-convert.test.ts` (currently lines 5-11) to include `checklistTemplate`:
```typescript
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    deal: { findUnique: vi.fn(), update: vi.fn() },
    transactionFile: { create: vi.fn() },
    checklistTemplate: { findFirst: vi.fn() },
  },
}));
```

Then add `vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);` to the existing `beforeEach` (currently line 27, `beforeEach(() => vi.clearAllMocks());` — change to a block body):
```typescript
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
  });
```

Add a new test at the end of the `describe` block, before its closing `});`:
```typescript
  it("attaches the matching checklist template when converting", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue(BUYERS_DEAL as any);
    const mockItems = [{ name: "RPA-CA — California Residential Purchase Agreement", description: "The purchase contract", order: 1, isRequired: true }];
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue({ id: "t1", items: mockItems } as any);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tf-new" } as any);
    vi.mocked(prisma.deal.update).mockResolvedValue({} as any);

    await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "d1" } });

    expect(prisma.checklistTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fileType: "TRANSACTION",
          OR: [{ transactionSide: "PURCHASE" }, { transactionSide: "ALL" }],
          AND: [{ OR: [{ propertyCategory: "RESIDENTIAL" }, { propertyCategory: "ALL" }] }],
        }),
      })
    );
    expect(prisma.transactionFile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          checklistItems: { create: [expect.objectContaining({ name: mockItems[0].name, fileType: "TRANSACTION" })] },
        }),
      })
    );
  });
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/web && npx vitest run src/__tests__/api/deals-convert.test.ts
```
Expected: FAIL — `prisma.checklistTemplate.findFirst` was never called (route doesn't look up a template today).

- [ ] **Step 3: Implement**

In `apps/web/src/app/api/deals/[id]/convert/route.ts`, insert directly before the `const tf = await prisma.transactionFile.create({` line (currently line 47):
```typescript
  const template = await prisma.checklistTemplate.findFirst({
    where: {
      fileType: "TRANSACTION",
      isActive: true,
      OR: [{ transactionSide }, { transactionSide: "ALL" }],
      AND: [{ OR: [{ propertyCategory: "RESIDENTIAL" }, { propertyCategory: "ALL" }] }],
    },
    include: { items: { orderBy: { order: "asc" } } },
  });
```

Add `checklistItems` to the `transactionFile.create` data block (currently lines 48-58), directly after `status: "INCOMPLETE",`:
```typescript
      status: "INCOMPLETE",
      checklistItems: template ? {
        create: template.items.map((item) => ({
          fileType: "TRANSACTION" as const,
          name: item.name,
          description: item.description,
          order: item.order,
          isRequired: item.isRequired,
        })),
      } : undefined,
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd apps/web && npx vitest run src/__tests__/api/deals-convert.test.ts
```
Expected: all tests PASS, including the 7 pre-existing ones.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/deals/[id]/convert/route.ts apps/web/src/__tests__/api/deals-convert.test.ts
git commit -m "fix: attach checklist template when converting a Deal to a Transaction"
```

---

### Task 7: Admin checklist-templates API — accept `propertyCategory`

**Files:**
- Modify: `apps/web/src/app/api/admin/checklist-templates/route.ts:24-37`, `apps/web/src/app/api/admin/checklist-templates/[id]/route.ts:6-23`
- Test: Create `apps/web/src/__tests__/api/admin-checklist-templates.test.ts` (no existing test file for these routes today)

**Interfaces:**
- Consumes: `ChecklistTemplate.propertyCategory` (Task 1)
- Produces: `POST`/`PATCH /api/admin/checklist-templates` accept and persist `propertyCategory`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/api/admin-checklist-templates.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    checklistTemplate: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/admin/checklist-templates/route";
import { PATCH } from "../../app/api/admin/checklist-templates/[id]/route";

const SESSION_ADMIN = { user: { id: "u1", role: "ADMIN" } };

function makeRequest(body: object) {
  return new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/admin/checklist-templates — propertyCategory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists propertyCategory on create, defaulting to ALL when omitted", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_ADMIN as any);
    vi.mocked(prisma.checklistTemplate.create).mockResolvedValue({ id: "t1" } as any);

    await POST(makeRequest({ name: "Commercial Purchase Forms", fileType: "TRANSACTION", transactionSide: "PURCHASE", propertyCategory: "COMMERCIAL" }));

    expect(prisma.checklistTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ propertyCategory: "COMMERCIAL" }) })
    );
  });

  it("defaults propertyCategory to ALL when not provided", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_ADMIN as any);
    vi.mocked(prisma.checklistTemplate.create).mockResolvedValue({ id: "t2" } as any);

    await POST(makeRequest({ name: "Referral Forms", fileType: "TRANSACTION" }));

    expect(prisma.checklistTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ propertyCategory: "ALL" }) })
    );
  });
});

describe("PATCH /api/admin/checklist-templates/[id] — propertyCategory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates propertyCategory when provided", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_ADMIN as any);
    vi.mocked(prisma.checklistTemplate.update).mockResolvedValue({ id: "t1" } as any);

    const req = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ propertyCategory: "COMMERCIAL" }),
      headers: { "Content-Type": "application/json" },
    });
    await PATCH(req, { params: { id: "t1" } });

    expect(prisma.checklistTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ propertyCategory: "COMMERCIAL" }) })
    );
  });

  it("omits propertyCategory from the update payload when not provided", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_ADMIN as any);
    vi.mocked(prisma.checklistTemplate.update).mockResolvedValue({ id: "t1" } as any);

    const req = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ isActive: false }),
      headers: { "Content-Type": "application/json" },
    });
    await PATCH(req, { params: { id: "t1" } });

    const call = vi.mocked(prisma.checklistTemplate.update).mock.calls[0][0];
    expect(call.data).not.toHaveProperty("propertyCategory");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd apps/web && npx vitest run src/__tests__/api/admin-checklist-templates.test.ts
```
Expected: all 4 tests FAIL — neither route handles `propertyCategory` yet.

- [ ] **Step 3: Implement**

In `apps/web/src/app/api/admin/checklist-templates/route.ts`, replace lines 29-34:
```typescript
  const { name, fileType, transactionSide, listingType, propertyCategory } = await req.json();
  if (!name || !fileType) return NextResponse.json({ error: "name and fileType are required" }, { status: 400 });

  const template = await prisma.checklistTemplate.create({
    data: { name, fileType, transactionSide: transactionSide ?? "ALL", listingType: listingType ?? "ALL", propertyCategory: propertyCategory ?? "ALL" },
  });
```

In `apps/web/src/app/api/admin/checklist-templates/[id]/route.ts`, add to the `data` object in `PATCH` (currently lines 13-18), directly after the `listingType` line:
```typescript
      ...(body.listingType !== undefined && { listingType: body.listingType }),
      ...(body.propertyCategory !== undefined && { propertyCategory: body.propertyCategory }),
```

- [ ] **Step 4: Run to verify they pass**

```bash
cd apps/web && npx vitest run src/__tests__/api/admin-checklist-templates.test.ts
```
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/admin/checklist-templates apps/web/src/__tests__/api/admin-checklist-templates.test.ts
git commit -m "feat: admin checklist-template API accepts and persists propertyCategory"
```

---

### Task 8: New Listing wizard — split the Commercial dropdown option

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-listing/page.tsx:93-95`

**Interfaces:**
- Consumes: `ListingType` values from Task 1/2

No automated test exists for this wizard today (it's a plain client form with no dedicated test file, consistent with `new-transaction/page.tsx` also having none) — verify manually per Step 2, matching this codebase's existing convention for wizard UI.

- [ ] **Step 1: Edit the dropdown**

In `apps/web/src/app/(dashboard)/dashboard/transactions/new-listing/page.tsx`, replace lines 93-95:
```typescript
                <option value="RESIDENTIAL_SALE">Residential Sale</option>
                <option value="RESIDENTIAL_LEASE">Residential Lease</option>
                <option value="COMMERCIAL_SALE">Commercial Sale</option>
                <option value="COMMERCIAL_LEASE">Commercial Lease</option>
```

Also update the default form state (currently line 17, `listingType: "RESIDENTIAL_SALE",`) — no change needed here, `"RESIDENTIAL_SALE"` is still a valid default.

- [ ] **Step 2: Manual verification**

Start the dev server (`pnpm --filter web dev`), navigate to `/dashboard/transactions/new-listing`, open the Listing Type dropdown, confirm it shows exactly 4 options: Residential Sale, Residential Lease, Commercial Sale, Commercial Lease. Submit a listing with `Commercial Sale` selected, confirm it creates successfully, then check that file's Checklist tab shows the 3 "Commercial Sale — Listing Forms" items (CLA, CSPQ, NHD) — this is the true end-to-end proof this task's data flows correctly, not just that the dropdown renders.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/transactions/new-listing/page.tsx"
git commit -m "feat: split Commercial listing type into Sale and Lease in the New Listing wizard"
```

---

### Task 9: New Transaction wizard — add the Property Category selector

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx:11-19, 46-66, 110-115, 254-269`

**Interfaces:**
- Consumes: `propertyCategory` field expected by `POST /api/transactions` (Task 4)
- Produces: `form.propertyCategory` included in the wizard's submit payload; Step 0 blocks advancing until it's set (for non-Referral sides)

- [ ] **Step 1: Add the `PROPERTY_CATEGORIES` constant**

In `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx`, add directly after the `STAGES` constant (currently ends at line 24):
```typescript
const PROPERTY_CATEGORIES = [
  { value: "RESIDENTIAL", label: "Residential", desc: "Single family, condo, multi-family, or other residential property" },
  { value: "COMMERCIAL", label: "Commercial", desc: "Office, retail, industrial, or other commercial property" },
] as const;
```

- [ ] **Step 2: Add `propertyCategory` to form state**

In the `form` initial state (currently line 47, `transactionSide: "",`), add directly after it:
```typescript
    transactionSide: "",
    propertyCategory: "",
```

- [ ] **Step 3: Gate `canAdvance` on it for non-Referral sides**

Replace the Step 0 line in `canAdvance` (currently line 111):
```typescript
    if (step === 0) return isReferral ? !!form.transactionSide : (!!form.transactionSide && !!form.propertyCategory);
```

Add `form.propertyCategory` and `isReferral` (if not already present — it is, per line 115) to the `useMemo` dependency array (currently line 115):
```typescript
  }, [step, isReferral, form.transactionSide, form.propertyCategory, form.referredToAgentName, form.propertyAddress, form.city, form.zip, form.salePrice, form.leasePrice]);
```

- [ ] **Step 4: Render the new OptionCard section**

In the Step 0 JSX, the "Transaction Stage" section is currently lines 254-269: it opens with `{form.transactionSide && (` at line 254 and closes with `)}` at line 269, immediately followed by `</div>` at line 270 (closing the outer `space-y-8` wrapper) and `)}` at line 271 (closing `{step === 0 && (...)}`). Insert the new block directly after line 269's `)}` and before line 270's `</div>`:
```typescript
            {form.transactionSide && !isReferral && (
              <div>
                <SectionLabel>Property Category</SectionLabel>
                <div className="grid grid-cols-2 gap-4">
                  {PROPERTY_CATEGORIES.map((c) => (
                    <OptionCard
                      key={c.value}
                      selected={form.propertyCategory === c.value}
                      onClick={() => set("propertyCategory", c.value)}
                      label={c.label}
                      desc={c.desc}
                    />
                  ))}
                </div>
              </div>
            )}
```

(Verify the exact insertion point by re-reading lines 253-271 immediately before editing — the existing Stage section's conditional and closing tags must be matched exactly.)

- [ ] **Step 5: Manual verification**

Start the dev server, navigate to `/dashboard/transactions/new-transaction`, select any non-Referral side (e.g., Purchase). Confirm:
- "Property Category" section appears below "Transaction Stage" with Residential/Commercial options.
- "Next" stays disabled until a category is picked (test by inspecting the button's `disabled` state or attempting to click before selecting).
- Selecting "Referral" as the side does NOT show the Property Category section.
- Complete the wizard with Commercial + Purchase selected, confirm the created file's Checklist tab shows "Commercial Purchase Forms" items (CPA, CSPQ, NHD), not the residential Purchase Forms.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx"
git commit -m "feat: add Property Category selector to the New Transaction wizard"
```

---

### Task 10: Admin Checklist Templates page — add Property Category selector

**Files:**
- Modify: `apps/web/src/app/(dashboard)/admin/settings/checklists/page.tsx:12-14, 25-43, 85-108`

**Interfaces:**
- Consumes: `POST /api/admin/checklist-templates` now accepting `propertyCategory` (Task 7)

- [ ] **Step 1: Add state**

In `apps/web/src/app/(dashboard)/admin/settings/checklists/page.tsx`, add directly after `const [newSide, setNewSide] = useState<string>("");` (currently line 14):
```typescript
  const [newPropertyCategory, setNewPropertyCategory] = useState<string>("");
```

- [ ] **Step 2: Include it in the create request and reset**

In `createTemplate` (currently lines 25-43), add `propertyCategory: newPropertyCategory || undefined,` to the request body (directly after `transactionSide: newSide || undefined,`, currently line 34):
```typescript
        transactionSide: newSide || undefined,
        propertyCategory: newPropertyCategory || undefined,
```
And reset it alongside the other fields after a successful create (directly after `setNewSide("");`, currently line 40):
```typescript
    setNewSide("");
    setNewPropertyCategory("");
```

- [ ] **Step 3: Render the selector**

In the JSX, directly after the "Transaction Side" `<select>`'s closing `</div>` (currently right after line 107, still inside the `grid grid-cols-2` wrapper that opened at line 85) — change that wrapper to `grid-cols-3` and add a third field:

Replace line 85:
```typescript
          <div className="grid grid-cols-3 gap-4">
```

Add directly after the Transaction Side field's closing `</div>` (currently line 107), before the wrapper's closing `</div>` (currently line 108):
```typescript
            <div>
              <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">Property Category</label>
              <select value={newPropertyCategory} onChange={(e) => setNewPropertyCategory(e.target.value)} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm">
                <option value="">Any</option>
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial</option>
              </select>
            </div>
```

- [ ] **Step 4: Update the template list display to show the category**

At line 136 (`{t.transactionSide ? ` · ${t.transactionSide.replace(/_/g, " ")}` : ""}`), add directly after it:
```typescript
                    {t.propertyCategory && t.propertyCategory !== "ALL" ? ` · ${t.propertyCategory}` : ""}
```

- [ ] **Step 5: Manual verification**

Start the dev server, navigate to `/admin/settings/checklists`, click "New Template," confirm the "Property Category" dropdown appears alongside "Listing Type" and "Transaction Side" (3-column layout), and confirm the 8 new commercial templates seeded in Task 3 display "· COMMERCIAL" in their subtitle line.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(dashboard)/admin/settings/checklists/page.tsx"
git commit -m "feat: add Property Category selector to the admin checklist template form"
```

---

### Task 11: Full regression pass

**Files:** None modified — verification only.

- [ ] **Step 1: Run the full test suite**

```bash
cd apps/web && npx vitest run
```
Expected: all tests pass, including every pre-existing test untouched by this plan (this is the final proof nothing residential broke).

- [ ] **Step 2: Type-check the whole app**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors introduced by this plan's files.

- [ ] **Step 3: Live end-to-end walk, one residential and one commercial flow, per property category**

Using Puppeteer or a browser, with the dev server running:
1. Create a **residential** Purchase transaction end-to-end (New Transaction wizard) — confirm it still gets "Purchase Forms" (RPA-CA, not CPA).
2. Create a **commercial** Purchase transaction — confirm it gets "Commercial Purchase Forms" (CPA, CSPQ, NHD).
3. Create a **Commercial Sale** listing, confirm "Commercial Sale — Listing Forms" attaches, then click "Convert to Transaction" — confirm the resulting Transaction file has `propertyCategory: COMMERCIAL` and shows "Commercial Listing Forms" on its Checklist tab.
4. Create a **Referral** transaction — confirm the Property Category section never appeared during creation, and the file still gets "Referral Forms" (unaffected by any of this plan's changes).

- [ ] **Step 4: Final commit if any fixes were needed during this pass**

If Steps 1-3 are clean, no commit needed — this task is verification-only. If any issue surfaced, fix it within the relevant task's file, re-run that task's own tests, then commit with a message referencing which task's regression it fixes.

---

## Self-Review Notes

**Spec coverage:** All of design-spec §1 (schema), §2 (matching logic + backfill), §3 (8 new templates), §4 (deals/convert fix), and §5's downstream-impact table (Tasks 8-10 for the 3 UI files, Task 2 for `types/transaction.ts`) are covered by a task. The Pre-Contract/Under-Contract item is explicitly out of scope (reviewed, no change) and correctly has no task.

**Placeholder scan:** No TBD/TODO — every step has literal, complete code. Task 8/9 manual-verification steps are the only non-automated checks, consistent with this codebase having zero wizard-UI test coverage today (established precedent, not a gap introduced by this plan).

**Type consistency:** `propertyCategory` (lowercase c) used consistently across every task; `PropertyCategory` (the type/enum name) capitalized consistently. `category` as a local variable name in Task 4/5's route bodies matches how `transactionSide` and other derived locals are named in those same files today.
