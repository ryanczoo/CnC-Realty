# Checklist Template Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3 generic placeholder checklist templates (currently `prisma db seed` demo data) with the real, DRE/C.A.R.-verified CA compliance checklists, and close a real auto-apply routing gap discovered during investigation: today, creating a residential-sale Listing File, or any Lease-side Transaction File (tenant or landlord), auto-applies zero checklist because no template exists for those match points.

**Architecture:** `ChecklistTemplate` rows are matched by two independent flows: `ListingFile` creation (`/api/listings` POST) matches on `fileType: "LISTING"` + `listingType` (RESIDENTIAL_SALE/RESIDENTIAL_LEASE/COMMERCIAL only — `transactionSide` is ignored for this flow). `TransactionFile` creation (`/api/transactions` POST) matches on `fileType: "TRANSACTION"` + `transactionSide` (PURCHASE/LISTING/DUAL/LEASE_TENANT/LEASE_LANDLORD/LEASE_DUAL/REFERRAL — `listingType` is ignored for this flow). Both default to `"ALL"` as a wildcard when unset. `packages/database/prisma/seed.ts` is the single source of truth — it's re-run against the live Neon DB to both fix current data and remain correct for any future fresh-DB seed.

**Tech Stack:** Prisma (Postgres/Neon), `tsx` seed script, Next.js API routes (read-only reference, not modified).

## Global Constraints

- Do not modify `apps/web/src/app/api/listings/route.ts`, `apps/web/src/app/api/transactions/route.ts`, or the admin checklist UI — this plan is data-only.
- Every checklist item name must use the real C.A.R. form code + name (e.g. `TDS — Real Estate Transfer Disclosure Statement`), verified live against car.org's June 2026 Master Forms List and the CA DRE's official "Disclosures in Real Property Transactions" (RE 6) booklet — not the placeholder names currently in `seed.ts`.
- `isRequired: true` only for items that are legally mandated by statute per the DRE booklet or standard CA practice (BRBC post-Aug-2024 NAR settlement); conditional items (HOA docs, Lead-Based Paint pre-1978) are `isRequired: false` with the condition stated in `description`.
- Scope is residential sale + residential lease only (matches CnC's site — Buy/Sell/Rent/Manage, no commercial marketing). `COMMERCIAL` listingType and `DUAL`/`LEASE_DUAL`/`REFERRAL` transactionSides intentionally get no dedicated template in this pass — flag as a known follow-up in the final report, don't build them now.
- Seed must stay idempotent and safe to re-run (fresh DB, CI, or re-running against the already-seeded live Neon DB tonight).

---

### Task 1: Rewrite the checklist seeding logic in `packages/database/prisma/seed.ts`

**Files:**
- Modify: `packages/database/prisma/seed.ts:5-123` (the `RESIDENTIAL_SALE_BUYER_ITEMS` / `RESIDENTIAL_SALE_SELLER_ITEMS` / `RESIDENTIAL_LEASE_ITEMS` constants and the 3 `checklistTemplate.upsert` calls inside `main()`)

**Interfaces:**
- Produces: 6 `ChecklistTemplate` rows in the DB, each with a stable seed `id` so re-running is idempotent:
  - `seed-res-sale-listing` — `fileType: "LISTING"`, `listingType: "RESIDENTIAL_SALE"`, `transactionSide: "ALL"`
  - `seed-res-sale-buyer` — `fileType: "TRANSACTION"`, `transactionSide: "PURCHASE"`, `listingType: "ALL"`
  - `seed-res-sale-seller` — `fileType: "TRANSACTION"`, `transactionSide: "LISTING"`, `listingType: "ALL"`
  - `seed-res-lease` — `fileType: "LISTING"`, `listingType: "RESIDENTIAL_LEASE"`, `transactionSide: "ALL"` (reused from the original seed's ID to replace it in place, not orphan it)
  - `seed-res-lease-tenant` — `fileType: "TRANSACTION"`, `transactionSide: "LEASE_TENANT"`, `listingType: "ALL"`
  - `seed-res-lease-landlord` — `fileType: "TRANSACTION"`, `transactionSide: "LEASE_LANDLORD"`, `listingType: "ALL"`

- [ ] **Step 1: Replace the 3 item-array constants and the 3 `checklistTemplate.upsert` calls with the corrected, complete set**

Replace lines 5-35 (the three `_ITEMS` constants) with:

```typescript
const RESIDENTIAL_SALE_LISTING_ITEMS = [
  { name: "RLA — Residential Listing Agreement (Exclusive)", description: "Signed exclusive right-to-sell listing contract", isRequired: true, order: 1 },
  { name: "AVID — Agent Visual Inspection Disclosure", description: "Agent's own visual inspection disclosure, Civil Code §2079", isRequired: true, order: 2 },
  { name: "TDS — Real Estate Transfer Disclosure Statement", description: "Seller's statutory disclosure, Civil Code §1102", isRequired: true, order: 3 },
  { name: "SPQ — Seller Property Questionnaire", description: "C.A.R. supplemental seller questionnaire", isRequired: true, order: 4 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Ordered from a third-party NHD vendor, not a C.A.R. form. Govt. Code §8589.3", isRequired: true, order: 5 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Civil Code §2079.13-2079.24", isRequired: true, order: 6 },
  { name: "DBD — Megan's Law Database Disclosure", description: "Civil Code §2079.10a", isRequired: true, order: 7 },
  { name: "WHSD — Water Heater & Smoke Detector Statement of Compliance", description: "Health & Safety Code water heater bracing + smoke/CO detector compliance", isRequired: true, order: 8 },
  { name: "HOA Governing Documents", description: "Required only if the property is part of a common interest development (HOA)", isRequired: false, order: 9 },
];

const RESIDENTIAL_SALE_BUYER_ITEMS = [
  { name: "RPA-CA — California Residential Purchase Agreement", description: "The purchase contract", isRequired: true, order: 1 },
  { name: "BRBC — Buyer Representation and Broker Compensation Agreement", description: "Required before touring homes per the Aug. 2024 NAR settlement", isRequired: true, order: 2 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Civil Code §2079.13-2079.24", isRequired: true, order: 3 },
  { name: "AVID — Agent Visual Inspection Disclosure", description: "Agent's own visual inspection disclosure", isRequired: true, order: 4 },
  { name: "SBSA — Statewide Buyer and Seller Advisory", description: "C.A.R. consolidated general-disclosure advisory", isRequired: true, order: 5 },
  { name: "TDS — Real Estate Transfer Disclosure Statement", description: "Received from seller", isRequired: true, order: 6 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Received from seller/vendor", isRequired: true, order: 7 },
  { name: "FIRPTA / CA Withholding Affidavit", description: "Foreign Investment in Real Property Tax Act + CA state withholding certification", isRequired: true, order: 8 },
  { name: "Proof of Funds / Loan Pre-Approval Letter", description: "Lender pre-approval or proof of funds dated within 30 days", isRequired: true, order: 9 },
];

const RESIDENTIAL_SALE_SELLER_ITEMS = [
  { name: "RPA-CA — Countersigned Purchase Agreement", description: "Fully executed purchase contract", isRequired: true, order: 1 },
  { name: "TDS — Real Estate Transfer Disclosure Statement", description: "Civil Code §1102", isRequired: true, order: 2 },
  { name: "SPQ — Seller Property Questionnaire", description: "C.A.R. supplemental seller questionnaire", isRequired: true, order: 3 },
  { name: "SBSA — Statewide Buyer and Seller Advisory", description: "C.A.R. consolidated general-disclosure advisory", isRequired: true, order: 4 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Govt. Code §8589.3", isRequired: true, order: 5 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Civil Code §2079.13-2079.24", isRequired: true, order: 6 },
  { name: "DBD — Megan's Law Database Disclosure", description: "Civil Code §2079.10a", isRequired: true, order: 7 },
  { name: "WHSD — Water Heater & Smoke Detector Statement of Compliance", description: "Health & Safety Code compliance statement", isRequired: true, order: 8 },
  { name: "HOA Governing Documents", description: "Required only if the property is part of a common interest development (HOA)", isRequired: false, order: 9 },
];

const RESIDENTIAL_LEASE_LISTING_ITEMS = [
  { name: "LL — Lease Listing Agreement (Exclusive Authorization to Lease or Rent)", description: "Landlord's exclusive leasing listing contract", isRequired: true, order: 1 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Required for leases over 1 year; standard practice regardless", isRequired: true, order: 2 },
  { name: "LPD — Lead-Based Paint and Lead-Based Paint Hazards Disclosure", description: "Federal law, required only for housing built before 1978", isRequired: false, order: 3 },
];

const RESIDENTIAL_LEASE_TENANT_ITEMS = [
  { name: "RLMM — Residential Lease or Month-to-Month Rental Agreement", description: "The lease contract", isRequired: true, order: 1 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Required for leases over 1 year; standard practice regardless", isRequired: true, order: 2 },
  { name: "LPD — Lead-Based Paint and Lead-Based Paint Hazards Disclosure", description: "Federal law, required only for housing built before 1978", isRequired: false, order: 3 },
  { name: "MII — Move-In Inspection", description: "Signed condition checklist at move-in", isRequired: true, order: 4 },
];

const RESIDENTIAL_LEASE_LANDLORD_ITEMS = [
  { name: "RLMM — Residential Lease or Month-to-Month Rental Agreement", description: "The lease contract", isRequired: true, order: 1 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Required for leases over 1 year; standard practice regardless", isRequired: true, order: 2 },
  { name: "LPD — Lead-Based Paint and Lead-Based Paint Hazards Disclosure", description: "Federal law, required only for housing built before 1978", isRequired: false, order: 3 },
];
```

Replace the body of `main()` from `console.log("Seeding checklist templates...")` through `console.log(\`Created templates: ...\`)` (original lines 73-123) with:

```typescript
  console.log("Seeding checklist templates...");

  async function upsertTemplate(
    id: string,
    name: string,
    fileType: "LISTING" | "TRANSACTION",
    listingType: string,
    transactionSide: string,
    items: { name: string; description: string; isRequired: boolean; order: number }[]
  ) {
    await prisma.checklistTemplateItem.deleteMany({ where: { templateId: id } });
    return prisma.checklistTemplate.upsert({
      where: { id },
      update: { name, fileType, listingType, transactionSide, items: { create: items } },
      create: { id, name, fileType, listingType, transactionSide, isActive: true, items: { create: items } },
    });
  }

  const templates = await Promise.all([
    upsertTemplate("seed-res-sale-listing", "Residential Sale — Listing (Pre-Contract)", "LISTING", "RESIDENTIAL_SALE", "ALL", RESIDENTIAL_SALE_LISTING_ITEMS),
    upsertTemplate("seed-res-sale-buyer", "Residential Sale — Buyer Side", "TRANSACTION", "ALL", "PURCHASE", RESIDENTIAL_SALE_BUYER_ITEMS),
    upsertTemplate("seed-res-sale-seller", "Residential Sale — Seller Side (Under Contract)", "TRANSACTION", "ALL", "LISTING", RESIDENTIAL_SALE_SELLER_ITEMS),
    upsertTemplate("seed-res-lease-listing", "Residential Lease — Landlord Listing (Pre-Contract)", "LISTING", "RESIDENTIAL_LEASE", "ALL", RESIDENTIAL_LEASE_LISTING_ITEMS),
    upsertTemplate("seed-res-lease-tenant", "Residential Lease — Tenant Side", "TRANSACTION", "ALL", "LEASE_TENANT", RESIDENTIAL_LEASE_TENANT_ITEMS),
    upsertTemplate("seed-res-lease-landlord", "Residential Lease — Landlord Side (Transaction)", "TRANSACTION", "ALL", "LEASE_LANDLORD", RESIDENTIAL_LEASE_LANDLORD_ITEMS),
  ]);

  console.log(`Created/updated ${templates.length} checklist templates: ${templates.map((t) => t.name).join(", ")}`);
```

Note: `checklistTemplate.upsert`'s nested `items: { create: items }` inside `update` would normally *add* items rather than replace them, which is why `checklistTemplateItem.deleteMany` runs first — this makes re-running the seed idempotent (old items are wiped and replaced, not duplicated) whether the template already exists or not.

- [ ] **Step 2: Verify the file has no leftover references to the old 3-item-array names**

Run: `grep -n "RESIDENTIAL_SALE_BUYER_ITEMS\|RESIDENTIAL_SALE_SELLER_ITEMS\|RESIDENTIAL_LEASE_ITEMS\b" packages/database/prisma/seed.ts`
Expected: no matches for the old bare `RESIDENTIAL_LEASE_ITEMS` name (only the new `RESIDENTIAL_LEASE_LISTING_ITEMS` / `RESIDENTIAL_LEASE_TENANT_ITEMS` / `RESIDENTIAL_LEASE_LANDLORD_ITEMS` names should exist), and `RESIDENTIAL_SALE_BUYER_ITEMS`/`RESIDENTIAL_SALE_SELLER_ITEMS` should each appear exactly twice (const declaration + one usage).

- [ ] **Step 3: Run the seed against the live (Neon) database**

Run: `pnpm --filter @cnc/database db:seed`
Expected: prints `Created/updated 6 checklist templates: ...` listing all 6 names, no errors.

- [ ] **Step 4: Verify directly against the database — not just trusting the script's own success message**

Run a one-off read query (e.g. via a short `tsx` script or `prisma studio`) confirming:
- Exactly 6 rows in `ChecklistTemplate`
- Each of the 6 has the exact `fileType`/`listingType`/`transactionSide` combination listed in the Interfaces section above
- `seed-res-sale-listing` has 9 items, `seed-res-sale-buyer` has 9 items, `seed-res-sale-seller` has 9 items, `seed-res-lease-listing` has 3 items, `seed-res-lease-tenant` has 4 items, `seed-res-lease-landlord` has 3 items
- No leftover orphaned `ChecklistTemplateItem` rows from the old placeholder data (the `deleteMany` in Step 1 should have cleaned these up for the 3 pre-existing IDs; the 3 new IDs never had old items)

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/seed.ts docs/superpowers/plans/2026-07-14-checklist-template-correction.md
git commit -m "fix: replace placeholder checklist template seed data with verified CA compliance forms, add 3 missing templates to close auto-apply gaps"
```

---

## Post-implementation report (not a task — just what to tell Ryan when done)

State clearly in the final summary to Ryan:
1. The 3 original templates now have the correct, DRE/C.A.R.-verified form names instead of generic placeholders.
2. 3 new templates were added to close a real gap found during investigation: previously, creating a residential-sale Listing File, a tenant-side Lease Transaction, or a landlord-side Lease Transaction auto-applied **zero** checklist items — no template existed for those match points at all. Now all 6 real combinations Ryan can hit in the New Listing / New Transaction wizards have a checklist.
3. Explicitly out of scope, left as-is (no template, matches prior behavior): Commercial listings, Dual Agency transactions, Lease Dual Agency transactions, Referral transactions — flag as a possible future follow-up, not built now.
4. Separately noted, not fixed (would require touching business logic, outside this plan's scope): the admin "New Template" button in `/admin/settings/checklists` is currently broken — its POST request never sends `fileType`, which the API requires, so clicking "Create" there will fail with a 400. And `api/listings/[id]/convert/route.ts` hardcodes `transactionSide: "LISTING"` on every listing→transaction conversion, so converting a *lease* listing to a transaction would incorrectly pull the sale-side seller checklist rather than the new landlord-transaction one — narrow edge case, not touched here.
