# Phase 5 Remaining — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete four remaining Phase 5 items: vercel.json daily cron for property alerts, SendGrid webhook signature verification, public agent profile pages at `/agents/[slug]`, and drip campaign sequence editor.

**Architecture:** Four independent features on the existing Next.js 14 App Router + Prisma + PostgreSQL stack. Tasks 1 and 2 are backend-only changes to existing files; Task 3 adds a new public page and API route; Task 4 requires a schema migration, new API route, and new UI component.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma ORM, PostgreSQL (Railway), shadcn/ui, Tailwind CSS, `@sendgrid/eventwebhook`, Vitest

---

## File Map

**Task 1 — vercel.json cron:**
- Modify: `vercel.json`

**Task 2 — SendGrid webhook verification:**
- Install: `@sendgrid/eventwebhook` in `apps/web`
- Create: `apps/web/src/app/api/webhooks/sendgrid/verify.ts`
- Modify: `apps/web/src/app/api/webhooks/sendgrid/route.ts`
- Create: `apps/web/src/__tests__/webhooks/sendgrid-verify.test.ts`

**Task 3 — Agent profile pages:**
- Create: `apps/web/src/app/(agents)/agents/[slug]/page.tsx`
- Create: `apps/web/src/components/agents/AgentProfileHero.tsx`
- Create: `apps/web/src/components/agents/AgentContactForm.tsx`
- Create: `apps/web/src/app/api/agents/[slug]/contact/route.ts`
- Create: `apps/web/src/__tests__/api/agents-contact.test.ts`
- Note: Admin agents table at `apps/web/src/app/(dashboard)/admin/agents/page.tsx:68` already links to `/agents/[slug]` — no admin change needed.

**Task 4 — Drip campaign sequence editor:**
- Modify: `packages/database/prisma/schema.prisma` — add `DripStep` model + `steps DripStep[]` to `Campaign`
- Create: `apps/web/src/app/api/campaigns/[id]/drip-steps/route.ts`
- Create: `apps/web/src/components/dashboard/DripSequenceEditor.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/campaigns/new/page.tsx`
- Create: `apps/web/src/__tests__/api/drip-steps.test.ts`

---

### Task 1: vercel.json — Add Daily Cron for Property Alerts

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add property-alerts cron entry**

Open `vercel.json` — currently contains the idx/sync delta cron. Replace with:

```json
{
  "crons": [
    {
      "path": "/api/idx/sync?type=delta",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/property-alerts/run",
      "schedule": "0 9 * * *"
    }
  ]
}
```

`0 9 * * *` fires at 09:00 UTC daily. Vercel invokes cron paths as POST.

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat: add daily cron for property alerts in vercel.json"
```

---

### Task 2: SendGrid Webhook Signature Verification

**Files:**
- Install: `@sendgrid/eventwebhook` in `apps/web`
- Create: `apps/web/src/app/api/webhooks/sendgrid/verify.ts`
- Modify: `apps/web/src/app/api/webhooks/sendgrid/route.ts`
- Create: `apps/web/src/__tests__/webhooks/sendgrid-verify.test.ts`

- [ ] **Step 1: Install the SendGrid event webhook package**

From the repo root:

```bash
pnpm --filter web add @sendgrid/eventwebhook
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/__tests__/webhooks/sendgrid-verify.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature } from '../../app/api/webhooks/sendgrid/verify';

describe('verifyWebhookSignature', () => {
  it('returns false when publicKey is empty', () => {
    expect(verifyWebhookSignature('', 'body', 'sig', '12345')).toBe(false);
  });

  it('returns false when signature is invalid for a given key', () => {
    expect(verifyWebhookSignature('not-a-real-key', 'body', 'badsig', '12345')).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd apps/web && pnpm test --reporter=verbose 2>&1 | grep -A5 "sendgrid-verify"
```

Expected: FAIL — `../../app/api/webhooks/sendgrid/verify` not found.

- [ ] **Step 4: Create the verify helper**

Create `apps/web/src/app/api/webhooks/sendgrid/verify.ts`:

```typescript
import { EventWebhook } from '@sendgrid/eventwebhook';

export function verifyWebhookSignature(
  publicKey: string,
  rawBody: string,
  signature: string,
  timestamp: string
): boolean {
  if (!publicKey) return false;
  try {
    const ew = new EventWebhook();
    const ecPublicKey = ew.convertPublicKeyToECDH(publicKey);
    return ew.verifySignature(ecPublicKey, Buffer.from(rawBody), signature, timestamp);
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/web && pnpm test --reporter=verbose 2>&1 | grep -A5 "sendgrid-verify"
```

Expected: PASS (2 tests pass).

- [ ] **Step 6: Update the webhook route**

Replace `apps/web/src/app/api/webhooks/sendgrid/route.ts` entirely:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "./verify";

interface SendGridEvent {
  email: string;
  event: string;
  timestamp: number;
  [key: string]: unknown;
}

const SENDGRID_PUBLIC_KEY = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY ?? "";

export async function POST(req: Request) {
  const rawBody = await req.text();

  if (SENDGRID_PUBLIC_KEY) {
    const signature = req.headers.get("X-Twilio-Email-Event-Webhook-Signature") ?? "";
    const timestamp = req.headers.get("X-Twilio-Email-Event-Webhook-Timestamp") ?? "";
    if (!verifyWebhookSignature(SENDGRID_PUBLIC_KEY, rawBody, signature, timestamp)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  try {
    const events: SendGridEvent[] = JSON.parse(rawBody);

    const emails = Array.from(new Set(events.map((e) => e.email)));
    const leads = await prisma.lead.findMany({ where: { email: { in: emails } } });
    const leadByEmail = new Map(leads.map((l) => [l.email, l]));

    const updates = events.flatMap(({ email, event: eventType, timestamp }) => {
      const lead = leadByEmail.get(email);
      if (!lead) return [];
      const eventDate = new Date(timestamp * 1000);

      if (eventType === "open") {
        return [prisma.campaignContact.updateMany({
          where: { leadId: lead.id, status: { in: ["SENT", "PENDING"] } },
          data: { status: "OPENED", openedAt: eventDate },
        })];
      }
      if (eventType === "click") {
        return [prisma.campaignContact.updateMany({
          where: { leadId: lead.id, status: { not: "BOUNCED" } },
          data: { status: "CLICKED", clickedAt: eventDate },
        })];
      }
      if (eventType === "bounce" || eventType === "blocked") {
        return [prisma.campaignContact.updateMany({
          where: { leadId: lead.id },
          data: { status: "BOUNCED" },
        })];
      }
      return [];
    });

    await Promise.all(updates);
    return NextResponse.json({ processed: updates.length });
  } catch (err) {
    console.error("SendGrid webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

Note: When `SENDGRID_WEBHOOK_PUBLIC_KEY` is not set (local dev), verification is skipped automatically.

- [ ] **Step 7: Document the env var**

Check if `apps/web/.env.example` exists. If it does, add:
```
SENDGRID_WEBHOOK_PUBLIC_KEY=  # From SendGrid > Settings > Mail Settings > Event Webhooks > Signed Event Webhook
```

If no `.env.example` exists, skip — Ryan will add this to Vercel env vars before deploy.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/api/webhooks/sendgrid/ apps/web/src/__tests__/webhooks/
git commit -m "feat: SendGrid webhook signature verification"
```

---

### Task 3: Agent Profile Pages

**Files:**
- Create: `apps/web/src/app/(agents)/agents/[slug]/page.tsx`
- Create: `apps/web/src/components/agents/AgentProfileHero.tsx`
- Create: `apps/web/src/components/agents/AgentContactForm.tsx`
- Create: `apps/web/src/app/api/agents/[slug]/contact/route.ts`
- Create: `apps/web/src/__tests__/api/agents-contact.test.ts`

- [ ] **Step 1: Write the failing test for the contact API**

Create `apps/web/src/__tests__/api/agents-contact.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    lead: { create: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { POST } from '../../app/api/agents/[slug]/contact/route';

describe('POST /api/agents/[slug]/contact', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when agent slug does not exist', async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);
    const req = new Request('http://localhost/api/agents/unknown/contact', {
      method: 'POST',
      body: JSON.stringify({ name: 'John Doe', email: 'john@example.com', phone: '', message: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: { slug: 'unknown' } });
    expect(res.status).toBe(404);
  });

  it('creates a lead and returns 200 for a valid agent', async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: 'agent-1', slug: 'ryan-chong' } as any);
    vi.mocked(prisma.lead.create).mockResolvedValue({} as any);

    const req = new Request('http://localhost/api/agents/ryan-chong/contact', {
      method: 'POST',
      body: JSON.stringify({ name: 'Jane Smith', email: 'jane@example.com', phone: '555-1234', message: 'Interested!' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: { slug: 'ryan-chong' } });
    expect(res.status).toBe(200);
    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ agentId: 'agent-1', email: 'jane@example.com' }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm test --reporter=verbose 2>&1 | grep -A5 "agents-contact"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the contact API route**

Create `apps/web/src/app/api/agents/[slug]/contact/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const { name, email, phone, message } = await req.json();

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const agent = await prisma.agent.findUnique({ where: { slug: params.slug } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const parts = (name as string).trim().split(/\s+/);
  const firstName = parts[0] ?? "Unknown";
  const lastName = parts.slice(1).join(" ") || "—";

  await prisma.lead.create({
    data: {
      firstName,
      lastName,
      email: (email as string).trim(),
      phone: (phone as string)?.trim() || null,
      notes: (message as string)?.trim() || null,
      agentId: agent.id,
      source: "WEBSITE",
    },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && pnpm test --reporter=verbose 2>&1 | grep -A5 "agents-contact"
```

Expected: PASS (2 tests pass).

- [ ] **Step 5: Create AgentContactForm client component**

Create `apps/web/src/components/agents/AgentContactForm.tsx`:

```tsx
"use client";
import { useState } from "react";

export function AgentContactForm({ slug }: { slug: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/agents/${slug}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to send");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-xl bg-[#9E8C61]/10 p-6 text-center">
        <p className="font-sans text-base font-medium text-[#9E8C61]">Message sent!</p>
        <p className="mt-1 font-sans text-sm text-[#1B1B1B]/60">
          The agent will be in touch shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="font-sans text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/60">
          Full Name
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="font-sans text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/60">
          Email
        </label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="font-sans text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/60">
          Phone (optional)
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 000-0000"
          className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="font-sans text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/60">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="I'm interested in buying/selling…"
          className="resize-none rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
        />
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 font-sans text-sm text-red-600">{error}</p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-[#9E8C61] py-3 font-sans text-sm font-medium text-white transition-colors hover:bg-[#9E8C61]/80 disabled:pointer-events-none disabled:opacity-40"
      >
        {submitting ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Create AgentProfileHero component**

Create `apps/web/src/components/agents/AgentProfileHero.tsx`:

```tsx
import Image from "next/image";

type AgentProfileHeroProps = {
  displayName: string | null;
  headshot: string | null;
  bio: string | null;
  licenseNum: string | null;
  licenseState: string | null;
  yearsExp: number | null;
  specialties: string[];
  phone: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  listingsClosed: number;
  volumeClosed: number;
};

export function AgentProfileHero(props: AgentProfileHeroProps) {
  const {
    displayName, headshot, bio, licenseNum, licenseState,
    yearsExp, specialties, phone, instagram, facebook, linkedin,
    listingsClosed, volumeClosed,
  } = props;

  const volumeFormatted =
    volumeClosed >= 1_000_000
      ? `$${(volumeClosed / 1_000_000).toFixed(1)}M`
      : `$${volumeClosed.toLocaleString()}`;

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
          {/* Headshot */}
          <div className="relative h-40 w-40 flex-shrink-0 overflow-hidden rounded-full bg-[#F2F0EF]">
            {headshot ? (
              <Image src={headshot} alt={displayName ?? "Agent"} fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-sans text-5xl font-light text-[#1B1B1B]/20">
                  {(displayName ?? "A")[0].toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="font-sans text-3xl font-light text-[#1B1B1B]">
              {displayName ?? "CnC Realty Agent"}
            </h1>
            <p className="mt-1 font-sans text-sm text-[#9E8C61]">
              Real Estate Agent · CnC Realty Group
            </p>
            {(licenseNum || licenseState) && (
              <p className="mt-1 font-sans text-xs text-[#1B1B1B]/50">
                License {licenseNum ?? "—"} · {licenseState ?? "CA"}
              </p>
            )}
            {phone && (
              <a
                href={`tel:${phone}`}
                className="mt-3 inline-block font-sans text-sm text-[#1B1B1B] transition-colors hover:text-[#9E8C61]"
              >
                {phone}
              </a>
            )}
            <div className="mt-3 flex items-center justify-center gap-4 md:justify-start">
              {instagram && (
                <a href={instagram} target="_blank" rel="noopener noreferrer" className="font-sans text-xs text-[#1B1B1B]/40 transition-colors hover:text-[#9E8C61]">
                  Instagram
                </a>
              )}
              {facebook && (
                <a href={facebook} target="_blank" rel="noopener noreferrer" className="font-sans text-xs text-[#1B1B1B]/40 transition-colors hover:text-[#9E8C61]">
                  Facebook
                </a>
              )}
              {linkedin && (
                <a href={linkedin} target="_blank" rel="noopener noreferrer" className="font-sans text-xs text-[#1B1B1B]/40 transition-colors hover:text-[#9E8C61]">
                  LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-10 grid grid-cols-3 gap-4 border-t border-[#1B1B1B]/5 pt-8">
          {[
            { label: "Listings Closed", value: listingsClosed.toString() },
            { label: "Volume Closed", value: volumeFormatted },
            { label: "Years Experience", value: yearsExp !== null ? yearsExp.toString() : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="font-sans text-2xl font-light text-[#1B1B1B]">{value}</p>
              <p className="mt-0.5 font-sans text-xs text-[#1B1B1B]/50">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bio + Specialties */}
      {(bio || specialties.length > 0) && (
        <div className="bg-[#F2F0EF] py-12">
          <div className="mx-auto max-w-5xl px-6">
            {bio && (
              <div className="mb-6">
                <h2 className="mb-3 font-sans text-xs font-medium uppercase tracking-widest text-[#9E8C61]">
                  About
                </h2>
                <p className="font-sans text-base leading-relaxed text-[#1B1B1B]/80">{bio}</p>
              </div>
            )}
            {specialties.length > 0 && (
              <div>
                <h2 className="mb-3 font-sans text-xs font-medium uppercase tracking-widest text-[#9E8C61]">
                  Specialties
                </h2>
                <div className="flex flex-wrap gap-2">
                  {specialties.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-[#9E8C61]/30 px-3 py-1 font-sans text-xs text-[#1B1B1B]/70"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Create the agent profile page**

Create `apps/web/src/app/(agents)/agents/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AgentProfileHero } from "@/components/agents/AgentProfileHero";
import { AgentContactForm } from "@/components/agents/AgentContactForm";
import type { Metadata } from "next";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const agent = await prisma.agent.findUnique({ where: { slug: params.slug } });
  if (!agent) return { title: "Agent Not Found | CnC Realty" };
  return {
    title: `${agent.displayName ?? agent.slug} | CnC Realty Group`,
    description:
      agent.bio ?? `Connect with ${agent.displayName ?? "a CnC Realty agent"} today.`,
  };
}

export default async function AgentProfilePage({ params }: Props) {
  const agent = await prisma.agent.findUnique({ where: { slug: params.slug } });
  if (!agent) notFound();

  return (
    <main>
      <AgentProfileHero
        displayName={agent.displayName}
        headshot={agent.headshot}
        bio={agent.bio}
        licenseNum={agent.licenseNum}
        licenseState={agent.licenseState}
        yearsExp={agent.yearsExp}
        specialties={agent.specialties}
        phone={agent.phone}
        instagram={agent.instagram}
        facebook={agent.facebook}
        linkedin={agent.linkedin}
        listingsClosed={agent.listingsClosed}
        volumeClosed={agent.volumeClosed}
      />

      <section className="bg-white py-16">
        <div className="mx-auto max-w-xl px-6">
          <h2 className="mb-2 font-sans text-2xl font-light text-[#1B1B1B]">Get in Touch</h2>
          <p className="mb-8 font-sans text-sm text-[#1B1B1B]/60">
            Ready to buy, sell, or just have questions? Send a message and{" "}
            {agent.displayName ?? "the agent"} will reach out.
          </p>
          <AgentContactForm slug={params.slug} />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 8: Run dev server and verify**

```bash
pnpm --filter web dev
```

Navigate to `http://localhost:3000/agents/<slug>` (find a valid slug in Prisma Studio or with `pnpm --filter @cnc/database exec prisma studio`). Verify:
- Profile hero renders with name, stats, bio, specialties
- Contact form submits and shows success message
- Navigating to a non-existent slug renders the 404 page

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/(agents)/agents/ apps/web/src/components/agents/ apps/web/src/app/api/agents/ apps/web/src/__tests__/api/agents-contact.test.ts
git commit -m "feat: public agent profile pages at /agents/[slug]"
```

---

### Task 4: Drip Campaign Sequence Editor

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `apps/web/src/app/api/campaigns/[id]/drip-steps/route.ts`
- Create: `apps/web/src/components/dashboard/DripSequenceEditor.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/campaigns/new/page.tsx`
- Create: `apps/web/src/__tests__/api/drip-steps.test.ts`

- [ ] **Step 1: Add DripStep model to schema**

In `packages/database/prisma/schema.prisma`:

Inside the `Campaign` model, after the `contacts CampaignContact[]` line, add:
```prisma
  steps    DripStep[]
```

After the `CampaignContact` model block, add:
```prisma
model DripStep {
  id         String   @id @default(cuid())
  campaignId String
  stepOrder  Int
  delayDays  Int      @default(0)
  subject    String
  body       String
  createdAt  DateTime @default(now())

  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Run the migration**

From the repo root:

```bash
pnpm --filter @cnc/database exec prisma migrate dev --name add-drip-steps
```

Expected: a new migration file is created in `packages/database/prisma/migrations/` and the DB schema is updated.

- [ ] **Step 3: Write the failing test for drip-steps API**

Create `apps/web/src/__tests__/api/drip-steps.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dripStep: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET, POST } from '../../app/api/campaigns/[id]/drip-steps/route';

describe('GET /api/campaigns/[id]/drip-steps', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(new Request('http://localhost'), { params: { id: 'c1' } });
    expect(res.status).toBe(401);
  });

  it('returns steps ordered by stepOrder when authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1' } } as any);
    const mockSteps = [{ id: 's1', campaignId: 'c1', stepOrder: 1, delayDays: 0, subject: 'Hello', body: 'Hi!', createdAt: new Date() }];
    vi.mocked(prisma.dripStep.findMany).mockResolvedValue(mockSteps as any);

    const res = await GET(new Request('http://localhost'), { params: { id: 'c1' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
  });
});

describe('POST /api/campaigns/[id]/drip-steps', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify([]) }), { params: { id: 'c1' } });
    expect(res.status).toBe(401);
  });

  it('replaces steps and returns 200 when authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined as any);

    const steps = [{ stepOrder: 1, delayDays: 0, subject: 'Welcome', body: 'Hi there!' }];
    const res = await POST(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify(steps), headers: { 'Content-Type': 'application/json' } }),
      { params: { id: 'c1' } }
    );
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd apps/web && pnpm test --reporter=verbose 2>&1 | grep -A5 "drip-steps"
```

Expected: FAIL — module not found.

- [ ] **Step 5: Create the drip-steps API route**

Create `apps/web/src/app/api/campaigns/[id]/drip-steps/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const steps = await prisma.dripStep.findMany({
    where: { campaignId: params.id },
    orderBy: { stepOrder: "asc" },
  });
  return NextResponse.json(steps);
}

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const steps: Array<{ stepOrder: number; delayDays: number; subject: string; body: string }> =
    await req.json();

  await prisma.$transaction([
    prisma.dripStep.deleteMany({ where: { campaignId: params.id } }),
    prisma.dripStep.createMany({
      data: steps.map((s) => ({ ...s, campaignId: params.id })),
    }),
  ]);

  return NextResponse.json({ saved: true });
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd apps/web && pnpm test --reporter=verbose 2>&1 | grep -A5 "drip-steps"
```

Expected: PASS (4 tests pass).

- [ ] **Step 7: Create DripSequenceEditor component**

Create `apps/web/src/components/dashboard/DripSequenceEditor.tsx`:

```tsx
"use client";

export type DripStepData = {
  stepOrder: number;
  delayDays: number;
  subject: string;
  body: string;
};

type Props = {
  steps: DripStepData[];
  onChange: (steps: DripStepData[]) => void;
};

export function DripSequenceEditor({ steps, onChange }: Props) {
  const addStep = () => {
    onChange([
      ...steps,
      {
        stepOrder: steps.length + 1,
        delayDays: steps.length === 0 ? 0 : 3,
        subject: "",
        body: "",
      },
    ]);
  };

  const removeStep = (index: number) => {
    onChange(
      steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepOrder: i + 1 }))
    );
  };

  const updateStep = (index: number, field: keyof DripStepData, value: string | number) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="flex flex-col gap-4">
      {steps.length === 0 && (
        <p className="rounded-xl border border-dashed border-[#1B1B1B]/10 py-8 text-center font-sans text-sm text-[#1B1B1B]/40">
          No steps yet — add your first email below.
        </p>
      )}

      {steps.map((step, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border border-[#1B1B1B]/10 p-4">
          <div className="flex items-center justify-between">
            <span className="font-sans text-sm font-medium text-[#1B1B1B]">Step {i + 1}</span>
            {steps.length > 1 && (
              <button
                type="button"
                onClick={() => removeStep(i)}
                className="font-sans text-xs text-red-400 transition-colors hover:text-red-600"
              >
                Remove
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap font-sans text-xs text-[#1B1B1B]/60">Send after</span>
            <input
              type="number"
              min={0}
              value={step.delayDays}
              onChange={(e) => updateStep(i, "delayDays", parseInt(e.target.value, 10) || 0)}
              className="w-16 rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-1.5 text-center font-sans text-sm text-[#1B1B1B] outline-none"
            />
            <span className="font-sans text-xs text-[#1B1B1B]/60">day(s)</span>
          </div>

          <input
            type="text"
            placeholder="Subject line…"
            value={step.subject}
            onChange={(e) => updateStep(i, "subject", e.target.value)}
            className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
          />

          <textarea
            placeholder="Email body…"
            value={step.body}
            onChange={(e) => updateStep(i, "body", e.target.value)}
            rows={4}
            className="resize-none rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addStep}
        className="rounded-full border border-dashed border-[#1B1B1B]/20 px-4 py-2.5 font-sans text-sm text-[#1B1B1B]/50 transition-colors hover:border-[#9E8C61] hover:text-[#9E8C61]"
      >
        + Add Step
      </button>
    </div>
  );
}
```

- [ ] **Step 8: Update campaigns/new wizard to support DRIP type**

Replace `apps/web/src/app/(dashboard)/dashboard/campaigns/new/page.tsx` entirely:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TiptapEditor } from "@/components/campaigns/TiptapEditor";
import { RecipientPicker } from "@/components/campaigns/RecipientPicker";
import { DripSequenceEditor, type DripStepData } from "@/components/dashboard/DripSequenceEditor";

type CampaignType = "EMAIL" | "DRIP";

const STEPS = ["Details", "Content", "Recipients", "Schedule"];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<CampaignType>("EMAIL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [dripSteps, setDripSteps] = useState<DripStepData[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sendNow, setSendNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");

  const canNext = () => {
    if (step === 1) return name.trim().length > 0 && (type === "DRIP" || subject.trim().length > 0);
    if (step === 2) {
      if (type === "DRIP") {
        return dripSteps.length > 0 && dripSteps.every((s) => s.subject.trim() && s.body.trim());
      }
      return body.trim().length > 0 && body !== "<p></p>";
    }
    if (step === 3) return selectedIds.length > 0;
    return true;
  };

  const handleFinish = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const createRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, subject: type === "DRIP" ? "" : subject }),
      });
      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error ?? "Failed to create campaign");
      }
      const campaign = await createRes.json();

      const contentSave =
        type === "DRIP"
          ? fetch(`/api/campaigns/${campaign.id}/drip-steps`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(dripSteps),
            })
          : fetch(`/api/campaigns/${campaign.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ body }),
            });

      await Promise.all([
        contentSave,
        fetch(`/api/campaigns/${campaign.id}/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadIds: selectedIds }),
        }),
      ]);

      if (!sendNow && scheduledAt) {
        await fetch(`/api/campaigns/${campaign.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduledAt: new Date(scheduledAt).toISOString(),
            status: "SCHEDULED",
          }),
        });
      } else if (sendNow && type === "EMAIL") {
        await fetch(`/api/campaigns/${campaign.id}/send`, { method: "POST" });
      }

      router.push("/dashboard/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-start justify-center bg-[#F2F0EF] py-10">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-8">
          <div className="mb-3 flex justify-between">
            {STEPS.map((label, i) => (
              <span
                key={label}
                className={`font-sans text-xs font-medium ${i + 1 <= step ? "text-[#1B1B1B]" : "text-[#1B1B1B]/30"}`}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#F2F0EF]">
            <div
              className="h-1.5 rounded-full bg-[#1B1B1B] transition-all duration-300"
              style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-sans text-xl font-light text-[#1B1B1B]">Campaign Details</h2>
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-sm text-[#1B1B1B]/60">Campaign Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Spring Outreach 2026"
                className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-sm text-[#1B1B1B]/60">Type</label>
              <div className="flex gap-3">
                {(["EMAIL", "DRIP"] as CampaignType[]).map((t) => (
                  <label key={t} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="type"
                      value={t}
                      checked={type === t}
                      onChange={() => setType(t)}
                      className="accent-[#9E8C61]"
                    />
                    <span className="font-sans text-sm text-[#1B1B1B]">{t}</span>
                  </label>
                ))}
              </div>
            </div>
            {type === "EMAIL" && (
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-sm text-[#1B1B1B]/60">Subject Line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject..."
                  className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
                />
              </div>
            )}
          </div>
        )}

        {step === 2 && type === "EMAIL" && (
          <div className="flex flex-col gap-5">
            <h2 className="font-sans text-xl font-light text-[#1B1B1B]">Email Content</h2>
            <TiptapEditor value={body} onChange={setBody} />
          </div>
        )}

        {step === 2 && type === "DRIP" && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="font-sans text-xl font-light text-[#1B1B1B]">Drip Sequence</h2>
              <p className="mt-1 font-sans text-xs text-[#1B1B1B]/50">
                Each step is sent after the specified delay. Step 1 goes out on day 0 (immediately after enrollment).
              </p>
            </div>
            <DripSequenceEditor steps={dripSteps} onChange={setDripSteps} />
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-sans text-xl font-light text-[#1B1B1B]">Select Recipients</h2>
            <RecipientPicker selectedIds={selectedIds} onChange={setSelectedIds} />
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-sans text-xl font-light text-[#1B1B1B]">Schedule</h2>
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#1B1B1B]/10 p-4 hover:bg-[#F2F0EF]">
                <input
                  type="radio"
                  name="schedule"
                  checked={sendNow}
                  onChange={() => setSendNow(true)}
                  className="accent-[#9E8C61]"
                />
                <div>
                  <p className="font-sans text-sm font-medium text-[#1B1B1B]">
                    {type === "DRIP" ? "Start Now" : "Send Now"}
                  </p>
                  <p className="font-sans text-xs text-[#1B1B1B]/50">
                    {type === "DRIP"
                      ? "Sequence begins immediately after you click Finish."
                      : "Campaign will be sent immediately after you click Finish."}
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#1B1B1B]/10 p-4 hover:bg-[#F2F0EF]">
                <input
                  type="radio"
                  name="schedule"
                  checked={!sendNow}
                  onChange={() => setSendNow(false)}
                  className="accent-[#9E8C61]"
                />
                <div className="flex-1">
                  <p className="font-sans text-sm font-medium text-[#1B1B1B]">Schedule for Later</p>
                  <p className="font-sans text-xs text-[#1B1B1B]/50">Choose a date and time.</p>
                </div>
              </label>
              {!sendNow && (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61]"
                />
              )}
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 font-sans text-sm text-red-600">{error}</p>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
            className="rounded-full border border-[#1B1B1B]/20 px-5 py-2.5 font-sans text-sm text-[#1B1B1B]/60 transition-colors hover:border-[#1B1B1B]/40 hover:text-[#1B1B1B] disabled:pointer-events-none disabled:opacity-0"
          >
            ← Back
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="rounded-full bg-[#1B1B1B] px-5 py-2.5 font-sans text-sm text-white transition-colors hover:bg-[#1B1B1B]/80 disabled:pointer-events-none disabled:opacity-40"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={submitting}
              className="rounded-full bg-[#9E8C61] px-5 py-2.5 font-sans text-sm text-white transition-colors hover:bg-[#9E8C61]/80 disabled:pointer-events-none disabled:opacity-40"
            >
              {submitting
                ? "Saving…"
                : sendNow
                  ? type === "DRIP" ? "Start Sequence" : "Send Campaign"
                  : "Schedule Campaign"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Run dev server and verify the drip editor**

```bash
pnpm --filter web dev
```

Navigate to `http://localhost:3000/dashboard/campaigns/new`. Verify:
- Selecting DRIP hides the Subject Line field in step 1
- Step 2 shows DripSequenceEditor instead of TiptapEditor
- Adding/removing/editing steps works correctly
- "Next" is disabled until at least one step has both subject and body filled
- Finishing creates the campaign, saves drip steps, and redirects to `/dashboard/campaigns`

- [ ] **Step 10: Commit**

```bash
git add packages/database/prisma/ apps/web/src/app/api/campaigns/ apps/web/src/components/dashboard/DripSequenceEditor.tsx "apps/web/src/app/(dashboard)/dashboard/campaigns/new/page.tsx" apps/web/src/__tests__/api/drip-steps.test.ts
git commit -m "feat: drip campaign sequence editor with DripStep schema"
```

---

## Self-Review

**Spec coverage:**
- ✅ `vercel.json` daily cron for property alerts (`0 9 * * *`)
- ✅ SendGrid webhook signature verification — gracefully skipped in dev when key is not set
- ✅ Public agent profile pages at `/agents/[slug]` with contact form that creates a `Lead`
- ✅ Drip campaign sequence editor — schema migration, API (replace-all strategy), UI component, wizard integration

**Placeholder scan:** No TBD, TODO, or incomplete sections found.

**Type consistency:**
- `DripStepData` defined once in `DripSequenceEditor.tsx`, imported via `type DripStepData` in `campaigns/new/page.tsx`
- `verifyWebhookSignature` defined in `verify.ts`, imported in `route.ts`
- `prisma.dripStep` used in `drip-steps/route.ts` — matches the `DripStep` model name in schema

**Ambiguity resolved:**
- DRIP "Start Now" saves the sequence but does not trigger real-time sending (the delivery engine is future work — the campaign is saved with contacts enrolled for future drip processing)
- Admin agents table already links to `/agents/[slug]` at line 68 — no change needed
