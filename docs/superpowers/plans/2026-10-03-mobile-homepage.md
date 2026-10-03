# Mobile Layout — Sub-project 2 (Homepage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every remaining homepage section (Hero, Listings heading, Why CnC, Services, "We create" + carousel, Testimonial cards, Join CnC image) a phone/upright-iPad layout, with simplified versions of the scroll effects — without changing desktop.

**Architecture:** Phone-only Tailwind `max-lg:` classes. Inline styles are overridden on phones with the important modifier (`max-lg:!…`), which beats inline styles and never applies ≥1024px, so desktop code is not edited. Scroll-effect numbers that must differ on phones (Services parallax distance, Join CnC image size) come from small exported pure functions fed by `useIsMobile()` through a motion value (the sub-project 1 SellValues pattern), so desktop numbers are pinned by unit tests.

**Tech Stack:** Next.js 14, React 18, Tailwind 3.4.19, `motion` 12.38, Vitest (node env, `.test.ts` only).

**Spec:** `docs/superpowers/specs/2026-10-03-mobile-homepage-design.md` (parent: `docs/superpowers/specs/2026-10-03-mobile-layout-design.md`)

## Global Constraints

- **Desktop is never edited.** Existing classes, inline styles and animation values stay as they are; only `max-lg:` classes (including `max-lg:!…` important overrides) and `useIsMobile()`-driven motion values are added.
- **Phone layout below 1024px**; fluid 320–1023px; sideways phones (~844×390) must fit; phone heights use `svh`/`dvh`.
- **Shared components untouched:** `PlaceholdersAndVanishInput`, `ListingsMarquee`, `useScrollStepper`, `FAQ`. No new shared components.
- **Every task ends with** `pnpm --filter web test`, `pnpm --filter web exec tsc --noEmit`, clean production build (check no dev server: `netstat -ano | grep -E ":300[0-9] .*LISTENING"`; stop the controller's own 3100 server before deleting `.next`).
- **No pushing.** Commit per task.
- **Browser checks are done by the controller** (Puppeteer MCP), on a production build served at port 3100.

## Review Focus

1. **Desktop drift** in any homepage section — expected identical boxes at 1440×900 vs the Task 1 baseline (transforms neutralized). Every task's controller check.
2. **Sideways phone (844×390) in Why CnC** — expected side-by-side layout (not stacked), "COMMISSION" fully visible, description and button inside the pinned screen. Task 3.
3. **"COMMISSION" at 320px upright** — expected on one line inside the screen. Task 3.
4. **Services flip on a phone** — expected tap flips the square card and the longest description (Buy) fits on the back without being cut off; no custom cursor appears. Task 4.
5. **Join CnC heading on a phone** — expected the "Be the agent you're meant to be" heading is readable before the growing image covers it, at 390×844 and 844×390. Task 7.

---

## File Structure

| File | Change |
|---|---|
| `apps/web/src/components/home/HeroSection.tsx` | phone top offset + height |
| `apps/web/src/components/home/FeaturedListings.tsx` | phone heading stagger + sizes |
| `apps/web/src/components/home/WhyCnC.tsx` | phone stacked pinned panel, shorter scroll |
| `apps/web/src/components/home/ServicesSection.tsx` | one card per row, reduced parallax, no cursor; export `parallaxY` |
| `apps/web/src/__tests__/components/ServicesSection.test.ts` | pins `parallaxY` |
| `apps/web/src/components/home/TestimonialsIntro.tsx` | phone headline sizes + `svh` |
| `apps/web/src/components/home/AdvantageCarousel.tsx` | wider/taller upright-phone cards |
| `apps/web/src/components/home/TestimonialCards.tsx` | single column, auto-height quotes |
| `apps/web/src/components/home/JoinCnCCTA.tsx` | larger start, shorter scroll; export `ctaImageSize` |
| `apps/web/src/__tests__/components/JoinCnCCTA.test.ts` | pins `ctaImageSize` |

## Controller browser-check toolkit

Serve the current commit: stop any old 3100 server, `pnpm --filter web build`, then `pnpm --filter web exec next start -p 3100` in the background; wait for HTTP 200.

Load pages inside same-origin iframes from `http://localhost:3100/press` (navigate there first at 1440×900 so iframes are same-origin). An iframe's own size drives its media queries and orientation, so one page can check every viewport.

**ROOTS** (in the iframe's document `d`):

```js
const byText = (sel, t) => [...d.querySelectorAll(sel)].find((e) => e.textContent.includes(t));
const ROOTS = {
  hero: () => d.querySelector("main section, section"),
  listings: () => byText("section", "Listings in"),
  why: () => [...d.querySelectorAll("div.sticky")].find((s) => s.textContent.includes("COMMISSION"))?.parentElement,
  services: () => byText("section", "See the difference"),
  intro: () => byText("section", "We create"),
  cards: () => byText("section", "Kevin Luevanos"),
  joincta: () => byText("section", "Be CnC"),
};
```

**Scroll position before measuring** (iframe window `w`): `why` → `w.scrollTo(0, root.offsetTop + 10)`; `joincta` → `w.scrollTo(0, root.offsetTop + root.offsetHeight / 2)`; others → `root.scrollIntoView()`. Wait 3500ms.

**MEASURE(root)** — transforms neutralized during the synchronous read:

```js
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(16) + ":" + s.length; };
const measure = (root) => { const els = [root, ...root.querySelectorAll("*")]; const sv = els.map((e) => e.style ? e.style.transform : null); els.forEach((e) => { if (e.style) e.style.transform = "none"; }); const r0 = root.getBoundingClientRect();
  const s = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 || r.height > 0).map((r) => [Math.round(r.left - r0.left), Math.round(r.top - r0.top), Math.round(r.width), Math.round(r.height)].join(",")).join("|");
  els.forEach((e, i) => { if (e.style) e.style.transform = sv[i]; }); return hash(s); };
```

**OVERFLOW(root)** — elements past the screen edge, excluding anything already clipped by an `overflow` hidden/clip ancestor that is itself on screen:

```js
const overflow = (w, root) => { const W = w.innerWidth;
  const clipped = (el) => { for (let a = el.parentElement; a; a = a.parentElement) { const s = w.getComputedStyle(a); if (/hidden|clip/.test(s.overflowX)) { const r = a.getBoundingClientRect(); if (r.left >= -1 && r.right <= W + 1) return true; } } return false; };
  return [root, ...root.querySelectorAll("*")].filter((el) => !el.closest("svg") || el.tagName === "svg").filter((el) => w.getComputedStyle(el).position !== "fixed")
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > W + 1 || r.left < -1) && !clipped(el); })
    .map((el) => `${el.tagName}.${String(el.className.baseVal ?? el.className).slice(0, 30)}`).slice(0, 5); };
```

**Phone viewports:** 320×568, 344×882, 375×667, 390×844, 430×932, 820×1180, 844×390.

---

### Task 1: Desktop baseline (controller only)

- [ ] **Step 1:** `git status -s apps/web/src` is empty; record `BASELINE_SHA` (`git log --oneline -1`).
- [ ] **Step 2:** Build and serve on 3100 (toolkit).
- [ ] **Step 3:** In a 1440×900 iframe of `/`, MEASURE each of `hero, listings, why, services, intro, cards, joincta` (scroll per toolkit). None `MISSING`.
- [ ] **Step 4:** Repeat Step 3 in a fresh iframe; all hashes identical. Save the hashes in the ledger workspace as `baseline.txt`.

---

### Task 2: Hero + Listings heading

**Files:** Modify `HeroSection.tsx`, `FeaturedListings.tsx`. No unit test (classes only; verified by controller check).

- [ ] **Step 1: Hero**

`HeroSection.tsx` line 55 section className: `"relative flex min-h-screen flex-col items-center justify-center overflow-hidden"` → append `" max-lg:min-h-[100svh]"`.

Line 68 content className: `"relative z-10 flex flex-col items-center gap-6 px-4 text-center mt-72"` → append `" max-lg:mt-24"`.

- [ ] **Step 2: Listings heading**

`FeaturedListings.tsx` line 34 span className: `"-ml-[1.6in] block text-[2.4rem] xl:text-[2.9rem] text-[#1B1B1B] tabular-nums"` → append `" max-lg:-ml-[18vw] max-lg:text-[clamp(1.6rem,7.5vw,2.4rem)]"`.

Line 37 span className: `"ml-[1.6in] block text-[3.2rem] xl:text-[3.8rem]"` → append `" max-lg:ml-[18vw] max-lg:text-[clamp(2.1rem,10vw,3.2rem)]"`.

- [ ] **Step 3:** Suite, `tsc`, build (Global Constraints). Expected: all pass, `tsc` 0, `✓ Compiled successfully`.
- [ ] **Step 4: Commit** — `git add apps/web/src/components/home/HeroSection.tsx apps/web/src/components/home/FeaturedListings.tsx && git commit -m "feat: homepage hero and listings heading fit phones"`
- [ ] **Step 5: Controller check** — desktop MEASURE `hero`, `listings` = baseline. Phones (7): OVERFLOW `hero`, `listings` = `[]`; the hero's search box (`input` in the hero) is fully inside the screen; at 844×390 the search box bottom ≤ 390.

---

### Task 3: Why CnC — stacked pinned panel on upright phones

**Files:** Modify `WhyCnC.tsx`. No unit test (classes only).

Upright phones/iPads (`max-lg:portrait:`) stack: media on top (45% of the pinned screen), text below. Sideways phones (`max-lg:landscape:`) keep the side-by-side layout with smaller padding. All phones get a 2-screen scroll and height-aware title sizes.

- [ ] **Step 1: Scroll length and pinned screen**

Line 66 container className `"relative"` → `"relative max-lg:!h-[200svh]"` (overrides the inline `${ITEMS.length * 100}vh` on phones only).

Line 68 className `"sticky top-0 h-screen overflow-hidden bg-[#F2F0EF]"` → append `" max-lg:h-[100svh]"`.

Line 69 className `"flex h-full"` → `"flex h-full max-lg:portrait:flex-col-reverse"` (text is first in the DOM, so reversing puts media on top).

- [ ] **Step 2: Text panel**

Line 72 className `"relative flex w-[42%] flex-col justify-center pl-28 pr-16"` → append `" max-lg:portrait:w-full max-lg:portrait:flex-1 max-lg:portrait:justify-start max-lg:portrait:pb-8 max-lg:portrait:pl-14 max-lg:portrait:pr-6 max-lg:portrait:pt-6 max-lg:landscape:pl-14 max-lg:landscape:pr-6"`.

Line 75 progress bar className `"absolute left-14 top-1/2 flex -translate-y-1/2 flex-col gap-1"` → append `" max-lg:left-6 max-lg:!h-[120px]"`.

Line 103 className `"flex flex-col gap-12"` → `"flex flex-col gap-12 max-lg:gap-5"`.

Line 111 title part className — replace the template with:

```tsx
className={`block ${part.size ?? (part.sm ? "text-[3rem] xl:text-[3.6rem]" : "text-[4rem] xl:text-[4.8rem]")} ${part.sm ? "max-lg:text-[clamp(1.2rem,min(7vw,6svh),2.8rem)]" : "max-lg:text-[clamp(1.5rem,min(9vw,8svh),3.6rem)]"}`}
```

(The desktop part of the template is unchanged; the phone class is appended. `min(…vw, …svh)` keeps "COMMISSION" inside a sideways phone's 390px height and a 320px upright width.)

- [ ] **Step 3: Media block**

Line 153 className `"relative flex-1"` → `"relative flex-1 max-lg:portrait:h-[45%] max-lg:portrait:flex-none"`.

Line 157 back media className `"absolute overflow-hidden rounded-2xl"` → append `" max-lg:portrait:!right-[6%] max-lg:portrait:!top-[10%] max-lg:portrait:!h-[82%] max-lg:portrait:!w-[62%]"`.

Line 187 preload copies className `"pointer-events-none absolute opacity-0"` → append `" max-lg:portrait:!left-[6%] max-lg:portrait:!top-[30%] max-lg:portrait:!h-[62%] max-lg:portrait:!w-[44%]"`.

Line 201 front image className `"absolute z-10 overflow-hidden rounded-2xl"` → append `" max-lg:portrait:!left-[6%] max-lg:portrait:!top-[30%] max-lg:portrait:!h-[62%] max-lg:portrait:!w-[44%]"`.

- [ ] **Step 4:** Suite, `tsc`, build.
- [ ] **Step 5: Commit** — `git commit -m "feat: Why CnC stacks into a shorter pinned panel on phones"` (only `WhyCnC.tsx` staged).
- [ ] **Step 6: Controller check** — desktop MEASURE `why` = baseline. Phones (7): OVERFLOW `why` = `[]`; the section's height ≈ 2× the viewport height; at the first panel the "COMMISSION" span's right edge ≤ viewport width and its text is on one line (its height < 1.5× its font size); the description `p` bottom ≤ viewport height. At 844×390 the layout is side-by-side (text panel left of media). Scroll through the section and confirm `activeIdx` advances (the visible title changes from "100% COMMISSION" to "FREEDOM AWAITS" by the end).

---

### Task 4: Services — one card per row, reduced parallax, no custom cursor

**Files:**
- Modify: `ServicesSection.tsx`
- Test: `apps/web/src/__tests__/components/ServicesSection.test.ts`

**Interfaces:** Produces `export function parallaxY(parallax: number, t: number, mobile: boolean): number` and `export const MOBILE_PARALLAX = 0.15`. Consumes `useIsMobile()`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/__tests__/components/ServicesSection.test.ts
import { describe, it, expect } from "vitest";
import { parallaxY } from "@/components/home/ServicesSection";

describe("parallaxY", () => {
  // Desktop must equal the old useTransform(scrollYProgress, [0, 1], [p, -p]).
  it("desktop: moves from +p to -p across the scroll (unchanged)", () => {
    expect(parallaxY(200, 0, false)).toBeCloseTo(200);
    expect(parallaxY(200, 0.5, false)).toBeCloseTo(0);
    expect(parallaxY(200, 1, false)).toBeCloseTo(-200);
    expect(parallaxY(450, 0.25, false)).toBeCloseTo(225);
  });

  it("phone: uses 15% of the distance so stacked cards never collide", () => {
    expect(parallaxY(200, 0, true)).toBeCloseTo(30);
    expect(parallaxY(450, 1, true)).toBeCloseTo(-67.5);
  });

  it("the Buy card (parallax 0) never moves", () => {
    expect(parallaxY(0, 0.3, false)).toBeCloseTo(0);
    expect(parallaxY(0, 0.3, true)).toBeCloseTo(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/components/ServicesSection.test.ts`
Expected: FAIL — `parallaxY` is not a function / not exported.

- [ ] **Step 3: Implement**

1. Imports: add `useEffect` to the React import and `import { useIsMobile } from "@/hooks/useIsMobile";`. `useMotionValue`, `useTransform`, `useScroll` are already imported.

2. Below `BACKFACE_HIDDEN`, add:

```ts
// Phones stack the cards in one column, so the collage's large parallax
// distances would drag neighbouring cards into each other.
export const MOBILE_PARALLAX = 0.15;

// Same curve as useTransform(scrollYProgress, [0, 1], [p, -p]).
export function parallaxY(parallax: number, t: number, mobile: boolean): number {
  return (mobile ? parallax * MOBILE_PARALLAX : parallax) * (1 - 2 * t);
}
```

3. In `ServicesSection()`, replace the three lines `const y1 = …`, `const y2 = …`, `const y3 = …` with:

```ts
  const isMobile = useIsMobile();
  const mobileMV = useMotionValue(isMobile ? 1 : 0);
  useEffect(() => { mobileMV.set(isMobile ? 1 : 0); }, [isMobile, mobileMV]);
  const y1 = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => parallaxY(CARDS[1].parallax, t, m === 1));
  const y2 = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => parallaxY(CARDS[2].parallax, t, m === 1));
  const y3 = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => parallaxY(CARDS[3].parallax, t, m === 1));
```

(`y0` stays a static `useMotionValue(0)`.)

4. Layout classes (all appended; desktop strings unchanged):

- Section (line 282) className `"relative bg-[#F2F0EF]"` → `"relative bg-[#F2F0EF] max-lg:flex max-lg:!min-h-0 max-lg:flex-col max-lg:gap-8 max-lg:px-6 max-lg:py-16"`.
- Heading `motion.div` (line 285) `"absolute right-[8%] top-[14%] text-right"` → append `" max-lg:static max-lg:text-left"`.
- Heading line 1 span `"block text-[2.5rem] xl:text-[3rem]"` → append `" max-lg:text-[clamp(1.9rem,8vw,2.5rem)]"`.
- Heading line 2 span `"block text-[3.5rem] xl:text-[4.2rem] font-medium"` → append `" max-lg:text-[clamp(2.6rem,11vw,3.5rem)]"`.
- "Let's Start" button `"ml-auto mt-6 flex w-fit …"` → append `" max-lg:ml-0"`.
- `ServiceCard` outer `motion.div` (line 122) `"absolute"` → `"absolute max-lg:!static max-lg:mx-auto max-lg:!w-full max-lg:max-w-[400px]"`.
- Card (line 128) `"relative aspect-[3/4] w-full rounded-2xl"` → append `" max-lg:aspect-square"`.
- Custom cursor `motion.div` (line 223) `"pointer-events-none absolute z-50"` → append `" max-lg:hidden"`.
- "Let's Start" modal overlay (line 315) `"fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"` → append `" max-lg:px-4"`.
- Modal panel (line 318) `"relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"` → append `" max-lg:max-h-[90dvh] max-lg:overflow-y-auto max-lg:p-6"`.

- [ ] **Step 4: Run to verify it passes** — same command; Expected: 3 passed.
- [ ] **Step 5:** Suite, `tsc`, build. If `tsc` rejects `([t, m]: number[])`, use `(v: number[]) => parallaxY(CARDS[1].parallax, v[0], v[1] === 1)`.
- [ ] **Step 6: Commit** — `git add apps/web/src/components/home/ServicesSection.tsx apps/web/src/__tests__/components/ServicesSection.test.ts && git commit -m "feat: Services cards stack one per row on phones with gentler parallax"`
- [ ] **Step 7: Controller check** — desktop MEASURE `services` = baseline. Phones (7): OVERFLOW `services` = `[]`; four cards stacked (each card's top ≥ previous card's bottom − 40px parallax tolerance), each ≤ 400px wide; heading above the first card. At 390×844 click the Buy card: it flips and the back's description `p` has `scrollHeight <= clientHeight` (not cut off). No element with text "View" is visible after hovering a card.

---

### Task 5: "We create" headline + Advantage carousel

**Files:** Modify `TestimonialsIntro.tsx`, `AdvantageCarousel.tsx`. No unit test (classes only).

- [ ] **Step 1: Headline**

`TestimonialsIntro.tsx`:
- Sticky div `"sticky top-[32vh] z-0 px-4 text-center"` → append `" max-lg:top-[32svh]"`.
- `h2` className `"font-sans font-light text-[#1B1B1B]"` → append `" max-lg:!text-[clamp(2rem,9vw,2.8rem)]"` (overrides the inline `clamp(2.8rem, 5.5vw, 5rem)` on phones).
- The inline-grid `<span>` (has inline `fontSize: "clamp(3.5rem, 6.8vw, 6.2rem)"`) — add `className="max-lg:!text-[clamp(2.4rem,11vw,3.5rem)]"`.
- Carousel wrapper `"relative z-10 mt-[52vh] bg-[#F2F0EF] pb-20"` → append `" max-lg:mt-[52svh]"`.

- [ ] **Step 2: Carousel (upright phones only — sideways keeps the height cap)**

`AdvantageCarousel.tsx`:
- Outer sizing div `"relative mx-auto"` → `"relative mx-auto max-lg:portrait:!w-[90vw]"`.
- Aspect div `"relative w-full"` → `"relative w-full max-lg:portrait:!aspect-[1.1]"`.
- Slide text block `"absolute left-8 top-8 max-w-[70%]"` → append `" max-lg:left-5 max-lg:top-5 max-lg:max-w-[85%]"`.
- Arrow row `"mt-24 flex justify-center gap-6"` → append `" max-lg:mt-16"`.

- [ ] **Step 3:** Suite, `tsc`, build.
- [ ] **Step 4: Commit** — `git commit -m "feat: We-create headline and advantage carousel sized for phones"` (both files).
- [ ] **Step 5: Controller check** — desktop MEASURE `intro` = baseline. Phones (7): OVERFLOW `intro` = `[]`; the "We create" `h2` fits within the width (wraps allowed); upright phones: the front card is ~90% of viewport width; arrows' top ≥ the card stack's bottom (`max` of all slide rects' bottoms); at 844×390 the card stack plus arrows height ≤ viewport height + one scroll (arrows reachable).

---

### Task 6: Testimonial cards — single column

**Files:** Modify `TestimonialCards.tsx`. No unit test (classes only).

- [ ] **Step 1:** Outer div with inline `display: "flex", … alignItems: "flex-start"` — add `className="max-lg:flex-col max-lg:!items-stretch"`.
- [ ] **Step 2:** Left and right column divs `"flex flex-1 flex-col"` (inline `marginTop: "200px"`) → `"flex flex-1 flex-col max-lg:!mt-0"`. Center column unchanged.
- [ ] **Step 3:** The three photo `motion.div`s (inline `height: "420px"`) — add `className="max-lg:!h-[300px]"`.
- [ ] **Step 4:** The four quote boxes `"flex flex-col bg-white px-10 py-10"` / `"flex flex-col bg-[#1B1B1B] px-10 py-10"` → append `" max-lg:!h-auto max-lg:px-6"` to each (keeps `py-10`; height becomes the quote's natural height).
- [ ] **Step 5:** Suite, `tsc`, build.
- [ ] **Step 6: Commit** — `git commit -m "feat: testimonial cards stack in one column on phones"`.
- [ ] **Step 7: Controller check** — desktop MEASURE `cards` = baseline. Phones (7): OVERFLOW `cards` = `[]`; seven boxes stacked in one column, each full width; every quote box's `scrollHeight <= clientHeight + 1`; reading order photo → Kevin → Jessica → photo → Raymond → photo → Rachel.

---

### Task 7: Join CnC image — larger start, shorter scroll

**Files:**
- Modify: `JoinCnCCTA.tsx`
- Test: `apps/web/src/__tests__/components/JoinCnCCTA.test.ts`

**Interfaces:** Produces `export function ctaImageSize(t: number, mobile: boolean): { width: string; height: string }`. Consumes `useIsMobile()`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/__tests__/components/JoinCnCCTA.test.ts
import { describe, it, expect } from "vitest";
import { ctaImageSize } from "@/components/home/JoinCnCCTA";

const num = (s: string) => parseFloat(s);

describe("ctaImageSize", () => {
  // Desktop must equal the old useTransform(progress, [0.1, 0.88], ["52%","100%"] / ["42vh","65vh"]).
  it("desktop: 52%×42vh before the range, 100%×65vh after (clamped)", () => {
    expect(ctaImageSize(0, false)).toEqual({ width: "52%", height: "42vh" });
    expect(ctaImageSize(0.95, false)).toEqual({ width: "100%", height: "65vh" });
  });

  it("desktop: halfway through the range", () => {
    const s = ctaImageSize(0.49, false);
    expect(num(s.width)).toBeCloseTo(76);
    expect(s.width.endsWith("%")).toBe(true);
    expect(num(s.height)).toBeCloseTo(53.5);
    expect(s.height.endsWith("vh")).toBe(true);
  });

  it("phone: starts larger (80% × 30svh) and ends full (100% × 65svh)", () => {
    expect(ctaImageSize(0, true)).toEqual({ width: "80%", height: "30svh" });
    expect(ctaImageSize(1, true)).toEqual({ width: "100%", height: "65svh" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/components/JoinCnCCTA.test.ts`
Expected: FAIL — `ctaImageSize` not exported.

- [ ] **Step 3: Implement**

1. Imports become:

```ts
import { useEffect, useRef } from "react";
import { motion, useMotionValue, useScroll, useTransform } from "motion/react";
```
and add `import { useIsMobile } from "@/hooks/useIsMobile";`.

2. Above `export function JoinCnCCTA`, add:

```ts
// Image growth across the section's scroll. Desktop numbers are the original
// useTransform ranges; phones start larger (less to grow) and shorter (so the
// heading above stays readable before the image covers it).
export function ctaImageSize(t: number, mobile: boolean): { width: string; height: string } {
  const p = Math.min(1, Math.max(0, (t - 0.1) / 0.78));
  return mobile
    ? { width: `${80 + 20 * p}%`, height: `${30 + 35 * p}svh` }
    : { width: `${52 + 48 * p}%`, height: `${42 + 23 * p}vh` };
}
```

3. Replace the `imgWidth` and `imgHeight` lines with:

```ts
  const isMobile = useIsMobile();
  const mobileMV = useMotionValue(isMobile ? 1 : 0);
  useEffect(() => { mobileMV.set(isMobile ? 1 : 0); }, [isMobile, mobileMV]);
  const imgWidth = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => ctaImageSize(t, m === 1).width);
  const imgHeight = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => ctaImageSize(t, m === 1).height);
```

(`overlayOpacity` unchanged.)

4. Layout classes:
- Section className `"bg-[#F2F0EF]"` → `"bg-[#F2F0EF] max-lg:!h-[150svh]"`.
- Sticky div (inline `position/top/height`) — add `className="max-lg:!top-[35svh] max-lg:!h-[65svh]"`.
- `motion.h2` className `"font-sans text-[2.8rem] font-light leading-[1.3] xl:text-[3.5rem]"` → append `" max-lg:text-[clamp(1.5rem,min(7vw,9svh),2.8rem)]"`.
- The "Be the agent" span `"text-[2rem] xl:text-[2.5rem]"` → append `" max-lg:text-[clamp(1.2rem,min(5.5vw,7svh),2rem)]"`.
- "Be CnC" span `"block font-sans text-[3.5rem] font-light text-white xl:text-[4.2rem]"` → append `" max-lg:text-[clamp(2.4rem,11vw,3.5rem)]"`.

- [ ] **Step 4: Run to verify it passes** — Expected: 3 passed.
- [ ] **Step 5:** Suite, `tsc`, build (same `tsc` fallback as Task 4).
- [ ] **Step 6: Commit** — `git add apps/web/src/components/home/JoinCnCCTA.tsx apps/web/src/__tests__/components/JoinCnCCTA.test.ts && git commit -m "feat: Join CnC image expand starts larger and scrolls shorter on phones"`
- [ ] **Step 7: Controller check** — desktop MEASURE `joincta` = baseline (at mid-scroll). Phones (7): OVERFLOW `joincta` = `[]`; section height ≈ 1.5× viewport; at the section's start the heading's bottom ≤ the image's top (heading readable before being covered) at 390×844 and 844×390; at the end the image is full width and the "Join Now" link is visible.

---

### Task 8: Final verification (controller)

- [ ] **Step 1:** Suite + `tsc` pass.
- [ ] **Step 2:** Clean build; serve on 3100.
- [ ] **Step 3:** Desktop: every Task 1 MEASURE equals its baseline.
- [ ] **Step 4:** Phones: whole-page check on `/` at all 7 viewports — OVERFLOW on `document.body` = `[]` (clipped content excluded) and `document.documentElement.scrollWidth <= innerWidth + 1`.
- [ ] **Step 5:** Stop the 3100 server. Do not push.
