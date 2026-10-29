# Checklist AD fix, listing-document rows, and Dual at Convert — Design

Date: 2026-10-28. Status: draft for Ryan's approval. Covers listings AND transactions, agent AND admin,
residential AND commercial, desktop AND phone.

## Why

1. **AD is asked for twice.** The Agency Disclosure (AD) is already printed on pages 1–2 of the RLA, RLAN, RLASR, CLA,
   BRBC, RPA, and CPA. Every template still has a separate required AD row, so agents upload the same pages twice
   or get blocked. (LL and RLMM do not carry the AD.)
2. **Files entered directly never ask for the listing agreement.** A Listing or Dual transaction created in the
   New Transaction wizard (not converted from a CnC listing) has no RLA/LL/CLA row, so the brokerage never collects
   the listing agreement for that deal.
3. **Convert can't make a Dual file.** `api/listings/[id]/convert/route.ts` hardcodes the side (LISTING or
   LEASE_LANDLORD). It was built 2026-05-19, before Dual existed; the Dual types were added 2026-07-11 and Convert was
   never updated. An agent who lists a home and also brings the buyer has no correct path.
4. **A wrong pick can't be fixed.** `transactionSide` can't be changed after a file exists. The only way out today is
   request cancellation → broker approves → convert again → re-upload documents, which leaves a dead canceled file.

How SkySlope does it (read via their help articles, see "Prior art"): no Dual at listing creation (correct — Dual only
exists once a buyer exists), the file type is picked at conversion, and a wrong type can be changed afterward.

## Goals

- AD row stops blocking files where the AD is already inside another form.
- Directly-entered Listing/Dual (sale and lease, residential and commercial) files require the listing agreement.
- Converted files never ask again for documents already collected on the listing.
- Convert asks who the file represents and builds the matching file.
- An admin can correct the representation afterward without losing documents.

## Non-goals

- No change to the New Listing wizard (a listing can't be Dual — no buyer exists yet).
- No change to the New Transaction wizard's choices.
- No change to Deal convert (`api/deals/[id]/convert`) or the transfer-unlock path.
- No copying of documents from the listing to the transaction.
- No change to how fees are calculated (`commission.ts` already handles DUAL ×2 and the flat lease fee).
- Representation changes between sale and lease, or to/from Referral, are out of scope.

## Anti-goals (would be a failure even if it "works")

- Any document an agent uploaded disappears or is detached.
- An agent can change the representation (and so the brokerage fee) on their own.
- Desktop pages change in any way not listed here.
- Running the full seed against the shared Neon DB (local and prod share it).

## Constraints

- Local dev and production share one Neon database: the template change is a targeted one-time data update plus the
  seed file; never the full seed.
- Reuse shared pieces: `OptionCard`, `PHONE_POPUP_FRAME`/`PHONE_POPUP_PANEL`, the `AssignLeadModal` pop-up pattern,
  `checkOwnership`/`requireAuth`, `checklistTemplateWhere`, `checklistCreateData`.
- Desktop untouchable except the pieces described here; check phone sizes too.
- Ask Ryan before any placement/cosmetic change not described here; ask before every push.

## Decisions (Ryan's)

### Fix 1 — AD becomes optional, everywhere

- Every AD row is renamed **"AD — Agency Disclosure (if not already included)"** and set to optional
  (`isRequired: false`). No description/notes shown under the name. The broker's review is the safety net.
- The 10 templates with an AD row: Residential Sale listing, Residential Lease listing, Purchase (residential buyer),
  Listing (residential seller transaction), Dual, Lease Tenant, Lease Landlord, Lease Dual, Commercial Dual,
  Commercial Lease Dual.
- Foster Road's existing AD row (listing `cmvivu9290001n3iejhf2jtap`, no documents) gets the same rename + optional.
- **Position:** optional AD must sit below the required documents. File pages already sort required first
  (`FILE_DETAIL_INCLUDE`). The template `order` of AD also moves to just after the last required item, so the admin
  Checklists editor shows the same order.

### Fix 2 — listing-document rows on Listing/Dual transaction templates

Add these rows, required, at the **top** of the checklist (orders shifted down). Names copied exactly from the listing
templates:

| Template | Rows added |
|---|---|
| Listing (residential seller transaction) | RLA, AVID |
| Dual | RLA |
| Lease Landlord | LL |
| Lease Dual | LL |
| Commercial Listing (transaction) | CLA |
| Commercial Dual | CLA |
| Commercial Lease Landlord | CLA |
| Commercial Lease Dual | CLA |

Exact names: "RLA — Residential Listing Agreement (Exclusive)", "AVID — Agent Visual Inspection Disclosure",
"LL — Lease Listing Agreement (Exclusive Authorization to Lease or Rent)", "CLA — Commercial/Residential Income and
Vacant Land Listing Agreement". (Dual already has an AVID row — it isn't added again.)

### Fix 3 — "Skip when converted from a CnC listing"

- New per-item setting on checklist template items. When a transaction is created by **Convert**, items with it ticked
  are not created.
- Rule for ticking: the document is already on the listing checklist **and** the buyer/tenant never signs it.
- **Ticked by the build** (Ryan doesn't tick anything himself): every row added in Fix 2, plus Dual's existing AVID
  row. Ryan ticks it himself only on items he adds later.
- Admin Checklists editor: a checkbox labelled "Skip when converted from a CnC listing", **right next to the "Only if
  built before" box on each row** (Ryan approved the placement).
- Known limit, accepted: an agent with a CnC listing who uses the New Transaction wizard instead of Convert will be
  asked for the RLA again.

### Dual at Convert — the pop-up

- Clicking **Convert to Transaction** (agent and admin listing pages; both use `ConvertListingButton`) opens a
  **pop-up centered on the page**, page dimmed behind it. Nothing is created until the agent confirms.
- Title "Convert to Transaction", question "Who will this transaction represent?", two choice cards (the wizard's
  `OptionCard`):

  | Listing being converted | Card 1 | Card 2 |
  |---|---|---|
  | Residential/Commercial Sale | Listing — "Seller only" | Dual — "Seller and buyer" |
  | Residential/Commercial Lease | Lease Landlord — "Landlord only" | Lease Dual — "Landlord and tenant" |

- **No card is picked by default; the Convert button is greyed out until a card is clicked.** Cancel and ✕ close it
  with no change.
- Phone: the pop-up fills most of the screen and the cards stack (existing `PHONE_POPUP_*` classes).
- The existing blocked-reason tooltip on the Convert button is unchanged (the pop-up only opens when Convert is
  allowed).

What the convert does with the choice:

- `transactionSide` = the chosen value; `propertyCategory` as today.
- Checklist = the matching template (`checklistTemplateWhere` with the chosen side) **minus items marked "Skip when
  converted"**, built with `checklistCreateData` as today (year-based rows still apply).
- Commission: `convertedCommission(listing, side)` as today. For Dual the listing commission lands on the listing side
  and the buyer-side commission is entered by the agent afterward. Dual ×2 fee and the flat lease fee come from
  `commission.ts` automatically.
- Parties: sellers/landlords carried over as today. For Dual/Lease Dual the agent adds the buyer/tenant afterward;
  Pending already requires both sides (`sidePartiesReady`).
- Listing ↔ transaction link and status sync: unchanged.

### "Change representation" — admin only

- A setting on a transaction file that switches the representation **within its group** (Ryan, 2026-10-28):
  - Sale: any change between Purchase, Listing, and Dual.
  - Lease: any change between Lease Tenant, Lease Landlord, and Lease Dual.
  - Never sale ↔ lease, never to/from Referral (same limit as SkySlope, which can't change lease files at all).
  - Residential and commercial. Works on any such file, converted or entered directly (also catches wrong picks
    in the New Transaction wizard).
- **Any admin account** can use it (role check, not a specific user). Agents can't; they ask an admin.
- Not allowed on finished files (Closed, Canceled, Canceled-approved, Archived).
- What it does:
  - Sets the new `transactionSide`.
  - Brings the checklist in line with the new type's template (skipping "Skip when converted" items if the file has
    an `originatingListingId`, applying year-based rules): rows the new type needs are added; rows the new type
    doesn't have are removed **only if they have no document**; rows with a document always stay. Matching rows take
    the new template's required/optional setting.
  - Fee changes by itself (computed from the side). The stored gross (`commissionGCI`) is recomputed with
    `resolveCommission(newSide, …)`: Purchase counts the selling side, Listing the listing side, Dual and the lease
    sides both. Commission values already entered are kept (a side the new type doesn't use is just not shown or
    counted).
  - Rows are matched between the file and the template by name (same as the year re-check).
  - Writes one Activity entry: which admin, from what, to what, and the checklist rows added/removed.
- Why admin-only (Ryan): it changes the brokerage fee (Dual doubles it). Same spirit as agents not being able to change
  commission during broker review.

## Prior art (SkySlope, support.skyslope.com)

- "Convert a Listing to a Transaction" (156000366436): Accepted Contract → full Create Transaction workflow.
- "Creating Double-Ended Transactions" (156000366451): pick File Type "Both Purchase & Listing" / "Both Lease Tenant &
  Landlord" on the converted file, or keep two separate files.
- "Change Your Checklist Type" (156000366441): the **agent** changes it from a dropdown; all documents get detached
  and must be reattached; sale types switch freely, but lease files can't be changed at all (support recreates them).
  CnC is deliberately stricter on who (admin only), keeps documents, and also allows switches between lease types.

## Data changes

- Schema: `ChecklistTemplateItem.skipWhenConverted Boolean @default(false)` (one migration). File checklist rows don't
  need it.
- Seed file (`packages/database/prisma/checklist-templates.ts`): Fix 1 renames/optional/order, Fix 2 rows, Fix 3 flags.
- One-time live data update (script, not the full seed): apply the same to the 17 live templates (matched by seed id +
  item name — the live DB was verified to match the seed exactly), and to Foster Road's AD row. Zero transaction files
  exist today.
- API: Convert takes the chosen side in the request body; anything not allowed for that listing type → 400.

## Tests (must exist)

- Template data: AD name/optional/order on all 10 templates; Fix 2 rows present, required, first; skip flags exactly on
  the listed rows.
- Convert: each listing type × each allowed side creates the right side/category/checklist (skip rows absent);
  disallowed or missing side → 400; agent and admin; commission placement for Dual and Lease Dual.
- Change representation: admin allowed, agent 403; finished file refused; sale ↔ lease and Referral refused; every
  in-group switch (e.g. Purchase → Dual, Listing → Purchase, Lease Tenant → Lease Dual) accepted; rows added; empty
  rows removed; rows with documents kept; skip rules respected on converted files; Activity entry written.
- Year re-check (`planYearChecklistChange`) unaffected by the new rows.
- Admin editor saves the new checkbox.
- Usual gates: full suite, `tsc --noEmit`, a clean production build; desktop pixel check of touched pages; phone check
  of the pop-up.

## Left to the builder (my calls, for Ryan to check)

- Long dash (—) in the AD name; new Fix 2 rows at the top.
- Pop-up visual style follows `AssignLeadModal` (white card, gold Convert, outlined Cancel); errors show inside the
  pop-up.
- The "Skip when converted" checkbox shows only on transaction templates (listing templates are never converted to).
- Change representation is the pencil on the existing **"Transaction Side"** row of the Overview tab
  (`OverviewTab.tsx:119`, shared by the agent and admin file pages; transaction files only), shown to admins only;
  clicking it offers the other types in the file's group and a confirm. Agents see the row with no pencil.
  (Ryan approved, 2026-10-28.)
- The "Skip when converted" checkbox lives in `ChecklistTemplateEditor.tsx` beside the existing built-before box.
- Change representation is allowed on Pending files too (admin's judgment); parties already on the file are kept
  as-is when switching.
- Whether it's a new endpoint or part of the existing transaction update route.
