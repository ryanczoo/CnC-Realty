# Sub-project 5: Action Plans — Design Spec

**Date:** 2026-06-19
**Phase:** 7 (CRM Expansion)
**Sub-project:** 5 of 8
**Status:** Approved — ready for implementation planning

---

## Overview

Action Plans are per-lead automated drip sequences that agents apply with one click. Ryan (admin) creates reusable plan templates — e.g., "New Lead 7-Day Drip," "Post-Showing Follow-Up" — each composed of ordered steps. When an agent enrolls a lead, all steps are materialized immediately with computed `dueAt` timestamps. A daily Vercel Cron job fires due steps: EMAIL steps send automatically via SendGrid; TASK steps create a `LeadTask` reminder for the agent. When a lead replies to an action plan email, SendGrid Inbound Parse intercepts it, auto-pauses the enrollment, and forwards the reply to the agent's personal inbox.

**Depends on:** Sub-project 4 (LeadTask model and `POST /api/leads/[id]/tasks` exist).

---

## Section 1: Data Model

### 1.1 `ActionPlan` (template, admin-created)

```prisma
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
```

### 1.2 `ActionPlanStep` (one step in a template)

```prisma
enum PlanStepType {
  EMAIL
  TASK
}

model ActionPlanStep {
  id        String      @id @default(cuid())
  planId    String
  stepOrder Int
  delayDays Int         @default(0)
  stepType  PlanStepType
  subject   String?
  body      String?
  taskTitle String?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  plan ActionPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
}
```

`delayDays` is days from enrollment date (not from the previous step). Step order 1 with `delayDays: 0` fires immediately; `delayDays: 7` fires on day 7. EMAIL steps require `subject` + `body`; TASK steps require `taskTitle`.

Supported variables in `subject` and `body`: `{{first_name}}`, `{{last_name}}`, `{{agent_name}}`, `{{agent_phone}}`.

### 1.3 `LeadPlanEnrollment` (a lead enrolled in a plan)

```prisma
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
```

### 1.4 `LeadPlanStep` (materialized step per enrollment)

```prisma
enum PlanStepStatus {
  PENDING
  DONE
  SKIPPED
  PAUSED
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

`dueAt` = `enrolledAt + delayDays days` (computed at enrollment time). The index on `(status, dueAt)` supports the cron job's query efficiently.

At enrollment, all steps are copied from the template (subject, body, taskTitle) with variables left as-is — substitution happens at send time when the lead's actual data is available.

---

## Section 2: API Routes

### 2.1 Admin — Template Management (ADMIN only)

#### `GET /api/admin/action-plans`
Returns all plans with step count. Ordered by `createdAt desc`.

Response:
```ts
{ id, name, description, isActive, stepCount, createdAt }[]
```

#### `POST /api/admin/action-plans`
Create a new plan.

Body: `{ name: string, description?: string }`

Response: `{ id, name, description, isActive, createdAt }` — 201

#### `PATCH /api/admin/action-plans/[id]`
Update plan name, description, or isActive.

Body: `{ name?: string, description?: string, isActive?: boolean }`

#### `DELETE /api/admin/action-plans/[id]`
Soft approach: only allow delete if no ACTIVE enrollments. Returns 409 if active enrollments exist. Returns 204 on success.

#### `POST /api/admin/action-plans/[id]/steps`
Add a step to a plan.

Body: `{ stepOrder: number, delayDays: number, stepType: "EMAIL" | "TASK", subject?: string, body?: string, taskTitle?: string }`

Validation: EMAIL requires subject + body; TASK requires taskTitle.

Response: step object — 201

#### `PATCH /api/admin/action-plans/[id]/steps/[stepId]`
Update a step.

Body: same fields as POST, all optional.

#### `DELETE /api/admin/action-plans/[id]/steps/[stepId]`
Delete a step. Returns 204.

### 2.2 Lead Enrollment (AGENT or ADMIN)

All enrollment routes use `requireAuth("AGENT")` + standard `assertOwnership` (AGENT must own the lead).

#### `GET /api/leads/[id]/enrollments`
Returns all enrollments for a lead, newest first. Includes plan name and steps.

Response:
```ts
{
  id, planId, planName, agentId, status, enrolledAt, pausedAt, pausedReason, completedAt,
  steps: { id, stepOrder, stepType, subject, taskTitle, dueAt, status, executedAt }[]
}[]
```

#### `POST /api/leads/[id]/enrollments`
Enroll a lead in a plan.

Body: `{ planId: string }`

Validation:
- Plan must exist and `isActive = true`
- Lead must not already have an ACTIVE enrollment in the same plan (returns 409)

On success:
1. Creates `LeadPlanEnrollment`
2. Fetches all `ActionPlanStep` records for the plan ordered by `stepOrder`
3. Creates one `LeadPlanStep` per template step with `dueAt = now + delayDays days`
4. Returns the created enrollment with steps — 201

#### `PATCH /api/leads/[id]/enrollments/[enrollmentId]`
Pause, resume, or cancel an enrollment.

Body: `{ status: "PAUSED" | "ACTIVE" | "CANCELLED" }`

- `PAUSED`: sets `pausedAt`, `pausedReason: MANUAL`, flips all PENDING steps to PAUSED
- `ACTIVE` (resume): clears `pausedAt`, `pausedReason`, flips all PAUSED steps back to PENDING
- `CANCELLED`: sets status to CANCELLED, flips all PENDING/PAUSED steps to SKIPPED

### 2.3 Background Jobs

#### `POST /api/cron/action-plans`
Auth: `Authorization: Bearer {CRON_SECRET}` header.

Added to `vercel.json`: `{ "path": "/api/cron/action-plans", "schedule": "0 8 * * *" }` — runs daily at 8am UTC.

Logic:
1. Query all `LeadPlanStep` where `status = PENDING`, `dueAt <= now`, and `enrollment.status = ACTIVE`
2. For each step:
   - **EMAIL:** substitute variables, send via SendGrid with Reply-To `reply+{enrollmentId}@reply.cncrealtygroup.com`, mark step `DONE`, set `executedAt`
   - **TASK:** call `prisma.leadTask.create` with the task title and `dueDate = dueAt`, mark step `DONE`
3. After each step is marked DONE, check if all steps for the enrollment are DONE — if so, mark enrollment `COMPLETED` and set `completedAt`
4. Return `{ processed: N, errors: M }`

Process steps one at a time (no `Promise.all`) to avoid overwhelming SendGrid free tier and for easier error isolation. Errors on individual steps are logged but don't abort the run.

`export const maxDuration = 60`

#### `POST /api/webhooks/sendgrid/inbound`
Receives SendGrid Inbound Parse POSTs when a lead replies to an action plan email.

No CRON_SECRET — validated by checking the `to` field contains a valid enrollmentId.

Logic:
1. Parse multipart form body — extract `to` field
2. Find `reply+{enrollmentId}@reply.cncrealtygroup.com` in the `to` addresses
3. Extract `enrollmentId`, look up `LeadPlanEnrollment`
4. If enrollment exists and status is ACTIVE:
   - Set `status = PAUSED`, `pausedAt = now`, `pausedReason = REPLY`
   - Set all PENDING steps for this enrollment to PAUSED
5. Forward the email to the agent's `user.email` via SendGrid (plain text forward, subject prefixed with `[Lead Reply] `)
6. Return 200 (SendGrid requires 200 to stop retrying)

---

## Section 3: UI

### 3.1 Admin — `/dashboard/admin/action-plans`

List view:
- Table of plans: name, step count, active/inactive badge, created date
- Toggle `isActive` inline (switch)
- "New Plan" button → opens `ActionPlanDrawer` (name + description fields)
- Click plan name → opens `ActionPlanDetailDrawer`

`ActionPlanDetailDrawer`:
- Shows plan name + description (editable inline)
- Ordered list of steps with up/down reorder arrows
- Each step: type badge (EMAIL / TASK), delay label ("Day 3"), subject or task title preview
- Click step → opens `ActionPlanStepDrawer` to edit
- "Add Step" button → opens blank `ActionPlanStepDrawer`
- Delete plan button at footer (disabled if active enrollments)

`ActionPlanStepDrawer`:
- Step type selector (EMAIL / TASK)
- Delay days input
- EMAIL fields: subject + body textarea (shows `{{first_name}}` etc. hints)
- TASK field: task title input
- Save / Delete buttons

### 3.2 Lead Profile — Action Plans Section

Displayed in the lead detail view alongside Tasks, Activities, etc.

Shows:
- List of enrollments: plan name, status badge, progress ("Step 2 of 5 — next due Jun 22")
- Expandable step list per enrollment showing each step's status and due date
- Per-enrollment action buttons: **Pause** / **Resume** / **Cancel**
- "Apply Plan" button → dropdown of `isActive` plans → click to enroll (one click, no confirmation needed since it's reversible)

---

## Section 4: Email Format

**FROM name:** Agent's `displayName` (falls back to `user.name`)
**FROM address:** `noreply@cncrealtygroup.com`
**Reply-To:** `reply+{enrollmentId}@reply.cncrealtygroup.com`

**Variable substitution** (performed at send time):
| Variable | Resolves to |
|---|---|
| `{{first_name}}` | Lead's `firstName` |
| `{{last_name}}` | Lead's `lastName` |
| `{{agent_name}}` | Agent's `displayName` or `user.name` |
| `{{agent_phone}}` | Agent's `phone` (empty string if null) |

Email body is sent as plain text. No HTML template wrapper — keeps deliverability high and matches the personal tone of a drip sequence.

---

## Section 5: Auto-Pause via SendGrid Inbound Parse

### DNS Setup (one-time, done in Hostinger DNS panel)

Add MX record:
- **Host:** `reply.cncrealtygroup.com`
- **Points to:** `mx.sendgrid.net`
- **Priority:** 10

### SendGrid Configuration (one-time, done in SendGrid dashboard)

Under Settings → Inbound Parse → Add Host & URL:
- **Receiving domain:** `reply.cncrealtygroup.com`
- **Destination URL:** `https://cncrealtygroup.com/api/webhooks/sendgrid/inbound`
- **POST the raw, full MIME message:** checked

### Reply Flow

1. Lead receives action plan email, hits Reply
2. Email client sends to `reply+{enrollmentId}@reply.cncrealtygroup.com`
3. MX record routes to SendGrid
4. SendGrid POSTs to `/api/webhooks/sendgrid/inbound`
5. System pauses enrollment + all pending steps
6. System forwards reply to agent's `user.email`
7. Agent sees forwarded reply in personal inbox, responds directly — conversation continues agent ↔ lead with no further CnC involvement

---

## Section 6: Files Created / Modified

**Schema:**
- `packages/database/prisma/schema.prisma` — add `ActionPlan`, `ActionPlanStep`, `LeadPlanEnrollment`, `LeadPlanStep` models + 3 new enums; add `enrollments LeadPlanEnrollment[]` to `Lead` and `Agent`
- New migration: `add_action_plans`

**API routes:**
- `apps/web/src/app/api/admin/action-plans/route.ts` — GET, POST
- `apps/web/src/app/api/admin/action-plans/[id]/route.ts` — PATCH, DELETE
- `apps/web/src/app/api/admin/action-plans/[id]/steps/route.ts` — POST
- `apps/web/src/app/api/admin/action-plans/[id]/steps/[stepId]/route.ts` — PATCH, DELETE
- `apps/web/src/app/api/leads/[id]/enrollments/route.ts` — GET, POST
- `apps/web/src/app/api/leads/[id]/enrollments/[enrollmentId]/route.ts` — PATCH
- `apps/web/src/app/api/cron/action-plans/route.ts` — POST (cron job)
- `apps/web/src/app/api/webhooks/sendgrid/inbound/route.ts` — POST (inbound parse)

**Components:**
- `apps/web/src/components/action-plans/ActionPlanDrawer.tsx` — create/edit plan
- `apps/web/src/components/action-plans/ActionPlanDetailDrawer.tsx` — plan steps management
- `apps/web/src/components/action-plans/ActionPlanStepDrawer.tsx` — create/edit step
- `apps/web/src/components/leads/LeadActionPlansSection.tsx` — lead profile section

**Pages:**
- `apps/web/src/app/(dashboard)/dashboard/admin/action-plans/page.tsx` — admin plan list

**Config:**
- `vercel.json` — add action-plans cron entry

**Tests:**
- `apps/web/src/__tests__/api/action-plans.test.ts` — admin CRUD routes
- `apps/web/src/__tests__/api/lead-enrollments.test.ts` — enrollment routes
- `apps/web/src/__tests__/api/cron-action-plans.test.ts` — cron job logic (step execution, email send, task creation, completion detection)
- `apps/web/src/__tests__/webhooks/sendgrid-inbound.test.ts` — inbound parse, pause logic

---

## Decisions Made

| Decision | Choice | Reason |
|---|---|---|
| Execution model | Auto-execute | Fully automated; agents get value without manual effort |
| Step types | EMAIL + TASK only | No SMS/Twilio; calling is agents' personal workflow |
| Template ownership | Admin only | Ryan controls messaging quality; agents apply, not author |
| Step scheduling | Materialize all at enrollment | Easy to preview, easy to bulk-pause, simple cron query |
| Reply detection | SendGrid Inbound Parse on subdomain | Zero extra cost; no new Hostinger mailboxes needed |
| Reply-To routing | `reply+{id}@reply.cncrealtygroup.com` | Enables auto-pause while keeping lead ↔ agent direct after first reply |
| Email format | Plain text | Better deliverability for personal drip; no HTML template overhead |
| Observability | SendGrid dashboard + Sentry | Sufficient for small brokerage; no custom admin log UI needed |
| Delete plan guard | Block if active enrollments | Prevents orphaned enrollments mid-sequence |
| Cron schedule | Daily 8am UTC | Consistent with existing deadline-reminders pattern |
