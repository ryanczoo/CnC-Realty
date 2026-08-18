# Per-Agent Email Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap how many campaign/drip emails each agent can send per month, so one agent cannot exhaust the brokerage's shared Postmark quota, without adding any query cost to dashboard tab-switching.

**Architecture:** Three new counter fields on `Agent`. A small pure-function module (`lib/email-quota.ts`) computes remaining quota for display and performs the actual DB writes via atomic conditional updates (never read-then-write, to survive concurrent sends within one batch). The campaign-send route and the Action Plan cron both consume quota per successful send and leave over-limit recipients `PENDING` (retryable later) rather than erroring. The Campaigns list page — already a Server Component running a session-scoped query — reads the three fields in one additional query. Admin editing reuses the existing `/admin/agents` inline-edit pattern verbatim.

**Tech Stack:** Next.js 14 App Router, Prisma 5 / PostgreSQL (Neon), Vitest.

## Global Constraints

- Default limit: **200** emails/agent/month (`10,000 ÷ 50 agents`, sized against the Postmark Basic plan).
- Only campaign sends and drip/Action Plan `EMAIL` steps consume quota. Trigger-automation emails, system notifications, and drip `TASK` steps never do.
- Reset boundary: UTC calendar-month (1st of the month, `00:00:00.000 UTC`), computed lazily — no cron.
- An over-limit send is skipped, never an error. The batch it belongs to still completes and reports a normal 200.
- A limit-skipped `CampaignContact` stays `PENDING`. A limit-skipped `LeadPlanStep` stays `PENDING`, not `SKIPPED` — `SKIPPED` is reserved for permanent conditions (no lead email on file), because the cron's own `dueAt <= now` query already re-selects a `PENDING` step on its next run once quota is available again.
- No new Vercel cron job. No client-side fetch anywhere in this feature (all data flows through server-rendered pages or existing send/cron routes).
- Spec: `docs/superpowers/specs/2026-08-17-per-agent-email-limit-design.md`.

---

### Task 1: Schema — add quota fields to `Agent`

**Files:**
- Modify: `packages/database/prisma/schema.prisma:321` (insert after `signedIcaKey String?`, before `createdAt`)
- Create: `packages/database/prisma/migrations/<timestamp>_add_agent_email_quota/migration.sql` (generated, not hand-written — see steps)

**Interfaces:**
- Produces: `Agent.monthlyEmailLimit: number`, `Agent.monthlyEmailsSent: number`, `Agent.monthlyResetAt: Date` — every later task reads/writes these exact field names.

- [ ] **Step 1: Add the three fields to the Prisma schema**

Open `packages/database/prisma/schema.prisma`. Find this block (currently lines 318–322):

```prisma
  listingsClosed   Int      @default(0)
  volumeClosed     Float    @default(0)
  propertiesRented Int      @default(0)
  signedIcaKey     String?
  createdAt        DateTime @default(now())
```

Insert three new lines immediately after `signedIcaKey String?`, so the block reads:

```prisma
  listingsClosed   Int      @default(0)
  volumeClosed     Float    @default(0)
  propertiesRented Int      @default(0)
  signedIcaKey     String?
  monthlyEmailLimit Int      @default(200)
  monthlyEmailsSent Int      @default(0)
  monthlyResetAt    DateTime @default(now())
  createdAt        DateTime @default(now())
```

`monthlyResetAt` defaults to `now()` (not a future date) so a brand-new agent's very first send correctly takes the
"boundary already passed" branch and starts counting from zero, without a separate first-time-setup case.

- [ ] **Step 2: Generate the migration**

Windows note: if the dev server is running, `prisma generate` (which `migrate dev` calls internally) will fail with
an `EPERM` file-lock error on `query_engine-windows.dll.node`. If that happens: stop the dev server
(`Stop-Process -Name "node" -Force` in PowerShell), run the command below, then restart the dev server afterward.

Run: `pnpm --filter @cnc/database exec prisma migrate dev --name add_agent_email_quota`

Expected: a new folder `packages/database/prisma/migrations/<timestamp>_add_agent_email_quota/migration.sql`
containing three `ALTER TABLE "Agent" ADD COLUMN ...` statements, and the command reports the migration applied
successfully against the Neon database.

- [ ] **Step 3: Verify the columns exist with correct defaults**

Run: `pnpm --filter @cnc/database exec prisma studio`

Open the `Agent` table in the browser tab that opens. Confirm every existing row shows `monthlyEmailLimit: 200`,
`monthlyEmailsSent: 0`, and a `monthlyResetAt` timestamp close to "now". Close Prisma Studio.

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat(db): add per-agent monthly email quota fields"
```

---

### Task 2: `lib/email-quota.ts` — pure calculation + atomic DB helpers

**Files:**
- Create: `apps/web/src/lib/email-quota.ts`
- Test: `apps/web/src/__tests__/lib/email-quota.test.ts`

**Interfaces:**
- Consumes: `prisma.agent.updateMany` (from `@/lib/prisma`, already used elsewhere in this codebase the same way).
- Produces:
  - `nextMonthBoundary(now: Date): Date`
  - `remainingQuota(agent: { monthlyEmailLimit: number; monthlyEmailsSent: number; monthlyResetAt: Date }, now: Date): number`
  - `ensureQuotaReset(agentId: string, now: Date): Promise<void>`
  - `tryConsumeEmailQuota(agentId: string, limit: number): Promise<boolean>`

  Later tasks (3, 4, 5) import all four by these exact names from `@/lib/email-quota`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/lib/email-quota.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { agent: { updateMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import {
  nextMonthBoundary,
  remainingQuota,
  ensureQuotaReset,
  tryConsumeEmailQuota,
} from "@/lib/email-quota";

describe("nextMonthBoundary", () => {
  it("returns the 1st of the following UTC month at midnight", () => {
    const now = new Date("2026-08-17T14:32:00.000Z");
    expect(nextMonthBoundary(now)).toEqual(new Date("2026-09-01T00:00:00.000Z"));
  });

  it("rolls over the year at December", () => {
    const now = new Date("2026-12-15T00:00:00.000Z");
    expect(nextMonthBoundary(now)).toEqual(new Date("2027-01-01T00:00:00.000Z"));
  });

  it("a reset triggered exactly on the 1st lands on the following month, not the same day", () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    expect(nextMonthBoundary(now)).toEqual(new Date("2026-10-01T00:00:00.000Z"));
  });
});

describe("remainingQuota", () => {
  const now = new Date("2026-08-17T00:00:00.000Z");

  it("returns limit minus sent when the boundary hasn't passed", () => {
    const agent = {
      monthlyEmailLimit: 200,
      monthlyEmailsSent: 58,
      monthlyResetAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    expect(remainingQuota(agent, now)).toBe(142);
  });

  it("returns the full limit once the boundary has passed, ignoring stale sent count", () => {
    const agent = {
      monthlyEmailLimit: 200,
      monthlyEmailsSent: 200,
      monthlyResetAt: new Date("2026-08-01T00:00:00.000Z"),
    };
    expect(remainingQuota(agent, now)).toBe(200);
  });

  it("clamps at 0, never negative", () => {
    const agent = {
      monthlyEmailLimit: 200,
      monthlyEmailsSent: 250,
      monthlyResetAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    expect(remainingQuota(agent, now)).toBe(0);
  });

  it("treats a boundary equal to now as passed", () => {
    const agent = {
      monthlyEmailLimit: 200,
      monthlyEmailsSent: 200,
      monthlyResetAt: now,
    };
    expect(remainingQuota(agent, now)).toBe(200);
  });
});

describe("ensureQuotaReset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resets the counter and advances monthlyResetAt when the boundary has passed", async () => {
    vi.mocked(prisma.agent.updateMany).mockResolvedValue({ count: 1 } as any);
    const now = new Date("2026-09-05T00:00:00.000Z");

    await ensureQuotaReset("agent-1", now);

    expect(prisma.agent.updateMany).toHaveBeenCalledWith({
      where: { id: "agent-1", monthlyResetAt: { lte: now } },
      data: { monthlyEmailsSent: 0, monthlyResetAt: new Date("2026-10-01T00:00:00.000Z") },
    });
  });

  it("is a harmless no-op (still called, matched zero rows) when the boundary hasn't passed", async () => {
    vi.mocked(prisma.agent.updateMany).mockResolvedValue({ count: 0 } as any);
    await expect(ensureQuotaReset("agent-1", new Date())).resolves.toBeUndefined();
  });
});

describe("tryConsumeEmailQuota", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when the atomic increment matched a row (quota was available)", async () => {
    vi.mocked(prisma.agent.updateMany).mockResolvedValue({ count: 1 } as any);

    const ok = await tryConsumeEmailQuota("agent-1", 200);

    expect(ok).toBe(true);
    expect(prisma.agent.updateMany).toHaveBeenCalledWith({
      where: { id: "agent-1", monthlyEmailsSent: { lt: 200 } },
      data: { monthlyEmailsSent: { increment: 1 } },
    });
  });

  it("returns false when the agent was already at their limit", async () => {
    vi.mocked(prisma.agent.updateMany).mockResolvedValue({ count: 0 } as any);
    const ok = await tryConsumeEmailQuota("agent-1", 200);
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test email-quota`
Expected: FAIL — `Cannot find module '@/lib/email-quota'` (the file doesn't exist yet).

- [ ] **Step 3: Implement `lib/email-quota.ts`**

```ts
import { prisma } from "@/lib/prisma";

export interface AgentQuota {
  monthlyEmailLimit: number;
  monthlyEmailsSent: number;
  monthlyResetAt: Date;
}

/** The first UTC midnight of the month strictly after `now`. A boundary hit
 * exactly on the 1st rolls to the *following* month, not the same day. */
export function nextMonthBoundary(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/**
 * Pure — never writes. Used by the read-only display path (Campaigns list
 * page) and mirrors the write path's own boundary logic so the two can never
 * disagree about whether the current period has ended.
 */
export function remainingQuota(agent: AgentQuota, now: Date): number {
  if (agent.monthlyResetAt.getTime() <= now.getTime()) {
    return agent.monthlyEmailLimit;
  }
  return Math.max(0, agent.monthlyEmailLimit - agent.monthlyEmailsSent);
}

/**
 * Call once per send batch, before any sends, not once per recipient.
 * Resets the counter only if the current period has actually ended;
 * otherwise a harmless no-op (the where clause matches zero rows).
 */
export async function ensureQuotaReset(agentId: string, now: Date): Promise<void> {
  await prisma.agent.updateMany({
    where: { id: agentId, monthlyResetAt: { lte: now } },
    data: { monthlyEmailsSent: 0, monthlyResetAt: nextMonthBoundary(now) },
  });
}

/**
 * Call once per recipient about to be sent to. Atomic — never a separate
 * read followed by a write, so concurrent sends within the same batch
 * (Promise.allSettled / Promise.all) cannot race past the limit. Returns
 * true iff this call is the one that consumed the last unit of quota
 * available; false means the agent was already at their limit and this
 * send must be skipped.
 */
export async function tryConsumeEmailQuota(agentId: string, limit: number): Promise<boolean> {
  const result = await prisma.agent.updateMany({
    where: { id: agentId, monthlyEmailsSent: { lt: limit } },
    data: { monthlyEmailsSent: { increment: 1 } },
  });
  return result.count === 1;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test email-quota`
Expected: PASS, all 9 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/email-quota.ts apps/web/src/__tests__/lib/email-quota.test.ts
git commit -m "feat: add pure quota calculation and atomic consume/reset helpers"
```

---

### Task 3: Wire quota enforcement into the campaign-send route

**Files:**
- Modify: `apps/web/src/app/api/campaigns/[id]/send/route.ts`
- Modify: `apps/web/src/__tests__/api/campaigns-send.test.ts`

**Interfaces:**
- Consumes: `ensureQuotaReset`, `tryConsumeEmailQuota` from `@/lib/email-quota` (Task 2).
- Produces: response shape grows from `{ sent, skipped, errors }` to `{ sent, skipped, skippedLimit, errors }`. No
  other route in this codebase currently depends on the old shape (verified: only the campaign detail page reads
  this response, and Task 3 does not touch that page — display of `skippedLimit` there is out of scope per the
  spec's "Out of scope" section, this task only needs the field present in the JSON, not surfaced in the banner
  yet).

- [ ] **Step 1: Update the shared mocks in the existing test file**

In `apps/web/src/__tests__/api/campaigns-send.test.ts`, the `prisma` mock currently only stubs `campaign` and
`campaignContact`. Add `agent`:

```ts
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: { findUnique: vi.fn(), update: vi.fn() },
    campaignContact: { updateMany: vi.fn() },
    agent: { updateMany: vi.fn() },
  },
}));
```

In `resetSeamMocks()`, add a default that simulates "quota always available" so every existing test — none of
which is about quota — keeps passing unchanged:

```ts
function resetSeamMocks() {
  vi.mocked(sendEmail).mockReset().mockResolvedValue({ sent: true });
  vi.mocked(prisma.campaignContact.updateMany)
    .mockReset()
    .mockResolvedValue({ count: 0 } as any);
  // Default: every quota check succeeds. ensureQuotaReset's return value is
  // never inspected by the route, and tryConsumeEmailQuota only cares about
  // count === 1, so one shared resolved value covers both call sites.
  vi.mocked(prisma.agent.updateMany).mockReset().mockResolvedValue({ count: 1 } as any);
}
```

**The new route code reads `campaign.agent.monthlyEmailLimit`. Every existing campaign fixture/mock in this file
constructs a plain object with no `agent` field at all — without fixing this, accessing `.monthlyEmailLimit` on
`undefined` would throw and break essentially every test in the file, not just the new ones.** Fix both places:

1. The shared `CAMPAIGN` constant (used directly by the "ownership" tests, and spread by `CAMPAIGN_WITH` and by
   the "NEXTAUTH_URL preflight" / "broadcast stream preflight" describe blocks — fixing it here fixes all of
   those automatically). Change:

```ts
const CAMPAIGN = {
  id: "c1",
  agentId: "a1",
  subject: "Hello",
  body: "Hi there",
  contacts: [],
};
```

to:

```ts
const CAMPAIGN = {
  id: "c1",
  agentId: "a1",
  agent: { monthlyEmailLimit: 200 },
  subject: "Hello",
  body: "Hi there",
  contacts: [],
};
```

2. The one standalone campaign mock that does **not** spread `CAMPAIGN` — inside the `"send seam"` describe
   block's `beforeEach`. Add the same `agent` field:

```ts
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({
      id: "c1",
      agentId: "a1",
      agent: { monthlyEmailLimit: 200 },
      subject: "Spring Market Update",
      body: "<p><strong>Big news</strong> this quarter.</p>",
      contacts: [{ id: "cc1", lead: { id: "lead_1", email: "lead@example.com" } }],
    } as any);
```

`campaign.agentId` (not `session.user.agentId`) is what the route uses for quota — so an ADMIN sending another
agent's campaign still consumes that campaign's own agent's quota, correctly.

- [ ] **Step 2: Add the new failing tests to the same file**

Append to the end of the `"suppressed contacts"` describe block (before its closing `});`):

```ts
  it("skips a recipient over quota, leaves the contact PENDING, and reports skippedLimit", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(CAMPAIGN_WITH(2) as any);
    // First agent.updateMany call is ensureQuotaReset (batch-level, called
    // once); the next two are tryConsumeEmailQuota, one per recipient.
    vi.mocked(prisma.agent.updateMany)
      .mockResolvedValueOnce({ count: 0 } as any) // ensureQuotaReset: boundary not passed, no-op
      .mockResolvedValueOnce({ count: 1 } as any) // recipient 1: quota available
      .mockResolvedValueOnce({ count: 0 } as any); // recipient 2: at limit

    const res = await POST(request(), { params: { id: "c1" } });
    const body = await res.json();

    expect(body).toEqual({ sent: 1, skipped: 0, skippedLimit: 1, errors: 0 });
    // The over-quota contact was never sent to at all.
    expect(sendEmail).toHaveBeenCalledOnce();
    // It must not be marked UNSUBSCRIBED — it should be retried once quota resets.
    expect(prisma.campaignContact.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "UNSUBSCRIBED" } })
    );
  });

  it("accounts for every contact including limit-skipped ones", async () => {
    const campaign = CAMPAIGN_WITH(3);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(campaign as any);
    vi.mocked(prisma.agent.updateMany)
      .mockResolvedValueOnce({ count: 0 } as any) // ensureQuotaReset
      .mockResolvedValueOnce({ count: 1 } as any) // recipient 1: sent
      .mockResolvedValueOnce({ count: 0 } as any) // recipient 2: over limit
      .mockResolvedValueOnce({ count: 1 } as any); // recipient 3: sent
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });

    const res = await POST(request(), { params: { id: "c1" } });
    const { sent, skipped, skippedLimit, errors } = await res.json();

    expect(sent + skipped + skippedLimit + errors).toBe(campaign.contacts.length);
  });

  it("checks quota once per batch (ensureQuotaReset), not once per recipient", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(CAMPAIGN_WITH(3) as any);

    await POST(request(), { params: { id: "c1" } });

    // 1 ensureQuotaReset call + 3 tryConsumeEmailQuota calls (one per
    // recipient) = 4 total. Not 3 (missing the reset) and not 6 (reset
    // called redundantly per recipient).
    expect(prisma.agent.updateMany).toHaveBeenCalledTimes(4);
  });
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `pnpm --filter web test campaigns-send`
Expected: the 3 new tests FAIL (route doesn't call `prisma.agent.updateMany` yet, so `body.skippedLimit` is
`undefined` and call counts are wrong). The pre-existing tests should still PASS at this point — confirm no
regressions from the mock changes in Step 1 alone before writing implementation code.

- [ ] **Step 4: Implement the route changes**

This task touches several non-contiguous parts of a 162-line file, and one new line (`ensureQuotaReset`) must be
inserted after the existing `const now = new Date();` declaration specifically, not merely "somewhere before
`Promise.allSettled`" — to remove any ordering ambiguity, replace the **entire contents** of
`apps/web/src/app/api/campaigns/[id]/send/route.ts` with the following:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, checkOwnership } from "@/lib/api-auth";
import { emailLayout } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";
import { unsubscribeFooterHtml } from "@/lib/email/unsubscribe";
import { ensureQuotaReset, tryConsumeEmailQuota } from "@/lib/email-quota";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const campaignRecord = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      agent: { select: { monthlyEmailLimit: true } },
      contacts: {
        // Filter here rather than relying only on the seam's per-send check:
        // that check is one query per recipient inside Promise.allSettled, so
        // a 1,000-lead campaign fired 1,000 concurrent lookups at Neon. The
        // seam still checks, as a backstop against a race between this query
        // and the send.
        where: { status: "PENDING", lead: { campaignOptOut: false } },
        include: { lead: { select: { id: true, email: true, firstName: true, lastName: true } } },
      },
    },
  });

  const { exists, forbidden, record: campaign } = checkOwnership(campaignRecord, session.user.agentId, session.user.role);
  if (!exists || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!campaign.subject || !campaign.body) {
    return NextResponse.json(
      { error: "Campaign must have a subject and body before sending" },
      { status: 400 }
    );
  }

  if (!process.env.POSTMARK_SERVER_TOKEN) {
    return NextResponse.json({ error: "POSTMARK_SERVER_TOKEN not configured" }, { status: 500 });
  }

  // Preflight, not per-recipient: the seam throws for an unconfigured broadcast
  // stream, and Promise.allSettled would bury that throw as N send failures —
  // a 200 response and a campaign marked ACTIVE/sentAt with zero delivered.
  // Fail here, before any state mutation, so a misconfigured deploy is loud.
  if (!process.env.POSTMARK_BROADCAST_STREAM) {
    return NextResponse.json(
      { error: "POSTMARK_BROADCAST_STREAM not configured" },
      { status: 500 }
    );
  }

  // Same reasoning: unsubscribe links are signed with this, so without it every
  // recipient throws inside allSettled and the campaign reports success having
  // delivered nothing.
  if (!process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "NEXTAUTH_SECRET not configured" }, { status: 500 });
  }

  // The fourth ingredient of a working unsubscribe, and the quietest failure of
  // the four: unset, the URL builders interpolate the literal string
  // "undefined", so every message ships a List-Unsubscribe header and a footer
  // link pointing at `undefined/...`. Postmark enforces that the header is
  // present, not that it resolves — so this sends successfully with a dead
  // opt-out link, which is worse than not sending at all.
  if (!process.env.NEXTAUTH_URL) {
    return NextResponse.json({ error: "NEXTAUTH_URL not configured" }, { status: 500 });
  }

  // A lead who unsubscribed from an earlier send is already flagged when the
  // next campaign fires, so the contact query above filters them out and the
  // send loop never sees them — they would sit at PENDING forever and
  // `skipped` would only ever be non-zero inside the query-to-send race
  // window. Mark them in one extra pass instead: two queries total regardless
  // of list size, so the N+1 fix stays intact.
  //
  // Deliberately placed after the ownership and validation gates above. Run
  // earlier, this would mutate contacts on a campaign the caller does not own,
  // and mutate state on a request that then 400s.
  const preMarked = await prisma.campaignContact.updateMany({
    where: {
      campaignId: params.id,
      status: "PENDING",
      lead: { campaignOptOut: true },
    },
    data: { status: "UNSUBSCRIBED" },
  });

  const now = new Date();
  // Once per batch, not once per recipient — see lib/email-quota.ts.
  await ensureQuotaReset(campaign.agentId, now);

  const results = await Promise.allSettled(
    campaign.contacts.map(async (contact) => {
      const quotaAvailable = await tryConsumeEmailQuota(campaign.agentId, campaign.agent.monthlyEmailLimit);
      if (!quotaAvailable) {
        return { contactId: contact.id, outcome: "limit" as const };
      }

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

      return { contactId: contact.id, outcome: result.sent ? ("sent" as const) : ("suppressed" as const) };
    })
  );

  let sent = 0;
  // Seeded, not zero: these contacts were suppressed before the loop began.
  let skipped = preMarked.count;
  let skippedLimit = 0;
  let errors = 0;
  const sentIds: string[] = [];
  const skippedIds: string[] = [];

  for (const settled of results) {
    if (settled.status === "rejected") {
      console.error("Failed to send email:", settled.reason);
      errors++;
      continue;
    }

    const { contactId, outcome } = settled.value;
    if (outcome === "sent") {
      sent++;
      sentIds.push(contactId);
    } else if (outcome === "suppressed") {
      skipped++;
      skippedIds.push(contactId);
    } else {
      // "limit" — over quota. Left PENDING (no id pushed to either array),
      // not UNSUBSCRIBED, so a future send of this same campaign retries it.
      skippedLimit++;
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

  return NextResponse.json({ sent, skipped, skippedLimit, errors });
}
```

The only behavioral changes from the original: the `agent: { select: { monthlyEmailLimit: true } }` relation added
to the `findUnique` include, the `ensureQuotaReset` call, the quota check at the top of the per-contact callback
(returning early with `outcome: "limit"` instead of sending), the three-way `outcome` branch replacing the old
two-way `result.sent` check, and `skippedLimit` added to both the running counters and the final response. Every
other line — ownership check, the four preflight config checks, the pre-mark pass, the two `updateMany` calls, the
campaign `update` call — is unchanged from the current file.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter web test campaigns-send`
Expected: PASS, all tests including the 3 new ones and every pre-existing one.

- [ ] **Step 6: Run the full suite to check for unrelated breakage**

Run: `pnpm --filter web test`
Expected: PASS. (Confirms nothing else in the app asserts the old two-field response shape.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/campaigns/\[id\]/send/route.ts apps/web/src/__tests__/api/campaigns-send.test.ts
git commit -m "feat(campaigns): enforce per-agent monthly send quota on campaign sends"
```

---

### Task 4: Wire quota enforcement into the Action Plan cron

**Files:**
- Modify: `apps/web/src/app/api/cron/action-plans/route.ts`
- Modify: `apps/web/src/__tests__/api/cron-action-plans.test.ts`

**Interfaces:**
- Consumes: `ensureQuotaReset`, `tryConsumeEmailQuota` from `@/lib/email-quota` (Task 2).
- Produces: response shape grows from `{ processed, errors }` to `{ processed, errors, skippedLimit }`.

- [ ] **Step 1: Update the shared mocks and fixtures in the existing test file**

In `apps/web/src/__tests__/api/cron-action-plans.test.ts`, add `updateMany` to the existing `agent` mock:

```ts
vi.mock("@/lib/prisma", () => ({
  prisma: {
    leadPlanStep: { findMany: vi.fn(), update: vi.fn() },
    leadPlanEnrollment: { findMany: vi.fn(), update: vi.fn() },
    leadTask: { create: vi.fn() },
    lead: { findUnique: vi.fn() },
    agent: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
}));
```

Add `monthlyEmailLimit` to the shared `AGENT` fixture (the route will need to select it):

```ts
const AGENT = {
  id: "a1",
  displayName: "Jane Agent",
  phone: "555-1234",
  monthlyEmailLimit: 200,
  user: { email: "agent@test.com" },
};
```

Add a default "quota always available" mock in the top-level `beforeEach`:

```ts
describe("POST /api/cron/action-plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.agent.updateMany).mockResolvedValue({ count: 1 } as any);
  });
```

- [ ] **Step 2: Add the new failing tests**

Append inside the same `describe` block, before its closing `});`:

```ts
  it("skips an EMAIL step over quota, leaves it PENDING (not SKIPPED), and reports skippedLimit", async () => {
    vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([EMAIL_STEP] as any);
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);
    // First call is the once-per-agent ensureQuotaReset; second is this
    // step's tryConsumeEmailQuota, which reports the agent already at limit.
    vi.mocked(prisma.agent.updateMany)
      .mockResolvedValueOnce({ count: 0 } as any)
      .mockResolvedValueOnce({ count: 0 } as any);

    const res = await POST(makeReq(CRON_SECRET));
    const body = await res.json();

    expect(body.skippedLimit).toBe(1);
    expect(body.processed).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    // Must stay PENDING, not be marked SKIPPED or DONE — the cron's own
    // dueAt <= now query re-selects it once quota is available again.
    expect(prisma.leadPlanStep.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ls1" } })
    );
  });

  it("still processes a TASK step normally when the same agent is over their email quota", async () => {
    vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([TASK_STEP] as any);
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.leadTask.create).mockResolvedValue({} as any);
    vi.mocked(prisma.leadPlanStep.update).mockResolvedValue({} as any);
    // Even if quota is exhausted, a TASK step never calls tryConsumeEmailQuota
    // at all — only ensureQuotaReset runs, once.
    vi.mocked(prisma.agent.updateMany).mockResolvedValueOnce({ count: 0 } as any);

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(prisma.leadTask.create).toHaveBeenCalledOnce();
    expect(prisma.agent.updateMany).toHaveBeenCalledTimes(1);
  });

  it("checks the reset boundary once per distinct agent, not once per step", async () => {
    const secondStep = {
      ...EMAIL_STEP,
      id: "ls3",
      enrollmentId: "e3",
      enrollment: { ...EMAIL_STEP.enrollment, id: "e3" }, // same agentId "a1"
    };
    vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([EMAIL_STEP, secondStep] as any);
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.leadPlanStep.update).mockResolvedValue({} as any);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });

    await POST(makeReq(CRON_SECRET));

    // 1 ensureQuotaReset (both steps share agent "a1") + 2 tryConsumeEmailQuota
    // (one per EMAIL step) = 3 total, not 4.
    expect(prisma.agent.updateMany).toHaveBeenCalledTimes(3);
  });
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `pnpm --filter web test cron-action-plans`
Expected: the 3 new tests FAIL. Pre-existing tests should still PASS (confirms the fixture/mock changes in Step 1
alone don't break anything).

- [ ] **Step 4: Implement the route changes**

Like Task 3, this touches several non-contiguous parts of the file with an ordering dependency (the agent-dedupe
reset pass needs `now`, which is declared at the top; the quota check needs `agent`, which is destructured deep
inside the per-step callback). To remove ambiguity, replace the **entire contents** of
`apps/web/src/app/api/cron/action-plans/route.ts` with the following:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { substituteVars, sendActionPlanEmail } from "@/lib/action-plan-email";
import { ensureQuotaReset, tryConsumeEmailQuota } from "@/lib/email-quota";
import type { Prisma } from "@cnc/database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

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

  // One reset check per distinct agent represented in this batch, not once
  // per step — matches how ensureQuotaReset is meant to be called (see
  // lib/email-quota.ts). A step's own agentId lives at
  // step.enrollment.agentId; no need to go through the loaded agent relation
  // just to dedupe.
  const agentIds = Array.from(new Set(dueSteps.map((s) => s.enrollment.agentId)));
  await Promise.all(agentIds.map((id) => ensureQuotaReset(id, now)));

  // Each step's send/create + status update is independent of every other
  // step, so run them concurrently instead of one at a time. Every branch
  // still resolves (never rejects) so Promise.all can't short-circuit on
  // the first failure — that would abandon the remaining steps.
  const stepResults = await Promise.all(
    dueSteps.map(async (step): Promise<"processed" | "error" | "skipped-limit"> => {
      try {
        const { enrollment } = step;
        const { lead, agent } = enrollment;
        const vars = {
          firstName: lead.firstName ?? "",
          lastName: lead.lastName ?? "",
          agentName: agent.displayName ?? agent.user?.email ?? "",
          agentPhone: agent.phone ?? "",
        };

        if (step.stepType === "EMAIL") {
          if (!lead.email) {
            // Skip EMAIL step — no lead email on file
            await prisma.leadPlanStep.update({
              where: { id: step.id },
              data: { status: "SKIPPED", executedAt: now },
            });
            return "processed";
          }

          const quotaAvailable = await tryConsumeEmailQuota(agent.id, agent.monthlyEmailLimit);
          if (!quotaAvailable) {
            // Left PENDING, not marked SKIPPED: this is circumstantial, not
            // permanent. dueAt is already <= now, so the cron's own query
            // re-selects this step on its next run once quota resets.
            return "skipped-limit";
          }

          const subject = substituteVars(step.subject ?? "", vars);
          const body = substituteVars(step.body ?? "", vars);
          await sendActionPlanEmail({
            to: lead.email,
            subject,
            body,
            enrollmentId: enrollment.id,
            leadId: lead.id,
          });
        } else if (step.stepType === "TASK") {
          const title = substituteVars(step.taskTitle ?? "", vars);
          await prisma.leadTask.create({
            data: {
              leadId: lead.id,
              title,
              taskType: "FOLLOW_UP",
              dueDate: step.dueAt,
            },
          });
        }

        await prisma.leadPlanStep.update({
          where: { id: step.id },
          data: { status: "DONE", executedAt: now },
        });
        return "processed";
      } catch (e) {
        console.error(`[action-plans-cron] step ${step.id} failed:`, e);
        return "error";
      }
    })
  );

  let processed = 0;
  let errors = 0;
  let skippedLimit = 0;
  for (const result of stepResults) {
    if (result === "processed") processed++;
    else if (result === "error") errors++;
    else skippedLimit++;
  }

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

  return NextResponse.json({ processed, errors, skippedLimit });
}
```

The only behavioral changes from the original: `monthlyEmailLimit` added to the agent `select`, the agent-dedupe
reset pass before the main loop, the quota check inside the `EMAIL` branch (after the existing missing-email
guard), the widened return type, and `skippedLimit` added to both the counting loop and the final response. Every
other line — auth check, the `dueSteps` query shape, the `TASK` branch, the failure handling, the enrollment
completion pass — is unchanged from the current file. Note this also means a limit-skipped step correctly stays
out of `completedEnrollments`: that filter requires every step's status to be `"DONE"` or `"SKIPPED"`, and a
limit-skipped step stays `"PENDING"`, so its enrollment is correctly not marked `COMPLETED` while a step is still
waiting to be retried.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter web test cron-action-plans`
Expected: PASS, all tests including the 3 new ones and every pre-existing one.

- [ ] **Step 6: Run the full suite to check for unrelated breakage**

Run: `pnpm --filter web test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/cron/action-plans/route.ts apps/web/src/__tests__/api/cron-action-plans.test.ts
git commit -m "feat(action-plans): enforce per-agent monthly send quota on drip email steps"
```

---

### Task 5: Display remaining quota on the Campaigns list page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/campaigns/page.tsx`
- Modify: `apps/web/src/__tests__/components/CampaignsPage.test.ts`

**Interfaces:**
- Consumes: `remainingQuota` from `@/lib/email-quota` (Task 2).

**Important — read before starting:** `CampaignsPage.test.ts` currently asserts `prisma.agent.findUnique` is
**never** called, for both the AGENT and ADMIN cases. That guard exists because of a real July 2026 dashboard
tab-switching bug where `agentId` was redundantly re-fetched from the DB on every tab even though it's already on
the cached session JWT. This task adds a genuinely new, single lookup for data that cannot live on the session
(the quota counters change over time and must stay fresh) — it is not the bug that test was written to prevent.
Only the AGENT case changes; the ADMIN case must still assert zero calls, since an admin has no personal quota to
display.

- [ ] **Step 1: Update the AGENT-role test, add fixtures**

In `apps/web/src/__tests__/components/CampaignsPage.test.ts`, replace the entire first test
(`"scopes campaigns using session.agentId, without querying prisma.agent"`) with:

```ts
  it("scopes campaigns using session.agentId and reads that agent's quota fields", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "AGENT", agentId: "agent-1" },
    } as any);
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      monthlyEmailLimit: 200,
      monthlyEmailsSent: 58,
      monthlyResetAt: new Date("2026-09-01T00:00:00.000Z"),
    } as any);

    await CampaignsPage();

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agentId: "agent-1" } })
    );
    expect(prisma.agent.findUnique).toHaveBeenCalledWith({
      where: { id: "agent-1" },
      select: { monthlyEmailLimit: true, monthlyEmailsSent: true, monthlyResetAt: true },
    });
  });

  it("does not crash if the agent quota lookup fails", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "AGENT", agentId: "agent-1" },
    } as any);
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);
    vi.mocked(prisma.agent.findUnique).mockRejectedValue(new Error("db down"));

    await expect(CampaignsPage()).resolves.toBeDefined();
  });
```

Leave the second existing test (`"shows brokerage-wide campaigns for ADMIN"`) exactly as it is — its
`expect(prisma.agent.findUnique).not.toHaveBeenCalled()` assertion must keep passing unchanged.

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `pnpm --filter web test CampaignsPage`
Expected: the 2 new/changed tests FAIL (`prisma.agent.findUnique` not called yet). The unchanged ADMIN test should
still PASS.

- [ ] **Step 3: Implement the page changes**

In `apps/web/src/app/(dashboard)/dashboard/campaigns/page.tsx`, add the import:

```ts
import { remainingQuota } from "@/lib/email-quota";
```

After the existing `campaigns` fetch (`try { campaigns = await prisma.campaign.findMany(...) } catch { ... }`), add
a second, independent try/catch — a failure here must not blank out the campaign list:

```ts
  let quotaText: string | null = null;
  if (agentId) {
    try {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { monthlyEmailLimit: true, monthlyEmailsSent: true, monthlyResetAt: true },
      });
      if (agent) {
        const remaining = remainingQuota(agent, new Date());
        quotaText = `${remaining} / ${agent.monthlyEmailLimit} sends left this month`;
      }
    } catch {
      // Show the page without the quota line on DB error.
    }
  }
```

Render it next to the existing heading. Change:

```tsx
        <div>
          <h1 className="font-sans text-2xl font-medium text-[#1B1B1B]">Campaigns</h1>
          <p className="mt-1 font-sans text-sm text-[#1B1B1B]/50">Create and send emails or DRIP campaigns to your leads here</p>
        </div>
```

to:

```tsx
        <div>
          <h1 className="font-sans text-2xl font-medium text-[#1B1B1B]">Campaigns</h1>
          <p className="mt-1 font-sans text-sm text-[#1B1B1B]/50">Create and send emails or DRIP campaigns to your leads here</p>
          {quotaText && (
            <p className="mt-1 font-sans text-xs text-[#1B1B1B]/40">{quotaText}</p>
          )}
        </div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test CampaignsPage`
Expected: PASS, all tests.

- [ ] **Step 5: Run the full suite to check for unrelated breakage**

Run: `pnpm --filter web test`
Expected: PASS.

- [ ] **Step 6: Manual verification (no render-test infrastructure exists in this project)**

Start the dev server (`pnpm --filter web dev`), log in as the `claude-test-agent` test account, open
`/dashboard/campaigns`, and confirm the "N / 200 sends left this month" line renders under the page heading.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/campaigns/page.tsx" apps/web/src/__tests__/components/CampaignsPage.test.ts
git commit -m "feat(campaigns): show remaining monthly email quota on the Campaigns list page"
```

---

### Task 6: Admin — editable per-agent limit on the All Agents table

**Files:**
- Create: `apps/web/src/app/(dashboard)/admin/agents/AgentEmailLimitEditor.tsx`
- Modify: `apps/web/src/app/(dashboard)/admin/agents/page.tsx`
- Modify: `apps/web/src/app/api/admin/agents/[id]/route.ts`
- Create: `apps/web/src/__tests__/api/admin-agents-patch.test.ts`

**Interfaces:**
- Produces: `PATCH /api/admin/agents/[id]` now accepts `{ title?: string; monthlyEmailLimit?: number }`, either or
  both, at least one required.

**Important — this task changes existing, working behavior of the PATCH route**, not just adds to it. Today the
route always requires `title`. `AgentEmailLimitEditor` needs to send `{ monthlyEmailLimit: N }` with no `title` at
all, which would currently 400. Both fields become independently optional; the route 400s only if neither is
present or a present field is invalid. `AgentTitleEditor`'s existing behavior (still always sends `title`, still
400s on an empty title) must be unaffected.

- [ ] **Step 1: Write the failing tests for the route**

Create `apps/web/src/__tests__/api/admin-agents-patch.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { agent: { update: vi.fn() } } }));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { PATCH } from "../../app/api/admin/agents/[id]/route";

function req(body: unknown) {
  return new Request("http://localhost/api/admin/agents/a1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/agents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({ session: { user: { role: "ADMIN" } }, error: null } as any);
  });

  it("updates title only, unchanged from existing behavior", async () => {
    vi.mocked(prisma.agent.update).mockResolvedValue({ id: "a1", title: "Listing Specialist" } as any);

    const res = await PATCH(req({ title: "Listing Specialist" }), { params: { id: "a1" } });

    expect(res.status).toBe(200);
    expect(prisma.agent.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { title: "Listing Specialist" },
      select: { id: true, title: true, monthlyEmailLimit: true },
    });
  });

  it("still 400s on an empty title, unchanged from existing behavior", async () => {
    const res = await PATCH(req({ title: "   " }), { params: { id: "a1" } });
    expect(res.status).toBe(400);
    expect(prisma.agent.update).not.toHaveBeenCalled();
  });

  it("updates monthlyEmailLimit only, with no title in the request", async () => {
    vi.mocked(prisma.agent.update).mockResolvedValue({ id: "a1", monthlyEmailLimit: 500 } as any);

    const res = await PATCH(req({ monthlyEmailLimit: 500 }), { params: { id: "a1" } });

    expect(res.status).toBe(200);
    expect(prisma.agent.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { monthlyEmailLimit: 500 },
      select: { id: true, title: true, monthlyEmailLimit: true },
    });
  });

  it("rejects a negative monthlyEmailLimit", async () => {
    const res = await PATCH(req({ monthlyEmailLimit: -5 }), { params: { id: "a1" } });
    expect(res.status).toBe(400);
    expect(prisma.agent.update).not.toHaveBeenCalled();
  });

  it("rejects a non-integer monthlyEmailLimit", async () => {
    const res = await PATCH(req({ monthlyEmailLimit: 12.5 }), { params: { id: "a1" } });
    expect(res.status).toBe(400);
    expect(prisma.agent.update).not.toHaveBeenCalled();
  });

  it("accepts both fields together", async () => {
    vi.mocked(prisma.agent.update).mockResolvedValue({ id: "a1" } as any);

    const res = await PATCH(req({ title: "Broker", monthlyEmailLimit: 300 }), { params: { id: "a1" } });

    expect(res.status).toBe(200);
    expect(prisma.agent.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { title: "Broker", monthlyEmailLimit: 300 },
      select: { id: true, title: true, monthlyEmailLimit: true },
    });
  });

  it("400s when neither field is present", async () => {
    const res = await PATCH(req({}), { params: { id: "a1" } });
    expect(res.status).toBe(400);
    expect(prisma.agent.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the agent does not exist", async () => {
    vi.mocked(prisma.agent.update).mockRejectedValue(new Error("not found"));
    const res = await PATCH(req({ title: "Broker" }), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test admin-agents-patch`
Expected: FAIL — several cases (`monthlyEmailLimit`-only update, both-fields, no-fields-400) don't match current
route behavior.

- [ ] **Step 3: Implement the route changes**

Replace the entire body of `apps/web/src/app/api/admin/agents/[id]/route.ts` from the `const body = ...` line
onward:

```ts
  const body = await req.json().catch(() => ({}));
  const { title, monthlyEmailLimit } = body as { title?: unknown; monthlyEmailLimit?: unknown };

  const data: { title?: string; monthlyEmailLimit?: number } = {};

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    data.title = title.trim();
  }

  if (monthlyEmailLimit !== undefined) {
    if (typeof monthlyEmailLimit !== "number" || !Number.isInteger(monthlyEmailLimit) || monthlyEmailLimit < 0) {
      return NextResponse.json(
        { error: "Monthly email limit must be a non-negative integer" },
        { status: 400 }
      );
    }
    data.monthlyEmailLimit = monthlyEmailLimit;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const agent = await prisma.agent
    .update({
      where: { id: params.id },
      data,
      select: { id: true, title: true, monthlyEmailLimit: true },
    })
    .catch(() => null);

  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  return NextResponse.json(agent);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web test admin-agents-patch`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Create `AgentEmailLimitEditor.tsx`**

Create `apps/web/src/app/(dashboard)/admin/agents/AgentEmailLimitEditor.tsx`, a near-identical sibling to
`AgentTitleEditor.tsx` in the same folder:

```tsx
"use client";

import { useState } from "react";

export function AgentEmailLimitEditor({ agentId, currentLimit }: { agentId: string; currentLimit: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentLimit));
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyEmailLimit: parsed }),
      });
      if (res.ok) setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="rounded px-2 py-1 text-xs text-[#1B1B1B]/50 transition-colors hover:bg-[#F2F0EF] hover:text-[#1B1B1B]"
      >
        {value}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="rounded border border-[#9E8C61]/40 px-2 py-1 text-xs text-[#1B1B1B] outline-none focus:border-[#9E8C61] w-20"
      />
      <button
        onClick={save}
        disabled={saving}
        className="rounded bg-[#9E8C61] px-2 py-1 text-xs text-white disabled:opacity-40"
      >
        {saving ? "…" : "Save"}
      </button>
      <button
        onClick={() => setEditing(false)}
        className="rounded px-2 py-1 text-xs text-[#1B1B1B]/40 hover:text-[#1B1B1B]"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Wire it into the admin agents page**

In `apps/web/src/app/(dashboard)/admin/agents/page.tsx`, add the import:

```ts
import { AgentEmailLimitEditor } from "./AgentEmailLimitEditor";
```

Add `monthlyEmailLimit: number` to the `AgentRow` type:

```ts
  type AgentRow = {
    id: string;
    slug: string;
    title: string | null;
    licenseNum: string | null;
    monthlyEmailLimit: number;
    createdAt: Date;
    signedIcaKey: string | null;
    user: { email: string; role: string; createdAt: Date };
    _count: { leads: number };
  };
```

`prisma.agent.findMany` already selects every scalar column by default (it has no explicit `select`), so
`monthlyEmailLimit` is already present on each row from Task 1's migration — no query change needed here.

Add a new header and a new `<td>`. Change:

```tsx
        <AdminTable
          headers={["Agent Name", "Email", "Title", "License", "Leads", "Joined", "Role", "Signed ICA", "Actions"]}
        >
```

to:

```tsx
        <AdminTable
          headers={["Agent Name", "Email", "Title", "License", "Email Limit", "Leads", "Joined", "Role", "Signed ICA", "Actions"]}
        >
```

and insert a new `<td>` between the existing License cell and Leads cell:

```tsx
              <td className="px-4 py-3 text-[#1B1B1B]/60">
                {agent.licenseNum ?? <span className="text-[#1B1B1B]/30">—</span>}
              </td>
              <td className="px-4 py-3">
                <AgentEmailLimitEditor agentId={agent.id} currentLimit={agent.monthlyEmailLimit} />
              </td>
              <td className="px-4 py-3 text-[#1B1B1B]">{agent._count.leads}</td>
```

- [ ] **Step 7: Run the full suite to check for unrelated breakage**

Run: `pnpm --filter web test`
Expected: PASS.

- [ ] **Step 8: Manual verification**

Start the dev server, log in as `ryanchong@cncrealtygroup.com` (ADMIN), open `/admin/agents`. Confirm the new
"Email Limit" column shows `200` for both existing agents. Click it, change the value to `250`, click Save, confirm
it persists after a page refresh.

- [ ] **Step 9: Commit**

```bash
git add "apps/web/src/app/(dashboard)/admin/agents" apps/web/src/app/api/admin/agents/\[id\]/route.ts apps/web/src/__tests__/api/admin-agents-patch.test.ts
git commit -m "feat(admin): make each agent's monthly email limit editable from All Agents"
```
