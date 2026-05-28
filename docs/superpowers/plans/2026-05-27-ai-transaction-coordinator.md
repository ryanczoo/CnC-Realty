# AI-Assisted Transaction Coordinator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate the administrative burden of transaction coordination so agents get deadline reminders automatically and the broker (Ryan) can fulfill DRE supervision obligations from a single admin view.

**Architecture:** Three additions to the existing CRM — (1) a Vercel Cron job that runs daily, reads upcoming deadlines from the `Transaction` table, and sends reminder emails via SendGrid; (2) an in-app alert banner on the agent dashboard that surfaces deadlines without requiring email; (3) a broker supervision panel in `/admin` that shows all open transactions with deadlines across every agent. No new third-party services — runs entirely on Railway (PostgreSQL), Vercel Cron (already configured in `vercel.json`), and SendGrid (already wired in `lib/email.ts`).

**Tech Stack:** Next.js 14 App Router, Prisma ORM, SendGrid (`@sendgrid/mail`), Vercel Cron, TypeScript, Tailwind CSS, shadcn/ui

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/app/api/transactions/deadlines/route.ts` | GET endpoint — returns upcoming deadlines for the authed agent (or all agents for ADMIN) |
| Create | `src/app/api/cron/deadline-reminders/route.ts` | POST endpoint called by Vercel Cron — queries deadlines 1 and 3 days out, sends SendGrid emails |
| Create | `src/lib/deadline-email.ts` | Builds and sends deadline reminder emails via SendGrid |
| Modify | `vercel.json` | Add cron entry for daily deadline reminder job |
| Create | `src/components/dashboard/DeadlineAlerts.tsx` | Client component — fetches `/api/transactions/deadlines`, renders alert banner |
| Modify | `src/app/(dashboard)/dashboard/page.tsx` | Import and render `<DeadlineAlerts />` at top of agent dashboard |
| Modify | `src/app/(dashboard)/dashboard/layout.tsx` | No change needed — alerts live inside the page |
| Modify | `src/app/(admin)/admin/page.tsx` | Add broker supervision panel showing all open transactions with upcoming deadlines |
| Create | `src/__tests__/api/deadline-reminders.test.ts` | Tests for the cron endpoint (auth, correct date window, SendGrid call) |
| Create | `src/__tests__/api/deadlines.test.ts` | Tests for the GET deadlines endpoint (agent scoping, ADMIN bypass) |

---

## Task 1: GET /api/transactions/deadlines endpoint

**Files:**
- Create: `src/app/api/transactions/deadlines/route.ts`
- Test: `src/__tests__/api/deadlines.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/api/deadlines.test.ts
import { GET } from "@/app/api/transactions/deadlines/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/prisma", () => ({ prisma: { transaction: { findMany: jest.fn() } } }));
jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";

const mockSession = (role: string, id: string) => ({ user: { id, role, email: "a@b.com" } });

describe("GET /api/transactions/deadlines", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/transactions/deadlines"));
    expect(res.status).toBe(401);
  });

  it("returns deadlines scoped to agent userId", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession("AGENT", "user-1"));
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
      { id: "t1", address: "123 Main St", closeOfEscrow: new Date("2026-05-30"), inspectionDeadline: null, appraisalDeadline: null, loanApprovalDeadline: null, status: "ACTIVE" }
    ]);
    const res = await GET(new NextRequest("http://localhost/api/transactions/deadlines"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deadlines).toHaveLength(1);
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ agentId: "user-1" }) })
    );
  });

  it("returns deadlines for ALL agents when ADMIN", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession("ADMIN", "admin-1"));
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
    await GET(new NextRequest("http://localhost/api/transactions/deadlines"));
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ agentId: expect.anything() }) })
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter web test src/__tests__/api/deadlines.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement the endpoint**

```typescript
// src/app/api/transactions/deadlines/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEADLINE_WINDOW_DAYS = 7;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + DEADLINE_WINDOW_DAYS);

  const where = {
    status: { not: "CLOSED" as const },
    OR: [
      { closeOfEscrow: { gte: new Date(), lte: cutoff } },
      { inspectionDeadline: { gte: new Date(), lte: cutoff } },
      { appraisalDeadline: { gte: new Date(), lte: cutoff } },
      { loanApprovalDeadline: { gte: new Date(), lte: cutoff } },
    ],
    ...(session.user.role !== "ADMIN" && { agentId: session.user.id }),
  };

  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      id: true,
      address: true,
      status: true,
      closeOfEscrow: true,
      inspectionDeadline: true,
      appraisalDeadline: true,
      loanApprovalDeadline: true,
      agent: { select: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { closeOfEscrow: "asc" },
    take: 50,
  });

  const deadlines = transactions.flatMap((t) =>
    [
      { label: "Close of Escrow", date: t.closeOfEscrow },
      { label: "Inspection", date: t.inspectionDeadline },
      { label: "Appraisal", date: t.appraisalDeadline },
      { label: "Loan Approval", date: t.loanApprovalDeadline },
    ]
      .filter((d) => d.date && d.date >= new Date() && d.date <= cutoff)
      .map((d) => ({
        transactionId: t.id,
        address: t.address,
        label: d.label,
        date: d.date,
        agentName: t.agent?.user?.name ?? null,
        agentEmail: t.agent?.user?.email ?? null,
        daysOut: Math.ceil((d.date!.getTime() - Date.now()) / 86_400_000),
      }))
  );

  return NextResponse.json({ deadlines });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter web test src/__tests__/api/deadlines.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/transactions/deadlines/route.ts src/__tests__/api/deadlines.test.ts
git commit -m "feat: GET /api/transactions/deadlines — upcoming deadlines scoped by role"
```

---

## Task 2: SendGrid deadline email helper

**Files:**
- Create: `src/lib/deadline-email.ts`

- [ ] **Step 1: Implement the email helper**

No test needed — this is a thin SendGrid wrapper with no logic to test independently. The cron endpoint test (Task 3) will cover it via mock.

```typescript
// src/lib/deadline-email.ts
import sgMail from "@sendgrid/mail";
import { FROM } from "@/lib/email";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export interface DeadlineReminder {
  agentEmail: string;
  agentName: string | null;
  address: string;
  label: string;
  date: Date;
  daysOut: number;
}

export async function sendDeadlineReminder(reminder: DeadlineReminder): Promise<void> {
  const dayWord = reminder.daysOut === 1 ? "tomorrow" : `in ${reminder.daysOut} days`;
  await sgMail.send({
    to: reminder.agentEmail,
    from: FROM,
    subject: `Deadline reminder: ${reminder.label} for ${reminder.address}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
        <h2 style="color:#1B1B1B">Upcoming Deadline — CnC Realty</h2>
        <p>Hi ${reminder.agentName ?? "there"},</p>
        <p>This is a reminder that the <strong>${reminder.label}</strong> deadline for
           <strong>${reminder.address}</strong> is <strong>${dayWord}</strong>
           (${reminder.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}).</p>
        <p>Log in to your dashboard to review the transaction details.</p>
        <a href="https://cncrealtygroup.com/dashboard/transactions"
           style="display:inline-block;margin-top:16px;padding:12px 24px;background:#9E8C61;color:#fff;border-radius:999px;text-decoration:none;font-weight:500">
          View Transaction
        </a>
        <p style="margin-top:32px;color:#999;font-size:12px">CnC Realty Group · Los Angeles, CA · CA DRE #02439028</p>
      </div>
    `,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/deadline-email.ts
git commit -m "feat: sendDeadlineReminder email helper via SendGrid"
```

---

## Task 3: Cron job endpoint — daily deadline reminder emails

**Files:**
- Create: `src/app/api/cron/deadline-reminders/route.ts`
- Modify: `vercel.json`
- Test: `src/__tests__/api/deadline-reminders.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/api/deadline-reminders.test.ts
import { POST } from "@/app/api/cron/deadline-reminders/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/prisma", () => ({ prisma: { transaction: { findMany: jest.fn() } } }));
jest.mock("@/lib/deadline-email", () => ({ sendDeadlineReminder: jest.fn() }));

import { prisma } from "@/lib/prisma";
import { sendDeadlineReminder } from "@/lib/deadline-email";

const validSecret = "7f3a9c2e8b1d4f6a0e5c7b3d9f2a8e1c4b6d0f3a9c2e8b1d4f6a0e5c7b3d9f2";
process.env.CRON_SECRET = validSecret;

const makeReq = (secret?: string) =>
  new NextRequest("http://localhost/api/cron/deadline-reminders", {
    method: "POST",
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });

describe("POST /api/cron/deadline-reminders", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 with wrong secret", async () => {
    const res = await POST(makeReq("wrong"));
    expect(res.status).toBe(401);
  });

  it("sends no emails when no deadlines fall in 1 or 3 day window", async () => {
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
    const res = await POST(makeReq(validSecret));
    expect(res.status).toBe(200);
    expect(sendDeadlineReminder).not.toHaveBeenCalled();
  });

  it("sends emails for each deadline in the 1-day and 3-day windows", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
      {
        id: "t1",
        address: "123 Main St",
        closeOfEscrow: tomorrow,
        inspectionDeadline: null,
        appraisalDeadline: null,
        loanApprovalDeadline: null,
        agent: { user: { name: "Test Agent", email: "agent@test.com" } },
      },
    ]);
    const res = await POST(makeReq(validSecret));
    expect(res.status).toBe(200);
    expect(sendDeadlineReminder).toHaveBeenCalledTimes(1);
    expect(sendDeadlineReminder).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Close of Escrow", agentEmail: "agent@test.com" })
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter web test src/__tests__/api/deadline-reminders.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement the cron endpoint**

```typescript
// src/app/api/cron/deadline-reminders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDeadlineReminder } from "@/lib/deadline-email";

export const maxDuration = 60;

const REMIND_AT_DAYS = [1, 3];

function startOfDay(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateWindows = REMIND_AT_DAYS.flatMap((d) => [
    { gte: startOfDay(d), lte: endOfDay(d) },
  ]);

  const orConditions = dateWindows.flatMap((window) => [
    { closeOfEscrow: window },
    { inspectionDeadline: window },
    { appraisalDeadline: window },
    { loanApprovalDeadline: window },
  ]);

  const transactions = await prisma.transaction.findMany({
    where: { status: { not: "CLOSED" }, OR: orConditions },
    select: {
      id: true,
      address: true,
      closeOfEscrow: true,
      inspectionDeadline: true,
      appraisalDeadline: true,
      loanApprovalDeadline: true,
      agent: { select: { user: { select: { name: true, email: true } } } },
    },
    take: 200,
  });

  const now = Date.now();
  const reminders = transactions.flatMap((t) =>
    [
      { label: "Close of Escrow", date: t.closeOfEscrow },
      { label: "Inspection", date: t.inspectionDeadline },
      { label: "Appraisal", date: t.appraisalDeadline },
      { label: "Loan Approval", date: t.loanApprovalDeadline },
    ]
      .filter((d) => {
        if (!d.date || !t.agent?.user?.email) return false;
        const daysOut = Math.round((d.date.getTime() - now) / 86_400_000);
        return REMIND_AT_DAYS.includes(daysOut);
      })
      .map((d) => ({
        agentEmail: t.agent!.user!.email!,
        agentName: t.agent!.user!.name,
        address: t.address ?? "Unknown address",
        label: d.label,
        date: d.date!,
        daysOut: Math.round((d.date!.getTime() - now) / 86_400_000),
      }))
  );

  await Promise.allSettled(reminders.map(sendDeadlineReminder));

  return NextResponse.json({ sent: reminders.length });
}
```

- [ ] **Step 4: Add cron entry to vercel.json**

Open `vercel.json`. Add to the `crons` array:

```json
{ "path": "/api/cron/deadline-reminders", "schedule": "0 16 * * *" }
```

`0 16 * * *` = 9am Pacific (UTC-7) every day. The full `crons` array should now look like:

```json
"crons": [
  { "path": "/api/idx/sync", "schedule": "*/15 * * * *" },
  { "path": "/api/property-alerts/run", "schedule": "0 16 * * *" },
  { "path": "/api/cron/deadline-reminders", "schedule": "0 16 * * *" }
]
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm --filter web test src/__tests__/api/deadline-reminders.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/deadline-reminders/route.ts src/__tests__/api/deadline-reminders.test.ts vercel.json
git commit -m "feat: daily deadline reminder cron — sends SendGrid emails 1 and 3 days before deadlines"
```

---

## Task 4: In-app deadline alerts banner on agent dashboard

**Files:**
- Create: `src/components/dashboard/DeadlineAlerts.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Implement the DeadlineAlerts component**

```typescript
// src/components/dashboard/DeadlineAlerts.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Deadline {
  transactionId: string;
  address: string;
  label: string;
  date: string;
  daysOut: number;
}

export function DeadlineAlerts() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);

  useEffect(() => {
    fetch("/api/transactions/deadlines")
      .then((r) => r.json())
      .then((data) => setDeadlines(data.deadlines ?? []));
  }, []);

  if (deadlines.length === 0) return null;

  const urgent = deadlines.filter((d) => d.daysOut <= 1);
  const upcoming = deadlines.filter((d) => d.daysOut > 1);

  return (
    <div className="mb-6 space-y-2">
      {urgent.map((d, i) => (
        <Link
          key={i}
          href={`/dashboard/transactions/${d.transactionId}`}
          className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 transition-opacity hover:opacity-80"
        >
          <span>
            <strong>{d.label}</strong> deadline for{" "}
            <strong>{d.address}</strong> is{" "}
            {d.daysOut === 0 ? "today" : "tomorrow"}
          </span>
          <span className="ml-4 shrink-0 text-xs text-red-500">View →</span>
        </Link>
      ))}
      {upcoming.map((d, i) => (
        <Link
          key={i}
          href={`/dashboard/transactions/${d.transactionId}`}
          className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 transition-opacity hover:opacity-80"
        >
          <span>
            <strong>{d.label}</strong> deadline for{" "}
            <strong>{d.address}</strong> in {d.daysOut} days
          </span>
          <span className="ml-4 shrink-0 text-xs text-amber-500">View →</span>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add DeadlineAlerts to the agent dashboard page**

Open `src/app/(dashboard)/dashboard/page.tsx`. Import and render `<DeadlineAlerts />` at the top of the page content, before the stats cards:

```typescript
import { DeadlineAlerts } from "@/components/dashboard/DeadlineAlerts";

// Inside the returned JSX, before <StatsCards /> or whatever is first:
<DeadlineAlerts />
```

- [ ] **Step 3: Manually verify in browser**

1. Run `pnpm --filter web dev`
2. Log in as an agent at `localhost:3000/login`
3. Navigate to `/dashboard`
4. If you have a transaction with a deadline within 7 days: the alert banner appears
5. If not: create a test transaction with `closeOfEscrow` set to tomorrow, then reload

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/DeadlineAlerts.tsx src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat: in-app deadline alert banners on agent dashboard"
```

---

## Task 5: Broker supervision panel in admin dashboard

**Files:**
- Modify: `src/app/(admin)/admin/page.tsx`

- [ ] **Step 1: Add the supervision panel to the admin overview page**

Open `src/app/(admin)/admin/page.tsx`. After the existing stats cards section, add a new section that fetches and displays open transactions with upcoming deadlines across all agents.

Add to the existing server-side data fetching at the top of the component (alongside existing `prisma` calls):

```typescript
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() + 7);

const openTransactionsWithDeadlines = await prisma.transaction.findMany({
  where: {
    status: { not: "CLOSED" },
    OR: [
      { closeOfEscrow: { gte: new Date(), lte: cutoff } },
      { inspectionDeadline: { gte: new Date(), lte: cutoff } },
      { appraisalDeadline: { gte: new Date(), lte: cutoff } },
      { loanApprovalDeadline: { gte: new Date(), lte: cutoff } },
    ],
  },
  select: {
    id: true,
    address: true,
    closeOfEscrow: true,
    inspectionDeadline: true,
    appraisalDeadline: true,
    loanApprovalDeadline: true,
    agent: { select: { user: { select: { name: true, email: true } } } },
  },
  orderBy: { closeOfEscrow: "asc" },
  take: 100,
}).catch(() => []);
```

Add the supervision panel JSX after the existing stats cards section:

```tsx
{/* Broker Supervision — Upcoming Deadlines */}
<div className="mt-10">
  <h2 className="mb-4 text-lg font-medium text-[#1B1B1B]">Upcoming Deadlines (Next 7 Days)</h2>
  {openTransactionsWithDeadlines.length === 0 ? (
    <p className="text-sm text-[#1B1B1B]/50">No deadlines in the next 7 days.</p>
  ) : (
    <div className="overflow-hidden rounded-xl border border-[#1B1B1B]/10">
      <table className="w-full text-sm">
        <thead className="bg-[#F2F0EF] text-left text-xs uppercase tracking-wider text-[#1B1B1B]/50">
          <tr>
            <th className="px-4 py-3">Property</th>
            <th className="px-4 py-3">Agent</th>
            <th className="px-4 py-3">Deadline</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Days Out</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1B1B1B]/5 bg-white">
          {openTransactionsWithDeadlines.flatMap((t) =>
            [
              { label: "Close of Escrow", date: t.closeOfEscrow },
              { label: "Inspection", date: t.inspectionDeadline },
              { label: "Appraisal", date: t.appraisalDeadline },
              { label: "Loan Approval", date: t.loanApprovalDeadline },
            ]
              .filter((d) => d.date && d.date >= new Date() && d.date <= cutoff)
              .map((d, idx) => {
                const daysOut = Math.ceil((d.date!.getTime() - Date.now()) / 86_400_000);
                return (
                  <tr key={`${t.id}-${idx}`} className="hover:bg-[#F2F0EF]/50">
                    <td className="px-4 py-3 font-medium text-[#1B1B1B]">
                      <a href={`/admin/transactions/${t.id}`} className="hover:underline">
                        {t.address ?? "—"}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-[#1B1B1B]/70">
                      {t.agent?.user?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[#1B1B1B]/70">
                      {d.date!.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-[#1B1B1B]/70">{d.label}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        daysOut <= 1 ? "bg-red-100 text-red-700" :
                        daysOut <= 3 ? "bg-amber-100 text-amber-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {daysOut === 0 ? "Today" : daysOut === 1 ? "Tomorrow" : `${daysOut} days`}
                      </span>
                    </td>
                  </tr>
                );
              })
          )}
        </tbody>
      </table>
    </div>
  )}
</div>
```

- [ ] **Step 2: Manually verify in browser**

1. Run `pnpm --filter web dev`
2. Log in as ADMIN at `localhost:3000/login`
3. Navigate to `/admin`
4. Confirm the "Upcoming Deadlines" table appears below the stats cards
5. Create a test transaction with a deadline within 7 days to verify a row appears

- [ ] **Step 3: Commit**

```bash
git add src/app/(admin)/admin/page.tsx
git commit -m "feat: broker supervision panel in /admin — all open transactions with upcoming deadlines"
```

---

## Self-Review

**Spec coverage:**
- ✅ Automated deadline email reminders (1-day and 3-day) via SendGrid + Vercel Cron — Task 3
- ✅ In-app dashboard alert banners for agents — Task 4
- ✅ Broker supervision view in `/admin` — Task 5
- ✅ No new third-party services — all tasks use Railway, Vercel Cron, SendGrid
- ✅ GET endpoint for deadlines (scoped by role) — Task 1
- ✅ SendGrid email helper — Task 2

**Placeholder scan:** None found — all tasks contain complete code.

**Type consistency:**
- `Deadline` interface in `DeadlineAlerts.tsx` matches shape returned by `GET /api/transactions/deadlines`
- `sendDeadlineReminder` parameter type `DeadlineReminder` matches what the cron endpoint constructs
- Prisma `transaction.findMany` select shapes are consistent across Task 1, Task 3, and Task 5
