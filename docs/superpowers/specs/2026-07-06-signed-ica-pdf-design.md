# Signed ICA PDF — Design Spec

**Date:** 2026-07-06
**Status:** Approved

---

## Overview

California DRE Regulation 2726 (10 CCR § 2726) requires every broker-salesperson agreement to be "dated and signed by the parties." The current application flow only captures a checkbox ("I have read and agree") plus an opened/agreed timestamp and IP — no captured signature name and no retained signed document. This spec adds a typed-name electronic signature to the existing ICA agreement step on `/join/apply`, generates a signed PDF snapshot of the ICA at submission time, stores it in the existing Cloudflare R2 bucket, and exposes a download link on the agent's row in `/admin/agents`.

This also fixes a pre-existing drift risk: the ICA text currently lives in two unlinked places — hardcoded JSX in `apps/web/src/app/(marketing)/join/ica/page.tsx` (312 lines) and `docs/cnc-ica-draft.md`. This spec consolidates it into one canonical content source used by both the web page and the PDF generator.

---

## Architecture & Data Flow

1. Applicant opens `/join/ica` in a new tab to read (unchanged), returns to `/join/apply`, checks the existing agreement checkbox, and types their full legal name into a new signature field.
2. On submit, `POST /api/agent-applications`:
   - Validates the typed name matches `firstName` + `lastName` from the same submission (case/whitespace-insensitive).
   - Generates a PDF via `pdf-lib`: full ICA content (from the new canonical content module) + a signature block (typed name, agreed-at timestamp, submission IP, ICA version).
   - Uploads the PDF to R2 via the existing `uploadToR2` helper.
   - Stores the R2 key on the new `AgentApplication.signedIcaKey` field, alongside `signedName` and `icaVersion`.
3. On approval (`POST /api/agent-applications/[id]/approve`), the transaction that creates the `Agent` record also copies `signedIcaKey` onto it.
4. `/admin/agents` shows a "Download Signed ICA" link on any row where `Agent.signedIcaKey` is set; the link is omitted entirely for agents with no key (covers agents approved before this feature existed).
5. Clicking the link calls `GET /api/admin/agents/[id]/signed-ica`, which returns a fresh presigned R2 URL (reusing `getPresignedGetUrl`) if a key exists, or 404.

---

## ICA Content — Single Source of Truth

New file: `apps/web/src/lib/ica-content.ts`

Exports:
- `ICA_VERSION: string` — a date stamp (e.g. `"2026-07-06"`), bumped by hand whenever the ICA text changes.
- `ICA_SECTIONS: IcaSection[]` where:
  ```ts
  type IcaSection = {
    num: string;        // "7"
    title: string;       // "COMPENSATION"
    paragraphs: (string | { sub: string; text: string })[];
    table?: { headers: string[]; rows: string[][] };
  };
  ```
- The fee table (currently the hardcoded `FeeTable` component's `rows` array in `page.tsx`) becomes the `table` field on the relevant section.

`apps/web/src/app/(marketing)/join/ica/page.tsx` is refactored to render this array (mapping sections to the existing `Section`/`Sub`/table JSX) instead of hand-authoring each section as JSX. Visual output is unchanged — same headings, spacing, and table styling as today.

`docs/cnc-ica-draft.md` remains the human-readable reference copy for attorney review; keeping it word-for-word in sync with `ica-content.ts` is a manual step when the ICA changes (out of scope to automate — see Out of Scope).

---

## Schema Changes

Migration adds:

```prisma
model AgentApplication {
  // ...existing fields...
  signedName    String  // typed legal name at signing
  icaVersion    String  // ICA_VERSION at time of signing
  signedIcaKey  String? // R2 object key for the generated PDF
}

model Agent {
  // ...existing fields...
  signedIcaKey  String? // copied from AgentApplication on approval
}
```

`signedName` and `icaVersion` are non-nullable on `AgentApplication` — every new application will have generated a PDF successfully before the row is created (see Error Handling below), so there's no partial state to represent. `signedIcaKey` is nullable on both models to represent "PDF generation/upload didn't happen" (pre-existing agents) without a special sentinel value.

---

## Signing Flow (ApplicationForm.tsx)

In the existing "Section 3: ICA Review & Agreement" block (~line 345):

- New field below the checkbox: `signatureName` (text input), label "Type your full legal name to sign *"
- Helper text: "By typing your name above, you are electronically signing the CnC Realty Independent Contractor Agreement."
- Client-side validation on submit (mirrors existing `icaOpened`/`icaAgreed` checks at ~line 144-152): `signatureName.trim().toLowerCase() === `${firstName} ${lastName}`.trim().toLowerCase()`. On mismatch, inline error: "Signature must match your full legal name (First + Last Name) entered above."
- `signatureName` added to the POST body alongside the existing `icaOpenedAt`/`icaAgreedAt`/`submissionIp` fields.

Server-side (`/api/agent-applications` route) re-validates the same name-match rule (never trust client-side-only validation) before generating the PDF.

---

## PDF Generation

New file: `apps/web/src/lib/ica-pdf.ts`

```ts
export async function generateSignedIcaPdf(input: {
  sections: IcaSection[];
  icaVersion: string;
  signerName: string;
  signedAt: Date;
  signerIp: string;
}): Promise<Buffer>
```

- Uses `pdf-lib` to lay out each section's heading, paragraphs, and table (simple row/column text grid — no borders needed) across as many pages as required, with page-break logic when content overflows the page height.
- Final page appends a signature block: signer's typed name, "Signed electronically on [date/time]", IP address, "ICA Version: [icaVersion]".
- Returns a `Buffer` — no disk I/O inside this function; the caller uploads it.

Key convention: `signed-ica/{applicationId}.pdf` (mirrors the existing `buildR2Key` pattern in `lib/r2.ts`, but signed ICAs aren't tied to a transaction/listing file so they get their own top-level prefix rather than reusing `buildR2Key`).

---

## Storage & Download

- Reuses `uploadToR2(key, buffer, "application/pdf")` and `getPresignedGetUrl(key)` from the existing `apps/web/src/lib/r2.ts` — no new storage code.
- New route: `apps/web/src/app/api/admin/agents/[id]/signed-ica/route.ts`
  ```ts
  GET → requireAuth("ADMIN") → look up Agent.signedIcaKey → 404 if null → getPresignedGetUrl(key) → { url }
  ```
- `/admin/agents` row: "Download Signed ICA" link only rendered when `agent.signedIcaKey` is present (fetched alongside the rest of the agents list query); `onClick` hits the route above and opens the returned URL in a new tab.

**Cost note:** confirmed with Ryan — a signed PDF is ~100-300 KB; even at hundreds of agents over years this stays inside R2's free tier (10 GB storage / 1M writes / 10M reads per month), no material cost impact.

---

## Error Handling

- If PDF generation or R2 upload fails during application submission, the whole request fails (application is not created) and the applicant sees a generic submission error — same behavior as any other write failure in this route today. We do not want an `AgentApplication` to exist without its signed PDF, since that PDF is the DRE-required signed record.
- If the approve-route transaction somehow runs against an `AgentApplication` with a null `signedIcaKey` (shouldn't happen given the above, but defensive): `Agent.signedIcaKey` is simply set to `null` too — the admin row silently omits the download link, no error thrown.

---

## Testing

Following TDD:
- Unit test: name-match validation function (exact match, case-insensitive, whitespace-insensitive, mismatch rejected) — both the client-side helper and the server-side re-check if they share logic (extract to one shared function used by both).
- Unit test: `generateSignedIcaPdf` produces a non-empty buffer that starts with the `%PDF-` magic bytes, and (via `pdf-lib`'s own load/parse) contains the expected page count and can be re-loaded without error.
- Integration test: `POST /api/agent-applications` with a valid payload results in an `AgentApplication` row with a non-null `signedIcaKey`, `signedName`, and `icaVersion` matching `ICA_VERSION`.
- Integration test: approve route copies `signedIcaKey` from application to the new `Agent` row.
- Integration test: `GET /api/admin/agents/[id]/signed-ica` returns 404 for an agent with a null key, and a `{ url }` shape for one with a key (mock `getPresignedGetUrl`).
- No test for actual R2 network calls — consistent with how existing document-upload code is tested in this repo (mocked at the `r2.ts` boundary).

---

## Out of Scope

- Automating sync between `ica-content.ts` and `docs/cnc-ica-draft.md` — the Word/markdown draft remains a manual copy for attorney review; only the in-app content module is consumed by the web page and PDF generator.
- Re-signing or amendment flow if the ICA changes after an agent has already signed — existing agents' signed PDFs are immutable historical snapshots; no re-signature prompt is built.
- Backfilling signed PDFs for agents approved before this feature ships (e.g. test accounts) — their rows simply show no download link, per Ryan's decision.
- Any UI in `/join/ica` itself — that page stays a read-only reference; the signature field lives only on `/join/apply`.
- Editing/revoking a submitted signature after the fact.
