# Agent Application Redesign — Design Spec

**Date:** 2026-06-29
**Status:** Approved for implementation planning

---

## Goal

Replace the current auth-gated 4-step agent onboarding form with a public single-page application at `/join/apply`. The application collects all legally required information, embeds the ICA for inline signing via HelloSign, and routes submissions to an admin approval queue. Agent accounts are created only after Ryan approves and countersigns the ICA.

---

## Architecture

### New route: `/join/apply` (public, no auth required)

- Accessible directly via URL — shareable link for agent-to-agent referrals
- All existing "Apply Now" / "Get Started" / "Apply" buttons on the join page point here
- Replaces `/join/agent` entirely (that route is removed)

### New DB table: `AgentApplication`

Stores submitted applications in a `PENDING` state until approved or rejected.

```prisma
model AgentApplication {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  status          ApplicationStatus @default(PENDING)

  // Personal
  firstName       String
  lastName        String
  email           String
  phone           String
  address         String
  city            String
  state           String
  zip             String
  dateOfBirth     String

  // License
  licenseNumber   String
  licenseType     LicenseType       // SALESPERSON | BROKER_ASSOCIATE
  licenseExpDate  String
  yearsLicensed   Int
  formerBrokerage String
  boardOfRealtors String?
  mlsId           String?

  // Transfer
  hasActiveListings  Boolean
  hasActiveSales     Boolean

  // Business / Tax
  commissionEntity   CommissionEntity  // PERSONAL | LLC | S_CORP | C_CORP

  // Background / Legal
  hasDisciplinaryHistory  Boolean
  disciplinaryExplain     String?
  hasInvestigationHistory Boolean
  investigationExplain    String?
  backgroundCheckConsent  Boolean

  // DRE perjury certification
  drePerJuryCert   Boolean

  // Specialties + bio (profile, carries over to Agent on approval)
  specialties      String[]
  bio              String?
  instagramUrl     String?
  facebookUrl      String?

  // HelloSign
  helloSignRequestId  String?   // set when ICA signing request is created
  icaSignedAt         DateTime? // set via webhook when agent signs

  // Admin
  reviewedBy      String?
  reviewedAt      DateTime?
  rejectionReason String?
}

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

---

## Application Form — Fields

All fields on a single scrollable page, grouped into visual sections. No steps, no pagination.

### Section 1 — Personal Information
| Field | Required | Notes |
|---|---|---|
| First Name | ✅ | |
| Last Name | ✅ | |
| Email | ✅ | Used for account creation on approval |
| Cell Phone | ✅ | |
| Street Address | ✅ | |
| City | ✅ | |
| State | ✅ | Default: CA |
| ZIP Code | ✅ | |
| Date of Birth | ✅ | Identity verification |

### Section 2 — License Information
| Field | Required | Notes |
|---|---|---|
| CA DRE License # | ✅ | |
| License Type | ✅ | Salesperson / Broker Associate — radio |
| License Expiration Date | ✅ | Date picker |
| Years Licensed | ✅ | Number input |
| Former Brokerage | ✅ | Name of current/most recent brokerage |
| Board of Realtors | ❌ | Optional text |
| MLS ID | ❌ | Optional text |

### Section 3 — Active Listings & Sales
| Field | Required | Notes |
|---|---|---|
| Do you have active listings to transfer? | ✅ | Yes / No |
| Do you have pending sales to transfer? | ✅ | Yes / No |

*Explanatory note: "If yes, your current broker will need to release them to CnC Realty."*

### Section 4 — Business & Tax Information
| Field | Required | Notes |
|---|---|---|
| Commission payments deposited to | ✅ | Personal Account / LLC / S-Corp / C-Corp |

*Note: "Required for W-9 purposes. A W-9 will be sent separately."*

### Section 5 — Background & Disclosures
| Field | Required | Notes |
|---|---|---|
| Have you ever been disciplined by any Local, State, or Federal entity? | ✅ | Yes / No — if Yes, explain textarea |
| Are you currently under investigation or prosecution by the DRE or any government agency? | ✅ | Yes / No — if Yes, explain textarea |
| I consent to a background check | ✅ | Checkbox |

### Section 6 — Specialties & Bio (optional profile info)
| Field | Required | Notes |
|---|---|---|
| Specialties | ❌ | Multi-select pill chips (same as current) |
| Bio | ❌ | Textarea |
| Instagram URL | ❌ | |
| Facebook URL | ❌ | |

### Section 7 — ICA Review & Signature
- Renders the CnC ICA as a scrollable read-only document (from `docs/cnc-ica-draft.md` or a PDF embed)
- HelloSign embedded signing widget below the ICA
- Agent signs inline — no redirect to HelloSign

### Section 8 — DRE Perjury Certification
Single mandatory checkbox with the full certification text:

> "I certify under penalty of perjury that all information provided in this application is true and correct, and that I am not under investigation or prosecution by the DRE, State of California, any Realtor Association, MLS, or any government entity for acts including but not limited to complaints, ethics violations, fraud, misconduct, or misrepresentation."

---

## Post-Submission Flow

```
Agent submits form + signs ICA
        ↓
AgentApplication created (status: PENDING)
HelloSign ICA request stored (helloSignRequestId)
Ryan receives email notification
        ↓
Ryan reviews in Admin Dashboard → /admin/applications
        ↓
    APPROVE                     REJECT
        ↓                           ↓
Ryan countersigns ICA         Rejection reason saved
via HelloSign                 Agent notified by email
        ↓
HelloSign webhook fires
        ↓
Agent account created (User + Agent rows)
Password-setup email sent to agent
        ↓
Agent sets password → /dashboard
```

---

## Admin Dashboard — Applications Page

New page at `/admin/applications`:

- Table: applicant name, email, license #, license type, submitted date, status badge
- Click row → full application detail view
- Detail view shows all fields + ICA signing status
- Approve / Reject buttons (reject requires reason input)
- Filter by status: Pending / Approved / Rejected

---

## HelloSign (Dropbox Sign) Integration

**Library:** `@dropbox/sign` (official Node SDK)

**Pricing:** Dropbox Sign API — Free tier (3 requests/month) to start; upgrade to Essentials ($75/month, 50 requests) when volume justifies it. Embedded signing is included on all tiers including free.

**Flow:**
1. On form submit, server creates a Dropbox Sign embedded sign request for the ICA template
2. Client receives a `sign_url` and renders the embedded signing widget in Section 7
3. Agent signs inline — no redirect to Dropbox Sign
4. On approval, Ryan countersigns via Dropbox Sign API (or Dropbox Sign email link)
5. `signature_request_signed` webhook → account creation triggered

**Environment variables needed:**
```
DROPBOX_SIGN_API_KEY=
DROPBOX_SIGN_CLIENT_ID=
DROPBOX_SIGN_ICA_TEMPLATE_ID=
```

---

## Button Updates (all pointing to `/join/apply`)

| Component | Current text | Current href | New text | New href |
|---|---|---|---|---|
| `JoinCTAButtons.tsx` | Join | /join/agent | Apply ✅ | /join/apply ✅ |
| `AgentPlan.tsx` | Get Started | /join/agent | Get Started | /join/apply |
| `HowToJoin.tsx` | Apply Now | /join/agent | Apply Now | /join/apply |

---

## Files

**New:**
- `apps/web/src/app/(marketing)/join/apply/page.tsx` — public application page
- `apps/web/src/components/join/ApplicationForm.tsx` — full form component
- `apps/web/src/app/api/agent-applications/route.ts` — POST: create application + init HelloSign request
- `apps/web/src/app/api/webhooks/hellosign/route.ts` — HelloSign webhook handler
- `apps/web/src/app/(dashboard)/admin/applications/page.tsx` — admin queue
- `apps/web/src/app/(dashboard)/admin/applications/[id]/page.tsx` — application detail + approve/reject
- `apps/web/src/lib/hellosign.ts` — HelloSign SDK singleton + helper functions
- `prisma/migrations/…` — AgentApplication table + enums

**Modified:**
- `apps/web/src/components/join/AgentPlan.tsx` — href: `/join/agent` → `/join/apply`
- `apps/web/src/components/join/HowToJoin.tsx` — href: `/join/agent` → `/join/apply`
- `prisma/schema.prisma` — add AgentApplication model + enums

**Removed:**
- `apps/web/src/app/(agents)/join/agent/page.tsx` — replaced by `/join/apply`

---

## Out of Scope

- Single-page visual design (layout, styling) — to be designed in a separate session
- E&O supplement display changes — separate discussion
- W-9 collection (sent separately after approval, not part of this form)
- SSN/EIN collection (handled via signed W-9, not web form)
