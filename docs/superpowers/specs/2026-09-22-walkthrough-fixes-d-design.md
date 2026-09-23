# Walkthrough fixes — Sub-project D: commission redesign

**Date:** 2026-09-22
**Origin:** Last item of the original ~25-issue walkthrough list, split into A (done), B (done), C (done), D (this spec).
**Scope:** make the "Commission Breakdown" table — in the New Transaction wizard's Commission step, its Review step, and the file-detail Commission tab — actually compute CnC's real, finalized fee schedule (`lib/ica-content.ts`'s `SUMMARY_TABLE`), instead of just commission-%-of-sale-price minus a free-text deduction.
**Explicitly out:** the separate `ListingFile` model's own `commissionPercent` field (pre-contract listings, a different model with a much simpler flat commission — untouched). The outbound-Referral fee formula (`calcReferralFee` in `lib/transaction-helpers.ts`) — already correctly implements "10% of referral commission received, or $200, whichever is greater," server-enforced, not touched by this project. The CnC TC Service $350 toggle — already correct, untouched.

## Reuse audit (done before designing)

| Need | Already in the codebase? | Decision |
|---|---|---|
| A place to hold the fee math | `lib/commission.ts` — currently just `TC_FEE` + `calcNetToAgent`. | Extend this file with the new fee-engine function; don't create a new file. |
| Toggle UI (pill switch) | The Commission step's existing CnC TC Service toggle (`new-transaction/page.tsx`, `relative h-6 w-11 rounded-full` pill pattern). | Extract as a small shared `ToggleRow` component; all 3 toggles (TC Service, Agent-Relative Sale, Broker-Provided Lead) render from it instead of copy-pasting the toggle markup three times. |
| Dropdown UI (`<select>`) | The Property step's existing Property Type `<select>`, same styling, driven off a constant array. | Reuse the identical pattern for the new Multi-Parcel dropdown — same classes, same shape, just a different options array (`2`–`100`). |
| A field to repurpose for Multi-Parcel | `annualTaxes Float?` on `TransactionFile` — not DRE/CA-law required (see below), already in the "Optional Property Info" section. | Rename this column to `numberOfParcels Int?` rather than add a new, orphaned one. Nothing reads `annualTaxes` outside this one field today (confirmed by grep) and no real transaction data exists pre-launch. |
| Referral fee formula | `calcReferralFee` in `lib/transaction-helpers.ts`, already server-enforced (ignores client-supplied values, always recomputes max(10%, $200)). | Confirmed correct, no changes. My first-pass reuse audit (presented in chat) said this was still manual — it isn't; corrected here. |
| Gross commission concept | `totalGci` in the wizard / `totalGross` in the file-detail tab (`saleCommissionAmt + listingCommissionAmt`). | Reuse as the "gross commission" input to the new fee engine — no new concept needed. |
| Net-to-agent subtraction | `calcNetToAgent(gross, deductions, tcFeeEnabled)`. | Extend its signature to also subtract the new CnC transaction fee (whichever formula produced it) — same function, more inputs. |

**DRE/CA-law check on `annualTaxes` before repurposing it:** not required. The DRE's actual recordkeeping mandate is retaining transaction *documents* (RPA, disclosures, TDS) for 3 years from close, not any specific CRM data field ([DRE — Duty to Keep Records](https://journal.firsttuesday.us/duty-to-dre-to-keep-records/90170/)). Tax/assessment disclosure is satisfied by the TDS itself ([DRE RE 6](https://www.dre.ca.gov/files/pdf/re6.pdf)), a document CnC's checklist system already requires — not by this wizard field. The field already lives under "Optional Property Info" in the app's own UI, confirming it was never treated as required.

## The fee schedule being implemented

Source of truth: `lib/ica-content.ts`'s `SUMMARY_TABLE` (the finalized CnC ICA).

| ICA line | Formula |
|---|---|
| Transaction Fee (base, all sale transactions) | $990 |
| E&O included through | $1,000,000 sale price |
| E&O Supplement | $400 per $500k (or fraction) over $1M |
| Dual Agency / Agent-Relative Sale | Full fee (base + supplement) × 2 |
| Multi-Parcel (APN) Transaction | Full fee (base + supplement, if applicable) charged per APN |
| Lease/Rental Transaction | 10% of commission or $200, whichever is greater |
| Broker-Provided Lead (referral fee) | 30% of gross commission (flat transaction fee does not apply) |
| Optional CnC TC Service | $350 (already correct, unchanged) |

### How the pieces compose

**Three new inputs**, all live on `TransactionFile`:
- `agentRelativeSale: boolean` (new toggle)
- `brokerProvidedLead: boolean` (new toggle)
- `numberOfParcels: number | null` (repurposed `annualTaxes` column, dropdown 2–100, `null`/blank = 1 parcel)

**Scope decisions made during brainstorming** (all confirmed with Ryan):
- Dual-agency/agent-relative doubling and the multi-parcel multiplier apply **only to sale-side transactions** (`PURCHASE`, `LISTING`, `DUAL`) — the ICA's wording ("base + supplement") is sale-fee-specific language that doesn't exist on the lease formula. Lease-side (`LEASE_TENANT`, `LEASE_LANDLORD`, `LEASE_DUAL`) files always use the 10%-or-$200 formula regardless of these toggles' state.
- Broker-Provided Lead is a **full override**, not a multiplier target: when on, the fee is exactly 30% of gross commission, full stop — dual-agency/agent-relative doubling and the multi-parcel multiplier do not apply on top of it, matching "flat transaction fee does not apply."
- Dual-agency doubling and the multi-parcel multiplier **compound** when both apply to the same sale-side file (e.g. a dual-agency 3-parcel land sale): `fee = (base + eoSupplement) × 2 × 3`. This is the more defensible reading of "full fee × 2" and "full fee ... charged per APN" each independently scaling the same base number — flagged here as an assumption for Ryan to correct if wrong; this is a rare-within-a-rare edge case.

**The engine, in words** (implemented as pure functions in `lib/commission.ts`):

```
calcEoSupplement(salePrice):
  salePrice <= 1,000,000 → 0
  else → ceil((salePrice - 1,000,000) / 500,000) × 400

calcTransactionFee(side, salePrice, grossCommission, agentRelativeSale, brokerProvidedLead, numberOfParcels):
  if side is LEASE_TENANT / LEASE_LANDLORD / LEASE_DUAL:
    return max(grossCommission × 0.10, 200)   // toggles/parcels have no effect
  else (PURCHASE / LISTING / DUAL):
    if brokerProvidedLead:
      return grossCommission × 0.30            // full override
    base = 990
    supplement = calcEoSupplement(salePrice)
    dualMultiplier = (side === "DUAL" || agentRelativeSale) ? 2 : 1
    parcelMultiplier = numberOfParcels && numberOfParcels >= 2 ? numberOfParcels : 1
    return (base + supplement) × dualMultiplier × parcelMultiplier

calcNetToAgent(grossCommission, transactionFee, otherDeductions, tcFeeEnabled):
  return grossCommission - transactionFee - otherDeductions - (tcFeeEnabled ? TC_FEE : 0)
```

`calcNetToAgent`'s signature changes (adds `transactionFee` as a parameter) — both existing call sites (the wizard and the file-detail tab) get updated together in the same task, so there's no window where the two are out of sync.

Referral files (`transactionSide === "REFERRAL"`) don't go through this engine at all — they keep using `calcReferralFee` exactly as today, and the Commission step/tab isn't shown for them (already true today, unchanged).

## Schema changes

One migration, three changes to `TransactionFile`:
- Rename `annualTaxes Float?` → `numberOfParcels Int?`
- Add `agentRelativeSale Boolean @default(false)`
- Add `brokerProvidedLead Boolean @default(false)`

No changes to `ListingFile`, `Agent`, or any other model.

## UI changes

**Property step (Optional Property Info section):** the Tax ID/APN + Annual Taxes row becomes **Multi-Parcel** (left) + **Tax ID / APN** (right) — both fields swap positions from where Tax ID/APN and Annual Taxes sit today. Multi-Parcel renders as a `<select>` (blank, then `2`–`100`), styled identically to the existing Property Type dropdown.

**Commission step:** three toggles in a row, sharing one new `ToggleRow` component — CnC TC Service (existing, refactored onto the shared component, no behavior change), Agent-Relative Sale (new), Broker-Provided Lead (new). The auto-calculated "Commission Breakdown" box gains line items for the CnC Transaction Fee (labeled per which formula actually produced it — e.g. "CnC Transaction Fee" vs. "CnC Transaction Fee (Dual ×2)" vs. "CnC Transaction Fee (3 Parcels)" vs. "Broker-Provided Lead Fee (30%)" vs., on lease files, "CnC Lease Fee") before the Net to Agent line.

**Review step:** the existing "Commission" `ReviewSection` gains a row for the computed CnC Transaction Fee, same label logic as the breakdown box.

**File-detail Commission tab:** same breakdown restructuring as the wizard's box — Sale Price → Sale/Listing Commission % and $ (unchanged) → **CnC Transaction Fee** (new row, labeled per formula) → Other Deductions (unchanged) → CnC TC Service (unchanged) → Net to Agent. The "Net to Agent" card mirrors the same rows.

## Testing plan

- `calcEoSupplement`: $0 at/under $1M, $400 at $1.1M, exact-boundary behavior at $1.5M/$2M/$2.5M matching the ICA's own worked examples, fraction-of-$500k rounds up.
- `calcTransactionFee`: one test per branch — plain sale, dual-agency sale, agent-relative sale (non-dual), multi-parcel sale, dual + multi-parcel compounding, broker-provided-lead override (confirms dual/parcel are ignored when this is on), each lease side, lease ignoring all three toggles.
- `calcNetToAgent`: updated existing tests for the new `transactionFee` parameter.
- Wizard + file-detail tab: verified via `tsc`, the full suite, and a live check with Ryan (one pass per meaningfully different fee shape: plain sale, dual sale, agent-relative sale, multi-parcel sale, broker-provided-lead sale, a lease).
- Migration: confirmed no other code reads `annualTaxes` before renaming (already grepped — zero other references).

## Risks

- The dual+multi-parcel compounding assumption (see above) is the one real judgment call in this spec — low-probability edge case, but worth Ryan double-checking during spec review since it's a real-dollar decision.
- No schema change touches `ListingFile`, the closed-file lock (sub-project B), or any other sub-project's work — fully isolated to `TransactionFile`'s commission-related fields and the 3 screens that read them.
