# Phase 7 Sub-project 1: Lead Profile Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Lead model and profile UI with tags, relationships, CRM tasks, homes tab, CSV export, lead merge, auto-tagging, and admin tag management — the foundation all other Phase 7 sub-projects depend on.

**Architecture:** Schema-first — migration runs first, then API routes (all follow `requireAuth` + Zod + Prisma pattern), then UI components (Server Components for data, Client Components for interactivity only), then page rewrites, then auto-tagging hooks.

**Tech Stack:** Next.js 14 App Router (TypeScript), Prisma 5 + PostgreSQL, Tailwind CSS + shadcn/ui, NextAuth (`requireAuth` from `@/lib/api-auth`), Zod validation, `z` from `zod`

## Global Constraints

- All API routes use `requireAuth` from `@/lib/api-auth` — never `getServerSession` directly in routes
- Agent ownership check pattern: get agent via `prisma.agent.findUnique({ where: { userId } })`, then verify `lead.agentId === agent.id`; ADMIN bypasses
- Admin pages use `requireAdminPage()` from `@/lib/server-utils` (redirects to /dashboard if not ADMIN)
- Brand colors: gold `#9E8C61`, dark `#1B1B1B`, off-white `#F2F0EF`
- All Prisma imports: `import { prisma } from "@/lib/prisma"`
- pnpm workspace — run migrations with `pnpm --filter database prisma migrate dev --name <name>`
- Commit after every task

---

## File Map

**Modified:**
- `packages/database/prisma/schema.prisma`
- `apps/web/src/lib/campaign-ui.ts`
- `apps/web/src/app/api/leads/[id]/route.ts` (extend patchSchema + GET include)
- `apps/web/src/app/api/leads/[id]/activities/route.ts` (set lastContactedAt)
- `apps/web/src/app/api/leads/route.ts` (add auto-tagging on POST)
- `apps/web/src/app/(dashboard)/dashboard/leads/[id]/page.tsx` (full rewrite)
- `apps/web/src/app/(dashboard)/admin/leads/page.tsx` (export + merge)

**Created — Lib:**
- `apps/web/src/lib/tags.ts`
- `apps/web/src/lib/lead-export.ts`

**Created — API Routes:**
- `apps/web/src/app/api/leads/[id]/tags/route.ts`
- `apps/web/src/app/api/leads/[id]/tags/[tagId]/route.ts`
- `apps/web/src/app/api/leads/[id]/relationships/route.ts`
- `apps/web/src/app/api/leads/[id]/relationships/[relId]/route.ts`
- `apps/web/src/app/api/leads/[id]/tasks/route.ts`
- `apps/web/src/app/api/leads/[id]/tasks/[taskId]/route.ts`
- `apps/web/src/app/api/leads/[id]/homes/route.ts`
- `apps/web/src/app/api/leads/export/route.ts`
- `apps/web/src/app/api/admin/leads/merge/route.ts`
- `apps/web/src/app/api/admin/tags/route.ts`
- `apps/web/src/app/api/admin/tags/[id]/route.ts`

**Created — Components:**
- `apps/web/src/components/leads/TagPicker.tsx`
- `apps/web/src/components/leads/RelationshipSection.tsx`
- `apps/web/src/components/leads/LeadTasksTab.tsx`
- `apps/web/src/components/leads/HomesTab.tsx`
- `apps/web/src/components/leads/LeadDetailSidebar.tsx`

**Created — Pages:**
- `apps/web/src/app/(dashboard)/admin/leads/[id]/page.tsx`
- `apps/web/src/app/(dashboard)/admin/settings/tags/page.tsx`

---

### Task 1: Schema Migration + Status Colors

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `apps/web/src/lib/campaign-ui.ts`

- [ ] **Step 1: Add 3 values to LeadStatus enum in schema.prisma**

Find the `enum LeadStatus` block and replace with:
```prisma
enum LeadStatus {
  NEW
  CONTACTED
  QUALIFIED
  HOT_PROSPECT
  NURTURE
  SHOWING
  OFFER
  UNDER_CONTRACT
  CLOSED
  LOST
  SPHERE
}
```

- [ ] **Step 2: Add 4 fields + back-relations to Lead model**

Inside the `model Lead` block, after `agentId String?` add:
```prisma
  priceMin        Float?
  priceMax        Float?
  timeframeToMove String?
  lastContactedAt DateTime?

  tags              LeadTag[]
  tasks             LeadTask[]
  customFieldValues CustomFieldValue[]
  relationshipsFrom LeadRelationship[] @relation("RelationshipFrom")
  relationshipsTo   LeadRelationship[] @relation("RelationshipTo")
```

- [ ] **Step 3: Add new models at end of schema.prisma**

Append after the existing `model Message` block:
```prisma
model Tag {
  id        String   @id @default(cuid())
  name      String   @unique
  color     String   @default("#9E8C61")
  createdAt DateTime @default(now())

  leads LeadTag[]
}

model LeadTag {
  leadId String
  tagId  String

  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId],  references: [id], onDelete: Cascade)

  @@id([leadId, tagId])
}

model LeadRelationship {
  id         String   @id @default(cuid())
  fromLeadId String
  toLeadId   String
  type       String
  createdAt  DateTime @default(now())

  fromLead Lead @relation("RelationshipFrom", fields: [fromLeadId], references: [id], onDelete: Cascade)
  toLead   Lead @relation("RelationshipTo",   fields: [toLeadId],   references: [id], onDelete: Cascade)

  @@unique([fromLeadId, toLeadId])
}

model LeadTask {
  id          String    @id @default(cuid())
  leadId      String
  title       String
  taskType    String    @default("FOLLOW_UP")
  assigneeId  String?
  dueDate     DateTime?
  done        Boolean   @default(false)
  completedAt DateTime?
  createdAt   DateTime  @default(now())

  lead     Lead   @relation(fields: [leadId],     references: [id], onDelete: Cascade)
  assignee Agent? @relation("TaskAssignee", fields: [assigneeId], references: [id])
}

model PropertyView {
  id        String   @id @default(cuid())
  userId    String
  mlsNumber String
  viewedAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([mlsNumber])
}

model CustomFieldDef {
  id          String   @id @default(cuid())
  name        String
  fieldType   String
  options     Json     @default("[]")
  order       Int      @default(0)
  hideIfEmpty Boolean  @default(false)
  createdAt   DateTime @default(now())

  values CustomFieldValue[]
}

model CustomFieldValue {
  id               String @id @default(cuid())
  customFieldDefId String
  leadId           String
  value            String

  def  CustomFieldDef @relation(fields: [customFieldDefId], references: [id], onDelete: Cascade)
  lead Lead           @relation(fields: [leadId],           references: [id], onDelete: Cascade)

  @@unique([customFieldDefId, leadId])
}
```

- [ ] **Step 4: Add back-relations to User and Agent models**

In `model User`, after `blogPosts BlogPost[]` add:
```prisma
  propertyViews PropertyView[]
```

In `model Agent`, after `campaigns Campaign[]` add:
```prisma
  assignedTasks LeadTask[] @relation("TaskAssignee")
```

- [ ] **Step 5: Run migration**

```bash
pnpm --filter database prisma migrate dev --name phase7-lead-profile-enhancements
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 6: Update campaign-ui.ts with new status colors and labels**

In `apps/web/src/lib/campaign-ui.ts`, extend `LEAD_STATUS_COLORS`:
```ts
export const LEAD_STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-yellow-100 text-yellow-700",
  QUALIFIED: "bg-purple-100 text-purple-700",
  HOT_PROSPECT: "bg-red-100 text-red-700",
  NURTURE: "bg-teal-100 text-teal-700",
  SHOWING: "bg-orange-100 text-orange-700",
  OFFER: "bg-pink-100 text-pink-700",
  UNDER_CONTRACT: "bg-indigo-100 text-indigo-700",
  CLOSED: "bg-green-100 text-green-700",
  LOST: "bg-gray-100 text-gray-500",
  SPHERE: "bg-amber-100 text-amber-700",
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/database/prisma/ apps/web/src/lib/campaign-ui.ts
git commit -m "feat(schema): phase7 sub1 — add LeadStatus stages, Tag/LeadTask/Relationship/PropertyView models"
```

---

### Task 2: Shared Utilities

**Files:**
- Create: `apps/web/src/lib/tags.ts`
- Create: `apps/web/src/lib/lead-export.ts`

- [ ] **Step 1: Create `apps/web/src/lib/tags.ts`**

```ts
import { prisma } from "@/lib/prisma";

export async function applyTag(leadId: string, tagName: string): Promise<void> {
  const tag = await prisma.tag.upsert({
    where: { name: tagName },
    update: {},
    create: { name: tagName },
  });
  await prisma.leadTag.upsert({
    where: { leadId_tagId: { leadId, tagId: tag.id } },
    update: {},
    create: { leadId, tagId: tag.id },
  });
}

export async function removeTag(leadId: string, tagId: string): Promise<void> {
  await prisma.leadTag.deleteMany({ where: { leadId, tagId } });
}
```

- [ ] **Step 2: Create `apps/web/src/lib/lead-export.ts`**

```ts
type LeadRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  source: string;
  tags: { tag: { name: string } }[];
  priceMin: number | null;
  priceMax: number | null;
  timeframeToMove: string | null;
  agent: { user: { name: string | null } } | null;
  createdAt: Date;
  lastContactedAt: Date | null;
};

export function leadsToCSV(leads: LeadRow[]): string {
  const headers = [
    "First Name", "Last Name", "Email", "Phone", "Stage", "Source",
    "Tags", "Price Min", "Price Max", "Timeframe", "Assigned Agent",
    "Created Date", "Last Contacted",
  ];

  const escape = (val: string | null | undefined) => {
    if (val == null) return "";
    const s = String(val);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = leads.map((l) => [
    escape(l.firstName),
    escape(l.lastName),
    escape(l.email),
    escape(l.phone),
    escape(l.status.replace(/_/g, " ")),
    escape(l.source),
    escape(l.tags.map((t) => t.tag.name).join("; ")),
    l.priceMin != null ? String(l.priceMin) : "",
    l.priceMax != null ? String(l.priceMax) : "",
    escape(l.timeframeToMove),
    escape(l.agent?.user?.name),
    l.createdAt.toLocaleDateString(),
    l.lastContactedAt ? l.lastContactedAt.toLocaleDateString() : "",
  ].join(","));

  return [headers.join(","), ...rows].join("\n");
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/tags.ts apps/web/src/lib/lead-export.ts
git commit -m "feat(lib): add applyTag utility and leadsToCSV helper"
```

---

### Task 3: Extend Lead PATCH + GET API

**Files:**
- Modify: `apps/web/src/app/api/leads/[id]/route.ts`

- [ ] **Step 1: Replace the file content**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

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

async function getAgentOrNull(userId: string) {
  return prisma.agent.findUnique({ where: { userId } });
}

async function assertOwnership(leadId: string, userId: string, role: string) {
  if (role === "ADMIN") return true;
  const [agent, lead] = await Promise.all([
    getAgentOrNull(userId),
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

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);
    const lead = await prisma.lead.update({ where: { id: params.id }, data });
    return NextResponse.json(lead);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Update activities route to set lastContactedAt**

In `apps/web/src/app/api/leads/[id]/activities/route.ts`, after the `activity` is created, add:
```ts
    // Update lastContactedAt on the lead whenever an activity is logged
    await prisma.lead.update({
      where: { id: params.id },
      data: { lastContactedAt: new Date() },
    });
```
Insert this between the `activity` creation and the `return NextResponse.json(activity, { status: 201 })` line.

- [ ] **Step 3: Verify with curl (dev server must be running)**

```bash
# Start dev server in another terminal: pnpm dev
curl -s http://localhost:3000/api/leads/export 2>&1 | head -5
# Expected: {"error":"Unauthorized"} — confirms route exists and auth is working
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/leads/[id]/route.ts apps/web/src/app/api/leads/[id]/activities/route.ts
git commit -m "feat(api): extend lead PATCH with new fields, enrich GET includes, set lastContactedAt on activity"
```

---

### Task 4: Tags API Routes

**Files:**
- Create: `apps/web/src/app/api/leads/[id]/tags/route.ts`
- Create: `apps/web/src/app/api/leads/[id]/tags/[tagId]/route.ts`

- [ ] **Step 1: Create `apps/web/src/app/api/leads/[id]/tags/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { applyTag } from "@/lib/tags";

const schema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
});

async function assertOwnership(leadId: string, userId: string, role: string) {
  if (role === "ADMIN") return true;
  const agent = await prisma.agent.findUnique({ where: { userId } });
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { agentId: true } });
  return agent && lead && lead.agentId === agent.id;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const owns = await assertOwnership(params.id, session.user.id, session.user.role);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { name, color } = schema.parse(await req.json());
    const tag = await prisma.tag.upsert({
      where: { name },
      update: color ? { color } : {},
      create: { name, ...(color ? { color } : {}) },
    });
    await prisma.leadTag.upsert({
      where: { leadId_tagId: { leadId: params.id, tagId: tag.id } },
      update: {},
      create: { leadId: params.id, tagId: tag.id },
    });
    return NextResponse.json(tag, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `apps/web/src/app/api/leads/[id]/tags/[tagId]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; tagId: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  if (session.user.role !== "ADMIN") {
    const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
    const lead = await prisma.lead.findUnique({ where: { id: params.id }, select: { agentId: true } });
    if (!agent || !lead || lead.agentId !== agent.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  await prisma.leadTag.deleteMany({ where: { leadId: params.id, tagId: params.tagId } });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/leads/[id]/tags/
git commit -m "feat(api): tags endpoints — apply/remove tags on leads"
```

---

### Task 5: Relationships + Tasks API Routes

**Files:**
- Create: `apps/web/src/app/api/leads/[id]/relationships/route.ts`
- Create: `apps/web/src/app/api/leads/[id]/relationships/[relId]/route.ts`
- Create: `apps/web/src/app/api/leads/[id]/tasks/route.ts`
- Create: `apps/web/src/app/api/leads/[id]/tasks/[taskId]/route.ts`

- [ ] **Step 1: Create relationships POST route**

`apps/web/src/app/api/leads/[id]/relationships/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const schema = z.object({
  toLeadId: z.string().min(1),
  type: z.enum(["SPOUSE","PARTNER","FAMILY","REFERRAL"]),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  try {
    const { toLeadId, type } = schema.parse(await req.json());
    if (toLeadId === params.id) {
      return NextResponse.json({ error: "Cannot link a lead to itself" }, { status: 400 });
    }
    const rel = await prisma.leadRelationship.upsert({
      where: { fromLeadId_toLeadId: { fromLeadId: params.id, toLeadId } },
      update: { type },
      create: { fromLeadId: params.id, toLeadId, type },
    });
    return NextResponse.json(rel, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create relationships DELETE route**

`apps/web/src/app/api/leads/[id]/relationships/[relId]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; relId: string } }
) {
  const { error } = await requireAuth("AGENT");
  if (error) return error;

  await prisma.leadRelationship.deleteMany({
    where: {
      id: params.relId,
      OR: [{ fromLeadId: params.id }, { toLeadId: params.id }],
    },
  });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: Create tasks POST route**

`apps/web/src/app/api/leads/[id]/tasks/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const TASK_TYPES = ["FOLLOW_UP","CALL","EMAIL","TEXT","SHOWING","THANK_YOU","OTHER"] as const;

const schema = z.object({
  title: z.string().min(1),
  taskType: z.enum(TASK_TYPES).default("FOLLOW_UP"),
  assigneeId: z.string().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

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
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create tasks PATCH + DELETE route**

`apps/web/src/app/api/leads/[id]/tasks/[taskId]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  taskType: z.enum(["FOLLOW_UP","CALL","EMAIL","TEXT","SHOWING","THANK_YOU","OTHER"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  done: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string; taskId: string } }) {
  const { error } = await requireAuth("AGENT");
  if (error) return error;

  try {
    const body = patchSchema.parse(await req.json());
    const data: Record<string, unknown> = { ...body };
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.done === true) data.completedAt = new Date();
    if (body.done === false) data.completedAt = null;

    const task = await prisma.leadTask.update({ where: { id: params.taskId }, data });
    return NextResponse.json(task);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; taskId: string } }) {
  const { error } = await requireAuth("AGENT");
  if (error) return error;

  await prisma.leadTask.delete({ where: { id: params.taskId } });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/leads/[id]/relationships/ apps/web/src/app/api/leads/[id]/tasks/
git commit -m "feat(api): lead relationships and CRM tasks endpoints"
```

---

### Task 6: Homes, Export, Merge + Admin Tags API Routes

**Files:**
- Create: `apps/web/src/app/api/leads/[id]/homes/route.ts`
- Create: `apps/web/src/app/api/leads/export/route.ts`
- Create: `apps/web/src/app/api/admin/leads/merge/route.ts`
- Create: `apps/web/src/app/api/admin/tags/route.ts`
- Create: `apps/web/src/app/api/admin/tags/[id]/route.ts`

- [ ] **Step 1: Create homes GET route**

`apps/web/src/app/api/leads/[id]/homes/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("AGENT");
  if (error) return error;

  const lead = await prisma.lead.findUnique({ where: { id: params.id }, select: { email: true } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await prisma.user.findFirst({ where: { email: lead.email, role: "BUYER" } });
  if (!user) return NextResponse.json({ saved: [], viewed: [] });

  const [saved, viewed] = await Promise.all([
    prisma.savedProperty.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.propertyView.findMany({
      where: { userId: user.id },
      orderBy: { viewedAt: "desc" },
      take: 50,
    }),
  ]);

  const mlsNumbers = [...new Set([...saved.map(s => s.mlsNumber), ...viewed.map(v => v.mlsNumber)])];
  const properties = await prisma.property.findMany({
    where: { mlsNumber: { in: mlsNumbers } },
    select: { mlsNumber: true, address: true, city: true, listPrice: true, beds: true, baths: true, sqft: true, photos: true },
  });
  const propMap = Object.fromEntries(properties.map(p => [p.mlsNumber, p]));

  return NextResponse.json({
    saved: saved.map(s => ({ ...s, property: propMap[s.mlsNumber] ?? null })),
    viewed: viewed.map(v => ({ ...v, property: propMap[v.mlsNumber] ?? null })),
  });
}
```

- [ ] **Step 2: Create export CSV route**

`apps/web/src/app/api/leads/export/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { leadsToCSV } from "@/lib/lead-export";

export async function GET() {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { id: userId, role } = session.user;

  let where = {};
  if (role !== "ADMIN") {
    const agent = await prisma.agent.findUnique({ where: { userId } });
    if (!agent) return NextResponse.json([]);
    where = { agentId: agent.id };
  }

  const leads = await prisma.lead.findMany({
    where,
    include: {
      tags: { include: { tag: true } },
      agent: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const csv = leadsToCSV(leads);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="cnc-leads-${date}.csv"`,
    },
  });
}
```

- [ ] **Step 3: Create admin merge route**

`apps/web/src/app/api/admin/leads/merge/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const schema = z.object({ winnerId: z.string(), loserId: z.string() });

export async function POST(req: Request) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  try {
    const { winnerId, loserId } = schema.parse(await req.json());
    if (winnerId === loserId) return NextResponse.json({ error: "Cannot merge a lead with itself" }, { status: 400 });

    await prisma.$transaction([
      prisma.activity.updateMany({ where: { leadId: loserId }, data: { leadId: winnerId } }),
      prisma.leadTag.deleteMany({ where: { leadId: loserId } }),
      prisma.leadTask.updateMany({ where: { leadId: loserId }, data: { leadId: winnerId } }),
      prisma.leadRelationship.deleteMany({ where: { OR: [{ fromLeadId: loserId }, { toLeadId: loserId }] } }),
      prisma.campaignContact.deleteMany({ where: { leadId: loserId } }),
      prisma.lead.delete({ where: { id: loserId } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create admin tags list + create route**

`apps/web/src/app/api/admin/tags/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const tags = await prisma.tag.findMany({
    include: { _count: { select: { leads: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(tags);
}

export async function POST(req: Request) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const schema = z.object({ name: z.string().min(1), color: z.string().default("#9E8C61") });
  try {
    const data = schema.parse(await req.json());
    const tag = await prisma.tag.create({ data });
    return NextResponse.json(tag, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Create admin tags update + delete route**

`apps/web/src/app/api/admin/tags/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  try {
    const data = patchSchema.parse(await req.json());
    const tag = await prisma.tag.update({ where: { id: params.id }, data });
    return NextResponse.json(tag);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "true";

  const count = await prisma.leadTag.count({ where: { tagId: params.id } });
  if (count > 0 && !force) {
    return NextResponse.json({ error: `Used by ${count} leads`, count }, { status: 409 });
  }

  await prisma.leadTag.deleteMany({ where: { tagId: params.id } });
  await prisma.tag.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/leads/[id]/homes/ apps/web/src/app/api/leads/export/ apps/web/src/app/api/admin/leads/ apps/web/src/app/api/admin/tags/
git commit -m "feat(api): homes, export CSV, merge leads, admin tags CRUD"
```

---

### Task 7: TagPicker Component

**Files:**
- Create: `apps/web/src/components/leads/TagPicker.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useEffect, useRef } from "react";

type Tag = { id: string; name: string; color: string };

interface Props {
  leadId: string;
  applied: Tag[];
  onApplied: (tag: Tag) => void;
  onRemoved: (tagId: string) => void;
}

const PRESET_COLORS = ["#9E8C61","#3B82F6","#22C55E","#EF4444","#A855F7","#F97316","#14B8A6","#6B7280"];

export function TagPicker({ leadId, applied, onApplied, onRemoved }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [creating, setCreating] = useState(false);
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/tags")
      .then((r) => r.json())
      .then((data) => setAllTags(Array.isArray(data) ? data : []));
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const appliedIds = new Set(applied.map((t) => t.id));
  const filtered = allTags.filter(
    (t) => !appliedIds.has(t.id) && t.name.toLowerCase().includes(query.toLowerCase())
  );
  const exactMatch = allTags.some((t) => t.name.toLowerCase() === query.toLowerCase());

  async function applyTag(tag: Tag) {
    await fetch(`/api/leads/${leadId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tag.name, color: tag.color }),
    });
    onApplied(tag);
    setQuery("");
  }

  async function createAndApply() {
    const res = await fetch(`/api/leads/${leadId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: query.trim(), color: newColor }),
    });
    const tag = await res.json();
    onApplied(tag);
    setQuery("");
    setCreating(false);
    setAllTags((prev) => [...prev, tag]);
  }

  async function removeTag(tagId: string) {
    await fetch(`/api/leads/${leadId}/tags/${tagId}`, { method: "DELETE" });
    onRemoved(tagId);
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap gap-1.5">
        {applied.map((tag) => (
          <span
            key={tag.id}
            className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={() => removeTag(tag.id)}
              className="ml-0.5 opacity-70 hover:opacity-100"
              aria-label={`Remove ${tag.name}`}
            >
              ×
            </button>
          </span>
        ))}
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-dashed border-[#1B1B1B]/20 px-2.5 py-0.5 text-xs text-[#1B1B1B]/40 hover:border-[#9E8C61] hover:text-[#9E8C61]"
        >
          + Add Tag
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-[#1B1B1B]/10 bg-white p-2 shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCreating(false); }}
            placeholder="Search or create tag..."
            className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-1.5 text-sm outline-none focus:border-[#9E8C61]"
          />
          <div className="mt-1 max-h-48 overflow-y-auto">
            {filtered.map((tag) => (
              <button
                key={tag.id}
                onClick={() => applyTag(tag)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[#F2F0EF]"
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))}
            {query.trim() && !exactMatch && (
              <button
                onClick={() => setCreating(true)}
                className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-[#9E8C61] hover:bg-[#F2F0EF]"
              >
                Create &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
          {creating && (
            <div className="mt-2 border-t border-[#1B1B1B]/10 pt-2">
              <p className="mb-1.5 text-xs text-[#1B1B1B]/50">Choose color</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className="h-5 w-5 rounded-full"
                    style={{ backgroundColor: c, outline: newColor === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }}
                  />
                ))}
              </div>
              <button
                onClick={createAndApply}
                className="mt-2 w-full rounded-lg bg-[#1B1B1B] py-1.5 text-xs font-medium text-white hover:bg-[#1B1B1B]/80"
              >
                Create tag
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/leads/TagPicker.tsx
git commit -m "feat(ui): TagPicker component — search, apply, create, remove tags inline"
```

---

### Task 8: LeadDetailSidebar Component

**Files:**
- Create: `apps/web/src/components/leads/LeadDetailSidebar.tsx`
- Create: `apps/web/src/components/leads/RelationshipSection.tsx`

- [ ] **Step 1: Create RelationshipSection**

`apps/web/src/components/leads/RelationshipSection.tsx`:
```tsx
"use client";

import { useState } from "react";

type LinkedLead = { id: string; firstName: string; lastName: string; email: string };
type Relationship = { id: string; type: string; lead: LinkedLead };

interface Props {
  leadId: string;
  relationships: Relationship[];
  onChanged: () => void;
}

const REL_TYPES = ["SPOUSE","PARTNER","FAMILY","REFERRAL"] as const;

export function RelationshipSection({ leadId, relationships, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkedLead[]>([]);
  const [selected, setSelected] = useState<LinkedLead | null>(null);
  const [type, setType] = useState<string>("SPOUSE");

  async function search(q: string) {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    const res = await fetch(`/api/leads?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setResults((Array.isArray(data) ? data : []).filter((l: LinkedLead) => l.id !== leadId).slice(0, 8));
  }

  async function save() {
    if (!selected) return;
    await fetch(`/api/leads/${leadId}/relationships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toLeadId: selected.id, type }),
    });
    setOpen(false);
    setSelected(null);
    setQuery("");
    onChanged();
  }

  async function remove(relId: string) {
    await fetch(`/api/leads/${leadId}/relationships/${relId}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Relationships</p>
      <div className="space-y-1.5">
        {relationships.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg bg-[#F2F0EF] px-3 py-2">
            <div>
              <p className="text-sm font-medium text-[#1B1B1B]">{r.lead.firstName} {r.lead.lastName}</p>
              <p className="text-xs text-[#1B1B1B]/50">{r.type.charAt(0) + r.type.slice(1).toLowerCase()}</p>
            </div>
            <button onClick={() => remove(r.id)} className="text-xs text-[#1B1B1B]/30 hover:text-red-500">Remove</button>
          </div>
        ))}
      </div>
      <button
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-[#9E8C61] hover:underline"
      >
        + Link Contact
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 font-sans text-lg font-light text-[#1B1B1B]">Link a Contact</h3>
            <input
              autoFocus
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
            />
            {results.length > 0 && !selected && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[#1B1B1B]/10">
                {results.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => { setSelected(l); setQuery(`${l.firstName} ${l.lastName}`); }}
                    className="flex w-full flex-col px-3 py-2 text-left hover:bg-[#F2F0EF]"
                  >
                    <span className="text-sm font-medium">{l.firstName} {l.lastName}</span>
                    <span className="text-xs text-[#1B1B1B]/50">{l.email}</span>
                  </button>
                ))}
              </div>
            )}
            {selected && (
              <div className="mt-3">
                <label className="mb-1 block text-xs text-[#1B1B1B]/50">Relationship type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm"
                >
                  {REL_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={() => { setOpen(false); setSelected(null); setQuery(""); }} className="flex-1 rounded-lg border border-[#1B1B1B]/10 py-2 text-sm">Cancel</button>
              <button onClick={save} disabled={!selected} className="flex-1 rounded-lg bg-[#1B1B1B] py-2 text-sm font-medium text-white disabled:opacity-40">Link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create LeadDetailSidebar**

`apps/web/src/components/leads/LeadDetailSidebar.tsx`:
```tsx
"use client";

import { useState } from "react";
import { TagPicker } from "./TagPicker";
import { RelationshipSection } from "./RelationshipSection";

type Tag = { id: string; name: string; color: string };
type Relationship = { id: string; type: string; lead: { id: string; firstName: string; lastName: string; email: string } };

const STATUSES = [
  { value: "NEW", label: "New Lead" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "HOT_PROSPECT", label: "Hot Prospect" },
  { value: "NURTURE", label: "Nurture" },
  { value: "SHOWING", label: "Showing" },
  { value: "OFFER", label: "Offer" },
  { value: "UNDER_CONTRACT", label: "Under Contract" },
  { value: "CLOSED", label: "Past Client" },
  { value: "LOST", label: "Dead Lead" },
  { value: "SPHERE", label: "Sphere" },
];

const TIMEFRAMES = ["0-3 months","3-6 months","6-12 months","12+ months","Unknown"];

interface Props {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    status: string;
    source: string;
    score: number;
    priceMin: number | null;
    priceMax: number | null;
    timeframeToMove: string | null;
    lastContactedAt: string | null;
    createdAt: string;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    tags: { tag: Tag }[];
    relationshipsFrom: Relationship[];
    relationshipsTo: Relationship[];
  };
  onRefresh: () => void;
}

export function LeadDetailSidebar({ lead, onRefresh }: Props) {
  const [tags, setTags] = useState<Tag[]>(lead.tags.map((t) => t.tag));

  const allRelationships = [
    ...lead.relationshipsFrom.map((r) => ({ id: r.id, type: r.type, lead: r.lead })),
    ...lead.relationshipsTo.map((r) => ({ id: r.id, type: r.type, lead: r.lead })),
  ];

  async function patch(data: Record<string, unknown>) {
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    onRefresh();
  }

  const initials = `${lead.firstName[0] ?? ""}${lead.lastName[0] ?? ""}`.toUpperCase();
  const lastContacted = lead.lastContactedAt
    ? `${Math.floor((Date.now() - new Date(lead.lastContactedAt).getTime()) / 86400000)} days ago`
    : "Never contacted";

  return (
    <div className="space-y-4">
      {/* Contact Card */}
      <div className="rounded-2xl bg-white p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#9E8C61] font-sans text-lg font-medium text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate font-sans text-base font-medium text-[#1B1B1B]">
              {lead.firstName} {lead.lastName}
            </p>
            <p className="truncate text-sm text-[#1B1B1B]/50">{lead.email}</p>
            {lead.phone && <p className="text-sm text-[#1B1B1B]/50">{lead.phone}</p>}
          </div>
        </div>

        <label className="mb-1 block text-xs text-[#1B1B1B]/40">Stage</label>
        <select
          defaultValue={lead.status}
          onChange={(e) => patch({ status: e.target.value })}
          className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm"
        >
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <div className="mt-3 flex items-center justify-between text-xs text-[#1B1B1B]/40">
          <span>Last contact: {lastContacted}</span>
          <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Tags */}
      <div className="rounded-2xl bg-white p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Tags</p>
        <TagPicker
          leadId={lead.id}
          applied={tags}
          onApplied={(tag) => setTags((prev) => [...prev, tag])}
          onRemoved={(tagId) => setTags((prev) => prev.filter((t) => t.id !== tagId))}
        />
      </div>

      {/* Lead Details */}
      <div className="rounded-2xl bg-white p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Lead Details</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/40">Price Range</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min $"
                defaultValue={lead.priceMin ?? ""}
                onBlur={(e) => patch({ priceMin: e.target.value ? Number(e.target.value) : null })}
                className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-1.5 text-sm"
              />
              <input
                type="number"
                placeholder="Max $"
                defaultValue={lead.priceMax ?? ""}
                onBlur={(e) => patch({ priceMax: e.target.value ? Number(e.target.value) : null })}
                className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-1.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/40">Timeframe</label>
            <select
              defaultValue={lead.timeframeToMove ?? ""}
              onChange={(e) => patch({ timeframeToMove: e.target.value || null })}
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm"
            >
              <option value="">Unknown</option>
              {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {(lead.utmSource || lead.utmMedium || lead.utmCampaign) && (
            <details className="text-xs text-[#1B1B1B]/40">
              <summary className="cursor-pointer">Campaign details</summary>
              <div className="mt-1 space-y-0.5 pl-2">
                {lead.utmSource && <p>Source: {lead.utmSource}</p>}
                {lead.utmMedium && <p>Medium: {lead.utmMedium}</p>}
                {lead.utmCampaign && <p>Campaign: {lead.utmCampaign}</p>}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Relationships */}
      <div className="rounded-2xl bg-white p-5">
        <RelationshipSection leadId={lead.id} relationships={allRelationships} onChanged={onRefresh} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/leads/LeadDetailSidebar.tsx apps/web/src/components/leads/RelationshipSection.tsx
git commit -m "feat(ui): LeadDetailSidebar and RelationshipSection components"
```

---

### Task 9: LeadTasksTab + HomesTab Components

**Files:**
- Create: `apps/web/src/components/leads/LeadTasksTab.tsx`
- Create: `apps/web/src/components/leads/HomesTab.tsx`

- [ ] **Step 1: Create LeadTasksTab**

`apps/web/src/components/leads/LeadTasksTab.tsx`:
```tsx
"use client";

import { useState } from "react";

type LeadTask = {
  id: string;
  title: string;
  taskType: string;
  dueDate: string | null;
  done: boolean;
  completedAt: string | null;
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<string>("FOLLOW_UP");
  const [newDate, setNewDate] = useState("");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdue = tasks.filter((t) => !t.done && t.dueDate && new Date(t.dueDate) < today);
  const dueToday = tasks.filter((t) => !t.done && t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString());
  const upcoming = tasks.filter((t) => !t.done && (!t.dueDate || new Date(t.dueDate) > today) && !dueToday.includes(t));
  const completed = tasks.filter((t) => t.done);

  async function quickTask(daysFromNow: number) {
    const due = new Date();
    due.setDate(due.getDate() + daysFromNow);
    const res = await fetch(`/api/leads/${leadId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Follow Up", taskType: "FOLLOW_UP", dueDate: due.toISOString() }),
    });
    const task = await res.json();
    setTasks((prev) => [task, ...prev]);
  }

  async function toggleDone(task: LeadTask) {
    const res = await fetch(`/api/leads/${leadId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    });
    const updated = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
  }

  async function createTask() {
    const res = await fetch(`/api/leads/${leadId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, taskType: newType, dueDate: newDate ? new Date(newDate).toISOString() : null }),
    });
    const task = await res.json();
    setTasks((prev) => [task, ...prev]);
    setDrawerOpen(false);
    setNewTitle("");
    setNewType("FOLLOW_UP");
    setNewDate("");
  }

  function TaskRow({ task, accent }: { task: LeadTask; accent?: string }) {
    return (
      <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ${accent ?? "bg-[#F2F0EF]"}`}>
        <input
          type="checkbox"
          checked={task.done}
          onChange={() => toggleDone(task)}
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
        <button onClick={() => quickTask(1)} className="rounded-lg border border-[#1B1B1B]/10 px-3 py-1.5 text-xs hover:border-[#9E8C61] hover:text-[#9E8C61]">Tomorrow</button>
        <button onClick={() => quickTask(3)} className="rounded-lg border border-[#1B1B1B]/10 px-3 py-1.5 text-xs hover:border-[#9E8C61] hover:text-[#9E8C61]">In 3 Days</button>
        <button onClick={() => quickTask(7)} className="rounded-lg border border-[#1B1B1B]/10 px-3 py-1.5 text-xs hover:border-[#9E8C61] hover:text-[#9E8C61]">Next Week</button>
        <button onClick={() => setDrawerOpen(true)} className="ml-auto rounded-lg bg-[#1B1B1B] px-3 py-1.5 text-xs font-medium text-white">+ New Task</button>
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

      {/* New Task Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setDrawerOpen(false)} />
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
              <button onClick={() => setDrawerOpen(false)} className="flex-1 rounded-lg border border-[#1B1B1B]/10 py-2 text-sm">Cancel</button>
              <button onClick={createTask} disabled={!newTitle.trim()} className="flex-1 rounded-lg bg-[#1B1B1B] py-2 text-sm font-medium text-white disabled:opacity-40">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create HomesTab**

`apps/web/src/components/leads/HomesTab.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";

type PropertyCard = {
  mlsNumber: string;
  address: string;
  city: string;
  listPrice: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  photos: unknown;
};
type SavedItem = { mlsNumber: string; createdAt: string; property: PropertyCard | null };
type ViewedItem = { mlsNumber: string; viewedAt: string; property: PropertyCard | null };

function formatPrice(p: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(p);
}

function getPhoto(photos: unknown): string | null {
  if (!Array.isArray(photos) || photos.length === 0) return null;
  const first = photos[0];
  return typeof first === "string" ? first : (first as { url?: string })?.url ?? null;
}

function PropCard({ prop, sub }: { prop: PropertyCard; sub: string }) {
  const photo = getPhoto(prop.photos);
  return (
    <div className="rounded-xl border border-[#1B1B1B]/10 overflow-hidden">
      {photo ? (
        <img src={photo} alt={prop.address} className="h-32 w-full object-cover" />
      ) : (
        <div className="h-32 w-full bg-[#F2F0EF]" />
      )}
      <div className="p-3">
        <p className="text-sm font-medium text-[#1B1B1B]">{formatPrice(prop.listPrice)}</p>
        <p className="truncate text-xs text-[#1B1B1B]/60">{prop.address}, {prop.city}</p>
        <p className="text-xs text-[#1B1B1B]/40">{[prop.beds && `${prop.beds}bd`, prop.baths && `${prop.baths}ba`, prop.sqft && `${prop.sqft.toLocaleString()} sqft`].filter(Boolean).join(" · ")}</p>
        <p className="mt-1 text-xs text-[#1B1B1B]/30">{sub}</p>
      </div>
    </div>
  );
}

export function HomesTab({ leadId }: { leadId: string }) {
  const [data, setData] = useState<{ saved: SavedItem[]; viewed: ViewedItem[] } | null>(null);

  useEffect(() => {
    fetch(`/api/leads/${leadId}/homes`)
      .then((r) => r.json())
      .then(setData);
  }, [leadId]);

  if (!data) return <p className="text-sm text-[#1B1B1B]/40">Loading...</p>;

  if (data.saved.length === 0 && data.viewed.length === 0) {
    return <p className="text-sm text-[#1B1B1B]/40">This lead hasn&apos;t registered on the website yet or hasn&apos;t viewed any properties.</p>;
  }

  return (
    <div className="space-y-6">
      {data.saved.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Saved Properties</p>
          <div className="grid grid-cols-2 gap-3">
            {data.saved.map((s) => s.property && (
              <PropCard key={s.mlsNumber} prop={s.property} sub={`Saved ${new Date(s.createdAt).toLocaleDateString()}`} />
            ))}
          </div>
        </div>
      )}
      {data.viewed.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Recently Viewed</p>
          <div className="space-y-2">
            {data.viewed.map((v) => v.property && (
              <div key={`${v.mlsNumber}-${v.viewedAt}`} className="flex items-center gap-3 rounded-lg bg-[#F2F0EF] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[#1B1B1B]">{v.property.address}, {v.property.city}</p>
                  <p className="text-xs text-[#1B1B1B]/40">{formatPrice(v.property.listPrice)} · Viewed {new Date(v.viewedAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/leads/LeadTasksTab.tsx apps/web/src/components/leads/HomesTab.tsx
git commit -m "feat(ui): LeadTasksTab and HomesTab components"
```

---

### Task 10: Lead Profile Page Rewrite

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/leads/[id]/page.tsx`

- [ ] **Step 1: Replace the page with 2-column layout**

```tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { AddNoteForm } from "@/components/dashboard/AddNoteForm";
import { LeadDetailSidebar } from "@/components/leads/LeadDetailSidebar";
import { LeadTasksTab } from "@/components/leads/LeadTasksTab";
import { HomesTab } from "@/components/leads/HomesTab";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id;
  const role = (session!.user as any).role;

  let lead = null;
  try {
    const agent = role !== "ADMIN" ? await prisma.agent.findUnique({ where: { userId } }) : null;

    lead = await prisma.lead.findUnique({
      where: { id: params.id },
      include: {
        activities: { orderBy: { createdAt: "desc" } },
        tags: { include: { tag: true } },
        tasks: { orderBy: { createdAt: "asc" } },
        relationshipsFrom: {
          include: { toLead: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
        relationshipsTo: {
          include: { fromLead: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
    });

    if (!lead) notFound();
    if (agent && lead.agentId !== agent.id) notFound();
  } catch {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="font-light text-[#1B1B1B]">Unable to load lead. Please try again.</p>
      </div>
    );
  }

  if (!lead) notFound();

  // Normalize for client components
  const leadData = {
    ...lead,
    createdAt: lead.createdAt.toISOString(),
    lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
    tags: lead.tags,
    relationshipsFrom: lead.relationshipsFrom.map((r) => ({ id: r.id, type: r.type, lead: r.toLead })),
    relationshipsTo: lead.relationshipsTo.map((r) => ({ id: r.id, type: r.type, lead: r.fromLead })),
  };

  const tasks = lead.tasks.map((t) => ({
    ...t,
    dueDate: t.dueDate?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <Link href="/dashboard/leads" className="mb-6 inline-block font-sans text-sm text-[#1B1B1B]/40 hover:text-[#1B1B1B]">
        ← Back to Leads
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: sidebar */}
        <div className="lg:col-span-1">
          <LeadDetailSidebar lead={leadData as any} onRefresh={() => {}} />
        </div>

        {/* Right: tabbed panel */}
        <div className="lg:col-span-2">
          <LeadProfileTabs
            leadId={lead.id}
            activities={lead.activities.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))}
            tasks={tasks}
          />
        </div>
      </div>
    </div>
  );
}

// Inline Client Component for tab state
import("react");
```

**Note:** The tab switcher needs to be a client component for interactivity. Create a small wrapper:

`apps/web/src/components/leads/LeadProfileTabs.tsx`:
```tsx
"use client";

import { useState } from "react";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { AddNoteForm } from "@/components/dashboard/AddNoteForm";
import { LeadTasksTab } from "./LeadTasksTab";
import { HomesTab } from "./HomesTab";

type Tab = "activity" | "tasks" | "homes";

interface Props {
  leadId: string;
  activities: { id: string; type: string; content: string; createdAt: string }[];
  tasks: { id: string; title: string; taskType: string; dueDate: string | null; done: boolean; completedAt: string | null }[];
}

export function LeadProfileTabs({ leadId, activities, tasks }: Props) {
  const [tab, setTab] = useState<Tab>("activity");

  const tabs: { id: Tab; label: string }[] = [
    { id: "activity", label: "Activity" },
    { id: "tasks", label: "Tasks" },
    { id: "homes", label: "Homes" },
  ];

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-xl bg-[#F2F0EF] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-white text-[#1B1B1B] shadow-sm" : "text-[#1B1B1B]/50 hover:text-[#1B1B1B]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-6">
        {tab === "activity" && (
          <div className="space-y-6">
            <AddNoteForm leadId={leadId} />
            <ActivityFeed activities={activities} />
          </div>
        )}
        {tab === "tasks" && <LeadTasksTab leadId={leadId} initialTasks={tasks} />}
        {tab === "homes" && <HomesTab leadId={leadId} />}
      </div>
    </div>
  );
}
```

Update the page to import and use `LeadProfileTabs` properly (remove the dangling `import("react")` line added as placeholder and replace with proper import at top of file).

Final page imports:
```tsx
import { LeadProfileTabs } from "@/components/leads/LeadProfileTabs";
```

Replace the right-column JSX with:
```tsx
<LeadProfileTabs leadId={lead.id} activities={...} tasks={tasks} />
```

- [ ] **Step 2: Test in browser**

Start dev server (`pnpm dev`), log in as an agent, navigate to any lead profile. Verify:
- [ ] 2-column layout renders (sidebar left, tabs right)
- [ ] Stage dropdown works — change stage and refresh, verify it persists
- [ ] Tags section shows "+ Add Tag", can add a tag
- [ ] Tasks tab shows quick task buttons, can create a task
- [ ] Homes tab shows "hasn't registered" placeholder if no buyer account

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/dashboard/leads/[id]/page.tsx apps/web/src/components/leads/LeadProfileTabs.tsx
git commit -m "feat(ui): rewrite lead profile page — 2-column layout with sidebar, tabs, tasks, homes"
```

---

### Task 11: Auto-tagging + Property View Tracking

**Files:**
- Modify: `apps/web/src/app/api/leads/route.ts`
- Modify: IDX property detail page (find with glob below)

- [ ] **Step 1: Add auto-tagging to lead creation**

In `apps/web/src/app/api/leads/route.ts`, update the `POST` handler.

Add import at top:
```ts
import { applyTag } from "@/lib/tags";
```

After `const lead = await prisma.lead.create({ data });`, replace the `sendLeadNotification` call with:
```ts
    // Fire-and-forget side effects
    Promise.all([
      sendLeadNotification(lead).catch(console.error),
      // Auto-tag: open house source
      data.source === "OPEN_HOUSE" ? applyTag(lead.id, "Open House").catch(console.error) : Promise.resolve(),
      // Auto-tag: city from property if mlsNumber provided in notes (extend schema later for explicit field)
    ]).catch(console.error);
```

**Note:** Full city auto-tagging from property MLS# requires the contact form to pass `mlsNumber`. This is wired in when the property inquiry form is updated in Sub-project 2. For now, Open House source tagging ships here.

- [ ] **Step 2: Find and update IDX property detail page**

```bash
# Run in terminal to find property detail page
ls apps/web/src/app/\(public\)/properties/
```

In the property detail server component, after the session check, add:
```ts
  // Track property view for logged-in buyers
  if (session?.user && (session.user as any).role === "BUYER") {
    prisma.propertyView.create({
      data: { userId: (session.user as any).id, mlsNumber: params.mlsNumber ?? params.id },
    }).catch(() => {}); // fire and forget
  }
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/leads/route.ts
git commit -m "feat(auto-tag): apply Open House tag on lead creation, track property views for buyers"
```

---

### Task 12: Admin Tag Management Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/admin/settings/tags/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { requireAdminPage } from "@/lib/server-utils";
import { prisma } from "@/lib/prisma";
import { AdminTagsClient } from "./AdminTagsClient";

export const metadata = { title: "Tags | CnC Realty Admin" };

export default async function AdminTagsPage() {
  await requireAdminPage();

  const tags = await prisma.tag.findMany({
    include: { _count: { select: { leads: true } } },
    orderBy: { name: "asc" },
  });

  const autoTagCity = await prisma.siteSettings.findUnique({ where: { key: "autoTagCity" } });

  return (
    <div>
      <h1 className="mb-8 font-sans text-2xl font-light text-[#1B1B1B]">Tags</h1>
      <AdminTagsClient
        initialTags={tags.map((t) => ({ ...t, leadCount: t._count.leads }))}
        autoTagCity={autoTagCity?.value !== "false"}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the client component `AdminTagsClient.tsx` in the same folder**

`apps/web/src/app/(dashboard)/admin/settings/tags/AdminTagsClient.tsx`:
```tsx
"use client";

import { useState } from "react";

type Tag = { id: string; name: string; color: string; leadCount: number };

const PRESET_COLORS = ["#9E8C61","#3B82F6","#22C55E","#EF4444","#A855F7","#F97316","#14B8A6","#6B7280"];

export function AdminTagsClient({ initialTags, autoTagCity }: { initialTags: Tag[]; autoTagCity: boolean }) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [cityToggle, setCityToggle] = useState(autoTagCity);

  async function createTag() {
    if (!newName.trim()) return;
    const res = await fetch("/api/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    });
    const tag = await res.json();
    setTags((prev) => [...prev, { ...tag, leadCount: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName("");
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/admin/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, color: editColor }),
    });
    const updated = await res.json();
    setTags((prev) => prev.map((t) => (t.id === id ? { ...updated, leadCount: t.leadCount } : t)));
    setEditId(null);
  }

  async function deleteTag(id: string, force = false) {
    const res = await fetch(`/api/admin/tags/${id}${force ? "?force=true" : ""}`, { method: "DELETE" });
    if (res.status === 409) {
      const { count } = await res.json();
      if (confirm(`This tag is used by ${count} leads. Force delete and remove from all leads?`)) {
        await deleteTag(id, true);
      }
      return;
    }
    setTags((prev) => prev.filter((t) => t.id !== id));
  }

  async function toggleCityTag(val: boolean) {
    setCityToggle(val);
    await fetch("/api/admin/tags/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "autoTagCity", value: String(val) }),
    });
  }

  return (
    <div className="space-y-6">
      {/* City auto-tag toggle */}
      <div className="flex items-center justify-between rounded-2xl bg-white p-5">
        <div>
          <p className="font-sans text-sm font-medium text-[#1B1B1B]">Auto-tag leads with city of property inquiry</p>
          <p className="text-xs text-[#1B1B1B]/50">When a lead inquires about a specific property, their city is applied as a tag</p>
        </div>
        <button
          onClick={() => toggleCityTag(!cityToggle)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cityToggle ? "bg-[#9E8C61]" : "bg-[#1B1B1B]/20"}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${cityToggle ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      {/* Create tag */}
      <div className="rounded-2xl bg-white p-5">
        <p className="mb-3 font-sans text-sm font-medium text-[#1B1B1B]">Create Tag</p>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tag name"
            className="flex-1 rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
          />
          <div className="flex gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="h-8 w-8 rounded-full"
                style={{ backgroundColor: c, outline: newColor === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }}
              />
            ))}
          </div>
          <button onClick={createTag} className="rounded-lg bg-[#1B1B1B] px-4 py-2 text-sm font-medium text-white">Create</button>
        </div>
      </div>

      {/* Tags table */}
      <div className="rounded-2xl bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1B1B1B]/10">
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Color</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Name</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Leads</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {tags.map((tag) => (
              <tr key={tag.id} className="border-b border-[#1B1B1B]/5 last:border-0">
                <td className="px-5 py-3">
                  {editId === tag.id ? (
                    <div className="flex gap-1">
                      {PRESET_COLORS.map((c) => (
                        <button key={c} onClick={() => setEditColor(c)} className="h-5 w-5 rounded-full" style={{ backgroundColor: c, outline: editColor === c ? `2px solid ${c}` : "none", outlineOffset: "1px" }} />
                      ))}
                    </div>
                  ) : (
                    <span className="inline-block h-4 w-4 rounded-full" style={{ backgroundColor: tag.color }} />
                  )}
                </td>
                <td className="px-5 py-3">
                  {editId === tag.id ? (
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-lg border border-[#9E8C61] px-2 py-1 text-sm outline-none" />
                  ) : (
                    <span className="font-medium text-[#1B1B1B]">{tag.name}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-[#1B1B1B]/50">{tag.leadCount}</td>
                <td className="px-5 py-3 text-right">
                  {editId === tag.id ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditId(null)} className="text-xs text-[#1B1B1B]/40">Cancel</button>
                      <button onClick={() => saveEdit(tag.id)} className="text-xs font-medium text-[#9E8C61]">Save</button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-3">
                      <button onClick={() => { setEditId(tag.id); setEditName(tag.name); setEditColor(tag.color); }} className="text-xs text-[#1B1B1B]/50 hover:text-[#1B1B1B]">Edit</button>
                      <button onClick={() => deleteTag(tag.id)} className={`text-xs ${tag.leadCount > 0 ? "text-[#1B1B1B]/20" : "text-red-400 hover:text-red-600"}`}>
                        {tag.leadCount > 0 ? `Used by ${tag.leadCount}` : "Delete"}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tags.length === 0 && <p className="px-5 py-8 text-center text-sm text-[#1B1B1B]/40">No tags yet. Create one above.</p>}
      </div>
    </div>
  );
}
```

Also add a settings API route for the toggle:

`apps/web/src/app/api/admin/tags/settings/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const schema = z.object({ key: z.string(), value: z.string() });

export async function POST(req: Request) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;
  const { key, value } = schema.parse(await req.json());
  await prisma.siteSettings.upsert({ where: { key }, update: { value }, create: { key, value } });
  return NextResponse.json({ ok: true });
}
```

Add link to the admin nav. Find `apps/web/src/app/(dashboard)/admin/` layout or nav component and add:
```
/admin/settings/tags → "Tags"
```

- [ ] **Step 2: Test in browser**

Navigate to `/admin/settings/tags`. Verify:
- [ ] Can create a tag with a color
- [ ] Can edit name and color inline
- [ ] Delete works for unused tags, shows count for used ones
- [ ] City auto-tag toggle saves to DB

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/admin/settings/tags/ apps/web/src/app/api/admin/tags/settings/
git commit -m "feat(admin): tag management page at /admin/settings/tags"
```

---

### Task 13: Admin Leads Enhancements (Export + Merge)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/admin/leads/page.tsx`

- [ ] **Step 1: Add Export button**

At the top of the admin leads page, add an export button that links to the CSV endpoint:
```tsx
<a
  href="/api/leads/export"
  className="rounded-lg border border-[#1B1B1B]/10 px-4 py-2 font-sans text-sm text-[#1B1B1B] hover:bg-[#F2F0EF]"
>
  Export CSV
</a>
```

Place it in the header row alongside the page title.

- [ ] **Step 2: Add merge UI**

Convert the admin leads page to a client component (add `"use client"` at top) and add checkbox selection + merge button logic:

```tsx
"use client";
// At top — add useState
const [selected, setSelected] = useState<string[]>([]);
const [merging, setMerging] = useState(false);

// In table rows, add checkbox column:
<td className="px-4 py-3">
  <input
    type="checkbox"
    checked={selected.includes(lead.id)}
    onChange={(e) => setSelected((prev) =>
      e.target.checked ? [...prev, lead.id] : prev.filter((id) => id !== lead.id)
    )}
    className="accent-[#9E8C61]"
  />
</td>

// Above table, show merge button when 2 selected:
{selected.length === 2 && (
  <button
    onClick={() => setMerging(true)}
    className="rounded-lg bg-[#1B1B1B] px-4 py-2 text-sm font-medium text-white"
  >
    Merge Selected
  </button>
)}

// Merge confirmation modal:
{merging && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
      <h3 className="mb-2 font-sans text-lg font-light">Merge Leads</h3>
      <p className="mb-4 text-sm text-[#1B1B1B]/60">Choose which lead record to keep. The other will be deleted and its activities transferred.</p>
      {selected.map((id) => {
        const lead = leads.find((l) => l.id === id);
        return (
          <button
            key={id}
            onClick={async () => {
              const loserId = selected.find((s) => s !== id)!;
              await fetch("/api/admin/leads/merge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ winnerId: id, loserId }),
              });
              setMerging(false);
              setSelected([]);
              window.location.reload();
            }}
            className="mb-2 w-full rounded-lg border border-[#1B1B1B]/10 px-4 py-3 text-left hover:border-[#9E8C61]"
          >
            <p className="font-medium">{lead?.firstName} {lead?.lastName}</p>
            <p className="text-xs text-[#1B1B1B]/50">{lead?.email}</p>
            <p className="mt-1 text-xs font-medium text-[#9E8C61]">Keep this record →</p>
          </button>
        );
      })}
      <button onClick={() => setMerging(false)} className="mt-2 w-full rounded-lg border border-[#1B1B1B]/10 py-2 text-sm">Cancel</button>
    </div>
  </div>
)}
```

**Note:** The admin leads page is currently a server component. Converting to `"use client"` means the lead data must be fetched client-side via `useEffect` + `/api/leads` (GET), or passed as props from a server parent. Recommend: keep the page as a server component, extract the interactive merge/select UI into a `AdminLeadsMergeClient` client component that receives `leads` as props.

- [ ] **Step 3: Test**

- [ ] Export CSV button downloads a `.csv` file with correct columns
- [ ] Select 2 leads → merge button appears
- [ ] Merge confirms, winner keeps activities, loser is deleted

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/admin/leads/
git commit -m "feat(admin): CSV export and lead merge UI on admin leads page"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Schema: enum, Lead fields, Tag, LeadTag, LeadRelationship, LeadTask, PropertyView, CustomFieldDef/Value, back-relations → Task 1
- [x] Shared utilities: applyTag, leadsToCSV → Task 2
- [x] Lead PATCH extended, GET enriched, lastContactedAt on activity → Task 3
- [x] Tags API: POST apply, DELETE remove → Task 4
- [x] Relationships API: POST create, DELETE remove → Task 5
- [x] Tasks API: POST, PATCH (toggle done), DELETE → Task 5
- [x] Homes API: GET saved + viewed → Task 6
- [x] Export CSV route → Task 6
- [x] Admin merge route → Task 6
- [x] Admin tags CRUD + delete with force → Task 6
- [x] TagPicker component → Task 7
- [x] LeadDetailSidebar (contact card, tags, details, relationships) → Task 8
- [x] LeadTasksTab (quick tasks, task list, drawer) → Task 9
- [x] HomesTab (saved + viewed properties) → Task 9
- [x] Lead profile page 2-column rewrite → Task 10
- [x] Auto-tagging on Open House source → Task 11
- [x] Property view tracking → Task 11
- [x] Admin tag management page → Task 12
- [x] Admin leads export + merge → Task 13
- [x] STATUS_LABELS update (HOT_PROSPECT, NURTURE, SPHERE) → Task 1

**Type consistency:**
- `applyTag(leadId: string, tagName: string)` used in Task 2 (defined), Task 4 (used), Task 11 (used) ✓
- `leadsToCSV(leads: LeadRow[])` defined in Task 2, used in Task 6 ✓
- `requireAuth("AGENT")` / `requireAuth("ADMIN")` consistent throughout ✓
- Task types array `["FOLLOW_UP","CALL","EMAIL","TEXT","SHOWING","THANK_YOU","OTHER"]` consistent across Task 5 and Task 9 ✓
