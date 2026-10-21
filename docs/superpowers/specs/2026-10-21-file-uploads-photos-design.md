# File uploads, property photos & document fixes — design

Date: 2026-10-21. Status: awaiting Ryan's approval. Found by Ryan while creating a real listing
(11538 Foster Road, listing file `cmvifkdmi00014xl3ohhnm825`) on the live site.

## Why

Ryan is using the dashboard for real files now. Several things fail silently or dead-end:

- The New Transaction wizard's **Upload Photo has never worked.** It asks `/api/upload-url` for a
  presigned URL using a random placeholder `fileId` (`photoTempId`); the route verifies the file
  exists and returns 403; the wizard doesn't check the response, PUTs to `undefined`, and sets
  `photoKey` to `undefined`. No error is shown.
- **Checklist uploads show no success message**, and failures show a generic message that drops
  the server's reason. "Additional Documents" never lists what was added.
- **Every Documents-tab download 404s.** `useFileUpload` saves `r2Url: key` (a bare storage key),
  and `DocumentsTab` uses it as `href`, so the browser resolves it relative to the page.
- The Documents tab labels both "added via Additional Documents" and "removed from a checklist item"
  as **"Unattached"**.
- The broker **cannot approve or reject an additional document** — `DocumentReviewCard` is only
  rendered under checklist items, so those stay "Pending Review" forever (they don't block submit
  or close; `getChecklistProgress` only counts checklist items).
- Listings have **no photo at all** (no wizard field, no column).

## Goals

Every change below covers **agent and admin**, and **listings and transactions**, unless stated.
There is one New Listing wizard and one New Transaction wizard, used by both roles.

### 1. Property photo upload (both wizards)

- Shared wizard photo block, extracted from the transaction wizard's current markup
  (`new-transaction/page.tsx` ~L447–466): centered "Property Photo" label, black pill button
  ("Upload Photo" / "Uploading…" / "Replace Photo"), result line under it.
  - Success: "Photo uploaded" + `CheckIcon` (current look, gold `#9E8C61`).
  - Failure: "Photo uploaded" + new `XIcon` + the server's reason (e.g. "File type not allowed. Use
    PDF, JPG, PNG, or DOCX."). Failure color: red (`text-red-600`, matching existing upload errors).
    The same words "Photo uploaded" on failure are **intentional** (Ryan, 2026-10-21: "Photo uploaded ✓"
    or "Photo uploaded X") — the icon and reason carry the result.
  - **Photos are shrunk on upload (Claude's call):** reuse the agent-headshot pattern
    (`api/account/headshot-upload`, sharp, commit `770249a`) — the photo goes through the server,
    is resized/compressed, then stored — so a 5–10 MB phone photo never loads on the file page.
    This supersedes the "image resizing" non-goal below.
  - **No pulse** on this button (Ryan, 2026-10-21) — exception to the pulse rule.
- Placement: transaction wizard unchanged (end of the Property step's Optional Info). New Listing
  wizard: **step 1 (Property Info), centered under the List Date / Expiration Date row.**
- Upload works before the file exists: a dedicated agent-scoped upload location for wizard photos,
  not tied to a file id. On create (`POST /api/transactions`, `POST /api/listings`) the server
  **must verify the submitted `photoKey` is inside the caller's own wizard-photo prefix** — today
  `/api/transactions` accepts any client-supplied `photoKey`, which would let a caller point the
  photo route at another file's document. Reject otherwise.
- Photo types: JPG and PNG (what the server already accepts and every browser can display). The
  file picker's `accept` should filter to those.
- New nullable `photoKey` column on `ListingFile` (TransactionFile already has one). Migration.
- Listing → transaction conversion (`api/listings/[id]/convert`) copies `photoKey`.
- Referrals: no photo (unchanged — the field is already hidden for referrals).
- No adding/replacing a photo after creation (Ryan's call). Foster Road stays without one.

### 2. Photo in the file-page header

- A small photo to the **right of the two-line address** in the file header (Ryan's blue box),
  about the height of both lines, landscape, rounded corners. Shown only when `photoKey` is set;
  otherwise the header is unchanged.
- Clicking opens it **full size on the same page**: dark backdrop, close button in the corner,
  click/tap outside the photo closes it. No new tab.
- Reuse: extract the lightbox from `components/properties/PhotoGallery.tsx` (portal, `bg-black/95`,
  corner close button using lucide `X`, outside-click closes, photo click doesn't) into a shared
  component. With one photo, hide the "1 / N" counter and arrows. PhotoGallery must render
  identically after the extraction (public listing page — see Constraints).
- The agent (`dashboard/transactions/[fileType]/[id]/page.tsx`) and admin
  (`admin/transactions/[fileType]/[id]/page.tsx`) headers are separate copies; both use one shared
  header-photo component.
- Photo route moves to `/api/files/[fileType]/[id]/photo` (next to `.../parties` and `.../note`),
  using `getFileAndVerifyAccess` so it serves listings and transactions with the existing
  agent-own / admin-all rule. Remove `/api/transactions/[id]/photo` and the Overview tab's
  "Property Photo" card (`OverviewTab.tsx` ~L169–175); nothing else uses them.
- Phones: photo stays beside the address, scaled to fit.

### 3. Upload status line (Checklist tab)

- One shared status line: "<file name>" + `CheckIcon` on success, "<file name>" + `XIcon` +
  server reason on failure. Left-aligned under the Additional Documents heading. Also used by the
  wizard photo block's result line where it fits (builder's call whether one component serves both).
- **Checklist rows get the same line** (Ryan, 2026-10-21): after uploading to a checklist item,
  "<file name>" + ✓, or + ✗ + reason, shows directly under that row — the failure reason no longer
  appears at the top of the panel. Agent `ChecklistPanel` and admin checklist view alike.
  So `useFileUpload` tracks the result per target (each item id, plus "additional").
- `useFileUpload` keeps the last result (name, ok/error) and surfaces the server's error text
  instead of the fixed "Couldn't upload that file". It is already shared by the agent
  `ChecklistPanel` and the admin checklist view, so both get it.

### 4. Additional Documents list

- Extract the "Additional Documents" section (heading + Add Document button) into one shared
  component used by `ChecklistPanel` (agent) and the admin page (~L276–286), which today are copies.
- Under the heading, list every additional document on the file, from saved data (persists across
  tab switches and reloads):
  - **Agent:** file name + the same review-status icon the checklist rows use
    (`STATUS_ICONS` in `ChecklistPanel`).
  - **Admin:** the full `DocumentReviewCard` (view / Approve / Reject), same as under checklist
    items.
- **Same remove-and-rejection rules as checklist rows** (Ryan, 2026-10-21):
  - Agent list: a trash icon on the agent's **own** additional upload **while Pending Review**
    (same rule and confirm prompt as `ChecklistPanel`'s remove). The remove route
    (`api/documents/[id]/remove`) currently 400s for documents not on a checklist item; for an
    additional document, "remove" takes it off the Additional Documents list (it stays in the
    Documents tab for B&P §10148 retention, shown as "Unattached", status Not Submitted) — i.e.
    `isAdditional` becomes false. Broker: may remove any, status kept, as today.
  - A rejected additional document shows "Rejected — please re-upload" and "Reason: <note>" under
    its name, exactly like checklist rows.
- Approving an additional document must **not** re-send the "all documents approved" email
  (Claude's call): only send it when the approved document is on a checklist item.
- "Additional documents" = documents added through Add Document. Documents **removed** from a
  checklist item are not listed here (they remain in the Documents tab as "Unattached").

### 5. "Additional Document" vs "Unattached"

- New boolean on `FileDocument` (e.g. `isAdditional`, default false), set true when uploaded via
  Add Document (`checklistItemId` null at upload).
- Documents tab "Checklist Item" column: "Additional Document" when set, "Unattached" when not on a
  checklist item and not additional (i.e. removed).
- Backfill existing rows in the migration: `checklistItemId IS NULL` and **no** `DOCUMENT_REMOVED`
  activity whose `payload.documentId` is that document → `isAdditional = true`. (Foster Road: Pest
  Inspection Report → Additional Document; first NHD report → stays Unattached.)

### 6. Download fix

- Documents tab download button uses the existing `/api/documents/[id]/download` route (the one
  `DocumentReviewCard` uses) instead of `href={doc.r2Url}`. Fixes all existing documents; no data
  change. Builder's call: fetch-then-open (as the review card does) or have the route redirect
  when opened as a link — but avoid popup blockers and keep "Download" working on phones.

### 7. Black column-header bars

- Documents tab and Parties tab headers become black `#1B1B1B` with white text, using the existing
  All Agents style (`components/admin/AdminTable.tsx`): share one style constant between AdminTable,
  DocumentsTab and PartiesTable rather than copying classes.
- Parties table cells currently have no horizontal padding — add the same side padding the
  Documents table uses so text doesn't touch the bar's edge and columns line up.

### 8. New `XIcon`

- `components/ui/XIcon.tsx`, beside `CheckIcon`: same 24×24 viewBox, `stroke="currentColor"`,
  `strokeWidth={1.5}`, round caps/joins, `aria-hidden`, same props (`size`, `className`).
- Shape (Ryan's sketch): two diagonals crossing at the center, spanning roughly the same area as
  the check (≈ 7→17 on both axes). Top-left→bottom-right is one solid line. Bottom-left→top-right
  has **one gap about halfway between the center and the top-right end**, the gap's size matching
  the check's gap (path gap ≈ 3 units incl. caps).
- Used only for upload failures. The checklist's red "Rejected" circled X (lucide `XCircle`) and
  the gallery's close ✕ are **not** changed.

### 9. Sentry noise

- Drop browser-extension errors (e.g. "MetaMask extension not found", frames from extension
  scripts like `app:///scripts/inpage.js` / `chrome-extension://`) in the client Sentry config.

## Non-goals

- Adding or replacing a photo after the file is created.
- Photos on referrals.
- Changing the circled "Rejected" icon, the gallery's look, or any other table's header.
- A full IDX/photo pipeline or HEIC support. (Photo resizing on upload IS in scope — see §1.)

## Constraints

- **Desktop look is untouchable except the approved changes** (header photo, black header bars,
  status line, Additional Documents list, listing wizard photo block). Pixel-check the rest of each
  touched page, one desktop + one phone size; targeted checks only, no whole-site sweep.
- **Public listing page** (`/properties/[mlsNumber]`) must be pixel-identical with the gallery and
  its lightbox open, desktop + phone, after the lightbox extraction.
- **Dashboard speed is a hard priority:** the header photo must not slow file-page loads or tab
  switching. Measure the file page before/after. The current photo route proxies bytes with
  `no-store`; the builder should keep cost low (e.g. allow short private caching, or redirect to a
  presigned URL).
- Two migrations-worth of schema change (`ListingFile.photoKey`, `FileDocument.isAdditional` +
  backfill) — Vercel deploy runs on push; call this out and confirm before pushing.
- TDD throughout. After any email-template change send a live test (none expected here).
- Ask before every push.

## Left to the builder

- Exact component names and file split; whether the status line and wizard result line are one
  component.
- Wizard-photo upload location naming and how the create routes validate it.
- Exact thumbnail pixel size within "about the height of the two address lines".
- Download mechanism details (within §6's constraints).
- Exact Sentry filter shape.
