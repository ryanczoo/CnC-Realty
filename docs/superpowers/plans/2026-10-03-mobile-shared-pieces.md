# Mobile Layout — Sub-project 1 (Shared Pieces) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the site's shared components (hero lettering, FAQ, footer, CTA, contact pop-up) work on phones and upright iPads, and add the shared `useIsMobile()` helper — without changing the desktop site at all.

**Architecture:** Phone behavior is only *added*: Tailwind `max-lg:` classes (apply below 1024px) for layout, and a `useSyncExternalStore`-based `useIsMobile()` hook only for animation values. Desktop classes, inline values and animation numbers are never edited; the one inline style that must move becomes an `lg:` class with the identical value. Desktop safety is proven by measuring each component's element boxes in a desktop browser before any code change and after each task.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind CSS 3.4.19, `motion` 12.38 (`motion/react`), Vitest (node environment, `.test.ts` only — no React render infrastructure).

**Spec:** `docs/superpowers/specs/2026-10-03-mobile-layout-design.md`

## Global Constraints

- **Desktop is never edited.** Existing classes, inline styles and animation values stay exactly as they are. Phone behavior is only added via `max-lg:` variants or `useIsMobile()`. An inline style that must move becomes an `lg:` arbitrary class with the identical value.
- **Phone layout applies below 1024px** (`max-lg:`; media query `(max-width: 1023px)`).
- **Fluid from 320px to 1023px** — never tuned to one device; nothing wider than the screen.
- **Short sideways screens** — phone versions must fit and function at ~375px viewport height.
- **Safari's address bar** — phone heights use `svh`/`dvh`, never `vh`. Desktop keeps `vh`.
- **CSS first, JS only for motion** — layout changes are CSS; `useIsMobile()` only swaps animation values.
- **Hover becomes tap** wherever hover reveals content.
- **No pushing.** Commit after each task; Ryan pushes everything together later.
- **Every task ends with:** `pnpm --filter web test`, `pnpm --filter web exec tsc --noEmit`, and a clean production build. Never delete `apps/web/.next` while a dev server is running on it — check first with `netstat -ano | grep -E ":300[0-9] .*LISTENING"`; if a dev server is running, stop and report instead of building.
- **Browser checks are done by the controller** (the session that has the Puppeteer MCP tools), not by implementer subagents. Implementers do tests, `tsc` and build only.

## Review Focus

1. **Desktop drift in a touched component** — any desktop element moving or resizing. Expected: identical boxes at 1440×900. Covered by the controller desktop comparison in every task.
2. **A sideways phone (844×390) showing the hero** — expected: the desktop lettering shows and "SELL / WITH US" is fully visible, not cropped. Check in Task 4.
3. **A folded Galaxy Fold (344px wide) on the Manage hero** — expected: "MANAGE" fits fully on the phone lettering. Check in Task 4.
4. **Rotating an upright iPad to sideways while on the Sell page** — expected: `useIsMobile()` flips and the Values cards re-position without needing a scroll. Covered by the store change-notification test in Task 2 and the motion-value input in Task 3.
5. **A phone footer taller than the 600px minimum, especially on a sideways phone** — expected: all footer content (links, legal bar) is reachable and not clipped. Check in Task 6.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `apps/web/src/hooks/useIsMobile.ts` | Shared phone/tablet detection for animation values | Create |
| `apps/web/src/__tests__/hooks/useIsMobile.test.ts` | Tests for the store behind the hook | Create |
| `apps/web/src/components/sell/SellValues.tsx` | Values arch wheel — migrate its one-off width check to the helper | Modify |
| `apps/web/src/__tests__/components/SellValues.test.ts` | Pins `cardVars` desktop + phone math | Create |
| `apps/web/src/components/ui/VideoMaskHero.tsx` | Hero lettering — add a phone (portrait) lettering layer | Modify |
| `apps/web/src/__tests__/components/VideoMaskHero.test.ts` | Tests for `phoneWordLayout` | Create |
| `apps/web/src/components/blog/PressHero.tsx` | Pass the Press hero's phone height | Modify |
| `apps/web/src/components/home/FAQ.tsx` | Stack rows + collapse answers on phones | Modify |
| `apps/web/src/components/layout/Footer.tsx` | Stack the footer on phones | Modify |
| `apps/web/src/components/ui/PageCTA.tsx` | Stack CTA buttons on phones | Modify |
| `apps/web/src/components/ui/ContactModal.tsx` | Lighter padding + internal scroll on phones | Modify |

## Controller browser-check toolkit (used by Tasks 1 and 3–8)

The controller runs a production build of the current commit on port 3100 so it never touches Ryan's dev server:

```bash
cd C:/Users/hey_r/Desktop/CnC-Realty && netstat -ano | grep -E ":3100 .*LISTENING" && echo "port busy — stop the old 3100 server first"
pnpm --filter web build && pnpm --filter web exec next start -p 3100   # run in background
```

Open each viewport with `mcp__puppeteer__puppeteer_navigate` and `launchOptions: {"headless": true, "defaultViewport": {"width": W, "height": H, "isMobile": <W<1024>, "hasTouch": <W<1024>, "deviceScaleFactor": 2}}`.

**ROOTS** — paste into `mcp__puppeteer__puppeteer_evaluate` to define the component finders on the current page:

```js
window.__roots = {
  hero: () => document.querySelector("main section, section"),
  faq: () => [...document.querySelectorAll("section")].find((s) => s.querySelector("h2")?.textContent.trim() === "FAQs"),
  footer: () => document.querySelector("footer"),
  cta: () => document.querySelector('svg[viewBox="0 0 700 820"]')?.closest("section"),
  values: () => [...document.querySelectorAll("section")].find((s) => (s.querySelector("h2")?.textContent || "").replace(/\s+/g, " ").trim() === "Our Values"),
  modal: () => document.querySelector(".fixed.inset-0.z-50"),
};
"ok";
```

**MEASURE(name)** — desktop fingerprint of a component (zero-size elements skipped, so phone-only elements hidden on desktop don't count):

```js
((name) => {
  const root = window.__roots[name]();
  if (!root) return "MISSING " + name;
  const r0 = root.getBoundingClientRect();
  return [root, ...root.querySelectorAll("*")]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 || r.height > 0)
    .map((r) => [Math.round(r.left - r0.left), Math.round(r.top - r0.top), Math.round(r.width), Math.round(r.height)].join(","))
    .join("|");
})("footer")
```

**OVERFLOW(name)** — phone check: elements of the component sticking out past the screen edge (ignores `fixed` elements and content inside an SVG):

```js
((name) => {
  const root = window.__roots[name]();
  if (!root) return "MISSING " + name;
  const W = window.innerWidth;
  return [root, ...root.querySelectorAll("*")]
    .filter((el) => !el.closest("svg") || el.tagName === "svg")
    .filter((el) => getComputedStyle(el).position !== "fixed")
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && (r.right > W + 1 || r.left < -1))
    .map(({ el, r }) => `${el.tagName}.${String(el.className.baseVal ?? el.className).slice(0, 40)} L${Math.round(r.left)} R${Math.round(r.right)}`)
    .slice(0, 10);
})("footer")
```

Before measuring, wait for entrance animations to settle (`await new Promise(r => setTimeout(r, 3000))` inside an evaluate) and, for components below the fold, `root.scrollIntoView()` first and wait again. For `values`, scroll to `root.offsetTop + 2 * innerHeight` (a fixed point in its 500vh scroll) before waiting.

**Phone viewports (W×H):** 320×568, 344×882, 375×667, 390×844, 430×932, 820×1180, 844×390.

---

### Task 1: Desktop baseline (controller only — no code changes)

**Files:** none in the repo. Baselines are saved to the session scratchpad as `mobile-baseline-<page>-<component>.txt`.

- [ ] **Step 1: Confirm the tree is clean and record the base commit**

Run: `cd C:/Users/hey_r/Desktop/CnC-Realty && git status -s && git log --oneline -1`
Expected: no modified files under `apps/web/src`; note the commit hash as `BASELINE_SHA`.

- [ ] **Step 2: Build and start the production server on port 3100** (see toolkit)

- [ ] **Step 3: Capture desktop fingerprints at 1440×900**

For each pair below, navigate, define ROOTS, settle, run MEASURE and save the string:

| Page | Components |
|---|---|
| `http://localhost:3100/` | `faq`, `footer` |
| `http://localhost:3100/sell` | `hero`, `values`, `cta` |
| `http://localhost:3100/manage` | `hero`, `cta` |
| `http://localhost:3100/press` | `hero` |
| `http://localhost:3100/sell` after clicking the first `button` inside `__roots.cta()` | `modal` |

Expected: none of the results is `MISSING ...`.

- [ ] **Step 4: Repeat Step 3 once and confirm the strings are identical** (proves the measurement is stable; if a component differs between two runs, increase the settle wait for it and re-capture).

---

### Task 2: `useIsMobile()` helper

**Files:**
- Create: `apps/web/src/hooks/useIsMobile.ts`
- Test: `apps/web/src/__tests__/hooks/useIsMobile.test.ts`

**Interfaces:**
- Produces: `MOBILE_QUERY: "(max-width: 1023px)"`; `createMobileStore(win: Pick<Window, "matchMedia">): { subscribe(onChange: () => void): () => void; getSnapshot(): boolean }`; `getServerSnapshot(): false`; `useIsMobile(): boolean`.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/src/__tests__/hooks/useIsMobile.test.ts
import { describe, it, expect, vi } from "vitest";
import { MOBILE_QUERY, createMobileStore, getServerSnapshot } from "@/hooks/useIsMobile";

function fakeWindow(initial: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: initial,
    addEventListener: vi.fn((_: string, cb: () => void) => listeners.add(cb)),
    removeEventListener: vi.fn((_: string, cb: () => void) => listeners.delete(cb)),
  };
  const win = { matchMedia: vi.fn(() => mql) } as unknown as Pick<Window, "matchMedia">;
  const flip = (next: boolean) => {
    mql.matches = next;
    listeners.forEach((cb) => cb());
  };
  return { win, mql, flip, listeners };
}

describe("useIsMobile store", () => {
  it("uses the shared 1024px cutoff", () => {
    expect(MOBILE_QUERY).toBe("(max-width: 1023px)");
    const { win } = fakeWindow(false);
    createMobileStore(win);
    expect(win.matchMedia).toHaveBeenCalledWith("(max-width: 1023px)");
  });

  it("reports the current match", () => {
    expect(createMobileStore(fakeWindow(true).win).getSnapshot()).toBe(true);
    expect(createMobileStore(fakeWindow(false).win).getSnapshot()).toBe(false);
  });

  it("notifies subscribers when the screen crosses the cutoff (e.g. iPad rotation)", () => {
    const { win, flip } = fakeWindow(true);
    const store = createMobileStore(win);
    const onChange = vi.fn();
    store.subscribe(onChange);
    flip(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(false);
  });

  it("removes its listener on unsubscribe", () => {
    const { win, flip, listeners } = fakeWindow(false);
    const store = createMobileStore(win);
    const onChange = vi.fn();
    const unsubscribe = store.subscribe(onChange);
    unsubscribe();
    expect(listeners.size).toBe(0);
    flip(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is never mobile on the server, so server HTML always matches desktop", () => {
    expect(getServerSnapshot()).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/hooks/useIsMobile.test.ts`
Expected: FAIL — cannot resolve `@/hooks/useIsMobile`.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/hooks/useIsMobile.ts
import { useSyncExternalStore } from "react";

// The single phone/tablet cutoff for the whole site. Matches Tailwind's
// `max-lg:` variant, so CSS layout and JS animation values switch together.
export const MOBILE_QUERY = "(max-width: 1023px)";

export function createMobileStore(win: Pick<Window, "matchMedia">) {
  const mql = win.matchMedia(MOBILE_QUERY);
  return {
    subscribe(onChange: () => void) {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    getSnapshot: () => mql.matches,
  };
}

// Server HTML is always the desktop variant; during hydration React uses this
// value, then re-renders with the real one — no hydration mismatch.
export const getServerSnapshot = () => false as const;

let store: ReturnType<typeof createMobileStore> | null = null;
const getStore = () => (store ??= createMobileStore(window));
const subscribe = (onChange: () => void) => getStore().subscribe(onChange);
const getSnapshot = () => getStore().getSnapshot();

// For animation values only — layout changes belong in `max-lg:` CSS so the
// first paint is already correct.
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/hooks/useIsMobile.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Full suite, type check, build**

Run: `cd C:/Users/hey_r/Desktop/CnC-Realty && pnpm --filter web test && pnpm --filter web exec tsc --noEmit && rm -rf apps/web/.next && pnpm --filter web build`
Expected: all tests pass, `tsc` exit 0, build prints `✓ Compiled successfully`. (Check for a running dev server first — see Global Constraints.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/useIsMobile.ts apps/web/src/__tests__/hooks/useIsMobile.test.ts
git commit -m "feat: shared useIsMobile() helper for phone animation values"
```

---

### Task 3: Migrate `SellValues` to the helper

**Files:**
- Modify: `apps/web/src/components/sell/SellValues.tsx` (`cardVars` at lines 19–49; the 25 `useTransform` calls at lines 60–88)
- Test: `apps/web/src/__tests__/components/SellValues.test.ts`

**Interfaces:**
- Consumes: `useIsMobile()` from Task 2.
- Produces: `export function cardVars(i: number, t: number, mobile: boolean, panelH: number): { x: number; y: number; scale: number; opacity: number; rotate: number }`.

**Why the motion value:** card positions are scroll-driven motion values computed once at mount. During hydration `useIsMobile()` is `false`, so reading it through a plain closure would leave phone cards in desktop positions until the first scroll. Feeding it as a second motion-value input makes every card recompute the instant the helper flips (including iPad rotation).

- [ ] **Step 1: Characterization test against the current code**

Export the existing function without changing it: change line 19 from `function cardVars(i: number, t: number) {` to `export function cardVars(i: number, t: number) {`. Then write:

```ts
// apps/web/src/__tests__/components/SellValues.test.ts
import { describe, it, expect } from "vitest";
import { cardVars } from "@/components/sell/SellValues";

// In the node test environment `window` is undefined, so the current code
// takes the desktop branch (R=660) with panelH=900.
describe("cardVars (current desktop behaviour)", () => {
  it("centres card 2 at the midpoint of the scroll", () => {
    const v = cardVars(2, 0.5);
    expect(v.x).toBeCloseTo(-150);
    expect(v.y).toBeCloseTo(-60);
    expect(v.scale).toBeCloseTo(1);
    expect(v.opacity).toBeCloseTo(1);
    expect(v.rotate).toBeCloseTo(0);
  });

  it("puts card 4 far to the side at the start", () => {
    const v = cardVars(4, 0);
    expect(v.x).toBeCloseTo(421.58, 1);
    expect(v.y).toBeCloseTo(-1050);
    expect(v.scale).toBeCloseTo(0.64);
    expect(v.opacity).toBeCloseTo(0.42);
    expect(v.rotate).toBeCloseTo(50.4);
  });
});
```

Run: `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/components/SellValues.test.ts`
Expected: 2 passed (this pins today's desktop numbers before anything changes).

- [ ] **Step 2: Rewrite the test for the new signature (fails until Step 3)**

Replace the file contents with:

```ts
// apps/web/src/__tests__/components/SellValues.test.ts
import { describe, it, expect } from "vitest";
import { cardVars } from "@/components/sell/SellValues";

describe("cardVars", () => {
  it("desktop: centres card 2 at the midpoint of the scroll (unchanged numbers)", () => {
    const v = cardVars(2, 0.5, false, 900);
    expect(v.x).toBeCloseTo(-150);
    expect(v.y).toBeCloseTo(-60);
    expect(v.scale).toBeCloseTo(1);
    expect(v.opacity).toBeCloseTo(1);
    expect(v.rotate).toBeCloseTo(0);
  });

  it("desktop: puts card 4 far to the side at the start (unchanged numbers)", () => {
    const v = cardVars(4, 0, false, 900);
    expect(v.x).toBeCloseTo(421.58, 1);
    expect(v.y).toBeCloseTo(-1050);
    expect(v.scale).toBeCloseTo(0.64);
    expect(v.opacity).toBeCloseTo(0.42);
    expect(v.rotate).toBeCloseTo(50.4);
  });

  it("phone: uses the smaller arch and card size", () => {
    const v = cardVars(2, 0.5, true, 900);
    expect(v.x).toBeCloseTo(-80);
    expect(v.y).toBeCloseTo(31);
  });
});
```

Run: `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/components/SellValues.test.ts`
Expected: FAIL on the phone test (the current function ignores the extra arguments and returns desktop values: x −150, not −80).

- [ ] **Step 3: Implement**

In `SellValues.tsx`:

1. Imports become:

```ts
import { useEffect, useRef } from "react";
import { motion, useMotionValue, useScroll, useTransform } from "motion/react";
import { RevealLine } from "@/components/ui/reveal-text";
import { useIsMobile } from "@/hooks/useIsMobile";
```

2. Replace the first five lines of `cardVars` (the signature through `const panelH = ...`) with:

```ts
export function cardVars(i: number, t: number, mobile: boolean, panelH: number) {
  const R       = mobile ? 360 : 660;
  const CW      = mobile ? 160 : 300;
  const CH      = mobile ? 208 : 390;
```

The rest of the function body is unchanged.

3. Directly after the `useScroll` call inside `SellValues()`, add:

```ts
  // 1 on phones/upright iPads, 0 on desktop. A motion value (not a plain
  // closure) so the cards recompute the instant the helper flips — after
  // hydration and on iPad rotation — without waiting for a scroll.
  const isMobile = useIsMobile();
  const mobileMV = useMotionValue(isMobile ? 1 : 0);
  useEffect(() => { mobileMV.set(isMobile ? 1 : 0); }, [isMobile, mobileMV]);
  const panelH = () => (typeof window !== "undefined" ? window.innerHeight : 900);
```

4. Replace the 25 `useTransform` lines with:

```ts
  const x0  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(0, t, m === 1, panelH()).x);
  const y0  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(0, t, m === 1, panelH()).y);
  const s0  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(0, t, m === 1, panelH()).scale);
  const o0  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(0, t, m === 1, panelH()).opacity);
  const ro0 = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(0, t, m === 1, panelH()).rotate);

  const x1  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(1, t, m === 1, panelH()).x);
  const y1  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(1, t, m === 1, panelH()).y);
  const s1  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(1, t, m === 1, panelH()).scale);
  const o1  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(1, t, m === 1, panelH()).opacity);
  const ro1 = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(1, t, m === 1, panelH()).rotate);

  const x2  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(2, t, m === 1, panelH()).x);
  const y2  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(2, t, m === 1, panelH()).y);
  const s2  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(2, t, m === 1, panelH()).scale);
  const o2  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(2, t, m === 1, panelH()).opacity);
  const ro2 = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(2, t, m === 1, panelH()).rotate);

  const x3  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(3, t, m === 1, panelH()).x);
  const y3  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(3, t, m === 1, panelH()).y);
  const s3  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(3, t, m === 1, panelH()).scale);
  const o3  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(3, t, m === 1, panelH()).opacity);
  const ro3 = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(3, t, m === 1, panelH()).rotate);

  const x4  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(4, t, m === 1, panelH()).x);
  const y4  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(4, t, m === 1, panelH()).y);
  const s4  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(4, t, m === 1, panelH()).scale);
  const o4  = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(4, t, m === 1, panelH()).opacity);
  const ro4 = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => cardVars(4, t, m === 1, panelH()).rotate);
```

Nothing else in the file changes (the `MOTION` array, JSX and classes stay as they are).

- [ ] **Step 4: Run to verify it passes**

Run: `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/components/SellValues.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Full suite, type check, build** (as Task 2 Step 5). If `tsc` rejects the `([t, m]: number[])` annotation, use `(values: number[]) => cardVars(0, values[0], values[1] === 1, panelH()).x` instead — same behaviour.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/sell/SellValues.tsx apps/web/src/__tests__/components/SellValues.test.ts
git commit -m "refactor: SellValues reads the shared useIsMobile() helper via a motion value"
```

- [ ] **Step 7: Controller check** — restart the 3100 server on this commit. Desktop 1440×900 `/sell` → MEASURE `values` must equal the Task 1 baseline. Phone 390×844 `/sell` → scroll into the Values section without scrolling further and confirm the cards are already in phone positions (small 160px cards), not desktop ones.

---

### Task 4: `VideoMaskHero` phone lettering

**Files:**
- Modify: `apps/web/src/components/ui/VideoMaskHero.tsx`
- Modify: `apps/web/src/components/blog/PressHero.tsx`
- Test: `apps/web/src/__tests__/components/VideoMaskHero.test.ts`

**Interfaces:**
- Produces: `export function phoneWordLayout(lines: string[]): { word: string; y: number }[]`; new optional prop `mobileHeightClass?: string` (default `"max-lg:h-[95svh]"`).

**How it stays desktop-safe:** the desktop `<svg>` only gains `max-lg:portrait:hidden` (hidden on upright phones/iPads below 1024px). The phone `<svg>` is `hidden max-lg:portrait:block`, so at ≥1024px it never displays. Sideways phones keep the desktop lettering, whose wide 1920×1080 canvas suits a wide screen.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/__tests__/components/VideoMaskHero.test.ts
import { describe, it, expect } from "vitest";
import { phoneWordLayout } from "@/components/ui/VideoMaskHero";

describe("phoneWordLayout", () => {
  it("puts one word per line, centred vertically on the 1920-tall canvas", () => {
    expect(phoneWordLayout(["SELL", "WITH US"])).toEqual([
      { word: "SELL", y: 700 },
      { word: "WITH", y: 960 },
      { word: "US", y: 1220 },
    ]);
  });

  it("centres a single word", () => {
    expect(phoneWordLayout(["PRESS"])).toEqual([{ word: "PRESS", y: 960 }]);
  });

  it("ignores extra spaces", () => {
    expect(phoneWordLayout(["MANAGE", " WITH  US "]).map((w) => w.word)).toEqual(["MANAGE", "WITH", "US"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/components/VideoMaskHero.test.ts`
Expected: FAIL — `phoneWordLayout` is not exported.

- [ ] **Step 3: Implement**

In `VideoMaskHero.tsx`, below the `LINE_Y` constant, add:

```ts
// Phone (portrait) lettering: one word per line on a 1080×1920 canvas.
// 180 keeps the longest word ("MANAGE") inside the visible width of a folded
// Galaxy Fold (~344px wide), where the "slice" crop hides the most width.
const PHONE_TEXT_SIZE = "180";
const PHONE_LINE_GAP = 260;

export function phoneWordLayout(lines: string[]): { word: string; y: number }[] {
  const words = lines.flatMap((line) => line.split(" ").filter(Boolean));
  const mid = (words.length - 1) / 2;
  return words.map((word, i) => ({ word, y: 960 + (i - mid) * PHONE_LINE_GAP }));
}
```

Add `mobileHeightClass?: string;` to `Props`, and add `mobileHeightClass = "max-lg:h-[95svh]"` to the destructured parameters (after `heightClass = "h-[95vh]"`).

Change the `<section>` className from:

```tsx
className={`relative overflow-hidden bg-black ${heightClass}`}
```
to:
```tsx
className={`relative overflow-hidden bg-black ${heightClass} ${mobileHeightClass}`}
```

Change the existing desktop `<svg>` className from `"absolute inset-0 h-full w-full"` to `"absolute inset-0 h-full w-full max-lg:portrait:hidden"`. Nothing else in that `<svg>` changes.

Directly after the desktop `</svg>`, add the phone layer:

```tsx
      <svg
        className="absolute inset-0 hidden h-full w-full max-lg:portrait:block"
        viewBox="0 0 1080 1920"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id={`${maskId}-mobile`}>
            <rect width="1080" height="1920" fill="white" />
            <motion.g initial="hidden" animate="visible" variants={container}>
              {phoneWordLayout(lines).map(({ word, y }, i) => (
                <motion.text
                  key={`${word}-${i}`}
                  {...TEXT_PROPS}
                  x="540"
                  fontSize={PHONE_TEXT_SIZE}
                  y={y}
                  variants={WORD_VARIANT}
                >
                  {word}
                </motion.text>
              ))}
            </motion.g>
          </mask>
        </defs>
        <rect width="1080" height="1920" fill="black" fillOpacity="0.72" mask={`url(#${maskId}-mobile)`} />
      </svg>
```

In `PressHero.tsx`, add `mobileHeightClass="max-lg:h-[47.5svh]"` directly after `heightClass="h-[47.5vh]"`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/components/VideoMaskHero.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Full suite, type check, build** (as Task 2 Step 5).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ui/VideoMaskHero.tsx apps/web/src/components/blog/PressHero.tsx apps/web/src/__tests__/components/VideoMaskHero.test.ts
git commit -m "feat: phone lettering layer for VideoMaskHero heroes"
```

- [ ] **Step 7: Controller check**
  - Desktop 1440×900: MEASURE `hero` on `/sell`, `/manage`, `/press` equals the Task 1 baselines.
  - Phones (upright sizes 320×568, 344×882, 375×667, 390×844, 430×932, 820×1180) on `/sell` and `/manage`: every word's `getBoundingClientRect()` (`[...document.querySelectorAll('mask[id$="-mobile"] text')]`) sits inside the hero section's left/right edges, and the section height is ~95% of the viewport height. Take a screenshot (for the controller only) at 344×882 on `/manage` to confirm "MANAGE" is fully visible.
  - Sideways phone 844×390 on `/sell`: the desktop lettering shows and both lines "SELL" / "WITH US" are fully inside the visible section.
  - `/press` at 390×844: section height is ~47.5% of the viewport.

---

### Task 5: `FAQ` stacks on phones

**Files:**
- Modify: `apps/web/src/components/home/FAQ.tsx` (row `motion.div` around line 49; question `p`, answer `motion.p`, number `span` below it)

No unit test: this task changes Tailwind classes only (no logic), and this project has no React render test infrastructure. Verified by the controller check.

- [ ] **Step 1: Row grid**

On the row `motion.div`, change:

```tsx
              className="relative grid cursor-pointer py-6"
              style={{ gridTemplateColumns: "26% 52% 22%" }}
```
to:
```tsx
              className="relative grid cursor-pointer py-6 lg:[grid-template-columns:26%_52%_22%] max-lg:grid-cols-[1fr_auto] max-lg:gap-x-4"
```

(The inline style is removed; the `lg:` class carries the identical desktop value.)

- [ ] **Step 2: Place the three cells on phones**

Question `<p>` className becomes:
```tsx
className="font-sans text-[1.15rem] font-light leading-tight text-[#1B1B1B] xl:text-[1.3rem] max-lg:col-start-1 max-lg:row-start-1"
```

Answer `<motion.p>` className becomes:
```tsx
className={`pl-24 pr-8 font-sans text-base leading-relaxed text-[#1B1B1B]/50 max-lg:col-span-2 max-lg:row-start-2 max-lg:pl-0 max-lg:pr-0 max-lg:pt-4 ${isOpen ? "" : "max-lg:hidden"}`}
```

Number `<span>` className becomes:
```tsx
className="pt-1 text-right font-sans text-sm text-[#1B1B1B]/25 max-lg:col-start-2 max-lg:row-start-1"
```

Nothing else changes — the existing `openIdx` click and keyboard handlers already open one answer at a time on tap.

- [ ] **Step 3: Full suite, type check, build** (as Task 2 Step 5).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/home/FAQ.tsx
git commit -m "feat: FAQ rows stack and collapse on phones"
```

- [ ] **Step 5: Controller check**
  - Desktop 1440×900 `/`: MEASURE `faq` equals the Task 1 baseline. Hover the first question (`mcp__puppeteer__puppeteer_hover`) and confirm its answer becomes visible (desktop hover unchanged).
  - Phones (all 7 viewports) `/`: OVERFLOW `faq` returns `[]`; closed answers have `display: none`; clicking a question makes its answer visible below it with the `( n )` number on the question's line.

---

### Task 6: `Footer` stacks on phones

**Files:**
- Modify: `apps/web/src/components/layout/Footer.tsx` (content `motion.div` ~line 158, main row ~163, logo `Image` ~167, right nav ~268, legal bar ~282–283)

No unit test (classes only). Verified by the controller check.

- [ ] **Step 1: Let the content set the footer height on phones**

Content `motion.div` className: `"absolute inset-0 flex flex-col justify-end"` → `"absolute inset-0 flex flex-col justify-end max-lg:relative"`.

(On desktop the content stays absolutely positioned inside the 600px footer. On phones the stacked content is taller than 600px, so it becomes `relative` and the footer grows to fit instead of clipping.)

- [ ] **Step 2: Stack the main row**

Main row className: `"flex items-end justify-between px-8 pb-6 pt-12 lg:px-16"` → `"flex items-end justify-between px-8 pb-6 pt-12 lg:px-16 max-lg:flex-col max-lg:items-center max-lg:gap-10 max-lg:pt-16"`.

Logo `Image` className: `"object-contain object-left"` → `"object-contain object-left max-lg:h-auto max-lg:w-[180px] max-lg:object-center"`.

Right nav className: `"flex flex-col items-end gap-2"` → `"flex flex-col items-end gap-2 max-lg:items-center"`.

- [ ] **Step 3: Wrap the legal bar cleanly**

Legal bar outer className: `"flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-8 py-4 lg:px-16"` → append `" max-lg:flex-col max-lg:justify-center max-lg:text-center"`.

Its first inner div: `"flex flex-wrap items-center gap-4"` → `"flex flex-wrap items-center gap-4 max-lg:justify-center"`.

- [ ] **Step 4: Full suite, type check, build** (as Task 2 Step 5).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/Footer.tsx
git commit -m "feat: footer stacks into one column on phones"
```

- [ ] **Step 6: Controller check**
  - Desktop 1440×900 `/`: MEASURE `footer` equals the Task 1 baseline.
  - Phones (all 7 viewports) `/`: scroll to the bottom (`window.scrollTo(0, document.body.scrollHeight)`), wait 1s; OVERFLOW `footer` returns `[]`; the last legal-bar element ("All Rights Reserved") has `getBoundingClientRect().bottom <= innerHeight` (reachable, not clipped).
  - **If at 844×390 the footer content cannot be fully brought into view** (the sticky footer is taller than the screen): add `max-lg:landscape:static` to the `<footer>` className, re-run Steps 4–6, and amend the commit message to mention it.

---

### Task 7: `PageCTA` buttons and `ContactModal` on phones

**Files:**
- Modify: `apps/web/src/components/ui/PageCTA.tsx` (heading ~line 58, button row ~62)
- Modify: `apps/web/src/components/ui/ContactModal.tsx` (panel `motion.div` ~line 86)

No unit test (classes only). Verified by the controller check.

- [ ] **Step 1: PageCTA heading scales, buttons stack full-width**

Heading className: `` `font-sans text-[2.5rem] font-light leading-tight ${body ? "mb-4" : "mb-10"}` `` → `` `font-sans text-[2.5rem] font-light leading-tight max-lg:text-[clamp(1.9rem,8vw,2.5rem)] ${body ? "mb-4" : "mb-10"}` ``.

Button row className: `"flex justify-center gap-4"` → `"flex justify-center gap-4 max-lg:flex-col max-lg:items-stretch max-lg:[&>*]:justify-center"`.

(The child selector centres the label inside each full-width button, including the custom `secondaryClassName` the Manage page passes, without editing any button's own classes.)

- [ ] **Step 2: ContactModal lighter padding and internal scroll**

Panel className: `"relative w-full max-w-lg rounded-2xl bg-white p-10"` → `"relative w-full max-w-lg rounded-2xl bg-white p-10 max-lg:max-h-[90dvh] max-lg:overflow-y-auto max-lg:p-6"`.

- [ ] **Step 3: Full suite, type check, build** (as Task 2 Step 5).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/PageCTA.tsx apps/web/src/components/ui/ContactModal.tsx
git commit -m "feat: CTA buttons stack and contact pop-up scrolls on phones"
```

- [ ] **Step 5: Controller check**
  - Desktop 1440×900: MEASURE `cta` on `/sell` and `/manage`, and `modal` on `/sell` (after clicking the CTA's first button), equal the Task 1 baselines.
  - Phones (all 7 viewports) on `/manage` (two buttons): OVERFLOW `cta` returns `[]`; the two buttons are stacked (second button's top ≥ first button's bottom) and each is wider than 60% of the viewport.
  - Phones 375×667 and 844×390 on `/sell`: open the modal; OVERFLOW `modal` returns `[]`; the panel's height ≤ 90% of the viewport and its submit button can be scrolled into view inside the panel.

---

### Task 8: Final verification (controller)

- [ ] **Step 1:** `cd C:/Users/hey_r/Desktop/CnC-Realty && pnpm --filter web test && pnpm --filter web exec tsc --noEmit` — all pass, exit 0.
- [ ] **Step 2:** Clean build and restart the 3100 server on the final commit.
- [ ] **Step 3: Full desktop comparison** — re-run every MEASURE from Task 1 at 1440×900; every string must equal its baseline. Any difference is a bug to fix before finishing.
- [ ] **Step 4: Phone sweep** — at all 7 phone viewports, run OVERFLOW for `hero` (`/sell`, `/manage`, `/press`), `faq` (`/`), `footer` (`/`), `cta` (`/manage`); all `[]`.
- [ ] **Step 5:** Stop the 3100 server. Report to Ryan which pages to check on his iPhone: the hero on Buy/Sell/Rent/Manage/Press, the FAQ on home/Buy/Sell/Rent, the footer anywhere, the CTA + "Message" pop-up on Sell/Manage. Note that page-specific sections (Why CnC, testimonials, Buy steps, etc.) are still desktop-only until sub-projects 2–6.
- [ ] **Step 6:** Do not push — Ryan pushes this together with the pending tracking commit.
