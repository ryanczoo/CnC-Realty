# Sub-project 7: Trigger Automations — Design Spec

**Date:** 2026-06-20
**Phase:** 7 (CRM Expansion)
**Sub-project:** 7 of 8
**Status:** Approved — ready for implementation planning

---

## Overview

Trigger automations let Ryan (admin) define "when a lead's status changes to X, automatically do Y." When an agent moves a lead on the Kanban or edits a lead's status, the system checks for matching active triggers and executes their actions immediately — non-blocking, non-fatal. Each trigger fires at most once per lead (enforced by a unique constraint).

Two action types:
- **Enroll in Action Plan** — auto-enroll the lead in a drip sequence
- **Send Email** — send a one-time email to the lead

---

## Section 1: Data Model

Two new tables. No changes to existing models.

```prisma
enum TriggerActionType {
  ENROLL_PLAN
  SEND_EMAIL
}

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

  actionPlan    ActionPlan?        @relation(fields: [actionPlanId], references: [id])
  executions    TriggerExecution[]
}

model TriggerExecution {
  id          String   @id @default(cuid())
  triggerId   String
  leadId      String
  executedAt  DateTime @default(now())

  trigger     Trigger  @relation(fields: [triggerId], references: [id], onDelete: Cascade)

  @@unique([triggerId, leadId])
}
```

**`@@unique([triggerId, leadId])`** is the mechanical enforcement of once-per-lead. Attempting to insert a duplicate throws Prisma `P2002`, which the execution block catches and treats as "already fired — skip."

**`onDelete: Cascade`** on `TriggerExecution.trigger` — deleting a trigger also deletes its execution records.

**Field rules:**
- `actionPlanId` required when `actionType === ENROLL_PLAN`; must be null for `SEND_EMAIL`
- `emailSubject` + `emailBody` required when `actionType === SEND_EMAIL`; must be null for `ENROLL_PLAN`

Migration name: `add_trigger_automations`

---

## Section 2: API Routes

All trigger CRUD routes require `requireAuth("ADMIN")`. All have `export const dynamic = "force-dynamic"`.

### `GET /api/admin/triggers`

Returns all triggers ordered by `createdAt asc`.

Response shape:
```ts
{
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
}[]
```

### `POST /api/admin/triggers`

Creates a new trigger.

**Body:**
```ts
{
  name: string;
  statusTrigger: LeadStatus;
  actionType: "ENROLL_PLAN" | "SEND_EMAIL";
  actionPlanId?: string;   // required if ENROLL_PLAN
  emailSubject?: string;   // required if SEND_EMAIL
  emailBody?: string;      // required if SEND_EMAIL
}
```

**Validation (without Zod — manual checks):**
- `name` missing → 400
- `statusTrigger` not a valid LeadStatus → 400
- `actionType` not ENROLL_PLAN or SEND_EMAIL → 400
- `actionType === ENROLL_PLAN` and no `actionPlanId` → 400
- `actionType === SEND_EMAIL` and no `emailSubject` or no `emailBody` → 400
- `actionPlanId` provided but plan not found → 404

Returns created trigger — 201.

### `PATCH /api/admin/triggers/[id]`

Partial update: any subset of `{ name, statusTrigger, actionType, actionPlanId, emailSubject, emailBody, isActive }`.

- Trigger not found → 404
- Returns updated trigger — 200

### `DELETE /api/admin/triggers/[id]`

Deletes the trigger and cascades to `TriggerExecution`.

- Trigger not found → 404 (catch P2025)
- Returns 204

---

## Section 3: Trigger Execution

Wired into the existing `PATCH /api/leads/[id]` route (`apps/web/src/app/api/leads/[id]/route.ts`).

After `prisma.lead.update` succeeds, check if `data.status` is present (i.e., a status change was requested):

```ts
if (data.status) {
  try {
    const triggers = await prisma.trigger.findMany({
      where: { statusTrigger: data.status, isActive: true },
      include: { actionPlan: { include: { steps: { orderBy: { stepOrder: "asc" } } } } },
    });

    for (const trigger of triggers) {
      // Once-per-lead enforcement
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

        // Skip if already actively enrolled in this plan
        const existing = await prisma.leadPlanEnrollment.findFirst({
          where: { leadId: params.id, planId: plan.id, status: "ACTIVE" },
        });
        if (existing) continue;

        // Find the lead's agent for enrollment attribution
        const currentLead = await prisma.lead.findUnique({
          where: { id: params.id },
          select: { agentId: true },
        });
        if (!currentLead?.agentId) continue; // no agent assigned — skip enrollment

        const now = new Date();
        await prisma.$transaction(async (tx) => {
          const enr = await tx.leadPlanEnrollment.create({
            data: { leadId: params.id, planId: plan.id, agentId: currentLead.agentId! },
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
    // Never rethrow — trigger failure must not affect the PATCH response
  }
}
```

**Key rules:**
- The entire trigger block is wrapped in try/catch — any failure is logged and swallowed
- P2002 on `TriggerExecution.create` = already fired → `continue` to next trigger
- ENROLL_PLAN with no assigned agent → skip (no agentId to attribute enrollment to)
- ENROLL_PLAN where lead is already actively enrolled in this plan → skip (prevent duplicate enrollments)
- SEND_EMAIL failure is non-fatal (inner try/catch)
- `lead` variable (the updated lead object from `prisma.lead.update`) must include `email` in its select for the email action — update the PATCH route's select to include `email`

---

## Section 4: Admin UI

New page at `/admin/triggers`. Follows the same client-component pattern as `/admin/action-plans/page.tsx`.

### Page layout

- Page title: "Trigger Automations"
- Subheading: "Automatically act when a lead's status changes"
- Gold PULSE "New Trigger" button → opens create drawer
- Table: Name | Fires When | Action | Active | Edit | Delete

**Table row details:**
- **Fires When:** "Status → QUALIFIED" (human-readable status label)
- **Action:** "Enroll in [Plan Name]" or "Send email: [Subject]"
- **Active:** inline toggle (PATCH `{ isActive: !trigger.isActive }`)
- **Edit:** pencil icon → opens edit drawer pre-filled
- **Delete:** trash icon → inline confirmation popover ("Delete this trigger?" → Confirm / Cancel)

Empty state: "No triggers yet — create one to start automating your workflow."

### Create / Edit drawer

Single drawer component (`TriggerDrawer`) with an `initialValues` prop for edit mode. Always-mounted, CSS `hidden` when closed.

**Fields:**
1. **Name** — text input (e.g., "Auto-qualify drip")
2. **When status changes to** — `<select>` with all 11 LeadStatus values, human-readable labels:
   - NEW → "New", CONTACTED → "Contacted", QUALIFIED → "Qualified", HOT_PROSPECT → "Hot Prospect", NURTURE → "Nurture", SHOWING → "Showing", OFFER → "Offer", UNDER_CONTRACT → "Under Contract", CLOSED → "Closed", LOST → "Lost", SPHERE → "Sphere of Influence"
3. **Action type** — two pill toggle buttons: "Enroll in Action Plan" | "Send Email"
4. **If ENROLL_PLAN:** `<select>` populated from `GET /api/admin/action-plans` (active plans only)
5. **If SEND_EMAIL:** Subject text input + Body `<textarea>`
6. **Active** — checkbox, defaults to checked on create

**Buttons:** Gold PULSE "Save" button + "Cancel"

Action type toggle uses CSS `hidden` to show/hide the conditional fields (always mounted).

---

## Section 5: Tests

Test file: `apps/web/src/__tests__/api/triggers.test.ts`

**CRUD routes:**
- `GET /api/admin/triggers` — 401 unauthenticated, 200 returns list
- `POST /api/admin/triggers` — 401 unauthenticated, 400 missing name, 400 ENROLL_PLAN without actionPlanId, 400 SEND_EMAIL without emailSubject, 201 creates trigger
- `PATCH /api/admin/triggers/[id]` — 401, 404 not found, 200 updates isActive
- `DELETE /api/admin/triggers/[id]` — 401, 404 not found, 204 deletes

**Execution (in `PATCH /api/leads/[id]` test or a dedicated execution test):**
- Status change with matching active trigger → `triggerExecution.create` called
- Second status change to same status for same lead → P2002 caught, execution skipped (no duplicate)
- Trigger execution failure → PATCH still returns 200 (failure is swallowed)
- No status in PATCH body → trigger block not entered

---

## Section 6: Files Created / Modified

**Schema:**
- `packages/database/prisma/schema.prisma` — add `TriggerActionType` enum, `Trigger` model, `TriggerExecution` model; add `triggers` relation to `ActionPlan`
- New migration: `add_trigger_automations`

**API routes (create):**
- `apps/web/src/app/api/admin/triggers/route.ts` — GET + POST
- `apps/web/src/app/api/admin/triggers/[id]/route.ts` — PATCH + DELETE

**API routes (modify):**
- `apps/web/src/app/api/leads/[id]/route.ts` — add trigger execution block after lead update; add `email` to the PATCH select

**UI (create):**
- `apps/web/src/app/(dashboard)/admin/triggers/page.tsx` — admin triggers page
- `apps/web/src/components/triggers/TriggerDrawer.tsx` — create/edit drawer

**Tests:**
- `apps/web/src/__tests__/api/triggers.test.ts`

---

## Decisions Made

| Decision | Choice | Reason |
|---|---|---|
| Trigger scope | All leads globally | Consistent brokerage-wide workflow; matches existing pattern |
| Who creates triggers | Admin only | Ryan controls the workflow; matches Sub5/Sub6 pattern |
| Execution timing | Inline in PATCH /api/leads/[id] | Immediate, simple, no new infrastructure; failure is non-fatal |
| Once-per-lead enforcement | DB unique constraint `@@unique([triggerId, leadId])` | Mechanical, reliable, no application-layer race condition |
| ENROLL_PLAN with no agent | Skip silently | Can't attribute enrollment without an agentId; brokerage-fed leads get assigned before reaching qualified statuses |
| ENROLL_PLAN duplicate check | Skip if already actively enrolled | Prevents double-enrolling a lead who was manually enrolled before the trigger existed |
| Email to lead | SendGrid, non-fatal, same pattern as Sub6 | Consistent with existing email failure philosophy |
| Trigger delete | Cascade to TriggerExecution | Clean slate if admin removes a trigger |
