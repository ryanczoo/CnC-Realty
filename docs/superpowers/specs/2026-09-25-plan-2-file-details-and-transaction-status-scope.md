# Plan 2 — Edit Details & Transaction Status: Agreed Scope

**Date:** 2026-09-25 · **Status:** scope agreed with Ryan in chat (2026-09-24/25); design + implementation plan still to be written (brainstorming → writing-plans).
**Follows:** Plan 1, `2026-09-24-listing-lifecycle-and-document-removal-design.md` (done).

Every item applies to **all listing types and all transaction sides**, and to **both the agent's file page and the broker's admin file page** unless stated otherwise. Reuse existing shared pieces (wizard sections, `FileStatusSelect`, `statusLabel`, `listingDatesError`, `changeFileStatus`) — no second copies.

## 1. Edit details — listings AND transactions (agent + admin)
- An **"Edit details"** view on the file page for **listings and transactions**, available to the **file's agent** and to the **broker** (admin page). Today the Overview tab is display-only everywhere; the PATCH routes already validate edits (Plan 1).
- **Listings:** reuse the New Listing wizard's Property Info fields/rules (required fields, `listingDatesError`). Covers address typos, price reductions, and **expiration extensions**.
- **Transactions:** reuse the New Transaction wizard's sections (Transaction Details, Parties). Needed so a converted transaction can get its price, buyer, Acceptance Date and Close of Escrow.
- Agents: blocked on locked files (existing `assertFileEditable`). Broker: exempt, as everywhere else.

## 2. Status follows the dates on save (SkySlope-style)
- **Listing:** saving a later expiration date on an **Expired** listing returns it to **Active** immediately.
- **Transaction:** saving a later Close of Escrow on an **Expired** transaction returns it to **Pending** immediately.
- The Plan 1 morning job already does both overnight as a safety net; this makes it instant on save.

## 3. Automatic Pending (transactions)
- One shared rule, `isReadyForPending`: a transaction becomes **Pending** automatically once its required details are complete — checked in the New Transaction wizard (Under Contract stage) and on every Edit-details save (converted and Pre-Contract files included).
- Required details — sales (Purchase / Listing / Dual): sale price, Acceptance Date, Close of Escrow, buyer(s) and seller(s) per the wizard's party rules. Leases: total lease amount, lease signing date, lease start date, tenant(s) and landlord(s). Referrals: unaffected. (Lease row to be confirmed when designing.)
- The wizard's **Under Contract** stage makes **Acceptance Date and Close of Escrow required** (always on a ratified RPA); Pre-Contract unaffected.

## 4. Transaction status dropdown
- Shared `FileStatusSelect` on the transaction file page, offering agents only **Pre-Contract** and **Request Cancellation**. Hidden on Referral files (they keep ReferralActions). Only the broker closes.
- Agents may request cancellation from Incomplete, Pre-Contract, Pending and Expired (currently only Pre-Contract/Pending) → `CANCELED_PENDING`.

## 5. Cancellation requests
- **Required reason** text field when an agent requests cancellation; stored in the STATUS_CHANGED activity payload (no schema change); shown on the broker's file page while Cancel Pending and in Activity.
- Broker is notified **both** ways: an **email** and an entry in the admin **Awaiting Review** tab (Cancel Pending status pill).
- Approval (`CANCELED_APPROVED`) already returns a converted listing to Active/Expired (Plan 1 sync).

## 6. Deadline-reminder fix
- `cron/deadline-reminders` only skips CLOSED, so canceled/archived transactions keep emailing agents. Remind only on active statuses.

## Backlog (not in Plan 2 unless pulled in)
- "View Listing" link on a converted transaction (reverse of View Transaction); optional read-only "From the listing" documents section. Listing documents are **not** copied as approved (transaction needs buyer-signed versions).
- Dead Pending-Transfer **transaction** placeholders (fallen-through pending sales) have no cleanup path; transactions are non-deletable.
- Deal drawer (Pipeline): Ryan will build a full deal once to see "Create Transaction File" / "Not yet" / Save / Cancel before any design decisions.
