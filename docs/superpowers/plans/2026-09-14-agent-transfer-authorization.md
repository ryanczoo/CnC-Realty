# Agent Transfer of Active Listings/Sales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an approved agent has an active listing or pending sale to transfer, automatically create a locked placeholder file in their dashboard, get them the right blank transfer-authorization form, and unlock the file into a normal editable one the moment you approve their signed upload.

**Architecture:** A new `PENDING_TRANSFER` status on both `ListingStatus` and `TransactionFileStatus` marks a file as locked. Placeholder files are created directly (not through the normal creation routes, which require real property data) inside the existing agent-application approve route, seeded with one checklist item. The existing document-approval route gets one added check: approving a document that belongs to a checklist item on a `PENDING_TRANSFER` file unlocks it to `INCOMPLETE`. No new upload mechanism, no new review queue, no new PDF-generation code — everything reuses infrastructure that already exists.

**Tech Stack:** Next.js 14 App Router, Prisma/PostgreSQL (Neon), Vitest, Postmark (via `lib/email/send.ts`), pdf-lib (one-off script only, not app code).

**Spec:** `docs/superpowers/specs/2026-09-14-agent-transfer-authorization-design.md`

## Global Constraints

- `PENDING_TRANSFER → INCOMPLETE` is never a manually-selectable transition — it must not appear as a reachable value in `AGENT_LISTING_TRANSITIONS`, `ADMIN_LISTING_TRANSITIONS`, `AGENT_TX_TRANSITIONS`, or `ADMIN_TX_TRANSITIONS` in `apps/web/src/lib/transaction-helpers.ts`. The only code path that performs this transition is the document-approval route.
- Two templates only — "Listing Authorization" and "Pending Sale Transfer Authorization" — per the spec's field-by-field merge of REeBroker's three reference forms. No third template.
- No parsing/OCR of the agent's uploaded signed document, ever. The only pre-populated field is `propertyAddress`, entered directly by the agent on the locked file's own page.
- `ListingFile.propertyAddress`, `city`, `zip`, `listPrice`, and `listingType` are non-nullable in the schema today — placeholder creation must supply sentinel values for these, and every place a `ListingFile`/`TransactionFile` is displayed must check `status === "PENDING_TRANSFER"` before rendering those fields, so sentinel values never leak into the UI.
- CnC's real office phone number for the form templates: `(562) 335-1759` (already in the spec's drafted text).

---

### Task 1: Schema — `PENDING_TRANSFER` status and application count fields

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (lines 83–92, 94–106, 1108–1110)
- Create: migration via `prisma migrate dev`

**Interfaces:**
- Produces: `ListingStatus.PENDING_TRANSFER`, `TransactionFileStatus.PENDING_TRANSFER`, `AgentApplication.activeListingsCount: number | null`, `AgentApplication.activeSalesCount: number | null` — consumed by every later task.

- [ ] **Step 1: Add the new enum value and application fields to the schema**

Edit `packages/database/prisma/schema.prisma`:

```prisma
enum ListingStatus {
  INCOMPLETE
  PENDING_TRANSFER
  COMING_SOON
  ACTIVE
  ACTIVE_UNDER_CONTRACT
  EXPIRED
  WITHDRAWN
  CANCELED
  CLOSED
}

enum TransactionFileStatus {
  INCOMPLETE
  PENDING_TRANSFER
  PRE_CONTRACT
  PENDING
  EXPIRED
  CLOSED
  ARCHIVED
  CANCELED_PENDING
  CANCELED_APPROVED
  REFERRAL_SUCCESSFUL
  REFERRAL_UNSUCCESSFUL
  REFERRAL_BROKER_REVIEW
}
```

And in `model AgentApplication`, right after the existing `Transfer` fields:

```prisma
  // Transfer
  hasActiveListings Boolean
  hasActiveSales    Boolean
  activeListingsCount Int?
  activeSalesCount    Int?
```

- [ ] **Step 2: Generate and apply the migration**

Run: `cd packages/database && pnpm exec prisma migrate dev --name add_pending_transfer_status`
Expected: a new folder under `packages/database/prisma/migrations/` with a `migration.sql` that adds the enum values and two nullable `INTEGER` columns; command exits 0.

- [ ] **Step 3: Regenerate the Prisma client**

Run: `pnpm --filter @cnc/database exec prisma generate`
Expected: exits 0. (On Windows, if the dev server is running and holding `query_engine-windows.dll.node`, stop it first — this is a known EPERM issue in this project, not a bug in this step.)

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat: add PENDING_TRANSFER status and application transfer-count fields"
```

---

### Task 2: Lock down the transition tables, type unions, and status badge

**Files:**
- Modify: `apps/web/src/lib/transaction-helpers.ts:31–79`
- Modify: `apps/web/src/types/transaction.ts:1–8`
- Modify: `apps/web/src/components/transactions/StatusBadge.tsx`
- Test: `apps/web/src/lib/__tests__/transaction-helpers.test.ts`

**Interfaces:**
- Consumes: `ListingStatus`, `TransactionFileStatus` from Task 1.
- Produces: `canTransitionListing`/`canTransitionTransaction` continue to type-check and now explicitly reject any transition out of `PENDING_TRANSFER` for both AGENT and ADMIN roles.

- [ ] **Step 1: Write the failing regression test**

Add to `apps/web/src/lib/__tests__/transaction-helpers.test.ts`:

```typescript
it("never allows PENDING_TRANSFER -> INCOMPLETE manually, for either role", () => {
  expect(canTransitionListing("PENDING_TRANSFER", "INCOMPLETE", "AGENT")).toBe(false);
  expect(canTransitionListing("PENDING_TRANSFER", "INCOMPLETE", "ADMIN")).toBe(false);
  expect(canTransitionTransaction("PENDING_TRANSFER", "INCOMPLETE", "AGENT")).toBe(false);
  expect(canTransitionTransaction("PENDING_TRANSFER", "INCOMPLETE", "ADMIN")).toBe(false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run src/lib/__tests__/transaction-helpers.test.ts`
Expected: FAIL — compile error, since `Record<ListingStatus, ListingStatus[]>` and `Record<TransactionFileStatus, TransactionFileStatus[]>` are now missing the `PENDING_TRANSFER` key (TypeScript's exhaustive-`Record` check catches this before the test even runs).

- [ ] **Step 3: Add `PENDING_TRANSFER: []` to all four transition tables**

In `apps/web/src/lib/transaction-helpers.ts`, add one line to each of the four `Record` literals (do not add any transitions out of it — an empty array is the point):

```typescript
const AGENT_LISTING_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  INCOMPLETE:            ["COMING_SOON", "ACTIVE"],
  PENDING_TRANSFER:      [],
  COMING_SOON:           ["ACTIVE", "WITHDRAWN", "CANCELED"],
  ACTIVE:                ["COMING_SOON", "ACTIVE_UNDER_CONTRACT", "EXPIRED", "WITHDRAWN", "CANCELED"],
  ACTIVE_UNDER_CONTRACT: ["ACTIVE", "WITHDRAWN", "CANCELED"],
  EXPIRED:               ["ACTIVE"],
  WITHDRAWN:             [],
  CANCELED:              [],
  CLOSED:                [],
};

const ADMIN_LISTING_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  INCOMPLETE:            ["COMING_SOON", "ACTIVE", "CANCELED"],
  PENDING_TRANSFER:      [],
  COMING_SOON:           ["ACTIVE", "WITHDRAWN", "CANCELED"],
  ACTIVE:                ["COMING_SOON", "ACTIVE_UNDER_CONTRACT", "EXPIRED", "WITHDRAWN", "CANCELED", "CLOSED"],
  ACTIVE_UNDER_CONTRACT: ["ACTIVE", "CLOSED", "WITHDRAWN", "CANCELED"],
  EXPIRED:               ["ACTIVE", "CLOSED", "CANCELED"],
  WITHDRAWN:             ["ACTIVE", "CANCELED"],
  CANCELED:              [],
  CLOSED:                [],
};
```

```typescript
const AGENT_TX_TRANSITIONS: Record<TransactionFileStatus, TransactionFileStatus[]> = {
  INCOMPLETE:              ["PRE_CONTRACT", "PENDING"],
  PENDING_TRANSFER:        [],
  PRE_CONTRACT:            ["PENDING", "CANCELED_PENDING"],
  PENDING:                 ["CANCELED_PENDING", "REFERRAL_SUCCESSFUL", "REFERRAL_UNSUCCESSFUL"],
  EXPIRED:                 [],
  CLOSED:                  [],
  ARCHIVED:                [],
  CANCELED_PENDING:        [],
  CANCELED_APPROVED:       [],
  REFERRAL_SUCCESSFUL:     [],
  REFERRAL_UNSUCCESSFUL:   [],
  REFERRAL_BROKER_REVIEW:  [],
};

const ADMIN_TX_TRANSITIONS: Record<TransactionFileStatus, TransactionFileStatus[]> = {
  INCOMPLETE:              ["PRE_CONTRACT", "PENDING", "CANCELED_APPROVED"],
  PENDING_TRANSFER:        [],
  PRE_CONTRACT:            ["PENDING", "CANCELED_PENDING", "CANCELED_APPROVED"],
  PENDING:                 ["CLOSED", "EXPIRED", "CANCELED_PENDING", "CANCELED_APPROVED"],
  EXPIRED:                 ["PENDING", "CLOSED", "CANCELED_APPROVED"],
  CLOSED:                  ["ARCHIVED"],
  ARCHIVED:                [],
  CANCELED_PENDING:        ["PENDING", "CANCELED_APPROVED"],
  CANCELED_APPROVED:       [],
  REFERRAL_SUCCESSFUL:     ["REFERRAL_BROKER_REVIEW"],
  REFERRAL_UNSUCCESSFUL:   ["CLOSED"],
  REFERRAL_BROKER_REVIEW:  ["CLOSED"],
};
```

- [ ] **Step 4: Update the type unions**

In `apps/web/src/types/transaction.ts`:

```typescript
export type ListingStatus =
  | "INCOMPLETE" | "PENDING_TRANSFER" | "COMING_SOON" | "ACTIVE" | "ACTIVE_UNDER_CONTRACT"
  | "EXPIRED" | "WITHDRAWN" | "CANCELED" | "CLOSED";

export type TransactionFileStatus =
  | "INCOMPLETE" | "PENDING_TRANSFER" | "PRE_CONTRACT" | "PENDING" | "EXPIRED"
  | "CLOSED" | "ARCHIVED" | "CANCELED_PENDING" | "CANCELED_APPROVED"
  | "REFERRAL_SUCCESSFUL" | "REFERRAL_UNSUCCESSFUL" | "REFERRAL_BROKER_REVIEW";
```

- [ ] **Step 5: Add the badge color/label**

In `apps/web/src/components/transactions/StatusBadge.tsx`, add one entry to each map:

```typescript
  PENDING_TRANSFER:      "bg-purple-100 text-purple-700",
```
```typescript
  PENDING_TRANSFER:      "Pending Transfer",
```

- [ ] **Step 6: Run the test suite to verify it passes**

Run: `pnpm --filter web exec vitest run src/lib/__tests__/transaction-helpers.test.ts`
Expected: PASS, all tests including the new one.

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors (there may be pre-existing unrelated ones — compare against a clean checkout if unsure).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/transaction-helpers.ts apps/web/src/lib/__tests__/transaction-helpers.test.ts apps/web/src/types/transaction.ts apps/web/src/components/transactions/StatusBadge.tsx
git commit -m "feat: lock PENDING_TRANSFER out of every manual status transition"
```

---

### Task 3: Application form — transfer count follow-up questions

**Files:**
- Modify: `apps/web/src/app/api/agent-applications/route.ts:12–46, 124–125`
- Modify: `apps/web/src/components/join/ApplicationForm.tsx:53, 70, 139–143, 407–439`
- Test: `apps/web/src/__tests__/api/agent-applications.test.ts`

**Interfaces:**
- Produces: `AgentApplication.activeListingsCount`/`activeSalesCount` populated on submit whenever the corresponding boolean is `true`; the submit API rejects a `true` boolean with no matching count.

- [ ] **Step 1: Write the failing test for the submit route**

Add to `apps/web/src/__tests__/api/agent-applications.test.ts`, using this file's real existing pattern — a `VALID_BODY` object spread with per-test overrides, passed straight into `new Request(...)` (there is no request-building helper in this file; do not invent one):

```typescript
it('requires activeListingsCount when hasActiveListings is true', async () => {
  const req = new Request('http://localhost/api/agent-applications', {
    method: 'POST',
    body: JSON.stringify({ ...VALID_BODY, hasActiveListings: true, activeListingsCount: undefined }),
    headers: { 'Content-Type': 'application/json' },
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/listing/i);
});

it('requires activeSalesCount when hasActiveSales is true', async () => {
  const req = new Request('http://localhost/api/agent-applications', {
    method: 'POST',
    body: JSON.stringify({ ...VALID_BODY, hasActiveSales: true, activeSalesCount: undefined }),
    headers: { 'Content-Type': 'application/json' },
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/sale/i);
});

it('accepts and persists both counts when both booleans are true', async () => {
  vi.mocked(prisma.agentApplication.create).mockResolvedValue({ id: 'app-1' } as any);
  const req = new Request('http://localhost/api/agent-applications', {
    method: 'POST',
    body: JSON.stringify({
      ...VALID_BODY,
      hasActiveListings: true, activeListingsCount: 3,
      hasActiveSales: true, activeSalesCount: 2,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  const res = await POST(req);
  expect(res.status).toBe(201);
  expect(vi.mocked(prisma.agentApplication.create)).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ activeListingsCount: 3, activeSalesCount: 2 }),
    })
  );
});
```

Note: `prisma.agentApplication.create` is not given a default mock return value anywhere in this file's existing tests (they only assert on status codes for validation failures, never reaching `create`) — the third test above is the first one in this file that needs `create` to actually resolve, so it sets that up explicitly.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/agent-applications.test.ts`
Expected: FAIL — either a Zod validation error surfaces as an unexpected 400/500, or `activeListingsCount`/`activeSalesCount` are simply absent from the `create` call.

- [ ] **Step 3: Extend the Zod schema with a cross-field refinement**

In `apps/web/src/app/api/agent-applications/route.ts`, add the two count fields and a `.refine()`:

```typescript
const schema = z.object({
  // ...(existing fields unchanged)...
  hasActiveListings:       z.boolean(),
  activeListingsCount:     z.number().int().min(1).max(10).optional(),
  hasActiveSales:          z.boolean(),
  activeSalesCount:        z.number().int().min(1).max(10).optional(),
  // ...(rest unchanged)...
}).refine((d) => !d.hasActiveListings || d.activeListingsCount != null, {
  message: "Please select how many listings you have to transfer.",
  path: ["activeListingsCount"],
}).refine((d) => !d.hasActiveSales || d.activeSalesCount != null, {
  message: "Please select how many pending sales you have to transfer.",
  path: ["activeSalesCount"],
});
```

- [ ] **Step 4: Persist the two fields on create**

In the same file, in the `prisma.agentApplication.create` call:

```typescript
          hasActiveListings:       data.hasActiveListings,
          activeListingsCount:     data.hasActiveListings ? data.activeListingsCount : null,
          hasActiveSales:          data.hasActiveSales,
          activeSalesCount:        data.hasActiveSales ? data.activeSalesCount : null,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/agent-applications.test.ts`
Expected: PASS, all tests.

- [ ] **Step 6: Add the follow-up dropdowns to the application form**

In `apps/web/src/components/join/ApplicationForm.tsx`, add the two new fields to the form-state type (line 53) and initial state (line 70):

```typescript
  activeListingsCount: number | "";
  activeSalesCount: number | "";
```
```typescript
  activeListingsCount: "", activeSalesCount: "",
```

Add validation alongside the existing transfer-question check (around line 139):

```typescript
    if (form.hasActiveListings === null || form.hasActiveSales === null) {
      fail("Please answer both transfer questions.", ["hasActiveListings", "hasActiveSales"]);
      return;
    }
    if (form.hasActiveListings && !form.activeListingsCount) {
      fail("Please select how many listings you have to transfer.", ["activeListingsCount"]);
      return;
    }
    if (form.hasActiveSales && !form.activeSalesCount) {
      fail("Please select how many pending sales you have to transfer.", ["activeSalesCount"]);
      return;
    }
```

Replace the `Section 4` block (lines 407–439) so each boolean gets its own count dropdown, following the existing conditional-paragraph pattern exactly:

```tsx
      {/* ── Section 4: Active Listings & Sales ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>Active Listings & Sales</p>
        {(
          [
            { field: "hasActiveListings", countField: "activeListingsCount", label: "Do you have active listings to transfer? *", countLabel: "How many listings do you have to transfer? *" },
            { field: "hasActiveSales", countField: "activeSalesCount", label: "Do you have pending sales to transfer? *", countLabel: "How many pending sales do you have to transfer? *" },
          ] as const
        ).map(({ field, countField, label, countLabel }) => (
          <div key={field} className="mb-4">
            <label className={labelClass}>{label}</label>
            <div className={`mt-2 flex gap-6 rounded-lg p-1 -m-1 ${ring(field)}`}>
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
            {form[field] === true && (
              <>
                <p className="mt-2 font-sans text-sm text-[#1B1B1B]/50">
                  Please request your current brokerage to release active listings to CnC Realty after submission
                </p>
                <label className={`${labelClass} mt-3`}>{countLabel}</label>
                <select
                  className={`${inputClass} ${ring(countField)}`}
                  value={form[countField]}
                  onChange={(e) => set(countField, e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Select…</option>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        ))}
      </div>
```

(Check the exact `inputClass`/`ring`/`set` helper signatures already used elsewhere in this file — e.g. the `licenseNumber` field earlier in the file — and match them; this file already defines these helpers, don't redefine them.)

- [ ] **Step 7: Manually verify in the browser**

Run: `pnpm --filter web dev`, open `/join/apply`, answer "Yes" to each transfer question, confirm a 1–10 dropdown appears under each, and confirm submitting without selecting a count shows the new validation error.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/api/agent-applications/route.ts apps/web/src/components/join/ApplicationForm.tsx apps/web/src/__tests__/api/agent-applications.test.ts
git commit -m "feat: ask how many listings/sales an applicant has to transfer"
```

---

### Task 4: Placeholder file creation at approval

**Files:**
- Modify: `apps/web/src/app/api/agent-applications/[id]/approve/route.ts`
- Test: `apps/web/src/__tests__/api/agent-applications-approve.test.ts`

**Interfaces:**
- Consumes: `AgentApplication.hasActiveListings`, `activeListingsCount`, `hasActiveSales`, `activeSalesCount` (Task 1/3); `ListingStatus.PENDING_TRANSFER`, `TransactionFileStatus.PENDING_TRANSFER` (Task 1).
- Produces: for each approval, 0..N `ListingFile` rows and 0..M `TransactionFile` rows, each `status: "PENDING_TRANSFER"` with exactly one seeded `FileChecklistItem` named `"Upload Signed Transfer Authorization"`.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/__tests__/api/agent-applications-approve.test.ts` — extend the mocked `prisma` object at the top of the file to include `listingFile: { create: vi.fn() }` and `transactionFile: { create: vi.fn() }` inside the `tx` callback shape (the existing mock already threads `mockPrisma` through `$transaction`, so these become available inside the same transaction callback the route uses):

```typescript
it("creates one locked ListingFile per activeListingsCount and one locked TransactionFile per activeSalesCount", async () => {
  vi.mocked(requireAuth).mockResolvedValue({
    session: { user: { email: "admin@cnc.com" } },
    error: undefined,
  } as any);
  vi.mocked(prisma.agentApplication.findUnique).mockResolvedValue({
    ...FULLY_SIGNED_APPLICATION,
    id: "app-transfer",
    hasActiveListings: true,
    activeListingsCount: 2,
    hasActiveSales: true,
    activeSalesCount: 1,
  } as any);
  vi.mocked(prisma.agentApplication.updateMany).mockResolvedValue({ count: 1 } as any);
  vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-transfer" } as any);
  vi.mocked(prisma.agent.create).mockResolvedValue({ id: "agent-transfer" } as any);
  vi.mocked(prisma.listingFile.create).mockResolvedValue({ id: "listing-x" } as any);
  vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tx-x" } as any);

  const req = new Request("http://localhost/api/agent-applications/app-transfer/approve", { method: "POST" });
  const res = await POST(req, { params: { id: "app-transfer" } });

  expect(res.status).toBe(200);
  expect(prisma.listingFile.create).toHaveBeenCalledTimes(2);
  expect(prisma.transactionFile.create).toHaveBeenCalledTimes(1);

  const listingCall = vi.mocked(prisma.listingFile.create).mock.calls[0][0];
  expect(listingCall.data.agentId).toBe("agent-transfer");
  expect(listingCall.data.status).toBe("PENDING_TRANSFER");
  expect(listingCall.data.checklistItems.create).toEqual(
    expect.objectContaining({ name: "Upload Signed Transfer Authorization", isRequired: true })
  );

  const txCall = vi.mocked(prisma.transactionFile.create).mock.calls[0][0];
  expect(txCall.data.agentId).toBe("agent-transfer");
  expect(txCall.data.status).toBe("PENDING_TRANSFER");
  expect(txCall.data.transactionSide).toBe("PURCHASE");
});

it("creates no placeholder files when neither transfer boolean is true", async () => {
  vi.mocked(requireAuth).mockResolvedValue({
    session: { user: { email: "admin@cnc.com" } },
    error: undefined,
  } as any);
  vi.mocked(prisma.agentApplication.findUnique).mockResolvedValue({
    ...FULLY_SIGNED_APPLICATION,
    id: "app-no-transfer",
    hasActiveListings: false,
    activeListingsCount: null,
    hasActiveSales: false,
    activeSalesCount: null,
  } as any);
  vi.mocked(prisma.agentApplication.updateMany).mockResolvedValue({ count: 1 } as any);
  vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-none" } as any);
  vi.mocked(prisma.agent.create).mockResolvedValue({ id: "agent-none" } as any);

  const req = new Request("http://localhost/api/agent-applications/app-no-transfer/approve", { method: "POST" });
  const res = await POST(req, { params: { id: "app-no-transfer" } });

  expect(res.status).toBe(200);
  expect(prisma.listingFile.create).not.toHaveBeenCalled();
  expect(prisma.transactionFile.create).not.toHaveBeenCalled();
});
```

Also add `listingFile: { create: vi.fn() }, transactionFile: { create: vi.fn() }` to the `mockPrisma` object literal at the top of the file (in the `vi.mock("@/lib/prisma", ...)` block), and clear these mocks in `beforeEach` alongside the existing ones (the file already has `vi.clearAllMocks()` in `beforeEach` — no change needed there, just make sure the new mock functions exist on the object before the test runs).

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/agent-applications-approve.test.ts`
Expected: FAIL — `prisma.listingFile.create`/`prisma.transactionFile.create` never get called (the route doesn't create placeholder files yet), or the mock object is missing these functions entirely (fix the mock setup first if so, then re-run to confirm it fails for the *behavior* reason, not a missing-mock error).

- [ ] **Step 3: Add placeholder-file creation inside the existing transaction**

In `apps/web/src/app/api/agent-applications/[id]/approve/route.ts`, inside the `prisma.$transaction(async (tx) => { ... })` callback, right after the `await tx.agent.create({...})` call (which returns the created agent — capture it in a variable):

```typescript
      const agent = await tx.agent.create({
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
          signedIcaKey: app.signedIcaKey,
        },
      });

      const TRANSFER_CHECKLIST_ITEM = {
        name: "Upload Signed Transfer Authorization",
        description: null,
        order: 0,
        isRequired: true,
      } as const;

      if (app.hasActiveListings && app.activeListingsCount) {
        for (let i = 0; i < app.activeListingsCount; i++) {
          await tx.listingFile.create({
            data: {
              agentId: agent.id,
              status: "PENDING_TRANSFER",
              propertyAddress: "Pending Transfer — Awaiting Signed Authorization",
              city: "Pending",
              zip: "00000",
              listPrice: 0,
              listingType: "RESIDENTIAL_SALE",
              checklistItems: {
                create: { fileType: "LISTING" as const, ...TRANSFER_CHECKLIST_ITEM },
              },
            },
          });
        }
      }

      if (app.hasActiveSales && app.activeSalesCount) {
        for (let i = 0; i < app.activeSalesCount; i++) {
          await tx.transactionFile.create({
            data: {
              agentId: agent.id,
              status: "PENDING_TRANSFER",
              transactionSide: "PURCHASE",
              checklistItems: {
                create: { fileType: "TRANSACTION" as const, ...TRANSFER_CHECKLIST_ITEM },
              },
            },
          });
        }
      }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/agent-applications-approve.test.ts`
Expected: PASS, all tests including the two new ones and the three pre-existing ones.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
Expected: everything passes; no new type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/agent-applications/[id]/approve/route.ts apps/web/src/__tests__/api/agent-applications-approve.test.ts
git commit -m "feat: create locked placeholder files for an approved agent's active listings/sales"
```

---

### Task 5: Unlock trigger — extend the document-approval route

**Files:**
- Modify: `apps/web/src/app/api/admin/documents/[id]/approve/route.ts`
- Test: create `apps/web/src/__tests__/api/admin-documents-approve.test.ts` (confirmed absent — no test file for this route exists anywhere in the repo today)

**Interfaces:**
- Consumes: `FileDocument.checklistItemId`, `ListingFile.status`/`TransactionFile.status` (Task 1).
- Produces: after this task, approving a document attached to a checklist item on a `PENDING_TRANSFER` file leaves that file `INCOMPLETE`; approving one on any other file, or an unattached document, is unaffected.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendAllDocsApproved: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fileDocument: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
    fileChecklistItem: { findMany: vi.fn() },
    listingFile: { findUnique: vi.fn(), update: vi.fn() },
    transactionFile: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/admin/documents/[id]/approve/route";

describe("POST /api/admin/documents/[id]/approve — PENDING_TRANSFER unlock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("unlocks a PENDING_TRANSFER listing file when its checklist-attached document is approved", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "doc-1",
      fileType: "LISTING",
      listingFileId: "listing-1",
      transactionFileId: null,
      checklistItemId: "checklist-1",
      name: "signed.pdf",
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "listing-1", status: "PENDING_TRANSFER" } as any);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]);

    const req = new Request("http://localhost/api/admin/documents/doc-1/approve", { method: "POST" });
    await POST(req, { params: { id: "doc-1" } });

    expect(prisma.listingFile.update).toHaveBeenCalledWith({
      where: { id: "listing-1" },
      data: { status: "INCOMPLETE" },
    });
  });

  it("does not unlock a file when the approved document is unattached to any checklist item", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "doc-2",
      fileType: "LISTING",
      listingFileId: "listing-2",
      transactionFileId: null,
      checklistItemId: null,
      name: "random.pdf",
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "listing-2", status: "PENDING_TRANSFER" } as any);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]);

    const req = new Request("http://localhost/api/admin/documents/doc-2/approve", { method: "POST" });
    await POST(req, { params: { id: "doc-2" } });

    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it("does not touch status for a file that is not PENDING_TRANSFER", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "doc-3",
      fileType: "TRANSACTION",
      listingFileId: null,
      transactionFileId: "tx-3",
      checklistItemId: "checklist-3",
      name: "signed.pdf",
    } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tx-3", status: "PENDING" } as any);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]);

    const req = new Request("http://localhost/api/admin/documents/doc-3/approve", { method: "POST" });
    await POST(req, { params: { id: "doc-3" } });

    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/admin-documents-approve.test.ts`
Expected: FAIL — `listingFile.update`/`transactionFile.update` are never called for the status transition (the route doesn't do this yet).

- [ ] **Step 3: Add the unlock check to the route**

In `apps/web/src/app/api/admin/documents/[id]/approve/route.ts`, right after the existing `fileActivity.create` call and before the `fileId`/`isListing` lines already there:

```typescript
  if (doc.checklistItemId) {
    if (doc.fileType === "LISTING") {
      const parent = await prisma.listingFile.findUnique({ where: { id: doc.listingFileId! }, select: { status: true } });
      if (parent?.status === "PENDING_TRANSFER") {
        await prisma.listingFile.update({ where: { id: doc.listingFileId! }, data: { status: "INCOMPLETE" } });
      }
    } else {
      const parent = await prisma.transactionFile.findUnique({ where: { id: doc.transactionFileId! }, select: { status: true } });
      if (parent?.status === "PENDING_TRANSFER") {
        await prisma.transactionFile.update({ where: { id: doc.transactionFileId! }, data: { status: "INCOMPLETE" } });
      }
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/admin-documents-approve.test.ts`
Expected: PASS, all three new tests.

- [ ] **Step 5: Run the full suite for this route to make sure nothing else broke**

Run: `pnpm --filter web exec vitest run --grep "approve"`
Expected: all matching tests pass, including the pre-existing `isReadyToClose`/`sendAllDocsApproved` tests in this same route.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/admin/documents/[id]/approve/route.ts apps/web/src/__tests__/api/admin-documents-approve.test.ts
git commit -m "feat: unlock a PENDING_TRANSFER file when its transfer document is approved"
```

---

### Task 6: Deliver the blank form — email attachments and a download route

**Files:**
- Modify: `apps/web/src/lib/email.ts:419–475`
- Modify: `apps/web/src/app/api/agent-applications/[id]/approve/route.ts` (call-site update)
- Create: `apps/web/src/app/api/transfer-forms/[type]/route.ts`
- Test: `apps/web/src/__tests__/lib/email.test.ts`, create `apps/web/src/__tests__/api/transfer-forms.test.ts`

**Interfaces:**
- Produces: `sendApprovalDocuments(to, firstName, hasActiveListings, hasActiveSales)` — new required boolean params, conditionally attaching the two new PDFs. `GET /api/transfer-forms/listing` and `GET /api/transfer-forms/pending-sale` stream the same two static files for in-dashboard download.

- [ ] **Step 1: Write the failing email tests**

Add to `apps/web/src/__tests__/lib/email.test.ts`, inside the existing `describe("sendApprovalDocuments", ...)` block:

```typescript
  it("attaches the listing transfer form only when hasActiveListings is true", async () => {
    await sendApprovalDocuments("jane@example.com", "Jane", true, false);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.attachments).toHaveLength(3);
    expect(call.attachments!.some((a) => a.filename.includes("Listing Transfer"))).toBe(true);
    expect(call.attachments!.some((a) => a.filename.includes("Pending Sale"))).toBe(false);
  });

  it("attaches the pending-sale transfer form only when hasActiveSales is true", async () => {
    await sendApprovalDocuments("jane@example.com", "Jane", false, true);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.attachments).toHaveLength(3);
    expect(call.attachments!.some((a) => a.filename.includes("Pending Sale"))).toBe(true);
    expect(call.attachments!.some((a) => a.filename.includes("Listing Transfer"))).toBe(false);
  });

  it("attaches both transfer forms when both are true, and neither when both are false", async () => {
    await sendApprovalDocuments("jane@example.com", "Jane", true, true);
    expect(vi.mocked(sendEmail).mock.calls[0][0].attachments).toHaveLength(4);

    vi.clearAllMocks();
    await sendApprovalDocuments("jane@example.com", "Jane", false, false);
    expect(vi.mocked(sendEmail).mock.calls[0][0].attachments).toHaveLength(2);
  });
```

Also update every *existing* call to `sendApprovalDocuments("jane@example.com", "Jane")` already in this file (the five tests above it) to pass `false, false` as the two new trailing arguments, since the function signature is becoming required, not optional — e.g. `sendApprovalDocuments("jane@example.com", "Jane", false, false)`.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/email.test.ts`
Expected: FAIL — compile error (too many arguments) until the signature changes, then a real assertion failure (wrong attachment count) once it compiles.

- [ ] **Step 3: Extend `sendApprovalDocuments`**

In `apps/web/src/lib/email.ts`:

```typescript
export async function sendApprovalDocuments(
  to: string,
  firstName: string,
  hasActiveListings: boolean,
  hasActiveSales: boolean
) {
  if (!process.env.POSTMARK_SERVER_TOKEN) {
    console.warn("[sendApprovalDocuments] POSTMARK_SERVER_TOKEN is not set — skipping email send.");
    return;
  }
  const w9 = readFileSync(join(ATTACHMENTS_DIR, "w9-blank.pdf"));
  const opm = readFileSync(join(ATTACHMENTS_DIR, "cnc-office-policy-manual.pdf"));

  const transferAttachments = [];
  if (hasActiveListings) {
    transferAttachments.push({
      filename: "CnC Realty - Listing Transfer Authorization.pdf",
      content: readFileSync(join(ATTACHMENTS_DIR, "listing-transfer-authorization.pdf")).toString("base64"),
      contentType: "application/pdf",
    });
  }
  if (hasActiveSales) {
    transferAttachments.push({
      filename: "CnC Realty - Pending Sale Transfer Authorization.pdf",
      content: readFileSync(join(ATTACHMENTS_DIR, "pending-sale-transfer-authorization.pdf")).toString("base64"),
      contentType: "application/pdf",
    });
  }

  const transferParagraph = (hasActiveListings || hasActiveSales)
    ? `<p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: left; margin: 16px 0 0;">
        You told us you have ${hasActiveListings && hasActiveSales ? "an active listing and a pending sale" : hasActiveListings ? "an active listing" : "a pending sale"} to transfer from your previous brokerage — the matching transfer authorization form is attached. Fill it in, get it signed by your previous broker, then upload the signed copy on the locked file waiting for it in your dashboard.
      </p>`
    : "";

  const bodyHtml = buildHeadingBodyHtml({
    heading: `Let's get started, ${firstName}!`,
    photoUrl: `${process.env.NEXTAUTH_URL}/onboarding-photo.jpg`,
    bodyHtml: `
      <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: center; margin: 0 0 32px;">
        Here is some "boring" stuff we have to get out of the way...
      </p>
      <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: left; font-weight: 700; margin: 0 0 16px;">
        Attached you will find the following:
      </p>
      <ul style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; margin: 0 0 16px; padding-left: 40px;">
        <li>Blank IRS W-9 Form</li>
        <li>Office Policy</li>
      </ul>
      <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: left; font-weight: 700; margin: 0 0 16px;">
        Please complete and provide the following for our records:
      </p>
      <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: left; margin: 0 0 8px; padding-left: 20px;">&#10003; IRS W-9 Form</p>
      <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: left; margin: 0 0 16px; padding-left: 20px;">&#10003; Copy of California DRE license</p>
      ${transferParagraph}
      <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: center; margin: 32px 0 0;">
        Also, don't forget to join the <a href="https://www.car.org" style="color: #9E8C61;">Board of REALTORS&reg;</a> and a local MLS Association! This is required for access to the MLS, ZipForms, legal guidance, and more.
      </p>
    `,
  });

  const html = emailLayout({ bodyHtml });

  await sendEmail({
    to,
    subject: "Onboarding Documents",
    html,
    replyTo: NOTIFY,
    attachments: [
      { filename: "CnC Realty - Blank W-9.pdf", content: w9.toString("base64"), contentType: "application/pdf" },
      { filename: "CnC Realty - Office Policy Manual.pdf", content: opm.toString("base64"), contentType: "application/pdf" },
      ...transferAttachments,
    ],
    stream: "transactional",
  });
}
```

- [ ] **Step 4: Update the approve-route call site**

In `apps/web/src/app/api/agent-applications/[id]/approve/route.ts`:

```typescript
  sendApprovalDocuments(app.email, app.firstName, app.hasActiveListings, app.hasActiveSales).catch(console.error);
```

- [ ] **Step 5: Run the email test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/email.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing test for the download route**

Create `apps/web/src/__tests__/api/transfer-forms.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { GET } from "../../app/api/transfer-forms/[type]/route";

describe("GET /api/transfer-forms/[type]", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/transfer-forms/listing"), { params: { type: "listing" } });
    expect(res.status).toBe(401);
  });

  it("streams the listing form PDF when signed in", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "agent-1" } } as any);
    const res = await GET(new Request("http://localhost/api/transfer-forms/listing"), { params: { type: "listing" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("streams the pending-sale form PDF when signed in", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "agent-1" } } as any);
    const res = await GET(new Request("http://localhost/api/transfer-forms/pending-sale"), { params: { type: "pending-sale" } });
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("returns 404 for an unknown type", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "agent-1" } } as any);
    const res = await GET(new Request("http://localhost/api/transfer-forms/bogus"), { params: { type: "bogus" } });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/transfer-forms.test.ts`
Expected: FAIL — module `../../app/api/transfer-forms/[type]/route` does not exist yet.

- [ ] **Step 8: Create the download route**

Create `apps/web/src/app/api/transfer-forms/[type]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFileSync } from "fs";
import { join } from "path";
import { authOptions } from "@/lib/auth";

const ATTACHMENTS_DIR = join(process.cwd(), "src", "lib", "email", "attachments");

const FILES: Record<string, { file: string; downloadName: string }> = {
  listing: { file: "listing-transfer-authorization.pdf", downloadName: "CnC Realty - Listing Transfer Authorization.pdf" },
  "pending-sale": { file: "pending-sale-transfer-authorization.pdf", downloadName: "CnC Realty - Pending Sale Transfer Authorization.pdf" },
};

export async function GET(_req: Request, { params }: { params: { type: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = FILES[params.type];
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bytes = readFileSync(join(ATTACHMENTS_DIR, entry.file));
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${entry.downloadName}"`,
    },
  });
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/transfer-forms.test.ts`
Expected: FAIL still, unless the two PDF files already exist on disk — this is expected; Task 7 creates them. Confirm the failure is specifically a missing-file `ENOENT`, not a routing or auth problem, then proceed to Task 7 before re-running.

- [ ] **Step 10: Commit** (after Task 7 makes these tests pass — see Task 7 Step 3)

---

### Task 7: The two blank PDF templates

**Files:**
- Create: `apps/web/src/lib/email/attachments/listing-transfer-authorization.pdf`
- Create: `apps/web/src/lib/email/attachments/pending-sale-transfer-authorization.pdf`

**Interfaces:**
- Produces: two real, valid PDF files at the paths Task 6 already reads from.

- [ ] **Step 1: Generate an initial real draft of both PDFs from the spec's text**

These are static files, not app code — no permanent PDF-generation module belongs in the codebase for them (see the spec's "Why these are static files" section; a prior session already tried and reverted exactly that approach for the Office Policy Manual). Write a one-off script, run it once, delete it.

Create a temporary script (anywhere outside `apps/web/src`, e.g. the repo's scratch area) that uses `pdf-lib` (already a dependency) to lay out the exact drafted text from `docs/superpowers/specs/2026-09-14-agent-transfer-authorization-design.md` — the "Form content — Listing Authorization" and "Form content — Pending Sale Transfer Authorization" sections — onto a US Letter page, one blank line per underscore run, and save each to the two paths above. This does not need reusable helpers or tests; it is a one-time content-generation step whose *output* is what gets committed, not the script itself.

- [ ] **Step 2: Verify both files are valid PDFs**

Run: `node -e "const fs=require('fs'); for (const f of ['listing-transfer-authorization.pdf','pending-sale-transfer-authorization.pdf']) { const b = fs.readFileSync('apps/web/src/lib/email/attachments/'+f); console.log(f, b.subarray(0,5).toString()); }"`
Expected: both print `%PDF-`.

- [ ] **Step 3: Re-run the Task 6 tests now that both files exist**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/email.test.ts src/__tests__/api/transfer-forms.test.ts`
Expected: PASS, all tests.

- [ ] **Step 4: Delete the one-off generation script**

It produced its output; it has no ongoing purpose and should not be committed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/email/attachments/listing-transfer-authorization.pdf apps/web/src/lib/email/attachments/pending-sale-transfer-authorization.pdf
git commit -m "feat: add initial blank transfer-authorization PDF templates"
```

**Note for Ryan:** these are a first machine-generated draft of the exact text from the spec, meant to unblock the code and its tests — not the final visual layout. Please review and replace with your own hand-reviewed version before this goes live, the same way the Office Policy Manual was finalized.

---

### Task 8: Locked-state UI — agent dashboard, admin dashboard, and file cards

**Files:**
- Modify: `apps/web/src/components/transactions/FileCard.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx`
- Create: `apps/web/src/components/transactions/TransferPendingPanel.tsx`

**Interfaces:**
- Consumes: `ListingStatus.PENDING_TRANSFER`/`TransactionFileStatus.PENDING_TRANSFER` (Task 1), `ChecklistPanel` (existing, unmodified), `PATCH /api/listings/[id]` and `PATCH /api/transactions/[id]` (existing, already support `propertyAddress` — no route changes needed), `GET /api/transfer-forms/[type]` (Task 6).

This task is UI-only; no new automated tests are meaningful for JSX layout in this codebase (there is no component-render test infrastructure here — confirmed absent project-wide). Verify by hand in the browser per Step 5.

- [ ] **Step 1: Fix `FileCard` so the sentinel placeholder values never render**

In `apps/web/src/components/transactions/FileCard.tsx`, add a `PENDING_TRANSFER` branch *before* the existing `address ? (...) : (...)` check:

```tsx
      <div className="flex items-start justify-between gap-2">
        <div>
          {status === "PENDING_TRANSFER" ? (
            <>
              <p className="font-medium text-[#1B1B1B] line-clamp-1">Locked — Pending Transfer</p>
              <p className="text-sm text-[#1B1B1B]/50">Upload the signed authorization to unlock</p>
            </>
          ) : address ? (
            <>
              <p className="font-medium text-[#1B1B1B] line-clamp-1">{address}</p>
              <p className="text-sm text-[#1B1B1B]/50">{city}, CA</p>
            </>
          ) : (
            <>
              <p className="font-medium text-[#1B1B1B] line-clamp-1">Referral — {referredToAgentName ?? "Unnamed"}</p>
              <p className="text-sm text-[#1B1B1B]/50">Outbound referral</p>
            </>
          )}
        </div>
        <StatusBadge status={status} />
      </div>
```

Also guard the `listPrice` line just below it so the `0` sentinel never shows as `$0`:

```tsx
      {status !== "PENDING_TRANSFER" && listPrice && (
        <p className="text-sm font-medium text-[#1B1B1B]">${listPrice.toLocaleString()}</p>
      )}
```

- [ ] **Step 2: Create `TransferPendingPanel`**

Create `apps/web/src/components/transactions/TransferPendingPanel.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { ChecklistPanel } from "./ChecklistPanel";
import type { FileChecklistItemWithDocs } from "@/types/transaction";

interface Props {
  fileType: "listing" | "transaction";
  fileId: string;
  checklistItems: FileChecklistItemWithDocs[];
  onUploaded: () => void;
}

export function TransferPendingPanel({ fileType, fileId, checklistItems, onUploaded }: Props) {
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setSaving(true);
    const endpoint = fileType === "listing" ? `/api/listings/${fileId}` : `/api/transactions/${fileId}`;
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyAddress: address }),
    });
    setSaving(false);
    setSaved(res.ok);
  }

  const downloadHref = fileType === "listing" ? "/api/transfer-forms/listing" : "/api/transfer-forms/pending-sale";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">This file is locked</h2>
        <p className="text-sm text-[#1B1B1B]/60">
          You told us you have {fileType === "listing" ? "an active listing" : "a pending sale"} to transfer from
          your previous brokerage. Download the blank transfer authorization below, get it signed by your previous
          broker, then upload the signed copy — this file unlocks the moment it's approved.
        </p>
        <a
          href={downloadHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#1B1B1B]/20 px-4 py-2 text-sm text-[#1B1B1B] hover:border-[#1B1B1B]/40"
        >
          <Download className="h-4 w-4" /> Download blank form
        </a>
      </div>

      <form onSubmit={saveAddress} className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Property Address (optional)</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => { setAddress(e.target.value); setSaved(false); }}
            placeholder="123 Main St, Anytown, CA"
            className="flex-1 rounded-lg border border-[#1B1B1B]/15 bg-[#F2F0EF] px-3 py-2 text-sm text-[#1B1B1B] outline-none focus:border-[#1B1B1B]/40"
          />
          <button
            type="submit"
            disabled={saving || !address.trim()}
            className="rounded-full bg-[#9E8C61] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {saved && <p className="text-xs text-green-600">Saved.</p>}
      </form>

      <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Upload Signed Authorization</h2>
        <ChecklistPanel
          fileType={fileType === "listing" ? "LISTING" : "TRANSACTION"}
          fileId={fileId}
          items={checklistItems}
          onUploaded={onUploaded}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire it into the agent file detail page**

In `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx`, import it:

```typescript
import { TransferPendingPanel } from "@/components/transactions/TransferPendingPanel";
```

Add a locked check right after `const isReferral = ...` (around line 108):

```typescript
  const isLocked = file.status === "PENDING_TRANSFER";
```

Replace the `title` computation (lines 113–117) so it never touches the sentinel fields:

```typescript
  const title = isLocked
    ? "Locked — Pending Transfer"
    : file.propertyAddress
      ? `${file.propertyAddress}, ${file.city ?? ""}, ${file.state} ${file.zip ?? ""}`
      : isReferral
        ? "Referral File"
        : `${file.city ?? ""} ${file.state} ${file.zip ?? ""}`.trim();
```

Hide price/tabs/submit-for-review while locked (update the existing conditionals):

```typescript
  const price = isLocked ? null : (isListing
    ? (listing?.listPrice ? `$${Number(listing.listPrice).toLocaleString()}` : null)
    : (transaction?.salePrice
        ? `$${Number(transaction.salePrice).toLocaleString()}`
        : transaction?.leasePrice
          ? `$${Number(transaction.leasePrice).toLocaleString()}/mo`
          : null));
```

And guard the "Submit for Review" button (around line 164):

```typescript
            {!isReferral && !isLocked && !file.awaitingReview && (
              <button onClick={submitForReview} className="rounded-full bg-[#9E8C61] px-4 py-2 text-sm text-white">
                Submit for Review
              </button>
            )}
```

Finally, two surgical edits around the existing tab-switcher-and-content block, without touching its ~70 lines of interior JSX:

**Edit A** — immediately *before* the tab-switcher `<div>`, insert the locked-panel branch and open a `{!isLocked && (<>` wrapper. Find this exact existing line:

```tsx
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-[#F2F0EF] p-1 w-fit max-w-full">
        {visibleTabs.map((t) => (
```

Replace it with:

```tsx
      {isLocked && (
        <TransferPendingPanel
          fileType={fileType as "listing" | "transaction"}
          fileId={id}
          checklistItems={file.checklistItems as FileChecklistItemWithDocs[]}
          onUploaded={load}
        />
      )}

      {!isLocked && (
      <>
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-[#F2F0EF] p-1 w-fit max-w-full">
        {visibleTabs.map((t) => (
```

**Edit B** — immediately *after* the existing `activity` tab's closing block, close the `<>`/`{!isLocked && (...)}` wrapper opened in Edit A. Find this exact existing block (the last one in the file's tab-content section, right before the component's closing `</div>` / `);` / `}`):

```tsx
      {tab === "activity" && (
        <ActivityFeed
          fileType={fileType as "listing" | "transaction"}
          fileId={id}
          activities={file.activities ?? []}
          onNoteAdded={load}
        />
      )}
    </div>
  );
}
```

Replace it with:

```tsx
      {tab === "activity" && (
        <ActivityFeed
          fileType={fileType as "listing" | "transaction"}
          fileId={id}
          activities={file.activities ?? []}
          onNoteAdded={load}
        />
      )}
      </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire the locked state into the admin file detail page**

In `apps/web/src/app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx`, replace the title line and the status-dropdown block:

```tsx
          <div>
            <h1 className="text-xl font-light text-[#1B1B1B]">
              {file.status === "PENDING_TRANSFER" ? "Locked — Pending Transfer" : `${file.propertyAddress}, ${file.city}, ${file.state} ${file.zip}`}
            </h1>
            {/* ...unchanged badges below this line... */}
          </div>

          <div className="flex items-center gap-2">
            {file.status === "PENDING_TRANSFER" ? (
              <span className="rounded-full bg-purple-100 px-3 py-1.5 text-xs font-medium text-purple-700">
                Approve the uploaded document below to unlock
              </span>
            ) : (
              <select
                disabled={statusLoading}
                value={file.status}
                onChange={(e) => changeStatus(e.target.value)}
                className="rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2 text-sm text-[#1B1B1B] disabled:opacity-50"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            )}
          </div>
```

(The existing `documents`/`activity` tabs and `DocumentReviewCard` approve button need no changes — they already work against whatever checklist items exist, and Task 5 already made approving the seeded item do the unlock.)

- [ ] **Step 5: Manually verify end-to-end in the browser**

Run: `pnpm --filter web dev`. Using an application that answers "Yes" with a count to at least one transfer question (from Task 3), approve it as admin, then:
1. Confirm the expected number of locked placeholder files appear in `/dashboard/transactions` labeled "Locked — Pending Transfer", with no `$0` price and no sentinel address text visible anywhere.
2. Open one — confirm the locked panel shows (download link, address field, upload widget) and no other tabs.
3. Save a property address, confirm it persists on reload.
4. Upload a file against the checklist item.
5. As admin, open `/admin/transactions/listing/[id]` (or `transaction`), confirm the title shows "Locked — Pending Transfer", the status dropdown is replaced by the purple note, and approve the uploaded document.
6. Reload the agent-side file — confirm it now shows the normal tabbed file view with status `INCOMPLETE`, and that the address you saved is present under the Overview tab.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/transactions/FileCard.tsx apps/web/src/components/transactions/TransferPendingPanel.tsx "apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx" "apps/web/src/app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx"
git commit -m "feat: locked-file UI for pending transfer placeholders, agent and admin dashboards"
```

---

### Task 9: Allow deleting an abandoned `PENDING_TRANSFER` listing placeholder

**Files:**
- Modify: `apps/web/src/app/api/listings/[id]/route.ts:92–93`
- Create: `apps/web/src/__tests__/api/listings-id-delete.test.ts` (confirmed absent — the existing `DELETE` handler's `"Only INCOMPLETE files can be deleted"` guard has no test anywhere in the repo today)

**Interfaces:**
- Produces: `DELETE /api/listings/[id]` also succeeds for a `PENDING_TRANSFER` file, matching the existing `INCOMPLETE` precedent (a transfer that falls through shouldn't leave permanent clutter). `TransactionFile` has no DELETE route today — not adding one is intentional; do not introduce new delete capability beyond what already exists for listings.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/__tests__/api/listings-id-delete.test.ts`. The real route (`apps/web/src/app/api/listings/[id]/route.ts`) calls `getServerSession(authOptions)`, `prisma.listingFile.findUnique`/`.delete`, and the real (unmocked) `checkOwnership` from `@/lib/api-auth` — using `role: "ADMIN"` in the session sidesteps the ownership check entirely, which is the simplest correct setup for this test:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn(), delete: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { DELETE } from "../../app/api/listings/[id]/route";

describe("DELETE /api/listings/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("still allows deleting an INCOMPLETE listing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "ADMIN", agentId: null } } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "listing-1", status: "INCOMPLETE", agentId: "agent-1" } as any);

    const res = await DELETE(new Request("http://localhost/api/listings/listing-1", { method: "DELETE" }), { params: { id: "listing-1" } });

    expect(res.status).toBe(200);
    expect(prisma.listingFile.delete).toHaveBeenCalledWith({ where: { id: "listing-1" } });
  });

  it("also allows deleting a PENDING_TRANSFER listing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "ADMIN", agentId: null } } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "listing-2", status: "PENDING_TRANSFER", agentId: "agent-1" } as any);

    const res = await DELETE(new Request("http://localhost/api/listings/listing-2", { method: "DELETE" }), { params: { id: "listing-2" } });

    expect(res.status).toBe(200);
    expect(prisma.listingFile.delete).toHaveBeenCalledWith({ where: { id: "listing-2" } });
  });

  it("still rejects deleting an ACTIVE listing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "ADMIN", agentId: null } } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "listing-3", status: "ACTIVE", agentId: "agent-1" } as any);

    const res = await DELETE(new Request("http://localhost/api/listings/listing-3", { method: "DELETE" }), { params: { id: "listing-3" } });

    expect(res.status).toBe(400);
    expect(prisma.listingFile.delete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/listings-id-delete.test.ts`
Expected: the first and third tests PASS already (existing behavior); the second (`PENDING_TRANSFER`) FAILS with a 400, since the route doesn't allow it yet.

- [ ] **Step 3: Widen the guard**

In `apps/web/src/app/api/listings/[id]/route.ts`:

```typescript
  if (listing.status !== "INCOMPLETE" && listing.status !== "PENDING_TRANSFER") {
    return NextResponse.json({ error: "Only INCOMPLETE or PENDING_TRANSFER files can be deleted" }, { status: 400 });
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/listings-id-delete.test.ts`
Expected: PASS, all three tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/listings/[id]/route.ts apps/web/src/__tests__/api/listings-id-delete.test.ts
git commit -m "feat: allow deleting an abandoned PENDING_TRANSFER listing placeholder"
```

---

## Final Verification

After all 9 tasks:

- [ ] Run the full suite: `pnpm --filter web exec vitest run` — expect 100% pass, no new failures versus the pre-existing baseline.
- [ ] Typecheck: `pnpm --filter web exec tsc --noEmit` — no new errors.
- [ ] Production build: `rm -rf apps/web/.next && pnpm --filter web exec next build` — this project has previously shipped a change that broke the build while `tsc` and `vitest` stayed green, so this step is not optional.
- [ ] Manual browser walkthrough per Task 8 Step 5, end to end, on a real dev server.
