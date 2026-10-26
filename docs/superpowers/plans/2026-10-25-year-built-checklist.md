# Year Built Checklist Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Year Built (and, for listings, Property Type) drive year-specific checklist items on every listing and transaction, with the wizard, Overview, gate, admin-template and small UI changes the spec lists.

**Architecture:** Pure rules live in `lib/year-built.ts` (valid years, missing facts) and `lib/year-checklist.ts` (which template items apply, what a re-check changes). One server helper `lib/year-checklist-db.ts` applies a re-check to a file and keeps a converted listing and its transaction in step. Every place that creates checklist rows (5 routes) goes through one shared `checklistCreateData()` and one shared `checklistTemplateWhere()`. The two wizards share three extracted components.

**Tech Stack:** Next.js 14 App Router, Prisma 5.22 on Neon Postgres, Vitest (node env, `.test.ts` only), Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-25-year-built-checklist-design.md`

## Global Constraints

- Local dev and production share ONE Neon database: a migration or data script is live the moment it runs. Never run `prisma/seed.ts` against it. Tell Ryan before running the migration (Task 1) and the rollout (Task 12).
- Stop the dev server before `prisma generate` / `migrate` (Windows DLL lock), restart after.
- Valid Year Built: 4 digits, **1500 through next calendar year**. Required for every listing type and transaction side **except Referral**, and except when Property Type is **"Land"** (then optional).
- Property Type options: the existing `FILE_PROPERTY_TYPES` (11 values) for both listings and transactions, no filtering.
- An item "built before N" applies only when `yearBuilt < N`. Unknown year → no year-based items. Items without `builtBefore` behave exactly as today.
- A re-check never removes a row that has ≥1 attached document (any review state). It runs only on files that are not locked (`isFileLocked(kind, status)` false). It never changes status. Each re-check that changes something writes one `CHECKLIST_UPDATED` activity.
- Rows are matched to template items **by name**.
- Admin keeps the existing Pending override (`file-status.ts:59` skips the check for ADMIN). Do not change that.
- Every change covers agent AND admin (both file pages, both share the wizards), listings AND transactions, desktop AND phone. Desktop must not change except the pages named in the spec (goals 1c, 1d, 8, 9, Overview rows).
- Reuse before creating: `FormField`, `DateField`, `WizardStepBar`, `PhotoUploadField`, `RequiredMark`, `PHONE_FIELD_PAIR`, `digitsOnly`, `isFileLocked`, `checkOwnership`, `FILE_PROPERTY_TYPES`.
- Gold-standard verification per task: `pnpm --filter web test`, `pnpm --filter web exec tsc --noEmit`. Tasks that touch UI or routes also run `rm -rf apps/web/.next && pnpm --filter web build` (with the dev server stopped).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push (Ryan approves every push).

## Review Focus

1. A Year Built like "0000", "3000", "999", "20" typed in a wizard or an Overview pencil → refused with "Year Built must be between 1500 and {next year}", never saved (Task 2 tests + Task 4/6 route tests).
2. Running a re-check twice on the same file → the second run changes nothing and writes no activity (Task 6 idempotency test).
3. A linked file that is Closed/Canceled while its partner's year changes → the closed one is untouched (Task 6 test).
4. A year-based row whose only document was **rejected** → stays; a row whose document was detached (no documents) → removable (Task 2 planner tests).
5. Admin edits a template item's built-before year after files exist → existing files change only on their next year/type change, using the template's current value (Task 6 test).

---

### Task 1: Schema, migration, types

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (ListingFile ~474, ChecklistTemplateItem ~652, FileChecklistItem ~663, `enum FileActivityType` ~182)
- Create: `packages/database/prisma/migrations/20261026120000_year_built_checklist/migration.sql` (via `prisma migrate dev --create-only --name year_built_checklist`, then rename folder timestamp only if needed)
- Modify: `apps/web/src/types/transaction.ts` (`FileActivityType` union; `ListingFileDetail` gains `yearBuilt: number | null; propertyType: string | null`; checklist item types gain `builtBefore: number | null`)

**Interfaces — Produces:** columns `ListingFile.yearBuilt Int?`, `ListingFile.propertyType String?`, `ChecklistTemplateItem.builtBefore Int?`, `FileChecklistItem.builtBefore Int?`; enum value `FileActivityType.CHECKLIST_UPDATED`.

- [ ] Step 1: Add the four nullable columns and the enum value. No indexes, no defaults.
- [ ] Step 2: Create the migration SQL with `--create-only`; read it — expect only `ALTER TABLE ... ADD COLUMN` ×4 and `ALTER TYPE "FileActivityType" ADD VALUE 'CHECKLIST_UPDATED'`. Nothing that drops or rewrites.
- [ ] Step 3: Tell Ryan the migration is about to go live (additive, old code unaffected), then `pnpm --filter @cnc/database exec prisma migrate deploy` and `prisma generate`.
- [ ] Step 4: Update the TS types; run `tsc --noEmit` — expected: clean (or only errors the next tasks resolve; list them).
- [ ] Step 5: Commit `feat(db): year built + built-before columns, CHECKLIST_UPDATED activity`.

### Task 2: Pure rules — years and which items apply

**Files:**
- Create: `apps/web/src/lib/year-built.ts`, `apps/web/src/lib/year-checklist.ts`
- Test: `apps/web/src/__tests__/lib/year-built.test.ts`, `apps/web/src/__tests__/lib/year-checklist.test.ts`

**Interfaces — Produces:**
```ts
// year-built.ts
export const YEAR_BUILT_MIN = 1500;
export function maxYearBuilt(now?: Date): number;                 // now.getFullYear() + 1
export function needsYearBuilt(propertyType: string | null | undefined): boolean; // !== "Land"
export function yearBuiltError(value: unknown, propertyType: string | null | undefined, now?: Date): string | null;
export function builtBeforeError(value: unknown, now?: Date): string | null;       // blank OK; else same range
export function missingPropertyFacts(f: { propertyType?: string | null; yearBuilt?: number | null }): ("property type" | "year built")[];
// year-checklist.ts
export type TemplateItemLike = { name: string; description: string | null; order: number; isRequired: boolean; builtBefore: number | null };
export type FileRowLike = { id: string; name: string; isRequired: boolean; documentCount: number };
export function builtBeforeApplies(builtBefore: number | null | undefined, yearBuilt: number | null | undefined): boolean;
export function checklistCreateData(fileType: "LISTING" | "TRANSACTION", items: TemplateItemLike[], yearBuilt: number | null | undefined):
  { fileType: "LISTING" | "TRANSACTION"; name: string; description: string | null; order: number; isRequired: boolean; builtBefore: number | null }[];
export function planYearChecklistChange(templateItems: TemplateItemLike[], rows: FileRowLike[], yearBuilt: number | null | undefined):
  { add: TemplateItemLike[]; removeIds: string[]; requiredUpdates: { id: string; isRequired: boolean; builtBefore: number }[] };
export function shortItemName(name: string): string;               // text before " — ", else before " (", else whole
```

- [ ] Step 1: Write failing tests. Exact cases:
  - `yearBuiltError("", "Single Family")` → `"Year Built is required"`; `yearBuiltError("", "Land")` → `null`; `yearBuiltError("1499", …)` and `yearBuiltError("2028", …, new Date("2026-10-25"))` → `"Year Built must be between 1500 and 2027"`; `"1500"`, `"2027"`, `1952` → `null`; `"19a2"`, `"20"` → range message.
  - `missingPropertyFacts({propertyType:null, yearBuilt:null})` → `["property type","year built"]`; `{propertyType:"Land", yearBuilt:null}` → `[]`; `{propertyType:"Condo", yearBuilt:null}` → `["year built"]`.
  - `builtBeforeApplies(null, null)` → true; `(1978, 1977)` → true; `(1978, 1978)` → false; `(1978, null)` → false.
  - `checklistCreateData` drops year items when the year doesn't qualify, keeps template `order`, copies `builtBefore`.
  - `planYearChecklistChange`: (a) year 1952, LPD(1978) + earthquake(1960) in template, no rows → both in `add`; (b) year 2005, LPD row with `documentCount:0` → its id in `removeIds`; (c) same with `documentCount:1` (rejected doc counts) → not removed; (d) lease LPD row named exactly like template, `isRequired:false`, year 1950, no docs → `requiredUpdates` `[{id, isRequired:true, builtBefore:1978}]`, not in `add`; (e) year null → no adds, removes rows without docs; (f) template items without `builtBefore` are never added/removed; (g) running on its own output (rows now present and required) → all three lists empty.
  - `shortItemName("LPD — Lead-Based…")` → `"LPD"`; `shortItemName("Residential Earthquake Hazards Report (Homeowner's…)")` → `"Residential Earthquake Hazards Report"`.
- [ ] Step 2: Run `pnpm --filter web test year-built year-checklist` — expect FAIL (modules missing).
- [ ] Step 3: Implement both files (pure, no Prisma import).
- [ ] Step 4: Re-run — expect PASS.
- [ ] Step 5: Commit `feat: year built rules and year-based checklist planner`.

### Task 3: Template contents (code source of truth)

**Files:**
- Modify: `packages/database/prisma/checklist-templates.ts`, `packages/database/prisma/seed.ts` (`upsertTemplate` item type gains `builtBefore?: number`, written as `builtBefore ?? null`)
- Test: `apps/web/src/__tests__/lib/checklist-templates.test.ts`

Exact copy (spec goals 3 and 6):
- `LPD_NAME = "LPD — Lead-Based Paint and Lead-Based Paint Hazards Disclosure"`, description `"Federal law for housing built before 1978; include the EPA pamphlet \"Protect Your Family From Lead in Your Home\""`, `isRequired: true`, `builtBefore: 1978`. Appended to RESIDENTIAL_SALE_LISTING, RESIDENTIAL_SALE_BUYER, RESIDENTIAL_SALE_SELLER, DUAL_AGENCY. In RESIDENTIAL_LEASE_LISTING, RESIDENTIAL_LEASE_TENANT, RESIDENTIAL_LEASE_LANDLORD, LEASE_DUAL_AGENCY the existing LPD item keeps its position and name and becomes this (required, 1978, new description).
- `"Residential Earthquake Hazards Report (Homeowner's Guide to Earthquake Safety)"`, description `"Required for 1–4 unit homes built before 1960. Gov. Code §8897.1"`, required, `builtBefore: 1960`. Appended after LPD to the 4 residential sale lists.
- `"Commercial Property Owner's Guide to Earthquake Safety (precast concrete or reinforced masonry buildings only)"`, description `"For precast concrete or reinforced masonry buildings built before 1975. Gov. Code §8893.2"`, **optional**, `builtBefore: 1975`. Appended to COMMERCIAL_SALE_LISTING, COMMERCIAL_PURCHASE, COMMERCIAL_LISTING_TX, COMMERCIAL_DUAL.
- WHSD rename to `"WHSD — Water Heater & Smoke Detector Statement of Compliance (required if TDS-exempt)"`, `isRequired: false`, in RESIDENTIAL_SALE_LISTING, RESIDENTIAL_SALE_SELLER, DUAL_AGENCY (descriptions unchanged).
- DBD description (3 lists) → `"The Megan's Law notice is pre-printed in the C.A.R. RPA and RIPA; this form is needed only with another purchase contract. Civil Code §2079.10a"`.

- [ ] Step 1: Failing tests: each table row above lands on exactly the named lists with the right `builtBefore`/`isRequired` and nowhere else (no LPD/earthquake on REFERRAL or commercial lease lists; no residential earthquake on leases); WHSD name/optional on the 3 lists; DBD description equals the string above (update the stale `RPA ¶10(D)` comment at the top of the test file); existing "numbered 1..n" test still holds; exactly one LPD per list.
- [ ] Step 2: Run — expect FAIL.
- [ ] Step 3: Edit the arrays and `upsertTemplate` typing.
- [ ] Step 4: Run `pnpm --filter web test checklist-templates` — PASS.
- [ ] Step 5: Commit `feat: year-based checklist items, WHSD optional, DBD wording`.

### Task 4: Create-time — shared template lookup, year filter, required fields

**Files:**
- Create: `apps/web/src/lib/checklist-template-match.ts`
- Modify: `app/api/listings/route.ts`, `app/api/transactions/route.ts`, `app/api/listings/[id]/convert/route.ts`, `app/api/deals/[id]/convert/route.ts`, `app/api/admin/documents/[id]/approve/route.ts` (replace `templateItemsCreate`)
- Test: extend `__tests__/api/listings.test.ts`, `transactions.test.ts`, and the listing-convert test (find with `rg -l "convert" apps/web/src/__tests__/api`)

**Interfaces — Produces:**
```ts
export function checklistTemplateWhere(kind: "listing", f: { listingType: string }): Prisma.ChecklistTemplateWhereInput;
export function checklistTemplateWhere(kind: "transaction", f: { transactionSide: string; propertyCategory: string }): Prisma.ChecklistTemplateWhereInput;
```
(same filters the routes use today; transactions map any non-"COMMERCIAL" category to "RESIDENTIAL").
**Consumes:** `checklistCreateData`, `yearBuiltError`, `needsYearBuilt` (Task 2).

- [ ] Step 1: Failing tests:
  - POST /api/listings: missing `propertyType` → 400 `"Missing required fields"`; `yearBuilt` `"1400"` → 400 range message; `propertyType:"Land"`, no year → 201; `yearBuilt:"1952"` with the residential-sale template containing LPD(1978) → created checklist includes LPD with `builtBefore:1978`; `yearBuilt:"2005"` → no LPD; saved row has `yearBuilt:1952`, `propertyType`.
  - POST /api/transactions (non-referral): same year rules (propertyType already required); REFERRAL with no year → 201 unchanged.
  - Listing convert: new transaction gets the listing's `yearBuilt` and `propertyType`; year-item filter applied.
  - Deal convert / transfer unlock: year null → year items excluded (one test each).
- [ ] Step 2: Run — FAIL.
- [ ] Step 3: Implement: listing POST reads `yearBuilt`, `propertyType`, validates with `yearBuiltError` and requires `propertyType`; all five sites use `checklistTemplateWhere` + `checklistCreateData(fileType, template.items, yearBuilt)`.
- [ ] Step 4: Run tests + tsc — PASS.
- [ ] Step 5: Commit `feat: year-based items applied at file creation`.

### Task 5: Gates — Pending and Convert

**Files:**
- Modify: `apps/web/src/lib/transaction-helpers.ts` (`isReadyForPending` input gains `propertyType?: string | null; yearBuilt?: number | null`; `convertBlockedReason` input gains the same), `apps/web/src/lib/file-status.ts:60` message, `app/api/transactions/route.ts` (pass the two fields to `isReadyForPending`)
- Test: `__tests__/lib/transaction-helpers.test.ts` (or wherever these are tested — `rg -l isReadyForPending apps/web/src/__tests__`)

- [ ] Step 1: Failing tests: a fully-described non-referral tx with `propertyType:null` → `isReadyForPending` false; `propertyType:"Condo", yearBuilt:null` → false; `"Land", null` → true; `"Condo", 1990` → true; REFERRAL unchanged. `convertBlockedReason` on an ACTIVE listing with all docs but `propertyType:null, yearBuilt:null` → `"Add the property type and year built on the Overview before converting"`; only year missing → `"Add the year built on the Overview before converting"`; non-ACTIVE still returns the status message first; facts checked before the document count. Agent PATCH to PENDING on such a file → 400 with `"Add the property type, year built, price, dates, parties and commission this transaction needs before it can be Pending"`; ADMIN same request → allowed (override unchanged).
- [ ] Step 2: Run — FAIL.
- [ ] Step 3: Implement using `missingPropertyFacts`; callers already load full rows (verify `file-status.ts` and `maybeAutoPending` pass rows containing the fields).
- [ ] Step 4: Run tests + tsc — PASS.
- [ ] Step 5: Commit `feat: property type and year built gate Pending and Convert`.

### Task 6: Re-check on edit, linked files kept in step

**Files:**
- Create: `apps/web/src/lib/year-checklist-db.ts`
- Modify: `app/api/listings/[id]/route.ts` (fieldData accepts `propertyType`, `yearBuilt`), `app/api/transactions/[id]/route.ts`, `apps/web/src/lib/file-edit.ts` (`requiredFieldError`: year can't be cleared unless Land; validates range when present; listing `propertyType` can't be cleared), `components/transactions/ActivityFeed.tsx` (label `CHECKLIST_UPDATED: "Checklist updated"`), `lib/activity-detail.ts`
- Test: `__tests__/lib/year-checklist-db.test.ts` (mocked prisma, same style as other lib DB tests), extend listing/transaction PATCH tests, `activity-detail` test

**Interfaces — Produces:**
```ts
export async function recheckYearChecklist(kind: "listing" | "transaction", fileId: string, actor: { userId: string; role: "ADMIN" | "AGENT" }, reason: string): Promise<{ added: string[]; removed: string[] }>;
export async function applyPropertyFacts(kind: "listing" | "transaction", fileId: string, facts: { yearBuilt?: number | null; propertyType?: string | null }, actor: { userId: string; role: "ADMIN" | "AGENT" }): Promise<void>;
```
`recheckYearChecklist`: load file + checklist rows with `_count.documents`; return empty if `isFileLocked(kind, status)`; find template via `checklistTemplateWhere`; `planYearChecklistChange`; if all empty return without writing; else one `prisma.$transaction` doing creates (`checklistCreateData` for `add`), `deleteMany` for `removeIds`, updates for `requiredUpdates`, and one `fileActivity` `{ type: "CHECKLIST_UPDATED", payload: { reason, added: string[] /* shortItemName */, removed: string[] } }`.
`applyPropertyFacts`: called by both PATCH routes after their own update when the body changed `yearBuilt` or `propertyType`; finds the linked file (listing → `convertedFiles`; transaction → `originatingListingId`), writes the same facts to it if it isn't locked, then re-checks every touched file. `reason` copy: `"Year Built set to 1952"` / `"Year Built cleared"` / `"Property Type set to Land"`.
Activity detail text: `"{reason} — checklist added: LPD, Residential Earthquake Hazards Report"`, plus `"; removed: …"` when any removed.

- [ ] Step 1: Failing tests: re-check adds/removes/updates per plan in one transaction with one activity; second run writes nothing (Review Focus 2); locked file → no writes; linked closed transaction untouched while listing re-checks (RF 3); template's current `builtBefore` used (RF 5); listing PATCH `{yearBuilt:"1952"}` updates the linked open transaction's year; PATCH `{yearBuilt:""}` on a "Condo" → 400 `"Year Built is required"`; on "Land" → 200; `{yearBuilt:"3000"}` → 400 range; activity-detail renders the copy above.
- [ ] Step 2: Run — FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run tests + tsc — PASS.
- [ ] Step 5: Commit `feat: year built changes re-check the checklist on both linked files`.

### Task 7: Overview rows for listings

**Files:** Modify `components/transactions/OverviewTab.tsx` (listing block ~93), `app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx` and `app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx` only if their listing query/serialization drops the new fields.

- [ ] Step 1: In the listing block, after the "Type" row add Property Type (`kind: "select", options: FILE_PROPERTY_TYPES`) and Year Built (`restrict: (v) => digitsOnly(v, 4)`) rows, built exactly like the transaction rows at lines 110–113, using `show()`.
- [ ] Step 2: `tsc`, test suite, build — PASS. Manually confirm in dev (agent and admin listing page) the two rows show and save, and the transaction Year Built pencil still works.
- [ ] Step 3: Commit `feat: listing Overview shows Property Type and Year Built`.

### Task 8: Shared wizard pieces + New Transaction wizard

**Files:**
- Create: `apps/web/src/components/ui/OptionCard.tsx`, `apps/web/src/components/ui/SectionLabel.tsx` (moved verbatim from `new-transaction/page.tsx:834-855`), `apps/web/src/components/transactions/PropertyTypeSelect.tsx` (`{ value: string; onChange: (v: string) => void }` — label "Property Type" + `RequiredMark`, the select markup from `new-transaction/page.tsx:366-377` verbatim)
- Modify: `app/(dashboard)/dashboard/transactions/new-transaction/page.tsx`

- [ ] Step 1: Move the three pieces; the transaction page imports them; zero visual change.
- [ ] Step 2: Property step: swap to `Year Built | MLS Number` (Year Built left). Year Built: `required={needsYearBuilt(form.propertyType)}`, `restrict={(v) => digitsOnly(v, 4)}`, `error` = `yearBuiltError(...)` shown only once 4 digits are typed. MLS keeps placeholder "Optional". Pair stays side by side on phones (no `PHONE_FIELD_PAIR`).
- [ ] Step 3: `canAdvance` step 1 (line ~186, non-referral): also `!yearBuiltError(form.yearBuilt, form.propertyType)`; add both to the `useMemo` deps.
- [ ] Step 4: Test suite, tsc, build — PASS. Desktop pixel check of the File Type step at 1440: identical to before (only the Property step changes).
- [ ] Step 5: Commit `feat: shared wizard cards; Year Built required in New Transaction`.

### Task 9: New Listing wizard — Listing Type step + Listing Info

**Files:** Modify `app/(dashboard)/dashboard/transactions/new-listing/page.tsx`, `apps/web/src/lib/listing-wizard.ts`; Test `__tests__/lib/listing-wizard.test.ts`.

- [ ] Step 1: Failing tests for `canAdvanceListingStep` with the new indexes: step 0 = needs `listingType`; step 1 = address/city/zip/listPrice/dates as today plus `propertyType` and `!yearBuiltError(yearBuilt, propertyType)`; step 2 = sellers (old step 1 rule); step 3 = commission (old step 2); step 4 always true. Form type gains `propertyType: string; yearBuilt: string`.
- [ ] Step 2: Run — FAIL. Step 3: implement `listing-wizard.ts`.
- [ ] Step 4: Page: `listingType` starts `""`; `STEPS = ["Listing Type", "Listing Info", isLease ? "Landlords" : "Sellers", "Commission", "Review"]`; step 0 = four `OptionCard`s from `LISTING_TYPES`, `grid grid-cols-2 gap-4`, no heading; step 1 order: Property Address · City|State|ZIP · `grid grid-cols-2 gap-4 ${PHONE_FIELD_PAIR}` Year Built | `PropertyTypeSelect` · same grid List Price | MLS Number · List Date | Expiration Date (unchanged) · `PhotoUploadField`. Remove the Listing Type `<select>`. Shift the remaining step indexes. Review adds "Property Type" and "Year Built" rows. Submit sends both.
- [ ] Step 5: Run tests, tsc, build — PASS. Walk the wizard in dev at 1440 and 390 for one Residential Sale and one Commercial Lease listing, as agent and as admin; confirm Next gating and that the created listing shows the right checklist. Delete the test listings afterward (shared DB).
- [ ] Step 6: Commit `feat: New Listing wizard Listing Type step and Listing Info layout`.

### Task 10: Admin Checklists — built-before setting, black text

**Files:** Modify `app/api/admin/checklist-templates/[id]/items/route.ts`, `.../items/[itemId]/route.ts`, `components/transactions/ChecklistTemplateEditor.tsx`, `app/(dashboard)/admin/settings/checklists/page.tsx` (lines ~103, ~116); Test: the two routes (create test file if none).

- [ ] Step 1: Failing route tests: POST/PATCH accept `builtBefore` (number or null), reject `1400` with `builtBeforeError`'s message (400), still 403 for non-admin.
- [ ] Step 2: Run — FAIL. Step 3: implement routes.
- [ ] Step 4: Editor: each item row gets a small number input labelled "Only if built before" (placeholder "Any year", `digitsOnly(v,4)`, saves on blur via PATCH `builtBefore`, blank → null); Add Item form gets the same box. Add `text-[#1B1B1B]` to the two Add Item inputs and the two Create Template selects. All new inputs `text-[#1B1B1B]`.
- [ ] Step 5: Run `rg -n "<(input|select|textarea)" apps/web/src --glob "*.tsx"` and list files whose field class has no `text-` colour and doesn't inherit one; report the list to Ryan, change nothing else.
- [ ] Step 6: Tests, tsc, build — PASS. Commit `feat: admin built-before setting; black text on checklist forms`.

### Task 11: Bigger file-header photo

**Files:** Modify `components/transactions/FileHeaderPhoto.tsx`, `app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx` (~229–245), `app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx` (~153–169).

- [ ] Step 0: Before-screenshots of one listing and one transaction page (agent + admin) at 1440 and 390.
- [ ] Step 1: Move the status row (`<div className="mt-1 flex items-center gap-3">…`) inside `WithHeaderPhoto` on both pages so the photo sits beside address + status.
- [ ] Step 2: Photo `h-24 w-36` (96×144, same 3:2 shape) on desktop. Measure at 390 and 320: if the address wraps onto more lines than before, add `max-sm:h-14 max-sm:w-[84px]`; otherwise leave phones at the new size. Record which in the commit message.
- [ ] Step 3: Build; screenshot one listing and one transaction page (agent and admin) at 1440 and 390; confirm nothing else on the page moved (compare against before-screenshots taken in Step 0 of this task).
- [ ] Step 4: Commit `feat: file header photo spans address and status`.

### Task 12: Live rollout (shared DB — tell Ryan first)

**Files:** Create temporary `apps/web/src/app/api/cron/year-built-rollout/route.ts` (CRON_SECRET bearer, like the other crons). **Never commit it**; delete after running.

The route, idempotent, returns a JSON report:
1. For each seed template id (`seed-res-sale-listing`, `seed-res-sale-buyer`, `seed-res-sale-seller`, `seed-dual-agency`, `seed-res-lease`, `seed-res-lease-tenant`, `seed-res-lease-landlord`, `seed-lease-dual-agency`, `seed-commercial-sale-listing`, `seed-commercial-purchase`, `seed-commercial-listing-tx`, `seed-commercial-dual`): upsert by name to match Task 3's arrays (add missing year items with `builtBefore`, update LPD/WHSD/DBD fields). Never delete template items.
2. Open (not locked) files: rename WHSD rows → new name, `isRequired:false`; DBD rows → new description; LPD rows → `builtBefore:1978`. Never delete rows.
3. Foster Road listing `cmvivu9290001n3iejhf2jtap`: `yearBuilt: 1952, propertyType: "Single Family"` via `applyPropertyFacts` (so its linked transaction, if any, follows and both re-check).
4. Every other open listing/transaction with a non-null `yearBuilt`: `recheckYearChecklist(kind, id, systemActor, "Year Built set to {year}")`.

- [ ] Step 0: Read-only drift check before building the route: a throwaway node script in `packages/database/` lists each template's live item names/required flags; diff against `git show <BASE>:packages/database/prisma/checklist-templates.ts`. If any differ, stop and report to Ryan.
- [ ] Step 1: Ask Ryan to confirm the go-ahead (it is live immediately).
- [ ] Step 2: Run it once in dev; save the report; run it a second time — expect a report with zero changes (idempotent).
- [ ] Step 3: Verify in the DB: Foster Road has LPD and the earthquake report; WHSD optional; DBD description new.
- [ ] Step 4: Delete the route; `git status` shows it never staged.

### Task 13: Final verification + targeted speed check

- [ ] Step 1: `pnpm --filter web test`, `tsc --noEmit`, clean `build` — all pass; record counts.
- [ ] Step 2: Speed check, targeted only (no whole-site sweep). Baseline: update the existing worktree `C:\Users\hey_r\Desktop\CnC-old` to this plan's BASE commit (`git -C C:/Users/hey_r/Desktop/CnC-old checkout --detach <BASE>`), build it, serve on :3100; new build on :3101 (`next start <abs app dir> -p …`, confirm BUILD_ID). Using `.superpowers/pf-survey/filesPF.cjs` (signed-in) / `speedAB.cjs`, measure 5 runs each at 1440 and 390 for: `/dashboard/transactions`, one listing file page, one transaction file page, `/dashboard/transactions/new-listing`, `/dashboard/transactions/new-transaction`, `/admin/settings/checklists`. Pass: median server time and load within +10% of old. Report a small table.
- [ ] Step 3: Desktop pixel check at 1440 of `/dashboard/transactions` (unchanged page): identical to old.
- [ ] Step 4: Final whole-branch review (fresh reviewer), one fix pass for Critical/Important.
- [ ] Step 5: Hand Ryan a short list to click through himself: one New Listing (agent), one New Transaction with Land (admin), Foster Road's checklist, the admin "Only if built before" box. Do not push until he says so.
