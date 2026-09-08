# Whole-Codebase Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every finding from the 2026-09-07 five-parallel-agent whole-codebase audit (security, performance, duplication, dead code) without regressing any currently-working behavior.

**Architecture:** No new subsystems. Every task is a targeted fix to existing code: closing missing ownership checks with the codebase's own `checkOwnership()` pattern, sanitizing two `dangerouslySetInnerHTML` sites, hardening 4 cron routes to match a pattern the 5th already has, adding indexes/`take` caps to unbounded queries, consolidating duplicated logic onto functions that already exist, and deleting confirmed-dead files/dependencies.

**Tech Stack:** Next.js 14 App Router, Prisma + PostgreSQL (Neon), NextAuth, Vitest, TypeScript.

**Spec:** The audit findings themselves (five agent reports, consolidated and presented to the user in-conversation on 2026-09-07) are the spec for this plan — there is no separate written design doc. Each task below cites the exact finding it fixes.

## Global Constraints

- Run `pnpm --filter web exec vitest run` and `pnpm --filter web exec tsc --noEmit` after every task. Both must be clean before moving to the next task.
- TDD per task wherever the change is behavioral (every security fix, the cron logic fix, index-backed query changes): write the failing test first, confirm RED, then implement, confirm GREEN.
- Each task is its own git commit. Never combine unrelated fixes in one commit. Never touch a file outside the task's stated scope.
- "Make sure the fixes won't break anything currently working" is the standing requirement for every task — end each task with proof (tests + tsc + a stated manual check where applicable), not an assumption.
- This is a long-lived single-branch project — work happens directly on `main`, no per-task worktrees, matching every other multi-task build in this codebase.
- Out of scope for this plan (explicitly deferred, do not touch): the sitewide hex-color-to-Tailwind-token cleanup; the SellQuote/FounderQuote/ManageQuote scroll-word-reveal shared-component extraction; any change to `LeadProfileTabs` tab mount/unmount behavior; the blog/triggers/action-plans `findMany` calls the audit rated as non-issues (small admin-curated tables).

---

### Task 1: Close the 5 missing ownership-check security gaps

Any authenticated agent can currently access or modify another agent's private file data by guessing/iterating an ID, because the `checkOwnership()` pattern (already used by 12+ routes since 2026-07-24) was never applied to these 5 routes.

**Files:**
- Modify: `apps/web/src/lib/api-auth.ts` — add a new shared helper
- Modify: `apps/web/src/app/api/files/[fileType]/[id]/parties/route.ts` — replace its local duplicate helper with the shared one
- Modify: `apps/web/src/app/api/files/[fileType]/[id]/parties/[partyId]/route.ts` — add ownership check
- Modify: `apps/web/src/app/api/files/[fileType]/[id]/note/route.ts` — add ownership check
- Modify: `apps/web/src/app/api/file-tasks/route.ts` — add ownership check
- Modify: `apps/web/src/app/api/documents/route.ts` — add ownership check
- Modify: `apps/web/src/app/api/upload-url/route.ts` — add ownership check
- Modify: `apps/web/src/app/api/documents/[id]/download/route.ts` — add ownership check
- Test: `apps/web/src/__tests__/lib/api-auth-file-access.test.ts` (new)
- Test: `apps/web/src/__tests__/api/files-parties.test.ts` (new)
- Test: `apps/web/src/__tests__/api/files-parties-id.test.ts` (new)
- Test: `apps/web/src/__tests__/api/files-note.test.ts` (new)
- Test: `apps/web/src/__tests__/api/file-tasks.test.ts` (new)
- Test: `apps/web/src/__tests__/api/documents.test.ts` (new)
- Test: `apps/web/src/__tests__/api/upload-url.test.ts` (new)
- Test: `apps/web/src/__tests__/api/documents-download.test.ts` (new)

**Interfaces:**
- Produces: `getFileAndVerifyAccess(fileType: "listing" | "transaction", fileId: string, callerAgentId: string | null, role: string): Promise<{ id: string; agentId: string } | null>` exported from `lib/api-auth.ts`. Returns `null` when the file doesn't exist OR the caller doesn't own it (ADMIN always passes). Task 15 (later) will migrate two more routes onto this same function — don't rename it.

- [ ] **Step 1: Write the failing test for `getFileAndVerifyAccess`**

Create `apps/web/src/__tests__/lib/api-auth-file-access.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getFileAndVerifyAccess } from "@/lib/api-auth";

describe("getFileAndVerifyAccess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the file when the caller owns it", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
    const result = await getFileAndVerifyAccess("listing", "f1", "a1", "AGENT");
    expect(result).toEqual({ id: "f1", agentId: "a1" });
  });

  it("returns null when a different agent owns the file", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
    const result = await getFileAndVerifyAccess("listing", "f1", "a2", "AGENT");
    expect(result).toBeNull();
  });

  it("returns the file for ADMIN regardless of owner", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "f2", agentId: "a1" } as any);
    const result = await getFileAndVerifyAccess("transaction", "f2", null, "ADMIN");
    expect(result).toEqual({ id: "f2", agentId: "a1" });
  });

  it("returns null when the file does not exist", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(null);
    const result = await getFileAndVerifyAccess("listing", "missing", "a1", "AGENT");
    expect(result).toBeNull();
  });

  it("queries transactionFile, not listingFile, when fileType is 'transaction'", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "f3", agentId: "a1" } as any);
    await getFileAndVerifyAccess("transaction", "f3", "a1", "AGENT");
    expect(prisma.transactionFile.findUnique).toHaveBeenCalledWith({
      where: { id: "f3" },
      select: { id: true, agentId: true },
    });
    expect(prisma.listingFile.findUnique).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/api-auth-file-access.test.ts`
Expected: FAIL — `getFileAndVerifyAccess is not a function` (it doesn't exist yet).

- [ ] **Step 3: Implement `getFileAndVerifyAccess` in `lib/api-auth.ts`**

Read the current file first — it exports `requireAuth` and `checkOwnership`, imports `getServerSession`, `NextResponse`, `authOptions`. Add a `prisma` import and the new function at the end of the file:

```ts
import { prisma } from "@/lib/prisma";

// Resolves a ListingFile or TransactionFile by id and verifies the caller
// owns it (or is ADMIN), in one call. Shared by every route that receives a
// fileType/fileId pair and needs to gate access to the parent file before
// touching a child record (parties, tasks, notes, documents).
export async function getFileAndVerifyAccess(
  fileType: "listing" | "transaction",
  fileId: string,
  callerAgentId: string | null,
  role: string
): Promise<{ id: string; agentId: string } | null> {
  const file = fileType === "listing"
    ? await prisma.listingFile.findUnique({ where: { id: fileId }, select: { id: true, agentId: true } })
    : await prisma.transactionFile.findUnique({ where: { id: fileId }, select: { id: true, agentId: true } });
  const { exists, forbidden, record } = checkOwnership(file, callerAgentId, role);
  if (!exists || forbidden) return null;
  return record;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/api-auth-file-access.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Replace the local duplicate in `parties/route.ts` with the shared helper**

Current top of `apps/web/src/app/api/files/[fileType]/[id]/parties/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOwnership } from "@/lib/api-auth";

async function getFileAndVerifyAccess(fileType: string, fileId: string, agentId: string | null, userRole: string) {
  const file = fileType === "listing"
    ? await prisma.listingFile.findUnique({ where: { id: fileId } })
    : await prisma.transactionFile.findUnique({ where: { id: fileId } });
  const { exists, forbidden, record } = checkOwnership(file, agentId, userRole);
  if (!exists || forbidden) return null;
  return record;
}
```

Replace with:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFileAndVerifyAccess } from "@/lib/api-auth";
```

The rest of the file (the `POST` handler calling `getFileAndVerifyAccess(params.fileType, params.id, session.user.agentId, session.user.role)`) is unchanged — it only ever checked truthiness of the returned file, never read a field beyond `id`/`agentId`, so narrowing the select is not a behavior change.

- [ ] **Step 6: Write the failing test for `parties/route.ts`'s existing behavior (regression guard) — RED first for the new note/file-tasks/etc. tests below, this file just needs a smoke test since its logic didn't change**

Create `apps/web/src/__tests__/api/files-parties.test.ts`:

```ts
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
    fileParty: { create: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/files/[fileType]/[id]/parties/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

function req(body: Record<string, unknown>) {
  return new Request("http://localhost/api/files/listing/f1/parties", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/files/[fileType]/[id]/parties", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the caller does not own the file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2" } as any);

    const res = await POST(req({ role: "BUYER", name: "Jane" }), { params: { fileType: "listing", id: "f1" } });
    expect(res.status).toBe(404);
    expect(prisma.fileParty.create).not.toHaveBeenCalled();
  });

  it("creates the party when the caller owns the file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
    vi.mocked(prisma.fileParty.create).mockResolvedValue({ id: "p1" } as any);

    const res = await POST(req({ role: "BUYER", name: "Jane" }), { params: { fileType: "listing", id: "f1" } });
    expect(res.status).toBe(201);
    expect(prisma.fileParty.create).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 7: Run this test — it should PASS immediately (this route's logic already worked correctly; this test just proves the refactor to the shared helper didn't break it)**

Run: `pnpm --filter web exec vitest run src/__tests__/api/files-parties.test.ts`
Expected: PASS, both tests. If it fails, the Step 5 refactor introduced a regression — fix before continuing.

- [ ] **Step 8: Write the failing tests for `parties/[partyId]/route.ts` (the real vulnerability)**

Create `apps/web/src/__tests__/api/files-parties-id.test.ts`:

```ts
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fileParty: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PATCH, DELETE } from "../../app/api/files/[fileType]/[id]/parties/[partyId]/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const PARAMS = { params: { fileType: "listing", id: "f1", partyId: "p1" } };

function patchReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/files/listing/f1/parties/p1", { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH/DELETE /api/files/[fileType]/[id]/parties/[partyId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PATCH: currently lets a non-owning agent edit another agent's party record", async () => {
    // This is the vulnerability: fileParty belongs to a listing owned by
    // a different agent (a2), but the caller (a1) is never checked against it.
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileParty.findUnique).mockResolvedValue({
      id: "p1", listingFileId: "f1", transactionFileId: null,
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2" } as any);

    const res = await PATCH(patchReq({ name: "Hacked Name" }), PARAMS);
    expect(res.status).toBe(403);
    expect(prisma.fileParty.update).not.toHaveBeenCalled();
  });

  it("PATCH: allows the owning agent to edit", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileParty.findUnique).mockResolvedValue({
      id: "p1", listingFileId: "f1", transactionFileId: null,
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
    vi.mocked(prisma.fileParty.update).mockResolvedValue({ id: "p1", name: "Jane" } as any);

    const res = await PATCH(patchReq({ name: "Jane" }), PARAMS);
    expect(res.status).toBe(200);
    expect(prisma.fileParty.update).toHaveBeenCalledOnce();
  });

  it("DELETE: forbids a non-owning agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileParty.findUnique).mockResolvedValue({
      id: "p1", listingFileId: null, transactionFileId: "t1",
    } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "t1", agentId: "a2" } as any);

    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), PARAMS);
    expect(res.status).toBe(403);
    expect(prisma.fileParty.delete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 9: Run tests to verify they fail**

Run: `pnpm --filter web exec vitest run src/__tests__/api/files-parties-id.test.ts`
Expected: FAIL on "currently lets a non-owning agent edit" (gets 200, not 403) and on the DELETE test (gets 200, not 403). The "allows the owning agent" test may already pass by coincidence — that's fine.

- [ ] **Step 10: Implement the fix in `parties/[partyId]/route.ts`**

Replace the full file content:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFileAndVerifyAccess } from "@/lib/api-auth";

async function verifyPartyAccess(partyId: string, agentId: string | null, role: string) {
  const party = await prisma.fileParty.findUnique({ where: { id: partyId } });
  if (!party) return { error: "Not found", status: 404 } as const;

  const fileId = party.listingFileId ?? party.transactionFileId;
  const fileType: "listing" | "transaction" = party.listingFileId ? "listing" : "transaction";
  if (!fileId) return { error: "Not found", status: 404 } as const;

  const file = await getFileAndVerifyAccess(fileType, fileId, agentId, role);
  if (!file) return { error: "Forbidden", status: 403 } as const;

  return { party };
}

export async function PATCH(req: Request, { params }: { params: { fileType: string; id: string; partyId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await verifyPartyAccess(params.partyId, session.user.agentId, session.user.role);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await req.json();
  const updated = await prisma.fileParty.update({
    where: { id: params.partyId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.company !== undefined && { company: body.company }),
      ...(body.licenseNumber !== undefined && { licenseNumber: body.licenseNumber }),
    },
  });

  return NextResponse.json({ party: updated });
}

export async function DELETE(_req: Request, { params }: { params: { fileType: string; id: string; partyId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await verifyPartyAccess(params.partyId, session.user.agentId, session.user.role);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  await prisma.fileParty.delete({ where: { id: params.partyId } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/__tests__/api/files-parties-id.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 12: Write the failing test for `files/[fileType]/[id]/note/route.ts`**

Create `apps/web/src/__tests__/api/files-note.test.ts`:

```ts
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/files/[fileType]/[id]/note/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

function req(note: string) {
  return new Request("http://localhost/api/files/listing/f1/note", { method: "POST", body: JSON.stringify({ note }) });
}

describe("POST /api/files/[fileType]/[id]/note", () => {
  beforeEach(() => vi.clearAllMocks());

  it("currently lets a non-owning agent post a note into another agent's file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2" } as any);

    const res = await POST(req("fabricated note"), { params: { fileType: "listing", id: "f1" } });
    expect(res.status).toBe(403);
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
  });

  it("allows the owning agent to post a note", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({ id: "act1" } as any);

    const res = await POST(req("real note"), { params: { fileType: "listing", id: "f1" } });
    expect(res.status).toBe(200);
    expect(prisma.fileActivity.create).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 13: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/files-note.test.ts`
Expected: FAIL on the first test (gets 200, not 403).

- [ ] **Step 14: Implement the fix in `files/[fileType]/[id]/note/route.ts`**

Replace the full file:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFileAndVerifyAccess } from "@/lib/api-auth";

export async function POST(req: Request, { params }: { params: { fileType: string; id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isListing = params.fileType === "listing";
  const file = await getFileAndVerifyAccess(
    isListing ? "listing" : "transaction",
    params.id,
    session.user.agentId,
    session.user.role
  );
  if (!file) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { note } = await req.json();
  if (!note?.trim()) return NextResponse.json({ error: "note is required" }, { status: 400 });

  await prisma.fileActivity.create({
    data: {
      fileType: isListing ? "LISTING" : "TRANSACTION",
      listingFileId: isListing ? params.id : null,
      transactionFileId: isListing ? null : params.id,
      actorId: session.user.id,
      actorRole: session.user.role === "ADMIN" ? "ADMIN" : "AGENT",
      type: "NOTE_ADDED",
      note,
    },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 15: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/files-note.test.ts`
Expected: PASS, both tests.

- [ ] **Step 16: Write the failing tests for `file-tasks/route.ts` (GET + POST collection)**

Create `apps/web/src/__tests__/api/file-tasks.test.ts`:

```ts
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
    fileTask: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../../app/api/file-tasks/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

function getReq(fileType: string, fileId: string) {
  return new Request(`http://localhost/api/file-tasks?fileType=${fileType}&fileId=${fileId}`);
}
function postReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/file-tasks", { method: "POST", body: JSON.stringify(body) });
}

describe("GET/POST /api/file-tasks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET: currently lets a non-owning agent list another agent's file tasks", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2" } as any);

    const res = await GET(getReq("listing", "f1"));
    expect(res.status).toBe(403);
    expect(prisma.fileTask.findMany).not.toHaveBeenCalled();
  });

  it("GET: allows the owning agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
    vi.mocked(prisma.fileTask.findMany).mockResolvedValue([] as any);

    const res = await GET(getReq("listing", "f1"));
    expect(res.status).toBe(200);
  });

  it("POST: currently lets a non-owning agent create a task on another agent's file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "t1", agentId: "a2" } as any);

    const res = await POST(postReq({ fileType: "transaction", fileId: "t1", title: "Sneak in a task" }));
    expect(res.status).toBe(403);
    expect(prisma.fileTask.create).not.toHaveBeenCalled();
  });

  it("POST: allows the owning agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "t1", agentId: "a1" } as any);
    vi.mocked(prisma.fileTask.create).mockResolvedValue({ id: "task1" } as any);

    const res = await POST(postReq({ fileType: "transaction", fileId: "t1", title: "Real task" }));
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 17: Run tests to verify they fail**

Run: `pnpm --filter web exec vitest run src/__tests__/api/file-tasks.test.ts`
Expected: FAIL on both "currently lets a non-owning agent" tests (200 instead of 403).

- [ ] **Step 18: Implement the fix in `file-tasks/route.ts`**

Replace the full file:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFileAndVerifyAccess } from "@/lib/api-auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fileType = searchParams.get("fileType");
  const fileId = searchParams.get("fileId");
  if (!fileType || !fileId) return NextResponse.json({ error: "fileType and fileId required" }, { status: 400 });

  if (fileType !== "listing" && fileType !== "transaction") {
    return NextResponse.json({ error: "fileType must be 'listing' or 'transaction'" }, { status: 400 });
  }

  const file = await getFileAndVerifyAccess(fileType, fileId, session.user.agentId, session.user.role);
  if (!file) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tasks = await prisma.fileTask.findMany({
    where: fileType === "listing" ? { listingFileId: fileId } : { transactionFileId: fileId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { fileType: string; fileId: string; title: string; dueDate?: string; assigneeName?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { fileType, fileId, title, dueDate, assigneeName } = body;
  if (!fileId || !title?.trim()) {
    return NextResponse.json({ error: "fileType, fileId, and title are required" }, { status: 400 });
  }
  if (fileType !== "listing" && fileType !== "transaction") {
    return NextResponse.json({ error: "fileType must be 'listing' or 'transaction'" }, { status: 400 });
  }

  const file = await getFileAndVerifyAccess(fileType, fileId, session.user.agentId, session.user.role);
  if (!file) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const task = await prisma.fileTask.create({
    data: {
      fileType: fileType === "listing" ? "LISTING" : "TRANSACTION",
      ...(fileType === "listing" ? { listingFileId: fileId } : { transactionFileId: fileId }),
      title: title.trim(),
      dueDate: dueDate ? new Date(dueDate) : null,
      assigneeName: assigneeName?.trim() || null,
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}
```

- [ ] **Step 19: Run tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/__tests__/api/file-tasks.test.ts`
Expected: PASS, all 4 tests.

- [ ] **Step 20: Write the failing test for `documents/route.ts` (POST)**

Create `apps/web/src/__tests__/api/documents.test.ts`:

```ts
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
    fileDocument: { create: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/documents/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

function req(body: Record<string, unknown>) {
  return new Request("http://localhost/api/documents", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/documents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("currently lets a non-owning agent attach a document to another agent's file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2" } as any);

    const res = await POST(req({ fileType: "LISTING", fileId: "f1", name: "sneaky.pdf", r2Key: "k", r2Url: "u" }));
    expect(res.status).toBe(403);
    expect(prisma.fileDocument.create).not.toHaveBeenCalled();
  });

  it("allows the owning agent to attach a document", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
    vi.mocked(prisma.fileDocument.create).mockResolvedValue({ id: "doc1" } as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({ id: "act1" } as any);

    const res = await POST(req({ fileType: "LISTING", fileId: "f1", name: "real.pdf", r2Key: "k", r2Url: "u" }));
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 21: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/documents.test.ts`
Expected: FAIL on the first test (200 instead of 403).

- [ ] **Step 22: Implement the fix in `documents/route.ts`**

`fileType` in this route's request body is `"LISTING"`/`"TRANSACTION"` (uppercase — it's used directly as the Prisma enum value), unlike the lowercase `"listing"`/`"transaction"` convention used everywhere else in this task. Normalize it before calling the shared helper. Replace the full file:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFileAndVerifyAccess } from "@/lib/api-auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { fileType, fileId, checklistItemId, name, r2Key, r2Url, documentId } = body;

  if (!fileType || !fileId || !name || !r2Key || !r2Url) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const isListing = fileType === "LISTING";
  const file = await getFileAndVerifyAccess(
    isListing ? "listing" : "transaction",
    fileId,
    session.user.agentId,
    session.user.role
  );
  if (!file) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const doc = await prisma.fileDocument.create({
    data: {
      id: documentId ?? undefined,
      fileType,
      listingFileId: isListing ? fileId : null,
      transactionFileId: isListing ? null : fileId,
      checklistItemId: checklistItemId ?? null,
      name,
      r2Key,
      r2Url,
      uploadedByAgentId: session.user.id,
      reviewStatus: "PENDING_REVIEW",
    },
  });

  await prisma.fileActivity.create({
    data: {
      fileType,
      listingFileId: isListing ? fileId : null,
      transactionFileId: isListing ? null : fileId,
      actorId: session.user.id,
      actorRole: session.user.role === "ADMIN" ? "ADMIN" : "AGENT",
      type: "DOCUMENT_UPLOADED",
      payload: { documentId: doc.id, name },
    },
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}
```

- [ ] **Step 23: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/documents.test.ts`
Expected: PASS, both tests.

- [ ] **Step 24: Write the failing test for `upload-url/route.ts` (GET)**

Create `apps/web/src/__tests__/api/upload-url.test.ts`:

```ts
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/r2", () => ({ getPresignedPutUrl: vi.fn().mockResolvedValue("https://r2.example/put-url") }));
vi.mock("@paralleldrive/cuid2", () => ({ createId: () => "generated-id" }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPresignedPutUrl } from "@/lib/r2";
import { GET } from "../../app/api/upload-url/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

function req(fileType: string, fileId: string) {
  return new Request(
    `http://localhost/api/upload-url?fileType=${fileType}&fileId=${fileId}&filename=doc.pdf&contentType=application/pdf&size=1000`
  );
}

describe("GET /api/upload-url", () => {
  beforeEach(() => vi.clearAllMocks());

  it("currently lets a non-owning agent get a presigned upload URL for another agent's file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2" } as any);

    const res = await GET(req("listing", "f1"));
    expect(res.status).toBe(403);
    expect(getPresignedPutUrl).not.toHaveBeenCalled();
  });

  it("allows the owning agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);

    const res = await GET(req("listing", "f1"));
    expect(res.status).toBe(200);
    expect(getPresignedPutUrl).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 25: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/upload-url.test.ts`
Expected: FAIL on the first test (200 instead of 403).

- [ ] **Step 26: Implement the fix in `upload-url/route.ts`**

Modify `apps/web/src/app/api/upload-url/route.ts` — add the import and the check right after the existing validation, before generating the presigned URL:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPresignedPutUrl, buildR2Key } from "@/lib/r2";
import { getFileAndVerifyAccess } from "@/lib/api-auth";
import { createId } from "@paralleldrive/cuid2";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE = 50 * 1024 * 1024;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fileType = searchParams.get("fileType") as "listing" | "transaction" | null;
  const fileId = searchParams.get("fileId");
  const filename = searchParams.get("filename");
  const contentType = searchParams.get("contentType");
  const size = Number(searchParams.get("size") ?? 0);

  if (!fileType || !fileId || !filename || !contentType) {
    return NextResponse.json({ error: "fileType, fileId, filename, and contentType are required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "File type not allowed. Use PDF, JPG, PNG, or DOCX." }, { status: 400 });
  }
  if (size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds 50MB limit" }, { status: 400 });
  }

  const file = await getFileAndVerifyAccess(fileType, fileId, session.user.agentId, session.user.role);
  if (!file) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const documentId = createId();
  const key = buildR2Key(fileType, fileId, documentId, filename);
  const uploadUrl = await getPresignedPutUrl(key, contentType);

  return NextResponse.json({ uploadUrl, key, documentId });
}
```

- [ ] **Step 27: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/upload-url.test.ts`
Expected: PASS, both tests.

- [ ] **Step 28: Write the failing test for `documents/[id]/download/route.ts` (GET) — the finding verified live during the audit**

Create `apps/web/src/__tests__/api/documents-download.test.ts`:

```ts
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fileDocument: { findUnique: vi.fn() },
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/r2", () => ({ getPresignedGetUrl: vi.fn().mockResolvedValue("https://r2.example/get-url") }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPresignedGetUrl } from "@/lib/r2";
import { GET } from "../../app/api/documents/[id]/download/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

describe("GET /api/documents/[id]/download", () => {
  beforeEach(() => vi.clearAllMocks());

  it("currently lets any authenticated agent download any other agent's document", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "doc1", r2Key: "k", listingFileId: "f1", transactionFileId: null,
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2" } as any);

    const res = await GET(new Request("http://localhost"), { params: { id: "doc1" } });
    expect(res.status).toBe(403);
    expect(getPresignedGetUrl).not.toHaveBeenCalled();
  });

  it("allows the owning agent to download", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "doc1", r2Key: "k", listingFileId: "f1", transactionFileId: null,
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);

    const res = await GET(new Request("http://localhost"), { params: { id: "doc1" } });
    expect(res.status).toBe(200);
    expect(getPresignedGetUrl).toHaveBeenCalledOnce();
  });

  it("allows ADMIN regardless of who owns the file", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u2", role: "ADMIN", agentId: null } } as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "doc1", r2Key: "k", listingFileId: null, transactionFileId: "t1",
    } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "t1", agentId: "a1" } as any);

    const res = await GET(new Request("http://localhost"), { params: { id: "doc1" } });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 29: Run tests to verify they fail**

Run: `pnpm --filter web exec vitest run src/__tests__/api/documents-download.test.ts`
Expected: FAIL on the first test (200 instead of 403).

- [ ] **Step 30: Implement the fix in `documents/[id]/download/route.ts`**

Replace the full file:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPresignedGetUrl } from "@/lib/r2";
import { getFileAndVerifyAccess } from "@/lib/api-auth";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.fileDocument.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fileId = doc.listingFileId ?? doc.transactionFileId;
  const fileType: "listing" | "transaction" = doc.listingFileId ? "listing" : "transaction";
  if (!fileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const file = await getFileAndVerifyAccess(fileType, fileId, session.user.agentId, session.user.role);
  if (!file) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = await getPresignedGetUrl(doc.r2Key);
  return NextResponse.json({ url });
}
```

- [ ] **Step 31: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/documents-download.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 32: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green, zero new errors.

- [ ] **Step 33: Commit**

```bash
git add apps/web/src/lib/api-auth.ts \
  "apps/web/src/app/api/files/[fileType]/[id]/parties/route.ts" \
  "apps/web/src/app/api/files/[fileType]/[id]/parties/[partyId]/route.ts" \
  "apps/web/src/app/api/files/[fileType]/[id]/note/route.ts" \
  apps/web/src/app/api/file-tasks/route.ts \
  apps/web/src/app/api/documents/route.ts \
  apps/web/src/app/api/upload-url/route.ts \
  "apps/web/src/app/api/documents/[id]/download/route.ts" \
  apps/web/src/__tests__/lib/api-auth-file-access.test.ts \
  apps/web/src/__tests__/api/files-parties.test.ts \
  apps/web/src/__tests__/api/files-parties-id.test.ts \
  apps/web/src/__tests__/api/files-note.test.ts \
  apps/web/src/__tests__/api/file-tasks.test.ts \
  apps/web/src/__tests__/api/documents.test.ts \
  apps/web/src/__tests__/api/upload-url.test.ts \
  apps/web/src/__tests__/api/documents-download.test.ts
git commit -m "fix: close 5 cross-agent ownership gaps (documents, file-tasks, file parties/notes)"
```

---

### Task 2: Sanitize stored XSS in blog posts and campaign body

An approved AGENT can currently set `<script>` as blog post content or campaign body, and it renders unsanitized via `dangerouslySetInnerHTML` — on the PUBLIC `/press/[slug]` page for blog, and in front of ADMIN sessions (which can view any agent's campaign) for campaigns.

**Files:**
- Modify: `apps/web/src/components/blog/PostBody.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx`
- Create: `apps/web/src/lib/sanitize-html.ts`
- Test: `apps/web/src/__tests__/lib/sanitize-html.test.ts` (new)

**Interfaces:**
- Produces: `sanitizeHtml(html: string): string` exported from `lib/sanitize-html.ts`.

- [ ] **Step 1: Install the sanitization library**

```bash
pnpm --filter web add isomorphic-dompurify
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/__tests__/lib/sanitize-html.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize-html";

describe("sanitizeHtml", () => {
  it("strips a script tag entirely", () => {
    const result = sanitizeHtml('<p>Hello</p><script>alert(1)</script>');
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("Hello");
  });

  it("strips an inline event-handler attribute", () => {
    const result = sanitizeHtml('<img src="x.jpg" onerror="alert(1)">');
    expect(result).not.toContain("onerror");
  });

  it("preserves the tags Tiptap's StarterKit actually outputs", () => {
    const html =
      "<p>Hi <strong>there</strong>, <em>welcome</em>.</p>" +
      "<ul><li>One</li><li>Two</li></ul>" +
      '<ol><li>First</li></ol>' +
      '<a href="https://example.com">a link</a>';
    const result = sanitizeHtml(html);
    expect(result).toContain("<strong>there</strong>");
    expect(result).toContain("<em>welcome</em>");
    expect(result).toContain("<li>One</li>");
    expect(result).toContain("<li>Two</li>");
    expect(result).toContain("<li>First</li>");
    expect(result).toContain('href="https://example.com"');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/sanitize-html.test.ts`
Expected: FAIL — `sanitizeHtml is not a function` (module doesn't exist yet).

- [ ] **Step 4: Implement `lib/sanitize-html.ts`**

```ts
import DOMPurify from "isomorphic-dompurify";

// Every place in this app that renders agent-authored or admin-authored
// rich text via dangerouslySetInnerHTML must go through this first — blog
// posts reach the public site, campaign bodies reach an admin's session via
// checkOwnership's admin bypass. DOMPurify's default allowlist already
// covers everything Tiptap's StarterKit can produce (p, strong, em, ul, ol,
// li, a, br, h1-h6, blockquote, code) while stripping script tags and
// event-handler attributes.
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/sanitize-html.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 6: Apply it in `PostBody.tsx`**

Replace the full file:

```tsx
import { sanitizeHtml } from "@/lib/sanitize-html";

interface PostBodyProps {
  html: string;
}

export function PostBody({ html }: PostBodyProps) {
  return (
    <div
      className="prose prose-neutral max-w-none prose-headings:font-sans prose-headings:font-light prose-headings:text-[#1B1B1B] prose-p:text-[#1B1B1B]/80 prose-p:leading-relaxed prose-a:text-[#9E8C61] prose-a:no-underline hover:prose-a:underline prose-strong:text-[#1B1B1B] prose-li:text-[#1B1B1B]/80 prose-img:rounded-2xl"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
```

- [ ] **Step 7: Apply it in the campaign detail page**

In `apps/web/src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx`, add the import at the top alongside the existing imports:

```tsx
import { sanitizeHtml } from "@/lib/sanitize-html";
```

Find this block (renders the campaign body preview):

```tsx
            <div
              className="prose prose-sm max-w-none font-sans text-sm text-[#1B1B1B]"
              dangerouslySetInnerHTML={{ __html: campaign.body }}
            />
```

Replace with:

```tsx
            <div
              className="prose prose-sm max-w-none font-sans text-sm text-[#1B1B1B]"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(campaign.body) }}
            />
```

- [ ] **Step 8: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green.

- [ ] **Step 9: Manual check — confirm the campaigns detail page still renders normally**

If a dev server is available, open a campaign with a body containing bold/italic/a list and confirm it still displays correctly (this page has no automated render tests, per this project's convention — state plainly in the report whether this live check was actually performed or not).

- [ ] **Step 10: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/src/lib/sanitize-html.ts apps/web/src/__tests__/lib/sanitize-html.test.ts apps/web/src/components/blog/PostBody.tsx "apps/web/src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx"
git commit -m "fix: sanitize agent-authored HTML before rendering (blog posts, campaign body)"
```

---

### Task 3: Fix fail-open cron secret comparison

Four cron routes compare against `Bearer ${process.env.CRON_SECRET}` with no check that `CRON_SECRET` is actually set — if it's ever unset, the literal string `"Bearer undefined"` becomes a valid credential. `idx/sync/route.ts` already guards against this (`isAuthorized()` returns `false` outright when `!secret`). Extract that pattern into a shared helper and apply it to the 4 routes missing it.

**Files:**
- Create: `apps/web/src/lib/cron-auth.ts`
- Test: `apps/web/src/__tests__/lib/cron-auth.test.ts` (new)
- Modify: `apps/web/src/app/api/cron/action-plans/route.ts`
- Modify: `apps/web/src/app/api/cron/campaign-deliveries/route.ts`
- Modify: `apps/web/src/app/api/cron/deadline-reminders/route.ts`
- Modify: `apps/web/src/app/api/cron/listing-expiration-warnings/route.ts`
- Test: `apps/web/src/__tests__/api/cron-action-plans.test.ts` — extend if it exists, else check for existing coverage first
- Test: `apps/web/src/__tests__/api/cron-campaign-deliveries.test.ts` — extend
- Test: `apps/web/src/__tests__/api/deadline-reminders.test.ts` — extend
- Test: `apps/web/src/__tests__/api/listing-expiration-warnings.test.ts` — extend

Do NOT touch `apps/web/src/app/api/idx/sync/route.ts` — it already has the correct pattern; leave it as-is rather than introduce unrelated churn.

**Interfaces:**
- Produces: `isAuthorizedCronRequest(req: Request): boolean` exported from `lib/cron-auth.ts`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/lib/cron-auth.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

describe("isAuthorizedCronRequest", () => {
  const ORIGINAL = process.env.CRON_SECRET;
  afterEach(() => { process.env.CRON_SECRET = ORIGINAL; });

  it("returns false when CRON_SECRET is not set, even if the header says 'Bearer undefined'", () => {
    delete process.env.CRON_SECRET;
    const req = new Request("http://localhost", { headers: { authorization: "Bearer undefined" } });
    expect(isAuthorizedCronRequest(req)).toBe(false);
  });

  it("returns true when the header matches the configured secret", () => {
    process.env.CRON_SECRET = "real-secret";
    const req = new Request("http://localhost", { headers: { authorization: "Bearer real-secret" } });
    expect(isAuthorizedCronRequest(req)).toBe(true);
  });

  it("returns false when the header doesn't match", () => {
    process.env.CRON_SECRET = "real-secret";
    const req = new Request("http://localhost", { headers: { authorization: "Bearer wrong" } });
    expect(isAuthorizedCronRequest(req)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/cron-auth.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/cron-auth.ts`**

```ts
// Shared by every cron route triggered by Vercel Cron with a bearer-token
// secret. Mirrors the pattern api/idx/sync/route.ts already used correctly:
// an unset secret must fail closed, not silently accept the literal string
// "Bearer undefined" as a valid credential.
export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/cron-auth.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Check existing test coverage for the 4 target routes before touching them**

Run: `ls apps/web/src/__tests__/api/ | grep -E "cron-action-plans|cron-campaign-deliveries|deadline-reminders|listing-expiration-warnings"`

For whichever files exist, open them and add ONE new test per file (pattern below) proving the current fail-open behavior, before making the fix. If a test file doesn't exist for a route, create it with just this one test plus whatever minimal mocking is needed to exercise the route's auth check specifically (mock `prisma` methods the route calls as empty/resolved so the auth check is what's actually being tested, not a downstream crash).

Add this test to each of the 4 files (adjust the imported `POST` path per file):

```ts
it("currently authorizes when CRON_SECRET is unset and the header literally says 'Bearer undefined'", async () => {
  const original = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { authorization: "Bearer undefined" },
    });
    const res = await POST(req as any);
    expect(res.status).not.toBe(200); // after the fix, this becomes 401
  } finally {
    process.env.CRON_SECRET = original;
  }
});
```

- [ ] **Step 6: Run the 4 new/updated tests to verify they fail**

Run: `pnpm --filter web exec vitest run src/__tests__/api/cron-action-plans.test.ts src/__tests__/api/cron-campaign-deliveries.test.ts src/__tests__/api/deadline-reminders.test.ts src/__tests__/api/listing-expiration-warnings.test.ts`
Expected: the 4 new tests FAIL (each route currently returns 200 or crashes-then-200 with the unset secret, not 401).

- [ ] **Step 7: Fix `action-plans/route.ts`**

Add the import and replace the auth check:

```ts
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
```

```ts
export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
```

- [ ] **Step 8: Fix `campaign-deliveries/route.ts`**

Same pattern — add the import, replace:

```ts
export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
```

with:

```ts
export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
```

- [ ] **Step 9: Fix `deadline-reminders/route.ts`**

Replace:

```ts
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
```

with:

```ts
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
```

Add the import at the top.

- [ ] **Step 10: Fix `listing-expiration-warnings/route.ts`**

Same replacement as Step 9, same import.

- [ ] **Step 11: Run the 4 tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/__tests__/api/cron-action-plans.test.ts src/__tests__/api/cron-campaign-deliveries.test.ts src/__tests__/api/deadline-reminders.test.ts src/__tests__/api/listing-expiration-warnings.test.ts`
Expected: PASS.

- [ ] **Step 12: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green.

- [ ] **Step 13: Commit**

```bash
git add apps/web/src/lib/cron-auth.ts apps/web/src/__tests__/lib/cron-auth.test.ts \
  apps/web/src/app/api/cron/action-plans/route.ts \
  apps/web/src/app/api/cron/campaign-deliveries/route.ts \
  apps/web/src/app/api/cron/deadline-reminders/route.ts \
  apps/web/src/app/api/cron/listing-expiration-warnings/route.ts \
  apps/web/src/__tests__/api/cron-action-plans.test.ts \
  apps/web/src/__tests__/api/cron-campaign-deliveries.test.ts \
  apps/web/src/__tests__/api/deadline-reminders.test.ts \
  apps/web/src/__tests__/api/listing-expiration-warnings.test.ts
git commit -m "fix: fail closed on unset CRON_SECRET in the 4 remaining cron routes"
```

---

### Task 4: Add rate limiting to unprotected public endpoints

Three public unauthenticated POST endpoints, plus the public GET home-value/estimate endpoint, have no rate limiting, unlike their siblings (`leads`, `agents/[slug]/contact`, `home-value/reveal`) which already use `publicFormRateLimit`.

**Files:**
- Modify: `apps/web/src/app/api/agent-applications/route.ts`
- Modify: `apps/web/src/app/api/auth/register/route.ts`
- Modify: `apps/web/src/app/api/auth/forgot-password/route.ts`
- Modify: `apps/web/src/app/api/home-value/estimate/route.ts`
- Test: `apps/web/src/__tests__/api/agent-applications.test.ts` — extend
- Test: `apps/web/src/__tests__/api/register.test.ts` — extend if exists, else check
- Test: `apps/web/src/__tests__/api/forgot-password.test.ts` — extend
- Test: `apps/web/src/__tests__/api/home-value-estimate.test.ts` — extend if exists, else check

**Interfaces:**
- Consumes: `publicFormRateLimit` from `apps/web/src/lib/rate-limit.ts` (already exists, already used by `home-value/reveal/route.ts` — copy that exact usage pattern: get client IP from `x-forwarded-for`, call `.limit(ip)`, on `!success` return 429 with a `Retry-After` header, wrap the call in try/catch and proceed on limiter-unavailable rather than fail the whole request).

- [ ] **Step 1: Check existing test coverage**

Run: `ls apps/web/src/__tests__/api/ | grep -E "^register|^forgot-password|^home-value-estimate|^agent-applications"`

For any that exist, read them first to match their mocking conventions before adding new tests.

- [ ] **Step 2: Write the failing test for `agent-applications`**

Add to `apps/web/src/__tests__/api/agent-applications.test.ts` (create the mock for `@/lib/rate-limit` at the top of the file alongside its other `vi.mock` calls if not already present):

```ts
vi.mock("@/lib/rate-limit", () => ({
  publicFormRateLimit: { limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }) },
}));
```

```ts
import { publicFormRateLimit } from "@/lib/rate-limit";

it("returns 429 when the rate limit is exceeded", async () => {
  vi.mocked(publicFormRateLimit.limit).mockResolvedValueOnce({ success: false, reset: Date.now() + 5000 } as any);
  const res = await POST(makeValidRequest()); // use this file's existing helper for a well-formed request body
  expect(res.status).toBe(429);
});
```

Adjust `makeValidRequest()` to whatever helper this file already uses to build a valid POST body — read the file first.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/agent-applications.test.ts`
Expected: FAIL (currently no rate limit, so it never returns 429).

- [ ] **Step 4: Implement in `agent-applications/route.ts`**

Add the import:

```ts
import { publicFormRateLimit } from "@/lib/rate-limit";
```

Insert this at the very top of the `POST` function body, before the existing `try`:

```ts
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  try {
    const { success, reset } = await publicFormRateLimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } }
      );
    }
  } catch (err) {
    console.error("[agent-applications] rate limiter unavailable, proceeding:", err);
  }

  try {
    const body = await req.json();
    // ... rest of the existing try block is unchanged
```

Note: the existing function already has its own `try { ... } catch` — keep that block exactly as-is, just wrap it with the new rate-limit check before it (as a second, separate try/catch, matching `home-value/reveal/route.ts`'s exact structure).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/agent-applications.test.ts`
Expected: PASS.

- [ ] **Step 6: Repeat Steps 2-5 for `auth/register/route.ts`**

Same pattern. If `apps/web/src/__tests__/api/register.test.ts` doesn't exist, create it with the rate-limit test plus a minimal happy-path test:

```ts
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rate-limit", () => ({
  publicFormRateLimit: { limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }) },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "u1" }) } },
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("hashed") } }));

import { publicFormRateLimit } from "@/lib/rate-limit";
import { POST } from "../../app/api/auth/register/route";

function req(body: Record<string, unknown>) {
  return new Request("http://localhost/api/auth/register", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 429 when rate limited", async () => {
    vi.mocked(publicFormRateLimit.limit).mockResolvedValueOnce({ success: false, reset: Date.now() + 5000 } as any);
    const res = await POST(req({ email: "a@example.com", password: "password123" }) as any);
    expect(res.status).toBe(429);
  });

  it("registers successfully when not rate limited", async () => {
    const res = await POST(req({ email: "a@example.com", password: "password123" }) as any);
    expect(res.status).toBe(201);
  });
});
```

Implement in `auth/register/route.ts` the same way — wrap the existing body with the rate-limit check first. Use `NextRequest`/`NextResponse` already imported in that file (it already imports both).

- [ ] **Step 7: Repeat for `auth/forgot-password/route.ts`**

Same pattern. This route must keep its existing "always return the same response" behavior for the underlying account-enumeration protection — the rate-limit check goes BEFORE that logic, and a rate-limited response (429) is a different, honest signal (server load) that doesn't leak whether an account exists, so it does not conflict with that protection. Add:

```ts
it("returns 429 when rate limited", async () => {
  vi.mocked(publicFormRateLimit.limit).mockResolvedValueOnce({ success: false, reset: Date.now() + 5000 } as any);
  const res = await POST(req("someone@example.com"));
  expect(res.status).toBe(429);
});
```

to `apps/web/src/__tests__/api/forgot-password.test.ts` (read it first for its existing `req()` helper and mock setup), implement the same wrap-with-rate-limit-check pattern in the route.

- [ ] **Step 8: Repeat for `home-value/estimate/route.ts` (GET, not POST)**

This one is a GET, so the rate-limit key should still be IP-based. Add the check right after parsing `address`/`zip`:

```ts
import { publicFormRateLimit } from "@/lib/rate-limit";
```

```ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const zip = searchParams.get("zip");

  if (!address || !zip) {
    return NextResponse.json({ error: "address and zip are required" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  try {
    const { success, reset } = await publicFormRateLimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } }
      );
    }
  } catch (err) {
    console.error("[home-value/estimate] rate limiter unavailable, proceeding:", err);
  }

  // ... rest of the function unchanged
```

If `apps/web/src/__tests__/api/home-value-estimate.test.ts` doesn't exist, check for one covering this route under a different name first (`grep -rl "home-value/estimate" apps/web/src/__tests__`); if none exists at all, create a minimal one with just the rate-limit test plus enough mocking of `@/lib/home-value-estimate`'s exports to reach a 200 in the non-limited case — read `home-value/reveal`'s existing test file first for the mocking pattern to copy.

- [ ] **Step 9: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/api/agent-applications/route.ts \
  apps/web/src/app/api/auth/register/route.ts \
  apps/web/src/app/api/auth/forgot-password/route.ts \
  apps/web/src/app/api/home-value/estimate/route.ts \
  apps/web/src/__tests__/api/agent-applications.test.ts \
  apps/web/src/__tests__/api/register.test.ts \
  apps/web/src/__tests__/api/forgot-password.test.ts \
  apps/web/src/__tests__/api/home-value-estimate.test.ts
git commit -m "fix: add rate limiting to agent-applications, register, forgot-password, home-value/estimate"
```

---

### Task 5: Fix JSON-LD `</script>` breakout

None of `lib/json-ld.ts`'s functions escape `<` before their output is `JSON.stringify`'d into a `<script type="application/ld+json">` tag. Agent-editable bio text (public agent pages) and MLS-sourced descriptions (public property pages) can currently break out of the script tag.

**Files:**
- Modify: `apps/web/src/lib/json-ld.ts`
- Test: `apps/web/src/__tests__/lib/json-ld.test.ts` — extend if exists, else create

**Interfaces:**
- Existing `propertyJsonLd`, `agentJsonLd`, `localBusinessJsonLd` keep their exact current signatures and return shapes — only how their caller embeds the result changes.

- [ ] **Step 1: Check for an existing test file**

Run: `ls apps/web/src/__tests__/lib/ | grep json-ld`

- [ ] **Step 2: Write the failing test**

Since the vulnerability is in how the JSON is embedded, not in the JSON-LD object shape itself, the fix belongs in a new small helper, not inside the three existing functions (which are also used server-side for structured metadata that never touches `dangerouslySetInnerHTML` in some cases — keep them pure). Add to `apps/web/src/__tests__/lib/json-ld.test.ts` (create if it doesn't exist):

```ts
import { describe, it, expect } from "vitest";
import { agentJsonLd, jsonLdScriptSafe } from "@/lib/json-ld";

describe("jsonLdScriptSafe", () => {
  it("neutralizes a </script> sequence so it cannot close the surrounding script tag", () => {
    const malicious = agentJsonLd({
      name: "Jane",
      slug: "jane",
      bio: '</script><script>alert(1)</script>',
      headshot: null,
      phone: null,
    });
    const safe = jsonLdScriptSafe(malicious);
    expect(safe).not.toContain("</script>");
    expect(safe).toContain("\\u003c/script\\u003e");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/json-ld.test.ts`
Expected: FAIL — `jsonLdScriptSafe` doesn't exist.

- [ ] **Step 4: Implement `jsonLdScriptSafe` in `lib/json-ld.ts`**

Add this export at the end of the file (after `localBusinessJsonLd`):

```ts
// Every caller that embeds one of this file's objects into a
// <script type="application/ld+json"> tag via dangerouslySetInnerHTML must
// run the stringified result through this first. JSON.stringify alone does
// not escape "<", so a "</script>" sequence inside attacker-controlled text
// (an agent's bio, an MLS description) can close the script tag early and
// inject a sibling <script> that the browser executes.
export function jsonLdScriptSafe(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/json-ld.test.ts`
Expected: PASS.

- [ ] **Step 6: Find and update every render-site call**

Run: `grep -rln "propertyJsonLd\|agentJsonLd\|localBusinessJsonLd" apps/web/src/app --include="*.tsx"`

For each file found, locate the `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(...) }} />` pattern and change `JSON.stringify(...)` to `jsonLdScriptSafe(...)`, adding `jsonLdScriptSafe` to that file's existing import from `@/lib/json-ld`. Do this for every call site found — do not skip any.

- [ ] **Step 7: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/json-ld.ts apps/web/src/__tests__/lib/json-ld.test.ts
git add -u apps/web/src/app
git commit -m "fix: neutralize </script> breakout in JSON-LD structured data"
```

---

### Task 6: Escape remaining unescaped HTML interpolations (minor, batch)

Two spots interpolate untrusted/semi-trusted strings into HTML without `escapeHtml()`, inconsistent with every other function in these files.

**Files:**
- Modify: `apps/web/src/lib/email/property-alert-email.ts`
- Modify: `apps/web/src/lib/email.ts`
- Test: `apps/web/src/__tests__/lib/property-alert-email.test.ts` — extend
- Test: `apps/web/src/__tests__/lib/email.test.ts` — extend (the `buildHeadingBodyHtml` describe block already exists)

- [ ] **Step 1: Write the failing test for `property-alert-email.ts`**

Add to `apps/web/src/__tests__/lib/property-alert-email.test.ts`:

```ts
it("escapes HTML in the user's name and property address/city", async () => {
  await sendPropertyAlertEmail(
    "buyer@example.com",
    '<img src=x onerror=alert(1)>',
    [{ address: "<b>123 Main</b>", city: "<i>LA</i>", listPrice: 500000, mlsNumber: "M1", photoUrl: null }],
    "user1"
  );

  const call = vi.mocked(sendEmail).mock.calls[0][0];
  expect(call.html).not.toContain("<img src=x onerror=alert(1)>");
  expect(call.html).not.toContain("<b>123 Main</b>");
  expect(call.html).not.toContain("<i>LA</i>");
});
```

Match this test's exact mock setup (`sendEmail` mock, imports) to whatever this file's existing tests already use — read the file first.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/property-alert-email.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the fix**

In `apps/web/src/lib/email/property-alert-email.ts`, add an `escapeHtml` import (check `lib/email.ts` for the exact export, it's `escapeHtml`) and wrap the three interpolations:

```ts
import { escapeHtml } from "@/lib/email";
```

Change:

```ts
      return `
        <tr>
          <td style="padding:16px 0;border-bottom:1px solid #eee;">
            ${photoHtml}
            <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1B1B1B;">${p.address}</p>
            <p style="margin:0 0 4px;font-size:13px;color:#666;">${p.city}</p>
```

to:

```ts
      return `
        <tr>
          <td style="padding:16px 0;border-bottom:1px solid #eee;">
            ${photoHtml}
            <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1B1B1B;">${escapeHtml(p.address)}</p>
            <p style="margin:0 0 4px;font-size:13px;color:#666;">${escapeHtml(p.city)}</p>
```

And change:

```ts
              <p style="margin:0 0 20px;font-size:22.5px;line-height:1.6;color:#4b4b4b;text-align:center;">Hi ${userName},</p>
```

to:

```ts
              <p style="margin:0 0 20px;font-size:22.5px;line-height:1.6;color:#4b4b4b;text-align:center;">Hi ${escapeHtml(userName)},</p>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/property-alert-email.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `buildHeadingBodyHtml`'s heading param**

Add to the existing `describe("buildHeadingBodyHtml", ...)` block in `apps/web/src/__tests__/lib/email.test.ts`:

```ts
  it("escapes HTML in the heading, matching every other interpolation in this function", () => {
    const html = buildHeadingBodyHtml({ heading: '<img src=x onerror=alert(1)>', bodyHtml: "<p>x</p>" });
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/email.test.ts -t "escapes HTML in the heading"`
Expected: FAIL.

- [ ] **Step 7: Implement the fix**

In `apps/web/src/lib/email.ts`, find `buildHeadingBodyHtml` and change:

```ts
    <h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 24px; text-align: center;">
      ${opts.heading}
    </h2>
```

to:

```ts
    <h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 24px; text-align: center;">
      ${escapeHtml(opts.heading)}
    </h2>
```

`escapeHtml` is already defined in this same file, no new import needed.

- [ ] **Step 8: Run test to verify it passes, then run the whole file**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/email.test.ts`
Expected: ALL tests in this file still pass — every existing caller of `buildHeadingBodyHtml` passes a heading that's either a static string with no HTML-special characters, or already-escaped content (e.g. campaign send already does `escapeHtml(heading)` before calling this function in the campaign-deliveries cron), so double-escaping risk is low, but check every existing passing test still passes to be sure nothing relied on unescaped output.

- [ ] **Step 9: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/email/property-alert-email.ts apps/web/src/lib/email.ts apps/web/src/__tests__/lib/property-alert-email.test.ts apps/web/src/__tests__/lib/email.test.ts
git commit -m "fix: escape remaining unescaped HTML interpolations in property-alert and buildHeadingBodyHtml"
```

---

### Task 7: Add missing Prisma indexes (LeadTask + 6 file-scoped models)

`LeadTask` has zero indexes despite being queried by `leadId` on every dashboard Tasks tab load and lead-detail Tasks tab load. Six file-scoped models (`FileTask`, `FileChecklistItem`, `FileDocument`, `FileParty`, `FileActivity`, `FileCondition`) have zero indexes despite every query filtering by `listingFileId`/`transactionFileId`.

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: a new migration under `packages/database/prisma/migrations/`

**Interfaces:** none — this is additive schema-only, no application code changes.

- [ ] **Step 1: Add indexes to `LeadTask`**

In `packages/database/prisma/schema.prisma`, find the `LeadTask` model:

```prisma
model LeadTask {
  id          String    @id @default(cuid())
  leadId      String
  title       String
  taskType    String    @default("FOLLOW_UP")
  assigneeId  String?
  dueDate     DateTime?
  notes       String?
  done        Boolean   @default(false)
  completedAt DateTime?
  createdAt   DateTime  @default(now())

  lead     Lead   @relation(fields: [leadId],     references: [id], onDelete: Cascade)
  assignee Agent? @relation("TaskAssignee", fields: [assigneeId], references: [id])
}
```

Add two `@@index` lines before the closing brace, matching the dashboard Tasks tab's actual sort (`[{done},{dueDate},{createdAt}]`):

```prisma
model LeadTask {
  id          String    @id @default(cuid())
  leadId      String
  title       String
  taskType    String    @default("FOLLOW_UP")
  assigneeId  String?
  dueDate     DateTime?
  notes       String?
  done        Boolean   @default(false)
  completedAt DateTime?
  createdAt   DateTime  @default(now())

  lead     Lead   @relation(fields: [leadId],     references: [id], onDelete: Cascade)
  assignee Agent? @relation("TaskAssignee", fields: [assigneeId], references: [id])

  @@index([leadId])
  @@index([done, dueDate])
}
```

- [ ] **Step 2: Add indexes to the 6 file-scoped models**

`FileTask`:

```prisma
model FileTask {
  id                String    @id @default(cuid())
  fileType          FileType
  listingFileId     String?
  transactionFileId String?
  title             String
  dueDate           DateTime?
  assigneeName      String?
  done              Boolean   @default(false)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  listingFile     ListingFile?     @relation(fields: [listingFileId], references: [id], onDelete: Cascade)
  transactionFile TransactionFile? @relation(fields: [transactionFileId], references: [id], onDelete: Cascade)

  @@index([listingFileId])
  @@index([transactionFileId])
}
```

`FileCondition` (only has `transactionFileId`, not `listingFileId`):

```prisma
model FileCondition {
  id                String   @id @default(cuid())
  transactionFileId String
  name              String
  dueDate           DateTime?
  notes             String?
  createdAt         DateTime @default(now())

  transactionFile TransactionFile @relation(fields: [transactionFileId], references: [id], onDelete: Cascade)

  @@index([transactionFileId])
}
```

`FileChecklistItem`:

```prisma
model FileChecklistItem {
  id                String   @id @default(cuid())
  fileType          FileType
  listingFileId     String?
  transactionFileId String?
  name              String
  description       String?
  order             Int
  isRequired        Boolean  @default(true)

  listingFile     ListingFile?     @relation(fields: [listingFileId], references: [id], onDelete: Cascade)
  transactionFile TransactionFile? @relation(fields: [transactionFileId], references: [id], onDelete: Cascade)
  documents       FileDocument[]

  @@index([listingFileId])
  @@index([transactionFileId])
}
```

`FileDocument` (add `@@index` lines after its existing relation lines, before the closing brace — keep every existing field/relation line unchanged):

```prisma
  @@index([listingFileId])
  @@index([transactionFileId])
}
```

`FileParty` (same — add after its relation lines):

```prisma
  @@index([listingFileId])
  @@index([transactionFileId])
}
```

`FileActivity` (same — add after its relation lines):

```prisma
  @@index([listingFileId])
  @@index([transactionFileId])
}
```

- [ ] **Step 3: Generate and apply the migration**

```bash
pnpm --filter @cnc/database exec prisma migrate dev --name add_missing_indexes_leadtask_and_file_tables
```

If this fails with `EPERM`/DLL-lock (a known Windows issue when the dev server is running and holding `query_engine-windows.dll.node`), stop the dev server first, retry, then restart the dev server afterward.

- [ ] **Step 4: Verify the migration applied cleanly and existing queries still return correct results**

```bash
pnpm --filter web exec vitest run
```

Every existing test touching `LeadTask`, `FileTask`, `FileChecklistItem`, `FileDocument`, `FileParty`, `FileActivity`, or `FileCondition` must still pass unchanged — indexes are additive and never change query results, only query speed. If any of these tests fail, something else broke (unrelated to indexes) — investigate before proceeding, don't assume it's fine.

- [ ] **Step 5: Run tsc**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: clean (schema-only change, generated Prisma client types don't change from adding an index).

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "perf: add missing indexes on LeadTask and 6 file-scoped models"
```

---

### Task 8: Add a `take` cap to GET /api/deals

When an ADMIN loads the Pipeline tab with no `pipeline`/`leadId` filter, the query is fully unbounded brokerage-wide.

**Files:**
- Modify: `apps/web/src/app/api/deals/route.ts`
- Test: `apps/web/src/__tests__/api/deals.test.ts` — extend if exists, else create

- [ ] **Step 1: Check existing test coverage**

Run: `ls apps/web/src/__tests__/api/ | grep "^deals"`

- [ ] **Step 2: Write the failing test**

Add (or create the file with, matching the mocking pattern from `apps/web/src/__tests__/api/deals-convert.test.ts` seen in this codebase — `vi.mock("@/lib/api-auth", ...)` since this route uses `requireAuth`):

```ts
it("caps GET results at 500 even for ADMIN with no filters", async () => {
  vi.mocked(requireAuth).mockResolvedValue({ session: { user: { role: "ADMIN", agentId: null } }, error: null } as any);
  vi.mocked(prisma.deal.findMany).mockResolvedValue([]);

  await GET(new Request("http://localhost/api/deals"));

  expect(prisma.deal.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ take: 500 })
  );
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/deals.test.ts`
Expected: FAIL — `take` is not currently passed at all.

- [ ] **Step 4: Implement the fix**

In `apps/web/src/app/api/deals/route.ts`, change:

```ts
  const deals = await prisma.deal.findMany({
    where,
    include: { lead: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
  });
```

to:

```ts
  const deals = await prisma.deal.findMany({
    where,
    include: { lead: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/deals.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/deals/route.ts apps/web/src/__tests__/api/deals.test.ts
git commit -m "perf: cap GET /api/deals at 500 rows"
```

---

### Task 9: Fix action-plans cron — take cap + unconditional unbounded fallback

Two problems in `apps/web/src/app/api/cron/action-plans/route.ts`: (a) the due-steps query has no `take` cap, unlike the sibling campaign-deliveries cron's `take: 500`; (b) when zero steps are due (the common case on an hourly run), the completed-enrollment check falls back to `{ status: "ACTIVE" }` with no `id` filter, unconditionally fetching every active enrollment brokerage-wide with a `steps` include, on every single invocation — even though an enrollment can only have just become "complete" if one of its steps was processed *this run*. When `dueSteps` is empty, nothing changed, so nothing could have just completed, and the whole fallback query is pure waste.

**Files:**
- Modify: `apps/web/src/app/api/cron/action-plans/route.ts`
- Test: `apps/web/src/__tests__/api/cron-action-plans.test.ts` — extend

**Interfaces:** none new — this only changes query shape/bounds, not the function's external behavior for any case where `dueSteps` is non-empty.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/__tests__/api/cron-action-plans.test.ts` (read the file first for its exact existing mock setup and adjust accordingly):

```ts
it("caps the due-steps query at 500", async () => {
  vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([]);
  vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);

  await POST(makeAuthorizedRequest()); // use this file's existing helper for a valid authorized POST

  expect(prisma.leadPlanStep.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ take: 500 })
  );
});

it("does not query leadPlanEnrollment at all when no steps are due", async () => {
  vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([]);

  await POST(makeAuthorizedRequest());

  expect(prisma.leadPlanEnrollment.findMany).not.toHaveBeenCalled();
});

it("still checks for completed enrollments when steps WERE processed this run", async () => {
  vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([
    {
      id: "step1", enrollmentId: "enr1", stepType: "TASK", taskTitle: "Follow up", dueAt: new Date(),
      enrollment: {
        id: "enr1", agentId: "a1",
        lead: { id: "lead1", firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
        agent: { id: "a1", displayName: "Agent", phone: null, monthlyEmailLimit: 200, user: { email: "agent@example.com" } },
      },
    },
  ] as any);
  vi.mocked(prisma.leadTask.create).mockResolvedValue({} as any);
  vi.mocked(prisma.leadPlanStep.update).mockResolvedValue({} as any);
  vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);

  await POST(makeAuthorizedRequest());

  expect(prisma.leadPlanEnrollment.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: { in: ["enr1"] }, status: "ACTIVE" } })
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web exec vitest run src/__tests__/api/cron-action-plans.test.ts`
Expected: FAIL on the `take: 500` test (no `take` passed currently) and the "does not query... when no steps are due" test (currently it DOES query, unconditionally).

- [ ] **Step 3: Implement the fix**

In `apps/web/src/app/api/cron/action-plans/route.ts`:

Change:

```ts
  const dueSteps = await prisma.leadPlanStep.findMany({
    where: {
      status: "PENDING",
      dueAt: { lte: now },
      enrollment: { status: "ACTIVE" },
    },
    include: {
      enrollment: {
        include: {
          lead: { select: { id: true, firstName: true, lastName: true, email: true } },
          agent: {
            select: { id: true, displayName: true, phone: true, monthlyEmailLimit: true, user: { select: { email: true } } },
          },
        },
      },
    },
    orderBy: { dueAt: "asc" },
  });
```

to:

```ts
  const dueSteps = await prisma.leadPlanStep.findMany({
    where: {
      status: "PENDING",
      dueAt: { lte: now },
      enrollment: { status: "ACTIVE" },
    },
    include: {
      enrollment: {
        include: {
          lead: { select: { id: true, firstName: true, lastName: true, email: true } },
          agent: {
            select: { id: true, displayName: true, phone: true, monthlyEmailLimit: true, user: { select: { email: true } } },
          },
        },
      },
    },
    orderBy: { dueAt: "asc" },
    take: 500,
  });
```

Change the completed-enrollments block from:

```ts
  // Check for newly-completed enrollments (always run, not just when steps were processed)
  const enrollmentIds = Array.from(new Set(dueSteps.map((s) => s.enrollmentId)));
  const enrollmentWhere: Prisma.LeadPlanEnrollmentWhereInput =
    enrollmentIds.length > 0
      ? { id: { in: enrollmentIds }, status: "ACTIVE" }
      : { status: "ACTIVE" };
  const enrollments = await prisma.leadPlanEnrollment.findMany({
    where: enrollmentWhere,
    include: { steps: { select: { status: true } } },
  });
  const completedEnrollments = enrollments.filter(
    (enr) => enr.steps.length > 0 && enr.steps.every((s) => s.status === "DONE" || s.status === "SKIPPED")
  );
  await Promise.all(
    completedEnrollments.map((enr) =>
      prisma.leadPlanEnrollment.update({
        where: { id: enr.id },
        data: { status: "COMPLETED", completedAt: now },
      })
    )
  );
```

to:

```ts
  // Check for newly-completed enrollments — only ever possible for
  // enrollments whose step was just processed this run. When dueSteps is
  // empty (the common case on an hourly cron), nothing changed, so nothing
  // could have just transitioned to complete, and this whole check is
  // skipped rather than scanning every active enrollment brokerage-wide.
  const enrollmentIds = Array.from(new Set(dueSteps.map((s) => s.enrollmentId)));
  if (enrollmentIds.length > 0) {
    const enrollments = await prisma.leadPlanEnrollment.findMany({
      where: { id: { in: enrollmentIds }, status: "ACTIVE" },
      include: { steps: { select: { status: true } } },
    });
    const completedEnrollments = enrollments.filter(
      (enr) => enr.steps.length > 0 && enr.steps.every((s) => s.status === "DONE" || s.status === "SKIPPED")
    );
    await Promise.all(
      completedEnrollments.map((enr) =>
        prisma.leadPlanEnrollment.update({
          where: { id: enr.id },
          data: { status: "COMPLETED", completedAt: now },
        })
      )
    );
  }
```

Remove the now-unused `import type { Prisma } from "@cnc/database";` line at the top of the file (it was only used for the `Prisma.LeadPlanEnrollmentWhereInput` type annotation, which no longer exists).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/__tests__/api/cron-action-plans.test.ts`
Expected: PASS, all tests including the pre-existing ones.

- [ ] **Step 5: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green — confirm the removed `Prisma` import doesn't leave a dangling unused-import error, and that no other test in this file depended on the enrollment query running unconditionally.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/cron/action-plans/route.ts apps/web/src/__tests__/api/cron-action-plans.test.ts
git commit -m "perf: cap action-plans due-steps query, skip enrollment scan when nothing was processed"
```

---

### Task 10: Migrate Settings page onto react-query + fix duplicated digitsOnly logic

The Settings page has two uncached `useEffect+fetch` calls with no `AbortController` (never migrated onto the pattern Transactions/Tasks/Pipeline got in 2026-07-24/25), and separately hand-rolls `digitsOnly()`'s logic four times instead of importing it. Both fixes touch the same file — bundled into one task.

**Files:**
- Modify: `apps/web/src/lib/dashboard-queries.ts`
- Modify: `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`
- Test: `apps/web/src/__tests__/lib/dashboard-queries.test.ts` — extend if exists, else create

**Interfaces:**
- Produces: `fetchAccountProfile(): Promise<{ licenseNum?: string; location?: string; language?: string }>` and `fetchAgentProfile(): Promise<{ bio?: string; yearsExp?: number; listingsClosed?: number; volumeClosed?: number; propertiesRented?: number; instagram?: string; facebook?: string; headshot?: string | null; slug?: string }>` exported from `lib/dashboard-queries.ts`.

- [ ] **Step 1: Check for an existing dashboard-queries test file**

Run: `ls apps/web/src/__tests__/lib/ | grep dashboard-queries`

- [ ] **Step 2: Write the failing test**

Add to `apps/web/src/__tests__/lib/dashboard-queries.test.ts` (create it if it doesn't exist, matching the plain-fetch-mock style already used by this file's sibling functions like `fetchDeals`):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAccountProfile, fetchAgentProfile } from "@/lib/dashboard-queries";

describe("fetchAccountProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches /api/account/profile and returns the parsed body", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ licenseNum: "123" }) });
    const result = await fetchAccountProfile();
    expect(fetch).toHaveBeenCalledWith("/api/account/profile", expect.objectContaining({ signal: expect.anything() }));
    expect(result).toEqual({ licenseNum: "123" });
  });

  it("returns an empty object when the response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const result = await fetchAccountProfile();
    expect(result).toEqual({});
  });
});

describe("fetchAgentProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches /api/account/agent-profile and returns the parsed body", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bio: "Hello" }) });
    const result = await fetchAgentProfile();
    expect(fetch).toHaveBeenCalledWith("/api/account/agent-profile", expect.objectContaining({ signal: expect.anything() }));
    expect(result).toEqual({ bio: "Hello" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/dashboard-queries.test.ts`
Expected: FAIL — the two functions don't exist yet.

- [ ] **Step 4: Implement the two fetch functions in `dashboard-queries.ts`**

Add to the end of `apps/web/src/lib/dashboard-queries.ts`:

```ts
export async function fetchAccountProfile(signal?: AbortSignal): Promise<Record<string, unknown>> {
  const res = await fetch("/api/account/profile", { signal });
  if (!res.ok) return {};
  return res.json();
}

export async function fetchAgentProfile(signal?: AbortSignal): Promise<Record<string, unknown>> {
  const res = await fetch("/api/account/agent-profile", { signal });
  if (!res.ok) return {};
  return res.json();
}
```

Note: the test above asserts `fetch` was called with `{ signal: expect.anything() }` — react-query's `useQuery` passes an `AbortSignal` to the query function automatically via its second argument (`{ signal }`), so the page component will call these as `queryFn: ({ signal }) => fetchAccountProfile(signal)`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/dashboard-queries.test.ts`
Expected: PASS.

- [ ] **Step 6: Migrate `settings/page.tsx` to use react-query for the two GET calls, and fix the digitsOnly duplication**

Read the current full file first (`apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`) to confirm nothing changed since this plan was written. Then:

Add imports at the top:

```tsx
import { useQuery } from "@tanstack/react-query";
import { fetchAccountProfile, fetchAgentProfile } from "@/lib/dashboard-queries";
import { digitsOnly } from "@/lib/form-validation";
```

Replace the two `useEffect` blocks:

```tsx
  // Load license number
  useEffect(() => {
    fetch("/api/account/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.licenseNum) setLicenseInput(d.licenseNum);
        if (d?.location) setLocationInput(d.location);
        if (d?.language) setLanguageInput(d.language);
      })
      .catch(() => {});
  }, []);

  // Load agent profile on mount
  useEffect(() => {
    fetch("/api/account/agent-profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setAgentProfile({
          bio: d.bio ?? "",
          yearsExp: d.yearsExp?.toString() ?? "",
          listingsClosed: d.listingsClosed > 0 ? d.listingsClosed.toString() : "",
          volumeClosed: d.volumeClosed > 0 ? Math.round(d.volumeClosed).toLocaleString("en-US") : "",
          propertiesRented: d.propertiesRented != null && d.propertiesRented > 0 ? d.propertiesRented.toString() : "",
          instagram: d.instagram ?? "",
          facebook: d.facebook ?? "",
          headshot: d.headshot ?? null,
        });
        if (d.headshot) setHeadshotKey(Date.now().toString());
        if (d.slug) setAgentSlug(d.slug);
      })
      .catch(() => {});
  }, []);
```

with:

```tsx
  const { data: accountProfile } = useQuery({
    queryKey: ["account", "profile"],
    queryFn: ({ signal }) => fetchAccountProfile(signal),
  });

  useEffect(() => {
    if (!accountProfile) return;
    if (accountProfile.licenseNum) setLicenseInput(accountProfile.licenseNum as string);
    if (accountProfile.location) setLocationInput(accountProfile.location as string);
    if (accountProfile.language) setLanguageInput(accountProfile.language as string);
  }, [accountProfile]);

  const { data: fetchedAgentProfile } = useQuery({
    queryKey: ["account", "agent-profile"],
    queryFn: ({ signal }) => fetchAgentProfile(signal),
  });

  useEffect(() => {
    const d = fetchedAgentProfile as any;
    if (!d) return;
    setAgentProfile({
      bio: d.bio ?? "",
      yearsExp: d.yearsExp?.toString() ?? "",
      listingsClosed: d.listingsClosed > 0 ? d.listingsClosed.toString() : "",
      volumeClosed: d.volumeClosed > 0 ? Math.round(d.volumeClosed).toLocaleString("en-US") : "",
      propertiesRented: d.propertiesRented != null && d.propertiesRented > 0 ? d.propertiesRented.toString() : "",
      instagram: d.instagram ?? "",
      facebook: d.facebook ?? "",
      headshot: d.headshot ?? null,
    });
    if (d.headshot) setHeadshotKey(Date.now().toString());
    if (d.slug) setAgentSlug(d.slug);
  }, [fetchedAgentProfile]);
```

This preserves the exact same effective behavior (state is set once data arrives) while getting react-query's caching (revisiting the Settings tab after the first load reuses cached data instead of re-fetching) and built-in `AbortSignal` wiring.

Now fix the 4 hand-rolled digit-stripping calls. Change each of these 4 lines:

```tsx
                  onChange={(e) => setAgentProfile((prev) => ({ ...prev, yearsExp: e.target.value.replace(/\D/g, "") }))}
```
```tsx
                  onChange={(e) => setAgentProfile((prev) => ({ ...prev, listingsClosed: e.target.value.replace(/\D/g, "") }))}
```
```tsx
                  onChange={(e) => setAgentProfile((prev) => ({ ...prev, propertiesRented: e.target.value.replace(/\D/g, "") }))}
```

to use `digitsOnly` (no length cap needed here since these are plain counters, not phone/license fields — pass a generous max like 9 to satisfy the function's required second argument without changing real-world behavior):

```tsx
                  onChange={(e) => setAgentProfile((prev) => ({ ...prev, yearsExp: digitsOnly(e.target.value, 3) }))}
```
```tsx
                  onChange={(e) => setAgentProfile((prev) => ({ ...prev, listingsClosed: digitsOnly(e.target.value, 5) }))}
```
```tsx
                  onChange={(e) => setAgentProfile((prev) => ({ ...prev, propertiesRented: digitsOnly(e.target.value, 5) }))}
```

The 4th one (Volume Closed) does digit-stripping AND comma-formatting in one handler — leave the comma-formatting logic as-is, just replace its inner digit-stripping:

```tsx
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                    setAgentProfile((prev) => ({ ...prev, volumeClosed: formatted }));
                  }}
```

to:

```tsx
                  onChange={(e) => {
                    const digits = digitsOnly(e.target.value, 12);
                    const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                    setAgentProfile((prev) => ({ ...prev, volumeClosed: formatted }));
                  }}
```

- [ ] **Step 7: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green.

- [ ] **Step 8: Manual check**

If a dev server is available, open `/dashboard/settings`, confirm the license/location/language/agent-profile fields still populate on load, confirm typing non-digit characters into Years of Experience / Listings Closed / Volume Closed / Properties Rented is still blocked exactly as before. State plainly in the report whether this was actually performed.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/dashboard-queries.ts "apps/web/src/app/(dashboard)/dashboard/settings/page.tsx" apps/web/src/__tests__/lib/dashboard-queries.test.ts
git commit -m "perf: cache Settings page reads via react-query, fix duplicated digit-stripping"
```

---

### Task 11: Minor performance fixes (batch)

Four small, independent fixes.

**Files:**
- Modify: `apps/web/src/app/api/leads/[id]/homes/route.ts`
- Modify: `apps/web/src/app/api/campaigns/[id]/contacts/route.ts`
- Modify: `apps/web/src/components/leads/HomesTab.tsx`
- Modify: `apps/web/src/components/leads/TagPicker.tsx`
- Test: `apps/web/src/__tests__/api/leads-id-homes.test.ts` — extend if exists, else create
- Test: `apps/web/src/__tests__/api/campaigns-id-contacts.test.ts` — extend if exists, else create

- [ ] **Step 1: Fix the duplicate lead lookup in `leads/[id]/homes/route.ts`**

Check for an existing test file first: `ls apps/web/src/__tests__/api/ | grep "leads-id-homes\|leads.*homes"`. If none exists, write a minimal test proving the fix (one `findUnique` call, not two):

```ts
it("looks up the lead in a single query, not two", async () => {
  vi.mocked(requireAuth).mockResolvedValue({ session: { user: { role: "AGENT", agentId: "a1" } }, error: null } as any);
  vi.mocked(prisma.lead.findUnique).mockResolvedValue({ agentId: "a1", email: null } as any);

  await GET(new Request("http://localhost"), { params: { id: "lead1" } });

  expect(prisma.lead.findUnique).toHaveBeenCalledTimes(1);
});
```

Run it (`pnpm --filter web exec vitest run src/__tests__/api/leads-id-homes.test.ts`), expect FAIL (currently 2 calls).

Implement: change

```ts
  const existingLead = await prisma.lead.findUnique({ where: { id: params.id }, select: { agentId: true } });
  const { exists, forbidden } = checkOwnership(existingLead, session.user.agentId, session.user.role);
  if (!exists || forbidden) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lead = await prisma.lead.findUnique({ where: { id: params.id }, select: { email: true } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!lead.email) return NextResponse.json({ saved: [], viewed: [] });
```

to:

```ts
  const lead = await prisma.lead.findUnique({ where: { id: params.id }, select: { agentId: true, email: true } });
  const { exists, forbidden } = checkOwnership(lead, session.user.agentId, session.user.role);
  if (!exists || forbidden) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!lead!.email) return NextResponse.json({ saved: [], viewed: [] });
```

Note `lead!` is safe here — `checkOwnership`'s `exists: true` branch only happens when `record` (here `lead`) is non-null. Run the test again, expect PASS. Then run the full pre-existing test file for this route (if one exists covering the happy path) to confirm no regression.

- [ ] **Step 2: Fix the full-row fetch in `campaigns/[id]/contacts/route.ts`**

Check for an existing test file: `ls apps/web/src/__tests__/api/ | grep "campaigns-id-contacts\|campaigns.*contacts"`. Add/write a test confirming a `select` is used:

```ts
it("selects only id and agentId to check ownership, not the full campaign row", async () => {
  vi.mocked(requireAuth).mockResolvedValue({ session: { user: { role: "AGENT", agentId: "a1" } }, error: null } as any);
  vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a1" } as any);
  vi.mocked(prisma.$transaction).mockResolvedValue([]);

  await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ leadIds: ["l1"] }) }), { params: { id: "c1" } });

  expect(prisma.campaign.findUnique).toHaveBeenCalledWith({
    where: { id: "c1" },
    select: { id: true, agentId: true },
  });
});
```

Run it, expect FAIL (currently no `select`, fetches the whole row). Implement: change

```ts
  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
```

to:

```ts
  const campaign = await prisma.campaign.findUnique({ where: { id: params.id }, select: { id: true, agentId: true } });
```

matching the sibling `send`/`start-now`/`[id]` routes in the same directory. Run the test again, expect PASS.

- [ ] **Step 3: Add AbortController to `HomesTab.tsx`**

This component has no automated tests (matches this project's established convention of no React-component-render tests). Change:

```tsx
  useEffect(() => {
    fetch(`/api/leads/${leadId}/homes`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ saved: [], viewed: [] }));
  }, [leadId]);
```

to:

```tsx
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/leads/${leadId}/homes`, { signal: controller.signal })
      .then((r) => r.json())
      .then(setData)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setData({ saved: [], viewed: [] });
      });
    return () => controller.abort();
  }, [leadId]);
```

- [ ] **Step 4: Add AbortController to `TagPicker.tsx`**

Change:

```tsx
  useEffect(() => {
    fetch("/api/admin/tags")
      .then((r) => r.json())
      .then((data) => setAllTags(Array.isArray(data) ? data : []));
  }, []);
```

to:

```tsx
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/tags", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setAllTags(Array.isArray(data) ? data : []))
      .catch((e: Error) => { if (e.name !== "AbortError") throw e; });
    return () => controller.abort();
  }, []);
```

- [ ] **Step 5: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/api/leads/[id]/homes/route.ts" "apps/web/src/app/api/campaigns/[id]/contacts/route.ts" apps/web/src/components/leads/HomesTab.tsx apps/web/src/components/leads/TagPicker.tsx apps/web/src/__tests__/api/leads-id-homes.test.ts apps/web/src/__tests__/api/campaigns-id-contacts.test.ts
git commit -m "perf: dedupe lead lookup, narrow campaign select, add AbortController to HomesTab/TagPicker"
```

---

### Task 12: Fix NewLeadModal duplicating shared validators

`NewLeadModal.tsx` hand-rolls `formatPhoneInput()` and `isValidEmail()` byte-for-byte instead of importing both from `lib/form-validation.ts`.

**Files:**
- Modify: `apps/web/src/components/leads/NewLeadModal.tsx`

This component has no automated tests (no React-component-render test infrastructure in this project). This is a pure, behavior-preserving refactor — confirmed by direct comparison that `formatPhoneInput()` and `isValidEmail()` are character-for-character identical to the inline logic being replaced.

- [ ] **Step 1: Add the import**

At the top of `apps/web/src/components/leads/NewLeadModal.tsx`, add:

```tsx
import { formatPhoneInput, isValidEmail } from "@/lib/form-validation";
```

- [ ] **Step 2: Delete the hand-rolled `handlePhoneChange` body, replace with the shared function**

Change:

```tsx
  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    const formatted =
      digits.length <= 3 ? digits :
      digits.length <= 6 ? `${digits.slice(0, 3)}-${digits.slice(3)}` :
      `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    setForm((f) => ({ ...f, phone: formatted }));
  }
```

to:

```tsx
  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, phone: formatPhoneInput(e.target.value) }));
  }
```

- [ ] **Step 3: Replace the inline email regex with `isValidEmail`**

Change:

```tsx
    const email = form.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
```

to:

```tsx
    const email = form.email.trim();
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
```

- [ ] **Step 4: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green (no test exercises this component directly, so this step confirms nothing ELSE broke).

- [ ] **Step 5: Manual check**

If a dev server is available, open the New Lead modal (dashboard Leads tab), type a phone number and confirm it still auto-formats as `XXX-XXX-XXXX`, type an invalid email and confirm the same error message appears. State plainly in the report whether this was actually performed.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/leads/NewLeadModal.tsx
git commit -m "refactor: NewLeadModal imports shared formatPhoneInput/isValidEmail instead of reimplementing"
```

---

### Task 13: Merge ContactModal and ManageContactModal, hoist ROLE_OPTIONS

`ContactModal.tsx` and `ManageContactModal.tsx` are byte-for-byte identical except the prop name (`source` vs `cardTitle`) and one line computing the source string. `ROLE_OPTIONS` is duplicated a third time in `contact/page.tsx`.

**Files:**
- Modify: `apps/web/src/components/ui/ContactModal.tsx` — export `ROLE_OPTIONS`
- Delete: `apps/web/src/components/manage/ManageContactModal.tsx`
- Modify: `apps/web/src/components/manage/ManageHandle.tsx` — use `ContactModal` instead
- Modify: `apps/web/src/app/(marketing)/contact/page.tsx` — import `ROLE_OPTIONS` instead of declaring its own

None of these three components have automated render tests (confirmed, matches this project's convention). Verification is tsc + full suite + a stated live visual check.

- [ ] **Step 1: Export `ROLE_OPTIONS` from `ContactModal.tsx`**

In `apps/web/src/components/ui/ContactModal.tsx`, change:

```tsx
const ROLE_OPTIONS = [
  "Agent",
  "Buyer",
  "Seller",
  "Owner",
  "Renter",
  "Landlord",
  "Property Manager",
];
```

to:

```tsx
export const ROLE_OPTIONS = [
  "Agent",
  "Buyer",
  "Seller",
  "Owner",
  "Renter",
  "Landlord",
  "Property Manager",
];
```

Everything else in `ContactModal.tsx` is unchanged — it already accepts `source: string` as a prop, which is exactly what's needed.

- [ ] **Step 2: Update `ManageHandle.tsx` to use `ContactModal` directly**

In `apps/web/src/components/manage/ManageHandle.tsx`, change the import:

```tsx
import { ManageContactModal } from "./ManageContactModal";
```

to:

```tsx
import { ContactModal } from "@/components/ui/ContactModal";
```

Find the render call:

```tsx
      <ManageContactModal
        open={modalOpen}
        cardTitle={activeCard}
        onClose={() => setModalOpen(false)}
      />
```

Replace with (moving the `"MANAGE_" + ...` computation here, exactly matching what `ManageContactModal` used to compute internally):

```tsx
      <ContactModal
        open={modalOpen}
        source={"MANAGE_" + activeCard.toUpperCase().replace(/\s+/g, "_")}
        onClose={() => setModalOpen(false)}
      />
```

Confirm `activeCard` is a `string` state variable already in scope in this file (it is — it's what was passed as `cardTitle` before).

- [ ] **Step 3: Delete `ManageContactModal.tsx`**

First re-verify it has no other importers:

```bash
grep -rn "ManageContactModal" apps/web/src --include="*.tsx"
```

Expected: only the definition file itself should remain after Step 2 — no other importers. If anything else still imports it, stop and investigate before deleting.

```bash
rm "apps/web/src/components/manage/ManageContactModal.tsx"
```

- [ ] **Step 4: Update `contact/page.tsx` to import the shared `ROLE_OPTIONS`**

In `apps/web/src/app/(marketing)/contact/page.tsx`, change:

```tsx
const ROLE_OPTIONS = [
  "Agent",
  "Buyer",
  "Seller",
  "Owner",
  "Renter",
  "Landlord",
  "Property Manager",
];
```

to an import alongside this file's other imports:

```tsx
import { ROLE_OPTIONS } from "@/components/ui/ContactModal";
```

(removing the local array declaration entirely).

- [ ] **Step 5: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green — confirm no test imported `ManageContactModal` directly (if one did, it would now fail to resolve — fix by pointing it at `ContactModal` instead, or removing it if it becomes redundant with a `ContactModal` test).

- [ ] **Step 6: Manual visual check — mandatory for this task given zero automated render coverage**

If a dev server is available: open `/contact` and confirm the form still renders and submits correctly; open `/manage`, scroll to the services section, click "Learn More" on any card, confirm the contact modal still opens with the same look, and submit it, then check that the created lead's `source` field is still `MANAGE_<CARD_TITLE>` (e.g. via `/dashboard/leads` or Prisma Studio). If a dev server is not available in this environment, state that explicitly in the task report rather than claiming this was checked — do not claim visual verification that didn't happen.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ui/ContactModal.tsx apps/web/src/components/manage/ManageHandle.tsx "apps/web/src/app/(marketing)/contact/page.tsx"
git rm apps/web/src/components/manage/ManageContactModal.tsx
git commit -m "refactor: merge ManageContactModal into ContactModal, hoist ROLE_OPTIONS"
```

---

### Task 14: Extract shared checklist-items-with-documents include shape

The Prisma include shape `checklistItems: { include: { documents: true } }` is independently written in 6 places across 5 files.

**Files:**
- Modify: `apps/web/src/lib/transaction-helpers.ts`
- Modify: `apps/web/src/app/api/admin/files/[fileType]/[id]/status/route.ts` (2 occurrences)
- Modify: `apps/web/src/app/api/listings/[id]/submit-review/route.ts`
- Modify: `apps/web/src/app/api/transactions/[id]/submit-review/route.ts`
- Modify: `apps/web/src/app/api/listings/route.ts`
- Modify: `apps/web/src/app/api/transactions/route.ts`

Pure syntactic extraction — must not change query results. No new tests needed; every existing test covering these 6 call sites is the regression guard.

- [ ] **Step 1: Add the shared constant to `transaction-helpers.ts`**

In `apps/web/src/lib/transaction-helpers.ts`, add near the existing `FILE_DETAIL_INCLUDE` constant:

```ts
// The lighter-weight sibling of FILE_DETAIL_INCLUDE.checklistItems, used by
// routes that only need checklist completion status (not the full file
// detail page's ordering) — independently written in 6 places before this,
// now the single source of truth for that shape.
export const CHECKLIST_ITEMS_WITH_DOCS_INCLUDE = { include: { documents: true } } as const;
```

- [ ] **Step 2: Update `admin/files/[fileType]/[id]/status/route.ts`**

Add the import, then replace both occurrences of `checklistItems: { include: { documents: true } }` with `checklistItems: CHECKLIST_ITEMS_WITH_DOCS_INCLUDE`.

- [ ] **Step 3: Update `listings/[id]/submit-review/route.ts`**

Add the import, change:

```ts
    include: { checklistItems: { include: { documents: true } }, agent: { include: { user: true } } },
```

to:

```ts
    include: { checklistItems: CHECKLIST_ITEMS_WITH_DOCS_INCLUDE, agent: { include: { user: true } } },
```

- [ ] **Step 4: Update `transactions/[id]/submit-review/route.ts`**

Same change as Step 3, in this file.

- [ ] **Step 5: Update `listings/route.ts`**

Add the import, change:

```ts
    include: { checklistItems: { include: { documents: true } } },
```

to:

```ts
    include: { checklistItems: CHECKLIST_ITEMS_WITH_DOCS_INCLUDE },
```

(the `findMany` at the top of the file only — leave the separate `checklistItems: template ? { create: ... } : undefined` write-path further down untouched, that's a different, unrelated shape).

- [ ] **Step 6: Update `transactions/route.ts`**

Same change as Step 5, in this file.

- [ ] **Step 7: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green — every existing test covering `submit-review`, `admin/files/.../status`, `listings`, and `transactions` GET/POST must still pass unchanged, since this is a pure syntactic substitution with an identical resulting query shape.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/transaction-helpers.ts \
  "apps/web/src/app/api/admin/files/[fileType]/[id]/status/route.ts" \
  "apps/web/src/app/api/listings/[id]/submit-review/route.ts" \
  "apps/web/src/app/api/transactions/[id]/submit-review/route.ts" \
  apps/web/src/app/api/listings/route.ts \
  apps/web/src/app/api/transactions/route.ts
git commit -m "refactor: extract CHECKLIST_ITEMS_WITH_DOCS_INCLUDE, dedupe 6 call sites"
```

---

### Task 15: Consolidate file-tasks ownership check onto the shared helper

`file-tasks/[taskId]/route.ts`'s `assertTaskAccess()` hand-rolls the same "resolve parent file, compare agentId, ADMIN bypass" logic that `getFileAndVerifyAccess()` (added in Task 1) now centralizes. `documents/[id]/route.ts`'s check is answering a genuinely different question (did *this specific agent* upload the document, not does the *file* belong to them) and is intentionally left as-is.

**Files:**
- Modify: `apps/web/src/app/api/file-tasks/[taskId]/route.ts`
- Test: `apps/web/src/__tests__/api/file-tasks-id.test.ts` — check for existing coverage first

This is a refactor of already-correct logic — must not change behavior, only consolidate it.

- [ ] **Step 1: Check for existing test coverage**

Run: `ls apps/web/src/__tests__/api/ | grep "file-tasks-id\|file-tasks.*taskId"`

If a test file exists covering `PATCH`/`DELETE` on this route, read it fully — it's the regression guard for this task. If none exists, write one before refactoring (characterization test, proving CURRENT behavior, so the refactor has something to prove against):

```ts
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fileTask: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PATCH, DELETE } from "../../app/api/file-tasks/[taskId]/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

describe("PATCH/DELETE /api/file-tasks/[taskId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PATCH: forbids a non-owning agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileTask.findUnique).mockResolvedValue({ id: "t1", fileType: "LISTING", listingFileId: "f1" } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ agentId: "a2" } as any);

    const req = new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ done: true }) });
    const res = await PATCH(req, { params: { taskId: "t1" } });
    expect(res.status).toBe(403);
  });

  it("PATCH: allows the owning agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileTask.findUnique).mockResolvedValue({ id: "t1", fileType: "LISTING", listingFileId: "f1" } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ agentId: "a1" } as any);
    vi.mocked(prisma.fileTask.update).mockResolvedValue({ id: "t1", done: true } as any);

    const req = new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ done: true }) });
    const res = await PATCH(req, { params: { taskId: "t1" } });
    expect(res.status).toBe(200);
  });

  it("PATCH: allows ADMIN regardless of owner", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u2", role: "ADMIN", agentId: null } } as any);
    vi.mocked(prisma.fileTask.findUnique).mockResolvedValue({ id: "t1", fileType: "TRANSACTION", transactionFileId: "tx1" } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ agentId: "a1" } as any);
    vi.mocked(prisma.fileTask.update).mockResolvedValue({ id: "t1" } as any);

    const req = new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ done: true }) });
    const res = await PATCH(req, { params: { taskId: "t1" } });
    expect(res.status).toBe(200);
  });

  it("DELETE: forbids a non-owning agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileTask.findUnique).mockResolvedValue({ id: "t1", fileType: "LISTING", listingFileId: "f1" } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ agentId: "a2" } as any);

    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params: { taskId: "t1" } });
    expect(res.status).toBe(403);
  });
});
```

Run this test against the CURRENT (unrefactored) code first: `pnpm --filter web exec vitest run src/__tests__/api/file-tasks-id.test.ts` — expected PASS (this is a characterization test of already-correct behavior, not a bug fix, so it should be green before you touch anything).

- [ ] **Step 2: Refactor `assertTaskAccess` to use the shared helper**

In `apps/web/src/app/api/file-tasks/[taskId]/route.ts`, add the import:

```ts
import { getFileAndVerifyAccess } from "@/lib/api-auth";
```

Replace:

```ts
async function assertTaskAccess(taskId: string, agentId: string | null, role: string) {
  const task = await prisma.fileTask.findUnique({ where: { id: taskId } });
  if (!task) return { error: "Not found", status: 404 } as const;

  if (role !== "ADMIN") {
    const parentAgentId = task.fileType === "LISTING"
      ? (await prisma.listingFile.findUnique({ where: { id: task.listingFileId! }, select: { agentId: true } }))?.agentId
      : (await prisma.transactionFile.findUnique({ where: { id: task.transactionFileId! }, select: { agentId: true } }))?.agentId;

    if (parentAgentId !== agentId) return { error: "Forbidden", status: 403 } as const;
  }

  return { task };
}
```

with:

```ts
async function assertTaskAccess(taskId: string, agentId: string | null, role: string) {
  const task = await prisma.fileTask.findUnique({ where: { id: taskId } });
  if (!task) return { error: "Not found", status: 404 } as const;

  const fileId = task.listingFileId ?? task.transactionFileId;
  const fileType: "listing" | "transaction" = task.fileType === "LISTING" ? "listing" : "transaction";
  if (!fileId) return { error: "Not found", status: 404 } as const;

  const file = await getFileAndVerifyAccess(fileType, fileId, agentId, role);
  if (!file) return { error: "Forbidden", status: 403 } as const;

  return { task };
}
```

This preserves the exact same behavior: ADMIN always passes (via `checkOwnership`'s own ADMIN bypass inside `getFileAndVerifyAccess`), agents are compared against the resolved parent's `agentId` the same way.

- [ ] **Step 3: Run the characterization test to verify it still passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/file-tasks-id.test.ts`
Expected: PASS, all 4 tests, unchanged from Step 1 — this proves the refactor didn't change behavior.

- [ ] **Step 4: Document why `documents/[id]/route.ts` is intentionally left untouched**

No code change needed here — just confirm the reasoning holds by re-reading the file: `doc.uploadedByAgentId !== session.user.id && session.user.role !== "ADMIN"` checks whether the CALLER personally uploaded this specific document, not whether the caller owns the parent file. Consolidating this onto `getFileAndVerifyAccess()` (file-ownership) would be a real behavior change — it would let any agent delete any document on their own files, not just ones they uploaded themselves — which is out of scope for a "consolidate duplicate logic, don't change behavior" task. Leave this file exactly as-is.

- [ ] **Step 5: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/api/file-tasks/[taskId]/route.ts" apps/web/src/__tests__/api/file-tasks-id.test.ts
git commit -m "refactor: consolidate file-tasks ownership check onto getFileAndVerifyAccess"
```

---

### Task 16: Minor duplication fix — LeadActionPlansSection pulse animation

`LeadActionPlansSection.tsx` hand-rolls the pulse-button animation instead of importing the shared constants it already imports a sibling constant from.

**Files:**
- Modify: `apps/web/src/components/leads/LeadActionPlansSection.tsx`

No automated tests exist for this component (confirmed, matches project convention) — pure visual/no-op-functional change, verified by tsc + full suite + a stated live check.

- [ ] **Step 1: Update the import**

Change:

```tsx
import { SPRING_HOVER } from "@/lib/motion";
```

to:

```tsx
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
```

- [ ] **Step 2: Replace the inline animation values**

Change:

```tsx
          <motion.button
            onClick={() => setShowPlanPicker(!showPlanPicker)}
            disabled={enrolling}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
            className="rounded-lg border border-[#9E8C61] bg-[#9E8C61] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
```

to:

```tsx
          <motion.button
            onClick={() => setShowPlanPicker(!showPlanPicker)}
            disabled={enrolling}
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
            className="rounded-lg border border-[#9E8C61] bg-[#9E8C61] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
```

(`PULSE_ANIMATE = { scale: [1, 1.04, 1] }` and `PULSE_TRANSITION = { duration: 2, repeat: Infinity, ease: "easeInOut" }` — confirmed identical to the values being replaced, verified directly against `lib/motion.ts`.)

- [ ] **Step 3: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/leads/LeadActionPlansSection.tsx
git commit -m "refactor: LeadActionPlansSection imports shared PULSE_ANIMATE/PULSE_TRANSITION"
```

---

### Task 17: Delete 6 confirmed-dead orphaned files

Zero references anywhere in the codebase, confirmed by the audit and explicitly superseded per this project's own history.

**Files:**
- Delete: `apps/web/src/components/ui/animated-tooltip.tsx`
- Delete: `apps/web/src/components/ui/bento-grid.tsx`
- Delete: `apps/web/src/components/ui/focus-cards.tsx`
- Delete: `apps/web/src/components/ui/shimmer-button.tsx`
- Delete: `apps/web/src/components/home/AgentSpotlight.tsx`
- Delete: `apps/web/src/components/join/JoinFaq.tsx`

- [ ] **Step 1: Re-verify zero references for each file before deleting anything**

```bash
grep -rln "AnimatedTooltip" apps/web/src --include="*.tsx" --include="*.ts"
grep -rln "BentoGrid" apps/web/src --include="*.tsx" --include="*.ts"
grep -rln "FocusCards" apps/web/src --include="*.tsx" --include="*.ts"
grep -rln "ShimmerButton" apps/web/src --include="*.tsx" --include="*.ts"
grep -rln "AgentSpotlight" apps/web/src --include="*.tsx" --include="*.ts"
grep -rln "JoinFaq" apps/web/src --include="*.tsx" --include="*.ts"
```

Each command should return ONLY the file being deleted itself (its own definition). If any command returns a second file, STOP — that file is not actually dead, do not delete it, and remove it from this task's scope.

- [ ] **Step 2: Delete the confirmed-dead files**

```bash
rm apps/web/src/components/ui/animated-tooltip.tsx
rm apps/web/src/components/ui/bento-grid.tsx
rm apps/web/src/components/ui/focus-cards.tsx
rm apps/web/src/components/ui/shimmer-button.tsx
rm apps/web/src/components/home/AgentSpotlight.tsx
rm apps/web/src/components/join/JoinFaq.tsx
```

- [ ] **Step 3: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green — no import errors, no missing-module errors.

- [ ] **Step 4: Run a production build as an extra safety check**

Run: `pnpm --filter web build`
Expected: succeeds — `tsc --noEmit` alone can sometimes miss a dynamic import or a re-export chain that a real build would catch.

- [ ] **Step 5: Commit**

```bash
git rm apps/web/src/components/ui/animated-tooltip.tsx apps/web/src/components/ui/bento-grid.tsx apps/web/src/components/ui/focus-cards.tsx apps/web/src/components/ui/shimmer-button.tsx apps/web/src/components/home/AgentSpotlight.tsx apps/web/src/components/join/JoinFaq.tsx
git commit -m "chore: delete 6 confirmed-dead orphaned components from the original Aceternity-era homepage"
```

---

### Task 18: Remove unused npm dependencies

`zustand` and `@tabler/icons-react` have zero imports anywhere in the codebase. `@tiptap/pm` needs a transitive-dependency check before removal.

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/pnpm-lock.yaml` (regenerated by `pnpm install`)

- [ ] **Step 1: Re-verify zero imports for `zustand` and `@tabler/icons-react`**

```bash
grep -rln "from \"zustand\"\|from 'zustand'" apps/web/src
grep -rln "@tabler/icons-react" apps/web/src
```

Both should return nothing. If either returns a file, stop and remove only the one confirmed genuinely unused.

- [ ] **Step 2: Check whether `@tiptap/pm` is a required transitive dependency**

```bash
pnpm --filter web why @tiptap/pm
```

Read the output. If it shows `@tiptap/pm` is required by `@tiptap/react` or `@tiptap/starter-kit` as a peer/transitive dependency (likely), leave it in `package.json` — removing a direct dependency that's also a real transitive requirement doesn't break anything today, but pins the version deliberately, and the audit itself flagged this as "only remove if safe to." If the output shows no other package depends on it, it's safe to remove.

- [ ] **Step 3: Remove the confirmed-dead dependencies from `apps/web/package.json`**

Remove these two lines from the `dependencies` block:

```json
    "@tabler/icons-react": "^3.41.1",
```

```json
    "zustand": "^5.0.12"
```

(Adjust for trailing commas correctly depending on final position in the alphabetized list — `zustand` is currently the last dependency, so removing it means the line above it loses its trailing comma.)

Only remove `@tiptap/pm`'s line too if Step 2 confirmed it's safe.

- [ ] **Step 4: Reinstall**

```bash
pnpm install
```

- [ ] **Step 5: Run the full suite, tsc, and a production build**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
pnpm --filter web build
```

Expected: all three succeed. The production build is the critical check here — a bad dependency removal can break bundling in a way neither tests nor `tsc` would catch (e.g. if something imported one of these packages via a string not caught by static grep, or a transitive resolution shifted).

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore: remove unused zustand and @tabler/icons-react dependencies"
```

---

### Task 19: Rename SyncProgress.nextLink to cursor

Confirmed safe: the `SyncProgress` table is currently empty (queried directly against the live database on 2026-09-07 as part of writing this plan — zero rows), meaning no crawl is in-flight and the last one completed and cleared its own checkpoint naturally. This was previously deferred specifically because a resync was in progress; that condition no longer holds.

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: a new migration under `packages/database/prisma/migrations/`
- Modify: `apps/web/src/app/api/idx/sync/route.ts`

- [ ] **Step 1: Re-verify the table is still empty immediately before making this change**

Write a one-off script (delete it immediately after running, do not commit it):

```js
// packages/database/check-sync-progress-recheck.mjs
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const rows = await prisma.syncProgress.findMany();
console.log(JSON.stringify(rows, null, 2));
await prisma.$disconnect();
```

```bash
cd packages/database && node check-sync-progress-recheck.mjs
```

Expected: `[]`. If it is NOT empty (a row exists), STOP — do not proceed with this task. A crawl may now be in-flight since the plan was written; leave the column as `nextLink`, note in the task report that this was skipped and why, and move on to the next task.

Delete the script immediately after checking, regardless of the result:

```bash
rm packages/database/check-sync-progress-recheck.mjs
```

- [ ] **Step 2: Rename the column in `schema.prisma`**

Change:

```prisma
model SyncProgress {
  id        String   @id @default(cuid())
  syncType  String   @unique
  nextLink  String   @db.Text
  updatedAt DateTime @updatedAt
}
```

to:

```prisma
model SyncProgress {
  id        String   @id @default(cuid())
  syncType  String   @unique
  cursor    String   @db.Text
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 3: Generate and apply the migration**

```bash
pnpm --filter @cnc/database exec prisma migrate dev --name rename_sync_progress_next_link_to_cursor
```

Since the table is empty (confirmed in Step 1), this is a zero-data-risk rename — there's nothing to migrate.

If this fails with `EPERM`/DLL-lock, stop the dev server first, retry, then restart it afterward.

- [ ] **Step 4: Update every reference in `idx/sync/route.ts`**

Read the file's current content around each of these 5 lines (confirmed via grep — these are the only production-code references anywhere; `idx/client.ts`'s mentions of "nextLink" are all in comments about Trestle's own `@odata.nextLink` API field, not this column, and don't need changing):

```ts
      isKeyCursor(checkpoint.nextLink)
        ? `[idx-sync] resuming ${type} sync from cursor ${checkpoint.nextLink}`
```

becomes:

```ts
      isKeyCursor(checkpoint.cursor)
        ? `[idx-sync] resuming ${type} sync from cursor ${checkpoint.cursor}`
```

```ts
  for await (const { properties: batch, cursor } of fetchProperties(modifiedSince, checkpoint?.nextLink)) {
```

becomes:

```ts
  for await (const { properties: batch, cursor } of fetchProperties(modifiedSince, checkpoint?.cursor)) {
```

```ts
      create: { syncType: type, nextLink: cursor },
      update: { nextLink: cursor },
```

becomes:

```ts
      create: { syncType: type, cursor },
      update: { cursor },
```

- [ ] **Step 5: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green — any existing test that mocks `SyncProgress` shape with `nextLink` will now fail to type-check or fail an assertion; update those mocks to use `cursor` instead. Search first: `grep -rln "nextLink" apps/web/src/__tests__`.

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations apps/web/src/app/api/idx/sync/route.ts
git add -u apps/web/src/__tests__
git commit -m "chore: rename SyncProgress.nextLink to cursor now that it's safe (table confirmed empty)"
```

---

### Task 20: Fix ContactModal silently failing on every submission (discovered during Task 13's live check)

Not part of the original 5-agent audit — discovered during Task 13's mandatory live visual check (merging `ManageContactModal` into `ContactModal`). `ContactModal.tsx` (used by `JoinCTAButtons.tsx`, `ManageHandle.tsx`, `SellProcess.tsx`, and every `PageCTA.tsx` consumer — `buy`, `rent`, `sell`, `manage`, `home-value`, `join/apply/submitted` pages) has never successfully created a lead: (a) its form never collects a `lastName`, which `/api/leads`'s Zod schema requires; (b) it sends its `source` prop (a descriptive string like `"MANAGE_TENANT_PLACEMENT"`, `"JOIN_CTA"`, `"SELL_PROCESS_CTA"`, or one of 6 more `*_CTA` strings from `PageCTA`) as the `source` field, but that field only accepts a fixed 6-value enum (`WEBSITE`/`REFERRAL`/`SOCIAL`/`OPEN_HOUSE`/`COLD_CALL`/`OTHER`). Every real submission gets a 400 (the component does show a visible "Something went wrong. Please try again." error banner — confirmed via live testing, it does not fail silently — but it always fails). The standalone `/contact` page's own inline form (a separate component in `contact/page.tsx`, not `ContactModal`) is unaffected — it already collects `lastName` and sends `source: "WEBSITE"`.

Fix: add the missing `lastName` field to `ContactModal`; always send a valid enum value (`"WEBSITE"`) as `source`; preserve the specific CTA-origin string (previously misused as `source`) in the `Lead` model's existing `utmSource` column instead — that column is already a plain optional string on the schema (no migration needed) and is already rendered on the agent dashboard's lead detail sidebar (`LeadDetailSidebar.tsx`), so agents will see exactly which CTA generated the lead with zero new UI work.

**Files:**
- Modify: `apps/web/src/components/ui/ContactModal.tsx`
- Modify: `apps/web/src/app/api/leads/route.ts`
- Test: `apps/web/src/__tests__/api/leads.test.ts` — extend

**Interfaces:** none new — `ContactModal`'s existing `source: string` prop is unchanged in meaning to its callers (still the descriptive CTA-origin string); only what the component does with it internally changes.

- [ ] **Step 1: Write the failing test for `/api/leads` accepting `utmSource`**

Add to `apps/web/src/__tests__/api/leads.test.ts` (read the file first to match its exact existing mock setup for `POST`):

```ts
it("accepts an optional utmSource and stores it on the lead", async () => {
  vi.mocked(prisma.lead.create).mockResolvedValue({ id: "lead1" } as any);

  const res = await POST(new Request("http://localhost/api/leads", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      role: "Owner",
      notes: "Hi",
      source: "WEBSITE",
      utmSource: "MANAGE_TENANT_PLACEMENT",
    }),
  }));

  expect(res.status).toBe(201);
  expect(prisma.lead.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ utmSource: "MANAGE_TENANT_PLACEMENT" }),
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/leads.test.ts`
Expected: FAIL — `createSchema` doesn't accept `utmSource` yet, so Zod strips it silently (the assertion on `prisma.lead.create`'s call args will fail since `utmSource` won't be present in `data`).

- [ ] **Step 3: Add `utmSource` to the create schema**

In `apps/web/src/app/api/leads/route.ts`, change:

```ts
const createSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(["WEBSITE", "REFERRAL", "SOCIAL", "OPEN_HOUSE", "COLD_CALL", "OTHER"]).default("WEBSITE"),
});
```

to:

```ts
const createSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(["WEBSITE", "REFERRAL", "SOCIAL", "OPEN_HOUSE", "COLD_CALL", "OTHER"]).default("WEBSITE"),
  utmSource: z.string().optional(),
});
```

`role` is also present in `ContactModal`'s submitted body today (used only for `notes`-adjacent context, not a Lead column) — confirm it's already silently stripped by Zod's default (non-strict) object parsing rather than causing a validation error; do not add it to the schema, it isn't a `Lead` field.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/leads.test.ts`
Expected: PASS.

- [ ] **Step 5: Fix `ContactModal.tsx` — add `lastName`, fix the source/enum mismatch**

Read the current full file first (`apps/web/src/components/ui/ContactModal.tsx`) to confirm nothing changed since this task was written. Then:

Change the form state:

```tsx
  const [form, setForm] = useState({ firstName: "", email: "", role: "", notes: "" });
```

to:

```tsx
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", role: "", notes: "" });
```

Change both places this shape is reset:

```tsx
      setForm({ firstName: "", email: "", role: "", notes: "" });
```

to:

```tsx
      setForm({ firstName: "", lastName: "", email: "", role: "", notes: "" });
```

Change the submit body:

```tsx
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source }),
      });
```

to:

```tsx
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "WEBSITE", utmSource: source }),
      });
```

Add a Last Name field to the form JSX, immediately after the First Name field:

```tsx
                <div className="flex flex-col gap-1.5">
                  <label className="font-sans text-sm text-left text-[#1B1B1B]/60">First Name *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
                    placeholder=""
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-sans text-sm text-left text-[#1B1B1B]/60">Email *</label>
```

to:

```tsx
                <div className="flex flex-col gap-1.5">
                  <label className="font-sans text-sm text-left text-[#1B1B1B]/60">First Name *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
                    placeholder=""
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-sans text-sm text-left text-[#1B1B1B]/60">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
                    placeholder=""
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-sans text-sm text-left text-[#1B1B1B]/60">Email *</label>
```

(Leave the existing `{status === "error" && (...)}` error banner exactly as-is — it already renders correctly on failure; this task fixes the underlying cause of that failure, not the error UI.)

- [ ] **Step 6: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green.

- [ ] **Step 7: Manual live check — mandatory, this is the exact bug this task fixes**

A dev server should be available (left running from earlier tasks in this plan). Open `/manage`, click "Learn More" on any card, fill in First Name, Last Name, Email, select a role, type a message, submit. Confirm the modal now shows "Message received." (the `status === "success"` branch), not the error banner. Then verify in the database (via a one-off script run from `packages/database`, or Prisma Studio) that a new `Lead` row was created with `source: "WEBSITE"` and `utmSource` equal to the expected `"MANAGE_<CARD_TITLE>"` string. Repeat once more for one `PageCTA`-based page (e.g. `/rent`) to confirm the `*_CTA` source strings flow through correctly too. Delete the test lead(s) afterward. State plainly in the report whether this was actually performed — this task's entire purpose is fixing a live bug, so this check is not optional the way it was for purely structural refactors elsewhere in this plan.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/ui/ContactModal.tsx apps/web/src/app/api/leads/route.ts apps/web/src/__tests__/api/leads.test.ts
git commit -m "fix: ContactModal was silently failing on every submission — add lastName, fix source enum mismatch via utmSource"
```

---

### Task 21: Fix production build failure caused by Task 2's isomorphic-dompurify addition (URGENT — run before Task 18)

Discovered during Task 17's own required production-build safety check. `pnpm --filter web build` currently fails with:

```
Error: ENOENT: no such file or directory, open '.../.next/server/browser/default-stylesheet.css'
    at ... .next/server/app/press/[slug]/page.js
Error: Failed to collect page data for /press/[slug]
```

Bisected via two throwaway git worktrees (never touching the real working tree): the build succeeds at the commit immediately before Task 1, and fails starting at Task 2's own commit (`3688fb3`, "fix: sanitize agent-authored HTML before rendering"). This is a real regression introduced by Task 2 of this very plan — not a pre-existing issue. It was not caught by any task's own verification because no task before Task 17 ran a real `next build` (only `vitest` + `tsc --noEmit`, neither of which catches this), and `next dev` never hits this failure mode at all (confirmed live throughout this session — every dev-server-based check tonight, including Tasks 10 and 13's live Puppeteer verification, ran fine against code that already had this bug).

Root cause: `isomorphic-dompurify`'s server-side (Node/jsdom) code path reads a `default-stylesheet.css` resource file via a path assumption that only holds when the package is loaded directly from `node_modules` at runtime. Next.js's default webpack behavior bundles anything imported by a Server Component or Route Handler into its own server chunk — `/press/[slug]` imports `PostBody.tsx`, which calls `sanitizeHtml()` (added in Task 2), which imports `isomorphic-dompurify` — and once bundled that way, jsdom's internal file read can no longer resolve the real path to its stylesheet asset.

Fix, already verified working in a throwaway worktree (built successfully before writing this task — not a guess): tell Next.js not to bundle this package, so it keeps running as a plain `node_modules` require. Confirmed via Next.js's own documentation that `experimental.serverComponentsExternalPackages` is the correct, current config key for this exact purpose on Next.js 14.2.x (this project's version) — it was stabilized and renamed to a top-level `serverExternalPackages` starting in Next.js 15, which this project is not on.

**Files:**
- Modify: `apps/web/next.config.mjs`

**Interfaces:** none — this is a build-configuration change only, zero application code changes.

- [ ] **Step 1: Reproduce the failure**

```bash
cd apps/web
rm -rf .next
pnpm exec next build 2>&1 | tail -30
```

Expected: FAILS with the `ENOENT: default-stylesheet.css` error on `/press/[slug]`, exactly as described above. Confirm you see this exact failure before proceeding — if the build succeeds or fails differently, STOP and report rather than assuming the fix below still applies.

- [ ] **Step 2: Add the config fix**

In `apps/web/next.config.mjs`, change:

```js
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};
```

to:

```js
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverComponentsExternalPackages: ["isomorphic-dompurify", "jsdom"],
  },
};
```

(Everything below this point in the file — the `export default withSentryConfig(nextConfig, {...})` call — is unchanged.)

- [ ] **Step 3: Verify the build now succeeds**

```bash
rm -rf .next
pnpm exec next build 2>&1 | tail -60
```

Expected: succeeds, ending with the normal route-size summary table (no `ENOENT`, no "Build error occurred"). Confirm `/press/[slug]` specifically appears in that summary table with no error.

- [ ] **Step 4: Run the full suite and tsc**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything green — this is a config-only change with zero application code touched, so nothing here should be affected, but confirm anyway.

- [ ] **Step 5: Live sanity check on the dev server**

A dev server may or may not currently be running on localhost:3000. If it's running, restart it (this config change requires a restart to take effect — `next dev` reads `next.config.mjs` once at startup). Confirm `/press` and at least one `/press/[slug]` post still render correctly with sanitized HTML intact (bold/italic/lists/links preserved, no raw `<script>` tags) — this re-confirms Task 2's original XSS fix still works after this config change, since `serverComponentsExternalPackages` only changes HOW the package is loaded, not what it does. State plainly in the report whether this was performed.

- [ ] **Step 6: Commit**

```bash
git add apps/web/next.config.mjs
git commit -m "fix: mark isomorphic-dompurify/jsdom as external server packages, fixing a production build failure introduced by the Task 2 XSS fix"
```

---

## Final Self-Review Notes

**Spec coverage:** every finding from the 5 audit categories (security critical/important/minor, performance important/minor, duplication critical/important/minor, dead code) maps to exactly one task above, except the sitewide color-token cleanup and the scroll-word-reveal extraction, both explicitly deferred by the user's own decision.

**Placeholder scan:** every step above contains the actual current code being replaced and the actual new code — no "TBD," no "add appropriate error handling," no "similar to Task N" shortcuts.

**Type consistency:** `getFileAndVerifyAccess`'s signature (`fileType: "listing" | "transaction", fileId: string, callerAgentId: string | null, role: string`) is used identically across Tasks 1 and 15, the only two tasks that consume it. `sanitizeHtml(html: string): string` and `isAuthorizedCronRequest(req: Request): boolean` are each used exactly once outside their own task. `CHECKLIST_ITEMS_WITH_DOCS_INCLUDE` is a `const` object, not a function, applied identically at all 6 call sites in Task 14.
