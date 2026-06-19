# Phase 7 Sub-project 4: CRM Tasks Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `notes` field to tasks, a slide-in edit/delete drawer on the lead profile, and a `/dashboard/tasks` cross-lead view so agents can see and action all their tasks in one place.

**Architecture:** Extend the existing `LeadTask` model with one optional `notes` column via Prisma migration; add a GET handler to the per-lead tasks route and a new top-level `GET /api/tasks` endpoint; build a `LeadTaskDrawer` slide-in panel (always mounted, CSS-hidden) that plugs into the existing `LeadTasksTab`; create a `/dashboard/tasks` client page that fetches the cross-lead endpoint and renders Overdue / Due Today / Upcoming sections with in-place check-off.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma ORM (PostgreSQL), NextAuth, Zod v4 (use `err.issues[0].message`, NOT `err.errors`), Tailwind CSS, vitest

## Global Constraints

- Gold accent: `#9E8C61` — use `text-cnc-gold` / `border-[#9E8C61]` / `bg-[#9E8C61]`; off-white bg: `#F2F0EF`; dark text: `#1B1B1B`
- Import Prisma client as `import { prisma } from "@/lib/prisma"`
- Auth via `requireAuth("AGENT")` from `@/lib/api-auth`; returns `{ session, error }`
- Zod v4: `err.issues[0].message` (NOT `err.errors[0].message`)
- Always-mounted UI uses CSS `hidden` class, NOT conditional rendering
- No toast library — inline error state only
- No push to origin until all Phase 7 sub-projects (1–8) are complete
- TypeScript must compile clean — run `pnpm --filter web tsc --noEmit` to verify
- Tests run with `pnpm --filter web vitest run`
- TASK_TYPES: `["FOLLOW_UP","CALL","EMAIL","TEXT","SHOWING","THANK_YOU","OTHER"]` as const
- `LeadTask` model already has: id, leadId, title, taskType, assigneeId, dueDate, done, completedAt, createdAt
- `assertOwnership(leadId, userId, role)` is defined locally in each leads route file — do NOT import from a shared lib; copy the same pattern when needed
- `export const dynamic = "force-dynamic"` is required on any API route that reads session
- MERGE_BASE for this sub-project = `e3b2f22`

---

## File Map

**Modified:**
- `packages/database/prisma/schema.prisma` — add `notes String?` to `LeadTask`
- `apps/web/src/app/api/leads/[id]/tasks/route.ts` — add `GET` handler
- `apps/web/src/app/api/leads/[id]/tasks/[taskId]/route.ts` — add `notes` to `patchSchema`
- `apps/web/src/components/leads/LeadTasksTab.tsx` — add `selectedTask` + `editDrawerOpen` state, `onClick` on each `TaskRow`, mount `LeadTaskDrawer`
- `apps/web/src/app/(dashboard)/layout.tsx` — add Tasks nav entry

**Created:**
- `apps/web/src/app/api/tasks/route.ts` — cross-lead GET endpoint
- `apps/web/src/components/leads/LeadTaskDrawer.tsx` — slide-in edit/delete drawer
- `apps/web/src/app/(dashboard)/dashboard/tasks/page.tsx` — cross-lead tasks dashboard page
- `apps/web/src/__tests__/api/lead-tasks.test.ts` — tests for GET + updated PATCH
- `apps/web/src/__tests__/api/tasks.test.ts` — tests for GET /api/tasks

---

### Task 1: Schema Migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (line 679–692 — the `LeadTask` model)

**Interfaces:**
- Produces: `LeadTask.notes: String?` — available in all subsequent Prisma calls

- [ ] **Step 1: Add `notes` field to LeadTask model**

Open `packages/database/prisma/schema.prisma`. Find the `LeadTask` model (currently at line 679). Change it to:

```prisma
model LeadTask {
  id          String    @id @default(cuid())
  leadId      String
  title       String
  taskType    String    @default("FOLLOW_UP")
  assigneeId  String?
  dueDate     DateTime?
  notes       String?
  done        Boolean   @default(false)
  completedAt DateTime?
  createdAt   DateTime  @default(now())

  lead     Lead   @relation(fields: [leadId],     references: [id], onDelete: Cascade)
  assignee Agent? @relation("TaskAssignee", fields: [assigneeId], references: [id])
}
```

- [ ] **Step 2: Run migration**

```powershell
pnpm --filter @cnc/database exec prisma migrate dev --name add_notes_to_lead_task
```

Expected output: `The following migration(s) have been created and applied: .../add_notes_to_lead_task/migration.sql`

- [ ] **Step 3: Regenerate Prisma client**

```powershell
pnpm --filter @cnc/database exec prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Verify TypeScript sees the new field**

```powershell
pnpm --filter web tsc --noEmit
```

Expected: zero errors (or same errors as before the change — no new ones)

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat: add notes field to LeadTask schema"
```

---

### Task 2: API Routes

**Files:**
- Modify: `apps/web/src/app/api/leads/[id]/tasks/route.ts`
- Modify: `apps/web/src/app/api/leads/[id]/tasks/[taskId]/route.ts`
- Create: `apps/web/src/app/api/tasks/route.ts`
- Create: `apps/web/src/__tests__/api/lead-tasks.test.ts`
- Create: `apps/web/src/__tests__/api/tasks.test.ts`

**Interfaces:**
- Consumes: `prisma.leadTask` with `notes` field (from Task 1)
- Produces:
  - `GET /api/leads/[id]/tasks` → `LeadTask[]` (all fields including `notes`)
  - `PATCH /api/leads/[id]/tasks/[taskId]` → accepts optional `notes` in body
  - `GET /api/tasks?done=false|true` → `CrossLeadTask[]`

`CrossLeadTask` shape:
```ts
{
  id: string;
  leadId: string;
  leadFirstName: string;
  leadLastName: string;
  title: string;
  taskType: string;
  notes: string | null;
  dueDate: string | null;
  done: boolean;
  completedAt: string | null;
  createdAt: string;
}
```

- [ ] **Step 1: Write failing tests for GET /api/leads/[id]/tasks and updated PATCH**

Create `apps/web/src/__tests__/api/lead-tasks.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    lead: { findUnique: vi.fn() },
    leadTask: { findMany: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../../app/api/leads/[id]/tasks/route";
import { PATCH } from "../../app/api/leads/[id]/tasks/[taskId]/route";

const SESSION = { user: { id: "u1", role: "AGENT" } };
const AGENT = { id: "a1" };
const LEAD = { agentId: "a1" };
const TASK = {
  id: "t1", leadId: "l1", title: "Call back", taskType: "CALL",
  assigneeId: null, dueDate: new Date("2026-06-20T10:00:00Z"),
  notes: "Left voicemail", done: false, completedAt: null,
  createdAt: new Date("2026-06-19T08:00:00Z"),
};

const PARAMS = { params: { id: "l1" } };
const TASK_PARAMS = { params: { id: "l1", taskId: "t1" } };

describe("GET /api/leads/[id]/tasks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/leads/l1/tasks"), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when agent does not own lead", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ agentId: "other" } as any);
    const res = await GET(new Request("http://localhost/api/leads/l1/tasks"), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns task list ordered by createdAt asc", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD as any);
    vi.mocked(prisma.leadTask.findMany).mockResolvedValue([TASK] as any);

    const res = await GET(new Request("http://localhost/api/leads/l1/tasks"), PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].notes).toBe("Left voicemail");
    expect(prisma.leadTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leadId: "l1" }, orderBy: { createdAt: "asc" } })
    );
  });
});

describe("PATCH /api/leads/[id]/tasks/[taskId] — notes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts and persists notes field", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD as any);
    vi.mocked(prisma.leadTask.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.leadTask.findFirst).mockResolvedValue({ ...TASK, notes: "Updated note" } as any);

    const req = new Request("http://localhost/api/leads/l1/tasks/t1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Updated note" }),
    });
    const res = await PATCH(req, TASK_PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.notes).toBe("Updated note");
  });

  it("accepts notes: null to clear notes", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD as any);
    vi.mocked(prisma.leadTask.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.leadTask.findFirst).mockResolvedValue({ ...TASK, notes: null } as any);

    const req = new Request("http://localhost/api/leads/l1/tasks/t1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: null }),
    });
    const res = await PATCH(req, TASK_PARAMS);
    expect(res.status).toBe(200);
    expect(prisma.leadTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ notes: null }) })
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```powershell
pnpm --filter web vitest run src/__tests__/api/lead-tasks.test.ts
```

Expected: FAIL — "GET is not a function" (handler not added yet)

- [ ] **Step 3: Add GET handler to per-lead tasks route**

Open `apps/web/src/app/api/leads/[id]/tasks/route.ts`. The current file has only `POST`. Add `GET` before `POST`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const TASK_TYPES = ["FOLLOW_UP","CALL","EMAIL","TEXT","SHOWING","THANK_YOU","OTHER"] as const;

const schema = z.object({
  title: z.string().min(1),
  taskType: z.enum(TASK_TYPES).default("FOLLOW_UP"),
  assigneeId: z.string().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

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

  const tasks = await prisma.leadTask.findMany({
    where: { leadId: params.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(tasks);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = schema.parse(await req.json());
    const task = await prisma.leadTask.create({
      data: {
        leadId: params.id,
        title: body.title,
        taskType: body.taskType,
        assigneeId: body.assigneeId ?? null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Add `notes` to patchSchema in [taskId] route**

Open `apps/web/src/app/api/leads/[id]/tasks/[taskId]/route.ts`. Change `patchSchema`:

```ts
const patchSchema = z.object({
  title: z.string().min(1).optional(),
  taskType: z.enum(["FOLLOW_UP","CALL","EMAIL","TEXT","SHOWING","THANK_YOU","OTHER"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  done: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});
```

The rest of the file stays the same — `notes` will be included in `data: { ...body }` automatically.

Also add `export const dynamic = "force-dynamic";` near the top of the file (after imports).

- [ ] **Step 5: Run tests to confirm GET and PATCH tests now pass**

```powershell
pnpm --filter web vitest run src/__tests__/api/lead-tasks.test.ts
```

Expected: all tests PASS

- [ ] **Step 6: Write failing tests for GET /api/tasks**

Create `apps/web/src/__tests__/api/tasks.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    leadTask: { findMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "../../app/api/tasks/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT" } };
const SESSION_ADMIN = { user: { id: "u2", role: "ADMIN" } };
const AGENT = { id: "a1" };

const TASK_DB = {
  id: "t1", leadId: "l1", title: "Call back", taskType: "CALL",
  notes: null, dueDate: new Date("2026-06-20T10:00:00Z"),
  done: false, completedAt: null, createdAt: new Date("2026-06-19T08:00:00Z"),
  lead: { agentId: "a1", firstName: "Jane", lastName: "Doe" },
};

describe("GET /api/tasks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/tasks"));
    expect(res.status).toBe(401);
  });

  it("returns tasks with lead name for authenticated agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.leadTask.findMany).mockResolvedValue([TASK_DB] as any);

    const res = await GET(new Request("http://localhost/api/tasks"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].leadFirstName).toBe("Jane");
    expect(data[0].leadLastName).toBe("Doe");
    expect(data[0].leadId).toBe("l1");
    expect(typeof data[0].createdAt).toBe("string");
  });

  it("filters by done=false", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.leadTask.findMany).mockResolvedValue([] as any);

    await GET(new Request("http://localhost/api/tasks?done=false"));
    expect(prisma.leadTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ done: false }) })
    );
  });

  it("filters by done=true", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.leadTask.findMany).mockResolvedValue([] as any);

    await GET(new Request("http://localhost/api/tasks?done=true"));
    expect(prisma.leadTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ done: true }) })
    );
  });

  it("admin sees all tasks (no agentId filter)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_ADMIN as any);
    vi.mocked(prisma.leadTask.findMany).mockResolvedValue([] as any);

    await GET(new Request("http://localhost/api/tasks"));
    expect(prisma.agent.findUnique).not.toHaveBeenCalled();
    expect(prisma.leadTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ lead: expect.anything() }) })
    );
  });
});
```

- [ ] **Step 7: Run tests to confirm they fail**

```powershell
pnpm --filter web vitest run src/__tests__/api/tasks.test.ts
```

Expected: FAIL — module not found for `../../app/api/tasks/route`

- [ ] **Step 8: Create cross-lead tasks API route**

Create `apps/web/src/app/api/tasks/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function serializeTask(task: {
  id: string; leadId: string; title: string; taskType: string; notes: string | null;
  dueDate: Date | null; done: boolean; completedAt: Date | null; createdAt: Date;
  lead: { agentId: string; firstName: string; lastName: string };
}) {
  return {
    id: task.id,
    leadId: task.leadId,
    leadFirstName: task.lead.firstName,
    leadLastName: task.lead.lastName,
    title: task.title,
    taskType: task.taskType,
    notes: task.notes,
    dueDate: task.dueDate?.toISOString() ?? null,
    done: task.done,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const url = new URL(req.url);
  const doneParam = url.searchParams.get("done");
  const doneFilter = doneParam === "true" ? true : doneParam === "false" ? false : undefined;

  const isAdmin = session.user.role === "ADMIN";

  let agentId: string | undefined;
  if (!isAdmin) {
    const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
    if (!agent) return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });
    agentId = agent.id;
  }

  const tasks = await prisma.leadTask.findMany({
    where: {
      ...(doneFilter !== undefined ? { done: doneFilter } : {}),
      ...(!isAdmin ? { lead: { agentId } } : {}),
    },
    include: { lead: { select: { agentId: true, firstName: true, lastName: true } } },
    orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(tasks.map(serializeTask));
}
```

- [ ] **Step 9: Run all tests to confirm everything passes**

```powershell
pnpm --filter web vitest run src/__tests__/api/lead-tasks.test.ts src/__tests__/api/tasks.test.ts
```

Expected: all tests PASS

- [ ] **Step 10: TypeScript check**

```powershell
pnpm --filter web tsc --noEmit
```

Expected: zero new errors

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/app/api/leads/[id]/tasks/route.ts \
        "apps/web/src/app/api/leads/[id]/tasks/[taskId]/route.ts" \
        apps/web/src/app/api/tasks/route.ts \
        apps/web/src/__tests__/api/lead-tasks.test.ts \
        apps/web/src/__tests__/api/tasks.test.ts
git commit -m "feat: add GET /api/leads/[id]/tasks, notes to PATCH schema, GET /api/tasks cross-lead endpoint"
```

---

### Task 3: LeadTaskDrawer Component

**Files:**
- Create: `apps/web/src/components/leads/LeadTaskDrawer.tsx`

**Interfaces:**
- Consumes:
  ```ts
  type LeadTaskRow = {
    id: string; leadId: string; title: string; taskType: string;
    notes: string | null; dueDate: string | null; done: boolean;
    completedAt: string | null; createdAt: string;
  };
  type Props = {
    open: boolean;
    task: LeadTaskRow | null;
    leadId: string;
    onClose: () => void;
    onSaved: (task: LeadTaskRow) => void;
    onDeleted: (taskId: string) => void;
  };
  ```
- Produces: `export function LeadTaskDrawer(props: Props)` — always mounted, CSS-hidden when `open=false`

- [ ] **Step 1: Create LeadTaskDrawer**

Create `apps/web/src/components/leads/LeadTaskDrawer.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

const TASK_TYPES = ["FOLLOW_UP","CALL","EMAIL","TEXT","SHOWING","THANK_YOU","OTHER"] as const;
const TYPE_LABELS: Record<string, string> = {
  FOLLOW_UP: "Follow Up", CALL: "Call", EMAIL: "Email", TEXT: "Text",
  SHOWING: "Showing", THANK_YOU: "Thank You", OTHER: "Other",
};

type LeadTaskRow = {
  id: string;
  leadId: string;
  title: string;
  taskType: string;
  notes: string | null;
  dueDate: string | null;
  done: boolean;
  completedAt: string | null;
  createdAt: string;
};

type Props = {
  open: boolean;
  task: LeadTaskRow | null;
  leadId: string;
  onClose: () => void;
  onSaved: (task: LeadTaskRow) => void;
  onDeleted: (taskId: string) => void;
};

export function LeadTaskDrawer({ open, task, leadId, onClose, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState("FOLLOW_UP");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setTaskType(task.taskType);
      setDueDate(task.dueDate ? task.dueDate.slice(0, 16) : "");
      setNotes(task.notes ?? "");
      setError(null);
    }
  }, [task]);

  async function handleSave() {
    if (!task || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          taskType,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to save");
        return;
      }
      const updated: LeadTaskRow = await res.json();
      onSaved(updated);
      onClose();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    if (!window.confirm("Delete this task?")) return;
    try {
      const res = await fetch(`/api/leads/${leadId}/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to delete");
        return;
      }
      onDeleted(task.id);
      onClose();
    } catch {
      setError("Network error — please try again");
    }
  }

  return (
    <div className={open ? "" : "hidden"}>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/10 px-6 py-4">
          <h2 className="font-sans text-lg font-light text-[#1B1B1B]">Edit Task</h2>
          <button onClick={onClose} className="text-[#1B1B1B]/40 hover:text-[#1B1B1B]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
              placeholder="Task title"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Type</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm"
            >
              {TASK_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Due Date</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="e.g. Left voicemail, mentioned price drop…"
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61] resize-none"
            />
          </div>
        </div>

        <div className="border-t border-[#1B1B1B]/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
            >
              Delete
            </button>
            <div className="flex-1" />
            <button onClick={onClose} className="rounded-lg border border-[#1B1B1B]/10 px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="rounded-lg bg-[#1B1B1B] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```powershell
pnpm --filter web tsc --noEmit
```

Expected: zero new errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/leads/LeadTaskDrawer.tsx
git commit -m "feat: add LeadTaskDrawer slide-in edit/delete component"
```

---

### Task 4: Wire LeadTaskDrawer into LeadTasksTab

**Files:**
- Modify: `apps/web/src/components/leads/LeadTasksTab.tsx`

**Interfaces:**
- Consumes: `LeadTaskDrawer` from `./LeadTaskDrawer`
- The existing `LeadTask` type in the file needs `notes: string | null` added so it matches what the API now returns

- [ ] **Step 1: Update LeadTasksTab**

Replace the full contents of `apps/web/src/components/leads/LeadTasksTab.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { LeadTaskDrawer } from "./LeadTaskDrawer";

type LeadTask = {
  id: string;
  leadId?: string;
  title: string;
  taskType: string;
  dueDate: string | null;
  notes: string | null;
  done: boolean;
  completedAt: string | null;
  createdAt?: string;
};

const TASK_TYPES = ["FOLLOW_UP","CALL","EMAIL","TEXT","SHOWING","THANK_YOU","OTHER"] as const;
const TYPE_LABELS: Record<string, string> = {
  FOLLOW_UP: "Follow Up", CALL: "Call", EMAIL: "Email", TEXT: "Text",
  SHOWING: "Showing", THANK_YOU: "Thank You", OTHER: "Other",
};

interface Props {
  leadId: string;
  initialTasks: LeadTask[];
}

export function LeadTasksTab({ leadId, initialTasks }: Props) {
  const [tasks, setTasks] = useState<LeadTask[]>(initialTasks);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<string>("FOLLOW_UP");
  const [newDate, setNewDate] = useState("");
  const [creating, setCreating] = useState(false);

  const [selectedTask, setSelectedTask] = useState<LeadTask | null>(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdue = tasks.filter((t) => !t.done && t.dueDate && new Date(t.dueDate) < today);
  const dueToday = tasks.filter((t) => !t.done && t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString());
  const upcoming = tasks.filter((t) => !t.done && (!t.dueDate || new Date(t.dueDate) > today) && !dueToday.includes(t));
  const completed = tasks.filter((t) => t.done);

  async function quickTask(daysFromNow: number) {
    if (creating) return;
    setCreating(true);
    try {
      const due = new Date();
      due.setDate(due.getDate() + daysFromNow);
      const res = await fetch(`/api/leads/${leadId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Follow Up", taskType: "FOLLOW_UP", dueDate: due.toISOString() }),
      });
      if (!res.ok) return;
      const task = await res.json();
      setTasks((prev) => [{ ...task, notes: null }, ...prev]);
    } finally {
      setCreating(false);
    }
  }

  async function toggleDone(task: LeadTask) {
    try {
      const res = await fetch(`/api/leads/${leadId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !task.done }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...updated, notes: updated.notes ?? null } : t)));
    } catch {
      // network error — leave state unchanged
    }
  }

  async function createTask() {
    try {
      const res = await fetch(`/api/leads/${leadId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, taskType: newType, dueDate: newDate ? new Date(newDate).toISOString() : null }),
      });
      if (!res.ok) return;
      const task = await res.json();
      setTasks((prev) => [{ ...task, notes: null }, ...prev]);
      setNewTaskOpen(false);
      setNewTitle("");
      setNewType("FOLLOW_UP");
      setNewDate("");
    } catch {
      // network error — leave drawer open so user can retry
    }
  }

  function openEdit(task: LeadTask) {
    setSelectedTask(task);
    setEditDrawerOpen(true);
  }

  function TaskRow({ task, accent }: { task: LeadTask; accent?: string }) {
    return (
      <div
        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${accent ?? "bg-[#F2F0EF]"} hover:brightness-95`}
        onClick={() => openEdit(task)}
      >
        <input
          type="checkbox"
          checked={task.done}
          onChange={(e) => { e.stopPropagation(); toggleDone(task); }}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 accent-[#9E8C61]"
        />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm ${task.done ? "line-through text-[#1B1B1B]/30" : "text-[#1B1B1B]"}`}>{task.title}</p>
          <p className="text-xs text-[#1B1B1B]/40">{TYPE_LABELS[task.taskType]} {task.dueDate ? `· ${new Date(task.dueDate).toLocaleDateString()}` : ""}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick tasks */}
      <div className="flex gap-2">
        <button onClick={() => quickTask(1)} disabled={creating} className="rounded-lg border border-[#1B1B1B]/10 px-3 py-1.5 text-xs hover:border-[#9E8C61] hover:text-[#9E8C61] disabled:opacity-40">Tomorrow</button>
        <button onClick={() => quickTask(3)} disabled={creating} className="rounded-lg border border-[#1B1B1B]/10 px-3 py-1.5 text-xs hover:border-[#9E8C61] hover:text-[#9E8C61] disabled:opacity-40">In 3 Days</button>
        <button onClick={() => quickTask(7)} disabled={creating} className="rounded-lg border border-[#1B1B1B]/10 px-3 py-1.5 text-xs hover:border-[#9E8C61] hover:text-[#9E8C61] disabled:opacity-40">Next Week</button>
        <button onClick={() => setNewTaskOpen(true)} className="ml-auto rounded-lg bg-[#1B1B1B] px-3 py-1.5 text-xs font-medium text-white">+ New Task</button>
      </div>

      {overdue.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-red-500">Overdue</p>
          <div className="space-y-1">{overdue.map((t) => <TaskRow key={t.id} task={t} accent="bg-red-50" />)}</div>
        </div>
      )}
      {dueToday.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-amber-600">Due Today</p>
          <div className="space-y-1">{dueToday.map((t) => <TaskRow key={t.id} task={t} accent="bg-amber-50" />)}</div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-[#1B1B1B]/40">Upcoming</p>
          <div className="space-y-1">{upcoming.map((t) => <TaskRow key={t.id} task={t} />)}</div>
        </div>
      )}
      {completed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-[#1B1B1B]/40">Completed ({completed.length})</summary>
          <div className="mt-1 space-y-1">{completed.map((t) => <TaskRow key={t.id} task={t} />)}</div>
        </details>
      )}
      {tasks.length === 0 && <p className="text-sm text-[#1B1B1B]/40">No tasks yet. Use the quick buttons above.</p>}

      {/* New Task panel */}
      {newTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setNewTaskOpen(false)} />
          <div className="relative w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl sm:m-4">
            <h3 className="mb-4 font-sans text-lg font-light">New Task</h3>
            <div className="space-y-3">
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task title" className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]" />
              <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm">
                {TASK_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
              <input type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm" />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setNewTaskOpen(false)} className="flex-1 rounded-lg border border-[#1B1B1B]/10 py-2 text-sm">Cancel</button>
              <button onClick={createTask} disabled={!newTitle.trim()} className="flex-1 rounded-lg bg-[#1B1B1B] py-2 text-sm font-medium text-white disabled:opacity-40">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Drawer — always mounted */}
      <LeadTaskDrawer
        open={editDrawerOpen}
        task={selectedTask ? { ...selectedTask, leadId: selectedTask.leadId ?? leadId, createdAt: selectedTask.createdAt ?? "" } : null}
        leadId={leadId}
        onClose={() => setEditDrawerOpen(false)}
        onSaved={(updated) => {
          setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...updated } : t)));
          setEditDrawerOpen(false);
        }}
        onDeleted={(taskId) => {
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
          setEditDrawerOpen(false);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```powershell
pnpm --filter web tsc --noEmit
```

Expected: zero new errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/leads/LeadTasksTab.tsx
git commit -m "feat: wire LeadTaskDrawer into LeadTasksTab — click any task to edit or delete"
```

---

### Task 5: Tasks Dashboard Page + Nav

**Files:**
- Create: `apps/web/src/app/(dashboard)/dashboard/tasks/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `GET /api/tasks?done=false` and `GET /api/tasks?done=true`
- Consumes: `PATCH /api/leads/[leadId]/tasks/[taskId]` (to check off tasks)

- [ ] **Step 1: Add Tasks nav entry to layout.tsx**

Open `apps/web/src/app/(dashboard)/layout.tsx`. Find `AGENT_NAV` (currently at line 7). Add the Tasks entry between Pipeline and Transactions:

```ts
const AGENT_NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/pipeline", label: "Pipeline" },
  { href: "/dashboard/tasks", label: "Tasks" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/settings", label: "Settings" },
];
```

- [ ] **Step 2: Create the tasks dashboard page**

Create `apps/web/src/app/(dashboard)/dashboard/tasks/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type CrossLeadTask = {
  id: string;
  leadId: string;
  leadFirstName: string;
  leadLastName: string;
  title: string;
  taskType: string;
  notes: string | null;
  dueDate: string | null;
  done: boolean;
  completedAt: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  FOLLOW_UP: "Follow Up", CALL: "Call", EMAIL: "Email", TEXT: "Text",
  SHOWING: "Showing", THANK_YOU: "Thank You", OTHER: "Other",
};

function formatDue(dueDate: string | null): string {
  if (!dueDate) return "—";
  return new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TasksDashboardPage() {
  const [tasks, setTasks] = useState<CrossLeadTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedTasks, setCompletedTasks] = useState<CrossLeadTask[]>([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedLoaded, setCompletedLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/tasks?done=false")
      .then((r) => r.json())
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function loadCompleted() {
    if (completedLoaded) return;
    setCompletedLoading(true);
    try {
      const res = await fetch("/api/tasks?done=true");
      const data: CrossLeadTask[] = await res.json();
      setCompletedTasks(data);
      setCompletedLoaded(true);
    } catch {
      // ignore
    } finally {
      setCompletedLoading(false);
    }
  }

  async function checkOff(task: CrossLeadTask) {
    // Optimistic removal from open list
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      await fetch(`/api/leads/${task.leadId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true }),
      });
    } catch {
      // No snap-back — consistent with spec intent; task disappearing is correct behavior
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toDateString();

  const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < today);
  const dueToday = tasks.filter((t) => t.dueDate && new Date(t.dueDate).toDateString() === todayStr);
  const upcoming = tasks.filter(
    (t) => !t.dueDate || (new Date(t.dueDate) > today && new Date(t.dueDate).toDateString() !== todayStr)
  );

  const allEmpty = !loading && tasks.length === 0;

  function TaskRow({ task }: { task: CrossLeadTask }) {
    const leadName = `${task.leadFirstName} ${task.leadLastName}`.trim();
    return (
      <div className="flex items-center gap-3 rounded-lg bg-[#F2F0EF] px-3 py-2">
        <input
          type="checkbox"
          checked={false}
          onChange={() => checkOff(task)}
          className="h-4 w-4 accent-[#9E8C61]"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[#1B1B1B]">{task.title}</p>
          <p className="text-xs text-[#1B1B1B]/40">
            {TYPE_LABELS[task.taskType] ?? task.taskType}
            {" · "}
            <Link href={`/dashboard/leads/${task.leadId}`} className="hover:text-[#9E8C61] hover:underline" onClick={(e) => e.stopPropagation()}>
              {leadName || "Unknown Lead"}
            </Link>
          </p>
        </div>
        <span className="shrink-0 text-xs text-[#1B1B1B]/40">{formatDue(task.dueDate)}</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Tasks</h1>
        <p className="mt-1 text-sm text-[#1B1B1B]/40">Your open tasks across all leads</p>
      </div>

      {loading && <p className="text-sm text-[#1B1B1B]/40">Loading…</p>}

      {allEmpty && (
        <p className="text-center text-sm text-[#1B1B1B]/40">You&apos;re all caught up.</p>
      )}

      {overdue.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-medium text-red-500">Overdue</p>
          <div className="space-y-1">{overdue.map((t) => <TaskRow key={t.id} task={t} />)}</div>
        </section>
      )}

      {dueToday.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-medium text-amber-600">Due Today</p>
          <div className="space-y-1">{dueToday.map((t) => <TaskRow key={t.id} task={t} />)}</div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-medium text-[#1B1B1B]/40">Upcoming</p>
          <div className="space-y-1">{upcoming.map((t) => <TaskRow key={t.id} task={t} />)}</div>
        </section>
      )}

      {/* Completed — lazy loaded on expand */}
      <details onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) loadCompleted(); }}>
        <summary className="cursor-pointer text-xs text-[#1B1B1B]/40">Completed tasks</summary>
        <div className="mt-2 space-y-1">
          {completedLoading && <p className="text-sm text-[#1B1B1B]/40">Loading…</p>}
          {completedLoaded && completedTasks.length === 0 && (
            <p className="text-sm text-[#1B1B1B]/40">No completed tasks.</p>
          )}
          {completedTasks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg bg-[#F2F0EF] px-3 py-2 opacity-50">
              <input type="checkbox" checked disabled className="h-4 w-4 accent-[#9E8C61]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm line-through text-[#1B1B1B]/60">{t.title}</p>
                <p className="text-xs text-[#1B1B1B]/30">
                  {TYPE_LABELS[t.taskType] ?? t.taskType}
                  {" · "}
                  <Link href={`/dashboard/leads/${t.leadId}`} className="hover:underline">
                    {`${t.leadFirstName} ${t.leadLastName}`.trim()}
                  </Link>
                </p>
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```powershell
pnpm --filter web tsc --noEmit
```

Expected: zero new errors

- [ ] **Step 4: Verify tests still pass**

```powershell
pnpm --filter web vitest run
```

Expected: all tests pass (same count as before)

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(dashboard)/dashboard/tasks/page.tsx" \
        "apps/web/src/app/(dashboard)/layout.tsx"
git commit -m "feat: /dashboard/tasks cross-lead tasks page + Tasks nav entry"
```

---

## Self-Review

### Spec Coverage Check

| Spec requirement | Task that covers it |
|---|---|
| `notes String?` added to LeadTask schema | Task 1 |
| `GET /api/leads/[id]/tasks` | Task 2 |
| `notes` in PATCH schema | Task 2 |
| `GET /api/tasks` cross-lead (ADMIN sees all, AGENT sees own leads) | Task 2 |
| `GET /api/tasks?done=false/true` filtering | Task 2 |
| Cross-lead response shape with `leadFirstName`/`leadLastName` | Task 2 |
| `LeadTaskDrawer` slide-in with title/type/dueDate/notes | Task 3 |
| Always-mounted (CSS hidden, not conditional) | Task 3 |
| `useEffect` to populate fields on `task` change | Task 3 |
| Save: PATCH → onSaved + onClose | Task 3 |
| Delete: window.confirm → DELETE → onDeleted + onClose | Task 3 |
| Inline error state | Task 3 |
| `LeadTasksTab`: selectedTask + editDrawerOpen state | Task 4 |
| `TaskRow` onClick opens drawer | Task 4 |
| onSaved updates task in local state | Task 4 |
| onDeleted removes task from local state | Task 4 |
| `/dashboard/tasks` page with Overdue/Due Today/Upcoming | Task 5 |
| Completed: collapsed `<details>`, lazy-loaded | Task 5 |
| Check-off via PATCH, optimistic removal, no snap-back | Task 5 |
| Lead name as Link to `/dashboard/leads/[leadId]` | Task 5 |
| Empty state: "You're all caught up." | Task 5 |
| Tasks nav entry between Pipeline and Transactions | Task 5 |

### Placeholder Scan — Clean ✅

No TBD, TODO, or incomplete steps found.

### Type Consistency Check

- `LeadTaskRow` (in `LeadTaskDrawer`) uses `leadId?: string` — the `LeadTasksTab` supplies it via `leadId` prop fallback, preventing null issues
- `CrossLeadTask` in the dashboard page uses `string | null` for optional date fields — matches the `serializeTask` function output in `GET /api/tasks`
- `done=false` filter: the admin test asserts `where` does NOT contain `lead: anything()` — this is satisfied because the admin branch simply omits `!isAdmin ? { lead: { agentId } } : {}` via the ternary
- The `PATCH` body spread `{ ...body }` in `[taskId]/route.ts` correctly passes `notes` through to Prisma since `notes` is now in `patchSchema` and `data: Record<string, unknown> = { ...body }` captures all parsed fields
