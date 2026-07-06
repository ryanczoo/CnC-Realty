# Application Submitted Page — Design Spec

**Date:** 2026-07-05
**Status:** Approved

---

## Overview

After an applicant clicks "Submit Application" on `/join/apply`, redirect them to a new standalone page (`/join/apply/submitted`) instead of showing the current inline success message. The page tells the applicant what to do next with the California DRE eLicensing system before CnC Realty can certify their acceptance — modeled on REeBroker Group's equivalent page, in plain "email format" text for now.

---

## Architecture

| File | Change |
|---|---|
| `apps/web/src/app/(marketing)/join/apply/submitted/page.tsx` | New file — static informational page |
| `apps/web/src/components/join/ApplicationForm.tsx` | On successful submit, `router.push("/join/apply/submitted")` instead of setting the `success` state; remove the now-unused inline success block |
| `apps/web/src/components/layout/Navbar.tsx` | Add `pathname !== "/join/apply/submitted"` to the `isTransparent` exclusion list (solid dark navbar, same as `/join/apply` and `/join/ica`) |

---

## Page Layout

Same pattern as `/join/ica`:

```tsx
<main className="min-h-screen bg-[#F2F0EF]">
  <div className="mx-auto max-w-3xl px-6 py-32">
    ...
  </div>
</main>
```

No dashed borders, cards, or icons — plain paragraph text, left-aligned, matching the REeBroker reference screenshot's "email" feel.

---

## Content

Plain paragraphs, `font-sans text-base leading-relaxed text-[#1B1B1B]/80`, `space-y-5` between them:

1. "Hello,"
2. "Thank you for your interest in joining **CnC Realty**. DRE #02439028"
3. "To complete your employment change with the brokerage, please log in to your account on the DRE eLicensing system and select **\"Change Responsible Broker / Add Responsible Broker.\"**" — plain text, not a hyperlink (no verified DRE eLicensing URL on hand; Ryan can add the link later)
4. **IMPORTANT** callout (bold label, same paragraph or its own block):
   "When initiating your employment change on the DRE eLicensing system, you will be asked if the broker is available to certify your acceptance now. **Please select \"No.\"** You will then be asked for the broker's email address (`info@cncrealtygroup.com`) and license number (`02439028`)."
5. "After you complete the DRE eLicensing process, we will certify your acceptance and send you a welcome email with instructions to set up your account and access all the tools CnC Realty has to offer."
6. "Please feel free to contact our office with any questions you may have."
7. "Best regards,"

Sign-off block (`mt-8`, no italics, plain lines):
```
Ryan Chong
Broker of Record
CnC Realty
DRE #02439028
info@cncrealtygroup.com
```

The `info@cncrealtygroup.com` mailto is the only link on the page (no DRE eLicensing link — see note above).

---

## ApplicationForm Changes

- Remove the `success` state's inline JSX block (lines ~191–200 currently)
- On successful POST, call `router.push("/join/apply/submitted")` (needs `useRouter` from `next/navigation`)
- No query params — the page is static, no applicant-specific data is shown

---

## Metadata

```ts
export const metadata: Metadata = {
  title: "Application Submitted | CnC Realty",
  description: "Next steps after submitting your CnC Realty agent application.",
};
```

---

## Out of Scope

- Any dynamic/applicant-specific content (name interpolation, application ID, etc.) — static text only, per Ryan: "copy the same format for now and I will change it after"
- Directly linking or gating this page behind application-submission state (no auth/session check — it's a plain informational URL, same as `/join/ica`)
- Updating copy/design of the DRE eLicensing instructions themselves beyond what's specified above
