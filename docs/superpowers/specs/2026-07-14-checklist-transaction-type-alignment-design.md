# Checklist / Transaction Type Alignment — Design Spec

**Date:** 2026-07-14
**Status:** Ready for self-review and user approval
**Amends:** `docs/superpowers/specs/2026-07-11-core-transaction-type-overhaul-design.md` (see Correction Note below) — does not replace that doc's schema work, which shipped and is live; amends its `REFERRAL` decision specifically.
**Supersedes:** Effectively serves as the deferred "Sub-project B: Checklist Template System" referenced in the 2026-07-11 doc's Overview, though scoped narrower (content already shipped earlier today for the 6 non-referral checklist templates; this doc covers what's left).

---

## Correction note (read this first)

The 2026-07-11 spec's Overview claims CnC's `TransactionSide` enum "has 4 values where zipForm's equivalent has 7, verified against 14 zipForm workflow screenshots." A fresh, live, source-quoted re-verification of Lone Wolf Transact's official documentation today (2026-07-14) found this to be incorrect: **Transact has exactly 4 transaction types** (Purchase, Listing, Lease, Lease Listing). Direct quote from Transact's "About transactions" article: *"you must select its type out of the 4 available options – listings, purchases, leases, and lease listings."* Dual agency is explicitly documented as **two separate linked files**, not a 5th type (*"If you are working with the client on both the listing and purchase side, you will need two separate client files"*) — which independently matches what CnC's own ICA already says ("Dual agency: 2 transaction records required"). Referral does not appear anywhere in Transact's transaction data model at all.

This does **not** mean CnC's current 6-type structure (Purchase, Listing, Dual, Lease Tenant, Lease Landlord, Lease Dual) is wrong — Ryan has explicitly decided to keep it as a deliberate CnC-specific simplification, already fully built and mapped, independent of what the reference system does. This note exists so the historical "we copied zipForm's 7" justification in the 2026-07-11 doc isn't taken as still-accurate by a future reader. The one piece of that doc's decision this spec does revise is `REFERRAL` — seeing it modeled as a peer of "Purchase" was importing a real-property-deal shape onto something that isn't one, and today's business-logic discussion (below) confirms it needs different handling entirely.

---

## Overview

Two things ship in this spec:

1. **Checklist template renaming + 2 new templates** for the 6 real transaction types, so template names visually match the wizard's own labels, and Dual/Lease Dual (currently uncovered — silently produce zero checklist items today, same class of bug already found and fixed for lease-listing conversions) get real content.
2. **`REFERRAL` retired as a `TransactionSide` peer**, replaced with a dedicated lightweight referral flow: a 2-step creation wizard (no property, offer, parties, or commission steps), a single-item checklist (the RFA form), and its own 5-state status lifecycle distinct from the other 6 types' lifecycle.

**What ships:**
- Checklist template renames (6 existing rows) + 2 new templates (Dual Agency Forms, Lease Dual Agency Forms) whose content is the union of their component single-side checklists
- Removal of `REFERRAL` from the New Transaction wizard's `SIDES` array and `ROLE_LABELS`
- A new, much shorter Referral creation flow (File Type → Referral Details → Create)
- New nullable `TransactionFile` fields for referral-specific data
- 3 new additive `TransactionFileStatus` enum values, reusing the 2 that already exist (`PENDING`, `CLOSED`) for the first and last states
- A new "Referral Forms" checklist template (1 item: RFA)
- Conditional property-field validation in the transaction-creation API for the `REFERRAL` side

**What is explicitly NOT touched:**
- The other 6 types' existing 6-step wizard, statuses, or checklist content (Purchase/Listing/Lease Tenant/Lease Landlord — already verified against C.A.R./DRE earlier today, not being revisited)
- `REFERRAL_AGENT` as a `FilePartyRole` — this is a different, already-correct concept (crediting a referral source *on* an ordinary Purchase/Listing/etc. deal) and is unaffected
- `LeadSource.REFERRAL` and any lead-relationship "Referral" values (`DashboardTabs.tsx`, `admin/reports/page.tsx`, `reports/my-stats/route.ts`) — confirmed via grep these are a completely unrelated concept (how a *lead* was sourced) and must not be touched

---

## 1. Checklist template renames

All 6 already-shipped templates get renamed to match the wizard's own label text exactly (Ryan's original observation — "Purchase" should map to something like "Purchase Forms"). Content is unchanged for all 6; this is a `name` field update only.

| Wizard label | Current template name | New name |
|---|---|---|
| Purchase | Residential Sale — Buyer Side | **Purchase Forms** |
| Listing | Residential Sale — Seller Side (Under Contract) | **Listing Forms** |
| Lease Tenant | Residential Lease — Tenant Side | **Lease Tenant Forms** |
| Lease Landlord | Residential Lease — Landlord Side (Transaction) | **Lease Landlord Forms** |
| *(pre-contract, different wizard)* | Residential Sale — Listing (Pre-Contract) | **Residential Sale — Listing Forms (Pre-Contract)** |
| *(pre-contract, different wizard)* | Residential Lease — Landlord Listing (Pre-Contract) | **Residential Lease — Landlord Listing Forms (Pre-Contract)** |

The last 2 keep the `(Pre-Contract)` suffix deliberately — they attach to the separate New Listing wizard (`fileType: "LISTING"`), not the New Transaction wizard, and must stay visually distinguishable from "Listing Forms" (the post-contract `TransactionFile` one) so they aren't confused for duplicates.

---

## 2. Two new checklist templates

### 2a. Dual Agency Forms

`fileType: "TRANSACTION"`, `transactionSide: "DUAL"`, `listingType: "ALL"`. Content is the union of Purchase Forms + Listing Forms, deduplicated where the same form serves both sides:

| Item | Source |
|---|---|
| RPA-CA — Purchase Agreement | shared |
| AD — Disclosure Regarding Real Estate Agency Relationships | shared |
| AVID — Agent Visual Inspection Disclosure | shared |
| SBSA — Statewide Buyer and Seller Advisory | shared |
| TDS — Real Estate Transfer Disclosure Statement | shared |
| NHD — Natural Hazard Disclosure Report | shared |
| BRBC — Buyer Representation and Broker Compensation Agreement | buyer-only |
| FIRPTA / CA Withholding Affidavit | buyer-only |
| Proof of Funds / Loan Pre-Approval Letter | buyer-only |
| SPQ — Seller Property Questionnaire | seller-only |
| DBD — Megan's Law Database Disclosure | seller-only |
| WHSD — Water Heater & Smoke Detector Statement of Compliance | seller-only |
| HOA Governing Documents (conditional) | seller-only |

13 items total. `isRequired` flags carry over unchanged from their source list (HOA stays optional/conditional).

### 2b. Lease Dual Agency Forms

`fileType: "TRANSACTION"`, `transactionSide: "LEASE_DUAL"`, `listingType: "ALL"`. Lease Landlord Forms' 3 items (RLMM, AD, LPD) are already a strict subset of Lease Tenant Forms' 4 (RLMM, AD, LPD, MII) — the union is just Lease Tenant Forms' list, reused as-is under a new template row:

| Item |
|---|
| RLMM — Residential Lease or Month-to-Month Rental Agreement |
| AD — Disclosure Regarding Real Estate Agency Relationships |
| LPD — Lead-Based Paint and Lead-Based Paint Hazards Disclosure (conditional) |
| MII — Move-In Inspection |

4 items, identical content to Lease Tenant Forms.

### 2c. Referral Forms

`fileType: "TRANSACTION"`, `transactionSide: "REFERRAL"`, `listingType: "ALL"`. One required item:

| Item |
|---|
| RFA — Referral Fee Agreement |

This is a real C.A.R. form (confirmed live against car.org's June 2026 Master Forms List during the original checklist research), tracked through the same upload/broker-review mechanism as every other checklist item — no special-case code needed for the checklist system itself.

**Implementation note:** all 3 new template rows follow the same `packages/database/prisma/seed.ts` pattern already established today (the `upsertTemplate()` helper, stable seed IDs, `checklistTemplateItem.deleteMany` before re-create for idempotency).

---

## 3. Referral: retire as a `TransactionSide` peer

### 3a. Business rule (confirmed with Ryan, corrects an earlier misreading)

Per CnC's ICA §7.5 ("Outbound Referral Transactions"): the fee only applies when a **CnC agent refers a client OUT** to another agent/brokerage — CnC takes 10% of the referral commission received, or $200, whichever is greater. Inbound referrals (someone sends a lead TO a CnC agent, who closes it themselves) are just a normal Purchase/Listing/etc. transaction with no special referral-fee logic. This spec's Referral flow models the outbound case only.

### 3b. Why it can't be a linear wizard step

The referral dollar amount is not knowable at file-creation time — it only exists once the *other* agent's deal actually closes, which could be months later. This rules out a single "File Type → Details → Review → Create" wizard with the amount as a field; the amount has to be entered later, as a status transition on the already-created file.

### 3c. Creation flow

**File Type → Referral Details → Create.** No Property, Offer, Parties, or Commission steps.

Referral Details step collects:
- Referred-to agent name
- Referred-to brokerage name
- Referred-to agent contact info (email, phone)
- Date referred

No property/location field of any kind (explicitly confirmed — not even optional free text).

### 3d. Status lifecycle

5 states, reusing the 2 that already exist on `TransactionFileStatus` (`PENDING`, `CLOSED`) and adding 3 new referral-specific ones:

```
PENDING  (set automatically on creation)
   │
   ├─→ REFERRAL_SUCCESSFUL  (agent marks this once the other side's deal closes escrow)
   │        │
   │        └─→ REFERRAL_BROKER_REVIEW  (agent submits; Ryan enters the referral amount received)
   │                 │
   │                 └─→ CLOSED  (Ryan sets this manually, after actually paying the agent out)
   │
   └─→ REFERRAL_UNSUCCESSFUL  (agent marks this if the deal fell through)
            │
            └─→ CLOSED  (straight through, no broker review — nothing to review, no money involved)
```

Who does what, at each transition:
- **Agent** triggers `PENDING → REFERRAL_SUCCESSFUL` or `PENDING → REFERRAL_UNSUCCESSFUL`. No dollar figure entered by the agent at any point.
- **`REFERRAL_SUCCESSFUL → REFERRAL_BROKER_REVIEW`** — Ryan enters the actual referral amount received; the system auto-calculates CnC's cut (`Math.max(amount * 0.10, 200)`) and the agent's net (`amount - cncFee`).
- **`REFERRAL_UNSUCCESSFUL → CLOSED`** and **`REFERRAL_BROKER_REVIEW → CLOSED`** — Ryan sets `CLOSED` manually once payout is actually done (the system does not automate the payout itself, only the fee calculation).

### 3e. Data model — recommended approach (needs Ryan's confirmation, see Open Questions)

**Recommendation: reuse the existing `TransactionFile` model rather than building a new one.** Reasoning:
- The checklist auto-apply mechanism already matches on `fileType: "TRANSACTION"` + `transactionSide` — reusing `TransactionFile` means "Referral Forms" (§2c) attaches through the exact same code path as every other checklist, no new matching logic needed.
- The existing precedent for side-dependent field relevance already exists on this model (e.g. `leasePrice` vs. `salePrice` coexist as side-conditional fields today) — adding a handful of referral-only nullable fields follows an established pattern rather than introducing a new one.
- Reuses the existing "All Files" list, admin file-detail page shell, and document upload/review UI already built for every other transaction type, instead of building a parallel page and API surface from scratch.

**New nullable fields needed on `TransactionFile`:**
```
referredToAgentName      String?
referredToBrokerageName  String?
referredToContactEmail   String?
referredToContactPhone   String?
dateReferred             DateTime?
referralAmountReceived   Float?
referralCncFee           Float?   // computed and stored at REFERRAL_BROKER_REVIEW entry, not recalculated live
```

**New additive `TransactionFileStatus` values:**
```
REFERRAL_SUCCESSFUL
REFERRAL_UNSUCCESSFUL
REFERRAL_BROKER_REVIEW
```
(`PENDING` and `CLOSED` already exist and are reused as-is.)

**Property field requirement:** `propertyAddress`, `city`, and `zip` are currently `NOT NULL` on `TransactionFile` at the schema level (not just API-level validation). Two options, need Ryan's call:
- **(a) Recommended — make them nullable** via a real migration, and have `POST /api/transactions` skip requiring them when `transactionSide === "REFERRAL"`. Correct long-term, small one-time migration cost.
- **(b) Lower-effort — write empty-string placeholders** (`city: "", zip: ""`) for Referral files, matching an existing precedent already in `deals/[id]/convert/route.ts`. No migration needed, but perpetuates a pattern that's arguably already a wart in that file.

---

## 4. Downstream code impact (confirmed via grep against current code, not assumed)

| File | Change |
|---|---|
| `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx` | Remove the `REFERRAL` entry from `SIDES` (line ~20). New short Referral flow is a **separate page/route**, not a branch inside this wizard, given how structurally different steps 2-3 are. |
| `apps/web/src/types/transaction.ts` | Remove `REFERRAL` from `ROLE_LABELS` and the `TransactionSide` union type used by the wizard/UI layer (the underlying Prisma enum value can stay — see below) |
| `apps/web/src/app/(dashboard)/admin/settings/checklists/page.tsx` | No change. `REFERRAL` stays in the New Template form's Transaction Side dropdown — a broker admin still needs to be able to create/edit a checklist template targeting the `REFERRAL` side (e.g. "Referral Forms" itself), even though `REFERRAL` is being removed from the *transaction-creation* wizard's `SIDES` array. Those are two different dropdowns serving two different purposes. |
| `apps/web/src/__tests__/lib/transaction-sides.test.ts` | Update `SIDES has all 7 types` → 6 types (drop `REFERRAL` from the expected array); drop the `ROLE_LABELS.REFERRAL` assertion |
| `packages/database/prisma/schema.prisma` | Add the 3 new `TransactionFileStatus` values (additive, safe migration) + the 7 new nullable `TransactionFile` fields (§3e) + (if option 3e-a chosen) make `propertyAddress`/`city`/`zip` nullable |
| `packages/database/prisma/seed.ts` | Add `upsertTemplate()` calls for Dual Agency Forms, Lease Dual Agency Forms, Referral Forms; rename the 6 existing templates per §1 |
| `apps/web/src/app/api/transactions/route.ts` | Conditional property-field validation for `transactionSide === "REFERRAL"` (skip requiring `propertyAddress`/`city`/`zip`); handle the new referral fields on create |
| New file: Referral creation page (e.g. `apps/web/src/app/(dashboard)/dashboard/transactions/new-referral/page.tsx`) | The 2-step flow from §3c |
| New file: Referral status-transition API route(s) | Handles agent-triggered `REFERRAL_SUCCESSFUL`/`REFERRAL_UNSUCCESSFUL`, and the broker-triggered amount-entry + `REFERRAL_BROKER_REVIEW`/`CLOSED` transitions |

**Confirmed NOT in scope** (grepped and ruled out as false positives — different "Referral" concept entirely): `DashboardTabs.tsx`, `admin/reports/page.tsx`, `api/reports/my-stats/route.ts` (all `LeadSource.REFERRAL`, unrelated); `api/leads/route.ts`, `api/leads/[id]/relationships/route.ts`, `SmartListResults.tsx`, `NewLeadModal.tsx`, `SmartListDrawer.tsx`, `RelationshipSection.tsx` (Lead/Contact relationship concepts, unrelated); `__tests__/api/transactions.test.ts`'s `REFERRAL_AGENT` party-role test (different, already-correct concept, unaffected); `AgentTransactionsSection.tsx` (no `REFERRAL` reference found — the 2026-07-11 doc's TODO about a duplicated label map there appears to have already been resolved).

---

## 5. Testing

- `__tests__/lib/transaction-sides.test.ts` — update expected `SIDES` array to 6 values; drop `REFERRAL` from `ROLE_LABELS` assertions
- New test file for the Referral creation route — confirms no `propertyAddress`/`city`/`zip` required, confirms status starts at `PENDING`, confirms the new referral fields save correctly
- New test file for the Referral status-transition route(s) — confirms the branching state machine (§3d): `PENDING → REFERRAL_SUCCESSFUL` and `PENDING → REFERRAL_UNSUCCESSFUL` (agent-triggered, no amount), `REFERRAL_SUCCESSFUL → REFERRAL_BROKER_REVIEW` (broker-triggered, requires amount, asserts fee calc `Math.max(amount * 0.10, 200)` for both the >$2,000 and <$2,000 cases), `REFERRAL_UNSUCCESSFUL → CLOSED` and `REFERRAL_BROKER_REVIEW → CLOSED` (broker-triggered)
- `packages/database/prisma/seed.ts` run against a real DB — confirm 9 total checklist templates exist afterward (6 renamed + 3 new), with Dual Agency Forms at 13 items and Lease Dual Agency Forms at 4 items matching Lease Tenant Forms exactly

---

## Open Questions (for Ryan's review before this moves to a plan)

1. **§3e — reuse `TransactionFile` vs. a new dedicated model?** Recommendation given above (reuse), but this is a real fork worth an explicit yes/no rather than a silent pick, since it affects how much new code the eventual plan contains.
2. **§3e — nullable columns (3e-a) vs. empty-string placeholders (3e-b)** for `propertyAddress`/`city`/`zip` on Referral files.
3. Should the Referral creation flow be its own page/route (as assumed in §4), or a heavily-branched mode within the existing New Transaction wizard? Recommendation is a separate page, given how little the two flows share.
