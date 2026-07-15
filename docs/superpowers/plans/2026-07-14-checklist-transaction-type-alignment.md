# Checklist / Transaction Type Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the 6 shipped checklist templates to match the wizard's own labels, add Dual/Lease-Dual checklist content, and give Referral its own short step sequence inside the existing New Transaction wizard (not a separate flow) — per `docs/superpowers/specs/2026-07-14-checklist-transaction-type-alignment-design.md` (approved), corrected per Ryan's 2026-07-14 catch below.

**Architecture:** Referral stays on the existing `TransactionFile` model, reuses the existing checklist-matching infrastructure, and — corrected from an earlier draft of this plan — stays as one of the selectable cards on the New Transaction wizard's File Type step and submits through the existing `POST /api/transactions` route. What changes is that picking "Referral" skips Property/Offer/Parties/Commission and shows a short Referral Details step instead, then Review.

**Tech Stack:** Prisma/Postgres (Neon), Next.js API routes, React client components — all matching existing patterns in `apps/web/src`.

## Correction note (read this first)

An earlier draft of this plan removed `REFERRAL` from the wizard's `SIDES` array entirely and built a fully separate creation page + API route + "New Referral" button, reached independently of "New Transaction." **That was wrong** — it silently turned "Referral gets a short step sequence instead of the full 6 steps" (what was actually agreed) into "Referral gets its own separate entry point" (never agreed). Ryan caught this before any code was written. This version keeps Referral inside the same wizard, same button, same submit route — only the step *sequence* differs once Referral is selected.

## Global Constraints

- Do not modify the 6-step wizard's Property/Offer/Parties/Commission step content or validation for the other 6 sides — the branching added here must leave their behavior byte-for-byte identical.
- Do not modify any of the 6 existing (renamed-in-this-plan) checklist templates' *content* — only their `name` field changes.
- Do not touch `FilePartyRole.REFERRAL_AGENT` or the "Add Referral Agent" party section in `new-transaction/page.tsx` — separate, already-correct concept (crediting a referral source on an ordinary deal), out of scope.
- Do not touch `LeadSource.REFERRAL` anywhere (`DashboardTabs.tsx`, `admin/reports/page.tsx`, `api/reports/my-stats/route.ts`) — confirmed via grep to be an unrelated concept.
- Every new/changed file must keep the existing test suite green; run the full suite (`npx vitest run` from `apps/web`) after every task, not just the new tests.
- **Ambiguity flagged for confirmation during Task 6, not silently resolved:** whether marking a referral "successful" is itself the entry into Broker Review, or a separate agent-only step with no dollar figure, followed by a distinct admin action into Broker Review. This plan implements the latter (agent sets `REFERRAL_SUCCESSFUL` with no amount; admin's act of entering the amount is what moves it into `REFERRAL_BROKER_REVIEW`) — flagged once already, worth a final visual confirmation once Task 8's UI exists, since it's the one piece of the status lifecycle that was never as concretely pinned down as the rest.

---

### Task 1: Schema migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

**Interfaces:**
- Produces: `TransactionFileStatus` enum gains `REFERRAL_SUCCESSFUL`, `REFERRAL_UNSUCCESSFUL`, `REFERRAL_BROKER_REVIEW`. `TransactionFile.propertyAddress`/`city`/`zip` become nullable. `TransactionFile` gains 7 new nullable referral fields.

- [ ] **Step 1: Edit the `TransactionFileStatus` enum**

Find:
```prisma
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
```
Replace with:
```prisma
enum TransactionFileStatus {
  INCOMPLETE
  PRE_CONTRACT
  PENDING
  EXPIRED
  CLOSED
  ARCHIVED
  CANCELED_PENDING
  CANCELED_APPROVED
  REFERRAL_SUCCESSFUL
  REFERRAL_UNSUCCESSFUL
  REFERRAL_BROKER_REVIEW
}
```

- [ ] **Step 2: Edit the `TransactionFile` model**

Find:
```prisma
  propertyAddress      String
  city                 String
  state                String                @default("CA")
  zip                  String
```
Replace with:
```prisma
  propertyAddress      String?
  city                 String?
  state                String                @default("CA")
  zip                  String?
```

Then find:
```prisma
  awaitingReview       Boolean               @default(false)
  tcFeeEnabled         Boolean               @default(false)
  createdAt            DateTime              @default(now())
```
Replace with:
```prisma
  awaitingReview       Boolean               @default(false)
  tcFeeEnabled         Boolean               @default(false)
  referredToAgentName     String?
  referredToBrokerageName String?
  referredToContactEmail  String?
  referredToContactPhone  String?
  dateReferred            DateTime?
  referralAmountReceived  Float?
  referralCncFee          Float?
  createdAt            DateTime              @default(now())
```

- [ ] **Step 3: Run the migration**

Safe, purely additive + nullable-relaxing change — a normal auto-generated migration is fine (unlike the 2026-07-11 enum rename, no values are removed).

Run: `pnpm --filter @cnc/database exec prisma migrate dev --name referral_lifecycle_and_nullable_property`
Expected: migration applies cleanly, no errors.

- [ ] **Step 4: Regenerate the Prisma client**

Run: `pnpm --filter @cnc/database exec prisma generate`
(If EPERM/DLL lock error: stop the dev server first, retry.)

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat: add referral status values, nullable property fields, referral fields to TransactionFile"
```

---

### Task 2: Checklist template renames + 3 new templates

**Files:**
- Modify: `packages/database/prisma/seed.ts`

**Interfaces:**
- Produces: 9 total `ChecklistTemplate` rows after running (6 renamed + 3 new)

- [ ] **Step 1: Rename the 6 existing templates**

Within the `Promise.all([...])` block in `main()`, change these `name` arguments:

```ts
upsertTemplate("seed-res-sale-listing", "Residential Sale — Listing Forms (Pre-Contract)", "LISTING", "RESIDENTIAL_SALE", "ALL", RESIDENTIAL_SALE_LISTING_ITEMS),
upsertTemplate("seed-res-sale-buyer", "Purchase Forms", "TRANSACTION", "ALL", "PURCHASE", RESIDENTIAL_SALE_BUYER_ITEMS),
upsertTemplate("seed-res-sale-seller", "Listing Forms", "TRANSACTION", "ALL", "LISTING", RESIDENTIAL_SALE_SELLER_ITEMS),
upsertTemplate("seed-res-lease", "Residential Lease — Landlord Listing Forms (Pre-Contract)", "LISTING", "RESIDENTIAL_LEASE", "ALL", RESIDENTIAL_LEASE_LISTING_ITEMS),
upsertTemplate("seed-res-lease-tenant", "Lease Tenant Forms", "TRANSACTION", "ALL", "LEASE_TENANT", RESIDENTIAL_LEASE_TENANT_ITEMS),
upsertTemplate("seed-res-lease-landlord", "Lease Landlord Forms", "TRANSACTION", "ALL", "LEASE_LANDLORD", RESIDENTIAL_LEASE_LANDLORD_ITEMS),
```

- [ ] **Step 2: Add the 3 new item-array constants**

```typescript
const DUAL_AGENCY_ITEMS = [
  { name: "RPA-CA — Purchase Agreement", description: "The purchase contract", isRequired: true, order: 1 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Civil Code §2079.13-2079.24", isRequired: true, order: 2 },
  { name: "AVID — Agent Visual Inspection Disclosure", description: "Agent's own visual inspection disclosure", isRequired: true, order: 3 },
  { name: "SBSA — Statewide Buyer and Seller Advisory", description: "C.A.R. consolidated general-disclosure advisory", isRequired: true, order: 4 },
  { name: "TDS — Real Estate Transfer Disclosure Statement", description: "Civil Code §1102", isRequired: true, order: 5 },
  { name: "NHD — Natural Hazard Disclosure Report", description: "Govt. Code §8589.3", isRequired: true, order: 6 },
  { name: "BRBC — Buyer Representation and Broker Compensation Agreement", description: "Required before touring homes per the Aug. 2024 NAR settlement", isRequired: true, order: 7 },
  { name: "FIRPTA / CA Withholding Affidavit", description: "Foreign Investment in Real Property Tax Act + CA state withholding certification", isRequired: true, order: 8 },
  { name: "Proof of Funds / Loan Pre-Approval Letter", description: "Lender pre-approval or proof of funds dated within 30 days", isRequired: true, order: 9 },
  { name: "SPQ — Seller Property Questionnaire", description: "C.A.R. supplemental seller questionnaire", isRequired: true, order: 10 },
  { name: "DBD — Megan's Law Database Disclosure", description: "Civil Code §2079.10a", isRequired: true, order: 11 },
  { name: "WHSD — Water Heater & Smoke Detector Statement of Compliance", description: "Health & Safety Code compliance statement", isRequired: true, order: 12 },
  { name: "HOA Governing Documents", description: "Required only if the property is part of a common interest development (HOA)", isRequired: false, order: 13 },
];

const LEASE_DUAL_AGENCY_ITEMS = [
  { name: "RLMM — Residential Lease or Month-to-Month Rental Agreement", description: "The lease contract", isRequired: true, order: 1 },
  { name: "AD — Disclosure Regarding Real Estate Agency Relationships", description: "Required for leases over 1 year; standard practice regardless", isRequired: true, order: 2 },
  { name: "LPD — Lead-Based Paint and Lead-Based Paint Hazards Disclosure", description: "Federal law, required only for housing built before 1978", isRequired: false, order: 3 },
  { name: "MII — Move-In Inspection", description: "Signed condition checklist at move-in", isRequired: true, order: 4 },
];

const REFERRAL_ITEMS = [
  { name: "RFA — Referral Fee Agreement", description: "Signed agreement between the CnC agent and the referred-to agent/brokerage", isRequired: false, order: 1 },
];
```

- [ ] **Step 3: Add the 3 new `upsertTemplate()` calls**

```ts
upsertTemplate("seed-dual-agency", "Dual Agency Forms", "TRANSACTION", "ALL", "DUAL", DUAL_AGENCY_ITEMS),
upsertTemplate("seed-lease-dual-agency", "Lease Dual Agency Forms", "TRANSACTION", "ALL", "LEASE_DUAL", LEASE_DUAL_AGENCY_ITEMS),
upsertTemplate("seed-referral", "Referral Forms", "TRANSACTION", "ALL", "REFERRAL", REFERRAL_ITEMS),
```

- [ ] **Step 4: Run the seed against the live DB**

Run: `pnpm --filter @cnc/database db:seed`
Expected: prints `Created/updated 9 checklist templates: ...`, no errors.

- [ ] **Step 5: Verify directly against the database**

Confirm 9 total `ChecklistTemplate` rows; `seed-dual-agency` has 13 items; `seed-lease-dual-agency` has 4 items identical to `seed-res-lease-tenant`'s; `seed-referral` has 1 item.

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/seed.ts
git commit -m "feat: rename checklist templates to match wizard labels, add Dual/Lease Dual/Referral templates"
```

---

### Task 3: `types/transaction.ts` — new statuses and referral fields

**Files:**
- Modify: `apps/web/src/types/transaction.ts`

**Interfaces:**
- Produces: `TransactionFileStatus` type gains the 3 new values; `TransactionFileDetail` gains the 7 new referral fields. `TransactionSide` and `ROLE_LABELS` are **unchanged** — `REFERRAL` stays exactly where it already is.

- [ ] **Step 1: Add the 3 new statuses**

Find:
```ts
export type TransactionFileStatus =
  | "INCOMPLETE" | "PRE_CONTRACT" | "PENDING" | "EXPIRED"
  | "CLOSED" | "ARCHIVED" | "CANCELED_PENDING" | "CANCELED_APPROVED";
```
Replace with:
```ts
export type TransactionFileStatus =
  | "INCOMPLETE" | "PRE_CONTRACT" | "PENDING" | "EXPIRED"
  | "CLOSED" | "ARCHIVED" | "CANCELED_PENDING" | "CANCELED_APPROVED"
  | "REFERRAL_SUCCESSFUL" | "REFERRAL_UNSUCCESSFUL" | "REFERRAL_BROKER_REVIEW";
```

- [ ] **Step 2: Add the 7 new fields to `TransactionFileDetail`**

Find (inside the `TransactionFileDetail` interface):
```ts
  tcFeeEnabled: boolean;
  awaitingReview: boolean;
```
Replace with:
```ts
  tcFeeEnabled: boolean;
  referredToAgentName: string | null;
  referredToBrokerageName: string | null;
  referredToContactEmail: string | null;
  referredToContactPhone: string | null;
  dateReferred: string | null;
  referralAmountReceived: number | null;
  referralCncFee: number | null;
  awaitingReview: boolean;
```

Also update `propertyAddress`/`city`/`zip` in this same interface to allow `null` (matching Task 1's schema change):
```ts
  propertyAddress: string | null;
  city: string | null;
  zip: string | null;
```

- [ ] **Step 3: Run the existing test, confirm it still passes unchanged**

Run: `npx vitest run src/__tests__/lib/transaction-sides.test.ts` (from `apps/web`)
Expected: all passed, with **no edits needed to this test file** — it already asserts `SIDES` has 7 values including `REFERRAL`, which remains true.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/types/transaction.ts
git commit -m "feat: add referral statuses and fields to TransactionFileDetail type"
```

---

### Task 4: Referral status transitions + fee calculation helper

**Files:**
- Modify: `apps/web/src/lib/transaction-helpers.ts`
- Test: `apps/web/src/__tests__/lib/transaction-helpers.test.ts` (create if it doesn't already exist)

**Interfaces:**
- Produces: `calcReferralFee(amount: number): { cncFee: number; agentNet: number }`, and 3 new statuses wired into `AGENT_TX_TRANSITIONS`/`ADMIN_TX_TRANSITIONS`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { calcReferralFee, canTransitionTransaction } from "@/lib/transaction-helpers";

describe("calcReferralFee", () => {
  it("takes 10% when 10% of the amount exceeds $200", () => {
    expect(calcReferralFee(5000)).toEqual({ cncFee: 500, agentNet: 4500 });
  });

  it("takes the $200 floor when 10% of the amount is under $200", () => {
    expect(calcReferralFee(1000)).toEqual({ cncFee: 200, agentNet: 800 });
  });

  it("takes exactly $200 at the breakeven point", () => {
    expect(calcReferralFee(2000)).toEqual({ cncFee: 200, agentNet: 1800 });
  });
});

describe("referral status transitions", () => {
  it("agent can move PENDING to REFERRAL_SUCCESSFUL", () => {
    expect(canTransitionTransaction("PENDING", "REFERRAL_SUCCESSFUL", "AGENT")).toBe(true);
  });

  it("agent can move PENDING to REFERRAL_UNSUCCESSFUL", () => {
    expect(canTransitionTransaction("PENDING", "REFERRAL_UNSUCCESSFUL", "AGENT")).toBe(true);
  });

  it("agent cannot move REFERRAL_SUCCESSFUL to REFERRAL_BROKER_REVIEW", () => {
    expect(canTransitionTransaction("REFERRAL_SUCCESSFUL", "REFERRAL_BROKER_REVIEW", "AGENT")).toBe(false);
  });

  it("admin can move REFERRAL_SUCCESSFUL to REFERRAL_BROKER_REVIEW", () => {
    expect(canTransitionTransaction("REFERRAL_SUCCESSFUL", "REFERRAL_BROKER_REVIEW", "ADMIN")).toBe(true);
  });

  it("admin can close from REFERRAL_BROKER_REVIEW", () => {
    expect(canTransitionTransaction("REFERRAL_BROKER_REVIEW", "CLOSED", "ADMIN")).toBe(true);
  });

  it("admin can close directly from REFERRAL_UNSUCCESSFUL", () => {
    expect(canTransitionTransaction("REFERRAL_UNSUCCESSFUL", "CLOSED", "ADMIN")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/transaction-helpers.test.ts` (from `apps/web`)
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
const AGENT_TX_TRANSITIONS: Record<TransactionFileStatus, TransactionFileStatus[]> = {
  INCOMPLETE:              ["PRE_CONTRACT", "PENDING"],
  PRE_CONTRACT:            ["PENDING", "CANCELED_PENDING"],
  PENDING:                 ["CANCELED_PENDING", "REFERRAL_SUCCESSFUL", "REFERRAL_UNSUCCESSFUL"],
  EXPIRED:                 [],
  CLOSED:                  [],
  ARCHIVED:                [],
  CANCELED_PENDING:        [],
  CANCELED_APPROVED:       [],
  REFERRAL_SUCCESSFUL:     [],
  REFERRAL_UNSUCCESSFUL:   [],
  REFERRAL_BROKER_REVIEW:  [],
};

const ADMIN_TX_TRANSITIONS: Record<TransactionFileStatus, TransactionFileStatus[]> = {
  INCOMPLETE:              ["PRE_CONTRACT", "PENDING", "CANCELED_APPROVED"],
  PRE_CONTRACT:            ["PENDING", "CANCELED_PENDING", "CANCELED_APPROVED"],
  PENDING:                 ["CLOSED", "EXPIRED", "CANCELED_PENDING", "CANCELED_APPROVED"],
  EXPIRED:                 ["PENDING", "CLOSED", "CANCELED_APPROVED"],
  CLOSED:                  ["ARCHIVED"],
  ARCHIVED:                [],
  CANCELED_PENDING:        ["PENDING", "CANCELED_APPROVED"],
  CANCELED_APPROVED:       [],
  REFERRAL_SUCCESSFUL:     ["REFERRAL_BROKER_REVIEW"],
  REFERRAL_UNSUCCESSFUL:   ["CLOSED"],
  REFERRAL_BROKER_REVIEW:  ["CLOSED"],
};
```

Then add, near the bottom of the file:
```typescript
export function calcReferralFee(amountReceived: number): { cncFee: number; agentNet: number } {
  const cncFee = Math.max(amountReceived * 0.10, 200);
  return { cncFee, agentNet: amountReceived - cncFee };
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/__tests__/lib/transaction-helpers.test.ts` (from `apps/web`)

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run` (from `apps/web`)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/transaction-helpers.ts apps/web/src/__tests__/lib/transaction-helpers.test.ts
git commit -m "feat: referral status transitions and fee calculation helper"
```

---

### Task 5: `POST /api/transactions` — conditional property validation for Referral

**Files:**
- Modify: `apps/web/src/app/api/transactions/route.ts`
- Modify: `apps/web/src/__tests__/api/transactions.test.ts`

**Interfaces:**
- Produces: the existing route now accepts `transactionSide: "REFERRAL"` with no `propertyAddress`/`city`/`zip`, and persists the 5 referral input fields.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/__tests__/api/transactions.test.ts` (follow this file's existing mock setup — it already mocks `prisma.transactionFile.create`):

```typescript
  it("creates a REFERRAL transaction with no property fields required", async () => {
    let capturedArgs: any;
    vi.mocked(prisma.transactionFile.create).mockImplementation((async (args: any) => {
      capturedArgs = args;
      return { id: "tf-referral" };
    }) as any);

    const res = await POST(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        transactionSide: "REFERRAL",
        referredToAgentName: "Jane Outbound",
        referredToBrokerageName: "Other Realty",
        referredToContactEmail: "jane@otherrealty.com",
        referredToContactPhone: "555-1234",
        dateReferred: "2026-07-14",
      }),
    }));

    expect(res.status).toBe(201);
    expect(capturedArgs.data.propertyAddress).toBeNull();
    expect(capturedArgs.data.referredToAgentName).toBe("Jane Outbound");
    expect(capturedArgs.data.referredToBrokerageName).toBe("Other Realty");
    expect(capturedArgs.data.status).toBe("PENDING");
  });

  it("still requires propertyAddress/city/zip for non-REFERRAL sides", async () => {
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ transactionSide: "PURCHASE" }),
    }));
    expect(res.status).toBe(400);
  });
```

(Check the top of the existing test file for the exact `SESSION_AGENT` mock and `getServerSession` setup already used by its other tests, and reuse that same setup rather than inventing a new one.)

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/api/transactions.test.ts` (from `apps/web`)
Expected: FAIL — the route currently 400s on missing `propertyAddress` regardless of side, and doesn't know about the referral fields.

- [ ] **Step 3: Implement**

In `apps/web/src/app/api/transactions/route.ts`, add the 5 new fields to the destructured `body`:
```typescript
  const {
    propertyAddress, city, state, zip,
    mlsNumber, propertyType, yearBuilt, escrowNumber,
    legalDescription, propertyIncludes, propertyExcludes,
    taxId, annualTaxes, schoolDistrict, zoningClass, photoKey,
    transactionSide, stage,
    listPrice, salePrice, leasePrice,
    deposit,
    offerDate, offerExpirationDate, acceptanceDate,
    inspectionDeadline, appraisalDeadline, loanApprovalDeadline,
    finalWalkthroughDate, possessionDate, closeOfEscrow,
    commissionGCI, saleCommissionPct, listingCommissionPct, otherDeductions,
    commissionSplit, commissionNotes,
    tcFeeEnabled = false,
    originatingLeadId,
    parties = [],
    referredToAgentName, referredToBrokerageName,
    referredToContactEmail, referredToContactPhone, dateReferred,
  } = body;
```

Change the required-fields check:
```typescript
  if (!propertyAddress || !city || !zip || !transactionSide) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
```
to:
```typescript
  if (!transactionSide) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (transactionSide !== "REFERRAL" && (!propertyAddress || !city || !zip)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (transactionSide === "REFERRAL" && !referredToAgentName) {
    return NextResponse.json({ error: "referredToAgentName is required" }, { status: 400 });
  }
```

And add to the `prisma.transactionFile.create({ data: { ... } })` call, alongside the existing `propertyAddress, city, state: state ?? "CA", zip,` line:
```typescript
        propertyAddress: propertyAddress || null,
        city: city || null,
        state: state ?? "CA",
        zip: zip || null,
```
(replacing the old non-nullable `propertyAddress, city, ... zip,` shorthand), and add the 5 referral fields alongside the existing `tcFeeEnabled: !!tcFeeEnabled,` line:
```typescript
        tcFeeEnabled: !!tcFeeEnabled,
        referredToAgentName: referredToAgentName || null,
        referredToBrokerageName: referredToBrokerageName || null,
        referredToContactEmail: referredToContactEmail || null,
        referredToContactPhone: referredToContactPhone || null,
        dateReferred: dateReferred ? new Date(dateReferred) : null,
```

Also change `initialStatus` so Referral always starts at `PENDING` regardless of the `stage` field (which doesn't apply to Referral):
```typescript
  const initialStatus = transactionSide === "REFERRAL" ? "PENDING" : (stage === "PRE_CONTRACT" ? "PRE_CONTRACT" : "INCOMPLETE");
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/__tests__/api/transactions.test.ts` (from `apps/web`)

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run` (from `apps/web`) — confirm the other 6 sides' creation behavior is unchanged.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/transactions/route.ts apps/web/src/__tests__/api/transactions.test.ts
git commit -m "feat: accept REFERRAL transactions with no property fields in POST /api/transactions"
```

---

### Task 6: Referral status-transition handling (amount entry + fee calc)

**Files:**
- Modify: `apps/web/src/app/api/transactions/[id]/route.ts`
- Test: `apps/web/src/__tests__/api/transactions-id.test.ts` (create if none exists for this route — check first)

**Interfaces:**
- Consumes: `calcReferralFee` from Task 4
- Produces: `PATCH /api/transactions/[id]` now also accepts `{ status: "REFERRAL_BROKER_REVIEW", referralAmountReceived: number }` and computes/stores `referralCncFee` server-side (never trusts a client-supplied fee value)

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    transactionFile: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
    agent: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/email/transaction-emails", () => ({ sendFileClosed: vi.fn() }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PATCH } from "../../app/api/transactions/[id]/route";

const ADMIN_SESSION = { user: { id: "admin1", role: "ADMIN", agentId: null } };
const REFERRAL_TX = { id: "tf1", agentId: "a1", transactionSide: "REFERRAL", status: "REFERRAL_SUCCESSFUL", propertyAddress: null };

describe("PATCH /api/transactions/[id] — referral amount entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  });

  it("computes and stores referralCncFee server-side when entering REFERRAL_BROKER_REVIEW", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(REFERRAL_TX as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ ...REFERRAL_TX, status: "REFERRAL_BROKER_REVIEW" } as any);

    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ status: "REFERRAL_BROKER_REVIEW", referralAmountReceived: 5000 }),
      }),
      { params: { id: "tf1" } }
    );

    expect(res.status).toBe(200);
    expect(prisma.transactionFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REFERRAL_BROKER_REVIEW",
          referralAmountReceived: 5000,
          referralCncFee: 500,
        }),
      })
    );
  });

  it("ignores a client-supplied referralCncFee and always recomputes it", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(REFERRAL_TX as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({} as any);

    await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ status: "REFERRAL_BROKER_REVIEW", referralAmountReceived: 1000, referralCncFee: 1 }),
      }),
      { params: { id: "tf1" } }
    );

    expect(prisma.transactionFile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ referralCncFee: 200 }) })
    );
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/api/transactions-id.test.ts` (from `apps/web`)
Expected: FAIL.

- [ ] **Step 3: Implement**

Change:
```typescript
import { canTransitionTransaction, FILE_DETAIL_INCLUDE } from "@/lib/transaction-helpers";
```
to:
```typescript
import { canTransitionTransaction, calcReferralFee, FILE_DETAIL_INCLUDE } from "@/lib/transaction-helpers";
```

Inside `PATCH`, right before the `prisma.transactionFile.update({...})` call:
```typescript
  const referralFeeUpdate =
    body.status === "REFERRAL_BROKER_REVIEW" && body.referralAmountReceived !== undefined
      ? calcReferralFee(parseFloat(body.referralAmountReceived))
      : null;
```

Add to the `update`'s `data` object, alongside the existing `...(body.status !== undefined && { status: body.status })` line:
```typescript
      ...(body.referralAmountReceived !== undefined && { referralAmountReceived: parseFloat(body.referralAmountReceived) }),
      ...(referralFeeUpdate && { referralCncFee: referralFeeUpdate.cncFee }),
      ...(body.status !== undefined && { status: body.status }),
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/__tests__/api/transactions-id.test.ts` (from `apps/web`)

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run` (from `apps/web`)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/transactions/\[id\]/route.ts apps/web/src/__tests__/api/transactions-id.test.ts
git commit -m "feat: server-computed referral fee on status transition to REFERRAL_BROKER_REVIEW"
```

---

### Task 7: New Transaction wizard — Referral branch (no separate page)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx` (871 lines — read the file fully before editing; this task changes step-navigation logic that today assumes a flat sequential `step + 1` / `step - 1`, so precision matters more here than in most tasks)

**Interfaces:**
- Consumes: `SIDES` (unchanged, still has all 7 entries including `REFERRAL`)
- Produces: selecting "Referral" on the File Type step shows a 3-step sequence (File Type → Referral Details → Review) instead of the full 6; every other side's step sequence is completely unaffected.

- [ ] **Step 1: Add an `isReferral` flag, alongside the existing `isLeaseSide` flag**

Find:
```ts
  const isLeaseSide = ["LEASE_TENANT", "LEASE_LANDLORD", "LEASE_DUAL"].includes(form.transactionSide);
```
Add directly after it:
```ts
  const isReferral = form.transactionSide === "REFERRAL";
```

- [ ] **Step 2: Add the 5 referral fields to `form` state**

In the `useState({...})` call initializing `form` (around line 48), add:
```ts
    referredToAgentName: "",
    referredToBrokerageName: "",
    referredToContactEmail: "",
    referredToContactPhone: "",
    dateReferred: "",
```

- [ ] **Step 3: Make `STEPS` computed instead of a module-level constant**

`STEPS` is currently declared at module scope (line 11: `const STEPS = ["File Type", "Property", "Details", "Parties", "Commission", "Review"] as const;`). Since the label list now depends on `form.transactionSide`, it must move inside the component. Delete the module-level `const STEPS = [...]` line entirely, and add this inside the component body (near where `isReferral` was added in Step 1):

```ts
  const STEPS = isReferral
    ? ["File Type", "Referral Details", "Review"]
    : ["File Type", "Property", "Details", "Parties", "Commission", "Review"];
```

Wherever `STEPS` is used for the step-bar UI (`STEPS.map(...)` or similar — locate via a search for `STEPS` in the file), no change needed there; it now just reads a variable instead of a constant and will correctly re-render with 3 entries when Referral is selected.

- [ ] **Step 4: Add skip-aware step navigation**

The Back/Next buttons currently call `setStep((s) => s - 1)` / `setStep((s) => s + 1)` directly. Replace both with skip-aware versions. Add these two functions near `canAdvance`:

```ts
  function goNext() {
    setStep((s) => {
      if (isReferral && s === 0) return 1; // File Type -> Referral Details
      if (isReferral && s === 1) return 5; // Referral Details -> Review (reuses index 5's existing Review render)
      return s + 1;
    });
  }
  function goBack() {
    setStep((s) => {
      if (isReferral && s === 5) return 1;
      if (isReferral && s === 1) return 0;
      return s - 1;
    });
  }
```

Then change the Back button's `onClick={() => setStep((s) => s - 1)}` to `onClick={goBack}`, and the Next button's `onClick={() => setStep((s) => s + 1)}` to `onClick={goNext}`.

**Design note on why index 1 is reused rather than adding a new index:** the existing step-body rendering is a flat sequence of `{step === 1 && (...)}`, `{step === 2 && (...)}` blocks. Reusing index 1 for "Referral Details" (instead of introducing a new index and renumbering everything after it) means only the index-1 block needs a conditional branch, and indices 2/3/4 (Property's continuation, Parties, Commission) are simply never reached when `isReferral` — no renumbering of the Review block (index 5) or its own internal references to `step === 5` required.

- [ ] **Step 5: Branch the index-1 step body**

Find the existing `{step === 1 && ( ... Property step content ... )}` block. Wrap its content so Referral renders different content at the same index:

```tsx
        {step === 1 && (
          isReferral ? (
            <div className="space-y-5">
              <Field label="Referred-To Agent Name *" value={form.referredToAgentName} onChange={(v) => set("referredToAgentName", v)} />
              <Field label="Referred-To Brokerage Name" value={form.referredToBrokerageName} onChange={(v) => set("referredToBrokerageName", v)} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Contact Email" type="email" value={form.referredToContactEmail} onChange={(v) => set("referredToContactEmail", v)} />
                <Field label="Contact Phone" type="tel" value={form.referredToContactPhone} onChange={(v) => set("referredToContactPhone", v)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Date Referred</label>
                <DateField value={form.dateReferred} onChange={(v) => set("dateReferred", v)} />
              </div>
            </div>
          ) : (
            /* ...existing Property step JSX, unchanged... */
          )
        )}
```

Use whatever `<Field>`-equivalent input component this file already uses elsewhere in its Property/Details steps (check the existing Property step JSX for the exact component name/props before writing this — do not assume it matches `ApplicationForm.tsx`'s `<Field>` verbatim, this file may have its own). Confirm the `<DateField>` import path and prop signature against an existing usage in this same file if one already exists, or against `ApplicationForm.tsx` if not.

- [ ] **Step 6: Update `canAdvance` validation for index 1**

Find:
```ts
    if (step === 1) return !!form.propertyAddress && !!form.city && !!form.zip;
```
Replace with:
```ts
    if (step === 1) return isReferral ? !!form.referredToAgentName : (!!form.propertyAddress && !!form.city && !!form.zip);
```

- [ ] **Step 7: Update the Review step (index 5) to show a referral summary**

Find the `{step === 5 && ( ... )}` block. Add a conditional at its top so Referral shows its own summary instead of the property/offer/commission review sections:

```tsx
        {step === 5 && (
          isReferral ? (
            <div className="space-y-3">
              <ReviewRow label="Referred-To Agent" value={form.referredToAgentName} />
              <ReviewRow label="Referred-To Brokerage" value={form.referredToBrokerageName || "—"} />
              <ReviewRow label="Contact" value={form.referredToContactEmail || form.referredToContactPhone || "—"} />
              <ReviewRow label="Date Referred" value={form.dateReferred || "—"} />
            </div>
          ) : (
            /* ...existing Review JSX, unchanged... */
          )
        )}
```

(`ReviewRow` — confirm it's already a component in this file, used by the existing Review step; reuse it rather than inventing a new summary-row component.)

- [ ] **Step 8: Update the submit handler**

Find the `submit()` function's `fetch("/api/transactions", { ... body: JSON.stringify({...}) })` call. The request body is already built as a plain object matching `form`'s fields plus some computed ones — the 5 new referral fields (`referredToAgentName` etc.) are already present on `form` as of Step 2, so if the body is built via object-spread of relevant `form` fields, they'll already be included automatically. Confirm this is the case by reading the exact body-construction code; if it explicitly lists each field rather than spreading, add the 5 new fields to that explicit list.

- [ ] **Step 9: Manual verification**

Run `pnpm --filter web dev`, navigate to `/dashboard/transactions/new-transaction`, select "Referral" on the File Type step, confirm the step bar shows only 3 steps, confirm Property/Parties/Commission never appear, fill Referral Details, confirm Review shows the referral summary, submit, confirm it creates a `TransactionFile` with `transactionSide: "REFERRAL"` and no property address. **Then repeat for at least 2 of the other 6 sides (e.g. Purchase and Lease Tenant) to confirm their step sequences are completely unaffected** — this is the step most likely to have an off-by-one regression given the index-reuse approach.

- [ ] **Step 10: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx"
git commit -m "feat: Referral gets a short 3-step sequence inside the existing New Transaction wizard"
```

---

### Task 8: File detail page — Referral rendering

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx` (680 lines — read the file first to find the right insertion points; exact placement within the Overview tab is an implementation-time call, following this file's existing side-conditional patterns)

**Interfaces:**
- Consumes: `transaction.transactionSide === "REFERRAL"` as the branch condition; `calcReferralFee` is NOT called client-side (the server already computed and stored `referralCncFee` in Task 6) — just display the stored values.

- [ ] **Step 1: Add a Referral-specific summary block**

When `transaction.transactionSide === "REFERRAL"`, render a summary section in place of the Property/Offer/Commission sections (which don't apply), showing: Referred-To Agent, Referred-To Brokerage, Contact Email/Phone, Date Referred, and — only once `referralAmountReceived` is non-null — Referral Amount Received, CnC Fee, and Agent Net (`referralAmountReceived - referralCncFee`).

- [ ] **Step 2: Add the 3 referral status action buttons**

Conditionally render (matching whatever existing pattern this file uses for its other status-change buttons):
- When `status === "PENDING"` and viewer is the file's agent: **"Referral Successful"** and **"Referral Unsuccessful"** buttons → `PATCH` with the corresponding status.
- When `status === "REFERRAL_SUCCESSFUL"` and viewer is ADMIN: a small form (amount input + submit) → `PATCH` with `{ status: "REFERRAL_BROKER_REVIEW", referralAmountReceived }`.
- When `status === "REFERRAL_BROKER_REVIEW"` or `"REFERRAL_UNSUCCESSFUL"` and viewer is ADMIN: **"Mark Closed"** button → `PATCH` with `{ status: "CLOSED" }`.

- [ ] **Step 3: Manual verification**

Run `pnpm --filter web dev`, open the referral file created in Task 7's manual test, walk it through all 5 statuses as both an agent and admin account, confirm the amount/fee display correctly once entered. This is also the point to double-check the Global Constraints' flagged ambiguity (does "Referral Successful" clicked by the agent look right as its own waiting state before you enter a number, or does it feel like it should jump straight to an amount-entry form) — flag back if this doesn't feel right in practice.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx"
git commit -m "feat: referral-specific summary and status actions on file detail page"
```

---

### Task 9: FileCard and StatusBadge — null-safe referral display

**Files:**
- Modify: `apps/web/src/components/transactions/FileCard.tsx`
- Modify: `apps/web/src/components/transactions/StatusBadge.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/page.tsx`

**Interfaces:**
- No new interfaces — display polish so Referral rows in the existing Transactions list don't show blank/`null` where an address would normally be. **No new button** — Referral is created via the existing "New Transaction" button, per the Task 7 correction.

- [ ] **Step 1: `StatusBadge.tsx` — add the 3 new statuses**

Add to `COLORS`:
```typescript
  REFERRAL_SUCCESSFUL:    "bg-blue-100 text-blue-700",
  REFERRAL_UNSUCCESSFUL:  "bg-red-100 text-red-600",
  REFERRAL_BROKER_REVIEW: "bg-orange-100 text-orange-700",
```
Add to `LABELS`:
```typescript
  REFERRAL_SUCCESSFUL:    "Referral Successful",
  REFERRAL_UNSUCCESSFUL:  "Referral Unsuccessful",
  REFERRAL_BROKER_REVIEW: "Broker Review",
```

- [ ] **Step 2: `FileCard.tsx` — null-safe address fallback**

Change the `Props` interface's `address`/`city` to accept `null`, and add a `referredToAgentName?: string | null` prop. Replace:
```tsx
        <div>
          <p className="font-medium text-[#1B1B1B] line-clamp-1">{address}</p>
          <p className="text-sm text-[#1B1B1B]/50">{city}, CA</p>
        </div>
```
with:
```tsx
        <div>
          {address ? (
            <>
              <p className="font-medium text-[#1B1B1B] line-clamp-1">{address}</p>
              <p className="text-sm text-[#1B1B1B]/50">{city}, CA</p>
            </>
          ) : (
            <>
              <p className="font-medium text-[#1B1B1B] line-clamp-1">Referral — {referredToAgentName ?? "Unnamed"}</p>
              <p className="text-sm text-[#1B1B1B]/50">Outbound referral</p>
            </>
          )}
        </div>
```

- [ ] **Step 3: `transactions/page.tsx` — pass the new prop**

In the `FileCard` mapping, add `referredToAgentName={item.referredToAgentName}`. No other changes to this file — the existing "New Transaction" button already covers Referral creation.

- [ ] **Step 4: Manual verification**

Confirm the Referral file created in Task 7 shows up correctly on the Transactions list (not as "null, CA").

- [ ] **Step 5: Run the full suite one final time**

Run: `npx vitest run` (from `apps/web`)
Expected: all passing, no regressions across the whole plan.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/transactions/FileCard.tsx apps/web/src/components/transactions/StatusBadge.tsx "apps/web/src/app/(dashboard)/dashboard/transactions/page.tsx"
git commit -m "feat: referral-aware FileCard/StatusBadge display"
```
