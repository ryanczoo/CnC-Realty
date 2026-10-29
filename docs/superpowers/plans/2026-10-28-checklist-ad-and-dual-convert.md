# Checklist AD Fix, Listing-Document Rows, and Dual at Convert — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AD row optional everywhere, require the listing agreement on directly-entered Listing/Dual files, let Convert build a Listing or Dual file from a pop-up, and let an admin correct a file's representation afterward.

**Architecture:** Template contents change in the seed arrays and one new per-item flag (`skipWhenConverted`). Pure rules go in a new `lib/representation.ts` (which sides Convert offers, which switches are allowed, what a switch does to a checklist). Convert and a new admin-only `POST /api/transactions/[id]/representation` route use those rules; the UI reuses `OptionCard`, the `AssignLeadModal` pop-up pattern, and `InfoRow`'s select edit.

**Tech Stack:** Next.js 14 App Router, Prisma 5 (Neon Postgres), Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-28-checklist-ad-and-dual-convert-design.md`

**BASE commit:** `8ae58794` (the approved spec).

## Global Constraints

- Local dev and production share ONE Neon database: a migration or data script is live the moment it runs. Never run `prisma/seed.ts`. Tell Ryan before the migration (Task 1) and the rollout (Task 9).
- AD name, exactly: `AD — Agency Disclosure (if not already included)`, `isRequired: false`, `description: null`.
- Fix 2 row names copied exactly from the listing arrays (RLA, AVID, LL, CLA strings in `checklist-templates.ts`).
- Reuse shared pieces: `OptionCard`, `SIDES` (types/transaction.ts), `PHONE_POPUP_FRAME`/`PHONE_POPUP_PANEL`, `PULSE_ANIMATE`/`PULSE_TRANSITION`/`SPRING_HOVER`, `InfoRow`, `checklistTemplateWhere`, `checklistCreateData`, `builtBeforeApplies`, `resolveCommission`, `requireAuth`, `checkOwnership`.
- Change representation: any ADMIN role (not a specific user); agents never.
- Desktop pages change only where this plan says. Every UI change works at 1440 and at 390/320.
- Every task ends green: `pnpm --filter web test`, `pnpm --filter web exec tsc --noEmit`. Tasks touching UI or routes also run a clean build (`rm -rf apps/web/.next && pnpm --filter web build`) — stop the dev server first.
- Ask Ryan before any push.

## Review Focus

1. **Convert with no or a bad side in the body** (old cached page, crafted request) → 400 with a clear message, nothing created. Test in Task 5.
2. **A sale listing sent a lease side (or the reverse)** → 400. Test in Task 5.
3. **Change representation removing a row that has a document** → row kept, never deleted. Test in Tasks 4 and 6.
4. **A converted file switched later** (e.g. Dual → Listing) must not get RLA/AVID added back → skip rules apply when `originatingListingId` is set. Test in Tasks 4 and 6.
5. **Double-click on Convert in the pop-up** → one transaction only (button disabled while converting). Test in Task 7 (manual) — the route already refuses a second convert because the listing leaves ACTIVE.

---

### Task 1: Schema — skip flag + activity type

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (`ChecklistTemplateItem`, `enum FileActivityType`)
- Create: `packages/database/prisma/migrations/20261028120000_skip_when_converted/migration.sql`

**Interfaces:**
- Produces: `ChecklistTemplateItem.skipWhenConverted: boolean` (default false); `FileActivityType.REPRESENTATION_CHANGED`.

- [ ] Step 1: Add `skipWhenConverted Boolean @default(false)` to `ChecklistTemplateItem`; add `REPRESENTATION_CHANGED` to `FileActivityType`.
- [ ] Step 2: Write the migration SQL by hand (additive only): `ALTER TABLE "ChecklistTemplateItem" ADD COLUMN "skipWhenConverted" BOOLEAN NOT NULL DEFAULT false;` and `ALTER TYPE "FileActivityType" ADD VALUE 'REPRESENTATION_CHANGED';`.
- [ ] Step 3: Tell Ryan the migration is about to go live (additive; old code unaffected). Stop the dev server, then `pnpm --filter @cnc/database exec prisma migrate deploy` and `prisma generate`.
- [ ] Step 4: `tsc --noEmit` passes. Commit `feat(db): skipWhenConverted on template items, REPRESENTATION_CHANGED activity`.

### Task 2: Template contents (seed arrays)

**Files:**
- Modify: `packages/database/prisma/checklist-templates.ts`, `packages/database/prisma/seed.ts` (`upsertTemplate` writes `skipWhenConverted ?? false`)
- Test: `apps/web/src/__tests__/lib/checklist-templates.test.ts`

**Interfaces:**
- Produces: every exported array's items may carry `skipWhenConverted?: true`. Exported `AD_ITEM_NAME = "AD — Agency Disclosure (if not already included)"`.

Ordering rule for every array that changes: Fix 2 rows first, then the remaining required items in their current relative order, then AD, then the remaining optional items in their current relative order; `order` renumbered 1..n with no gaps. A shared `const AD = { name: AD_ITEM_NAME, description: null, isRequired: false }` replaces every AD literal (10 arrays: RESIDENTIAL_SALE_LISTING, RESIDENTIAL_SALE_BUYER, RESIDENTIAL_SALE_SELLER, RESIDENTIAL_LEASE_LISTING, RESIDENTIAL_LEASE_TENANT, RESIDENTIAL_LEASE_LANDLORD, DUAL_AGENCY, LEASE_DUAL_AGENCY, COMMERCIAL_DUAL, COMMERCIAL_LEASE_DUAL). Shared `RLA`, `AVID`, `LL`, `CLA` consts (name + the listing array's description) are reused by the listing arrays and the Fix 2 rows.

Fix 2 rows (required, `skipWhenConverted: true`): RESIDENTIAL_SALE_SELLER ← RLA, AVID · DUAL_AGENCY ← RLA (plus its existing AVID gets `skipWhenConverted: true` and moves up with it) · RESIDENTIAL_LEASE_LANDLORD ← LL · LEASE_DUAL_AGENCY ← LL · COMMERCIAL_LISTING_TX ← CLA · COMMERCIAL_DUAL ← CLA · COMMERCIAL_LEASE_LANDLORD ← CLA · COMMERCIAL_LEASE_DUAL ← CLA.

- [ ] Step 1: Write failing tests:
  - `it("AD is optional, renamed, description-free on all 10 templates")` — for each of the 10 arrays, exactly one item named `AD_ITEM_NAME`, `isRequired === false`, `description === null`; no item anywhere still named `"AD — Disclosure Regarding Real Estate Agency Relationships"`.
  - `it("AD sits below every required item and above the other optional items")` — per array: every required item's `order` < AD's; AD's < every other optional item's.
  - `it("orders are 1..n with no gaps")` — every exported array.
  - `it("listing-document rows lead the eight templates")` — per the table above, `arr.slice(0, k).map(i => i.name)` equals the expected names (DUAL_AGENCY: `[RLA, AVID]`), each `isRequired && skipWhenConverted`.
  - `it("only the listing-document rows skip on convert")` — the set of `skipWhenConverted` names across all arrays is exactly {RLA, AVID, LL, CLA} and appears only in the eight transaction arrays.
- [ ] Step 2: Run `pnpm --filter web test checklist-templates` — FAIL.
- [ ] Step 3: Edit the arrays per the rules above; `seed.ts` passes `skipWhenConverted: i.skipWhenConverted ?? false` in create/update.
- [ ] Step 4: Run the test — PASS; existing year-checklist tests still pass.
- [ ] Step 5: Commit `feat(checklists): optional AD, listing-document rows, skip-on-convert flags`.

### Task 3: Admin Checklists editor — "Skip when converted from a CnC listing"

**Files:**
- Modify: `apps/web/src/app/api/admin/checklist-templates/[id]/items/route.ts` (POST), `.../items/[itemId]/route.ts` (PATCH), `apps/web/src/components/transactions/ChecklistTemplateEditor.tsx`, `apps/web/src/app/(dashboard)/admin/settings/checklists/page.tsx` (pass `fileType`)
- Test: `apps/web/src/__tests__/api/admin-checklist-template-items.test.ts`

**Interfaces:**
- Produces: POST/PATCH accept `skipWhenConverted?: boolean`; editor prop `fileType: "LISTING" | "TRANSACTION"`.

- [ ] Step 1: Failing tests: `PATCH saves skipWhenConverted true`, `POST defaults skipWhenConverted to false`, `POST saves skipWhenConverted true`, `PATCH rejects a non-boolean skipWhenConverted with 400` (body `{ skipWhenConverted: "yes" }`).
- [ ] Step 2: Run — FAIL.
- [ ] Step 3: Routes: validate `typeof === "boolean"` when present, else 400 `"skipWhenConverted must be true or false"`; write it. Editor: when `fileType === "TRANSACTION"`, a checkbox labelled `Skip when converted from a CnC listing` right after `BuiltBeforeBox` on each row (same `text-xs text-[#1B1B1B]/50` label style as "Required"), toggled via PATCH like `toggleRequired`; same checkbox in the add-item form beside "Only if built before". Checklists page passes the template's `fileType`.
- [ ] Step 4: Tests PASS; build passes. At 1440 and 390, open `/admin/settings/checklists`, one transaction and one listing template: checkbox shows only on the transaction one; rows don't overflow at 390 (they wrap like today).
- [ ] Step 5: Commit `feat(admin): skip-when-converted checkbox on checklist items`.

### Task 4: Representation rules (pure)

**Files:**
- Create: `apps/web/src/lib/representation.ts`
- Modify: `apps/web/src/lib/year-checklist.ts` (`TemplateItemLike` gains `skipWhenConverted?: boolean`)
- Test: `apps/web/src/__tests__/lib/representation.test.ts`

**Interfaces:**
- Consumes: `TemplateItemLike`, `FileRowLike`, `builtBeforeApplies` from `lib/year-checklist.ts`; `TransactionSide` from types.
- Produces:
  - `convertSideChoices(listingType: string): ["LISTING","DUAL"] | ["LEASE_LANDLORD","LEASE_DUAL"]` — lease for `RESIDENTIAL_LEASE`/`COMMERCIAL_LEASE`, sale otherwise.
  - `representationGroup(side: string): readonly TransactionSide[] | null` — `["PURCHASE","LISTING","DUAL"]`, `["LEASE_TENANT","LEASE_LANDLORD","LEASE_DUAL"]`, or null (REFERRAL/unknown).
  - `canChangeRepresentation(from: string, to: string): boolean` — same non-null group and `from !== to`.
  - `templateItemsForFile(items: TemplateItemLike[], converted: boolean): TemplateItemLike[]` — drops `skipWhenConverted` items when `converted`.
  - `planRepresentationChange(items: TemplateItemLike[], rows: FileRowLike[], yearBuilt: number | null): { add: TemplateItemLike[]; removeIds: string[]; requiredUpdates: { id: string; isRequired: boolean }[] }` — target = `items` filtered by `builtBeforeApplies`; add target items whose name has no row; remove rows whose name isn't in target **and** `documentCount === 0`; for rows matching a target item by name whose `isRequired` differs, a required update. (Callers pass already-filtered items.)

- [ ] Step 1: Failing tests (names → assertions):
  - `convertSideChoices` for each of the 4 listing types.
  - `canChangeRepresentation`: true for PURCHASE→DUAL, LISTING→PURCHASE, LEASE_TENANT→LEASE_DUAL; false for LISTING→LEASE_DUAL, REFERRAL→PURCHASE, DUAL→REFERRAL, DUAL→DUAL.
  - `templateItemsForFile` drops RLA when converted, keeps it when not.
  - `planRepresentationChange`: adds missing items; removes an empty row not in target; **keeps a row with a document not in target** (not in removeIds); flips required on a matching row; ignores a year item whose `builtBefore` doesn't apply (not added).
- [ ] Step 2: Run — FAIL. Step 3: implement. Step 4: PASS.
- [ ] Step 5: Commit `feat: representation rules (convert choices, allowed switches, checklist plan)`.

### Task 5: Convert route takes the chosen side

**Files:**
- Modify: `apps/web/src/app/api/listings/[id]/convert/route.ts`
- Test: `apps/web/src/__tests__/api/listings-convert.test.ts`

**Interfaces:**
- Consumes: `convertSideChoices`, `templateItemsForFile` (Task 4).
- Produces: `POST /api/listings/[id]/convert` with JSON body `{ transactionSide: string }`.

- [ ] Step 1: Update existing tests to send a body; add failing tests:
  - `creates a DUAL file from a residential sale listing` (side, category RESIDENTIAL, template looked up with side DUAL).
  - `creates a LEASE_DUAL file from a residential lease listing`; `creates COMMERCIAL + LISTING from a commercial sale listing`.
  - `leaves skip-on-convert items off the checklist` (template mock includes an RLA item with `skipWhenConverted: true`; created checklist has no RLA).
  - `400 when transactionSide is missing`, `400 when the body isn't JSON`, `400 when a sale listing is sent LEASE_DUAL` — and `prisma.$transaction` not called.
  - `DUAL puts the listing commission on the listing side` (`convertedCommission` result: `listingCommissionPct` set, `saleCommissionPct` null).
- [ ] Step 2: Run — FAIL.
- [ ] Step 3: Read the body after the ownership/blocked checks; side must be in `convertSideChoices(listing.listingType)` else 400 `"Choose who this transaction represents."`; template via `checklistTemplateWhere("transaction", { transactionSide, propertyCategory })`; checklist from `checklistCreateData("TRANSACTION", templateItemsForFile(template.items, true), listing.yearBuilt)`. Everything else unchanged.
- [ ] Step 4: PASS. Commit `feat(convert): build a Listing or Dual file from the chosen side`.

### Task 6: Change-representation route (admin only)

**Files:**
- Create: `apps/web/src/app/api/transactions/[id]/representation/route.ts`
- Test: `apps/web/src/__tests__/api/transactions-representation.test.ts`

**Interfaces:**
- Consumes: `canChangeRepresentation`, `templateItemsForFile`, `planRepresentationChange` (Task 4); `resolveCommission`; `checklistCreateData`; `shortItemName`; `FileActivityType.REPRESENTATION_CHANGED` (Task 1).
- Produces: `POST /api/transactions/[id]/representation`, body `{ transactionSide }` → 200 `{ transactionFile }`.

- [ ] Step 1: Failing tests:
  - `403 for an AGENT` (even the file's own agent); `401 signed out`; `404 unknown id`.
  - `400 for a finished file` — each of CLOSED, CANCELED, CANCELED_APPROVED, ARCHIVED: `"This file is finished and can't be changed."`
  - `400 for sale↔lease and Referral` (`"That change isn't allowed."`).
  - `LISTING → DUAL adds the Dual rows, keeps a row with a document, removes an empty row Dual doesn't have`.
  - `a converted file (originatingListingId set) switching DUAL → LISTING doesn't add RLA/AVID`.
  - `recomputes commissionGCI for the new side` (LISTING→DUAL with both sides entered: GCI = sale + listing; DUAL→PURCHASE: GCI = sale only).
  - `writes one REPRESENTATION_CHANGED activity` with payload `{ from, to, added: string[], removed: string[] }` (short names) and the admin's id.
- [ ] Step 2: Run — FAIL.
- [ ] Step 3: `requireAuth("ADMIN")`; load file with checklist rows + `_count.documents`; finished set as above; template via `checklistTemplateWhere("transaction", { transactionSide: to, propertyCategory })`; plan; one `prisma.$transaction`: update `transactionSide` + `resolveCommission(to, price ?? 0, inputs)` (price = `leasePrice` for lease sides else `salePrice`; inputs from the file's four commission fields), createMany added rows (`checklistCreateData`), deleteMany removeIds, update required flags, create activity.
- [ ] Step 4: PASS. Commit `feat: admin-only change representation on transaction files`.

### Task 7: Convert pop-up

**Files:**
- Create: `apps/web/src/components/transactions/ConvertListingModal.tsx`
- Modify: `apps/web/src/components/transactions/ConvertListingButton.tsx` (opens the modal; new prop `listingType: string`), both listing pages that render it (`app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx:253`, `app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx:182`) pass `listingType={listing.listingType}`
- Test: `apps/web/src/__tests__/components/ConvertListingModal.test.ts` (pure helper only — no component-render infra exists)

**Interfaces:**
- Consumes: `convertSideChoices` (Task 4), `SIDES`, `OptionCard`, popup classes.
- Produces: `convertChoiceCards(listingType: string): { value: string; label: string; desc: string }[]` exported from the modal file's sibling `lib/convert-choices.ts` (so it's testable) — the two `SIDES` entries for `convertSideChoices(listingType)`, in that order.

- [ ] Step 1: Failing test: `convertChoiceCards("RESIDENTIAL_SALE")` → Listing + "Both Purchase & Listing" (labels/descs from `SIDES`); `"COMMERCIAL_LEASE"` → Lease Landlord + "Both Lease Tenant & Landlord".
- [ ] Step 2: FAIL → implement `lib/convert-choices.ts` → PASS.
- [ ] Step 3: Modal, following `AssignLeadModal`'s frame: `fixed inset-0 z-50 … bg-black/40 ${PHONE_POPUP_FRAME}` / `max-w-lg rounded-2xl bg-white p-6 shadow-2xl ${PHONE_POPUP_PANEL}`. Title `Convert to Transaction` with a ✕ (`XIcon`), line `Who will this transaction represent?`, two `OptionCard`s in `grid grid-cols-2 gap-3 max-sm:grid-cols-1`, nothing selected at start. Buttons like AssignLeadModal: gold pulsing `Convert` (disabled until a card is picked and while converting, shows "Converting…"), outlined `Cancel`. POST the chosen side; error text shown inside the modal; success calls `onConverted(id)`. Escape and ✕/Cancel close without changes. Button: clicking opens the modal (blocked-reason tooltip unchanged).
- [ ] Step 4: Build; on Foster Road (agent page and admin page) at 1440 and 390: pop-up centered, cards side by side at 1440 and stacked at 390, Convert greyed until a pick, Cancel closes. **Do not click Convert on Foster Road.** Rapid double-click check is done in Task 10 on a throwaway listing.
- [ ] Step 5: Commit `feat(convert): representation pop-up`.

### Task 8: Overview pencil + Activity line

**Files:**
- Modify: `apps/web/src/components/transactions/OverviewTab.tsx` (row at line 119; new prop `canChangeRepresentation?: boolean`; update the header comment), the two file pages (admin page passes `true`; agent page passes `viewerIsAdmin`), `apps/web/src/components/transactions/ActivityFeed.tsx`
- Modify: `apps/web/src/lib/file-actions.ts` — add `changeRepresentation(fileId: string, transactionSide: string): Promise<string | null>` (returns error text or null, like `saveFileField`)
- Test: `apps/web/src/__tests__/lib/file-actions.test.ts` (or the existing file-actions test file), `apps/web/src/__tests__/components/ActivityFeed.test.ts` if an ActivityFeed helper test exists; otherwise test the pure line-builder.

**Interfaces:**
- Consumes: `representationGroup` (Task 4), `transactionSideLabel`, route from Task 6.

- [ ] Step 1: Failing tests: `changeRepresentation` POSTs `{ transactionSide }` to `/api/transactions/{id}/representation` and returns the server error text on non-2xx; the activity line for `REPRESENTATION_CHANGED` reads `Changed representation from Listing to Both Purchase & Listing` (labels via `transactionSideLabel`), plus `Added: RLA` / `Removed: …` when present (match the existing CHECKLIST_UPDATED line style).
- [ ] Step 2: FAIL → implement → PASS.
- [ ] Step 3: Row: when `canChangeRepresentation` and the side has a group and the file isn't finished, pass `edit={{ kind: "select", raw: currentLabel, options: group labels, onSave }}` (map label → side value; saving the current value is a no-op); otherwise display-only as today. `onSave` calls `changeRepresentation` then `onSaved()`.
- [ ] Step 4: Build; check at 1440 and 390 on a throwaway transaction (Task 10 creates it): admin sees the pencil, agent account doesn't.
- [ ] Step 5: Commit `feat: admin pencil to change representation, activity line`.

### Task 9: Live rollout (shared DB — tell Ryan first)

**Files:** Create temporary `apps/web/src/app/api/cron/checklist-ad-rollout/route.ts` (CRON_SECRET bearer, like the other crons). **Never commit it**; delete after running.

Idempotent route returning a JSON report:
1. For each of the 17 seed template ids (`seed-res-sale-listing`, `seed-res-sale-buyer`, `seed-res-sale-seller`, `seed-res-lease`, `seed-res-lease-tenant`, `seed-res-lease-landlord`, `seed-dual-agency`, `seed-lease-dual-agency`, `seed-referral`, `seed-commercial-sale-listing`, `seed-commercial-lease-listing`, `seed-commercial-purchase`, `seed-commercial-listing-tx`, `seed-commercial-dual`, `seed-commercial-lease-tenant`, `seed-commercial-lease-landlord`, `seed-commercial-lease-dual`): rename the old AD item to the new name/optional/description null; add missing Fix 2 rows; set `order`, `isRequired`, `skipWhenConverted` on every item to match the Task 2 arrays (matched by name). Never delete template items.
2. Open listing/transaction files: rows named the old AD name → new name, `isRequired:false`, `description:null`. Never delete rows. (Today: only Foster Road `cmvivu9290001n3iejhf2jtap`.)

- [ ] Step 0: Read-only drift check: a throwaway node script in `packages/database/` lists each template's live item names/required flags; diff against `git show 8ae58794:packages/database/prisma/checklist-templates.ts`. Any difference → stop and report to Ryan.
- [ ] Step 1: Ask Ryan for the go-ahead (live immediately).
- [ ] Step 2: Run once; save the report; run again — expect zero changes.
- [ ] Step 3: Verify in the DB: Foster Road's AD row renamed + optional; `seed-dual-agency` starts RLA, AVID; AD below required items everywhere.
- [ ] Step 4: Delete the route and the throwaway script; `git status` shows neither staged.

### Task 10: End-to-end checks, targeted speed check, review

- [ ] Step 1: `pnpm --filter web test`, `tsc --noEmit`, clean build — all pass; record counts.
- [ ] Step 2: Live click-through (agent test account and admin, desktop 1440 and phone 390), creating throwaway files only:
  - New Listing wizard (residential sale): checklist has optional AD below the required rows.
  - New Transaction wizard → Listing (residential): checklist starts RLA, AVID; AD optional.
  - Create a throwaway sale listing, convert it as **Dual** via the pop-up (double-click Convert once to confirm a single file is created): checklist has no RLA/AVID, fee label "Dual ×2".
  - As admin, change that file Dual → Listing → Purchase via the pencil: rows follow, Activity shows the lines; agent account shows no pencil.
  - Delete all throwaway files afterward (same discipline as earlier sessions; no Deal linkage).
- [ ] Step 3: Targeted speed check only (no sweep): baseline worktree `C:\Users\hey_r\Desktop\CnC-old` → `git -C C:/Users/hey_r/Desktop/CnC-old checkout --detach 8ae58794`, build, serve on :3100; new build on :3101 (absolute app dir, confirm BUILD_ID). With `.superpowers/pf-survey/filesPF.cjs`/`speedAB.cjs`, 5 runs each at 1440 and 390 for: Foster Road listing page (agent), `/admin/settings/checklists`. Compare route first-load JS for the two file pages from the build output. Pass: median within +10% of old. Report a small table.
- [ ] Step 4: Desktop pixel check at 1440 of `/dashboard/transactions` (untouched): identical to old.
- [ ] Step 5: Final whole-branch review (fresh reviewer); one fix pass for Critical/Important.
- [ ] Step 6: Hand Ryan a short click-through list (the pop-up on Foster Road without converting, the admin Checklists checkbox, Foster Road's AD row). Do not push until he says so.
