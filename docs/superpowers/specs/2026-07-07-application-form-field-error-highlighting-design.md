# Application Form — Field-Level Error Highlighting

**Date:** 2026-07-07
**Status:** Approved

---

## Overview

`apps/web/src/components/join/ApplicationForm.tsx` (the `/join/apply` agent application form) currently shows validation errors as a single generic red banner (rendered at the top of the form and again near the submit button) with no visual indication of *which* field the error is about. Ryan asked to add a red-highlighted border/ring on the specific field(s) implicated by whichever error is currently showing, in addition to (not instead of) the existing banner. Also changing the signature-mismatch message to "Please type the same first and last name used in the Personal Information section."

---

## Approach

**New state:** `const [errorFields, setErrorFields] = useState<Set<string>>(new Set());` alongside the existing `error` state.

**Helper replacing the repeated `setError(msg); return;` pattern:**

```ts
const fail = (message: string, fields: string[] = []) => {
  setError(message);
  setErrorFields(new Set(fields));
};
```

Each of the 13 validation branches in `handleSubmit` calls `fail(message, [...fieldKeys])` instead of `setError(message)`, then `return`. `errorFields` is reset to empty at the top of `handleSubmit` (alongside the existing `setError(null)`) so a fresh submit attempt starts clean.

**Visual treatment:** a small helper `const ring = (field: string) => errorFields.has(field) ? "ring-2 ring-red-400" : "";` appended to the relevant element's className. Applied via a wrapping `<div>` for radio groups, checkboxes, the DateField component, and the ICA button (since these don't have a simple appendable border the way a plain `<input>` does) — a `p-2 -m-2 rounded-lg` wrapper keeps the ring from clipping against tight spacing.

## Field ↔ Validation Mapping

| Validation check | Field key(s) highlighted |
|---|---|
| Personal info empty (firstName/lastName/email/phone) | `firstName`, `lastName`, `email`, `phone` |
| Invalid email format | `email` |
| License # not 8 digits | `licenseNumber` |
| License info empty (type/expDate/yearsLicensed) | `licenseType`, `licenseExpDate`, `yearsLicensed` |
| Missing Membership Association | `boardOfRealtors` |
| Active Listings/Sales unanswered | `hasActiveListings`, `hasActiveSales` |
| Missing commission entity | `commissionEntity` |
| Background questions unanswered | `hasDisciplinaryHistory`, `hasInvestigationHistory` |
| ICA not opened | `icaButton` (synthetic key — no input exists, highlights the "CnC Realty ICA" button) |
| ICA checkbox not agreed | `icaAgreed` |
| Signature doesn't match name | `signatureName` |
| DRE perjury checkbox not checked | `drePerJuryCert` |
| reCAPTCHA not ready | *(none — banner only, nothing user-editable to highlight)* |

## Message Change

`"Your signature must match your full legal name (First + Last Name) entered above."` → `"Please type the same first and last name used in the Personal Information section."`

## Out of Scope

- No live-clearing of the highlight as the user edits a field (highlight only resets on the next submit attempt, matching how the existing banner already behaves — no new interaction pattern introduced).
- No changes to server-side validation (Task 7's `route.ts` re-validation stays untouched — this is purely client-side UX).
- No changes to the banner's positioning, styling, or the set of messages themselves (other than the one signature-mismatch wording change requested).
