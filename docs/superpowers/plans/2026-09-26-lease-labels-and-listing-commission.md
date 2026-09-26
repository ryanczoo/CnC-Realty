# Lease Labels, Offer/LOI Dates & Listing Commission $ — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD per task.

**Goal:** Lease files use lease wording (Monthly Rent, LOI dates), residential leases hide offer dates, and listings accept commission as % or $.

**Decisions (Ryan, 2026-09-25/26 chat):**
- Lease listings: "List Price" → **"Monthly Rent \*"**. Lease transactions keep **"Total Lease Amount \*"**; their existing list-price field shows as **"Monthly Rent"** (optional) — wizard Details step: `Total Lease Amount * | Monthly Rent` then `Deposit` below; Overview row relabeled. Same DB column (`listPrice`), no schema change.
- **Listing Type** moves to the top of the New Listing wizard's Property Info. Labels follow the dropdown live in any order.
- Offer dates: **hidden for residential leases**; **"LOI Date / LOI Expiration Date" (optional) for commercial leases**; sales unchanged. Same DB columns (`offerDate`, `offerExpirationDate`). Wizard + Overview.
- Listing commission **% or $**: extract the transaction wizard's `CommissionField` (%/$ toggle) into a shared component; add `ListingFile.commissionAmount Float?` (additive migration — **ask Ryan first**). Overview shows "2.5%" or "$15,000"; its pencil uses the same toggle.

**Applies to:** all listing types / transaction sides; agent + admin pages (shared `OverviewTab`). No page-load work (labels are render-time conditions).

## Tasks
1. **Shared label helpers** (`types/transaction.ts`, tests): `listingPriceLabel(listingType)`, `transactionListPriceLabel(side)`, `offerDateLabels(side, propertyCategory) → { date, expiration } | null`.
2. **New Listing wizard:** Listing Type first; price label from `listingPriceLabel`; Review label too.
3. **New Transaction wizard (Details + Review):** lease layout (Total Lease Amount / Monthly Rent, Deposit below); offer section via `offerDateLabels` (hidden when null).
4. **Overview:** listing price row, transaction list-price row, Key Dates offer rows via the helpers.
5. **Shared `CommissionField`** (`components/transactions/CommissionField.tsx`) extracted unchanged from the transaction wizard; wizard imports it.
6. **Migration** `ListingFile.commissionAmount` (ask first) → listings POST/PATCH accept it (blank → null; `lib/file-edit` pattern); New Listing Commission step uses `CommissionField`; Overview Commission row shows % or $ and its pencil edits with the toggle (`InfoRow` edit kind `commission`, multi-field save).
7. Gate after each (vitest, tsc, lint), commit; Ryan clicks through.
