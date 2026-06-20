# Phase 7 Sub-project 5: Action Plans — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build per-lead automated drip sequences — admin creates templates, agents enroll leads, daily cron fires EMAIL/TASK steps automatically, and SendGrid Inbound Parse auto-pauses when a lead replies.

**Architecture:** Materialize all steps at enrollment time with computed `dueAt` timestamps (Approach A). A Vercel Cron job runs daily at 8am UTC and executes any `PENDING` steps due today or earlier. Reply detection uses a subdomain MX (`reply.cncrealtygroup.com → mx.sendgrid.net`) so lead replies route to SendGrid Inbound Parse, which pauses the enrollment and forwards to the agent's email.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Prisma ORM + PostgreSQL, Tailwind CSS, `@sendgrid/mail`, Vercel Cron, Zod v4, vitest

## Global Constraints

- Auth: `requireAuth("AGENT")` or `requireAuth("ADMIN")` from `@/lib/api-auth` → returns `{ session, error }`
- `assertOwnership` defined locally per route file: ADMIN bypasses, AGENT checks `lead.agentId === agent.id` (via `prisma.agent.findUnique({ where: { userId } })`)
- `export const dynamic = "force-dynamic"` on every session-reading route
- Zod v4: `err.issues[0].message` (NOT `err.errors[0].message`)
- No toast library — inline `error` state only
- Always-mounted drawer pattern: CSS `hidden` class, NOT conditional render; `role="dialog"` `aria-modal="true"` on wrapper
- Gold accent: `#9E8C61`; off-white bg: `#F2F0EF`; dark text: `#1B1B1B`
- CTA buttons: `PULSE_ANIMATE + PULSE_TRANSITION` from `@/lib/motion`
- vitest mock pattern: `vi.mock("next-auth", ...)` + `vi.mock("@/lib/auth", ...)` + `vi.mock("@/lib/prisma", ...)`
- SendGrid: `sgMail.send()` with `from: FROM` imported from `@/lib/email`
- Cron auth: `req.headers.get("authorization") !== \`Bearer ${process.env.CRON_SECRET}\``
- `export const maxDuration = 60` on cron routes
- FROM address for emails: `"noreply@cncrealtygroup.com"` (imported from `@/lib/email`)
- MERGE_BASE for Sub-project 5: commit `2628724` (HEAD at end of Sub-project 4)
- Do NOT push commits until all Phase 7 sub-projects (1–8) are complete

---

## File Map

**Schema (modify):**
- `packages/database/prisma/schema.prisma` — add 4 models + 4 enums + relations on Lead + Agent

**API routes (create):**
- `apps/web/src/app/api/admin/action-plans/route.ts` — GET, POST
- `apps/web/src/app/api/admin/action-plans/[id]/route.ts` — PATCH, DELETE
- `apps/web/src/app/api/admin/action-plans/[id]/steps/route.ts` — POST
- `apps/web/src/app/api/admin/action-plans/[id]/steps/[stepId]/route.ts` — PATCH, DELETE
- `apps/web/src/app/api/leads/[id]/enrollments/route.ts` — GET, POST
- `apps/web/src/app/api/leads/[id]/enrollments/[enrollmentId]/route.ts` — PATCH
- `apps/web/src/app/api/cron/action-plans/route.ts` — POST
- `apps/web/src/app/api/webhooks/sendgrid/inbound/route.ts` — POST

**Email helper (create):**
- `apps/web/src/lib/action-plan-email.ts` — variable substitution + SendGrid send

**Components (create):**
- `apps/web/src/components/action-plans/ActionPlanDrawer.tsx` — create/edit plan name+desc
- `apps/web/src/components/action-plans/ActionPlanDetailDrawer.tsx` — step list, add/edit/delete
- `apps/web/src/components/action-plans/ActionPlanStepDrawer.tsx` — create/edit one step
- `apps/web/src/components/leads/LeadActionPlansSection.tsx` — lead profile section

**Pages (create):**
- `apps/web/src/app/(dashboard)/dashboard/admin/action-plans/page.tsx` — admin plan list

**Config (modify):**
- `vercel.json` — add action-plans cron entry

**Tests (create):**
- `apps/web/src/__tests__/api/action-plans.test.ts`
- `apps/web/src/__tests__/api/lead-enrollments.test.ts`
- `apps/web/src/__tests__/api/cron-action-plans.test.ts`
- `apps/web/src/__tests__/webhooks/sendgrid-inbound.test.ts`

---

## Task 1: Schema + Migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

**Interfaces:**
- Produces: `ActionPlan`, `ActionPlanStep`, `LeadPlanEnrollment`, `LeadPlanStep` Prisma models; enums `PlanStepType`, `EnrollmentStatus`, `PausedReason`, `PlanStepStatus`; `enrollments LeadPlanEnrollment[]` relation on `Lead` and `Agent`

- [ ] **Step 1: Add enums and models to schema**

Open `packages/database/prisma/schema.prisma`. After the last existing enum, add:

```prisma
enum PlanStepType {
  EMAIL
  TASK
}

enum EnrollmentStatus {
  ACTIVE
  PAUSED
  COMPLETED
  CANCELLED
}

enum PausedReason {
  REPLY
  MANUAL
}

enum PlanStepStatus {
  PENDING
  DONE
  SKIPPED
  PAUSED
}

model ActionPlan {
  id          String   @id @default(cuid())
  name        String
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  steps       ActionPlanStep[]
  enrollments LeadPlanEnrollment[]
}

model ActionPlanStep {
  id        String       @id @default(cuid())
  planId    String
  stepOrder Int
  delayDays Int          @default(0)
  stepType  PlanStepType
  subject   String?
  body      String?
  taskTitle String?
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  plan ActionPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
}

model LeadPlanEnrollment {
  id           String           @id @default(cuid())
  leadId       String
  planId       String
  agentId      String
  status       EnrollmentStatus @default(ACTIVE)
  enrolledAt   DateTime         @default(now())
  pausedAt     DateTime?
  pausedReason PausedReason?
  completedAt  DateTime?

  lead  Lead       @relation(fields: [leadId], references: [id], onDelete: Cascade)
  plan  ActionPlan @relation(fields: [planId], references: [id])
  agent Agent      @relation(fields: [agentId], references: [id])
  steps LeadPlanStep[]
}

model LeadPlanStep {
  id           String         @id @default(cuid())
  enrollmentId String
  stepOrder    Int
  stepType     PlanStepType
  subject      String?
  body         String?
  taskTitle    String?
  dueAt        DateTime
  status       PlanStepStatus @default(PENDING)
  executedAt   DateTime?

  enrollment LeadPlanEnrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

  @@index([status, dueAt])
}
```

- [ ] **Step 2: Add relations to existing Lead and Agent models**

In `schema.prisma`, find the `Lead` model's relation fields block and add:
```prisma
  enrollments LeadPlanEnrollment[]
```

Find the `Agent` model's relation fields block and add:
```prisma
  enrollments LeadPlanEnrollment[]
```

- [ ] **Step 3: Generate migration**

```powershell
pnpm --filter @cnc/database exec prisma migrate dev --name add_action_plans
```

Expected output: `Your database is now in sync with your schema.` and a new file under `packages/database/prisma/migrations/`.

- [ ] **Step 4: Regenerate Prisma client**

```powershell
pnpm --filter @cnc/database exec prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(schema): add ActionPlan, ActionPlanStep, LeadPlanEnrollment, LeadPlanStep models"
```

---

## Task 2: Admin Plan API Routes + Tests

**Files:**
- Create: `apps/web/src/app/api/admin/action-plans/route.ts`
- Create: `apps/web/src/app/api/admin/action-plans/[id]/route.ts`
- Create: `apps/web/src/app/api/admin/action-plans/[id]/steps/route.ts`
- Create: `apps/web/src/app/api/admin/action-plans/[id]/steps/[stepId]/route.ts`
- Create: `apps/web/src/__tests__/api/action-plans.test.ts`

**Interfaces:**
- Consumes: `requireAuth("ADMIN")` from `@/lib/api-auth`, Prisma `ActionPlan`, `ActionPlanStep`, `PlanStepType`
- Produces: REST endpoints for admin CRUD; consumed by Task 6 admin UI

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/api/action-plans.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    actionPlan: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    actionPlanStep: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    leadPlanEnrollment: { count: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../../app/api/admin/action-plans/route";
import { PATCH, DELETE } from "../../app/api/admin/action-plans/[id]/route";
import { POST as POST_STEP } from "../../app/api/admin/action-plans/[id]/steps/route";
import { PATCH as PATCH_STEP, DELETE as DELETE_STEP } from "../../app/api/admin/action-plans/[id]/steps/[stepId]/route";

const ADMIN_SESSION = { user: { id: "u1", role: "ADMIN" } };
const AGENT_SESSION = { user: { id: "u2", role: "AGENT" } };
const PLAN = { id: "p1", name: "7-Day Drip", description: null, isActive: true, createdAt: new Date(), _count: { steps: 2 } };
const STEP = { id: "s1", planId: "p1", stepOrder: 1, delayDays: 0, stepType: "EMAIL", subject: "Hi", body: "Hello", taskTitle: null };
const PLAN_PARAMS = { params: { id: "p1" } };
const STEP_PARAMS = { params: { id: "p1", stepId: "s1" } };

describe("GET /api/admin/action-plans", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns plan list for admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.actionPlan.findMany).mockResolvedValue([PLAN] as any);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("7-Day Drip");
  });
});

describe("POST /api/admin/action-plans", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a plan", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.actionPlan.create).mockResolvedValue({ id: "p1", name: "New Plan", description: null, isActive: true, createdAt: new Date() } as any);
    const req = new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "New Plan" }) });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("returns 400 for missing name", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    const req = new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/action-plans/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 409 when active enrollments exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.leadPlanEnrollment.count).mockResolvedValue(2);
    const req = new Request("http://localhost", { method: "DELETE" });
    const res = await DELETE(req, PLAN_PARAMS);
    expect(res.status).toBe(409);
  });

  it("deletes plan when no active enrollments", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.leadPlanEnrollment.count).mockResolvedValue(0);
    vi.mocked(prisma.actionPlan.delete).mockResolvedValue(PLAN as any);
    const req = new Request("http://localhost", { method: "DELETE" });
    const res = await DELETE(req, PLAN_PARAMS);
    expect(res.status).toBe(204);
  });
});

describe("POST /api/admin/action-plans/[id]/steps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for EMAIL step missing subject", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepOrder: 1, delayDays: 0, stepType: "EMAIL", body: "Hello" }),
    });
    const res = await POST_STEP(req, PLAN_PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns 400 for TASK step missing taskTitle", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepOrder: 1, delayDays: 0, stepType: "TASK" }),
    });
    const res = await POST_STEP(req, PLAN_PARAMS);
    expect(res.status).toBe(400);
  });

  it("creates an EMAIL step", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.actionPlanStep.create).mockResolvedValue(STEP as any);
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepOrder: 1, delayDays: 0, stepType: "EMAIL", subject: "Hi", body: "Hello" }),
    });
    const res = await POST_STEP(req, PLAN_PARAMS);
    expect(res.status).toBe(201);
  });
});

describe("DELETE /api/admin/action-plans/[id]/steps/[stepId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a step and returns 204", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.actionPlanStep.delete).mockResolvedValue(STEP as any);
    const req = new Request("http://localhost", { method: "DELETE" });
    const res = await DELETE_STEP(req, STEP_PARAMS);
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
pnpm --filter web test src/__tests__/api/action-plans.test.ts
```

Expected: FAIL (modules not found)

- [ ] **Step 3: Implement `GET /api/admin/action-plans` and `POST /api/admin/action-plans`**

Create `apps/web/src/app/api/admin/action-plans/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const plans = await prisma.actionPlan.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { steps: true } } },
  });
  return NextResponse.json(
    plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      isActive: p.isActive,
      stepCount: p._count.steps,
      createdAt: p.createdAt,
    }))
  );
}

export async function POST(req: Request) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const schema = z.object({ name: z.string().min(1), description: z.string().optional() });
  try {
    const data = schema.parse(await req.json());
    const plan = await prisma.actionPlan.create({ data });
    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Implement `PATCH /api/admin/action-plans/[id]` and `DELETE /api/admin/action-plans/[id]`**

Create `apps/web/src/app/api/admin/action-plans/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { EnrollmentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const schema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
  });
  try {
    const data = schema.parse(await req.json());
    const plan = await prisma.actionPlan.update({ where: { id: params.id }, data });
    return NextResponse.json(plan);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const activeCount = await prisma.leadPlanEnrollment.count({
    where: { planId: params.id, status: EnrollmentStatus.ACTIVE },
  });
  if (activeCount > 0) {
    return NextResponse.json({ error: "Cannot delete plan with active enrollments" }, { status: 409 });
  }
  await prisma.actionPlan.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 5: Implement `POST /api/admin/action-plans/[id]/steps`**

Create `apps/web/src/app/api/admin/action-plans/[id]/steps/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const stepSchema = z.object({
  stepOrder: z.number().int().min(1),
  delayDays: z.number().int().min(0).default(0),
  stepType: z.enum(["EMAIL", "TASK"]),
  subject: z.string().optional(),
  body: z.string().optional(),
  taskTitle: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  try {
    const raw = stepSchema.parse(await req.json());
    if (raw.stepType === "EMAIL" && (!raw.subject || !raw.body)) {
      return NextResponse.json({ error: "EMAIL steps require subject and body" }, { status: 400 });
    }
    if (raw.stepType === "TASK" && !raw.taskTitle) {
      return NextResponse.json({ error: "TASK steps require taskTitle" }, { status: 400 });
    }
    const step = await prisma.actionPlanStep.create({
      data: { planId: params.id, ...raw },
    });
    return NextResponse.json(step, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Implement `PATCH /api/admin/action-plans/[id]/steps/[stepId]` and `DELETE`**

Create `apps/web/src/app/api/admin/action-plans/[id]/steps/[stepId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string; stepId: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const schema = z.object({
    stepOrder: z.number().int().min(1).optional(),
    delayDays: z.number().int().min(0).optional(),
    stepType: z.enum(["EMAIL", "TASK"]).optional(),
    subject: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    taskTitle: z.string().nullable().optional(),
  });
  try {
    const data = schema.parse(await req.json());
    const step = await prisma.actionPlanStep.update({ where: { id: params.stepId }, data });
    return NextResponse.json(step);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; stepId: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  await prisma.actionPlanStep.delete({ where: { id: params.stepId } });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 7: Run tests and verify all pass**

```powershell
pnpm --filter web test src/__tests__/api/action-plans.test.ts
```

Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/api/admin/action-plans/ apps/web/src/__tests__/api/action-plans.test.ts
git commit -m "feat(api): admin action plan CRUD routes + tests"
```

---

## Task 3: Lead Enrollment API Routes + Tests

**Files:**
- Create: `apps/web/src/app/api/leads/[id]/enrollments/route.ts`
- Create: `apps/web/src/app/api/leads/[id]/enrollments/[enrollmentId]/route.ts`
- Create: `apps/web/src/__tests__/api/lead-enrollments.test.ts`

**Interfaces:**
- Consumes: `requireAuth("AGENT")`, `assertOwnership` pattern from `apps/web/src/app/api/leads/[id]/tasks/route.ts`
- Produces: enrollment endpoints consumed by Task 7 LeadActionPlansSection

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/api/lead-enrollments.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    lead: { findUnique: vi.fn() },
    actionPlan: { findUnique: vi.fn() },
    leadPlanEnrollment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    leadPlanStep: { createMany: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    actionPlanStep: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../../app/api/leads/[id]/enrollments/route";
import { PATCH } from "../../app/api/leads/[id]/enrollments/[enrollmentId]/route";

const SESSION = { user: { id: "u1", role: "AGENT" } };
const AGENT = { id: "a1" };
const LEAD = { agentId: "a1" };
const PLAN = { id: "pl1", name: "7-Day Drip", isActive: true };
const ENROLLMENT = {
  id: "e1", leadId: "l1", planId: "pl1", agentId: "a1",
  status: "ACTIVE", enrolledAt: new Date(), pausedAt: null, pausedReason: null, completedAt: null,
  plan: { name: "7-Day Drip" },
  steps: [],
};
const PARAMS = { params: { id: "l1" } };
const ENR_PARAMS = { params: { id: "l1", enrollmentId: "e1" } };

describe("GET /api/leads/[id]/enrollments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when agent does not own lead", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ agentId: "other" } as any);
    const res = await GET(new Request("http://localhost"), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns enrollment list", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD as any);
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([ENROLLMENT] as any);
    const res = await GET(new Request("http://localhost"), PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].planName).toBe("7-Day Drip");
  });
});

describe("POST /api/leads/[id]/enrollments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when plan not found or inactive", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD as any);
    vi.mocked(prisma.actionPlan.findUnique).mockResolvedValue(null);
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "pl1" }),
    });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 409 when already enrolled in same plan", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD as any);
    vi.mocked(prisma.actionPlan.findUnique).mockResolvedValue(PLAN as any);
    vi.mocked(prisma.leadPlanEnrollment.findFirst).mockResolvedValue(ENROLLMENT as any);
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "pl1" }),
    });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(409);
  });

  it("creates enrollment and materializes steps", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD as any);
    vi.mocked(prisma.actionPlan.findUnique).mockResolvedValue(PLAN as any);
    vi.mocked(prisma.leadPlanEnrollment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.actionPlanStep.findMany).mockResolvedValue([
      { id: "ts1", stepOrder: 1, delayDays: 0, stepType: "EMAIL", subject: "Hi", body: "Hello", taskTitle: null },
    ] as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma));
    vi.mocked(prisma.leadPlanEnrollment.create).mockResolvedValue({ ...ENROLLMENT, id: "e2" } as any);
    vi.mocked(prisma.leadPlanStep.createMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.leadPlanEnrollment.findUnique).mockResolvedValue({ ...ENROLLMENT, id: "e2", steps: [] } as any);
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "pl1" }),
    });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(201);
  });
});

describe("PATCH /api/leads/[id]/enrollments/[enrollmentId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pauses an enrollment with MANUAL reason", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD as any);
    vi.mocked(prisma.leadPlanEnrollment.findUnique).mockResolvedValue({ ...ENROLLMENT, leadId: "l1" } as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma));
    vi.mocked(prisma.leadPlanEnrollment.update).mockResolvedValue({ ...ENROLLMENT, status: "PAUSED" } as any);
    vi.mocked(prisma.leadPlanStep.updateMany).mockResolvedValue({ count: 1 } as any);
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAUSED" }),
    });
    const res = await PATCH(req, ENR_PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("PAUSED");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
pnpm --filter web test src/__tests__/api/lead-enrollments.test.ts
```

Expected: FAIL (modules not found)

- [ ] **Step 3: Implement `GET /api/leads/[id]/enrollments` and `POST`**

Create `apps/web/src/app/api/leads/[id]/enrollments/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

async function assertOwnership(leadId: string, userId: string, role: string) {
  if (role === "ADMIN") return true;
  const agent = await prisma.agent.findUnique({ where: { userId } });
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { agentId: true } });
  return agent && lead && lead.agentId === agent.id;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const enrollments = await prisma.leadPlanEnrollment.findMany({
    where: { leadId: params.id },
    orderBy: { enrolledAt: "desc" },
    include: {
      plan: { select: { name: true } },
      steps: {
        select: { id: true, stepOrder: true, stepType: true, subject: true, taskTitle: true, dueAt: true, status: true, executedAt: true },
        orderBy: { stepOrder: "asc" },
      },
    },
  });

  return NextResponse.json(
    enrollments.map((e) => ({
      id: e.id,
      planId: e.planId,
      planName: e.plan.name,
      agentId: e.agentId,
      status: e.status,
      enrolledAt: e.enrolledAt,
      pausedAt: e.pausedAt,
      pausedReason: e.pausedReason,
      completedAt: e.completedAt,
      steps: e.steps,
    }))
  );
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const schema = z.object({ planId: z.string().min(1) });
  let planId: string;
  try {
    ({ planId } = schema.parse(await req.json()));
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const plan = await prisma.actionPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const existing = await prisma.leadPlanEnrollment.findFirst({
    where: { leadId: params.id, planId, status: "ACTIVE" },
  });
  if (existing) return NextResponse.json({ error: "Already enrolled in this plan" }, { status: 409 });

  const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
  const agentId = session.user.role === "ADMIN" ? plan.id : agent!.id;

  const templateSteps = await prisma.actionPlanStep.findMany({
    where: { planId },
    orderBy: { stepOrder: "asc" },
  });

  const now = new Date();
  const enrollment = await prisma.$transaction(async (tx) => {
    const enr = await tx.leadPlanEnrollment.create({
      data: { leadId: params.id, planId, agentId },
    });
    if (templateSteps.length > 0) {
      await tx.leadPlanStep.createMany({
        data: templateSteps.map((s) => {
          const dueAt = new Date(now);
          dueAt.setDate(dueAt.getDate() + s.delayDays);
          return {
            enrollmentId: enr.id,
            stepOrder: s.stepOrder,
            stepType: s.stepType,
            subject: s.subject,
            body: s.body,
            taskTitle: s.taskTitle,
            dueAt,
          };
        }),
      });
    }
    return enr;
  });

  const full = await prisma.leadPlanEnrollment.findUnique({
    where: { id: enrollment.id },
    include: {
      plan: { select: { name: true } },
      steps: { orderBy: { stepOrder: "asc" } },
    },
  });
  return NextResponse.json(full, { status: 201 });
}
```

- [ ] **Step 4: Implement `PATCH /api/leads/[id]/enrollments/[enrollmentId]`**

Create `apps/web/src/app/api/leads/[id]/enrollments/[enrollmentId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

async function assertOwnership(leadId: string, userId: string, role: string) {
  if (role === "ADMIN") return true;
  const agent = await prisma.agent.findUnique({ where: { userId } });
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { agentId: true } });
  return agent && lead && lead.agentId === agent.id;
}

export async function PATCH(req: Request, { params }: { params: { id: string; enrollmentId: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const enrollment = await prisma.leadPlanEnrollment.findUnique({ where: { id: params.enrollmentId } });
  if (!enrollment || enrollment.leadId !== params.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const schema = z.object({ status: z.enum(["PAUSED", "ACTIVE", "CANCELLED"]) });
  let status: "PAUSED" | "ACTIVE" | "CANCELLED";
  try {
    ({ status } = schema.parse(await req.json()));
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    let enrData: Record<string, unknown> = { status };
    if (status === "PAUSED") {
      enrData = { ...enrData, pausedAt: new Date(), pausedReason: "MANUAL" };
      await tx.leadPlanStep.updateMany({
        where: { enrollmentId: params.enrollmentId, status: "PENDING" },
        data: { status: "PAUSED" },
      });
    } else if (status === "ACTIVE") {
      enrData = { ...enrData, pausedAt: null, pausedReason: null };
      await tx.leadPlanStep.updateMany({
        where: { enrollmentId: params.enrollmentId, status: "PAUSED" },
        data: { status: "PENDING" },
      });
    } else if (status === "CANCELLED") {
      await tx.leadPlanStep.updateMany({
        where: { enrollmentId: params.enrollmentId, status: { in: ["PENDING", "PAUSED"] } },
        data: { status: "SKIPPED" },
      });
    }
    return tx.leadPlanEnrollment.update({ where: { id: params.enrollmentId }, data: enrData });
  });

  return NextResponse.json(updated);
}
```

- [ ] **Step 5: Run tests and verify all pass**

```powershell
pnpm --filter web test src/__tests__/api/lead-enrollments.test.ts
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/leads/ apps/web/src/__tests__/api/lead-enrollments.test.ts
git commit -m "feat(api): lead enrollment routes + tests"
```

---

## Task 4: Email Helper + Cron Job + vercel.json

**Files:**
- Create: `apps/web/src/lib/action-plan-email.ts`
- Create: `apps/web/src/app/api/cron/action-plans/route.ts`
- Modify: `vercel.json`
- Create: `apps/web/src/__tests__/api/cron-action-plans.test.ts`

**Interfaces:**
- Consumes: `FROM` from `@/lib/email`, `sgMail` from `@sendgrid/mail`, `prisma`, Prisma types from Task 1
- Produces: daily cron that fires due steps; consumed by SendGrid for auto-pause (Task 5)

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/api/cron-action-plans.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sendgrid/mail", () => ({ default: { setApiKey: vi.fn(), send: vi.fn() } }));
vi.mock("@/lib/email", () => ({ FROM: "noreply@cncrealtygroup.com" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    leadPlanStep: { findMany: vi.fn(), update: vi.fn() },
    leadPlanEnrollment: { findMany: vi.fn(), update: vi.fn() },
    leadTask: { create: vi.fn() },
    lead: { findUnique: vi.fn() },
    agent: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import sgMail from "@sendgrid/mail";
import { POST } from "../../app/api/cron/action-plans/route";

const CRON_SECRET = "test-secret";
process.env.CRON_SECRET = CRON_SECRET;

function makeReq(auth?: string) {
  return new Request("http://localhost/api/cron/action-plans", {
    method: "POST",
    headers: auth ? { authorization: `Bearer ${auth}` } : {},
  });
}

const LEAD = { id: "l1", firstName: "John", lastName: "Doe" };
const AGENT = { id: "a1", displayName: "Jane Agent", phone: "555-1234", user: { email: "agent@test.com" } };
const EMAIL_STEP = {
  id: "ls1", enrollmentId: "e1", stepType: "EMAIL",
  subject: "Hi {{first_name}}", body: "Hello {{first_name}} from {{agent_name}}",
  taskTitle: null, dueAt: new Date(), status: "PENDING",
  enrollment: { id: "e1", leadId: "l1", agentId: "a1", status: "ACTIVE", lead: LEAD, agent: AGENT },
};
const TASK_STEP = {
  id: "ls2", enrollmentId: "e2", stepType: "TASK",
  subject: null, body: null, taskTitle: "Call {{first_name}}",
  dueAt: new Date(), status: "PENDING",
  enrollment: { id: "e2", leadId: "l1", agentId: "a1", status: "ACTIVE", lead: LEAD, agent: AGENT },
};

describe("POST /api/cron/action-plans", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without auth", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it("sends email for EMAIL step and marks DONE", async () => {
    vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([EMAIL_STEP] as any);
    vi.mocked(prisma.leadPlanStep.update).mockResolvedValue({ ...EMAIL_STEP, status: "DONE" } as any);
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);
    vi.mocked(sgMail.send).mockResolvedValue(undefined as any);

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(sgMail.send).toHaveBeenCalledOnce();
    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(call.subject).toBe("Hi John");
    expect(call.text).toContain("Hello John from Jane Agent");
    expect(prisma.leadPlanStep.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ls1" }, data: expect.objectContaining({ status: "DONE" }) })
    );
  });

  it("creates LeadTask for TASK step and marks DONE", async () => {
    vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([TASK_STEP] as any);
    vi.mocked(prisma.leadPlanStep.update).mockResolvedValue({ ...TASK_STEP, status: "DONE" } as any);
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.leadTask.create).mockResolvedValue({} as any);

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(prisma.leadTask.create).toHaveBeenCalledOnce();
    const call = vi.mocked(prisma.leadTask.create).mock.calls[0][0] as any;
    expect(call.data.title).toBe("Call John");
  });

  it("marks enrollment COMPLETED when all steps done", async () => {
    vi.mocked(prisma.leadPlanStep.findMany)
      .mockResolvedValueOnce([]) // no pending steps
      .mockResolvedValueOnce([]); // all steps DONE
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([
      { id: "e1", steps: [{ status: "DONE" }] },
    ] as any);
    vi.mocked(prisma.leadPlanEnrollment.update).mockResolvedValue({} as any);

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(prisma.leadPlanEnrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
pnpm --filter web test src/__tests__/api/cron-action-plans.test.ts
```

Expected: FAIL (modules not found)

- [ ] **Step 3: Create email helper**

Create `apps/web/src/lib/action-plan-email.ts`:

```typescript
import sgMail from "@sendgrid/mail";
import { FROM } from "@/lib/email";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export function substituteVars(
  template: string,
  vars: { firstName: string; lastName: string; agentName: string; agentPhone: string }
): string {
  return template
    .replace(/\{\{first_name\}\}/g, vars.firstName)
    .replace(/\{\{last_name\}\}/g, vars.lastName)
    .replace(/\{\{agent_name\}\}/g, vars.agentName)
    .replace(/\{\{agent_phone\}\}/g, vars.agentPhone);
}

export async function sendActionPlanEmail(opts: {
  to: string;
  subject: string;
  body: string;
  enrollmentId: string;
}): Promise<void> {
  const replyTo = `reply+${opts.enrollmentId}@reply.cncrealtygroup.com`;
  await sgMail.send({
    to: opts.to,
    from: FROM,
    replyTo,
    subject: opts.subject,
    text: opts.body,
  });
}
```

- [ ] **Step 4: Implement the cron route**

Create `apps/web/src/app/api/cron/action-plans/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { substituteVars, sendActionPlanEmail } from "@/lib/action-plan-email";

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
          lead: { select: { id: true, firstName: true, lastName: true } },
          agent: {
            select: { id: true, displayName: true, phone: true, user: { select: { email: true } } },
          },
        },
      },
    },
    orderBy: { dueAt: "asc" },
  });

  let processed = 0;
  let errors = 0;

  for (const step of dueSteps) {
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
        const subject = substituteVars(step.subject ?? "", vars);
        const body = substituteVars(step.body ?? "", vars);
        await sendActionPlanEmail({
          to: agent.user?.email ?? "",
          subject,
          body,
          enrollmentId: enrollment.id,
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
      processed++;
    } catch (e) {
      console.error(`[action-plans-cron] step ${step.id} failed:`, e);
      errors++;
    }
  }

  // Check for newly-completed enrollments
  const enrollmentIds = [...new Set(dueSteps.map((s) => s.enrollmentId))];
  if (enrollmentIds.length > 0) {
    const enrollments = await prisma.leadPlanEnrollment.findMany({
      where: { id: { in: enrollmentIds }, status: "ACTIVE" },
      include: { steps: { select: { status: true } } },
    });
    for (const enr of enrollments) {
      const allDone = enr.steps.every((s) => s.status === "DONE" || s.status === "SKIPPED");
      if (allDone && enr.steps.length > 0) {
        await prisma.leadPlanEnrollment.update({
          where: { id: enr.id },
          data: { status: "COMPLETED", completedAt: now },
        });
      }
    }
  }

  return NextResponse.json({ processed, errors });
}
```

- [ ] **Step 5: Add cron entry to vercel.json**

Open `vercel.json`. Add to the `"crons"` array:
```json
{ "path": "/api/cron/action-plans", "schedule": "0 8 * * *" }
```

- [ ] **Step 6: Run tests and verify all pass**

```powershell
pnpm --filter web test src/__tests__/api/cron-action-plans.test.ts
```

Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/action-plan-email.ts apps/web/src/app/api/cron/action-plans/ apps/web/src/__tests__/api/cron-action-plans.test.ts vercel.json
git commit -m "feat(cron): action plans daily step executor + email helper + vercel.json"
```

---

## Task 5: Inbound Parse Webhook + Tests

**Files:**
- Create: `apps/web/src/app/api/webhooks/sendgrid/inbound/route.ts`
- Create: `apps/web/src/__tests__/webhooks/sendgrid-inbound.test.ts`

**Interfaces:**
- Consumes: `prisma.leadPlanEnrollment`, `prisma.leadPlanStep`, `sendActionPlanEmail` for forwarding
- Produces: auto-pause on lead reply; used by SendGrid Inbound Parse webhook

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/webhooks/sendgrid-inbound.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leadPlanEnrollment: { findUnique: vi.fn(), update: vi.fn() },
    leadPlanStep: { updateMany: vi.fn() },
    agent: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/action-plan-email", () => ({ sendActionPlanEmail: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { sendActionPlanEmail } from "@/lib/action-plan-email";
import { POST } from "../../app/api/webhooks/sendgrid/inbound/route";

const AGENT = { id: "a1", user: { email: "agent@test.com" } };
const ENROLLMENT = {
  id: "e1", leadId: "l1", agentId: "a1", status: "ACTIVE",
  agent: AGENT,
};

function makeRequest(to: string, subject = "Re: Hello", text = "Thanks for reaching out") {
  const form = new FormData();
  form.append("to", to);
  form.append("from", "lead@gmail.com");
  form.append("subject", subject);
  form.append("text", text);
  return new Request("http://localhost/api/webhooks/sendgrid/inbound", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/webhooks/sendgrid/inbound", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 and ignores unknown enrollment IDs", async () => {
    vi.mocked(prisma.leadPlanEnrollment.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("reply+unknown123@reply.cncrealtygroup.com"));
    expect(res.status).toBe(200);
    expect(prisma.leadPlanEnrollment.update).not.toHaveBeenCalled();
  });

  it("pauses ACTIVE enrollment and forwards email to agent", async () => {
    vi.mocked(prisma.leadPlanEnrollment.findUnique).mockResolvedValue(ENROLLMENT as any);
    vi.mocked(prisma.leadPlanEnrollment.update).mockResolvedValue({ ...ENROLLMENT, status: "PAUSED" } as any);
    vi.mocked(prisma.leadPlanStep.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(sendActionPlanEmail).mockResolvedValue(undefined);

    const res = await POST(makeRequest("reply+e1@reply.cncrealtygroup.com"));
    expect(res.status).toBe(200);
    expect(prisma.leadPlanEnrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAUSED", pausedReason: "REPLY" }),
      })
    );
    expect(prisma.leadPlanStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PAUSED" } })
    );
    expect(sendActionPlanEmail).toHaveBeenCalledOnce();
    const fwdCall = vi.mocked(sendActionPlanEmail).mock.calls[0][0];
    expect(fwdCall.to).toBe("agent@test.com");
    expect(fwdCall.subject).toContain("[Lead Reply]");
  });

  it("does not pause already-PAUSED enrollment", async () => {
    vi.mocked(prisma.leadPlanEnrollment.findUnique).mockResolvedValue({ ...ENROLLMENT, status: "PAUSED" } as any);
    const res = await POST(makeRequest("reply+e1@reply.cncrealtygroup.com"));
    expect(res.status).toBe(200);
    expect(prisma.leadPlanEnrollment.update).not.toHaveBeenCalled();
  });

  it("returns 200 when to field contains no valid reply address", async () => {
    const res = await POST(makeRequest("noreply@example.com"));
    expect(res.status).toBe(200);
    expect(prisma.leadPlanEnrollment.findUnique).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
pnpm --filter web test src/__tests__/webhooks/sendgrid-inbound.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement the inbound webhook**

Create `apps/web/src/app/api/webhooks/sendgrid/inbound/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendActionPlanEmail } from "@/lib/action-plan-email";

export const dynamic = "force-dynamic";

const REPLY_PATTERN = /reply\+([a-z0-9]+)@reply\.cncrealtygroup\.com/i;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const to = form.get("to")?.toString() ?? "";
    const subject = form.get("subject")?.toString() ?? "(no subject)";
    const text = form.get("text")?.toString() ?? "";

    const match = REPLY_PATTERN.exec(to);
    if (!match) return NextResponse.json({ ok: true });

    const enrollmentId = match[1];
    const enrollment = await prisma.leadPlanEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { agent: { include: { user: { select: { email: true } } } } },
    });

    if (!enrollment || enrollment.status !== "ACTIVE") return NextResponse.json({ ok: true });

    await prisma.leadPlanEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "PAUSED", pausedAt: new Date(), pausedReason: "REPLY" },
    });

    await prisma.leadPlanStep.updateMany({
      where: { enrollmentId, status: "PENDING" },
      data: { status: "PAUSED" },
    });

    const agentEmail = enrollment.agent?.user?.email;
    if (agentEmail) {
      await sendActionPlanEmail({
        to: agentEmail,
        subject: `[Lead Reply] ${subject}`,
        body: text,
        enrollmentId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[sendgrid-inbound]", e);
    return NextResponse.json({ ok: true }); // Always 200 to stop SendGrid retries
  }
}
```

- [ ] **Step 4: Run tests and verify all pass**

```powershell
pnpm --filter web test src/__tests__/webhooks/sendgrid-inbound.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/webhooks/sendgrid/inbound/ apps/web/src/__tests__/webhooks/sendgrid-inbound.test.ts
git commit -m "feat(webhook): SendGrid Inbound Parse auto-pause on lead reply + tests"
```

---

## Task 6: Admin UI — 3 Drawers + Admin Page

**Files:**
- Create: `apps/web/src/components/action-plans/ActionPlanDrawer.tsx`
- Create: `apps/web/src/components/action-plans/ActionPlanDetailDrawer.tsx`
- Create: `apps/web/src/components/action-plans/ActionPlanStepDrawer.tsx`
- Create: `apps/web/src/app/(dashboard)/dashboard/admin/action-plans/page.tsx`

**Interfaces:**
- Consumes: admin API routes from Task 2; pattern from `LeadTaskDrawer.tsx`
- Produces: admin plan management UI

- [ ] **Step 1: Create ActionPlanDrawer (create/edit plan)**

Create `apps/web/src/components/action-plans/ActionPlanDrawer.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { PULSE_ANIMATE, PULSE_TRANSITION } from "@/lib/motion";

type ActionPlan = { id: string; name: string; description: string | null };

type Props = {
  open: boolean;
  plan: ActionPlan | null;
  onClose: () => void;
  onSaved: (plan: ActionPlan) => void;
};

export function ActionPlanDrawer({ open, plan, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setDescription(plan.description ?? "");
      setError(null);
    } else {
      setName("");
      setDescription("");
      setError(null);
    }
  }, [plan]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const isEdit = !!plan;
      const res = await fetch(
        isEdit ? `/api/admin/action-plans/${plan!.id}` : "/api/admin/action-plans",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to save");
        return;
      }
      const saved = await res.json();
      onSaved(saved);
      onClose();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={open ? "" : "hidden"} role="dialog" aria-modal="true" aria-label={plan ? "Edit Plan" : "New Plan"}>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/10 px-6 py-4">
          <h2 className="font-sans text-lg font-light text-[#1B1B1B]">{plan ? "Edit Plan" : "New Plan"}</h2>
          <button onClick={onClose} className="text-[#1B1B1B]/40 hover:text-[#1B1B1B]" aria-label="Close">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Plan Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
              placeholder="e.g. New Lead 7-Day Drip"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61] resize-none"
              placeholder="Optional description"
            />
          </div>
        </div>
        <div className="border-t border-[#1B1B1B]/10 px-6 py-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[#1B1B1B]/10 px-4 py-2 text-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className={`rounded-lg bg-[#1B1B1B] px-4 py-2 text-sm font-medium text-white disabled:opacity-40 ${PULSE_ANIMATE} ${PULSE_TRANSITION}`}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ActionPlanStepDrawer (create/edit step)**

Create `apps/web/src/components/action-plans/ActionPlanStepDrawer.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { PULSE_ANIMATE, PULSE_TRANSITION } from "@/lib/motion";

type PlanStep = {
  id: string;
  stepOrder: number;
  delayDays: number;
  stepType: "EMAIL" | "TASK";
  subject: string | null;
  body: string | null;
  taskTitle: string | null;
};

type Props = {
  open: boolean;
  planId: string;
  step: PlanStep | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
};

export function ActionPlanStepDrawer({ open, planId, step, onClose, onSaved, onDeleted }: Props) {
  const [stepOrder, setStepOrder] = useState(1);
  const [delayDays, setDelayDays] = useState(0);
  const [stepType, setStepType] = useState<"EMAIL" | "TASK">("EMAIL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step) {
      setStepOrder(step.stepOrder);
      setDelayDays(step.delayDays);
      setStepType(step.stepType);
      setSubject(step.subject ?? "");
      setBody(step.body ?? "");
      setTaskTitle(step.taskTitle ?? "");
      setError(null);
    } else {
      setStepOrder(1);
      setDelayDays(0);
      setStepType("EMAIL");
      setSubject("");
      setBody("");
      setTaskTitle("");
      setError(null);
    }
  }, [step]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = { stepOrder, delayDays, stepType, subject: subject || null, body: body || null, taskTitle: taskTitle || null };
      const url = step
        ? `/api/admin/action-plans/${planId}/steps/${step.id}`
        : `/api/admin/action-plans/${planId}/steps`;
      const res = await fetch(url, {
        method: step ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Failed to save");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!step) return;
    if (!window.confirm("Delete this step?")) return;
    try {
      await fetch(`/api/admin/action-plans/${planId}/steps/${step.id}`, { method: "DELETE" });
      onDeleted();
      onClose();
    } catch {
      setError("Network error — please try again");
    }
  }

  const HINTS = "Available variables: {{first_name}}, {{last_name}}, {{agent_name}}, {{agent_phone}}";

  return (
    <div className={open ? "" : "hidden"} role="dialog" aria-modal="true" aria-label={step ? "Edit Step" : "Add Step"}>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/10 px-6 py-4">
          <h2 className="font-sans text-lg font-light text-[#1B1B1B]">{step ? "Edit Step" : "Add Step"}</h2>
          <button onClick={onClose} className="text-[#1B1B1B]/40 hover:text-[#1B1B1B]" aria-label="Close">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-[#1B1B1B]/50">Step Order</label>
              <input type="number" min={1} value={stepOrder} onChange={(e) => setStepOrder(Number(e.target.value))}
                className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-[#1B1B1B]/50">Delay (days from enrollment)</label>
              <input type="number" min={0} value={delayDays} onChange={(e) => setDelayDays(Number(e.target.value))}
                className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Step Type</label>
            <select value={stepType} onChange={(e) => setStepType(e.target.value as "EMAIL" | "TASK")}
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm">
              <option value="EMAIL">Email</option>
              <option value="TASK">Task</option>
            </select>
          </div>
          {stepType === "EMAIL" && (
            <>
              <div>
                <label className="mb-1 block text-xs text-[#1B1B1B]/50">Subject *</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
                  placeholder="e.g. Hi {{first_name}}, welcome to CnC!" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#1B1B1B]/50">Body *</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6}
                  className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61] resize-none"
                  placeholder={`Email body...\n\n${HINTS}`} />
                <p className="mt-1 text-xs text-[#1B1B1B]/40">{HINTS}</p>
              </div>
            </>
          )}
          {stepType === "TASK" && (
            <div>
              <label className="mb-1 block text-xs text-[#1B1B1B]/50">Task Title *</label>
              <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)}
                className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
                placeholder="e.g. Call {{first_name}} to check in" />
              <p className="mt-1 text-xs text-[#1B1B1B]/40">{HINTS}</p>
            </div>
          )}
        </div>
        <div className="border-t border-[#1B1B1B]/10 px-6 py-4 flex items-center gap-2">
          {step && (
            <button onClick={handleDelete} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-500 hover:bg-red-50">Delete</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="rounded-lg border border-[#1B1B1B]/10 px-4 py-2 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className={`rounded-lg bg-[#1B1B1B] px-4 py-2 text-sm font-medium text-white disabled:opacity-40 ${PULSE_ANIMATE} ${PULSE_TRANSITION}`}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ActionPlanDetailDrawer (step list)**

Create `apps/web/src/components/action-plans/ActionPlanDetailDrawer.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { ActionPlanStepDrawer } from "./ActionPlanStepDrawer";

type PlanStep = {
  id: string;
  stepOrder: number;
  delayDays: number;
  stepType: "EMAIL" | "TASK";
  subject: string | null;
  body: string | null;
  taskTitle: string | null;
};

type ActionPlan = { id: string; name: string; description: string | null; isActive: boolean };

type Props = {
  open: boolean;
  plan: ActionPlan | null;
  onClose: () => void;
  onPlanChanged: () => void;
  onDeletePlan: (planId: string) => void;
};

export function ActionPlanDetailDrawer({ open, plan, onClose, onPlanChanged, onDeletePlan }: Props) {
  const [steps, setSteps] = useState<PlanStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepDrawerOpen, setStepDrawerOpen] = useState(false);
  const [editStep, setEditStep] = useState<PlanStep | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!plan || !open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/action-plans/${plan.id}/steps`)
      .then((r) => r.json())
      .then((data) => setSteps(Array.isArray(data) ? data.sort((a: PlanStep, b: PlanStep) => a.stepOrder - b.stepOrder) : []))
      .catch(() => setError("Failed to load steps"))
      .finally(() => setLoading(false));
  }, [plan, open]);

  async function toggleActive() {
    if (!plan) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/admin/action-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !plan.isActive }),
      });
      if (res.ok) onPlanChanged();
    } finally {
      setToggling(false);
    }
  }

  function reloadSteps() {
    if (!plan) return;
    fetch(`/api/admin/action-plans/${plan.id}/steps`)
      .then((r) => r.json())
      .then((data) => setSteps(Array.isArray(data) ? data.sort((a: PlanStep, b: PlanStep) => a.stepOrder - b.stepOrder) : []));
  }

  const DELAY_LABEL = (d: number) => d === 0 ? "Day 0 (immediately)" : `Day ${d}`;

  return (
    <>
      <div className={open ? "" : "hidden"} role="dialog" aria-modal="true" aria-label="Plan Details">
        <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
        <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#1B1B1B]/10 px-6 py-4">
            <div>
              <h2 className="font-sans text-lg font-light text-[#1B1B1B]">{plan?.name}</h2>
              {plan?.description && <p className="text-xs text-[#1B1B1B]/50 mt-0.5">{plan.description}</p>}
            </div>
            <button onClick={onClose} className="text-[#1B1B1B]/40 hover:text-[#1B1B1B]" aria-label="Close">✕</button>
          </div>

          <div className="flex items-center justify-between px-6 py-3 border-b border-[#1B1B1B]/10">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#1B1B1B]/50">Active</span>
              <button
                onClick={toggleActive}
                disabled={toggling}
                className={`w-10 h-5 rounded-full transition-colors ${plan?.isActive ? "bg-[#9E8C61]" : "bg-[#1B1B1B]/20"}`}
              >
                <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${plan?.isActive ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            <button
              onClick={() => { setEditStep(null); setStepDrawerOpen(true); }}
              className="rounded-lg bg-[#1B1B1B] px-3 py-1.5 text-xs font-medium text-white"
            >
              + Add Step
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {error && <p className="text-sm text-red-500">{error}</p>}
            {loading && <p className="text-sm text-[#1B1B1B]/40">Loading…</p>}
            {!loading && steps.length === 0 && <p className="text-sm text-[#1B1B1B]/40">No steps yet. Add one above.</p>}
            {steps.map((s) => (
              <button
                key={s.id}
                onClick={() => { setEditStep(s); setStepDrawerOpen(true); }}
                className="w-full text-left rounded-lg bg-[#F2F0EF] px-4 py-3 hover:bg-[#F2F0EF]/70 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.stepType === "EMAIL" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                      {s.stepType}
                    </span>
                    <span className="text-xs text-[#1B1B1B]/50">{DELAY_LABEL(s.delayDays)}</span>
                  </div>
                  <span className="text-xs text-[#1B1B1B]/30">#{s.stepOrder}</span>
                </div>
                <p className="mt-1 text-sm text-[#1B1B1B] truncate">
                  {s.stepType === "EMAIL" ? s.subject : s.taskTitle}
                </p>
              </button>
            ))}
          </div>

          <div className="border-t border-[#1B1B1B]/10 px-6 py-4">
            <button
              onClick={() => plan && onDeletePlan(plan.id)}
              className="text-sm text-red-500 hover:underline"
            >
              Delete plan
            </button>
          </div>
        </div>
      </div>

      {plan && (
        <ActionPlanStepDrawer
          open={stepDrawerOpen}
          planId={plan.id}
          step={editStep}
          onClose={() => setStepDrawerOpen(false)}
          onSaved={reloadSteps}
          onDeleted={reloadSteps}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Implement the admin page**

Create `apps/web/src/app/(dashboard)/dashboard/admin/action-plans/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { PULSE_ANIMATE, PULSE_TRANSITION } from "@/lib/motion";
import { ActionPlanDrawer } from "@/components/action-plans/ActionPlanDrawer";
import { ActionPlanDetailDrawer } from "@/components/action-plans/ActionPlanDetailDrawer";

type Plan = { id: string; name: string; description: string | null; isActive: boolean; stepCount: number; createdAt: string };

export const dynamic = "force-dynamic";

export default function ActionPlansAdminPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDrawerOpen, setNewDrawerOpen] = useState(false);
  const [detailPlan, setDetailPlan] = useState<Plan | null>(null);

  function loadPlans() {
    setLoading(true);
    fetch("/api/admin/action-plans")
      .then((r) => r.json())
      .then(setPlans)
      .catch(() => setError("Failed to load plans"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadPlans(); }, []);

  async function handleDeletePlan(planId: string) {
    if (!window.confirm("Delete this plan? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/action-plans/${planId}`, { method: "DELETE" });
    if (res.status === 409) {
      alert("Cannot delete plan with active enrollments.");
      return;
    }
    setDetailPlan(null);
    loadPlans();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Action Plans</h1>
          <p className="mt-1 text-sm text-[#1B1B1B]/40">Create and manage automated drip sequences for agents to apply to leads</p>
        </div>
        <button
          onClick={() => setNewDrawerOpen(true)}
          className={`rounded-full bg-[#1B1B1B] px-5 py-2.5 text-sm font-medium text-white ${PULSE_ANIMATE} ${PULSE_TRANSITION}`}
        >
          + New Plan
        </button>
      </div>

      {loading && <p className="text-sm text-[#1B1B1B]/40">Loading…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && plans.length === 0 && (
        <p className="text-center text-sm text-[#1B1B1B]/40 py-12">No action plans yet. Create one above.</p>
      )}

      <div className="space-y-2">
        {plans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setDetailPlan(plan)}
            className="w-full text-left rounded-lg bg-[#F2F0EF] px-5 py-4 hover:bg-[#F2F0EF]/70 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${plan.isActive ? "bg-green-100 text-green-700" : "bg-[#1B1B1B]/10 text-[#1B1B1B]/50"}`}>
                  {plan.isActive ? "Active" : "Inactive"}
                </span>
                <h3 className="text-sm font-medium text-[#1B1B1B]">{plan.name}</h3>
              </div>
              <span className="text-xs text-[#1B1B1B]/40">{plan.stepCount} step{plan.stepCount !== 1 ? "s" : ""}</span>
            </div>
            {plan.description && <p className="mt-1 text-xs text-[#1B1B1B]/50 truncate">{plan.description}</p>}
          </button>
        ))}
      </div>

      <ActionPlanDrawer
        open={newDrawerOpen}
        plan={null}
        onClose={() => setNewDrawerOpen(false)}
        onSaved={() => { setNewDrawerOpen(false); loadPlans(); }}
      />

      <ActionPlanDetailDrawer
        open={!!detailPlan}
        plan={detailPlan}
        onClose={() => setDetailPlan(null)}
        onPlanChanged={loadPlans}
        onDeletePlan={handleDeletePlan}
      />
    </div>
  );
}
```

- [ ] **Step 5: Add `GET /api/admin/action-plans/[id]/steps` route for detail drawer**

The detail drawer fetches `/api/admin/action-plans/${plan.id}/steps`. Add this to `apps/web/src/app/api/admin/action-plans/[id]/route.ts`:

```typescript
// Add at the top of the existing [id]/route.ts, before PATCH:
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const plan = await prisma.actionPlan.findUnique({
    where: { id: params.id },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(plan.steps);
}
```

Wait — actually the detail drawer fetches the steps directly from `/api/admin/action-plans/[id]/steps`, not from `[id]`. But `steps/route.ts` only has `POST`. Add the GET to `steps/route.ts`:

Add to `apps/web/src/app/api/admin/action-plans/[id]/steps/route.ts` BEFORE the POST function:

```typescript
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;
  const steps = await prisma.actionPlanStep.findMany({
    where: { planId: params.id },
    orderBy: { stepOrder: "asc" },
  });
  return NextResponse.json(steps);
}
```

- [ ] **Step 6: Add Action Plans to admin nav**

Open `apps/web/src/app/(dashboard)/layout.tsx`. Find `ADMIN_NAV` (the admin nav links array). Add:

```typescript
{ href: "/dashboard/admin/action-plans", label: "Action Plans" },
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/action-plans/ apps/web/src/app/(dashboard)/dashboard/admin/action-plans/ apps/web/src/app/api/admin/action-plans/ apps/web/src/app/(dashboard)/layout.tsx
git commit -m "feat(ui): admin action plans page + 3 drawers"
```

---

## Task 7: Lead Profile Action Plans Section

**Files:**
- Create: `apps/web/src/components/leads/LeadActionPlansSection.tsx`

**Interfaces:**
- Consumes: `GET /api/leads/[id]/enrollments`, `POST /api/leads/[id]/enrollments`, `PATCH /api/leads/[id]/enrollments/[enrollmentId]`, `GET /api/admin/action-plans` (active plans list)
- Produces: Action Plans section displayed on lead detail page

- [ ] **Step 1: Create LeadActionPlansSection**

Create `apps/web/src/components/leads/LeadActionPlansSection.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

type EnrollmentStep = {
  id: string;
  stepOrder: number;
  stepType: "EMAIL" | "TASK";
  subject: string | null;
  taskTitle: string | null;
  dueAt: string;
  status: "PENDING" | "DONE" | "SKIPPED" | "PAUSED";
  executedAt: string | null;
};

type Enrollment = {
  id: string;
  planId: string;
  planName: string;
  agentId: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  enrolledAt: string;
  pausedAt: string | null;
  pausedReason: string | null;
  completedAt: string | null;
  steps: EnrollmentStep[];
};

type ActivePlan = { id: string; name: string; stepCount: number };

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-[#1B1B1B]/10 text-[#1B1B1B]/50",
};

const STEP_STATUS_COLORS: Record<string, string> = {
  PENDING: "text-[#1B1B1B]/50",
  DONE: "text-green-600",
  SKIPPED: "text-[#1B1B1B]/30 line-through",
  PAUSED: "text-amber-600",
};

export function LeadActionPlansSection({ leadId }: { leadId: string }) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [activePlans, setActivePlans] = useState<ActivePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/leads/${leadId}/enrollments`, { signal: controller.signal }).then((r) => r.json()),
      fetch("/api/admin/action-plans", { signal: controller.signal }).then((r) => r.json()),
    ])
      .then(([enrs, plans]) => {
        setEnrollments(Array.isArray(enrs) ? enrs : []);
        setActivePlans(Array.isArray(plans) ? plans.filter((p: any) => p.isActive) : []);
      })
      .catch((e) => { if (e.name !== "AbortError") setError("Failed to load action plans"); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [leadId]);

  async function enroll(planId: string) {
    setEnrolling(true);
    setActionError(null);
    setShowPlanPicker(false);
    try {
      const res = await fetch(`/api/leads/${leadId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setActionError(b.error ?? "Failed to enroll");
        return;
      }
      const enr = await res.json();
      setEnrollments((prev) => [enr, ...prev]);
    } catch {
      setActionError("Network error — please try again");
    } finally {
      setEnrolling(false);
    }
  }

  async function updateEnrollment(enrollmentId: string, status: "PAUSED" | "ACTIVE" | "CANCELLED") {
    setActionError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/enrollments/${enrollmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setActionError(b.error ?? "Failed to update");
        return;
      }
      const updated = await res.json();
      setEnrollments((prev) => prev.map((e) => (e.id === enrollmentId ? { ...e, status: updated.status } : e)));
    } catch {
      setActionError("Network error — please try again");
    }
  }

  const doneCount = (e: Enrollment) => e.steps.filter((s) => s.status === "DONE").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#1B1B1B]">Action Plans</h3>
        <div className="relative">
          <button
            onClick={() => setShowPlanPicker(!showPlanPicker)}
            disabled={enrolling}
            className="text-xs rounded-lg border border-[#1B1B1B]/10 px-3 py-1.5 hover:bg-[#F2F0EF] disabled:opacity-40"
          >
            {enrolling ? "Enrolling…" : "Apply Plan"}
          </button>
          {showPlanPicker && activePlans.length > 0 && (
            <div className="absolute right-0 top-full mt-1 z-10 w-64 rounded-lg border border-[#1B1B1B]/10 bg-white shadow-lg">
              {activePlans.map((p) => (
                <button
                  key={p.id}
                  onClick={() => enroll(p.id)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F2F0EF] first:rounded-t-lg last:rounded-b-lg"
                >
                  <span className="block font-medium text-[#1B1B1B]">{p.name}</span>
                  <span className="text-xs text-[#1B1B1B]/40">{p.stepCount} steps</span>
                </button>
              ))}
            </div>
          )}
          {showPlanPicker && activePlans.length === 0 && (
            <div className="absolute right-0 top-full mt-1 z-10 w-56 rounded-lg border border-[#1B1B1B]/10 bg-white shadow-lg px-4 py-3">
              <p className="text-xs text-[#1B1B1B]/50">No active plans. Ask your admin to create one.</p>
            </div>
          )}
        </div>
      </div>

      {actionError && <p className="text-sm text-red-500">{actionError}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading && <p className="text-sm text-[#1B1B1B]/40">Loading…</p>}

      {!loading && enrollments.length === 0 && (
        <p className="text-sm text-[#1B1B1B]/40">No action plans applied to this lead.</p>
      )}

      <div className="space-y-3">
        {enrollments.map((enr) => {
          const done = doneCount(enr);
          const total = enr.steps.length;
          const next = enr.steps.find((s) => s.status === "PENDING");
          const isExpanded = expandedId === enr.id;

          return (
            <div key={enr.id} className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF]">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[enr.status]}`}>
                      {enr.status}
                    </span>
                    <span className="text-sm text-[#1B1B1B]">{enr.planName}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#1B1B1B]/50">
                    {done}/{total} steps complete
                    {next && ` · next due ${formatDate(next.dueAt)}`}
                    {enr.pausedReason === "REPLY" && " · paused (lead replied)"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {enr.status === "ACTIVE" && (
                    <button onClick={() => updateEnrollment(enr.id, "PAUSED")} className="text-xs text-[#1B1B1B]/50 hover:text-amber-600">Pause</button>
                  )}
                  {enr.status === "PAUSED" && (
                    <button onClick={() => updateEnrollment(enr.id, "ACTIVE")} className="text-xs text-[#1B1B1B]/50 hover:text-green-600">Resume</button>
                  )}
                  {(enr.status === "ACTIVE" || enr.status === "PAUSED") && (
                    <button onClick={() => updateEnrollment(enr.id, "CANCELLED")} className="text-xs text-[#1B1B1B]/50 hover:text-red-500">Cancel</button>
                  )}
                  <button onClick={() => setExpandedId(isExpanded ? null : enr.id)} className="text-xs text-[#1B1B1B]/40 hover:text-[#1B1B1B]">
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-[#1B1B1B]/10 px-4 py-3 space-y-1.5">
                  {enr.steps.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-xs">
                      <span className={`w-4 text-center font-medium ${STEP_STATUS_COLORS[s.status]}`}>
                        {s.status === "DONE" ? "✓" : s.status === "SKIPPED" ? "—" : s.stepOrder}
                      </span>
                      <span className={`flex-1 ${STEP_STATUS_COLORS[s.status]}`}>
                        {s.stepType === "EMAIL" ? s.subject : s.taskTitle}
                      </span>
                      <span className="text-[#1B1B1B]/30">{formatDate(s.dueAt)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        s.stepType === "EMAIL" ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
                      }`}>{s.stepType}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire LeadActionPlansSection into the lead detail page**

Find the lead detail page at `apps/web/src/app/(dashboard)/dashboard/leads/[id]/page.tsx` (or similar path). Import and add `LeadActionPlansSection`:

```tsx
import { LeadActionPlansSection } from "@/components/leads/LeadActionPlansSection";
```

Add inside the lead detail layout, after the Tasks section:

```tsx
<LeadActionPlansSection leadId={lead.id} />
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/leads/LeadActionPlansSection.tsx apps/web/src/app/(dashboard)/dashboard/leads/
git commit -m "feat(ui): LeadActionPlansSection — apply plans, view progress, pause/resume/cancel"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| 4 new Prisma models + 4 enums | Task 1 |
| `GET/POST /api/admin/action-plans` | Task 2 |
| `PATCH/DELETE /api/admin/action-plans/[id]` | Task 2 |
| `POST /api/admin/action-plans/[id]/steps` | Task 2 |
| `PATCH/DELETE /api/admin/action-plans/[id]/steps/[stepId]` | Task 2 |
| Admin DELETE returns 409 if active enrollments | Task 2 |
| `GET/POST /api/leads/[id]/enrollments` | Task 3 |
| POST creates enrollment + materializes all steps with computed dueAt | Task 3 |
| POST returns 409 if already ACTIVE in same plan | Task 3 |
| `PATCH /api/leads/[id]/enrollments/[enrollmentId]` — pause/resume/cancel | Task 3 |
| PAUSED: sets pausedAt + MANUAL + flips PENDING→PAUSED | Task 3 |
| ACTIVE (resume): clears pausedAt + PAUSED→PENDING | Task 3 |
| CANCELLED: flips PENDING/PAUSED→SKIPPED | Task 3 |
| Variable substitution: `{{first_name}}` etc. | Task 4 |
| EMAIL steps: SendGrid plain text, Reply-To `reply+{enrollmentId}@reply.cncrealtygroup.com` | Task 4 |
| TASK steps: create LeadTask | Task 4 |
| Enrollment marked COMPLETED when all steps DONE | Task 4 |
| `vercel.json` cron `0 8 * * *` | Task 4 |
| `maxDuration = 60` on cron route | Task 4 |
| Inbound Parse webhook auto-pause on reply | Task 5 |
| Forward email to agent's `user.email` with `[Lead Reply] ` prefix | Task 5 |
| Returns 200 always (stop SendGrid retries) | Task 5 |
| `ActionPlanDrawer` — create/edit plan | Task 6 |
| `ActionPlanDetailDrawer` — step list, add/edit, isActive toggle | Task 6 |
| `ActionPlanStepDrawer` — EMAIL/TASK fields + variable hints | Task 6 |
| Admin page at `/dashboard/admin/action-plans` | Task 6 |
| `LeadActionPlansSection` — enroll, progress, expand steps, pause/resume/cancel | Task 7 |
| 4 test files | Tasks 2, 3, 4, 5 |

**No placeholder scan:** All steps contain actual code. No TBDs.

**Type consistency:**
- `PlanStepType` enum used consistently as `"EMAIL" | "TASK"` in TypeScript (string union matches Prisma enum)
- `EnrollmentStatus` used as `"ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED"` throughout
- `assertOwnership` pattern is consistent with existing routes (returns `boolean`, same logic)
- `substituteVars` function signature matches usage in cron route
- `sendActionPlanEmail` `opts` object matches both cron (task 4) and inbound webhook (task 5) usage
