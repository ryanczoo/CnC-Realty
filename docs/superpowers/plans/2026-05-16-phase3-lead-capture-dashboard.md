# Phase 3 — Lead Capture & Agent Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire public forms to create Leads in the database, send email notifications to info@cncrealtygroup.com, and build the agent dashboard with a Kanban lead pipeline and lead detail page.

**Architecture:** Public forms POST to `/api/leads` (unauthenticated), which validates with Zod, persists to Postgres via Prisma, and fires a SendGrid email. The agent dashboard is a protected route group with a sidebar layout; it fetches leads from `/api/leads` (authenticated) and renders a drag-and-drop Kanban via @dnd-kit. Lead detail shows an activity feed and an add-note form that hits `/api/leads/[id]/activities`.

**Tech Stack:** Next.js 14 App Router, Prisma (PostgreSQL on Railway), NextAuth JWT sessions, Zod validation, SendGrid (`@sendgrid/mail`), @dnd-kit/core + @dnd-kit/sortable, Tailwind CSS, Lucide React icons.

---

## File Map

**Create:**
- `apps/web/src/lib/email.ts` — SendGrid wrapper (send lead notification email)
- `apps/web/src/lib/api-auth.ts` — typed session helper for API routes
- `apps/web/src/app/api/leads/route.ts` — POST (public create) + GET (agent list)
- `apps/web/src/app/api/leads/[id]/route.ts` — GET + PATCH (single lead)
- `apps/web/src/app/api/leads/[id]/activities/route.ts` — POST (add note/activity)
- `apps/web/src/app/(marketing)/contact/page.tsx` — Contact form page → POST /api/leads
- `apps/web/src/app/(dashboard)/layout.tsx` — Dashboard shell with sidebar
- `apps/web/src/app/(dashboard)/dashboard/page.tsx` — Dashboard home with StatsCards
- `apps/web/src/components/dashboard/StatsCard.tsx` — Single stat display card
- `apps/web/src/app/(dashboard)/dashboard/leads/page.tsx` — Kanban board page (server, fetches leads)
- `apps/web/src/components/dashboard/LeadKanban.tsx` — Client Kanban with dnd-kit
- `apps/web/src/components/dashboard/LeadCard.tsx` — Draggable lead card
- `apps/web/src/app/(dashboard)/dashboard/leads/[id]/page.tsx` — Lead detail page
- `apps/web/src/components/dashboard/ActivityFeed.tsx` — Timeline of activities
- `apps/web/src/components/dashboard/AddNoteForm.tsx` — Client form to add note

**Modify:**
- `apps/web/src/components/home/ServicesSection.tsx` — Convert "Let's Start" from `href="/sell"` to a modal that POSTs to /api/leads
- `apps/web/.env.local` — Add `SENDGRID_API_KEY` (user adds manually)

---

## Task 1: Install Dependencies

- [ ] **Step 1: Install packages**

```bash
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm --filter web add @sendgrid/mail zod @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
pnpm --filter web add -D @types/sendgrid__mail
```

- [ ] **Step 2: Add env variable**

Open `apps/web/.env.local` and add:
```
SENDGRID_API_KEY=your_key_here
```
(User provides actual key from sendgrid.com dashboard)

- [ ] **Step 3: Verify install**

```bash
pnpm --filter web run build
```
Expected: build succeeds (same as before, new packages just added).

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore: install sendgrid, zod, dnd-kit for Phase 3"
```

---

## Task 2: Email Utility

**Files:**
- Create: `apps/web/src/lib/email.ts`

- [ ] **Step 1: Create the email helper**

```typescript
// apps/web/src/lib/email.ts
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const FROM = "noreply@cncrealtygroup.com";
const NOTIFY = "info@cncrealtygroup.com";

export async function sendLeadNotification(lead: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
}) {
  await sgMail.send({
    to: NOTIFY,
    from: FROM,
    subject: `New Lead: ${lead.firstName} ${lead.lastName}`,
    html: `
      <h2>New lead from cncrealtygroup.com</h2>
      <p><strong>Name:</strong> ${lead.firstName} ${lead.lastName}</p>
      <p><strong>Email:</strong> ${lead.email}</p>
      ${lead.phone ? `<p><strong>Phone:</strong> ${lead.phone}</p>` : ""}
      ${lead.notes ? `<p><strong>Message:</strong> ${lead.notes}</p>` : ""}
    `,
  });
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm --filter web exec tsc --noEmit 2>&1 | head -20
```
Expected: no new errors related to `email.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/email.ts
git commit -m "feat: add SendGrid email utility for lead notifications"
```

---

## Task 3: API Auth Helper

**Files:**
- Create: `apps/web/src/lib/api-auth.ts`

- [ ] **Step 1: Create the helper**

```typescript
// apps/web/src/lib/api-auth.ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

type Role = "BUYER" | "AGENT" | "ADMIN";

interface AuthedSession {
  user: { id: string; email: string; name?: string | null; role: Role };
}

export async function requireAuth(minRole?: "AGENT" | "ADMIN"): Promise<
  | { session: AuthedSession; error: null }
  | { session: null; error: NextResponse }
> {
  const raw = await getServerSession(authOptions);
  if (!raw?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const session = raw as unknown as AuthedSession;
  const role = session.user.role;

  if (minRole === "AGENT" && role !== "AGENT" && role !== "ADMIN") {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (minRole === "ADMIN" && role !== "ADMIN") {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session, error: null };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/api-auth.ts
git commit -m "feat: add typed API auth helper"
```

---

## Task 4: POST + GET /api/leads

**Files:**
- Create: `apps/web/src/app/api/leads/route.ts`

- [ ] **Step 1: Create the route handler**

```typescript
// apps/web/src/app/api/leads/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { sendLeadNotification } from "@/lib/email";

const createSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(["WEBSITE", "REFERRAL", "SOCIAL", "OPEN_HOUSE", "COLD_CALL", "OTHER"]).default("WEBSITE"),
});

// Public — no auth required. Anyone can submit a lead.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const lead = await prisma.lead.create({ data });

    // Fire-and-forget — don't fail the request if email fails
    sendLeadNotification(lead).catch(console.error);

    return NextResponse.json({ id: lead.id }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Agents see their own leads; ADMIN sees all leads.
export async function GET() {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { id: userId, role } = session.user;

  if (role === "ADMIN") {
    const leads = await prisma.lead.findMany({
      include: { agent: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(leads);
  }

  const agent = await prisma.agent.findUnique({ where: { userId } });
  if (!agent) return NextResponse.json([]);

  const leads = await prisma.lead.findMany({
    where: { agentId: agent.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(leads);
}
```

- [ ] **Step 2: Manual verify — POST creates a lead**

With the dev server running, open a terminal and run:
```bash
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@example.com","notes":"Hello"}'
```
Expected: `{"id":"clxxx..."}` with status 201. Check Railway DB or Prisma Studio for the new row.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/leads/route.ts
git commit -m "feat: POST /api/leads (public create) + GET (agent list)"
```

---

## Task 5: GET + PATCH /api/leads/[id]

**Files:**
- Create: `apps/web/src/app/api/leads/[id]/route.ts`

- [ ] **Step 1: Create the route handler**

```typescript
// apps/web/src/app/api/leads/[id]/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const patchSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "SHOWING", "OFFER", "UNDER_CONTRACT", "CLOSED", "LOST"]).optional(),
  notes: z.string().optional(),
  score: z.number().int().min(0).max(100).optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("AGENT");
  if (error) return error;

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: { activities: { orderBy: { createdAt: "desc" } } },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(lead);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("AGENT");
  if (error) return error;

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const lead = await prisma.lead.update({ where: { id: params.id }, data });
    return NextResponse.json(lead);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/leads/[id]/route.ts
git commit -m "feat: GET + PATCH /api/leads/[id]"
```

---

## Task 6: POST /api/leads/[id]/activities

**Files:**
- Create: `apps/web/src/app/api/leads/[id]/activities/route.ts`

- [ ] **Step 1: Create the route handler**

```typescript
// apps/web/src/app/api/leads/[id]/activities/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const schema = z.object({
  type: z.enum(["NOTE", "CALL", "EMAIL", "SHOWING", "OFFER", "DOCUMENT"]).default("NOTE"),
  content: z.string().min(1, "Content required"),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAuth("AGENT");
  if (error) return error;

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const activity = await prisma.activity.create({
      data: { ...data, leadId: params.id },
    });
    return NextResponse.json(activity, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/leads/[id]/activities/route.ts
git commit -m "feat: POST /api/leads/[id]/activities"
```

---

## Task 7: Contact Page `/contact`

**Files:**
- Create: `apps/web/src/app/(marketing)/contact/page.tsx`

- [ ] **Step 1: Create the contact page**

```tsx
// apps/web/src/app/(marketing)/contact/page.tsx
"use client";
import { useState } from "react";

export default function ContactPage() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", notes: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "WEBSITE" }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
      setForm({ firstName: "", lastName: "", email: "", phone: "", notes: "" });
    } catch {
      setStatus("error");
    }
  }

  const field = (name: keyof typeof form, label: string, type = "text", required = false) => (
    <div className="flex flex-col gap-1.5">
      <label className="font-sans text-sm text-[#1B1B1B]/60">{label}{required && " *"}</label>
      <input
        type={type}
        required={required}
        value={form[name]}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        className="border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
      />
    </div>
  );

  return (
    <main className="min-h-screen bg-[#F2F0EF] px-8 pb-24 pt-32 lg:px-20">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-2 font-sans text-[3rem] font-light leading-tight text-[#1B1B1B]">
          Get in touch.
        </h1>
        <p className="mb-12 font-sans text-base text-[#1B1B1B]/50">
          Send us a message and a CnC agent will reach out within 24 hours.
        </p>

        {status === "success" ? (
          <div className="rounded-2xl bg-white p-8 text-center">
            <p className="font-sans text-lg font-light text-[#1B1B1B]">Message received.</p>
            <p className="mt-2 font-sans text-sm text-[#1B1B1B]/50">We&apos;ll be in touch soon.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            <div className="grid grid-cols-2 gap-6">
              {field("firstName", "First Name", "text", true)}
              {field("lastName", "Last Name", "text", true)}
            </div>
            {field("email", "Email", "email", true)}
            {field("phone", "Phone (optional)")}
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-sm text-[#1B1B1B]/60">Message</label>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="resize-none border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
              />
            </div>
            {status === "error" && (
              <p className="font-sans text-sm text-red-500">Something went wrong. Please try again.</p>
            )}
            <button
              type="submit"
              disabled={status === "loading"}
              className="self-start rounded-full bg-[#1B1B1B] px-8 py-3.5 font-sans text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {status === "loading" ? "Sending…" : "Send Message"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Manual verify**

Run dev server. Navigate to `localhost:3000/contact`. Fill out the form and submit. Expected: success message shown, lead appears in DB, email sent to info@cncrealtygroup.com.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(marketing\)/contact/page.tsx
git commit -m "feat: contact page wired to POST /api/leads"
```

---

## Task 8: Services "Let's Start" Lead Capture Modal

**Files:**
- Modify: `apps/web/src/components/home/ServicesSection.tsx`

The current code has `<motion.a href="/sell" ...>Let&apos;s Start</motion.a>`. Replace with a modal overlay that collects name/email/phone/deal type and POSTs to /api/leads.

- [ ] **Step 1: Add modal state and UI to ServicesSection**

At the top of the `ServicesSection` component function body, add:

```tsx
const [modalOpen, setModalOpen] = useState(false);
const [modalForm, setModalForm] = useState({ firstName: "", lastName: "", email: "", phone: "", dealType: "Buy" });
const [modalStatus, setModalStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

async function handleModalSubmit(e: React.FormEvent) {
  e.preventDefault();
  setModalStatus("loading");
  try {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...modalForm, notes: `Deal type: ${modalForm.dealType}`, source: "WEBSITE" }),
    });
    if (!res.ok) throw new Error();
    setModalStatus("success");
  } catch {
    setModalStatus("error");
  }
}
```

- [ ] **Step 2: Replace the "Let's Start" button**

Find:
```tsx
<motion.a
  href="/sell"
  whileHover={{ scale: 1.1 }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
  className="ml-auto mt-6 flex w-fit items-center rounded-full bg-[#1B1B1B] px-7 py-3.5 text-sm font-medium text-white"
>
  Let&apos;s Start
</motion.a>
```

Replace with:
```tsx
<motion.button
  onClick={() => setModalOpen(true)}
  whileHover={{ scale: 1.1 }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
  className="ml-auto mt-6 flex w-fit items-center rounded-full bg-[#1B1B1B] px-7 py-3.5 text-sm font-medium text-white"
>
  Let&apos;s Start
</motion.button>
```

- [ ] **Step 3: Add modal JSX at end of section return, before closing `</section>`**

```tsx
{/* Lead capture modal */}
{modalOpen && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    onClick={(e) => { if (e.target === e.currentTarget) { setModalOpen(false); setModalStatus("idle"); } }}
  >
    <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
      <button
        onClick={() => { setModalOpen(false); setModalStatus("idle"); }}
        className="absolute right-4 top-4 text-[#1B1B1B]/40 hover:text-[#1B1B1B]"
      >
        ✕
      </button>
      {modalStatus === "success" ? (
        <div className="py-8 text-center">
          <p className="font-sans text-lg font-light text-[#1B1B1B]">Got it — we&apos;ll be in touch soon.</p>
        </div>
      ) : (
        <form onSubmit={handleModalSubmit} className="flex flex-col gap-5">
          <h2 className="font-sans text-2xl font-light text-[#1B1B1B]">Let&apos;s get started.</h2>
          <div className="grid grid-cols-2 gap-4">
            {(["firstName", "lastName"] as const).map((k) => (
              <div key={k} className="flex flex-col gap-1">
                <label className="font-sans text-xs text-[#1B1B1B]/50">{k === "firstName" ? "First Name *" : "Last Name *"}</label>
                <input
                  required
                  value={modalForm[k]}
                  onChange={(e) => setModalForm((f) => ({ ...f, [k]: e.target.value }))}
                  className="border-b border-[#1B1B1B]/20 bg-transparent py-1.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#1B1B1B]/60"
                />
              </div>
            ))}
          </div>
          {(["email", "phone"] as const).map((k) => (
            <div key={k} className="flex flex-col gap-1">
              <label className="font-sans text-xs text-[#1B1B1B]/50">{k === "email" ? "Email *" : "Phone"}</label>
              <input
                type={k === "email" ? "email" : "tel"}
                required={k === "email"}
                value={modalForm[k]}
                onChange={(e) => setModalForm((f) => ({ ...f, [k]: e.target.value }))}
                className="border-b border-[#1B1B1B]/20 bg-transparent py-1.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#1B1B1B]/60"
              />
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <label className="font-sans text-xs text-[#1B1B1B]/50">I&apos;m looking to…</label>
            <select
              value={modalForm.dealType}
              onChange={(e) => setModalForm((f) => ({ ...f, dealType: e.target.value }))}
              className="border-b border-[#1B1B1B]/20 bg-transparent py-1.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#1B1B1B]/60"
            >
              {["Buy", "Sell", "Rent", "Property Management"].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          {modalStatus === "error" && (
            <p className="font-sans text-xs text-red-500">Something went wrong. Please try again.</p>
          )}
          <button
            type="submit"
            disabled={modalStatus === "loading"}
            className="w-full rounded-full bg-[#1B1B1B] py-3 font-sans text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {modalStatus === "loading" ? "Sending…" : "Next →"}
          </button>
        </form>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 4: Manual verify**

Navigate to `localhost:3000`. Scroll to Services section. Click "Let's Start". Fill form. Submit. Expected: success message. Check DB for new lead.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/home/ServicesSection.tsx
git commit -m "feat: Services Let's Start modal wired to POST /api/leads"
```

---

## Task 9: Dashboard Layout

**Files:**
- Create: `apps/web/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create the layout**

```tsx
// apps/web/src/app/(dashboard)/layout.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/leads", label: "Leads" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-[#F2F0EF]">
      {/* Sidebar */}
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-[#1B1B1B]/10 bg-white px-4 py-6">
        <Link href="/" className="mb-8 block">
          <Image src="/logo-white.png" alt="CnC" width={100} height={40} className="invert" />
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg px-3 py-2 font-sans text-sm font-light text-[#1B1B1B]/60 transition-colors hover:bg-[#F2F0EF] hover:text-[#1B1B1B]"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-[#1B1B1B]/10 pt-4">
          <p className="font-sans text-xs text-[#1B1B1B]/40">{(session.user as any).email}</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Manual verify**

Navigate to `localhost:3000/dashboard` (must be logged in). Expected: sidebar visible with logo + nav links, children render in the main area. If not logged in, redirected to `/login`.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(dashboard)/layout.tsx"
git commit -m "feat: dashboard layout with sidebar"
```

---

## Task 10: Dashboard Home — StatsCards

**Files:**
- Create: `apps/web/src/components/dashboard/StatsCard.tsx`
- Create: `apps/web/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Create StatsCard component**

```tsx
// apps/web/src/components/dashboard/StatsCard.tsx
interface StatsCardProps {
  label: string;
  value: number | string;
  sub?: string;
}

export function StatsCard({ label, value, sub }: StatsCardProps) {
  return (
    <div className="rounded-2xl bg-white p-6">
      <p className="font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">{label}</p>
      <p className="mt-2 font-sans text-4xl font-light text-[#1B1B1B]">{value}</p>
      {sub && <p className="mt-1 font-sans text-sm text-[#1B1B1B]/40">{sub}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create dashboard home page**

```tsx
// apps/web/src/app/(dashboard)/dashboard/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { StatsCard } from "@/components/dashboard/StatsCard";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id;
  const role = (session!.user as any).role;

  const agent = role !== "ADMIN"
    ? await prisma.agent.findUnique({ where: { userId } })
    : null;

  const where = agent ? { agentId: agent.id } : {};
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [total, newThisWeek, active, closed] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.count({ where: { ...where, createdAt: { gte: weekAgo } } }),
    prisma.lead.count({ where: { ...where, status: { notIn: ["CLOSED", "LOST"] } } }),
    prisma.lead.count({ where: { ...where, status: "CLOSED" } }),
  ]);

  return (
    <div>
      <h1 className="mb-8 font-sans text-2xl font-light text-[#1B1B1B]">Overview</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard label="Total Leads" value={total} />
        <StatsCard label="New This Week" value={newThisWeek} />
        <StatsCard label="Active Pipeline" value={active} />
        <StatsCard label="Closed" value={closed} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manual verify**

Navigate to `localhost:3000/dashboard`. Expected: 4 stat cards visible. All show 0 if no leads exist yet — that's correct.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/StatsCard.tsx "apps/web/src/app/(dashboard)/dashboard/page.tsx"
git commit -m "feat: dashboard home with StatsCards"
```

---

## Task 11: Lead Pipeline Kanban

**Files:**
- Create: `apps/web/src/components/dashboard/LeadCard.tsx`
- Create: `apps/web/src/components/dashboard/LeadKanban.tsx`
- Create: `apps/web/src/app/(dashboard)/dashboard/leads/page.tsx`

- [ ] **Step 1: Create LeadCard**

```tsx
// apps/web/src/components/dashboard/LeadCard.tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  createdAt: string;
}

export function LeadCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-xl bg-white p-4 shadow-sm active:cursor-grabbing"
    >
      <p className="font-sans text-sm font-medium text-[#1B1B1B]">
        {lead.firstName} {lead.lastName}
      </p>
      <p className="mt-0.5 font-sans text-xs text-[#1B1B1B]/50">{lead.email}</p>
      <Link
        href={`/dashboard/leads/${lead.id}`}
        onClick={(e) => e.stopPropagation()}
        className="mt-3 inline-block font-sans text-xs text-[#9E8C61] hover:underline"
      >
        View →
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Create LeadKanban**

```tsx
// apps/web/src/components/dashboard/LeadKanban.tsx
"use client";
import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { LeadCard } from "./LeadCard";

type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "SHOWING" | "OFFER" | "UNDER_CONTRACT" | "CLOSED" | "LOST";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: LeadStatus;
  createdAt: string;
}

const COLUMNS: { status: LeadStatus; label: string }[] = [
  { status: "NEW", label: "New" },
  { status: "CONTACTED", label: "Contacted" },
  { status: "QUALIFIED", label: "Qualified" },
  { status: "SHOWING", label: "Showing" },
  { status: "OFFER", label: "Offer" },
  { status: "UNDER_CONTRACT", label: "Under Contract" },
  { status: "CLOSED", label: "Closed" },
  { status: "LOST", label: "Lost" },
];

export function LeadKanban({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    // `over.id` is the column status when dropped over an empty column
    const newStatus = over.id as LeadStatus;
    if (!COLUMNS.find((c) => c.status === newStatus)) return;

    setLeads((prev) => prev.map((l) => l.id === active.id ? { ...l, status: newStatus } : l));

    await fetch(`/api/leads/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  const activeLead = leads.find((l) => l.id === activeId);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(({ status, label }) => {
          const col = leads.filter((l) => l.status === status);
          return (
            <div key={status} className="flex w-56 flex-shrink-0 flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/50">{label}</p>
                <span className="rounded-full bg-[#1B1B1B]/10 px-2 py-0.5 font-sans text-xs text-[#1B1B1B]/50">{col.length}</span>
              </div>
              <SortableContext id={status} items={col.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                <div
                  id={status}
                  className="flex min-h-[120px] flex-col gap-2 rounded-2xl bg-[#1B1B1B]/5 p-2"
                >
                  {col.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>
      <DragOverlay>
        {activeLead && <LeadCard lead={activeLead} />}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 3: Create leads page (server component, passes data to client Kanban)**

```tsx
// apps/web/src/app/(dashboard)/dashboard/leads/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LeadKanban } from "@/components/dashboard/LeadKanban";
import Link from "next/link";

export default async function LeadsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id;
  const role = (session!.user as any).role;

  const agent = role !== "ADMIN"
    ? await prisma.agent.findUnique({ where: { userId } })
    : null;

  const leads = await prisma.lead.findMany({
    where: agent ? { agentId: agent.id } : {},
    orderBy: { createdAt: "desc" },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, createdAt: true },
  });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Leads</h1>
      </div>
      <LeadKanban initialLeads={leads.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))} />
    </div>
  );
}
```

- [ ] **Step 4: Manual verify**

Navigate to `localhost:3000/dashboard/leads`. Expected: Kanban with 8 columns. If leads exist (created via contact form or curl), they appear in the NEW column. Drag a card to another column — card moves, status updates in DB (check DB or refresh page).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/LeadCard.tsx apps/web/src/components/dashboard/LeadKanban.tsx "apps/web/src/app/(dashboard)/dashboard/leads/page.tsx"
git commit -m "feat: lead pipeline Kanban with dnd-kit drag-to-change-status"
```

---

## Task 12: Lead Detail Page

**Files:**
- Create: `apps/web/src/components/dashboard/ActivityFeed.tsx`
- Create: `apps/web/src/components/dashboard/AddNoteForm.tsx`
- Create: `apps/web/src/app/(dashboard)/dashboard/leads/[id]/page.tsx`

- [ ] **Step 1: Create ActivityFeed**

```tsx
// apps/web/src/components/dashboard/ActivityFeed.tsx
interface Activity {
  id: string;
  type: string;
  content: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  NOTE: "Note",
  CALL: "Call",
  EMAIL: "Email",
  SHOWING: "Showing",
  OFFER: "Offer",
  DOCUMENT: "Document",
};

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <p className="font-sans text-sm text-[#1B1B1B]/40">No activity yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {activities.map((a) => (
        <div key={a.id} className="flex gap-3">
          <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[#9E8C61]" />
          <div>
            <p className="font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">
              {TYPE_LABELS[a.type] ?? a.type} · {new Date(a.createdAt).toLocaleDateString()}
            </p>
            <p className="mt-0.5 font-sans text-sm text-[#1B1B1B]">{a.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create AddNoteForm**

```tsx
// apps/web/src/components/dashboard/AddNoteForm.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddNoteForm({ leadId }: { leadId: string }) {
  const [content, setContent] = useState("");
  const [type, setType] = useState("NOTE");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    await fetch(`/api/leads/${leadId}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, content }),
    });
    setContent("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex gap-2">
        {["NOTE", "CALL", "EMAIL", "SHOWING"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-full px-3 py-1 font-sans text-xs transition-colors ${
              type === t
                ? "bg-[#1B1B1B] text-white"
                : "bg-[#1B1B1B]/10 text-[#1B1B1B]/60 hover:bg-[#1B1B1B]/20"
            }`}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <textarea
        rows={3}
        placeholder="Add a note…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full resize-none rounded-xl border border-[#1B1B1B]/15 bg-white p-3 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#1B1B1B]/40"
      />
      <button
        type="submit"
        disabled={loading || !content.trim()}
        className="self-start rounded-full bg-[#1B1B1B] px-5 py-2 font-sans text-xs font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        {loading ? "Saving…" : "Add"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create lead detail page**

```tsx
// apps/web/src/app/(dashboard)/dashboard/leads/[id]/page.tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { AddNoteForm } from "@/components/dashboard/AddNoteForm";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified",
  SHOWING: "Showing", OFFER: "Offer", UNDER_CONTRACT: "Under Contract",
  CLOSED: "Closed", LOST: "Lost",
};

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: { activities: { orderBy: { createdAt: "desc" } } },
  });
  if (!lead) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/leads" className="mb-6 inline-block font-sans text-sm text-[#1B1B1B]/40 hover:text-[#1B1B1B]">
        ← Back to Leads
      </Link>

      {/* Lead header */}
      <div className="mb-8 rounded-2xl bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">
              {lead.firstName} {lead.lastName}
            </h1>
            <p className="mt-1 font-sans text-sm text-[#1B1B1B]/50">{lead.email}</p>
            {lead.phone && <p className="font-sans text-sm text-[#1B1B1B]/50">{lead.phone}</p>}
          </div>
          <span className="rounded-full bg-[#9E8C61]/15 px-3 py-1 font-sans text-xs font-medium text-[#9E8C61]">
            {STATUS_LABELS[lead.status] ?? lead.status}
          </span>
        </div>
        {lead.notes && (
          <div className="mt-4 border-t border-[#1B1B1B]/10 pt-4">
            <p className="font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Message</p>
            <p className="mt-1 font-sans text-sm text-[#1B1B1B]/70">{lead.notes}</p>
          </div>
        )}
        <p className="mt-4 font-sans text-xs text-[#1B1B1B]/30">
          Received {new Date(lead.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Add note */}
      <div className="mb-6 rounded-2xl bg-white p-6">
        <h2 className="mb-4 font-sans text-sm font-medium text-[#1B1B1B]">Add Activity</h2>
        <AddNoteForm leadId={lead.id} />
      </div>

      {/* Activity feed */}
      <div className="rounded-2xl bg-white p-6">
        <h2 className="mb-4 font-sans text-sm font-medium text-[#1B1B1B]">Activity</h2>
        <ActivityFeed
          activities={lead.activities.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Manual verify**

Navigate to `localhost:3000/dashboard/leads`. Click "View →" on any lead card. Expected: lead detail page with name, email, status badge, notes, and empty activity feed. Add a note → feed updates immediately.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/ActivityFeed.tsx apps/web/src/components/dashboard/AddNoteForm.tsx "apps/web/src/app/(dashboard)/dashboard/leads/[id]/page.tsx"
git commit -m "feat: lead detail page with activity feed and add-note form"
```

---

## Final Verification

- [ ] Submit a lead via `/contact` → appears in DB → email sent → visible in `/dashboard/leads` Kanban
- [ ] Submit a lead via Services "Let's Start" modal → same flow
- [ ] Drag a Kanban card from NEW → CONTACTED → verify status updated in DB
- [ ] Open lead detail → add a note → confirm it appears in activity feed
- [ ] Open `/dashboard` in a browser tab without auth → confirm redirect to `/login`

---

## Self-Review

**Spec coverage:**
- ✅ `/api/leads` endpoint (POST public, GET agent-authed)
- ✅ `/api/leads/[id]` PATCH for status updates
- ✅ `/api/leads/[id]/activities` POST for notes
- ✅ Contact page wired to `/api/leads`
- ✅ Services "Let's Start" modal wired to `/api/leads`
- ✅ Email notification on lead creation (SendGrid)
- ✅ Dashboard home with StatsCards
- ✅ Lead pipeline Kanban with drag-to-change-status
- ✅ Lead detail page with activity feed + add note form
- ✅ Role-based auth guards (AGENT min role on all dashboard API routes)

**Not in this plan (Phase 4+):**
- Property inquiry form (no property pages yet)
- Valuation form (no valuation page yet)
- Admin dashboard (Phase 5)
