# Residual Fixes (from 2026-09-07 Whole-Codebase Audit — Final Review) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 residual issues surfaced (but deliberately not fixed) by the final whole-plan review of `docs/superpowers/plans/2026-09-07-whole-codebase-audit-fixes.md`, at the user's explicit direction after seeing them explained.

**Architecture:** Four small, independent fixes. No shared code between them; each is its own task, its own commit.

**Tech Stack:** Next.js 14.2.35 (App Router), Prisma 5.22/Postgres, Zod, `@tanstack/react-query`, Upstash Redis (rate limiting), Cloudflare R2.

**Spec:** No separate spec doc — each task's own text below is the complete spec, written from direct investigation of the current live codebase on 2026-09-08 (every file read in full before writing this plan; no assumptions carried over from the original audit).

## Global Constraints

- Full test suite (`pnpm --filter web exec vitest run`) and `pnpm --filter web exec tsc --noEmit` must be clean after every task.
- **A full production build (`rm -rf apps/web/.next && pnpm --filter web build`) is REQUIRED after every task, no exceptions** — this is not optional and not skippable even for a task whose own text doesn't repeat it. This project's own recent history (`docs/superpowers/plans/2026-09-07-whole-codebase-audit-fixes.md`, Task 21) had a real production-build-breaking regression sit undetected for 15 tasks specifically because `vitest`+`tsc` alone were treated as sufficient. Do not repeat that mistake.
- TDD wherever the change is behavioral (all 4 tasks here are behavioral). RED then GREEN, every time.
- Each task is its own commit. Never combine unrelated fixes in one commit.
- Never touch files outside a task's stated scope.
- Where a task calls for a live/manual check, it is mandatory, not optional — state plainly in the report whether it was actually performed, and how (this project has no automated React-component-render test infrastructure, confirmed repeatedly — `vitest.config.ts` uses `environment: "node"`; live checks are the only way to verify UI-adjacent behavior).
- The user's explicit instruction for this plan: **"Be triple confident that you break nothing in the process of doing these 4 fixes."** Every task's implementer, the controller (independently, a second time), and a task reviewer (independently, a third time) must each separately confirm the full suite + tsc + production build are clean before a task is considered done.

---

### Task 1: Add rate limiting to `reset-password` and `setup-account`

Both are public, unauthenticated POST endpoints that run `bcrypt.hash(password, 10)` per request — a CPU-exhaustion vector with no cap today. `forgot-password` already has this exact protection; these two never got it. Mirror `forgot-password`'s established pattern exactly (`apps/web/src/app/api/auth/forgot-password/route.ts`).

**Files:**
- Modify: `apps/web/src/app/api/reset-password/route.ts`
- Modify: `apps/web/src/app/api/setup-account/route.ts`
- Test: `apps/web/src/__tests__/api/reset-password.test.ts` — check for existing coverage first
- Test: `apps/web/src/__tests__/api/setup-account.test.ts` — check for existing coverage first

**Interfaces:** none new — both routes' external request/response shape is unchanged for the success path; only a new 429 response is added for the rate-limited case.

- [ ] **Step 1: Check for existing test coverage**

```bash
ls apps/web/src/__tests__/api/ | grep -i "reset-password\|setup-account"
```

If files exist, read them fully first — they are the regression guard.

- [ ] **Step 2: Write the failing tests**

Add (or create, matching the mocking pattern already used elsewhere in this codebase for `publicFormRateLimit` — see `apps/web/src/__tests__/api/auth-forgot-password.test.ts` if it exists, or `apps/web/src/__tests__/api/leads.test.ts`'s rate-limit test as a reference for the mock shape):

```ts
vi.mock("@/lib/rate-limit", () => ({
  publicFormRateLimit: { limit: vi.fn() },
}));
```

```ts
import { publicFormRateLimit } from "@/lib/rate-limit";

it("returns 429 when rate limited", async () => {
  vi.mocked(publicFormRateLimit.limit).mockResolvedValue({ success: false, reset: Date.now() + 30000 } as any);

  const res = await POST(new Request("http://localhost/api/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: "abc", password: "password123" }),
  }));

  expect(res.status).toBe(429);
  expect(res.headers.get("Retry-After")).toBeTruthy();
});
```

(Same test, same shape, for `setup-account` — adjust the body to `{ token: "abc", password: "password123" }`, identical schema.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter web exec vitest run src/__tests__/api/reset-password.test.ts src/__tests__/api/setup-account.test.ts`
Expected: FAIL — neither route currently checks the rate limiter at all, so calling `POST` never even touches the mocked `publicFormRateLimit.limit`, and no 429 is ever returned.

- [ ] **Step 4: Add rate limiting to `reset-password/route.ts`**

Current file:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  token:    z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, password } = schema.parse(body);
```

Change to:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { publicFormRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  token:    z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

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
    console.error("[POST /api/reset-password] rate limiter unavailable, proceeding:", err);
  }

  try {
    const body = await req.json();
    const { token, password } = schema.parse(body);
```

(The rest of the function — the `try` block's body, the `catch` at the bottom — is completely unchanged. This is the exact same two-try-block structure `forgot-password` uses: an outer rate-limit check that fails open on limiter error, then the existing logic untouched.)

- [ ] **Step 5: Add rate limiting to `setup-account/route.ts`**

Identical change, same diff shape, in `apps/web/src/app/api/setup-account/route.ts` — same import added, same `ip`/rate-limit block inserted before the existing `try`, error log line reads `[POST /api/setup-account] rate limiter unavailable, proceeding:`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/__tests__/api/reset-password.test.ts src/__tests__/api/setup-account.test.ts`
Expected: PASS. Also re-run any pre-existing tests in these two files (valid token, expired token, password-too-short cases) to confirm no regression — the success path must still return 200 exactly as before when not rate-limited (default the mock to `{ success: true }` for those).

- [ ] **Step 7: Run the full suite, tsc, and a production build**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
rm -rf apps/web/.next && pnpm --filter web build
```

Expected: all three succeed.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/api/reset-password/route.ts apps/web/src/app/api/setup-account/route.ts apps/web/src/__tests__/api/reset-password.test.ts apps/web/src/__tests__/api/setup-account.test.ts
git commit -m "fix: add rate limiting to reset-password and setup-account, matching forgot-password"
```

---

### Task 2: Persist the "I am a" role field on Lead

`ContactModal.tsx` and the standalone `/contact` page form both collect a required `role` field (one of `ROLE_OPTIONS`: Agent, Buyer, Seller, Owner, Renter, Landlord, Property Manager) and send it in the POST body to `/api/leads`, but `createSchema` never declares it, so Zod silently strips it before it reaches `prisma.lead.create()` — every lead loses this information. Add a new nullable `visitorRole` column (named to avoid any confusion with the existing `Role` enum used for `User`/session roles, which is a completely different concept) and wire it through.

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: a new migration under `packages/database/prisma/migrations/`
- Modify: `apps/web/src/app/api/leads/route.ts`
- Test: `apps/web/src/__tests__/api/leads.test.ts` — extend

**Interfaces:** none new — this is additive (one new nullable column, one new optional schema field), no existing behavior changes for callers that don't send `role`.

- [ ] **Step 1: Add the column to `schema.prisma`**

In `packages/database/prisma/schema.prisma`, find the `Lead` model (around line 394) and add `visitorRole` next to the other free-text contact-context fields:

```prisma
model Lead {
  id          String     @id @default(cuid())
  firstName   String
  lastName    String
  email       String
  phone       String?
  status      LeadStatus @default(NEW)
  source      LeadSource @default(WEBSITE)
  score       Int        @default(0)
  notes       String?
  utmSource   String?
  utmMedium   String?
  utmCampaign String?
```

to:

```prisma
model Lead {
  id          String     @id @default(cuid())
  firstName   String
  lastName    String
  email       String
  phone       String?
  status      LeadStatus @default(NEW)
  source      LeadSource @default(WEBSITE)
  score       Int        @default(0)
  notes       String?
  visitorRole String?
  utmSource   String?
  utmMedium   String?
  utmCampaign String?
```

- [ ] **Step 2: Write the failing test**

Add to `apps/web/src/__tests__/api/leads.test.ts` (read the file first to match its exact existing mock setup for `POST` — it should already mock `prisma.lead.create`):

```ts
it("persists the visitor-selected role", async () => {
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
    }),
  }));

  expect(res.status).toBe(201);
  expect(prisma.lead.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ visitorRole: "Owner" }),
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/leads.test.ts`
Expected: FAIL — `role` is not in `createSchema`, so it's stripped and never reaches `data`.

- [ ] **Step 4: Update the schema and route**

In `apps/web/src/app/api/leads/route.ts`, change:

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
  role: z.string().optional(),
});
```

Then find where `data` is built for `prisma.lead.create` — it currently passes the parsed object directly:

```ts
    const data = createSchema.parse(body);
    const lead = await prisma.lead.create({ data });
```

Since `data.role` needs to map to the `visitorRole` column (different name), change to:

```ts
    const { role, ...rest } = createSchema.parse(body);
    const lead = await prisma.lead.create({ data: { ...rest, visitorRole: role } });
```

(Read the surrounding code first to confirm nothing else in this function reads `data` by that exact variable name in a way this rename would break — if it does, adjust the destructuring accordingly rather than blindly pasting this diff.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/leads.test.ts`
Expected: PASS.

- [ ] **Step 6: Generate and apply the migration**

```bash
pnpm --filter @cnc/database exec prisma migrate dev --name add_lead_visitor_role
```

Purely additive (one new nullable column on an existing table with data) — zero data-loss risk. If this fails with `EPERM`/DLL-lock (Windows dev-server lock on `query_engine-windows.dll.node`), stop the dev server first, retry, then restart it afterward.

- [ ] **Step 7: Run the full suite, tsc, and a production build**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
rm -rf apps/web/.next && pnpm --filter web build
```

Expected: all three succeed.

- [ ] **Step 8: Live end-to-end check — mandatory**

A dev server should be available (check `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`; if not responding, restart it: kill whatever's on port 3000, `nohup pnpm --filter web dev > /tmp/dev-server.log 2>&1 &`, poll with curl until 200). POST a real ContactModal-shaped payload directly:

```bash
curl -s -i -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Task2","lastName":"Verify","email":"task2-verify-role@example.com","role":"Owner","notes":"role persistence check","source":"WEBSITE","utmSource":"MANAGE_TEST"}'
```

Expect `201`. Then, via a one-off script run from `packages/database` (delete it immediately after), confirm the real `Lead` row has `visitorRole: "Owner"`, then delete that test lead. State plainly in the report whether this was performed and exactly what the row contained.

- [ ] **Step 9: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations apps/web/src/app/api/leads/route.ts apps/web/src/__tests__/api/leads.test.ts
git commit -m "fix: persist the visitor-selected role field on Lead (was silently dropped)"
```

---

### Task 3: Validate `r2Key` against the verified `fileId` in `POST /api/documents`

`POST /api/documents` accepts `r2Key`/`r2Url` verbatim from the client with no check that they actually correspond to the ownership-verified `fileId`. `buildR2Key()` (`apps/web/src/lib/r2.ts`) already builds keys in a deterministic, structured format — `transactions/${fileType}/${fileId}/${documentId}/${filename}` — every legitimately-issued key for a given file always starts with the same prefix. Validate the client-supplied `r2Key` starts with that exact prefix for the file being attached to; reject with 400 if not.

**Files:**
- Modify: `apps/web/src/app/api/documents/route.ts`
- Test: `apps/web/src/__tests__/api/documents.test.ts` — check for existing coverage first

**Interfaces:** none new — this is a stricter validation on an existing field, not a shape change. Every legitimate caller (the app's own `ChecklistPanel.tsx`, which always sends the `key` returned by `/api/upload-url`) is unaffected, since that key already has the correct prefix by construction.

- [ ] **Step 1: Check for existing test coverage**

```bash
ls apps/web/src/__tests__/api/ | grep "^documents"
```

Read the file fully if it exists.

- [ ] **Step 2: Write the failing test**

Add to `apps/web/src/__tests__/api/documents.test.ts` (match its exact existing mock setup — it should already mock `getFileAndVerifyAccess` and `prisma.fileDocument.create`):

```ts
it("rejects an r2Key that doesn't match the verified file's own key prefix", async () => {
  vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
  vi.mocked(getFileAndVerifyAccess).mockResolvedValue({ id: "f1", agentId: "a1" } as any);

  const res = await POST(new Request("http://localhost/api/documents", {
    method: "POST",
    body: JSON.stringify({
      fileType: "LISTING",
      fileId: "f1",
      name: "sneaky.pdf",
      r2Key: "transactions/listing/SOMEONE-ELSES-FILE-ID/doc123/sneaky.pdf",
      r2Url: "transactions/listing/SOMEONE-ELSES-FILE-ID/doc123/sneaky.pdf",
    }),
  }));

  expect(res.status).toBe(400);
  expect(prisma.fileDocument.create).not.toHaveBeenCalled();
});

it("accepts an r2Key that correctly matches the verified file's own key prefix", async () => {
  vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
  vi.mocked(getFileAndVerifyAccess).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
  vi.mocked(prisma.fileDocument.create).mockResolvedValue({ id: "doc1" } as any);
  vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);

  const res = await POST(new Request("http://localhost/api/documents", {
    method: "POST",
    body: JSON.stringify({
      fileType: "LISTING",
      fileId: "f1",
      name: "legit.pdf",
      r2Key: "transactions/listing/f1/doc123/legit.pdf",
      r2Url: "transactions/listing/f1/doc123/legit.pdf",
    }),
  }));

  expect(res.status).toBe(201);
});
```

(Adjust `SESSION_AGENT` to whatever fixture name this file's existing tests already use — read the file first.)

- [ ] **Step 3: Run tests to verify the rejection test fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/documents.test.ts`
Expected: the rejection test FAILS (currently returns 201, no validation exists); the acceptance test should already PASS (current code has no validation at all, so it never blocks a legitimate key either).

- [ ] **Step 4: Add the validation**

In `apps/web/src/app/api/documents/route.ts`, import `buildR2Key`:

```ts
import { getFileAndVerifyAccess } from "@/lib/api-auth";
```

to:

```ts
import { getFileAndVerifyAccess } from "@/lib/api-auth";
import { buildR2Key } from "@/lib/r2";
```

Then, right after the existing ownership check:

```ts
  const isListing = fileType === "LISTING";
  const file = await getFileAndVerifyAccess(
    isListing ? "listing" : "transaction",
    fileId,
    session.user.agentId,
    session.user.role
  );
  if (!file) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const doc = await prisma.fileDocument.create({
```

insert a prefix check between the ownership check and the create call:

```ts
  const isListing = fileType === "LISTING";
  const file = await getFileAndVerifyAccess(
    isListing ? "listing" : "transaction",
    fileId,
    session.user.agentId,
    session.user.role
  );
  if (!file) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // r2Key/r2Url come from the client — verify the key actually belongs to
  // THIS file (buildR2Key's format is deterministic: every key legitimately
  // issued by /api/upload-url for this exact file starts with this prefix),
  // so a caller can't register a document pointing at another file's real
  // R2 object just because they own *some* file to attach it to.
  const expectedPrefix = `transactions/${isListing ? "listing" : "transaction"}/${fileId}/`;
  if (!r2Key.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Invalid document key" }, { status: 400 });
  }

  const doc = await prisma.fileDocument.create({
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/__tests__/api/documents.test.ts`
Expected: PASS, both new tests, plus every pre-existing test in this file (a real, previously-uploaded document's key always has this exact prefix by construction via `/api/upload-url`, so no legitimate existing test should break — if one does, read it carefully, it may be using a fixture key that doesn't match this format, in which case fix the FIXTURE to use a realistic key shape, not the validation).

- [ ] **Step 6: Run the full suite, tsc, and a production build**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
rm -rf apps/web/.next && pnpm --filter web build
```

Expected: all three succeed.

- [ ] **Step 7: Live end-to-end check — mandatory, since this changes real upload behavior**

With a dev server running and using the test agent account (`claude-test-agent@cncrealtygroup.com` / `ClaudeTestAgent2026!` — if this credential no longer works, note that in the report rather than skipping the check), confirm the REAL document-upload flow still works end-to-end: call `GET /api/upload-url` for a real owned file to get a genuine `key`, then `POST /api/documents` with that exact key — must still succeed (201). Then confirm the rejection path live too: `POST /api/documents` with a fabricated `r2Key` that doesn't match the file's prefix — must be rejected (400). State plainly in the report whether this was performed and what each call returned.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/api/documents/route.ts apps/web/src/__tests__/api/documents.test.ts
git commit -m "fix: validate r2Key matches the verified fileId's own key prefix before creating a FileDocument"
```

---

### Task 4: Prevent Settings page background refetches from overwriting unsaved edits

`Providers.tsx` constructs `new QueryClient()` with stock defaults (`staleTime: 0`, `refetchOnWindowFocus: true`). The Settings page's two `useQuery` calls feed `useEffect`s that call `setAgentProfile`/`setLicenseInput` etc. whenever the query's `data` reference changes. Under stock defaults, tabbing away from and back to the Settings page can trigger a background refetch; if react-query's structural sharing doesn't preserve the object reference (not guaranteed in every case), the effect re-fires and silently overwrites whatever the user had typed but not yet saved. Scope this fix to ONLY the two Settings-page queries — do not touch the global `QueryClient` defaults, which are relied on elsewhere (Transactions/Tasks/Pipeline) and are out of scope here.

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`

**Interfaces:** none new — purely a per-query config change, no new props, no new functions.

This is a pure client-side behavior change with no automated test coverage possible (this codebase's `vitest.config.ts` uses `environment: "node"`, confirmed no React-component-render test infra exists anywhere in this project) — verification is tsc + full suite (nothing here should break either) + a mandatory live check.

- [ ] **Step 1: Read the current file in full**

Read `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx` to confirm the two `useQuery` calls still match what's below (they may have shifted line numbers or gained fields since this plan was written).

- [ ] **Step 2: Add per-query overrides**

Change:

```tsx
  const { data: accountProfile } = useQuery({
    queryKey: ["account", "profile"],
    queryFn: ({ signal }) => fetchAccountProfile(signal),
  });
```

to:

```tsx
  const { data: accountProfile } = useQuery({
    queryKey: ["account", "profile"],
    queryFn: ({ signal }) => fetchAccountProfile(signal),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
```

and change:

```tsx
  const { data: fetchedAgentProfile } = useQuery({
    queryKey: ["account", "agent-profile"],
    queryFn: ({ signal }) => fetchAgentProfile(signal),
  });
```

to:

```tsx
  const { data: fetchedAgentProfile } = useQuery({
    queryKey: ["account", "agent-profile"],
    queryFn: ({ signal }) => fetchAgentProfile(signal),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
```

Rationale to include as a one-line comment above each, if there isn't one already: a 5-minute `staleTime` means a background refetch (e.g. from window refocus, or revisiting the tab) won't re-fire within that window, and `refetchOnWindowFocus: false` removes the specific trigger most likely to interrupt an in-progress edit (switching tabs to check something, then coming back). The page's own "Save" buttons remain the only way the user's edits reach the server — this doesn't change save behavior at all, only when the read-side re-populates the form from a background fetch.

- [ ] **Step 3: Run the full suite, tsc, and a production build**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
rm -rf apps/web/.next && pnpm --filter web build
```

Expected: all three succeed (this change cannot affect any of them meaningfully, but confirm anyway per this plan's global constraint).

- [ ] **Step 4: Live check — mandatory**

With a dev server running, log in as the test agent, load `/dashboard/settings`, confirm the fields still populate correctly on initial load (unchanged behavior). Then specifically re-verify the save→reload round trip still works exactly as it did in the original plan's Task 10 verification (type a value into e.g. Location Served, click Save Changes, reload the page, confirm the saved value is still there) — this confirms the `staleTime` change didn't accidentally make the page serve stale data after a save. State plainly in the report whether this was performed.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/settings/page.tsx"
git commit -m "fix: prevent Settings page background refetches from overwriting unsaved edits"
```

---

## Final Self-Review Notes

**Spec coverage:** all 4 residual findings from the final whole-plan review of the 2026-09-07 audit-fixes plan are covered, one task each.

**Placeholder scan:** every step contains the actual current code being replaced and the actual new code — no TBD, no "add appropriate validation."

**Type consistency:** Task 2's `role`/`visitorRole` rename is used identically in both the schema change and the route change (the only two places it appears). Task 3's `expectedPrefix` construction matches `buildR2Key`'s actual format exactly, verified by reading `apps/web/src/lib/r2.ts` directly before writing this plan.
