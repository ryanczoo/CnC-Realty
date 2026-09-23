# Walkthrough fixes D (commission redesign) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Commission Breakdown" table — in the New Transaction wizard's Commission step, its Review step, and the file-detail Commission tab — compute CnC's real, finalized ICA fee schedule instead of just commission-%-of-sale-price minus a free-text deduction.

**Architecture:** One new pure fee-calculation engine in `lib/commission.ts` (no DB, no network — a plain function), fed by 3 new `TransactionFile` fields (1 renamed from `annualTaxes`, 2 new booleans), consumed by the same 3 UI surfaces the spec identified. No new routes, no new pages.

**Tech Stack:** Next.js 14 App Router, Prisma 5 + Neon Postgres, Vitest 4 (node env), TypeScript, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-22-walkthrough-fixes-d-design.md` — read it too; this plan argues from it.

## Global Constraints

- Schema migration (Task 1) is **controller-run, not delegated** — Prisma's `generate` step can EPERM-lock against a running dev server on this machine (documented project-wide gotcha), and only the controller has standing permission to touch the dev server, with Ryan's explicit OK each time.
- `lib/commission.ts` is a plain, pure-function module — TDD required (RED, then GREEN) per the project's standing TDD discipline.
- `calcNetToAgent`'s signature changes (`grossCommission, transactionFee, otherDeductions, tcFeeEnabled`, `transactionFee` inserted as the 2nd parameter). Both call sites (the wizard, the file-detail tab) get updated in the same session `calcNetToAgent`'s new signature lands in — never leave one call site on the old 3-arg shape.
- Tasks 3 and 4 both touch `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx` and `apps/web/src/app/api/transactions/route.ts`, in disjoint line ranges, sequentially. Task 4's implementer must re-grep current line numbers before editing rather than trust this plan's line numbers verbatim — Task 3's edits shift them slightly.
- No task touches `ListingFile`, the closed-file lock (sub-project B), or the outbound-Referral fee path (`calcReferralFee` in `lib/transaction-helpers.ts`) — all explicitly out of scope per the spec.
- Implementers never run `next build` or touch the dev server.

---

### Task 1: Schema migration (controller-run, not delegated)

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (the `TransactionFile` model, around line 517-519 and 539)

**Interfaces:**
- Produces: `TransactionFile.numberOfParcels: number | null`, `TransactionFile.agentRelativeSale: boolean`, `TransactionFile.brokerProvidedLead: boolean` — Tasks 2-5 all consume these names exactly.

- [ ] **Step 1: Rename `annualTaxes` to `numberOfParcels`**

```prisma
  taxId                String?
  numberOfParcels      Int?
  schoolDistrict       String?
```

(was `annualTaxes          Float?`)

- [ ] **Step 2: Add the two new toggle fields, right after `tcFeeEnabled`**

```prisma
  tcFeeEnabled         Boolean               @default(false)
  agentRelativeSale    Boolean               @default(false)
  brokerProvidedLead   Boolean               @default(false)
```

- [ ] **Step 3: Confirm nothing else reads `annualTaxes`**

```bash
grep -rn "annualTaxes" apps/web/src packages/database/prisma
```

Expected: no matches (the rename in Steps 4-5 below is the only place it currently appears; those files are covered by Tasks 3 and 5, not this task).

- [ ] **Step 4: Run the migration**

Stop the dev server first if it's running (ask Ryan, per standing project practice), then:

```bash
pnpm --filter @cnc/database exec prisma migrate dev --name rename_annual_taxes_add_commission_toggles
```

- [ ] **Step 5: Confirm the client regenerated cleanly**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no new errors (existing `annualTaxes` references elsewhere will now fail to compile — that's expected and is what Tasks 3 and 5 fix).

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat: schema for commission redesign — numberOfParcels, agentRelativeSale, brokerProvidedLead"
```

---

### Task 2: `lib/commission.ts` fee engine

**Files:**
- Modify: `apps/web/src/lib/commission.ts`
- Modify: `apps/web/src/__tests__/lib/commission.test.ts`

**Interfaces:**
- Consumes: nothing (pure function module, no imports from app code).
- Produces: `calcEoSupplement(salePrice: number): number`, `calcTransactionFee(input: TransactionFeeInput): TransactionFeeResult`, `calcNetToAgent(grossCommission, transactionFee, otherDeductions, tcFeeEnabled): number` — Task 4 (wizard) and Task 5 (file-detail tab) both import and call all three by these exact names/signatures.

- [ ] **Step 1: Write the failing tests**

Replace `apps/web/src/__tests__/lib/commission.test.ts` entirely with:

```typescript
import { TC_FEE, calcEoSupplement, calcTransactionFee, calcNetToAgent } from "@/lib/commission";

describe("calcEoSupplement", () => {
  it("is 0 at or under the $1M threshold", () => {
    expect(calcEoSupplement(1_000_000)).toBe(0);
    expect(calcEoSupplement(500_000)).toBe(0);
  });

  it("is $400 for the first increment over $1M", () => {
    expect(calcEoSupplement(1_100_000)).toBe(400);
    expect(calcEoSupplement(1_500_000)).toBe(400);
  });

  it("is $800 in the $1.5M-$2M tier", () => {
    expect(calcEoSupplement(1_500_001)).toBe(800);
    expect(calcEoSupplement(2_000_000)).toBe(800);
  });

  it("is $1,200 in the $2M-$2.5M tier", () => {
    expect(calcEoSupplement(2_000_001)).toBe(1200);
    expect(calcEoSupplement(2_500_000)).toBe(1200);
  });

  it("rounds a fraction of a $500k increment up to a full increment", () => {
    expect(calcEoSupplement(1_000_001)).toBe(400);
  });
});

describe("calcTransactionFee", () => {
  const base = {
    side: "PURCHASE",
    salePrice: 500_000,
    grossCommission: 15_000,
    agentRelativeSale: false,
    brokerProvidedLead: false,
    numberOfParcels: null,
  };

  it("is the flat $990 base fee on a plain sale under $1M", () => {
    const result = calcTransactionFee(base);
    expect(result.fee).toBe(990);
    expect(result.label).toBe("CnC Transaction Fee");
  });

  it("adds the E&O supplement above $1M", () => {
    const result = calcTransactionFee({ ...base, salePrice: 1_200_000 });
    expect(result.fee).toBe(990 + 400);
  });

  it("doubles the fee for a DUAL-side transaction", () => {
    const result = calcTransactionFee({ ...base, side: "DUAL" });
    expect(result.fee).toBe(990 * 2);
    expect(result.label).toBe("CnC Transaction Fee (Dual ×2)");
  });

  it("doubles the fee for an agent-relative sale on a non-dual side", () => {
    const result = calcTransactionFee({ ...base, agentRelativeSale: true });
    expect(result.fee).toBe(990 * 2);
    expect(result.label).toBe("CnC Transaction Fee (Dual ×2)");
  });

  it("multiplies the fee by parcel count when numberOfParcels is 2 or more", () => {
    const result = calcTransactionFee({ ...base, numberOfParcels: 3 });
    expect(result.fee).toBe(990 * 3);
    expect(result.label).toBe("CnC Transaction Fee (3 Parcels)");
  });

  it("treats numberOfParcels of 1 or null the same as no multi-parcel", () => {
    expect(calcTransactionFee({ ...base, numberOfParcels: 1 }).fee).toBe(990);
    expect(calcTransactionFee({ ...base, numberOfParcels: null }).fee).toBe(990);
  });

  it("compounds dual and multi-parcel on the same file", () => {
    const result = calcTransactionFee({ ...base, side: "DUAL", numberOfParcels: 3 });
    expect(result.fee).toBe(990 * 2 * 3);
    expect(result.label).toBe("CnC Transaction Fee (Dual ×2, 3 Parcels)");
  });

  it("overrides everything to 30% of gross when brokerProvidedLead is on", () => {
    const result = calcTransactionFee({
      ...base,
      side: "DUAL",
      agentRelativeSale: true,
      numberOfParcels: 3,
      brokerProvidedLead: true,
      salePrice: 1_200_000,
      grossCommission: 20_000,
    });
    expect(result.fee).toBe(20_000 * 0.3);
    expect(result.label).toBe("Broker-Provided Lead Fee (30%)");
  });

  it("uses the 10%-or-$200 lease formula for lease sides, ignoring toggles and parcels", () => {
    const result = calcTransactionFee({
      side: "LEASE_TENANT",
      salePrice: 0,
      grossCommission: 3_000,
      agentRelativeSale: true,
      brokerProvidedLead: false,
      numberOfParcels: 5,
    });
    expect(result.fee).toBe(300);
    expect(result.label).toBe("CnC Lease Fee");
  });

  it("floors the lease formula at $200", () => {
    const result = calcTransactionFee({
      side: "LEASE_LANDLORD",
      salePrice: 0,
      grossCommission: 1_000,
      agentRelativeSale: false,
      brokerProvidedLead: false,
      numberOfParcels: null,
    });
    expect(result.fee).toBe(200);
  });

  it("applies the lease formula the same way for LEASE_DUAL", () => {
    const result = calcTransactionFee({
      side: "LEASE_DUAL",
      salePrice: 0,
      grossCommission: 3_000,
      agentRelativeSale: false,
      brokerProvidedLead: false,
      numberOfParcels: null,
    });
    expect(result.fee).toBe(300);
  });
});

describe("calcNetToAgent", () => {
  it("subtracts the transaction fee, deductions, and no TC fee", () => {
    expect(calcNetToAgent(10000, 990, 500, false)).toBe(10000 - 990 - 500);
  });

  it("also subtracts the TC fee when enabled", () => {
    expect(calcNetToAgent(10000, 990, 500, true)).toBe(10000 - 990 - 500 - TC_FEE);
  });

  it("handles zero deductions and zero transaction fee", () => {
    expect(calcNetToAgent(5000, 0, 0, false)).toBe(5000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/commission.test.ts`
Expected: FAIL — `calcEoSupplement`/`calcTransactionFee` not exported, `calcNetToAgent` called with the wrong arity.

- [ ] **Step 3: Implement**

Replace `apps/web/src/lib/commission.ts` entirely with:

```typescript
export const TC_FEE = 350;

const BASE_FEE = 990;
const EO_INCLUDED_THROUGH = 1_000_000;
const EO_SUPPLEMENT_STEP = 500_000;
const EO_SUPPLEMENT_AMOUNT = 400;

export function calcEoSupplement(salePrice: number): number {
  if (salePrice <= EO_INCLUDED_THROUGH) return 0;
  return Math.ceil((salePrice - EO_INCLUDED_THROUGH) / EO_SUPPLEMENT_STEP) * EO_SUPPLEMENT_AMOUNT;
}

export interface TransactionFeeInput {
  side: string; // TransactionSide, kept as string here so this module has zero Prisma-generated imports
  salePrice: number;
  grossCommission: number;
  agentRelativeSale: boolean;
  brokerProvidedLead: boolean;
  numberOfParcels: number | null;
}

export interface TransactionFeeResult {
  fee: number;
  label: string;
}

const LEASE_SIDES = new Set(["LEASE_TENANT", "LEASE_LANDLORD", "LEASE_DUAL"]);

export function calcTransactionFee(input: TransactionFeeInput): TransactionFeeResult {
  const { side, salePrice, grossCommission, agentRelativeSale, brokerProvidedLead, numberOfParcels } = input;

  if (LEASE_SIDES.has(side)) {
    return { fee: Math.max(grossCommission * 0.1, 200), label: "CnC Lease Fee" };
  }

  if (brokerProvidedLead) {
    return { fee: grossCommission * 0.3, label: "Broker-Provided Lead Fee (30%)" };
  }

  const supplement = calcEoSupplement(salePrice);
  const isDual = side === "DUAL" || agentRelativeSale;
  const parcels = numberOfParcels && numberOfParcels >= 2 ? numberOfParcels : 1;
  const fee = (BASE_FEE + supplement) * (isDual ? 2 : 1) * parcels;

  const labelParts: string[] = [];
  if (isDual) labelParts.push("Dual ×2");
  if (parcels > 1) labelParts.push(`${parcels} Parcels`);
  const label = labelParts.length > 0 ? `CnC Transaction Fee (${labelParts.join(", ")})` : "CnC Transaction Fee";

  return { fee, label };
}

export function calcNetToAgent(
  grossCommission: number,
  transactionFee: number,
  otherDeductions: number,
  tcFeeEnabled: boolean
): number {
  return grossCommission - transactionFee - otherDeductions - (tcFeeEnabled ? TC_FEE : 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/commission.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/commission.ts apps/web/src/__tests__/lib/commission.test.ts
git commit -m "feat: commission fee engine (base fee, E&O supplement, dual/multi-parcel, lease, broker-lead)"
```

---

### Task 3: Multi-Parcel field, end-to-end

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx`
- Modify: `apps/web/src/app/api/transactions/route.ts`
- Test: `apps/web/src/__tests__/api/transactions.test.ts` (extend the existing POST test file)

**Interfaces:**
- Consumes: `TransactionFile.numberOfParcels` (Task 1).
- Produces: the wizard's `form.numberOfParcels` field name — Task 4 reads this same field to feed `calcTransactionFee`.

- [ ] **Step 1: Add the options constant**

In `new-transaction/page.tsx`, right after the `PROPERTY_TYPES` constant (around line 26):

```typescript
const PROPERTY_TYPES = ["Single Family", "Condo", "Townhouse", "Multi-Family", "Commercial", "Land", "Industrial", "Farm and Ranch", "Manufactured Home", "Co-Op", "Other"];
const MULTI_PARCEL_OPTIONS = Array.from({ length: 99 }, (_, i) => i + 2); // 2–100; blank/1 both mean "not multi-parcel"
```

- [ ] **Step 2: Rename the form-state key**

Change (around line 51):

```typescript
    taxId: "", annualTaxes: "", schoolDistrict: "", zoningClass: "", photoKey: "",
```

to:

```typescript
    taxId: "", numberOfParcels: "", schoolDistrict: "", zoningClass: "", photoKey: "",
```

- [ ] **Step 3: Swap the Property-step fields**

Re-grep for the current `Tax ID / APN` / `Annual Taxes` row (was around lines 387-390) and replace:

```tsx
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tax ID / APN" value={form.taxId} onChange={(v) => set("taxId", v)} placeholder="Optional" />
                <Field label="Annual Taxes" type="number" value={form.annualTaxes} onChange={(v) => set("annualTaxes", v)} placeholder="$" />
              </div>
```

with:

```tsx
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Multi-Parcel</label>
                  <select
                    value={form.numberOfParcels}
                    onChange={(e) => set("numberOfParcels", e.target.value)}
                    className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
                  >
                    <option value="">—</option>
                    {MULTI_PARCEL_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <Field label="Tax ID / APN" value={form.taxId} onChange={(v) => set("taxId", v)} placeholder="Optional" />
              </div>
```

- [ ] **Step 4: Update the Review step's Property section**

Re-grep for the current Tax ID/Annual Taxes review rows (was around lines 673-674) and replace:

```tsx
              {form.taxId && <ReviewRow label="Tax ID / APN" value={form.taxId} />}
              {form.annualTaxes && <ReviewRow label="Annual Taxes" value={`$${Number(form.annualTaxes).toLocaleString()}`} />}
```

with:

```tsx
              {form.numberOfParcels && <ReviewRow label="Multi-Parcel" value={`${form.numberOfParcels} parcels`} />}
              {form.taxId && <ReviewRow label="Tax ID / APN" value={form.taxId} />}
```

- [ ] **Step 5: Update the API route**

In `apps/web/src/app/api/transactions/route.ts`, change the destructure (around line 36):

```typescript
    taxId, annualTaxes, schoolDistrict, zoningClass, photoKey,
```

to:

```typescript
    taxId, numberOfParcels, schoolDistrict, zoningClass, photoKey,
```

and the create-data assignment (around lines 90-91):

```typescript
        taxId: taxId || null,
        annualTaxes: annualTaxes ? Number(annualTaxes) : null,
```

to:

```typescript
        taxId: taxId || null,
        numberOfParcels: numberOfParcels ? parseInt(numberOfParcels, 10) : null,
```

- [ ] **Step 6: Write a test for the route change**

In `apps/web/src/__tests__/api/transactions.test.ts`, add a test asserting a POST body with `numberOfParcels: "3"` results in `prisma.transactionFile.create` being called with `numberOfParcels: 3` (integer), and that omitting it results in `numberOfParcels: null`. Follow this file's existing mocking pattern for `prisma.transactionFile.create`.

- [ ] **Step 7: Run tests and typecheck**

Run: `pnpm --filter web exec vitest run src/__tests__/api/transactions.test.ts && pnpm --filter web exec tsc --noEmit`
Expected: PASS, no new type errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/dashboard/transactions/new-transaction/page.tsx apps/web/src/app/api/transactions/route.ts apps/web/src/__tests__/api/transactions.test.ts
git commit -m "feat: Multi-Parcel field replaces Annual Taxes, swapped left of Tax ID/APN"
```

---

### Task 4: Commission step — toggles, fee engine wiring, relabeled breakdown

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx`
- Modify: `apps/web/src/app/api/transactions/route.ts`
- Test: `apps/web/src/__tests__/api/transactions.test.ts` (extend further)

**Interfaces:**
- Consumes: `calcTransactionFee`, `calcNetToAgent` from `lib/commission.ts` (Task 2); `form.numberOfParcels`, `isLeaseSide` (Task 3, already exists in this file).
- Produces: nothing further downstream — this is the last piece of the wizard.

- [ ] **Step 1: Re-grep this file's current state first**

Task 3 shifted some line numbers in this same file. Re-grep for each anchor below before editing rather than trusting the line numbers in this plan.

- [ ] **Step 2: Widen the commission import**

Change:

```typescript
import { TC_FEE, calcNetToAgent } from "@/lib/commission";
```

to:

```typescript
import { TC_FEE, calcNetToAgent, calcTransactionFee } from "@/lib/commission";
```

- [ ] **Step 3: Add the two new toggle states**

Right after the existing `tcFeeEnabled` state (around line 40):

```typescript
  const [tcFeeEnabled, setTcFeeEnabled] = useState(false);
  const [agentRelativeSale, setAgentRelativeSale] = useState(false);
  const [brokerProvidedLead, setBrokerProvidedLead] = useState(false);
```

- [ ] **Step 4: Wire the fee engine into the live calc**

Change:

```typescript
  const otherDeductionsAmt = parseFloat(form.otherDeductions) || 0;
  const totalGci = saleCommissionAmt + listingCommissionAmt;
  const netToAgent = calcNetToAgent(totalGci, otherDeductionsAmt, tcFeeEnabled);
```

to:

```typescript
  const otherDeductionsAmt = parseFloat(form.otherDeductions) || 0;
  const totalGci = saleCommissionAmt + listingCommissionAmt;
  const transactionFee = calcTransactionFee({
    side: form.transactionSide,
    salePrice,
    grossCommission: totalGci,
    agentRelativeSale,
    brokerProvidedLead,
    numberOfParcels: form.numberOfParcels ? parseInt(form.numberOfParcels, 10) : null,
  });
  const netToAgent = calcNetToAgent(totalGci, transactionFee.fee, otherDeductionsAmt, tcFeeEnabled);
```

- [ ] **Step 5: Add the shared `ToggleRow` component**

Add this new function near the other small helper components in this file (e.g. right after `CommissionField`):

```tsx
function ToggleRow({
  label, sublabel, checked, onChange,
}: {
  label: string; sublabel: string; checked: boolean; onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-3">
      <div>
        <p className="text-sm font-medium text-[#1B1B1B]">{label}</p>
        <p className="text-xs text-[#1B1B1B]/40">{sublabel}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-[#9E8C61]" : "bg-[#1B1B1B]/20"}`}
      >
        <span
          className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Replace the hand-rolled TC toggle with three `ToggleRow`s**

Re-grep for the current `{/* TC Fee toggle */}` block and replace it (the whole `<div className="flex items-center justify-between rounded-lg ...">...</div>` for CnC TC Service) with:

```tsx
            <ToggleRow
              label="CnC TC Service"
              sublabel={`In-house transaction coordinator — $${TC_FEE}`}
              checked={tcFeeEnabled}
              onChange={() => setTcFeeEnabled((v) => !v)}
            />
            {!isLeaseSide && (
              <>
                <ToggleRow
                  label="Agent-Relative Sale"
                  sublabel="Buyer or seller is a relative of the representing agent"
                  checked={agentRelativeSale}
                  onChange={() => setAgentRelativeSale((v) => !v)}
                />
                <ToggleRow
                  label="Broker-Provided Lead"
                  sublabel="This transaction originated from a CnC-provided lead"
                  checked={brokerProvidedLead}
                  onChange={() => setBrokerProvidedLead((v) => !v)}
                />
              </>
            )}
```

(`isLeaseSide` already exists earlier in this component — these two new toggles have no effect on lease files per the spec, so they're hidden there rather than shown as dead controls.)

- [ ] **Step 7: Add the fee row to the breakdown box, and widen its visibility gate**

Re-grep for `{/* Auto-calculated breakdown */}`. The gate `{salePrice > 0 && (` must become `{(salePrice > 0 || totalGci > 0) && (` — lease files never have a non-zero `salePrice` (they use `leasePrice`), so without this the box (and the new Lease Fee row) would never render for a lease file at all. Then add the transaction-fee row:

```tsx
            {(salePrice > 0 || totalGci > 0) && (
              <div className="rounded-xl border border-[#1B1B1B]/8 bg-[#F2F0EF] p-5 space-y-2 text-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#1B1B1B]/40">
                  Commission Breakdown
                </p>
                <BdRow label="Purchase Price" value={`$${salePrice.toLocaleString()}`} />
                <BdRow
                  label="Sale Commission"
                  value={saleCommissionAmt > 0 ? `$${Math.round(saleCommissionAmt).toLocaleString()}` : "—"}
                />
                <BdRow
                  label="Listing Commission"
                  value={listingCommissionAmt > 0 ? `$${Math.round(listingCommissionAmt).toLocaleString()}` : "—"}
                />
                {transactionFee.fee > 0 && (
                  <BdRow label={transactionFee.label} value={`−$${Math.round(transactionFee.fee).toLocaleString()}`} muted />
                )}
                {otherDeductionsAmt > 0 && (
                  <BdRow label="Other Deductions" value={`−$${otherDeductionsAmt.toLocaleString()}`} muted />
                )}
                {tcFeeEnabled && (
                  <BdRow label="CnC TC Service" value={`−$${TC_FEE}`} muted />
                )}
                <div className="border-t border-[#1B1B1B]/10 pt-2">
                  <div className="flex justify-between font-semibold text-[#1B1B1B]">
                    <span>Net to Agent</span>
                    <span>{netToAgent > 0 ? `$${Math.round(netToAgent).toLocaleString()}` : "—"}</span>
                  </div>
                </div>
              </div>
            )}
```

- [ ] **Step 8: Add the fee row to the Review step's Commission section**

Re-grep for `<ReviewSection title="Commission">` and change:

```tsx
            <ReviewSection title="Commission">
              {totalGci > 0 && <ReviewRow label="Total GCI" value={`$${Math.round(totalGci).toLocaleString()}`} />}
              {otherDeductionsAmt > 0 && <ReviewRow label="Deductions" value={`$${otherDeductionsAmt.toLocaleString()}`} />}
              {tcFeeEnabled && <ReviewRow label="CnC TC Service" value={`$${TC_FEE}`} />}
              {netToAgent > 0 && <ReviewRow label="Net to Agent" value={`$${Math.round(netToAgent).toLocaleString()}`} />}
            </ReviewSection>
```

to:

```tsx
            <ReviewSection title="Commission">
              {totalGci > 0 && <ReviewRow label="Total GCI" value={`$${Math.round(totalGci).toLocaleString()}`} />}
              {transactionFee.fee > 0 && <ReviewRow label={transactionFee.label} value={`$${Math.round(transactionFee.fee).toLocaleString()}`} />}
              {otherDeductionsAmt > 0 && <ReviewRow label="Deductions" value={`$${otherDeductionsAmt.toLocaleString()}`} />}
              {tcFeeEnabled && <ReviewRow label="CnC TC Service" value={`$${TC_FEE}`} />}
              {netToAgent > 0 && <ReviewRow label="Net to Agent" value={`$${Math.round(netToAgent).toLocaleString()}`} />}
            </ReviewSection>
```

- [ ] **Step 9: Send the two new toggles at submit**

Re-grep for the `submit()` function's `fetch("/api/transactions"` call and change:

```typescript
      body: JSON.stringify({
        ...form,
        tcFeeEnabled,
        commissionGCI: totalGci || null,
        saleCommissionPct: commissionMode.sale === "pct" ? parseFloat(form.saleCommission) || null : null,
        listingCommissionPct: commissionMode.listing === "pct" ? parseFloat(form.listingCommission) || null : null,
        otherDeductions: otherDeductionsAmt || null,
        parties,
      }),
```

to:

```typescript
      body: JSON.stringify({
        ...form,
        tcFeeEnabled,
        agentRelativeSale,
        brokerProvidedLead,
        commissionGCI: totalGci || null,
        saleCommissionPct: commissionMode.sale === "pct" ? parseFloat(form.saleCommission) || null : null,
        listingCommissionPct: commissionMode.listing === "pct" ? parseFloat(form.listingCommission) || null : null,
        otherDeductions: otherDeductionsAmt || null,
        parties,
      }),
```

- [ ] **Step 10: Persist the two new booleans server-side**

Re-grep for the `tcFeeEnabled = false,` destructure line in `apps/web/src/app/api/transactions/route.ts` and change:

```typescript
    tcFeeEnabled = false,
```

to:

```typescript
    tcFeeEnabled = false,
    agentRelativeSale = false,
    brokerProvidedLead = false,
```

Then re-grep for `tcFeeEnabled: !!tcFeeEnabled,` in the `create` call's data object and change:

```typescript
        tcFeeEnabled: !!tcFeeEnabled,
```

to:

```typescript
        tcFeeEnabled: !!tcFeeEnabled,
        agentRelativeSale: !!agentRelativeSale,
        brokerProvidedLead: !!brokerProvidedLead,
```

- [ ] **Step 11: Write tests for the route change**

Add to `apps/web/src/__tests__/api/transactions.test.ts`: a test asserting `agentRelativeSale: true, brokerProvidedLead: true` in the POST body results in both booleans `true` in the `create` call's data, and that omitting them defaults both to `false`.

- [ ] **Step 12: Run tests and typecheck**

Run: `pnpm --filter web exec vitest run src/__tests__/api/transactions.test.ts && pnpm --filter web exec tsc --noEmit`
Expected: PASS, no new type errors.

- [ ] **Step 13: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/dashboard/transactions/new-transaction/page.tsx apps/web/src/app/api/transactions/route.ts apps/web/src/__tests__/api/transactions.test.ts
git commit -m "feat: Agent-Relative Sale and Broker-Provided Lead toggles, wired into the fee engine"
```

---

### Task 5: File-detail Commission tab

**Files:**
- Modify: `apps/web/src/types/transaction.ts`
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx`

**Interfaces:**
- Consumes: `calcTransactionFee`, `calcNetToAgent` from `lib/commission.ts` (Task 2); `TransactionFile.numberOfParcels`/`agentRelativeSale`/`brokerProvidedLead` (Task 1).

- [ ] **Step 1: Update `TransactionFileDetail`**

In `apps/web/src/types/transaction.ts`, change (around line 108):

```typescript
  taxId: string | null;
  annualTaxes: number | null;
  schoolDistrict: string | null;
```

to:

```typescript
  taxId: string | null;
  numberOfParcels: number | null;
  schoolDistrict: string | null;
```

and (around line 129):

```typescript
  tcFeeEnabled: boolean;
```

to:

```typescript
  tcFeeEnabled: boolean;
  agentRelativeSale: boolean;
  brokerProvidedLead: boolean;
```

- [ ] **Step 2: Widen the commission import**

In `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx`, change:

```typescript
import { TC_FEE, calcNetToAgent } from "@/lib/commission";
```

to:

```typescript
import { TC_FEE, calcNetToAgent, calcTransactionFee } from "@/lib/commission";
```

- [ ] **Step 3: Rewire `CommissionTab`**

Replace the whole `CommissionTab` function with:

```tsx
function CommissionTab({ transaction }: { transaction: TransactionFileDetail }) {
  const salePrice = Number(transaction.salePrice ?? 0);
  const salePct = Number(transaction.saleCommissionPct ?? 0);
  const listingPct = Number(transaction.listingCommissionPct ?? 0);
  const deductions = Number(transaction.otherDeductions ?? 0);

  const saleCommissionDollar = salePrice * (salePct / 100);
  const listingCommissionDollar = salePrice * (listingPct / 100);
  // commissionGCI is the single source of truth for gross commission — it's set
  // at creation from whichever commission-entry mode (% or flat $) the agent
  // used, whereas saleCommissionDollar/listingCommissionDollar above are $0 on
  // any file where flat-dollar mode was used (saleCommissionPct is null then),
  // including every lease file (leases have no salePrice to multiply a % against).
  const totalGross = Number(transaction.commissionGCI ?? 0);
  const transactionFee = calcTransactionFee({
    side: transaction.transactionSide,
    salePrice,
    grossCommission: totalGross,
    agentRelativeSale: transaction.agentRelativeSale,
    brokerProvidedLead: transaction.brokerProvidedLead,
    numberOfParcels: transaction.numberOfParcels,
  });
  const netToAgent = calcNetToAgent(totalGross, transactionFee.fee, deductions, transaction.tcFeeEnabled);

  const fmt = (n: number) => n !== 0 ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
  const fmtPct = (n: number) => n !== 0 ? `${n}%` : "—";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Commission Breakdown</h2>
        <InfoRow label="Sale Price" value={salePrice > 0 ? `$${salePrice.toLocaleString()}` : "—"} />
        {transaction.deposit && <InfoRow label="Deposit" value={`$${Number(transaction.deposit).toLocaleString()}`} />}
        <InfoRow label="Sale Commission" value={fmtPct(salePct)} />
        <InfoRow label="Sale Commission $" value={fmt(saleCommissionDollar)} />
        <InfoRow label="Listing Commission" value={fmtPct(listingPct)} />
        <InfoRow label="Listing Commission $" value={fmt(listingCommissionDollar)} />
        {transactionFee.fee > 0 && (
          <InfoRow label={transactionFee.label} value={`-${fmt(transactionFee.fee)}`} />
        )}
        <InfoRow label="Other Deductions" value={deductions > 0 ? `-${fmt(deductions)}` : "—"} />
        {transaction.tcFeeEnabled && (
          <InfoRow label="CnC TC Service" value={`-${fmt(TC_FEE)}`} />
        )}
      </div>

      <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Net to Agent</h2>
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/5 pb-3">
          <span className="text-sm text-[#1B1B1B]/50">Gross Commission</span>
          <span className="font-medium text-[#1B1B1B]">{fmt(totalGross)}</span>
        </div>
        {transactionFee.fee > 0 && (
          <div className="flex items-center justify-between border-b border-[#1B1B1B]/5 pb-3">
            <span className="text-sm text-[#1B1B1B]/50">{transactionFee.label}</span>
            <span className="font-medium text-red-500">-{fmt(transactionFee.fee)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/5 pb-3">
          <span className="text-sm text-[#1B1B1B]/50">Deductions</span>
          <span className="font-medium text-red-500">{deductions > 0 ? `-${fmt(deductions)}` : "—"}</span>
        </div>
        {transaction.tcFeeEnabled && (
          <div className="flex items-center justify-between border-b border-[#1B1B1B]/5 pb-3">
            <span className="text-sm text-[#1B1B1B]/50">CnC TC Service</span>
            <span className="font-medium text-red-500">-{fmt(TC_FEE)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-base font-semibold text-[#1B1B1B]">Net to Agent</span>
          <span className="text-xl font-light text-[#9E8C61]">{fmt(netToAgent)}</span>
        </div>
        {transaction.commissionNotes && (
          <p className="mt-2 text-xs text-[#1B1B1B]/40 border-t border-[#1B1B1B]/5 pt-3">{transaction.commissionNotes}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Confirm any other reader of `TransactionFileDetail.annualTaxes` is caught**

```bash
grep -rn "annualTaxes" apps/web/src
```

Expected: no matches anywhere (Task 3 already renamed the wizard/API side; this step is a final sweep).

- [ ] **Step 5: Run the full suite and typecheck**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: full suite passes, zero new type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/types/transaction.ts apps/web/src/app/\(dashboard\)/dashboard/transactions/\[fileType\]/\[id\]/page.tsx
git commit -m "feat: file-detail Commission tab reads the real fee schedule via commissionGCI"
```

---

### Task 6: Controller-only — production build + live check

Not a subagent dispatch. After all 5 tasks are individually reviewed and the final whole-branch review is clean:

- [ ] Run `pnpm --filter web build` (needs Ryan's OK to stop the dev server first, same as every prior sub-project's build step)
- [ ] Restart the dev server, confirm `/login` returns 200
- [ ] Live check with Ryan: one pass per meaningfully different fee shape — a plain sale, a dual-agency sale, an agent-relative sale, a multi-parcel sale, a broker-provided-lead sale, and a lease — confirming the Commission Breakdown box, Review step, and file-detail Commission tab all show the same, correctly-labeled number for each
