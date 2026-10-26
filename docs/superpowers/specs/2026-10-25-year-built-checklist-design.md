# Year Built Checklist Rules — Design

**Date:** 2026-10-25 · **Approved by:** pending Ryan · **Repo:** C:/Users/hey_r/Desktop/CnC-Realty

## Why

Some California disclosures are required only for older homes. Today our checklists either leave them off (sale
files have no lead-paint form at all) or list them as "optional, required only if built before 1978" and trust the
agent to notice. Ryan wants the year a property was built to drive these forms automatically, so a 1952 house like
Foster Road gets the lead-paint and earthquake forms as required items and a 2005 house never sees them. Ryan's rule:
no temporary fixes; if we find an issue we fix it entirely.

The same project also folds in a checklist clean-up from the same research (WHSD, DBD wording) and two small fixes
Ryan found on the way (white text in the admin Checklists form, a bigger property photo in file headers).

## Goals

1. **Year Built is required** (red asterisk, the shared `RequiredMark`) in the New Listing wizard and the New
   Transaction wizard, for every listing type and every transaction side except Referral, **unless Property Type is
   "Land"**: then the asterisk goes away, the year may be left blank, and a blank year adds no year-based items.
   It is saved on listing files (new column) and transaction files (existing column), editable later on the file's
   Overview (agent and admin), and shown on each wizard's Review step.
1a. **Listings get a Property Type** (new `ListingFile` column, required in the wizard), using the same 11 options as
   transactions (`FILE_PROPERTY_TYPES`, no filtering by residential/commercial), editable on the listing's Overview.
1b. **Kept in step after Convert:** a listing's Year Built and Property Type are copied to its transaction on Convert,
   and a later change on either file updates both (same pattern as status), re-checks both checklists, and writes an
   Activity line on each.
1c. **New Listing wizard layout** (one page shared by agents and admins):
   - Steps become **Listing Type · Listing Info · Sellers (Landlords for leases) · Commission · Review**.
   - **Listing Type step:** four cards — Residential Sale, Residential Lease, Commercial Sale, Commercial Lease — two
     per row, same look as the Transaction wizard's cards, no heading. Nothing is preselected; Next stays disabled
     until one is picked. The Listing Type dropdown is removed.
   - **Listing Info step**, top to bottom: Property Address · City | State | ZIP · Year Built | Property Type ·
     List Price | MLS Number · List Date | Expiration Date · Upload Photo. On phones each pair stacks one per row
     (`PHONE_FIELD_PAIR`), as the date pair does today.
1d. **New Transaction wizard:** the first step keeps its name **"File Type"** (its "Transaction Type" heading over the
   side cards already exists). On the Property step, **Year Built and MLS Number switch places** — Year Built
   (required) on the left, MLS Number (still optional, grey "Optional" placeholder) on the right. MLS Number is not
   moved to Optional Info. The pair stays side by side on phones as today. Nothing else on the step changes.
1e. **Shared components:** the card (`OptionCard`) and small heading (`SectionLabel`) now live only inside the
   Transaction wizard page; they move to shared components used by both wizards. The Property Type dropdown is
   extracted the same way. Everything else (`FormField`, `DateField`, `WizardStepBar`, `PhotoUploadField`,
   `RequiredMark`, `PHONE_FIELD_PAIR`) is already shared and is reused, not copied.
2. **Checklist items can carry a "built before" year.** An item with "built before 1978" goes on a file only when the
   file's Year Built is earlier than 1978. An item with no year goes on every file, exactly as today.
3. **The year-based items**, all research-backed (see Sources):

   | Item | Built before | Required? | Checklists |
   |---|---|---|---|
   | LPD — Lead-Based Paint and Lead-Based Paint Hazards Disclosure (+ EPA pamphlet) | 1978 | Required | Residential Sale — Listing; Residential Purchase; Residential Listing (tx); Residential Dual; Residential Lease — Landlord Listing; Lease Tenant; Lease Landlord; Lease Dual |
   | Residential Earthquake Hazards Report (Homeowner's Guide to Earthquake Safety) | 1960 | Required | Residential Sale — Listing; Residential Purchase; Residential Listing (tx); Residential Dual (sales only, not leases) |
   | Commercial Property Owner's Guide to Earthquake Safety (precast concrete or reinforced masonry buildings only) | 1975 | Optional | Commercial Sale — Listing; Commercial Purchase; Commercial Listing (tx); Commercial Dual (sales only, not leases) |

   The lease checklists' existing optional "LPD … required only for housing built before 1978" item becomes the
   required, year-driven item above (same name, description updated). The sale checklists gain LPD as a new item.
4. **Changing the year later updates the checklist.** Adding or correcting Year Built on an open file adds any
   year-based items that now apply, and removes ones that no longer apply, **but never removes an item that has a
   document on it** (that item stays exactly as it is).
5. **Admin Checklists page gets a "built before" setting** on each item and in the Add Item form (admin-only; agents
   can't open that page today).
6. **Checklist clean-up (no year logic):**
   - **WHSD** becomes optional and is renamed "WHSD — Water Heater & Smoke Detector Statement of Compliance
     (required if TDS-exempt)" on Residential Sale — Listing, Residential Listing (tx) and Residential Dual. Reason:
     the TDS already covers water heater bracing and smoke detectors; C.A.R. uses WHSD for TDS-exempt sales; KW marks
     it "required if no TDS"; SkySlope has no "TDS-exempt" question, so we don't add one either.
   - **DBD description** drops the paragraph numbers ("RPA ¶10(D) / RIPA ¶11(C)" was wrong — the RPA 12/22 prints the
     Megan's Law notice in ¶11I — and numbers move with every C.A.R. revision). New description: "The Megan's Law
     notice is pre-printed in the C.A.R. RPA and RIPA; this form is needed only with another purchase contract.
     Civil Code §2079.10a". Name unchanged.
7. **Foster Road** (listing `cmvivu9290001n3iejhf2jtap`) gets Year Built 1952 and Property Type "Single Family",
   which adds LPD and the earthquake report to its checklist. The WHSD/DBD clean-up in goal 6 is also applied, once,
   to open files (today only Foster Road); it changes names, descriptions and the required flag only, never removes a
   row or document. New files get the new wording from the templates.
8. **Admin Checklists text colour:** the Add Item "Document name" and "Description" fields and the Create Template
   "Transaction Side" / "Property Category" dropdowns get the site's black text (#1B1B1B). Cause: the site's
   always-on dark theme makes un-coloured text near-white. The builder also searches the rest of the site for form
   fields with the same missing colour and lists them for Ryan rather than changing them silently.
9. **Bigger header photo:** on the agent and admin file pages (listings and transactions), the property photo next to
   the address grows to the height of the address **plus** the status row below it (about 96px instead of 56px),
   keeping its current shape. On narrow phones, if the bigger photo squeezes the address onto more lines than today,
   the phone size stays smaller.

## Non-goals

- **No SOLAR checklist item.** A solar contract is a third-party property document, like inspection and pest
  reports; agents upload it under Additional Documents. SkySlope's own sample checklist lists only compliance forms.
- **No "TDS-exempt" question** in either wizard (SkySlope doesn't ask one).
- **No renaming of NHD** ("NHD — Natural Hazard Disclosure Report" stays) and LPD keeps its name.
- **No other conditions** (location, fire zone, HOA, lease length, bedrooms). Only the year. FHDS (fire hardening)
  is possible future work.
- **No change to SBSA** — it stays required on Residential Purchase, Listing (tx) and Dual.
- Existing closed, canceled or archived files are not touched.

## Anti-goals (would be a failure even if it works)

- An uploaded document disappears, or a checklist item with a document is removed, because the year changed.
- Desktop or mobile layout changes anywhere other than the pages named in goals 1c–1d and 8–9 and the Overview rows.
- Dashboard tab switching gets slower (the year logic must add no query to dashboard list pages).
- Agents can set or see the "built before" setting.

## Constraints

- Next.js 14 App Router, Prisma 5.22, Neon Postgres. **Local dev and production share one database**, so any
  migration or data script is live the moment it runs.
- Template rows are copied into each file's `FileChecklistItem` rows at creation; there is no link back to the
  template, so template edits only affect new files. Checklists are applied in five places, all of which must use the
  same year rule: `api/listings` POST, `api/transactions` POST, `api/listings/[id]/convert`, `api/deals/[id]/convert`,
  and the transfer-unlock in `api/admin/documents/[id]/approve`.
- Checklist lists live in `packages/database/prisma/checklist-templates.ts` (imported by `seed.ts`). The live
  templates are updated with a targeted script after confirming the live copies match the code (the full seed would
  rebuild every template and tag — do not run it against production).
- Every change covers agent and admin accounts, listings and transactions, desktop and mobile. Check shared
  components first. Speed checks are quick and targeted (touched pages only). TDD throughout. Ask before every push.

## Decided by Ryan

- Year Built required in both wizards; year-specific forms required by year (LPD before 1978; Homeowner's Guide /
  earthquake report before 1960).
- SBSA stays required on Residential Purchase, Listing and Dual.
- No TDS-exempt question (SkySlope doesn't ask one).
- NHD and LPD keep their names.
- SOLAR dropped from the checklists.
- Commercial guide optional, commercial sales only.
- The "built before" column is on the admin Checklists page, admin-only.
- The text-colour fix and the bigger header photo are part of this project.
- DBD description loses its paragraph numbers.
- Land is exempt from Year Built via Property Type (no "no building" checkbox); listings gain Property Type with the
  same 11 options as transactions.
- New Listing wizard gets a "Listing Type" first step and "Listing Info" second step, laid out as in goal 1c.
- New Transaction wizard: first step stays "File Type"; Year Built and MLS Number switch places; MLS stays optional
  and stays where it is (option A).
- Year Built shows the red required asterisk.
- WHSD/DBD clean-up reaches existing open files (Foster Road).
- Year Built (and, by Claude's call 11, Property Type) stay in step between a listing and its transaction.

## Calls made by Claude (Ryan to check)

1. **Unknown year = no year-based items.** Files without a year (old files, files made from a Deal, transfer
   placeholders after unlock, any file made before this ships) get none of the year-based items until someone enters
   the year on the Overview; entering it then adds them. Reason: adding a required LPD to every house of unknown age
   would wrongly block brand-new homes.
2. **Valid years:** 4 digits, from 1500 to next year (Ryan: some California buildings predate 1800; new construction can be listed before completion).
3. **Re-evaluating on a year change applies only to open files** (not Closed, Canceled, Archived, Expired, Withdrawn,
   Referral Successful). It uses the file's current matching template, so it also picks up template edits made since
   the file was created — but only for year-based items; other items are never added or removed by this.
4. **"No longer applies" with a document on it:** the item stays unchanged (same name, same required flag). The broker
   sees it in review as usual.
5. **Each file row remembers its item's year** (a copied `builtBefore` value), so a later year change knows which
   rows are year-based. Matching the template to the file's rows is by item name.
6. **Status is not changed by the re-check.** Adding a required item to an Under Contract or Pending file doesn't move
   it back; the existing "ready to close" checks already require every required item, so closing waits for it.
7. **Every re-check that changes anything writes one Activity line** on the file, e.g. "Year Built set to 1952 —
   checklist added: LPD, Residential Earthquake Hazards Report".
8. **Existing open files with a known year** (any transactions that already have one) get the same re-check once
   when this ships, so they match new files.
9. **Existing lease LPD rows** (optional, no year) become the year-based row: when this ships they are tagged
   "built before 1978". If the file's year is known, a row with no document becomes required (before 1978) or is
   removed (1978 or later); a row with a document stays exactly as it is. If the year is unknown the row stays
   optional until the year is entered. No second LPD row is ever added beside an existing one.
10. **"Has a document"** means at least one document is attached to the item, in any review state (pending, approved
    or rejected). A document the agent removed (detached) no longer counts.
11. **Property Type stays in step after Convert too**, like Year Built, because it now decides the Land exemption; two
    linked files must never disagree about which year-based forms apply.
12. **Changing Property Type to or from "Land"** on an open file re-checks the checklist the same way a year change
    does (Land with no year = no year-based items; documents are never removed).
13. **Files made from a Deal or by a transfer unlock** have no Property Type or year; they follow call 1 until someone
    fills them in on the Overview.

## Left to the builder

- Exact column/field names, the shared helper's name and file, migration names.
- How the admin page shows the setting (a small number box with the label "Only if built before"), as long as it
  matches the page's existing style and the text is black.
- Test layout and the speed-check/pixel-check method (the existing `.superpowers/pf-survey/` scripts are available).

## Sources (from the research conversation, 2026-10-21 → 10-25)

- EPA Lead Disclosure Rule (pre-1978, sales and leases; exceptions for ≤100-day leases, 0-bedroom units,
  elderly/disabled housing, certified lead-free, foreclosures); C.A.R. Form LPD Revised 12/24.
- Gov Code §8897.1 (Homeowner's Guide + earthquake hazards report, 1–4 unit light-frame dwellings built before
  1/1/1960, transfers only). RPA 12/22 ¶11 also requires the "Residential Earthquake Risk Disclosure Statement" for
  1–4 unit homes built before 1/1/1960 and the LPD for homes built before 1/1/1978.
- Gov Code §8893.2 (Commercial Property Owner's Guide, precast concrete / reinforced masonry with wood floors or roof,
  built before 1/1/1975, sales/transfers).
- Civil Code §2079.10a (Megan's Law notice in the contract; RPA 12/22 ¶11I prints it).
- RPA 12/22 and RLA 2024 full-text check: neither contains any other form on our checklists; they only reference or
  acknowledge receipt (AD) of separate forms.
- SkySlope support articles and SkySlope's sample California purchase checklist (forms only, broker sets required vs
  conditional; no year logic, no TDS-exempt question; any document can sit unassigned in the Documents tab).
