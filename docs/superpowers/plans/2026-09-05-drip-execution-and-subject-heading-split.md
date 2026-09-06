# Drip Execution Engine + Subject/Heading Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Campaign DRIP sequences and "Schedule for Later" EMAIL campaigns actually send, via a new per-recipient delivery table and hourly cron; then let `Campaign`, `ActionPlanStep`, and `DripStep` each carry an optional heading that's separate from the literal email subject line.

**Architecture:** Phase 1 (Tasks 1–6) builds a `CampaignDelivery` table + hourly cron that materializes and executes scheduled/drip sends, fully independent of and testable without any heading changes — it reuses `subject` for both roles, exactly matching today's behavior, so it stands on its own. Phase 2 (Tasks 7–14) adds the optional `heading` column to all three models, extracts a shared render helper (retrofitting Phase 1's cron and the existing immediate-send route to use it), and adds the UI inputs. This ordering matches the explicit build order requested: finish DRIP execution first, then apply the heading fix everywhere.

**Tech Stack:** Next.js 14 App Router, Prisma 5 / PostgreSQL (Neon), Vitest, Postmark (via the existing `lib/email/send.ts` seam), Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-09-05-drip-execution-and-subject-heading-split-design.md`

## Global Constraints

- TDD every task: write the failing test first, watch it fail, then implement.
- Every new/modified route follows this codebase's existing two-query ownership
  pattern exactly: a light `findUnique` (just `id`/`agentId`/whatever's needed for
  the check) → `checkOwnership()` → early 404/403 return → *then* the real fetch or
  mutation. See `apps/web/src/app/api/campaigns/[id]/route.ts` for the reference
  shape.
- `checkOwnership` and `requireAuth` come from `@/lib/api-auth` — never
  reimplement auth/ownership logic in a new route.
- Mock `@/lib/api-auth`'s `requireAuth` directly in new route tests (matching
  `apps/web/src/__tests__/api/campaigns-send.test.ts`'s style) — do not mock
  `next-auth` directly for these.
- No React-component-render tests exist in this project and none are added by
  this plan — UI tasks are verified live in the browser (`pnpm --filter web dev`),
  per this project's established convention.
- After any Prisma schema change, run `pnpm --filter @cnc/database exec prisma
  generate` before touching application code that references the new
  model/fields — on Windows, the dev server must be stopped first, or the
  generate step fails with EPERM on `query_engine-windows.dll.node` (a
  documented, recurring issue in this project). Kill node processes, generate,
  then restart the dev server.
- Run `pnpm --filter web exec vitest run` (full suite) and `pnpm --filter web
  exec tsc --noEmit` (clearing `apps/web/.next/types` first if stale) at the end
  of every task, not just the new test file.

---

## Phase 1 — Drip Execution Engine

### Task 1: Schema — `CampaignDelivery` model + `DeliveryStatus` enum

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: a new migration under `packages/database/prisma/migrations/` (auto-named by Prisma)

**Interfaces:**
- Produces: `DeliveryStatus` enum (`PENDING | SENT | SKIPPED | ERROR`), `CampaignDelivery` model with fields `id, campaignContactId, dripStepId, dueAt, status, executedAt, createdAt` and relations `campaignContact`, `dripStep`. `CampaignContact.deliveries` and `DripStep.deliveries` back-relations.

This task has no test of its own — schema changes are verified by the next task's tests compiling and passing against the generated client.

- [ ] **Step 1: Add the enum and model to `schema.prisma`**

Find the `model DripStep { ... }` block (currently ends around line 724, right
before `// ─── Action Plan models ─────`) and insert the new enum + model
immediately after it:

```prisma
enum DeliveryStatus {
  PENDING
  SENT
  SKIPPED
  ERROR
}

model CampaignDelivery {
  id                String         @id @default(cuid())
  campaignContactId String
  dripStepId        String?
  dueAt             DateTime
  status            DeliveryStatus @default(PENDING)
  executedAt        DateTime?
  createdAt         DateTime       @default(now())

  campaignContact CampaignContact @relation(fields: [campaignContactId], references: [id], onDelete: Cascade)
  dripStep        DripStep?       @relation(fields: [dripStepId], references: [id], onDelete: Cascade)

  @@index([status, dueAt])
}
```

- [ ] **Step 2: Add the back-relations**

In `model CampaignContact { ... }`, add one line inside the model body (after
the existing `lead` relation line):

```prisma
  deliveries CampaignDelivery[]
```

In `model DripStep { ... }`, add one line inside the model body (after the
existing `campaign` relation line):

```prisma
  deliveries CampaignDelivery[]
```

- [ ] **Step 3: Stop the dev server, then generate + migrate**

```bash
# In PowerShell, stop any running dev server first (Windows EPERM issue — see Global Constraints)
pnpm --filter @cnc/database exec prisma migrate dev --name add_campaign_delivery
```

Expected: Prisma reports the migration applied and regenerates the client with
no errors. A new folder appears under
`packages/database/prisma/migrations/<timestamp>_add_campaign_delivery/`.

- [ ] **Step 4: Restart the dev server and confirm the app still boots**

```bash
pnpm --filter web dev
```

Visit `http://localhost:3000/dashboard/campaigns` and confirm the existing
campaigns list still loads with no server error — this schema change is
additive only, so nothing here should behave differently yet.

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat(db): add CampaignDelivery model for scheduled/drip sends"
```

---

### Task 2: `POST /api/campaigns/[id]/schedule`

**Files:**
- Create: `apps/web/src/app/api/campaigns/[id]/schedule/route.ts`
- Test: `apps/web/src/__tests__/api/campaigns-schedule.test.ts`

**Interfaces:**
- Consumes: `requireAuth("AGENT")`, `checkOwnership` from `@/lib/api-auth`
  (signatures unchanged, see `apps/web/src/lib/api-auth.ts`). `prisma.campaign`,
  `prisma.campaignDelivery` from `@/lib/prisma`.
- Produces: `POST /api/campaigns/[id]/schedule` accepting `{ sendNow: boolean,
  scheduledAt?: string }` (ISO datetime), used by Task 5 (wizard rewire).
  Success: `200 { ok: true }`. Failure: `400` with a specific `{ error: string
  }` message for each validation case, `403`/`404` from ownership.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/src/__tests__/api/campaigns-schedule.test.ts

vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: { findUnique: vi.fn(), update: vi.fn() },
    campaignDelivery: { createMany: vi.fn() },
  },
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/campaigns/[id]/schedule/route";

const AGENT_SESSION = {
  session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
  error: null,
} as any;

function request(body: object) {
  return new Request("http://localhost/api/campaigns/c1/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function draftCampaign(overrides: object = {}) {
  return {
    id: "c1",
    agentId: "a1",
    status: "DRAFT",
    type: "EMAIL",
    contacts: [{ id: "cc1" }],
    steps: [],
    ...overrides,
  };
}

describe("POST /api/campaigns/[id]/schedule — ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
    vi.mocked(prisma.campaignDelivery.createMany).mockResolvedValue({ count: 1 } as any);
  });

  it("returns 403 when the campaign belongs to a different agent", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u2", email: "b@cnc.com", role: "AGENT", agentId: "a2" } },
      error: null,
    } as any);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(draftCampaign() as any);

    const res = await POST(request({ sendNow: true }), { params: { id: "c1" } });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the campaign does not exist", async () => {
    vi.mocked(requireAuth).mockResolvedValue(AGENT_SESSION);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(null);

    const res = await POST(request({ sendNow: true }), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/campaigns/[id]/schedule — validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(AGENT_SESSION);
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
    vi.mocked(prisma.campaignDelivery.createMany).mockResolvedValue({ count: 1 } as any);
  });

  it("returns 400 when the campaign has no contacts", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(draftCampaign({ contacts: [] }) as any);

    const res = await POST(request({ sendNow: true }), { params: { id: "c1" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/contacts/i);
    expect(prisma.campaignDelivery.createMany).not.toHaveBeenCalled();
  });

  it("returns 400 when a DRIP campaign has no steps", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(draftCampaign({ type: "DRIP", steps: [] }) as any);

    const res = await POST(request({ sendNow: true }), { params: { id: "c1" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/steps/i);
    expect(prisma.campaignDelivery.createMany).not.toHaveBeenCalled();
  });

  it("returns 400 when scheduling for later without a scheduledAt", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(draftCampaign() as any);

    const res = await POST(request({ sendNow: false }), { params: { id: "c1" } });
    expect(res.status).toBe(400);
    expect(prisma.campaignDelivery.createMany).not.toHaveBeenCalled();
  });

  it("returns 400 when scheduledAt is in the past", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(draftCampaign() as any);

    const res = await POST(
      request({ sendNow: false, scheduledAt: "2020-01-01T00:00:00.000Z" }),
      { params: { id: "c1" } }
    );
    expect(res.status).toBe(400);
    expect(prisma.campaignDelivery.createMany).not.toHaveBeenCalled();
  });

  it("returns 400 when the campaign is not DRAFT — the idempotency guard", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(draftCampaign({ status: "SCHEDULED" }) as any);

    const res = await POST(request({ sendNow: true }), { params: { id: "c1" } });
    expect(res.status).toBe(400);
    expect(prisma.campaignDelivery.createMany).not.toHaveBeenCalled();
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/campaigns/[id]/schedule — materialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(AGENT_SESSION);
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
    vi.mocked(prisma.campaignDelivery.createMany).mockResolvedValue({ count: 1 } as any);
  });

  it("creates one delivery per contact for a plain EMAIL campaign, due at scheduledAt", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(
      draftCampaign({ contacts: [{ id: "cc1" }, { id: "cc2" }] }) as any
    );

    const res = await POST(
      request({ sendNow: false, scheduledAt: "2030-01-01T09:00:00.000Z" }),
      { params: { id: "c1" } }
    );
    expect(res.status).toBe(200);

    const rows = vi.mocked(prisma.campaignDelivery.createMany).mock.calls[0][0].data as any[];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.dripStepId).toBeNull();
      expect(row.dueAt).toEqual(new Date("2030-01-01T09:00:00.000Z"));
    }

    expect(prisma.campaign.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "SCHEDULED" },
    });
  });

  it("sets status ACTIVE and sentAt when sendNow is true for a plain EMAIL campaign", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(draftCampaign() as any);
    const before = Date.now();

    await POST(request({ sendNow: true }), { params: { id: "c1" } });

    const call = vi.mocked(prisma.campaign.update).mock.calls[0][0] as any;
    expect(call.data.status).toBe("ACTIVE");
    expect(call.data.sentAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("computes cumulative dueAt for each DRIP step, not relative to sendNow directly", async () => {
    const startedAt = new Date("2030-06-01T00:00:00.000Z");
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(
      draftCampaign({
        type: "DRIP",
        contacts: [{ id: "cc1" }],
        steps: [
          { id: "step1", stepOrder: 1, delayDays: 0 },
          { id: "step2", stepOrder: 2, delayDays: 3 },
          { id: "step3", stepOrder: 3, delayDays: 3 },
        ],
      }) as any
    );

    await POST(
      request({ sendNow: false, scheduledAt: startedAt.toISOString() }),
      { params: { id: "c1" } }
    );

    const rows = vi.mocked(prisma.campaignDelivery.createMany).mock.calls[0][0].data as any[];
    expect(rows).toHaveLength(3);
    const byStep = Object.fromEntries(rows.map((r) => [r.dripStepId, r.dueAt]));
    expect(byStep["step1"]).toEqual(new Date("2030-06-01T00:00:00.000Z"));
    expect(byStep["step2"]).toEqual(new Date("2030-06-04T00:00:00.000Z")); // +3 days from step1
    expect(byStep["step3"]).toEqual(new Date("2030-06-07T00:00:00.000Z")); // +3 more days from step2, not from start
  });

  it("creates one delivery per (contact × step) for a DRIP campaign with multiple contacts", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(
      draftCampaign({
        type: "DRIP",
        contacts: [{ id: "cc1" }, { id: "cc2" }],
        steps: [
          { id: "step1", stepOrder: 1, delayDays: 0 },
          { id: "step2", stepOrder: 2, delayDays: 3 },
        ],
      }) as any
    );

    await POST(request({ sendNow: true }), { params: { id: "c1" } });

    const rows = vi.mocked(prisma.campaignDelivery.createMany).mock.calls[0][0].data as any[];
    expect(rows).toHaveLength(4); // 2 contacts × 2 steps
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter web exec vitest run src/__tests__/api/campaigns-schedule.test.ts
```

Expected: FAIL — the route module doesn't exist yet.

- [ ] **Step 3: Implement the route**

```typescript
// apps/web/src/app/api/campaigns/[id]/schedule/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, checkOwnership } from "@/lib/api-auth";

const scheduleSchema = z.object({
  sendNow: z.boolean(),
  scheduledAt: z.string().datetime().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const existing = await prisma.campaign.findUnique({
    where: { id: params.id },
    select: { id: true, agentId: true },
  });
  const { exists, forbidden } = checkOwnership(existing, session.user.agentId, session.user.role);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let data: z.infer<typeof scheduleSchema>;
  try {
    data = scheduleSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      contacts: { select: { id: true } },
      steps: { orderBy: { stepOrder: "asc" }, select: { id: true, delayDays: true } },
    },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotency guard: this endpoint only ever runs once per campaign. A
  // second call (double-submit, network retry) cannot re-materialize
  // duplicate deliveries, because the first successful call always advances
  // status past DRAFT before a second one could run.
  if (campaign.status !== "DRAFT") {
    return NextResponse.json({ error: "Campaign has already been scheduled" }, { status: 400 });
  }

  if (campaign.contacts.length === 0) {
    return NextResponse.json({ error: "Campaign has no contacts" }, { status: 400 });
  }
  if (campaign.type === "DRIP" && campaign.steps.length === 0) {
    return NextResponse.json({ error: "DRIP campaign has no steps" }, { status: 400 });
  }

  let startTime: Date;
  if (data.sendNow) {
    startTime = new Date();
  } else {
    if (!data.scheduledAt) {
      return NextResponse.json({ error: "scheduledAt is required when sendNow is false" }, { status: 400 });
    }
    startTime = new Date(data.scheduledAt);
    if (startTime.getTime() <= Date.now()) {
      return NextResponse.json({ error: "scheduledAt must be in the future" }, { status: 400 });
    }
  }

  const rows: { campaignContactId: string; dripStepId: string | null; dueAt: Date }[] = [];

  if (campaign.type === "DRIP") {
    // Cumulative from the previous step, not from startTime directly — see
    // the design spec's "Resolved ambiguity" section. Computed once per step
    // order, then crossed with every contact.
    let runningDueAt = startTime;
    const stepDueAts: { id: string; dueAt: Date }[] = [];
    for (const step of campaign.steps) {
      runningDueAt = new Date(runningDueAt.getTime() + step.delayDays * 24 * 60 * 60 * 1000);
      stepDueAts.push({ id: step.id, dueAt: runningDueAt });
    }
    for (const contact of campaign.contacts) {
      for (const step of stepDueAts) {
        rows.push({ campaignContactId: contact.id, dripStepId: step.id, dueAt: step.dueAt });
      }
    }
  } else {
    for (const contact of campaign.contacts) {
      rows.push({ campaignContactId: contact.id, dripStepId: null, dueAt: startTime });
    }
  }

  await prisma.campaignDelivery.createMany({ data: rows });

  await prisma.campaign.update({
    where: { id: params.id },
    data: data.sendNow
      ? { status: "ACTIVE", sentAt: startTime }
      : { status: "SCHEDULED" },
  });

  return NextResponse.json({ ok: true });
}
```

Note on the cumulative-`dueAt` test above: with `delayDays: [0, 3, 3]` starting
at `2030-06-01`, step 1's `runningDueAt` becomes `startTime + 0 days =
2030-06-01`, step 2's becomes `2030-06-01 + 3 days = 2030-06-04`, step 3's
becomes `2030-06-04 + 3 days = 2030-06-07` — cumulative, matching the test's
expectations exactly.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter web exec vitest run src/__tests__/api/campaigns-schedule.test.ts
```

Expected: PASS, all cases.

- [ ] **Step 5: Full suite + typecheck**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
```

Expected: no regressions, no new type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/campaigns/[id]/schedule apps/web/src/__tests__/api/campaigns-schedule.test.ts
git commit -m "feat(campaigns): add /schedule endpoint to materialize deliveries"
```

---

### Task 3: `POST /api/campaigns/[id]/start-now`

**Files:**
- Create: `apps/web/src/app/api/campaigns/[id]/start-now/route.ts`
- Test: `apps/web/src/__tests__/api/campaigns-start-now.test.ts`

**Interfaces:**
- Consumes: same auth/ownership pattern as Task 2. `prisma.campaignDelivery.findMany`/`.update`, `prisma.campaign.findUnique`/`.update`.
- Produces: `POST /api/campaigns/[id]/start-now`, no body, used by Task 6 (detail page "Start Now" button). Success: `200 { ok: true }`.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/src/__tests__/api/campaigns-start-now.test.ts

vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: { findUnique: vi.fn(), update: vi.fn() },
    campaignDelivery: { findMany: vi.fn(), update: vi.fn() },
  },
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/campaigns/[id]/start-now/route";

const AGENT_SESSION = {
  session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
  error: null,
} as any;

function request() {
  return new Request("http://localhost/api/campaigns/c1/start-now", { method: "POST" });
}

describe("POST /api/campaigns/[id]/start-now", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(AGENT_SESSION);
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);
    vi.mocked(prisma.campaignDelivery.update).mockResolvedValue({} as any);
  });

  it("returns 403 when the campaign belongs to a different agent", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u2", email: "b@cnc.com", role: "AGENT", agentId: "a2" } },
      error: null,
    } as any);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a1", status: "SCHEDULED" } as any);

    const res = await POST(request(), { params: { id: "c1" } });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the campaign does not exist", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(null);

    const res = await POST(request(), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });

  it("returns 400 when the campaign is not SCHEDULED", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a1", status: "ACTIVE" } as any);

    const res = await POST(request(), { params: { id: "c1" } });
    expect(res.status).toBe(400);
    expect(prisma.campaignDelivery.findMany).not.toHaveBeenCalled();
  });

  it("shifts every PENDING delivery by the same delta, preserving relative spacing", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a1", status: "SCHEDULED" } as any);
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([
      { id: "d1", dueAt: new Date("2030-01-10T00:00:00.000Z") },
      { id: "d2", dueAt: new Date("2030-01-13T00:00:00.000Z") }, // 3 days after d1
    ] as any);

    const before = Date.now();
    const res = await POST(request(), { params: { id: "c1" } });
    expect(res.status).toBe(200);

    const calls = vi.mocked(prisma.campaignDelivery.update).mock.calls;
    expect(calls).toHaveLength(2);
    const d1Call = calls.find((c) => (c[0] as any).where.id === "d1")![0] as any;
    const d2Call = calls.find((c) => (c[0] as any).where.id === "d2")![0] as any;

    // d1 (the earliest) becomes due essentially immediately.
    expect(d1Call.data.dueAt.getTime()).toBeGreaterThanOrEqual(before);
    // d2 keeps its original 3-day gap relative to d1's new time.
    const gapMs = d2Call.data.dueAt.getTime() - d1Call.data.dueAt.getTime();
    expect(gapMs).toBe(3 * 24 * 60 * 60 * 1000);

    expect(prisma.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1" }, data: expect.objectContaining({ status: "ACTIVE" }) })
    );
  });

  it("leaves already-terminal deliveries alone", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a1", status: "SCHEDULED" } as any);
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([
      { id: "d1", dueAt: new Date("2030-01-10T00:00:00.000Z") },
    ] as any);

    await POST(request(), { params: { id: "c1" } });

    // The query itself only ever asks for PENDING rows — proven by asserting
    // the where clause, since the mock always returns exactly what's given.
    const query = vi.mocked(prisma.campaignDelivery.findMany).mock.calls[0][0] as any;
    expect(query.where.status).toBe("PENDING");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter web exec vitest run src/__tests__/api/campaigns-start-now.test.ts
```

Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Implement the route**

```typescript
// apps/web/src/app/api/campaigns/[id]/start-now/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, checkOwnership } from "@/lib/api-auth";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    select: { id: true, agentId: true, status: true },
  });
  const { exists, forbidden } = checkOwnership(campaign, session.user.agentId, session.user.role);
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (campaign!.status !== "SCHEDULED") {
    return NextResponse.json({ error: "Only a scheduled campaign can be started early" }, { status: 400 });
  }

  const pending = await prisma.campaignDelivery.findMany({
    where: { status: "PENDING", campaignContact: { campaignId: params.id } },
    select: { id: true, dueAt: true },
  });

  if (pending.length > 0) {
    const earliestDueAt = Math.min(...pending.map((d) => d.dueAt.getTime()));
    const delta = Date.now() - earliestDueAt;

    await Promise.all(
      pending.map((d) =>
        prisma.campaignDelivery.update({
          where: { id: d.id },
          data: { dueAt: new Date(d.dueAt.getTime() + delta) },
        })
      )
    );
  }

  await prisma.campaign.update({
    where: { id: params.id },
    data: { status: "ACTIVE", sentAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter web exec vitest run src/__tests__/api/campaigns-start-now.test.ts
```

Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/campaigns/[id]/start-now apps/web/src/__tests__/api/campaigns-start-now.test.ts
git commit -m "feat(campaigns): add /start-now endpoint to kick off a scheduled campaign early"
```

---

### Task 4: Hourly cron — `POST /api/cron/campaign-deliveries`

**Files:**
- Create: `apps/web/src/app/api/cron/campaign-deliveries/route.ts`
- Modify: `apps/web/src/lib/action-plan-email.ts` (export `paragraph`, unchanged behavior)
- Modify: `vercel.json`
- Test: `apps/web/src/__tests__/api/cron-campaign-deliveries.test.ts`

**Interfaces:**
- Consumes: `ensureQuotaReset`, `tryConsumeEmailQuota` from `@/lib/email-quota`
  (unchanged). `sendEmail` from `@/lib/email/send`. `emailLayout`, `escapeHtml`
  from `@/lib/email`. `unsubscribeFooterHtml` from `@/lib/email/unsubscribe`.
  `paragraph` (newly exported) from `@/lib/action-plan-email`.
- Produces: `POST /api/cron/campaign-deliveries`, auth via `Bearer
  ${CRON_SECRET}` header, response `{ processed, skippedLimit, errors }`.

This task deliberately duplicates the 33px-heading markup block that already
lives in `apps/web/src/app/api/campaigns/[id]/send/route.ts` — Task 9 extracts
both into a shared helper. Building it this way keeps Phase 1 fully
self-contained and correct on its own (a scheduled EMAIL must look identical
to an immediately-sent one) without pulling Phase 2's heading work forward.

- [ ] **Step 1: Export `paragraph` from `lib/action-plan-email.ts`**

In `apps/web/src/lib/action-plan-email.ts`, change:

```typescript
function paragraph(body: string): string {
```

to:

```typescript
export function paragraph(body: string): string {
```

No other change to this file in this task — this is a pure visibility change,
zero behavior difference. Run the existing action-plan-email tests to confirm:

```bash
pnpm --filter web exec vitest run src/__tests__/lib/action-plan-email.test.ts
```

Expected: PASS, unchanged.

- [ ] **Step 2: Write the failing cron tests**

```typescript
// apps/web/src/__tests__/api/cron-campaign-deliveries.test.ts

process.env.NEXTAUTH_SECRET = "test-secret";
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue({ sent: true }) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaignDelivery: { findMany: vi.fn(), update: vi.fn() },
    campaignContact: { updateMany: vi.fn() },
    campaign: { updateMany: vi.fn(), findMany: vi.fn() },
    agent: { updateMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { POST } from "../../app/api/cron/campaign-deliveries/route";

const CRON_SECRET = "test-secret";
process.env.CRON_SECRET = CRON_SECRET;

function makeReq(auth?: string) {
  return new NextRequest("http://localhost/api/cron/campaign-deliveries", {
    method: "POST",
    headers: auth ? { authorization: `Bearer ${auth}` } : {},
  });
}

const AGENT = { id: "a1", monthlyEmailLimit: 200 };
const LEAD = { id: "lead1", email: "lead@example.com" };

function plainEmailDelivery(overrides: object = {}) {
  return {
    id: "d1",
    dripStepId: null,
    dueAt: new Date(),
    status: "PENDING",
    campaignContact: {
      id: "cc1",
      lead: LEAD,
      campaign: { id: "c1", agentId: "a1", agent: AGENT, subject: "Hello", body: "<p>Hi there</p>" },
    },
    dripStep: null,
    ...overrides,
  };
}

function dripStepDelivery(overrides: object = {}) {
  return {
    id: "d2",
    dripStepId: "step1",
    dueAt: new Date(),
    status: "PENDING",
    campaignContact: {
      id: "cc2",
      lead: LEAD,
      campaign: { id: "c2", agentId: "a1", agent: AGENT, subject: null, body: null },
    },
    dripStep: { id: "step1", subject: "Step subject", body: "Plain\ntext body" },
    ...overrides,
  };
}

describe("POST /api/cron/campaign-deliveries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.agent.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.campaignDelivery.update).mockResolvedValue({} as any);
    vi.mocked(prisma.campaignContact.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.campaign.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);
  });

  it("returns 401 without auth", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it("sends a plain scheduled email using the campaign's own subject/body", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("lead@example.com");
    expect(call.subject).toBe("Hello");
    expect(call.stream).toBe("broadcast");
    expect(call.category).toBe("campaign");
    expect(call.html).toContain("Hi there");
    expect(prisma.campaignDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d1" }, data: expect.objectContaining({ status: "SENT" }) })
    );
  });

  it("sends a drip step email using the step's own subject/body, escaped and br'd", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([dripStepDelivery()] as any);

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.subject).toBe("Step subject");
    expect(call.html).toContain("Plain<br>text body");
  });

  it("leaves a delivery PENDING and reports skippedLimit when quota is exhausted", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);
    vi.mocked(prisma.agent.updateMany)
      .mockResolvedValueOnce({ count: 0 } as any) // ensureQuotaReset
      .mockResolvedValueOnce({ count: 0 } as any); // tryConsumeEmailQuota: at limit

    const res = await POST(makeReq(CRON_SECRET));
    const body = await res.json();

    expect(body.skippedLimit).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.campaignDelivery.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d1" } })
    );
  });

  it("marks a delivery SKIPPED and refunds quota when the send is suppressed", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);
    vi.mocked(sendEmail).mockResolvedValueOnce({ sent: false, reason: "opted_out" });
    vi.mocked(prisma.agent.updateMany)
      .mockResolvedValueOnce({ count: 0 } as any) // ensureQuotaReset
      .mockResolvedValueOnce({ count: 1 } as any) // tryConsumeEmailQuota: consumed
      .mockResolvedValueOnce({ count: 1 } as any); // refund

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);

    expect(prisma.campaignDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d1" }, data: expect.objectContaining({ status: "SKIPPED" }) })
    );
    expect(prisma.agent.updateMany).toHaveBeenCalledWith({
      where: { id: "a1", monthlyEmailsSent: { gt: 0 } },
      data: { monthlyEmailsSent: { decrement: 1 } },
    });
  });

  it("isolates a failing delivery so others still process", async () => {
    const failing = plainEmailDelivery({ id: "d-fail" });
    const ok = dripStepDelivery();
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([failing, ok] as any);
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("postmark down"));

    const res = await POST(makeReq(CRON_SECRET));
    const body = await res.json();

    expect(body.errors).toBe(1);
    expect(body.processed).toBe(1);
    expect(prisma.campaignDelivery.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d-fail" } })
    );
    expect(prisma.campaignDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d2" }, data: expect.objectContaining({ status: "SENT" }) })
    );
  });

  it("flips a contact's status to SENT once all its deliveries are terminal", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);
    // No other PENDING deliveries remain for this contact.
    vi.mocked(prisma.campaignContact.updateMany).mockResolvedValue({ count: 1 } as any);

    await POST(makeReq(CRON_SECRET));

    expect(prisma.campaignContact.updateMany).toHaveBeenCalledWith({
      where: { id: "cc1", deliveries: { none: { status: "PENDING" } } },
      data: { status: "SENT" },
    });
  });

  it("flips a SCHEDULED campaign to ACTIVE with sentAt on its first successful send", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);

    await POST(makeReq(CRON_SECRET));

    expect(prisma.campaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1", status: "SCHEDULED" },
        data: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });

  it("flips a campaign to COMPLETED once every delivery for it is terminal", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);

    await POST(makeReq(CRON_SECRET));

    expect(prisma.campaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1", deliveries: undefined }, // see implementation note below — replaced with the real relational filter
      })
    );
  });
});
```

Note on the last test above: it is intentionally a weak placeholder shape to
start from. When implementing Step 3, write the campaign-completion query
first, then come back and tighten this assertion to match the exact `where`
clause the implementation actually uses (it will filter campaigns whose
deliveries — reached via the `CampaignContact` join — have none left
`PENDING`). Do not leave the weak assertion in place after Step 4 passes;
replace `deliveries: undefined` with the real clause your implementation uses
once you know it, and rerun.

- [ ] **Step 3: Implement the cron route**

```typescript
// apps/web/src/app/api/cron/campaign-deliveries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailLayout, escapeHtml } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";
import { unsubscribeFooterHtml } from "@/lib/email/unsubscribe";
import { ensureQuotaReset, tryConsumeEmailQuota } from "@/lib/email-quota";
import { paragraph } from "@/lib/action-plan-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Duplicated from campaigns/[id]/send/route.ts deliberately — Task 9 extracts
// both into one shared helper once the heading field exists. Kept identical
// to that route's markup so a scheduled/drip email looks the same as an
// immediately-sent one.
function buildBodyHtml(heading: string, innerHtml: string): string {
  return `
    <h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 24px; text-align: center;">
      ${heading}
    </h2>
    <style>
      #campaign-content p { margin: 0 0 20px; }
      #campaign-content p:last-child { margin-bottom: 0; }
    </style>
    <div id="campaign-content" style="color: #4b4b4b; font-size: 22.5px; line-height: 1.6; text-align: left;">
      ${innerHtml}
    </div>
  `;
}

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const dueDeliveries = await prisma.campaignDelivery.findMany({
    where: { status: "PENDING", dueAt: { lte: now } },
    include: {
      campaignContact: {
        include: {
          lead: { select: { id: true, email: true } },
          campaign: {
            select: {
              id: true,
              agentId: true,
              subject: true,
              body: true,
              agent: { select: { monthlyEmailLimit: true } },
            },
          },
        },
      },
      dripStep: { select: { id: true, subject: true, body: true } },
    },
    orderBy: { dueAt: "asc" },
  });

  const agentIds = Array.from(
    new Set(dueDeliveries.map((d) => d.campaignContact.campaign.agentId).filter((id): id is string => !!id))
  );
  await Promise.all(agentIds.map((id) => ensureQuotaReset(id, now)));

  const results = await Promise.all(
    dueDeliveries.map(async (delivery): Promise<"processed" | "error" | "skipped-limit"> => {
      try {
        const { campaignContact, dripStep } = delivery;
        const { lead, campaign } = campaignContact;
        if (!campaign.agentId || !campaign.agent) {
          await prisma.campaignDelivery.update({ where: { id: delivery.id }, data: { status: "ERROR", executedAt: now } });
          return "error";
        }

        const quotaAvailable = await tryConsumeEmailQuota(campaign.agentId, campaign.agent.monthlyEmailLimit);
        if (!quotaAvailable) {
          return "skipped-limit";
        }

        const subject = dripStep ? dripStep.subject : campaign.subject ?? "";
        const innerHtml = dripStep
          ? paragraph(dripStep.body ?? "")
          : campaign.body ?? "";
        const html = emailLayout({
          heading: "",
          bodyHtml:
            buildBodyHtml(escapeHtml(subject), innerHtml) +
            unsubscribeFooterHtml("lead", lead.id, "campaign"),
        });

        const result = await sendEmail({
          to: lead.email,
          subject,
          html,
          stream: "broadcast",
          recipient: { kind: "lead", id: lead.id },
          category: "campaign",
        });

        if (!result.sent) {
          // Quota was already consumed above; refund it since the message
          // never actually went out. Mirrors cron/action-plans/route.ts.
          await prisma.agent.updateMany({
            where: { id: campaign.agentId, monthlyEmailsSent: { gt: 0 } },
            data: { monthlyEmailsSent: { decrement: 1 } },
          });
          await prisma.campaignDelivery.update({
            where: { id: delivery.id },
            data: { status: "SKIPPED", executedAt: now },
          });
          return "processed";
        }

        await prisma.campaignDelivery.update({
          where: { id: delivery.id },
          data: { status: "SENT", executedAt: now },
        });
        return "processed";
      } catch (e) {
        console.error(`[campaign-deliveries-cron] delivery ${delivery.id} failed:`, e);
        await prisma.campaignDelivery
          .update({ where: { id: delivery.id }, data: { status: "ERROR", executedAt: now } })
          .catch(() => {});
        return "error";
      }
    })
  );

  let processed = 0;
  let errors = 0;
  let skippedLimit = 0;
  for (const r of results) {
    if (r === "processed") processed++;
    else if (r === "error") errors++;
    else skippedLimit++;
  }

  // Status rollup — run for every distinct contact/campaign touched this run,
  // regardless of outcome, since a delivery that errored still needs its
  // contact/campaign re-evaluated.
  const contactIds = Array.from(new Set(dueDeliveries.map((d) => d.campaignContact.id)));
  await Promise.all(
    contactIds.map((id) =>
      prisma.campaignContact.updateMany({
        where: { id, deliveries: { none: { status: "PENDING" } } },
        data: { status: "SENT" },
      })
    )
  );

  const campaignIds = Array.from(
    new Set(dueDeliveries.map((d) => d.campaignContact.campaign.id))
  );
  // SCHEDULED → ACTIVE the moment a campaign's first delivery actually sends.
  await Promise.all(
    campaignIds.map((id) =>
      prisma.campaign.updateMany({
        where: { id, status: "SCHEDULED" },
        data: { status: "ACTIVE", sentAt: now },
      })
    )
  );
  // ACTIVE → COMPLETED once every delivery across every one of a campaign's
  // contacts is terminal.
  await Promise.all(
    campaignIds.map((id) =>
      prisma.campaign.updateMany({
        where: {
          id,
          status: "ACTIVE",
          contacts: { every: { deliveries: { none: { status: "PENDING" } } } },
        },
        data: { status: "COMPLETED" },
      })
    )
  );

  return NextResponse.json({ processed, skippedLimit, errors });
}
```

Now go back to the test file from Step 2 and replace the placeholder
`COMPLETED` test's assertion with the real clause the implementation above
uses:

```typescript
  it("flips a campaign to COMPLETED once every delivery for it is terminal", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([plainEmailDelivery()] as any);

    await POST(makeReq(CRON_SECRET));

    expect(prisma.campaign.updateMany).toHaveBeenCalledWith({
      where: {
        id: "c1",
        status: "ACTIVE",
        contacts: { every: { deliveries: { none: { status: "PENDING" } } } },
      },
      data: { status: "COMPLETED" },
    });
  });
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter web exec vitest run src/__tests__/api/cron-campaign-deliveries.test.ts
```

Expected: PASS, all cases including the corrected COMPLETED assertion.

- [ ] **Step 5: Add the cron to `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/idx/sync?type=delta", "schedule": "*/15 * * * *" },
    { "path": "/api/property-alerts/run", "schedule": "0 9 * * *" },
    { "path": "/api/cron/deadline-reminders", "schedule": "0 16 * * *" },
    { "path": "/api/cron/action-plans", "schedule": "0 8 * * *" },
    { "path": "/api/cron/listing-expiration-warnings", "schedule": "0 17 * * *" },
    { "path": "/api/cron/campaign-deliveries", "schedule": "0 * * * *" }
  ]
}
```

- [ ] **Step 6: Full suite + typecheck**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/cron/campaign-deliveries apps/web/src/lib/action-plan-email.ts apps/web/src/__tests__/api/cron-campaign-deliveries.test.ts vercel.json
git commit -m "feat(campaigns): hourly cron executes scheduled and drip deliveries"
```

---

### Task 5: Wizard — rewire `handleFinish` to use `/schedule`

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/campaigns/new/page.tsx`

**Interfaces:**
- Consumes: `POST /api/campaigns/[id]/schedule` (Task 2).

No new automated test — this is a client component change verified live, per
this project's convention (no React-component-render tests exist).

- [ ] **Step 1: Replace the ad-hoc branching in `handleFinish`**

Find this block (currently lines 77–88):

```typescript
      if (!sendNow && scheduledAt) {
        await fetch(`/api/campaigns/${campaign.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduledAt: new Date(scheduledAt).toISOString(),
            status: "SCHEDULED",
          }),
        });
      } else if (sendNow && type === "EMAIL") {
        await fetch(`/api/campaigns/${campaign.id}/send`, { method: "POST" });
      }
```

Replace it with:

```typescript
      if (sendNow && type === "EMAIL") {
        // Unchanged, still the synchronous immediate-send path.
        await fetch(`/api/campaigns/${campaign.id}/send`, { method: "POST" });
      } else {
        // Covers a scheduled one-off EMAIL and every DRIP campaign
        // (sendNow or scheduled) — both now go through the delivery engine.
        await fetch(`/api/campaigns/${campaign.id}/schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sendNow,
            scheduledAt: !sendNow && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          }),
        });
      }
```

- [ ] **Step 2: Live-verify all four combinations**

With `pnpm --filter web dev` running, go through the wizard at
`/dashboard/campaigns/new` four times:

1. Type EMAIL, Send Now → confirm it still sends immediately (unchanged
   behavior) and the campaign lands on `/dashboard/campaigns` with status
   `Active`.
2. Type EMAIL, Schedule for Later (pick a time a few minutes out) → confirm
   the campaign shows status `Scheduled`, and after that time passes and the
   cron endpoint is manually triggered (see Task 4's route — call it directly
   with the correct `Authorization: Bearer $CRON_SECRET` header via `curl` for
   this manual check), the campaign flips to `Active` and the recipient
   receives the email.
3. Type DRIP, Start Now (2+ steps, short delays) → confirm status becomes
   `Active` immediately, step 1's delivery is due right away, and triggering
   the cron sends it.
4. Type DRIP, Schedule for Later → confirm status becomes `Scheduled`, and
   after the scheduled time and a cron trigger, it flips to `Active` and step
   1 sends.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/campaigns/new/page.tsx"
git commit -m "fix(campaigns): wizard routes scheduled/DRIP campaigns through the delivery engine"
```

---

### Task 6: Campaign detail page — bug fix, Start Now button, Drip Steps preview

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx`
- Modify: `apps/web/src/app/api/campaigns/[id]/route.ts` (GET needs to include `steps` and delivery counts for DRIP campaigns)
- Test: extend `apps/web/src/__tests__/api/campaigns-send.test.ts`'s sibling coverage is not needed here — the GET route has no existing dedicated test file; add one.

**Interfaces:**
- Consumes: `POST /api/campaigns/[id]/start-now` (Task 3).
- Produces: `Campaign` interface in the detail page gains `steps` (only
  populated for DRIP) with per-step delivery counts.

- [ ] **Step 1: Write a failing test for the GET route's DRIP payload**

Create `apps/web/src/__tests__/api/campaigns-id-get.test.ts`:

```typescript
vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: { findUnique: vi.fn() },
  },
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "../../app/api/campaigns/[id]/route";

describe("GET /api/campaigns/[id] — drip steps in the payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
      error: null,
    } as any);
  });

  it("includes steps with per-step sent/total delivery counts", async () => {
    vi.mocked(prisma.campaign.findUnique)
      .mockResolvedValueOnce({ id: "c1", agentId: "a1" } as any) // ownership check
      .mockResolvedValueOnce({
        id: "c1",
        agentId: "a1",
        type: "DRIP",
        contacts: [],
        _count: { contacts: 2 },
        steps: [
          {
            id: "s1",
            stepOrder: 1,
            delayDays: 0,
            subject: "Step 1",
            body: "Hi",
            _count: { deliveries: 2 },
            deliveries: [{ status: "SENT" }, { status: "PENDING" }],
          },
        ],
      } as any);

    const res = await GET(new Request("http://localhost"), { params: { id: "c1" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.steps).toHaveLength(1);
    expect(data.steps[0].subject).toBe("Step 1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter web exec vitest run src/__tests__/api/campaigns-id-get.test.ts
```

Expected: FAIL — `data.steps` is `undefined` today, since the GET query
doesn't include `steps` at all.

- [ ] **Step 3: Update the GET query in `campaigns/[id]/route.ts`**

Change the `include` block in `GET` (currently just `contacts` + `_count`):

```typescript
  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      contacts: {
        include: {
          lead: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      steps: {
        orderBy: { stepOrder: "asc" },
        include: { deliveries: { select: { status: true } } },
      },
      _count: { select: { contacts: true } },
    },
  });
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter web exec vitest run src/__tests__/api/campaigns-id-get.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update the detail page**

In `apps/web/src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx`:

Add to the `Campaign` interface (after `contacts: ContactRow[];`):

```typescript
  steps: {
    id: string;
    stepOrder: number;
    delayDays: number;
    subject: string;
    heading?: string | null;
    body: string;
    deliveries: { status: string }[];
  }[];
```

Add new state and a handler near `handleSend`:

```typescript
  const [startingNow, setStartingNow] = useState(false);

  const handleStartNow = async () => {
    if (!confirm("Start this campaign now instead of waiting for its scheduled time?")) return;
    setStartingNow(true);
    try {
      await fetch(`/api/campaigns/${id}/start-now`, { method: "POST" });
      const updated = await fetch(`/api/campaigns/${id}`).then((r) => r.json());
      setCampaign(updated);
    } finally {
      setStartingNow(false);
    }
  };
```

Restrict `canSend` to EMAIL only (this is the bug fix):

```typescript
  const canSend =
    campaign.type === "EMAIL" &&
    campaign.status === "DRAFT" &&
    campaign.contacts.some((c) => c.status === "PENDING");
  const canStartNow = campaign.status === "SCHEDULED";
```

Add the "Start Now" button next to the existing "Send Now" button (inside the
header's button row, alongside the `{canSend && (...)}` block):

```tsx
          {canStartNow && (
            <button
              type="button"
              onClick={handleStartNow}
              disabled={startingNow}
              className="rounded-full bg-[#9E8C61] px-4 py-2 font-sans text-sm text-white hover:bg-[#9E8C61]/80 disabled:opacity-40 transition-colors"
            >
              {startingNow ? "Starting…" : "Start Now"}
            </button>
          )}
```

Replace the "Body Preview" block (the `{campaign.body && (...)}` section) with
a type-conditional block — EMAIL keeps the existing preview, DRIP gets the new
steps list:

```tsx
        {campaign.type === "EMAIL" && campaign.body && (
          <div className="mt-5 border-t border-[#1B1B1B]/5 pt-5">
            <p className="mb-3 font-sans text-sm text-[#1B1B1B]/50">Body Preview</p>
            <div
              className="prose prose-sm max-w-none font-sans text-sm text-[#1B1B1B]"
              dangerouslySetInnerHTML={{ __html: campaign.body }}
            />
          </div>
        )}
        {campaign.type === "DRIP" && campaign.steps.length > 0 && (
          <div className="mt-5 border-t border-[#1B1B1B]/5 pt-5">
            <p className="mb-3 font-sans text-sm text-[#1B1B1B]/50">Drip Steps</p>
            <div className="flex flex-col gap-4">
              {campaign.steps.map((step) => {
                const sentCount = step.deliveries.filter((d) => d.status === "SENT").length;
                const totalCount = step.deliveries.length;
                return (
                  <div key={step.id} className="rounded-lg border border-[#1B1B1B]/10 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-sans text-sm font-medium text-[#1B1B1B]">
                        Step {step.stepOrder} — {step.delayDays === 0 ? "immediately" : `${step.delayDays} day(s) after the previous step`}
                      </p>
                      <p className="font-sans text-xs text-[#1B1B1B]/50">
                        {sentCount} of {totalCount} sent
                      </p>
                    </div>
                    <p className="font-sans text-sm text-[#1B1B1B]/80">{step.heading || step.subject}</p>
                    <p className="mt-1 font-sans text-xs text-[#1B1B1B]/50">{step.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
```

- [ ] **Step 6: Live-verify**

With `pnpm --filter web dev` running:
1. Open an EMAIL campaign's detail page — confirm Body Preview still shows,
   "Send Now" button still works as before.
2. Open a DRIP campaign's detail page — confirm the Drip Steps section lists
   each step with delay/heading/body and a sent count, and the old "Send Now"
   button never appears for it.
3. Create a DRIP campaign scheduled for a future time, open its detail page —
   confirm "Start Now" appears, click it, confirm status flips to `Active` and
   a subsequent cron trigger sends step 1.

- [ ] **Step 7: Full suite + typecheck**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx" apps/web/src/app/api/campaigns/[id]/route.ts apps/web/src/__tests__/api/campaigns-id-get.test.ts
git commit -m "fix(campaigns): restrict Send Now to EMAIL, add Start Now + Drip Steps preview"
```

**Phase 1 complete here.** DRIP campaigns and scheduled EMAIL campaigns now
fully execute, independent of anything in Phase 2.

---

## Phase 2 — Subject/Heading Split

### Task 7: Schema — `heading` column on `Campaign`, `ActionPlanStep`, `LeadPlanStep`, `DripStep`

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: a new migration

**Interfaces:**
- Produces: `heading String?` on all four models.

`ActionPlanStep` and `LeadPlanStep` are two separate models —
`ActionPlanStep` is the admin-authored reusable template, `LeadPlanStep` is
the per-enrollment copy actually read by the sending cron
(`cron/action-plans/route.ts` queries `leadPlanStep`, never `actionPlanStep`
directly). Both need their own `heading` column, or the field would exist on
the template and never reach a real send. See Task 12 for the copy-through fix
that carries a template's `heading` into each new enrollment's `LeadPlanStep`
rows.

- [ ] **Step 1: Add the column to each model**

In `model Campaign { ... }`, add after `subject String?`:

```prisma
  heading     String?
```

In `model ActionPlanStep { ... }`, add after `subject   String?`:

```prisma
  heading   String?
```

In `model LeadPlanStep { ... }`, add after `subject      String?`:

```prisma
  heading      String?
```

In `model DripStep { ... }`, add after `subject    String`:

```prisma
  heading    String?
```

- [ ] **Step 2: Stop the dev server, generate + migrate**

```bash
pnpm --filter @cnc/database exec prisma migrate dev --name add_heading_field
```

- [ ] **Step 3: Restart the dev server, confirm the app boots**

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat(db): add optional heading field to Campaign, ActionPlanStep, DripStep"
```

---

### Task 8: Shared render helper in `lib/email.ts`

**Files:**
- Modify: `apps/web/src/lib/email.ts`
- Test: `apps/web/src/__tests__/lib/email.test.ts`

**Interfaces:**
- Produces: `export function buildHeadingBodyHtml(opts: { heading: string; bodyHtml: string }): string` from `@/lib/email`, consumed by Tasks 9, 11, 12.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/__tests__/lib/email.test.ts` (find the existing `import {
... } from "@/lib/email"` at the top and add `buildHeadingBodyHtml` to it):

```typescript
describe("buildHeadingBodyHtml", () => {
  it("renders the 33px centered heading and 22.5px/#4b4b4b body styling", () => {
    const html = buildHeadingBodyHtml({ heading: "My Heading", bodyHtml: "<p>Body text</p>" });

    expect(html).toContain("My Heading");
    expect(html).toContain("font-size: 33px");
    expect(html).toContain("font-size: 22.5px");
    expect(html).toContain("#4b4b4b");
    expect(html).toContain("<p>Body text</p>");
  });

  it("scopes paragraph spacing to its own content, not globally", () => {
    const html = buildHeadingBodyHtml({ heading: "H", bodyHtml: "<p>x</p>" });
    expect(html).toContain("#campaign-content p { margin: 0 0 20px; }");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter web exec vitest run src/__tests__/lib/email.test.ts
```

Expected: FAIL — `buildHeadingBodyHtml` is not exported.

- [ ] **Step 3: Add the function to `lib/email.ts`**

Add this new exported function right after `emailLayout`'s closing brace
(after line 125):

```typescript
// Shared by every email that needs the welcome-agent-style heading (33px,
// centered) over a 22.5px/#4b4b4b body — the campaign send route, the
// scheduled/drip cron, and Action Plan emails all render through this so the
// markup exists in exactly one place.
export function buildHeadingBodyHtml(opts: { heading: string; bodyHtml: string }): string {
  return `
    <h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 24px; text-align: center;">
      ${opts.heading}
    </h2>
    <style>
      #campaign-content p { margin: 0 0 20px; }
      #campaign-content p:last-child { margin-bottom: 0; }
    </style>
    <div id="campaign-content" style="color: #4b4b4b; font-size: 22.5px; line-height: 1.6; text-align: left;">
      ${opts.bodyHtml}
    </div>
  `;
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter web exec vitest run src/__tests__/lib/email.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/email.ts apps/web/src/__tests__/lib/email.test.ts
git commit -m "feat(email): extract shared 33px heading + body render helper"
```

---

### Task 9: Refactor `/send` route to use the shared helper + heading fallback

**Files:**
- Modify: `apps/web/src/app/api/campaigns/[id]/send/route.ts`
- Modify: `apps/web/src/__tests__/api/campaigns-send.test.ts`

**Interfaces:**
- Consumes: `buildHeadingBodyHtml` from `@/lib/email` (Task 8).

- [ ] **Step 1: Add a failing test for the heading fallback**

Add to `apps/web/src/__tests__/api/campaigns-send.test.ts`, inside the `"POST
/api/campaigns/[id]/send — send seam"` describe block:

```typescript
  it("uses the campaign's heading in the h2 when set, falling back to subject otherwise", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({
      id: "c1",
      agentId: "a1",
      agent: { monthlyEmailLimit: 200 },
      subject: "Spring Market Update",
      heading: "A Big Announcement",
      body: "<p>Body</p>",
      contacts: [{ id: "cc1", lead: { id: "lead_1", email: "lead@example.com" } }],
    } as any);

    await POST(request(), { params: { id: "c1" } });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.subject).toBe("Spring Market Update"); // literal subject line unaffected
    expect(call.html).toContain("A Big Announcement"); // heading used instead
  });

  it("falls back to subject for the heading when heading is not set", async () => {
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({
      id: "c1",
      agentId: "a1",
      agent: { monthlyEmailLimit: 200 },
      subject: "Spring Market Update",
      heading: null,
      body: "<p>Body</p>",
      contacts: [{ id: "cc1", lead: { id: "lead_1", email: "lead@example.com" } }],
    } as any);

    await POST(request(), { params: { id: "c1" } });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain("Spring Market Update");
  });
```

- [ ] **Step 2: Run to verify these two fail**

```bash
pnpm --filter web exec vitest run src/__tests__/api/campaigns-send.test.ts
```

Expected: the two new tests FAIL (heading isn't read at all today); the rest
still pass.

- [ ] **Step 3: Update the route**

Change the import line:

```typescript
import { emailLayout } from "@/lib/email";
```

to:

```typescript
import { emailLayout, buildHeadingBodyHtml } from "@/lib/email";
```

Inside the `Promise.allSettled` map, find this exact block (currently lines
118–144 of the file, starting right after `const quotaAvailable = ...` /
`if (!quotaAvailable) { ... }`):

```typescript
      // Built per contact, not once outside the loop: the unsubscribe link is
      // signed for a specific lead, so a shared body would opt the wrong
      // person out.
      //
      // The heading/body styling matches the welcome-agent email (33px
      // centered heading, 22.5px/#4b4b4b body) rather than emailLayout's
      // generic 22px heading slot — kept out of that slot (heading: "")
      // the same way the other custom-styled emails do it. The scoped
      // <style> block sets consistent paragraph spacing on the agent's
      // Tiptap-authored body, which ships its own <p> tags with no inline
      // margin of their own.
      const html = emailLayout({
        heading: "",
        bodyHtml: `
          <h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 24px; text-align: center;">
            ${campaign.subject}
          </h2>
          <style>
            #campaign-content p { margin: 0 0 20px; }
            #campaign-content p:last-child { margin-bottom: 0; }
          </style>
          <div id="campaign-content" style="color: #4b4b4b; font-size: 22.5px; line-height: 1.6; text-align: left;">
            ${campaign.body}
          </div>
          ${unsubscribeFooterHtml("lead", contact.lead.id, "campaign")}
        `,
      });
```

Replace that entire block with:

```typescript
      // Built per contact, not once outside the loop: the unsubscribe link is
      // signed for a specific lead, so a shared body would opt the wrong
      // person out.
      const html = emailLayout({
        heading: "",
        bodyHtml:
          buildHeadingBodyHtml({
            heading: campaign.heading || campaign.subject!,
            bodyHtml: campaign.body!,
          }) + unsubscribeFooterHtml("lead", contact.lead.id, "campaign"),
      });
```

- [ ] **Step 4: Run to verify all tests pass**

```bash
pnpm --filter web exec vitest run src/__tests__/api/campaigns-send.test.ts
```

Expected: PASS, all cases including the two new ones and everything
pre-existing (the markup output is byte-identical to before for a campaign
with no `heading` set, since `campaign.heading || campaign.subject!` reduces
to `campaign.subject!` when `heading` is undefined/null).

- [ ] **Step 5: Full suite + typecheck**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/campaigns/[id]/send/route.ts apps/web/src/__tests__/api/campaigns-send.test.ts
git commit -m "refactor(campaigns): use shared render helper, add heading fallback to /send"
```

---

### Task 10: Campaign create/update/drip-steps routes accept `heading`

**Files:**
- Modify: `apps/web/src/app/api/campaigns/route.ts`
- Modify: `apps/web/src/app/api/campaigns/[id]/route.ts`
- Modify: `apps/web/src/app/api/campaigns/[id]/drip-steps/route.ts`
- Modify: `apps/web/src/__tests__/api/campaigns.test.ts`
- Modify: `apps/web/src/__tests__/api/drip-steps.test.ts`

**Interfaces:**
- Produces: `heading` accepted and persisted by `POST /api/campaigns`, `PATCH
  /api/campaigns/[id]`, and `POST /api/campaigns/[id]/drip-steps`.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/__tests__/api/campaigns.test.ts`:

```typescript
describe("POST /api/campaigns — heading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(AGENT_SESSION);
  });

  it("persists an optional heading alongside subject", async () => {
    vi.mocked(prisma.campaign.create).mockResolvedValue({ id: "c1" } as any);

    await createCampaign(
      makeRequest("http://localhost/api/campaigns", {
        name: "Spring",
        type: "EMAIL",
        subject: "Spring Update",
        heading: "Big News",
      })
    );

    expect(prisma.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ heading: "Big News" }) })
    );
  });
});

describe("PATCH /api/campaigns/[id] — heading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(AGENT_SESSION);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a1" } as any);
  });

  it("updates heading when provided", async () => {
    vi.mocked(prisma.campaign.update).mockResolvedValue({} as any);

    await patchCampaign(
      makeRequest("http://localhost/api/campaigns/c1", { heading: "New Heading" }, "PATCH"),
      { params: { id: "c1" } }
    );

    expect(prisma.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ heading: "New Heading" }) })
    );
  });
});
```

Add to `apps/web/src/__tests__/api/drip-steps.test.ts`, inside the existing
`describe('POST /api/campaigns/[id]/drip-steps', ...)` block:

```typescript
  it('persists an optional heading per step alongside subject', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1', role: 'AGENT', agentId: 'a1' } } as any);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: 'c1', agentId: 'a1' } as any);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined as any);

    const steps = [{ stepOrder: 1, delayDays: 0, subject: 'Welcome', heading: 'A Warm Welcome', body: 'Hi there!' }];
    await POST(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify(steps), headers: { 'Content-Type': 'application/json' } }),
      { params: { id: 'c1' } }
    );

    const createManyCall = vi.mocked(prisma.dripStep.createMany).mock.calls[0][0] as any;
    expect(createManyCall.data[0].heading).toBe('A Warm Welcome');
  });
```

Note: the current `POST /drip-steps` mock for `prisma.$transaction` in
`drip-steps.test.ts` is `vi.fn()` returning `undefined`, which doesn't
actually invoke the array of operations passed to it — so
`prisma.dripStep.createMany` needs its own direct mock too. Add
`createMany: vi.fn()` to the `dripStep` mock object at the top of the file
(alongside the existing `findMany`/`deleteMany`) before this test can pass.

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm --filter web exec vitest run src/__tests__/api/campaigns.test.ts src/__tests__/api/drip-steps.test.ts
```

Expected: the 3 new tests FAIL.

- [ ] **Step 3: Update the three routes**

In `apps/web/src/app/api/campaigns/route.ts`, update `createSchema` and the
`create` call:

```typescript
const createSchema = z.object({
  name: z.string().min(1, "Name required"),
  type: z.enum(["EMAIL", "DRIP"]),
  subject: z.string().optional(),
  heading: z.string().optional(),
});
```

```typescript
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        type: data.type,
        subject: data.subject ?? null,
        heading: data.heading ?? null,
        body: "",
        status: "DRAFT",
        agentId,
      },
    });
```

In `apps/web/src/app/api/campaigns/[id]/route.ts`, update `patchSchema` and
the `update` call:

```typescript
const patchSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().optional(),
  heading: z.string().optional(),
  body: z.string().optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
});
```

```typescript
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.heading !== undefined && { heading: data.heading }),
        ...(data.body !== undefined && { body: data.body }),
        ...(data.scheduledAt !== undefined && {
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        }),
        ...(data.status !== undefined && { status: data.status }),
      },
```

In `apps/web/src/app/api/campaigns/[id]/drip-steps/route.ts`, update the
inline type annotation on `steps`:

```typescript
  let steps: Array<{ stepOrder: number; delayDays: number; subject: string; heading?: string; body: string }>;
```

(No other change needed here — `prisma.dripStep.createMany({ data: steps.map((s) => ({ ...s, campaignId: params.id })) })` already spreads whatever fields are present, so `heading` flows through automatically once it's in the type and the caller sends it.)

Also add `createMany: vi.fn()` to the `dripStep` mock in
`drip-steps.test.ts`'s `vi.mock("@/lib/prisma", ...)` block per the note in
Step 1.

- [ ] **Step 4: Run to verify they pass**

```bash
pnpm --filter web exec vitest run src/__tests__/api/campaigns.test.ts src/__tests__/api/drip-steps.test.ts
```

Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/campaigns apps/web/src/__tests__/api/campaigns.test.ts apps/web/src/__tests__/api/drip-steps.test.ts
git commit -m "feat(campaigns): accept and persist optional heading on create/update/drip-steps"
```

---

### Task 11: `/schedule` and the cron read/apply heading fallback

**Files:**
- Modify: `apps/web/src/app/api/campaigns/[id]/schedule/route.ts` (no code change needed — see note)
- Modify: `apps/web/src/app/api/cron/campaign-deliveries/route.ts`
- Modify: `apps/web/src/__tests__/api/cron-campaign-deliveries.test.ts`

**Interfaces:**
- Consumes: `buildHeadingBodyHtml` from `@/lib/email` (Task 8), `heading` field
  on `Campaign`/`DripStep` (Task 7).

Note on `/schedule`: it never renders an email — it only computes `dueAt`
values and creates `CampaignDelivery` rows keyed by `campaignContactId`/
`dripStepId`. It doesn't need to read `heading` at all; the cron reads
`heading` at send time by following the same `dripStepId`/`campaign`
relations it already loads. No change needed to `/schedule` for this task.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/__tests__/api/cron-campaign-deliveries.test.ts`:

```typescript
  it("uses the campaign's heading over subject for a plain scheduled email", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([
      plainEmailDelivery({
        campaignContact: {
          id: "cc1",
          lead: LEAD,
          campaign: {
            id: "c1",
            agentId: "a1",
            agent: AGENT,
            subject: "Hello",
            heading: "A Bigger Hello",
            body: "<p>Hi there</p>",
          },
        },
      }),
    ] as any);

    await POST(makeReq(CRON_SECRET));

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.subject).toBe("Hello"); // literal subject unaffected
    expect(call.html).toContain("A Bigger Hello");
  });

  it("uses a drip step's heading over its subject", async () => {
    vi.mocked(prisma.campaignDelivery.findMany).mockResolvedValue([
      dripStepDelivery({
        dripStep: { id: "step1", subject: "Step subject", heading: "Step Heading", body: "Plain text" },
      }),
    ] as any);

    await POST(makeReq(CRON_SECRET));

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.subject).toBe("Step subject");
    expect(call.html).toContain("Step Heading");
  });
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm --filter web exec vitest run src/__tests__/api/cron-campaign-deliveries.test.ts
```

Expected: the two new tests FAIL (`heading` isn't selected/read yet, and the
markup is still built by the duplicated `buildBodyHtml` local function from
Task 4, not the shared helper).

- [ ] **Step 3: Update the cron route**

Change the import line:

```typescript
import { emailLayout, escapeHtml } from "@/lib/email";
```

to:

```typescript
import { emailLayout, escapeHtml, buildHeadingBodyHtml } from "@/lib/email";
```

Delete the local `buildBodyHtml` function entirely (it's now redundant with
the shared helper).

Add `heading: true` to both `select` blocks in the main query — the campaign
select:

```typescript
          campaign: {
            select: {
              id: true,
              agentId: true,
              subject: true,
              heading: true,
              body: true,
              agent: { select: { monthlyEmailLimit: true } },
            },
          },
```

and the dripStep select:

```typescript
      dripStep: { select: { id: true, subject: true, heading: true, body: true } },
```

Replace the content-resolution + render block:

```typescript
        const subject = dripStep ? dripStep.subject : campaign.subject ?? "";
        const heading = dripStep ? (dripStep.heading || dripStep.subject) : (campaign.heading || campaign.subject ?? "");
        const innerHtml = dripStep
          ? paragraph(dripStep.body ?? "")
          : campaign.body ?? "";
        const html = emailLayout({
          heading: "",
          bodyHtml:
            buildHeadingBodyHtml({ heading: escapeHtml(heading), bodyHtml: innerHtml }) +
            unsubscribeFooterHtml("lead", lead.id, "campaign"),
        });
```

- [ ] **Step 4: Run to verify all tests pass**

```bash
pnpm --filter web exec vitest run src/__tests__/api/cron-campaign-deliveries.test.ts
```

Expected: PASS, all cases (the pre-existing ones still pass since
`heading || subject` reduces to `subject` when `heading` is unset, and the
shared helper's output is identical to the deleted local function's).

- [ ] **Step 5: Full suite + typecheck**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/cron/campaign-deliveries apps/web/src/__tests__/api/cron-campaign-deliveries.test.ts
git commit -m "refactor(cron): use shared render helper, add heading fallback to scheduled/drip sends"
```

---

### Task 12: Upgrade Action Plan emails — shared helper + heading fallback

**Files:**
- Modify: `apps/web/src/lib/action-plan-email.ts`
- Modify: `apps/web/src/app/api/leads/[id]/route.ts` (copies a template's `heading` into each new enrollment's `LeadPlanStep` rows)
- Modify: `apps/web/src/app/api/cron/action-plans/route.ts`
- Modify: `apps/web/src/__tests__/lib/action-plan-email.test.ts`
- Modify: `apps/web/src/__tests__/api/triggers.test.ts`
- Modify: `apps/web/src/__tests__/api/cron-action-plans.test.ts`

**Interfaces:**
- Consumes: `buildHeadingBodyHtml` from `@/lib/email` (Task 8), `LeadPlanStep.heading` (Task 7).
- Produces: `sendActionPlanEmail` gains an optional `heading?: string` param.
  `sendLeadReplyNotification`'s signature is unchanged — it gets the visual
  upgrade only, no heading field (there's no persisted step to add one to for
  a runtime-only forward).

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/__tests__/lib/action-plan-email.test.ts`:

```typescript
describe("sendActionPlanEmail — visual upgrade + heading fallback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the 33px heading style, not the generic 22px emailLayout heading", async () => {
    await sendActionPlanEmail({
      to: "jordan@example.com",
      subject: "Following up",
      body: "hi",
      enrollmentId: "enr-1",
      leadId: "lead-1",
    });

    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    expect(html).toContain("font-size: 33px");
    expect(html).toContain("font-size: 22.5px");
  });

  it("uses heading over subject in the body when heading is provided", async () => {
    await sendActionPlanEmail({
      to: "jordan@example.com",
      subject: "Following up",
      heading: "A Warmer Heading",
      body: "hi",
      enrollmentId: "enr-1",
      leadId: "lead-1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.subject).toBe("Following up"); // literal subject unaffected
    expect(call.html).toContain("A Warmer Heading");
  });

  it("falls back to subject when heading is not provided", async () => {
    await sendActionPlanEmail({
      to: "jordan@example.com",
      subject: "Following up",
      body: "hi",
      enrollmentId: "enr-1",
      leadId: "lead-1",
    });

    expect(vi.mocked(sendEmail).mock.calls[0][0].html).toContain("Following up");
  });
});

describe("sendLeadReplyNotification — visual upgrade", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the 33px heading style", async () => {
    await sendLeadReplyNotification({
      to: "agent@cncrealtygroup.com",
      subject: "[Lead Reply] Still interested",
      body: "Yes, please call me",
      enrollmentId: "enr-1",
    });

    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    expect(html).toContain("font-size: 33px");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm --filter web exec vitest run src/__tests__/lib/action-plan-email.test.ts
```

Expected: the new tests FAIL — current output has no `font-size: 33px`
anywhere, and `heading` isn't an accepted param.

- [ ] **Step 3: Update `lib/action-plan-email.ts`**

Change the import:

```typescript
import { emailLayout, escapeHtml } from "@/lib/email";
```

to:

```typescript
import { emailLayout, escapeHtml, buildHeadingBodyHtml } from "@/lib/email";
```

Simplify `paragraph` — drop its own conflicting inline `font-size`/`color` so
it inherits the wrapping div's 22.5px/`#4b4b4b` from the shared helper (an
element's own inline style always wins over an inherited value, so leaving
the old 15px/`color` inline would silently defeat the upgrade):

```typescript
export function paragraph(body: string): string {
  return `<p>${escapeHtml(body).replace(/\n/g, "<br>")}</p>`;
}
```

Update `sendActionPlanEmail`:

```typescript
export async function sendActionPlanEmail(opts: {
  to: string;
  subject: string;
  heading?: string;
  body: string;
  enrollmentId: string;
  leadId: string;
}): Promise<SendResult> {
  const replyTo = `reply+${opts.enrollmentId}@reply.cncrealtygroup.com`;
  const bodyHtml =
    buildHeadingBodyHtml({ heading: opts.heading || opts.subject, bodyHtml: paragraph(opts.body) }) +
    unsubscribeFooterHtml("lead", opts.leadId, "action_plan");
  const html = emailLayout({ heading: "", bodyHtml });

  return sendEmail({
    to: opts.to,
    subject: opts.subject,
    html,
    replyTo,
    stream: "broadcast",
    recipient: { kind: "lead", id: opts.leadId },
    category: "action_plan",
  });
}
```

Update `sendLeadReplyNotification`:

```typescript
export async function sendLeadReplyNotification(opts: {
  to: string;
  subject: string;
  body: string;
  enrollmentId: string;
}): Promise<void> {
  await sendEmail({
    to: opts.to,
    subject: opts.subject,
    html: emailLayout({ heading: "", bodyHtml: buildHeadingBodyHtml({ heading: opts.subject, bodyHtml: paragraph(opts.body) }) }),
    replyTo: `reply+${opts.enrollmentId}@reply.cncrealtygroup.com`,
    stream: "transactional",
  });
}
```

- [ ] **Step 4: Run to verify all tests pass**

```bash
pnpm --filter web exec vitest run src/__tests__/lib/action-plan-email.test.ts
```

Expected: PASS, all cases including the pre-existing ones (they only check
for substring presence of heading text / logo / unsubscribe link / stream —
none of that changes).

- [ ] **Step 5: Carry `heading` from the template into each new enrollment**

`ActionPlanStep.heading` (the reusable template field) is never read by the
sending cron — the cron reads `LeadPlanStep`, a separate per-enrollment copy
created when a trigger fires. The copy is built by explicitly listing which
fields to carry over in `apps/web/src/app/api/leads/[id]/route.ts`, and
`heading` needs adding to that list or it will silently never reach a real
send.

First, write the failing test. Add to `apps/web/src/__tests__/api/triggers.test.ts`,
inside the `describe("Trigger execution — PATCH /api/leads/[id]", ...)` block:

```typescript
  it("carries a plan step's heading into the new enrollment's LeadPlanStep rows", async () => {
    vi.mocked(getServerSession).mockResolvedValue(LEAD_SESSION as any);
    vi.mocked(prisma.lead.update).mockResolvedValue(UPDATED_LEAD as any);
    vi.mocked(prisma.trigger.findMany).mockResolvedValue([
      {
        ...TRIGGER_ENROLL,
        actionPlan: {
          id: "p1",
          isActive: true,
          steps: [
            { stepOrder: 1, delayDays: 0, stepType: "EMAIL", subject: "Hi", heading: "A Warmer Hi", body: "Hello", taskTitle: null },
          ],
        },
      },
    ] as any);
    vi.mocked(prisma.leadPlanEnrollment.findFirst).mockResolvedValue(null);

    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      leadPlanEnrollment: { create: vi.fn().mockResolvedValue({ id: "enr1" }) },
      leadPlanStep: { createMany },
    };
    vi.mocked(prisma.$transaction).mockImplementation((cb: any) => cb(tx));

    const req = new Request("http://localhost/api/leads/l1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "QUALIFIED" }),
    });
    const res = await PATCH_LEAD(req, LEAD_PARAMS);

    expect(res.status).toBe(200);
    const call = createMany.mock.calls[0][0] as any;
    expect(call.data[0].heading).toBe("A Warmer Hi");
  });
```

Run it to verify it fails:

```bash
pnpm --filter web exec vitest run src/__tests__/api/triggers.test.ts
```

Expected: FAIL — `call.data[0].heading` is `undefined` today, since the
mapping in `route.ts` doesn't copy it.

Now fix `apps/web/src/app/api/leads/[id]/route.ts`. Find the
`tx.leadPlanStep.createMany` call inside the `ENROLL_PLAN` branch and add
`heading: s.heading` to the mapped object:

```typescript
            if (plan.steps.length > 0) {
              await tx.leadPlanStep.createMany({
                data: plan.steps.map((s) => {
                  const dueAt = new Date(now);
                  dueAt.setDate(dueAt.getDate() + s.delayDays);
                  return {
                    enrollmentId: enr.id,
                    stepOrder: s.stepOrder,
                    stepType: s.stepType,
                    subject: s.subject,
                    heading: s.heading,
                    body: s.body,
                    taskTitle: s.taskTitle,
                    dueAt,
                  };
                }),
              });
            }
```

Run the test again to verify it passes:

```bash
pnpm --filter web exec vitest run src/__tests__/api/triggers.test.ts
```

Expected: PASS, this test and every pre-existing one in the file (the
`$transaction` mock change only affects this one new test — every other test
in this describe block either doesn't reach the `ENROLL_PLAN` branch or
already mocks `$transaction` with a plain resolved value that this change
doesn't touch).

- [ ] **Step 6: Wire `heading` through the cron caller**

In `apps/web/src/app/api/cron/action-plans/route.ts`, update the
`sendActionPlanEmail` call site:

```typescript
          const subject = substituteVars(step.subject ?? "", vars);
          const heading = step.heading ? substituteVars(step.heading, vars) : undefined;
          const body = substituteVars(step.body ?? "", vars);
          const result = await sendActionPlanEmail({
            to: lead.email,
            subject,
            heading,
            body,
            enrollmentId: enrollment.id,
            leadId: lead.id,
          });
```

No query change is needed for this route's own `leadPlanStep.findMany` call —
it uses a bare `findMany` with no `select` restricting `LeadPlanStep`'s own
scalar fields (only its `enrollment` relation is `include`d), so `heading`
comes through automatically by Prisma's default "return every scalar field"
behavior once Step 5 above has actually populated it on real rows.

Add a test to `apps/web/src/__tests__/api/cron-action-plans.test.ts`:

```typescript
  it("passes the step's heading through to sendActionPlanEmail, substituted", async () => {
    const stepWithHeading = { ...EMAIL_STEP, heading: "Hi {{first_name}}, a warmer heading" };
    vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([stepWithHeading] as any);
    vi.mocked(prisma.leadPlanStep.update).mockResolvedValue({} as any);
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });

    await POST(makeReq(CRON_SECRET));

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain("Hi John, a warmer heading");
  });
```

- [ ] **Step 7: Run to verify it passes**

```bash
pnpm --filter web exec vitest run src/__tests__/api/cron-action-plans.test.ts
```

Expected: PASS.

- [ ] **Step 8: Full suite + typecheck**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/action-plan-email.ts apps/web/src/app/api/leads/[id]/route.ts apps/web/src/app/api/cron/action-plans/route.ts apps/web/src/__tests__/lib/action-plan-email.test.ts apps/web/src/__tests__/api/triggers.test.ts apps/web/src/__tests__/api/cron-action-plans.test.ts
git commit -m "feat(action-plans): upgrade emails to the 33px heading style, add heading fallback"
```

---

### Task 13: Admin Action Plan step routes accept `heading`

**Files:**
- Modify: `apps/web/src/app/api/admin/action-plans/[id]/steps/route.ts`
- Modify: `apps/web/src/app/api/admin/action-plans/[id]/steps/[stepId]/route.ts`
- Modify: `apps/web/src/__tests__/api/action-plans.test.ts`

**Interfaces:**
- Produces: `heading` accepted and persisted on `POST`/`PATCH` for
  `ActionPlanStep`.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/__tests__/api/action-plans.test.ts`, inside the `describe
'POST /api/admin/action-plans/[id]/steps'` block:

```typescript
  it("persists an optional heading alongside subject", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.actionPlan.findUnique).mockResolvedValue(PLAN as any);
    vi.mocked(prisma.actionPlanStep.create).mockResolvedValue(STEP as any);
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepOrder: 1, delayDays: 0, stepType: "EMAIL", subject: "Hi", heading: "A Warmer Hi", body: "Hello" }),
    });
    const res = await POST_STEP(req, PLAN_PARAMS);
    expect(res.status).toBe(201);
    expect(prisma.actionPlanStep.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ heading: "A Warmer Hi" }) })
    );
  });
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter web exec vitest run src/__tests__/api/action-plans.test.ts
```

Expected: FAIL — `heading` isn't in the Zod schema, so it's stripped before
reaching `prisma.actionPlanStep.create`.

- [ ] **Step 3: Update both routes' Zod schemas**

In `apps/web/src/app/api/admin/action-plans/[id]/steps/route.ts`:

```typescript
const stepSchema = z.object({
  stepOrder: z.number().int().min(1),
  delayDays: z.number().int().min(0).default(0),
  stepType: z.enum(["EMAIL", "TASK"]),
  subject: z.string().optional(),
  heading: z.string().optional(),
  body: z.string().optional(),
  taskTitle: z.string().optional(),
});
```

In `apps/web/src/app/api/admin/action-plans/[id]/steps/[stepId]/route.ts`:

```typescript
  const schema = z.object({
    stepOrder: z.number().int().min(1).optional(),
    delayDays: z.number().int().min(0).optional(),
    stepType: z.enum(["EMAIL", "TASK"]).optional(),
    subject: z.string().nullable().optional(),
    heading: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    taskTitle: z.string().nullable().optional(),
  });
```

No other changes needed in either route — both already spread the parsed
`data`/`raw` object straight into `prisma.actionPlanStep.create`/`.update`, so
`heading` flows through automatically once it survives Zod parsing.

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter web exec vitest run src/__tests__/api/action-plans.test.ts
```

Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/admin/action-plans apps/web/src/__tests__/api/action-plans.test.ts
git commit -m "feat(action-plans): accept and persist optional heading on step create/update"
```

---

### Task 14: UI — "Heading (optional)" input in all three editors

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/campaigns/new/page.tsx`
- Modify: `apps/web/src/components/dashboard/DripSequenceEditor.tsx`
- Modify: `apps/web/src/components/action-plans/ActionPlanStepDrawer.tsx`

No new automated tests — client component changes, verified live per this
project's convention.

- [ ] **Step 1: Campaign wizard's Details step**

In `apps/web/src/app/(dashboard)/dashboard/campaigns/new/page.tsx`, add state
near the existing `subject` state:

```typescript
  const [heading, setHeading] = useState("");
```

Add the input right after the existing Subject Line field (inside the
`{type === "EMAIL" && (...)}` block, after its closing `</div>`):

```tsx
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-sm text-[#1B1B1B]/60">Heading (optional)</label>
                <input
                  type="text"
                  value={heading}
                  onChange={(e) => setHeading(e.target.value)}
                  placeholder="Defaults to subject line"
                  className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
                />
              </div>
```

Include it in the campaign creation POST body inside `handleFinish`:

```typescript
        body: JSON.stringify({ name, type, subject: type === "DRIP" ? "" : subject, heading: type === "DRIP" ? "" : heading }),
```

- [ ] **Step 2: `DripSequenceEditor.tsx` — per-step heading**

Add `heading` to the exported type:

```typescript
export type DripStepData = {
  stepOrder: number;
  delayDays: number;
  subject: string;
  heading: string;
  body: string;
};
```

Update `addStep`'s new-step default:

```typescript
      {
        stepOrder: steps.length + 1,
        delayDays: steps.length === 0 ? 0 : 3,
        subject: "",
        heading: "",
        body: "",
      },
```

Add the input right after the existing Subject line input:

```tsx
          <input
            type="text"
            placeholder="Heading (optional) — defaults to subject line"
            value={step.heading}
            onChange={(e) => updateStep(i, "heading", e.target.value)}
            className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
          />
```

- [ ] **Step 3: `ActionPlanStepDrawer.tsx` — heading field**

Add to the `PlanStep` type:

```typescript
type PlanStep = {
  id: string;
  stepOrder: number;
  delayDays: number;
  stepType: "EMAIL" | "TASK";
  subject: string | null;
  heading: string | null;
  body: string | null;
  taskTitle: string | null;
};
```

Add state:

```typescript
  const [heading, setHeading] = useState("");
```

Load/reset it alongside `subject` in the existing `useEffect`:

```typescript
    if (step) {
      setStepOrder(step.stepOrder);
      setDelayDays(step.delayDays);
      setStepType(step.stepType);
      setSubject(step.subject ?? "");
      setHeading(step.heading ?? "");
      setBody(step.body ?? "");
      setTaskTitle(step.taskTitle ?? "");
      setError(null);
    } else {
      setStepOrder(1);
      setDelayDays(0);
      setStepType("EMAIL");
      setSubject("");
      setHeading("");
      setBody("");
      setTaskTitle("");
      setError(null);
    }
```

Include it in the save payload:

```typescript
      const payload = { stepOrder, delayDays, stepType, subject: subject || null, heading: heading || null, body: body || null, taskTitle: taskTitle || null };
```

Add the input right after the existing Subject field (inside the `{stepType
=== "EMAIL" && (...)}` block):

```tsx
              <div>
                <label className="mb-1 block text-xs text-[#1B1B1B]/50">Heading (optional — defaults to subject)</label>
                <input value={heading} onChange={(e) => setHeading(e.target.value)}
                  className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
                  placeholder="e.g. A Warm Welcome" />
              </div>
```

- [ ] **Step 4: Live-verify all three**

With `pnpm --filter web dev` running:
1. Create an EMAIL campaign with a Subject Line and a different Heading, send
   it (Send Now), confirm the received email's subject line matches the
   Subject field and the big heading in the body matches the Heading field.
2. Create a DRIP campaign, leave one step's Heading blank and fill another's,
   Start Now, trigger the cron, confirm the blank one renders its Subject as
   the heading and the filled one renders its own Heading.
3. In `/admin/action-plans`, edit a plan's EMAIL step, set a Heading different
   from its Subject, enroll a test lead, trigger `/api/cron/action-plans`,
   confirm the received email's heading matches.

- [ ] **Step 5: Full suite + typecheck**

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/campaigns/new/page.tsx" apps/web/src/components/dashboard/DripSequenceEditor.tsx apps/web/src/components/action-plans/ActionPlanStepDrawer.tsx
git commit -m "feat(ui): add optional Heading input to campaign, drip step, and action plan editors"
```

---

## Final verification

- [ ] Full suite: `pnpm --filter web exec vitest run` — all green.
- [ ] Typecheck: clear `apps/web/.next/types` then `pnpm --filter web exec tsc --noEmit` — clean.
- [ ] Live click-through of all three scenarios in Task 14, Step 4 once more end-to-end, after every task has landed.
- [ ] Confirm `vercel.json` has the new hourly cron entry and no syntax errors (`cat vercel.json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` or equivalent).
