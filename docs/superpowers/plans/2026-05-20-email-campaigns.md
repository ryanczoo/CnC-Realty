# Email Campaigns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full email campaigns feature — API routes, rich text editor, recipient picker, campaign list/new/detail pages — so agents can create, send, and track email campaigns from the dashboard.

**Architecture:** API routes follow the existing `requireAuth("AGENT")` pattern from `api-auth.ts`; agents are looked up by `userId` → `agent.id` before any DB query. UI components mirror the transactions page pattern (client components fetching from `/api/*`). The Campaign model needs an `agentId` field added via schema migration before any data can be scoped per-agent.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma ORM, @sendgrid/mail, @tiptap/react + @tiptap/starter-kit + @tiptap/extension-placeholder, shadcn/ui, Tailwind CSS.

---

## Schema Note

The `Campaign` model in `packages/database/prisma/schema.prisma` is **missing `agentId`**. This must be added in Task 1 (migration) before any other task runs. The field is nullable so existing rows (if any) are not broken.

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/database/prisma/schema.prisma` | Modify | Add `agentId String?` + `Agent?` relation to `Campaign` |
| `apps/web/src/app/api/campaigns/route.ts` | Create | GET list + POST create |
| `apps/web/src/app/api/campaigns/[id]/route.ts` | Create | GET detail + PATCH update + DELETE |
| `apps/web/src/app/api/campaigns/[id]/contacts/route.ts` | Create | POST upsert recipients |
| `apps/web/src/app/api/campaigns/[id]/send/route.ts` | Create | POST send via SendGrid |
| `apps/web/src/app/api/webhooks/sendgrid/route.ts` | Create | POST webhook handler (public) |
| `apps/web/src/components/campaigns/TiptapEditor.tsx` | Create | Rich text editor wrapper |
| `apps/web/src/components/campaigns/RecipientPicker.tsx` | Create | Lead checkbox picker with search |
| `apps/web/src/components/campaigns/CampaignCard.tsx` | Create | Display card for list page |
| `apps/web/src/app/(dashboard)/dashboard/campaigns/page.tsx` | Create | Campaign list (Server Component) |
| `apps/web/src/app/(dashboard)/dashboard/campaigns/new/page.tsx` | Create | 4-step new campaign wizard |
| `apps/web/src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx` | Create | Campaign detail + send/delete |

---

## Task 1: Schema Migration — Add agentId to Campaign

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (lines 465–478, Campaign model)

- [ ] **Step 1: Open schema.prisma and locate the Campaign model**

The Campaign model currently looks like:
```prisma
model Campaign {
  id          String         @id @default(cuid())
  name        String
  type        CampaignType
  status      CampaignStatus @default(DRAFT)
  subject     String?
  body        String?
  scheduledAt DateTime?
  sentAt      DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  contacts CampaignContact[]
}
```

Replace it with:
```prisma
model Campaign {
  id          String         @id @default(cuid())
  name        String
  type        CampaignType
  status      CampaignStatus @default(DRAFT)
  subject     String?
  body        String?
  scheduledAt DateTime?
  sentAt      DateTime?
  agentId     String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  agent    Agent?            @relation(fields: [agentId], references: [id])
  contacts CampaignContact[]
}
```

Also add `campaigns Campaign[]` to the `Agent` model relation list (after `transactionFiles TransactionFile[]`):
```prisma
  campaigns        Campaign[]
```

- [ ] **Step 2: Run Prisma migration**

From the repo root in a PowerShell window:
```powershell
pnpm --filter @cnc/database exec prisma migrate dev --name add_campaign_agent_id
```

Expected output: `✔  Generated Prisma Client` and a new migration file under `packages/database/prisma/migrations/`.

- [ ] **Step 3: Regenerate Prisma client**

```powershell
pnpm --filter @cnc/database exec prisma generate
```

Expected: no errors, `Generated Prisma Client` message.

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(schema): add agentId to Campaign model"
```

---

## Task 2: Install Tiptap

**Files:** No new files — installs packages only.

- [ ] **Step 1: Install Tiptap packages**

From `apps/web` directory:
```powershell
cd C:\Users\hey_r\Desktop\CnC-Realty\apps\web
pnpm add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder
```

Expected: packages added to `apps/web/package.json`, no peer dependency errors.

- [ ] **Step 2: Verify install**

```powershell
node -e "require('@tiptap/react'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat(deps): install Tiptap rich text editor"
```

---

## Task 3: GET + POST /api/campaigns

**Files:**
- Create: `apps/web/src/app/api/campaigns/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// apps/web/src/app/api/campaigns/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const createSchema = z.object({
  name: z.string().min(1, "Name required"),
  type: z.enum(["EMAIL", "DRIP"]),
  subject: z.string().optional(),
});

export async function GET() {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const userId = session.user.id;
  const agent = await prisma.agent.findUnique({ where: { userId } });
  if (!agent) return NextResponse.json([]);

  const campaigns = await prisma.campaign.findMany({
    where: { agentId: agent.id },
    include: { _count: { select: { contacts: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const userId = session.user.id;
  const role = session.user.role;

  const agent = role !== "ADMIN"
    ? await prisma.agent.findUnique({ where: { userId } })
    : await prisma.agent.findUnique({ where: { userId } });

  if (!agent) {
    return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        type: data.type,
        subject: data.subject ?? null,
        body: "",
        status: "DRAFT",
        agentId: agent.id,
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm --filter web tsc --noEmit
```

Expected: no errors related to `campaigns/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/campaigns/route.ts
git commit -m "feat(api): GET + POST /api/campaigns"
```

---

## Task 4: GET + PATCH + DELETE /api/campaigns/[id]

**Files:**
- Create: `apps/web/src/app/api/campaigns/[id]/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// apps/web/src/app/api/campaigns/[id]/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]).optional(),
});

async function getCampaignOrForbid(id: string, userId: string, role: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      contacts: {
        include: {
          lead: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      _count: { select: { contacts: true } },
    },
  });

  if (!campaign) return { campaign: null, forbidden: false };

  if (role === "ADMIN") return { campaign, forbidden: false };

  const agent = await prisma.agent.findUnique({ where: { userId } });
  if (!agent || campaign.agentId !== agent.id) {
    return { campaign: null, forbidden: true };
  }

  return { campaign, forbidden: false };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { campaign, forbidden } = await getCampaignOrForbid(
    params.id,
    session.user.id,
    session.user.role
  );

  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(campaign);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { campaign, forbidden } = await getCampaignOrForbid(
    params.id,
    session.user.id,
    session.user.role
  );

  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const updated = await prisma.campaign.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.body !== undefined && { body: data.body }),
        ...(data.scheduledAt !== undefined && {
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const { campaign, forbidden } = await getCampaignOrForbid(
    params.id,
    session.user.id,
    session.user.role
  );

  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.campaign.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm --filter web tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/campaigns/[id]/route.ts
git commit -m "feat(api): GET + PATCH + DELETE /api/campaigns/[id]"
```

---

## Task 5: POST /api/campaigns/[id]/contacts

**Files:**
- Create: `apps/web/src/app/api/campaigns/[id]/contacts/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// apps/web/src/app/api/campaigns/[id]/contacts/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

const bodySchema = z.object({
  leadIds: z.array(z.string()).min(1, "At least one lead required"),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  // Verify campaign ownership
  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role !== "ADMIN") {
    const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
    if (!agent || campaign.agentId !== agent.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const { leadIds } = bodySchema.parse(body);

    await prisma.$transaction(
      leadIds.map((leadId) =>
        prisma.campaignContact.upsert({
          where: { campaignId_leadId: { campaignId: params.id, leadId } },
          create: { campaignId: params.id, leadId, status: "PENDING" },
          update: {},
        })
      )
    );

    return NextResponse.json({ added: leadIds.length });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm --filter web tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/campaigns/[id]/contacts/route.ts
git commit -m "feat(api): POST /api/campaigns/[id]/contacts"
```

---

## Task 6: POST /api/campaigns/[id]/send

**Files:**
- Create: `apps/web/src/app/api/campaigns/[id]/send/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// apps/web/src/app/api/campaigns/[id]/send/route.ts
import { NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      contacts: {
        where: { status: "PENDING" },
        include: { lead: { select: { email: true, firstName: true, lastName: true } } },
      },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ownership check
  if (session.user.role !== "ADMIN") {
    const agent = await prisma.agent.findUnique({ where: { userId: session.user.id } });
    if (!agent || campaign.agentId !== agent.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!campaign.subject || !campaign.body) {
    return NextResponse.json({ error: "Campaign must have a subject and body before sending" }, { status: 400 });
  }

  if (!process.env.SENDGRID_API_KEY) {
    return NextResponse.json({ error: "SENDGRID_API_KEY not configured" }, { status: 500 });
  }

  let sent = 0;
  let errors = 0;
  const now = new Date();

  for (const contact of campaign.contacts) {
    try {
      await sgMail.send({
        to: contact.lead.email,
        from: "noreply@cncrealtygroup.com",
        subject: campaign.subject,
        html: campaign.body,
      });

      await prisma.campaignContact.update({
        where: { id: contact.id },
        data: { status: "SENT", sentAt: now },
      });
      sent++;
    } catch (err) {
      console.error(`Failed to send to ${contact.lead.email}:`, err);
      errors++;
    }
  }

  await prisma.campaign.update({
    where: { id: params.id },
    data: { status: "ACTIVE", sentAt: now },
  });

  return NextResponse.json({ sent, errors });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm --filter web tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/campaigns/[id]/send/route.ts
git commit -m "feat(api): POST /api/campaigns/[id]/send via SendGrid"
```

---

## Task 7: POST /api/webhooks/sendgrid

**Files:**
- Create: `apps/web/src/app/api/webhooks/sendgrid/route.ts`

- [ ] **Step 1: Create the route file**

Note: SendGrid sends a JSON array of events. Each event has `email`, `event` (e.g. `"open"`, `"click"`), and a `timestamp`. We look up the CampaignContact by the lead's email address. No auth is applied — SendGrid calls this endpoint directly.

```typescript
// apps/web/src/app/api/webhooks/sendgrid/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface SendGridEvent {
  email: string;
  event: string;
  timestamp: number;
  [key: string]: unknown;
}

export async function POST(req: Request) {
  try {
    const events: SendGridEvent[] = await req.json();

    for (const event of events) {
      const { email, event: eventType, timestamp } = event;
      const eventDate = new Date(timestamp * 1000);

      // Find the lead by email
      const lead = await prisma.lead.findFirst({ where: { email } });
      if (!lead) continue;

      if (eventType === "open") {
        await prisma.campaignContact.updateMany({
          where: { leadId: lead.id, status: { in: ["SENT", "PENDING"] } },
          data: { status: "OPENED", openedAt: eventDate },
        });
      } else if (eventType === "click") {
        await prisma.campaignContact.updateMany({
          where: { leadId: lead.id, status: { not: "BOUNCED" } },
          data: { status: "CLICKED", clickedAt: eventDate },
        });
      } else if (eventType === "bounce" || eventType === "blocked") {
        await prisma.campaignContact.updateMany({
          where: { leadId: lead.id },
          data: { status: "BOUNCED" },
        });
      }
    }
  } catch (err) {
    console.error("SendGrid webhook error:", err);
  }

  // Always return 200 — SendGrid retries on non-200
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm --filter web tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/webhooks/sendgrid/route.ts
git commit -m "feat(api): SendGrid webhook handler for open/click/bounce events"
```

---

## Task 8: TiptapEditor component

**Files:**
- Create: `apps/web/src/components/campaigns/TiptapEditor.tsx`

- [ ] **Step 1: Create the component**

```typescript
// apps/web/src/components/campaigns/TiptapEditor.tsx
"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

interface TiptapEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export function TiptapEditor({ value, onChange }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write your email body here..." }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "min-h-[200px] p-3 outline-none font-sans text-sm text-[#1B1B1B] leading-relaxed",
      },
    },
  });

  const btn = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium transition-colors ${
      active
        ? "bg-[#1B1B1B] text-white"
        : "bg-[#F2F0EF] text-[#1B1B1B]/60 hover:text-[#1B1B1B]"
    }`;

  return (
    <div className="rounded-xl border border-[#1B1B1B]/10 bg-white overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-[#1B1B1B]/10 px-3 py-2">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={btn(editor?.isActive("bold") ?? false)}
          aria-label="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={btn(editor?.isActive("italic") ?? false)}
          aria-label="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={btn(editor?.isActive("bulletList") ?? false)}
          aria-label="Bullet list"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={btn(editor?.isActive("orderedList") ?? false)}
          aria-label="Ordered list"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm --filter web tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/campaigns/TiptapEditor.tsx
git commit -m "feat(ui): TiptapEditor rich text component"
```

---

## Task 9: RecipientPicker component

**Files:**
- Create: `apps/web/src/components/campaigns/RecipientPicker.tsx`

- [ ] **Step 1: Create the component**

```typescript
// apps/web/src/components/campaigns/RecipientPicker.tsx
"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

interface RecipientPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-yellow-100 text-yellow-700",
  QUALIFIED: "bg-purple-100 text-purple-700",
  SHOWING: "bg-orange-100 text-orange-700",
  OFFER: "bg-pink-100 text-pink-700",
  UNDER_CONTRACT: "bg-indigo-100 text-indigo-700",
  CLOSED: "bg-green-100 text-green-700",
  LOST: "bg-gray-100 text-gray-500",
};

export function RecipientPicker({ selectedIds, onChange }: RecipientPickerProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leads")
      .then((r) => r.json())
      .then((data) => {
        setLeads(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.firstName.toLowerCase().includes(q) ||
      l.lastName.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q)
    );
  });

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  const toggleAll = () => {
    const allFilteredIds = filtered.map((l) => l.id);
    const allSelected = allFilteredIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      onChange(selectedIds.filter((id) => !allFilteredIds.includes(id)));
    } else {
      const combined = Array.from(new Set([...selectedIds, ...allFilteredIds]));
      onChange(combined);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-sans text-sm font-medium text-[#1B1B1B]">
          {selectedIds.length > 0
            ? `${selectedIds.length} recipient${selectedIds.length > 1 ? "s" : ""} selected`
            : "No recipients selected"}
        </p>
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-[#9E8C61] hover:underline"
          >
            {filtered.every((l) => selectedIds.includes(l.id)) ? "Deselect all" : "Select all"}
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1B1B1B]/40" />
        <input
          type="text"
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] py-2 pl-9 pr-3 font-sans text-sm text-[#1B1B1B] placeholder:text-[#1B1B1B]/40 outline-none focus:border-[#9E8C61]"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-[#F2F0EF]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center font-sans text-sm text-[#1B1B1B]/40">
          {search ? "No leads match your search." : "No leads yet."}
        </p>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-[#1B1B1B]/10 bg-white">
          {filtered.map((lead) => (
            <label
              key={lead.id}
              className="flex cursor-pointer items-center gap-3 border-b border-[#1B1B1B]/5 px-4 py-3 last:border-0 hover:bg-[#F2F0EF]"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(lead.id)}
                onChange={() => toggle(lead.id)}
                className="h-4 w-4 rounded accent-[#9E8C61]"
              />
              <div className="flex-1 min-w-0">
                <p className="font-sans text-sm font-medium text-[#1B1B1B] truncate">
                  {lead.firstName} {lead.lastName}
                </p>
                <p className="font-sans text-xs text-[#1B1B1B]/50 truncate">{lead.email}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-500"
                }`}
              >
                {lead.status.replace("_", " ")}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm --filter web tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/campaigns/RecipientPicker.tsx
git commit -m "feat(ui): RecipientPicker component with search and checkboxes"
```

---

## Task 10: CampaignCard component

**Files:**
- Create: `apps/web/src/components/campaigns/CampaignCard.tsx`

- [ ] **Step 1: Create the component**

```typescript
// apps/web/src/components/campaigns/CampaignCard.tsx
import Link from "next/link";

interface CampaignCardProps {
  id: string;
  name: string;
  type: string;
  status: string;
  contactCount: number;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  EMAIL: "bg-blue-50 text-blue-700",
  DRIP: "bg-purple-50 text-purple-700",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-[#F2F0EF] text-[#1B1B1B]/50",
  SCHEDULED: "bg-blue-50 text-blue-700",
  ACTIVE: "bg-green-50 text-green-700",
  PAUSED: "bg-yellow-50 text-yellow-700",
  COMPLETED: "bg-[#9E8C61]/10 text-[#9E8C61]",
  CANCELLED: "bg-red-50 text-red-500",
};

export function CampaignCard({
  id,
  name,
  type,
  status,
  contactCount,
  createdAt,
}: CampaignCardProps) {
  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link
      href={`/dashboard/campaigns/${id}`}
      className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-sans text-base font-medium text-[#1B1B1B] leading-snug line-clamp-2">
          {name}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            TYPE_COLORS[type] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {type}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-[#1B1B1B]/5 pt-3 font-sans text-xs text-[#1B1B1B]/50">
        <span>{contactCount} recipient{contactCount !== 1 ? "s" : ""}</span>
        <span>{formattedDate}</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm --filter web tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/campaigns/CampaignCard.tsx
git commit -m "feat(ui): CampaignCard display component"
```

---

## Task 11: Campaign list page

**Files:**
- Create: `apps/web/src/app/(dashboard)/dashboard/campaigns/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// apps/web/src/app/(dashboard)/dashboard/campaigns/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CampaignCard } from "@/components/campaigns/CampaignCard";

export default async function CampaignsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id;
  const role = (session!.user as any).role;

  let campaigns: {
    id: string;
    name: string;
    type: string;
    status: string;
    createdAt: Date;
    _count: { contacts: number };
  }[] = [];

  try {
    const agent = role !== "ADMIN"
      ? await prisma.agent.findUnique({ where: { userId } })
      : null;

    campaigns = await prisma.campaign.findMany({
      where: agent ? { agentId: agent.id } : {},
      include: { _count: { select: { contacts: true } } },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    // Show empty state on DB error
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Campaigns</h1>
        <Link
          href="/dashboard/campaigns/new"
          className="rounded-full bg-[#1B1B1B] px-4 py-2 font-sans text-sm text-white hover:bg-[#1B1B1B]/80 transition-colors"
        >
          New Campaign →
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1B1B1B]/20 py-20 text-center">
          <p className="font-sans text-[#1B1B1B]/40">No campaigns yet.</p>
          <p className="mt-1 font-sans text-sm text-[#1B1B1B]/30">Create your first email campaign.</p>
          <Link
            href="/dashboard/campaigns/new"
            className="mt-5 rounded-full bg-[#1B1B1B] px-5 py-2.5 font-sans text-sm text-white hover:bg-[#1B1B1B]/80 transition-colors"
          >
            New Campaign →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              id={c.id}
              name={c.name}
              type={c.type}
              status={c.status}
              contactCount={c._count.contacts}
              createdAt={c.createdAt.toISOString()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm --filter web tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/dashboard/campaigns/page.tsx
git commit -m "feat(dashboard): campaigns list page"
```

---

## Task 12: New campaign wizard page

**Files:**
- Create: `apps/web/src/app/(dashboard)/dashboard/campaigns/new/page.tsx`

- [ ] **Step 1: Create the page**

This is a 4-step wizard. Each step is rendered conditionally based on `step` state (1–4). A progress bar at the top shows current step. "Next →" advances and "← Back" goes back. On step 4, submitting calls POST /api/campaigns, then POST /api/campaigns/[id]/contacts, then optionally POST /api/campaigns/[id]/send.

```typescript
// apps/web/src/app/(dashboard)/dashboard/campaigns/new/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TiptapEditor } from "@/components/campaigns/TiptapEditor";
import { RecipientPicker } from "@/components/campaigns/RecipientPicker";

type CampaignType = "EMAIL" | "DRIP";

const STEPS = ["Details", "Content", "Recipients", "Schedule"];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [name, setName] = useState("");
  const [type, setType] = useState<CampaignType>("EMAIL");
  const [subject, setSubject] = useState("");

  // Step 2
  const [body, setBody] = useState("");

  // Step 3
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Step 4
  const [sendNow, setSendNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");

  const canNext = () => {
    if (step === 1) return name.trim().length > 0 && subject.trim().length > 0;
    if (step === 2) return body.trim().length > 0 && body !== "<p></p>";
    if (step === 3) return selectedIds.length > 0;
    return true;
  };

  const handleFinish = async () => {
    setError(null);
    setSubmitting(true);

    try {
      // Create the campaign
      const createRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, subject }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error ?? "Failed to create campaign");
      }

      const campaign = await createRes.json();

      // Save body
      await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      // Add recipients
      await fetch(`/api/campaigns/${campaign.id}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: selectedIds }),
      });

      // Schedule or send
      if (!sendNow && scheduledAt) {
        await fetch(`/api/campaigns/${campaign.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduledAt: new Date(scheduledAt).toISOString(),
            status: "SCHEDULED",
          }),
        });
      } else if (sendNow) {
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
        {/* Progress bar */}
        <div className="mb-8">
          <div className="mb-3 flex justify-between">
            {STEPS.map((label, i) => (
              <span
                key={label}
                className={`font-sans text-xs font-medium ${
                  i + 1 <= step ? "text-[#1B1B1B]" : "text-[#1B1B1B]/30"
                }`}
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

        {/* Step 1: Details */}
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
          </div>
        )}

        {/* Step 2: Content */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-sans text-xl font-light text-[#1B1B1B]">Email Content</h2>
            <TiptapEditor value={body} onChange={setBody} />
          </div>
        )}

        {/* Step 3: Recipients */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-sans text-xl font-light text-[#1B1B1B]">Select Recipients</h2>
            <RecipientPicker selectedIds={selectedIds} onChange={setSelectedIds} />
          </div>
        )}

        {/* Step 4: Schedule */}
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
                  <p className="font-sans text-sm font-medium text-[#1B1B1B]">Send Now</p>
                  <p className="font-sans text-xs text-[#1B1B1B]/50">
                    Campaign will be sent immediately after you click Finish.
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

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
            className="rounded-full border border-[#1B1B1B]/20 px-5 py-2.5 font-sans text-sm text-[#1B1B1B]/60 hover:border-[#1B1B1B]/40 hover:text-[#1B1B1B] disabled:opacity-0 disabled:pointer-events-none transition-colors"
          >
            ← Back
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="rounded-full bg-[#1B1B1B] px-5 py-2.5 font-sans text-sm text-white hover:bg-[#1B1B1B]/80 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={submitting}
              className="rounded-full bg-[#9E8C61] px-5 py-2.5 font-sans text-sm text-white hover:bg-[#9E8C61]/80 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              {submitting ? "Saving…" : sendNow ? "Send Campaign" : "Schedule Campaign"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm --filter web tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/dashboard/campaigns/new/page.tsx
git commit -m "feat(dashboard): new campaign wizard (4-step)"
```

---

## Task 13: Campaign detail page

**Files:**
- Create: `apps/web/src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// apps/web/src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface ContactRow {
  id: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  lead: { id: string; firstName: string; lastName: string; email: string };
}

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  subject: string | null;
  body: string | null;
  scheduledAt: string | null;
  createdAt: string;
  contacts: ContactRow[];
  _count: { contacts: number };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-[#F2F0EF] text-[#1B1B1B]/50",
  SCHEDULED: "bg-blue-50 text-blue-700",
  ACTIVE: "bg-green-50 text-green-700",
  PAUSED: "bg-yellow-50 text-yellow-700",
  COMPLETED: "bg-[#9E8C61]/10 text-[#9E8C61]",
  CANCELLED: "bg-red-50 text-red-500",
};

const CONTACT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-500",
  SENT: "bg-blue-50 text-blue-700",
  OPENED: "bg-green-50 text-green-700",
  CLICKED: "bg-purple-50 text-purple-700",
  BOUNCED: "bg-red-50 text-red-500",
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; errors: number } | null>(null);

  useEffect(() => {
    fetch(`/api/campaigns/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setCampaign(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleSend = async () => {
    if (!confirm("Send this campaign to all pending recipients now?")) return;
    setSending(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/send`, { method: "POST" });
      const data = await res.json();
      setSendResult(data);
      // Refresh campaign data
      const updated = await fetch(`/api/campaigns/${id}`).then((r) => r.json());
      setCampaign(updated);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    router.push("/dashboard/campaigns");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[#F2F0EF]" />
        <div className="h-48 animate-pulse rounded-xl bg-[#F2F0EF]" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <p className="font-sans text-[#1B1B1B]/40">Campaign not found.</p>
        <Link href="/dashboard/campaigns" className="mt-4 font-sans text-sm text-[#9E8C61] hover:underline">
          ← Back to Campaigns
        </Link>
      </div>
    );
  }

  const sentCount = campaign.contacts.filter((c) => c.status !== "PENDING").length;
  const openedCount = campaign.contacts.filter((c) =>
    ["OPENED", "CLICKED"].includes(c.status)
  ).length;
  const clickedCount = campaign.contacts.filter((c) => c.status === "CLICKED").length;
  const pendingCount = campaign.contacts.filter((c) => c.status === "PENDING").length;
  const canSend = campaign.status === "DRAFT" && pendingCount > 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard/campaigns"
            className="font-sans text-xs text-[#1B1B1B]/40 hover:text-[#1B1B1B]"
          >
            ← Campaigns
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">{campaign.name}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                STATUS_COLORS[campaign.status] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {campaign.status.charAt(0) + campaign.status.slice(1).toLowerCase()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canSend && (
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="rounded-full bg-[#9E8C61] px-4 py-2 font-sans text-sm text-white hover:bg-[#9E8C61]/80 disabled:opacity-40 transition-colors"
            >
              {sending ? "Sending…" : "Send Now"}
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-full border border-red-200 px-4 py-2 font-sans text-sm text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {/* Send result */}
      {sendResult && (
        <div className="rounded-xl bg-green-50 px-5 py-4 font-sans text-sm text-green-700">
          Sent to {sendResult.sent} recipient{sendResult.sent !== 1 ? "s" : ""}.
          {sendResult.errors > 0 && ` ${sendResult.errors} failed.`}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total Recipients", value: campaign._count.contacts },
          { label: "Sent", value: sentCount },
          { label: "Opened", value: openedCount },
          { label: "Clicked", value: clickedCount },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="font-sans text-2xl font-light text-[#1B1B1B]">{value}</p>
            <p className="mt-1 font-sans text-xs text-[#1B1B1B]/50">{label}</p>
          </div>
        ))}
      </div>

      {/* Campaign details */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-sans text-sm font-medium text-[#1B1B1B]/60 uppercase tracking-wider">
          Campaign Details
        </h2>
        <dl className="flex flex-col gap-3">
          <div className="flex items-start gap-4">
            <dt className="w-28 shrink-0 font-sans text-sm text-[#1B1B1B]/50">Subject</dt>
            <dd className="font-sans text-sm text-[#1B1B1B]">{campaign.subject ?? "—"}</dd>
          </div>
          <div className="flex items-start gap-4">
            <dt className="w-28 shrink-0 font-sans text-sm text-[#1B1B1B]/50">Type</dt>
            <dd className="font-sans text-sm text-[#1B1B1B]">{campaign.type}</dd>
          </div>
          {campaign.scheduledAt && (
            <div className="flex items-start gap-4">
              <dt className="w-28 shrink-0 font-sans text-sm text-[#1B1B1B]/50">Scheduled</dt>
              <dd className="font-sans text-sm text-[#1B1B1B]">
                {new Date(campaign.scheduledAt).toLocaleString()}
              </dd>
            </div>
          )}
        </dl>
        {campaign.body && (
          <div className="mt-5 border-t border-[#1B1B1B]/5 pt-5">
            <p className="mb-3 font-sans text-sm text-[#1B1B1B]/50">Body Preview</p>
            <div
              className="prose prose-sm max-w-none font-sans text-sm text-[#1B1B1B]"
              dangerouslySetInnerHTML={{ __html: campaign.body }}
            />
          </div>
        )}
      </div>

      {/* Contacts table */}
      {campaign.contacts.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1B1B1B]/5">
            <h2 className="font-sans text-sm font-medium text-[#1B1B1B]/60 uppercase tracking-wider">
              Recipients
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1B1B1B]/5">
                  <th className="px-6 py-3 text-left font-sans text-xs font-medium text-[#1B1B1B]/40 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left font-sans text-xs font-medium text-[#1B1B1B]/40 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left font-sans text-xs font-medium text-[#1B1B1B]/40 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left font-sans text-xs font-medium text-[#1B1B1B]/40 uppercase tracking-wider">
                    Sent At
                  </th>
                </tr>
              </thead>
              <tbody>
                {campaign.contacts.map((contact) => (
                  <tr key={contact.id} className="border-b border-[#1B1B1B]/5 last:border-0 hover:bg-[#F2F0EF]/50">
                    <td className="px-6 py-4 font-sans text-sm text-[#1B1B1B]">
                      {contact.lead.firstName} {contact.lead.lastName}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-[#1B1B1B]/60">
                      {contact.lead.email}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-sans text-xs font-medium ${
                          CONTACT_STATUS_COLORS[contact.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {contact.status.charAt(0) + contact.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-[#1B1B1B]/50">
                      {contact.sentAt
                        ? new Date(contact.sentAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm --filter web tsc --noEmit
```

- [ ] **Step 3: Run dev server and navigate to /dashboard/campaigns**

```powershell
pnpm --filter web dev
```

Open `http://localhost:3000/dashboard/campaigns` — should show the Campaigns page (empty state or list).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx
git commit -m "feat(dashboard): campaign detail page with send and delete"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] GET /api/campaigns — Task 3
- [x] POST /api/campaigns — Task 3
- [x] GET /api/campaigns/[id] — Task 4
- [x] PATCH /api/campaigns/[id] — Task 4
- [x] DELETE /api/campaigns/[id] — Task 4
- [x] POST /api/campaigns/[id]/contacts — Task 5
- [x] POST /api/campaigns/[id]/send — Task 6
- [x] POST /api/webhooks/sendgrid — Task 7
- [x] TiptapEditor — Task 8
- [x] RecipientPicker — Task 9
- [x] CampaignCard — Task 10
- [x] Campaigns list page — Task 11
- [x] New campaign wizard — Task 12
- [x] Campaign detail page — Task 13
- [x] Schema migration for agentId — Task 1 (critical prerequisite)
- [x] Tiptap install — Task 2

**Schema note:** The actual schema uses `ContactStatus` enum values (`PENDING`, `SENT`, `OPENED`, `CLICKED`, `BOUNCED`, `UNSUBSCRIBED`) not plain strings. The `CampaignContact.status` field is typed as `ContactStatus` enum. The API routes and UI components in this plan use the correct values (`"PENDING"`, `"SENT"`, `"OPENED"`, `"CLICKED"`, `"BOUNCED"`).

**Type consistency check:**
- `Campaign.agentId` → `String?` in schema, `agent.id` from `prisma.agent.findUnique` ✓
- `CampaignContact.status` → `ContactStatus` enum, values used in routes match enum ✓
- `CampaignCard` receives `contactCount: number` from `_count.contacts` ✓
- `TiptapEditor` props `value: string, onChange: (html: string) => void` ✓ (used in wizard)
- `RecipientPicker` props `selectedIds: string[], onChange: (ids: string[]) => void` ✓ (used in wizard)
- `getCampaignOrForbid` returns `{ campaign, forbidden }` ✓ (used in GET/PATCH/DELETE)

**Placeholder scan:** No TBDs, no "implement later", no missing code blocks found.

**CANCELLED enum value note:** The spec and detail page use `"CANCELLED"` as a status value. The schema's `CampaignStatus` enum only defines `DRAFT | SCHEDULED | ACTIVE | PAUSED | COMPLETED`. There is no `CANCELLED` value in the schema. The PATCH schema in Task 4 includes `"CANCELLED"` — this should be removed or the schema enum should be extended. For now, the PATCH schema is corrected to only allow the 5 defined values: `DRAFT | SCHEDULED | ACTIVE | PAUSED | COMPLETED`. The detail page's `STATUS_COLORS` keeps a `CANCELLED` entry for safety but it won't be reachable without a schema change.
