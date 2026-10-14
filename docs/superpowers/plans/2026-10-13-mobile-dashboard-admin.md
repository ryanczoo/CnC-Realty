# Mobile Layout — Sub-project 7e (the 13 other admin pages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones and upright iPads (<1024px) the Applications list and detail, Action Plans, Triggers, Checklists and Tags admin pages fit the screen with nothing squeezed, cut off or running sideways; desktop stays pixel-identical; load speed is not worse on desktop or phone.

**Architecture:** Same method as 7a–7d: phone-only words (`max-lg:` / `max-sm:`) appended to existing class strings, reusing `lib/dashboard-phone.ts` bundles (`PHONE_TAB_BAR`, `PHONE_HEADER_STACK`, `PHONE_WRAP_TEXT`). No new bundle, no new component, no library. `lib/dashboard-phone.ts` is not edited.

**Tech Stack:** Next.js 14 App Router, Tailwind 3.4.19, framer-motion, Vitest (node env), Puppeteer for controller checks.

**Spec:** `docs/superpowers/specs/2026-10-13-mobile-dashboard-admin-design.md`

## Global Constraints

- **Desktop (≥1024px) pixel-identical.** Every change only *appends* `max-lg:` / `max-sm:` words (directly, or via an imported `PHONE_*` bundle) to an existing class string. Nothing removed or reordered.
- **Reuse first:** `PHONE_TAB_BAR`, `PHONE_HEADER_STACK`, `PHONE_WRAP_TEXT` from `@/lib/dashboard-phone`. No new bundle, no new component, no new library.
- **No push** (nothing pushed until 7e is complete, then Ryan decides). No CLAUDE.md edit. Commit per task, messages ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Every code task ends with:** `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run` (all pass), `npx tsc --noEmit` (clean), clean build (`rm -rf apps/web/.next && pnpm --filter web build` from the repo root). Before deleting `.next`, check `netstat -ano | grep ":3000 .*LISTEN"` — if Ryan's dev server is running, report instead of building. The controller stops its own port-3100 server before any build.
- **If a server or background process dies unexpectedly: report to Ryan and stop** — do not restart or fix it autonomously.
- **Sample data** (Ryan-approved 2026-10-13, in the shared Neon DB): created by `.superpowers/7e-survey/seed7e.mjs`, IDs in `.superpowers/7e-survey/ids7e.json` (`applicationId`, `blogPostId`). Deleted only at the very end with `clean7e.mjs` (zero leftovers). Run either by copying into `packages/database` (`cp ../../.superpowers/7e-survey/X.mjs ./_X.mjs && node _X.mjs; rm -f _X.mjs`). Admin login `ryanchong@cncrealtygroup.com` / `Fakeaccount1!`. Browser checks never save: every non-GET `/api/*` except `/api/auth/*` is aborted (`noWrites` from `.superpowers/7d-survey/views7d.cjs`).

## Review Focus

1. **A long, unbroken email/address on a 320px phone** (application detail) — wraps inside the card, no sideways page scroll. Sample `zz-sample-applicant1@example.com` + "4567 Extremely Long Street Name Boulevard Apt 1203". Task 2 controller check.
2. **Exactly 1024px** — application rows keep the 192px label column beside the value; headers stay side-by-side; trigger rows stay one line. FINGERPRINT at 1024×768 every task.
3. **A trigger in delete-confirm state on a 390px phone** — "Delete? Confirm Cancel" sits on line 2 under the name and stays reachable. Task 5 walk.
4. **The "+ New …" buttons' pulse animation** — full-width on phones, still pulses, no sideways overflow from the 1.04 scale (it scales inside the stacked header). Task 3 controller survey + Task 5 walk.
5. **Application with status APPROVED/REJECTED** (badge text length differs; Approve/Reject block absent) — header still stacks cleanly. Check with the REJECTED sample ("ZZ Sample Mia Tran") in Task 5.

## Controller toolkit

Work dir `.superpowers/7e-survey/` (git-ignored). Puppeteer `C:/Users/hey_r/AppData/Local/npm-cache/_npx/ab5cd9f6d13a2312/node_modules/puppeteer`, Chrome `C:/Program Files/Google/Chrome/Application/chrome.exe`, headless. Serve the build with `cd apps/web && NEXTAUTH_URL=http://localhost:3100 ./node_modules/.bin/next start -p 3100`. When stopping a server, also clear its child node process (netstat → PID → `Stop-Process`).

**SURVEY** (`survey7e.cjs`, exists): the 13 pages at 320×568, 390×844, 844×390, 820×1180. `node survey7e.cjs 3100 <label> shots`.

**POPUPS** (`interact7e.cjs`, exists): every drawer/popup/inline editor at 320, 390, 820. `node interact7e.cjs 3100 <label> shots`.

**FINGERPRINT** (`fingerprint7e.cjs`, new — copy `.superpowers/7d-survey/fingerprint7d.cjs` and adapt): admin only; views = the 13 SURVEY pages **plus** the POPUPS steps (reuse their `open` functions); at 1440×900 and 1024×768 (DPR 1); root `document.querySelector("aside").parentElement`; 7a MEASURE (transforms neutralized, so the pulse animation can't cause false differences). Plus **PIXEL** full-page shots (`img{visibility:hidden}`) of application detail, action-plans, triggers, checklists, tags at both sizes. Prints `N/N identical` and `k/k pixel-identical`. `node fingerprint7e.cjs 3100 <label> [compareTo]`.

**SPEED** (`.superpowers/mobile-tools/speed-ab.cjs`): `SPEED_EMAIL=ryanchong@cncrealtygroup.com SPEED_PASSWORD='Fakeaccount1!' SPEED_PAGES=/admin/applications,/admin/applications/<applicationId>,/admin/action-plans,/admin/triggers,/admin/settings/checklists,/admin/settings/tags`; `node speed-ab.cjs <port> <desktop|phone> <label>`. Under git-bash set `MSYS_NO_PATHCONV=1`.

## File Structure

| File (under `apps/web/src/app/(dashboard)/admin/`) | Change | Responsibility |
|---|---|---|
| `applications/[id]/page.tsx` | modify | rows stack label over value, values wrap, header stacks |
| `applications/ApplicationsClient.tsx` | modify | filter pills swipe |
| `action-plans/page.tsx` | modify | header stacks, full-width button |
| `triggers/page.tsx` | modify | header stacks, rows wrap controls to line 2 |
| `settings/checklists/page.tsx` | modify | header stacks, full-width button |
| `settings/tags/AdminTagsClient.tsx` | modify | colour dots wrap |

---

### Task 1: Baselines (controller)

- [ ] `git status -s apps/web/src` empty; record `BASE_SHA` = HEAD (the spec commit).
- [ ] Old-build copy for the speed A/B: `git worktree add <scratchpad>/b7e BASE_SHA`, `pnpm install --frozen-lockfile`, copy `apps/web/.env.local`, `pnpm --filter web build` there.
- [ ] Write `fingerprint7e.cjs` (above). Server 3100 is already serving a build of the code that BASE_SHA contains (no product changes since) — verify with `git diff --stat <build's commit> BASE_SHA -- apps/web/src` empty; otherwise stop it, clean-build, re-serve.
- [ ] FINGERPRINT twice (`base1`, `base2 base1`) → identical to each other; if a view is unstable, fix the script (waits, wait for images) first. Keep `base1`.
- [ ] Existing survey outputs (`survey-full.out`, `pop2.out` + screenshots) are the "before" record. Stop 3100.

### Task 2: Applications — detail rows, header, filter pills

**Files:** Modify `apps/web/src/app/(dashboard)/admin/applications/[id]/page.tsx`, `apps/web/src/app/(dashboard)/admin/applications/ApplicationsClient.tsx`

**Interfaces — Consumes:** `PHONE_HEADER_STACK`, `PHONE_WRAP_TEXT`, `PHONE_TAB_BAR` from `@/lib/dashboard-phone`.

- [ ] **Step 1: Detail import** — in `applications/[id]/page.tsx` add after the `lucide-react` import:

```ts
import { PHONE_HEADER_STACK, PHONE_WRAP_TEXT } from "@/lib/dashboard-phone";
```

- [ ] **Step 2: `Row`** — replace the function body's JSX:

```tsx
    <div className="flex gap-4 py-2 border-b border-[#1B1B1B]/5 max-lg:flex-col max-lg:gap-1">
      <span className="w-48 shrink-0 text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/40 max-lg:w-auto">{label}</span>
      <span className={`text-sm text-[#1B1B1B]/80 ${PHONE_WRAP_TEXT}`}>{value === null || value === "" ? "—" : value}</span>
    </div>
```

- [ ] **Step 3: Header** — `<div className="mb-6 flex items-center justify-between">` (holds the `<h1>` name and the status badge) → ``<div className={`mb-6 flex items-center justify-between ${PHONE_HEADER_STACK} max-lg:gap-2`}>``; the `<h1 className="font-sans text-2xl font-light text-[#1B1B1B]">` → ``<h1 className={`font-sans text-2xl font-light text-[#1B1B1B] ${PHONE_WRAP_TEXT}`}>``; the badge's template literal `` `rounded-full px-3 py-1 text-xs font-medium ${ `` → `` `rounded-full px-3 py-1 text-xs font-medium max-lg:self-start ${ ``.
- [ ] **Step 4: Filter pills** — in `ApplicationsClient.tsx` extend the import to `import { PHONE_TABLE_FRAME, PHONE_TAB_BAR } from "@/lib/dashboard-phone";` and change `<div className="mb-4 flex gap-2">` → ``<div className={`mb-4 flex gap-2 ${PHONE_TAB_BAR}`}>``.
- [ ] **Step 5:** Full suite, `tsc --noEmit`, clean build — all pass.
- [ ] **Step 6:** Commit `feat: phones — application details show each label above its value (long emails/addresses wrap), header stacks; status filters swipe`.
- [ ] **Controller after:** FINGERPRINT `t2 base1` → all identical, PIXEL identical. SURVEY + POPUPS: `application`/`app-detail`/`app-reject` worst element gone at 320/390 (was +98/+28), `applications` no overflow at 320 (was +61). Screenshots 320/390/820: labels above values, email wraps, badge under name at natural width, pills one swipeable row.

### Task 3: Action Plans, Triggers, Checklists — headers and trigger rows

**Files:** Modify `apps/web/src/app/(dashboard)/admin/action-plans/page.tsx`, `apps/web/src/app/(dashboard)/admin/triggers/page.tsx`, `apps/web/src/app/(dashboard)/admin/settings/checklists/page.tsx`

**Interfaces — Consumes:** `PHONE_HEADER_STACK` from `@/lib/dashboard-phone`.

- [ ] **Step 1: Action Plans** — add `import { PHONE_HEADER_STACK } from "@/lib/dashboard-phone";`. The header `<div className="flex items-center justify-between">` that holds `<h1>Action Plans</h1>` (first one in the return, line ~45 — NOT the per-plan card row at ~75) → ``<div className={`flex items-center justify-between ${PHONE_HEADER_STACK} max-lg:gap-3`}>``. The "+ New Plan" `motion.button` `className="rounded-full bg-[#1B1B1B] px-5 py-2.5 text-sm font-medium text-white"` → append ` max-lg:w-full max-lg:justify-center`.
- [ ] **Step 2: Triggers header** — add the same import. The header `<div className="flex items-center justify-between">` holding `<h1>Trigger Automations</h1>` → ``<div className={`flex items-center justify-between ${PHONE_HEADER_STACK} max-lg:gap-3`}>``. "+ New Trigger" `motion.button` className → append ` max-lg:w-full max-lg:justify-center`.
- [ ] **Step 3: Trigger rows** — in the `triggers.map` row:
  - `` className={`flex items-center gap-4 px-5 py-4 ${ `` → `` className={`flex items-center gap-4 px-5 py-4 max-lg:flex-wrap max-lg:gap-x-3 max-lg:gap-y-2 ${ ``
  - the info block `<div className="flex-1 min-w-0">` → `<div className="flex-1 min-w-0 max-lg:basis-[calc(100%-2rem)]">` (checkbox 16px + 12px gap fill line 1 with the name)
  - the Active badge's template literal `` `shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${ `` → `` `shrink-0 rounded-full px-2 py-0.5 text-xs font-medium max-lg:ml-7 ${ `` (line 2 starts under the name: 16px + 12px = 28px = `ml-7`)
- [ ] **Step 4: Checklists** — add `import { PHONE_HEADER_STACK } from "@/lib/dashboard-phone";`. `<div className="mb-6 flex items-center justify-between">` (holds `<h1>Checklist Templates</h1>`) → ``<div className={`mb-6 flex items-center justify-between ${PHONE_HEADER_STACK} max-lg:gap-3`}>``. The "New Template" button `className="flex items-center gap-1.5 rounded-full bg-[#1B1B1B] px-4 py-2 text-sm text-white"` → append ` max-lg:w-full max-lg:justify-center`.
- [ ] **Step 5:** Full suite, `tsc --noEmit`, clean build — all pass.
- [ ] **Step 6:** Commit `feat: phones — action plans, triggers, checklists headers stack with a full-width New button; trigger name gets the full width, controls on the line below`.
- [ ] **Controller after:** FINGERPRINT `t3 base1` → all identical, PIXEL identical. SURVEY + POPUPS clean (drawers unchanged). Screenshots 320/390/820: title on top, full-width button below on all three pages; trigger name on line 1 at full width, badge/Edit/Delete on line 2 under it.

### Task 4: Tags — colour dots wrap

**Files:** Modify `apps/web/src/app/(dashboard)/admin/settings/tags/AdminTagsClient.tsx`

- [ ] **Step 1:** In the **Create Tag** card (the `<div className="flex gap-1">` immediately after the "Tag name" `<input>`, ~line 96 — NOT the edit-row `<div className="flex gap-1">` inside the table at ~line 130), change to `<div className="flex gap-1 max-lg:flex-wrap">`.
- [ ] **Step 2:** Full suite, `tsc --noEmit`, clean build — all pass.
- [ ] **Step 3:** Commit `fix: phones — Create Tag colour dots wrap instead of clipping off the card`.
- [ ] **Controller after:** FINGERPRINT `t4 base1` identical, PIXEL identical. Screenshot `tags` at 320: all 8 dots visible.

### Task 5: Phone walk of the controls (controller, fixes dispatched)

- [ ] Serve 3100. At 320×568, 390×844, 820×1180, non-GET API aborted:
  - Applications: tap each filter pill (swipe to "REJECTED") → list filters; open "ZZ Sample Mia Tran" (REJECTED) → header stacks, rows readable; open the PENDING sample → tap Reject → reason box visible, Cancel closes it.
  - Action Plans: "+ New Plan" opens the drawer (close it); tap the sample plan → detail drawer.
  - Triggers: "+ New Trigger" opens the drawer; on a row tap Edit → drawer; tap Delete → "Delete? Confirm Cancel" on line 2, all reachable; tap Cancel; toggle the checkbox → its PATCH is aborted (request attempted, nothing saved).
  - Checklists: "New Template" toggles the create form; open "Commercial Lease Dual".
  - Tags: tap every colour dot in Create Tag; Edit on the sample tag.
  - Record overflow, elements past the viewport, fields <16px, reachability; screenshots.
- [ ] For each problem: one fix, reusing an existing bundle first; FINGERPRINT identical after it. If none: record "walk clean".
- [ ] Stop 3100.

### Task 6: Final verification (controller)

- [ ] Clean build of HEAD, serve 3100; serve the old build (`<scratchpad>/b7e`) on 3101. FINGERPRINT `final base1` on 3100 → all identical, PIXEL identical. Run twice.
- [ ] SURVEY + POPUPS on HEAD at all sizes with screenshots: zero page overflow, zero fields <16px; every row of the spec's survey table fixed; remaining CUT entries only the desktop-also truncations listed as "left as is".
- [ ] SPEED A/B: HEAD 3100 vs old 3101, interleaved 3100, 3101, 3100, 3101 desktop, then 3100, 3101 phone. JS request counts equal; timings within noise (re-run more pairs if a page looks slower). Report a before/after table.
- [ ] Stop both servers (and their child node processes); remove the `b7e` worktree (`git worktree remove --force`; if the path is too long, `cmd /c 'rmdir /s /q "\\?\<full path>"'` with the path written literally).
- [ ] **After the final whole-branch review is clean:** run `clean7e.mjs` (copied into `packages/database`) → every leftover count 0; delete the `_` copy. Update memory (7e complete). CLAUDE.md update and push wait for Ryan.
