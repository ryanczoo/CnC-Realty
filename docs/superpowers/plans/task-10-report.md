# Task 10 Report — Lead Profile Page: 2-Column Layout + LeadProfileTabs

## Status: DONE

## Files Created / Modified

- **Created:** `apps/web/src/components/leads/LeadProfileTabs.tsx`
- **Rewritten:** `apps/web/src/app/(dashboard)/dashboard/leads/[id]/page.tsx`

## Component Prop Shape Findings

### ActivityFeed (`components/dashboard/ActivityFeed.tsx`)
Expects: `{ id: string; type: string; content: string; createdAt: string }[]`
- Exactly matches the plan spec — no adjustment needed
- Uses `TYPE_LABELS` to display NOTE/CALL/EMAIL/SHOWING/OFFER/DOCUMENT

### AddNoteForm (`components/dashboard/AddNoteForm.tsx`)
Expects: `{ leadId: string }` — single prop only
- No change needed from the plan spec

### LeadDetailSidebar (`components/leads/LeadDetailSidebar.tsx`)
Expects a `lead` object with these serialized fields:
- `id, firstName, lastName, email, phone, status, source, score, priceMin, priceMax`
- `timeframeToMove, utmSource, utmMedium, utmCampaign`
- `createdAt: string` (serialized ISO string)
- `lastContactedAt: string | null` (serialized ISO string or null)
- `tags: { tag: { id, name, color } }[]`
- `relationshipsFrom: { id, type, lead: { id, firstName, lastName, email } }[]`
- `relationshipsTo: { id, type, lead: { id, firstName, lastName, email } }[]`

The page maps `r.toLead` → `lead` in `relationshipsFrom` and `r.fromLead` → `lead` in `relationshipsTo`.

### LeadTasksTab (`components/leads/LeadTasksTab.tsx`)
Expects: `{ leadId: string; initialTasks: LeadTask[] }` where LeadTask has `dueDate: string | null` and `completedAt: string | null`

### HomesTab (`components/leads/HomesTab.tsx`)
Expects: `{ leadId: string }` — single prop only

## What Changed

**Old page.tsx:** Single-column layout, max-w-2xl, inline status label map, no auth guard for agent role, no tags/tasks/relationships included.

**New page.tsx:** 2-column grid (lg:grid-cols-3), LeadDetailSidebar in col-1, LeadProfileTabs (tabbed: Activity / Tasks / Homes) in col-2/3. Auth guard added (agent can only see their own leads). Full include of activities, tags, tasks, relationships. Dates serialized to ISO strings before passing to client components. No `as any` casts needed — types matched exactly.

## TypeScript Check

`npx tsc --noEmit` — no errors in the two modified/created files. All errors in output are pre-existing issues in other parts of the codebase (test files, Framer Motion PULSE_ANIMATE readonly tuple, Prisma client import in some files, Zod `.errors` property).
