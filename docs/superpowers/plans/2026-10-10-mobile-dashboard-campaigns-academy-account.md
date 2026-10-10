# Mobile Layout — Sub-project 7c (Campaigns, Academy, Settings, client /account) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones and upright iPads (<1024px) the Campaigns pages, Announcements and the client `/account` page fit the screen with nothing squeezed, cut off or zooming, while desktop stays pixel-identical.

**Architecture:** Same method as 7a/7b: phone-only words appended to existing class strings, reusing the 7a/7b bundles in `lib/dashboard-phone.ts` (`PHONE_HEADER_STACK`, `PHONE_HEADER_ACTIONS`, `PHONE_FIELDS_16`). The only new file is `lib/account-tabs.ts` (the `/account` tab names + tested short phone labels); the only new elements are the `/account` tab label spans.

**Tech Stack:** Next.js 14 App Router, Tailwind 3.4.19, Vitest (node env, `src/**/*.test.ts`), Puppeteer for controller browser checks.

**Spec:** `docs/superpowers/specs/2026-10-10-mobile-dashboard-campaigns-academy-account-design.md` (parents: `2026-10-03-mobile-layout-design.md`, `2026-10-06-mobile-dashboard-shell-design.md`, `2026-10-07-mobile-dashboard-transactions-design.md`)

## Global Constraints

- **Desktop (≥1024px) pixel-identical.** Existing class strings are only ever *appended to*; appended words are `max-lg:` (below 1024px) or `max-sm:` (below 640px). The only new elements are phone-only label spans (`lg:hidden`) beside desktop label spans (`max-lg:hidden`) on the `/account` tabs.
- **Reuse first:** `PHONE_HEADER_STACK`, `PHONE_HEADER_ACTIONS`, `PHONE_FIELDS_16` from `@/lib/dashboard-phone`. No new bundle or component unless the same fix is needed in more than one place. `dashboard-phone.ts` is not changed in 7c (its test keeps listing the same ten bundles).
- **No new libraries.** Load speed not worse on desktop or phone (measured before/after).
- **Every task ends with:** full suite (`cd apps/web && npx vitest run`), `npx tsc --noEmit`, clean build (`rm -rf apps/web/.next && pnpm --filter web build`). Before deleting `.next`, check `netstat -ano | grep ":3000 .*LISTEN"` — if Ryan's dev server is running, do not delete `.next`; report instead. The controller stops its own port-3100 server before any build.
- Commit per task, messages ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **No push** (Ryan: nothing pushed until 7e is complete). Never `git add` `packages/database/_samples7c.mjs` (untracked on purpose, deleted at cleanup).
- **Sample data** (Ryan-approved, IDs in `.superpowers/7c-survey/sample-ids.json`): draft `cmv2q9vay00073h0l30jgvvod`, sent `cmv2q9vfa00093h0lu2657u07`, drip `cmv2q9vwt000f3h0lyd0jy6yj`, announcement `cmv2q9wc8000i3h0lm8e81alg`, buyer `zz-sample-client@example.com` / `ZzSampleClient2026!`. Browser checks may open forms and type, but **never** press Send Now, Start Now, Delete, the wizard's final step button (its `handleFinish` is the only place the wizard writes), "Send to All Agents", the composer's "Continue" without the Task 4 interceptor (it creates a draft row), Save (account settings) or remove a saved home — the samples must stay identical so fingerprints stay comparable and no email is ever sent. Every script dismisses `confirm()` dialogs (`page.on("dialog", d => d.dismiss())`).

## Review Focus

1. **A very long campaign name on a 320px phone** (e.g. one 60-character word) — wraps inside the stacked header, never pushes the page sideways. Checked in Task 4 by replacing the `<h1>` text in the live DOM only (no data change); if it overflows, the fix is `max-lg:[overflow-wrap:anywhere]` on that `<h1>`.
2. **`/account` tab switching on a phone** — tapping "Tours" or "Settings" (short labels) still shows the right panel, because state keeps the full names. Pinned by the `ACCOUNT_TABS` / `accountTabShortLabel` test in Task 2; tapped in Task 4.
3. **Exactly 1024px wide** — side-by-side headers, composer beside the heading, full tab labels. Fingerprints + `/account` pixel shots at 1024×768 in Tasks 1, 3 and 5.
4. **The announcement composer's second step ("Ready to Send?") and its error line on a phone** — fits full width under the heading. The composer's "Continue" button POSTs `/api/announcements` and **creates a draft row**, so Task 4 reaches "Ready to Send?" with Puppeteer request interception answering that POST with a fake `{ "id": "zz-fake" }` (no DB write), and shows the error line by intercepting it with a fake 400 `{ "error": "Title and body are required" }`. "Send to All Agents" is never pressed.
5. **Upright iPad (820×1180)** gets the phone layout (stacked headers, short tab labels) and it must look intentional, not stretched. Checked in Tasks 3 and 4 screenshots.

## Controller toolkit

Work dir for scripts and results: `.superpowers/7c-survey/` (git-ignored). Login: admin `ryanchong@cncrealtygroup.com` / `Fakeaccount1!`; buyer from `sample-ids.json`. Puppeteer: `C:/Users/hey_r/AppData/Local/npm-cache/_npx/ab5cd9f6d13a2312/node_modules/puppeteer`, Chrome `C:/Program Files/Google/Chrome/Application/chrome.exe`, **headless**.

**VIEWS (15)** — reuse the `ADMIN` / `BUYER` lists and the `wizardTo` / `clickText` helpers already in `survey7c2.cjs`:
- admin: `campaigns`, `camp-draft`, `camp-sent`, `camp-drip`, `wiz-email-1..4`, `videos` (`/dashboard/academy/videos`), `guides` (`/dashboard/academy/guides`), `announcements`, `ann-composer`, `settings` (`/dashboard/settings`)
- buyer: `acct-saved`, `acct-tours`, `acct-settings`
- (that is 12 admin + 3 buyer = 15; `wiz-drip-2` stays in the phone survey only)

**Tab finder fix (needed before Task 2 lands):** after Task 2 a tab button's `textContent` is e.g. `"Saved PropertiesSaved"` / `"SettingsSettings"`. In `survey7c2.cjs` (and the new fingerprint script) find tabs with `x.textContent.trim().startsWith("Saved Properties")`, `startsWith("Tour")`, `startsWith("Settings")` — the exact-match `=== "Settings"` would silently stop clicking.

**FINGERPRINT** (`fingerprint7c.cjs`, new — adapted from `.superpowers/mobile-tools/fingerprint.cjs`): two browser contexts (admin, buyer), each VIEW at 1440×900 and 1024×768 (DPR 1), load, wait 2500ms, run the view's setup, wait 600ms, then hash every element box under the root — the dashboard frame `document.querySelector("aside").parentElement` for admin views, `document.body` for `/account` — with the 7a MEASURE, plus one 7c rule: **skip elements whose class list is exactly `max-lg:hidden`** (the new desktop tab-label spans, whose box is the text's own box):

```js
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(16) + ":" + s.length; };
const measure = (root) => { const els = [root, ...root.querySelectorAll("*")].filter((e) => (e.getAttribute("class") || "").trim() !== "max-lg:hidden");
  const sv = els.map((e) => e.style ? e.style.transform : null); els.forEach((e) => { if (e.style) e.style.transform = "none"; }); const r0 = root.getBoundingClientRect();
  const s = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 || r.height > 0).map((r) => [Math.round(r.left - r0.left), Math.round(r.top - r0.top), Math.round(r.width), Math.round(r.height)].join(",")).join("|");
  els.forEach((e, i) => { if (e.style) e.style.transform = sv[i]; }); return hash(s); };
```

**PIXEL** (in `fingerprint7c.cjs`, `/account` only — because of the skip rule above): for the 3 buyer views at both desktop sizes, `page.screenshot({ fullPage: true })` saved as `px-<label>-<w>-<view>.png`; compare to the baseline with `Buffer.compare` (byte-identical). If bytes differ, open both images and compare by eye before calling it a failure (image decode timing can differ) — report either way.

Writes `fp-<label>.json` (30 hashes) and the 6 PNGs; `node fingerprint7c.cjs 3100 <label> [compareTo]` prints `30/30 identical` / `6/6 pixel-identical` or the differing view+size.

**PHONE-SURVEY** (`survey7c2.cjs`, already written; tab-finder fix above): all views at 320×568, 390×844, 844×390, 820×1180; reports inner-`<main>` overflow (page for `/account`), elements past the viewport not inside an `overflow-x:auto/scroll` box, fields <16px. `node survey7c2.cjs 3100 <label> shots` also writes 320/390 screenshots. Baseline already exists: `s2.json` + `s2-*.png` (build of `f42385c`; `apps/web` is unchanged since — `git diff --stat f42385c HEAD -- apps/web` is empty).

**SPEED** (`.superpowers/mobile-tools/speed-ab.cjs`): make it read `SPEED_PAGES` (comma-separated, default today's list) and `SPEED_DEST` (default `/dashboard`, used in the post-login `waitForFunction` and the `includes` check). Runs: admin with `SPEED_PAGES=/dashboard/campaigns,/dashboard/campaigns/cmv2q9vfa00093h0lu2657u07,/dashboard/academy/announcements`; buyer with `SPEED_DEST=/account SPEED_PAGES=/account`.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `apps/web/src/lib/account-tabs.ts` | create | `ACCOUNT_TABS`, `AccountTab`, `accountTabShortLabel` |
| `apps/web/src/__tests__/lib/account-tabs.test.ts` | create | pins the tab names and short labels |
| `apps/web/src/app/(account)/account/page.tsx` | modify | import tabs; two label spans per tab; 16px settings fields |
| `apps/web/src/app/(dashboard)/dashboard/campaigns/page.tsx` | modify | stacked header, full-width New Campaign |
| `apps/web/src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx` | modify | stacked header, badge under name, full-width actions |
| `apps/web/src/app/(dashboard)/dashboard/academy/announcements/page.tsx` | modify | stacked header; card date under title |
| `apps/web/src/app/(dashboard)/dashboard/academy/announcements/AnnouncementComposer.tsx` | modify | full-width "+ New Announcement" on phones |

---

### Task 1: Baselines (controller)

- [ ] `git status -s apps/web/src` empty; record `BASE_SHA` (= HEAD, `44fb3ff` or later docs-only commit). `apps/web/.next` is the clean build of `f42385c` source (BUILD_ID dated 2026-10-10 10:54; apps/web unchanged since) — reuse it, no rebuild.
- [ ] Old-build copy for the final speed A/B: `git worktree add <scratchpad>/b7c BASE_SHA`, `pnpm install --frozen-lockfile` in it, copy `apps/web/.env.local` and the current `apps/web/.next` into `<scratchpad>/b7c/apps/web/`.
- [ ] Apply the tab-finder fix to `survey7c2.cjs`; write `fingerprint7c.cjs` (toolkit); add `SPEED_PAGES` / `SPEED_DEST` to `speed-ab.cjs`.
- [ ] Serve 3100 (`cd apps/web && npx next start -p 3100`). Run FINGERPRINT twice (`base1`, `base2`) — must be 30/30 identical and 6/6 pixel-identical to each other; keep `base1`. If a view is unstable between two runs of the same build, fix the script (longer wait, wait for images) before going on.
- [ ] Confirm the speed script runs for both logins (one quick run each, discard). Stop 3100.

### Task 2: `/account` — short tab labels on phones, 16px settings fields

**Files:** Create `apps/web/src/lib/account-tabs.ts`, `apps/web/src/__tests__/lib/account-tabs.test.ts`; Modify `apps/web/src/app/(account)/account/page.tsx`

**Interfaces — Produces:** from `@/lib/account-tabs`: `ACCOUNT_TABS: readonly ["Saved Properties", "Tour Requests", "Settings"]`, `type AccountTab = (typeof ACCOUNT_TABS)[number]`, `accountTabShortLabel(tab: AccountTab): string`. **Consumes:** `PHONE_FIELDS_16` from `@/lib/dashboard-phone`.

- [ ] **Step 1: Failing test.** Create `apps/web/src/__tests__/lib/account-tabs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ACCOUNT_TABS, accountTabShortLabel } from "@/lib/account-tabs";

describe("account tabs", () => {
  it("keeps the three full tab names in order (tab state uses these)", () => {
    expect([...ACCOUNT_TABS]).toEqual(["Saved Properties", "Tour Requests", "Settings"]);
  });

  it("gives each tab a short phone label", () => {
    expect(accountTabShortLabel("Saved Properties")).toBe("Saved");
    expect(accountTabShortLabel("Tour Requests")).toBe("Tours");
    expect(accountTabShortLabel("Settings")).toBe("Settings");
  });

  it("every short label is no longer than its full name and not empty", () => {
    for (const t of ACCOUNT_TABS) {
      const s = accountTabShortLabel(t);
      expect(s.length, t).toBeGreaterThan(0);
      expect(s.length, t).toBeLessThanOrEqual(t.length);
    }
  });
});
```

- [ ] **Step 2:** `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/lib/account-tabs.test.ts` — Expected FAIL (cannot find `@/lib/account-tabs`).
- [ ] **Step 3: Implement.** Create `apps/web/src/lib/account-tabs.ts`:

```ts
// Tabs on the client /account page. State and panels use the full names; phones (<1024px)
// show the short label so all three fit on one line at 320px.
export const ACCOUNT_TABS = ["Saved Properties", "Tour Requests", "Settings"] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];

const SHORT: Record<AccountTab, string> = {
  "Saved Properties": "Saved",
  "Tour Requests": "Tours",
  Settings: "Settings",
};

export function accountTabShortLabel(tab: AccountTab): string {
  return SHORT[tab];
}
```

- [ ] **Step 4: Page.** In `apps/web/src/app/(account)/account/page.tsx`:
  - Add imports: `import { ACCOUNT_TABS, accountTabShortLabel, type AccountTab } from "@/lib/account-tabs";` and `import { PHONE_FIELDS_16 } from "@/lib/dashboard-phone";`
  - Delete the two local lines `const TABS = ["Saved Properties", "Tour Requests", "Settings"] as const;` and `type Tab = (typeof TABS)[number];`
  - `useState<Tab>("Saved Properties")` → `useState<AccountTab>("Saved Properties")`; any other `Tab` type use → `AccountTab`.
  - `{TABS.map((t) => (` → `{ACCOUNT_TABS.map((t) => (`; inside that button replace the bare `{t}` with:
    ```tsx
              <span className="max-lg:hidden">{t}</span>
              <span className="lg:hidden">{accountTabShortLabel(t)}</span>
    ```
    The button's own class string is unchanged. The tab bar `mb-6 flex w-fit gap-1 rounded-lg bg-white p-1 shadow-sm` is unchanged.
  - Settings column `<div className="flex flex-col gap-5 max-w-lg">` (inside `{tab === "Settings" && (`) → ``<div className={`flex flex-col gap-5 max-w-lg ${PHONE_FIELDS_16}`}>``
  - `grep -n "TABS\|\bTab\b" "src/app/(account)/account/page.tsx"` → only `ACCOUNT_TABS` / `AccountTab` remain.
- [ ] **Step 5:** New test passes (3/3); full suite, `tsc --noEmit`, clean build.
- [ ] **Step 6:** Commit `feat: client account tabs use short labels on phones; settings fields 16px so iPhones don't zoom`.
- [ ] **Controller after review:** FINGERPRINT vs `base1` = 30/30 and PIXEL 6/6; PHONE-SURVEY: `acct-*` tabs on one line, `small=0` on `acct-settings`, at all 4 sizes; screenshots at 320 and 820.

### Task 3: Stacked headers (Campaigns list + detail, Announcements) and announcement cards

**Files:** Modify `apps/web/src/app/(dashboard)/dashboard/campaigns/page.tsx`, `apps/web/src/app/(dashboard)/dashboard/campaigns/[id]/page.tsx`, `apps/web/src/app/(dashboard)/dashboard/academy/announcements/page.tsx`, `apps/web/src/app/(dashboard)/dashboard/academy/announcements/AnnouncementComposer.tsx`

**Interfaces — Consumes:** `PHONE_HEADER_STACK`, `PHONE_HEADER_ACTIONS` from `@/lib/dashboard-phone` (unchanged).

- [ ] **Step 1: Campaigns list** (`campaigns/page.tsx`): add `import { PHONE_HEADER_STACK } from "@/lib/dashboard-phone";`.
  - `<div className="mb-8 flex items-center justify-between">` (the header, ~line 70) → ``<div className={`mb-8 flex items-center justify-between ${PHONE_HEADER_STACK} max-lg:gap-3`}>``
  - The header's `<Link href="/dashboard/campaigns/new" className="flex items-center gap-1.5 rounded-full bg-[#1B1B1B] px-4 py-2 …">` (the one with `<Plus …/> New Campaign`, ~line 79 — NOT the empty-state link with `ArrowIcon`) → append ` max-lg:justify-center` to its class string.
- [ ] **Step 2: Campaign detail** (`campaigns/[id]/page.tsx`): add `import { PHONE_HEADER_STACK, PHONE_HEADER_ACTIONS } from "@/lib/dashboard-phone";`.
  - `<div className="flex items-start justify-between gap-4">` (directly under `{/* Header */}`, ~line 159) → ``<div className={`flex items-start justify-between gap-4 ${PHONE_HEADER_STACK}`}>``
  - `<div className="flex items-center gap-3">` holding the `<h1>{campaign.name}` and status badge (~line 167) → `<div className="flex items-center gap-3 max-lg:flex-col max-lg:items-start max-lg:gap-2">`
  - `<div className="flex items-center gap-2">` holding Send Now / Start Now / Delete (~line 178) → ``<div className={`flex items-center gap-2 ${PHONE_HEADER_ACTIONS}`}>``
  - Leave the drip step row `mb-2 flex items-center justify-between` (~line 289) and everything else alone (spec: already fits).
- [ ] **Step 3: Announcements** (`academy/announcements/page.tsx`): add `import { PHONE_HEADER_STACK } from "@/lib/dashboard-phone";`.
  - `<div className="mb-6 flex items-center justify-between">` (header with `<h1>Announcements</h1>` and `<AnnouncementComposer />`) → ``<div className={`mb-6 flex items-center justify-between ${PHONE_HEADER_STACK} max-lg:gap-3`}>``
  - Card title row `<div className="mb-2 flex items-center justify-between">` (inside `announcements.map`) → `<div className="mb-2 flex items-center justify-between max-lg:flex-col max-lg:items-start max-lg:gap-1">`
  - Its date span `<span className="font-sans text-xs text-[#1B1B1B]/40">` → `<span className="font-sans text-xs text-[#1B1B1B]/40 max-lg:whitespace-nowrap">`
- [ ] **Step 4: Composer** (`AnnouncementComposer.tsx`): the closed-state button (`+ New Announcement`, class `rounded-full bg-[#9E8C61] px-5 py-2.5 …`, ~line 67) → append ` max-lg:w-full`. No other change: the compose and confirm panels are the same flex child, so they sit full width under the heading once the header stacks.
- [ ] **Step 5:** `grep -rn "dashboard-phone" "src/app/(dashboard)/dashboard/campaigns" "src/app/(dashboard)/dashboard/academy"` shows the three new imports. Full suite, `tsc --noEmit`, clean build.
- [ ] **Step 6:** Commit `feat: campaign and announcement headers stack on phones (title, then full-width actions); announcement dates sit under the title`.
- [ ] **Controller after review:** FINGERPRINT vs `base1` = 30/30, PIXEL 6/6; PHONE-SURVEY: no overflow on `campaigns`, `camp-*`, `announcements`, `ann-composer` at any size; screenshots at 320, 390 and 820 checked by eye (New Campaign label on one line, badge under name, actions full width, composer under heading, date one line under title).

### Task 4: Phone walk of the extra controls (controller, fixes dispatched)

- [ ] Serve 3100. At **320×568** and **390×844** (plus 820×1180 for the first item of each group), with `page.on("dialog", d => d.dismiss())`:
  - New Campaign wizard: the drip editor's **"+ Add Step"** form (open it, type `ZZ` into its fields, don't save the campaign); **"Schedule for Later"** — select it and open the date-time field; the recipients step's **lead search** (type `ZZ`). Never press the final create/launch button.
  - Announcements composer: `page.setRequestInterception(true)`; for `POST */api/announcements` (exact path, not `/send`) respond `{ status: 200, contentType: "application/json", body: '{"id":"zz-fake"}' }` — every other request `continue()`. Open the composer, type `ZZ Walk` title/body, press **Continue** → "Ready to Send?" panel; measure + screenshot; press **Cancel**. Then switch the interceptor to `{ status: 400, body: '{"error":"Title and body are required"}' }`, reopen, press Continue → error line; measure + screenshot; Cancel. Afterwards confirm in the DB that no `Announcement` row besides the sample exists (`count = 1`). Never press "Send to All Agents".
  - Campaign detail (draft): replace the `<h1>` text in the DOM with `"ZZ" + "W".repeat(58)` (`page.evaluate`, no data change) and measure overflow (Review Focus 1).
  - `/account` as the buyer: tap each short tab ("Saved", "Tours", "Settings") and confirm the right panel shows (Saved: 2 home cards; Settings: Profile card). Focus the Display Name field and confirm computed font-size 16px. Never press Save.
  - For each state record: inner-`<main>` overflow (page for `/account`), elements past the viewport, fields <16px, buttons reachable; screenshot.
- [ ] For each problem found: dispatch one fix (same implementer rules), reusing an existing bundle first (`PHONE_HEADER_STACK`, `PHONE_HEADER_ACTIONS`, `PHONE_FIELD_PAIR`, `PHONE_FIELDS_16`, `PHONE_TABLE_FRAME`, `PHONE_POPUP_*`), a new `max-lg:`/`max-sm:` word only if none fits. Each fix is reviewed, then FINGERPRINT = 30/30 and PIXEL 6/6. If nothing is found, record "walk clean" and skip the dispatch.
- [ ] Stop 3100.

### Task 5: Final verification (controller)

- [ ] Clean build of HEAD, serve 3100. FINGERPRINT vs `base1` = 30/30 and PIXEL 6/6 (run twice).
- [ ] PHONE-SURVEY at all four sizes with screenshots: overflow 0 and no element past the viewport on every view; `small=0` everywhere. Compare to `s2.json` — every row from the spec's survey table now clean, nothing that was clean got worse.
- [ ] SPEED A/B: serve the old build from `<scratchpad>/b7c` on 3101 and HEAD on 3100. Admin pages (toolkit `SPEED_PAGES`) interleaved 3100, 3101, 3100, 3101 for desktop, then 3100, 3101 for phone; then buyer `/account` the same way. Expect no difference beyond run-to-run noise; JS request counts equal (one extra tiny module in the `/account` chunk is expected to change no request count).
- [ ] Stop both servers; remove the `b7c` worktree (`git worktree remove --force`, then `rmdir /s /q "\\?\<path>"` if the path is too long).
- [ ] **After the final whole-branch review is clean:** run the delete mode of `packages/database/_samples7c.mjs` (leads, campaigns with recipients/steps/deliveries, announcement, buyer with saved homes and sessions), then its count mode — zero rows for every ID and zero rows named/emailed `ZZ Sample%` / `zz-sample-client@example.com`. Then delete `packages/database/_samples7c.mjs` itself. Update memory (7c complete, next 7d). CLAUDE.md is **not** updated (Ryan: only after 7e).
