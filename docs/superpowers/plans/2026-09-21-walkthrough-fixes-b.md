# Walkthrough Fixes B (review, status and email flow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One shared status-change function, a server-enforced closed-file lock, emails that never block an action, and visible errors plus the rejection reason on screen.

**Architecture:** New small lib modules (`file-lock`, `file-messages`, `file-status`, `email/send-safely`) plus an `allowedNextStatuses` helper beside the existing transition tables. The three status routes call `changeFileStatus`; every route an agent can use to change a file calls `assertFileEditable` right after its ownership check; the UI reads the same rules.

**Tech Stack:** Next.js 14 App Router, Prisma 5, Vitest (node env, `src/**/*.test.ts`), `@sentry/nextjs`, Tailwind. No schema change, no migration.

**Spec:** `docs/superpowers/specs/2026-09-21-walkthrough-fixes-b-design.md`

## Global Constraints

- Repo: `C:\Users\hey_r\Desktop\CnC-Realty`, branch `main`. Run all commands from `apps/web` (`npx vitest run <fragment>`, `npx tsc --noEmit`, which must stay at 0 errors).
- Every commit message ends with a blank line then `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. `git add` explicit paths only. **Never push.**
- **Never run `next build` or start/stop/restart any dev server.** Ryan's dev server runs on :3000 and a build breaks it. The controller does the one production build at the end, with Ryan's OK.
- Never read the file detail page (`app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx`, ~900 lines) whole. Use grep and offset/limit reads.
- Tests go in `apps/web/src/__tests__/`, mirroring existing files. Test-first for logic: write the test, run it, see it fail for the stated reason, then implement.
- Locked statuses: transactions `CLOSED`, `ARCHIVED`, `CANCELED_APPROVED`; listings `CLOSED`, `CANCELED`. Admin is exempt everywhere.
- Lock message, exactly: `This file is closed and can't be changed`. Email warning text, exactly: `Saved, but the email to the agent couldn't be sent.`
- Awaiting Review is cleared only when an ADMIN changes the status. It is never cleared by document review.
- Only an admin ever sees `emailWarning`. Agent-triggered email failures are logged to Sentry and nothing else.
- The referral lifecycle tests in `transactions-id.test.ts` must keep passing.

## File Structure

| File | Responsibility |
|---|---|
| `lib/file-messages.ts` (new) | Two constant strings shared by server and UI |
| `lib/file-lock.ts` (new) | Pure `isFileLocked`, `isFileReadOnlyFor` (safe to import in client code) |
| `lib/api-auth.ts` (modify) | `assertFileEditable` (server); `getFileAndVerifyAccess` also returns `status` |
| `lib/email/send-safely.ts` (new) | `sendSafely`: await a send, log to Sentry on failure, never throw |
| `lib/transaction-helpers.ts` (modify) | `allowedNextStatuses` |
| `lib/file-status.ts` (new) | `changeFileStatus`: the single status-change implementation |
| Routes | Thin: authenticate, ownership, lock, call the shared function |
| Components / page | Read-only mode, inline errors, warnings, rejection reason |

All paths are under `apps/web/src/`.

---

### Task 1: Lock rules and the guard

**Files:**
- Create: `apps/web/src/lib/file-messages.ts`
- Create: `apps/web/src/lib/file-lock.ts`
- Modify: `apps/web/src/lib/api-auth.ts`
- Test: `apps/web/src/__tests__/lib/file-lock.test.ts`

**Interfaces:**
- Produces: `FILE_LOCKED_MESSAGE`, `EMAIL_WARNING_TEXT` (strings); `isFileLocked(kind, status)`, `isFileReadOnlyFor(kind, status, role)` (booleans); `assertFileEditable(kind, status, role): NextResponse | null`; `getFileAndVerifyAccess` now resolves to `{ id, agentId, status } | null`.

- [ ] **Step 1: Write the failing test** at `apps/web/src/__tests__/lib/file-lock.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { isFileLocked, isFileReadOnlyFor } from "@/lib/file-lock";
import { assertFileEditable } from "@/lib/api-auth";
import { FILE_LOCKED_MESSAGE, EMAIL_WARNING_TEXT } from "@/lib/file-messages";

describe("isFileLocked", () => {
  it.each(["CLOSED", "ARCHIVED", "CANCELED_APPROVED"])("locks a transaction that is %s", (s) => {
    expect(isFileLocked("transaction", s)).toBe(true);
  });
  it.each(["INCOMPLETE", "PRE_CONTRACT", "PENDING", "EXPIRED", "CANCELED_PENDING", "PENDING_TRANSFER", "REFERRAL_SUCCESSFUL", "REFERRAL_BROKER_REVIEW"])(
    "leaves a transaction that is %s editable",
    (s) => { expect(isFileLocked("transaction", s)).toBe(false); }
  );
  it.each(["CLOSED", "CANCELED"])("locks a listing that is %s", (s) => {
    expect(isFileLocked("listing", s)).toBe(true);
  });
  it.each(["INCOMPLETE", "COMING_SOON", "ACTIVE", "ACTIVE_UNDER_CONTRACT", "EXPIRED", "WITHDRAWN", "PENDING_TRANSFER"])(
    "leaves a listing that is %s editable",
    (s) => { expect(isFileLocked("listing", s)).toBe(false); }
  );
  it("does not lock when the status is missing", () => {
    expect(isFileLocked("transaction", undefined)).toBe(false);
    expect(isFileLocked("listing", null)).toBe(false);
  });
  it("does not treat an archived listing status as locked (listings have no ARCHIVED)", () => {
    expect(isFileLocked("listing", "ARCHIVED")).toBe(false);
  });
});

describe("isFileReadOnlyFor", () => {
  it("is read-only for an agent on a closed file", () => {
    expect(isFileReadOnlyFor("transaction", "CLOSED", "AGENT")).toBe(true);
  });
  it("is never read-only for an admin", () => {
    expect(isFileReadOnlyFor("transaction", "CLOSED", "ADMIN")).toBe(false);
  });
  it("is editable for an agent on an open file", () => {
    expect(isFileReadOnlyFor("listing", "ACTIVE", "AGENT")).toBe(false);
  });
});

describe("assertFileEditable", () => {
  it("returns a 403 with the lock message for an agent on a closed file", async () => {
    const res = assertFileEditable("transaction", "CLOSED", "AGENT");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    expect((await res!.json()).error).toBe("This file is closed and can't be changed");
  });
  it("returns null for an admin on a closed file", () => {
    expect(assertFileEditable("transaction", "CLOSED", "ADMIN")).toBeNull();
  });
  it("returns null for an agent on an open file", () => {
    expect(assertFileEditable("listing", "ACTIVE", "AGENT")).toBeNull();
  });
});

describe("shared messages", () => {
  it("uses the exact wording agreed with Ryan", () => {
    expect(FILE_LOCKED_MESSAGE).toBe("This file is closed and can't be changed");
    expect(EMAIL_WARNING_TEXT).toBe("Saved, but the email to the agent couldn't be sent.");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run file-lock`
Expected: FAIL, "Failed to resolve import @/lib/file-lock" (the modules do not exist yet).

- [ ] **Step 3: Create `lib/file-messages.ts`**

```ts
export const FILE_LOCKED_MESSAGE = "This file is closed and can't be changed";
export const EMAIL_WARNING_TEXT = "Saved, but the email to the agent couldn't be sent.";
```

- [ ] **Step 4: Create `lib/file-lock.ts`** (pure, no server imports, so client components can use it)

```ts
export type FileKind = "listing" | "transaction";

const LOCKED_TRANSACTION_STATUSES = ["CLOSED", "ARCHIVED", "CANCELED_APPROVED"];
const LOCKED_LISTING_STATUSES = ["CLOSED", "CANCELED"];

// Finished files can no longer be changed by the agent. WITHDRAWN and EXPIRED
// listings stay editable because an admin can reactivate them.
export function isFileLocked(kind: FileKind, status: string | null | undefined): boolean {
  if (!status) return false;
  return (kind === "listing" ? LOCKED_LISTING_STATUSES : LOCKED_TRANSACTION_STATUSES).includes(status);
}

export function isFileReadOnlyFor(kind: FileKind, status: string | null | undefined, role: string): boolean {
  return role !== "ADMIN" && isFileLocked(kind, status);
}
```

- [ ] **Step 5: Modify `lib/api-auth.ts`**

Add imports at the top:

```ts
import { isFileReadOnlyFor, type FileKind } from "@/lib/file-lock";
import { FILE_LOCKED_MESSAGE } from "@/lib/file-messages";
```

Add after `checkOwnership`:

```ts
// Returns the 403 response to send when an agent tries to change a finished
// file; returns null when the change is allowed (open file, or an admin).
export function assertFileEditable(
  kind: FileKind,
  status: string | null | undefined,
  role: string
): NextResponse | null {
  if (!isFileReadOnlyFor(kind, status, role)) return null;
  return NextResponse.json({ error: FILE_LOCKED_MESSAGE }, { status: 403 });
}
```

Change `getFileAndVerifyAccess` so it also selects and returns `status`. The whole function becomes:

```ts
export async function getFileAndVerifyAccess(
  fileType: "listing" | "transaction",
  fileId: string,
  callerAgentId: string | null,
  role: string
): Promise<{ id: string; agentId: string; status: string } | null> {
  const file = fileType === "listing"
    ? await prisma.listingFile.findUnique({ where: { id: fileId }, select: { id: true, agentId: true, status: true } })
    : await prisma.transactionFile.findUnique({ where: { id: fileId }, select: { id: true, agentId: true, status: true } });
  const { exists, forbidden, record } = checkOwnership(file, callerAgentId, role);
  if (!exists || forbidden) return null;
  return record;
}
```

- [ ] **Step 6: Run the new test, then anything that mocked the old select**

Run: `npx vitest run file-lock` → PASS.
Run: `npx vitest run api` → PASS. If a test asserts `select: { id: true, agentId: true }` exactly, change it to `select: { id: true, agentId: true, status: true }` (this is an intended change).
Run: `npx tsc --noEmit` → 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/file-messages.ts apps/web/src/lib/file-lock.ts apps/web/src/lib/api-auth.ts apps/web/src/__tests__/lib/file-lock.test.ts
git commit -m "feat: closed-file lock rules and the assertFileEditable guard" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
(Add any test file you had to adjust in Step 6 to the `git add`.)

---

### Task 2: Lock the routes that go through `getFileAndVerifyAccess`

**Files:**
- Modify: `apps/web/src/app/api/documents/route.ts`, `api/upload-url/route.ts`, `api/file-tasks/route.ts`, `api/file-tasks/[taskId]/route.ts`, `api/files/[fileType]/[id]/note/route.ts`, `api/files/[fileType]/[id]/parties/route.ts`, `api/files/[fileType]/[id]/parties/[partyId]/route.ts`
- Test: `apps/web/src/__tests__/api/file-lock-child-routes.test.ts`

**Interfaces:**
- Consumes: `assertFileEditable`, `isFileReadOnlyFor`, `FILE_LOCKED_MESSAGE`, and `file.status` from Task 1.

- [ ] **Step 1: Write the failing test** at `apps/web/src/__tests__/api/file-lock-child-routes.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/r2", () => ({
  getPresignedPutUrl: vi.fn(),
  buildR2Key: vi.fn(() => "k/__doc__/__name__"),
  deleteR2Object: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
    fileTask: { findUnique: vi.fn() },
    fileParty: { findUnique: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST as postDocument } from "../../app/api/documents/route";
import { GET as getUploadUrl } from "../../app/api/upload-url/route";
import { POST as postTask } from "../../app/api/file-tasks/route";
import { PATCH as patchTask, DELETE as deleteTask } from "../../app/api/file-tasks/[taskId]/route";
import { POST as postNote } from "../../app/api/files/[fileType]/[id]/note/route";
import { POST as postParty } from "../../app/api/files/[fileType]/[id]/parties/route";
import { PATCH as patchParty, DELETE as deleteParty } from "../../app/api/files/[fileType]/[id]/parties/[partyId]/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: null } };
const LOCK_MESSAGE = "This file is closed and can't be changed";

function json(body: unknown) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const noBody = () => new Request("http://localhost");

const CALLS: [string, () => Promise<Response>][] = [
  ["POST /api/documents", () => postDocument(json({ fileType: "TRANSACTION", fileId: "f1", name: "a.pdf", r2Key: "k", r2Url: "k" }))],
  ["GET /api/upload-url", () => getUploadUrl(new Request("http://localhost/api/upload-url?fileType=transaction&fileId=f1&filename=a.pdf&contentType=application/pdf&size=10"))],
  ["POST /api/file-tasks", () => postTask(json({ fileType: "transaction", fileId: "f1", title: "t" }))],
  ["PATCH /api/file-tasks/[taskId]", () => patchTask(json({ done: true }), { params: { taskId: "t1" } })],
  ["DELETE /api/file-tasks/[taskId]", () => deleteTask(noBody(), { params: { taskId: "t1" } })],
  ["POST note", () => postNote(json({ note: "hi" }), { params: { fileType: "transaction", id: "f1" } })],
  ["POST parties", () => postParty(json({ role: "BUYER", name: "n" }), { params: { fileType: "transaction", id: "f1" } })],
  ["PATCH party", () => patchParty(json({ name: "n" }), { params: { fileType: "transaction", id: "f1", partyId: "p1" } })],
  ["DELETE party", () => deleteParty(noBody(), { params: { fileType: "transaction", id: "f1", partyId: "p1" } })],
];

function mockTransaction(status: string) {
  vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.fileTask.findUnique).mockResolvedValue({ id: "t1", transactionFileId: "f1", listingFileId: null } as any);
  vi.mocked(prisma.fileParty.findUnique).mockResolvedValue({ id: "p1", transactionFileId: "f1", listingFileId: null } as any);
  vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
});

describe("closed files are read-only for agents", () => {
  it.each(CALLS)("%s returns the lock 403 when the file is closed", async (_name, call) => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    mockTransaction("CLOSED");
    const res = await call();
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(LOCK_MESSAGE);
  });

  it.each(["CLOSED", "ARCHIVED", "CANCELED_APPROVED"])("blocks a note on a transaction that is %s", async (status) => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    mockTransaction(status);
    const res = await postNote(json({ note: "hi" }), { params: { fileType: "transaction", id: "f1" } });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(LOCK_MESSAGE);
  });

  it.each(["CLOSED", "CANCELED"])("blocks a note on a listing that is %s", async (status) => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status } as any);
    const res = await postNote(json({ note: "hi" }), { params: { fileType: "listing", id: "f1" } });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(LOCK_MESSAGE);
  });

  it("still lets an agent add a note to an open file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    mockTransaction("PENDING");
    const res = await postNote(json({ note: "hi" }), { params: { fileType: "transaction", id: "f1" } });
    expect(res.status).toBe(200);
  });

  it("still lets an admin add a note to a closed file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    mockTransaction("CLOSED");
    const res = await postNote(json({ note: "hi" }), { params: { fileType: "transaction", id: "f1" } });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run file-lock-child-routes`
Expected: the nine "returns the lock 403" cases and the note-status cases FAIL (routes return 200/201/other, or throw on unmocked prisma calls); the two "still lets…" cases PASS.

- [ ] **Step 3: Add the guard to each route.**

In each of these routes, add `assertFileEditable` to the `@/lib/api-auth` import, then add the two lines right after the existing `if (!file) return …403/404` line:

```ts
const locked = assertFileEditable(<kind>, file.status, session.user.role);
if (locked) return locked;
```

`<kind>` per route:
- `documents/route.ts` (POST): `isListing ? "listing" : "transaction"`
- `upload-url/route.ts` (GET): `fileType`
- `file-tasks/route.ts` (POST only, not GET): `fileType`
- `files/[fileType]/[id]/note/route.ts` (POST): `isListing ? "listing" : "transaction"`
- `files/[fileType]/[id]/parties/route.ts` (POST): `isListing ? "listing" : "transaction"`

The two routes that use a helper function (`assertTaskAccess`, `verifyPartyAccess`) return `{ error, status }` objects instead of responses, so they use the pure check rather than `assertFileEditable`. In `file-tasks/[taskId]/route.ts` add these imports (`isFileReadOnlyFor` lives in `@/lib/file-lock`, not `@/lib/api-auth`):

```ts
import { isFileReadOnlyFor } from "@/lib/file-lock";
import { FILE_LOCKED_MESSAGE } from "@/lib/file-messages";
```

and in `assertTaskAccess`, after `if (!file) return { error: "Forbidden", status: 403 } as const;` add:

```ts
if (isFileReadOnlyFor(ref.fileType, file.status, role)) return { error: FILE_LOCKED_MESSAGE, status: 403 } as const;
```

Do the identical thing in `verifyPartyAccess` in `parties/[partyId]/route.ts` (same two imports, same line after its `if (!file)` line).

- [ ] **Step 4: Run the tests**

Run: `npx vitest run file-lock-child-routes` → PASS (all).
Run: `npx vitest run api` → PASS. Existing route tests mock `getFileAndVerifyAccess`'s prisma call with `{ id, agentId }` only, so `status` is undefined and nothing locks; if any test fails, read why before changing it.
Run: `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/documents/route.ts apps/web/src/app/api/upload-url/route.ts apps/web/src/app/api/file-tasks/route.ts "apps/web/src/app/api/file-tasks/[taskId]/route.ts" "apps/web/src/app/api/files/[fileType]/[id]/note/route.ts" "apps/web/src/app/api/files/[fileType]/[id]/parties/route.ts" "apps/web/src/app/api/files/[fileType]/[id]/parties/[partyId]/route.ts" apps/web/src/__tests__/api/file-lock-child-routes.test.ts
git commit -m "feat: agents can't change documents, tasks, notes or parties on a closed file" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Lock the routes that do their own file lookup

**Files:**
- Modify: `api/documents/[id]/route.ts` (DELETE), `api/transactions/[id]/conditions/route.ts` (POST), `api/transactions/[id]/submit-review/route.ts`, `api/listings/[id]/submit-review/route.ts`, `api/listings/[id]/convert/route.ts`
- Test: `apps/web/src/__tests__/api/file-lock-file-routes.test.ts`

**Interfaces:**
- Consumes: `assertFileEditable`, `resolveFileRef` from `@/lib/api-auth`.

- [ ] **Step 1: Write the failing test** at `apps/web/src/__tests__/api/file-lock-file-routes.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/r2", () => ({ deleteR2Object: vi.fn() }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendSubmitForReview: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
    fileDocument: { findUnique: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { DELETE as deleteDocument } from "../../app/api/documents/[id]/route";
import { POST as postCondition } from "../../app/api/transactions/[id]/conditions/route";
import { POST as submitTransaction } from "../../app/api/transactions/[id]/submit-review/route";
import { POST as submitListing } from "../../app/api/listings/[id]/submit-review/route";
import { POST as convertListing } from "../../app/api/listings/[id]/convert/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const LOCK_MESSAGE = "This file is closed and can't be changed";
const req = () => new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Inspection" }) });

const CLOSED_TX = { id: "f1", agentId: "a1", status: "CLOSED", checklistItems: [], agent: { user: { name: "Ann" } }, propertyAddress: "1 A St" };
const CLOSED_LISTING = { id: "f1", agentId: "a1", status: "CLOSED", listingType: "RESIDENTIAL_SALE", checklistItems: [], agent: { user: { name: "Ann" } }, propertyAddress: "1 A St" };

const CALLS: [string, () => Promise<Response>][] = [
  ["DELETE /api/documents/[id]", () => deleteDocument(new Request("http://localhost"), { params: { id: "d1" } })],
  ["POST transaction conditions", () => postCondition(req(), { params: { id: "f1" } })],
  ["POST transaction submit-review", () => submitTransaction(req(), { params: { id: "f1" } })],
  ["POST listing submit-review", () => submitListing(req(), { params: { id: "f1" } })],
  ["POST listing convert", () => convertListing(req(), { params: { id: "f1" } })],
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
  vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(CLOSED_TX as any);
  vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(CLOSED_LISTING as any);
  vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
    id: "d1", reviewStatus: "PENDING_REVIEW", uploadedByAgentId: "u1", transactionFileId: "f1", listingFileId: null, r2Key: "k",
  } as any);
});

describe("closed files are read-only for agents (routes with their own lookup)", () => {
  it.each(CALLS)("%s returns the lock 403 when the file is closed", async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(LOCK_MESSAGE);
  });

  it("deleting a document on a listing file checks the listing's status", async () => {
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "d1", reviewStatus: "PENDING_REVIEW", uploadedByAgentId: "u1", transactionFileId: null, listingFileId: "f1", r2Key: "k",
    } as any);
    const res = await deleteDocument(new Request("http://localhost"), { params: { id: "d1" } });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(LOCK_MESSAGE);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run file-lock-file-routes`
Expected: FAIL. The routes either proceed (200/other status) or throw on an unmocked prisma call.

- [ ] **Step 3: Edit the routes.**

`documents/[id]/route.ts`: add `import { resolveFileRef, assertFileEditable } from "@/lib/api-auth";`. After the existing `uploadedByAgentId` forbidden check, before `deleteR2Object`, insert:

```ts
  const ref = resolveFileRef(doc);
  if (ref) {
    const parent = ref.fileType === "listing"
      ? await prisma.listingFile.findUnique({ where: { id: ref.fileId }, select: { status: true } })
      : await prisma.transactionFile.findUnique({ where: { id: ref.fileId }, select: { status: true } });
    const locked = assertFileEditable(ref.fileType, parent?.status, session.user.role);
    if (locked) return locked;
  }
```

`transactions/[id]/conditions/route.ts` (POST only): change the import to `import { requireAuth, checkOwnership, assertFileEditable } from "@/lib/api-auth";` and replace the POST's ownership block with:

```ts
  const txFile = await prisma.transactionFile.findUnique({ where: { id: params.id } });
  const { exists, forbidden, record } = checkOwnership(txFile, session.user.agentId, session.user.role);
  if (!exists || !record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const locked = assertFileEditable("transaction", record.status, session.user.role);
  if (locked) return locked;
```

`transactions/[id]/submit-review/route.ts`: add `assertFileEditable` to the `@/lib/api-auth` import; after `if (forbidden) …403` add:

```ts
  const locked = assertFileEditable("transaction", tx.status, session.user.role);
  if (locked) return locked;
```

`listings/[id]/submit-review/route.ts`: same, with `"listing"` and `listing.status`, placed after the `forbidden` line and before the existing `PENDING_TRANSFER` check.

`listings/[id]/convert/route.ts`: add `assertFileEditable` to its `@/lib/api-auth` import; after `if (forbidden) …403` add the same two lines with `"listing"` and `listing.status`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run file-lock-file-routes` → PASS.
Run: `npx vitest run api` → PASS. If an existing `documents` DELETE test now fails because `prisma.transactionFile`/`listingFile` is missing from its mock, add `transactionFile: { findUnique: vi.fn() }` and `listingFile: { findUnique: vi.fn() }` to that mock (returning `{ status: "PENDING" }`).
Run: `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/api/documents/[id]/route.ts" "apps/web/src/app/api/transactions/[id]/conditions/route.ts" "apps/web/src/app/api/transactions/[id]/submit-review/route.ts" "apps/web/src/app/api/listings/[id]/submit-review/route.ts" "apps/web/src/app/api/listings/[id]/convert/route.ts" apps/web/src/__tests__/api/file-lock-file-routes.test.ts
git commit -m "feat: lock document delete, conditions, submit-for-review and convert on closed files" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
(Add any existing test file you adjusted in Step 4.)

---

### Task 4: `sendSafely`

**Files:**
- Create: `apps/web/src/lib/email/send-safely.ts`
- Test: `apps/web/src/__tests__/lib/send-safely.test.ts`

**Interfaces:**
- Produces: `sendSafely(send: () => Promise<unknown>): Promise<{ failed: boolean }>`. Never throws.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import * as Sentry from "@sentry/nextjs";
import { sendSafely } from "@/lib/email/send-safely";

describe("sendSafely", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns failed: false and logs nothing when the send succeeds", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await expect(sendSafely(send)).resolves.toEqual({ failed: false });
    expect(send).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("returns failed: true and logs to Sentry when the send throws", async () => {
    const error = new Error("Postmark 406: inactive recipient");
    await expect(sendSafely(() => Promise.reject(error))).resolves.toEqual({ failed: true });
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("never throws, even when the send throws synchronously", async () => {
    await expect(sendSafely(() => { throw new Error("boom"); })).resolves.toEqual({ failed: true });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run send-safely`
Expected: FAIL, cannot resolve `@/lib/email/send-safely`.

- [ ] **Step 3: Implement** `apps/web/src/lib/email/send-safely.ts`

Check how `api/agent-applications/[id]/approve/route.ts` imports Sentry and use the same import form.

```ts
import * as Sentry from "@sentry/nextjs";

// Runs an email send without letting a delivery problem break the action that
// triggered it. The database change has already happened by the time we send,
// so a failure is logged and reported back, never thrown.
export async function sendSafely(send: () => Promise<unknown>): Promise<{ failed: boolean }> {
  try {
    await send();
    return { failed: false };
  } catch (err) {
    Sentry.captureException(err);
    return { failed: true };
  }
}
```

- [ ] **Step 4: Run and verify**

Run: `npx vitest run send-safely` → PASS (3). Run: `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/email/send-safely.ts apps/web/src/__tests__/lib/send-safely.test.ts
git commit -m "feat: sendSafely, so an email failure never breaks the action" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `allowedNextStatuses`

**Files:**
- Modify: `apps/web/src/lib/transaction-helpers.ts`
- Test: `apps/web/src/__tests__/lib/transaction-helpers.test.ts` (append)

**Interfaces:**
- Produces: `allowedNextStatuses(kind: "listing" | "transaction", from: string, role: ActorRole): string[]`, which must agree exactly with `canTransitionListing` / `canTransitionTransaction`.

- [ ] **Step 1: Write the failing tests.** Add `allowedNextStatuses` to the existing import on line 2 of `transaction-helpers.test.ts`, and add `canTransitionListing` too if it is not already imported. Append:

```ts
describe("allowedNextStatuses", () => {
  const LISTING_STATUSES = ["INCOMPLETE", "PENDING_TRANSFER", "COMING_SOON", "ACTIVE", "ACTIVE_UNDER_CONTRACT", "EXPIRED", "WITHDRAWN", "CANCELED", "CLOSED"];
  const TX_STATUSES = ["INCOMPLETE", "PENDING_TRANSFER", "PRE_CONTRACT", "PENDING", "EXPIRED", "CLOSED", "ARCHIVED", "CANCELED_PENDING", "CANCELED_APPROVED", "REFERRAL_SUCCESSFUL", "REFERRAL_UNSUCCESSFUL", "REFERRAL_BROKER_REVIEW"];

  it.each(["ADMIN", "AGENT"] as const)("matches canTransitionTransaction exactly for every %s move", (role) => {
    for (const from of TX_STATUSES) {
      const allowed = allowedNextStatuses("transaction", from, role);
      for (const to of TX_STATUSES) {
        expect(allowed.includes(to), `${from} -> ${to} as ${role}`).toBe(canTransitionTransaction(from as any, to as any, role));
      }
    }
  });

  it.each(["ADMIN", "AGENT"] as const)("matches canTransitionListing exactly for every %s move", (role) => {
    for (const from of LISTING_STATUSES) {
      const allowed = allowedNextStatuses("listing", from, role);
      for (const to of LISTING_STATUSES) {
        expect(allowed.includes(to), `${from} -> ${to} as ${role}`).toBe(canTransitionListing(from as any, to as any, role));
      }
    }
  });

  it("offers an admin the move from PENDING to CLOSED", () => {
    expect(allowedNextStatuses("transaction", "PENDING", "ADMIN")).toContain("CLOSED");
  });

  it("does not offer an agent the move from PENDING to CLOSED", () => {
    expect(allowedNextStatuses("transaction", "PENDING", "AGENT")).not.toContain("CLOSED");
  });

  it("offers nothing for an unknown status and never repeats a status", () => {
    expect(allowedNextStatuses("transaction", "NOPE", "ADMIN")).toEqual([]);
    const list = allowedNextStatuses("transaction", "PENDING", "ADMIN");
    expect(new Set(list).size).toBe(list.length);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run transaction-helpers`
Expected: FAIL, `allowedNextStatuses is not a function`.

- [ ] **Step 3: Implement.** In `transaction-helpers.ts`, directly after `canTransitionTransaction`, add:

```ts
// The moves the server will accept from a status, read from the same tables
// as canTransition*, so a dropdown built from this can never offer a move the
// server rejects.
export function allowedNextStatuses(
  kind: "listing" | "transaction",
  from: string,
  role: ActorRole
): string[] {
  const agentTable = (kind === "listing" ? AGENT_LISTING_TRANSITIONS : AGENT_TX_TRANSITIONS) as Record<string, string[]>;
  const adminTable = (kind === "listing" ? ADMIN_LISTING_TRANSITIONS : ADMIN_TX_TRANSITIONS) as Record<string, string[]>;
  const tables = role === "ADMIN" ? [adminTable, agentTable] : [agentTable];
  const next = new Set<string>();
  for (const table of tables) for (const status of table[from] ?? []) next.add(status);
  return [...next];
}
```

- [ ] **Step 4: Run and verify**

Run: `npx vitest run transaction-helpers` → PASS. Run: `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/transaction-helpers.ts apps/web/src/__tests__/lib/transaction-helpers.test.ts
git commit -m "feat: allowedNextStatuses, read from the same tables the server checks" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `changeFileStatus`

**Files:**
- Create: `apps/web/src/lib/file-status.ts`
- Test: `apps/web/src/__tests__/lib/file-status.test.ts`

**Interfaces:**
- Consumes: `canTransitionListing`, `canTransitionTransaction`, `isReadyToClose`, `CHECKLIST_ITEMS_WITH_DOCS_INCLUDE` (transaction-helpers); `sendFileClosed`; `sendSafely` (Task 4).
- Produces:

```ts
export type ChangeFileStatusArgs = {
  kind: "listing" | "transaction";
  fileId: string;
  toStatus: string;
  actor: { userId: string; role: "ADMIN" | "AGENT" };
  extraData?: Record<string, unknown>;   // field updates written in the same update
};
export type ChangeFileStatusResult =
  | { ok: true; file: any; emailWarning?: true }
  | { ok: false; status: number; error: string };
export function changeFileStatus(args: ChangeFileStatusArgs): Promise<ChangeFileStatusResult>;
```

Rules: validation (not found, transition, ready-to-close) happens before any write; an ADMIN actor sets `awaitingReview: false` in the same update, an AGENT does not; the activity payload is `{ from, to }`; a move to CLOSED sends the Closed email via `sendSafely`; `emailWarning: true` is returned only when the actor is an ADMIN and the send failed.

- [ ] **Step 1: Write the failing test** at `apps/web/src/__tests__/lib/file-status.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendFileClosed: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn(), update: vi.fn() },
    transactionFile: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
    agent: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { sendFileClosed } from "@/lib/email/transaction-emails";
import { changeFileStatus } from "@/lib/file-status";

const READY = [{ isRequired: true, documents: [{ reviewStatus: "APPROVED" }] }];
const NOT_READY = [{ isRequired: true, documents: [{ reviewStatus: "PENDING_REVIEW" }] }];
const tx = (over: Record<string, unknown> = {}) => ({
  id: "f1", agentId: "a1", status: "PENDING", propertyAddress: "1 A St", city: "Irvine", state: "CA", zip: "92603",
  checklistItems: READY, ...over,
});
const ADMIN = { userId: "admin1", role: "ADMIN" as const };
const AGENT = { userId: "u1", role: "AGENT" as const };

// resetAllMocks (not clearAllMocks): a mockRejectedValue set in one test must not leak into the next.
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "f1", status: "CLOSED" } as any);
  vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "f1", status: "CLOSED" } as any);
  vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  vi.mocked(prisma.agent.findUnique).mockResolvedValue({ user: { email: "a@x.com", name: "Ann Lee" } } as any);
});

describe("changeFileStatus: validation happens before any write", () => {
  it("returns 404 when the file does not exist", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(null);
    const r = await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(r).toEqual({ ok: false, status: 404, error: "Not found" });
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });

  it("returns 400 for a move the tables do not allow", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx({ status: "ARCHIVED" }) as any);
    const r = await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "PENDING", actor: ADMIN });
    expect(r).toEqual({ ok: false, status: 400, error: "Cannot transition from ARCHIVED to PENDING" });
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
  });

  it("returns 400 when closing without every required document approved", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx({ checklistItems: NOT_READY }) as any);
    const r = await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(r).toEqual({ ok: false, status: 400, error: "Cannot close: not all required documents are approved" });
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });
});

describe("changeFileStatus: a successful change", () => {
  it("clears Awaiting Review when an admin changes the status", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx() as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { status: "CLOSED", awaitingReview: false },
    });
  });

  it("does not clear Awaiting Review when an agent changes the status", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx() as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CANCELED_PENDING", actor: AGENT });
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { status: "CANCELED_PENDING" },
    });
  });

  it("writes extra field updates in the same update as the status", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx({ status: "REFERRAL_SUCCESSFUL" }) as any);
    await changeFileStatus({
      kind: "transaction", fileId: "f1", toStatus: "REFERRAL_BROKER_REVIEW", actor: ADMIN,
      extraData: { referralAmountReceived: 5000, referralCncFee: 500 },
    });
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { referralAmountReceived: 5000, referralCncFee: 500, status: "REFERRAL_BROKER_REVIEW", awaitingReview: false },
    });
  });

  it("logs both the previous and the new status", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx() as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(prisma.fileActivity.create).toHaveBeenCalledWith({
      data: {
        fileType: "TRANSACTION", listingFileId: null, transactionFileId: "f1",
        actorId: "admin1", actorRole: "ADMIN", type: "STATUS_CHANGED",
        payload: { from: "PENDING", to: "CLOSED" },
      },
    });
  });

  it("uses the listing table and listing file for a listing", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status: "ACTIVE", propertyAddress: "1 A St", city: "Irvine", state: "CA", zip: "92603", checklistItems: READY } as any);
    const r = await changeFileStatus({ kind: "listing", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(r.ok).toBe(true);
    expect(prisma.listingFile.update).toHaveBeenCalled();
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
    expect(prisma.fileActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ fileType: "LISTING", listingFileId: "f1", transactionFileId: null }),
    }));
  });
});

describe("changeFileStatus: the Closed email", () => {
  it("sends the Closed email when a file is closed", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx() as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(sendFileClosed).toHaveBeenCalledWith(expect.objectContaining({
      agentEmail: "a@x.com", agentName: "Ann Lee", fileType: "transaction", fileId: "f1",
    }));
  });

  it("does not send it for any other status", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx() as any);
    await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "EXPIRED", actor: ADMIN });
    expect(sendFileClosed).not.toHaveBeenCalled();
  });

  it("still succeeds, with a warning for an admin, when the email fails", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(tx() as any);
    vi.mocked(sendFileClosed).mockRejectedValue(new Error("Postmark 406"));
    const r = await changeFileStatus({ kind: "transaction", fileId: "f1", toStatus: "CLOSED", actor: ADMIN });
    expect(r).toMatchObject({ ok: true, emailWarning: true });
  });

  it("sends no Closed email and returns no warning for a status change an agent makes", async () => {
    // An agent's moves never reach CLOSED, so no Closed email is ever attempted for them.
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status: "ACTIVE", checklistItems: READY } as any);
    const r = await changeFileStatus({ kind: "listing", fileId: "f1", toStatus: "WITHDRAWN", actor: AGENT });
    expect(r.ok).toBe(true);
    expect("emailWarning" in r).toBe(false);
    expect(sendFileClosed).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run file-status`
Expected: FAIL, cannot resolve `@/lib/file-status`.

- [ ] **Step 3: Implement** `apps/web/src/lib/file-status.ts`

```ts
import { prisma } from "@/lib/prisma";
import {
  canTransitionListing,
  canTransitionTransaction,
  isReadyToClose,
  CHECKLIST_ITEMS_WITH_DOCS_INCLUDE,
} from "@/lib/transaction-helpers";
import { sendFileClosed } from "@/lib/email/transaction-emails";
import { sendSafely } from "@/lib/email/send-safely";
import type { ListingStatus, TransactionFileStatus, FileChecklistItemWithDocs } from "@/types/transaction";

export type ChangeFileStatusArgs = {
  kind: "listing" | "transaction";
  fileId: string;
  toStatus: string;
  actor: { userId: string; role: "ADMIN" | "AGENT" };
  extraData?: Record<string, unknown>;
};

export type ChangeFileStatusResult =
  | { ok: true; file: any; emailWarning?: true }
  | { ok: false; status: number; error: string };

// The one place a file's status changes. Validation runs first, so a refused
// change writes nothing. Only an admin's change clears Awaiting Review: the
// broker may still be checking price and commission after the documents are done.
export async function changeFileStatus({
  kind,
  fileId,
  toStatus,
  actor,
  extraData = {},
}: ChangeFileStatusArgs): Promise<ChangeFileStatusResult> {
  const isListing = kind === "listing";

  const file: any = isListing
    ? await prisma.listingFile.findUnique({ where: { id: fileId }, include: { checklistItems: CHECKLIST_ITEMS_WITH_DOCS_INCLUDE } })
    : await prisma.transactionFile.findUnique({ where: { id: fileId }, include: { checklistItems: CHECKLIST_ITEMS_WITH_DOCS_INCLUDE } });
  if (!file) return { ok: false, status: 404, error: "Not found" };

  const allowed = isListing
    ? canTransitionListing(file.status as ListingStatus, toStatus as ListingStatus, actor.role)
    : canTransitionTransaction(file.status as TransactionFileStatus, toStatus as TransactionFileStatus, actor.role);
  if (!allowed) {
    return { ok: false, status: 400, error: `Cannot transition from ${file.status} to ${toStatus}` };
  }
  if (toStatus === "CLOSED" && !isReadyToClose((file.checklistItems ?? []) as FileChecklistItemWithDocs[])) {
    return { ok: false, status: 400, error: "Cannot close: not all required documents are approved" };
  }

  const data = {
    ...extraData,
    status: toStatus,
    ...(actor.role === "ADMIN" && { awaitingReview: false }),
  };
  const updated = isListing
    ? await prisma.listingFile.update({ where: { id: fileId }, data: data as any })
    : await prisma.transactionFile.update({ where: { id: fileId }, data: data as any });

  await prisma.fileActivity.create({
    data: {
      fileType: isListing ? "LISTING" : "TRANSACTION",
      listingFileId: isListing ? fileId : null,
      transactionFileId: isListing ? null : fileId,
      actorId: actor.userId,
      actorRole: actor.role,
      type: "STATUS_CHANGED",
      payload: { from: file.status, to: toStatus },
    },
  });

  let emailFailed = false;
  if (toStatus === "CLOSED") {
    const agentRecord = await prisma.agent.findUnique({ where: { id: file.agentId }, include: { user: true } });
    if (agentRecord?.user) {
      const { failed } = await sendSafely(() =>
        sendFileClosed({
          agentEmail: agentRecord.user.email,
          agentName: agentRecord.user.name ?? "Agent",
          address: file.propertyAddress,
          city: file.city,
          state: file.state,
          zip: file.zip,
          fileType: kind,
          fileId,
        })
      );
      emailFailed = failed;
    }
  }

  return { ok: true, file: updated, ...(emailFailed && actor.role === "ADMIN" && { emailWarning: true as const }) };
}
```

- [ ] **Step 4: Run and verify**

Run: `npx vitest run file-status` → PASS. Run: `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/file-status.ts apps/web/src/__tests__/lib/file-status.test.ts
git commit -m "feat: changeFileStatus, the single implementation of a status change" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: The admin status route uses `changeFileStatus`

**Files:**
- Modify: `apps/web/src/app/api/admin/files/[fileType]/[id]/status/route.ts`
- Test: `apps/web/src/__tests__/api/admin-files-status.test.ts` (new; no test exists for this route today)

**Interfaces:**
- Consumes: `changeFileStatus`. Produces: JSON `{ ok: true }` plus `emailWarning: true` when the Closed email failed; error responses `{ error }` with the function's status code.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/file-status", () => ({ changeFileStatus: vi.fn() }));

import { getServerSession } from "next-auth";
import { changeFileStatus } from "@/lib/file-status";
import { PATCH } from "../../app/api/admin/files/[fileType]/[id]/status/route";

const ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: null } };
const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const call = (fileType: string, body: unknown) =>
  PATCH(new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), {
    params: { fileType, id: "f1" },
  });

describe("PATCH /api/admin/files/[fileType]/[id]/status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for a non-admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    expect((await call("transaction", { status: "CLOSED" })).status).toBe(403);
    expect(changeFileStatus).not.toHaveBeenCalled();
  });

  it("returns 400 when status is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    expect((await call("transaction", {})).status).toBe(400);
  });

  it("passes the file, status and admin actor to changeFileStatus", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(changeFileStatus).mockResolvedValue({ ok: true, file: {} });
    const res = await call("listing", { status: "CLOSED" });
    expect(changeFileStatus).toHaveBeenCalledWith({
      kind: "listing", fileId: "f1", toStatus: "CLOSED", actor: { userId: "admin1", role: "ADMIN" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("treats any file type other than listing as a transaction (existing behavior)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(changeFileStatus).mockResolvedValue({ ok: true, file: {} });
    await call("transaction", { status: "PENDING" });
    expect(changeFileStatus).toHaveBeenCalledWith(expect.objectContaining({ kind: "transaction" }));
  });

  it("returns the function's error and status code", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(changeFileStatus).mockResolvedValue({ ok: false, status: 400, error: "Cannot close: not all required documents are approved" });
    const res = await call("transaction", { status: "CLOSED" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Cannot close: not all required documents are approved" });
  });

  it("passes the email warning through to the admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(changeFileStatus).mockResolvedValue({ ok: true, file: {}, emailWarning: true });
    expect(await (await call("transaction", { status: "CLOSED" })).json()).toEqual({ ok: true, emailWarning: true });
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run admin-files-status`
Expected: FAIL. The current route talks to prisma directly, so `changeFileStatus` is never called and the mocked prisma object has no models.

- [ ] **Step 3: Replace the route body** in `status/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { changeFileStatus } from "@/lib/file-status";

export async function PATCH(req: Request, { params }: { params: { fileType: string; id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status } = await req.json();
  if (!status) return NextResponse.json({ error: "status is required" }, { status: 400 });

  const result = await changeFileStatus({
    kind: params.fileType === "listing" ? "listing" : "transaction",
    fileId: params.id,
    toStatus: status,
    actor: { userId: session.user.id, role: "ADMIN" },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ ok: true, ...(result.emailWarning && { emailWarning: true }) });
}
```

- [ ] **Step 4: Run and verify**

Run: `npx vitest run admin-files-status` → PASS. Run: `npx vitest run api` → PASS. Run: `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/api/admin/files/[fileType]/[id]/status/route.ts" apps/web/src/__tests__/api/admin-files-status.test.ts
git commit -m "refactor: the admin status route uses changeFileStatus, now logging from and sending the Closed email" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: The two `PATCH` routes use `changeFileStatus` and the lock

**Files:**
- Modify: `apps/web/src/app/api/transactions/[id]/route.ts`, `apps/web/src/app/api/listings/[id]/route.ts` (PATCH only)
- Modify tests: `apps/web/src/__tests__/api/transactions-id.test.ts`
- Create tests: `apps/web/src/__tests__/api/listings-id-patch.test.ts`

**Interfaces:**
- Consumes: `changeFileStatus` (with `extraData`), `assertFileEditable`. Produces: the same `{ transaction }` / `{ listing }` JSON as today, plus `emailWarning: true` for an admin when the Closed email failed.

Behavior: lock first (403 for an agent on a finished file); field data is built exactly as today but without `status`; when the status changes, the fields go through `changeFileStatus` as `extraData` (one update, validation first); when it does not change, a plain update. The `sendFileClosed` import and the inline activity/email code are removed from both routes.

- [ ] **Step 1: Update the existing referral test fixtures.** In `transactions-id.test.ts`, the shared function now reads the file's checklist. Change `REFERRAL_TX` to include `checklistItems: []`:

```ts
const REFERRAL_TX = { id: "tf1", agentId: "a1", transactionSide: "REFERRAL", status: "REFERRAL_SUCCESSFUL", propertyAddress: null, checklistItems: [] };
```

The Closed-email assertions in that file mock `sendFileClosed` and `prisma.agent.findUnique`, which still work. One intended difference: the status-change activity entry now also carries `listingFileId: null`, so if a test asserts `fileActivity.create` with an exact `data` object, add `listingFileId: null` to its expected value. Add `vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));` near the other mocks. Run `npx vitest run transactions-id` and read any failure before editing it: a referral test that expects `prisma.transactionFile.update` to be called with `status` and `referralCncFee` in the same `data` object must still pass, because `extraData` is merged into that single update.

- [ ] **Step 2: Write the new failing tests.** Append to `transactions-id.test.ts` (uses the file's existing mocks and `ADMIN_SESSION`):

```ts
const AGENT_SESSION = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const okReq = (body: unknown) =>
  new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const READY_ITEMS = [{ isRequired: true, documents: [{ reviewStatus: "APPROVED" }] }];
const NOT_READY_ITEMS = [{ isRequired: true, documents: [{ reviewStatus: "PENDING_REVIEW" }] }];

describe("PATCH /api/transactions/[id] — closed-file lock", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["CLOSED", "ARCHIVED", "CANCELED_APPROVED"])("returns 403 for an agent editing a transaction that is %s", async (status) => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status } as any);
    const res = await PATCH(okReq({ salePrice: "999" }), { params: { id: "tf1" } });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("This file is closed and can't be changed");
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });

  it("lets an admin edit a closed transaction", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status: "CLOSED" } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "tf1" } as any);
    const res = await PATCH(okReq({ commissionNotes: "fixed" }), { params: { id: "tf1" } });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/transactions/[id] — shared status rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  });

  it("refuses to close without every required document approved, and writes nothing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status: "PENDING", checklistItems: NOT_READY_ITEMS } as any);
    const res = await PATCH(okReq({ status: "CLOSED", salePrice: "900000" }), { params: { id: "tf1" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Cannot close: not all required documents are approved");
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });

  it("clears Awaiting Review when an admin changes the status through PATCH", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status: "PENDING", checklistItems: READY_ITEMS } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "tf1", status: "EXPIRED" } as any);
    await PATCH(okReq({ status: "EXPIRED" }), { params: { id: "tf1" } });
    expect(prisma.transactionFile.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "EXPIRED", awaitingReview: false }),
    }));
  });

  it("does a plain field update when the status is unchanged", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status: "PENDING", checklistItems: READY_ITEMS } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "tf1" } as any);
    await PATCH(okReq({ commissionNotes: "note" }), { params: { id: "tf1" } });
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({ where: { id: "tf1" }, data: { commissionNotes: "note" } });
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
  });
});
```

Create `listings-id-patch.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/r2", () => ({ deleteR2Object: vi.fn() }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendFileClosed: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
    agent: { findUnique: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PATCH } from "../../app/api/listings/[id]/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: null } };
const patch = (body: unknown) =>
  PATCH(new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), { params: { id: "lf1" } });
const READY = [{ isRequired: true, documents: [{ reviewStatus: "APPROVED" }] }];
const NOT_READY = [{ isRequired: true, documents: [{ reviewStatus: "PENDING_REVIEW" }] }];

describe("PATCH /api/listings/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ user: { email: "a@x.com", name: "Ann" } } as any);
  });

  it.each(["CLOSED", "CANCELED"])("returns 403 for an agent editing a listing that is %s", async (status) => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status } as any);
    const res = await patch({ listPrice: "1" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("This file is closed and can't be changed");
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it("lets an admin edit a closed listing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status: "CLOSED" } as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1" } as any);
    expect((await patch({ commissionNotes: "x" })).status).toBe(200);
  });

  it("refuses to close without every required document approved", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status: "ACTIVE", checklistItems: NOT_READY } as any);
    const res = await patch({ status: "CLOSED" });
    expect(res.status).toBe(400);
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it("changes status through the shared function, clearing Awaiting Review for an admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status: "ACTIVE", checklistItems: READY } as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1", status: "EXPIRED" } as any);
    const res = await patch({ status: "EXPIRED", listPrice: "500000" });
    expect(res.status).toBe(200);
    expect(prisma.listingFile.update).toHaveBeenCalledWith({
      where: { id: "lf1" },
      data: { listPrice: 500000, status: "EXPIRED", awaitingReview: false },
    });
  });
});
```

- [ ] **Step 3: Run and watch them fail**

Run: `npx vitest run transactions-id listings-id-patch`
Expected: the new lock tests FAIL (agents are not blocked yet); the close-without-approval tests FAIL (the routes do not check readiness); the field-only test may already pass.

- [ ] **Step 4: Rewrite `PATCH` in `api/transactions/[id]/route.ts`.** Remove the `sendFileClosed` import and `canTransitionTransaction` from the helpers import (keep `calcReferralFee`, `FILE_DETAIL_INCLUDE`). Add:

```ts
import { checkOwnership, assertFileEditable } from "@/lib/api-auth";
import { changeFileStatus } from "@/lib/file-status";
```

Replace the whole `PATCH` function with:

```ts
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tx = await prisma.transactionFile.findUnique({ where: { id: params.id } });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.role === "ADMIN";
  const { forbidden } = checkOwnership(tx, session.user.agentId, session.user.role);
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const locked = assertFileEditable("transaction", tx.status, session.user.role);
  if (locked) return locked;

  const body = await req.json();
  const role = isAdmin ? "ADMIN" : "AGENT";

  const referralFeeUpdate =
    body.status === "REFERRAL_BROKER_REVIEW" && body.referralAmountReceived !== undefined
      ? calcReferralFee(parseFloat(body.referralAmountReceived))
      : null;

  const fieldData = {
    ...(body.propertyAddress !== undefined && { propertyAddress: body.propertyAddress }),
    ...(body.salePrice !== undefined && { salePrice: body.salePrice ? parseFloat(body.salePrice) : null }),
    ...(body.closeOfEscrow !== undefined && { closeOfEscrow: body.closeOfEscrow ? new Date(body.closeOfEscrow) : null }),
    ...(body.inspectionDeadline !== undefined && { inspectionDeadline: body.inspectionDeadline ? new Date(body.inspectionDeadline) : null }),
    ...(body.appraisalDeadline !== undefined && { appraisalDeadline: body.appraisalDeadline ? new Date(body.appraisalDeadline) : null }),
    ...(body.loanApprovalDeadline !== undefined && { loanApprovalDeadline: body.loanApprovalDeadline ? new Date(body.loanApprovalDeadline) : null }),
    ...(body.commissionGCI !== undefined && { commissionGCI: body.commissionGCI ? parseFloat(body.commissionGCI) : null }),
    ...(body.commissionSplit !== undefined && { commissionSplit: body.commissionSplit ? parseFloat(body.commissionSplit) : null }),
    ...(body.commissionNotes !== undefined && { commissionNotes: body.commissionNotes }),
    ...(body.referralAmountReceived !== undefined && { referralAmountReceived: parseFloat(body.referralAmountReceived) }),
    ...(referralFeeUpdate && { referralCncFee: referralFeeUpdate.cncFee }),
  };

  if (body.status && body.status !== tx.status) {
    const result = await changeFileStatus({
      kind: "transaction",
      fileId: params.id,
      toStatus: body.status,
      actor: { userId: session.user.id, role },
      extraData: fieldData,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ transaction: result.file, ...(result.emailWarning && { emailWarning: true }) });
  }

  const updated = await prisma.transactionFile.update({ where: { id: params.id }, data: fieldData });
  return NextResponse.json({ transaction: updated });
}
```

- [ ] **Step 5: Rewrite `PATCH` in `api/listings/[id]/route.ts`** the same way. Remove the `sendFileClosed` import and `canTransitionListing` from the helpers import (keep `FILE_DETAIL_INCLUDE`); add the same two imports (`assertFileEditable`, `changeFileStatus`). Leave `GET` and `DELETE` untouched. `PATCH` becomes:

```ts
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listingFile.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.role === "ADMIN";
  const { forbidden } = checkOwnership(listing, session.user.agentId, session.user.role);
  if (forbidden) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const locked = assertFileEditable("listing", listing.status, session.user.role);
  if (locked) return locked;

  const body = await req.json();
  const role = isAdmin ? "ADMIN" : "AGENT";

  const fieldData = {
    ...(body.propertyAddress !== undefined && { propertyAddress: body.propertyAddress }),
    ...(body.city !== undefined && { city: body.city }),
    ...(body.zip !== undefined && { zip: body.zip }),
    ...(body.listPrice !== undefined && { listPrice: parseFloat(body.listPrice) }),
    ...(body.mlsNumber !== undefined && { mlsNumber: body.mlsNumber }),
    ...(body.expirationDate !== undefined && { expirationDate: body.expirationDate ? new Date(body.expirationDate) : null }),
    ...(body.listDate !== undefined && { listDate: body.listDate ? new Date(body.listDate) : null }),
    ...(body.commissionPercent !== undefined && { commissionPercent: body.commissionPercent ? parseFloat(body.commissionPercent) : null }),
    ...(body.commissionNotes !== undefined && { commissionNotes: body.commissionNotes }),
  };

  if (body.status && body.status !== listing.status) {
    const result = await changeFileStatus({
      kind: "listing",
      fileId: params.id,
      toStatus: body.status,
      actor: { userId: session.user.id, role },
      extraData: fieldData,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ listing: result.file, ...(result.emailWarning && { emailWarning: true }) });
  }

  const updated = await prisma.listingFile.update({ where: { id: params.id }, data: fieldData });
  return NextResponse.json({ listing: updated });
}
```

- [ ] **Step 6: Run and verify**

Run: `npx vitest run transactions-id listings-id-patch` → PASS.
Run: `npx vitest run` (full suite) → PASS. The referral lifecycle tests must be green; if `transactions-id.test.ts` fails, read the failure and fix the fixture rather than the route.
Run: `npx tsc --noEmit` → 0.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/api/transactions/[id]/route.ts" "apps/web/src/app/api/listings/[id]/route.ts" apps/web/src/__tests__/api/transactions-id.test.ts apps/web/src/__tests__/api/listings-id-patch.test.ts
git commit -m "refactor: PATCH routes use changeFileStatus and respect the closed-file lock" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: `sendSafely` at the remaining email call sites

**Files:**
- Modify: `api/transactions/[id]/submit-review/route.ts`, `api/listings/[id]/submit-review/route.ts`, `api/admin/documents/[id]/reject/route.ts`, `api/admin/documents/[id]/approve/route.ts`
- Tests: `apps/web/src/__tests__/api/email-failures.test.ts` (new: both submit routes and reject); the approve route's test is added to the existing `admin-documents-approve.test.ts`; other existing approve/reject/submit tests may need a `@sentry/nextjs` mock

**Interfaces:**
- Submit-for-review (agent action): a failed email is logged only; response stays `{ ok: true }`.
- Reject and approve (admin actions): a failed email returns `{ ok: true, emailWarning: true }`.

- [ ] **Step 1: Write the failing test** `email-failures.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/r2", () => ({ deleteR2Object: vi.fn() }));
vi.mock("@/lib/email/transaction-emails", () => ({
  sendSubmitForReview: vi.fn(),
  sendDocumentRejected: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    transactionFile: { findUnique: vi.fn(), update: vi.fn() },
    listingFile: { findUnique: vi.fn(), update: vi.fn() },
    fileDocument: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));

import * as Sentry from "@sentry/nextjs";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { sendSubmitForReview, sendDocumentRejected } from "@/lib/email/transaction-emails";
import { POST as submitTransaction } from "../../app/api/transactions/[id]/submit-review/route";
import { POST as submitListing } from "../../app/api/listings/[id]/submit-review/route";
import { POST as rejectDocument } from "../../app/api/admin/documents/[id]/reject/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: null } };
const post = (body: unknown = {}) =>
  new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const AGENT_USER = { agent: { user: { email: "a@x.com", name: "Ann" } } };

// resetAllMocks (not clearAllMocks): a rejected send set in one test must not leak into the next.
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
});

describe("submit for review: an email failure is logged, never shown to the agent", () => {
  it("transaction", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status: "PENDING", checklistItems: [], propertyAddress: "1 A St", ...AGENT_USER } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({} as any);
    vi.mocked(sendSubmitForReview).mockRejectedValue(new Error("Postmark 406"));
    const res = await submitTransaction(post(), { params: { id: "f1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("listing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status: "ACTIVE", checklistItems: [], propertyAddress: "1 A St", ...AGENT_USER } as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({} as any);
    vi.mocked(sendSubmitForReview).mockRejectedValue(new Error("Postmark 406"));
    const res = await submitListing(post(), { params: { id: "f1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("admin document review: an email failure warns the admin", () => {
  it("reject returns emailWarning and still records the rejection", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({ id: "d1", name: "TDS.pdf", fileType: "TRANSACTION", transactionFileId: "f1", listingFileId: null } as any);
    vi.mocked(prisma.fileDocument.update).mockResolvedValue({} as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ propertyAddress: "1 A St", ...AGENT_USER } as any);
    vi.mocked(sendDocumentRejected).mockRejectedValue(new Error("Postmark 406"));
    const res = await rejectDocument(post({ note: "Blurry scan" }), { params: { id: "d1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, emailWarning: true });
    expect(prisma.fileDocument.update).toHaveBeenCalled();
  });

  it("reject returns plain ok when the email is sent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({ id: "d1", name: "TDS.pdf", fileType: "TRANSACTION", transactionFileId: "f1", listingFileId: null } as any);
    vi.mocked(prisma.fileDocument.update).mockResolvedValue({} as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ propertyAddress: "1 A St", ...AGENT_USER } as any);
    vi.mocked(sendDocumentRejected).mockResolvedValue(undefined);
    const res = await rejectDocument(post({ note: "Blurry scan" }), { params: { id: "d1" } });
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

The approve route's test goes in the existing `apps/web/src/__tests__/api/admin-documents-approve.test.ts`, because it needs that file's mocks (`$transaction`, `checklistTemplate`, and so on). Add `vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));` beside its other `vi.mock` calls, add `import { sendAllDocsApproved } from "@/lib/email/transaction-emails";` beside its imports, and append:

```ts
describe("POST /api/admin/documents/[id]/approve — email failure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("still approves and warns the admin when the all-approved email fails", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "doc-9", fileType: "TRANSACTION", listingFileId: null, transactionFileId: "tx-9", checklistItemId: "c-9", name: "signed.pdf",
    } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({
      id: "tx-9", status: "PENDING", propertyAddress: "1 A St", city: "Irvine", state: "CA", zip: "92603",
      agent: { user: { email: "a@x.com", name: "Ann" } },
    } as any);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]); // no required items left, so the file is ready to close
    vi.mocked(sendAllDocsApproved).mockRejectedValueOnce(new Error("Postmark 406"));

    const res = await POST(new Request("http://localhost/api/admin/documents/doc-9/approve", { method: "POST" }), { params: { id: "doc-9" } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, emailWarning: true });
    expect(prisma.fileDocument.update).toHaveBeenCalled();
  });
});
```

`mockRejectedValueOnce` is deliberate: the file's top-level mock is `vi.fn().mockResolvedValue(undefined)` and `clearAllMocks` does not restore implementations, so a permanent rejection would leak into other tests.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run email-failures admin-documents-approve`
Expected: FAIL. The four routes await the send directly, so a rejected send throws and the route returns 500 or the JSON lacks `emailWarning`.

- [ ] **Step 3: Edit the four routes.** In each, add `import { sendSafely } from "@/lib/email/send-safely";`.

`transactions/[id]/submit-review/route.ts` and `listings/[id]/submit-review/route.ts`: wrap the existing send:

```ts
await sendSafely(() => sendSubmitForReview({ fileType: "Transaction", address: tx.propertyAddress, agentName: tx.agent.user.name ?? "Agent", fileId: params.id }));
```
(use the route's own existing arguments; only the wrapper is new). The response stays `{ ok: true }`.

`admin/documents/[id]/reject/route.ts`: replace the `if (fileRecord?.agent?.user) { await sendDocumentRejected(...) }` block and the return with:

```ts
  let emailFailed = false;
  if (fileRecord?.agent?.user) {
    const { failed } = await sendSafely(() =>
      sendDocumentRejected({
        agentEmail: fileRecord.agent.user.email,
        agentName: fileRecord.agent.user.name ?? "Agent",
        documentName: doc.name,
        address: fileRecord.propertyAddress,
        rejectionNote: note,
        fileType: isListing ? "listing" : "transaction",
        fileId,
      })
    );
    emailFailed = failed;
  }

  return NextResponse.json({ ok: true, ...(emailFailed && { emailWarning: true }) });
```

`admin/documents/[id]/approve/route.ts`: same pattern around `sendAllDocsApproved` (the block at `if (isReadyToClose(checklistItems)) { … if (fileRecord?.agent?.user) { await sendAllDocsApproved({...}) } }`): declare `let emailFailed = false;` before that `if`, set `emailFailed = (await sendSafely(() => sendAllDocsApproved({...same args...}))).failed`, and end with `return NextResponse.json({ ok: true, ...(emailFailed && { emailWarning: true }) });`.

- [ ] **Step 4: Run and verify**

Run: `npx vitest run email-failures admin-documents-approve admin-documents-reject submit-review` → PASS. If any existing test for these routes now fails to import `@sentry/nextjs` behavior, add `vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));` to that test file.
Run: `npx vitest run` → PASS. Run: `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/api/transactions/[id]/submit-review/route.ts" "apps/web/src/app/api/listings/[id]/submit-review/route.ts" "apps/web/src/app/api/admin/documents/[id]/reject/route.ts" "apps/web/src/app/api/admin/documents/[id]/approve/route.ts" apps/web/src/__tests__/api/email-failures.test.ts apps/web/src/__tests__/api/admin-documents-approve.test.ts
git commit -m "fix: an email failure no longer breaks submit, approve or reject" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
(Add any other existing test file you had to touch.)

---

### Task 10: Admin screens: filtered dropdown, error and email warning

**Files:**
- Modify: `apps/web/src/app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx`
- Modify: `apps/web/src/components/transactions/DocumentReviewCard.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx` (the `ReferralActions` function only, ~line 742 onward; read with offset/limit)

**Interfaces:**
- Consumes: `allowedNextStatuses` (Task 5), `EMAIL_WARNING_TEXT` (Task 1). Server responses: `{ error }` on failure, `{ …, emailWarning: true }` on an email failure.

There is no component-render test setup in this project, so these are verified with `tsc`, the full suite, and Ryan's live check.

- [ ] **Step 1: Admin file page.** In `admin/transactions/[fileType]/[id]/page.tsx`:

Replace the imports line `import type { FileDocumentRecord, ListingStatus, TransactionFileStatus } from "@/types/transaction";` with:

```tsx
import type { FileDocumentRecord } from "@/types/transaction";
import { allowedNextStatuses } from "@/lib/transaction-helpers";
import { EMAIL_WARNING_TEXT } from "@/lib/file-messages";
```

Delete the two constants `LISTING_STATUSES` and `TRANSACTION_STATUSES`.

Add state next to `statusLoading`:

```tsx
  const [actionError, setActionError] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState(false);
```

Replace `changeStatus` with:

```tsx
  async function changeStatus(newStatus: string) {
    setStatusLoading(true);
    setActionError(null);
    setEmailWarning(false);
    try {
      const res = await fetch(`/api/admin/files/${fileType}/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setActionError(body?.error ?? "Couldn't change the status. Please try again.");
        return;
      }
      if (body?.emailWarning) setEmailWarning(true);
      await load();
    } finally {
      setStatusLoading(false);
    }
  }
```

Replace the line `const statuses = fileType === "listing" ? LISTING_STATUSES : TRANSACTION_STATUSES;` with:

```tsx
  const kind = fileType === "listing" ? "listing" : "transaction";
  const isReferralFile = file.transactionSide === "REFERRAL";
  // Only offer moves the server will accept. The tables also hold the referral
  // steps, which make no sense on an ordinary file, so hide those unless this
  // really is a referral.
  const statuses = [
    file.status as string,
    ...allowedNextStatuses(kind, file.status, "ADMIN").filter((s) => isReferralFile || !s.startsWith("REFERRAL_")),
  ];
```

Directly under the closing `</div>` of the header flex row (after the `<div className="flex items-center gap-2">…</div>` block, still inside the `mb-6` wrapper), add:

```tsx
        {actionError && <p className="mt-2 text-xs text-red-600">{actionError}</p>}
        {emailWarning && <p className="mt-2 text-xs text-amber-700">{EMAIL_WARNING_TEXT}</p>}
```

- [ ] **Step 2: `DocumentReviewCard.tsx`.** Add `import { EMAIL_WARNING_TEXT } from "@/lib/file-messages";` and state:

```tsx
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState(false);
```

Replace `approve` and `reject` with:

```tsx
  async function approve() {
    setLoading(true);
    setError(null);
    setWarning(false);
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/approve`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Couldn't approve this document. Please try again.");
        return;
      }
      if (body?.emailWarning) setWarning(true);
      onReviewed();
    } finally {
      setLoading(false);
    }
  }

  async function reject() {
    if (!rejectNote.trim()) return;
    setLoading(true);
    setError(null);
    setWarning(false);
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: rejectNote }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Couldn't reject this document. Please try again.");
        return;
      }
      if (body?.emailWarning) setWarning(true);
      setShowRejectForm(false);
      onReviewed();
    } finally {
      setLoading(false);
    }
  }
```

Directly after the `<div className="mt-3 flex flex-wrap gap-2">…</div>` buttons block, add:

```tsx
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {warning && <p className="mt-2 text-xs text-amber-700">{EMAIL_WARNING_TEXT}</p>}
```

- [ ] **Step 3: `ReferralActions` warning** (agent file page, `ReferralActions` only). Add `import { EMAIL_WARNING_TEXT } from "@/lib/file-messages";` to that file's imports, add `const [warning, setWarning] = useState(false);` next to the other state, and in `patch()` change the success path from `onDone();` to:

```tsx
      const okBody = await res.json().catch(() => null);
      if (okBody?.emailWarning) setWarning(true);
      onDone();
```

Then find where `ReferralActions` renders its `error` (`grep -n "{error &&" ` inside that function) and render the warning next to it, only for an admin (the server only sends it to admins, so no extra check is needed):

```tsx
      {warning && <p className="mt-2 text-xs text-amber-700">{EMAIL_WARNING_TEXT}</p>}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → 0. Run: `npx vitest run` → PASS.
Check by grep that `LISTING_STATUSES` and `TRANSACTION_STATUSES` no longer appear anywhere: `grep -rn "LISTING_STATUSES\|TRANSACTION_STATUSES" apps/web/src` (the arrays in `transaction-helpers.test.ts` from Task 5 use different local names; only report unexpected hits).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx" apps/web/src/components/transactions/DocumentReviewCard.tsx "apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx"
git commit -m "feat: admin status dropdown offers only allowed moves; errors and email warnings show on screen" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Agent screens: action errors and the rejection reason

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx` (`submitForReview`, `convertToTransaction`, and a message under the header; use grep + offset/limit)
- Modify: `apps/web/src/components/transactions/ChecklistPanel.tsx`
- Modify: `apps/web/src/types/transaction.ts` (line ~52, `FileChecklistItemWithDocs.documents`)

- [ ] **Step 1: Widen the type.** In `types/transaction.ts`, change the `documents` line of `FileChecklistItemWithDocs` to:

```ts
  documents: { reviewStatus: DocumentReviewStatus; uploadedAt?: string | Date; rejectionNote?: string | null }[];
```

- [ ] **Step 2: Show the rejection reason.** In `ChecklistPanel.tsx`, replace the block

```tsx
              {status === "REJECTED" && (
                <p className="text-xs text-red-500">Rejected — please re-upload</p>
              )}
```

with:

```tsx
              {status === "REJECTED" && (
                <>
                  <p className="text-xs text-red-500">Rejected — please re-upload</p>
                  {topDoc?.rejectionNote && <p className="text-xs text-red-500">Reason: {topDoc.rejectionNote}</p>}
                </>
              )}
```

- [ ] **Step 3: Agent file page errors.** Add state near `const [submitting, setSubmitting] = useState(false);` (line ~50):

```tsx
  const [actionError, setActionError] = useState<string | null>(null);
```

Replace `submitForReview` and `convertToTransaction` (lines ~78-94) with:

```tsx
  async function submitForReview() {
    const endpoint = fileType === "listing"
      ? `/api/listings/${id}/submit-review`
      : `/api/transactions/${id}/submit-review`;
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setActionError(body?.error ?? "Couldn't submit this file. Please try again.");
        return;
      }
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function convertToTransaction() {
    setActionError(null);
    const res = await fetch(`/api/listings/${id}/convert`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setActionError(body?.error ?? "Couldn't convert this listing. Please try again.");
      return;
    }
    router.push("/dashboard/transactions");
  }
```

Under the header row (immediately after the closing `</div>` of `<div className="flex items-start justify-between gap-4">`, still inside `<div className="mb-6">`), add:

```tsx
        {actionError && <p className="mt-2 text-xs text-red-600">{actionError}</p>}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → 0 (the type widening must not break `getChecklistProgress`/`isItemSatisfied`/`isReadyToClose`, which only read `reviewStatus`). Run: `npx vitest run` → PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx" apps/web/src/components/transactions/ChecklistPanel.tsx apps/web/src/types/transaction.ts
git commit -m "feat: agents see why an action failed and why a document was rejected" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: Read-only mode on the agent screens

**Files:**
- Modify: `apps/web/src/components/transactions/ChecklistPanel.tsx`, `PartiesTable.tsx`, `ActivityFeed.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx` (`TasksTab`, `TaskRow`, and the render section; grep + offset/limit)

**Interfaces:**
- Consumes: `isFileReadOnlyFor` from `@/lib/file-lock`. Each component gains an optional `readOnly?: boolean` prop (default false).

The server is the real lock (Tasks 1-3, 8). This task hides or disables what the server would refuse.

- [ ] **Step 1: `ChecklistPanel.tsx`.** Add `readOnly?: boolean;` to `Props` and `readOnly = false` to the destructured props. For the per-row upload label (the `<label className={\`shrink-0 cursor-pointer rounded-full …\`}>`), prefix the class expression with `${readOnly ? "pointer-events-none opacity-40 " : ""}` and change that row's input to `disabled={uploadingItemId !== null || readOnly}`. For the "Add Document" label, change its class to end with `${uploadingItemId !== null ? "opacity-50" : ""} ${readOnly ? "pointer-events-none opacity-40" : ""}` and its input to `disabled={uploadingItemId !== null || readOnly}`.

- [ ] **Step 2: `PartiesTable.tsx`.** Add `readOnly?: boolean;` to `Props` and `readOnly = false` to the destructured props. Wrap the trash button in each row:

```tsx
                {!readOnly && (
                  <button onClick={() => removeParty(p.id)} className="text-[#1B1B1B]/30 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
```

and wrap the whole `{adding ? (…) : (…)}` block at the bottom in `{!readOnly && ( … )}`.

- [ ] **Step 3: `ActivityFeed.tsx`.** Add `readOnly?: boolean;` to `Props` and `readOnly = false` to the destructured props. Wrap the `<div className="border-t border-[#1B1B1B]/10 pt-4">…</div>` note box in `{!readOnly && ( … )}`.

- [ ] **Step 4: File page.** Add `import { isFileReadOnlyFor } from "@/lib/file-lock";` (merge with the existing imports).

After the line `const viewerIsAdmin = session?.user?.role === "ADMIN";` add:

```tsx
  const readOnly = isFileReadOnlyFor(isListing ? "listing" : "transaction", file.status, session?.user?.role ?? "AGENT");
```

Header buttons: change the Convert condition to `{isListing && listing?.status === "ACTIVE" && !readOnly && (` and the Submit condition to `{!isReferral && !isLocked && !file.awaitingReview && !readOnly && (`.

Above the tab bar (just before `<div className="mb-6 flex gap-1 overflow-x-auto …">`, inside the `!isLocked` fragment), add:

```tsx
      {readOnly && (
        <p className="mb-4 rounded-lg bg-[#F2F0EF] px-4 py-2 text-sm text-[#1B1B1B]/60">This file is closed.</p>
      )}
```

Pass the prop at the four render sites: `<TasksTab … readOnly={readOnly} />`, `<ChecklistPanel … readOnly={readOnly} />`, `<PartiesTable … readOnly={readOnly} />`, `<ActivityFeed … readOnly={readOnly} />`.

`TasksTab`: add `readOnly` to its props type (`readOnly: boolean;`) and destructuring. Wrap the "+ Add Task" button in `{!readOnly && ( … )}`. Change `{showForm && (` to `{showForm && !readOnly && (`. Change the empty-state second line to render only when not read-only: `{!readOnly && <p className="mt-1 text-xs …">Click &quot;Add Task&quot; to create the first one.</p>}`. Pass `readOnly={readOnly}` to both `<TaskRow … />` usages.

`TaskRow`: add `readOnly: boolean;` to its props type and destructuring. On the toggle `<button onClick={() => onToggle(task)} …>` add `disabled={readOnly}` and append `disabled:cursor-default` to its className. Wrap the delete `<button … aria-label="Delete task">…</button>` in `{!readOnly && ( … )}`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` → 0. Run: `npx vitest run` → PASS.
Grep to confirm every component the page renders got the prop: `grep -n "readOnly" "apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx"` should show the definition, the two header conditions, the banner, and four render sites plus TasksTab/TaskRow internals.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/transactions/ChecklistPanel.tsx apps/web/src/components/transactions/PartiesTable.tsx apps/web/src/components/transactions/ActivityFeed.tsx "apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx"
git commit -m "feat: closed files are read-only on the agent screens" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: Lock coverage sweep and final checks (controller only)

**Files:** none modified unless the sweep finds a gap.

- [ ] **Step 1: Sweep for unguarded write routes.** From the repo root:

```bash
grep -rlE "prisma\.(listingFile|transactionFile|fileDocument|fileTask|fileParty|fileCondition|fileActivity)\.(create|update|delete|createMany|updateMany|deleteMany)" apps/web/src/app/api --include=route.ts | grep -v "/admin/" | sort
```

Every file listed must contain `assertFileEditable` or `isFileReadOnlyFor` or `changeFileStatus`, or be on this exceptions list (they create or delete whole files, or are admin-only): `api/transactions/route.ts` (create), `api/listings/route.ts` (create), `api/listings/[id]/route.ts` DELETE path (only INCOMPLETE or PENDING_TRANSFER files), `api/documents/[id]/download/route.ts` (read). For each remaining file, open it and either add the guard with a test in the matching test file, or record a written ruling for why not.

- [ ] **Step 2: Full verification.** From `apps/web`: `npx tsc --noEmit` (0 errors) and `npx vitest run` (all pass; note the new total).

- [ ] **Step 3: Production build (needs Ryan's OK).** Ask Ryan to approve stopping the dev server on :3000. Then `rm -rf apps/web/.next && pnpm --filter web build` (exit 0), delete `apps/web/.next`, restart `pnpm --filter web dev`, confirm `/login` returns 200. Report each result.

- [ ] **Step 4: Live check with Ryan on the walkthrough file** (Closed and Awaiting Review). Ask him to confirm:
  1. As the test agent: the "This file is closed." line shows; Upload and Add Document are greyed; Submit for Review is hidden; the Parties add and delete controls and the Tasks add and delete controls are gone; the note box is hidden.
  2. As admin: the status dropdown shows only Closed and Archived; all of the above stay editable.
  3. Approve or reject a document on any open test file: errors show inline, and the rejection reason appears on the agent's checklist row.
  4. Awaiting Review stays on after all documents are reviewed and clears only when the status is changed.
  5. The Closed email arrives for a close done from the admin screen, with `from → to` in the Activity tab.

- [ ] **Step 5: Commit any sweep fixes** (none expected).
