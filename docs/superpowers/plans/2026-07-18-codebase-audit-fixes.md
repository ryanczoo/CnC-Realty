# Whole-Codebase Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every finding from the 2026-07-18 whole-codebase audit (N+1/redundant queries, unbounded queries, missing indexes, duplicated business logic) across the CnC Realty Next.js 14 + Prisma monorepo at `C:\Users\hey_r\Desktop\CnC-Realty`.

**Architecture:** No new subsystems. Each task is a targeted, verified fix to existing files: dedupe redundant DB round-trips, cap unbounded queries, add missing indexes via Prisma migrations, and extract genuinely duplicated logic into shared helpers (matching this codebase's existing conventions — e.g. `lib/api-auth.ts` for auth helpers, React `cache()` for per-request query dedup, the pattern already used correctly in `agents/[slug]/page.tsx`).

**Tech Stack:** Next.js 14 App Router, Prisma 5.22, PostgreSQL (Neon), Vitest.

## Global Constraints

- This is `feature/agent-application-redesign` — a long-lived branch, not a fresh worktree. Work directly on it.
- Every task must leave `pnpm --filter web test -- --run` fully green and introduce zero new `tsc --noEmit` errors before its commit.
- Do not run `pnpm --filter @cnc/database exec prisma generate` or `prisma migrate dev` while the dev server is running (Windows EPERM — DLL lock). Stop the dev server first if a task needs to regenerate the Prisma client.
- `packages/database/.env` and `apps/web/.env.local` both point at the same Neon DB — migrations only need to be run once (via `packages/database`).
- No new abstractions beyond what each task specifies. Do not add pagination UI, do not convert plain-text emails to HTML templates, do not touch anything not explicitly listed in a task's Files section.

---

## Task 1: Unify email sender identity and links

**Files:**
- Modify: `apps/web/src/lib/email/transaction-emails.ts`
- Modify: `apps/web/src/lib/email/property-alert-email.ts`
- Test: `apps/web/src/__tests__/lib/transaction-emails.test.ts` (new)

**Interfaces:**
- Consumes: `FROM` (typed `{ email: string; name: string }`) exported from `@/lib/email` (already exists, unchanged).
- Produces: nothing new consumed by later tasks.

**Context:** `lib/email.ts` exports `FROM = { email: "noreply@cncrealtygroup.com", name: "CnC Realty" }` and every correctly-updated email helper (e.g. `lib/deadline-email.ts`) imports it and builds links with `${process.env.NEXTAUTH_URL}/...`. `transaction-emails.ts` and `property-alert-email.ts` each still hold their own stale bare-string `FROM = "noreply@cncrealtygroup.com"`, and `transaction-emails.ts` additionally hardcodes `https://cncrealtygroup.com` in 5 places — meaning every submit-for-review / document-rejected / all-docs-approved / file-closed / expiration-warning email sends unbranded, and any local/staging test of these produces links pointing at production.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/lib/transaction-emails.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sendgrid/mail", () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue(undefined) },
}));

import sgMail from "@sendgrid/mail";
import { sendSubmitForReview, sendFileClosed } from "@/lib/email/transaction-emails";

describe("transaction-emails — sender identity and links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  it("sends from the shared branded FROM object, not a bare address", async () => {
    await sendSubmitForReview({
      fileType: "Transaction",
      address: "123 Main St",
      agentName: "Jane Agent",
      fileId: "f1",
    });

    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(call.from).toEqual({ email: "noreply@cncrealtygroup.com", name: "CnC Realty" });
  });

  it("builds links from NEXTAUTH_URL, not a hardcoded production domain", async () => {
    await sendFileClosed({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      address: "123 Main St",
      fileType: "transaction",
      fileId: "f1",
    });

    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(call.text).toContain("http://localhost:3000/dashboard/transactions/transaction/f1");
    expect(call.text).not.toContain("https://cncrealtygroup.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --run src/__tests__/lib/transaction-emails.test.ts`
Expected: FAIL — `call.from` is the bare string `"noreply@cncrealtygroup.com"` (not an object), and `call.text` contains `https://cncrealtygroup.com`.

- [ ] **Step 3: Fix `transaction-emails.ts`**

Replace the top of the file and every `from:`/URL:

```ts
import sgMail from "@sendgrid/mail";
import { FROM } from "@/lib/email";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const BROKER_EMAIL = "info@cncrealtygroup.com";

export async function sendSubmitForReview(opts: {
  fileType: "Listing" | "Transaction";
  address: string;
  agentName: string;
  fileId: string;
}): Promise<void> {
  await sgMail.send({
    to: BROKER_EMAIL,
    from: FROM,
    subject: `[CnC] ${opts.fileType} File Ready for Review — ${opts.address}`,
    text: `${opts.agentName} has submitted a ${opts.fileType.toLowerCase()} file for compliance review.\n\nProperty: ${opts.address}\n\nReview at: ${process.env.NEXTAUTH_URL}/admin/transactions/${opts.fileType.toLowerCase()}/${opts.fileId}`,
  });
}

export async function sendDocumentRejected(opts: {
  agentEmail: string;
  agentName: string;
  documentName: string;
  address: string;
  rejectionNote: string;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  await sgMail.send({
    to: opts.agentEmail,
    from: FROM,
    subject: `[CnC] Document Rejected — ${opts.address}`,
    text: `Hi ${opts.agentName},\n\nThe document "${opts.documentName}" on your file for ${opts.address} was rejected by the broker.\n\nReason: ${opts.rejectionNote}\n\nPlease re-upload at: ${process.env.NEXTAUTH_URL}/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
}

export async function sendAllDocsApproved(opts: {
  agentEmail: string;
  agentName: string;
  address: string;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  await sgMail.send({
    to: opts.agentEmail,
    from: FROM,
    subject: `[CnC] All Documents Approved — ${opts.address}`,
    text: `Hi ${opts.agentName},\n\nAll required documents for ${opts.address} have been approved. The broker can now close this file.\n\nView file: ${process.env.NEXTAUTH_URL}/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
}

export async function sendFileClosed(opts: {
  agentEmail: string;
  agentName: string;
  address: string;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  await sgMail.send({
    to: opts.agentEmail,
    from: FROM,
    subject: `[CnC] File Closed — ${opts.address}`,
    text: `Hi ${opts.agentName},\n\nYour file for ${opts.address} has been marked as CLOSED by the broker. Congratulations!\n\nView file: ${process.env.NEXTAUTH_URL}/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
}

export async function sendFileExpirationWarning(opts: {
  agentEmail: string;
  agentName: string;
  address: string;
  expiresInDays: number;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  await sgMail.send({
    to: opts.agentEmail,
    from: FROM,
    subject: `[CnC] File Expiring Soon — ${opts.address}`,
    text: `Hi ${opts.agentName},\n\nYour file for ${opts.address} expires in ${opts.expiresInDays} day(s). Please take action.\n\nView file: ${process.env.NEXTAUTH_URL}/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
}
```

- [ ] **Step 4: Fix `property-alert-email.ts`**

Replace line 3 (`const FROM = "noreply@cncrealtygroup.com";`) and the import at the top:

```ts
import sgMail from "@sendgrid/mail";
import { FROM } from "@/lib/email";
```

(Delete the local `const FROM = ...` line entirely — the rest of the file, including its `NEXT_PUBLIC_SITE_URL` link-building, is already correct and stays unchanged.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web test -- --run src/__tests__/lib/transaction-emails.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full suite**

Run: `pnpm --filter web test -- --run`
Expected: all pass, one new test file added.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/email/transaction-emails.ts apps/web/src/lib/email/property-alert-email.ts apps/web/src/__tests__/lib/transaction-emails.test.ts
git commit -m "fix: transaction and property-alert emails send from the shared branded FROM and use NEXTAUTH_URL instead of a hardcoded domain"
```

---

## Task 2: Consolidate large-dollar-amount formatting into one shared function

**Files:**
- Modify: `apps/web/src/lib/utils.ts` (add shared function)
- Modify: `apps/web/src/lib/deal-pipeline.ts:38-42`
- Modify: `apps/web/src/components/agents/AgentProfileHero.tsx:34-38,75`
- Modify: `apps/web/src/lib/home-value-estimate.ts:319-325`
- Modify: `apps/web/src/__tests__/lib/home-value-estimate.test.ts:486-499` (update expectations — see note below)
- Test: `apps/web/src/__tests__/lib/utils.test.ts` (new, or extend if it already exists — check first)

**Interfaces:**
- Produces: `formatCompactCurrency(n: number): string` exported from `@/lib/utils`. Used by Tasks nowhere else in this plan, but by 3 existing call sites listed above.

**Context — a real, visible behavior change, called out deliberately:** Today `deal-pipeline.ts`'s `formatDealPrice` and `AgentProfileHero.tsx`'s `formatVolume` both round to 1 decimal place (one strips a trailing `.0`, the other doesn't — e.g. `$1.0M` vs `$1M` for the same value). `home-value-estimate.ts`'s `formatPriceShort` rounds to 2 decimal places (`$1.50M`, `$1.23M`). The user was told directly that consolidation would standardize on the 1-decimal, strip-trailing-zero convention (majority behavior) — so `formatPriceShort`'s callers (the home-value page's price-history bar labels) will start showing one fewer decimal place than today (e.g. `$1.25M` → `$1.3M`). This is intentional, not a regression — flag it plainly in the task's final report but do not treat the existing 2-decimal test assertions as ground truth to preserve; update them to match the new 1-decimal convention instead.

Before writing code: check `apps/web/src/__tests__/lib/utils.test.ts` — if it already exists, add to it; if not, create it.

- [ ] **Step 1: Write the failing test**

Add to (or create) `apps/web/src/__tests__/lib/utils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatCompactCurrency } from "@/lib/utils";

describe("formatCompactCurrency", () => {
  it("strips a trailing .0 for whole millions", () => {
    expect(formatCompactCurrency(1_000_000)).toBe("$1M");
  });

  it("shows 1 decimal place for non-whole millions", () => {
    expect(formatCompactCurrency(1_500_000)).toBe("$1.5M");
    expect(formatCompactCurrency(1_234_567)).toBe("$1.2M");
  });

  it("formats thousands with a lowercase-free K suffix and no decimals", () => {
    expect(formatCompactCurrency(725_000)).toBe("$725K");
  });

  it("formats sub-thousand values with a plain dollar sign", () => {
    expect(formatCompactCurrency(500)).toBe("$500");
  });

  it("returns an em dash for null", () => {
    expect(formatCompactCurrency(null)).toBe("—");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --run src/__tests__/lib/utils.test.ts`
Expected: FAIL — `formatCompactCurrency is not a function`.

- [ ] **Step 3: Add the shared function to `lib/utils.ts`**

Read the existing file first to see what's already there (it has `toTitleCase`/`formatDate` per prior session history) and append:

```ts
export function formatCompactCurrency(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --run src/__tests__/lib/utils.test.ts`
Expected: PASS

- [ ] **Step 5: Replace `formatDealPrice` in `deal-pipeline.ts`**

Read `apps/web/src/lib/deal-pipeline.ts` in full first (it exports several functions; only touch `formatDealPrice`). Replace:

```ts
export function formatDealPrice(price: number | null): string {
  if (price === null) return "—";
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  return `$${Math.round(price / 1000)}k`;
}
```

with:

```ts
import { formatCompactCurrency } from "@/lib/utils";

export function formatDealPrice(price: number | null): string {
  return formatCompactCurrency(price);
}
```

(Add the import at the top of the file alongside existing imports — do not remove any other existing export from this file. Note the old function lowercased "k" for thousands; `formatCompactCurrency` uses "K" — check whether any existing test in `apps/web/src/__tests__/lib/deal-pipeline.test.ts` asserts on the lowercase "k" and update it to "K" if so.)

- [ ] **Step 6: Replace `formatVolume` in `AgentProfileHero.tsx`**

Replace lines 34-38:

```ts
function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v.toLocaleString()}`;
}
```

with nothing (delete the function) — add `import { formatCompactCurrency } from "@/lib/utils";` to the top imports, and change line 75 from:

```ts
value: volumeClosed > 0 ? formatVolume(volumeClosed) : "—",
```

to:

```ts
value: volumeClosed > 0 ? formatCompactCurrency(volumeClosed) : "—",
```

- [ ] **Step 7: Replace `formatPriceShort` in `home-value-estimate.ts`**

Replace lines 319-325:

```ts
export function formatPriceShort(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)}M`;
  }
  return `$${Math.round(n / 1000)}K`;
}
```

with:

```ts
import { formatCompactCurrency } from "@/lib/utils";

export function formatPriceShort(n: number): string {
  return formatCompactCurrency(n);
}
```

(Add the import at the top of the file alongside existing imports. Keep `formatPriceShort` as an exported wrapper — do not rename it or its call sites at lines 341/359 in this same file, since renaming is out of scope.)

- [ ] **Step 8: Update the existing 2-decimal test expectations**

In `apps/web/src/__tests__/lib/home-value-estimate.test.ts`, find the `describe("formatPriceShort", ...)` block (around line 486) and update:

```ts
it("formats 1250000 with 2 decimals when not a whole million", async () => {
  const { formatPriceShort } = await import("@/lib/home-value-estimate");
  expect(formatPriceShort(1250000)).toBe("$1.25M");
});
```

to:

```ts
it("formats 1250000 with 1 decimal when not a whole million", async () => {
  const { formatPriceShort } = await import("@/lib/home-value-estimate");
  expect(formatPriceShort(1250000)).toBe("$1.3M");
});
```

(Read the surrounding 2 test cases at lines 486-499 first — only the 2-decimal assertion needs to change; the `$725K` and `$2M` cases are unaffected by the precision change and should stay as-is.)

- [ ] **Step 9: Run the full suite**

Run: `pnpm --filter web test -- --run`
Expected: all pass. If `deal-pipeline.test.ts` had a lowercase-"k" assertion, confirm it was updated in Step 5 and now passes.

- [ ] **Step 10: Type-check**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors in any of the 4 files touched.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/lib/utils.ts apps/web/src/lib/deal-pipeline.ts apps/web/src/components/agents/AgentProfileHero.tsx apps/web/src/lib/home-value-estimate.ts apps/web/src/__tests__/lib/utils.test.ts apps/web/src/__tests__/lib/home-value-estimate.test.ts apps/web/src/__tests__/lib/deal-pipeline.test.ts
git commit -m "refactor: consolidate 3 divergent large-dollar formatters into one shared formatCompactCurrency"
```

---

## Task 3: Cap unbounded ADMIN-facing list queries

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/leads/page.tsx:56-58`
- Modify: `apps/web/src/app/api/tasks/route.ts:43-50`
- Modify: `apps/web/src/app/(dashboard)/dashboard/campaigns/page.tsx:25-29`
- Modify: `apps/web/src/app/api/admin/leads/unassigned/route.ts:11-24`

**Interfaces:** None — this task only adds `take` limits to existing queries. No signatures change.

**Context:** Each of these 4 queries has a `where: agentId ? {...} : {}` (or equivalent `!isAdmin` gate) pattern that becomes an unscoped, un-limited `findMany` for an ADMIN caller. This is a real, live gap on pages an admin hits routinely (dashboard Leads/Tasks/Campaigns tabs), not a hypothetical. There is no existing pagination UI on any of these 4 pages/routes — a defensive `take` cap is the correct minimal fix, not new pagination.

- [ ] **Step 1: Cap `dashboard/leads/page.tsx`**

Read the file first to confirm current line numbers still match (line 56-58 as of this plan). Change:

```ts
const leads = await prisma.lead.findMany({
  where: agentId ? { agentId } : {},
  orderBy: { createdAt: "desc" },
```

to:

```ts
const leads = await prisma.lead.findMany({
  where: agentId ? { agentId } : {},
  orderBy: { createdAt: "desc" },
  take: 500,
```

- [ ] **Step 2: Cap `api/tasks/route.ts`**

Change:

```ts
  const tasks = await prisma.leadTask.findMany({
    where: {
      ...(doneFilter !== undefined ? { done: doneFilter } : {}),
      ...(!isAdmin ? { lead: { agentId } } : {}),
    },
    include: { lead: { select: { firstName: true, lastName: true } } },
    orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
  });
```

to:

```ts
  const tasks = await prisma.leadTask.findMany({
    where: {
      ...(doneFilter !== undefined ? { done: doneFilter } : {}),
      ...(!isAdmin ? { lead: { agentId } } : {}),
    },
    include: { lead: { select: { firstName: true, lastName: true } } },
    orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
    take: 500,
  });
```

- [ ] **Step 3: Cap `dashboard/campaigns/page.tsx`**

Change:

```ts
    campaigns = await prisma.campaign.findMany({
      where: agentId ? { agentId } : {},
      include: { _count: { select: { contacts: true } } },
      orderBy: { createdAt: "desc" },
    });
```

to:

```ts
    campaigns = await prisma.campaign.findMany({
      where: agentId ? { agentId } : {},
      include: { _count: { select: { contacts: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
```

- [ ] **Step 4: Cap `admin/leads/unassigned/route.ts`**

Change:

```ts
  const leads = await prisma.lead.findMany({
    where: { agentId: null },
    orderBy: { createdAt: "desc" },
    select: {
```

to:

```ts
  const leads = await prisma.lead.findMany({
    where: { agentId: null },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
```

- [ ] **Step 5: Run the full test suite**

Run: `pnpm --filter web test -- --run`
Expected: all pass — none of these files have existing tests asserting on unbounded result-set size, so this should be a no-op for test results. If any test mocks `findMany` and asserts on the exact call arguments (unlikely for these 4 files — confirm via `grep -rln "leads/page\|tasks/route\|campaigns/page\|unassigned/route" apps/web/src/__tests__/` first), update the expected call shape to include `take: 500`.

- [ ] **Step 6: Type-check**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/leads/page.tsx" apps/web/src/app/api/tasks/route.ts "apps/web/src/app/(dashboard)/dashboard/campaigns/page.tsx" apps/web/src/app/api/admin/leads/unassigned/route.ts
git commit -m "fix: cap unbounded ADMIN-scope queries on leads/tasks/campaigns pages at take:500"
```

---

## Task 4: Add missing B-tree indexes (TransactionFile, ListingFile, CampaignContact, Activity)

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Migration: new folder under `packages/database/prisma/migrations/`

**Interfaces:** None — schema-only change, no application code touched in this task.

**Context:** `TransactionFile` and `ListingFile` (schema.prisma lines 438-532) have zero `@@index` declarations despite being filtered by `agentId`, `status`, and `awaitingReview` on nearly every authenticated page load (agent dashboard, admin dashboard, public agent-profile pages, the deadline-reminder cron). `CampaignContact` only has a composite `@@unique([campaignId, leadId])`, which does not help queries filtering on `leadId` alone (SendGrid webhook handler, lead-merge route). `Activity` has `@@index([leadId])` and `@@index([transactionId])` but nothing on `createdAt`, despite both the admin Reports page and every agent's "My Stats" tab filtering the whole table by a `createdAt` date range.

**Important — the dev server must be stopped before this task** (Prisma client regeneration will EPERM if the dev server holds the DLL). Confirm with the user before stopping it, or check the process isn't running via `Get-CimInstance Win32_Process -Filter "name = 'node.exe'"` and only proceed once it's safe.

- [ ] **Step 1: Stop the dev server if running**

If a `next dev` process is running, stop it before continuing (this task needs to run `prisma migrate dev`, which regenerates the Prisma client).

- [ ] **Step 2: Add indexes to `schema.prisma`**

Find `model ListingFile` (currently ends at line 464 with just `tasks FileTask[]` before the closing brace) and add an index block before the closing `}`:

```prisma
  @@index([agentId])
  @@index([status])
  @@index([awaitingReview])
}
```

Find `model TransactionFile` (currently ends with `deal Deal?` before the closing brace) and add before the closing `}`:

```prisma
  @@index([agentId])
  @@index([status])
  @@index([awaitingReview])
}
```

Find `model CampaignContact` and add a new index line alongside the existing `@@unique`:

```prisma
  @@unique([campaignId, leadId])
  @@index([leadId])
```

Find `model Activity` and add to its existing index block:

```prisma
  @@index([leadId])
  @@index([transactionId])
  @@index([createdAt])
```

- [ ] **Step 3: Generate the migration**

Run from `packages/database`:

```bash
pnpm --filter @cnc/database exec prisma migrate dev --name add_missing_indexes_transaction_listing_campaign_activity
```

Expected: Prisma detects the 4 new `@@index` additions via schema diff and generates a migration folder containing 4 `CREATE INDEX` statements. **Do not hand-write this migration.sql** — this project has a documented incident (2026-07-16 commercial-listing plan, Task 1) where a hand-written migration silently introduced an undeclared column default that `prisma migrate dev`'s diffing would never have produced. Let Prisma generate it from the schema diff.

- [ ] **Step 4: Verify the generated migration**

Run: `cat packages/database/prisma/migrations/<newest-folder>/migration.sql`
Expected: exactly 6 `CREATE INDEX` statements (2 on ListingFile, 3 on TransactionFile... wait, 3 each on ListingFile/TransactionFile = 6, plus 1 on CampaignContact, plus 1 on Activity = 8 total). Confirm no unexpected `ALTER TABLE ... SET DEFAULT` or column-type changes appear — only `CREATE INDEX` statements should be present.

- [ ] **Step 5: Confirm no drift**

Run: `pnpm --filter @cnc/database exec prisma migrate status`
Expected: "Database schema is up to date!"

- [ ] **Step 6: Run the full test suite**

Run: `pnpm --filter web test -- --run`
Expected: all pass — this is a pure schema/index change, no query-shape or application-code change, so no test should be affected.

- [ ] **Step 7: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "perf: add missing indexes on TransactionFile/ListingFile (agentId, status, awaitingReview), CampaignContact.leadId, and Activity.createdAt"
```

---

## Task 5: Enable pg_trgm and add trigram indexes for Property city/address search

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Migration: 2 new folders under `packages/database/prisma/migrations/` (one for the extension, one for the indexes — see Step 2 for why this must be 2 separate migrations)

**Interfaces:** None — schema-only, no application code touched.

**Context:** `apps/web/src/lib/property-search-query.ts` builds `{ address: { contains: q, mode: "insensitive" } }` / `{ city: { contains: q, mode: "insensitive" } }` for the property search bar (including the homepage hero search). A standard B-tree index (what `@@index([city])` produces) cannot accelerate a leading-wildcard `ILIKE '%text%'` query — only a trigram (`pg_trgm`) GIN index can. This is confirmed as stable, non-preview functionality in Prisma 5.x (verified against current Prisma docs before writing this plan) — `ops: raw("gin_trgm_ops")` requires no preview feature flag. Enabling the extension itself, however, is not something `prisma migrate dev`'s schema diffing can express without the separate `postgresqlExtensions` preview feature — so this task deliberately does NOT take on that preview feature. Instead it follows Prisma's own documented pattern for this exact situation: an empty migration hand-edited to add `CREATE EXTENSION IF NOT EXISTS pg_trgm;`, followed by a normal schema-diffed migration for the indexes themselves.

**This task must run after Task 4** (so the migration history stays linear) and, like Task 4, **requires the dev server to be stopped first**.

- [ ] **Step 1: Confirm dev server is stopped**

Same check as Task 4 Step 1.

- [ ] **Step 2: Create an empty migration for the extension**

Run from `packages/database`:

```bash
pnpm --filter @cnc/database exec prisma migrate dev --create-only --name enable_pg_trgm_extension
```

Expected: Prisma creates a new, empty migration folder (schema.prisma hasn't changed yet at this point, so the diff is empty).

- [ ] **Step 3: Hand-edit that one migration to add the extension**

Open the newly created `packages/database/prisma/migrations/<timestamp>_enable_pg_trgm_extension/migration.sql` (currently empty or containing only a comment) and set its full contents to exactly:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

This is the one deliberate, sanctioned exception to "don't hand-write migrations" in this plan — it is the officially documented Prisma pattern for enabling a Postgres extension without the `postgresqlExtensions` preview feature, and this step does not touch any table/column/index definition (the actual index changes in Step 5 below will still go through normal `prisma migrate dev` diffing).

- [ ] **Step 4: Apply that migration**

Run: `pnpm --filter @cnc/database exec prisma migrate deploy`
Expected: the `enable_pg_trgm_extension` migration applies cleanly. Verify with a direct query:

```bash
pnpm --filter @cnc/database exec prisma db execute --stdin <<< "SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';"
```

Expected output includes a row with `pg_trgm`.

- [ ] **Step 5: Add the GIN indexes to schema.prisma**

In `model Property`, add 2 lines to the existing index block (after the last `@@index([status, zip, closeDate])` line):

```prisma
  @@index([city(ops: raw("gin_trgm_ops"))], type: Gin)
  @@index([address(ops: raw("gin_trgm_ops"))], type: Gin)
```

- [ ] **Step 6: Generate the index migration normally**

Run: `pnpm --filter @cnc/database exec prisma migrate dev --name add_property_trigram_indexes`
Expected: Prisma diffs the schema change and generates `CREATE INDEX ... USING GIN (city gin_trgm_ops)` and the same for `address`. This step uses normal diffing — do not hand-write it.

- [ ] **Step 7: Verify the generated migration**

Run: `cat packages/database/prisma/migrations/<newest-folder>/migration.sql`
Expected: exactly 2 `CREATE INDEX ... USING GIN` statements referencing `gin_trgm_ops`, nothing else.

- [ ] **Step 8: Confirm no drift**

Run: `pnpm --filter @cnc/database exec prisma migrate status`
Expected: "Database schema is up to date!"

- [ ] **Step 9: Live-verify the index is actually used**

With the dev server running again (`pnpm --filter web dev`), query the DB directly to confirm Postgres picks the new index for a substring search:

```bash
pnpm --filter @cnc/database exec prisma db execute --stdin <<< "EXPLAIN SELECT * FROM \"Property\" WHERE city ILIKE '%cerrit%' LIMIT 20;"
```

Expected: the query plan mentions a `Bitmap Index Scan` (or similar) referencing the new GIN index, not a `Seq Scan` on the full table. If it still shows a sequential scan, do not treat this as a hard failure — Postgres's planner can prefer a seq scan on some data distributions even with a valid index present — but note this in the task's final report rather than silently assuming success.

- [ ] **Step 10: Run the full test suite**

Run: `pnpm --filter web test -- --run`
Expected: all pass — no application code changed.

- [ ] **Step 11: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "perf: enable pg_trgm and add GIN trigram indexes on Property.city/address for substring search"
```

---

## Task 6: Dedupe property and press detail-page double queries via React cache()

**Files:**
- Modify: `apps/web/src/app/(listings)/properties/[mlsNumber]/page.tsx`
- Modify: `apps/web/src/app/press/[slug]/page.tsx`

**Interfaces:** None new — internal refactor only, page output is unchanged.

**Context:** Next.js runs `generateMetadata` and the page component as separate server executions per request; raw Prisma calls (unlike `fetch()`) are not automatically deduped between them. Both files currently call `prisma.X.findUnique` twice per page view. The established, already-correct pattern for this in this exact codebase is `apps/web/src/app/(agents)/agents/[slug]/page.tsx:11-16`, which wraps a single `select`-complete Prisma call in React's `cache()` and has both `generateMetadata` and the page body call the same cached function.

- [ ] **Step 1: Fix `properties/[mlsNumber]/page.tsx`**

Read the full current file first. Add `import { cache } from "react";` to the top imports. Replace the top-level structure — the page body currently calls `prisma.property.findUnique({ where: { mlsNumber: params.mlsNumber } })` with no `select` (full record), and `generateMetadata` calls it separately with a narrow 6-field `select`. Unify on the full-record shape (matching the page body's existing behavior, since `generateMetadata`'s needs are a subset of the full record):

```ts
const getProperty = cache((mlsNumber: string) =>
  prisma.property.findUnique({ where: { mlsNumber } })
);
```

Place this right after the imports, before `generateMetadata`. Then in `generateMetadata`, replace:

```ts
  let property = null;
  try {
    property = await prisma.property.findUnique({
      where: { mlsNumber: params.mlsNumber },
      select: { address: true, city: true, state: true, listPrice: true, photos: true, description: true },
    });
  } catch {
    return { title: "Property" };
  }
```

with:

```ts
  let property = null;
  try {
    property = await getProperty(params.mlsNumber);
  } catch {
    return { title: "Property" };
  }
```

And in `PropertyDetailPage`, replace:

```ts
  let property = null;
  try {
    property = await prisma.property.findUnique({ where: { mlsNumber: params.mlsNumber } });
  } catch {
```

with:

```ts
  let property = null;
  try {
    property = await getProperty(params.mlsNumber);
  } catch {
```

- [ ] **Step 2: Fix `press/[slug]/page.tsx`**

Read the full current file first (already read in full during plan research — reproduced below for reference, but re-read before editing in case it changed). Add `import { cache } from "react";` to the top imports. The page body's existing `select` (id, title, slug, excerpt, content, coverImage, publishedAt, authorName, author.name) is a strict superset of `generateMetadata`'s (title, excerpt, coverImage) — use the page body's select as the single cached function:

```ts
const getPost = cache((slug: string) =>
  prisma.blogPost.findUnique({
    where: { slug, published: true },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      coverImage: true,
      publishedAt: true,
      authorName: true,
      author: { select: { name: true } },
    },
  })
);
```

Place this after the imports, before `generateMetadata`. Replace `generateMetadata`'s body:

```ts
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({
    where: { slug, published: true },
    select: { title: true, excerpt: true, coverImage: true },
  });
  if (!post) return { title: "Not Found" };
```

with:

```ts
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Not Found" };
```

And in `PressPostPage`, replace:

```ts
  const { slug } = await params;

  const post = await prisma.blogPost.findUnique({
    where: { slug, published: true },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      coverImage: true,
      publishedAt: true,
      authorName: true,
      author: { select: { name: true } },
    },
  });

  if (!post) notFound();
```

with:

```ts
  const { slug } = await params;

  const post = await getPost(slug);

  if (!post) notFound();
```

(Leave the `others` query — the "related posts" `findMany` — completely untouched; it's a genuine dependent query on `post.id`, not part of this bug.)

- [ ] **Step 3: Run the full test suite**

Run: `pnpm --filter web test -- --run`
Expected: all pass — check first whether either page has an existing test (`grep -rln "properties/\[mlsNumber\]\|press/\[slug\]" apps/web/src/__tests__/`); if one exists, it should still pass unchanged since the query shape returned to callers is unchanged, only the call count changes.

- [ ] **Step 4: Type-check**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors in either file.

- [ ] **Step 5: Live-verify both pages still render correctly**

Start the dev server if not running (`pnpm --filter web dev`), then use Puppeteer to navigate to a real property detail page (any valid `mlsNumber` from the DB) and a real press post (any valid `slug`), confirming both render with correct title, price/content, and metadata (check the page `<title>` via `document.title`) — not just that they don't crash.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(listings)/properties/[mlsNumber]/page.tsx" apps/web/src/app/press/\[slug\]/page.tsx
git commit -m "perf: dedupe property and press detail-page double queries with React cache(), matching the agents/[slug] pattern"
```

---

## Task 7: Fix redundant agent lookups in deadlines and dismiss-brokerage-assignments routes

**Files:**
- Modify: `apps/web/src/app/api/transactions/deadlines/route.ts`
- Modify: `apps/web/src/app/api/leads/dismiss-brokerage-assignments/route.ts`

**Interfaces:** None new — both routes' response shapes are unchanged.

**Context:** `deadlines/route.ts` uses raw `getServerSession(authOptions)` instead of this codebase's `requireAuth()` helper, so it never benefits from the JWT-cached `agentId` added in the 2026-07-08 dashboard-lag fix — it re-queries `prisma.agent.findUnique` on every call, and this route is hit on every single agent dashboard load via `<DeadlineAlerts />` (rendered unconditionally at the top of `dashboard/page.tsx`). `dismiss-brokerage-assignments/route.ts` already uses `requireAuth("AGENT")` (which provides `session.user.agentId`) but ignores it and re-queries anyway.

- [ ] **Step 1: Fix `deadlines/route.ts`**

Replace:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { TransactionFileStatus } from "@cnc/database";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEADLINE_WINDOW_DAYS = 7;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "AGENT" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + DEADLINE_WINDOW_DAYS);

  let scopedAgentId: string | undefined;
  if (role === "AGENT") {
    const agent = await prisma.agent.findUnique({
      where: { userId: (session.user as { id: string }).id },
      select: { id: true },
    });
    if (!agent) return NextResponse.json({ deadlines: [] });
    scopedAgentId = agent.id;
  }
```

with:

```ts
import { NextResponse } from "next/server";
import { TransactionFileStatus } from "@cnc/database";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const DEADLINE_WINDOW_DAYS = 7;

export async function GET() {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + DEADLINE_WINDOW_DAYS);

  let scopedAgentId: string | undefined;
  if (session.user.role === "AGENT") {
    if (!session.user.agentId) return NextResponse.json({ deadlines: [] });
    scopedAgentId = session.user.agentId;
  }
```

(Leave everything from `const where = {...}` to the end of the file completely unchanged — only the imports and the auth/scoping block above change. `requireAuth("AGENT")` allows both AGENT and ADMIN through, matching the original route's own role check exactly.)

- [ ] **Step 2: Fix `dismiss-brokerage-assignments/route.ts`**

Replace:

```ts
export async function POST() {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const agent = await prisma.agent.findUnique({
    where: { userId: session.user.id },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 403 });
  }

  const result = await prisma.lead.updateMany({
    where: {
      agentId: agent.id,
      brokerageFed: true,
      assignmentSeenAt: null,
    },
    data: { assignmentSeenAt: new Date() },
  });

  return NextResponse.json({ dismissed: result.count });
}
```

with:

```ts
export async function POST() {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  if (!session.user.agentId) {
    return NextResponse.json({ error: "Agent not found" }, { status: 403 });
  }

  const result = await prisma.lead.updateMany({
    where: {
      agentId: session.user.agentId,
      brokerageFed: true,
      assignmentSeenAt: null,
    },
    data: { assignmentSeenAt: new Date() },
  });

  return NextResponse.json({ dismissed: result.count });
}
```

- [ ] **Step 3: Check for existing tests on these 2 routes**

Run: `grep -rln "transactions/deadlines\|dismiss-brokerage-assignments" apps/web/src/__tests__/`
If `deadlines.test.ts` or similar exists, read it — it likely mocks `getServerSession` directly (the OLD pattern). Update its mocks to mock `requireAuth` from `@/lib/api-auth` instead, following the exact pattern already used in `apps/web/src/__tests__/api/leads-export.test.ts` (`vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }))`, then `vi.mocked(requireAuth).mockResolvedValue({ session: {...}, error: null })` per test case). Preserve every existing test's intent (401/403/200 cases) — only change how auth is mocked, not what's asserted.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm --filter web test -- --run`
Expected: all pass, including any updated tests from Step 3.

- [ ] **Step 5: Type-check**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors in either file.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/transactions/deadlines/route.ts apps/web/src/app/api/leads/dismiss-brokerage-assignments/route.ts apps/web/src/__tests__/api/
git commit -m "perf: use cached session.agentId instead of redundant agent.findUnique in deadlines and dismiss-brokerage-assignments routes"
```

---

## Task 8: Reduce unbounded Activity aggregation in admin/reports

**Files:**
- Modify: `apps/web/src/app/api/admin/reports/route.ts`

**Interfaces:** None new — response shape unchanged.

**Context:** The `activities` query (`prisma.activity.findMany({ where: { createdAt: dateFilter, leadId: { not: null } }, select: { type: true, lead: { select: { agentId: true } } } })`) materializes every Activity row in the date range into Node memory to count them per-agent in a JS `Map`. `Activity` has no direct `agentId` column (only `leadId`), so a single-step `groupBy(by: ["agentId"])` isn't possible without a raw SQL join — but the expensive part (counting potentially thousands of rows) can be pushed to Postgres via a 2-step `groupBy` + small lookup, replacing the full-row materialization. The `speedLeads` query cannot be similarly reduced without raw SQL (it needs an average of `lastContactedAt - createdAt`, which Prisma's typed `groupBy` API can't express) — leave it as `findMany` but add a defensive `take` cap, same reasoning as Task 3.

- [ ] **Step 1: Read the full current file**

Re-read `apps/web/src/app/api/admin/reports/route.ts` in full before editing — confirm the line numbers below still match; if the file has changed since this plan was written, adapt the edit to the current structure rather than blindly applying a stale diff.

- [ ] **Step 2: Replace the `activities` query and its aggregation**

Replace this array entry inside the `Promise.all`:

```ts
      // all activities in range with their lead's agentId
      prisma.activity.findMany({
        where: { createdAt: dateFilter as any, leadId: { not: null } },
        select: { type: true, lead: { select: { agentId: true } } },
      }),
```

with:

```ts
      // per-lead activity counts in range (aggregated in Postgres, not in JS)
      prisma.activity.groupBy({
        by: ["leadId"],
        where: { createdAt: dateFilter as any, leadId: { not: null } },
        _count: { id: true },
      }),
```

Update the destructured variable name in the `Promise.all` assignment — change:

```ts
  const [leadGroups, activities, pipelineGroups, closedGroups, speedLeads, sourceGroups, activityGroups] =
```

to:

```ts
  const [leadGroups, activityCountsByLead, pipelineGroups, closedGroups, speedLeads, sourceGroups, activityGroups] =
```

Then replace the JS aggregation block:

```ts
  const activitiesMap = new Map<string, number>();
  for (const a of activities) {
    const aid = a.lead?.agentId;
    if (aid) activitiesMap.set(aid, (activitiesMap.get(aid) ?? 0) + 1);
  }
```

with:

```ts
  const leadIdsWithActivity = activityCountsByLead
    .map((g) => g.leadId)
    .filter((id): id is string => id !== null);
  const leadsForActivityMap = leadIdsWithActivity.length > 0
    ? await prisma.lead.findMany({
        where: { id: { in: leadIdsWithActivity } },
        select: { id: true, agentId: true },
      })
    : [];
  const leadIdToAgentId = new Map(leadsForActivityMap.map((l) => [l.id, l.agentId]));

  const activitiesMap = new Map<string, number>();
  for (const g of activityCountsByLead) {
    if (!g.leadId) continue;
    const aid = leadIdToAgentId.get(g.leadId);
    if (aid) activitiesMap.set(aid, (activitiesMap.get(aid) ?? 0) + g._count.id);
  }
```

(This trades one large `findMany` — potentially thousands of Activity rows — for one `groupBy` aggregated in Postgres plus one small `findMany` scoped to only the distinct leads that actually have activity in range, which is bounded by lead count, not activity-event count.)

- [ ] **Step 3: Cap the `speedLeads` query defensively**

Find:

```ts
      // leads with lastContactedAt for speed-to-lead
      prisma.lead.findMany({
        where: {
          createdAt: dateFilter as any,
          lastContactedAt: { not: null },
          agentId: { not: null },
        },
        select: { agentId: true, createdAt: true, lastContactedAt: true },
      }),
```

and add a `take`:

```ts
      // leads with lastContactedAt for speed-to-lead
      prisma.lead.findMany({
        where: {
          createdAt: dateFilter as any,
          lastContactedAt: { not: null },
          agentId: { not: null },
        },
        select: { agentId: true, createdAt: true, lastContactedAt: true },
        take: 2000,
      }),
```

- [ ] **Step 4: Check for an existing test on this route**

Run: `grep -rln "admin/reports" apps/web/src/__tests__/`
If a test exists, read it — it likely mocks `prisma.activity.findMany` directly for the old query shape. Update the mock to mock `prisma.activity.groupBy` (for the new leadId-count query) and add a mock for the new `prisma.lead.findMany` lookup, returning data that lets the existing assertions on `leaderboard[].activitiesLogged` still pass with the same expected counts.

- [ ] **Step 5: Run the full test suite**

Run: `pnpm --filter web test -- --run`
Expected: all pass, including the updated test from Step 4.

- [ ] **Step 6: Type-check**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Live-verify the admin Reports page still shows correct numbers**

With the dev server running, navigate to `/admin/reports` as an ADMIN session via Puppeteer and confirm the leaderboard's "Activities Logged" column shows non-zero, sensible numbers (cross-check one agent's count against a direct DB query: `SELECT COUNT(*) FROM "Activity" a JOIN "Lead" l ON a."leadId" = l.id WHERE l."agentId" = '<that agent's id>'` for the same date range) — not just that the page doesn't crash.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/api/admin/reports/route.ts apps/web/src/__tests__/api/
git commit -m "perf: aggregate admin/reports activity counts via groupBy instead of materializing every row in JS"
```

---

## Task 9: Extract a shared ownership-check helper and fix the null-safety gap

**Files:**
- Modify: `apps/web/src/lib/api-auth.ts` (add shared helper)
- Modify: `apps/web/src/app/api/leads/[id]/route.ts`
- Modify: `apps/web/src/app/api/leads/[id]/tasks/route.ts`
- Modify: `apps/web/src/app/api/leads/[id]/tags/route.ts`
- Modify: `apps/web/src/app/api/leads/[id]/homes/route.ts`
- Modify: `apps/web/src/app/api/leads/[id]/relationships/route.ts`
- Modify: `apps/web/src/app/api/leads/[id]/enrollments/route.ts`
- Modify: `apps/web/src/app/api/smart-lists/[id]/route.ts`
- Modify: `apps/web/src/app/api/transactions/[id]/conditions/route.ts`
- Modify: `apps/web/src/app/api/transactions/[id]/route.ts`
- Modify: `apps/web/src/app/api/transactions/[id]/photo/route.ts`
- Modify: `apps/web/src/app/api/listings/[id]/route.ts`
- Modify: `apps/web/src/app/api/campaigns/[id]/route.ts`
- Modify: `apps/web/src/app/api/files/[fileType]/[id]/parties/route.ts`
- Test: `apps/web/src/__tests__/lib/api-auth-ownership.test.ts` (new)

**Interfaces:**
- Produces: `checkOwnership<T extends { agentId: string | null }>(record: T | null, callerAgentId: string | null, role: string): { exists: boolean; forbidden: boolean; record: T | null }` exported from `@/lib/api-auth`. Every file in this task's list consumes it.

**Context — this is the largest task in the plan, read carefully before starting.** The identical rule — "ADMIN can access anything; otherwise the resource's `agentId` must equal the caller's `agentId`" — is currently hand-written independently in 14 files across 2 different shapes:

1. A boolean-returning `assertOwnership(id, agentId, role): Promise<boolean>` in 6 files (against 5 different resources: Lead ×5 files, SmartList ×1), each doing its own `findUnique` then comparing. Callers of this shape collapse "doesn't exist" and "not yours" into a single 404 response (a deliberate, correct security pattern — don't leak existence of a resource you don't own). These 6 already front-load a `if (!agentId) return false;` guard on the caller's side, independent of the resource — they were never actually buggy.
2. An object-returning `{exists, forbidden}` (or similar) shape in 8 files, where callers distinguish 404 (not found) from 403 (forbidden) as separate responses. 3 of these 8 are missing an explicit `!callerAgentId ||` null-safety guard on the comparison: `campaigns/[id]/route.ts`'s `checkAccess`, `files/[fileType]/[id]/parties/route.ts`'s `getFileAndVerifyAccess`, and 6 inline occurrences across `transactions/[id]/route.ts` (×2), `transactions/[id]/photo/route.ts` (×1), and `listings/[id]/route.ts` (×3).

**Verified severity — corrected from the original audit framing, do not overstate this.** Checked `agentId`'s actual nullability on every model involved: `TransactionFile.agentId` and `ListingFile.agentId` are both schema-required (`String`, not `String?`) — so on 7 of those 8 files (everything except `campaigns/[id]/route.ts`), the resource's `agentId` can **never** be null, meaning the missing guard was never actually reachable (`someRealId !== null` is always `true` regardless of the guard). Only `Campaign.agentId` is nullable (`String?`), and a caller's own `session.user.agentId` can also legitimately be null (an AGENT-role user before their `Agent` record exists) — so `campaigns/[id]/route.ts` is the **one file with a real, if narrow, gap**.

Further verified this specific gap is currently unreachable in practice, not just narrow: grepped every `Campaign` write path — `POST /api/campaigns` requires a non-null `agentId` before it will create a row at all; `PATCH /api/campaigns/[id]`'s schema doesn't include `agentId`, so it can never be changed after creation; the send route never touches it. A direct query against the live database confirms zero `Campaign` rows currently have a null `agentId` (zero campaigns exist at all as of this writing). Also traced all 4 reachable input combinations for the old-vs-new comparison logic by hand: 3 of the 4 produce an identical result under both the old and new logic; the 4th (both sides null) changes from wrongly-allowed to correctly-denied, never the reverse — so this fix cannot break any currently-working access pattern, only close a gap that isn't presently exploitable through any code path but would become one the moment any future feature allows an unassigned Campaign or a null-agentId session to interact with one.

**What this task actually is, then:** one real (currently-dormant, not exploitable-today) security fix in `campaigns/[id]/route.ts`, plus a DRY consolidation of 13 other files that were never individually buggy but duplicate the same rule 13 times — worth doing so a future nullable-`agentId` field doesn't reintroduce this exact class of gap unnoticed, not because they're broken today.

The fix extracts ONE generic helper containing just the authorization decision (not the fetch — each call site keeps its own `findUnique`/`select` shape, since they vary), used by all 14 files, uniformly null-safe. **Do this task file-by-file, verifying each one individually** — do not attempt a single global find-and-replace, since the exact surrounding code differs per file (different models, different response-code conventions, different existing `select` shapes).

- [ ] **Step 1: Write the failing test for the shared helper**

Create `apps/web/src/__tests__/lib/api-auth-ownership.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { checkOwnership } from "@/lib/api-auth";

describe("checkOwnership", () => {
  it("reports not-exists when the record is null, regardless of role", () => {
    expect(checkOwnership(null, "agent-1", "AGENT")).toEqual({ exists: false, forbidden: false, record: null });
    expect(checkOwnership(null, "agent-1", "ADMIN")).toEqual({ exists: false, forbidden: false, record: null });
  });

  it("ADMIN is never forbidden on an existing record", () => {
    const record = { agentId: "someone-else" };
    expect(checkOwnership(record, "agent-1", "ADMIN")).toEqual({ exists: true, forbidden: false, record });
  });

  it("AGENT is allowed when the record's agentId matches their own", () => {
    const record = { agentId: "agent-1" };
    expect(checkOwnership(record, "agent-1", "AGENT")).toEqual({ exists: true, forbidden: false, record });
  });

  it("AGENT is forbidden when the record's agentId does not match", () => {
    const record = { agentId: "someone-else" };
    expect(checkOwnership(record, "agent-1", "AGENT")).toEqual({ exists: true, forbidden: true, record });
  });

  it("is forbidden when the caller's own agentId is null, even if the record's agentId is also null", () => {
    // Regression test for the real gap this task fixes: a bare `!==`
    // comparison would grant access here (null !== null is false), letting
    // an AGENT-role session with no linked Agent record yet access any
    // resource that also happens to have a null agentId.
    const record = { agentId: null };
    expect(checkOwnership(record, null, "AGENT")).toEqual({ exists: true, forbidden: true, record });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- --run src/__tests__/lib/api-auth-ownership.test.ts`
Expected: FAIL — `checkOwnership is not a function`.

- [ ] **Step 3: Add the helper to `lib/api-auth.ts`**

Read the full current file first (it already exports `requireAuth`). Append:

```ts
export function checkOwnership<T extends { agentId: string | null }>(
  record: T | null,
  callerAgentId: string | null,
  role: string
): { exists: boolean; forbidden: boolean; record: T | null } {
  if (!record) return { exists: false, forbidden: false, record: null };
  if (role === "ADMIN") return { exists: true, forbidden: false, record };
  return { exists: true, forbidden: !callerAgentId || record.agentId !== callerAgentId, record };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- --run src/__tests__/lib/api-auth-ownership.test.ts`
Expected: PASS

- [ ] **Step 5: Migrate the 6 boolean-`assertOwnership` files (uniform-404 callers)**

For each of `leads/[id]/route.ts`, `leads/[id]/tasks/route.ts`, `leads/[id]/tags/route.ts`, `leads/[id]/homes/route.ts`, `leads/[id]/relationships/route.ts`, `leads/[id]/enrollments/route.ts`:

Read the file. Delete its local `assertOwnership` function (the 5-line block starting `async function assertOwnership(leadId: string, agentId: string | null, role: string) {`). Add `import { requireAuth, checkOwnership } from "@/lib/api-auth";` if `checkOwnership` isn't already in the existing `requireAuth` import line (most files already `import { requireAuth } from "@/lib/api-auth"` — just add `checkOwnership` to that same import).

Replace every call site of the shape:

```ts
  const owns = await assertOwnership(params.id, session.user.agentId, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });
```

with:

```ts
  const lead = await prisma.lead.findUnique({ where: { id: params.id }, select: { agentId: true } });
  const { exists, forbidden } = checkOwnership(lead, session.user.agentId, session.user.role);
  if (!exists || forbidden) return NextResponse.json({ error: "Not found" }, { status: 404 });
```

(For `smart-lists/[id]/route.ts`, same pattern but `prisma.smartList.findUnique({ where: { id: listId }, select: { agentId: true } })` instead of `prisma.lead...` — check its exact variable name, likely `listId` not `leadId`, before editing.)

Verify each file individually after editing — re-read it in full to confirm every call site of the old `assertOwnership` was replaced (some files call it more than once, e.g. once in GET and once in PATCH/DELETE) and the file still imports everything it uses.

- [ ] **Step 6: Migrate `transactions/[id]/conditions/route.ts` (already-correct object-returning file)**

Read the file. Delete the local `checkFileAccess` function. Add `checkOwnership` to the existing `@/lib/api-auth` import. Replace its call sites — this file already has the right null-guard, so behavior must stay identical; the call site currently does:

```ts
  const { file, forbidden } = await checkFileAccess(params.id, session.user.agentId, session.user.role);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

Replace the fetch-and-check into 2 lines using the shared helper:

```ts
  const txFile = await prisma.transactionFile.findUnique({ where: { id: params.id } });
  const { exists, forbidden, record: file } = checkOwnership(txFile, session.user.agentId, session.user.role);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

(Note this file's original `checkFileAccess` fetched the FULL record with no `select`, not just `{agentId: true}` — preserve that, since the rest of the route likely uses other fields off `file`. Verify by reading how `file` is used later in the route before finalizing.)

- [ ] **Step 7: Fix `campaigns/[id]/route.ts` (real null-safety gap)**

Read the file. Delete the local `checkAccess` function:

```ts
async function checkAccess(id: string, agentId: string | null, role: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id }, select: { id: true, agentId: true } });
  if (!campaign) return { exists: false, forbidden: false };
  if (role === "ADMIN") return { exists: true, forbidden: false };
  return { exists: true, forbidden: agentId !== campaign.agentId };
}
```

Add `checkOwnership` to the `@/lib/api-auth` import. This file calls `checkAccess` 3 times (GET, PATCH, DELETE) with the pattern `const { exists, forbidden } = await checkAccess(params.id, session.user.agentId, session.user.role);` — replace each with:

```ts
  const campaign = await prisma.campaign.findUnique({ where: { id: params.id }, select: { id: true, agentId: true } });
  const { exists, forbidden } = checkOwnership(campaign, session.user.agentId, session.user.role);
```

(3 call sites, same replacement each time — the lines immediately after each, checking `forbidden`/`exists` and returning 403/404, stay unchanged.)

- [ ] **Step 8: Fix `files/[fileType]/[id]/parties/route.ts` (real null-safety gap)**

Read the file. This one's structure is different — `getFileAndVerifyAccess` branches on `fileType` to query either `listingFile` or `transactionFile`, and returns the file directly or `null` (not an `{exists, forbidden}` object) — its callers treat a `null` return as "not found or forbidden" (collapsed, like the boolean-`assertOwnership` group). Replace:

```ts
async function getFileAndVerifyAccess(fileType: string, fileId: string, agentId: string | null, userRole: string) {
  if (fileType === "listing") {
    const file = await prisma.listingFile.findUnique({ where: { id: fileId } });
    if (!file) return null;
    if (userRole !== "ADMIN" && file.agentId !== agentId) return null;
    return file;
  } else {
    const file = await prisma.transactionFile.findUnique({ where: { id: fileId } });
    if (!file) return null;
    if (userRole !== "ADMIN" && file.agentId !== agentId) return null;
    return file;
  }
}
```

with:

```ts
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

(Add the `checkOwnership` import at the top of the file alongside its existing imports — this file currently imports `getServerSession`/`authOptions` directly rather than `requireAuth`, which is a separate, pre-existing pattern not in scope to change here; only fix the ownership-check function itself.)

- [ ] **Step 9: Fix the 6 inline occurrences in `transactions/[id]/route.ts`, `transactions/[id]/photo/route.ts`, `listings/[id]/route.ts`**

These 3 files don't have a named helper function at all — the check is written inline at each call site. For each of the 6 occurrences (2 in `transactions/[id]/route.ts`, 1 in `transactions/[id]/photo/route.ts`, 3 in `listings/[id]/route.ts`), the pattern is one of:

```ts
if (session.user.role !== "ADMIN" && tx.agentId !== session.user.agentId) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

or

```ts
const isAdmin = session.user.role === "ADMIN";
if (!isAdmin && tx.agentId !== session.user.agentId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

or

```ts
if (listing.agentId !== session.user.agentId && session.user.role !== "ADMIN") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

Add `checkOwnership` to each file's `@/lib/api-auth` import (add the import if the file doesn't already import from `@/lib/api-auth` at all — check first). Replace each occurrence with the null-safe equivalent, preserving the exact 403-only response shape these already use (they've already separately confirmed the record exists via an earlier `if (!tx) return 404` a few lines above each of these — do not add a duplicate exists-check, only fix the forbidden-check itself):

```ts
const { forbidden } = checkOwnership(tx, session.user.agentId, session.user.role);
if (forbidden) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

(Substitute `listing` for `tx` in `listings/[id]/route.ts`'s 3 occurrences. Read each file fully before editing — confirm the exact variable name holding the fetched record at each call site, since it varies, and confirm each occurrence already has its own preceding `if (!record) return 404` so `checkOwnership`'s `exists`/`record` fields can be safely ignored here — only destructure `forbidden`.)

- [ ] **Step 10: Verify no `assertOwnership`/`checkAccess`/`getFileAndVerifyAccess`/inline bare-`!==` pattern remains**

Run: `grep -rn "async function assertOwnership\|async function checkAccess" apps/web/src/app/api/`
Expected: no matches (all deleted in favor of the shared helper).

Run: `grep -rn "agentId !== session.user.agentId\|agentId !== agent" apps/web/src/app/api/ | grep -v "checkOwnership\|__tests__"`
Expected: no matches outside `lib/api-auth.ts` itself — every inline bare comparison should now be gone.

- [ ] **Step 11: Run the full test suite**

Run: `pnpm --filter web test -- --run`
Expected: all pass. This task touches many auth-critical files — if any existing test in `apps/web/src/__tests__/api/` covering leads/[id], smart-lists, transactions/[id], listings/[id], campaigns/[id], or file-parties routes fails, it means a response-code or behavior change slipped through; fix the source file to match the ORIGINAL behavior (this task must not change any route's external behavior except closing the one real null-safety gap) rather than adjusting the test.

- [ ] **Step 12: Type-check**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors across all 13 modified route files.

- [ ] **Step 13: Live-verify at least 2 of the fixed routes still behave correctly**

With the dev server running, use Puppeteer (or direct authenticated `fetch` calls, matching an existing session cookie) to confirm: (a) an AGENT can still successfully GET/PATCH a lead they own via `leads/[id]/route.ts`, (b) an AGENT gets a 403/404 (per that route's convention) when trying to access another agent's transaction file via `transactions/[id]/route.ts`. Do not just trust the test suite for a change this security-relevant.

- [ ] **Step 14: Commit**

```bash
git add apps/web/src/lib/api-auth.ts apps/web/src/app/api/leads/ apps/web/src/app/api/smart-lists/ apps/web/src/app/api/transactions/ apps/web/src/app/api/listings/ apps/web/src/app/api/campaigns/ apps/web/src/app/api/files/ apps/web/src/__tests__/lib/api-auth-ownership.test.ts apps/web/src/__tests__/api/
git commit -m "refactor: extract shared checkOwnership helper across 14 duplicated ownership-check copies, closing the one reachable null-safety gap (Campaign, currently dormant)"
```

---

## Final Verification (after all 9 tasks)

- [ ] Run the full suite once more: `pnpm --filter web test -- --run` — expect all green.
- [ ] Run `pnpm --filter web exec tsc --noEmit` once more — expect zero new errors compared to the pre-plan baseline.
- [ ] Run `pnpm --filter @cnc/database exec prisma migrate status` — expect "Database schema is up to date!"
- [ ] Confirm the dev server starts cleanly (`pnpm --filter web dev`) after all schema changes.
