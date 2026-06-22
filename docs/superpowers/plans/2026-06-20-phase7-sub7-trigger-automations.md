# Trigger Automations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-configured status-change triggers that automatically enroll leads in action plans or send them one-time emails, firing once per lead when a lead's status is updated.

**Architecture:** Two new Prisma models (`Trigger`, `TriggerExecution`) store config and fire history. Four CRUD API routes handle admin management. Execution logic is injected into the existing `PATCH /api/leads/[id]` route — after a successful status update, matching active triggers run synchronously but non-fatally. A new admin page with a create/edit drawer mirrors the `/admin/action-plans` pattern.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Prisma ORM, PostgreSQL, Tailwind CSS, Framer Motion, SendGrid, vitest

## Global Constraints

- Auth: `const { error } = await requireAuth("ADMIN")` from `@/lib/api-auth` — destructure, return `error` immediately if set
- `export const dynamic = "force-dynamic"` on every route file that reads session
- CTA buttons: `motion.button` from `framer-motion` with `animate={PULSE_ANIMATE}` and `transition={PULSE_TRANSITION}` from `@/lib/motion` — these are animation OBJECTS not className strings; also `whileHover={{ scale: 1.05, transition: SPRING_HOVER }}`
- `PULSE_ANIMATE = { scale: [1, 1.04, 1] } as const`, `PULSE_TRANSITION = { duration: 2, repeat: Infinity, ease: "easeInOut" } as const`, `SPRING_HOVER = { type: "spring", stiffness: 300, damping: 20 } as const` — all from `@/lib/motion`
- No toast library — inline error state only (`const [error, setError] = useState<string | null>(null)`)
- Gold accent: `#9E8C61`; off-white bg: `#F2F0EF`; dark text: `#1B1B1B`
- Always-mounted drawer pattern: CSS `hidden` class on wrapper div, NOT conditional render
- Zod v4 error access: `err.issues[0].message` (NOT `err.errors`)
- vitest pattern: `vi.mock("next-auth", ...)` + `vi.mock("@/lib/auth", ...)` + `vi.mock("@/lib/prisma", ...)`
- Admin pages live at `(dashboard)/admin/` — NOT `(dashboard)/dashboard/admin/`
- SendGrid: `sgMail.setApiKey(process.env.SENDGRID_API_KEY!)` before `sgMail.send()`, FROM from `@/lib/email`, failure non-fatal (catch + console.error)
- MERGE_BASE for Sub-project 7: `567e673` (HEAD after Sub6 final review)
- Windows machine — use PowerShell for all shell commands

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `packages/database/prisma/schema.prisma` | Add `TriggerActionType` enum, `Trigger` model, `TriggerExecution` model, `triggers` relation on `ActionPlan` |
| Create | `apps/web/src/app/api/admin/triggers/route.ts` | GET (list) + POST (create) |
| Create | `apps/web/src/app/api/admin/triggers/[id]/route.ts` | PATCH (update) + DELETE |
| Modify | `apps/web/src/app/api/leads/[id]/route.ts` | Inject trigger execution block after lead PATCH; add `email` to select |
| Create | `apps/web/src/app/(dashboard)/admin/triggers/page.tsx` | Client page: trigger list + New Trigger button |
| Create | `apps/web/src/components/triggers/TriggerDrawer.tsx` | Create/edit drawer (always-mounted CSS hidden) |
| Create | `apps/web/src/__tests__/api/triggers.test.ts` | vitest: CRUD routes + execution logic |

---

## Task 1: Schema — Add Trigger Models

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

**Interfaces:**
- Produces: `Trigger`, `TriggerExecution`, `TriggerActionType` — consumed by all later tasks

- [ ] **Step 1: Add the enum and two models to schema.prisma**

Open `packages/database/prisma/schema.prisma`. Add the following **after the existing `PlanStepType` enum** and **before the `model User` block**. Also add a `triggers TriggerExecution[]` relation to the `ActionPlan` model's existing field list (after `enrollments LeadPlanEnrollment[]` on line ~618).

New enum (add with the other enums near the top of the file, after the last existing enum):

```prisma
enum TriggerActionType {
  ENROLL_PLAN
  SEND_EMAIL
}
```

New models (add at the bottom of the file, after the last model):

```prisma
model Trigger {
  id            String            @id @default(cuid())
  name          String
  statusTrigger LeadStatus
  actionType    TriggerActionType
  actionPlanId  String?
  emailSubject  String?
  emailBody     String?
  isActive      Boolean           @default(true)
  createdAt     DateTime          @default(now())

  actionPlan  ActionPlan?        @relation(fields: [actionPlanId], references: [id])
  executions  TriggerExecution[]
}

model TriggerExecution {
  id         String   @id @default(cuid())
  triggerId  String
  leadId     String
  executedAt DateTime @default(now())

  trigger Trigger @relation(fields: [triggerId], references: [id], onDelete: Cascade)

  @@unique([triggerId, leadId])
}
```

Also add to `model ActionPlan { ... }` (after the `enrollments` line):
```prisma
  triggers    Trigger[]
```

- [ ] **Step 2: Run the migration**

```powershell
pnpm --filter @cnc/database exec prisma migrate dev --name add_trigger_automations
```

Expected output: `The following migration(s) have been applied: .../add_trigger_automations/migration.sql`

- [ ] **Step 3: Regenerate Prisma client**

```powershell
pnpm --filter @cnc/database exec prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(sub7): add Trigger + TriggerExecution schema models"
```

---

## Task 2: CRUD API Routes (TDD)

**Files:**
- Create: `apps/web/src/app/api/admin/triggers/route.ts`
- Create: `apps/web/src/app/api/admin/triggers/[id]/route.ts`
- Create: `apps/web/src/__tests__/api/triggers.test.ts`

**Interfaces:**
- Consumes: `requireAuth("ADMIN")` from `@/lib/api-auth`; `prisma` from `@/lib/prisma`
- Produces:
  - `GET /api/admin/triggers` → `TriggerRow[]` (shape below) — consumed by Task 4 (admin page)
  - `POST /api/admin/triggers` body: `{ name, statusTrigger, actionType, actionPlanId?, emailSubject?, emailBody? }` → 201
  - `PATCH /api/admin/triggers/[id]` body: partial of above → 200
  - `DELETE /api/admin/triggers/[id]` → 204

```ts
type TriggerRow = {
  id: string;
  name: string;
  statusTrigger: string;
  actionType: "ENROLL_PLAN" | "SEND_EMAIL";
  actionPlanId: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  isActive: boolean;
  createdAt: string; // ISO
  actionPlan: { name: string } | null;
};
```

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/api/triggers.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trigger: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    actionPlan: { findUnique: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../../app/api/admin/triggers/route";
import { PATCH, DELETE } from "../../app/api/admin/triggers/[id]/route";

const ADMIN_SESSION = { user: { id: "u1", role: "ADMIN" } };
const AGENT_SESSION = { user: { id: "u2", role: "AGENT" } };

const TRIGGER_ENROLL = {
  id: "t1",
  name: "Auto-qualify drip",
  statusTrigger: "QUALIFIED",
  actionType: "ENROLL_PLAN",
  actionPlanId: "p1",
  emailSubject: null,
  emailBody: null,
  isActive: true,
  createdAt: new Date("2026-06-20T10:00:00Z"),
  actionPlan: { name: "7-Day Drip" },
};

const TRIGGER_EMAIL = {
  id: "t2",
  name: "Under contract congrats",
  statusTrigger: "UNDER_CONTRACT",
  actionType: "SEND_EMAIL",
  actionPlanId: null,
  emailSubject: "Your offer was accepted!",
  emailBody: "Congratulations!",
  isActive: true,
  createdAt: new Date("2026-06-20T10:00:00Z"),
  actionPlan: null,
};

const TRIGGER_PARAMS = { params: { id: "t1" } };

// ─── GET /api/admin/triggers ──────────────────────────────────────────────────

describe("GET /api/admin/triggers", () => {
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

  it("returns 200 with trigger list for admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.trigger.findMany).mockResolvedValue([TRIGGER_ENROLL] as any);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Auto-qualify drip");
  });
});

// ─── POST /api/admin/triggers ─────────────────────────────────────────────────

describe("POST /api/admin/triggers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const req = new Request("http://localhost/api/admin/triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", statusTrigger: "QUALIFIED", actionType: "ENROLL_PLAN", actionPlanId: "p1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    const req = new Request("http://localhost/api/admin/triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusTrigger: "QUALIFIED", actionType: "ENROLL_PLAN", actionPlanId: "p1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for ENROLL_PLAN without actionPlanId", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    const req = new Request("http://localhost/api/admin/triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", statusTrigger: "QUALIFIED", actionType: "ENROLL_PLAN" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for SEND_EMAIL without emailSubject", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    const req = new Request("http://localhost/api/admin/triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", statusTrigger: "UNDER_CONTRACT", actionType: "SEND_EMAIL", emailBody: "Body" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates ENROLL_PLAN trigger and returns 201", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.actionPlan.findUnique).mockResolvedValue({ id: "p1", name: "7-Day Drip" } as any);
    vi.mocked(prisma.trigger.create).mockResolvedValue(TRIGGER_ENROLL as any);
    const req = new Request("http://localhost/api/admin/triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Auto-qualify drip", statusTrigger: "QUALIFIED", actionType: "ENROLL_PLAN", actionPlanId: "p1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.actionType).toBe("ENROLL_PLAN");
  });
});

// ─── PATCH /api/admin/triggers/[id] ──────────────────────────────────────────

describe("PATCH /api/admin/triggers/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const req = new Request("http://localhost/api/admin/triggers/t1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    const res = await PATCH(req, TRIGGER_PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when trigger not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.trigger.update).mockRejectedValue(
      Object.assign(new Error("Not found"), { code: "P2025" })
    );
    const req = new Request("http://localhost/api/admin/triggers/t1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    const res = await PATCH(req, TRIGGER_PARAMS);
    expect(res.status).toBe(404);
  });

  it("updates isActive and returns 200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.trigger.update).mockResolvedValue({ ...TRIGGER_ENROLL, isActive: false } as any);
    const req = new Request("http://localhost/api/admin/triggers/t1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    const res = await PATCH(req, TRIGGER_PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isActive).toBe(false);
  });
});

// ─── DELETE /api/admin/triggers/[id] ─────────────────────────────────────────

describe("DELETE /api/admin/triggers/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost/api/admin/triggers/t1", { method: "DELETE" }), TRIGGER_PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when trigger not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.trigger.delete).mockRejectedValue(
      Object.assign(new Error("Not found"), { code: "P2025" })
    );
    const res = await DELETE(new Request("http://localhost/api/admin/triggers/t1", { method: "DELETE" }), TRIGGER_PARAMS);
    expect(res.status).toBe(404);
  });

  it("deletes trigger and returns 204", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.trigger.delete).mockResolvedValue(TRIGGER_ENROLL as any);
    const res = await DELETE(new Request("http://localhost/api/admin/triggers/t1", { method: "DELETE" }), TRIGGER_PARAMS);
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```powershell
pnpm --filter web exec vitest run src/__tests__/api/triggers.test.ts
```

Expected: FAIL with "Cannot find module" errors for the route files.

- [ ] **Step 3: Create GET + POST route**

Create `apps/web/src/app/api/admin/triggers/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "NEW", "CONTACTED", "QUALIFIED", "HOT_PROSPECT", "NURTURE",
  "SHOWING", "OFFER", "UNDER_CONTRACT", "CLOSED", "LOST", "SPHERE",
] as const;

const VALID_ACTION_TYPES = ["ENROLL_PLAN", "SEND_EMAIL"] as const;

export async function GET() {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const triggers = await prisma.trigger.findMany({
    orderBy: { createdAt: "asc" },
    include: { actionPlan: { select: { name: true } } },
  });

  return NextResponse.json(
    triggers.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))
  );
}

export async function POST(req: Request) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const { name, statusTrigger, actionType, actionPlanId, emailSubject, emailBody } =
    body as {
      name?: string;
      statusTrigger?: string;
      actionType?: string;
      actionPlanId?: string;
      emailSubject?: string;
      emailBody?: string;
    };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!statusTrigger || !VALID_STATUSES.includes(statusTrigger as any)) {
    return NextResponse.json({ error: "valid statusTrigger is required" }, { status: 400 });
  }
  if (!actionType || !VALID_ACTION_TYPES.includes(actionType as any)) {
    return NextResponse.json({ error: "actionType must be ENROLL_PLAN or SEND_EMAIL" }, { status: 400 });
  }
  if (actionType === "ENROLL_PLAN" && !actionPlanId) {
    return NextResponse.json({ error: "actionPlanId is required for ENROLL_PLAN" }, { status: 400 });
  }
  if (actionType === "SEND_EMAIL" && !emailSubject?.trim()) {
    return NextResponse.json({ error: "emailSubject is required for SEND_EMAIL" }, { status: 400 });
  }
  if (actionType === "SEND_EMAIL" && !emailBody?.trim()) {
    return NextResponse.json({ error: "emailBody is required for SEND_EMAIL" }, { status: 400 });
  }

  if (actionPlanId) {
    const plan = await prisma.actionPlan.findUnique({ where: { id: actionPlanId } });
    if (!plan) {
      return NextResponse.json({ error: "Action plan not found" }, { status: 404 });
    }
  }

  const trigger = await prisma.trigger.create({
    data: {
      name: name.trim(),
      statusTrigger: statusTrigger as any,
      actionType: actionType as any,
      actionPlanId: actionType === "ENROLL_PLAN" ? actionPlanId : null,
      emailSubject: actionType === "SEND_EMAIL" ? emailSubject!.trim() : null,
      emailBody: actionType === "SEND_EMAIL" ? emailBody!.trim() : null,
    },
    include: { actionPlan: { select: { name: true } } },
  });

  return NextResponse.json({ ...trigger, createdAt: trigger.createdAt.toISOString() }, { status: 201 });
}
```

- [ ] **Step 4: Create PATCH + DELETE route**

Create `apps/web/src/app/api/admin/triggers/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const { name, statusTrigger, actionType, actionPlanId, emailSubject, emailBody, isActive } =
    body as {
      name?: string;
      statusTrigger?: string;
      actionType?: string;
      actionPlanId?: string | null;
      emailSubject?: string | null;
      emailBody?: string | null;
      isActive?: boolean;
    };

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (statusTrigger !== undefined) data.statusTrigger = statusTrigger;
  if (actionType !== undefined) data.actionType = actionType;
  if (actionPlanId !== undefined) data.actionPlanId = actionPlanId;
  if (emailSubject !== undefined) data.emailSubject = emailSubject;
  if (emailBody !== undefined) data.emailBody = emailBody;
  if (isActive !== undefined) data.isActive = isActive;

  try {
    const trigger = await prisma.trigger.update({
      where: { id: params.id },
      data,
      include: { actionPlan: { select: { name: true } } },
    });
    return NextResponse.json({ ...trigger, createdAt: trigger.createdAt.toISOString() });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  try {
    await prisma.trigger.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }
    throw e;
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```powershell
pnpm --filter web exec vitest run src/__tests__/api/triggers.test.ts
```

Expected: all tests pass (11 tests, 0 failures).

- [ ] **Step 6: Verify TypeScript compiles**

```powershell
pnpm --filter web exec tsc --noEmit
```

Expected: no new errors from the new route files.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/admin/triggers/ apps/web/src/__tests__/api/triggers.test.ts
git commit -m "feat(sub7): trigger CRUD routes + 11 tests"
```

---

## Task 3: Trigger Execution in PATCH /api/leads/[id]

**Files:**
- Modify: `apps/web/src/app/api/leads/[id]/route.ts`
- Modify: `apps/web/src/__tests__/api/triggers.test.ts` (add execution tests)

**Interfaces:**
- Consumes: `Trigger`, `TriggerExecution` from Task 1 schema; `sgMail` from `@sendgrid/mail`; `FROM` from `@/lib/email`
- Produces: Modified PATCH handler that fires triggers after status change — no change to response shape

- [ ] **Step 1: Add execution tests to the existing test file**

Append to `apps/web/src/__tests__/api/triggers.test.ts`. First add new mocks at the top of the file (extend the existing `vi.mock("@/lib/prisma", ...)` to include the new methods, and add new mocks for sendgrid and email):

Replace the existing `vi.mock("@/lib/prisma", ...)` block with:

```typescript
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trigger: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    actionPlan: { findUnique: vi.fn() },
    lead: { update: vi.fn() },
    triggerExecution: { create: vi.fn() },
    leadPlanEnrollment: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));
```

Also add near the top (with the other mocks):

```typescript
vi.mock("@sendgrid/mail", () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue([{}, {}]) },
}));
vi.mock("@/lib/email", () => ({ FROM: "noreply@cncrealtygroup.com" }));
```

Then add new imports after the existing route imports:

```typescript
import { PATCH as PATCH_LEAD } from "../../app/api/leads/[id]/route";
```

Then append the new describe block to the bottom of the file:

```typescript
// ─── Trigger execution in PATCH /api/leads/[id] ───────────────────────────────

describe("Trigger execution — PATCH /api/leads/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  const LEAD_PARAMS = { params: { id: "l1" } };
  const LEAD_SESSION = { user: { id: "u1", role: "ADMIN" } };
  const UPDATED_LEAD = {
    id: "l1", firstName: "John", lastName: "Doe",
    email: "john@test.com", phone: null, status: "QUALIFIED",
    agentId: "a1", createdAt: new Date(), updatedAt: new Date(),
  };

  it("fires trigger when status changes to matching value", async () => {
    vi.mocked(getServerSession).mockResolvedValue(LEAD_SESSION as any);
    vi.mocked(prisma.lead.update).mockResolvedValue(UPDATED_LEAD as any);
    vi.mocked(prisma.trigger.findMany).mockResolvedValue([
      { ...TRIGGER_ENROLL, actionPlan: { id: "p1", isActive: true, steps: [] } },
    ] as any);
    vi.mocked(prisma.triggerExecution.create).mockResolvedValue({ id: "e1" } as any);
    vi.mocked(prisma.leadPlanEnrollment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockResolvedValue({} as any);

    const req = new Request("http://localhost/api/leads/l1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "QUALIFIED" }),
    });
    const res = await PATCH_LEAD(req, LEAD_PARAMS);
    expect(res.status).toBe(200);
    expect(prisma.triggerExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { triggerId: "t1", leadId: "l1" } })
    );
  });

  it("skips trigger when P2002 (already fired for this lead)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(LEAD_SESSION as any);
    vi.mocked(prisma.lead.update).mockResolvedValue(UPDATED_LEAD as any);
    vi.mocked(prisma.trigger.findMany).mockResolvedValue([
      { ...TRIGGER_ENROLL, actionPlan: { id: "p1", isActive: true, steps: [] } },
    ] as any);
    vi.mocked(prisma.triggerExecution.create).mockRejectedValue(
      Object.assign(new Error("Unique constraint"), { code: "P2002" })
    );

    const req = new Request("http://localhost/api/leads/l1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "QUALIFIED" }),
    });
    const res = await PATCH_LEAD(req, LEAD_PARAMS);
    // PATCH still succeeds even when trigger is skipped
    expect(res.status).toBe(200);
    // enrollment transaction should NOT have been called
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not enter trigger block when status not in body", async () => {
    vi.mocked(getServerSession).mockResolvedValue(LEAD_SESSION as any);
    vi.mocked(prisma.lead.update).mockResolvedValue({ ...UPDATED_LEAD, status: "QUALIFIED" } as any);

    const req = new Request("http://localhost/api/leads/l1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Updated notes" }),
    });
    const res = await PATCH_LEAD(req, LEAD_PARAMS);
    expect(res.status).toBe(200);
    expect(prisma.trigger.findMany).not.toHaveBeenCalled();
  });

  it("PATCH returns 200 even if trigger execution block throws", async () => {
    vi.mocked(getServerSession).mockResolvedValue(LEAD_SESSION as any);
    vi.mocked(prisma.lead.update).mockResolvedValue(UPDATED_LEAD as any);
    vi.mocked(prisma.trigger.findMany).mockRejectedValue(new Error("DB failure"));

    const req = new Request("http://localhost/api/leads/l1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "QUALIFIED" }),
    });
    const res = await PATCH_LEAD(req, LEAD_PARAMS);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run new tests to confirm they fail**

```powershell
pnpm --filter web exec vitest run src/__tests__/api/triggers.test.ts
```

Expected: the 4 new execution tests FAIL (existing 11 still pass).

- [ ] **Step 3: Modify PATCH /api/leads/[id]/route.ts**

Replace the entire file with the following (the full modified route):

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import sgMail from "@sendgrid/mail";
import { FROM } from "@/lib/email";

const LEAD_STATUSES = [
  "NEW","CONTACTED","QUALIFIED","HOT_PROSPECT","NURTURE",
  "SHOWING","OFFER","UNDER_CONTRACT","CLOSED","LOST","SPHERE",
] as const;

const patchSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  score: z.number().int().min(0).max(100).optional(),
  priceMin: z.number().nullable().optional(),
  priceMax: z.number().nullable().optional(),
  timeframeToMove: z.string().nullable().optional(),
});

async function assertOwnership(leadId: string, userId: string, role: string) {
  if (role === "ADMIN") return true;
  const [agent, lead] = await Promise.all([
    prisma.agent.findUnique({ where: { userId } }),
    prisma.lead.findUnique({ where: { id: leadId }, select: { agentId: true } }),
  ]);
  return agent && lead && lead.agentId === agent.id;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      activities: { orderBy: { createdAt: "desc" } },
      tags: { include: { tag: true } },
      tasks: { orderBy: { createdAt: "asc" } },
      relationshipsFrom: { include: { toLead: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      relationshipsTo:   { include: { fromLead: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      agent: { include: { user: { select: { name: true } } } },
    },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let data: z.infer<typeof patchSchema>;
  let lead: { id: string; firstName: string; lastName: string; email: string; phone: string | null; status: string; agentId: string | null; createdAt: Date; updatedAt: Date };
  try {
    const body = await req.json();
    data = patchSchema.parse(body);
    lead = await prisma.lead.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        agentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  // Fire triggers for status changes — non-fatal, never blocks the response
  if (data.status) {
    try {
      const triggers = await prisma.trigger.findMany({
        where: { statusTrigger: data.status as any, isActive: true },
        include: {
          actionPlan: {
            include: { steps: { orderBy: { stepOrder: "asc" } } },
          },
        },
      });

      for (const trigger of triggers) {
        // Once-per-lead: unique constraint on (triggerId, leadId)
        try {
          await prisma.triggerExecution.create({
            data: { triggerId: trigger.id, leadId: params.id },
          });
        } catch (e: any) {
          if (e?.code === "P2002") continue; // already fired for this lead
          throw e;
        }

        if (trigger.actionType === "ENROLL_PLAN" && trigger.actionPlan) {
          const plan = trigger.actionPlan;
          if (!plan.isActive) continue;

          const existing = await prisma.leadPlanEnrollment.findFirst({
            where: { leadId: params.id, planId: plan.id, status: "ACTIVE" },
          });
          if (existing) continue;

          if (!lead.agentId) continue; // no agent to attribute enrollment to

          const now = new Date();
          await prisma.$transaction(async (tx) => {
            const enr = await tx.leadPlanEnrollment.create({
              data: { leadId: params.id, planId: plan.id, agentId: lead.agentId! },
            });
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
                    body: s.body,
                    taskTitle: s.taskTitle,
                    dueAt,
                  };
                }),
              });
            }
          });
        }

        if (trigger.actionType === "SEND_EMAIL" && trigger.emailSubject && trigger.emailBody) {
          try {
            if (process.env.SENDGRID_API_KEY && lead.email) {
              sgMail.setApiKey(process.env.SENDGRID_API_KEY);
              await sgMail.send({
                to: lead.email,
                from: FROM,
                subject: trigger.emailSubject,
                text: trigger.emailBody,
              });
            }
          } catch (e) {
            console.error("[triggers] email send failed:", e);
          }
        }
      }
    } catch (e) {
      console.error("[triggers] execution failed:", e);
    }
  }

  return NextResponse.json(lead);
}
```

- [ ] **Step 4: Run all trigger tests to confirm they pass**

```powershell
pnpm --filter web exec vitest run src/__tests__/api/triggers.test.ts
```

Expected: 15 tests passing, 0 failures.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```powershell
pnpm --filter web exec vitest run
```

Expected: no new failures beyond pre-existing ones.

- [ ] **Step 6: Verify TypeScript compiles**

```powershell
pnpm --filter web exec tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/leads/[id]/route.ts apps/web/src/__tests__/api/triggers.test.ts
git commit -m "feat(sub7): trigger execution in PATCH /api/leads/[id]"
```

---

## Task 4: Admin UI — Triggers Page + Drawer

**Files:**
- Create: `apps/web/src/app/(dashboard)/admin/triggers/page.tsx`
- Create: `apps/web/src/components/triggers/TriggerDrawer.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/triggers` → `TriggerRow[]`; `POST`, `PATCH`, `DELETE /api/admin/triggers/[id]` from Task 2
- Consumes: `GET /api/admin/action-plans` → `{ id, name, isActive }[]` (existing route, for dropdown)
- Produces: admin UI at `/admin/triggers`

**Status label map** (use this exact mapping everywhere):
```ts
const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  HOT_PROSPECT: "Hot Prospect",
  NURTURE: "Nurture",
  SHOWING: "Showing",
  OFFER: "Offer",
  UNDER_CONTRACT: "Under Contract",
  CLOSED: "Closed",
  LOST: "Lost",
  SPHERE: "Sphere of Influence",
};
```

- [ ] **Step 1: Create TriggerDrawer component**

Create `apps/web/src/components/triggers/TriggerDrawer.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

type Plan = { id: string; name: string; isActive: boolean };

type TriggerRow = {
  id: string;
  name: string;
  statusTrigger: string;
  actionType: "ENROLL_PLAN" | "SEND_EMAIL";
  actionPlanId: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  isActive: boolean;
};

type Props = {
  open: boolean;
  trigger: TriggerRow | null;
  onClose: () => void;
  onSaved: () => void;
};

const ALL_STATUSES = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "HOT_PROSPECT", label: "Hot Prospect" },
  { value: "NURTURE", label: "Nurture" },
  { value: "SHOWING", label: "Showing" },
  { value: "OFFER", label: "Offer" },
  { value: "UNDER_CONTRACT", label: "Under Contract" },
  { value: "CLOSED", label: "Closed" },
  { value: "LOST", label: "Lost" },
  { value: "SPHERE", label: "Sphere of Influence" },
];

export function TriggerDrawer({ open, trigger, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [statusTrigger, setStatusTrigger] = useState("NEW");
  const [actionType, setActionType] = useState<"ENROLL_PLAN" | "SEND_EMAIL">("ENROLL_PLAN");
  const [actionPlanId, setActionPlanId] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/action-plans")
      .then((r) => r.json())
      .then((data: Plan[]) => setPlans(data.filter((p) => p.isActive)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (trigger) {
      setName(trigger.name);
      setStatusTrigger(trigger.statusTrigger);
      setActionType(trigger.actionType);
      setActionPlanId(trigger.actionPlanId ?? "");
      setEmailSubject(trigger.emailSubject ?? "");
      setEmailBody(trigger.emailBody ?? "");
      setIsActive(trigger.isActive);
    } else {
      setName("");
      setStatusTrigger("NEW");
      setActionType("ENROLL_PLAN");
      setActionPlanId("");
      setEmailSubject("");
      setEmailBody("");
      setIsActive(true);
    }
    setError(null);
  }, [trigger, open]);

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    if (actionType === "ENROLL_PLAN" && !actionPlanId) { setError("Please select an action plan"); return; }
    if (actionType === "SEND_EMAIL" && !emailSubject.trim()) { setError("Email subject is required"); return; }
    if (actionType === "SEND_EMAIL" && !emailBody.trim()) { setError("Email body is required"); return; }

    setSaving(true);
    setError(null);
    try {
      const isEdit = !!trigger;
      const res = await fetch(
        isEdit ? `/api/admin/triggers/${trigger!.id}` : "/api/admin/triggers",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            statusTrigger,
            actionType,
            actionPlanId: actionType === "ENROLL_PLAN" ? actionPlanId : null,
            emailSubject: actionType === "SEND_EMAIL" ? emailSubject.trim() : null,
            emailBody: actionType === "SEND_EMAIL" ? emailBody.trim() : null,
            isActive,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Failed to save");
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

  return (
    <div className={open ? "" : "hidden"} role="dialog" aria-modal="true" aria-label={trigger ? "Edit Trigger" : "New Trigger"}>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/10 px-6 py-4">
          <h2 className="font-sans text-lg font-light text-[#1B1B1B]">
            {trigger ? "Edit Trigger" : "New Trigger"}
          </h2>
          <button onClick={onClose} className="text-[#1B1B1B]/40 hover:text-[#1B1B1B]" aria-label="Close">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          {/* Name */}
          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Trigger Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
              placeholder="e.g. Auto-qualify drip"
            />
          </div>

          {/* Status trigger */}
          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">When status changes to *</label>
            <select
              value={statusTrigger}
              onChange={(e) => setStatusTrigger(e.target.value)}
              className="w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
            >
              {ALL_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Action type pills */}
          <div>
            <label className="mb-2 block text-xs text-[#1B1B1B]/50">Action *</label>
            <div className="flex gap-2">
              {(["ENROLL_PLAN", "SEND_EMAIL"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActionType(type)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    actionType === type
                      ? "border-[#9E8C61] bg-[#9E8C61]/10 text-[#9E8C61]"
                      : "border-[#1B1B1B]/10 text-[#1B1B1B]/50 hover:border-[#1B1B1B]/20"
                  }`}
                >
                  {type === "ENROLL_PLAN" ? "Enroll in Plan" : "Send Email"}
                </button>
              ))}
            </div>
          </div>

          {/* ENROLL_PLAN fields — always mounted, CSS hidden */}
          <div className={actionType === "ENROLL_PLAN" ? "" : "hidden"}>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Action Plan *</label>
            <select
              value={actionPlanId}
              onChange={(e) => setActionPlanId(e.target.value)}
              className="w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
            >
              <option value="">— Select a plan —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* SEND_EMAIL fields — always mounted, CSS hidden */}
          <div className={actionType === "SEND_EMAIL" ? "" : "hidden"}>
            <div className="mb-3">
              <label className="mb-1 block text-xs text-[#1B1B1B]/50">Email Subject *</label>
              <input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
                placeholder="e.g. Your offer was accepted!"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#1B1B1B]/50">Email Body *</label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={5}
                className="w-full resize-none rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
                placeholder="Write the email message to send to the lead..."
              />
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <input
              id="trigger-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-[#9E8C61]"
            />
            <label htmlFor="trigger-active" className="text-sm text-[#1B1B1B]">Active</label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#1B1B1B]/10 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[#1B1B1B]/10 px-4 py-2 text-sm text-[#1B1B1B]/50 hover:bg-[#F2F0EF]"
          >
            Cancel
          </button>
          <motion.button
            onClick={handleSave}
            disabled={saving}
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
            className="rounded-lg bg-[#1B1B1B] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the admin triggers page**

Create `apps/web/src/app/(dashboard)/admin/triggers/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { TriggerDrawer } from "@/components/triggers/TriggerDrawer";

type TriggerRow = {
  id: string;
  name: string;
  statusTrigger: string;
  actionType: "ENROLL_PLAN" | "SEND_EMAIL";
  actionPlanId: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  isActive: boolean;
  createdAt: string;
  actionPlan: { name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  HOT_PROSPECT: "Hot Prospect",
  NURTURE: "Nurture",
  SHOWING: "Showing",
  OFFER: "Offer",
  UNDER_CONTRACT: "Under Contract",
  CLOSED: "Closed",
  LOST: "Lost",
  SPHERE: "Sphere of Influence",
};

export const dynamic = "force-dynamic";

export default function TriggersAdminPage() {
  const [triggers, setTriggers] = useState<TriggerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<TriggerRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function loadTriggers() {
    setLoading(true);
    fetch("/api/admin/triggers")
      .then((r) => r.json())
      .then(setTriggers)
      .catch(() => setError("Failed to load triggers"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadTriggers(); }, []);

  async function handleToggleActive(trigger: TriggerRow) {
    await fetch(`/api/admin/triggers/${trigger.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !trigger.isActive }),
    });
    loadTriggers();
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await fetch(`/api/admin/triggers/${id}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      loadTriggers();
    } finally {
      setDeleting(false);
    }
  }

  function openCreate() {
    setEditingTrigger(null);
    setDrawerOpen(true);
  }

  function openEdit(trigger: TriggerRow) {
    setEditingTrigger(trigger);
    setDrawerOpen(true);
  }

  function actionDescription(t: TriggerRow): string {
    if (t.actionType === "ENROLL_PLAN") {
      return `Enroll in "${t.actionPlan?.name ?? "Unknown Plan"}"`;
    }
    return `Send email: "${t.emailSubject}"`;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Trigger Automations</h1>
          <p className="mt-1 text-sm text-[#1B1B1B]/40">
            Automatically act when a lead&apos;s status changes
          </p>
        </div>
        <motion.button
          onClick={openCreate}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          className="rounded-full bg-[#1B1B1B] px-5 py-2.5 text-sm font-medium text-white"
        >
          + New Trigger
        </motion.button>
      </div>

      {loading && <p className="text-sm text-[#1B1B1B]/40">Loading…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && triggers.length === 0 && (
        <p className="py-12 text-center text-sm text-[#1B1B1B]/40">
          No triggers yet — create one to start automating your workflow.
        </p>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {triggers.map((trigger, i) => (
          <div
            key={trigger.id}
            className={`flex items-center gap-4 px-5 py-4 ${
              i > 0 ? "border-t border-[#1B1B1B]/5" : ""
            }`}
          >
            {/* Active toggle */}
            <input
              type="checkbox"
              checked={trigger.isActive}
              onChange={() => handleToggleActive(trigger)}
              className="h-4 w-4 accent-[#9E8C61]"
              title={trigger.isActive ? "Disable trigger" : "Enable trigger"}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1B1B1B]">{trigger.name}</p>
              <p className="mt-0.5 text-xs text-[#1B1B1B]/50">
                Status → {STATUS_LABELS[trigger.statusTrigger] ?? trigger.statusTrigger}
                {" · "}
                {actionDescription(trigger)}
              </p>
            </div>

            {/* Active badge */}
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                trigger.isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-[#1B1B1B]/10 text-[#1B1B1B]/40"
              }`}
            >
              {trigger.isActive ? "Active" : "Inactive"}
            </span>

            {/* Edit */}
            <button
              onClick={() => openEdit(trigger)}
              className="shrink-0 text-xs text-[#1B1B1B]/40 hover:text-[#1B1B1B]"
              title="Edit"
            >
              Edit
            </button>

            {/* Delete / confirm */}
            {confirmDeleteId === trigger.id ? (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-[#1B1B1B]/50">Delete?</span>
                <button
                  onClick={() => handleDelete(trigger.id)}
                  disabled={deleting}
                  className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {deleting ? "…" : "Confirm"}
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="text-xs text-[#1B1B1B]/40 hover:text-[#1B1B1B]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(trigger.id)}
                className="shrink-0 text-xs text-[#1B1B1B]/40 hover:text-red-500"
                title="Delete"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>

      <TriggerDrawer
        open={drawerOpen}
        trigger={editingTrigger}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => { setDrawerOpen(false); loadTriggers(); }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```powershell
pnpm --filter web exec tsc --noEmit
```

Expected: no new type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/admin/triggers/ apps/web/src/components/triggers/
git commit -m "feat(sub7): admin triggers page + TriggerDrawer"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Task 1 → Section 1 (`Trigger`, `TriggerExecution`, `TriggerActionType`, migration `add_trigger_automations`)
- [x] Task 2 → Section 2 (GET, POST with all validations, PATCH, DELETE with P2025 guard)
- [x] Task 3 → Section 3 (trigger execution: status check, P2002 skip, ENROLL_PLAN transaction, SEND_EMAIL non-fatal, entire block non-fatal)
- [x] Task 4 → Section 4 (admin page at `/admin/triggers`, `TriggerDrawer`, status labels, active toggle, delete confirmation, empty state)
- [x] Section 5 (tests: CRUD routes 11 tests + execution 4 tests = 15 total)

**Type consistency:**
- `TriggerRow` shape defined in Task 2 interfaces and reused verbatim in Task 4 — consistent
- `STATUS_LABELS` map defined once in Task 4 and used in both page and drawer — consistent
- `actionPlan` include shape (`{ name: string }`) matches between GET route and page consumer

**Trigger execution guard:** `data.status` check only enters the trigger block when a status field was in the PATCH body — confirmed in test "does not enter trigger block when status not in body"
