# Mobile Layout — Sub-project 7b (Transactions: agent + admin file pages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones and upright iPads (<1024px) the Transactions pages — file list, file detail (agent + admin), New Transaction and New Listing wizards — fit the screen with nothing cut off, while desktop stays pixel-identical.

**Architecture:** Same method as 7a: phone-only words appended to existing class strings, shared ones through named bundles in `lib/dashboard-phone.ts` (every word pinned to a phone-only prefix by a test). The step-bar markup copied verbatim in both wizards moves into one `WizardStepBar` component that renders today's desktop bar (hidden below 1024px) plus a compact phone bar driven by a tested `wizardStepLabel` helper.

**Tech Stack:** Next.js 14 App Router, Tailwind 3.4.19, Vitest (node env, `src/**/*.test.ts`), Puppeteer for controller browser checks.

**Spec:** `docs/superpowers/specs/2026-10-07-mobile-dashboard-transactions-design.md` (parents: `2026-10-03-mobile-layout-design.md`, `2026-10-06-mobile-dashboard-shell-design.md`)

## Global Constraints

- **Desktop (≥1024px) pixel-identical.** Existing class strings are only ever *appended to*; appended words are `max-lg:` (below 1024px) or `max-sm:` (below 640px), except `lg:hidden` on elements that exist only for phones and `max-lg:hidden` on the desktop-only step bar.
- **Reuse first:** 7a's bundles (`PHONE_TAB_BAR`, `PHONE_TABLE_FRAME`, `PHONE_FIELDS_16`, …), `FormField`, `DateField`, existing `components/transactions/*`. New shared bundle/component only when used in more than one place.
- **No new libraries.** Load speed not worse on desktop or phone.
- **Every task ends with:** full suite (`cd apps/web && npx vitest run`), `npx tsc --noEmit`, clean build (`rm -rf apps/web/.next && pnpm --filter web build`). Before deleting `.next`, check `netstat -ano | grep ":3000 .*LISTEN"` — if Ryan's dev server is running, do not delete `.next`; report instead. The controller stops its own port-3100 server before any build.
- Commit per task, messages ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **No push** (Ryan: nothing pushed until 7e is complete).
- **Sample data:** transaction `cmuyp01k5000110p7ck96mrp5`, listing `cmuyp0239000h10p7adcgwcqc` (fake, Ryan-approved). Browser checks may open/close popups and type into wizard fields, but never submit a wizard, upload, change status, or edit a sample file — the samples must stay identical so desktop fingerprints stay comparable.

## Review Focus

1. **Long address / long party names on a 320px phone** — header text wraps, never pushes buttons off-screen. The sample transaction has a 49-character address; checked in Tasks 5 and 6.
2. **Referral wizard on a phone** — "Step 3 of 3 · Review" on the Review step (raw index 5 → bar position 2). Pinned by the `wizardStepLabel` clamp test in Task 2; walked in Task 5.
3. **Exactly 1024px wide** — full desktop bar and side-by-side header. Fingerprints at 1024×768 in Tasks 1 and 6.
4. **Upright iPad (820×1180)** gets the phone layout (stacked header, compact bar) and it must look intentional, not stretched. Checked in Tasks 5 and 6.
5. **Admin file with the purple "Approve the uploaded document below to unlock" pill (pending transfer)** — wraps inside the stacked actions instead of overflowing. Not reproducible with the samples (no pending-transfer file); covered by `max-lg:[&>*]:w-full` + `whitespace` default wrapping, reviewed in Task 4.

## Controller toolkit

Work dir for scripts and results: `.superpowers/7b-survey/` (git-ignored). Login: admin `ryanchong@cncrealtygroup.com` / `Fakeaccount1!` (the `info@` test login no longer works). Puppeteer: `C:/Users/hey_r/AppData/Local/npm-cache/_npx/ab5cd9f6d13a2312/node_modules/puppeteer`, Chrome `C:/Program Files/Google/Chrome/Application/chrome.exe`, **headless**.

**VIEWS (19):** `/dashboard/transactions`, `/dashboard/transactions/new-transaction`, `/dashboard/transactions/new-listing`, `/dashboard/transactions/transaction/{T}?tab=` × `overview checklist commission documents tasks parties activity`, `/dashboard/transactions/listing/{L}?tab=` × `overview checklist documents tasks parties activity`, `/admin/transactions`, `/admin/transactions/transaction/{T}`, `/admin/transactions/listing/{L}`.

**FINGERPRINT** (`fingerprint.cjs`): for each VIEW at 1440×900 and 1024×768 (desktop, DPR 1), load, wait 2500ms, then hash every element box under the dashboard frame (`document.querySelector("aside").parentElement`), transforms neutralized, boxes relative to the frame, zero-size boxes skipped — the 7a MEASURE:

```js
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(16) + ":" + s.length; };
const measure = (root) => { const els = [root, ...root.querySelectorAll("*")]; const sv = els.map((e) => e.style ? e.style.transform : null); els.forEach((e) => { if (e.style) e.style.transform = "none"; }); const r0 = root.getBoundingClientRect();
  const s = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 || r.height > 0).map((r) => [Math.round(r.left - r0.left), Math.round(r.top - r0.top), Math.round(r.width), Math.round(r.height)].join(",")).join("|");
  els.forEach((e, i) => { if (e.style) e.style.transform = sv[i]; }); return hash(s); };
```

Writes `fp-<label>.json` (38 hashes); `node fingerprint.cjs 3100 <label> [compareTo]` prints `38/38 identical` or the differing view+size.

**HTML-SAME** (in `fingerprint.cjs`, wizards only): fetch the server HTML of both wizards from the logged-in page (`fetch(url).then(r => r.text())`), keep only the dashboard `<main>…</main>`, remove every class word starting `max-lg:`/`max-sm:`, and remove elements whose class contains the word `lg:hidden`; then compare to the baseline the same way. Also strip Next's per-build asset hashes (`/_next/static/...` paths and `"buildId"`).

**PHONE-SURVEY** (`survey.cjs`, already written): all VIEWS at 320×568, 390×844, 844×390, 820×1180; reports overflow of the inner dashboard `<main>` (the page has two `<main>`; use the last) and every element sticking out past the viewport that isn't inside an `overflow-x:auto/scroll` box; fields <16px.

**SPEED** (`.superpowers/speed-ab.cjs`): `node .superpowers/speed-ab.cjs <port> desktop|phone <label>` with `SPEED_EMAIL`/`SPEED_PASSWORD` set; for this plan change its `PAGES` to `/dashboard/transactions`, `/dashboard/transactions/transaction/{T}`, `/dashboard/transactions/new-transaction`.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `apps/web/src/lib/dashboard-phone.ts` | modify | + `PHONE_HEADER_STACK`, `PHONE_HEADER_ACTIONS`, `PHONE_FIELD_PAIR` |
| `apps/web/src/__tests__/lib/dashboard-phone.test.ts` | modify | allow `max-sm:`, list 10 bundles |
| `apps/web/src/lib/wizard-steps.ts` | create | `wizardStepIndex`, `wizardStepLabel` (pure) |
| `apps/web/src/__tests__/lib/wizard-steps.test.ts` | create | label + clamp tests |
| `apps/web/src/components/transactions/WizardStepBar.tsx` | create | desktop bar (verbatim) + compact phone bar |
| `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx` | modify | use `WizardStepBar`; phone spacing/padding; date pairs stack |
| `apps/web/src/app/(dashboard)/dashboard/transactions/new-listing/page.tsx` | modify | same |
| `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx` | modify | stacked header on phones |
| `apps/web/src/app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx` | modify | stacked header on phones |
| `apps/web/src/app/(dashboard)/dashboard/transactions/page.tsx` | modify | heading + button pair on phones |

---

### Task 1: Baselines (controller)

- [ ] `git status -s apps/web/src` empty; record `BASE_SHA` (= HEAD, includes the 7b spec). The current `apps/web/.next` is the clean build of `01863be` source (apps/web unchanged since) — reuse it, no rebuild.
- [ ] Create the old-build copy for the final speed A/B: `git worktree add <scratchpad>/b7b BASE_SHA`, `pnpm install --frozen-lockfile` in it, copy `apps/web/.env.local` and the current `apps/web/.next` into `<scratchpad>/b7b/apps/web/`.
- [ ] Write `fingerprint.cjs` (toolkit). Serve 3100 (`cd apps/web && npx next start -p 3100`). Run FINGERPRINT twice (`base1`, `base2`) — both must be 38/38 identical to each other; keep `base1`. Save HTML-SAME baselines of both wizards.
- [ ] PHONE-SURVEY → `survey-base.json` (matches the spec's survey table). Stop 3100.

### Task 2: Phone bundles + step-label helper

**Files:** Modify `apps/web/src/lib/dashboard-phone.ts`, `apps/web/src/__tests__/lib/dashboard-phone.test.ts`; Create `apps/web/src/lib/wizard-steps.ts`, `apps/web/src/__tests__/lib/wizard-steps.test.ts`

**Interfaces — Produces:**
- `PHONE_HEADER_STACK`, `PHONE_HEADER_ACTIONS`, `PHONE_FIELD_PAIR` (all `string`) from `@/lib/dashboard-phone`
- `wizardStepIndex(steps: readonly string[], current: number): number` and `wizardStepLabel(steps: readonly string[], current: number): string` from `@/lib/wizard-steps`

- [ ] **Step 1: Failing tests.** Replace `apps/web/src/__tests__/lib/dashboard-phone.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import * as bundle from "@/lib/dashboard-phone";

describe("dashboard phone bundle", () => {
  it("exports the ten phone bundles", () => {
    expect(Object.keys(bundle).sort()).toEqual([
      "PHONE_DRAG_CARD", "PHONE_DRAWER_PANEL", "PHONE_FIELDS_16", "PHONE_FIELD_PAIR", "PHONE_HEADER_ACTIONS",
      "PHONE_HEADER_STACK", "PHONE_POPUP_FRAME", "PHONE_POPUP_PANEL", "PHONE_TABLE_FRAME", "PHONE_TAB_BAR",
    ]);
  });

  it("every class word is phone-only (below 1024px or below 640px), so nothing here can reach desktop", () => {
    for (const [name, value] of Object.entries(bundle)) {
      expect(typeof value, name).toBe("string");
      const words = (value as string).split(/\s+/).filter(Boolean);
      expect(words.length, name).toBeGreaterThan(0);
      for (const word of words) expect(word, `${name}: ${word}`).toMatch(/^max-(lg|sm):/);
    }
  });

  it("drag cards carry the -webkit- prefixed user-select (iOS Safari ignores the unprefixed one)", () => {
    expect(bundle.PHONE_DRAG_CARD.split(/\s+/)).toContain("max-lg:[-webkit-user-select:none]");
  });

  it("header actions make the status select full width too (it sits inside a wrapper div)", () => {
    expect(bundle.PHONE_HEADER_ACTIONS.split(/\s+/)).toContain("max-lg:[&_select]:w-full");
  });
});
```

Create `apps/web/src/__tests__/lib/wizard-steps.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { wizardStepIndex, wizardStepLabel } from "@/lib/wizard-steps";

const SIX = ["File Type", "Property", "Details", "Parties", "Commission", "Review"];
const REFERRAL = ["File Type", "Referral Details", "Review"];

describe("wizardStepLabel", () => {
  it("names the current step out of the total", () => {
    expect(wizardStepLabel(SIX, 0)).toBe("Step 1 of 6 · File Type");
    expect(wizardStepLabel(SIX, 1)).toBe("Step 2 of 6 · Property");
    expect(wizardStepLabel(SIX, 5)).toBe("Step 6 of 6 · Review");
  });

  it("clamps an index past the end to the last step (referral reuses index 5 for Review)", () => {
    expect(wizardStepLabel(REFERRAL, 5)).toBe("Step 3 of 3 · Review");
    expect(wizardStepIndex(REFERRAL, 5)).toBe(2);
  });

  it("clamps a negative index to the first step", () => {
    expect(wizardStepLabel(SIX, -1)).toBe("Step 1 of 6 · File Type");
    expect(wizardStepIndex(SIX, -1)).toBe(0);
  });

  it("returns an empty label for an empty step list", () => {
    expect(wizardStepLabel([], 0)).toBe("");
  });
});
```

- [ ] **Step 2:** `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/lib/dashboard-phone.test.ts src/__tests__/lib/wizard-steps.test.ts` — Expected FAIL (missing exports / cannot find `@/lib/wizard-steps`).
- [ ] **Step 3: Implement.** Append to `apps/web/src/lib/dashboard-phone.ts` (and change the header comment's "Every word must start with `max-lg:`" to "Every word must start with `max-lg:` or `max-sm:`"):

```ts
// Page header row (title left, actions right): stacks on phones — title full width, actions below.
export const PHONE_HEADER_STACK = "max-lg:flex-col max-lg:items-stretch";
// The header's actions group: one full-width row per action on phones (the status select sits
// inside a wrapper div, so it needs its own full-width word).
export const PHONE_HEADER_ACTIONS =
  "max-lg:w-full max-lg:flex-col max-lg:items-stretch max-lg:[&>*]:w-full max-lg:[&>*]:justify-center max-lg:[&>*]:text-center max-lg:[&_select]:w-full";
// Two-column field pair in a wizard card: one field per row on narrow phones (below 640px).
export const PHONE_FIELD_PAIR = "max-sm:grid-cols-1";
```

Create `apps/web/src/lib/wizard-steps.ts`:

```ts
// Which step the wizard is on, clamped into the step list. The New Transaction wizard's
// referral flow reuses raw index 5 for Review on a 3-step list; clamping keeps it on "Review".
export function wizardStepIndex(steps: readonly string[], current: number): number {
  return Math.min(Math.max(current, 0), Math.max(steps.length - 1, 0));
}

// Compact phone step label, e.g. "Step 2 of 6 · Property".
export function wizardStepLabel(steps: readonly string[], current: number): string {
  if (steps.length === 0) return "";
  const i = wizardStepIndex(steps, current);
  return `Step ${i + 1} of ${steps.length} · ${steps[i]}`;
}
```

- [ ] **Step 4:** Both test files pass (4 + 4). Full suite, `tsc --noEmit`, clean build. Confirm in `.next/static/css/*.css` that `max-sm\:grid-cols-1` and `max-lg\:\[\&_select\]\:w-full` exist (they will once Task 3/4 use them — if absent now because no file uses them yet, note it; Tailwind only emits used classes. `lib/**` is in Tailwind's content so they should be emitted from this file alone).
- [ ] **Step 5:** Commit `feat: phone bundles for stacked headers and field pairs; tested wizard step label`.

### Task 3: Shared wizard step bar + wizard phone layout

**Files:** Create `apps/web/src/components/transactions/WizardStepBar.tsx`; Modify `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx`, `apps/web/src/app/(dashboard)/dashboard/transactions/new-listing/page.tsx`

**Interfaces — Consumes:** `wizardStepIndex`, `wizardStepLabel` (`@/lib/wizard-steps`), `PHONE_FIELD_PAIR` (`@/lib/dashboard-phone`). **Produces:** `WizardStepBar({ steps, current }: { steps: readonly string[]; current: number })`.

- [ ] **Step 1: Create** `apps/web/src/components/transactions/WizardStepBar.tsx`. The first block is the wizards' existing step bar, character-for-character (only `STEPS`→`steps`, `displayStep`/`step`→`current`, and ` max-lg:hidden` appended to the outer class):

```tsx
import { wizardStepIndex, wizardStepLabel } from "@/lib/wizard-steps";

// Step bar shared by the New Transaction and New Listing wizards. Desktop: the full
// labelled bar (unchanged markup). Phones (<1024px): dots + "Step 2 of 6 · Property".
export function WizardStepBar({ steps, current }: { steps: readonly string[]; current: number }) {
  const phoneIndex = wizardStepIndex(steps, current);
  return (
    <>
      <div className="mb-20 mx-auto flex max-w-5xl items-center max-lg:hidden">
        {steps.flatMap((s, i) => {
          const done = i < current;
          const active = i === current;
          const el = (
            <div key={s} className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
              {active && <div className="h-3 w-3 rounded-full bg-[#1B1B1B]" />}
              {done && <div className="h-3 w-3 rounded-full bg-[#9E8C61]" />}
              <span
                className={`text-base ${active ? "font-semibold text-[#1B1B1B]" : done ? "text-[#9E8C61]" : "text-[#1B1B1B]/30"}`}
              >
                {s}
              </span>
            </div>
          );
          if (i < steps.length - 1)
            return [el, <div key={`ln-${i}`} className="mx-3 h-px flex-1 bg-[#1B1B1B]/10" />];
          return [el];
        })}
      </div>
      <div className="mb-8 lg:hidden">
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-2.5 w-2.5 rounded-full ${i < phoneIndex ? "bg-[#9E8C61]" : i === phoneIndex ? "bg-[#1B1B1B]" : "bg-[#1B1B1B]/15"}`}
            />
          ))}
        </div>
        <p className="mt-3 text-sm font-semibold text-[#1B1B1B]">{wizardStepLabel(steps, current)}</p>
      </div>
    </>
  );
}
```

Note: the desktop block deliberately uses raw `current` (not clamped) — exactly today's behaviour, where the New Transaction page already passes the mapped `displayStep`.

- [ ] **Step 2: New Transaction page.** In `new-transaction/page.tsx`:
  - Add imports: `import { WizardStepBar } from "@/components/transactions/WizardStepBar";` and `import { PHONE_FIELD_PAIR } from "@/lib/dashboard-phone";`
  - Replace the whole `{/* Step bar */}` block (the `<div className="mb-20 mx-auto flex max-w-5xl items-center">` … its closing `</div>`, currently ~lines 304–324) with:
    ```tsx
          {/* Step bar */}
          <WizardStepBar steps={STEPS} current={displayStep} />
    ```
  - Heading wrapper `<div className="mb-16">` (above `<h1 …>New Transaction</h1>`) → `<div className="mb-16 max-lg:mb-6">`.
  - Card `<div className="mx-auto max-w-2xl rounded-2xl border border-[#1B1B1B]/8 bg-white p-10">` → append ` max-lg:p-5`.
  - The five date-pair grids get `PHONE_FIELD_PAIR` (convert `className="…"` to ``className={`… ${PHONE_FIELD_PAIR}`}``). Identify each by the line after it (the class strings repeat, so match on context):
    1. `mb-4 grid grid-cols-2 gap-4` followed by `<DateFieldRow label={offerLabels.date}`
    2. `grid grid-cols-2 gap-4` followed by `{isLease ? (` (Lease Signed/Start, Acceptance/Close of Escrow)
    3. `grid grid-cols-2 gap-4` followed by `<DateFieldRow label="Inspection Deadline"`
    4. `mt-4 grid grid-cols-2 gap-4` followed by `<DateFieldRow label="Loan Approval Deadline"`
    5. `grid grid-cols-2 gap-3` followed by `<Field label="Condition Name"`
  - No other grid changes in this task (Task 5 decides any others from the step-by-step walk).
- [ ] **Step 3: New Listing page.** In `new-listing/page.tsx`: same two imports; replace its `{/* Step bar */}` block (`<div className="mb-20 mx-auto flex max-w-5xl items-center">` … closing `</div>`, ~lines 73–93) with `<WizardStepBar steps={STEPS} current={step} />`; heading `<div className="mb-16">` → `"mb-16 max-lg:mb-6"`; card (`… bg-white p-10`) append ` max-lg:p-5`; the `grid grid-cols-2 gap-4` followed by the "List Date" label div gets `PHONE_FIELD_PAIR`.
- [ ] **Step 4:** `grep -n "mb-20 mx-auto flex max-w-5xl" apps/web/src -r` → only `WizardStepBar.tsx`. Full suite, `tsc --noEmit`, clean build.
- [ ] **Step 5:** Commit `feat: wizards share one step bar — desktop unchanged, compact "Step 2 of 6" on phones; date pairs stack on narrow phones`.
- [ ] **Controller after review:** FINGERPRINT vs `base1` = 38/38; HTML-SAME for both wizards = identical; PHONE-SURVEY: no step-bar overflow on either wizard at any size.

### Task 4: Stacked file headers (agent + admin) and the file list header

**Files:** Modify `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx`, `apps/web/src/app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx`, `apps/web/src/app/(dashboard)/dashboard/transactions/page.tsx`

**Interfaces — Consumes:** `PHONE_HEADER_STACK`, `PHONE_HEADER_ACTIONS` (`@/lib/dashboard-phone`).

- [ ] **Step 1: Agent file detail** (`dashboard/transactions/[fileType]/[id]/page.tsx`): add `import { PHONE_HEADER_STACK, PHONE_HEADER_ACTIONS } from "@/lib/dashboard-phone";`.
  - `<div className="flex items-start justify-between gap-4">` (the first one, directly inside `<div className="mb-6">` at the top of the returned JSX, ~line 224) → ``<div className={`flex items-start justify-between gap-4 ${PHONE_HEADER_STACK}`}>``
  - `<div className="flex shrink-0 gap-2">` (the actions group holding ConvertListingButton / Submit for Review / FileStatusSelect, ~line 242) → ``<div className={`flex shrink-0 gap-2 ${PHONE_HEADER_ACTIONS}`}>``
- [ ] **Step 2: Admin file detail** (`admin/transactions/[fileType]/[id]/page.tsx`; it already imports `PHONE_TAB_BAR` from `@/lib/dashboard-phone` — extend that import):
  - `<div className="flex items-start justify-between gap-4">` (directly below the "All Files" back link, ~line 147) → ``<div className={`flex items-start justify-between gap-4 ${PHONE_HEADER_STACK}`}>``
  - `<div className="flex items-center gap-2">` that opens the actions group (the one containing `ConvertListingButton` and `FileStatusSelect`, ~line 170 — NOT the `mt-1 flex items-center gap-3` badge row and NOT the review-card rows lower down) → ``<div className={`flex items-center gap-2 ${PHONE_HEADER_ACTIONS}`}>``
- [ ] **Step 3: Agent file list** (`dashboard/transactions/page.tsx`; already imports `PHONE_TAB_BAR` — extend the import with `PHONE_HEADER_STACK`):
  - `<div className="mb-6 flex items-center justify-between">` → ``<div className={`mb-6 flex items-center justify-between ${PHONE_HEADER_STACK} max-lg:gap-3`}>``
  - `<div className="flex gap-2">` (holding the New Listing / New Transaction links) → `<div className="flex gap-2 max-lg:grid max-lg:grid-cols-2 max-lg:[&>*]:justify-center">`
  - The admin All Files page already fits — do not change it.
- [ ] **Step 4:** Full suite, `tsc --noEmit`, clean build.
- [ ] **Step 5:** Commit `feat: file headers stack on phones (address, then full-width actions); list buttons sit under the heading`.
- [ ] **Controller after review:** FINGERPRINT vs `base1` = 38/38; PHONE-SURVEY: no header/list overflow at any size; screenshots at 390 and 820 of agent T-overview, L-overview, admin-T, list.

### Task 5: Step-by-step phone walk + in-tab controls (controller, fixes dispatched)

- [ ] Serve 3100. At **320×568** and **390×844** (and 820×1180 for step 1 only), walk New Transaction for **Purchase** (all 6 steps), **Lease Tenant** (steps 2–3, the lease date pair) and **Referral** (all 3 steps, check "Step 3 of 3 · Review"), and New Listing (all 4 steps). Fill only what each step's Next button needs (fake values, `ZZ` prefix); **never press Create**. At every step record: inner-`<main>` overflow, elements past the viewport, fields <16px, Next/Back reachable, step label text.
- [ ] On the sample files at 390×844: open/close the Upload button's file picker trigger (don't pick a file), Add Party form, Add Task form, Add Note field, an inline-edit pencil on Overview, the status select, the cancel-request form (open via selecting "Request Cancellation" then press Cancel — this does not submit). Record any overflow or unreachable control.
- [ ] For each problem found: dispatch one fix (same implementer rules), reusing an existing bundle first (`PHONE_FIELD_PAIR`, `PHONE_HEADER_ACTIONS`, `PHONE_TAB_BAR`, `PHONE_TABLE_FRAME`, `PHONE_POPUP_*`), a new `max-lg:`/`max-sm:` word only if none fits. Each fix is reviewed, then FINGERPRINT = 38/38. If nothing is found, record "walk clean" in the ledger and skip the dispatch.
- [ ] Stop 3100.

### Task 6: Final verification (controller)

- [ ] Clean build of HEAD, serve 3100. FINGERPRINT vs `base1` = 38/38 (run twice). HTML-SAME both wizards = identical.
- [ ] PHONE-SURVEY at all four sizes: inner-`<main>` overflow 0 and no element past the viewport on all 19 VIEWS; fields ≥16px. Compare to `survey-base.json`.
- [ ] SPEED A/B: serve the old build from `<scratchpad>/b7b` on 3101 and HEAD on 3100; run `speed-ab.cjs` (PAGES per toolkit) interleaved 3100, 3101, 3100, 3101 for desktop, then 3100, 3101 for phone. Expect no difference beyond run-to-run noise; JS request counts equal. Record in the ledger.
- [ ] Stop both servers; remove the `b7b` worktree (`git worktree remove --force`, then `rmdir /s /q "\\?\<path>"` if the path is too long).
- [ ] **After the final whole-branch review is clean:** delete the two sample files with their checklist items, documents, tasks, parties and activity (check no `Deal` links first), then confirm zero rows for both IDs in every child table and zero `TransactionFile`/`ListingFile` rows named `ZZ Sample%`.
