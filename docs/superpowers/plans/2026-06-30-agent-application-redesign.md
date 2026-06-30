# Agent Application Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the auth-gated 4-step `/join/agent` onboarding form with a public single-page application at `/join/apply` that collects all legally required info, enforces ICA acknowledgment via a link-click-gated checkbox, routes submissions to an admin approval queue, and creates agent accounts only after Ryan approves.

**Architecture:** Public form → `AgentApplication` DB row (PENDING) + SendGrid notification to Ryan → Admin reviews at `/admin/applications` → Approve creates `User`+`Agent` rows and sends agent a password-setup link → Reject sends agent a rejection email. No third-party e-signature service needed.

**Tech Stack:** Next.js 14 App Router, Prisma 5 (PostgreSQL), Zod, `@sendgrid/mail`, `react-google-recaptcha-v3`, bcryptjs, NextAuth

## Global Constraints

- Schema lives at `packages/database/prisma/schema.prisma` — all model changes go there
- Migration command: `pnpm --filter @cnc/database db:migrate`
- Generate Prisma client: `pnpm --filter @cnc/database db:generate`
- Tests use Vitest: `pnpm --filter web test`
- Dev server: `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
- All email goes through `@sendgrid/mail` via helpers in `apps/web/src/lib/email.ts`
- Admin-only pages call `requireAdminPage()` from `apps/web/src/lib/server-utils.ts`
- API auth uses `requireAuth()` from `apps/web/src/lib/api-auth.ts`
- Existing input/label class names from `/join/agent`: `inputClass = "w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-3 text-sm text-[#1B1B1B] placeholder-[#1B1B1B]/40 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/40"`, `labelClass = "mb-1 block text-xs font-medium text-[#1B1B1B]/60 uppercase tracking-wide"`
- DRE license format: 8 digits (e.g. `01234567`) — validate with `/^\d{8}$/`
- reCAPTCHA score threshold: 0.5
- Password setup token expires: 72 hours after approval
- Agent slug: `firstName-lastName` lowercased, spaces → hyphens (e.g. `ryan-chong`)

---

## File Map

**New files:**
- `packages/database/prisma/schema.prisma` — add 3 enums + AgentApplication model + setupToken fields on User
- `apps/web/src/app/(marketing)/join/apply/page.tsx` — public page shell (no auth)
- `apps/web/src/components/join/ApplicationForm.tsx` — full 9-section controlled form
- `apps/web/src/app/api/agent-applications/route.ts` — POST: validate, verify reCAPTCHA, save, notify Ryan
- `apps/web/src/app/(dashboard)/admin/applications/page.tsx` — admin queue server component
- `apps/web/src/app/(dashboard)/admin/applications/ApplicationsClient.tsx` — interactive table + status filter
- `apps/web/src/app/(dashboard)/admin/applications/[id]/page.tsx` — detail view + approve/reject UI
- `apps/web/src/app/api/agent-applications/[id]/approve/route.ts` — POST: create User+Agent, send setup email
- `apps/web/src/app/api/agent-applications/[id]/reject/route.ts` — POST: save reason, send rejection email
- `apps/web/src/app/(marketing)/setup-account/page.tsx` — password setup page for approved agents
- `apps/web/src/app/api/setup-account/route.ts` — POST: verify token, set password, clear token
- `apps/web/src/__tests__/api/agent-applications.test.ts` — unit tests for POST /api/agent-applications

**Modified files:**
- `packages/database/prisma/schema.prisma` — (see above)
- `apps/web/src/lib/email.ts` — add 3 new email helpers
- `apps/web/src/components/join/AgentPlan.tsx:96` — href `/join/agent` → `/join/apply`
- `apps/web/src/components/join/HowToJoin.tsx:48` — href `/join/agent` → `/join/apply`

**Deleted files:**
- `apps/web/src/app/(agents)/join/agent/page.tsx`

---

## Task 1: DB Schema — AgentApplication model + User setup token

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

**Interfaces:**
- Produces: `AgentApplication`, `ApplicationStatus`, `LicenseType`, `CommissionEntity` Prisma types; `User.setupToken`, `User.setupTokenExpiry` fields

- [ ] **Step 1: Add enums and AgentApplication model to schema**

Open `packages/database/prisma/schema.prisma`. Add the following after the last existing enum block (before `// ─── Auth models`):

```prisma
// ─── Agent Application enums ─────────────────────────────────────────────────

enum ApplicationStatus {
  PENDING
  APPROVED
  REJECTED
}

enum LicenseType {
  SALESPERSON
  BROKER_ASSOCIATE
}

enum CommissionEntity {
  PERSONAL
  LLC
  S_CORP
  C_CORP
}
```

Then add this model at the end of the file (after all other models):

```prisma
// ─── Agent Application ───────────────────────────────────────────────────────

model AgentApplication {
  id        String            @id @default(cuid())
  createdAt DateTime          @default(now())
  status    ApplicationStatus @default(PENDING)

  // Personal
  firstName   String
  lastName    String
  email       String
  phone       String
  address     String
  city        String
  state       String
  zip         String
  dateOfBirth String

  // License
  licenseNumber   String
  licenseType     LicenseType
  licenseExpDate  String
  yearsLicensed   Int
  formerBrokerage String
  boardOfRealtors String?
  mlsId           String?

  // Transfer
  hasActiveListings Boolean
  hasActiveSales    Boolean

  // Business / Tax
  commissionEntity CommissionEntity

  // Background / Legal
  hasDisciplinaryHistory  Boolean
  disciplinaryExplain     String?
  hasInvestigationHistory Boolean
  investigationExplain    String?
  backgroundCheckConsent  Boolean
  drePerJuryCert          Boolean

  // Profile (carries over to Agent on approval)
  specialties  String[]
  bio          String?
  instagramUrl String?
  facebookUrl  String?

  // ICA audit trail
  icaOpenedAt  DateTime
  icaAgreedAt  DateTime
  submissionIp String

  // Admin review
  reviewedBy      String?
  reviewedAt      DateTime?
  rejectionReason String?
}
```

- [ ] **Step 2: Add setupToken fields to User model**

In the same file, find the `model User` block and add two fields after `updatedAt`:

```prisma
  setupToken       String?   @unique
  setupTokenExpiry DateTime?
```

The User model should now look like:

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?
  role          UserRole  @default(BUYER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  setupToken       String?   @unique
  setupTokenExpiry DateTime?

  accounts           Account[]
  // ... rest unchanged
```

- [ ] **Step 3: Run migration**

```powershell
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm --filter @cnc/database db:migrate
```

When prompted for migration name, enter: `add_agent_application`

Expected output: `✓ Generated Prisma Client`

- [ ] **Step 4: Verify Prisma client has the new types**

```powershell
pnpm --filter @cnc/database db:generate
```

Expected: no errors. The types `AgentApplication`, `ApplicationStatus`, `LicenseType`, `CommissionEntity` are now available from `@prisma/client`.

- [ ] **Step 5: Commit**

```powershell
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat: add AgentApplication model + setup token fields to User"
```

---

## Task 2: Email helpers — application notification + approval + rejection

**Files:**
- Modify: `apps/web/src/lib/email.ts`

**Interfaces:**
- Produces:
  - `sendApplicationNotification(app: { firstName: string; lastName: string; email: string; id: string }): Promise<void>`
  - `sendApplicationApproved(to: string, firstName: string, setupUrl: string): Promise<void>`
  - `sendApplicationRejected(to: string, firstName: string, reason: string): Promise<void>`

- [ ] **Step 1: Add the three new email functions to `apps/web/src/lib/email.ts`**

Append to the end of the file:

```typescript
export async function sendApplicationNotification(app: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}) {
  if (!process.env.SENDGRID_API_KEY) return;
  const safeName = `${escapeHtml(app.firstName)} ${escapeHtml(app.lastName)}`;
  const safeEmail = escapeHtml(app.email);
  await sgMail.send({
    to: NOTIFY,
    from: FROM,
    subject: `New Agent Application: ${app.firstName} ${app.lastName}`,
    html: `
      <h2>New agent application received</h2>
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><a href="${process.env.NEXTAUTH_URL}/admin/applications/${app.id}">Review application →</a></p>
    `,
  });
}

export async function sendApplicationApproved(
  to: string,
  firstName: string,
  setupUrl: string
) {
  if (!process.env.SENDGRID_API_KEY) return;
  const safeName = escapeHtml(firstName);
  const safeUrl = escapeHtml(setupUrl);
  await sgMail.send({
    to,
    from: FROM,
    subject: "Welcome to CnC Realty — Set Up Your Account",
    html: `
      <h2>Welcome to CnC Realty, ${safeName}!</h2>
      <p>Your application has been approved. Click the link below to set your password and access your dashboard.</p>
      <p><a href="${safeUrl}">Set up my account →</a></p>
      <p>This link expires in 72 hours.</p>
      <p>— The CnC Realty Team</p>
    `,
  });
}

export async function sendApplicationRejected(
  to: string,
  firstName: string,
  reason: string
) {
  if (!process.env.SENDGRID_API_KEY) return;
  const safeName = escapeHtml(firstName);
  const safeReason = escapeHtml(reason);
  await sgMail.send({
    to,
    from: FROM,
    subject: "CnC Realty — Application Update",
    html: `
      <h2>Hi ${safeName},</h2>
      <p>Thank you for your interest in joining CnC Realty. After reviewing your application, we are unable to move forward at this time.</p>
      ${safeReason ? `<p><strong>Reason:</strong> ${safeReason}</p>` : ""}
      <p>If you have questions, please reach out to <a href="mailto:info@cncrealtygroup.com">info@cncrealtygroup.com</a>.</p>
      <p>— The CnC Realty Team</p>
    `,
  });
}
```

- [ ] **Step 2: Commit**

```powershell
git add apps/web/src/lib/email.ts
git commit -m "feat: add application notification + approval + rejection email helpers"
```

---

## Task 3: POST /api/agent-applications

**Files:**
- Create: `apps/web/src/app/api/agent-applications/route.ts`
- Create: `apps/web/src/__tests__/api/agent-applications.test.ts`

**Interfaces:**
- Consumes: `sendApplicationNotification` from `@/lib/email`; `prisma.agentApplication.create`
- Produces: `POST /api/agent-applications` → `{ id: string }` on 201, `{ error: string }` on 400/500

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/api/agent-applications.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentApplication: { create: vi.fn() },
  },
}));
vi.mock('@/lib/email', () => ({
  sendApplicationNotification: vi.fn(),
}));

// Mock reCAPTCHA verification — success by default
global.fetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve({ success: true, score: 0.9 }),
} as any);

import { prisma } from '@/lib/prisma';
import { POST } from '../../app/api/agent-applications/route';

const VALID_BODY = {
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane@example.com',
  phone: '5551234567',
  address: '123 Main St',
  city: 'Los Angeles',
  state: 'CA',
  zip: '90001',
  dateOfBirth: '1985-06-15',
  licenseNumber: '01234567',
  licenseType: 'SALESPERSON',
  licenseExpDate: '2027-01-01',
  yearsLicensed: 5,
  formerBrokerage: 'Keller Williams',
  boardOfRealtors: '',
  mlsId: '',
  hasActiveListings: false,
  hasActiveSales: false,
  commissionEntity: 'PERSONAL',
  hasDisciplinaryHistory: false,
  disciplinaryExplain: '',
  hasInvestigationHistory: false,
  investigationExplain: '',
  backgroundCheckConsent: true,
  drePerJuryCert: true,
  specialties: ['Residential'],
  bio: '',
  instagramUrl: '',
  facebookUrl: '',
  icaOpenedAt: '2026-06-30T14:00:00.000Z',
  icaAgreedAt: '2026-06-30T14:05:00.000Z',
  recaptchaToken: 'valid-token',
};

describe('POST /api/agent-applications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 if licenseNumber is not 8 digits', async () => {
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, licenseNumber: '1234' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 if required fields are missing', async () => {
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, firstName: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 if backgroundCheckConsent is false', async () => {
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, backgroundCheckConsent: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 if drePerJuryCert is false', async () => {
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, drePerJuryCert: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('creates application and returns 201 for valid submission', async () => {
    vi.mocked(prisma.agentApplication.create).mockResolvedValue({ id: 'app-1' } as any);
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('app-1');
    expect(prisma.agentApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'jane@example.com',
          licenseNumber: '01234567',
          submissionIp: '1.2.3.4',
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```powershell
pnpm --filter web test agent-applications
```

Expected: FAIL — `POST` not found.

- [ ] **Step 3: Create the API route**

Create `apps/web/src/app/api/agent-applications/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendApplicationNotification } from "@/lib/email";

const schema = z.object({
  firstName:      z.string().min(1, "First name required"),
  lastName:       z.string().min(1, "Last name required"),
  email:          z.string().email("Valid email required"),
  phone:          z.string().min(1, "Phone required"),
  address:        z.string().min(1, "Address required"),
  city:           z.string().min(1, "City required"),
  state:          z.string().min(1, "State required"),
  zip:            z.string().min(1, "ZIP required"),
  dateOfBirth:    z.string().min(1, "Date of birth required"),
  licenseNumber:  z.string().regex(/^\d{8}$/, "CA DRE license must be exactly 8 digits"),
  licenseType:    z.enum(["SALESPERSON", "BROKER_ASSOCIATE"]),
  licenseExpDate: z.string().min(1, "License expiration date required"),
  yearsLicensed:  z.number().int().min(0),
  formerBrokerage:z.string().min(1, "Former brokerage required"),
  boardOfRealtors:z.string().optional().default(""),
  mlsId:          z.string().optional().default(""),
  hasActiveListings:       z.boolean(),
  hasActiveSales:          z.boolean(),
  commissionEntity:        z.enum(["PERSONAL", "LLC", "S_CORP", "C_CORP"]),
  hasDisciplinaryHistory:  z.boolean(),
  disciplinaryExplain:     z.string().optional().default(""),
  hasInvestigationHistory: z.boolean(),
  investigationExplain:    z.string().optional().default(""),
  backgroundCheckConsent:  z.literal(true, { errorMap: () => ({ message: "Background check consent required" }) }),
  drePerJuryCert:          z.literal(true, { errorMap: () => ({ message: "DRE certification required" }) }),
  specialties:    z.array(z.string()).default([]),
  bio:            z.string().optional().default(""),
  instagramUrl:   z.string().optional().default(""),
  facebookUrl:    z.string().optional().default(""),
  icaOpenedAt:    z.string().datetime(),
  icaAgreedAt:    z.string().datetime(),
  recaptchaToken: z.string().min(1, "reCAPTCHA token required"),
});

async function verifyRecaptcha(token: string): Promise<boolean> {
  if (!process.env.RECAPTCHA_SECRET_KEY) return true; // skip in dev if not configured
  const res = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
    { method: "POST" }
  );
  const data = await res.json();
  return data.success === true && (data.score ?? 1) >= 0.5;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    const recaptchaOk = await verifyRecaptcha(data.recaptchaToken);
    if (!recaptchaOk) {
      return NextResponse.json({ error: "reCAPTCHA verification failed. Please try again." }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

    const app = await prisma.agentApplication.create({
      data: {
        firstName:       data.firstName,
        lastName:        data.lastName,
        email:           data.email,
        phone:           data.phone,
        address:         data.address,
        city:            data.city,
        state:           data.state,
        zip:             data.zip,
        dateOfBirth:     data.dateOfBirth,
        licenseNumber:   data.licenseNumber,
        licenseType:     data.licenseType,
        licenseExpDate:  data.licenseExpDate,
        yearsLicensed:   data.yearsLicensed,
        formerBrokerage: data.formerBrokerage,
        boardOfRealtors: data.boardOfRealtors || null,
        mlsId:           data.mlsId || null,
        hasActiveListings:       data.hasActiveListings,
        hasActiveSales:          data.hasActiveSales,
        commissionEntity:        data.commissionEntity,
        hasDisciplinaryHistory:  data.hasDisciplinaryHistory,
        disciplinaryExplain:     data.disciplinaryExplain || null,
        hasInvestigationHistory: data.hasInvestigationHistory,
        investigationExplain:    data.investigationExplain || null,
        backgroundCheckConsent:  data.backgroundCheckConsent,
        drePerJuryCert:          data.drePerJuryCert,
        specialties:    data.specialties,
        bio:            data.bio || null,
        instagramUrl:   data.instagramUrl || null,
        facebookUrl:    data.facebookUrl || null,
        icaOpenedAt:    new Date(data.icaOpenedAt),
        icaAgreedAt:    new Date(data.icaAgreedAt),
        submissionIp:   ip,
      },
    });

    sendApplicationNotification(app).catch(console.error);

    return NextResponse.json({ id: app.id }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("[POST /api/agent-applications]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```powershell
pnpm --filter web test agent-applications
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/app/api/agent-applications/route.ts apps/web/src/__tests__/api/agent-applications.test.ts
git commit -m "feat: POST /api/agent-applications with reCAPTCHA + Zod validation"
```

---

## Task 4: Install reCAPTCHA package

**Files:**
- `apps/web/package.json` (modified by pnpm)

- [ ] **Step 1: Install `react-google-recaptcha-v3`**

```powershell
pnpm --filter web add react-google-recaptcha-v3
```

Expected: package added, `apps/web/package.json` updated.

- [ ] **Step 2: Commit**

```powershell
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat: add react-google-recaptcha-v3"
```

---

## Task 5: ApplicationForm component

**Files:**
- Create: `apps/web/src/components/join/ApplicationForm.tsx`

**Interfaces:**
- Consumes: `POST /api/agent-applications`; `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` env var
- Produces: `<ApplicationForm />` — self-contained form, shows success state on submit

- [ ] **Step 1: Create the form component**

Create `apps/web/src/components/join/ApplicationForm.tsx`:

```typescript
"use client";

import { useState, useCallback } from "react";
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from "react-google-recaptcha-v3";

const SPECIALTIES = [
  "Residential","Commercial","Luxury","Investment",
  "First-Time Buyers","Relocation","New Construction","Short Sales",
] as const;

const inputClass =
  "w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-3 text-sm text-[#1B1B1B] placeholder-[#1B1B1B]/40 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/40";
const labelClass =
  "mb-1 block text-xs font-medium text-[#1B1B1B]/60 uppercase tracking-wide text-left";
const sectionClass = "mb-10";
const sectionHeadingClass =
  "mb-6 font-sans text-base font-medium uppercase tracking-widest text-[#9E8C61]";

type LicenseType = "SALESPERSON" | "BROKER_ASSOCIATE";
type CommissionEntity = "PERSONAL" | "LLC" | "S_CORP" | "C_CORP";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  dateOfBirth: string;
  licenseNumber: string;
  licenseType: LicenseType | "";
  licenseExpDate: string;
  yearsLicensed: string;
  formerBrokerage: string;
  boardOfRealtors: string;
  mlsId: string;
  hasActiveListings: boolean | null;
  hasActiveSales: boolean | null;
  commissionEntity: CommissionEntity | "";
  hasDisciplinaryHistory: boolean | null;
  disciplinaryExplain: string;
  hasInvestigationHistory: boolean | null;
  investigationExplain: string;
  backgroundCheckConsent: boolean;
  specialties: string[];
  bio: string;
  instagramUrl: string;
  facebookUrl: string;
  icaAgreed: boolean;
  drePerJuryCert: boolean;
}

const INITIAL: FormState = {
  firstName: "", lastName: "", email: "", phone: "",
  address: "", city: "", state: "CA", zip: "", dateOfBirth: "",
  licenseNumber: "", licenseType: "", licenseExpDate: "", yearsLicensed: "",
  formerBrokerage: "", boardOfRealtors: "", mlsId: "",
  hasActiveListings: null, hasActiveSales: null,
  commissionEntity: "",
  hasDisciplinaryHistory: null, disciplinaryExplain: "",
  hasInvestigationHistory: null, investigationExplain: "",
  backgroundCheckConsent: false,
  specialties: [], bio: "", instagramUrl: "", facebookUrl: "",
  icaAgreed: false, drePerJuryCert: false,
};

function FormInner() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [icaOpened, setIcaOpened] = useState(false);
  const [icaOpenedAt, setIcaOpenedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { executeRecaptcha } = useGoogleReCaptcha();

  const set = (field: keyof FormState, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleSpecialty = (s: string) =>
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(s)
        ? prev.specialties.filter((x) => x !== s)
        : [...prev.specialties, s],
    }));

  const handleIcaClick = () => {
    if (!icaOpened) {
      setIcaOpened(true);
      setIcaOpenedAt(new Date().toISOString());
    }
    window.open("/join/ica", "_blank");
  };

  const handleSubmit = useCallback(async () => {
    setError(null);

    // Basic client-side validation
    if (!form.firstName || !form.lastName || !form.email || !form.phone) {
      setError("Please fill out all required personal information fields.");
      return;
    }
    if (!/^\d{8}$/.test(form.licenseNumber)) {
      setError("CA DRE License Number must be exactly 8 digits.");
      return;
    }
    if (!form.licenseType || !form.licenseExpDate || !form.yearsLicensed || !form.formerBrokerage) {
      setError("Please fill out all required license information fields.");
      return;
    }
    if (form.hasActiveListings === null || form.hasActiveSales === null) {
      setError("Please answer both transfer questions.");
      return;
    }
    if (!form.commissionEntity) {
      setError("Please select your commission deposit type.");
      return;
    }
    if (form.hasDisciplinaryHistory === null || form.hasInvestigationHistory === null) {
      setError("Please answer all background disclosure questions.");
      return;
    }
    if (!form.backgroundCheckConsent) {
      setError("Background check consent is required.");
      return;
    }
    if (!icaOpened) {
      setError("Please read the ICA before agreeing to it.");
      return;
    }
    if (!form.icaAgreed) {
      setError("You must agree to the Independent Contractor Agreement.");
      return;
    }
    if (!form.drePerJuryCert) {
      setError("DRE perjury certification is required.");
      return;
    }

    if (!executeRecaptcha) {
      setError("reCAPTCHA not ready. Please try again.");
      return;
    }

    setSubmitting(true);
    try {
      const recaptchaToken = await executeRecaptcha("agent_application");
      const icaAgreedAt = new Date().toISOString();

      const res = await fetch("/api/agent-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          yearsLicensed: parseInt(form.yearsLicensed, 10) || 0,
          icaOpenedAt,
          icaAgreedAt,
          recaptchaToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [form, icaOpened, icaOpenedAt, executeRecaptcha]);

  if (success) {
    return (
      <div className="py-16 text-center">
        <p className="font-sans text-2xl font-light text-[#1B1B1B]">Application submitted!</p>
        <p className="mt-3 font-sans text-sm text-[#1B1B1B]/60">
          We&apos;ll review your application and be in touch within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-2 font-sans text-3xl font-light text-[#1B1B1B]">Apply to Join CnC Realty</h1>
      <p className="mb-10 font-sans text-sm text-[#1B1B1B]/50">
        All fields marked * are required.
      </p>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* ── Section 1: Personal Information ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>01 — Personal Information</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>First Name *</label>
            <input className={inputClass} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Last Name *</label>
            <input className={inputClass} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Email *</label>
            <input className={inputClass} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Cell Phone *</label>
            <input className={inputClass} type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="5551234567" />
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>Street Address *</label>
          <input className={inputClass} value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>City *</label>
            <input className={inputClass} value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>State *</label>
            <input className={inputClass} value={form.state} onChange={(e) => set("state", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>ZIP Code *</label>
            <input className={inputClass} value={form.zip} onChange={(e) => set("zip", e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>Date of Birth *</label>
          <input className={inputClass} type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
        </div>
      </div>

      {/* ── Section 2: License Information ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>02 — License Information</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>CA DRE License # *</label>
            <input className={inputClass} value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} placeholder="01234567" />
          </div>
          <div>
            <label className={labelClass}>License Expiration Date *</label>
            <input className={inputClass} type="date" value={form.licenseExpDate} onChange={(e) => set("licenseExpDate", e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>License Type *</label>
          <div className="mt-2 flex gap-6">
            {(["SALESPERSON", "BROKER_ASSOCIATE"] as LicenseType[]).map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 font-sans text-sm text-[#1B1B1B]">
                <input
                  type="radio"
                  name="licenseType"
                  value={t}
                  checked={form.licenseType === t}
                  onChange={() => set("licenseType", t)}
                  className="accent-[#9E8C61]"
                />
                {t === "SALESPERSON" ? "Salesperson" : "Broker Associate"}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Years Licensed *</label>
            <input className={inputClass} type="number" min={0} value={form.yearsLicensed} onChange={(e) => set("yearsLicensed", e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className={labelClass}>Former Brokerage *</label>
            <input className={inputClass} value={form.formerBrokerage} onChange={(e) => set("formerBrokerage", e.target.value)} placeholder="Current or most recent brokerage" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Board of Realtors</label>
            <input className={inputClass} value={form.boardOfRealtors} onChange={(e) => set("boardOfRealtors", e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className={labelClass}>MLS ID</label>
            <input className={inputClass} value={form.mlsId} onChange={(e) => set("mlsId", e.target.value)} placeholder="Optional" />
          </div>
        </div>
      </div>

      {/* ── Section 3: Active Listings & Sales ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>03 — Active Listings & Sales</p>
        <p className="mb-4 font-sans text-sm text-[#1B1B1B]/50">
          If yes, your current broker will need to release them to CnC Realty.
        </p>
        {(
          [
            { field: "hasActiveListings", label: "Do you have active listings to transfer? *" },
            { field: "hasActiveSales", label: "Do you have pending sales to transfer? *" },
          ] as const
        ).map(({ field, label }) => (
          <div key={field} className="mb-4">
            <label className={labelClass}>{label}</label>
            <div className="mt-2 flex gap-6">
              {([true, false] as const).map((val) => (
                <label key={String(val)} className="flex cursor-pointer items-center gap-2 font-sans text-sm text-[#1B1B1B]">
                  <input
                    type="radio"
                    name={field}
                    checked={form[field] === val}
                    onChange={() => set(field, val)}
                    className="accent-[#9E8C61]"
                  />
                  {val ? "Yes" : "No"}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Section 4: Business & Tax ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>04 — Business & Tax Information</p>
        <p className="mb-4 font-sans text-sm text-[#1B1B1B]/50">
          Required for W-9 purposes. A W-9 will be sent separately after approval.
        </p>
        <label className={labelClass}>Commission payments deposited to *</label>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {(
            [
              { value: "PERSONAL", label: "Personal Account" },
              { value: "LLC", label: "LLC" },
              { value: "S_CORP", label: "S Corporation" },
              { value: "C_CORP", label: "C Corporation" },
            ] as { value: CommissionEntity; label: string }[]
          ).map(({ value, label }) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 font-sans text-sm text-[#1B1B1B]">
              <input
                type="radio"
                name="commissionEntity"
                value={value}
                checked={form.commissionEntity === value}
                onChange={() => set("commissionEntity", value)}
                className="accent-[#9E8C61]"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* ── Section 5: Background & Disclosures ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>05 — Background & Disclosures</p>
        <div className="mb-4">
          <label className={labelClass}>
            Have you ever been disciplined by any Local, State, or Federal entity? *
          </label>
          <div className="mt-2 flex gap-6">
            {([true, false] as const).map((val) => (
              <label key={String(val)} className="flex cursor-pointer items-center gap-2 font-sans text-sm text-[#1B1B1B]">
                <input
                  type="radio"
                  name="hasDisciplinaryHistory"
                  checked={form.hasDisciplinaryHistory === val}
                  onChange={() => set("hasDisciplinaryHistory", val)}
                  className="accent-[#9E8C61]"
                />
                {val ? "Yes" : "No"}
              </label>
            ))}
          </div>
          {form.hasDisciplinaryHistory === true && (
            <textarea
              className={`${inputClass} mt-3 resize-none`}
              rows={3}
              placeholder="Please explain..."
              value={form.disciplinaryExplain}
              onChange={(e) => set("disciplinaryExplain", e.target.value)}
            />
          )}
        </div>
        <div className="mb-4">
          <label className={labelClass}>
            Are you currently under investigation or prosecution by the DRE or any government agency? *
          </label>
          <div className="mt-2 flex gap-6">
            {([true, false] as const).map((val) => (
              <label key={String(val)} className="flex cursor-pointer items-center gap-2 font-sans text-sm text-[#1B1B1B]">
                <input
                  type="radio"
                  name="hasInvestigationHistory"
                  checked={form.hasInvestigationHistory === val}
                  onChange={() => set("hasInvestigationHistory", val)}
                  className="accent-[#9E8C61]"
                />
                {val ? "Yes" : "No"}
              </label>
            ))}
          </div>
          {form.hasInvestigationHistory === true && (
            <textarea
              className={`${inputClass} mt-3 resize-none`}
              rows={3}
              placeholder="Please explain..."
              value={form.investigationExplain}
              onChange={(e) => set("investigationExplain", e.target.value)}
            />
          )}
        </div>
        <label className="flex cursor-pointer items-start gap-3 font-sans text-sm text-[#1B1B1B]">
          <input
            type="checkbox"
            checked={form.backgroundCheckConsent}
            onChange={(e) => set("backgroundCheckConsent", e.target.checked)}
            className="mt-0.5 accent-[#9E8C61]"
          />
          I consent to CnC Realty performing a background check before or after onboarding. *
        </label>
      </div>

      {/* ── Section 6: Specialties & Bio ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>06 — Specialties & Bio (Optional)</p>
        <div>
          <label className={labelClass}>Specialties</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {SPECIALTIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSpecialty(s)}
                className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                  form.specialties.includes(s)
                    ? "bg-[#9E8C61] text-white"
                    : "border border-[#1B1B1B]/15 bg-[#F2F0EF] text-[#1B1B1B]/70 hover:border-[#9E8C61]/50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>Bio</label>
          <textarea
            className={`${inputClass} resize-none`}
            rows={4}
            placeholder="Tell clients a bit about yourself…"
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Instagram URL</label>
            <input className={inputClass} type="url" value={form.instagramUrl} onChange={(e) => set("instagramUrl", e.target.value)} placeholder="https://instagram.com/username" />
          </div>
          <div>
            <label className={labelClass}>Facebook URL</label>
            <input className={inputClass} type="url" value={form.facebookUrl} onChange={(e) => set("facebookUrl", e.target.value)} placeholder="https://facebook.com/username" />
          </div>
        </div>
      </div>

      {/* ── Section 7: ICA Review & Agreement ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>07 — Independent Contractor Agreement</p>
        <p className="mb-4 font-sans text-sm text-[#1B1B1B]/50">
          Please read the CnC Realty ICA before agreeing below.
        </p>
        <button
          type="button"
          onClick={handleIcaClick}
          className="mb-4 inline-flex items-center gap-1 rounded-full border border-[#9E8C61] px-5 py-2.5 font-sans text-sm font-medium text-[#9E8C61] transition-colors hover:bg-[#9E8C61]/5"
        >
          Read the CnC Realty ICA →
        </button>
        {icaOpened && (
          <p className="mb-3 font-sans text-xs text-[#1B1B1B]/40">
            Opened at {new Date(icaOpenedAt!).toLocaleTimeString()}
          </p>
        )}
        <label
          className={`flex cursor-pointer items-start gap-3 font-sans text-sm ${
            !icaOpened ? "cursor-not-allowed opacity-40" : "text-[#1B1B1B]"
          }`}
        >
          <input
            type="checkbox"
            disabled={!icaOpened}
            checked={form.icaAgreed}
            onChange={(e) => set("icaAgreed", e.target.checked)}
            className="mt-0.5 accent-[#9E8C61]"
          />
          I have read and agree to the CnC Realty Independent Contractor Agreement. *
        </label>
      </div>

      {/* ── Section 8: DRE Perjury Certification ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>08 — DRE Certification</p>
        <label className="flex cursor-pointer items-start gap-3 font-sans text-sm text-[#1B1B1B]">
          <input
            type="checkbox"
            checked={form.drePerJuryCert}
            onChange={(e) => set("drePerJuryCert", e.target.checked)}
            className="mt-0.5 flex-shrink-0 accent-[#9E8C61]"
          />
          <span>
            I certify under penalty of perjury that all information provided in this application is true
            and correct, and that I am not under investigation or prosecution by the DRE, State of
            California, any Realtor Association, MLS, or any government entity for acts including but not
            limited to complaints, ethics violations, fraud, misconduct, or misrepresentation. *
          </span>
        </label>
      </div>

      {/* ── Submit ── */}
      <div className="mt-2">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-full bg-[#1B1B1B] py-4 font-sans text-sm font-medium text-white transition-colors hover:bg-[#1B1B1B]/85 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit Application"}
        </button>
        <p className="mt-3 text-center font-sans text-xs text-[#1B1B1B]/40">
          This site is protected by reCAPTCHA.
        </p>
      </div>
    </div>
  );
}

export function ApplicationForm() {
  return (
    <GoogleReCaptchaProvider reCaptchaKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ""}>
      <FormInner />
    </GoogleReCaptchaProvider>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add apps/web/src/components/join/ApplicationForm.tsx
git commit -m "feat: ApplicationForm component — 9 sections, ICA gate, reCAPTCHA"
```

---

## Task 6: Public /join/apply page

**Files:**
- Create: `apps/web/src/app/(marketing)/join/apply/page.tsx`

**Interfaces:**
- Consumes: `<ApplicationForm />`
- Produces: public route `/join/apply` — no auth required

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/(marketing)/join/apply/page.tsx`:

```typescript
import type { Metadata } from "next";
import { ApplicationForm } from "@/components/join/ApplicationForm";

export const metadata: Metadata = {
  title: "Apply to Join | CnC Realty",
  description: "Apply to join CnC Realty. 100% commission, $0 monthly fees, E&O included.",
};

export default function ApplyPage() {
  return (
    <main data-navbar-theme="light" className="min-h-screen bg-[#F2F0EF]">
      <ApplicationForm />
    </main>
  );
}
```

- [ ] **Step 2: Verify the page loads**

Start dev server (`pnpm --filter web dev`) and open `http://localhost:3000/join/apply`. The form should render all 9 sections. No auth prompt should appear.

- [ ] **Step 3: Commit**

```powershell
git add apps/web/src/app/(marketing)/join/apply/page.tsx
git commit -m "feat: public /join/apply page"
```

---

## Task 7: Admin applications queue

**Files:**
- Create: `apps/web/src/app/(dashboard)/admin/applications/page.tsx`
- Create: `apps/web/src/app/(dashboard)/admin/applications/ApplicationsClient.tsx`

**Interfaces:**
- Consumes: `prisma.agentApplication.findMany`; `requireAdminPage()`
- Produces: `/admin/applications` — table of applications filterable by status

- [ ] **Step 1: Create the client component**

Create `apps/web/src/app/(dashboard)/admin/applications/ApplicationsClient.tsx`:

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

type Application = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  licenseNumber: string;
  licenseType: string;
  status: string;
  createdAt: Date;
};

const STATUS_BADGE: Record<string, string> = {
  PENDING:  "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export function ApplicationsClient({ applications }: { applications: Application[] }) {
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");

  const filtered = filter === "ALL" ? applications : applications.filter((a) => a.status === filter);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              filter === s
                ? "bg-[#1B1B1B] text-white"
                : "border border-[#1B1B1B]/15 text-[#1B1B1B]/60 hover:border-[#1B1B1B]/30"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center font-sans text-sm text-[#1B1B1B]/40">No applications.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#1B1B1B]/10">
          <table className="w-full text-sm">
            <thead className="border-b border-[#1B1B1B]/10 bg-[#F2F0EF]">
              <tr>
                {["Name", "Email", "License #", "Type", "Submitted", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1B1B1B]/5 bg-white">
              {filtered.map((app) => (
                <tr key={app.id} className="hover:bg-[#F2F0EF]/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/applications/${app.id}`} className="font-medium text-[#1B1B1B] hover:text-[#9E8C61]">
                      {app.firstName} {app.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#1B1B1B]/60">{app.email}</td>
                  <td className="px-4 py-3 text-[#1B1B1B]/60">{app.licenseNumber}</td>
                  <td className="px-4 py-3 text-[#1B1B1B]/60">
                    {app.licenseType === "SALESPERSON" ? "Salesperson" : "Broker Assoc."}
                  </td>
                  <td className="px-4 py-3 text-[#1B1B1B]/60">{formatDate(app.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[app.status] ?? ""}`}>
                      {app.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the server page**

Create `apps/web/src/app/(dashboard)/admin/applications/page.tsx`:

```typescript
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/server-utils";
import { ApplicationsClient } from "./ApplicationsClient";

export const metadata = { title: "Agent Applications | CnC Realty Admin" };

export default async function AdminApplicationsPage() {
  await requireAdminPage();

  let applications: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    licenseNumber: string;
    licenseType: string;
    status: string;
    createdAt: Date;
  }[] = [];

  try {
    applications = await prisma.agentApplication.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        licenseNumber: true,
        licenseType: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    // DB unreachable — show empty state
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Agent Applications</h1>
      </div>
      <ApplicationsClient applications={applications} />
    </div>
  );
}
```

- [ ] **Step 3: Add applications link to admin nav**

Open `apps/web/src/app/(dashboard)/admin/page.tsx` (or the admin sidebar/nav component) and verify there is a link to `/admin/applications`. If not, add it wherever other admin nav links are defined.

- [ ] **Step 4: Commit**

```powershell
git add apps/web/src/app/(dashboard)/admin/applications/
git commit -m "feat: admin applications queue page with status filter"
```

---

## Task 8: Admin application detail + approve/reject API

**Files:**
- Create: `apps/web/src/app/(dashboard)/admin/applications/[id]/page.tsx`
- Create: `apps/web/src/app/api/agent-applications/[id]/approve/route.ts`
- Create: `apps/web/src/app/api/agent-applications/[id]/reject/route.ts`

**Interfaces:**
- Consumes: `prisma.agentApplication.findUnique`; `sendApplicationApproved`; `sendApplicationRejected`; `bcrypt`
- Produces:
  - `GET /admin/applications/[id]` — full application detail with audit trail + approve/reject controls
  - `POST /api/agent-applications/[id]/approve` → `{ ok: true }` on 200
  - `POST /api/agent-applications/[id]/reject` → `{ ok: true }` on 200

- [ ] **Step 1: Create approve API route**

Create `apps/web/src/app/api/agent-applications/[id]/approve/route.ts`:

```typescript
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { sendApplicationApproved } from "@/lib/email";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("ADMIN");
  if (error) return error;

  const app = await prisma.agentApplication.findUnique({ where: { id: params.id } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (app.status !== "PENDING") {
    return NextResponse.json({ error: "Application already processed" }, { status: 409 });
  }

  // Generate setup token (expires 72h)
  const setupToken = randomBytes(32).toString("hex");
  const setupTokenExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

  // Build slug from name — append random suffix to avoid collisions
  const baseSlug = `${app.firstName}-${app.lastName}`.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const slug = `${baseSlug}-${randomBytes(3).toString("hex")}`;

  // Temporary random password (agent will reset via setup link)
  const tempPassword = await bcrypt.hash(randomBytes(16).toString("hex"), 10);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: app.email,
        name: `${app.firstName} ${app.lastName}`,
        password: tempPassword,
        role: "AGENT",
        setupToken,
        setupTokenExpiry,
      },
    });

    await tx.agent.create({
      data: {
        userId: user.id,
        slug,
        displayName: `${app.firstName} ${app.lastName}`,
        phone: app.phone,
        licenseNum: app.licenseNumber,
        licenseState: "CA",
        yearsExp: app.yearsLicensed,
        specialties: app.specialties,
        bio: app.bio ?? undefined,
        instagram: app.instagramUrl ?? undefined,
        facebook: app.facebookUrl ?? undefined,
      },
    });

    await tx.agentApplication.update({
      where: { id: params.id },
      data: {
        status: "APPROVED",
        reviewedBy: session.user.email,
        reviewedAt: new Date(),
      },
    });
  });

  const setupUrl = `${process.env.NEXTAUTH_URL}/setup-account?token=${setupToken}`;
  sendApplicationApproved(app.email, app.firstName, setupUrl).catch(console.error);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create reject API route**

Create `apps/web/src/app/api/agent-applications/[id]/reject/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { sendApplicationRejected } from "@/lib/email";

const schema = z.object({
  reason: z.string().min(1, "Rejection reason required"),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAuth("ADMIN");
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const app = await prisma.agentApplication.findUnique({ where: { id: params.id } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (app.status !== "PENDING") {
    return NextResponse.json({ error: "Application already processed" }, { status: 409 });
  }

  await prisma.agentApplication.update({
    where: { id: params.id },
    data: {
      status: "REJECTED",
      rejectionReason: parsed.data.reason,
      reviewedBy: session.user.email,
      reviewedAt: new Date(),
    },
  });

  sendApplicationRejected(app.email, app.firstName, parsed.data.reason).catch(console.error);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create the detail page**

Create `apps/web/src/app/(dashboard)/admin/applications/[id]/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";

type ApplicationDetail = {
  id: string; status: string; createdAt: string;
  firstName: string; lastName: string; email: string; phone: string;
  address: string; city: string; state: string; zip: string; dateOfBirth: string;
  licenseNumber: string; licenseType: string; licenseExpDate: string;
  yearsLicensed: number; formerBrokerage: string; boardOfRealtors: string | null;
  mlsId: string | null; hasActiveListings: boolean; hasActiveSales: boolean;
  commissionEntity: string;
  hasDisciplinaryHistory: boolean; disciplinaryExplain: string | null;
  hasInvestigationHistory: boolean; investigationExplain: string | null;
  backgroundCheckConsent: boolean; drePerJuryCert: boolean;
  specialties: string[]; bio: string | null;
  icaOpenedAt: string; icaAgreedAt: string; submissionIp: string;
  reviewedBy: string | null; reviewedAt: string | null; rejectionReason: string | null;
};

const ENTITY_LABELS: Record<string, string> = {
  PERSONAL: "Personal Account", LLC: "LLC", S_CORP: "S Corporation", C_CORP: "C Corporation",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 border-b border-[#1B1B1B]/5">
      <span className="w-48 shrink-0 text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/40">{label}</span>
      <span className="text-sm text-[#1B1B1B]/80">{value ?? "—"}</span>
    </div>
  );
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/agent-applications/${id}`)
      .then((r) => r.json())
      .then((d) => setApp(d))
      .catch(() => setApp(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleApprove = async () => {
    if (!confirm("Approve this application and create the agent account?")) return;
    setActing(true); setActionError(null);
    const res = await fetch(`/api/agent-applications/${id}/approve`, { method: "POST" });
    if (res.ok) { router.push("/admin/applications"); }
    else { const d = await res.json(); setActionError(d.error); setActing(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { setActionError("Please enter a rejection reason."); return; }
    setActing(true); setActionError(null);
    const res = await fetch(`/api/agent-applications/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    if (res.ok) { router.push("/admin/applications"); }
    else { const d = await res.json(); setActionError(d.error); setActing(false); }
  };

  if (loading) return <div className="py-12 text-center text-sm text-[#1B1B1B]/40">Loading…</div>;
  if (!app) return <div className="py-12 text-center text-sm text-red-500">Application not found.</div>;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">
          {app.firstName} {app.lastName}
        </h1>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
          app.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
          app.status === "APPROVED" ? "bg-green-100 text-green-800" :
          "bg-red-100 text-red-800"
        }`}>{app.status}</span>
      </div>

      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm space-y-0">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[#9E8C61]">Personal</p>
        <Row label="Email" value={app.email} />
        <Row label="Phone" value={app.phone} />
        <Row label="Address" value={`${app.address}, ${app.city}, ${app.state} ${app.zip}`} />
        <Row label="Date of Birth" value={app.dateOfBirth} />

        <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-[#9E8C61]">License</p>
        <Row label="DRE License #" value={app.licenseNumber} />
        <Row label="License Type" value={app.licenseType === "SALESPERSON" ? "Salesperson" : "Broker Associate"} />
        <Row label="Expiration Date" value={app.licenseExpDate} />
        <Row label="Years Licensed" value={app.yearsLicensed} />
        <Row label="Former Brokerage" value={app.formerBrokerage} />
        <Row label="Board of Realtors" value={app.boardOfRealtors} />
        <Row label="MLS ID" value={app.mlsId} />

        <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-[#9E8C61]">Transfers</p>
        <Row label="Active Listings" value={app.hasActiveListings ? "Yes" : "No"} />
        <Row label="Pending Sales" value={app.hasActiveSales ? "Yes" : "No"} />

        <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-[#9E8C61]">Tax / Business</p>
        <Row label="Commission Entity" value={ENTITY_LABELS[app.commissionEntity] ?? app.commissionEntity} />

        <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-[#9E8C61]">Background</p>
        <Row label="Disciplinary History" value={app.hasDisciplinaryHistory ? `Yes — ${app.disciplinaryExplain}` : "No"} />
        <Row label="DRE Investigation" value={app.hasInvestigationHistory ? `Yes — ${app.investigationExplain}` : "No"} />
        <Row label="Background Check Consent" value={app.backgroundCheckConsent ? "Yes" : "No"} />
        <Row label="DRE Perjury Cert" value={app.drePerJuryCert ? "Certified" : "No"} />

        <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-[#9E8C61]">ICA Audit Trail</p>
        <Row label="ICA Opened At" value={new Date(app.icaOpenedAt).toLocaleString()} />
        <Row label="ICA Agreed At" value={new Date(app.icaAgreedAt).toLocaleString()} />
        <Row label="Submission IP" value={app.submissionIp} />

        {app.specialties.length > 0 && (
          <>
            <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-[#9E8C61]">Profile</p>
            <Row label="Specialties" value={app.specialties.join(", ")} />
            {app.bio && <Row label="Bio" value={app.bio} />}
          </>
        )}

        {app.status !== "PENDING" && (
          <>
            <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-[#9E8C61]">Review</p>
            <Row label="Reviewed By" value={app.reviewedBy} />
            <Row label="Reviewed At" value={app.reviewedAt ? new Date(app.reviewedAt).toLocaleString() : null} />
            {app.rejectionReason && <Row label="Rejection Reason" value={app.rejectionReason} />}
          </>
        )}
      </div>

      {app.status === "PENDING" && (
        <div className="space-y-3">
          {actionError && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{actionError}</p>
          )}
          <button
            onClick={handleApprove}
            disabled={acting}
            className="w-full rounded-full bg-[#9E8C61] py-3 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8a7a52] disabled:opacity-60"
          >
            Approve & Create Account
          </button>
          {!showReject ? (
            <button
              onClick={() => setShowReject(true)}
              className="w-full rounded-full border border-red-200 py-3 font-sans text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
            >
              Reject
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                rows={3}
                placeholder="Reason for rejection (sent to applicant)…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={acting}
                  className="flex-1 rounded-full bg-red-500 py-3 font-sans text-sm font-medium text-white disabled:opacity-60"
                >
                  Confirm Rejection
                </button>
                <button
                  onClick={() => setShowReject(false)}
                  className="rounded-full border border-[#1B1B1B]/15 px-6 py-3 font-sans text-sm text-[#1B1B1B]/60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create the GET /api/agent-applications/[id] route (needed by the detail page)**

Create `apps/web/src/app/api/agent-applications/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const app = await prisma.agentApplication.findUnique({ where: { id: params.id } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(app);
}
```

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/app/(dashboard)/admin/applications/[id]/ apps/web/src/app/api/agent-applications/
git commit -m "feat: admin application detail page + approve/reject API routes"
```

---

## Task 9: Password setup flow

**Files:**
- Create: `apps/web/src/app/(marketing)/setup-account/page.tsx`
- Create: `apps/web/src/app/api/setup-account/route.ts`

**Interfaces:**
- Consumes: `User.setupToken`, `User.setupTokenExpiry`; `bcrypt`
- Produces:
  - `GET /setup-account?token=…` — password entry form
  - `POST /api/setup-account` `{ token, password }` → `{ ok: true }` on 200; clears token + sets password

- [ ] **Step 1: Create the setup-account API route**

Create `apps/web/src/app/api/setup-account/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  token:    z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, password } = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { setupToken: token } });
    if (!user || !user.setupTokenExpiry || user.setupTokenExpiry < new Date()) {
      return NextResponse.json({ error: "This link has expired or is invalid. Please contact info@cncrealtygroup.com." }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, setupToken: null, setupTokenExpiry: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("[POST /api/setup-account]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create the setup-account page**

Create `apps/web/src/app/(marketing)/setup-account/page.tsx`:

```typescript
"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-3 text-sm text-[#1B1B1B] focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/40";

function SetupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (!token) { setError("Invalid setup link."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/setup-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <p className="text-center text-sm text-red-500">
        Invalid setup link. Please contact{" "}
        <a href="mailto:info@cncrealtygroup.com" className="underline">info@cncrealtygroup.com</a>.
      </p>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <p className="font-sans text-xl font-light text-[#1B1B1B]">Password set!</p>
        <p className="mt-2 text-sm text-[#1B1B1B]/60">Redirecting to login…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-5">
      <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Set your password</h1>
      <p className="text-sm text-[#1B1B1B]/50">Choose a password for your CnC Realty account.</p>
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/60 text-left">Password</label>
        <input
          className={inputClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 characters"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/60 text-left">Confirm Password</label>
        <input
          className={inputClass}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-full bg-[#9E8C61] py-3 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8a7a52] disabled:opacity-60"
      >
        {submitting ? "Setting password…" : "Set Password & Continue"}
      </button>
    </div>
  );
}

export default function SetupAccountPage() {
  return (
    <main data-navbar-theme="light" className="flex min-h-screen items-center justify-center bg-[#F2F0EF] px-4">
      <Suspense fallback={<p className="text-sm text-[#1B1B1B]/40">Loading…</p>}>
        <SetupForm />
      </Suspense>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```powershell
git add apps/web/src/app/(marketing)/setup-account/ apps/web/src/app/api/setup-account/
git commit -m "feat: agent password setup flow — token-gated /setup-account page + API"
```

---

## Task 10: Button href updates + remove old route

**Files:**
- Modify: `apps/web/src/components/join/AgentPlan.tsx:96`
- Modify: `apps/web/src/components/join/HowToJoin.tsx:48`
- Delete: `apps/web/src/app/(agents)/join/agent/page.tsx`

- [ ] **Step 1: Update AgentPlan.tsx**

In `apps/web/src/components/join/AgentPlan.tsx`, change line 96:

```typescript
// Before:
href="/join/agent"
// After:
href="/join/apply"
```

- [ ] **Step 2: Update HowToJoin.tsx**

In `apps/web/src/components/join/HowToJoin.tsx`, change line 48:

```typescript
// Before:
href="/join/agent"
// After:
href="/join/apply"
```

- [ ] **Step 3: Delete the old onboarding page**

```powershell
Remove-Item "apps/web/src/app/(agents)/join/agent/page.tsx"
```

If the `(agents)/join/agent/` directory is now empty, remove the directory too:

```powershell
Remove-Item -Recurse "apps/web/src/app/(agents)/join/agent"
```

- [ ] **Step 4: Verify no remaining references to /join/agent**

```powershell
cd C:\Users\hey_r\Desktop\CnC-Realty
grep -r "/join/agent" apps/web/src --include="*.tsx" --include="*.ts"
```

Expected: no output.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: update all join buttons to /join/apply, remove old /join/agent page"
```

---

## Task 11: End-to-end smoke test

- [ ] **Step 1: Start the dev server**

```powershell
pnpm --filter web dev
```

- [ ] **Step 2: Test the application form**

1. Open `http://localhost:3000/join/apply` — confirm no auth redirect
2. Submit with empty fields — confirm validation error appears
3. Enter a license number that isn't 8 digits — confirm "must be exactly 8 digits" error
4. Click "Read the CnC Realty ICA →" — confirm it opens in a new tab and the ICA checkbox becomes enabled
5. Fill all required fields, check all required checkboxes, submit — confirm success message appears
6. Check Railway/local DB: `AgentApplication` row should exist with `status: PENDING` and `icaOpenedAt`/`icaAgreedAt`/`submissionIp` populated

- [ ] **Step 3: Test admin queue**

1. Log in as admin, go to `http://localhost:3000/admin/applications`
2. Confirm new application appears in Pending tab
3. Click into it — confirm all fields + ICA audit trail display correctly
4. Click "Approve & Create Account" — confirm redirected back to queue, application now shows APPROVED
5. Check DB: `User` row created with role AGENT, `Agent` row created, `setupToken` set

- [ ] **Step 4: Test password setup**

1. Copy the `setupToken` from the DB (or check Ryan's inbox if SendGrid configured)
2. Open `http://localhost:3000/setup-account?token=<token>`
3. Enter a password and confirm — confirm redirect to `/login`
4. Log in with the new agent's email + password — confirm dashboard access

- [ ] **Step 5: Test rejection flow**

1. Submit another test application
2. In admin, click Reject, enter a reason, confirm rejection
3. Application status → REJECTED, rejection reason visible in detail view

- [ ] **Step 6: Run full test suite**

```powershell
pnpm --filter web test
```

Expected: all tests pass including the 5 new agent-applications tests.

- [ ] **Step 7: Commit session notes to CLAUDE.md and final commit**

```powershell
git add -A
git commit -m "feat: agent application redesign complete — public /join/apply, admin queue, approve/reject, password setup"
```
