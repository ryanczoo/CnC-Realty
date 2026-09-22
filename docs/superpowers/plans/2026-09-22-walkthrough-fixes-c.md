# Walkthrough Fixes C (input rules) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Required parties actually block Next on the New Transaction wizard's Parties step, the Title/Escrow/Attorney toggle stops losing data when switched, and every route that saves agent-typed text trims leading and trailing whitespace.

**Architecture:** One new pure function (`trimStrings`) applied at the top of ten routes; a wizard-only rewrite of the Parties step's gating, labels, and the escrow-contact state; no schema change.

**Tech Stack:** Next.js 14 App Router, Prisma 5, Vitest (node env, `src/**/*.test.ts`), Tailwind. No migration.

**Spec:** `docs/superpowers/specs/2026-09-22-walkthrough-fixes-c-design.md`

## Global Constraints

- Repo: `C:\Users\hey_r\Desktop\CnC-Realty`, branch `main`. Run all commands from `apps/web` (`npx vitest run <fragment>`, `npx tsc --noEmit`, which must stay at 0 errors).
- Every commit message ends with a blank line then `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`, **regardless of which model wrote the commit**. `git add` explicit paths only, quoting any path with `[`, `]`, or `(` in it. **Never push.**
- **Never run `next build` or start/stop/restart any dev server.** Ryan's dev server runs on :3000 and a build breaks it. The controller does the one production build at the end, with Ryan's OK.
- If `tsc` or a test fails, that is a stop-and-fix signal: fix the code or test, or report BLOCKED with the exact error. **Never edit `tsconfig.json` or any project config to silence an error**, and never recommend proceeding with a failing check.
- Never read `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx` whole (it is ~900 lines). Use grep and offset/limit reads; the tasks below give exact line anchors and full replacement code so this is never necessary.
- Tests go in `apps/web/src/__tests__/`, mirroring existing files. Test-first for every function and route: write the test, run it, see it fail for the stated reason, then implement.
- Whitespace trimming is server-side only (Ryan's decision) — no client-side `restrict` changes.
- The Parties step keeps both party sections visible for every side; only the label and which one gates Next change (Ryan's decision).
- The Title/Escrow/Attorney toggle stays a toggle; each of the three types keeps its own remembered fields, and any of the three with a name becomes its own party at Create (Ryan's decision).

## File Structure

| File | Responsibility |
|---|---|
| `lib/form-validation.ts` (modify) | Add `trimStrings` |
| 10 route files (modify) | Wrap `req.json()` with `trimStrings` |
| `new-transaction/page.tsx` (modify) | `canAdvance` Step 3 gate, party section labels, escrow-contact state, submit payload, Review rows |

All paths are under `apps/web/src/`.

---

### Task 1: `trimStrings`

**Files:**
- Modify: `apps/web/src/lib/form-validation.ts`
- Test: `apps/web/src/__tests__/lib/form-validation.test.ts` (append)

**Interfaces:**
- Produces: `trimStrings<T>(value: T): T` — trims every string, recursing into plain objects and arrays; leaves `null`, numbers, booleans, and `Date` instances untouched.

- [ ] **Step 1: Write the failing tests.** Add `trimStrings` to the import on line 2 of `apps/web/src/__tests__/lib/form-validation.test.ts` (it becomes `import { formatPhoneInput, isValidEmail, limitDigits, stripDigits, digitsOnly, trimStrings } from "@/lib/form-validation";`), then append:

```ts
describe("trimStrings", () => {
  it("trims a plain string", () => {
    expect(trimStrings("  hi  ")).toBe("hi");
  });

  it("trims every string value in a flat object", () => {
    expect(trimStrings({ name: "  Jane  ", city: "Irvine " })).toEqual({ name: "Jane", city: "Irvine" });
  });

  it("trims strings inside a nested object", () => {
    expect(trimStrings({ party: { name: " Jane " } })).toEqual({ party: { name: "Jane" } });
  });

  it("trims strings inside an array of objects, matching the parties payload shape", () => {
    const input = { parties: [{ role: "BUYER", name: " Jane " }, { role: "SELLER", name: "Bob  " }] };
    expect(trimStrings(input)).toEqual({ parties: [{ role: "BUYER", name: "Jane" }, { role: "SELLER", name: "Bob" }] });
  });

  it("leaves numbers, booleans, and null untouched", () => {
    expect(trimStrings({ n: 5, b: true, x: null })).toEqual({ n: 5, b: true, x: null });
  });

  it("leaves a Date instance untouched rather than trying to recurse into it", () => {
    const d = new Date("2026-09-22T00:00:00.000Z");
    const result = trimStrings({ when: d });
    expect(result.when).toBe(d);
  });

  it("does not mutate the object it was given", () => {
    const input = { name: "  Jane  " };
    trimStrings(input);
    expect(input.name).toBe("  Jane  ");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run form-validation`
Expected: FAIL, `trimStrings is not a function` (or `undefined`).

- [ ] **Step 3: Implement.** Append to `apps/web/src/lib/form-validation.ts`:

```ts
// Trims every string in a JSON-shaped value, recursing into plain objects and
// arrays; leaves numbers, booleans, null and Dates untouched. Applied once per
// route, right after parsing the request body, so no caller has to remember
// to trim any individual field.
export function trimStrings<T>(value: T): T {
  if (typeof value === "string") return value.trim() as unknown as T;
  if (Array.isArray(value)) return value.map(trimStrings) as unknown as T;
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = trimStrings(v);
    return out as T;
  }
  return value;
}
```

- [ ] **Step 4: Run and verify**

Run: `npx vitest run form-validation` → PASS (all). Run: `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/form-validation.ts apps/web/src/__tests__/lib/form-validation.test.ts
git commit -m "feat: trimStrings, so agent-typed text is trimmed once, on the server" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Trim on the four "simple body" routes (transactions, listings, parties add, parties edit)

**Files:**
- Modify: `apps/web/src/app/api/transactions/route.ts` (POST)
- Modify: `apps/web/src/app/api/listings/route.ts` (POST)
- Modify: `apps/web/src/app/api/files/[fileType]/[id]/parties/route.ts` (POST)
- Modify: `apps/web/src/app/api/files/[fileType]/[id]/parties/[partyId]/route.ts` (PATCH)
- Test: `apps/web/src/__tests__/api/trim-on-write.test.ts` (new)

**Interfaces:**
- Consumes: `trimStrings` from Task 1.

These four routes share the exact shape `const body = await req.json();` immediately followed by destructuring or direct use. In each, add `trimStrings` to that file's existing `@/lib/form-validation`-adjacent import block (a new import line, since none of them import from `form-validation` today) and change that one line to `const body = trimStrings(await req.json());`. No other line in any of the four files changes.

- [ ] **Step 1: Write the failing test** at `apps/web/src/__tests__/api/trim-on-write.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/api-auth", () => ({
  getFileAndVerifyAccess: vi.fn(),
  assertFileEditable: vi.fn(() => null),
  resolveFileRef: vi.fn(),
}));
vi.mock("@/lib/file-lock", () => ({ isFileReadOnlyFor: vi.fn(() => false) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    transactionFile: { create: vi.fn() },
    listingFile: { create: vi.fn() },
    checklistTemplate: { findFirst: vi.fn() },
    fileParty: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { getFileAndVerifyAccess, resolveFileRef } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST as postTransaction } from "../../app/api/transactions/route";
import { POST as postListing } from "../../app/api/listings/route";
import { POST as postParty } from "../../app/api/files/[fileType]/[id]/parties/route";
import { PATCH as patchParty } from "../../app/api/files/[fileType]/[id]/parties/[partyId]/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const json = (body: unknown) =>
  new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
  vi.mocked(getFileAndVerifyAccess).mockResolvedValue({ id: "f1", agentId: "a1", status: "PENDING" } as any);
  vi.mocked(resolveFileRef).mockReturnValue({ fileId: "f1", fileType: "transaction" } as any);
  vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tx1" } as any);
  vi.mocked(prisma.listingFile.create).mockResolvedValue({ id: "lf1" } as any);
  vi.mocked(prisma.fileParty.create).mockResolvedValue({ id: "p1" } as any);
  vi.mocked(prisma.fileParty.update).mockResolvedValue({ id: "p1" } as any);
  vi.mocked(prisma.fileParty.findUnique).mockResolvedValue({ id: "p1", transactionFileId: "f1", listingFileId: null } as any);
  vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
});

describe("whitespace is trimmed before a write", () => {
  it("POST /api/transactions trims propertyAddress and a nested party name", async () => {
    await postTransaction(json({
      transactionSide: "PURCHASE", propertyAddress: "  1 Main St  ", city: " Irvine ", zip: " 92603 ",
      propertyType: "Single Family", mlsNumber: "1234567890",
      parties: [{ role: "BUYER", name: "  Jane Buyer  " }],
    }));
    const data = vi.mocked(prisma.transactionFile.create).mock.calls[0][0].data as any;
    expect(data.propertyAddress).toBe("1 Main St");
    expect(data.city).toBe("Irvine");
    expect(data.parties.create[0].name).toBe("Jane Buyer");
  });

  it("POST /api/listings trims propertyAddress", async () => {
    await postListing(json({
      propertyAddress: "  1 Main St  ", city: "Irvine", zip: "92603", listPrice: "500000", listingType: "RESIDENTIAL_SALE",
    }));
    const data = vi.mocked(prisma.listingFile.create).mock.calls[0][0].data as any;
    expect(data.propertyAddress).toBe("1 Main St");
  });

  it("POST party trims name and company", async () => {
    await postParty(json({ role: "BUYER", name: "  Jane  ", company: " Acme  " }), { params: { fileType: "transaction", id: "f1" } });
    const data = vi.mocked(prisma.fileParty.create).mock.calls[0][0].data as any;
    expect(data.name).toBe("Jane");
    expect(data.company).toBe("Acme");
  });

  it("PATCH party trims name", async () => {
    await patchParty(json({ name: "  Jane  " }), { params: { fileType: "transaction", id: "f1", partyId: "p1" } });
    const data = vi.mocked(prisma.fileParty.update).mock.calls[0][0].data as any;
    expect(data.name).toBe("Jane");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run trim-on-write`
Expected: FAIL on all four, values still carry their surrounding whitespace.

- [ ] **Step 3: Edit the four routes.** In each, add `import { trimStrings } from "@/lib/form-validation";` to the import block, and change the body-parsing line:

`transactions/route.ts` line 30: `const body = await req.json();` → `const body = trimStrings(await req.json());`

`listings/route.ts` line 30: same change.

`files/[fileType]/[id]/parties/route.ts` line 20: same change.

`files/[fileType]/[id]/parties/[partyId]/route.ts` line 30 (inside `PATCH`): same change.

- [ ] **Step 4: Run and verify**

Run: `npx vitest run trim-on-write` → PASS (4). Run: `npx vitest run api` → PASS (existing tests for these four routes are unaffected — trimming untrimmed test fixtures is a no-op). Run: `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/transactions/route.ts apps/web/src/app/api/listings/route.ts "apps/web/src/app/api/files/[fileType]/[id]/parties/route.ts" "apps/web/src/app/api/files/[fileType]/[id]/parties/[partyId]/route.ts" apps/web/src/__tests__/api/trim-on-write.test.ts
git commit -m "fix: trim whitespace when creating a file or adding/editing a party" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Trim on the two PATCH-a-file routes

**Files:**
- Modify: `apps/web/src/app/api/transactions/[id]/route.ts` (PATCH only)
- Modify: `apps/web/src/app/api/listings/[id]/route.ts` (PATCH only)
- Test: `apps/web/src/__tests__/api/trim-on-write-patch.test.ts` (new)

**Interfaces:**
- Consumes: `trimStrings` from Task 1.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendFileClosed: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    transactionFile: { findUnique: vi.fn(), update: vi.fn() },
    listingFile: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PATCH as patchTransaction } from "../../app/api/transactions/[id]/route";
import { PATCH as patchListing } from "../../app/api/listings/[id]/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const json = (body: unknown) =>
  new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
});

describe("PATCH trims whitespace before writing field data", () => {
  it("transactions", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status: "PENDING" } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "tf1" } as any);
    await patchTransaction(json({ commissionNotes: "  fixed  " }), { params: { id: "tf1" } });
    const data = vi.mocked(prisma.transactionFile.update).mock.calls[0][0].data as any;
    expect(data.commissionNotes).toBe("fixed");
  });

  it("listings", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status: "ACTIVE" } as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1" } as any);
    await patchListing(json({ commissionNotes: "  fixed  " }), { params: { id: "lf1" } });
    const data = vi.mocked(prisma.listingFile.update).mock.calls[0][0].data as any;
    expect(data.commissionNotes).toBe("fixed");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run trim-on-write-patch`
Expected: FAIL on both, `commissionNotes` still carries whitespace.

- [ ] **Step 3: Edit the two routes.** Add `import { trimStrings } from "@/lib/form-validation";` to each file's imports.

`transactions/[id]/route.ts` line 41 (inside `PATCH`): `const body = await req.json();` → `const body = trimStrings(await req.json());`

`listings/[id]/route.ts` line 41 (inside `PATCH`): same change.

- [ ] **Step 4: Run and verify**

Run: `npx vitest run trim-on-write-patch` → PASS. Run: `npx vitest run api` → PASS (sub-project B's PATCH tests are unaffected — untrimmed fixtures pass through the trim as a no-op). Run: `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/api/transactions/[id]/route.ts" "apps/web/src/app/api/listings/[id]/route.ts" apps/web/src/__tests__/api/trim-on-write-patch.test.ts
git commit -m "fix: trim whitespace when a file's fields are edited" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Trim on tasks, notes, and conditions

**Files:**
- Modify: `apps/web/src/app/api/file-tasks/route.ts` (POST)
- Modify: `apps/web/src/app/api/file-tasks/[taskId]/route.ts` (PATCH)
- Modify: `apps/web/src/app/api/files/[fileType]/[id]/note/route.ts` (POST)
- Modify: `apps/web/src/app/api/transactions/[id]/conditions/route.ts` (POST)
- Test: `apps/web/src/__tests__/api/trim-on-write-misc.test.ts` (new)

**Interfaces:**
- Consumes: `trimStrings` from Task 1.

`trimStrings(null)` returns `null` unchanged (the top-level `if` chain in Task 1's implementation falls through to `return value;` for `null`, since the object branch explicitly excludes it), which is why the conditions route's `.catch(() => null)` shape is safe to wrap.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/api-auth", () => ({
  getFileAndVerifyAccess: vi.fn(),
  assertFileEditable: vi.fn(() => null),
  checkOwnership: vi.fn(),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fileTask: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    fileActivity: { create: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
    fileCondition: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { getFileAndVerifyAccess, checkOwnership, requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST as postTask } from "../../app/api/file-tasks/route";
import { POST as postNote } from "../../app/api/files/[fileType]/[id]/note/route";
import { POST as postCondition } from "../../app/api/transactions/[id]/conditions/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const json = (body: unknown) =>
  new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
  vi.mocked(getFileAndVerifyAccess).mockResolvedValue({ id: "f1", agentId: "a1", status: "PENDING" } as any);
  vi.mocked(checkOwnership).mockReturnValue({ exists: true, forbidden: false, record: { id: "tf1", agentId: "a1", status: "PENDING" } } as any);
  vi.mocked(requireAuth).mockResolvedValue({ session: AGENT, error: null } as any);
  vi.mocked(prisma.fileTask.create).mockResolvedValue({ id: "t1" } as any);
  vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status: "PENDING" } as any);
  vi.mocked(prisma.fileCondition.create).mockResolvedValue({ id: "c1" } as any);
});

describe("whitespace is trimmed on tasks, notes, and conditions", () => {
  it("POST /api/file-tasks trims assigneeName even without its own inline .trim()", async () => {
    await postTask(json({ fileType: "transaction", fileId: "f1", title: "Call lender", assigneeName: "  Ann  " }));
    const data = vi.mocked(prisma.fileTask.create).mock.calls[0][0].data as any;
    expect(data.assigneeName).toBe("Ann");
  });

  it("POST note trims the note text", async () => {
    await postNote(json({ note: "  call back  " }), { params: { fileType: "transaction", id: "f1" } });
    const data = vi.mocked(prisma.fileActivity.create).mock.calls[0][0].data as any;
    expect(data.note).toBe("call back");
  });

  it("POST condition trims name and notes", async () => {
    await postCondition(json({ name: "  Inspection  ", notes: " ok " }), { params: { id: "tf1" } });
    const data = vi.mocked(prisma.fileCondition.create).mock.calls[0][0].data as any;
    expect(data.name).toBe("Inspection");
    expect(data.notes).toBe("ok");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run trim-on-write-misc`
Expected: the note and condition tests FAIL (untrimmed). The task test may already PASS, because `file-tasks/route.ts` already does `assigneeName?.trim() || null` inline — confirm this in the output rather than assuming; either way Step 3 still wraps the parse for consistency and to trim `title` and `fileId`-adjacent fields uniformly with every other route.

- [ ] **Step 3: Edit the four routes.** Add `import { trimStrings } from "@/lib/form-validation";` to each file's imports.

`file-tasks/route.ts` line 36 (inside `POST`, inside the try): `try { body = await req.json(); } catch { ... }` → `try { body = trimStrings(await req.json()); } catch { ... }`

`file-tasks/[taskId]/route.ts` line 28 (inside `PATCH`, inside the try): same change: `try { body = await req.json(); } catch { ... }` → `try { body = trimStrings(await req.json()); } catch { ... }`

`files/[fileType]/[id]/note/route.ts` line 25: `const { note } = await req.json();` → `const { note } = trimStrings(await req.json());`

`transactions/[id]/conditions/route.ts` line 34 (inside `POST`): `const body = await req.json().catch(() => null);` → `const body = trimStrings(await req.json().catch(() => null));`

- [ ] **Step 4: Run and verify**

Run: `npx vitest run trim-on-write-misc` → PASS (3). Run: `npx vitest run api` → PASS. Run: `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/file-tasks/route.ts "apps/web/src/app/api/file-tasks/[taskId]/route.ts" "apps/web/src/app/api/files/[fileType]/[id]/note/route.ts" "apps/web/src/app/api/transactions/[id]/conditions/route.ts" apps/web/src/__tests__/api/trim-on-write-misc.test.ts
git commit -m "fix: trim whitespace on tasks, notes, and conditions" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Required parties gate the Parties step, with side-appropriate labels

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx`

**Interfaces:**
- No new exports; this is UI-only. No component-render test infrastructure exists in this project, so this task is verified with `tsc`, the full suite (to confirm nothing else broke), and a live check with Ryan.

- [ ] **Step 1: Locate the exact lines.** Run `grep -n "const canAdvance\|PartySection label=\"Buyers\"\|PartySection label=\"Sellers\"\|function PartySection" "apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx"` to confirm the line numbers below still match (the file has not changed since this plan was written, but confirm before editing).

- [ ] **Step 2: Add the required-parties helper, right above `canAdvance`.** Find (near line 111):

```tsx
  const canAdvance = useMemo(() => {
```

Insert immediately before it:

```tsx
  // Which party section gates Next on Step 3, mirroring how the agent
  // always knows the side they represent when the file is created.
  const partiesReady = useMemo(() => {
    const hasBuyer = buyers.some((b) => b.name);
    const hasSeller = sellers.some((s) => s.name);
    switch (form.transactionSide) {
      case "PURCHASE":
      case "LEASE_TENANT":
        return hasBuyer;
      case "LISTING":
      case "LEASE_LANDLORD":
        return hasSeller;
      case "DUAL":
      case "LEASE_DUAL":
        return hasBuyer && hasSeller;
      default:
        return true;
    }
  }, [form.transactionSide, buyers, sellers]);

```

- [ ] **Step 3: Change `canAdvance`'s Step 3 case.** Find (the `canAdvance` body, near line 111-116):

```tsx
  const canAdvance = useMemo(() => {
    if (step === 0) return isReferral ? !!form.transactionSide : (!!form.transactionSide && !!form.propertyCategory);
    if (step === 1) return isReferral ? !!form.referredToAgentName : (!!form.propertyAddress && !!form.city && !!form.zip && !!form.propertyType && !!form.mlsNumber);
    if (step === 2) return isLeaseSide ? !!form.leasePrice : !!form.salePrice;
    return true;
  }, [step, isReferral, form.transactionSide, form.propertyCategory, form.referredToAgentName, form.propertyAddress, form.city, form.zip, form.propertyType, form.mlsNumber, form.salePrice, form.leasePrice]);
```

Replace with:

```tsx
  const canAdvance = useMemo(() => {
    if (step === 0) return isReferral ? !!form.transactionSide : (!!form.transactionSide && !!form.propertyCategory);
    if (step === 1) return isReferral ? !!form.referredToAgentName : (!!form.propertyAddress && !!form.city && !!form.zip && !!form.propertyType && !!form.mlsNumber);
    if (step === 2) return isLeaseSide ? !!form.leasePrice : !!form.salePrice;
    if (step === 3) return partiesReady;
    return true;
  }, [step, isReferral, form.transactionSide, form.propertyCategory, form.referredToAgentName, form.propertyAddress, form.city, form.zip, form.propertyType, form.mlsNumber, form.salePrice, form.leasePrice, partiesReady]);
```

(`partiesReady` is defined above `canAdvance` per Step 2, so this reference is valid; `useMemo`'s own dependency array does not need to be exhaustive of `partiesReady`'s own dependencies, only to include `partiesReady` itself, which it now does.)

- [ ] **Step 4: Change the two section labels.** Find (Step 3 render, near line 438-439):

```tsx
            <PartySection label="Buyers" parties={buyers} onUpdate={setBuyers} />
            <PartySection label="Sellers" parties={sellers} onUpdate={setSellers} />
```

Replace with:

```tsx
            <PartySection label={isLeaseSide ? "Tenants" : "Buyers"} parties={buyers} onUpdate={setBuyers} />
            <PartySection label={isLeaseSide ? "Landlords" : "Sellers"} parties={sellers} onUpdate={setSellers} />
```

(`isLeaseSide` is already defined earlier in the component — `const isLeaseSide = ["LEASE_TENANT", "LEASE_LANDLORD", "LEASE_DUAL"].includes(form.transactionSide);` — and `PartySection`'s existing `singular = label.slice(0, -1)` already turns "Tenants" into "Tenant" and "Landlords" into "Landlord" with no change to `PartySection` itself.)

- [ ] **Step 5: Run and verify**

Run: `npx tsc --noEmit` → 0. Run: `npx vitest run` (full suite) → PASS (no test in this project renders this component, so nothing new is expected to fail).

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx"
git commit -m "feat: require a party per side before leaving the Parties step, with matching section labels" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Title/Escrow/Attorney — one toggle, three remembered contacts

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx`

**Interfaces:**
- Consumes: `EscrowContactType` (already exported from `@/lib/transaction-helpers`), `escrowTypeToRole` (already imported in this file).
- No new exports; UI-only, same verification approach as Task 5.

This task replaces every use of the current single `titleEscrow` state (declared once, at the wizard's top-level state, referenced in the render, the submit payload, and the Review step) with three independent contacts plus a separate "which one is on screen" state. Do the four edits in this order.

- [ ] **Step 1: Widen the import.** Find (near line 9):

```tsx
import { escrowTypeToRole } from "@/lib/transaction-helpers";
```

Replace with:

```tsx
import { escrowTypeToRole, type EscrowContactType } from "@/lib/transaction-helpers";
```

- [ ] **Step 2: Replace the state declaration.** Find (near line 74):

```tsx
  const [titleEscrow, setTitleEscrow] = useState<TitleEscrowParty>({ ...emptyParty(), contactType: "Escrow" });
```

Replace with:

```tsx
  // One set of fields per contact type, so switching the toggle never loses what
  // was typed for the other types. Any of the three with a name becomes its own
  // party at Create.
  const [escrowContacts, setEscrowContacts] = useState<Record<EscrowContactType, Party>>({
    Title: emptyParty(), Escrow: emptyParty(), Attorney: emptyParty(),
  });
  const [activeEscrowType, setActiveEscrowType] = useState<EscrowContactType>("Escrow");
```

(The `TitleEscrowParty` type near line 31 — `type TitleEscrowParty = Party & { contactType: "Title" | "Escrow" | "Attorney" };` — becomes unused after this change. Leave it in place for this step; Step 5 removes it once every usage is gone, so `tsc` only reports it as unused between steps, never as a hard error, and Step 5's removal is the one place to verify no other reference survived.)

- [ ] **Step 3: Rewrite the render section.** Find (the whole "Title / Escrow / Attorney" block, near line 455-475):

```tsx
            {/* Title / Escrow / Attorney */}
            <div>
              <p className="mb-3 text-sm font-semibold text-[#1B1B1B]/60">Title / Escrow / Attorney</p>
              <div className="mb-4 flex gap-2">
                {(["Title", "Escrow", "Attorney"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setTitleEscrow((a) => ({ ...a, contactType: type }))}
                    className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${titleEscrow.contactType === type ? "bg-[#1B1B1B] text-white" : "bg-[#F2F0EF] text-[#1B1B1B]/60 hover:text-[#1B1B1B]"}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" value={titleEscrow.name} onChange={(v) => setTitleEscrow((a) => ({ ...a, name: v }))} />
                <Field label="Email" type="email" value={titleEscrow.email} onChange={(v) => setTitleEscrow((a) => ({ ...a, email: v }))} />
                <Field label="Phone" type="tel" value={titleEscrow.phone} onChange={(v) => setTitleEscrow((a) => ({ ...a, phone: v }))} />
                <Field label="Company" value={titleEscrow.company} onChange={(v) => setTitleEscrow((a) => ({ ...a, company: v }))} />
              </div>
            </div>
```

Replace with:

```tsx
            {/* Title / Escrow / Attorney — the toggle only changes which type's fields
                are on screen; each type keeps its own values underneath. */}
            <div>
              <p className="mb-3 text-sm font-semibold text-[#1B1B1B]/60">Title / Escrow / Attorney</p>
              <div className="mb-4 flex gap-2">
                {(["Title", "Escrow", "Attorney"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setActiveEscrowType(type)}
                    className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${activeEscrowType === type ? "bg-[#1B1B1B] text-white" : "bg-[#F2F0EF] text-[#1B1B1B]/60 hover:text-[#1B1B1B]"}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" value={escrowContacts[activeEscrowType].name} onChange={(v) => setEscrowContacts((c) => ({ ...c, [activeEscrowType]: { ...c[activeEscrowType], name: v } }))} />
                <Field label="Email" type="email" value={escrowContacts[activeEscrowType].email} onChange={(v) => setEscrowContacts((c) => ({ ...c, [activeEscrowType]: { ...c[activeEscrowType], email: v } }))} />
                <Field label="Phone" type="tel" value={escrowContacts[activeEscrowType].phone} onChange={(v) => setEscrowContacts((c) => ({ ...c, [activeEscrowType]: { ...c[activeEscrowType], phone: v } }))} />
                <Field label="Company" value={escrowContacts[activeEscrowType].company} onChange={(v) => setEscrowContacts((c) => ({ ...c, [activeEscrowType]: { ...c[activeEscrowType], company: v } }))} />
              </div>
            </div>
```

- [ ] **Step 4: Rewrite the submit payload.** Find (in `submit()`, near line 160-162):

```tsx
      ...(titleEscrow.name
        ? [{ role: escrowTypeToRole(titleEscrow.contactType), ...titleEscrow }]
        : []),
```

Replace with:

```tsx
      ...(["Title", "Escrow", "Attorney"] as const)
        .filter((t) => escrowContacts[t].name)
        .map((t) => ({ role: escrowTypeToRole(t), ...escrowContacts[t] })),
```

- [ ] **Step 5: Rewrite the Review step row, and remove the now-unused type.** Find (Review step, near line 671):

```tsx
              {titleEscrow.name && <ReviewRow label={titleEscrow.contactType} value={titleEscrow.name} />}
```

Replace with:

```tsx
              {(["Title", "Escrow", "Attorney"] as const)
                .filter((t) => escrowContacts[t].name)
                .map((t) => <ReviewRow key={t} label={t} value={escrowContacts[t].name} />)}
```

Then find and delete the now-fully-unused type declaration (near line 31):

```tsx
type TitleEscrowParty = Party & { contactType: "Title" | "Escrow" | "Attorney" };
```

Confirm with `grep -n "TitleEscrowParty" "apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx"` that no reference remains before running `tsc` (there should be exactly zero matches after this deletion).

- [ ] **Step 6: Run and verify**

Run: `npx tsc --noEmit` → 0 (this also confirms `TitleEscrowParty`'s removal left nothing dangling). Run: `npx vitest run` (full suite) → PASS.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx"
git commit -m "feat: Title/Escrow/Attorney each keep their own fields; any filled-in type is saved as its own party" -m "" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Final checks and live check (controller only)

**Files:** none modified unless verification finds a gap.

- [ ] **Step 1: Full verification.** From `apps/web`: `npx tsc --noEmit` (0 errors) and `npx vitest run` (all pass; note the new total against B's 1264).

- [ ] **Step 2: Grep sweep — confirm every intended route was touched and nothing else changed.**

```bash
grep -rln "trimStrings" apps/web/src/app/api --include=route.ts
```

Expected: exactly the 10 files this plan named (`transactions/route.ts`, `listings/route.ts`, `transactions/[id]/route.ts`, `listings/[id]/route.ts`, `files/[fileType]/[id]/parties/route.ts`, `files/[fileType]/[id]/parties/[partyId]/route.ts`, `file-tasks/route.ts`, `file-tasks/[taskId]/route.ts`, `files/[fileType]/[id]/note/route.ts`, `transactions/[id]/conditions/route.ts`). If any is missing, that task's Step 3 was not completed — go back and finish it before proceeding; do not patch it ad hoc here.

- [ ] **Step 3: Production build (needs Ryan's OK).** Ask Ryan to approve stopping the dev server on :3000. Then `rm -rf apps/web/.next && pnpm --filter web build` (exit 0), delete `apps/web/.next`, restart `pnpm --filter web dev`, confirm `/login` returns 200. Report each result.

- [ ] **Step 4: Live check with Ryan**, one purchase and one lease side (his own words: "one pass per side: Purchase, Listing, Dual, a lease side" — cover as many as time allows, Purchase and one lease side at minimum):
  1. On the Parties step for a Purchase, leave Buyer empty — Next stays disabled. Fill in a Buyer name — Next enables. The Seller section still says "Sellers" and is not required.
  2. On a Lease Tenant (or Lease Landlord) side, confirm the section labels read "Tenants"/"Landlords" and the correct one gates Next.
  3. On the Title/Escrow/Attorney toggle: type a name under Attorney, switch to Escrow, type a different name, switch back to Attorney — the Attorney name is still there. Click Create with both filled in; the new file's Parties tab shows both an Attorney and an Escrow party, each with the right name.
  4. Type a name with leading or trailing spaces into any field that reaches the server (a party name, a task title, a note) — confirm the saved value has no extra spaces, either in the UI after a refresh or by checking the record.

- [ ] **Step 5: Commit any sweep fixes** (none expected).
