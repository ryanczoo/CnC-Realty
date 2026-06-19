# Sub-project 4: CRM Tasks Polish — Design Spec

**Date:** 2026-06-19
**Phase:** 7 (CRM Expansion)
**Sub-project:** 4 of 8
**Status:** Approved — ready for implementation planning

---

## Overview

The `LeadTask` model, per-lead API routes (POST/PATCH/DELETE), and the `LeadTasksTab` UI component are already functional from earlier phases. Agents can create tasks, use quick-add buttons (Tomorrow / In 3 Days / Next Week), and check tasks off — grouped into Overdue / Due Today / Upcoming / Completed sections on each lead's profile.

**What's missing and what this sub-project adds:**

1. **Task editing** — no way to change a task's title, type, or due date after creation. Fix: a slide-in `LeadTaskDrawer` (consistent with `DealDrawer` and `SmartListDrawer` patterns).
2. **Task delete UI** — the DELETE API exists; the UI has no delete button. Fix: delete button inside the drawer with `window.confirm`.
3. **Notes field** — tasks have no notes. Fix: add `notes String?` to `LeadTask` schema + migration.
4. **Cross-lead task dashboard** — agents have no way to see all their tasks across every lead in one view. Fix: `/dashboard/tasks` page with Overdue / Today / Upcoming sections, lead name + link on each row, in-place check-off.
5. **GET `/api/leads/[id]/tasks`** — currently tasks are only loaded server-side. A GET route enables the drawer to refresh without a full page reload.
6. **GET `/api/tasks`** — new top-level endpoint for the cross-lead view.
7. **Nav link** — Tasks added to the dashboard sidebar between Pipeline and Transactions.

**Depends on:** Sub-project 3 (nav already has Pipeline entry).

---

## Section 1: Data Model

### 1.1 Change to `LeadTask`

Add one optional field:

```prisma
model LeadTask {
  id          String    @id @default(cuid())
  leadId      String
  title       String
  taskType    String    @default("FOLLOW_UP")
  assigneeId  String?
  dueDate     DateTime?
  notes       String?   // ← new
  done        Boolean   @default(false)
  completedAt DateTime?
  createdAt   DateTime  @default(now())

  lead     Lead   @relation(fields: [leadId], references: [id], onDelete: Cascade)
  assignee Agent? @relation("TaskAssignee", fields: [assigneeId], references: [id])
}
```

Migration name: `add_notes_to_lead_task`

---

## Section 2: API Routes

### 2.1 New: `GET /api/leads/[id]/tasks`

Add to `apps/web/src/app/api/leads/[id]/tasks/route.ts`.

Auth: `requireAuth("AGENT")`. Ownership check (same `assertOwnership` already in the file).

Returns the task list for one lead, ordered by `createdAt asc`. Serializes dates to ISO strings.

Response: `LeadTaskRow[]` (same shape as the existing POST response, plus `notes`).

### 2.2 Update: `PATCH /api/leads/[id]/tasks/[taskId]`

Add `notes: z.string().nullable().optional()` to the existing `patchSchema`. Pass through to Prisma update. No other change.

### 2.3 New: `GET /api/tasks`

New file: `apps/web/src/app/api/tasks/route.ts`

Auth: `requireAuth("AGENT")`. ADMIN sees all tasks; AGENT sees only tasks on their own leads (via `lead.agentId === agent.id` join).

Query params:
- `?done=false` (default) — open tasks only
- `?done=true` — completed tasks only
- No value — all tasks

Response shape per item:
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

Implementation: `prisma.leadTask.findMany` with `include: { lead: { select: { agentId, firstName, lastName } } }`, filtered by `lead.agentId === agent.id` for non-admins (use `where: { lead: { agentId: agent.id } }`).

Order: `[{ done: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }]`

---

## Section 3: Components

### 3.1 New: `LeadTaskDrawer.tsx`

**File:** `apps/web/src/components/leads/LeadTaskDrawer.tsx`

Slide-in drawer from the right. Always mounted — CSS `hidden` when closed, not conditional render.

**Props:**
```ts
type Props = {
  open: boolean;
  task: LeadTaskRow | null;
  leadId: string;
  onClose: () => void;
  onSaved: (task: LeadTaskRow) => void;
  onDeleted: (taskId: string) => void;
};
```

**Fields (editable):**
- Title (text input, required)
- Task type (select from TASK_TYPES)
- Due date (datetime-local input, optional)
- Notes (textarea, optional)

**Behavior:**
- `useEffect` on `task` to populate all fields when a task is selected
- Save: `PATCH /api/leads/[leadId]/tasks/[task.id]` with `{ title, taskType, dueDate, notes }`; on success call `onSaved(updated)` and `onClose()`
- Delete: `window.confirm("Delete this task?")` → `DELETE /api/leads/[leadId]/tasks/[task.id]` → `onDeleted(task.id)` and `onClose()`
- Inline error state (no toast)
- Cancel button, Save button (disabled while saving), Delete button at footer left

### 3.2 Updated: `LeadTasksTab.tsx`

Mount `LeadTaskDrawer` inside `LeadTasksTab` (always mounted, CSS hidden). Add `selectedTask` and `drawerOpen` state.

**Changes:**
- Each `TaskRow` gets an `onClick` that sets `selectedTask` and opens the drawer
- `onSaved`: update the task in local state
- `onDeleted`: remove the task from local state
- Drawer mounted below the existing JSX

No other changes to the existing task list UI.

### 3.3 New: `/dashboard/tasks/page.tsx`

**File:** `apps/web/src/app/(dashboard)/dashboard/tasks/page.tsx`

`"use client"`. Fetches `GET /api/tasks?done=false` on mount.

**Layout:**
- Page heading: "Tasks" with subtext "Your open tasks across all leads"
- Three sections: **Overdue** (red label), **Due Today** (amber label), **Upcoming** (muted label)
- Completed tasks: collapsed `<details>` toggle at the bottom (fetched separately via `GET /api/tasks?done=true` only when expanded)
- Each task row shows:
  - Checkbox (check-off in place via `PATCH /api/leads/[leadId]/tasks/[taskId]`)
  - Task title
  - Task type label
  - Due date formatted as "Jun 19" or "—"
  - Lead name as a `<Link>` to `/dashboard/leads/[leadId]`
- Empty state per section: hidden if no tasks (only show sections that have tasks)
- Full empty state (no open tasks at all): "You're all caught up." centered text

**Sectioning logic** (client-side, from fetched data):
```ts
const today = new Date(); today.setHours(0,0,0,0);
const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < today);
const dueToday = tasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString());
const upcoming = tasks.filter(t => !t.dueDate || new Date(t.dueDate) > today && !isDueToday);
```

Check-off updates local state optimistically, then fires PATCH. No snap-back needed (task disappearing from the open list on check-off is the intended behavior).

### 3.4 Updated: `layout.tsx`

Add Tasks nav entry between Pipeline and Transactions:

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

---

## Section 4: Files Changed / Created

**Schema:**
- `packages/database/prisma/schema.prisma` — add `notes String?` to `LeadTask`
- New migration: `add_notes_to_lead_task`

**API routes:**
- `apps/web/src/app/api/leads/[id]/tasks/route.ts` — add GET handler
- `apps/web/src/app/api/leads/[id]/tasks/[taskId]/route.ts` — add `notes` to PATCH schema
- `apps/web/src/app/api/tasks/route.ts` — new file (cross-lead GET)

**Components:**
- `apps/web/src/components/leads/LeadTaskDrawer.tsx` — new
- `apps/web/src/components/leads/LeadTasksTab.tsx` — updated (add drawer)

**Pages:**
- `apps/web/src/app/(dashboard)/dashboard/tasks/page.tsx` — new
- `apps/web/src/app/(dashboard)/layout.tsx` — add Tasks nav entry

**Tests:**
- `apps/web/src/__tests__/api/tasks.test.ts` — unit tests for GET /api/tasks
- `apps/web/src/__tests__/api/lead-tasks.test.ts` — unit tests for GET + updated PATCH

---

## Decisions Made

| Decision | Choice | Reason |
|---|---|---|
| Edit UX | Slide-in drawer | Consistent with DealDrawer / SmartListDrawer; room for notes field |
| Notes field | Add to schema | Agents need to capture context (e.g., "left voicemail", "send MLS link") |
| Cross-lead view | Dedicated `/dashboard/tasks` page | Agents' primary daily workflow; per-lead tab alone is not discoverable |
| Completed tasks on tasks page | Lazy-load on expand | Keeps initial fetch fast; completed list can be long |
| Check-off on tasks page | Optimistic, no snap-back | Task disappearing on check-off is correct; no state to restore |
| Assignee field | Not exposed in UI | Ryan assigns leads manually; no team task routing needed at MVP |
| Task types | Keep existing 7 | FOLLOW_UP / CALL / EMAIL / TEXT / SHOWING / THANK_YOU / OTHER covers all real estate workflows |
