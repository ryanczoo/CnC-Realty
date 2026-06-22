# Sub-project 6: Lead Pool — Design Spec

**Date:** 2026-06-20
**Phase:** 7 (CRM Expansion)
**Sub-project:** 6 of 8
**Status:** Approved — ready for implementation planning

---

## Overview

When a website inquiry arrives with no assigned agent, it sits in an unassigned pool. Ryan (admin) reviews unassigned leads, picks an agent, and assigns them. The assignment permanently marks the lead as brokerage-fed (70/30 commission split: 70% agent, 30% Ryan). The assigned agent receives an email notification and sees a dismissible banner on their leads dashboard until they acknowledge it.

---

## Section 1: Data Model

Two new fields added to the existing `Lead` model. No new tables.

```prisma
brokerageFed      Boolean   @default(false)
assignmentSeenAt  DateTime?
```

**`brokerageFed`** — permanently flags this lead as a 70/30 split lead. Set to `true` when Ryan assigns it via the pool. Never changes after assignment. Defaults to `false` for all existing and agent-sourced leads.

**`assignmentSeenAt`** — tracks whether the assigned agent has dismissed their notification banner. `null` means unseen. Set to the current timestamp when the agent dismisses. If Ryan reassigns a lead to a different agent, this resets to `null` so the new agent gets a fresh notification.

Migration name: `add_lead_pool_fields`

---

## Section 2: API Routes

### `GET /api/admin/leads/unassigned`

**Auth:** `requireAuth("ADMIN")`

Returns all leads where `agentId IS NULL`, ordered by `createdAt desc`. Response shape:

```ts
{
  id, firstName, lastName, email, phone, status, source, createdAt
}[]
```

### `PATCH /api/admin/leads/[id]/assign`

**Auth:** `requireAuth("ADMIN")`

Assigns a lead to an agent and marks it as brokerage-fed.

**Body:** `{ agentId: string }`

**Logic:**
1. Validate `agentId` — return 404 if agent doesn't exist
2. Update lead: `agentId`, `brokerageFed: true`, `assignmentSeenAt: null`
3. Fetch agent's `user.email` and `displayName`
4. Send assignment email via SendGrid
5. Return updated lead

**Response:** updated lead object — 200

**Error cases:**
- 400 if `agentId` missing
- 404 if agent not found
- 500 on DB/email failure (lead update still saved; email failure is logged, not fatal)

### `GET /api/admin/agents-list`

**Auth:** `requireAuth("ADMIN")`

Returns all agents for the assign modal dropdown.

```ts
{ id: string; displayName: string; user: { email: string } }[]
```

Ordered by `displayName asc`.

### `POST /api/leads/dismiss-brokerage-assignments`

**Auth:** `requireAuth("AGENT")`

Sets `assignmentSeenAt = now` on all brokerage-fed leads assigned to this agent that have not yet been seen.

**Logic:**
1. Look up agent by `userId`
2. `updateMany` where `{ agentId: agent.id, brokerageFed: true, assignmentSeenAt: null }`
3. Return `{ dismissed: N }`

---

## Section 3: Email Notification

**Trigger:** `PATCH /api/admin/leads/[id]/assign` success

**To:** Agent's `user.email`
**From:** `noreply@cncrealtygroup.com`
**Subject:** `New lead assigned to you — [Lead First Name] [Lead Last Name]`

**Body (plain text):**
```
Hi [Agent Display Name],

Ryan has assigned you a new brokerage lead:

Name: [Lead First Name] [Lead Last Name]
Email: [Lead Email]
Phone: [Lead Phone or "Not provided"]
Status: [Lead Status]

Log in to view their full profile and get started.

— CnC Realty Group
```

Sent via `@sendgrid/mail` using existing `FROM` from `@/lib/email`. Email failure is caught, logged, and does not block the assignment response.

---

## Section 4: Admin UI

### Unassigned tab on `/admin/leads`

The existing `AdminLeadsMergeClient` component is replaced (or extended) with an `AdminLeadsClient` that adds an **"Unassigned" tab** alongside the existing "All Leads" view.

**Tab bar:**
- All Leads (existing behavior)
- Unassigned (fetches from `GET /api/admin/leads/unassigned`)

**Unassigned tab:**
- List of unassigned leads: name, email, phone, status, source, date received
- Each row has an **"Assign" button**
- Clicking "Assign" opens an inline modal (same pattern as existing merge modal) with:
  - Lead name shown at top
  - Agent dropdown (populated from `GET /api/admin/agents-list`)
  - "Assign" button — calls `PATCH /api/admin/leads/[id]/assign`
  - "Cancel" button
- On success: lead row disappears from the Unassigned tab (optimistic removal)
- On error: inline error message below the dropdown

**Empty state:** "No unassigned leads — you're all caught up."

---

## Section 5: Agent Dashboard Banner

### Location

Top of `apps/web/src/app/(dashboard)/dashboard/leads/page.tsx`, rendered above the Kanban/list.

### Behavior

The leads page server component already fetches the agent's leads. Add a second query:

```ts
const unseenBrokerageLeads = agent
  ? await prisma.lead.findMany({
      where: { agentId: agent.id, brokerageFed: true, assignmentSeenAt: null },
      select: { id: true, firstName: true, lastName: true },
    })
  : [];
```

Pass `unseenBrokerageLeads` to a new `BrokerageLeadsBanner` client component.

### `BrokerageLeadsBanner` component

**Props:** `{ leads: { id: string; firstName: string; lastName: string }[] }`

**Renders** (when `leads.length > 0`):

```
┌─────────────────────────────────────────────────────────┐
│  📋 Ryan assigned you N new brokerage lead(s):           │
│  John Smith, Jane Doe                                    │
│                                              [Dismiss]   │
└─────────────────────────────────────────────────────────┘
```

- Gold/accent background (`bg-[#9E8C61]/10 border border-[#9E8C61]/30`)
- Lead names listed (up to 3, then "+ N more")
- **Dismiss button** — calls `POST /api/leads/dismiss-brokerage-assignments`, then hides the banner (optimistic)
- No reload needed — banner disappears client-side immediately on dismiss

**Does not render** when `leads.length === 0`.

---

## Section 6: Files Created / Modified

**Schema:**
- `packages/database/prisma/schema.prisma` — add `brokerageFed` + `assignmentSeenAt` to `Lead`
- New migration: `add_lead_pool_fields`

**API routes:**
- `apps/web/src/app/api/admin/leads/unassigned/route.ts` — GET
- `apps/web/src/app/api/admin/leads/[id]/assign/route.ts` — PATCH
- `apps/web/src/app/api/admin/agents-list/route.ts` — GET
- `apps/web/src/app/api/leads/dismiss-brokerage-assignments/route.ts` — POST

**Components:**
- `apps/web/src/app/(dashboard)/admin/leads/AdminLeadsClient.tsx` — replaces `AdminLeadsMergeClient`, adds Unassigned tab + assign modal
- `apps/web/src/components/leads/BrokerageLeadsBanner.tsx` — dismissible agent notification banner

**Pages (modify):**
- `apps/web/src/app/(dashboard)/admin/leads/page.tsx` — pass unassigned leads + agents list to new client
- `apps/web/src/app/(dashboard)/dashboard/leads/page.tsx` — query + pass unseenBrokerageLeads to banner

**Tests:**
- `apps/web/src/__tests__/api/lead-pool.test.ts` — covers assign route + dismiss route

---

## Decisions Made

| Decision | Choice | Reason |
|---|---|---|
| Who assigns | Admin only | Ryan needs to control 70/30 split leads |
| Pool entry point | Website inquiries (agentId = null) | Auto-pooled; no manual admin action needed to add to pool |
| Split tracking | `brokerageFed` boolean on Lead | Permanent, queryable, no separate table needed |
| Notification UI | Dismissible banner on leads dashboard | Most visible without requiring a full notification system |
| Dismiss scope | All unseen brokerage leads at once | Simpler than per-lead dismiss; one click is enough |
| Email failure | Log + continue (non-fatal) | Assignment is the critical action; email retry can be manual |
| Agent list endpoint | New `GET /api/admin/agents-list` | No existing endpoint returns agent list for admin use |
