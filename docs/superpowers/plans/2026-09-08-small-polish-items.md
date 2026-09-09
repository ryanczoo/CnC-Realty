# Small Polish Items (Leftover from 2026-09-07/08 Audit Work) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 small, independent, low-risk items surfaced by an audit of leftovers from the 2026-09-07 whole-codebase audit plan and its 2026-09-08 residual-fixes follow-up. The 6th item found by that same audit (sitewide color-token cleanup, ~200 files) is explicitly OUT OF SCOPE — the user has deliberately deferred it to its own dedicated session.

**Architecture:** Five small, independent fixes. No shared code between them; each is its own task, its own commit.

**Tech Stack:** Next.js 14.2.35 (App Router), Prisma 5.22/Postgres.

**Spec:** No separate spec doc — each task's own text is the complete spec, written from direct investigation of the live codebase on 2026-09-08.

## Global Constraints

- Full test suite (`pnpm --filter web exec vitest run`) and `pnpm --filter web exec tsc --noEmit` must be clean after every task.
- **A full production build (`rm -rf apps/web/.next && pnpm --filter web build`) is REQUIRED after every task, no exceptions.** This project's own recent history had a real production-build-breaking regression sit undetected for 15 tasks specifically because `vitest`+`tsc` alone were treated as sufficient — do not repeat that mistake, even for a task that looks trivial.
- TDD wherever the change is behavioral (Tasks 1-3 are; Tasks 4-5 are pure documentation/style with no behavioral test surface).
- Each task is its own commit. Never combine unrelated fixes in one commit.
- Never touch files outside a task's stated scope.
- The user's explicit instruction for this plan: **"I don't want anything breaking."** Every task's implementer, the controller (independently, a second time), and a task reviewer (independently, a third time) must each separately confirm the full suite + tsc + production build are clean before a task is considered done — matching the exact discipline used for the immediately preceding residual-fixes plan.
- **Explicitly out of scope for this plan:** the sitewide color-token cleanup. Do not touch any `.tsx`/`.ts` file purely to replace a raw hex color literal with a CSS variable token — that is a separate, much larger, deliberately deferred effort.

---

### Task 1: Log when the `take: 500` caps are actually hit

`apps/web/src/app/api/deals/route.ts` and `apps/web/src/app/api/cron/action-plans/route.ts` both cap a query at 500 rows (added in the 2026-09-07 audit plan, Tasks 8 and 9) with no signal if that cap is ever actually reached — a real backlog beyond 500 would silently and invisibly drop rows.

**Files:**
- Modify: `apps/web/src/app/api/deals/route.ts`
- Modify: `apps/web/src/app/api/cron/action-plans/route.ts`
- Test: `apps/web/src/__tests__/api/deals.test.ts` — extend
- Test: `apps/web/src/__tests__/api/cron-action-plans.test.ts` — extend

**Interfaces:** none new — pure logging addition, zero change to response shape or status codes.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/__tests__/api/deals.test.ts` (read the file first to match its exact existing mock setup — it mocks `getServerSession` and `prisma.deal.findMany`):

```ts
it("logs a warning when the result is exactly capped at 500", async () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "ADMIN", agentId: null } } as any);
  vi.mocked(prisma.deal.findMany).mockResolvedValue(Array(500).fill({
    id: "d1", agentId: "a1", leadId: "l1", pipeline: "BUYERS", stage: "TOURING",
    propertyAddress: null, price: null, expectedCloseDate: null, notes: null,
    transactionFileId: null, stageUpdatedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    lead: { firstName: "Jane", lastName: "Doe" },
  }) as any);

  await GET(new Request("http://localhost/api/deals"));

  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("capped at 500"));
  warnSpy.mockRestore();
});

it("does not log when the result is under 500", async () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "ADMIN", agentId: null } } as any);
  vi.mocked(prisma.deal.findMany).mockResolvedValue([] as any);

  await GET(new Request("http://localhost/api/deals"));

  expect(warnSpy).not.toHaveBeenCalled();
  warnSpy.mockRestore();
});
```

Add to `apps/web/src/__tests__/api/cron-action-plans.test.ts` (read the file first — it should already have a `makeAuthorizedRequest()` helper and mocks `prisma.leadPlanStep.findMany`):

```ts
it("logs a warning when the due-steps result is exactly capped at 500", async () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue(Array(500).fill(EMAIL_STEP) as any);
  vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);

  await POST(makeAuthorizedRequest());

  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("capped at 500"));
  warnSpy.mockRestore();
});
```

(Use whatever this file's existing fixture for a single due step is actually named — check the file first; `EMAIL_STEP` is a placeholder name, substitute the real one.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web exec vitest run src/__tests__/api/deals.test.ts src/__tests__/api/cron-action-plans.test.ts`
Expected: the "logs a warning" tests FAIL (no such log call exists yet); the "does not log" test should already pass.

- [ ] **Step 3: Add the log line to `deals/route.ts`**

Change:

```ts
  const deals = await prisma.deal.findMany({
    where,
    include: { lead: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  return NextResponse.json(deals.map(serializeDeal));
```

to:

```ts
  const deals = await prisma.deal.findMany({
    where,
    include: { lead: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  if (deals.length === 500) {
    console.warn("[GET /api/deals] result capped at 500 rows — some deals may not be shown");
  }

  return NextResponse.json(deals.map(serializeDeal));
```

- [ ] **Step 4: Add the log line to `cron/action-plans/route.ts`**

Find the `dueSteps` query (it ends with `take: 500,\n  });`) and add immediately after it, before whatever code currently follows:

```ts
  if (dueSteps.length === 500) {
    console.warn("[cron/action-plans] due-steps result capped at 500 — a backlog may exist");
  }
```

(Read the surrounding code first to place this cleanly — it should go right after the `dueSteps` query's closing `});` and before the next statement, whatever that currently is.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/__tests__/api/deals.test.ts src/__tests__/api/cron-action-plans.test.ts`
Expected: PASS, plus every pre-existing test in both files unchanged.

- [ ] **Step 6: Run the full suite, tsc, and a production build**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
rm -rf apps/web/.next && pnpm --filter web build
```

Expected: all three succeed.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/deals/route.ts apps/web/src/app/api/cron/action-plans/route.ts apps/web/src/__tests__/api/deals.test.ts apps/web/src/__tests__/api/cron-action-plans.test.ts
git commit -m "chore: log when the deals/action-plans take:500 caps are actually hit"
```

---

### Task 2: Make `fileType` validation consistent across ownership-check call sites

`apps/web/src/app/api/file-tasks/route.ts` explicitly validates `fileType` is exactly `"listing"` or `"transaction"`, returning 400 otherwise. Four other routes silently degrade an unrecognized value into the `"transaction"` branch via an unchecked ternary or cast. Not exploitable (the same discriminator drives both the ownership check and the subsequent read/write, so they can never disagree) — this is a consistency fix, not a security fix.

**Files:**
- Modify: `apps/web/src/app/api/files/[fileType]/[id]/note/route.ts`
- Modify: `apps/web/src/app/api/files/[fileType]/[id]/parties/route.ts`
- Modify: `apps/web/src/app/api/documents/route.ts`
- Modify: `apps/web/src/app/api/upload-url/route.ts`
- Test: `apps/web/src/__tests__/api/files-note.test.ts` — check for existing coverage, extend or create
- Test: `apps/web/src/__tests__/api/files-parties.test.ts` — check for existing coverage, extend or create
- Test: `apps/web/src/__tests__/api/documents.test.ts` — extend
- Test: `apps/web/src/__tests__/api/upload-url.test.ts` — check for existing coverage, extend or create

**Interfaces:** none new. This IS a real, intentional behavior change for the invalid-input edge case only: a request with a `fileType` that is neither the expected lowercase (`note`/`parties`/`upload-url`, URL param or query string) nor uppercase (`documents`, JSON body — matches the Prisma `FileType` enum: `LISTING`/`TRANSACTION`) value now gets an explicit 400 instead of silently falling through to the transaction branch (which would then 403 or 404 downstream anyway in virtually every real case, since a bogus fileType essentially never happens to also collide with a real file's actual type). Every legitimate real caller (the app's own frontend, which always sends a correct value) is completely unaffected.

- [ ] **Step 1: Check for existing test coverage in all 4 test files**

```bash
ls apps/web/src/__tests__/api/ | grep "files-note\|files-parties\|^documents\.test\|upload-url"
```

Read each existing file fully before touching it.

- [ ] **Step 2: Write the failing tests**

For `note/route.ts` and `parties/route.ts` (URL param, lowercase `"listing"`/`"transaction"` expected), add a test like this to each corresponding test file (adapt to that file's exact existing mock/session pattern):

```ts
it("rejects an unrecognized fileType with 400", async () => {
  vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any); // use this file's real session fixture name
  const res = await POST(
    new Request("http://localhost", { method: "POST", body: JSON.stringify({ note: "hi" }) }), // adapt body per route — parties/route.ts needs { role, name }
    { params: { fileType: "bogus", id: "f1" } }
  );
  expect(res.status).toBe(400);
});
```

For `documents/route.ts` (JSON body, uppercase `"LISTING"`/`"TRANSACTION"` expected), add to `apps/web/src/__tests__/api/documents.test.ts`:

```ts
it("rejects an unrecognized fileType with 400", async () => {
  vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
  const res = await POST(req({ fileType: "BOGUS", fileId: "f1", name: "x.pdf", r2Key: "k", r2Url: "u" }));
  expect(res.status).toBe(400);
});
```

For `upload-url/route.ts` (query string, lowercase `"listing"`/`"transaction"` expected), add/create in `apps/web/src/__tests__/api/upload-url.test.ts`:

```ts
it("rejects an unrecognized fileType with 400", async () => {
  vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
  const res = await GET(new Request("http://localhost/api/upload-url?fileType=bogus&fileId=f1&filename=x.pdf&contentType=application/pdf&size=1000"));
  expect(res.status).toBe(400);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter web exec vitest run src/__tests__/api/files-note.test.ts src/__tests__/api/files-parties.test.ts src/__tests__/api/documents.test.ts src/__tests__/api/upload-url.test.ts`
Expected: all 4 new tests FAIL (currently no validation exists, so a bogus fileType silently proceeds down the transaction branch and returns whatever status that branch happens to produce — likely 403/404, not 400).

- [ ] **Step 4: Add validation to `note/route.ts`**

Change:

```ts
export async function POST(req: Request, { params }: { params: { fileType: string; id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isListing = params.fileType === "listing";
```

to:

```ts
export async function POST(req: Request, { params }: { params: { fileType: string; id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (params.fileType !== "listing" && params.fileType !== "transaction") {
    return NextResponse.json({ error: "fileType must be 'listing' or 'transaction'" }, { status: 400 });
  }
  const isListing = params.fileType === "listing";
```

- [ ] **Step 5: Add validation to `parties/route.ts`**

Identical change, same diff shape, in `apps/web/src/app/api/files/[fileType]/[id]/parties/route.ts` (its current line is `const isListing = params.fileType === "listing";` — insert the same validation block immediately before it).

- [ ] **Step 6: Add validation to `documents/route.ts`**

Change:

```ts
  const { fileType, fileId, checklistItemId, name, r2Key, r2Url, documentId } = body;

  if (!fileType || !fileId || !name || !r2Key || !r2Url) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const isListing = fileType === "LISTING";
```

to:

```ts
  const { fileType, fileId, checklistItemId, name, r2Key, r2Url, documentId } = body;

  if (!fileType || !fileId || !name || !r2Key || !r2Url) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (fileType !== "LISTING" && fileType !== "TRANSACTION") {
    return NextResponse.json({ error: "fileType must be 'LISTING' or 'TRANSACTION'" }, { status: 400 });
  }

  const isListing = fileType === "LISTING";
```

- [ ] **Step 7: Add validation to `upload-url/route.ts`**

Change:

```ts
  const fileType = searchParams.get("fileType") as "listing" | "transaction" | null;
  const fileId = searchParams.get("fileId");
  const filename = searchParams.get("filename");
  const contentType = searchParams.get("contentType");
  const size = Number(searchParams.get("size") ?? 0);

  if (!fileType || !fileId || !filename || !contentType) {
    return NextResponse.json({ error: "fileType, fileId, filename, and contentType are required" }, { status: 400 });
  }
```

to:

```ts
  const rawFileType = searchParams.get("fileType");
  const fileId = searchParams.get("fileId");
  const filename = searchParams.get("filename");
  const contentType = searchParams.get("contentType");
  const size = Number(searchParams.get("size") ?? 0);

  if (!rawFileType || !fileId || !filename || !contentType) {
    return NextResponse.json({ error: "fileType, fileId, filename, and contentType are required" }, { status: 400 });
  }
  if (rawFileType !== "listing" && rawFileType !== "transaction") {
    return NextResponse.json({ error: "fileType must be 'listing' or 'transaction'" }, { status: 400 });
  }
  const fileType = rawFileType;
```

(This removes the unchecked `as "listing" | "transaction" | null` cast entirely — after the explicit check, TypeScript can narrow `fileType`'s type correctly on its own without a cast. Confirm `tsc` agrees in Step 9; if the narrowing doesn't flow through cleanly for some reason, keep the logic but adjust the exact typing approach — the runtime validation is what matters, not the exact type-narrowing mechanism.)

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/__tests__/api/files-note.test.ts src/__tests__/api/files-parties.test.ts src/__tests__/api/documents.test.ts src/__tests__/api/upload-url.test.ts`
Expected: PASS, all 4 new tests, plus every pre-existing test in all 4 files unchanged (every existing test already sends a valid `fileType`, so none of them should be affected by adding stricter validation for the invalid case).

- [ ] **Step 9: Run the full suite, tsc, and a production build**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
rm -rf apps/web/.next && pnpm --filter web build
```

Expected: all three succeed.

- [ ] **Step 10: Commit**

```bash
git add "apps/web/src/app/api/files/[fileType]/[id]/note/route.ts" "apps/web/src/app/api/files/[fileType]/[id]/parties/route.ts" apps/web/src/app/api/documents/route.ts apps/web/src/app/api/upload-url/route.ts apps/web/src/__tests__/api/files-note.test.ts apps/web/src/__tests__/api/files-parties.test.ts apps/web/src/__tests__/api/documents.test.ts apps/web/src/__tests__/api/upload-url.test.ts
git commit -m "chore: validate fileType explicitly at 4 remaining call sites, matching file-tasks/route.ts's existing pattern"
```

---

### Task 3: Extract shared `resolveFileRef()` helper (dedupe 3 call sites)

`apps/web/src/app/api/documents/[id]/download/route.ts`, `apps/web/src/app/api/files/[fileType]/[id]/parties/[partyId]/route.ts`, and `apps/web/src/app/api/file-tasks/[taskId]/route.ts` each independently resolve "which file (listing or transaction) does this record belong to" from a record with `listingFileId`/`transactionFileId` fields. This is a behavior-preserving refactor — must not change any response, status code, or query.

**Files:**
- Modify: `apps/web/src/lib/api-auth.ts` — add the new helper next to `getFileAndVerifyAccess`
- Modify: `apps/web/src/app/api/documents/[id]/download/route.ts`
- Modify: `apps/web/src/app/api/files/[fileType]/[id]/parties/[partyId]/route.ts`
- Modify: `apps/web/src/app/api/file-tasks/[taskId]/route.ts`
- Test: `apps/web/src/__tests__/lib/api-auth.test.ts` — extend if it exists, else create
- Test: `apps/web/src/__tests__/api/documents-download.test.ts`, `apps/web/src/__tests__/api/files-parties-id.test.ts`, `apps/web/src/__tests__/api/file-tasks-id.test.ts` — these should already exist from earlier plans; read them fully first, they are the regression guard

**Interfaces:**
- Produces: `resolveFileRef(record: { listingFileId: string | null; transactionFileId: string | null }): { fileId: string; fileType: "listing" | "transaction" } | null`, exported from `apps/web/src/lib/api-auth.ts`.

**Important — one real behavioral nuance to verify, not assume:** `file-tasks/[taskId]/route.ts`'s current code derives `fileType` from the record's own `fileType` ENUM field (`task.fileType === "LISTING" ? "listing" : "transaction"`), NOT from which FK is populated (unlike the other two files, which use `record.listingFileId ? "listing" : "transaction"`). The new shared helper takes the FK-presence approach (matching 2 of the 3 current call sites). Before switching `file-tasks/[taskId]/route.ts` to use it, verify these two derivations are actually guaranteed to agree for every `FileTask` row that can exist — check `apps/web/src/app/api/file-tasks/route.ts`'s `POST` handler (the only creation path) to confirm it always sets `fileType` and the matching FK together, consistently, with no path that could create a mismatched row. If you find any doubt about this invariant, do NOT switch `file-tasks/[taskId]/route.ts` to the shared helper — leave it using `task.fileType` as before and only dedupe the other two call sites, noting this in your report. Do not guess; verify by reading the actual creation code.

- [ ] **Step 1: Check for existing test coverage in all 3 affected route test files**

```bash
ls apps/web/src/__tests__/api/ | grep "documents-download\|files-parties-id\|file-tasks-id"
```

Read each file fully — these are your regression guards. If any of the 3 route test files don't exist, write a characterization test proving CURRENT behavior first (mirroring the pattern used for `file-tasks-id.test.ts` in an earlier plan — 4 cases: 403 non-owner, 200/success owner, 200/success ADMIN, and the not-found case) before refactoring anything.

- [ ] **Step 2: Verify the `file-tasks` invariant**

Read `apps/web/src/app/api/file-tasks/route.ts`'s `POST` handler in full. Confirm it sets `fileType: isListing ? "LISTING" : "TRANSACTION"` and the corresponding FK (`listingFileId`/`transactionFileId`) together, derived from the same `isListing` boolean, with no code path that could set one without the other agreeing. State your finding plainly in the report either way.

- [ ] **Step 3: Add `resolveFileRef` to `lib/api-auth.ts`**

Add near `getFileAndVerifyAccess`:

```ts
// Resolves which file (listing or transaction) a record with both possible
// FK columns belongs to, from whichever one is actually populated. Returns
// null if neither is set (shouldn't happen with real data, but callers must
// still handle it — matches the existing 404 behavior at every call site
// this replaces).
export function resolveFileRef(
  record: { listingFileId: string | null; transactionFileId: string | null }
): { fileId: string; fileType: "listing" | "transaction" } | null {
  const fileId = record.listingFileId ?? record.transactionFileId;
  if (!fileId) return null;
  const fileType: "listing" | "transaction" = record.listingFileId ? "listing" : "transaction";
  return { fileId, fileType };
}
```

- [ ] **Step 4: Write a failing test for `resolveFileRef` itself**

Add to `apps/web/src/__tests__/lib/api-auth.test.ts` (create if it doesn't exist):

```ts
describe("resolveFileRef", () => {
  it("resolves a listing record", () => {
    expect(resolveFileRef({ listingFileId: "f1", transactionFileId: null })).toEqual({ fileId: "f1", fileType: "listing" });
  });
  it("resolves a transaction record", () => {
    expect(resolveFileRef({ listingFileId: null, transactionFileId: "f2" })).toEqual({ fileId: "f2", fileType: "transaction" });
  });
  it("returns null when neither FK is set", () => {
    expect(resolveFileRef({ listingFileId: null, transactionFileId: null })).toBeNull();
  });
});
```

Run it, confirm it fails (function doesn't exist yet), then confirm it passes once Step 3 is in place.

- [ ] **Step 5: Update `documents/[id]/download/route.ts`**

Change:

```ts
import { getFileAndVerifyAccess } from "@/lib/api-auth";
```

to:

```ts
import { getFileAndVerifyAccess, resolveFileRef } from "@/lib/api-auth";
```

and change:

```ts
  const fileId = doc.listingFileId ?? doc.transactionFileId;
  const fileType: "listing" | "transaction" = doc.listingFileId ? "listing" : "transaction";
  if (!fileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const file = await getFileAndVerifyAccess(fileType, fileId, session.user.agentId, session.user.role);
```

to:

```ts
  const ref = resolveFileRef(doc);
  if (!ref) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const file = await getFileAndVerifyAccess(ref.fileType, ref.fileId, session.user.agentId, session.user.role);
```

- [ ] **Step 6: Update `parties/[partyId]/route.ts`**

Same pattern — import `resolveFileRef` alongside `getFileAndVerifyAccess`, and inside `verifyPartyAccess`, change:

```ts
  const fileId = party.listingFileId ?? party.transactionFileId;
  const fileType: "listing" | "transaction" = party.listingFileId ? "listing" : "transaction";
  if (!fileId) return { error: "Not found", status: 404 } as const;

  const file = await getFileAndVerifyAccess(fileType, fileId, agentId, role);
```

to:

```ts
  const ref = resolveFileRef(party);
  if (!ref) return { error: "Not found", status: 404 } as const;

  const file = await getFileAndVerifyAccess(ref.fileType, ref.fileId, agentId, role);
```

- [ ] **Step 7: Update `file-tasks/[taskId]/route.ts` — ONLY IF Step 2's invariant check passed**

If (and only if) you confirmed in Step 2 that `task.fileType` and the FK are always set consistently together, apply the same pattern to `assertTaskAccess`:

```ts
  const fileId = task.listingFileId ?? task.transactionFileId;
  const fileType: "listing" | "transaction" = task.fileType === "LISTING" ? "listing" : "transaction";
  if (!fileId) return { error: "Not found", status: 404 } as const;

  const file = await getFileAndVerifyAccess(fileType, fileId, agentId, role);
```

becomes:

```ts
  const ref = resolveFileRef(task);
  if (!ref) return { error: "Not found", status: 404 } as const;

  const file = await getFileAndVerifyAccess(ref.fileType, ref.fileId, agentId, role);
```

If the invariant did NOT clearly hold, skip this step entirely, leave this file exactly as-is, and say so plainly in your report — deduping 2 of 3 sites safely is a better outcome than deduping all 3 with a subtle behavior risk.

- [ ] **Step 8: Run the characterization/regression tests for all 3 (or 2) modified routes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/documents-download.test.ts src/__tests__/api/files-parties-id.test.ts src/__tests__/api/file-tasks-id.test.ts src/__tests__/lib/api-auth.test.ts`
Expected: PASS, every case, completely unchanged from before this refactor — this proves zero behavior change.

- [ ] **Step 9: Run the full suite, tsc, and a production build**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
rm -rf apps/web/.next && pnpm --filter web build
```

Expected: all three succeed.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/api-auth.ts "apps/web/src/app/api/documents/[id]/download/route.ts" "apps/web/src/app/api/files/[fileType]/[id]/parties/[partyId]/route.ts" apps/web/src/__tests__/lib/api-auth.test.ts apps/web/src/__tests__/api/documents-download.test.ts apps/web/src/__tests__/api/files-parties-id.test.ts
git add -u "apps/web/src/app/api/file-tasks/[taskId]/route.ts" apps/web/src/__tests__/api/file-tasks-id.test.ts
git commit -m "refactor: extract resolveFileRef() helper, dedupe file-resolution logic across ownership routes"
```

(Adjust the `git add` list if Step 7 was skipped — only add `file-tasks/[taskId]/route.ts` and its test if it was actually changed.)

---

### Task 4: Two small polish items — `lead!.email` non-null assertion, `ROLE_OPTIONS` location

Pure style/organization changes, zero behavior change, bundled into one task since both are tiny and unrelated to each other but each too small to be its own task.

**Files:**
- Modify: `apps/web/src/app/api/leads/[id]/homes/route.ts`
- Modify: `apps/web/src/components/ui/ContactModal.tsx`
- Modify: `apps/web/src/app/(marketing)/contact/page.tsx`
- Create: `apps/web/src/lib/role-options.ts`

**Interfaces:** `ROLE_OPTIONS` moves from being defined in `ContactModal.tsx` to being defined in a new `lib/role-options.ts` and re-exported (or just imported directly by both consumers) — the array's contents and order are byte-identical, only its home changes.

This task has no new automated test requirement — it's a pure refactor with zero behavior change, and the existing full suite (which already exercises `leads/[id]/homes/route.ts` and imports `ROLE_OPTIONS` indirectly via any component-level usage, though this codebase has no component-render tests) is the regression guard.

- [ ] **Step 1: Fix the non-null assertions in `leads/[id]/homes/route.ts`**

Change:

```ts
  const lead = await prisma.lead.findUnique({ where: { id: params.id }, select: { agentId: true, email: true } });
  const { exists, forbidden } = checkOwnership(lead, session.user.agentId, session.user.role);
  if (!exists || forbidden) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!lead!.email) return NextResponse.json({ saved: [], viewed: [] });

  const user = await prisma.user.findFirst({ where: { email: lead!.email, role: "BUYER" } });
```

to:

```ts
  const lead = await prisma.lead.findUnique({ where: { id: params.id }, select: { agentId: true, email: true } });
  const { exists, forbidden, record } = checkOwnership(lead, session.user.agentId, session.user.role);
  if (!exists || forbidden || !record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!record.email) return NextResponse.json({ saved: [], viewed: [] });

  const user = await prisma.user.findFirst({ where: { email: record.email, role: "BUYER" } });
```

(Confirm `checkOwnership`'s actual return shape includes a `record` field with the correct type by reading `apps/web/src/lib/api-auth.ts` first — this plan assumes it does based on its use elsewhere in this codebase, e.g. `getFileAndVerifyAccess`'s own implementation, but verify directly rather than assuming. If `checkOwnership`'s exact shape differs from what's shown here, adapt the destructuring accordingly while achieving the same goal: eliminate the `lead!` non-null assertions by using TypeScript's real narrowing instead.)

- [ ] **Step 2: Move `ROLE_OPTIONS` to `lib/role-options.ts`**

Create `apps/web/src/lib/role-options.ts`:

```ts
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

In `apps/web/src/components/ui/ContactModal.tsx`, change:

```ts
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

to:

```ts
export { ROLE_OPTIONS } from "@/lib/role-options";
```

(placed at the same location in the file, alongside the other imports at the top — re-exporting so `ContactModal.tsx` itself doesn't need every internal usage rewritten, while `contact/page.tsx` can optionally be updated to import from the new canonical location directly.)

In `apps/web/src/app/(marketing)/contact/page.tsx`, change:

```ts
import { ROLE_OPTIONS } from "@/components/ui/ContactModal";
```

to:

```ts
import { ROLE_OPTIONS } from "@/lib/role-options";
```

- [ ] **Step 3: Run the full suite, tsc, and a production build**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
rm -rf apps/web/.next && pnpm --filter web build
```

Expected: all three succeed — this is a pure refactor, nothing should be affected, but confirm anyway per this plan's global constraint. Pay particular attention to `tsc` here: if `checkOwnership`'s actual shape in Step 1 doesn't match what was assumed, this is exactly where a mismatch would surface.

- [ ] **Step 4: Live check (recommended, not strictly mandatory given this is a pure refactor with an existing test surface for Step 1)**

If a dev server is available, load `/contact` and confirm the "I am a" dropdown still shows all 7 role options in the same order. This confirms the `ROLE_OPTIONS` relocation didn't break anything visually.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/api/leads/[id]/homes/route.ts" apps/web/src/components/ui/ContactModal.tsx "apps/web/src/app/(marketing)/contact/page.tsx" apps/web/src/lib/role-options.ts
git commit -m "refactor: narrow lead!.email assertions via checkOwnership's record, move ROLE_OPTIONS to lib/"
```

---

### Task 5: Document the `SyncProgress` migration's empty-table constraint

`packages/database/prisma/migrations/20260908090103_rename_sync_progress_next_link_to_cursor/migration.sql` does `ADD COLUMN "cursor" TEXT NOT NULL` — safe only because the table was confirmed empty when this migration was written and applied. Nothing in this repo's own documentation flags this for whoever runs `prisma migrate deploy` in the future, if the table is ever non-empty at that point (e.g. a crawl in progress).

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** none — documentation only, zero code change.

- [ ] **Step 1: Add a short pending/reference note near the top of `CLAUDE.md`**

Read the top of `CLAUDE.md` first to see the exact current state of the `## ⚠️ Pending — office address` section and whatever immediately follows it, then add a new short section in the same style, either just before or just after that one:

```markdown
## ⚠️ Reference — SyncProgress migration constraint

`packages/database/prisma/migrations/20260908090103_rename_sync_progress_next_link_to_cursor/migration.sql` adds `cursor TEXT NOT NULL` with no default. This is only safe because the `SyncProgress` table was confirmed empty when this migration was written and applied (2026-09-08). **Before ever running `prisma migrate deploy` against a fresh or different environment, confirm `SyncProgress` is empty first** (or that no crawl is in-flight) — a non-empty table with existing rows would fail this migration since there's no default value for the new column.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note the SyncProgress migration's empty-table constraint for future deploys"
```

(No test/tsc/build step required — this is a documentation-only change with zero code impact. Still run `git status` afterward to confirm only `CLAUDE.md` was touched.)

---

## Final Self-Review Notes

**Spec coverage:** all 5 items from the leftover-audit report map to exactly one task above. The 6th item (sitewide color-token cleanup) is explicitly excluded per the user's own decision, restated in Global Constraints.

**Placeholder scan:** every step contains the actual current code being replaced and the actual new code — no TBD, no "add appropriate validation." Task 3 explicitly instructs verifying (not assuming) a real invariant before applying its riskiest sub-change, and gives an explicit fallback (skip that one file) if the invariant doesn't hold.

**Type consistency:** `resolveFileRef`'s signature (`record: { listingFileId: string | null; transactionFileId: string | null }` → `{ fileId: string; fileType: "listing" | "transaction" } | null`) is used identically at all 2-3 call sites in Task 3.
