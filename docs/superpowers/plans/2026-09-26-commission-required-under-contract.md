# Commission Required When Under Contract — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD per task.

**Goal:** Transaction commission is required for Under Contract files, optional for Pre-Contract, can't be skipped on the way to Pending, and can be entered/edited later from the Overview tab. Commission % can never exceed 100, and flipping the %/$ toggle clears the typed value.

**Decisions (Ryan, 2026-09-26 chat, SkySlope as reference):**
- Wizard Commission step: **Under Contract → required** (asterisk, Next disabled); **Pre-Contract → optional**. Purchase = Selling Agent commission; Listing = Listing Agent commission; Dual = both; all lease sides (residential + commercial) = Lease Commission. Referral unchanged.
- **Pre-Contract → Pending** is blocked until commission is filled, through the shared `isReadyForPending` (creation, status dropdown, automatic). **Admins can override** (existing rule).
- Overview tab gets transaction commission pencils (shared `CommissionField` via `InfoRow`); saving recomputes $ amounts and GCI so the Commission tab updates. Once past Pre-Contract, commission can't be blanked (`requiredFieldError`).
- #3: shared `CommissionField` clears its value when %/$ flips; listing + transaction POST/PATCH reject a commission % over 100.

**Applies to:** all transaction sides (residential + commercial), listings for the 100% check; agent + admin (shared `OverviewTab`, shared routes). No new page-load queries.

## Tasks

1. **Shared rules** (TDD)
   - `transaction-helpers.ts`: `commissionReady(side, { hasSale, hasListing })` — PURCHASE and lease sides need sale; LISTING needs listing; DUAL both; REFERRAL true. `isReadyForPending` also requires it, reading `saleCommissionPct/Amount` and `listingCommissionPct/Amount` (value > 0).
   - `commission.ts`: `resolveCommission(side, price, { salePct, saleAmount, listingPct, listingAmount })` → `{ saleCommissionAmount, listingCommissionAmount, commissionGCI }`; a % wins and is priced off `price`; GCI = sale (PURCHASE), listing (LISTING), else sum.
   - `file-edit.ts`: `commissionPercentError(body)` (any of `commissionPercent`, `saleCommissionPct`, `listingCommissionPct` > 100 → "Commission can't be more than 100%"); `transactionCommissionEdit(body, tx)` parses the four fields + recomputes via `resolveCommission` when any of them or the price changes; `requiredFieldError` refuses leaving a required side's commission empty once `status !== "PRE_CONTRACT"`.
   - `file-status.ts` message: "Add the price, dates, parties and commission this transaction needs before it can be Pending".
2. **Routes** (TDD): transactions POST — 100% check; Under Contract (non-referral) without required commission → 400; pass commission to `isReadyForPending`. Transactions PATCH — 100% check, commission edit data. Listings POST/PATCH — 100% check.
3. **UI:** `CommissionField` clears on toggle; wizard step 4 required + asterisk when Under Contract (`commissionReady`); `InfoRow` edit `hideModeToggle`; `OverviewTab` transaction commission rows (Selling / Listing / Lease) saving both % and $ keys; rename `listingCommissionDisplay` → `commissionDisplay` (now shared).
4. Gate (vitest, tsc, lint, dev log), commit; Ryan clicks through.
