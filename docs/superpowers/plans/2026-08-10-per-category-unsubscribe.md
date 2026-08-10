# Per-Category Unsubscribe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an unsubscribe click opt the recipient out of only the email category it arrived in, and make our own unsubscribe system — rather than Postmark's — the one that actually reaches the inbox.

**Architecture:** The signed HMAC token grows a third field, `category`. The single `emailOptOut` boolean becomes one boolean per category (`campaignOptOut`, `actionPlanOptOut` on `Lead`; `propertyAlertOptOut` on `User`). `category` becomes compile-time-required on broadcast sends, so the type checker locates every call site. Postmark's broadcast stream moves to `UnsubscribeHandlingType: "none"` so it stops injecting its own link and overriding ours.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma + PostgreSQL (Neon), Vitest, Postmark.

**Spec:** `docs/superpowers/specs/2026-08-10-per-category-unsubscribe-design.md`

## Global Constraints

- Test runner is Vitest. Full suite: `pnpm --filter web test`. Single file: `pnpm --filter web test <path>`.
- Suite is at 757/757 passing before this work. It must be green at the end of every task.
- Migrations run from `packages/database` (package name `@cnc/database`): `pnpm --filter @cnc/database db:migrate`.
- Set mock implementations in `beforeEach`. Never rely on `vi.clearAllMocks()` to reset them — it clears calls but **not** implementations. This caused the `idx-sync.test.ts` pollution on 2026-08-09.
- Every CTA/pill button must use `PULSE_ANIMATE` + `PULSE_TRANSITION` from `@/lib/motion`. The existing unsubscribe button already does; keep it.
- Transactional email is never suppressible. Only broadcast sends check opt-out flags.
- The one-click endpoint must complete the opt-out immediately and must never redirect to the preference page. Google's bulk-sender guidance is explicit that a header pointing at a preference center does not satisfy the requirement.
- `GET` must never mutate opt-out state. Mail scanners prefetch links found in email.
- Commit after every task.

## Deviation from the spec: expand/contract instead of rename

The spec called for a hand-written `ALTER TABLE ... RENAME COLUMN`. This plan uses an **additive migration with a backfill** (Task 1) and drops `emailOptOut` in a final migration (Task 10) instead.

Two reasons. It keeps the tree compiling and the suite green after every single task, which a rename does not — renaming the column in Task 1 breaks `send.ts` until Task 3 lands. And backfilling `campaignOptOut = emailOptOut` makes the spec's "verify no `emailOptOut = true` rows exist first" step unnecessary: whatever the values are, they carry over correctly. That open item is closed by construction.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `packages/database/prisma/schema.prisma` | Add three category columns; later drop `emailOptOut` | 1, 10 |
| `apps/web/src/lib/email/unsubscribe.ts` | `EmailCategory`, category-carrying token, category→table map | 2 |
| `apps/web/src/lib/email/send.ts` | Require `category` on broadcast; per-category suppression; return `SendResult` | 3 |
| `apps/web/src/lib/action-plan-email.ts` | Pass `category: "action_plan"` | 4 |
| `apps/web/src/lib/email/property-alert-email.ts` | Pass `category: "property_alert"` | 4 |
| `apps/web/src/app/api/campaigns/[id]/send/route.ts` | Pass `category: "campaign"`; pre-filter; count skipped | 4, 9 |
| `apps/web/src/app/api/unsubscribe/route.ts` | One-click, category-scoped | 5 |
| `apps/web/src/app/api/unsubscribe/preferences/route.ts` | **New.** Read + save the full preference set | 6 |
| `apps/web/src/app/(marketing)/unsubscribe/page.tsx` | Preference center UI | 7 |
| `apps/web/src/app/api/webhooks/postmark/route.ts` | Handle `SubscriptionChange` | 8 |

---

### Task 1: Add the three category columns

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (`User` ~line 242, `Lead` ~line 404)
- Create: `packages/database/prisma/migrations/<timestamp>_add_per_category_opt_out/migration.sql`

**Interfaces:**
- Consumes: nothing
- Produces: `Lead.campaignOptOut`, `Lead.actionPlanOptOut`, `User.propertyAlertOptOut` — all `Boolean @default(false)`. `emailOptOut` still exists on both and is untouched by application code from Task 3 onward.

- [ ] **Step 1: Add the columns to the schema**

In `model Lead`, directly below the existing `emailOptOut` line:

```prisma
  campaignOptOut    Boolean   @default(false)
  actionPlanOptOut  Boolean   @default(false)
```

In `model User`, directly below its existing `emailOptOut` line:

```prisma
  propertyAlertOptOut Boolean @default(false)
```

- [ ] **Step 2: Generate the migration without applying it**

```bash
pnpm --filter @cnc/database exec prisma migrate dev --create-only --name add_per_category_opt_out
```

Expected: a new folder under `packages/database/prisma/migrations/` containing `ADD COLUMN` statements for all three.

- [ ] **Step 3: Append the backfill to the generated SQL**

Add these two statements to the end of the generated `migration.sql`:

```sql
-- Carry existing opt-outs onto the category columns. Property alerts go to
-- User, campaigns and drips to Lead, so each side backfills only what it can
-- actually receive. actionPlanOptOut inherits the same value as campaignOptOut
-- because the old single flag suppressed both.
UPDATE "Lead" SET "campaignOptOut" = "emailOptOut", "actionPlanOptOut" = "emailOptOut";
UPDATE "User" SET "propertyAlertOptOut" = "emailOptOut";
```

- [ ] **Step 4: Apply the migration**

```bash
pnpm --filter @cnc/database db:migrate
```

Expected: migration applies cleanly. If this fails to reach the database, you are probably on the CnC office network, which blocks Neon's port 5432 — run it from a different network.

- [ ] **Step 5: Regenerate the Prisma client and confirm the suite is still green**

```bash
pnpm --filter @cnc/database db:generate
pnpm --filter web test
```

Expected: 757 passing. Nothing reads the new columns yet.

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat(db): add per-category email opt-out columns"
```

---

### Task 2: Teach the token to carry a category

**Files:**
- Modify: `apps/web/src/lib/email/unsubscribe.ts`
- Test: `apps/web/src/__tests__/lib/email/unsubscribe.test.ts` (may not exist yet — create if absent)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type EmailCategory = "campaign" | "action_plan" | "property_alert"`
  - `CATEGORY_KIND: Record<EmailCategory, OptOutKind>`
  - `makeUnsubscribeToken(kind: OptOutKind, id: string, category: EmailCategory): string`
  - `verifyUnsubscribeToken(token: string): { kind: OptOutKind; id: string; category: EmailCategory } | null`
  - `unsubscribeUrl(kind, id, category): string`
  - `unsubscribePostUrl(kind, id, category): string`
  - `unsubscribeFooterHtml(kind, id, category): string`

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/__tests__/lib/email/unsubscribe.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
  type EmailCategory,
} from "@/lib/email/unsubscribe";

describe("category-carrying unsubscribe token", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret";
  });

  const categories: EmailCategory[] = ["campaign", "action_plan", "property_alert"];

  it.each(categories)("round-trips the %s category", (category) => {
    const token = makeUnsubscribeToken("lead", "lead_123", category);
    expect(verifyUnsubscribeToken(token)).toEqual({
      kind: "lead",
      id: "lead_123",
      category,
    });
  });

  it("rejects a token whose signature was tampered with", () => {
    const token = makeUnsubscribeToken("lead", "lead_123", "campaign");
    const [payload] = token.split(".");
    expect(verifyUnsubscribeToken(`${payload}.deadbeef`)).toBeNull();
  });

  it("rejects a category that is not one of the three known values", () => {
    // Signed correctly, so this passes the HMAC check and can only be caught
    // by validating the category itself.
    const forged = makeUnsubscribeToken("lead", "lead_123", "newsletter" as EmailCategory);
    expect(verifyUnsubscribeToken(forged)).toBeNull();
  });

  it("rejects a token with no category segment", () => {
    expect(verifyUnsubscribeToken("bm90LWEtdG9rZW4.sig")).toBeNull();
  });

  it("preserves an id containing a colon", () => {
    const token = makeUnsubscribeToken("user", "weird:id", "property_alert");
    expect(verifyUnsubscribeToken(token)).toEqual({
      kind: "user",
      id: "weird:id",
      category: "property_alert",
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test src/__tests__/lib/email/unsubscribe.test.ts`
Expected: FAIL — `makeUnsubscribeToken` takes 2 arguments, not 3.

- [ ] **Step 3: Implement**

In `apps/web/src/lib/email/unsubscribe.ts`, add below `OptOutKind`:

```ts
export type EmailCategory = "campaign" | "action_plan" | "property_alert";

const CATEGORIES: readonly string[] = ["campaign", "action_plan", "property_alert"];

// Which table each category's recipient lives in. Users only ever receive
// property alerts; leads receive campaigns and drips.
export const CATEGORY_KIND: Record<EmailCategory, OptOutKind> = {
  campaign: "lead",
  action_plan: "lead",
  property_alert: "user",
};
```

Replace `makeUnsubscribeToken` and `verifyUnsubscribeToken`:

```ts
export function makeUnsubscribeToken(
  kind: OptOutKind,
  id: string,
  category: EmailCategory
): string {
  const payload = Buffer.from(`${kind}:${id}:${category}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(
  token: string
): { kind: OptOutKind; id: string; category: EmailCategory } | null {
  const [payload, sig] = (token ?? "").split(".");
  if (!payload || !sig) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  // Length check first: timingSafeEqual throws on a length mismatch rather
  // than returning false.
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }

  // kind is the first segment and category the last, so the id in between may
  // itself contain colons. A cuid never does, but this keeps the parse correct
  // if id formats ever change.
  const parts = Buffer.from(payload, "base64url").toString().split(":");
  if (parts.length < 3) return null;

  const kind = parts[0];
  const category = parts[parts.length - 1];
  const id = parts.slice(1, -1).join(":");

  if (kind !== "lead" && kind !== "user") return null;
  if (!id) return null;
  // A signed but unknown category is still a refusal: defaulting would opt the
  // recipient out of something they did not ask to leave.
  if (!CATEGORIES.includes(category)) return null;

  return { kind, id, category: category as EmailCategory };
}
```

Update the three URL helpers to thread `category` through:

```ts
export function unsubscribeUrl(kind: OptOutKind, id: string, category: EmailCategory): string {
  return `${process.env.NEXTAUTH_URL}/unsubscribe?t=${makeUnsubscribeToken(kind, id, category)}`;
}

export function unsubscribePostUrl(kind: OptOutKind, id: string, category: EmailCategory): string {
  return `${process.env.NEXTAUTH_URL}/api/unsubscribe?t=${makeUnsubscribeToken(kind, id, category)}`;
}

export function unsubscribeFooterHtml(
  kind: OptOutKind,
  id: string,
  category: EmailCategory
): string {
  return `<p style="margin:24px 0 0;font-size:12px;color:#999999;">Don&rsquo;t want these emails? <a href="${unsubscribeUrl(kind, id, category)}" style="color:#9E8C61;">Unsubscribe</a></p>`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test src/__tests__/lib/email/unsubscribe.test.ts`
Expected: PASS. Other files will not compile yet — that is expected and fixed in Tasks 3 and 4.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/email/unsubscribe.ts apps/web/src/__tests__/lib/email/unsubscribe.test.ts
git commit -m "feat(email): carry the email category in the unsubscribe token"
```

---

### Task 3: Make the send seam category-aware

**Files:**
- Modify: `apps/web/src/lib/email/send.ts`
- Test: `apps/web/src/__tests__/lib/email/send.test.ts`

**Interfaces:**
- Consumes: `EmailCategory`, `unsubscribePostUrl(kind, id, category)` from Task 2
- Produces:
  - `type SendResult = { sent: true } | { sent: false; reason: "opted_out" }`
  - `sendEmail(opts: SendOptions): Promise<SendResult>` — was `Promise<void>`
  - Broadcast sends now require `category: EmailCategory`

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/__tests__/lib/email/send.test.ts`, inside the existing `describe("opt-out suppression")` block:

```ts
it("suppresses a campaign but not a drip when only campaignOptOut is set", async () => {
  vi.mocked(prisma.lead.findUnique).mockResolvedValue({
    campaignOptOut: true,
    actionPlanOptOut: false,
  } as never);

  const result = await sendEmail({
    to: "a@b.com", subject: "Hi", html: "<p>x</p>",
    stream: "broadcast", recipient: LEAD, category: "campaign",
  });

  expect(result).toEqual({ sent: false, reason: "opted_out" });
  expect(sendEmailMock).not.toHaveBeenCalled();
});

it("sends a drip to someone who only opted out of campaigns", async () => {
  vi.mocked(prisma.lead.findUnique).mockResolvedValue({
    campaignOptOut: true,
    actionPlanOptOut: false,
  } as never);

  const result = await sendEmail({
    to: "a@b.com", subject: "Hi", html: "<p>x</p>",
    stream: "broadcast", recipient: LEAD, category: "action_plan",
  });

  expect(result).toEqual({ sent: true });
  expect(sendEmailMock).toHaveBeenCalledOnce();
});

it("reads propertyAlertOptOut from the User table for a property alert", async () => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    propertyAlertOptOut: true,
  } as never);

  const result = await sendEmail({
    to: "a@b.com", subject: "Hi", html: "<p>x</p>",
    stream: "broadcast", recipient: { kind: "user", id: "user_1" }, category: "property_alert",
  });

  expect(result).toEqual({ sent: false, reason: "opted_out" });
  expect(prisma.lead.findUnique).not.toHaveBeenCalled();
});

it("reports a transactional send as sent", async () => {
  const result = await sendEmail({
    to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "transactional",
  });

  expect(result).toEqual({ sent: true });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test src/__tests__/lib/email/send.test.ts`
Expected: FAIL — `category` is not a known property, and `sendEmail` resolves to `undefined`.

- [ ] **Step 3: Implement**

In `apps/web/src/lib/email/send.ts`, update the import:

```ts
import {
  unsubscribePostUrl,
  type OptOutKind,
  type EmailCategory,
} from "@/lib/email/unsubscribe";
```

Replace `StreamRouting`:

```ts
// Required on broadcast, optional on transactional. Commercial email must
// honour an opt-out and carry a working unsubscribe link, and neither is
// possible without knowing who the recipient is. `category` is required for
// the same reason: an unsubscribe click has to opt the recipient out of the
// list this message came from and nothing else.
type StreamRouting =
  | { stream: "transactional"; recipient?: OptOutRecipient; category?: never }
  | { stream: "broadcast"; recipient: OptOutRecipient; category: EmailCategory };
```

Add the result type above `SendOptions`:

```ts
// Returned rather than void so a caller can tell a suppressed send from a
// delivered one. Returning void made an opt-out indistinguishable from a
// success, which is how campaign stats came to count suppressed contacts as
// SENT.
export type SendResult = { sent: true } | { sent: false; reason: "opted_out" };
```

Replace `isOptedOut`:

```ts
// Fails open on a missing row: a deleted lead is not an opt-out, and treating
// every lookup miss as one would silently drop mail.
async function isOptedOut(
  recipient: OptOutRecipient,
  category: EmailCategory
): Promise<boolean> {
  if (recipient.kind === "lead") {
    const row = await prisma.lead.findUnique({
      where: { id: recipient.id },
      select: { campaignOptOut: true, actionPlanOptOut: true },
    });
    if (!row) return false;
    return category === "action_plan" ? row.actionPlanOptOut : row.campaignOptOut;
  }

  const row = await prisma.user.findUnique({
    where: { id: recipient.id },
    select: { propertyAlertOptOut: true },
  });
  return row?.propertyAlertOptOut === true;
}
```

Update the body of `sendEmail` — signature, the two early paths, and both returns:

```ts
export async function sendEmail(opts: SendOptions): Promise<SendResult> {
  const messageStream = resolveStream(opts.stream);

  const unsubscribe =
    opts.stream === "broadcast"
      ? unsubscribePostUrl(opts.recipient.kind, opts.recipient.id, opts.category)
      : null;

  if (opts.stream === "broadcast" && (await isOptedOut(opts.recipient, opts.category))) {
    return { sent: false, reason: "opted_out" };
  }
```

…leave `base` and the header/attachment construction exactly as they are, then change the two send branches to return:

```ts
  if (opts.html !== undefined) {
    await getClient().sendEmail({
      ...base,
      HtmlBody: opts.html,
      TextBody: opts.text ?? htmlToPlainText(opts.html),
    });
    return { sent: true };
  }

  await getClient().sendEmail({ ...base, TextBody: opts.text });
  return { sent: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test src/__tests__/lib/email/send.test.ts`
Expected: PASS for the new tests. Pre-existing tests in this file that call `sendEmail` with `stream: "broadcast"` and no `category` will now fail to compile — add `category: "campaign"` to each.

- [ ] **Step 5: Fix the three mocks that no longer type-check**

Ten test files mock `sendEmail` as resolving `undefined`. Most are transactional callers that ignore the return value, so they keep working. But these three make an explicitly typed `mockResolvedValue(undefined)` call, and `undefined` is not assignable to `SendResult`:

- `apps/web/src/__tests__/api/admin-leads-assign.test.ts:49`
- `apps/web/src/__tests__/api/cron-action-plans.test.ts:60`
- `apps/web/src/__tests__/api/triggers.test.ts:327`

Change each to:

```ts
vi.mocked(sendEmail).mockResolvedValue({ sent: true });
```

`campaigns-send.test.ts:12` also needs fixing, but that is handled in Task 9 where its other problems are addressed together.

- [ ] **Step 6: Verify the whole suite**

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web test
```

Expected: `tsc` reports only the three missing-`category` errors at the broadcast call sites, which Task 4 fixes. No other type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/email/send.ts apps/web/src/__tests__
git commit -m "feat(email): suppress broadcast sends per category and report the result"
```

---

### Task 4: Update the three broadcast call sites

**Files:**
- Modify: `apps/web/src/lib/action-plan-email.ts:29,32-38`
- Modify: `apps/web/src/lib/email/property-alert-email.ts:107-112`
- Modify: `apps/web/src/app/api/campaigns/[id]/send/route.ts:69,72-78`
- Test: `apps/web/src/__tests__/lib/action-plan-email.test.ts`

**Interfaces:**
- Consumes: `sendEmail` with required `category` (Task 3), `unsubscribeFooterHtml(kind, id, category)` (Task 2)
- Produces: nothing new. After this task `tsc` is clean again.

- [ ] **Step 1: Find every call site the compiler objects to**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: exactly three errors, one per broadcast call site, each reporting a missing `category`. If you get more or fewer, stop and work out why before continuing — the type is meant to find precisely these.

- [ ] **Step 2: Update the action-plan drip**

In `apps/web/src/lib/action-plan-email.ts`, change the footer and the send:

```ts
  const bodyHtml = paragraph(opts.body) + unsubscribeFooterHtml("lead", opts.leadId, "action_plan");
```

```ts
  await sendEmail({
    to: opts.to,
    subject: opts.subject,
    html,
    replyTo,
    stream: "broadcast",
    recipient: { kind: "lead", id: opts.leadId },
    category: "action_plan",
  });
```

- [ ] **Step 3: Update the property alert**

In `apps/web/src/lib/email/property-alert-email.ts`:

```ts
  await sendEmail({
    to,
    subject: `New listings matching your search`,
    html,
    stream: "broadcast",
    recipient: { kind: "user", id: userId },
    category: "property_alert",
  });
```

If this file builds its own unsubscribe footer via `unsubscribeFooterHtml`, pass `"property_alert"` as the third argument there too.

- [ ] **Step 4: Update the campaign send**

In `apps/web/src/app/api/campaigns/[id]/send/route.ts`:

```ts
        bodyHtml: campaign.body! + unsubscribeFooterHtml("lead", contact.lead.id, "campaign"),
```

```ts
      await sendEmail({
        to: contact.lead.email,
        subject: campaign.subject!,
        html,
        stream: "broadcast",
        recipient: { kind: "lead", id: contact.lead.id },
        category: "campaign",
      });
```

- [ ] **Step 5: Verify the tree compiles and the suite is green**

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web test
```

Expected: no type errors, full suite passing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/action-plan-email.ts apps/web/src/lib/email/property-alert-email.ts "apps/web/src/app/api/campaigns/[id]/send/route.ts" apps/web/src/__tests__
git commit -m "feat(email): declare a category at every broadcast call site"
```

---

### Task 5: Scope the one-click endpoint to its category

**Files:**
- Modify: `apps/web/src/app/api/unsubscribe/route.ts`
- Test: `apps/web/src/__tests__/api/unsubscribe.test.ts`

**Interfaces:**
- Consumes: `verifyUnsubscribeToken` returning `category` (Task 2), the columns from Task 1
- Produces: `POST /api/unsubscribe?t=<token>` sets exactly one flag

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/__tests__/api/unsubscribe.test.ts`:

```ts
it("sets only campaignOptOut for a campaign token", async () => {
  const token = makeUnsubscribeToken("lead", "lead_1", "campaign");

  const res = await POST(
    new Request(`http://localhost:3000/api/unsubscribe?t=${token}`, { method: "POST" })
  );

  expect(res.status).toBe(200);
  expect(prisma.lead.update).toHaveBeenCalledWith({
    where: { id: "lead_1" },
    data: { campaignOptOut: true },
  });
});

it("sets only actionPlanOptOut for an action_plan token", async () => {
  const token = makeUnsubscribeToken("lead", "lead_1", "action_plan");

  await POST(
    new Request(`http://localhost:3000/api/unsubscribe?t=${token}`, { method: "POST" })
  );

  expect(prisma.lead.update).toHaveBeenCalledWith({
    where: { id: "lead_1" },
    data: { actionPlanOptOut: true },
  });
});

it("sets propertyAlertOptOut on the User table for a property_alert token", async () => {
  const token = makeUnsubscribeToken("user", "user_1", "property_alert");

  await POST(
    new Request(`http://localhost:3000/api/unsubscribe?t=${token}`, { method: "POST" })
  );

  expect(prisma.user.update).toHaveBeenCalledWith({
    where: { id: "user_1" },
    data: { propertyAlertOptOut: true },
  });
  expect(prisma.lead.update).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test src/__tests__/api/unsubscribe.test.ts`
Expected: FAIL — the route still writes `emailOptOut`.

- [ ] **Step 3: Implement**

Replace the update block in `apps/web/src/app/api/unsubscribe/route.ts`:

```ts
  // One category per click. The token says which list this message came from,
  // and Google's sender guidance is explicit that a one-click unsubscribe
  // removes the recipient only from that list.
  if (claim.kind === "lead") {
    await prisma.lead.update({
      where: { id: claim.id },
      data:
        claim.category === "action_plan"
          ? { actionPlanOptOut: true }
          : { campaignOptOut: true },
    });
  } else {
    await prisma.user.update({
      where: { id: claim.id },
      data: { propertyAlertOptOut: true },
    });
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test src/__tests__/api/unsubscribe.test.ts`
Expected: PASS, including the pre-existing tests for invalid tokens and the form-encoded body path.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/unsubscribe apps/web/src/__tests__/api/unsubscribe.test.ts
git commit -m "feat(unsubscribe): one-click opts out of only its own category"
```

---

### Task 6: Preferences read/write endpoint

**Files:**
- Create: `apps/web/src/app/api/unsubscribe/preferences/route.ts`
- Test: `apps/web/src/__tests__/api/unsubscribe-preferences.test.ts`

**Interfaces:**
- Consumes: `verifyUnsubscribeToken`, `CATEGORY_KIND` (Task 2)
- Produces:
  - `GET /api/unsubscribe/preferences?t=<token>` → `{ kind, category, preferences: { campaign?: boolean, action_plan?: boolean, property_alert?: boolean } }` where each value is `true` when **subscribed**
  - `POST /api/unsubscribe/preferences` with JSON `{ token, preferences: { … } }` → `{ ok: true }`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/api/unsubscribe-preferences.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/unsubscribe/preferences/route";
import { makeUnsubscribeToken } from "@/lib/email/unsubscribe";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

describe("GET /api/unsubscribe/preferences", () => {
  // Implementations are set here, not reset via clearAllMocks, which clears
  // calls but not implementations.
  beforeEach(() => {
    vi.mocked(prisma.lead.findUnique).mockReset().mockResolvedValue({
      campaignOptOut: true,
      actionPlanOptOut: false,
    } as never);
    vi.mocked(prisma.user.findUnique).mockReset().mockResolvedValue({
      propertyAlertOptOut: false,
    } as never);
    vi.mocked(prisma.lead.update).mockReset();
    vi.mocked(prisma.user.update).mockReset();
    process.env.NEXTAUTH_SECRET = "test-secret";
  });

  it("returns both lead categories as subscribed-or-not", async () => {
    const token = makeUnsubscribeToken("lead", "lead_1", "campaign");

    const res = await GET(
      new Request(`http://localhost:3000/api/unsubscribe/preferences?t=${token}`)
    );

    expect(await res.json()).toEqual({
      kind: "lead",
      category: "campaign",
      preferences: { campaign: false, action_plan: true },
    });
  });

  it("returns only the property alert preference for a user", async () => {
    const token = makeUnsubscribeToken("user", "user_1", "property_alert");

    const res = await GET(
      new Request(`http://localhost:3000/api/unsubscribe/preferences?t=${token}`)
    );

    expect(await res.json()).toEqual({
      kind: "user",
      category: "property_alert",
      preferences: { property_alert: true },
    });
  });

  it("does not mutate anything on GET", async () => {
    const token = makeUnsubscribeToken("lead", "lead_1", "campaign");

    await GET(new Request(`http://localhost:3000/api/unsubscribe/preferences?t=${token}`));

    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid token", async () => {
    const res = await GET(
      new Request("http://localhost:3000/api/unsubscribe/preferences?t=nonsense")
    );

    expect(res.status).toBe(400);
  });
});

describe("POST /api/unsubscribe/preferences", () => {
  beforeEach(() => {
    vi.mocked(prisma.lead.update).mockReset().mockResolvedValue({} as never);
    vi.mocked(prisma.user.update).mockReset().mockResolvedValue({} as never);
    process.env.NEXTAUTH_SECRET = "test-secret";
  });

  it("writes both lead flags, inverting subscribed into opted-out", async () => {
    const token = makeUnsubscribeToken("lead", "lead_1", "campaign");

    const res = await POST(
      new Request("http://localhost:3000/api/unsubscribe/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          preferences: { campaign: false, action_plan: true },
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead_1" },
      data: { campaignOptOut: true, actionPlanOptOut: false },
    });
  });

  it("ignores a category the recipient's table cannot receive", async () => {
    const token = makeUnsubscribeToken("lead", "lead_1", "campaign");

    await POST(
      new Request("http://localhost:3000/api/unsubscribe/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          preferences: { campaign: false, property_alert: false },
        }),
      })
    );

    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead_1" },
      data: { campaignOptOut: true },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test src/__tests__/api/unsubscribe-preferences.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement**

Create `apps/web/src/app/api/unsubscribe/preferences/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken, type EmailCategory } from "@/lib/email/unsubscribe";

// Values are "is subscribed", not "is opted out". The UI shows checkboxes the
// recipient ticks to keep receiving something, so the API speaks the same way
// and the inversion happens in exactly one place.
type Preferences = Partial<Record<EmailCategory, boolean>>;

const LEAD_CATEGORIES: EmailCategory[] = ["campaign", "action_plan"];
const USER_CATEGORIES: EmailCategory[] = ["property_alert"];

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const claim = verifyUnsubscribeToken(token);
  if (!claim) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  if (claim.kind === "lead") {
    const row = await prisma.lead.findUnique({
      where: { id: claim.id },
      select: { campaignOptOut: true, actionPlanOptOut: true },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      kind: claim.kind,
      category: claim.category,
      preferences: {
        campaign: !row.campaignOptOut,
        action_plan: !row.actionPlanOptOut,
      },
    });
  }

  const row = await prisma.user.findUnique({
    where: { id: claim.id },
    select: { propertyAlertOptOut: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    kind: claim.kind,
    category: claim.category,
    preferences: { property_alert: !row.propertyAlertOptOut },
  });
}

export async function POST(req: Request) {
  let body: { token?: string; preferences?: Preferences };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const claim = verifyUnsubscribeToken(body.token ?? "");
  if (!claim) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  const prefs = body.preferences ?? {};

  // Only categories this recipient's table can actually receive. A lead has no
  // property alerts to manage, so a stray key is dropped rather than trusted.
  const allowed = claim.kind === "lead" ? LEAD_CATEGORIES : USER_CATEGORIES;
  const column: Record<EmailCategory, string> = {
    campaign: "campaignOptOut",
    action_plan: "actionPlanOptOut",
    property_alert: "propertyAlertOptOut",
  };

  const data: Record<string, boolean> = {};
  for (const category of allowed) {
    const subscribed = prefs[category];
    if (typeof subscribed === "boolean") data[column[category]] = !subscribed;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true });
  }

  if (claim.kind === "lead") {
    await prisma.lead.update({ where: { id: claim.id }, data });
  } else {
    await prisma.user.update({ where: { id: claim.id }, data });
  }

  return NextResponse.json({ ok: true });
}
```

`LEAD_CATEGORIES` / `USER_CATEGORIES` are declared locally here rather than derived from `CATEGORY_KIND`, because this route needs the categories grouped *by table*, which is the inverse of what that map provides.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test src/__tests__/api/unsubscribe-preferences.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/unsubscribe/preferences apps/web/src/__tests__/api/unsubscribe-preferences.test.ts
git commit -m "feat(unsubscribe): add a preferences read/write endpoint"
```

---

### Task 7: Preference centre UI

**Files:**
- Modify: `apps/web/src/app/(marketing)/unsubscribe/page.tsx`

**Interfaces:**
- Consumes: `GET`/`POST /api/unsubscribe/preferences` (Task 6)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Replace the page body**

Replace the contents of `apps/web/src/app/(marketing)/unsubscribe/page.tsx` with:

```tsx
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

type Category = "campaign" | "action_plan" | "property_alert";
type Preferences = Partial<Record<Category, boolean>>;

const LABELS: Record<Category, { title: string; blurb: string }> = {
  campaign: {
    title: "Market updates & announcements",
    blurb: "Occasional news, market reports and updates from CnC Realty.",
  },
  action_plan: {
    title: "Follow-up from your agent",
    blurb: "Messages your agent sends as part of staying in touch.",
  },
  property_alert: {
    title: "New listing alerts",
    blurb: "Homes matching the searches you saved.",
  },
};

function PreferencesForm() {
  const token = useSearchParams().get("t") ?? "";
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [arrivedFrom, setArrivedFrom] = useState<Category | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "saving" | "done" | "error">("loading");

  // Reading preferences is a GET and never mutates. The opt-out itself only
  // ever happens on an explicit POST, because mail scanners prefetch links
  // found in email and would otherwise unsubscribe people who never clicked.
  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    fetch(`/api/unsubscribe/preferences?t=${encodeURIComponent(token)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad token"))))
      .then((data) => {
        setPrefs(data.preferences);
        setArrivedFrom(data.category);
        setState("idle");
      })
      .catch(() => setState("error"));
  }, [token]);

  const save = useCallback(
    async (next: Preferences) => {
      setState("saving");
      try {
        const res = await fetch("/api/unsubscribe/preferences", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, preferences: next }),
        });
        if (!res.ok) throw new Error("save failed");
        setPrefs(next);
        setState("done");
      } catch {
        setState("error");
      }
    },
    [token]
  );

  if (state === "loading") {
    return <p className="text-[#1B1B1B]/70">Loading your preferences…</p>;
  }

  if (state === "error" && !prefs) {
    return (
      <>
        <h1 className="font-sans text-[2rem] font-light text-[#1B1B1B]">Unsubscribe</h1>
        <p className="mt-4 text-sm text-red-600">
          That link is invalid or expired. Please use the link from a recent email.
        </p>
      </>
    );
  }

  if (state === "done") {
    return (
      <>
        <h1 className="font-sans text-[2rem] font-light text-[#1B1B1B]">
          Preferences saved
        </h1>
        <p className="mt-4 text-[#1B1B1B]/70">
          You&apos;ll still receive messages about your account and any active
          transactions — those aren&apos;t marketing emails.
        </p>
      </>
    );
  }

  const categories = Object.keys(prefs ?? {}) as Category[];

  return (
    <>
      <h1 className="font-sans text-[2rem] font-light text-[#1B1B1B]">Email preferences</h1>
      <p className="mt-4 text-[#1B1B1B]/70">
        Choose what you&apos;d like to keep receiving from CnC Realty.
      </p>

      <div className="mt-8 space-y-4 text-left">
        {categories.map((category) => (
          <label
            key={category}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#1B1B1B]/10 p-4"
          >
            <input
              type="checkbox"
              checked={prefs?.[category] ?? false}
              onChange={(e) =>
                setPrefs({ ...(prefs ?? {}), [category]: e.target.checked })
              }
              className="mt-1 h-5 w-5 shrink-0 accent-[#9E8C61]"
            />
            <span>
              <span className="block text-[#1B1B1B]">
                {LABELS[category].title}
                {category === arrivedFrom && (
                  <span className="ml-2 text-xs text-[#9E8C61]">this email</span>
                )}
              </span>
              <span className="block text-sm text-[#1B1B1B]/60">
                {LABELS[category].blurb}
              </span>
            </span>
          </label>
        ))}
      </div>

      {state === "error" && (
        <p className="mt-4 text-sm text-red-600">
          Something went wrong saving that. Please try again.
        </p>
      )}

      <motion.button
        type="button"
        onClick={() => save(prefs ?? {})}
        disabled={state === "saving"}
        animate={PULSE_ANIMATE}
        transition={PULSE_TRANSITION}
        whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
        className="mt-8 rounded-full bg-[#1B1B1B] px-7 py-3.5 text-white disabled:opacity-50"
      >
        {state === "saving" ? "Saving…" : "Save preferences"}
      </motion.button>

      <button
        type="button"
        onClick={() =>
          save(Object.fromEntries(categories.map((c) => [c, false])) as Preferences)
        }
        disabled={state === "saving"}
        className="mt-4 block w-full text-sm text-[#1B1B1B]/60 underline disabled:opacity-50"
      >
        Unsubscribe from all marketing email
      </button>
    </>
  );
}

export default function UnsubscribePage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-cnc-bg px-6 py-16">
      <div className="w-full max-w-md text-center">
        {/* useSearchParams needs a Suspense boundary or the route opts into
            dynamic rendering at build time. */}
        <Suspense fallback={null}>
          <PreferencesForm />
        </Suspense>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify it compiles and the suite is green**

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web test
```

Expected: clean, full suite passing.

- [ ] **Step 3: Check it in a browser**

```bash
pnpm --filter web dev
```

Generate a token in a Node REPL using `makeUnsubscribeToken("lead", "<a real lead id>", "campaign")` with `NEXTAUTH_SECRET` set to the value from `apps/web/.env.local`, then open `http://localhost:3000/unsubscribe?t=<token>`.

Confirm: two checkboxes for a lead, the "this email" marker on the campaign row, checkboxes reflect current DB state, saving persists, and the layout holds at a 375px-wide viewport.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(marketing)/unsubscribe/page.tsx"
git commit -m "feat(unsubscribe): replace the single button with a preference centre"
```

---

### Task 8: Handle SubscriptionChange in the Postmark webhook

**Files:**
- Modify: `apps/web/src/app/api/webhooks/postmark/route.ts`
- Test: `apps/web/src/__tests__/api/postmark-webhook.test.ts` (create if absent)

**Interfaces:**
- Consumes: the columns from Task 1
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Write the failing tests**

```ts
it("opts a bounced address out of every category, on both tables", async () => {
  vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: "lead_1" } as never);
  vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "user_1" } as never);

  await POST(authorizedRequest({
    RecordType: "SubscriptionChange",
    Recipient: "dead@example.com",
    SuppressSending: true,
    SuppressionReason: "HardBounce",
  }));

  expect(prisma.lead.update).toHaveBeenCalledWith({
    where: { id: "lead_1" },
    data: { campaignOptOut: true, actionPlanOptOut: true },
  });
  expect(prisma.user.update).toHaveBeenCalledWith({
    where: { id: "user_1" },
    data: { propertyAlertOptOut: true },
  });
});

it("opts out on a spam complaint", async () => {
  vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: "lead_1" } as never);
  vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);

  await POST(authorizedRequest({
    RecordType: "SubscriptionChange",
    Recipient: "angry@example.com",
    SuppressSending: true,
    SuppressionReason: "SpamComplaint",
  }));

  expect(prisma.lead.update).toHaveBeenCalledWith({
    where: { id: "lead_1" },
    data: { campaignOptOut: true, actionPlanOptOut: true },
  });
});

it("ignores a reactivation rather than resubscribing anyone", async () => {
  vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: "lead_1" } as never);

  await POST(authorizedRequest({
    RecordType: "SubscriptionChange",
    Recipient: "back@example.com",
    SuppressSending: false,
    SuppressionReason: "ManualSuppression",
  }));

  expect(prisma.lead.update).not.toHaveBeenCalled();
  expect(prisma.user.update).not.toHaveBeenCalled();
});

it("ignores an unrecognised suppression reason", async () => {
  vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: "lead_1" } as never);

  await POST(authorizedRequest({
    RecordType: "SubscriptionChange",
    Recipient: "who@example.com",
    SuppressSending: true,
    SuppressionReason: "SomethingNew",
  }));

  expect(prisma.lead.update).not.toHaveBeenCalled();
});
```

`isAuthorizedPostmarkWebhook` checks an HTTP Basic header against `POSTMARK_WEBHOOK_USER` / `POSTMARK_WEBHOOK_PASSWORD` and fails closed when either is unset, so the test file needs both set and a matching header:

```ts
beforeEach(() => {
  process.env.POSTMARK_WEBHOOK_USER = "hook";
  process.env.POSTMARK_WEBHOOK_PASSWORD = "secret";
});

function authorizedRequest(event: Record<string, unknown>): Request {
  const basic = Buffer.from("hook:secret").toString("base64");
  return new Request("http://localhost:3000/api/webhooks/postmark", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${basic}`,
    },
    body: JSON.stringify(event),
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test src/__tests__/api/postmark-webhook.test.ts`
Expected: FAIL — `SubscriptionChange` falls through to the `default: return null` branch and nothing is written.

- [ ] **Step 3: Implement**

In `apps/web/src/app/api/webhooks/postmark/route.ts`, extend the event type:

```ts
type PostmarkEvent = {
  RecordType?: string;
  Recipient?: string;
  Email?: string;
  ReceivedAt?: string;
  BouncedAt?: string;
  SuppressSending?: boolean;
  SuppressionReason?: string;
};
```

Add above `POST`:

```ts
// A hard bounce means the address is gone; a complaint means stop entirely.
// Either way every category is suppressed. Reactivations are deliberately not
// handled: with no stored reason we cannot tell someone who opted out from
// someone who merely bounced, and clearing the flag would put a person who
// asked to leave back on the list. Recipients can resubscribe themselves —
// the signed token in any past email still works.
const SUPPRESSING_REASONS = new Set(["HardBounce", "SpamComplaint"]);

async function applySuppression(email: string) {
  const [lead, user] = await Promise.all([
    prisma.lead.findFirst({ where: { email } }),
    prisma.user.findFirst({ where: { email } }),
  ]);

  await Promise.all([
    lead
      ? prisma.lead.update({
          where: { id: lead.id },
          data: { campaignOptOut: true, actionPlanOptOut: true },
        })
      : Promise.resolve(),
    user
      ? prisma.user.update({
          where: { id: user.id },
          data: { propertyAlertOptOut: true },
        })
      : Promise.resolve(),
  ]);
}
```

Inside `POST`, immediately after `email` is derived and checked, before the existing `prisma.lead.findFirst` lookup:

```ts
    // Additive to the Bounce/SpamComplaint handling below, which updates a
    // single CampaignContact. This sets the durable per-person flag — without
    // it a bounced address is mailable again on the next campaign, because
    // that campaign creates fresh PENDING contact rows.
    if (event.RecordType === "SubscriptionChange") {
      if (event.SuppressSending === true && SUPPRESSING_REASONS.has(event.SuppressionReason ?? "")) {
        await applySuppression(email);
      }
      return NextResponse.json({ ok: true });
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test src/__tests__/api/postmark-webhook.test.ts`
Expected: PASS, with the existing `Open`/`Click`/`Bounce` tests still passing unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/webhooks/postmark/route.ts apps/web/src/__tests__/api/postmark-webhook.test.ts
git commit -m "feat(webhooks): suppress every category on bounce and spam complaint"
```

---

### Task 9: Stop counting suppressed contacts as sent

**Files:**
- Modify: `apps/web/src/app/api/campaigns/[id]/send/route.ts:15-23,58-107`
- Test: `apps/web/src/__tests__/api/campaigns-send.test.ts`

**Interfaces:**
- Consumes: `SendResult` from Task 3
- Produces: response body `{ sent, skipped, errors }` — was `{ sent, errors }`

- [ ] **Step 1: Write the failing tests**

```ts
it("marks a suppressed contact UNSUBSCRIBED, not SENT", async () => {
  // Two contacts; the seam suppresses the second.
  vi.mocked(sendEmail)
    .mockResolvedValueOnce({ sent: true })
    .mockResolvedValueOnce({ sent: false, reason: "opted_out" });

  const res = await POST(new Request("http://localhost:3000"), { params: { id: "camp_1" } });
  const body = await res.json();

  expect(body).toEqual({ sent: 1, skipped: 1, errors: 0 });
  expect(prisma.campaignContact.updateMany).toHaveBeenCalledWith({
    where: { id: { in: ["contact_2"] } },
    data: { status: "UNSUBSCRIBED" },
  });
});

it("accounts for every contact", async () => {
  vi.mocked(sendEmail)
    .mockResolvedValueOnce({ sent: true })
    .mockResolvedValueOnce({ sent: false, reason: "opted_out" })
    .mockRejectedValueOnce(new Error("postmark down"));

  const res = await POST(new Request("http://localhost:3000"), { params: { id: "camp_1" } });
  const { sent, skipped, errors } = await res.json();

  // Same invariant the IDX sync asserts: nothing vanishes between fetched and
  // accounted for.
  expect(sent + skipped + errors).toBe(3);
});

it("excludes opted-out leads from the contact query", async () => {
  await POST(new Request("http://localhost:3000"), { params: { id: "camp_1" } });

  const arg = vi.mocked(prisma.campaign.findUnique).mock.calls[0][0];
  expect(arg.include.contacts.where).toMatchObject({
    status: "PENDING",
    lead: { campaignOptOut: false },
  });
});
```

**Two things in this file must be fixed first or every test in it breaks.**

The module mock at line 12 resolves `undefined`, which stops satisfying `SendResult` the moment Task 3 lands — the route will read `.sent` off `undefined` and throw:

```ts
// was: vi.fn().mockResolvedValue(undefined)
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true }),
}));
```

The `beforeEach` at line 39 uses `vi.clearAllMocks()`, which clears recorded calls but leaves implementations *and queued `mockResolvedValueOnce` values* in place — the same leak that polluted `idx-sync.test.ts`. Tests below chain `mockResolvedValueOnce`, so reset the send mock explicitly and re-establish its default:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendEmail).mockReset().mockResolvedValue({ sent: true });
  // …existing prisma mocks…
});
```

Add a fixture with contacts, alongside the existing `CAMPAIGN`:

```ts
function contact(n: number) {
  return {
    id: `contact_${n}`,
    lead: { id: `lead_${n}`, email: `lead${n}@example.com`, firstName: "A", lastName: "B" },
  };
}

const CAMPAIGN_WITH = (count: number) => ({
  ...CAMPAIGN,
  contacts: Array.from({ length: count }, (_, i) => contact(i + 1)),
});
```

Each test then sets the campaign it needs — `vi.mocked(prisma.campaign.findUnique).mockResolvedValue(CAMPAIGN_WITH(2) as any)` for the first test and `CAMPAIGN_WITH(3)` for the second — and mocks `requireAuth` to the owning agent (`agentId: "a1"`) the way the ownership tests above already do.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test src/__tests__/api/campaigns-send.test.ts`
Expected: FAIL — the response has no `skipped` key and suppressed contacts are marked `SENT`.

- [ ] **Step 3: Pre-filter opted-out leads in the query**

Change the `contacts` include (around line 18):

```ts
      contacts: {
        // Filter here rather than relying only on the seam's per-send check:
        // that check is one query per recipient inside Promise.allSettled, so
        // a 1,000-lead campaign fired 1,000 concurrent lookups at Neon. The
        // seam still checks, as a backstop against a race between this query
        // and the send.
        where: { status: "PENDING", lead: { campaignOptOut: false } },
        include: { lead: { select: { id: true, email: true, firstName: true, lastName: true } } },
      },
```

- [ ] **Step 4: Count suppressed sends separately**

Replace the results-handling block (lines 58–106) with:

```ts
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const now = new Date();

  const results = await Promise.allSettled(
    campaign.contacts.map(async (contact) => {
      // Built per contact, not once outside the loop: the unsubscribe link is
      // signed for a specific lead, so a shared body would opt the wrong
      // person out.
      const html = emailLayout({
        heading: campaign.subject!,
        bodyHtml: campaign.body! + unsubscribeFooterHtml("lead", contact.lead.id, "campaign"),
      });

      const result = await sendEmail({
        to: contact.lead.email,
        subject: campaign.subject!,
        html,
        stream: "broadcast",
        recipient: { kind: "lead", id: contact.lead.id },
        category: "campaign",
      });

      return { contactId: contact.id, result };
    })
  );

  const sentIds: string[] = [];
  const skippedIds: string[] = [];

  for (const outcome of results) {
    if (outcome.status === "rejected") {
      console.error("Failed to send email:", outcome.reason);
      errors++;
      continue;
    }

    // A suppressed send is not a failure and not a delivery. Counting it as
    // either is what made campaign stats overstate reach.
    if (outcome.value.result.sent) {
      sent++;
      sentIds.push(outcome.value.contactId);
    } else {
      skipped++;
      skippedIds.push(outcome.value.contactId);
    }
  }

  if (sentIds.length > 0) {
    await prisma.campaignContact.updateMany({
      where: { id: { in: sentIds } },
      data: { status: "SENT", sentAt: now },
    });
  }

  if (skippedIds.length > 0) {
    await prisma.campaignContact.updateMany({
      where: { id: { in: skippedIds } },
      data: { status: "UNSUBSCRIBED" },
    });
  }

  await prisma.campaign.update({
    where: { id: params.id },
    data: { status: "ACTIVE", sentAt: now },
  });

  return NextResponse.json({ sent, skipped, errors });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter web test src/__tests__/api/campaigns-send.test.ts`
Expected: PASS.

- [ ] **Step 6: Check for consumers of the old response shape**

```bash
grep -rn "\.sent\b" apps/web/src --include=*.tsx --include=*.ts | grep -i campaign
```

Any UI reading the send response should show `skipped` too. If a campaign page displays "X sent", add the skipped count beside it.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/api/campaigns/[id]/send/route.ts" apps/web/src/__tests__/api/campaigns-send.test.ts
git commit -m "fix(campaigns): count suppressed contacts as skipped, not sent"
```

---

### Task 10: Drop the old emailOptOut column

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_drop_email_opt_out/migration.sql`

**Interfaces:**
- Consumes: everything above
- Produces: nothing

- [ ] **Step 1: Confirm nothing references the column**

```bash
grep -rn "emailOptOut" apps packages --include=*.ts --include=*.tsx --include=*.prisma
```

Expected: only the two `schema.prisma` model definitions. If application code still references it, stop — an earlier task is incomplete.

- [ ] **Step 2: Remove the field from both models**

Delete the `emailOptOut` line from `model Lead` and from `model User`.

- [ ] **Step 3: Generate and apply**

```bash
pnpm --filter @cnc/database exec prisma migrate dev --create-only --name drop_email_opt_out
```

Confirm the generated SQL is two `DROP COLUMN` statements and nothing else, then:

```bash
pnpm --filter @cnc/database db:migrate
pnpm --filter @cnc/database db:generate
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web test
```

Expected: clean, full suite passing.

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "chore(db): drop the superseded emailOptOut column"
```

---

### Task 11: Flip the Postmark stream and verify live

**Requires Ryan's explicit go-ahead before starting.** This changes live configuration on an external service and spends one of the 100 free monthly sends.

**Files:**
- Modify: `docs/superpowers/specs/2026-08-10-per-category-unsubscribe-design.md` (record the result)
- Modify: `CLAUDE.md` (session notes)

- [ ] **Step 1: Record the current configuration**

```bash
curl -s -H "X-Postmark-Server-Token: $POSTMARK_SERVER_TOKEN" \
  https://api.postmarkapp.com/message-streams/broadcast
```

Expected: `"UnsubscribeHandlingType": "Postmark"`. Save the output.

- [ ] **Step 2: Flip it to none**

```bash
curl -s -X PATCH -H "X-Postmark-Server-Token: $POSTMARK_SERVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"SubscriptionManagementConfiguration":{"UnsubscribeHandlingType":"none"}}' \
  https://api.postmarkapp.com/message-streams/broadcast
```

Expected: 200 with `"UnsubscribeHandlingType": "none"`.

- [ ] **Step 3: Send one broadcast through the real seam**

With the dev server running and `NEXTAUTH_URL` temporarily set to a public value (or accepting that the link will point at localhost), trigger one campaign send to `ryanchong@cncrealtygroup.com`.

- [ ] **Step 4: Read the delivered message back and confirm three things**

```bash
curl -s -H "X-Postmark-Server-Token: $POSTMARK_SERVER_TOKEN" \
  "https://api.postmarkapp.com/messages/outbound/<MessageID>/details"
```

Confirm in the raw `Body`:

1. `List-Unsubscribe` points at **our** `/api/unsubscribe`, not `subscriptions.pstmrk.it`.
2. Postmark has **not** appended its own unsubscribe paragraph to either body part.
3. `Status` is `Sent` — Postmark enforces `List-Unsubscribe` on broadcast streams, so acceptance proves our header satisfies it.

This step also settles the open question from the spec: whether Postmark was overriding our header or merely filling a gap.

- [ ] **Step 5: Record the outcome**

Append the verified findings to the spec and add a session-notes entry to `CLAUDE.md`. Update the deploy checklist in `CLAUDE.md` to include registering the `SubscriptionChange` webhook trigger alongside the existing event-webhook item.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-08-10-per-category-unsubscribe-design.md
git commit -m "docs: record the broadcast stream flip and live verification"
```

---

## Deferred to deploy day

- Register the Postmark event webhook, **with the `SubscriptionChange` trigger enabled**, at `https://USER:PASS@cncrealtygroup.com/api/webhooks/postmark`. No webhooks are registered today and `NEXTAUTH_URL` is still `localhost:3000`, so Postmark cannot reach us until then. Task 8's handler is written and unit-tested; only the registration is outstanding.
- Rotate `NEXTAUTH_SECRET` **before** the first campaign. It signs unsubscribe tokens, so rotating afterwards invalidates every link already in an inbox.
