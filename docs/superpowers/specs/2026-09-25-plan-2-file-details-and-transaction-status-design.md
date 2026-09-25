# Plan 2 — Edit Details, Lease Dates & Transaction Status — Design

**Date:** 2026-09-25 · **Scope doc:** `2026-09-25-plan-2-file-details-and-transaction-status-scope.md` · **Decisions:** Ryan, in chat 2026-09-24/25.

## Applies to
Every item covers **all listing types and all transaction sides**, on **both** the agent file page and the admin file page — both render the shared `OverviewTab`, `FileStatusSelect`, `ActivityFeed` — unless an item says otherwise. Referral files keep their own flow (ReferralActions, Referral Details card).

## 1. Dedicated lease date fields (migration)
- Add optional `leaseSignedDate DateTime?` and `leaseStartDate DateTime?` to `TransactionFile` (additive; 0 lease transactions exist today, so nothing to backfill). **Ask Ryan before applying.**
- Lease sides (LEASE_TENANT / LEASE_LANDLORD / LEASE_DUAL) use them instead of Acceptance Date / Close of Escrow, and **hide sale-only fields** (Close of Escrow, Inspection, Appraisal, Loan Approval) in the wizard, Overview and Review. Sale sides and listings are unchanged.

## 2. Per-row editing on the Overview card (pencil)
- Shared `PencilIcon` (`components/ui/`, from Ryan's `pen-svgrepo-com.svg`, stroke → `currentColor`, same convention as `TrashIcon` / `DownloadIcon`).
- Shared `InfoRow` gains an **opt-in** `edit` prop (off by default, so CommissionTab is untouched): pencil at the row's right → the row becomes the existing shared input (`FormField`, comma-currency `FormField`, `DateField`, or a select) with ✓ Save / ✕ Cancel; errors inline; saves **one field** via the file's PATCH route.
- `OverviewTab` gains `canEdit` + `onSaved`. **Agent page:** `canEdit` = viewer owns the file and it isn't locked (`isFileReadOnlyFor`). **Admin page:** always (broker exempt from locks).
- **Editable rows always render** (showing "—" with a pencil when empty) so missing values can be filled; non-editable optional rows keep today's hide-when-empty behavior.
- **Listing — editable:** Address, City, ZIP, MLS #, List Price, List Date, Expiration, Commission %. **Not editable:** State, Type.
- **Transaction — editable (Property Details):** Address, City, ZIP, MLS #, Property Type (select, same list as the wizard), Year Built, Escrow # (sales), List Price, Sale Price (sales) / Total Lease Amount (leases), Legal Description, Property Includes, Property Excludes, Tax ID / APN, Multi-Parcels, School District, Zoning Class. **Not editable:** Transaction Side, State.
- **Transaction — editable (Key Dates):** sales — Offer Date, Offer Expiration, Acceptance Date, Inspection Deadline, Appraisal Deadline, Loan Approval, Close of Escrow, Final Walkthrough, Possession Date; leases — Offer Date, Offer Expiration, **Lease Signed Date**, **Lease Start Date**.
- **Server rules (PATCH):** extend the transaction PATCH allowlist to these fields; blanks → null for optional text; required fields can't be cleared (listing: address/city/ZIP/list price/dates; transaction non-referral: address/city/ZIP/property type/MLS #/sale or lease price) — the same required sets the wizards enforce. Listing dates keep `listingDatesError`.

## 3. Status follows the dates (on save + morning job)
- Extract the pure decision from `lib/auto-status.ts`: `dateDrivenStatus({ kind, status, side, listDate, expirationDate, closeOfEscrow, leaseStartDate }, today) → target | null`. Used by **both** the morning job and every PATCH save, so the rule lives in one place.
- Listings: Coming Soon → Active on list date; Active/Coming Soon → Expired after expiration; **Expired → Active when a later expiration is saved** (new).
- Transactions: Pending → Expired after its key date; Expired → Pending when the key date is in the future again. **Key date = Close of Escrow for sales, Lease Start Date for leases** (new).
- Logged as `STATUS_CHANGED` `{ from, to, automatic: true }`.

## 4. Automatic Pending (transactions)
- Shared pure rule `isReadyForPending(tx, parties)`: sales — sale price, Acceptance Date, Close of Escrow, and the buyer/seller names the side requires (same party rules as the wizard's `partiesReady`); leases — total lease amount, Lease Signed Date, Lease Start Date, and tenant/landlord names per side. Referrals: never.
- Checked, for **Incomplete and Pre-Contract** files, in: the transactions POST (wizard), every transaction PATCH save, and parties add/remove. When true → `PENDING`, logged as automatic.
- `changeFileStatus`: moving a transaction to `PENDING` requires `isReadyForPending` (broker exempt).
- Wizard, **Under Contract** stage: Acceptance Date + Close of Escrow required for sales; Lease Signed Date + Lease Start Date required for leases (Next greyed, same pattern as the listing dates). Pre-Contract unaffected.

## 5. Transaction status dropdown (agent)
- The shared `FileStatusSelect` on the agent's transaction page (last in the header, like listings), hidden on referral and locked files.
- New `transactionStatusOptions(status, "AGENT")`: Incomplete → Pre-Contract, Request Cancellation; Pre-Contract / Pending / Expired → Request Cancellation. (Pending itself is automatic, never picked.) Agent table gains `INCOMPLETE`/`EXPIRED → CANCELED_PENDING`.
- The admin dropdown is unchanged apart from the `changeFileStatus` Pending guard.

## 6. Cancellation requests
- Choosing **Request Cancellation** opens an inline form (same pattern as Reject): required reason → PATCH `{ status: "CANCELED_PENDING", cancellationReason }`; the reason goes into the `STATUS_CHANGED` payload (no schema change) and `describeActivity` shows it.
- Broker notified **both** ways: a new email (shared transaction-emails + `sendSafely` pattern; live test send to ryanchong@cncrealtygroup.com after building it) and the admin **Awaiting Review** tab (audit-queue includes `CANCELED_PENDING` transactions; card shows the existing "Cancel Pending" pill). The admin transaction page shows the latest reason while Cancel Pending.
- Approval → `CANCELED_APPROVED` (Plan 1 sync returns a converted listing to Active/Expired).

## 7. Deadline-reminder fix
- `cron/deadline-reminders` reminds only for `INCOMPLETE`, `PRE_CONTRACT`, `PENDING` (not Canceled/Archived/Closed/Expired).

## Performance
No new queries on page loads or tab switches: pencils and forms are client-side; rules run only on save or in the existing morning job. The audit-queue addition is one condition on an indexed status column (admin page only).

## Testing
TDD per task (vitest, node): pure rules (`isReadyForPending`, `dateDrivenStatus`, `transactionStatusOptions`, required-field checks), routes (PATCH allowlists/guards, parties re-check, cancellation, audit queue, cron filter). UI verified by Ryan's click-through with fresh test files (dummy PDF, not real documents).
