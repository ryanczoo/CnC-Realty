# Commercial Listing & Transaction Support — Design Spec

**Date:** 2026-07-16
**Status:** Approved by Ryan (2026-07-16) — ready for implementation plan
**Builds on:** `docs/superpowers/specs/2026-07-14-checklist-transaction-type-alignment-design.md` (the 6 residential checklist templates + matching mechanism this spec extends)

---

## Why this exists

`COMMERCIAL` has been a selectable `ListingType` in the New Listing wizard since the transaction system was first built (`24e555b`, Phase 5A) — it was never removed or gated. The 2026-07-14 checklist audit explicitly scoped itself to "every residential sale/lease combination" and never mentioned commercial — not a deliberate legal exclusion, just out of scope for that pass. Result: today, creating a Commercial listing produces a file with **zero checklist items** (`ChecklistTemplate.findFirst` matches nothing), and there is no way to represent a commercial buyer/tenant/dual transaction at all. Ryan confirmed CnC does do commercial sales and leases, so this needs full, correct support — not a stopgap.

---

## Overview

**What ships:**
1. `ListingType.COMMERCIAL` splits into `COMMERCIAL_SALE` / `COMMERCIAL_LEASE`, mirroring the existing `RESIDENTIAL_SALE`/`RESIDENTIAL_LEASE` split.
2. New `PropertyCategory` enum (`RESIDENTIAL` | `COMMERCIAL`) added as a field on `TransactionFile`, **not** as 6 new duplicate `TransactionSide` values — see §1 for why.
3. `ChecklistTemplate` gains a `propertyCategory` field (string, default `"ALL"`, same pattern as its existing `transactionSide`/`listingType` fields).
4. Checklist-matching logic in `transactions/route.ts` and `listings/[id]/convert/route.ts` extended to match on `propertyCategory` too, done **atomically** with backfilling the 6 existing residential templates to `propertyCategory: "RESIDENTIAL"` — see §2 for why these can't ship separately.
5. 8 new checklist templates (2 Listing-side, 6 Transaction-side) with real C.A.R.-form and CA-statute-grounded content — see §3.
6. `deals/[id]/convert/route.ts` fixed to attach a checklist at all (currently attaches none, for any deal — a separate, pre-existing bug found during this audit, folded into this work at Ryan's request).

**What is explicitly NOT touched:**
- The 6 existing residential `TransactionSide` values, their status-transition tables, permissions, or wizard step logic — `propertyCategory` is a new orthogonal field precisely so none of this needs to change.
- `Property.listingType` (`FOR_SALE`/`FOR_RENT`) — the public MLS/IDX search's field of the same name on a completely different model. Confirmed via `apps/web/src/types/property.ts` vs `types/transaction.ts`: these are two unrelated fields that happen to share a name. Files touching the former (`properties/page.tsx`, `rent/*`, `useProperties.ts`, `useSearchFilters.ts`, `idx/*`, `FilterBar.tsx`, `PropertyDrawer.tsx`, `api/properties/route.ts`) are **out of scope** and must not be confused with this work.
- The New Transaction wizard's Pre-Contract/Under-Contract stage selector — reviewed and confirmed intentional (§ below), no change.

---

## Pre-Contract / Under-Contract — reviewed, unchanged

Raised during brainstorming: why does a *Transaction* file support a "no signed contract yet" state? Confirmed via the wizard's own copy (`new-transaction/page.tsx`) this is deliberate: **Under Contract** ("You have a signed purchase agreement") vs. **Pre-Contract** ("No signed contract yet — set up file early"). This models when CnC starts representing a client, not when a contract exists — an agent can open a file the moment they start working a buyer/tenant relationship. Confirmed this status split flows correctly into the existing transition table (`PRE_CONTRACT → PENDING` once a contract is later signed). No change needed; documented here so it isn't re-litigated.

---

## 1. Data model: why `propertyCategory`, not 6 duplicate `TransactionSide` values

Two research findings, both confirmed rather than assumed, ruled this out:

**a) The app's own status-transition tables (`transaction-helpers.ts`) are already identical across Purchase, Listing, Dual, Lease Tenant, Lease Landlord, and Lease Dual.** Zero branching on `transactionSide` exists in `AGENT_TX_TRANSITIONS`/`ADMIN_TX_TRANSITIONS` for any of those 6 — only `REFERRAL` has genuinely different states. Duplicating the enum would mean adding 6 new values whose transition-table entries are byte-for-byte identical to their residential counterparts — pure duplication, not real differentiation.

**b) Commercial vs. residential deals differ in substance, not workflow shape.** Confirmed via research: commercial deals still follow the same buyer/seller-or-landlord/tenant → agreement → escrow/closing shape; what differs is due diligence depth, financing type, title complexity, and disclosure standard — not the stage progression itself.

**Conclusion:** the only thing that actually needs to vary by property type is *which checklist applies*. That's exactly what an orthogonal field is for, and it's the same pattern already used successfully for the Listing side.

**Confirmed the checklist content genuinely differs, not just assumed:** read all 6 existing Transaction-side templates directly from the database before finalizing this. Every one references residential-specific forms by name — `RPA-CA — California **Residential** Purchase Agreement`, `RLMM — **Residential** Lease or Month-to-Month`, `LPD — Lead-Based Paint` (federally residential-only) — confirming all 6 genuinely need commercial counterparts. Only `Referral Forms` (a single-item "RFA — Referral Fee Agreement") is property-type-agnostic and needs no commercial version.

**Schema:**
```prisma
enum PropertyCategory {
  RESIDENTIAL
  COMMERCIAL
}

model TransactionFile {
  // ...existing fields...
  propertyCategory PropertyCategory @default(RESIDENTIAL)
}

model ChecklistTemplate {
  // ...existing fields...
  propertyCategory String @default("ALL")   // "ALL" | "RESIDENTIAL" | "COMMERCIAL" — string, not the enum above, to allow the "ALL" fallback sentinel (matches existing transactionSide/listingType pattern on this model)
}
```

`TransactionFile.propertyCategory` is a real enum (every transaction has exactly one definite category, no "ALL" case). `ChecklistTemplate.propertyCategory` stays a plain string like its siblings, to keep the `"ALL"` fallback matching pattern consistent.

**`ListingType` enum split** (Listing side, separate from the above — Listing files have no "side" concept to explode, so the existing combined-enum convention extends cleanly):
```prisma
enum ListingType {
  RESIDENTIAL_SALE
  RESIDENTIAL_LEASE
  COMMERCIAL_SALE   // was COMMERCIAL
  COMMERCIAL_LEASE  // new
}
```
Confirmed zero existing `ListingFile` rows use the bare `COMMERCIAL` value (queried live DB) — no data backfill needed for this migration.

---

## 2. Matching logic changes — must ship atomically with the schema change

`transactions/route.ts` and `listings/[id]/convert/route.ts` currently do:
```js
where: { fileType: "TRANSACTION", isActive: true, OR: [{ transactionSide }, { transactionSide: "ALL" }] }
```
This must become (both call sites):
```js
where: {
  fileType: "TRANSACTION",
  isActive: true,
  OR: [{ transactionSide }, { transactionSide: "ALL" }],
  AND: [{ OR: [{ propertyCategory }, { propertyCategory: "ALL" }] }],
}
```

**Why this can't land as two separate steps:** the moment a commercial template exists for a given `transactionSide` without the query also filtering on `propertyCategory`, `findFirst` would match *both* the existing residential template and the new commercial one for every residential transaction on that side — with no `orderBy`, which one wins is undefined. That would silently corrupt checklists that already work correctly in production. So the plan must: (1) add the schema field, (2) update the query in both files, and (3) backfill the 6 existing residential templates to `propertyCategory: "RESIDENTIAL"` (not left on the `"ALL"` default) — as one atomic unit of work, seed script included, before any commercial template rows are inserted.

`listings/[id]/convert/route.ts` also needs its `propertyCategory` derived from the source listing:
```js
const propertyCategory = listing.listingType.startsWith("COMMERCIAL") ? "COMMERCIAL" : "RESIDENTIAL";
```

---

## 3. New checklist content (draft — flagged for broker/attorney review, see caveat below)

Grounded in: C.A.R.'s live Master Forms List (fetched directly, not from memory) and CA statutory research (Civil Code §1624 Statute of Frauds — written-agreement requirement for real property sales and leases over 1 year; Civil Code §1103 / Government Code §8589.3 — Natural Hazard Disclosure applies to commercial, not just residential; Civil Code §1938 / AB 2093 — CASp accessibility disclosure is legally required on every commercial lease, not just customary).

### Listing side (`fileType: LISTING`, pre-contract)

**"Commercial Sale — Listing Forms (Pre-Contract)"** — `listingType: COMMERCIAL_SALE`
| Item | Note |
|---|---|
| CLA — Commercial/Residential Income and Vacant Land Listing Agreement | required |
| CSPQ — Commercial Seller Property Questionnaire | required |
| NHD — Natural Hazard Disclosure Report | required — confirmed applies to commercial (Govt. Code §8589.3) |

**"Commercial Lease — Landlord Listing Forms (Pre-Contract)"** — `listingType: COMMERCIAL_LEASE`
| Item | Note |
|---|---|
| CLA — Commercial/Residential Income and Vacant Land Listing Agreement | required (CAR uses this form for lease listings too) |
| CL — Commercial Lease Agreement | required once executed |
| CASp Disclosure (accessibility inspection status) | required — Civil Code §1938, every commercial lease |
| Prop 65 Warning | conditional — only if the property contains listed chemicals, Health & Safety Code §25249.6 |

### Transaction side (`fileType: TRANSACTION`, `propertyCategory: COMMERCIAL`)

**"Commercial Purchase Forms" / "Commercial Listing Forms" / "Commercial Dual Agency Forms"** — `transactionSide: PURCHASE` / `LISTING` / `DUAL` respectively (sale-side deals — 3 templates, content identical except Dual adds agency disclosure):
| Item | Purchase | Listing | Dual |
|---|---|---|---|
| CPA — Commercial Property Purchase Agreement & Joint Escrow Instructions | ✓ | ✓ | ✓ |
| CSPQ — Commercial Seller Property Questionnaire | ✓ | ✓ | ✓ |
| NHD — Natural Hazard Disclosure Report | ✓ | ✓ | ✓ |
| AD — Disclosure Regarding Real Estate Agency Relationships | | | ✓ |

**"Commercial Lease Tenant Forms" / "Commercial Lease Landlord Forms" / "Commercial Lease Dual Agency Forms"** — `transactionSide: LEASE_TENANT` / `LEASE_LANDLORD` / `LEASE_DUAL` respectively (lease-side deals — 3 templates):
| Item | Lease Tenant | Lease Landlord | Lease Dual |
|---|---|---|---|
| CL — Commercial Lease Agreement | ✓ | ✓ | ✓ |
| CASp Disclosure | ✓ | ✓ | ✓ |
| Prop 65 Warning (conditional) | ✓ | ✓ | ✓ |
| AD — Disclosure Regarding Real Estate Agency Relationships | | | ✓ |

8 new templates total (2 Listing-side + 6 Transaction-side), all with explicit `propertyCategory: "COMMERCIAL"` (Listing-side templates distinguish via `listingType` alone, no separate category field needed there — see §1).

**Caveat, stated plainly:** this content was built the same way the residential checklists were — by pattern-matching C.A.R.'s form catalog and researching CA statutes — but neither Ryan nor I have direct experience with a real commercial transaction. Same situation already on record for the ICA. Treat this as a strong, well-sourced starting draft, not a final compliance authority — a broker or attorney familiar with commercial deals should sanity-check it before it governs real files.

---

## 4. `deals/[id]/convert/route.ts` fix (folded in at Ryan's request)

Currently creates a `TransactionFile` with no checklist attached at all, for any deal, regardless of property type — a separate pre-existing bug found while auditing this. Fix: reuse the same lookup-and-attach pattern already used in `transactions/route.ts`, keyed on the `transactionSide` this route already derives from `deal.pipeline`, defaulting `propertyCategory: RESIDENTIAL` (the `DealPipeline` enum has no commercial concept today — out of scope to add one here; noting it as a known limitation, not silently working around it).

---

## 5. Downstream code impact (confirmed via grep, not assumed)

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | Split `ListingType.COMMERCIAL` → `COMMERCIAL_SALE`/`COMMERCIAL_LEASE`; add `PropertyCategory` enum; add `TransactionFile.propertyCategory`; add `ChecklistTemplate.propertyCategory` |
| `packages/database/prisma/seed.ts` | Backfill 6 existing Transaction-side templates to `propertyCategory: "RESIDENTIAL"`; add 8 new template rows (§3) |
| `apps/web/src/app/api/transactions/route.ts` | Extend checklist match to filter on `propertyCategory` too; accept `propertyCategory` in the request body |
| `apps/web/src/app/api/listings/route.ts` | No change to matching logic (already keys on `listingType` alone, and `COMMERCIAL_SALE`/`COMMERCIAL_LEASE` are just new valid values for the same field) — confirmed by re-reading this file |
| `apps/web/src/app/api/listings/[id]/convert/route.ts` | Derive `propertyCategory` from `listing.listingType`; extend checklist match; extend the existing `RESIDENTIAL_LEASE → LEASE_LANDLORD` derivation to also handle `COMMERCIAL_SALE → LISTING` / `COMMERCIAL_LEASE → LEASE_LANDLORD` |
| `apps/web/src/app/api/deals/[id]/convert/route.ts` | Add the missing checklist-attach logic (§4) |
| `apps/web/src/app/(dashboard)/dashboard/transactions/new-listing/page.tsx` | Dropdown: replace the single `COMMERCIAL` option with `COMMERCIAL_SALE` / `COMMERCIAL_LEASE` |
| `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx` | Add a property-category selector (Residential/Commercial) — needs its own placement decision, not yet designed; see open item below |
| `apps/web/src/app/(dashboard)/admin/settings/checklists/page.tsx` | New Template form needs a Property Category selector alongside its existing File Type / Transaction Side / Listing Type selectors |
| `apps/web/src/app/api/admin/checklist-templates/route.ts`, `.../[id]/route.ts` | Accept/persist `propertyCategory` on create/update |
| `apps/web/src/types/transaction.ts` | `ListingFileDetail.listingType` type update for the new enum values; add `propertyCategory` to `TransactionFileDetail` |

**Confirmed NOT in scope** (grepped and ruled out — different `listingType` field on an unrelated model): `apps/web/src/app/(listings)/properties/page.tsx`, `apps/web/src/app/(marketing)/rent/page.tsx`, `apps/web/src/components/rent/RentCitiesSlider.tsx`, `apps/web/src/components/rent/RentSteps.tsx`, `apps/web/src/hooks/useProperties.ts`, `apps/web/src/hooks/useSearchFilters.ts`, `apps/web/src/lib/idx/field-map.ts`, `apps/web/src/app/api/idx/sync/route.ts`, `apps/web/src/app/api/properties/route.ts`, `apps/web/src/components/properties/FilterBar.tsx`, `apps/web/src/components/properties/PropertyDrawer.tsx`, `apps/web/src/types/property.ts` — all reference `Property.listingType` (`FOR_SALE`/`FOR_RENT`), confirmed via `types/property.ts` vs `types/transaction.ts` to be a completely separate field that happens to share a name.

**Open item, not yet resolved — needs a follow-up decision before implementation:** where and how the New Transaction wizard collects `propertyCategory` for direct buyer/tenant-side commercial representation (the wizard currently has no such field at all). Likely lands on Step 1 alongside the side selector, but the exact UI shape hasn't been designed. Flagging rather than guessing.

---

## 6. Testing

No pure, standalone function to unit-test in isolation here (unlike the map-bounds/search-filters work earlier this session) — this change is entirely in Prisma query construction and route handlers, so coverage is via API-route tests:

- `api/transactions/route.ts` test: commercial `propertyCategory` + each of the 6 sides resolves to the correct commercial template, not the residential one
- Regression test: an existing residential-side request still resolves to its residential template post-change (guards against the `findFirst` ambiguity risk in §2)
- `api/listings/route.ts` test: `COMMERCIAL_SALE`/`COMMERCIAL_LEASE` resolve to their new Listing-side templates
- `api/listings/[id]/convert/route.ts` test: commercial listing conversion derives the correct `transactionSide` + `propertyCategory` and attaches the correct commercial Transaction-side template
- `api/deals/[id]/convert/route.ts` test: confirms a checklist is now attached at all (currently has no coverage of this because there's no behavior to cover)
- `prisma/seed.ts` run against a real DB: confirm 17 total checklist templates exist afterward (9 existing + 8 new), and that all 6 previously-`"ALL"` Transaction-side templates now read `propertyCategory: "RESIDENTIAL"`

---

## Decisions confirmed (Ryan, 2026-07-16)

1. **`propertyCategory` as a new orthogonal `TransactionFile` field**, not 6 duplicate `TransactionSide` values — confirmed by evidence (identical status-transition tables today; industry research showing workflow shape doesn't differ by property type), not by implementation-effort preference.
2. **Both the Listing-side and direct buyer/tenant-side Transaction flows need commercial support** — not listing-conversion only.
3. **Pre-Contract/Under-Contract stage selector stays unchanged** — reviewed and confirmed intentional.
4. **`deals/[id]/convert` checklist-attach bug folded into this work.**
5. **Checklist content is a researched draft, explicitly flagged for broker/attorney review before governing real files** — same posture as the outstanding ICA review.

**One open item before this is fully implementation-ready:** the New Transaction wizard's UI for selecting `propertyCategory` hasn't been designed (§5). Recommend resolving this in the implementation plan itself (`superpowers:writing-plans`) rather than blocking spec approval on it, since it's a contained UI decision, not an architecture question.

Ready for `superpowers:writing-plans`, with that one open item carried forward explicitly.
