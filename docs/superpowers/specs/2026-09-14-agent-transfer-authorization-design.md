# Agent Transfer of Active Listings/Sales — Design Spec

**Date:** 2026-09-14
**Status:** Approved by Ryan, ready for implementation planning

## Problem

An agent applying to join CnC may already have an active listing and/or a pending sale
at their current brokerage. Today the application form asks two yes/no questions
(`hasActiveListings`, `hasActiveSales`) and nothing happens with the answer — there is
no mechanism to actually move that in-flight business over to CnC once the agent is
approved.

## Scope

**Building:**
- A follow-up count question on the application for each "yes" answer
- A placeholder, locked Transaction/Listing File created per transfer at approval time
- Two blank transfer-authorization PDF templates (down from an earlier plan of three —
  see "Two templates, not three" below)
- Delivery of the correct blank form(s) to the agent (email + in-dashboard download)
- A simple upload + broker-review flow that unlocks the file once you approve the
  signed document
- Pre-population of exactly one field (property address) on unlock — nothing else

**Explicitly not building:**
- Any parsing/OCR of the signed document the agent uploads back (see "Why we don't
  read the uploaded document" below)
- Any new e-signature infrastructure — confirmed CnC has none today; the agent gets
  the form signed by their previous broker however they already would (print, sign,
  scan; or their own e-sign tool if they have one) and uploads the result
- Pre-population of any field beyond property address (parties, commission, dates,
  etc.) — the agent fills the rest out through the normal wizard once unlocked, exactly
  like a brand-new file
- A stage-selection dropdown on the application — the existing `hasActiveListings` /
  `hasActiveSales` booleans already encode which of the two templates applies

## Two templates, not three

The original plan (from the session cut off by the 2026-09-13 crash) was three
documents — Listing / Negotiation / Escrow — because a "pre-populate from the signed
form" design needed to know which fields to expect. That's no longer the design: we're
not reading the uploaded document at all, so the only real reason to keep Negotiation
and Escrow separate — different expected fields — no longer applies. Checked whether
DRE law requires them to be separate: it doesn't. There is no DRE-mandated form for
this at all (DRE's only standardized transfer forms, RE204/RE214, govern license
affiliation changes, not deal-file transfers) — this is a private CnC document, same
status as the ICA (drafted by us, not attorney-reviewed).

So: **two templates.**
- **Listing Authorization** — for `hasActiveListings`
- **Pending Sale Transfer Authorization** — for `hasActiveSales`, combining what were
  separately "Negotiation" and "Escrow" versions, with the escrow-company section made
  optional/conditional (see form text below) rather than needing two documents.

Combining these was checked field-by-field against three real reference documents
(REeBroker's Escrow, Negotiation, and Listing transfer forms) so nothing gets silently
dropped — see "Form content" below for the full drafted text and the specific calls
made while merging (agent-signature lines kept for both stages; "Purchase Agreement
dated" kept for both stages; compensation stated both ways — affirmatively for CnC,
negatively for the transferor — since the two source forms phrased it differently and
neither phrasing alone is as clear as both together).

## Why we don't read the uploaded document

Considered generating the blank form with real fillable PDF fields (confirmed via a
direct test that `pdf-lib` can create and read back AcroForm fields — this part
works) and reading the property address back out of the signed upload. Rejected: the
signing happens entirely outside our system by design (no e-sign infrastructure), so
we have no control over what comes back — printed/signed/scanned returns a flat image
with no extractable text at all, and even a digital signing tool may flatten the form
on completion. There's no reliable way to tell in advance which case we'd get, and a
failed silent read is worse than not attempting one. Instead, the agent types the
property address directly into our own upload UI — deterministic, works regardless of
what file format comes back, and they're the only one who knows which specific listing
this is anyway (the application never asks for one, only a yes/no).

## Application form changes

Add a follow-up question under each boolean, shown only when it's answered "yes":

- `hasActiveListings = true` → **"How many listings do you have to transfer?"**
  (dropdown, 1–10)
- `hasActiveSales = true` → **"How many pending sales do you have to transfer?"**
  (dropdown, 1–10)

New fields on `AgentApplication`: `activeListingsCount Int?`, `activeSalesCount Int?`
— populated only when the corresponding boolean is true.

## File lifecycle

1. **Approval.** For each unit of `activeListingsCount`, create a `ListingFile` with
   status `PENDING_TRANSFER`. For each unit of `activeSalesCount`, create a
   `TransactionFile` with status `PENDING_TRANSFER`. Each gets seeded with exactly one
   `FileChecklistItem`: **"Upload Signed Transfer Authorization"** (`isRequired: true`).
   Nothing else on the file is filled in — no address, no parties, nothing.

   If an agent has both (e.g. 2 listings + 1 pending sale), they get 3 separate
   placeholder files. Multiple placeholders of the same type are interchangeable —
   nothing distinguishes them from each other until the agent uploads a form against
   one, so they just use whichever one for whichever property they get to first. No
   need to pre-label them.

2. **Locked state.** While `PENDING_TRANSFER`, the file does not expose the normal
   wizard/edit fields — only the one checklist item and an optional plain "Property
   Address" text field are actionable. This status is new on both `ListingStatus` and
   `TransactionFileStatus` — deliberately distinct from the existing `INCOMPLETE`
   status, which already means something specific ("agent is actively building this
   via the wizard") and would let them start editing a file that's supposed to be
   locked. `PENDING_TRANSFER` files are deletable, same precedent as `INCOMPLETE`
   files today, in case a transfer falls through.

   The `PENDING_TRANSFER → INCOMPLETE` transition is **not** a normal user-facing
   status change and does not go through `canTransitionListing`/`canTransitionTransaction`
   or the admin manual status dropdown — it's a system side effect of one specific
   event (below), not something an agent or admin selects from a list.

3. **Getting the blank form.** Extend the existing `sendApprovalDocuments` email
   (already sends the blank W-9 + Office Policy Manual at approval) rather than send a
   third separate email — conditionally attach `listing-transfer-authorization.pdf`
   and/or `pending-sale-transfer-authorization.pdf` based on `hasActiveListings` /
   `hasActiveSales`, with an added paragraph explaining what to do with it. Also add a
   "Download blank form" link directly on the locked file's own page, next to the
   checklist item — the email is a one-shot thing that's easy to lose track of weeks
   later; the file sitting in their dashboard is persistent.

4. **Agent fills in property address (optional, best-effort).** A plain text field on
   the locked file's page, independent of the document upload itself — if filled in,
   it writes directly onto the file's own existing `propertyAddress` column (the same
   column the normal wizard's Property step already uses). Not a hard requirement —
   if skipped, the agent just fills in the Property step normally once unlocked,
   matching the "brand new file" baseline anyway.

5. **Agent uploads the signed form.** Through the exact same document-upload UI every
   other file in the CRM already uses, attached to the one seeded checklist item.
   Lands in the existing `PENDING_REVIEW` queue.

6. **You approve it.** Through the existing document-approval route
   (`api/admin/documents/[id]/approve`). The unlock trigger: **if the approved
   document is attached to a checklist item (`checklistItemId` is set) belonging to a
   file that is currently `PENDING_TRANSFER`, transition that file to `INCOMPLETE`** as
   part of the same approval. The `checklistItemId` check matters — this app already
   supports uploading a document unattached to any checklist item (`checklistItemId:
   null`), and a `PENDING_TRANSFER` file must not unlock from an unrelated unattached
   upload. Since a `PENDING_TRANSFER` file only ever has the one seeded checklist item,
   checking "does this approval belong to *a* checklist item on this file" is
   sufficient — no separate marker needed to identify it as *the* transfer item
   specifically. From that point the file behaves exactly like any file the agent
   started via the wizard — checklists, tasks, deadlines, everything else already
   built.

## Form content — Listing Authorization

Drafted from REeBroker's listing-transfer form, adapted for CnC. No buyer fields, no
escrow section (no purchase agreement exists yet for a pure listing).

```
CnC Realty
DRE #02439028

AUTHORIZATION TO TRANSFER LISTING TO CNC REALTY

I, _________________________________ ("Seller")
and I _________________________________ ("Seller"),
owner(s) of the property located at:
_______________________________________________________________________

hereby grant authorization to transfer the Exclusive Authorization and Right to Sell
("the Listing") on the above property from ____________________________________
("Previous Brokerage"), who currently holds the Listing, to CnC Realty.

All terms of the Listing shall remain the same as those originally entered into by and
between the parties, with the exception that CnC Realty will now hold the Listing on
the above property and be entitled to all rights granted under the Exclusive
Authorization and Right to Sell.

Agent's Previous Brokerage Transfer Date: _______________________

Previous Brokerage Information:
  Brokerage Name: _________________________________
  Address: _________________________________
  City, State, Zip: _________________________________
  Phone: _________________________________
  DRE License #: _________________________________
  Broker of Record: _________________________________

Transferee Brokerage:
  CnC Realty
  830 S. Main St, STE 227, Santa Ana, CA 92701
  Phone: (562) 335-1759
  Email: info@cncrealtygroup.com
  DRE License #: 02439028

Seller:  _________________________________   Date: _______________
Seller:  _________________________________   Date: _______________

Previous Brokerage (Transferor)
Broker Signature: _________________________________   Date: _______________

CnC Realty (Transferee)
Broker Signature: _________________________________   Date: _______________

---------------------------- Agent Use Section ----------------------------
Reminder: as the agent responsible for this Listing, your AOR and MLS
affiliation will need to be updated to reflect CnC Realty as your current
brokerage.

Date Brokerage/MLS Change Made: _______________________
Change Confirmed by Agent (Initials): _______________________
```

## Form content — Pending Sale Transfer Authorization

Drafted by merging REeBroker's Negotiation and Escrow forms, field-by-field, per the
comparison in the earlier design discussion. Escrow block is explicitly conditional.

```
CnC Realty
DRE #02439028

AUTHORIZATION TO TRANSFER PENDING SALE TO CNC REALTY

I, _________________________________ ("Seller")
and I _________________________________ ("Seller"),
and I _________________________________ ("Buyer")
and I _________________________________ ("Buyer"),

hereby grant authorization to transfer the Residential Purchase Agreement ("RPA") on
the property located at:
_______________________________________________________________________

from ____________________________________ ("Previous Brokerage"), who currently holds
the Purchase Agreement, to CnC Realty.

Purchase Agreement dated: _______________________
Agent's Previous Brokerage Transfer Date: _______________________

CnC Realty shall be entitled to all rights granted under the Residential Purchase
Agreement and shall be entitled to the full commission at the close of escrow.
The Previous Brokerage is not entitled to any compensation on this transaction.

Previous Brokerage Information:
  Brokerage Name: _________________________________
  Address: _________________________________
  City, State, Zip: _________________________________
  Phone: _________________________________
  DRE License #: _________________________________
  Broker of Record: _________________________________

Escrow Information (if escrow has been opened — leave blank if not applicable):
  Escrow Company: _________________________________
  Escrow Officer: _________________________________
  Address: _________________________________
  City, State, Zip: _________________________________
  Phone: _________________________________
  Fax: _________________________________
  Email: _________________________________
  Escrow File #: _________________________________

Transferee Brokerage:
  CnC Realty
  830 S. Main St, STE 227, Santa Ana, CA 92701
  Phone: (562) 335-1759
  Email: info@cncrealtygroup.com
  DRE License #: 02439028

Seller:        _________________________________   Date: _______________
Seller:        _________________________________   Date: _______________
Buyer:         _________________________________   Date: _______________
Buyer:         _________________________________   Date: _______________
Seller's Agent: _________________________________   Date: _______________
Buyer's Agent:  _________________________________   Date: _______________

Previous Brokerage (Transferor)
Broker Signature: _________________________________   Date: _______________

CnC Realty (Transferee)
Broker Signature: _________________________________   Date: _______________

---------------------------- Agent Use Section ----------------------------
Reminder: as the agent responsible for this transaction, your AOR and MLS
affiliation will need to be updated to reflect CnC Realty as your current
brokerage.

Date Brokerage/MLS Change Made: _______________________
Change Confirmed by Agent (Initials): _______________________
```

## Why these are static files, not generated PDFs

The ICA is machine-generated per agent (`ica-pdf.ts`) because it needs per-agent data
baked in — name, license number, signature timestamp. These two forms don't; they're
identical blank templates for every agent, same situation as the W-9 and Office Policy
Manual. A prior session already tried building a shared PDF-generation pipeline for the
Office Policy Manual specifically because it seemed more consistent with the ICA's
approach, then reverted it once it was clear the manual didn't need per-agent
personalization — a static file was simpler and was the right call. Same reasoning
applies here: author the content above (already drafted, ready for you to edit),
convert to PDF the same way the Office Policy Manual was (Word doc, hand-reviewed,
exported), and drop the resulting static files into
`apps/web/src/lib/email/attachments/`. No new PDF-generation code needed.

## Data model changes

- `ListingStatus`: add `PENDING_TRANSFER`
- `TransactionFileStatus`: add `PENDING_TRANSFER`
- `AgentApplication`: add `activeListingsCount Int?`, `activeSalesCount Int?`
- No new checklist/document schema needed — reuses `FileChecklistItem` /
  `FileDocument` as they exist today
- No new field to mark "this is the transfer checklist item" — a `PENDING_TRANSFER`
  file having exactly one checklist item is sufficient signal, checked at the point of
  document approval

## Open items for the implementation plan

- Exact wording Ryan wants to hand-edit once he reviews the drafted form text above
- Whether the property-address field on the locked file page needs its own small API
  route or can reuse an existing PATCH endpoint on `ListingFile`/`TransactionFile`

## Legal caveat

Same status as the ICA: this is CnC's own document, informed by public DRE material
and REeBroker's real forms, but **not attorney-reviewed**. Flag this distinction if it
comes up again.
