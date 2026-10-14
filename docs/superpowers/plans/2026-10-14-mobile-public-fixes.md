# Mobile Public-Page Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the six phone problems Ryan found on the live public pages (Why CnC, footer, Buy "One stop SHOP", Sell Our Process, contact pop-up, Join titles) with desktop pixel-identical and load speed not worse.

**Architecture:** Phone-only class words (`max-lg:`, `max-sm:`, `max-lg:portrait:`) appended/adjusted on existing class strings. Our Process re-enables desktop's pinned scroll on phones: the row's `x` comes from the shared `useIsMobile()` hook — desktop keeps today's exact `x` motion value; phones get a pixel travel measured from the row. One tiny pure helper module (`lib/sell-process-scroll.ts`) holds the phone math so it can be unit-tested (a component file can't export helpers without breaking fast refresh — same reason `reviewsPerView` lives in `lib/`).

**Tech Stack:** Next.js 14 App Router, Tailwind 3.4.19, motion/react (`useScroll`, `useTransform`, `useMotionValue`), Vitest (node env), Puppeteer for controller checks.

**Spec:** `docs/superpowers/specs/2026-10-14-mobile-public-fixes-design.md`

## Global Constraints

- **Desktop (≥1024px) pixel-identical.** Only phone-only words are added or removed (`max-lg:`, `max-sm:`, `max-lg:portrait:`, `max-lg:landscape:`). For Our Process the desktop `x` motion value and inline `height: "900vh"` / `width: TOTAL_VW vw` are left exactly as they are; phones override with `!important` phone classes or the phone branch of `useIsMobile()`.
- **Reuse first:** `useIsMobile()` from `@/hooks/useIsMobile`; the phone indent `max-lg:pl-[3rem]` already used by `HowToJoin`; Our Process's existing desktop scroll mechanism. No new component, hook or library. The only new file is `apps/web/src/lib/sell-process-scroll.ts` (+ its test) — the testable phone math (plan ruling against the spec's "no new shared file": it is not shared, it exists so the math can be tested).
- **No push** without Ryan's go-ahead (push = live deploy). Commit per task, messages ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Every code task ends with:** `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run` (all pass), `npx tsc --noEmit` (clean), clean build (`rm -rf apps/web/.next && pnpm --filter web build` from the repo root). Before deleting `.next`, check `netstat -ano | grep ":3000 .*LISTEN"` — if Ryan's dev server runs, report instead. Stop the controller's own port-3100 server (and its child node process) before a build.
- **If a server or background process dies unexpectedly: report to Ryan and stop** — no autonomous restart/fix.
- Public pages need no login and no sample data.

## Review Focus

1. **Our Process on a sideways phone (844×390)** — pinned row still shows each step's title and text inside the shorter row height (landscape `pt-36 pb-3`), nothing cut off; bar visible. Task 7 controller screenshots at 844×390.
2. **Our Process right after load, before the row is measured** — phone uses the `600svh` fallback height and `x` = 0px; no jump to desktop vw values (the phone branch must never output `vw`). Covered by `sell-process-scroll` tests + Task 8 scroll test from a fresh load.
3. **Resizing / rotating a phone mid-section** — travel and section height are re-measured (ResizeObserver on the row + window `resize`), so the last step still lands at the right edge. Task 8: rotate 390×844 → 844×390 mid-section and re-check the end position.
4. **Contact pop-up on the smallest phone (320×568)** — top below the navbar, Send button reachable by scrolling inside the pop-up, nothing behind the navbar. Task 6 controller check.
5. **Exactly 1024px wide** — every section uses the desktop layout (footer side-by-side, Our Process desktop vw slide, pop-up centred). FINGERPRINT at 1024×768 every task.

## Controller toolkit

Work dir `.superpowers/pf-survey/` (git-ignored). Puppeteer `C:/Users/hey_r/AppData/Local/npm-cache/_npx/ab5cd9f6d13a2312/node_modules/puppeteer`, Chrome `C:/Program Files/Google/Chrome/Application/chrome.exe`, headless. Serve builds with `cd apps/web && NEXTAUTH_URL=http://localhost:3100 ./node_modules/.bin/next start -p 3100`. Under git-bash set `MSYS_NO_PATHCONV=1`.

**FINGERPRINT** (`fingerprintPF.cjs`, new — adapt `.superpowers/7e-survey/fingerprint7e.cjs`): no login. Before measuring, inject `*{animation:none!important;transition:none!important}` and pause every `<video>`. Views at 1440×900 and 1024×768 (DPR 1), root = `document.body`, MEASURE = element boxes relative to the page (scroll-independent: `getBoundingClientRect()` + `window.scrollY`), transforms neutralized:
- `home-why` — `/`, scrolled so Why CnC is pinned at 30% of its scroll length; `home-footer` — `/`, scrolled to the bottom;
- `buy-shop` — `/buy`, "One stop SHOP" in view; `buy-popup` — `/buy`, click the first "Message" button (opens ContactModal);
- `sell-process-a` / `sell-process-b` — `/sell`, Our Process at 10% and 60% of its scroll length;
- `join-agents` — `/join`, "For Agents" in view; `join-steps` — `/join`, the feature-title panel in view;
- `rent-footer` — `/rent`, bottom.
Plus PIXEL full-page-free viewport screenshots (photos and videos hidden: `img,video{visibility:hidden!important}`) of every view. Prints `N/N identical` and `k/k pixel-identical`. `node fingerprintPF.cjs 3100 <label> [compareTo]`.

**SHOTS** (`shotsPF.cjs`, new): the same views at 320×568, 390×844, 844×390, 820×1180 (isMobile, hasTouch), viewport screenshots + page overflow (`documentElement.scrollWidth - clientWidth`) per view; popup view also reports whether the Send button and consent line are inside the viewport (and inside the pop-up's visible box). `node shotsPF.cjs 3100 <label>`.

**PROCESS** (`processPF.cjs`, new): at 390×844 and 844×390, load `/sell`, scroll from Our Process's top to its end in 40 steps; at each step record which step title (`h3`) is fully inside the viewport and the four progress-segment `scaleX` values. Passes when titles 01→04 each appear, in order, segments fill in turn, the section stays pinned (`getBoundingClientRect().top` of its sticky child = 0) until the end, and scrolling back up reverses it. Also: at 390×844 scroll to 50%, set viewport to 844×390, wait 500ms, scroll to the end, and confirm step 04's text panel is fully inside the viewport. `node processPF.cjs 3100 <label>`.

**SPEED** (`speedPF.cjs`, new — copy `.superpowers/mobile-tools/speed-ab.cjs` minus the login): fresh profile, 3 loads each of `/`, `/buy`, `/sell`, `/join`; prints ttfb/load/lcp + JS request count. `node speedPF.cjs <port> <desktop|phone> <label>`.

## File Structure

| File (under `apps/web/src/`) | Change | Responsibility |
|---|---|---|
| `components/home/WhyCnC.tsx` | modify | text first, bar at top, front photo centred on the video (phone portrait) |
| `components/layout/Footer.tsx` | modify | phone order: links → contact block → logo |
| `components/buy/BuyFeatures.tsx` | modify | one-column phones: no side line, centred |
| `components/join/AgentPlan.tsx` | modify | "By Agents" phone indent |
| `components/join/JoinSteps.tsx` | modify | second title word phone-portrait indent |
| `components/ui/ContactModal.tsx` | modify | under the navbar, fits, short scrolling Message box |
| `lib/sell-process-scroll.ts` | create | `phoneTravelPx`, `phoneSectionHeight` |
| `__tests__/lib/sell-process-scroll.test.ts` | create | tests for the above |
| `components/sell/SellProcess.tsx` | modify | phones use the pinned scroll + progress bar |

---

### Task 1: Baselines (controller)

- [ ] `git status -s apps/web/src` empty; record `BASE_SHA` = HEAD.
- [ ] Old-build copy for the speed A/B: `git worktree add <scratchpad>/bpf BASE_SHA`, `pnpm install --frozen-lockfile`, copy `apps/web/.env.local`, `pnpm --filter web build` there.
- [ ] Write `fingerprintPF.cjs`, `shotsPF.cjs`, `processPF.cjs`, `speedPF.cjs`. Clean build of BASE in the main checkout; serve 3100.
- [ ] FINGERPRINT twice (`base1`, `base2 base1`) → identical; if a view is unstable, fix the script (freeze more, wait for fonts/images) first. Keep `base1`.
- [ ] SHOTS `before` — confirms each spec problem (photos above text, footer order, side line, swipe row with no bar, pop-up under navbar / Send off-screen, unindented titles). Stop 3100.

### Task 2: Homepage Why CnC (#1)

**Files:** Modify `apps/web/src/components/home/WhyCnC.tsx`

- [ ] **Step 1:** Row: `<div className="flex h-full max-lg:portrait:flex-col-reverse">` → `<div className="flex h-full max-lg:portrait:flex-col">`.
- [ ] **Step 2:** Progress bar: `className="absolute left-14 top-1/2 flex -translate-y-1/2 flex-col gap-1 max-lg:left-6 max-lg:!h-[120px]"` → append ` max-lg:portrait:top-6 max-lg:portrait:translate-y-0`.
- [ ] **Step 3:** Front photo, both places (the `aria-hidden` preload `div` and the `motion.div` front image): `max-lg:portrait:!top-[30%]` → `max-lg:portrait:!top-[20%]`. `grep -c "max-lg:portrait:!top-\[30%\]"` → 0 afterwards; `grep -c "max-lg:portrait:!top-\[20%\]"` → 2.
- [ ] **Step 4:** Full suite, `tsc --noEmit`, clean build.
- [ ] **Step 5:** Commit `fix: phones — Why CnC text first with photos below, progress bar level with the title, small photo centred on the video`.
- [ ] **Controller after:** FINGERPRINT vs `base1` identical; SHOTS `home-why` at 390×844 and 320×568: title → text → photos; bar's top within ±8px of the title's top; front photo's vertical centre within ±2% of the video's.

### Task 3: Footer order (#2)

**Files:** Modify `apps/web/src/components/layout/Footer.tsx`

The stacked row (`flex items-end justify-between px-8 pb-6 pt-12 lg:px-16 max-lg:flex-col …`) has three children: logo `<div className="flex-shrink-0">`, contact block `<div className="flex flex-col items-center gap-5 text-center">`, links `<div className="flex flex-col items-end gap-2 max-lg:items-center">`.

- [ ] **Step 1:** Logo wrapper `className="flex-shrink-0"` → `className="flex-shrink-0 max-lg:order-3"`.
- [ ] **Step 2:** Contact block `className="flex flex-col items-center gap-5 text-center"` (the direct child of the row — not the inner `flex flex-col items-center gap-2`) → append ` max-lg:order-2`.
- [ ] **Step 3:** Links `className="flex flex-col items-end gap-2 max-lg:items-center"` → append ` max-lg:order-1`.
- [ ] **Step 4:** Full suite, `tsc --noEmit`, clean build.
- [ ] **Step 5:** Commit `fix: phones — footer shows page links first, contact block next, logo last`.
- [ ] **Controller after:** FINGERPRINT identical; SHOTS `home-footer`, `rent-footer` at 390×844: Buy…Press, then email, address, newsletter, icons, then logo, then the legal bar.

### Task 4: Buy "One stop SHOP" (#3)

**Files:** Modify `apps/web/src/components/buy/BuyFeatures.tsx`

- [ ] **Step 1:** Feature item `className="flex flex-col gap-4 border-l border-[#1B1B1B]/15 px-8 py-6"` → append ` max-sm:items-center max-sm:border-l-0 max-sm:text-center`.
- [ ] **Step 2:** CTA item `className="flex flex-col justify-end border-l border-[#1B1B1B]/15 px-8 pt-6 pb-2"` → append ` max-sm:items-center max-sm:border-l-0 max-sm:text-center`; its inner `<div className="flex flex-col gap-2">` → `<div className="flex flex-col gap-2 max-sm:items-center">`.
- [ ] **Step 3:** Full suite, `tsc --noEmit`, clean build.
- [ ] **Step 4:** Commit `fix: phones — Buy "One stop SHOP" items centred with no side line when stacked`.
- [ ] **Controller after:** FINGERPRINT identical; SHOTS `buy-shop` at 320×568 and 390×844: no left border (computed `border-left-width` 0), icon/text/button centred (horizontal centre within ±2px of the column's); at 844×390 and 820×1180 the two-column lines unchanged.

### Task 5: Join title indents (#6)

**Files:** Modify `apps/web/src/components/join/AgentPlan.tsx`, `apps/web/src/components/join/JoinSteps.tsx`

- [ ] **Step 1:** `AgentPlan.tsx` "By Agents" line `className="block text-[3.5rem] font-medium xl:text-[4.2rem] max-lg:text-[clamp(2.6rem,11vw,3.5rem)]"` → append ` max-lg:pl-[3rem]` (same value as `HowToJoin`'s "Join CnC").
- [ ] **Step 2:** `JoinSteps.tsx` title gold span `<span className="text-cnc-gold font-medium">{active.title.last}</span>` → `<span className="text-cnc-gold font-medium max-lg:portrait:inline-block max-lg:portrait:pl-[3rem]">{active.title.last}</span>`.
- [ ] **Step 3:** Full suite, `tsc --noEmit`, clean build.
- [ ] **Step 4:** Commit `fix: phones — "By Agents" and each feature title's second word indented like "Join CnC"`.
- [ ] **Controller after:** FINGERPRINT identical; SHOTS `join-agents`, `join-steps` at 390×844 and 320×568: second line starts 48px right of the first (±2px), matching "Join CnC"'s offset; 844×390 unchanged (right-aligned).

### Task 6: Contact pop-up (#5)

**Files:** Modify `apps/web/src/components/ui/ContactModal.tsx`

- [ ] **Step 1:** Overlay `className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"` → append ` max-lg:items-start max-lg:pb-4 max-lg:pt-20`.
- [ ] **Step 2:** Panel `className="relative w-full max-w-lg rounded-2xl bg-white p-10 max-lg:max-h-[90dvh] max-lg:overflow-y-auto max-lg:p-6"` → replace `max-lg:max-h-[90dvh]` with `max-lg:max-h-[calc(100dvh-6rem)]`.
- [ ] **Step 3:** Subtitle `className="mt-1 mb-8 font-sans text-sm text-[#1B1B1B]/50"` → append ` max-lg:mb-5`; form `className="flex flex-col gap-6"` → append ` max-lg:gap-4`.
- [ ] **Step 4:** Message `<textarea rows={4} … className="resize-none border-b …"` → append ` max-lg:h-16` to its className (the textarea scrolls inside itself when the text is longer).
- [ ] **Step 5:** Full suite, `tsc --noEmit`, clean build.
- [ ] **Step 6:** Commit `fix: phones — contact pop-up starts below the navbar and fits the screen; shorter Message box that scrolls`.
- [ ] **Controller after:** FINGERPRINT identical (incl. `buy-popup` at 1440/1024). SHOTS `buy-popup`: at 390×664 (add this size for the pop-up) the pop-up top ≥ 64px, Send button and consent line fully inside both the viewport and the pop-up; at 320×568 top ≥ 64px, bottom ≤ viewport, Send reachable by scrolling the pop-up; type 400 characters into Message → the textarea scrolls (its `scrollHeight > clientHeight`) and the pop-up height does not change. If Send is still off-screen at 390×664, reduce further only with phone words (e.g. `max-lg:p-5`) and re-check.

### Task 7: Sell Our Process — pinned scroll on phones (#4)

**Files:** Create `apps/web/src/lib/sell-process-scroll.ts`, `apps/web/src/__tests__/lib/sell-process-scroll.test.ts`; Modify `apps/web/src/components/sell/SellProcess.tsx`

**Interfaces — Produces:** `phoneTravelPx(rowWidth: number, viewportWidth: number): number`; `phoneSectionHeight(travelPx: number | null): string`.

- [ ] **Step 1: Failing test** — `apps/web/src/__tests__/lib/sell-process-scroll.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { phoneSectionHeight, phoneTravelPx } from "@/lib/sell-process-scroll";

describe("phoneTravelPx", () => {
  it("is how far the row must slide so its right edge meets the screen's right edge", () => {
    expect(phoneTravelPx(3000, 390)).toBe(2610);
  });
  it("rounds to whole pixels", () => {
    expect(phoneTravelPx(3000.6, 390)).toBe(2611);
  });
  it("never goes negative when the row is narrower than the screen", () => {
    expect(phoneTravelPx(300, 390)).toBe(0);
  });
});

describe("phoneSectionHeight", () => {
  it("is the travel plus one screen height, so one swipe moves the cards about one-for-one", () => {
    expect(phoneSectionHeight(2610)).toBe("calc(2610px + 100svh)");
  });
  it("falls back to 600svh before the row has been measured", () => {
    expect(phoneSectionHeight(null)).toBe("600svh");
  });
});
```

- [ ] **Step 2:** `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/lib/sell-process-scroll.test.ts` — Expected: FAIL (cannot resolve `@/lib/sell-process-scroll`).
- [ ] **Step 3: Implement** `apps/web/src/lib/sell-process-scroll.ts`:

```ts
// Phone math for Sell's "Our Process" pinned scroll (below 1024px). Desktop uses its own vw values in SellProcess.
// How far the row slides: its right edge ends at the screen's right edge.
export function phoneTravelPx(rowWidth: number, viewportWidth: number): number {
  return Math.max(0, Math.round(rowWidth - viewportWidth));
}

// Section height on phones: the slide distance plus one screen, so scrolling moves the cards about one-for-one.
// Before the row is measured, a safe fallback that still pins the section.
export function phoneSectionHeight(travelPx: number | null): string {
  return travelPx === null ? "600svh" : `calc(${travelPx}px + 100svh)`;
}
```

- [ ] **Step 4:** Run the test file — Expected: PASS (5/5).
- [ ] **Step 5: Component** (`SellProcess.tsx`):
  - Imports: `import { useEffect, useRef, useState } from "react";` (add `useEffect`); `import { motion, useMotionValue, useScroll, useTransform } from "motion/react";` (add `useMotionValue`); add `import { useIsMobile } from "@/hooks/useIsMobile";` and `import { phoneSectionHeight, phoneTravelPx } from "@/lib/sell-process-scroll";`.
  - In `SellProcess()` after `const x = useTransform(...)` add:

```tsx
  // Phones (<1024px): same pinned scroll as desktop, but the slide distance is measured in px from the row.
  const isMobile = useIsMobile();
  const rowRef = useRef<HTMLDivElement>(null);
  const travel = useMotionValue(0);
  const [phoneTravel, setPhoneTravel] = useState<number | null>(null);
  const xPhone = useTransform(() => -scrollYProgress.get() * travel.get());
  useEffect(() => {
    if (!isMobile) return;
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const t = phoneTravelPx(row.offsetWidth, window.innerWidth);
      travel.set(t);
      setPhoneTravel(t);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [isMobile, travel]);
```

  - `<section … className="relative bg-[#1B1B1B] max-lg:!h-auto max-lg:pb-16" style={{ height: "900vh" }}>` → `className="relative bg-[#1B1B1B] max-lg:!h-[var(--sp-phone-h)]"` and `style={{ height: "900vh", ["--sp-phone-h" as string]: phoneSectionHeight(phoneTravel) }}`.
  - Sticky container `className="sticky top-0 h-screen overflow-hidden max-lg:static max-lg:h-auto max-lg:overflow-visible"` → `className="sticky top-0 h-screen overflow-hidden max-lg:h-[100svh]"`.
  - Progress bar `className="absolute left-16 right-16 top-[5.25rem] z-20 flex gap-1 max-lg:hidden"` → `className="absolute left-16 right-16 top-[5.25rem] z-20 flex gap-1 max-lg:left-6 max-lg:right-6"`.
  - Title wrapper `className="absolute left-16 top-[6.25rem] z-20 max-lg:static max-lg:px-6 max-lg:pb-6 max-lg:pt-24"` → `className="absolute left-16 top-[6.25rem] z-20 max-lg:left-6"`.
  - Row `motion.div`: add `ref={rowRef}`; className → `"flex h-full max-lg:!w-max max-lg:gap-3 max-lg:px-6 max-lg:pb-6 max-lg:pt-40 max-lg:landscape:pb-3 max-lg:landscape:pt-36"`; style → `{{ x: isMobile ? xPhone : x, width: `${TOTAL_VW}vw` }}` (desktop keeps the same `x` object and inline width).
  - Remove the now-unused phone word `max-lg:[scroll-snap-align:start]` from the intro, photo, text and `SlidePanel` panels (phone-only, no desktop effect).
- [ ] **Step 6:** Full suite, `tsc --noEmit`, clean build.
- [ ] **Step 7:** Commit `feat: phones — Sell Our Process pins and slides as you scroll, like desktop, with its progress bar`.
- [ ] **Controller after:** FINGERPRINT identical (incl. `sell-process-a/b` at 1440/1024). PROCESS passes at 390×844 and 844×390 incl. the rotate check. SHOTS of `sell-process-a/b` at 320/390/844/820: bar + title visible, panels not cut off (step title and body fully inside the row). If the landscape row is too short for a text panel, adjust only the landscape phone words (`max-lg:landscape:pt-*`/`pb-*`) and re-check.

### Task 8: Phone walk (controller, fixes dispatched)

- [ ] Serve 3100. At 320×568, 390×844, 844×390, 820×1180 with screenshots: homepage scroll through Why CnC (each panel's photos below text); footer on `/`, `/buy`, `/join` (order, newsletter field usable, icons tappable); `/buy` SHOP; `/sell` Our Process down and back up; open the pop-up from Buy ("Message"), Sell ("Start" on step 04, "Message"), Rent, Manage, Join — each fits per Task 6; `/join` titles. Record page overflow (must be 0) and anything off-screen.
- [ ] For each problem: one fix (phone-only words), FINGERPRINT identical after it. If none: "walk clean". Stop 3100.

### Task 9: Final verification (controller)

- [ ] Clean build of HEAD, serve 3100; old build (`<scratchpad>/bpf`) on 3101. FINGERPRINT `final base1` → all identical, twice.
- [ ] SHOTS + PROCESS on HEAD: every spec item fixed (compare with `before`), page overflow 0 everywhere.
- [ ] SPEED A/B: 3100 vs 3101 interleaved, desktop ×2 pairs then phone ×2 pairs; JS request counts equal or explained; timings within noise (re-run more pairs for any page that looks slower; separate server-time drift from browser time). Report a table.
- [ ] Stop both servers + child processes; remove the `bpf` worktree (`git worktree remove --force`; long paths → `cmd /c 'rmdir /s /q "\\?\<full path>"'` with the path written literally).
- [ ] Final whole-branch review (fresh reviewer, most capable model) with this plan's Review Focus. Then Ryan decides on the push.
