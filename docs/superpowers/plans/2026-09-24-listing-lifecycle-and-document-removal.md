# Listing Lifecycle & Document Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the listing lifecycle (card date label, open-after-convert, agent status dropdown, listing↔transaction sync, admin-only listing delete) and add SkySlope-style document Remove plus admin-only permanent Delete.

**Architecture:** Every status change already flows through `changeFileStatus` (`lib/file-status.ts`), so sync lives there. UI reuses shared pieces: `FileCard`, `DocumentsTab`, `ChecklistPanel`, `DocumentReviewCard`, and a new `FileStatusSelect` extracted from the admin page's inline `<select>`. Pure rules live in `lib/transaction-helpers.ts` so they are unit-testable (vitest runs in `node`, no DOM).

**Tech Stack:** Next.js 14 App Router, Prisma/Neon, Vitest (node env), Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-24-listing-lifecycle-and-document-removal-design.md`

## Global Constraints

- Applies to every listing type and every transaction side — no test-file special cases.
- Before creating a component/helper, grep for an existing one; extend it instead.
- All buttons are round pills (`rounded-full`).
- Run from `apps/web`: `npx vitest run <file>`; full gate = `npx vitest run` + `npx tsc --noEmit -p .` + `npx next lint --file <changed files>`.
- The migration (Task 7) touches the shared dev/prod Neon DB and needs the dev server stopped for `prisma generate` — **ask Ryan before running it**.
- Commit after each task: `git commit` with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer.

---

### Task 1: File card date label

**Files:** Modify `src/lib/transaction-helpers.ts` (next to `pickDisplayPrice`), `src/components/transactions/FileCard.tsx`, `src/app/(dashboard)/dashboard/transactions/page.tsx:78`, `src/app/(dashboard)/admin/transactions/page.tsx:82`. Test `src/__tests__/lib/transaction-helpers.test.ts`.

**Produces:** `pickDisplayDate(kind: "listing" | "transaction", item: { expirationDate?: string | null; closeOfEscrow?: string | null }): { label: "Expires" | "COE"; date: string } | null`; `FileCard` prop `displayDate?: { label: string; date: string } | null` replacing `closeDate`.

- [ ] Test (RED):
```ts
describe("pickDisplayDate", () => {
  it("labels a listing's expiration date 'Expires'", () => {
    expect(pickDisplayDate("listing", { expirationDate: "2026-02-22T00:00:00.000Z", closeOfEscrow: null })).toEqual({ label: "Expires", date: "2026-02-22T00:00:00.000Z" });
  });
  it("labels a transaction's close of escrow 'COE'", () => {
    expect(pickDisplayDate("transaction", { closeOfEscrow: "2026-03-01T00:00:00.000Z" })).toEqual({ label: "COE", date: "2026-03-01T00:00:00.000Z" });
  });
  it("never shows a listing's date as COE or a transaction's as Expires", () => {
    expect(pickDisplayDate("listing", { closeOfEscrow: "2026-03-01T00:00:00.000Z", expirationDate: null })).toBeNull();
    expect(pickDisplayDate("transaction", { expirationDate: "2026-02-22T00:00:00.000Z", closeOfEscrow: null })).toBeNull();
  });
});
```
- [ ] Implement:
```ts
export function pickDisplayDate(
  kind: "listing" | "transaction",
  item: { expirationDate?: string | null; closeOfEscrow?: string | null },
): { label: "Expires" | "COE"; date: string } | null {
  if (kind === "listing") return item.expirationDate ? { label: "Expires", date: item.expirationDate } : null;
  return item.closeOfEscrow ? { label: "COE", date: item.closeOfEscrow } : null;
}
```
- [ ] `FileCard`: replace `closeDate` prop with `displayDate`, render `{displayDate && <p className="text-xs text-[#1B1B1B]/50">{displayDate.label}: {formatDateOnly(displayDate.date)}</p>}`. Both pages: `displayDate={pickDisplayDate(<kind>, item)}`.
- [ ] Gate + commit `fix: label listing card dates "Expires" instead of "COE"`.

### Task 2: Open the new transaction after Convert

**Files:** `src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx:125-134`. UI-only wiring (no DOM tests in this repo) — verified live by Ryan.

- [ ] Replace `router.push("/dashboard/transactions");` with:
```ts
const { transactionFile } = await res.json();
router.push(`/dashboard/transactions/transaction/${transactionFile.id}`);
```
- [ ] Gate + commit `feat: open the new transaction file after converting a listing`.

### Task 3: Agent listing guardrail — no agent CANCELED

**Files:** `src/lib/transaction-helpers.ts` (`AGENT_LISTING_TRANSITIONS`), test `src/__tests__/lib/transaction-helpers.test.ts`.

- [ ] Test (RED):
```ts
it.each(["COMING_SOON", "ACTIVE", "ACTIVE_UNDER_CONTRACT"])("does not let an agent cancel a %s listing (broker only)", (from) => {
  expect(canTransitionListing(from as any, "CANCELED", "AGENT")).toBe(false);
  expect(canTransitionListing(from as any, "CANCELED", "ADMIN")).toBe(true);
});
it("still lets an agent withdraw an active listing", () => {
  expect(canTransitionListing("ACTIVE", "WITHDRAWN", "AGENT")).toBe(true);
});
```
- [ ] Remove `"CANCELED"` from the `COMING_SOON`, `ACTIVE`, `ACTIVE_UNDER_CONTRACT` agent rows. Confirm each `ADMIN_LISTING_TRANSITIONS` row still contains `CANCELED` (admin inherits agent rows, so add explicitly where missing).
- [ ] Gate + commit `fix: only the broker can cancel a listing`.

### Task 4: Shared `FileStatusSelect` + agent listing dropdown

**Files:** Create `src/components/transactions/FileStatusSelect.tsx`; modify admin page `src/app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx:152-161`, agent page `src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx` header; export `statusLabel` from `StatusBadge.tsx` (its existing `LABELS` map).

**Produces:** `<FileStatusSelect current statuses disabled onChange deleteAction? />` where `deleteAction?: { label: string; onSelect: () => void }` renders a disabled divider option then the delete option; selecting it calls `onSelect` and leaves the value unchanged.

- [ ] Component (labels via `statusLabel`, falls back to `s.replace(/_/g, " ")`):
```tsx
"use client";
import { statusLabel } from "./StatusBadge";
const DELETE_VALUE = "__delete__";
export function FileStatusSelect({ current, statuses, disabled, onChange, deleteAction }: {
  current: string; statuses: string[]; disabled?: boolean;
  onChange: (status: string) => void;
  deleteAction?: { label: string; onSelect: () => void };
}) {
  return (
    <select
      disabled={disabled}
      value={current}
      onChange={(e) => (e.target.value === DELETE_VALUE ? deleteAction?.onSelect() : onChange(e.target.value))}
      className="rounded-full border border-[#1B1B1B]/10 bg-white px-3 py-2 text-sm text-[#1B1B1B] disabled:opacity-50"
    >
      {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
      {deleteAction && <option disabled>──────────</option>}
      {deleteAction && <option value={DELETE_VALUE}>{deleteAction.label}</option>}
    </select>
  );
}
```
- [ ] Admin page: swap the inline `<select>` for `<FileStatusSelect current={file.status} statuses={statuses} disabled={statusLoading} onChange={changeStatus} />` (delete wired in Task 6).
- [ ] Add a pure helper in `transaction-helpers.ts` with RED tests first: `agentListingStatusOptions(status: string): string[]` → `[]` when status is `ACTIVE_UNDER_CONTRACT`, `PENDING_TRANSFER`, `CLOSED`, or `CANCELED`; otherwise `allowedNextStatuses("listing", status, "AGENT").filter((s) => s !== "ACTIVE_UNDER_CONTRACT")`. Tests: Active → contains ACTIVE/…/WITHDRAWN but not ACTIVE_UNDER_CONTRACT or CANCELED; Under Contract → `[]`; Incomplete → `["COMING_SOON", "ACTIVE"]`.
- [ ] Agent page, listings only, not `readOnly`: when `agentListingStatusOptions(status)` is non-empty render `FileStatusSelect` with `[status, ...options]`; `onChange` PATCHes `/api/listings/${id}` `{ status }`, shows `body.error` in the existing `actionError`, then `load()`. Header order (Ryan): `[Convert to Transaction | View Transaction] [Submit for Review] [Status ▾]` — the dropdown is last.
- [ ] Gate + commit `feat: agents can change their listing's status (shared FileStatusSelect)`.

### Task 5: Listing ↔ transaction sync + View Transaction link

**Files:** `src/lib/file-status.ts`, test `src/__tests__/lib/file-status.test.ts`; `src/app/api/listings/[id]/route.ts` GET include; both file pages; `src/types/transaction.ts` (`ListingFileDetail.convertedFiles?: { id: string; status: string }[]`).

- [ ] Tests (RED) — transaction fixture gets `originatingListingId: "l1"`; mock `prisma.listingFile.findUnique` for the linked listing:
```ts
describe("changeFileStatus: keeps the originating listing in step", () => {
  const LINKED = { id: "l1", status: "ACTIVE_UNDER_CONTRACT", expirationDate: new Date("2099-01-01T00:00:00.000Z") };
  beforeEach(() => vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(LINKED as any));

  it("closes the listing when its transaction closes", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx({ originatingListingId: "l1" }) as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(prisma.listingFile.update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { status: "CLOSED" } });
  });
  it("returns the listing to ACTIVE when the transaction's cancellation is approved", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx({ status: "CANCELED_PENDING", originatingListingId: "l1" }) as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CANCELED_APPROVED", actor: ADMIN });
    expect(prisma.listingFile.update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { status: "ACTIVE" } });
  });
  it("returns the listing to EXPIRED instead when its expiration date has passed", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ ...LINKED, expirationDate: new Date("2000-01-01T00:00:00.000Z") } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx({ status: "CANCELED_PENDING", originatingListingId: "l1" }) as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CANCELED_APPROVED", actor: ADMIN });
    expect(prisma.listingFile.update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { status: "EXPIRED" } });
  });
  it("logs the listing's change in its own activity feed", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx({ originatingListingId: "l1" }) as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(prisma.fileActivity.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      fileType: "LISTING", listingFileId: "l1", type: "STATUS_CHANGED",
      payload: { from: "ACTIVE_UNDER_CONTRACT", to: "CLOSED", viaTransactionId: "f1" },
    }) });
  });
  it("leaves the listing alone when it is not Under Contract", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ ...LINKED, status: "WITHDRAWN" } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx({ originatingListingId: "l1" }) as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });
  it("does nothing for other transaction statuses or unlinked transactions", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx({ status: "INCOMPLETE", originatingListingId: "l1" }) as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "PENDING", actor: ADMIN });
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx() as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });
});
```
- [ ] Implement in `changeFileStatus`, after validation, before the `$transaction`:
```ts
const listingSyncOps: any[] = [];
if (!isListing && file.originatingListingId && (toStatus === "CLOSED" || toStatus === "CANCELED_APPROVED")) {
  const listing = await prisma.listingFile.findUnique({ where: { id: file.originatingListingId }, select: { id: true, status: true, expirationDate: true } });
  if (listing?.status === "ACTIVE_UNDER_CONTRACT") {
    const listingTo = toStatus === "CLOSED"
      ? "CLOSED"
      : listing.expirationDate && new Date(listing.expirationDate) < new Date() ? "EXPIRED" : "ACTIVE";
    listingSyncOps.push(
      prisma.listingFile.update({ where: { id: listing.id }, data: { status: listingTo } }),
      prisma.fileActivity.create({ data: {
        fileType: "LISTING", listingFileId: listing.id, transactionFileId: null,
        actorId: actor.userId, actorRole: actor.role, type: "STATUS_CHANGED",
        payload: { from: listing.status, to: listingTo, viaTransactionId: fileId },
      } }),
    );
  }
}
const [updated] = await prisma.$transaction([updateOp, prisma.fileActivity.create({ data: activityData }), ...listingSyncOps]);
```
- [ ] Listing GET: `include: { ...FILE_DETAIL_INCLUDE, convertedFiles: { select: { id: true, status: true }, orderBy: { createdAt: "desc" }, take: 1 } }`. Both pages: when listing `status === "ACTIVE_UNDER_CONTRACT"` and `convertedFiles?.[0]`, render a white pill link "View Transaction" (same classes as the Convert button) in the slot Convert occupies — first in the header row (agent → `/dashboard/transactions/transaction/<id>`, admin → `/admin/transactions/transaction/<id>`, admin places it before its status dropdown).
- [ ] Gate + commit `feat: keep a converted listing in step with its transaction`.

### Task 6: Admin-only listing delete (zero documents, not converted)

**Files:** `src/app/api/listings/[id]/route.ts` DELETE, test `src/__tests__/api/listings-id-delete.test.ts`; `src/lib/transaction-helpers.ts` `canDeleteListing`; admin page.

**Produces:** `canDeleteListing(listing: { documents?: unknown[]; convertedFiles?: unknown[] }): boolean` (true when both empty).

- [ ] Tests (RED), replacing the status-based cases: agent → 403; admin + documents → 400 `"Delete this listing's documents first"`; admin + converted → 400 `"This listing was converted to a transaction and can't be deleted"`; admin + none, any status (ACTIVE, PENDING_TRANSFER) → 200 and `listingFile.delete` called; R2 never called. Plus `canDeleteListing` unit tests.
- [ ] Route: `if (session.user.role !== "ADMIN") 403`; load with `include: { _count: { select: { documents: true, convertedFiles: true } } }`; reject per above; `prisma.listingFile.delete`. Remove the R2 loop (no documents by construction).
- [ ] Admin page: listings only, when `canDeleteListing(file)`: pass `deleteAction={{ label: "Delete listing…", onSelect: deleteListing }}` to `FileStatusSelect`; for `PENDING_TRANSFER`, render a small text link "Delete listing…" beside the purple label. `deleteListing` = `window.confirm("Permanently delete this listing file? This can't be undone.")` → `DELETE /api/listings/${id}` → `router.push("/admin/transactions")`, errors to `actionError`.
- [ ] Gate + commit `feat: listing delete is admin-only and requires an empty listing`.

### Task 7: Migration — `DOCUMENT_REMOVED`, `DOCUMENT_DELETED` (ASK RYAN FIRST)

**Files:** Create `packages/database/prisma/migrations/20260924200000_add_document_removed_deleted_activity/migration.sql`; modify `schema.prisma` `FileActivityType`; `src/types/transaction.ts` union; `src/components/transactions/ActivityFeed.tsx` labels.

- [ ] SQL:
```sql
-- AlterEnum
ALTER TYPE "FileActivityType" ADD VALUE 'DOCUMENT_REMOVED';
ALTER TYPE "FileActivityType" ADD VALUE 'DOCUMENT_DELETED';
```
- [ ] Schema enum + TS union + labels `DOCUMENT_REMOVED: "Document removed from checklist"`, `DOCUMENT_DELETED: "Document permanently deleted"` (ActivityFeed shows `payload.name` / `payload.reason` the way it shows existing payloads).
- [ ] With Ryan's OK: stop dev server, `pnpm --filter @cnc/database exec prisma migrate deploy`, `pnpm --filter @cnc/database exec prisma generate`, restart `pnpm --filter web dev`.
- [ ] Gate + commit `feat: activity types for document remove/delete`.

### Task 8: Document Remove API

**Files:** Create `src/app/api/documents/[id]/remove/route.ts`, test `src/__tests__/api/documents-remove.test.ts`.

- [ ] Tests (RED): 401 unauthenticated; 404 missing; agent removing someone else's doc → 403; agent removing APPROVED/REJECTED → 400 `"Only documents still in review can be removed"`; agent own PENDING_REVIEW → 200, `fileDocument.update` with `{ checklistItemId: null, reviewStatus: "NOT_SUBMITTED" }` and a `DOCUMENT_REMOVED` activity `{ name, documentId, checklistItemName }`; admin removing an APPROVED doc → 200 keeps `reviewStatus` (only `checklistItemId: null`); already-unattached → 400 `"This document isn't on a checklist item"`; locked parent file for agent → 403 via `assertFileEditable`.
- [ ] Implement with `resolveFileRef` + `assertFileEditable` (same as the documents DELETE route), update + activity in one `$transaction`.
- [ ] Gate + commit `feat: remove a document from its checklist item without deleting it`.

### Task 9: Admin-only permanent Delete with reason

**Files:** `src/app/api/documents/[id]/route.ts`, test `src/__tests__/api/documents-delete.test.ts`, update `src/__tests__/api/file-lock-file-routes.test.ts` expectations.

- [ ] Tests (RED): agent (even uploader) → 403; admin without reason / blank reason → 400 `"A reason is required"`; admin with reason, any review status (incl. APPROVED) → 200, activity `DOCUMENT_DELETED` `{ name, documentId, reason }` written **before** the row is deleted, `deleteR2Object` + `fileDocument.delete` called.
- [ ] Implement: admin check first, `const { reason } = await req.json().catch(() => ({}))`, trim, activity create, R2 delete, row delete. Admin is exempt from the closed-file lock already (`assertFileEditable`).
- [ ] Gate + commit `feat: permanent document delete is admin-only and logged with a reason`.

### Task 10: Remove / Delete UI

**Files:** `ChecklistPanel.tsx` (agent trash icon), agent page (pass `viewerId={session?.user?.id}`), `DocumentReviewCard.tsx` (admin Remove), `DocumentsTab.tsx` (admin trash + inline reason form), admin page (pass `canDelete` + `onChanged={load}` to `DocumentsTab`). Reuse `TrashIcon`, `window.confirm` for Remove, and `DocumentReviewCard`'s inline reject-form pattern for the reason.

- [ ] `ChecklistPanel`: when `topDoc?.reviewStatus === "PENDING_REVIEW" && topDoc.uploadedByAgentId === viewerId && !readOnly`, show a `TrashIcon` button (title "Remove this document") before Upload → `window.confirm("Remove this document from the checklist? It stays in the file's Documents tab.")` → `POST /api/documents/${id}/remove` → `onUploaded()`; errors shown in the panel's error line.
- [ ] `DocumentReviewCard`: white pill "Remove" button placed after Download / Approve / Reject (admin, any status, only when `doc.checklistItemId`) → `window.confirm("Remove this document from the checklist item? The checklist item stays; the document moves to the Documents tab.")` → same endpoint → `onReviewed()`.
- [ ] `DocumentsTab`: optional `canDelete?: boolean; onChanged?: () => void`. When `canDelete`, add a trailing column with `TrashIcon`; clicking expands an inline row: warning text ("Permanently erases this file. It can't be undone. California requires keeping file documents for 3 years (B&P §10148) — only delete a document that doesn't belong in this file."), required reason textarea, pill "Delete permanently" (disabled until reason) → `DELETE /api/documents/${id}` `{ reason }` → `onChanged()`.
- [ ] Gate + commit `feat: Remove on the checklist, admin permanent Delete on the Documents tab`.

### Task 10b: Morning status job (date-driven)

**Files:** Create `src/lib/auto-status.ts`; modify `src/app/api/cron/listing-expiration-warnings/route.ts` to call it; test `src/__tests__/lib/auto-status.test.ts`.

**Produces:** `runAutoStatus(now: Date): Promise<{ listingsActivated: number; listingsExpired: number; transactionsExpired: number; transactionsReopened: number }>`.

- [ ] Tests (RED), prisma mocked: `COMING_SOON` listing with `listDate ≤ today` → `ACTIVE`; `ACTIVE`/`COMING_SOON` with `expirationDate < today` → `EXPIRED` (expiration wins over activation); `INCOMPLETE` never touched; `PENDING` transaction with `closeOfEscrow < today` → `EXPIRED`; `EXPIRED` transaction with `closeOfEscrow ≥ today` → `PENDING`; each change writes a `STATUS_CHANGED` activity `{ from, to, automatic: true }` with `actorId` = the file agent's `userId`, `actorRole: "AGENT"`; "today" is the Pacific calendar day (`America/Los_Angeles`) compared against UTC-midnight date-only fields.
- [ ] Implement with `findMany` on the indexed `status` column (select `id`, `status`, dates, `agent.userId`) and one `$transaction([update, activity])` per changed file. Cron route: call `runAutoStatus(new Date())` after the existing warnings and include the counts in its JSON response. Ignore failures per file (log to Sentry, continue).
- [ ] Gate + commit `feat: date-driven listing/transaction statuses in the morning job`.

### Task 11: Live verification + cleanup (with Ryan)
- [ ] Ryan clicks through: card labels, convert redirect, agent dropdown (no Cancel), sync (close + cancel-approved), delete listing option visibility, Remove/Delete flows.
- [ ] Clean up today's test listing + transaction + 8 R2 objects directly (show Ryan the exact rows first), verify zero orphans and R2 keys gone.
