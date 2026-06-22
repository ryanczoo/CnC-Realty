# Sub-project 1: Lead Profile Enhancements — Design Spec

**Date:** 2026-06-17  
**Phase:** 7 (CRM Expansion)  
**Sub-project:** 1 of 8  
**Status:** Approved — ready for implementation planning  

---

## Overview

Expand the existing `Lead` model and lead profile UI to support the full FUB-equivalent contact management layer. This sub-project is the **foundation** for all subsequent Phase 7 sub-projects — Smart Lists, Action Plans, and Trigger Automations all depend on the fields and models introduced here.

**What ships in this sub-project:**
- Schema: 3 new enum values, 4 new fields on Lead, 6 new models
- Enhanced lead profile: 2-column layout with tags, price range, timeframe to move, relationships, Tasks tab, Homes tab
- Auto-tagging on lead creation + SendGrid bounce/unsubscribe hooks
- Export leads to CSV on the leads list page
- Lead merge (admin-only)
- Admin tag management at `/admin/settings/tags`

**What is deferred:**
- Smart List filters that consume the new fields → Sub-project 2
- Full CRM Tasks page (calendar view, team view) → Sub-project 4
- Action Plans applying/removing tags → Sub-project 5
- Custom Fields admin UI → later sub-project (schema is in place, UI deferred)

---

## Section 1: Schema Changes

### 1.1 `LeadStatus` enum — 3 new values (additive, no migration of existing data)

```prisma
enum LeadStatus {
  NEW
  CONTACTED
  QUALIFIED
  HOT_PROSPECT    // ← new: engaged, wants to move fast
  NURTURE         // ← new: not ready now, 6–12+ months out
  SHOWING
  OFFER
  UNDER_CONTRACT
  CLOSED
  LOST
  SPHERE          // ← new: personal network — friends, family, referrals
}
```

The existing Kanban board (`LeadKanban.tsx`) remains at 8 columns. Leads with new stages are not shown in the Kanban — they appear in Smart Lists (Sub-project 2) which becomes the primary view for relationship-stage contacts. The `LEAD_STATUS_COLORS` map in `campaign-ui.ts` gets 3 new color entries.

`STATUS_LABELS` in `leads/[id]/page.tsx` and any other label maps get updated with human-readable names:
- `HOT_PROSPECT` → "Hot Prospect"
- `NURTURE` → "Nurture"
- `SPHERE` → "Sphere"

### 1.2 `Lead` model — 4 new fields

```prisma
priceMin        Float?    // buyer's minimum budget
priceMax        Float?    // buyer's maximum budget
timeframeToMove String?   // "0-3 months" | "3-6 months" | "6-12 months" | "12+ months" | "Unknown"
lastContactedAt DateTime? // updated whenever an Activity is logged for this lead
```

`lastContactedAt` is updated automatically by the activity creation API whenever a NOTE, CALL, or EMAIL activity is logged — it does not require a separate user action.

### 1.3 New `Tag` model

```prisma
model Tag {
  id        String   @id @default(cuid())
  name      String   @unique
  color     String   @default("#9E8C61")
  createdAt DateTime @default(now())

  leads LeadTag[]
}
```

All tags are equal — no distinction between system tags and custom tags. Auto-applied tags (city, "Bounced Email", "Unsubscribed") are regular tags that agents can edit or remove.

### 1.4 New `LeadTag` junction

```prisma
model LeadTag {
  leadId String
  tagId  String

  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([leadId, tagId])
}
```

Add `tags LeadTag[]` relation to `Lead` model.

### 1.5 New `LeadRelationship` model

```prisma
model LeadRelationship {
  id         String   @id @default(cuid())
  fromLeadId String
  toLeadId   String
  type       String   // "SPOUSE" | "PARTNER" | "FAMILY" | "REFERRAL"
  createdAt  DateTime @default(now())

  fromLead Lead @relation("RelationshipFrom", fields: [fromLeadId], references: [id], onDelete: Cascade)
  toLead   Lead @relation("RelationshipTo",   fields: [toLeadId],   references: [id], onDelete: Cascade)

  @@unique([fromLeadId, toLeadId])
}
```

Relationships are bidirectional in the UI — creating A→B also displays B→A on the other lead's profile. The DB stores one record; the query fetches both directions.

### 1.6 New `LeadTask` model

CRM tasks scoped to a lead. Separate from `FileTask` (which is scoped to transaction/listing files).

```prisma
model LeadTask {
  id          String    @id @default(cuid())
  leadId      String
  title       String
  taskType    String    @default("FOLLOW_UP")
  // taskType values: "FOLLOW_UP" | "CALL" | "EMAIL" | "TEXT" | "SHOWING" | "THANK_YOU" | "OTHER"
  assigneeId  String?   // agentId — defaults to lead's assigned agent
  dueDate     DateTime?
  done        Boolean   @default(false)
  completedAt DateTime?
  createdAt   DateTime  @default(now())

  lead     Lead   @relation(fields: [leadId], references: [id], onDelete: Cascade)
  assignee Agent? @relation(fields: [assigneeId], references: [id])
}
```

### 1.7 New `PropertyView` model

Tracks when a registered buyer views a property detail page. Used by the Homes Tab.

```prisma
model PropertyView {
  id        String   @id @default(cuid())
  userId    String
  mlsNumber String
  viewedAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([mlsNumber])
}
```

View tracking fires in the property detail page server component when `session.user` exists with role BUYER. One record per view (not deduplicated — we want a recency signal).

### 1.8 New `CustomFieldDef` + `CustomFieldValue` models (schema only — UI deferred)

```prisma
model CustomFieldDef {
  id          String   @id @default(cuid())
  name        String
  fieldType   String   // "TEXT" | "NUMBER" | "DATE" | "DROPDOWN"
  options     Json     @default("[]") // for DROPDOWN type: ["Option A", "Option B"]
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

Schema is created in this sub-project's migration. No API routes or UI are built yet.

### 1.9 Back-relations added to existing models

These must be added to existing model definitions in `schema.prisma` for Prisma to compile:

**`Lead` model gains:**
```prisma
tags              LeadTag[]
tasks             LeadTask[]
customFieldValues CustomFieldValue[]
relationshipsFrom LeadRelationship[] @relation("RelationshipFrom")
relationshipsTo   LeadRelationship[] @relation("RelationshipTo")
```

**`User` model gains:**
```prisma
propertyViews PropertyView[]
```

**`Agent` model gains:**
```prisma
assignedTasks LeadTask[] @relation("TaskAssignee")
```

---

## Section 2: Lead Profile UI

### 2.1 Layout change

Current: single column, `max-w-2xl`, 3 cards  
New: 2-column grid, `max-w-6xl`, left sidebar (1/3) + tabbed right panel (2/3)

### 2.2 Left column — contact sidebar

**Contact card** (top of left column):
- Initials avatar (first + last initial, gold background)
- Name — editable inline (click to edit, blur to save via PATCH `/api/leads/[id]`)
- Email + phone — editable inline
- Stage dropdown — full LeadStatus enum with human labels
- Source badge (read-only)
- Lead score (read-only)
- "Last contacted X days ago" computed from `lastContactedAt`, or "Never contacted"
- Created date

**Tags section:**
- Colored tag pills, each with an × button to remove
- "+ Add Tag" button → Popover:
  - Search input (filters existing tags by name)
  - List of matching tags (colored dot + name) — click to apply
  - "Create tag: [typed name]" option at bottom if no exact match → opens color picker → creates Tag + applies LeadTag
- Auto-applied tags (city, Bounced Email, Unsubscribed) appear identically to manually applied tags

**Lead Details section:**
- Price Range: "Min $" and "Max $" number inputs, saved on blur
- Timeframe to Move: select dropdown with 5 options
- Collapsible "Campaign Details" row: UTM source / medium / campaign (read-only, gray)

**Relationships section:**
- List of linked leads: "[Name] — [Type]" with a remove button
- "+ Link Contact" → Modal:
  - Search field: find leads by first name, last name, or email
  - Results list with name + email
  - Relationship type selector (Spouse, Partner, Family, Referral)
  - Save button → creates `LeadRelationship` record
- When viewing Lead A, the profile of Lead B also shows A in its Relationships section (bidirectional query)

### 2.3 Right column — tabbed panel

Three tabs: **Activity** | **Tasks** | **Homes**

**Activity tab** (existing content moved here):
- `AddNoteForm` component (existing)
- `ActivityFeed` component (existing)
- On activity creation: API also sets `lead.lastContactedAt = now()`

**Tasks tab** (new):
- Quick task row: three buttons — "Tomorrow", "In 3 Days", "Next Week"
  - One click → creates a FOLLOW_UP LeadTask with that due date, assigned to current agent, no modal
- Task list sections:
  - **Overdue** (red badge) — dueDate < today, done = false
  - **Due Today** (amber badge) — dueDate = today, done = false
  - **Upcoming** (no badge) — dueDate > today, done = false
  - **Completed** (collapsed by default, struck-through) — done = true
- Each task row: checkbox (toggle done) + title + type icon + due date + assignee initials
- "+ New Task" → slide-in drawer:
  - Title input
  - Task type dropdown (Follow Up / Call / Email / Text / Showing / Thank You / Other)
  - Assignee picker (agents list, defaults to lead's assigned agent)
  - Due date picker + optional time
  - Save button

**Homes tab** (new):
- Only shown if a User account exists with `email = lead.email` and `role = BUYER`
- If no account: placeholder — "This lead hasn't registered on the website yet"
- **Saved Properties** section: grid of property cards (photo, address, price, beds/baths/sqft), pulled from `SavedProperty` via the matched userId
- **Recently Viewed** section: list sorted by most recent — address, price, last viewed date/time, pulled from `PropertyView` via matched userId
- Both sections are read-only on the lead profile

### 2.4 Admin lead profile (`/admin/leads/[id]`)

Same 2-column layout as agent profile. Admins additionally see:
- Assigned agent (editable — reassign via dropdown)
- All agents' tasks (not just their own)
- "Merge Lead" button (described in 2.5)

### 2.5 Leads list page additions

**Export CSV button** (visible to agents for their own leads, admins for all):
- Exports currently visible leads (respects agent scope / any applied filters)
- Columns: First Name, Last Name, Email, Phone, Stage, Source, Tags, Price Min, Price Max, Timeframe, Assigned Agent, Created Date, Last Contacted Date
- Downloaded as `cnc-leads-YYYY-MM-DD.csv`

**Merge Leads** (admin-only):
- Checkbox column on admin leads table to select two leads
- "Merge Selected" button appears when exactly 2 are checked
- Confirmation modal: shows both leads side-by-side, asks which is the "winner" (the record that survives)
- On confirm: activities, tags, tasks, and relationships from the loser are moved to the winner; loser record is deleted
- API route: `POST /api/admin/leads/merge` with `{ winnerId, loserId }`

---

## Section 3: Auto-tagging + Admin Tag Management

### 3.1 Auto-tagging rules

Fires inside the lead creation API route (`POST /api/leads`) and relevant webhook handlers. Uses a shared `applyTag(leadId, tagName)` utility that finds-or-creates the Tag then upserts the LeadTag.

| Trigger | Tag applied | Where it fires |
|---|---|---|
| Property inquiry (mlsNumber present on lead creation) | City of that property (e.g., "Irvine") | Lead creation API |
| Lead source = OPEN_HOUSE | "Open House" | Lead creation API |
| SendGrid bounce webhook | "Bounced Email" | `/api/webhooks/sendgrid` |
| Campaign unsubscribe | "Unsubscribed" | Unsubscribe API route |

**City auto-tag toggle:** Stored as `SiteSettings` key `autoTagCity` (value `"true"` / `"false"`). Default: `"true"`. Admin can toggle from the Tags settings page. The lead creation API checks this setting before applying the city tag.

### 3.2 Admin Tag Management — `/admin/settings/tags`

New page, same layout/chrome as `/admin/settings/checklists`.

**Tag table columns:** Color swatch | Name | Leads using it (count) | Actions

**Create tag** (inline form at page top):
- Name input + color picker (8 preset swatches: gold `#9E8C61`, blue, green, red, purple, orange, teal, gray) + custom hex input
- Save → creates Tag record → appears in table

**Edit tag:**
- Click Edit → row becomes editable inline → update name and/or color → Save
- Color change reflects immediately on all lead profiles (tag color is stored on the Tag model, not per-lead)

**Delete tag:**
- If lead count = 0: delete button enabled, confirms and removes
- If lead count > 0: button shows "Used by N leads" and is disabled
- Admin override: "Force delete (removes from all leads)" — deletes Tag + all LeadTag records for it

**City auto-tag toggle:**
- Toggle switch at top of page: "Auto-tag leads with city of property inquiry"
- Reads/writes `SiteSettings.autoTagCity`

---

## Key API Routes

| Method | Path | Purpose |
|---|---|---|
| PATCH | `/api/leads/[id]` | Update lead fields (name, email, phone, stage, priceMin, priceMax, timeframeToMove) |
| POST | `/api/leads/[id]/tags` | Apply a tag to a lead |
| DELETE | `/api/leads/[id]/tags/[tagId]` | Remove a tag from a lead |
| POST | `/api/leads/[id]/relationships` | Link two leads |
| DELETE | `/api/leads/[id]/relationships/[relId]` | Remove a relationship |
| POST | `/api/leads/[id]/tasks` | Create a LeadTask |
| PATCH | `/api/leads/[id]/tasks/[taskId]` | Update a task (toggle done, edit fields) |
| DELETE | `/api/leads/[id]/tasks/[taskId]` | Delete a task |
| GET | `/api/leads/[id]/homes` | Return saved properties + viewed properties for this lead |
| GET | `/api/leads/export` | Stream CSV of leads in scope |
| POST | `/api/admin/leads/merge` | Merge two leads (admin only) |
| GET | `/api/admin/tags` | List all tags with lead counts |
| POST | `/api/admin/tags` | Create a tag |
| PATCH | `/api/admin/tags/[id]` | Update tag name/color |
| DELETE | `/api/admin/tags/[id]` | Delete tag (with force option) |

---

## Files Changed / Created

**Schema:**
- `packages/database/prisma/schema.prisma` — enum + model additions
- New migration file

**App:**
- `apps/web/src/lib/campaign-ui.ts` — 3 new color entries + updated status labels
- `apps/web/src/app/(dashboard)/dashboard/leads/[id]/page.tsx` — full rewrite (2-column layout)
- `apps/web/src/app/(dashboard)/admin/leads/page.tsx` — export button + merge checkbox
- `apps/web/src/app/(dashboard)/admin/leads/[id]/page.tsx` — new admin lead detail page
- `apps/web/src/app/(dashboard)/admin/settings/tags/page.tsx` — new tags management page

**New components:**
- `apps/web/src/components/leads/TagPicker.tsx`
- `apps/web/src/components/leads/RelationshipSection.tsx`
- `apps/web/src/components/leads/LeadTasksTab.tsx`
- `apps/web/src/components/leads/HomesTab.tsx`
- `apps/web/src/components/leads/LeadDetailSidebar.tsx`

**New API routes:**
- 14 routes listed in the Key API Routes table above

**Lib utilities:**
- `apps/web/src/lib/tags.ts` — `applyTag(leadId, tagName)` shared utility
- `apps/web/src/lib/lead-export.ts` — CSV generation

---

## Decisions Made

| Decision | Choice | Reason |
|---|---|---|
| LeadStatus stages | Expand enum (add 3 values) | Additive — zero risk to existing data or Kanban |
| Kanban columns | Leave at 8 (unchanged) | New stages belong in Smart Lists view (Sub-project 2) |
| Tag system | Reference table (Tag + LeadTag) | Data consistency for Smart List filters |
| System vs custom tags | All tags equal | Simpler; CnC's scale doesn't require locked system tags |
| Naming | "Lead Pool" not "Lead Ponds" | Product differentiation from FUB |
| Custom fields UI | Deferred | Schema in place; UI adds scope without screenshot value |
| PropertyView linkage | Via userId (not leadId) | Consistent with existing SavedProperty model |
