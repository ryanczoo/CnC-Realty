# Listing Lifecycle & Document Removal — Design

**Date:** 2026-09-24 · **Approved by:** Ryan, piece by piece in chat during the New Listing wizard walkthrough.

Applies to **every listing type** (Residential/Commercial × Sale/Lease) and **every transaction side** — nothing here is specific to a test file.

## 1. File card date label
Listing cards show `Expires: <expirationDate>`; transaction cards show `COE: <closeOfEscrow>`. Today both show "COE" using `closeOfEscrow ?? expirationDate`. Shared by the agent and admin Transactions pages via `FileCard`.

## 2. Convert → open the new transaction
After **Convert to Transaction** succeeds, go to `/dashboard/transactions/transaction/<new id>` instead of the list.

## 3. Agent listing status (Option A + guardrail)
- Agents get a status dropdown on their own listing's file page, fed by `allowedNextStatuses("listing", status, "AGENT")` — the same tables the server enforces. The admin page's existing dropdown is extracted into one shared component used by both.
- Guardrail (SkySlope parity): agents can no longer move a listing to `CANCELED` (it locks the file). Agents use `WITHDRAWN`; only the broker cancels.
- No own/family-property approval gate (Ryan: agents email him first).
- `ACTIVE_UNDER_CONTRACT` is never offered in the agent dropdown — Convert is the only way there — and the agent dropdown is hidden entirely while a listing is Under Contract (the linked transaction drives it).
- Header order on a listing: `[Convert to Transaction | View Transaction] [Submit for Review] [Status ▾]`. Convert becomes View Transaction in the same slot after converting.
- Agent **transaction** status is a separate follow-up plan (Plan 2: edit details, auto-Pending, Pre-Contract / Request Cancellation dropdown with required reason, broker email + Awaiting Review entry, deadline-reminder fix, required Acceptance Date + COE in the wizard's Under Contract stage).

## 3b. Morning status job (date-driven, SkySlope-style)
Folded into the existing daily `/api/cron/listing-expiration-warnings` job (no new cron): listing `COMING_SOON → ACTIVE` once `listDate ≤ today`; listing `ACTIVE`/`COMING_SOON → EXPIRED` once `expirationDate < today`; transaction `PENDING → EXPIRED` once `closeOfEscrow < today`, and `EXPIRED → PENDING` if `closeOfEscrow ≥ today` again. `INCOMPLETE` stays manual. Each change logs a `STATUS_CHANGED` activity with `payload.automatic = true`, attributed to the file's agent.

## 4. Listing ↔ transaction sync
Inside `changeFileStatus` (every status change goes through it), when a transaction with an `originatingListingId` changes status and the listing is `ACTIVE_UNDER_CONTRACT`:
- transaction → `CLOSED` ⇒ listing → `CLOSED`
- transaction → `CANCELED_APPROVED` ⇒ listing → `ACTIVE`, or `EXPIRED` if its expiration date has passed
Each sync writes a `STATUS_CHANGED` activity on the listing in the same DB transaction. An Under Contract listing shows a **View Transaction** link (agent and admin pages).

## 5. Listing deletion
- Admin-only (agents lose it server-side). Allowed only when the listing has **zero documents** and **no converted transaction**; any status.
- UI: a **"Delete listing…"** option at the bottom of the admin status dropdown (separated by a divider), shown only when deletable; selecting it opens `window.confirm`, never changes status. Pending Transfer listings (no dropdown) get a small **"Delete listing…"** link beside the purple label under the same rule.
- Transactions remain non-deletable.

## 6. Document Remove / Delete
- **Remove** (SkySlope "remove from checklist"): detaches the document from its checklist item (`checklistItemId = null`), `PENDING_REVIEW → NOT_SUBMITTED` (drops out of the review queue); file stays in R2 and in the Documents tab as "Unattached"; logs `DOCUMENT_REMOVED`. Agents: only documents they uploaded that are `PENDING_REVIEW`, via a trash icon on the Checklist row. Admin: any document, via a white pill **Remove** next to Download / Approve / Reject on the admin Checklist tab's document card. Remove detaches only the uploaded document; the checklist item itself (and its required flag) is never removed.
- **Delete permanently**: admin-only, required reason, from a trash icon on the admin Documents tab (inline reason form, same pattern as Reject). Erases R2 object + row; logs `DOCUMENT_DELETED` with name and reason. Agents lose the delete endpoint.
- Requires adding `DOCUMENT_REMOVED` and `DOCUMENT_DELETED` to `FileActivityType` (additive migration).

## Compliance basis
10 CCR §2725 (supervision systems, no listing pre-approval), B&P §10148 (3-year retention incl. unconsummated listings), SkySlope help: "Property File Statuses", "Removing Documents from the Checklist", Product-team statement that SkySlope prevents file deletion.
