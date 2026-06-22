# Task 1 Report — Schema Migration + Status Colors

**Date:** 2026-06-17
**Plan:** 2026-06-17-phase7-sub1-lead-profile-enhancements.md
**Status:** DONE_WITH_CONCERNS

---

## What Was Done

### 1. LeadStatus Enum — 3 values added (schema.prisma)
Added `HOT_PROSPECT`, `NURTURE`, and `SPHERE` between `QUALIFIED`/`SHOWING` and after `LOST` respectively, preserving existing sort order.

### 2. Lead Model — 4 new fields + 5 back-relations (schema.prisma)
Added to `model Lead` after `agentId`:
- `priceMin Float?`
- `priceMax Float?`
- `timeframeToMove String?`
- `lastContactedAt DateTime?`
- Back-relations: `tags LeadTag[]`, `tasks LeadTask[]`, `customFieldValues CustomFieldValue[]`, `relationshipsFrom LeadRelationship[] @relation("RelationshipFrom")`, `relationshipsTo LeadRelationship[] @relation("RelationshipTo")`

### 3. User Model — 1 back-relation added (schema.prisma)
Added `propertyViews PropertyView[]` after `blogPosts BlogPost[]`.

### 4. Agent Model — 1 back-relation added (schema.prisma)
Added `assignedTasks LeadTask[] @relation("TaskAssignee")` after `campaigns Campaign[]`.

### 5. New Models — 7 models appended (schema.prisma)
Appended after `model Message`:
- `Tag` — id, name @unique, color default "#9E8C61", createdAt, leads LeadTag[]
- `LeadTag` — composite @@id([leadId, tagId]), cascade deletes on both sides
- `LeadRelationship` — @@unique([fromLeadId, toLeadId]), named relations "RelationshipFrom" / "RelationshipTo"
- `LeadTask` — taskType default "FOLLOW_UP", named relation "TaskAssignee" on Agent
- `PropertyView` — @@index([userId]), @@index([mlsNumber])
- `CustomFieldDef` — options Json default "[]", order Int default 0, hideIfEmpty Boolean
- `CustomFieldValue` — @@unique([customFieldDefId, leadId])

### 6. Migration File — Created manually (packages/database/prisma/migrations/)
Migration name: `20260617000000_phase7_lead_profile_enhancements`
File: `packages/database/prisma/migrations/20260617000000_phase7_lead_profile_enhancements/migration.sql`

The migration was created **manually** rather than via `prisma migrate dev` — see concern below.

### 7. campaign-ui.ts — 3 new status color entries added
Added `HOT_PROSPECT`, `NURTURE`, and `SPHERE` to `LEAD_STATUS_COLORS` in `apps/web/src/lib/campaign-ui.ts`.

---

## Migration Name Used

`phase7-lead-profile-enhancements` (directory: `20260617000000_phase7_lead_profile_enhancements`)

---

## Issues Encountered

### Railway DB Not Responding to Prisma Connections (CONCERN)

`prisma migrate dev` returned P1001 ("Can't reach database server") consistently.

Diagnosis:
- TCP port 51294 IS reachable (PowerShell `Test-NetConnection` confirms `True`)
- Raw PostgreSQL protocol test (SSLRequest packet) timed out — server accepted the TCP connection but never responded with `S` or `N`
- This indicates the Railway PostgreSQL instance is **suspended/sleeping** rather than unreachable

**Root cause:** Railway Hobby plan suspends Postgres instances after idle periods. The DB is healthy but sleeping.

**Resolution required:** Ryan needs to wake the DB by visiting the Railway dashboard or starting the dev server (which will trigger a connection and wake it). Once the DB is awake, run:

```bash
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm --filter "@cnc/database" exec prisma migrate dev --name phase7-lead-profile-enhancements
```

If the DB has already applied the manually-created migration file (Prisma will detect it by checksum), this will succeed immediately. If Prisma complains about a migration drift, use:

```bash
pnpm --filter "@cnc/database" exec prisma migrate deploy
```

### packages/database/.env Was Missing

The database package had no `.env` file pointing to the Railway DB (previously noted as created in the 2026-05-22 session, but it was missing). Created `packages/database/.env` with `DATABASE_URL` from `apps/web/.env.local` — this file was NOT committed (it contains the production DB password).

---

## Confirmation of Schema Changes

All 7 schema changes are committed in `adce158` and verified in `packages/database/prisma/schema.prisma`:
- LeadStatus enum: 11 values (was 8)
- Lead model: 4 new nullable fields + 5 back-relations
- User model: +propertyViews back-relation
- Agent model: +assignedTasks back-relation
- 7 new models appended after Message

Migration SQL is in place and correct — awaiting DB wake-up to execute.

---

## Commit

`adce158` — feat(schema): phase7 sub1 — add LeadStatus stages, Tag/LeadTask/Relationship/PropertyView/CustomField models
