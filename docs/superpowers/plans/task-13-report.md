# Task 13 Report — CSV Export + Lead Merge UI

## Existing page structure

The page was a server component that:
- Used `AdminTable` (a shared wrapper that renders `<table>` inside a rounded white card with a styled `<thead>`)
- Rendered 6 columns: Lead Name, Email, Status, Source, Agent, Created
- Used `formatDate`, `LEAD_STATUS_COLORS`, and inline `<Link>` for name column
- Had no interactive elements — purely static table rows

## Approach taken

The `AdminTable` component was not reused in the client component because it only accepts `headers` + `children` (no way to inject a checkbox column header). Instead, `AdminLeadsMergeClient` renders its own full `<table>` with the same visual styling (`bg-white rounded-2xl shadow-sm`, same header classes) but adds a leading checkbox column.

The server component now:
1. Serializes leads (converting `createdAt: Date` → ISO string, extracting `agentEmail` from nested `agent.user.email`)
2. Adds an `"Export CSV"` anchor pointing to `/api/leads/export` in the header
3. Passes the serialized array to `AdminLeadsMergeClient`

The `AdminLeadsMergeClient` handles:
- Checkbox selection (max 2 leads)
- Merge bar (appears when exactly 2 are selected)
- Merge modal (choose which record to keep; calls `POST /api/admin/leads/merge`)
- Reload after successful merge

Columns are preserved (Lead Name, Email, Status, Source, Agent, Created) plus a new unlabeled checkbox column at the start. `formatDate` and `LEAD_STATUS_COLORS` are reused from shared libs.

## Status: DONE

**Commit:** `5f3add5`

**TypeScript:** No new errors introduced. Pre-existing errors (in test files, Prisma client imports, motion.ts `readonly` arrays) are unrelated to this task.

**Both API endpoints confirmed present:**
- `GET /api/leads/export` — `apps/web/src/app/api/leads/export/route.ts`
- `POST /api/admin/leads/merge` — `apps/web/src/app/api/admin/leads/merge/route.ts`
