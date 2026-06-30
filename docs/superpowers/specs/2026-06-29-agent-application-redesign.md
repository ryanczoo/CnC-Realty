# Agent Application Redesign — Design Spec

**Date:** 2026-06-29
**Status:** Approved for implementation planning

---

## Goal

Replace the current auth-gated 4-step agent onboarding form with a public single-page application at `/join/apply`. The application collects all legally required information (matching Rise Realty + VRG standards), uses a link-gated ICA checkbox for legal acknowledgment, and routes submissions to an admin approval queue. Agent accounts are created only after Ryan approves.

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

  // ICA audit trail
  icaOpenedAt         DateTime  // when agent clicked the ICA link
  icaAgreedAt         DateTime  // when agent checked the agreement box
  submissionIp        String    // captured server-side on POST

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

### Section 7 — ICA Review & Agreement
- A clearly labeled link/button opens the full CnC ICA (PDF or `/join/ica` page) in a new tab
- Clicking the link sets an `icaOpened` state flag and captures an `icaOpenedAt` timestamp
- The agreement checkbox below is **disabled** until the ICA link has been clicked
- Once enabled, agent checks: *"I have read and agree to the CnC Realty Independent Contractor Agreement."*
- `icaOpenedAt` timestamp stored with the application submission as part of the audit trail

### Section 8 — DRE Perjury Certification
Single mandatory checkbox with the full certification text:

> "I certify under penalty of perjury that all information provided in this application is true and correct, and that I am not under investigation or prosecution by the DRE, State of California, any Realtor Association, MLS, or any government entity for acts including but not limited to complaints, ethics violations, fraud, misconduct, or misrepresentation."

### Section 9 — reCAPTCHA
- Google reCAPTCHA v3 embedded before the submit button
- Free up to 1M assessments/month — no cost
- Site key rendered client-side; secret key verified server-side on POST
- Form submission blocked if reCAPTCHA score is below threshold (0.5)
- Environment variables: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`

---

## Unlicensed Applicants

If the agent leaves DRE License Number blank or enters an invalid format, the form displays an inline error and blocks submission. There is no "not licensed yet" option — CnC requires an active CA DRE license to apply.

---

## Post-Submission Flow

```
Agent submits form (ICA agreed, reCAPTCHA passed)
        ↓
Server verifies reCAPTCHA token
        ↓
AgentApplication created (status: PENDING)
Audit trail stored (icaOpenedAt, icaAgreedAt, submissionIp)
        ↓
SendGrid notification email → Ryan
("New agent application from [First Last] — review at /admin/applications")
        ↓
Ryan reviews in Admin Dashboard → /admin/applications
        ↓
    APPROVE                     REJECT
        ↓                           ↓
Agent account created         Rejection reason saved
(User + Agent rows)           SendGrid email → Agent
Password-setup email →        (polite rejection notice)
Agent sets password →
/dashboard
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

## ICA Agreement — Checkbox with Link-Click Gate

**No third-party e-signature service required.**

The ICA agreement is a clickwrap acknowledgment, legally valid under the federal E-SIGN Act and California UETA. The link-click gate ensures the agent was presented with and opened the document before agreeing.

**Audit trail stored per submission:**
- `icaOpenedAt` — timestamp when agent clicked the ICA link
- `icaAgreedAt` — timestamp when agent checked the agreement checkbox
- `submissionIp` — IP address captured server-side on form POST

**UX behavior:**
1. ICA link is displayed prominently with the text "Read the CnC Realty ICA →"
2. Clicking the link opens the ICA in a new tab and enables the checkbox
3. Checkbox label: *"I have read and agree to the CnC Realty Independent Contractor Agreement."*
4. Checkbox remains disabled until `icaOpened` state is `true`
5. Form cannot be submitted without the checkbox checked

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
- `apps/web/src/app/api/agent-applications/route.ts` — POST: create application, capture IP + timestamps
- `apps/web/src/app/(dashboard)/admin/applications/page.tsx` — admin queue
- `apps/web/src/app/(dashboard)/admin/applications/[id]/page.tsx` — application detail + approve/reject
- `prisma/migrations/…` — AgentApplication table + enums

**Modified:**
- `apps/web/src/components/join/AgentPlan.tsx` — href: `/join/agent` → `/join/apply`
- `apps/web/src/components/join/HowToJoin.tsx` — href: `/join/agent` → `/join/apply`
- `prisma/schema.prisma` — add AgentApplication model + enums

**Removed:**
- `apps/web/src/app/(agents)/join/agent/page.tsx` — replaced by `/join/apply`

---

## Environment Variables Required

```
# Google reCAPTCHA v3 (free — register at google.com/recaptcha)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
```

SendGrid is already configured in the project — no new env vars needed for email notifications.

---

## Out of Scope

- Single-page visual design (layout, styling) — to be designed in a separate session
- E&O supplement display changes — separate discussion
- W-9 collection (sent separately after approval, not part of this form)
- SSN/EIN collection (handled via signed W-9, not web form)
