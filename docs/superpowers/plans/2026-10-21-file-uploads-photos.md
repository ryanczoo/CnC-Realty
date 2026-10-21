# File Uploads, Property Photos & Document Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make photo and document uploads report their result, give listings photos, show the photo beside the file address with an in-page full-size view, list and review additional documents, fix downloads, and restyle the Documents/Parties header bars.

**Architecture:** Shared UI pieces (`XIcon`, `UploadResultLine`, `AdditionalDocuments`, `PhotoUploadField`, `PhotoLightbox`, `FileHeaderPhoto`) are each used by both the agent and admin file pages and both wizards. Wizard photos upload straight to R2 under an agent-scoped prefix, then a server route shrinks them with sharp (Vercel caps function request bodies at ~4.5 MB, so the photo cannot be POSTed through the server like headshots). One additive migration adds `ListingFile.photoKey` and `FileDocument.isAdditional` (+ backfill).

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Prisma/Postgres (Neon), Cloudflare R2 (`@aws-sdk/client-s3`), sharp, Vitest + `react-dom/server` `renderToStaticMarkup`, Sentry.

**Spec:** `docs/superpowers/specs/2026-10-21-file-uploads-photos-design.md` (approved 2026-10-21).

## Global Constraints

- Every change covers agent + admin and listings + transactions unless a task says otherwise. Referrals get no photo.
- Desktop look is untouchable except the approved changes; pixel-check the rest of each touched page (one desktop 1440 + one phone 390 size). Public `/properties/[mlsNumber]` must be pixel-identical with the gallery and its lightbox open.
- Dashboard speed is a hard priority: file-page load must not get slower.
- Copy: wizard photo result "Photo uploaded" + ✓ (gold `text-[#9E8C61]`) or "Photo uploaded" + ✗ + server reason (`text-red-600`). Checklist/additional result "<file name>" + ✓ / ✗ + reason.
- No pulse animation on any upload button.
- Do not change the checklist's red "Rejected" `XCircle` or the gallery lightbox's lucide `X` close button.
- Photos: JPG/PNG only, ≤ 20 MB raw; stored as JPEG, max 1600 px longest side, quality 82, EXIF-rotated.
- TDD: failing test first for every behavior change. Tests live in `apps/web/src/__tests__/{api,components,lib}/`; run with `cd apps/web && npx vitest run <path>`.
- Commit after each task (local only). **Never push, and never run `prisma migrate deploy`, without Ryan's explicit OK** — `.env.local` points at the production Neon database.

## Review Focus

1. A phone photo that is HEIC/WebP or > 20 MB → ✗ with a readable reason, no photo saved, Create still works without a photo.
2. A client that submits another user's `photoKey` (or a document key) on create → 400, nothing saved.
3. An additional document the agent removes, then the backfill/label logic → shows "Unattached" in Documents, disappears from Additional Documents; a broker-removed one keeps its status.
4. Uploading to checklist row A while row B shows an old ✗ → each row keeps its own line; a new upload to the same row replaces its line.
5. File page with no photo (all existing files, Foster Road) → header renders byte-identical to today.

---

### Task 1: `XIcon` and `UploadResultLine`

**Files:**
- Create: `apps/web/src/components/ui/XIcon.tsx`
- Create: `apps/web/src/components/ui/UploadResultLine.tsx`
- Test: `apps/web/src/__tests__/components/UploadResultLine.test.ts`

**Interfaces:**
- Produces: `XIcon({ size = 16, className = "" }: { size?: number; className?: string })` — same signature and SVG attributes as `CheckIcon` (24×24 viewBox, `stroke="currentColor"`, `strokeWidth={1.5}`, round caps/joins, `aria-hidden="true"`), path `M7 7L17 17 M7 17L13.44 10.56 M15.56 8.44L17 7` (gap on the bottom-left→top-right line, halfway from center to the top-right end; header comment says it is Ryan's design, matching CheckIcon's broken-line style).
- Produces: `type UploadResult = { name: string; ok: true } | { name: string; ok: false; error: string }` (exported from `UploadResultLine.tsx`) and `UploadResultLine({ label, result, align = "left" }: { label?: string; result: UploadResult | null; align?: "left" | "center" })`. Renders nothing when `result` is null. Text is `label ?? result.name`. Success: `text-[#9E8C61]` + `CheckIcon size={14}`. Failure: `text-red-600` + `XIcon size={14}` + `result.error`. Classes `mt-1.5 inline-flex items-center gap-1 text-xs` (the wizard's current "Photo uploaded" line); `align="center"` wraps in `text-center`.

- [ ] **Step 1: Write failing tests** — `renders nothing without a result`; `success shows the file name and the check icon in gold` (contains `Pest.pdf`, `text-[#9E8C61]`, CheckIcon path `M7 12.9`); `failure shows the label, the X icon and the server reason in red` (label `Photo uploaded`, contains `M7 7L17 17`, `File exceeds 50MB limit`, `text-red-600`); `center alignment wraps the line in text-center`.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/components/UploadResultLine.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement both files.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(ui): shared XIcon and upload result line`.

### Task 2: Schema + migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (`model ListingFile` ~L474: add `photoKey String?`; `model FileDocument` ~L680: add `isAdditional Boolean @default(false)`)
- Create: `packages/database/prisma/migrations/20261021120000_listing_photo_and_additional_documents/migration.sql`
- Modify: `apps/web/src/types/transaction.ts` (`FileDocumentRecord`: add `isAdditional: boolean`; listing file type: add `photoKey: string | null`)

**Interfaces:**
- Produces: `ListingFile.photoKey`, `FileDocument.isAdditional` columns and TS fields used by Tasks 3–10.

- [ ] **Step 1: Write the migration** — header comment like `20261015120000_add_property_area` ("additive, no table rewrite"):
```sql
ALTER TABLE "ListingFile" ADD COLUMN "photoKey" TEXT;
ALTER TABLE "FileDocument" ADD COLUMN "isAdditional" BOOLEAN NOT NULL DEFAULT false;
-- Backfill: not on a checklist item and never removed from one = added via Additional Documents.
UPDATE "FileDocument" d SET "isAdditional" = true
WHERE d."checklistItemId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "FileActivity" a
    WHERE a."type" = 'DOCUMENT_REMOVED' AND a."payload"->>'documentId' = d."id"
  );
```
- [ ] **Step 2: Verify** `cd packages/database && npx prisma validate && npx prisma generate` → valid, client generated. `cd apps/web && npx tsc --noEmit -p .` → 0 errors (fix fixtures that build `FileDocumentRecord` literals by adding `isAdditional: false`).
- [ ] **Step 3: STOP — ask Ryan before `npx prisma migrate deploy`** (it hits production; the change is additive and safe for the live code). After his OK, run it and confirm with a read-only query: Foster Road's "Pest Inspection Report.pdf" `isAdditional = true`, "nhdFullReport_91826-100_11538_FOSTER_RD.pdf" `false`.
- [ ] **Step 4: Commit** `feat(db): listing photo and additional-document flag`.

### Task 3: Document API rules

**Files:**
- Modify: `apps/web/src/app/api/documents/route.ts` (create: `isAdditional: !checklistItemId`)
- Modify: `apps/web/src/app/api/documents/[id]/remove/route.ts`
- Modify: `apps/web/src/app/api/admin/documents/[id]/approve/route.ts` (~L163–192)
- Modify: `apps/web/src/app/api/documents/[id]/download/route.ts`
- Test: `__tests__/api/documents.test.ts`, `documents-remove.test.ts`, `admin-documents-approve.test.ts`, `documents-download.test.ts`

**Interfaces:**
- Produces: remove route accepts an additional document: same agent rule (own upload, `PENDING_REVIEW` only; admin any, status kept); update sets `isAdditional: false` (+ `NOT_SUBMITTED` when it was pending); logs `DOCUMENT_REMOVED` with `checklistItemName: null`. Still 400 when the document is neither on a checklist item nor additional.
- Produces: `GET /api/documents/[id]/download?redirect=1` → 302 to the presigned URL (no `redirect` → JSON `{ url }` as today, for `DocumentReviewCard`).

- [ ] **Step 1: Failing tests** — `marks a document uploaded without a checklist item as additional` / `…with one as not additional`; `lets an agent remove their own pending additional document` (update data `{ isAdditional: false, reviewStatus: "NOT_SUBMITTED" }`); `refuses an agent removing someone else's additional document` (403); `still rejects a document that is neither on a checklist nor additional` (400); `does not send the all-approved email when the approved document is additional` (`sendAllDocsApproved` not called even when `isReadyToClose`); `redirects to the presigned URL when asked to` (302, `Location` = mocked URL).
- [ ] **Step 2: Run the four files** → the new tests FAIL.
- [ ] **Step 3: Implement.** Approve: wrap the `isReadyToClose` email block in `if (doc.checklistItemId)`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(documents): additional-document rules, redirect download`.

### Task 4: `useFileUpload` per-target results

**Files:**
- Modify: `apps/web/src/hooks/useFileUpload.ts`
- Test: `apps/web/src/__tests__/lib/useFileUpload.test.ts` (test the extracted pure function)

**Interfaces:**
- Produces: `export async function uploadDocument(fileType, fileId, itemId: string | null, file: File): Promise<UploadResult>` — returns `{ name, ok: false, error }` using the server's `error` text from `/api/upload-url` or `/api/documents` when present, else `"Upload failed"`; never throws.
- Produces: hook returns `{ uploadingId, results, upload }` where `results: Record<string, UploadResult>` keyed by item id or `"additional"`; a new upload to a key replaces that key only. `error` is removed (callers updated in Tasks 5).

- [ ] **Step 1: Failing tests** (mock `fetch`) — `returns the server's reason when the upload URL is refused` (`File type not allowed. Use PDF, JPG, PNG, or DOCX.`); `returns Upload failed when the storage PUT fails`; `returns the server's reason when registering the document fails`; `returns ok with the file name on success`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `uploadDocument` and rewire the hook onto it.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(uploads): keep each upload's result and the server's reason`.

### Task 5: Checklist result lines + shared Additional Documents (agent and admin)

**Files:**
- Create: `apps/web/src/components/transactions/document-status-icons.tsx` (move `STATUS_ICONS` out of `ChecklistPanel.tsx` verbatim)
- Create: `apps/web/src/components/transactions/AdditionalDocuments.tsx`
- Modify: `apps/web/src/components/transactions/ChecklistPanel.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx` (~L372, pass `documents`)
- Modify: `apps/web/src/app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx` (~L245–286)
- Test: `apps/web/src/__tests__/components/AdditionalDocuments.test.ts`, `ChecklistPanel.test.ts`

**Interfaces:**
- Consumes: `UploadResultLine`, `UploadResult` (Task 1); hook `results` (Task 4); `removeFromChecklist` (`lib/document-actions`, works for additional docs after Task 3); `DocumentReviewCard`.
- Produces: `AdditionalDocuments({ documents, mode, uploading, disabled, result, onSelect, viewerId, onChanged }: { documents: FileDocumentRecord[]; mode: "agent" | "admin"; uploading: boolean; disabled: boolean; result: UploadResult | null; onSelect: (f: File) => void; viewerId?: string; onChanged: () => void })`. Renders the existing heading row (heading + `UploadFileButton label="Add Document" variant="outline"`, markup unchanged), then `UploadResultLine` (left), then the list: only `isAdditional` documents, oldest first. Agent row: status icon + name, "Rejected — please re-upload" / "Reason: …" when rejected, trash with the same `window.confirm` copy and rule as checklist rows. Admin row: `DocumentReviewCard` with `onReviewed={onChanged}`.
- ChecklistPanel: `documents: FileDocumentRecord[]` prop added; each row gets `UploadResultLine result={results[item.id]}` directly under it; the top-of-panel upload error is removed (remove error stays). Admin page: same per-card line under each item header; top `uploadError` removed; its Additional Documents block replaced by `AdditionalDocuments mode="admin"`.

- [ ] **Step 1: Failing tests** — `lists only additional documents` (one additional + one Unattached removed → only the additional name); `agent sees the rejection reason under a rejected additional document`; `agent sees a remove button only on their own pending upload`; `admin gets the broker review card with Approve and Reject`; `shows the last upload result under the heading`; ChecklistPanel `shows a failed upload's reason under that checklist row, not at the top`; `renders the same row markup as before when there is no result` (snapshot the row HTML before changing code, assert equality after).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the two files + `npx tsc --noEmit -p .` → PASS / 0.
- [ ] **Step 5: Commit** `feat(checklist): per-row upload results and a shared Additional Documents list`.

### Task 6: Documents tab label + download; black header bars

**Files:**
- Modify: `apps/web/src/lib/dashboard-phone.ts` (add `TABLE_HEAD_DARK_ROW = "bg-[#1B1B1B]"` and `TABLE_HEAD_DARK_CELL = "text-xs font-medium uppercase tracking-wider text-white"` next to `PHONE_TABLE_FRAME`)
- Modify: `apps/web/src/components/admin/AdminTable.tsx` (use the constants; rendered HTML must not change)
- Modify: `apps/web/src/components/transactions/DocumentsTab.tsx`
- Modify: `apps/web/src/components/transactions/PartiesTable.tsx`
- Test: `apps/web/src/__tests__/components/DocumentsTab.test.ts`, `PartiesTable.test.ts`, `AdminTable.test.ts`

**Interfaces:**
- DocumentsTab: Checklist Item cell = item name, else `"Additional Document"` when `doc.isAdditional`, else `"Unattached"`; download `href={`/api/documents/${doc.id}/download?redirect=1`}` (keep `target="_blank"`); header row uses the dark constants (keep each `th`'s padding and text alignment).
- PartiesTable: header row dark; header and body cells get `px-5` (Documents' side padding); header cells `py-3`.

- [ ] **Step 1: Failing tests** — `labels a document added through Additional Documents`; `still labels a removed document Unattached`; `downloads through the document's download route` (href, no raw key); `Documents header bar is black with white text`; `Parties header bar is black with white text and padded like Documents`; `AdminTable header markup is unchanged` (assert current HTML string before refactor).
- [ ] **Step 2: Run** → FAIL (except AdminTable, which must PASS before and after).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(files): Additional Document label, working downloads, black table headers`.

### Task 7: Wizard photo backend

**Files:**
- Create: `apps/web/src/lib/wizard-photo.ts`
- Create: `apps/web/src/app/api/wizard-photo/upload-url/route.ts`
- Create: `apps/web/src/app/api/wizard-photo/route.ts`
- Modify: `apps/web/src/lib/r2.ts` (add `getR2ObjectBuffer(key: string): Promise<Buffer>`)
- Modify: `apps/web/src/app/api/transactions/route.ts` (~L39, L122), `apps/web/src/app/api/listings/route.ts` (~L54), `apps/web/src/app/api/listings/[id]/convert/route.ts` (~L47: copy `photoKey: listing.photoKey`)
- Test: `__tests__/lib/wizard-photo.test.ts`, `__tests__/api/wizard-photo.test.ts`, `transactions.test.ts`, `listings.test.ts`, `listings-convert.test.ts`

**Interfaces:**
- Produces (`lib/wizard-photo.ts`): `PHOTO_TYPES = ["image/jpeg", "image/png"]`, `PHOTO_MAX_BYTES = 20 * 1024 * 1024`, `wizardPhotoPrefix(userId: string): string` → `wizard-photos/${userId}/`, `isOwnWizardPhoto(key: string, userId: string): boolean` (starts with prefix, ends with `/photo.jpg`, no `..`).
- Produces: `GET /api/wizard-photo/upload-url?filename&contentType&size` → `{ uploadUrl, key }` for `wizard-photos/<userId>/<cuid>/original`; 400 `"Photo must be a JPG or PNG"` / `"Photo exceeds 20MB limit"`; 401 unauthenticated.
- Produces: `POST /api/wizard-photo` `{ key }` → verifies `key` is the caller's `…/original`, reads it, `sharp().rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 })`, stores `…/photo.jpg`, deletes the original, returns `{ photoKey }`; 400 `"Couldn't read that photo"` if sharp fails.
- Create routes: when `photoKey` is non-empty and `!isOwnWizardPhoto(photoKey, session.user.id)` → 400 `"Invalid photo"`, nothing created.

- [ ] **Step 1: Failing tests** — `isOwnWizardPhoto` accepts own `photo.jpg`, rejects another user's, an `original`, a document key, and `..`; upload-url refuses HEIC and 25 MB with the exact messages; process `shrinks the photo and returns its key` (sharp mocked or a tiny real PNG; asserts `uploadToR2` called with `…/photo.jpg`, `image/jpeg`, and `deleteR2Object` with the original); process `refuses another user's key` (403); transactions/listings `refuse a photo key that isn't the caller's` (400, `create` not called) and `save the caller's photo key`; convert `carries the listing photo over`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(photos): agent-scoped wizard photo upload, shrunk on the server`.

### Task 8: `PhotoUploadField` in both wizards

**Files:**
- Create: `apps/web/src/components/transactions/PhotoUploadField.tsx`
- Create: `apps/web/src/lib/wizard-photo-client.ts` (`uploadWizardPhoto(file: File): Promise<{ ok: true; photoKey: string } | { ok: false; error: string }>` — upload-url → PUT → POST process; server reason passed through, else `"Upload failed"`)
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx` (~L51–52, L222–240, L447–466: replace with the field; drop `photoTempId`)
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-listing/page.tsx` (form state `photoKey: ""`; field after the List Date / Expiration Date row ~L116, inside step 0; send `photoKey` on create)
- Test: `__tests__/components/PhotoUploadField.test.ts`, `__tests__/lib/wizard-photo-client.test.ts`

**Interfaces:**
- Produces: `PhotoUploadField({ photoKey, onChange }: { photoKey: string; onChange: (key: string) => void })` — the transaction wizard's current markup moved verbatim (centered "Property Photo" label, black pill `label` with sr-only `input type="file" accept="image/jpeg,image/png"`, "Upload Photo" / "Uploading…" / "Replace Photo"), no motion/pulse, then `UploadResultLine label="Photo uploaded" align="center"`. On failure `onChange("")` is not called (a previous good photo is kept).

- [ ] **Step 1: Failing tests** — client: `passes the server's reason through` and `returns the shrunk photo key`; field: `shows Upload Photo with no photo` and `Replace Photo once a photo is set`; `accepts only JPG and PNG`; `renders the transaction wizard's existing markup` (string-compare the label/button block against the pre-change HTML captured first).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** and swap both wizards onto it.
- [ ] **Step 4: Run** + `tsc` → PASS / 0.
- [ ] **Step 5: Commit** `feat(wizards): working photo upload in both wizards`.

### Task 9: Shared `PhotoLightbox`

**Files:**
- Create: `apps/web/src/components/ui/PhotoLightbox.tsx`
- Modify: `apps/web/src/components/properties/PhotoGallery.tsx` (~L84–145)
- Test: `__tests__/components/PhotoLightbox.test.ts`

**Interfaces:**
- Produces: `PhotoLightbox({ photos, index, alt, onIndexChange, onClose }: { photos: string[]; index: number; alt: (i: number) => string; onIndexChange: (i: number) => void; onClose: () => void })` — PhotoGallery's portal markup moved verbatim (same classes, lucide `X`/chevrons, outside-click closes, photo click doesn't). Counter and arrows render only when `photos.length > 1`. Adds Escape-to-close (keydown listener) — the only behavior change.
- PhotoGallery renders `PhotoLightbox` with `alt={(i) => `${address} photo ${i + 1}`}`; its own output must be unchanged.

- [ ] **Step 1: Failing tests** — `hides the counter and arrows for a single photo`; `shows the counter and arrows for several photos`; `matches the gallery's lightbox markup` (capture current markup first).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** + existing `PhotoSwiper.test.ts` → PASS.
- [ ] **Step 5: Commit** `refactor(photos): share the listing gallery's lightbox`.

### Task 10: Photo beside the file address (agent and admin)

**Files:**
- Create: `apps/web/src/app/api/files/[fileType]/[id]/photo/route.ts`
- Create: `apps/web/src/components/transactions/FileHeaderPhoto.tsx`
- Modify: agent page header (~L226–240) and admin page header (~L148–166): wrap the address block and `<FileHeaderPhoto>` in `flex items-start gap-4`
- Modify: `apps/web/src/components/transactions/OverviewTab.tsx` (remove the Property Photo card ~L169–175)
- Delete: `apps/web/src/app/api/transactions/[id]/photo/route.ts` and `__tests__/api/transaction-photo.test.ts` (port its cases)
- Test: `__tests__/api/files-photo.test.ts`, `__tests__/components/FileHeaderPhoto.test.ts`

**Interfaces:**
- Consumes: `getFileAndVerifyAccess`, `getR2ObjectBuffer` or the existing stream pattern, `PhotoLightbox`.
- Produces: `GET /api/files/[fileType]/[id]/photo` — 400 bad fileType, 401, 404 no file/forbidden/no `photoKey`; streams the image with `Cache-Control: private, max-age=3600` (photos can't change after creation).
- Produces: `FileHeaderPhoto({ fileType, fileId, photoKey, address }: { fileType: "listing" | "transaction"; fileId: string; photoKey: string | null; address: string })` — null when no `photoKey`; otherwise a button with an `img` `h-14 w-[84px] rounded-lg object-cover` (`h-14` = the two `text-xl` lines) that opens `PhotoLightbox` with one photo.

- [ ] **Step 1: Failing tests** — route: `serves a listing photo to its agent`, `serves any file's photo to the broker`, `hides another agent's photo` (404), `is cacheable for an hour`; component: `renders nothing without a photo`; `shows the photo from the file photo route`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**, remove the old route/card/test.
- [ ] **Step 4: Run** + `tsc` + `grep -rn "api/transactions/.*photo" src` (no hits) → PASS.
- [ ] **Step 5: Commit** `feat(files): property photo beside the address with a full-size view`.

### Task 11: Sentry extension filter

**Files:** Modify `apps/web/sentry.client.config.ts`.

- [ ] **Step 1:** Add to `Sentry.init`: `ignoreErrors: [/MetaMask/i]`, `denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-web-extension:\/\//, /^app:\/\/\/scripts\/inpage\.js/]`, with a one-line comment (browser-extension noise, e.g. CNC-REALTY-2C). Config only — no test.
- [ ] **Step 2:** `npx tsc --noEmit -p .` → 0. Commit `chore(sentry): ignore browser-extension errors`.

### Task 12: Whole-build verification

- [ ] **Step 1:** `cd apps/web && npx vitest run` → all pass (report any failure by name); `npx tsc --noEmit -p .` → 0; `npx eslint` on every touched file → 0 new errors.
- [ ] **Step 2: Baseline build** — `git worktree add ../CnC-base f3a913d`, install, `next build`, serve on 3100; this branch built and served on 3101.
- [ ] **Step 3: Pixel A/B (targeted, numeric)** with `.superpowers/pf-survey/t9PF.cjs`-style diffing at 1440 and 390: `/properties/<mls>` with the lightbox open; agent + admin file page for a file **without** a photo (Overview, Documents, Parties, Checklist tabs) — differences allowed only in the Documents/Parties header bars, Parties cell padding, and the Additional Documents list. New Listing wizard step 1 and New Transaction Property step — only the photo block may differ (listing) / nothing (transaction). Report pixel counts, no screenshot sweep.
- [ ] **Step 4: Speed A/B (token-light)** — `speedAB.cjs`-style, 5 alternating runs per side, print one median line per page: `/properties/<mls>` (public, desktop + phone viewport) and one signed-in file page (desktop + phone). Pass = new median within run-to-run noise of old.
- [ ] **Step 5:** Live test send not needed (no email templates changed). Remove `../CnC-base`. Report to Ryan; push only on his OK.
