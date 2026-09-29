# Personal Agent Views, All Leads Assignment, Newsletter Enrollment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard's Agent section personal for admins, let admins assign any agent-less lead from All Leads, make the newsletter list admin-only, and enroll contact-form visitors in the newsletter through one shared signup function.

**Architecture:** Replace the "admin → no agent filter" pattern with the signed-in user's own `session.user.agentId` in the Agent-section data paths (two deliberate exceptions: a lead's Deals box for admins, and the admin "Newsletter" list). Extract the Assign pop-up into a shared component and the newsletter signup into a shared `subscribeToNewsletter()` used by the footer and three contact forms, plus one shared disclaimer component.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma, Vitest (node environment — no React render tests in this repo), Framer Motion, Postmark via `sendEmail`.

**Spec:** `docs/superpowers/specs/2026-09-29-personal-agent-views-and-newsletter-enrollment-design.md`

## Global Constraints

- Work in `apps/web`. Run tests with `pnpm --filter web exec vitest run <path>`; full suite `pnpm --filter web exec vitest run`; types `pnpm --filter web exec tsc --noEmit`.
- Disclaimer text, exact: `By submitting, I agree to be contacted by CnC Realty for real estate services or news (unsubscribe anytime via email).`
- Admin newsletter list display name: `Newsletter`; slug stays `newsletter-subscribers`.
- Footer-created subscriber leads keep `firstName: "Newsletter"`, `lastName: "Subscriber"`.
- Not enrolled: homepage "Let's Start" (`ServicesSection`), property tour request (`properties/ContactForm`), an agent's Add Lead (`NewLeadModal`).
- `lib/unassigned-leads.ts` is not changed.
- Every `/admin/*` page stays brokerage-wide.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.
- Do not change `.env*` files or run migrations (none needed).

## Review Focus

1. **An agent (or admin) session with no `agentId`** must see *nothing*, never the whole brokerage. Today `where: agentId ? { agentId } : {}` returns everything when the id is missing. Pinned by the "no agentId → empty" tests in Tasks 1, 2, 3.
2. **An admin opening another agent's lead from All Leads** must still see that lead's deals. Pinned in Task 2.
3. **The same person, different capitalization, already subscribed** (`Sam@Example.com` on the list, contact form with `sam@example.com`) must not get a second subscription or welcome. Pinned in Task 6.
4. **Someone who unsubscribed later uses a contact form** must stay unsubscribed. Pinned in Task 6.
5. **Newsletter enrollment throws** (DB or email down) — the visitor's inquiry must still succeed. Pinned in Task 7.

---

### Task 1: Personal Overview and Leads page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/leads/page.tsx:20-36,54-58`
- Test: `apps/web/src/__tests__/components/DashboardOverviewPage.test.ts`
- Test: `apps/web/src/__tests__/components/LeadsPage.test.ts`

**Interfaces:**
- Produces: Leads page computes `const agentId = session.user.agentId` and `const isAdmin = role === "ADMIN"` (Task 4 passes `isAdmin` to the smart-list components).

- [ ] **Step 1: Replace the admin Overview test and add a no-agentId test**

In `DashboardOverviewPage.test.ts`, replace the whole `it("shows brokerage-wide (unscoped) counts for ADMIN", ...)` block with:

```ts
  it("scopes an ADMIN's Overview to their own leads (the Agent section is personal)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-2", role: "ADMIN", agentId: "agent-2" },
    } as any);
    vi.mocked(prisma.lead.count).mockResolvedValue(0);

    await DashboardPage();

    expect(prisma.lead.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ agentId: "agent-2" }) })
    );
    expect(prisma.lead.count).not.toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("shows zeros, never the whole brokerage, when the session has no agentId", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-3", role: "ADMIN", agentId: null },
    } as any);

    await DashboardPage();

    expect(prisma.lead.count).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Replace the admin LeadsPage test and add a no-agentId test**

In `LeadsPage.test.ts`, replace the whole `it("does not scope by agent for ADMIN (brokerage-wide view)", ...)` block with:

```ts
  it("scopes an ADMIN's Leads board, custom lists and banner to their own agentId", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-2", role: "ADMIN", agentId: "agent-2" },
    } as any);
    vi.mocked(prisma.smartList.findMany).mockResolvedValue([]);
    vi.mocked(prisma.lead.findMany).mockResolvedValue([]);

    await LeadsPage({ searchParams: {} });

    expect(prisma.smartList.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agentId: "agent-2" } })
    );
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ agentId: "agent-2", brokerageFed: true }) })
    );
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agentId: "agent-2" } })
    );
  });

  it("shows an empty board, never the whole brokerage, when the session has no agentId", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-3", role: "ADMIN", agentId: null },
    } as any);

    await LeadsPage({ searchParams: {} });

    expect(prisma.lead.findMany).not.toHaveBeenCalled();
    expect(prisma.smartList.findMany).not.toHaveBeenCalled();
  });
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `pnpm --filter web exec vitest run src/__tests__/components/DashboardOverviewPage.test.ts src/__tests__/components/LeadsPage.test.ts`
Expected: the new ADMIN and no-agentId tests FAIL (admin currently queried with `where: {}`).

- [ ] **Step 4: Make the Overview personal**

In `app/(dashboard)/dashboard/page.tsx`, replace the lines from `const role = ...` through the end of the `try { ... } catch { ... }` block with:

```tsx
  const role = (session!.user as any).role;
  // The Agent section is personal for everyone, admins included — an admin's
  // brokerage-wide numbers live on Admin → Overview.
  const agentId = (session!.user as any).agentId as string | null;

  let total = 0, newThisWeek = 0, active = 0, closed = 0;

  if (agentId) {
    try {
      const where = { agentId };
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      [total, newThisWeek, active, closed] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.count({ where: { ...where, createdAt: { gte: weekAgo } } }),
        prisma.lead.count({ where: { ...where, status: { notIn: ["CLOSED", "LOST"] } } }),
        prisma.lead.count({ where: { ...where, status: "CLOSED" } }),
      ]);
    } catch {
      // Shows zeros on DB error — better than crashing
    }
  }
```

- [ ] **Step 5: Make the Leads page personal**

In `app/(dashboard)/dashboard/leads/page.tsx`, replace the line
`const agentId = role !== "ADMIN" ? ((session!.user as any).agentId as string | null) : null;`
with:

```tsx
  // The Agent section is personal for everyone, admins included; the admin's
  // brokerage-wide view is Admin → All Leads.
  const agentId = (session!.user as any).agentId as string | null;
  const isAdmin = role === "ADMIN";
```

Then replace `if (!list || !isValidList) {` with `if (agentId && (!list || !isValidList)) {`, and inside that block replace `where: agentId ? { agentId } : {},` with `where: { agentId },`.

(`isAdmin` is used by Task 4; if lint flags it as unused now, prefix the declaration with `// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by the smart-list components (next task)` and Task 4 removes that comment.)

- [ ] **Step 6: Run both tests to verify they pass**

Run: `pnpm --filter web exec vitest run src/__tests__/components/DashboardOverviewPage.test.ts src/__tests__/components/LeadsPage.test.ts`
Expected: PASS (all tests in both files).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/dashboard/page.tsx apps/web/src/app/\(dashboard\)/dashboard/leads/page.tsx apps/web/src/__tests__/components/DashboardOverviewPage.test.ts apps/web/src/__tests__/components/LeadsPage.test.ts
git commit -m "feat: admin's Agent-section Overview and Leads show only their own leads

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Personal Pipeline and Tasks (lead Deals box stays open for admins)

**Files:**
- Modify: `apps/web/src/app/api/deals/route.ts:45-53`
- Modify: `apps/web/src/app/api/tasks/route.ts:35-47`
- Test: `apps/web/src/__tests__/api/deals.test.ts`
- Test: `apps/web/src/__tests__/api/tasks.test.ts`

- [ ] **Step 1: Update and add deals tests**

In `deals.test.ts`, inside `describe("GET /api/deals", ...)`, change the session in the three tests "caps GET results at 500 even for ADMIN with no filters", "logs a warning when the result is exactly capped at 500" and "does not log when the result is under 500" from `{ user: { id: "u1", role: "ADMIN", agentId: null } }` to `{ user: { id: "u1", role: "ADMIN", agentId: "a9" } }`. Then add these tests before the describe's closing `});`:

```ts
  it("scopes an ADMIN's Pipeline board to their own deals", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "ADMIN", agentId: "a9" } } as any);
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as any);

    await GET(new Request("http://localhost/api/deals?pipeline=BUYERS"));

    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agentId: "a9", pipeline: "BUYERS" } })
    );
  });

  it("lets an ADMIN see any lead's deals on that lead's page (?leadId=)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "ADMIN", agentId: "a9" } } as any);
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as any);

    await GET(new Request("http://localhost/api/deals?leadId=l-other"));

    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leadId: "l-other" } })
    );
  });

  it("keeps an AGENT's ?leadId= lookup limited to their own deals", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as any);

    await GET(new Request("http://localhost/api/deals?leadId=l-other"));

    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agentId: "a1", leadId: "l-other" } })
    );
  });

  it("returns an empty board, never every deal, for an ADMIN with no agentId", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "ADMIN", agentId: null } } as any);

    const res = await GET(new Request("http://localhost/api/deals?pipeline=BUYERS"));

    expect(await res.json()).toEqual([]);
    expect(prisma.deal.findMany).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Update the tasks admin test**

In `tasks.test.ts`, change `const SESSION_ADMIN = { user: { id: "u2", role: "ADMIN", agentId: null } };` to `const SESSION_ADMIN = { user: { id: "u2", role: "ADMIN", agentId: "a9" } };`, then replace the whole `it("admin sees all tasks (no agentId filter)", ...)` block with:

```ts
  it("scopes an ADMIN's Tasks to their own leads (the Agent section is personal)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_ADMIN as any);
    vi.mocked(prisma.leadTask.findMany).mockResolvedValue([] as any);

    const res = await GET(new Request("http://localhost/api/tasks"));

    expect(res.status).toBe(200);
    expect(prisma.leadTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ lead: { agentId: "a9" } }) })
    );
  });

  it("returns 404, never every task, for an ADMIN with no agentId", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u2", role: "ADMIN", agentId: null } } as any);

    const res = await GET(new Request("http://localhost/api/tasks"));

    expect(res.status).toBe(404);
    expect(prisma.leadTask.findMany).not.toHaveBeenCalled();
  });
```

(If `tasks.test.ts` names its GET import or prisma mock differently, keep the file's existing names — check the top of the file.)

- [ ] **Step 3: Run to verify failures**

Run: `pnpm --filter web exec vitest run src/__tests__/api/deals.test.ts src/__tests__/api/tasks.test.ts`
Expected: the new ADMIN tests FAIL.

- [ ] **Step 4: Change the deals GET scoping**

In `app/api/deals/route.ts`, replace:

```ts
  const role = (session.user as any).role;
  const agentId = role !== "ADMIN" ? session.user.agentId : null;

  if (role !== "ADMIN" && !agentId) return NextResponse.json([]);

  const where: Record<string, unknown> = {};
  if (agentId) where.agentId = agentId;
```

with:

```ts
  const role = (session.user as any).role;
  // The Pipeline board is personal for everyone, admins included. The one
  // exception: the Deals box on a lead's page (?leadId=) — an admin can open
  // any agent's lead from All Leads and must see that lead's deals.
  const adminLeadLookup = role === "ADMIN" && !!leadId;
  const agentId = adminLeadLookup ? null : session.user.agentId;

  if (!adminLeadLookup && !agentId) return NextResponse.json([]);

  const where: Record<string, unknown> = {};
  if (agentId) where.agentId = agentId;
```

- [ ] **Step 5: Change the tasks GET scoping**

In `app/api/tasks/route.ts`, replace:

```ts
  const isAdmin = session.user.role === "ADMIN";

  let agentId: string | undefined;
  if (!isAdmin) {
    if (!session.user.agentId) return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });
    agentId = session.user.agentId;
  }

  const tasks = await prisma.leadTask.findMany({
    where: {
      ...(doneFilter !== undefined ? { done: doneFilter } : {}),
      ...(!isAdmin ? { lead: { agentId } } : {}),
    },
```

with:

```ts
  // Tasks are personal for everyone, admins included.
  const agentId = session.user.agentId;
  if (!agentId) return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });

  const tasks = await prisma.leadTask.findMany({
    where: {
      ...(doneFilter !== undefined ? { done: doneFilter } : {}),
      lead: { agentId },
    },
```

- [ ] **Step 6: Run to verify they pass**

Run: `pnpm --filter web exec vitest run src/__tests__/api/deals.test.ts src/__tests__/api/tasks.test.ts src/__tests__/lib/dashboard-queries.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/deals/route.ts apps/web/src/app/api/tasks/route.ts apps/web/src/__tests__/api/deals.test.ts apps/web/src/__tests__/api/tasks.test.ts
git commit -m "feat: admin's Pipeline and Tasks are personal; a lead's Deals box stays open to admins

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Personal Campaigns list and lead pickers (`GET /api/leads`)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/campaigns/page.tsx:13-44`
- Modify: `apps/web/src/app/api/leads/route.ts` (GET, lines ~61-101)
- Test: `apps/web/src/__tests__/components/CampaignsPage.test.ts`
- Test: `apps/web/src/__tests__/api/leads.test.ts`

**Interfaces:**
- Produces: `GET /api/leads` filters branch computes `let agentId: string | null` from `sessionAgentId` for everyone (Task 4 adds the newsletter exception right above `buildLeadWhere`).

- [ ] **Step 1: Update the campaigns admin tests**

In `CampaignsPage.test.ts`, in the test "shows brokerage-wide campaigns for ADMIN, but still shows that admin's own quota if they have an Agent record": rename it to `"shows an ADMIN only their own campaigns, plus their own quota"` and replace its `expect(prisma.campaign.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));` (and the two comment lines above it) with:

```ts
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agentId: "agent-2" } })
    );
```

In the test "skips the quota lookup for an ADMIN with no Agent record at all", add at its end:

```ts
    // No agent record → no campaigns listed, never every agent's campaigns.
    expect(prisma.campaign.findMany).not.toHaveBeenCalled();
```

- [ ] **Step 2: Add GET /api/leads scoping tests**

In `leads.test.ts`, change the prisma mock to:

```ts
vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() } },
}));
```

change the route import to `import { GET, POST } from "../../app/api/leads/route";`, and append:

```ts
describe("GET /api/leads — personal scope", () => {
  const as = (role: string, agentId: string | null) =>
    vi.mocked(requireAuth).mockResolvedValue({ session: { user: { id: "u", role, agentId } }, error: null } as any);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.lead.findMany).mockResolvedValue([]);
    vi.mocked(prisma.lead.count).mockResolvedValue(0);
  });

  it("gives an ADMIN's lead pickers only their own leads", async () => {
    as("ADMIN", "agent-2");
    await GET(new Request("http://localhost/api/leads"));
    expect(prisma.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { agentId: "agent-2" } }));
  });

  it("scopes an ADMIN's smart-list results to their own leads", async () => {
    as("ADMIN", "agent-2");
    const filters = encodeURIComponent(JSON.stringify([{ field: "status", operator: "is", value: ["NEW"] }]));
    await GET(new Request(`http://localhost/api/leads?filters=${filters}`));
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ agentId: "agent-2" }, { status: { in: ["NEW"] } }] } })
    );
  });

  it("returns nothing, never the whole brokerage, for an ADMIN with no agentId", async () => {
    as("ADMIN", null);
    const res = await GET(new Request("http://localhost/api/leads"));
    expect(await res.json()).toEqual([]);
    expect(prisma.lead.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run to verify failures**

Run: `pnpm --filter web exec vitest run src/__tests__/components/CampaignsPage.test.ts src/__tests__/api/leads.test.ts`
Expected: the new ADMIN tests FAIL.

- [ ] **Step 4: Make the Campaigns list personal**

In `app/(dashboard)/dashboard/campaigns/page.tsx`, delete these lines (the role/agentId pair and the long comment):

```tsx
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session!.user as any).role;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentId = role !== "ADMIN" ? ((session!.user as any).agentId as string | null) : null;
  // Unfiltered by role — an ADMIN can have their own Agent record (e.g. a
  // broker who also sends campaigns personally) and still has a real quota
  // to see, even though `agentId` above is deliberately nulled for them so
  // the campaign LIST stays brokerage-wide instead of scoped to just them.
```

replace the comment above `const personalAgentId` with `// Campaigns are personal for everyone, admins included (the list and the quota line).`, and in `fetchCampaigns()` replace:

```tsx
    try {
      return await prisma.campaign.findMany({
        where: agentId ? { agentId } : {},
```

with:

```tsx
    if (!personalAgentId) return [];
    try {
      return await prisma.campaign.findMany({
        where: { agentId: personalAgentId },
```

If `role` was used elsewhere in the file, keep a `const role = (session!.user as any).role;` line for that use.

- [ ] **Step 5: Make GET /api/leads personal**

In `app/api/leads/route.ts` GET, replace the comment `// Agents see their own leads; ADMIN sees all.` with `// Personal for everyone, admins included (Leads smart lists and the lead pickers).`, then replace the `if (!filtersParam) { ... }` block with:

```ts
  if (!filtersParam) {
    if (!sessionAgentId) return NextResponse.json([]);
    const leads = await prisma.lead.findMany({
      where: { agentId: sessionAgentId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json(leads);
  }
```

and replace:

```ts
  let agentId: string | null = null;
  if (role !== "ADMIN") {
    if (!sessionAgentId) return NextResponse.json({ leads: [], total: 0, page, pageSize });
    agentId = sessionAgentId;
  }
```

with:

```ts
  if (!sessionAgentId) return NextResponse.json({ leads: [], total: 0, page, pageSize });
  let agentId: string | null = sessionAgentId;
```

(`role` stays destructured — Task 4 uses it. If lint flags it unused, leave it; Task 4 consumes it.)

- [ ] **Step 6: Run to verify they pass**

Run: `pnpm --filter web exec vitest run src/__tests__/components/CampaignsPage.test.ts src/__tests__/api/leads.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/dashboard/campaigns/page.tsx apps/web/src/app/api/leads/route.ts apps/web/src/__tests__/components/CampaignsPage.test.ts apps/web/src/__tests__/api/leads.test.ts
git commit -m "feat: admin's Campaigns list and lead pickers show only their own

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Admin-only "Newsletter" smart list (brokerage-wide)

**Files:**
- Modify: `apps/web/src/lib/smart-list-filters.ts`
- Modify: `apps/web/src/components/leads/SmartListSidebar.tsx`
- Modify: `apps/web/src/components/leads/SmartListResults.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/leads/page.tsx`
- Modify: `apps/web/src/app/api/leads/route.ts` (GET filters branch)
- Test: `apps/web/src/lib/smart-list-filters.test.ts`
- Test: `apps/web/src/__tests__/api/leads.test.ts`

**Interfaces:**
- Consumes: `isAdmin` in the Leads page (Task 1); `agentId`/`role` in GET /api/leads (Task 3).
- Produces: `visiblePrebuiltLists(isAdmin: boolean)`, `hasNewsletterFilter(filters: FilterCondition[]): boolean`, `resolveListFilters(slug, customLists, isAdmin = false)`; `SmartListSidebar` and `SmartListResults` take `isAdmin: boolean`.

- [ ] **Step 1: Write the failing list tests**

In `smart-list-filters.test.ts`, change the import to `import { buildLeadWhere, PREBUILT_LISTS, resolveListFilters, visiblePrebuiltLists, hasNewsletterFilter } from "./smart-list-filters";`, replace the test `"ships a prebuilt Newsletter Subscribers list"` with:

```ts
  it("ships an admin-only prebuilt Newsletter list", () => {
    const list = PREBUILT_LISTS.find((l) => l.slug === "newsletter-subscribers");
    expect(list).toEqual({
      slug: "newsletter-subscribers",
      name: "Newsletter",
      adminOnly: true,
      filters: [{ field: "newsletter", operator: "is", value: true }],
    });
  });

  it("hides the Newsletter list from agents and shows it to admins", () => {
    expect(visiblePrebuiltLists(false).map((l) => l.slug)).not.toContain("newsletter-subscribers");
    expect(visiblePrebuiltLists(true).map((l) => l.slug)).toContain("newsletter-subscribers");
  });

  it("treats a stale Newsletter link as invalid for an agent (falls back to the board)", () => {
    expect(resolveListFilters("newsletter-subscribers", [])).toBeNull();
    expect(resolveListFilters("newsletter-subscribers", [], true)).toEqual([{ field: "newsletter", operator: "is", value: true }]);
  });

  it("detects a newsletter filter", () => {
    expect(hasNewsletterFilter([{ field: "newsletter", operator: "is", value: true }])).toBe(true);
    expect(hasNewsletterFilter([{ field: "status", operator: "is", value: ["NEW"] }])).toBe(false);
  });
```

- [ ] **Step 2: Write the failing API tests**

Append to the `describe("GET /api/leads — personal scope", ...)` block in `leads.test.ts`:

```ts
  const newsletter = encodeURIComponent(JSON.stringify([{ field: "newsletter", operator: "is", value: true }]));

  it("shows an ADMIN every newsletter subscriber in the brokerage", async () => {
    as("ADMIN", "agent-2");
    await GET(new Request(`http://localhost/api/leads?filters=${newsletter}`));
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ newsletterSubscribedAt: { not: null }, newsletterOptOut: false }] } })
    );
  });

  it("refuses the newsletter list to an AGENT", async () => {
    as("AGENT", "agent-1");
    const res = await GET(new Request(`http://localhost/api/leads?filters=${newsletter}`));
    expect(res.status).toBe(403);
    expect(prisma.lead.findMany).not.toHaveBeenCalled();
  });
```

- [ ] **Step 3: Run to verify failures**

Run: `pnpm --filter web exec vitest run src/lib/smart-list-filters.test.ts src/__tests__/api/leads.test.ts`
Expected: FAIL (`visiblePrebuiltLists` not exported; newsletter results scoped/allowed).

- [ ] **Step 4: Implement the list helpers**

In `lib/smart-list-filters.ts`, change the `PREBUILT_LISTS` type and its newsletter entry:

```ts
export const PREBUILT_LISTS: Array<{ slug: string; name: string; filters: FilterCondition[]; adminOnly?: boolean }> = [
```

```ts
  // Admin-only and brokerage-wide: only admins control the newsletter.
  { slug: "newsletter-subscribers", name: "Newsletter", adminOnly: true, filters: [{ field: "newsletter", operator: "is", value: true }] },
```

Add after the array:

```ts
export function visiblePrebuiltLists(isAdmin: boolean) {
  return PREBUILT_LISTS.filter((l) => !l.adminOnly || isAdmin);
}

export function hasNewsletterFilter(filters: FilterCondition[]): boolean {
  return filters.some((f) => f.field === "newsletter");
}
```

and change `resolveListFilters` to:

```ts
export function resolveListFilters(
  slug: string | null,
  customLists: Array<{ id: string; filters: unknown }>,
  isAdmin = false,
): FilterCondition[] | null {
  if (!slug) return null;
  const prebuilt = visiblePrebuiltLists(isAdmin).find(l => l.slug === slug);
  if (prebuilt) return prebuilt.filters;
  const custom = customLists.find(l => l.id === slug);
  if (custom) return custom.filters as FilterCondition[];
  return null;
}
```

- [ ] **Step 5: Newsletter exception in GET /api/leads**

In `app/api/leads/route.ts`, add `hasNewsletterFilter` to the import from `@/lib/smart-list-filters`. In the filters branch, replace:

```ts
  if (!sessionAgentId) return NextResponse.json({ leads: [], total: 0, page, pageSize });
  let agentId: string | null = sessionAgentId;
```

with:

```ts
  // The newsletter list is admin-only and brokerage-wide (only admins run the
  // newsletter); every other list is personal.
  const isNewsletterList = hasNewsletterFilter(filters);
  if (isNewsletterList && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isNewsletterList && !sessionAgentId) {
    return NextResponse.json({ leads: [], total: 0, page, pageSize });
  }
  const agentId: string | null = isNewsletterList ? null : sessionAgentId;
```

- [ ] **Step 6: Pass `isAdmin` through the Leads UI**

In `app/(dashboard)/dashboard/leads/page.tsx`: remove the temporary eslint-disable comment on `isAdmin` if Task 1 added one; change `resolveListFilters(list, customLists)` to `resolveListFilters(list, customLists, isAdmin)`; change `<SmartListSidebar customLists={customLists} />` to `<SmartListSidebar customLists={customLists} isAdmin={isAdmin} />`; change `<SmartListResults activeList={list} customLists={customLists} />` to `<SmartListResults activeList={list} customLists={customLists} isAdmin={isAdmin} />`.

In `components/leads/SmartListSidebar.tsx`: change the import to `import { visiblePrebuiltLists } from "@/lib/smart-list-filters";`, change `type Props` to `{ customLists: CustomList[]; isAdmin: boolean }`, the signature to `export function SmartListSidebar({ customLists: initialLists, isAdmin }: Props)`, and `{PREBUILT_LISTS.map(list => (` to `{visiblePrebuiltLists(isAdmin).map(list => (`.

In `components/leads/SmartListResults.tsx`: add `isAdmin: boolean;` to `type Props`, change the signature to `export function SmartListResults({ activeList, customLists, isAdmin }: Props)`, and in the effect change `resolveListFilters(activeList, customLists)` to `resolveListFilters(activeList, customLists, isAdmin)` and its dependency array to `[activeList, customLists, isAdmin]`.

- [ ] **Step 7: Run tests and types**

Run: `pnpm --filter web exec vitest run src/lib/smart-list-filters.test.ts src/__tests__/api/leads.test.ts src/__tests__/components/LeadsPage.test.ts && pnpm --filter web exec tsc --noEmit`
Expected: PASS, 0 type errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/smart-list-filters.ts apps/web/src/lib/smart-list-filters.test.ts apps/web/src/components/leads/SmartListSidebar.tsx apps/web/src/components/leads/SmartListResults.tsx apps/web/src/app/\(dashboard\)/dashboard/leads/page.tsx apps/web/src/app/api/leads/route.ts apps/web/src/__tests__/api/leads.test.ts
git commit -m "feat: admin-only 'Newsletter' smart list showing every subscriber; hidden from agents

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Assign from the All Leads tab (shared pop-up) + Export CSV style

**Files:**
- Create: `apps/web/src/lib/assign-lead.ts`
- Create: `apps/web/src/lib/assign-lead.test.ts`
- Create: `apps/web/src/components/leads/AssignLeadModal.tsx`
- Modify: `apps/web/src/app/(dashboard)/admin/leads/AdminLeadsClient.tsx`
- Modify: `apps/web/src/app/(dashboard)/admin/leads/page.tsx:111-116`

**Interfaces:**
- Produces: `assignLead(leadId: string, agentId: string): Promise<{ ok: true } | { ok: false; error: string }>`; `AssignLeadModal({ lead, agents, onAssigned, onClose })` with `lead: { id: string; firstName: string; lastName: string }`, `agents: AgentOption[]`, `onAssigned: (leadId: string) => void`, `onClose: () => void`; `export type AgentOption = { id: string; displayName: string | null; user: { email: string } }`.

- [ ] **Step 1: Write the failing test**

Create `lib/assign-lead.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { assignLead } from "./assign-lead";

describe("assignLead", () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  it("PATCHes the existing assign route with the chosen agent", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    expect(await assignLead("lead-1", "agent-9")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/leads/lead-1/assign", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "agent-9" }),
    });
  });

  it("returns the server's error message on failure", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Agent not found" }) });
    expect(await assignLead("lead-1", "agent-9")).toEqual({ ok: false, error: "Agent not found" });
  });

  it("falls back to a generic message when the error body is unreadable", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => { throw new Error("bad json"); } });
    expect(await assignLead("lead-1", "agent-9")).toEqual({ ok: false, error: "Assignment failed. Please try again." });
  });

  it("reports a network error without throwing", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await assignLead("lead-1", "agent-9")).toEqual({ ok: false, error: "Network error. Please try again." });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web exec vitest run src/lib/assign-lead.test.ts`
Expected: FAIL — cannot find module `./assign-lead`.

- [ ] **Step 3: Implement `assignLead`**

Create `lib/assign-lead.ts`:

```ts
// The admin "Assign lead to an agent" call, shared by every place the Assign
// pop-up appears (All Leads and Unassigned tabs). Same messages the pop-up has
// always shown.
export async function assignLead(
  leadId: string,
  agentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/admin/leads/${leadId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: (data as { error?: string }).error ?? "Assignment failed. Please try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web exec vitest run src/lib/assign-lead.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Create the shared pop-up**

Create `components/leads/AssignLeadModal.tsx` (markup moved verbatim from `AdminLeadsClient`'s Assign modal):

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { assignLead } from "@/lib/assign-lead";

export type AgentOption = { id: string; displayName: string | null; user: { email: string } };

// The "Assign Lead" pop-up: pick an agent, and the lead becomes theirs (the
// agent gets the "You Just Got A Lead!" email). Used by both All Leads tabs.
export function AssignLeadModal({
  lead,
  agents,
  onAssigned,
  onClose,
}: {
  lead: { id: string; firstName: string; lastName: string };
  agents: AgentOption[];
  onAssigned: (leadId: string) => void;
  onClose: () => void;
}) {
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  async function handleAssign() {
    if (!selectedAgentId || assigning) return;
    setAssigning(true);
    setAssignError("");
    const result = await assignLead(lead.id, selectedAgentId);
    setAssigning(false);
    if (!result.ok) {
      setAssignError(result.error);
      return;
    }
    onAssigned(lead.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-1 font-sans text-lg font-light text-[#1B1B1B]">Assign Lead</h3>
        <p className="mb-4 text-sm text-[#1B1B1B]/60">
          {lead.firstName} {lead.lastName}
        </p>
        <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/50">Select Agent</label>
        <select
          value={selectedAgentId}
          onChange={(e) => {
            setSelectedAgentId(e.target.value);
            setAssignError("");
          }}
          className="mb-4 w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm text-[#1B1B1B] focus:outline-none focus:ring-1 focus:ring-[#9E8C61]"
        >
          <option value="">— Choose an agent —</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName ?? a.user.email}
            </option>
          ))}
        </select>
        {assignError && <p className="mb-3 text-xs text-red-600">{assignError}</p>}
        <div className="flex gap-2">
          <motion.button
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
            onClick={handleAssign}
            disabled={!selectedAgentId || assigning}
            className="flex-1 rounded-lg bg-[#9E8C61] py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {assigning ? "Assigning..." : "Assign"}
          </motion.button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#1B1B1B]/10 py-2 text-sm text-[#1B1B1B]/50 hover:bg-[#F2F0EF]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Use it in both tabs of `AdminLeadsClient`**

In `app/(dashboard)/admin/leads/AdminLeadsClient.tsx`:

1. Add `import { AssignLeadModal, type AgentOption } from "@/components/leads/AssignLeadModal";` and delete the local `type AgentOption = { ... };` block.
2. Replace the "assign modal state" block (the four `useState` lines for `assigningLead`, `selectedAgentId`, `assigning`, `assignError`) with:

```tsx
  // assign pop-up (shared component) — any lead without an agent, either tab
  const [assigningLead, setAssigningLead] = useState<{ id: string; firstName: string; lastName: string } | null>(null);

  function handleAssigned(leadId: string) {
    setUnassigned((prev) => prev.filter((l) => l.id !== leadId));
    setAssigningLead(null);
    router.refresh(); // All Leads row now shows the agent
  }
```

3. Delete the functions `openAssignModal`, `closeAssignModal` and `handleAssign`.
4. In the Unassigned tab, change `onClick={() => openAssignModal(lead)}` to `onClick={() => setAssigningLead(lead)}`.
5. In the All Leads tab, replace:

```tsx
                    {lead.agentEmail ?? (
                      <span className="text-[#1B1B1B]/30">Unassigned</span>
                    )}
```

with:

```tsx
                    {lead.agentEmail ?? (
                      <motion.button
                        animate={PULSE_ANIMATE}
                        transition={PULSE_TRANSITION}
                        whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
                        onClick={() => setAssigningLead(lead)}
                        className="rounded-lg bg-[#9E8C61] px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Assign
                      </motion.button>
                    )}
```

6. Replace the whole `{/* ── Assign modal ── */}` block (`{assigningLead && ( <div className="fixed inset-0 ...">...</div> )}`) with:

```tsx
      {/* ── Assign pop-up ── */}
      {assigningLead && (
        <AssignLeadModal
          key={assigningLead.id}
          lead={assigningLead}
          agents={agents}
          onAssigned={handleAssigned}
          onClose={() => setAssigningLead(null)}
        />
      )}
```

- [ ] **Step 7: Restyle Export CSV like "New Listing"**

In `app/(dashboard)/admin/leads/page.tsx`, change the Export CSV `<a>`'s `className` to exactly:

```tsx
          className="flex items-center gap-1.5 rounded-full border border-[#1B1B1B]/20 bg-white px-4 py-2 text-sm text-[#1B1B1B]"
```

- [ ] **Step 8: Types, lint, tests**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web exec eslint src/components/leads/AssignLeadModal.tsx "src/app/(dashboard)/admin/leads/AdminLeadsClient.tsx" src/lib/assign-lead.ts && pnpm --filter web exec vitest run src/lib/assign-lead.test.ts`
Expected: 0 type errors, no new lint errors, PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/assign-lead.ts apps/web/src/lib/assign-lead.test.ts apps/web/src/components/leads/AssignLeadModal.tsx apps/web/src/app/\(dashboard\)/admin/leads/AdminLeadsClient.tsx apps/web/src/app/\(dashboard\)/admin/leads/page.tsx
git commit -m "feat: assign any agent-less lead from All Leads via a shared Assign pop-up; restyle Export CSV

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Shared `subscribeToNewsletter()` (footer moved onto it)

**Files:**
- Create: `apps/web/src/lib/newsletter.ts`
- Create: `apps/web/src/lib/newsletter.test.ts`
- Modify: `apps/web/src/app/api/newsletter/subscribe/route.ts`
- Modify: `apps/web/src/__tests__/api/newsletter-subscribe.test.ts`

**Interfaces:**
- Produces: `export type NewsletterSignupSource = "footer" | "contact-form"`; `subscribeToNewsletter(opts: { email: string; source: NewsletterSignupSource; leadId?: string }): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create `lib/newsletter.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() } },
}));
vi.mock("@/lib/email/newsletter-email", () => ({ sendNewsletterWelcome: vi.fn().mockResolvedValue({ sent: true }) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { sendNewsletterWelcome } from "@/lib/email/newsletter-email";
import { emailMatchWhere } from "@/lib/email-match";
import { subscribeToNewsletter } from "./newsletter";

const lead = (over: Partial<{ id: string; email: string; newsletterSubscribedAt: Date | null; newsletterOptOut: boolean }>) => ({
  id: "lead-1", email: "sam@example.com", newsletterSubscribedAt: null, newsletterOptOut: false, ...over,
});

describe("subscribeToNewsletter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.lead.findMany).mockResolvedValue([]);
    vi.mocked(prisma.lead.create).mockResolvedValue({ id: "new-lead" } as any);
  });

  it("looks the address up ignoring capitalization, oldest lead first", async () => {
    await subscribeToNewsletter({ email: "Sam@Example.com", source: "footer" });
    expect(prisma.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: emailMatchWhere("Sam@Example.com"), orderBy: { createdAt: "asc" },
    }));
  });

  it("footer: a brand-new address becomes a brokerage Newsletter Subscriber lead and is welcomed", async () => {
    await subscribeToNewsletter({ email: "sam@example.com", source: "footer" });
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: {
        firstName: "Newsletter", lastName: "Subscriber", email: "sam@example.com",
        source: "NEWSLETTER", agentId: null, newsletterSubscribedAt: expect.any(Date),
      },
    });
    expect(sendNewsletterWelcome).toHaveBeenCalledWith({ to: "sam@example.com", leadId: "new-lead" });
  });

  it("footer: subscribes an existing lead in place and welcomes them at their stored address", async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([lead({ email: "Sam@Example.com" })] as any);
    await subscribeToNewsletter({ email: "sam@example.com", source: "footer" });
    expect(prisma.lead.create).not.toHaveBeenCalled();
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead-1" }, data: { newsletterSubscribedAt: expect.any(Date), newsletterOptOut: false },
    });
    expect(sendNewsletterWelcome).toHaveBeenCalledWith({ to: "Sam@Example.com", leadId: "lead-1" });
  });

  it("does nothing when the address is already subscribed on any lead (no duplicate, no second welcome)", async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([
      lead({ id: "old", newsletterSubscribedAt: new Date("2026-01-01") }),
      lead({ id: "new-contact" }),
    ] as any);
    await subscribeToNewsletter({ email: "SAM@example.com", source: "contact-form", leadId: "new-contact" });
    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.lead.create).not.toHaveBeenCalled();
    expect(sendNewsletterWelcome).not.toHaveBeenCalled();
  });

  it("footer: re-subscribes someone who left, keeping their join date, without a welcome", async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([
      lead({ newsletterSubscribedAt: new Date("2026-01-01"), newsletterOptOut: true }),
    ] as any);
    await subscribeToNewsletter({ email: "sam@example.com", source: "footer" });
    expect(prisma.lead.update).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { newsletterOptOut: false } });
    expect(sendNewsletterWelcome).not.toHaveBeenCalled();
  });

  it("contact form: never re-subscribes someone who unsubscribed", async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([
      lead({ id: "old", newsletterSubscribedAt: new Date("2026-01-01"), newsletterOptOut: true }),
      lead({ id: "new-contact" }),
    ] as any);
    await subscribeToNewsletter({ email: "sam@example.com", source: "contact-form", leadId: "new-contact" });
    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(sendNewsletterWelcome).not.toHaveBeenCalled();
  });

  it("contact form: subscribes the lead the form just created (an agent's lead stays the agent's)", async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([lead({ id: "older" }), lead({ id: "agents-lead" })] as any);
    await subscribeToNewsletter({ email: "sam@example.com", source: "contact-form", leadId: "agents-lead" });
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "agents-lead" }, data: { newsletterSubscribedAt: expect.any(Date), newsletterOptOut: false },
    });
    expect(sendNewsletterWelcome).toHaveBeenCalledWith({ to: "sam@example.com", leadId: "agents-lead" });
  });

  it("contact form: never creates a brokerage subscriber lead of its own", async () => {
    await subscribeToNewsletter({ email: "sam@example.com", source: "contact-form", leadId: "missing" });
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("does not throw when the welcome email fails", async () => {
    vi.mocked(sendNewsletterWelcome).mockRejectedValueOnce(new Error("postmark down"));
    await expect(subscribeToNewsletter({ email: "sam@example.com", source: "footer" })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web exec vitest run src/lib/newsletter.test.ts`
Expected: FAIL — cannot find module `./newsletter`.

- [ ] **Step 3: Implement `subscribeToNewsletter`**

Create `lib/newsletter.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { emailMatchWhere } from "@/lib/email-match";
import { sendSafely } from "@/lib/email/send-safely";
import { sendNewsletterWelcome } from "@/lib/email/newsletter-email";

export type NewsletterSignupSource = "footer" | "contact-form";

/**
 * The one place a newsletter subscription is created: the footer signup and
 * the contact forms (the /contact page, the shared contact pop-up and the
 * agent-profile form) all come through here.
 *
 * - One subscription per email address. Newsletter sends read subscribed
 *   leads, so two subscribed leads with one address would get every
 *   newsletter twice.
 * - Only the footer (an explicit signup) re-subscribes someone who left; a
 *   contact form's disclaimer never overrides an unsubscribe.
 * - A contact form subscribes the lead it just created (`leadId`), so a lead
 *   from an agent's profile page stays that agent's.
 * - The welcome email goes out only on a first subscription, and a failed
 *   send never fails the signup.
 */
export async function subscribeToNewsletter(opts: {
  email: string;
  source: NewsletterSignupSource;
  leadId?: string;
}): Promise<void> {
  const matches = await prisma.lead.findMany({
    where: emailMatchWhere(opts.email),
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, newsletterSubscribedAt: true, newsletterOptOut: true },
  });

  if (matches.some((m) => m.newsletterSubscribedAt && !m.newsletterOptOut)) return;

  const optedOut = matches.find((m) => m.newsletterOptOut);
  if (optedOut && opts.source === "contact-form") return;

  const target =
    optedOut ?? (opts.leadId ? matches.find((m) => m.id === opts.leadId) : matches[0]);

  const now = new Date();

  if (!target) {
    // Only a footer signup creates its own lead; a contact form always passes
    // the lead it just made.
    if (opts.source === "contact-form") return;
    const lead = await prisma.lead.create({
      data: {
        firstName: "Newsletter", lastName: "Subscriber", email: opts.email,
        source: "NEWSLETTER", agentId: null, newsletterSubscribedAt: now,
      },
    });
    await sendSafely(() => sendNewsletterWelcome({ to: opts.email, leadId: lead.id }));
    return;
  }

  const firstJoin = !target.newsletterSubscribedAt;
  await prisma.lead.update({
    where: { id: target.id },
    data: firstJoin ? { newsletterSubscribedAt: now, newsletterOptOut: false } : { newsletterOptOut: false },
  });
  if (firstJoin) await sendSafely(() => sendNewsletterWelcome({ to: target.email, leadId: target.id }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web exec vitest run src/lib/newsletter.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Move the footer route onto it (tests first)**

Replace `__tests__/api/newsletter-subscribe.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/rate-limit", () => ({ publicFormRateLimit: { limit: vi.fn() } }));
vi.mock("@/lib/newsletter", () => ({ subscribeToNewsletter: vi.fn().mockResolvedValue(undefined) }));

import { publicFormRateLimit } from "@/lib/rate-limit";
import { subscribeToNewsletter } from "@/lib/newsletter";
import { POST } from "../../app/api/newsletter/subscribe/route";

const subscribe = (email: string) =>
  POST(new Request("http://localhost/api/newsletter/subscribe", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
  }));

describe("POST /api/newsletter/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(publicFormRateLimit.limit).mockResolvedValue({ success: true, reset: Date.now() + 60000 } as any);
  });

  it("refuses an invalid email without subscribing anyone", async () => {
    const res = await subscribe("not an email");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Please enter a valid email address.");
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });

  it("subscribes the trimmed address as a footer signup and always answers ok", async () => {
    const res = await subscribe("  sam@example.com ");
    expect(await res.json()).toEqual({ ok: true });
    expect(subscribeToNewsletter).toHaveBeenCalledWith({ email: "sam@example.com", source: "footer" });
  });

  it("is rate limited like the other public forms", async () => {
    vi.mocked(publicFormRateLimit.limit).mockResolvedValue({ success: false, reset: Date.now() + 60000 } as any);
    const res = await subscribe("sam@example.com");
    expect(res.status).toBe(429);
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm --filter web exec vitest run src/__tests__/api/newsletter-subscribe.test.ts`
Expected: FAIL (route still does its own lookups, `subscribeToNewsletter` never called).

- [ ] **Step 6: Simplify the footer route**

Replace `app/api/newsletter/subscribe/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { publicFormRateLimit } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/form-validation";
import { subscribeToNewsletter } from "@/lib/newsletter";

// Footer newsletter signup (single opt-in). The subscription rules live in the
// shared subscribeToNewsletter(). Always answers { ok: true } for a valid
// email, so the form can't be used to check who's already in the system.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anonymous";
  const { success, reset } = await publicFormRateLimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } }
    );
  }

  let email = "";
  try {
    email = String((await req.json())?.email ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  await subscribeToNewsletter({ email, source: "footer" });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Run to verify both pass**

Run: `pnpm --filter web exec vitest run src/lib/newsletter.test.ts src/__tests__/api/newsletter-subscribe.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/newsletter.ts apps/web/src/lib/newsletter.test.ts apps/web/src/app/api/newsletter/subscribe/route.ts apps/web/src/__tests__/api/newsletter-subscribe.test.ts
git commit -m "refactor: shared subscribeToNewsletter() (one subscription per address; contact forms never override an unsubscribe)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Contact-form enrollment + shared disclaimer

**Files:**
- Create: `apps/web/src/components/ui/ContactConsentNotice.tsx`
- Modify: `apps/web/src/app/api/leads/route.ts` (POST)
- Modify: `apps/web/src/app/api/agents/[slug]/contact/route.ts`
- Modify: `apps/web/src/app/(marketing)/contact/page.tsx`
- Modify: `apps/web/src/components/ui/ContactModal.tsx`
- Modify: `apps/web/src/components/agents/AgentContactForm.tsx`
- Test: `apps/web/src/__tests__/api/leads.test.ts`
- Test: `apps/web/src/__tests__/api/agents-contact.test.ts`

**Interfaces:**
- Consumes: `subscribeToNewsletter({ email, source: "contact-form", leadId })` (Task 6).
- Produces: `POST /api/leads` accepts optional `newsletterConsent: true`; `ContactConsentNotice()` component.

- [ ] **Step 1: Write the failing POST /api/leads tests**

In `leads.test.ts` add, next to the other `vi.mock` calls:

```ts
vi.mock("@/lib/newsletter", () => ({ subscribeToNewsletter: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
```

import them (`import { subscribeToNewsletter } from "@/lib/newsletter";`), and append:

```ts
describe("POST /api/leads — newsletter consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({ session: null, error: null as any });
    vi.mocked(prisma.lead.create).mockResolvedValue({ id: "lead-9", email: "jane@example.com" } as any);
  });

  const submit = (extra: object) =>
    POST(makeRequest({ firstName: "Jane", lastName: "Doe", email: "jane@example.com", role: "Buyer", ...extra }));

  it("enrolls the new lead when the form shows the consent disclaimer", async () => {
    const res = await submit({ newsletterConsent: true });
    expect(res.status).toBe(201);
    expect(subscribeToNewsletter).toHaveBeenCalledWith({ email: "jane@example.com", leadId: "lead-9", source: "contact-form" });
    expect(prisma.lead.create).toHaveBeenCalledWith({ data: expect.not.objectContaining({ newsletterConsent: true }) });
  });

  it("does not enroll forms without the disclaimer (Let's Start, tour requests, Add Lead)", async () => {
    await submit({});
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });

  it("still accepts the inquiry when enrollment fails", async () => {
    vi.mocked(subscribeToNewsletter).mockRejectedValueOnce(new Error("db down"));
    const res = await submit({ newsletterConsent: true });
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 2: Write the failing agent-contact tests**

In `agents-contact.test.ts` add the same two `vi.mock` lines as Step 1 plus `import { subscribeToNewsletter } from '@/lib/newsletter';`, and append:

```ts
describe('POST /api/agents/[slug]/contact — newsletter', () => {
  beforeEach(() => vi.clearAllMocks());

  const send = () => POST(new Request('http://localhost/api/agents/ryan-chong/contact', {
    method: 'POST',
    body: JSON.stringify({ name: 'Jane Smith', email: ' jane@example.com ', phone: '', message: 'Hi' }),
    headers: { 'Content-Type': 'application/json' },
  }), { params: { slug: 'ryan-chong' } });

  it("enrolls the visitor into the newsletter on the agent's own lead", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: 'agent-1', slug: 'ryan-chong' } as any);
    vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead-7' } as any);
    const res = await send();
    expect(res.status).toBe(200);
    expect(subscribeToNewsletter).toHaveBeenCalledWith({ email: 'jane@example.com', leadId: 'lead-7', source: 'contact-form' });
  });

  it('still succeeds when enrollment fails', async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: 'agent-1', slug: 'ryan-chong' } as any);
    vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead-7' } as any);
    vi.mocked(subscribeToNewsletter).mockRejectedValueOnce(new Error('db down'));
    const res = await send();
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 3: Run to verify failures**

Run: `pnpm --filter web exec vitest run src/__tests__/api/leads.test.ts src/__tests__/api/agents-contact.test.ts`
Expected: new tests FAIL.

- [ ] **Step 4: Enroll from POST /api/leads**

In `app/api/leads/route.ts`: add imports `import * as Sentry from "@sentry/nextjs";` and `import { subscribeToNewsletter } from "@/lib/newsletter";`; add to `createSchema`: `newsletterConsent: z.literal(true).optional(),`; replace `const { role, ...leadFields } = data;` with `const { role, newsletterConsent, ...leadFields } = data;`; and immediately after `sendLeadNotification(lead).catch(console.error);` add:

```ts
    // Only the /contact page and the shared contact pop-up send this — both
    // show the consent disclaimer. A failed enrollment never fails the inquiry.
    if (newsletterConsent) {
      await subscribeToNewsletter({ email: lead.email, leadId: lead.id, source: "contact-form" }).catch((err) =>
        Sentry.captureException(err)
      );
    }
```

- [ ] **Step 5: Enroll from the agent-profile contact route**

In `app/api/agents/[slug]/contact/route.ts`: add the same two imports as Step 4, and immediately after `sendLeadNotification(lead).catch(console.error);` add:

```ts
    // The agent-profile form shows the consent disclaimer. Subscribes this new
    // lead, so the visitor stays the agent's lead. Never fails the inquiry.
    await subscribeToNewsletter({ email: (email as string).trim(), leadId: lead.id, source: "contact-form" }).catch((err) =>
      Sentry.captureException(err)
    );
```

- [ ] **Step 6: Run to verify they pass**

Run: `pnpm --filter web exec vitest run src/__tests__/api/leads.test.ts src/__tests__/api/agents-contact.test.ts`
Expected: PASS.

- [ ] **Step 7: Create the shared disclaimer**

Create `components/ui/ContactConsentNotice.tsx`:

```tsx
// The newsletter consent line shown above the submit button of every contact
// form that enrolls visitors (the /contact page, the shared contact pop-up and
// the agent-profile form). One place for the wording.
export function ContactConsentNotice() {
  return (
    <p className="font-sans text-xs leading-relaxed text-[#1B1B1B]/50">
      By submitting, I agree to be contacted by CnC Realty for real estate services or news (unsubscribe anytime via email).
    </p>
  );
}
```

- [ ] **Step 8: Add it to the three forms and send consent**

1. `app/(marketing)/contact/page.tsx`: add `import { ContactConsentNotice } from "@/components/ui/ContactConsentNotice";`; change `body: JSON.stringify({ ...form, source: "WEBSITE" }),` to `body: JSON.stringify({ ...form, source: "WEBSITE", newsletterConsent: true }),`; insert `<ContactConsentNotice />` on the line directly before `<motion.button type="submit"`.
2. `components/ui/ContactModal.tsx`: add the same import; change `body: JSON.stringify({ ...form, source: "WEBSITE", utmSource: source }),` to `body: JSON.stringify({ ...form, source: "WEBSITE", utmSource: source, newsletterConsent: true }),`; insert `<ContactConsentNotice />` directly before `<motion.button type="submit"`.
3. `components/agents/AgentContactForm.tsx`: add the same import; insert `<ContactConsentNotice />` directly before the `<button type="submit"` element. (The route always enrolls; no body change.)

- [ ] **Step 9: Types, lint, full tests**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web exec vitest run`
Expected: 0 type errors; full suite PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/ui/ContactConsentNotice.tsx apps/web/src/app/api/leads/route.ts "apps/web/src/app/api/agents/[slug]/contact/route.ts" "apps/web/src/app/(marketing)/contact/page.tsx" apps/web/src/components/ui/ContactModal.tsx apps/web/src/components/agents/AgentContactForm.tsx apps/web/src/__tests__/api/leads.test.ts apps/web/src/__tests__/api/agents-contact.test.ts
git commit -m "feat: contact page, contact pop-up and agent-profile form enroll visitors in the newsletter with a consent notice

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Final verification

**Files:** none changed (verification only).

- [ ] **Step 1: Full gate**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit && pnpm --filter web exec eslint src --quiet 2>&1 | tail -3`
Expected: all tests pass; 0 type errors; lint error count not higher than before this plan (record both numbers).

- [ ] **Step 2: Production build**

Stop the dev server properly (stop the task, then confirm with `Get-NetTCPConnection -LocalPort 3000` that the Next process is gone; if one remains, verify its command line contains `CnC-Realty` and `next` before stopping it), then: `rm -rf apps/web/.next && pnpm --filter web build`. Expected: exit 0, "Compiled successfully". Restart the dev server.

- [ ] **Step 3: Dashboard speed check (admin account)**

With Puppeteer logged in as the admin account, time a load of Overview, Leads, Pipeline, Tasks and Campaigns (Agent section) and compare to the same pages measured before starting Task 1. Expected: no page slower.

- [ ] **Step 4: Browser pass with Ryan**

Ryan checks on localhost:3000 (Claude verifies the database after each):
1. Agent-section tabs show only his own data; Admin → Overview still brokerage-wide.
2. Leads → "Newsletter" list shows the test subscriber; an agent login has no such list.
3. All Leads → Assign on the subscriber row → pick himself → the row shows him; the Unassigned tab is unchanged.
4. Export CSV looks like "New Listing".
5. /contact, a contact pop-up (e.g. on /sell) and an agent profile form all show the disclaimer; a submission with a new test address enrolls it and sends the welcome email; an agent-profile submission's lead stays with that agent.
