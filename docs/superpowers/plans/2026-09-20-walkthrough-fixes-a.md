# Walkthrough Fixes A — Display and Wording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 12 display, wording and list issues found during the live Purchase-transaction walkthrough (toggle knob, dates a day early, escrow company overwritten, popup, spinners, admin list links/price/scope, email wording, activity detail, parties columns).

**Architecture:** Small pure helpers (date-only formatter, display-price picker, escrow-role mapper, activity-detail describer) are written test-first and reused by the pages. Two tiny new UI primitives (`Spinner`, `Tooltip`) are added because the codebase has neither. One new admin-only route lists every agent's files. One additive Prisma enum migration adds three party roles.

**Tech Stack:** Next.js 14 (App Router, client components), TypeScript, Prisma 5 (Postgres/Neon), Tailwind, lucide-react, Vitest 4 (node environment, `src/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-09-20-walkthrough-fixes-a-design.md`

## Global Constraints

- No new dependencies. `Tooltip` is plain CSS; `Spinner` wraps the already-installed `lucide-react` `Loader2`.
- `formatDate` in `apps/web/src/lib/utils.ts` must keep its current local-time behavior (it formats real timestamps). Only date-only fields move to the new `formatDateOnly`.
- Not in scope, do not touch: the New Listing "Listing Type" dropdown (#5), the global form-field text color (#16), and every item belonging to sub-projects B, C and D (submit-error messages, non-fatal emails, checklist row picking the newest document, status dropdown filtering, closed-file lock, parties rule, whitespace trimming, commission redesign).
- Commit messages end with a blank line then `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Use `git add` with explicit file paths. **Do not push.**
- Shell is Git Bash on Windows. Run `vitest` and `tsc` from `C:\Users\hey_r\Desktop\CnC-Realty\apps\web`: `npx vitest run <name-fragment>` and `npx tsc --noEmit` (baseline: 0 errors, must stay 0).
- The database is the shared Neon database (local dev and production share it). Only Task 9 touches it, and only the controller (not a subagent) runs it, after asking Ryan.
- A dev server is running in the background on port 3000. Do not run `next build` while it runs (Task 13 handles that with Ryan's OK).
- Pre-existing uncommitted edits exist in `new-transaction/page.tsx` (centered heading and card text) and `DocumentReviewCard.tsx` (black text in the reason box). Task 1 commits them; do not revert them.

---

### Task 1: Commit finished edits and fix the toggle knob (#6, #3)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx` (knob span, around line 570)
- Commit as-is: `apps/web/src/components/transactions/DocumentReviewCard.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Confirm exactly what is uncommitted**

Run: `git -C /c/Users/hey_r/Desktop/CnC-Realty status --short`
Expected: exactly these two lines (plus nothing else):
```
 M apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx
 M apps/web/src/components/transactions/DocumentReviewCard.tsx
```

- [ ] **Step 2: Type-check, then commit the two finished edits**

Run: `cd /c/Users/hey_r/Desktop/CnC-Realty/apps/web && npx tsc --noEmit` — Expected: no output, exit 0.

```bash
cd /c/Users/hey_r/Desktop/CnC-Realty
git add "apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx" apps/web/src/components/transactions/DocumentReviewCard.tsx
git commit -m "$(cat <<'EOF'
style: center the New Transaction type screen and use black text in the rejection reason box

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Fix the knob**

The knob `<span>` is `absolute` with a translate but no left anchor, so it sits in the middle of the button (off looks on; on overflows the 44px track). In `new-transaction/page.tsx`, replace:

```tsx
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
```
with:
```tsx
                <span
                  className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
```
(Only this one toggle has the bug; `ActionPlanDetailDrawer.tsx` builds its knob differently and is left alone.)

- [ ] **Step 4: Type-check and commit**

Run: `npx tsc --noEmit` — Expected: exit 0.
```bash
cd /c/Users/hey_r/Desktop/CnC-Realty
git add "apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx"
git commit -m "$(cat <<'EOF'
fix: anchor the TC toggle knob so the on and off states render correctly

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `formatDateOnly` helper (#8, part 1)

**Files:**
- Create: `apps/web/src/__tests__/lib/utils.test.ts`
- Modify: `apps/web/src/lib/utils.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `formatDateOnly(d: Date | string, options?: Intl.DateTimeFormatOptions): string` exported from `@/lib/utils`. Default output is US `M/D/YYYY`. Always formats in UTC.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/lib/utils.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { formatDateOnly, formatDate } from "@/lib/utils";

// Reproduce the California bug: date-only fields are stored as UTC midnight and
// were rendered in local time, which is the previous evening in Pacific time.
process.env.TZ = "America/Los_Angeles";

describe("formatDateOnly", () => {
  it("environment check: plain local formatting shifts a UTC-midnight date back one day (the bug)", () => {
    expect(new Date("2026-09-21T00:00:00.000Z").toLocaleDateString("en-US")).toBe("9/20/2026");
  });

  it("shows the stored calendar day, not the previous evening", () => {
    expect(formatDateOnly("2026-09-21T00:00:00.000Z")).toBe("9/21/2026");
  });

  it("accepts a Date object", () => {
    expect(formatDateOnly(new Date("2026-10-02T00:00:00.000Z"))).toBe("10/2/2026");
  });

  it("supports custom formatting options", () => {
    expect(formatDateOnly("2026-10-22T00:00:00.000Z", { month: "short", year: "numeric" })).toBe("Oct 2026");
    expect(formatDateOnly("2026-10-02T00:00:00.000Z", { weekday: "long", month: "long", day: "numeric" })).toBe("Friday, October 2");
  });

  it("does not slip a month boundary (Nov 1 stays November)", () => {
    expect(formatDateOnly("2026-11-01T00:00:00.000Z", { month: "short", year: "numeric" })).toBe("Nov 2026");
  });
});

describe("formatDate (unchanged behavior)", () => {
  it("still formats real timestamps in local time", () => {
    expect(formatDate("2026-09-21T02:00:00.000Z")).toBe("Sep 20, 2026");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd /c/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run lib/utils`
Expected: the `formatDateOnly` tests FAIL (`formatDateOnly is not a function`). The "environment check" and `formatDate` tests should PASS — if the environment check fails, the timezone override is not being honored on this machine; stop and report instead of continuing.

- [ ] **Step 3: Implement**

In `apps/web/src/lib/utils.ts`, directly after `formatDate`, add:
```ts
// Date-only fields (offer date, deadlines, close of escrow…) are stored as UTC
// midnight, so they must be formatted in UTC. Formatting them in local time
// shows the previous day in California. Use formatDate for real timestamps.
export function formatDateOnly(
  d: Date | string,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "numeric", day: "numeric" }
): string {
  return new Date(d).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}
```

- [ ] **Step 4: Run and confirm it passes**

Run: `npx vitest run lib/utils` — Expected: all tests PASS.

- [ ] **Step 5: Commit**
```bash
cd /c/Users/hey_r/Desktop/CnC-Realty
git add apps/web/src/lib/utils.ts apps/web/src/__tests__/lib/utils.test.ts
git commit -m "$(cat <<'EOF'
feat: add formatDateOnly for date-only fields stored as UTC midnight

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Use `formatDateOnly` on every date-only field (#8, part 2)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx`
- Modify: `apps/web/src/components/transactions/FileCard.tsx` (COE line only)
- Modify: `apps/web/src/components/agents/AgentTransactionsSection.tsx` (line 31)
- Modify: `apps/web/src/app/(dashboard)/admin/page.tsx` (line 175)
- Modify: `apps/web/src/lib/deadline-email.ts` (lines 35–39)

**Interfaces:**
- Consumes: `formatDateOnly` from `@/lib/utils` (Task 2).
- Produces: nothing new.

- [ ] **Step 1: File detail page — replace only the date-only fields with a guarded `sed`**

The pattern is limited to the named fields so real timestamps (`doc.uploadedAt`) are not touched.
```bash
cd /c/Users/hey_r/Desktop/CnC-Realty/apps/web/src
F="app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx"
sed -i -E 's/new Date\(((listing|transaction|c|task)\.(listDate|expirationDate|dateReferred|offerDate|acceptanceDate|inspectionDeadline|appraisalDeadline|loanApprovalDeadline|closeOfEscrow|offerExpirationDate|finalWalkthroughDate|possessionDate|dueDate))\)\.toLocaleDateString\(\)/formatDateOnly(\1)/g' "$F"
grep -n "toLocaleDateString" "$F"
```
Expected from the grep: exactly ONE remaining line, the document table's `new Date(doc.uploadedAt).toLocaleDateString()` (a real timestamp). Any other remaining line means the sed missed a field: fix it by hand using `formatDateOnly(<value>)`.

Add the import near the other `@/lib` imports at the top of that file (after `import { TC_FEE, calcNetToAgent } from "@/lib/commission";`):
```tsx
import { formatDateOnly } from "@/lib/utils";
```
Also report (do not fix here) how `isOverdue` is computed for file tasks: if it compares `new Date(task.dueDate)` to `new Date()` in local time, a task will show overdue on the evening before its due date. That belongs to a later sub-project.

- [ ] **Step 2: `FileCard` close-of-escrow line**

In `apps/web/src/components/transactions/FileCard.tsx` replace:
```tsx
        <p className="text-xs text-[#1B1B1B]/50">COE: {new Date(closeDate).toLocaleDateString()}</p>
```
with:
```tsx
        <p className="text-xs text-[#1B1B1B]/50">COE: {formatDateOnly(closeDate)}</p>
```
and add `import { formatDateOnly } from "@/lib/utils";` under the existing imports.

- [ ] **Step 3: Public agent page "Closed <month year>"**

In `apps/web/src/components/agents/AgentTransactionsSection.tsx` replace:
```tsx
    ? new Date(tx.closeOfEscrow).toLocaleDateString("en-US", { month: "short", year: "numeric" })
```
with:
```tsx
    ? formatDateOnly(tx.closeOfEscrow, { month: "short", year: "numeric" })
```
and add `import { formatDateOnly } from "@/lib/utils";` with the other imports.

- [ ] **Step 4: Admin overview deadline rows**

In `apps/web/src/app/(dashboard)/admin/page.tsx` replace (line 175):
```tsx
                          {row.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
```
with:
```tsx
                          {formatDateOnly(row.date, { month: "short", day: "numeric", year: "numeric" })}
```
and add `import { formatDateOnly } from "@/lib/utils";`. Leave line 76 (`new Date().toLocaleDateString(...)`, today's date) alone.

- [ ] **Step 5: Deadline reminder email**

In `apps/web/src/lib/deadline-email.ts` replace:
```ts
  const formattedDate = reminder.date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
```
with:
```ts
  const formattedDate = formatDateOnly(reminder.date, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
```
and add `import { formatDateOnly } from "@/lib/utils";` with the other imports.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` — Expected: exit 0.
Run: `npx vitest run deadline` — Expected: any existing deadline-email tests still PASS. If one fails because it hard-coded a date string that depended on the machine's timezone, update the expected string to the UTC calendar day and mention it in the report.

- [ ] **Step 7: Commit**
```bash
cd /c/Users/hey_r/Desktop/CnC-Realty
git add "apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx" apps/web/src/components/transactions/FileCard.tsx apps/web/src/components/agents/AgentTransactionsSection.tsx "apps/web/src/app/(dashboard)/admin/page.tsx" apps/web/src/lib/deadline-email.ts
git commit -m "$(cat <<'EOF'
fix: show date-only fields as the stored calendar day, not the previous evening

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Admin "All Files" lists every agent's files and links to the admin page (#25, #12)

**Files:**
- Create: `apps/web/src/app/api/admin/files/route.ts`
- Create: `apps/web/src/__tests__/api/admin-files-list.test.ts`
- Modify: `apps/web/src/components/transactions/FileCard.tsx` (add optional `href`)
- Modify: `apps/web/src/app/(dashboard)/admin/transactions/page.tsx`

**Interfaces:**
- Consumes: `CHECKLIST_ITEMS_WITH_DOCS_INCLUDE` from `@/lib/transaction-helpers`.
- Produces: `GET /api/admin/files` → `{ listings: [...], transactions: [...] }` (all agents; each row has `checklistItems` with `documents`, and `agent.user.{name,email}`); `FileCard` accepts optional `href?: string`; the admin page tags every row with `kind: "listing" | "transaction"`.

- [ ] **Step 1: Write the failing route test**

Create `apps/web/src/__tests__/api/admin-files-list.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findMany: vi.fn() },
    transactionFile: { findMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "../../app/api/admin/files/route";

describe("GET /api/admin/files", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a request with no session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("rejects a non-admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT" } } as any);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(prisma.transactionFile.findMany).not.toHaveBeenCalled();
  });

  it("returns every agent's listings and transactions to an admin, with no per-agent filter", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any);
    vi.mocked(prisma.listingFile.findMany).mockResolvedValue([{ id: "l1" }] as any);
    vi.mocked(prisma.transactionFile.findMany).mockResolvedValue([{ id: "t1" }, { id: "t2" }] as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.listings).toEqual([{ id: "l1" }]);
    expect(body.transactions).toEqual([{ id: "t1" }, { id: "t2" }]);

    const txArgs = vi.mocked(prisma.transactionFile.findMany).mock.calls[0][0] as any;
    const listingArgs = vi.mocked(prisma.listingFile.findMany).mock.calls[0][0] as any;
    expect(txArgs).not.toHaveProperty("where");
    expect(listingArgs).not.toHaveProperty("where");
    expect(txArgs.include.agent.include.user.select).toEqual({ name: true, email: true });
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `cd /c/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run admin-files-list`
Expected: FAIL — cannot resolve `../../app/api/admin/files/route`.

- [ ] **Step 3: Create the route**

Create `apps/web/src/app/api/admin/files/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CHECKLIST_ITEMS_WITH_DOCS_INCLUDE } from "@/lib/transaction-helpers";

// Every agent's files, for the admin "All Files" tab. The agent-facing
// GET /api/listings and GET /api/transactions only return the caller's own files.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const include = {
    checklistItems: CHECKLIST_ITEMS_WITH_DOCS_INCLUDE,
    agent: { include: { user: { select: { name: true, email: true } } } },
  } as const;

  const [listings, transactions] = await Promise.all([
    prisma.listingFile.findMany({ orderBy: { createdAt: "desc" }, include }),
    prisma.transactionFile.findMany({ orderBy: { createdAt: "desc" }, include }),
  ]);

  return NextResponse.json({ listings, transactions });
}
```

- [ ] **Step 4: Run and confirm it passes**

Run: `npx vitest run admin-files-list` — Expected: 3 tests PASS. Then `npx tsc --noEmit` — Expected: exit 0.

- [ ] **Step 5: `FileCard` accepts an optional `href`**

In `apps/web/src/components/transactions/FileCard.tsx`: in `interface Props` add `href?: string;` after `transactionSide?: string | null;`. Change the function signature line to include `href`:
```tsx
export function FileCard({ id, fileType, address, city, status, closeDate, listPrice, checklistItems, awaitingReview, referredToAgentName, transactionSide, href }: Props) {
```
and replace `href={`/dashboard/transactions/${fileType}/${id}`}` with:
```tsx
      href={href ?? `/dashboard/transactions/${fileType}/${id}`}
```

- [ ] **Step 6: Admin page — use the new route, tag each row, open the admin page, drop the nested link**

In `apps/web/src/app/(dashboard)/admin/transactions/page.tsx`:

Replace the fetch block:
```tsx
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/audit-queue").then((r) => r.json()),
      fetch("/api/listings").then((r) => r.json()),
      fetch("/api/transactions").then((r) => r.json()),
    ]).then(([audit, l, t]) => {
      setAuditQueue([...(audit.listings ?? []), ...(audit.transactions ?? [])]);
      setAllFiles([...(l.listings ?? []), ...(t.transactions ?? [])]);
      setLoading(false);
    });
  }, []);
```
with:
```tsx
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/audit-queue").then((r) => r.json()),
      fetch("/api/admin/files").then((r) => r.json()),
    ]).then(([audit, all]) => {
      setAuditQueue([
        ...(audit.listings ?? []).map(withKind("listing")),
        ...(audit.transactions ?? []).map(withKind("transaction")),
      ]);
      setAllFiles([
        ...(all.listings ?? []).map(withKind("listing")),
        ...(all.transactions ?? []).map(withKind("transaction")),
      ]);
      setLoading(false);
    });
  }, []);
```
Add above the component function (near the top of the file, after the imports/`TABS`):
```tsx
type FileKind = "listing" | "transaction";
// The two API lists are merged, so tag each row with where it came from.
const withKind = (kind: FileKind) => (file: any) => ({ ...file, kind });
```
Replace the whole `items.map` block:
```tsx
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/admin/transactions/${item.fileType?.toLowerCase() ?? "listing"}/${item.id}`}
              className="block"
            >
              <FileCard
                id={item.id}
                fileType={item.fileType?.toLowerCase() === "transaction" ? "transaction" : "listing"}
                address={item.propertyAddress}
                city={item.city}
                status={item.status}
                closeDate={item.closeOfEscrow ?? item.expirationDate}
                listPrice={item.listPrice ?? item.salePrice}
                checklistItems={item.checklistItems ?? []}
                awaitingReview={item.awaitingReview}
                referredToAgentName={item.referredToAgentName}
                transactionSide={item.transactionSide}
              />
            </Link>
          ))}
```
with:
```tsx
          {items.map((item) => (
            <FileCard
              key={`${item.kind}-${item.id}`}
              id={item.id}
              fileType={item.kind}
              href={`/admin/transactions/${item.kind}/${item.id}`}
              address={item.propertyAddress}
              city={item.city}
              status={item.status}
              closeDate={item.closeOfEscrow ?? item.expirationDate}
              listPrice={item.listPrice ?? item.salePrice}
              checklistItems={item.checklistItems ?? []}
              awaitingReview={item.awaitingReview}
              referredToAgentName={item.referredToAgentName}
              transactionSide={item.transactionSide}
            />
          ))}
```
Then run `grep -n "<Link" "apps/web/src/app/(dashboard)/admin/transactions/page.tsx"`; if it prints nothing, remove the now-unused `import Link from "next/link";` line.

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit` — Expected: exit 0. Run: `npx vitest run admin-files-list` — Expected: PASS.
```bash
cd /c/Users/hey_r/Desktop/CnC-Realty
git add apps/web/src/app/api/admin/files/route.ts apps/web/src/__tests__/api/admin-files-list.test.ts apps/web/src/components/transactions/FileCard.tsx "apps/web/src/app/(dashboard)/admin/transactions/page.tsx"
git commit -m "$(cat <<'EOF'
fix: admin All Files lists every agent's files and cards open the admin file page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Sale price on file cards (#13)

**Files:**
- Modify: `apps/web/src/lib/transaction-helpers.ts` (append helper)
- Modify: `apps/web/src/__tests__/lib/transaction-helpers.test.ts` (append tests; add to its import)
- Modify: `apps/web/src/components/transactions/FileCard.tsx` (`listPrice` prop becomes `price`)
- Modify: `apps/web/src/app/(dashboard)/admin/transactions/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/page.tsx`

**Interfaces:**
- Consumes: the `kind` tag added to admin rows in Task 4.
- Produces: `pickDisplayPrice(fileType: "listing" | "transaction", prices: { listPrice?: number | null; salePrice?: number | null }): number | null`; `FileCard` prop `price?: number | null` replaces `listPrice`.

- [ ] **Step 1: Write the failing tests**

Open `apps/web/src/__tests__/lib/transaction-helpers.test.ts`, add `pickDisplayPrice` to its existing named import from `"@/lib/transaction-helpers"`, and append at the end of the file:
```ts
describe("pickDisplayPrice", () => {
  it("transactions show the sale price, the price it went into contract for", () => {
    expect(pickDisplayPrice("transaction", { listPrice: 850000, salePrice: 800000 })).toBe(800000);
  });

  it("transactions fall back to the list price when there is no sale price yet", () => {
    expect(pickDisplayPrice("transaction", { listPrice: 850000, salePrice: null })).toBe(850000);
  });

  it("listings always show the list price (they have no sale price)", () => {
    expect(pickDisplayPrice("listing", { listPrice: 2500000, salePrice: 2400000 })).toBe(2500000);
  });

  it("returns null when there is no price at all", () => {
    expect(pickDisplayPrice("transaction", {})).toBeNull();
    expect(pickDisplayPrice("listing", { listPrice: null })).toBeNull();
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `cd /c/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/lib/transaction-helpers`
Expected: the new tests FAIL (`pickDisplayPrice is not a function`).

- [ ] **Step 3: Implement**

Append to `apps/web/src/lib/transaction-helpers.ts`:
```ts
// The price a file card should show. A transaction's sale price is the price it
// went under contract for, so it wins over the list price. Listing files only
// ever have a list price.
export function pickDisplayPrice(
  fileType: "listing" | "transaction",
  prices: { listPrice?: number | null; salePrice?: number | null }
): number | null {
  if (fileType === "transaction") return prices.salePrice ?? prices.listPrice ?? null;
  return prices.listPrice ?? null;
}
```

- [ ] **Step 4: Run and confirm it passes**

Run: `npx vitest run src/__tests__/lib/transaction-helpers` — Expected: PASS (all tests in the file, old and new).

- [ ] **Step 5: `FileCard` takes `price` instead of `listPrice`**

In `apps/web/src/components/transactions/FileCard.tsx`: in `Props` change `listPrice?: number | null;` to `price?: number | null;`; in the destructured signature replace `listPrice` with `price`; replace:
```tsx
      {status !== "PENDING_TRANSFER" && listPrice && (
        <p className="text-sm font-medium text-[#1B1B1B]">${listPrice.toLocaleString()}</p>
      )}
```
with:
```tsx
      {status !== "PENDING_TRANSFER" && price && (
        <p className="text-sm font-medium text-[#1B1B1B]">${price.toLocaleString()}</p>
      )}
```

- [ ] **Step 6: Update both callers**

`apps/web/src/app/(dashboard)/admin/transactions/page.tsx`: replace `listPrice={item.listPrice ?? item.salePrice}` with `price={pickDisplayPrice(item.kind, item)}` and add `import { pickDisplayPrice } from "@/lib/transaction-helpers";` to the imports.

`apps/web/src/app/(dashboard)/dashboard/transactions/page.tsx`: replace `listPrice={item.listPrice}` with:
```tsx
              price={pickDisplayPrice(tab === "listings" ? "listing" : "transaction", item)}
```
and add `import { pickDisplayPrice } from "@/lib/transaction-helpers";` to the imports.

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit` — Expected: exit 0 (a type error here means `item` lacks `listPrice`/`salePrice` typing; widen the helper's parameter, do not cast at the call site).
```bash
cd /c/Users/hey_r/Desktop/CnC-Realty
git add apps/web/src/lib/transaction-helpers.ts apps/web/src/__tests__/lib/transaction-helpers.test.ts apps/web/src/components/transactions/FileCard.tsx "apps/web/src/app/(dashboard)/admin/transactions/page.tsx" "apps/web/src/app/(dashboard)/dashboard/transactions/page.tsx"
git commit -m "$(cat <<'EOF'
feat: file cards show the sale price for transactions and the list price for listings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Email wording matches the file type (#18)

**Files:**
- Modify: `apps/web/src/__tests__/lib/transaction-emails.test.ts` (append)
- Modify: `apps/web/src/lib/email/transaction-emails.ts`

**Interfaces:**
- Consumes: the existing `fileType: "listing" | "transaction"` option on `sendDocumentRejected` and `sendAllDocsApproved`.
- Produces: nothing new.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/__tests__/lib/transaction-emails.test.ts` (its imports already include `sendDocumentRejected` and `sendAllDocsApproved`):
```ts
describe("transaction-emails — wording follows the file type", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  it("the rejection email says 'transaction' for a transaction file", async () => {
    await sendDocumentRejected({
      agentEmail: "a@example.com", agentName: "Jane", documentName: "TDS.pdf",
      address: "1 Main St", rejectionNote: "Blurry scan", fileType: "transaction", fileId: "f1",
    });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html;
    expect(html).toContain("your transaction at");
    expect(html).not.toContain("your listing at");
  });

  it("the rejection email still says 'listing' for a listing file", async () => {
    await sendDocumentRejected({
      agentEmail: "a@example.com", agentName: "Jane", documentName: "LL.pdf",
      address: "1 Main St", rejectionNote: "Unsigned", fileType: "listing", fileId: "f1",
    });
    expect(vi.mocked(sendEmail).mock.calls[0][0].html).toContain("your listing at");
  });

  it("the all-approved email says 'transaction' for a transaction file", async () => {
    await sendAllDocsApproved({
      agentEmail: "a@example.com", agentName: "Jane", address: "1 Main St",
      fileType: "transaction", fileId: "f1",
    });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html;
    expect(html).toContain("for your transaction at");
    expect(html).not.toContain("for your listing at");
  });

  it("the all-approved email still says 'listing' for a listing file", async () => {
    await sendAllDocsApproved({
      agentEmail: "a@example.com", agentName: "Jane", address: "1 Main St",
      fileType: "listing", fileId: "f1",
    });
    expect(vi.mocked(sendEmail).mock.calls[0][0].html).toContain("for your listing at");
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `cd /c/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run transaction-emails`
Expected: the two "transaction" tests FAIL (the html still says "your listing at"); the two "listing" tests PASS.

- [ ] **Step 3: Implement**

In `apps/web/src/lib/email/transaction-emails.ts`:

In `sendDocumentRejected` replace:
```
        Hi ${safeAgentName}, the following document was rejected for your listing at <strong style="color: #1B1B1B;">${safeAddress}</strong>:
```
with:
```
        Hi ${safeAgentName}, the following document was rejected for your ${opts.fileType} at <strong style="color: #1B1B1B;">${safeAddress}</strong>:
```
In `sendAllDocsApproved` replace:
```
        Hi ${safeAgentName}, all required documents have been approved for your listing at:
```
with:
```
        Hi ${safeAgentName}, all required documents have been approved for your ${opts.fileType} at:
```
Then run `grep -n "your listing\|listing file\|a listing" apps/web/src/lib/email/transaction-emails.ts`. For any other email in this file that takes a `fileType` option but hard-codes the word "listing" in its copy, apply the same `${opts.fileType}` substitution. If an email has no `fileType` option, leave it and mention it in your report.

- [ ] **Step 4: Run and confirm it passes**

Run: `npx vitest run transaction-emails` — Expected: all tests PASS (existing ones included). Then `npx tsc --noEmit` — Expected: exit 0.

- [ ] **Step 5: Commit**
```bash
cd /c/Users/hey_r/Desktop/CnC-Realty
git add apps/web/src/lib/email/transaction-emails.ts apps/web/src/__tests__/lib/transaction-emails.test.ts
git commit -m "$(cat <<'EOF'
fix: file emails say transaction or listing instead of always listing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Activity feed shows document names and rejection notes (#23)

**Files:**
- Create: `apps/web/src/lib/activity-detail.ts`
- Create: `apps/web/src/__tests__/lib/activity-detail.test.ts`
- Modify: `apps/web/src/components/transactions/ActivityFeed.tsx`

**Interfaces:**
- Consumes: activity `payload` values already saved by the API: upload/approve `{ documentId, name }`, reject `{ documentId, name, note }`, status change `{ to }` or `{ from, to }`.
- Produces: `describeActivity(a: { type: string; payload: unknown }): { detail: string | null; reason: string | null }`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/lib/activity-detail.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { describeActivity } from "@/lib/activity-detail";

describe("describeActivity", () => {
  it("shows the document name for an upload", () => {
    expect(describeActivity({ type: "DOCUMENT_UPLOADED", payload: { documentId: "d1", name: "TDS.pdf" } }))
      .toEqual({ detail: "TDS.pdf", reason: null });
  });

  it("shows the document name for an approval", () => {
    expect(describeActivity({ type: "DOCUMENT_APPROVED", payload: { documentId: "d1", name: "RPA.pdf" } }))
      .toEqual({ detail: "RPA.pdf", reason: null });
  });

  it("shows the document name and the rejection note for a rejection", () => {
    expect(describeActivity({ type: "DOCUMENT_REJECTED", payload: { documentId: "d1", name: "TDS.pdf", note: "Blurry scan" } }))
      .toEqual({ detail: "TDS.pdf", reason: "Blurry scan" });
  });

  it("shows from → to when both statuses are recorded", () => {
    expect(describeActivity({ type: "STATUS_CHANGED", payload: { from: "INCOMPLETE", to: "PENDING" } }))
      .toEqual({ detail: "INCOMPLETE → PENDING", reason: null });
  });

  it("shows → to when only the new status was recorded", () => {
    expect(describeActivity({ type: "STATUS_CHANGED", payload: { to: "CLOSED" } }))
      .toEqual({ detail: "→ CLOSED", reason: null });
  });

  it("returns nothing extra for other types or a missing payload", () => {
    expect(describeActivity({ type: "SUBMITTED_FOR_REVIEW", payload: null })).toEqual({ detail: null, reason: null });
    expect(describeActivity({ type: "DOCUMENT_APPROVED", payload: null })).toEqual({ detail: null, reason: null });
    expect(describeActivity({ type: "FILE_CREATED", payload: { anything: 1 } })).toEqual({ detail: null, reason: null });
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `cd /c/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run activity-detail`
Expected: FAIL — cannot resolve `@/lib/activity-detail`.

- [ ] **Step 3: Implement**

Create `apps/web/src/lib/activity-detail.ts`:
```ts
type Payload = { name?: unknown; note?: unknown; from?: unknown; to?: unknown };

const asText = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

// Extra detail for one activity row, read from the payload the API already saves.
export function describeActivity(a: { type: string; payload: unknown }): { detail: string | null; reason: string | null } {
  const p: Payload = a.payload && typeof a.payload === "object" ? (a.payload as Payload) : {};

  if (a.type === "DOCUMENT_UPLOADED" || a.type === "DOCUMENT_APPROVED") {
    return { detail: asText(p.name), reason: null };
  }
  if (a.type === "DOCUMENT_REJECTED") {
    return { detail: asText(p.name), reason: asText(p.note) };
  }
  if (a.type === "STATUS_CHANGED") {
    const from = asText(p.from);
    const to = asText(p.to);
    if (from && to) return { detail: `${from} → ${to}`, reason: null };
    if (to) return { detail: `→ ${to}`, reason: null };
  }
  return { detail: null, reason: null };
}
```

- [ ] **Step 4: Run and confirm it passes**

Run: `npx vitest run activity-detail` — Expected: 6 tests PASS.

- [ ] **Step 5: Use it in `ActivityFeed`**

In `apps/web/src/components/transactions/ActivityFeed.tsx` add `import { describeActivity } from "@/lib/activity-detail";` with the imports, then replace the whole `activities.map` block:
```tsx
        {activities.map((a) => (
          <div key={a.id} className="flex gap-3">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#9E8C61]" />
            <div className="flex-1">
              <p className="text-sm text-[#1B1B1B]">
                <span className="font-medium">{a.actor.name ?? a.actor.email}</span>
                {" "}
                {TYPE_LABELS[a.type]}
                {a.type === "STATUS_CHANGED" && a.payload && (
                  <span className="text-[#1B1B1B]/50"> · {(a.payload as { from: string; to: string }).from} → {(a.payload as { from: string; to: string }).to}</span>
                )}
              </p>
              {a.note && <p className="mt-0.5 text-sm text-[#1B1B1B]/60">{a.note}</p>}
              <p className="text-xs text-[#1B1B1B]/40">{new Date(a.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
```
with:
```tsx
        {activities.map((a) => {
          const { detail, reason } = describeActivity(a);
          return (
            <div key={a.id} className="flex gap-3">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#9E8C61]" />
              <div className="flex-1">
                <p className="text-sm text-[#1B1B1B]">
                  <span className="font-medium">{a.actor.name ?? a.actor.email}</span>
                  {" "}
                  {TYPE_LABELS[a.type]}
                  {detail && <span className="text-[#1B1B1B]/50"> · {detail}</span>}
                </p>
                {reason && <p className="mt-0.5 text-sm text-red-500">Reason: {reason}</p>}
                {a.note && <p className="mt-0.5 text-sm text-[#1B1B1B]/60">{a.note}</p>}
                <p className="text-xs text-[#1B1B1B]/40">{new Date(a.createdAt).toLocaleString()}</p>
              </div>
            </div>
          );
        })}
```
(Activity times stay local: they are real timestamps.)

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit` — Expected: exit 0.
```bash
cd /c/Users/hey_r/Desktop/CnC-Realty
git add apps/web/src/lib/activity-detail.ts apps/web/src/__tests__/lib/activity-detail.test.ts apps/web/src/components/transactions/ActivityFeed.tsx
git commit -m "$(cat <<'EOF'
feat: activity feed shows document names and rejection reasons

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Add the Title, Escrow and Attorney party roles to the database (#9, part 1) — CONTROLLER ONLY

This task changes the shared production database and needs the dev server stopped, so a subagent must not run it. The controller asks Ryan first.

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (enum `FilePartyRole`)
- Create: `packages/database/prisma/migrations/<timestamp>_add_title_escrow_attorney_party_roles/migration.sql`

**Interfaces:**
- Produces: DB enum values `TITLE`, `ESCROW`, `ATTORNEY` on `FilePartyRole`; regenerated Prisma client that knows them. Existing `TITLE_ESCROW` rows stay valid.

- [ ] **Step 1: Ask Ryan for two approvals, wait for both**

Ask: (1) permission to apply an additive migration (`ALTER TYPE "FilePartyRole" ADD VALUE` ×3) to the shared Neon database; (2) permission to stop the background dev server, regenerate the Prisma client (Windows locks the engine file while the server runs), and restart the dev server.

- [ ] **Step 2: Edit the schema**

In `packages/database/prisma/schema.prisma` change the enum to:
```prisma
enum FilePartyRole {
  BUYER
  SELLER
  LISTING_AGENT
  BUYERS_AGENT
  CO_AGENT
  TITLE_ESCROW
  TITLE
  ESCROW
  ATTORNEY
  LENDER
  TRANSACTION_COORDINATOR
  REFERRAL_AGENT
  OTHER
}
```

- [ ] **Step 3: Create the migration by hand (not `migrate dev`, which can prompt to reset a shared database)**

Run `ls /c/Users/hey_r/Desktop/CnC-Realty/packages/database/prisma/migrations | tail -3` and choose a timestamp later than the newest folder. Create `packages/database/prisma/migrations/20260921050000_add_title_escrow_attorney_party_roles/migration.sql` (use a later timestamp if the listing shows one at or after `20260921050000`):
```sql
-- AlterEnum
ALTER TYPE "FilePartyRole" ADD VALUE 'TITLE';
ALTER TYPE "FilePartyRole" ADD VALUE 'ESCROW';
ALTER TYPE "FilePartyRole" ADD VALUE 'ATTORNEY';
```

- [ ] **Step 4: Apply it and regenerate the client**

With Ryan's approval, stop the dev server, then:
```bash
cd /c/Users/hey_r/Desktop/CnC-Realty
pnpm --filter @cnc/database exec prisma migrate deploy
pnpm --filter @cnc/database exec prisma generate
```
Expected: `migrate deploy` reports the new migration applied; `generate` prints `Generated Prisma Client`. Restart the dev server the same way it was started before (`pnpm --filter web dev`, output to the scratchpad `dev.log`).

- [ ] **Step 5: Verify against the database**

Run from `apps/web`:
```bash
node -e '
const fs=require("fs");
const env=fs.readFileSync(".env.local","utf8").replace(/\r/g,"");
process.env.DATABASE_URL=env.match(/^\s*DATABASE_URL\s*=\s*["\x27]?(.+?)["\x27]?\s*$/m)[1];
const {PrismaClient}=require("@cnc/database");
const p=new PrismaClient();
p.$queryRaw`select unnest(enum_range(NULL::"FilePartyRole"))::text as v`.then(r=>{console.log(r.map(x=>x.v).join(","));process.exit(0)});
'
```
Expected: the list includes `TITLE,ESCROW,ATTORNEY` alongside `TITLE_ESCROW`.

- [ ] **Step 6: Commit**
```bash
cd /c/Users/hey_r/Desktop/CnC-Realty
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "$(cat <<'EOF'
feat(db): add Title, Escrow and Attorney party roles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Escrow role helper, role labels and the Parties table columns (#9 part 2, #24)

**Files:**
- Modify: `apps/web/src/lib/transaction-helpers.ts` (append helper)
- Modify: `apps/web/src/__tests__/lib/transaction-helpers.test.ts` (append tests; extend its import)
- Modify: `apps/web/src/types/transaction.ts` (`FilePartyRole`)
- Modify: `apps/web/src/components/transactions/PartiesTable.tsx`

**Interfaces:**
- Consumes: the enum values from Task 8.
- Produces: `EscrowContactType = "Title" | "Escrow" | "Attorney"`; `escrowTypeToRole(type: EscrowContactType): "TITLE" | "ESCROW" | "ATTORNEY"`; `FilePartyRole` gains `TITLE`, `ESCROW`, `ATTORNEY`, `REFERRAL_AGENT`.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/__tests__/lib/transaction-helpers.test.ts` add `escrowTypeToRole` to the named import from `"@/lib/transaction-helpers"` and append:
```ts
describe("escrowTypeToRole", () => {
  it("maps each Title/Escrow/Attorney choice to its own party role", () => {
    expect(escrowTypeToRole("Title")).toBe("TITLE");
    expect(escrowTypeToRole("Escrow")).toBe("ESCROW");
    expect(escrowTypeToRole("Attorney")).toBe("ATTORNEY");
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `cd /c/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/lib/transaction-helpers`
Expected: the new test FAILS (`escrowTypeToRole is not a function`).

- [ ] **Step 3: Implement the helper**

Append to `apps/web/src/lib/transaction-helpers.ts`:
```ts
export type EscrowContactType = "Title" | "Escrow" | "Attorney";

const ESCROW_ROLE_BY_TYPE = { Title: "TITLE", Escrow: "ESCROW", Attorney: "ATTORNEY" } as const;

// The wizard's Title / Escrow / Attorney choice is the party's role, so the
// Company field stays free for the company name the agent typed.
export function escrowTypeToRole(type: EscrowContactType): "TITLE" | "ESCROW" | "ATTORNEY" {
  return ESCROW_ROLE_BY_TYPE[type];
}
```

- [ ] **Step 4: Run and confirm it passes**

Run: `npx vitest run src/__tests__/lib/transaction-helpers` — Expected: PASS.

- [ ] **Step 5: Widen the role type**

In `apps/web/src/types/transaction.ts` replace:
```ts
export type FilePartyRole =
  | "BUYER" | "SELLER" | "LISTING_AGENT" | "BUYERS_AGENT" | "CO_AGENT"
  | "TITLE_ESCROW" | "LENDER" | "TRANSACTION_COORDINATOR" | "OTHER";
```
with:
```ts
export type FilePartyRole =
  | "BUYER" | "SELLER" | "LISTING_AGENT" | "BUYERS_AGENT" | "CO_AGENT"
  | "TITLE_ESCROW" | "TITLE" | "ESCROW" | "ATTORNEY" | "LENDER"
  | "TRANSACTION_COORDINATOR" | "REFERRAL_AGENT" | "OTHER";
```

- [ ] **Step 6: Labels and columns in `PartiesTable`**

In `apps/web/src/components/transactions/PartiesTable.tsx` replace the label map:
```tsx
const ROLE_LABELS: Record<FilePartyRole, string> = {
  BUYER: "Buyer", SELLER: "Seller", LISTING_AGENT: "Listing Agent",
  BUYERS_AGENT: "Buyer's Agent", CO_AGENT: "Co-Agent",
  TITLE_ESCROW: "Title/Escrow", LENDER: "Lender",
  TRANSACTION_COORDINATOR: "TC", OTHER: "Other",
};
```
with:
```tsx
const ROLE_LABELS: Record<FilePartyRole, string> = {
  BUYER: "Buyer", SELLER: "Seller", LISTING_AGENT: "Listing Agent",
  BUYERS_AGENT: "Buyer's Agent", CO_AGENT: "Co-Agent",
  TITLE_ESCROW: "Title/Escrow", TITLE: "Title", ESCROW: "Escrow", ATTORNEY: "Attorney",
  LENDER: "Lender", TRANSACTION_COORDINATOR: "TC", REFERRAL_AGENT: "Referral Agent", OTHER: "Other",
};
```
Replace the header row:
```tsx
            <th className="pb-2">Role</th><th className="pb-2">Name</th><th className="pb-2">Email</th><th className="pb-2">Phone</th><th className="pb-2"></th>
```
with:
```tsx
            <th className="pb-2">Role</th><th className="pb-2">Name</th><th className="pb-2">Email</th><th className="pb-2">Phone</th><th className="pb-2">Company</th><th className="pb-2">License #</th><th className="pb-2"></th>
```
and after the phone cell add the two new cells:
```tsx
              <td className="py-2 text-[#1B1B1B]/60">{p.phone ?? "—"}</td>
              <td className="py-2 text-[#1B1B1B]/60">{p.company ?? "—"}</td>
              <td className="py-2 text-[#1B1B1B]/60">{p.licenseNumber ?? "—"}</td>
```
(the first line is the existing phone cell; only the two lines after it are new).

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit` — Expected: exit 0. If a type error says `company` or `licenseNumber` does not exist on `FilePartyRecord`, add `company: string | null; licenseNumber: string | null;` to that type in `types/transaction.ts` (the API already returns them). If another `Record<FilePartyRole, …>` elsewhere now errors, add the four new keys there.
```bash
cd /c/Users/hey_r/Desktop/CnC-Realty
git add apps/web/src/lib/transaction-helpers.ts apps/web/src/__tests__/lib/transaction-helpers.test.ts apps/web/src/types/transaction.ts apps/web/src/components/transactions/PartiesTable.tsx
git commit -m "$(cat <<'EOF'
feat: escrow role helper, new party role labels, and Company/License columns in Parties

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: The wizard sends the escrow type as the role and keeps the typed company (#9, part 3)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx` (parties block near line 158; imports)

**Interfaces:**
- Consumes: `escrowTypeToRole` from Task 9; DB enum from Task 8 (must already be applied, or creating a transaction with an escrow party fails).
- Produces: nothing new.

- [ ] **Step 1: Import the helper**

Add next to the existing `import { TC_FEE, calcNetToAgent } from "@/lib/commission";`:
```tsx
import { escrowTypeToRole } from "@/lib/transaction-helpers";
```

- [ ] **Step 2: Send the type as the role, keep the company**

Replace:
```tsx
      ...(titleEscrow.name
        ? [{ role: "TITLE_ESCROW", ...titleEscrow, company: titleEscrow.contactType }]
        : []),
```
with:
```tsx
      ...(titleEscrow.name
        ? [{ role: escrowTypeToRole(titleEscrow.contactType), ...titleEscrow }]
        : []),
```

- [ ] **Step 3: Verify and commit**

Run: `cd /c/Users/hey_r/Desktop/CnC-Realty/apps/web && npx tsc --noEmit` — Expected: exit 0.
```bash
cd /c/Users/hey_r/Desktop/CnC-Realty
git add "apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx"
git commit -m "$(cat <<'EOF'
fix: keep the escrow company the agent typed and store Title/Escrow/Attorney as the party role

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: `Spinner` component and its uses (#7)

**Files:**
- Create: `apps/web/src/components/ui/Spinner.tsx`
- Modify: `apps/web/src/components/transactions/ChecklistPanel.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/new-listing/page.tsx`

**Interfaces:**
- Produces: `Spinner({ className?: string })` — the gold `Loader2` already used in six pages (`animate-spin`, `#9E8C61`), default `h-4 w-4`; `className` overrides size or color.

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/ui/Spinner.tsx`:
```tsx
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// The gold loading spinner used across the app (six pages already inline the
// same icon). Pass className to change size or color, e.g. text-white on gold.
export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden="true" className={cn("h-4 w-4 animate-spin text-[#9E8C61]", className)} />;
}
```

- [ ] **Step 2: Checklist upload buttons**

In `apps/web/src/components/transactions/ChecklistPanel.tsx` add `import { Spinner } from "@/components/ui/Spinner";`. Replace:
```tsx
              {uploadingItemId === item.id ? "Uploading…" : <><Upload className="mr-1 inline h-3 w-3" />Upload</>}
```
with:
```tsx
              {uploadingItemId === item.id ? <><Spinner className="mr-1 inline h-3 w-3" />Uploading…</> : <><Upload className="mr-1 inline h-3 w-3" />Upload</>}
```
For "Add Document" replace:
```tsx
          <Upload className="mr-1 inline h-3 w-3" />Add Document
          <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(null, f); }} />
```
with:
```tsx
          {uploadingItemId === "additional" ? <><Spinner className="mr-1 inline h-3 w-3" />Uploading…</> : <><Upload className="mr-1 inline h-3 w-3" />Add Document</>}
          <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.docx" disabled={uploadingItemId !== null} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(null, f); }} />
```

- [ ] **Step 3: Submit for Review (file page)**

In `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx` add `import { Spinner } from "@/components/ui/Spinner";`, add state next to `const [loading, setLoading] = useState(true);`:
```tsx
  const [submitting, setSubmitting] = useState(false);
```
and replace:
```tsx
  async function submitForReview() {
    const endpoint = fileType === "listing"
      ? `/api/listings/${id}/submit-review`
      : `/api/transactions/${id}/submit-review`;
    await fetch(endpoint, { method: "POST" });
    load();
  }
```
with:
```tsx
  async function submitForReview() {
    const endpoint = fileType === "listing"
      ? `/api/listings/${id}/submit-review`
      : `/api/transactions/${id}/submit-review`;
    setSubmitting(true);
    try {
      await fetch(endpoint, { method: "POST" });
      load();
    } finally {
      setSubmitting(false);
    }
  }
```
Replace the button:
```tsx
              <button onClick={submitForReview} className="rounded-full bg-[#9E8C61] px-4 py-2 text-sm text-white">
                Submit for Review
              </button>
```
with:
```tsx
              <button onClick={submitForReview} disabled={submitting} className="inline-flex items-center rounded-full bg-[#9E8C61] px-4 py-2 text-sm text-white disabled:opacity-70">
                {submitting ? <><Spinner className="mr-1.5 h-3.5 w-3.5 text-white" />Submitting…</> : "Submit for Review"}
              </button>
```
(The spinner is white here because the button itself is gold. Showing errors from a rejected submit is sub-project B, not this task.)

- [ ] **Step 4: Create buttons in both wizards**

In `new-transaction/page.tsx` add `import { Spinner } from "@/components/ui/Spinner";` and replace `{saving ? "Creating…" : "Create Transaction"}` with:
```tsx
            {saving ? <><Spinner className="mr-2 h-4 w-4" />Creating…</> : "Create Transaction"}
```
In `new-listing/page.tsx` add the same import and replace `{saving ? "Creating…" : "Create Listing"}` with:
```tsx
            {saving ? <><Spinner className="mr-2 h-4 w-4" />Creating…</> : "Create Listing"}
```
(Both buttons are already `inline-flex items-center` on a dark background, so the gold spinner is visible.)

- [ ] **Step 5: Verify and commit**

Run: `cd /c/Users/hey_r/Desktop/CnC-Realty/apps/web && npx tsc --noEmit` — Expected: exit 0.
```bash
cd /c/Users/hey_r/Desktop/CnC-Realty
git add apps/web/src/components/ui/Spinner.tsx apps/web/src/components/transactions/ChecklistPanel.tsx "apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx" "apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx" "apps/web/src/app/(dashboard)/dashboard/transactions/new-listing/page.tsx"
git commit -m "$(cat <<'EOF'
feat: show a loading spinner on Create, upload and Submit for Review

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: `Tooltip` component and the "Pending Broker Review" popup (#10)

**Files:**
- Create: `apps/web/src/components/ui/Tooltip.tsx`
- Modify: `apps/web/src/components/transactions/ChecklistPanel.tsx`

**Interfaces:**
- Produces: `Tooltip({ text: string; children: ReactNode; className?: string; disabled?: boolean })` — renders a `div` (it is the wrapper element, so pass the row's classes in `className`) that shows a small dark popup above its left end while the mouse is anywhere over it. `disabled` hides the popup.

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/ui/Tooltip.tsx`:
```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

// CSS-only tooltip: the wrapper is the hover target, so hovering anywhere on it
// (not just an icon) shows the popup above its left end. No JavaScript, no dependency.
export function Tooltip({ text, children, className, disabled = false }: Props) {
  return (
    <div className={cn("group relative", className)}>
      {children}
      {!disabled && (
        <span
          role="tooltip"
          className="pointer-events-none absolute -top-2 left-4 z-20 -translate-y-full whitespace-nowrap rounded-md bg-[#1B1B1B] px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
        >
          {text}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wrap each checklist row**

In `apps/web/src/components/transactions/ChecklistPanel.tsx` add `import { Tooltip } from "@/components/ui/Tooltip";`. Replace the row's opening tag:
```tsx
          <div key={item.id} className="flex items-center gap-3 rounded-lg border border-[#1B1B1B]/10 bg-white p-3">
```
with:
```tsx
          <Tooltip
            key={item.id}
            text="Pending Broker Review"
            disabled={status !== "PENDING_REVIEW"}
            className="flex items-center gap-3 rounded-lg border border-[#1B1B1B]/10 bg-white p-3"
          >
```
and its closing tag (the `</div>` right after the row's `</label>`, just before `);` and `})}`):
```tsx
            </label>
          </div>
        );
      })}
```
with:
```tsx
            </label>
          </Tooltip>
        );
      })}
```
(`status` is the existing per-row variable computed from the row's first document. Picking the newest document instead is sub-project B.)

- [ ] **Step 3: Verify and commit**

Run: `cd /c/Users/hey_r/Desktop/CnC-Realty/apps/web && npx tsc --noEmit` — Expected: exit 0.
```bash
cd /c/Users/hey_r/Desktop/CnC-Realty
git add apps/web/src/components/ui/Tooltip.tsx apps/web/src/components/transactions/ChecklistPanel.tsx
git commit -m "$(cat <<'EOF'
feat: show "Pending Broker Review" when hovering a checklist row that is awaiting review

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Final verification — CONTROLLER ONLY

- [ ] **Step 1: Full test suite and type check**

Run from `apps/web`: `npx vitest run` — Expected: all tests PASS (baseline before this plan was 623 plus the new ones). Run `npx tsc --noEmit` — Expected: exit 0. Report exact counts.

- [ ] **Step 2: Production build (needs Ryan's OK — a build breaks a running dev server)**

Ask Ryan for permission to stop the dev server. Then from the repo root: `pnpm --filter web build` — Expected: exit 0 and the route table prints. Restart the dev server afterward and confirm `GET /login` returns 200.

- [ ] **Step 3: Live check with Ryan (browser)**

Ask Ryan to confirm each, in the agent window (log in as `info@cncrealtygroup.com`) and the admin window:
1. New Transaction Commission step: the TC toggle knob sits at the left when off and inside the track at the right when on.
2. The test file's Overview Key Dates match what was entered (Offer Date 9/21/2026, Close of Escrow 10/22/2026, and so on).
3. Parties tab: the Company and License # columns are there.
4. Checklist tab: hovering anywhere on a row that is awaiting review shows "Pending Broker Review" above its left end; other rows show nothing.
5. Creating a transaction or listing shows a spinner and "Creating…"; uploading shows a spinner and "Uploading…"; Submit for Review shows a spinner.
6. Admin All Files tab: the 100 TEST DELETE file is listed; clicking any card opens the admin file page (not "File not found"); the price on transaction cards is the sale price.
7. New Transaction with an escrow contact: choose Attorney, type a company; after creating, the Parties tab shows role "Attorney" and the company column shows what was typed.
8. Activity tab: entries read like "Document rejected · TDS.pdf" with a red "Reason: …" line under rejections.

- [ ] **Step 4: Report**

Summarize each task's commit, the test/tsc/build results and Ryan's live-check answers. Do not push.
