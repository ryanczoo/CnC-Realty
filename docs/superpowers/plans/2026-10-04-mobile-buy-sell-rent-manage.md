# Mobile Layout — Sub-project 3 (Buy, Sell, Rent, Manage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phone/upright-iPad layouts for Buy steps, Buy "Why Choose → RESULTS", Sell "Our Process" (swipeable cards), Sell "Our Values", Rent "Moving made, Easy" and Rent "Popular Cities" — desktop unchanged, mobile load cost unchanged.

**Architecture:** Phone-only `max-lg:` classes (incl. `max-lg:!…` overrides of inline styles, `max-lg:portrait:`/`landscape:` where orientation matters). The Buy photo cluster's fly-in math moves into an exported pure function `clusterGeometry(portraitPhone)`, fed through a motion value (pattern from sub-projects 1–2); its desktop numbers are pinned by a unit test. "Our Process" reuses the `StatCards` swipe-row pattern. Image `sizes` gain a phone-first condition only where the phone box grows.

**Tech Stack:** Next.js 14, Tailwind 3.4.19, `motion` 12.38, Vitest (node env).

**Spec:** `docs/superpowers/specs/2026-10-04-mobile-buy-sell-rent-manage-design.md` (parent: `docs/superpowers/specs/2026-10-03-mobile-layout-design.md`)

## Global Constraints

- **Desktop never edited:** only `max-lg:` classes (incl. `!` overrides) and `useIsMobile()`/orientation-driven motion values; `sizes` changes add a `(max-width: 1023px)` condition first so desktop resolves to its original value.
- **Phone layout below 1024px**, fluid 320–1023px, sideways phones fit, phone heights `svh` where not tied to JS `innerHeight` math.
- **No new components, libraries, images, videos, or requests.** Swipe row = `StatCards` pattern.
- **Load speed:** each page's first-load JS and total transfer (desktop 1440×900 and phone 390×844) within ~2% of the Task 1 baseline.
- **Every task ends with** `pnpm --filter web test`, `pnpm --filter web exec tsc --noEmit`, clean build (no dev server running; stop the controller's own 3100 server before deleting `.next`). Commit per task. No pushing.
- **Browser checks are the controller's** (Puppeteer, production build on port 3100, same-origin iframes loaded from `/press`).

## Review Focus

1. **Desktop drift** in any of the six sections — identical boxes at 1440×900 vs baseline (transforms neutralized). Every task.
2. **Sideways phone (844×390) on Buy RESULTS** — desktop positions kept (no portrait overrides), images inside the screen, WHY CHOOSE readable. Task 3.
3. **Swiping every "Our Process" card** at 320, 390 and 844×390 — each card snaps fully into view with its text and photos uncut; the "Start" button on the last text card opens the contact pop-up. Task 4.
4. **Rent at 390px no longer overflows** (it laid out 585px wide). Task 6.
5. **Load cost** — no page's JS or transfer grows beyond ~2% at desktop or phone size. Task 7.

---

## File Structure

| File | Change |
|---|---|
| `apps/web/src/components/buy/BuySteps.tsx` | left-edge timeline, image-first stacked rows |
| `apps/web/src/components/buy/BuyContemporary.tsx` | export `clusterGeometry`; portrait-phone positions; no lines on phones; phone `sizes`; shorter scroll |
| `apps/web/src/__tests__/components/BuyContemporary.test.ts` | pins `clusterGeometry` |
| `apps/web/src/components/sell/SellProcess.tsx` | phone swipe row; phone `sizes` |
| `apps/web/src/components/sell/SellValues.tsx` | shorter phone scroll; title/label sizes |
| `apps/web/src/components/rent/RentSteps.tsx` | stacked title + list |
| `apps/web/src/components/rent/RentCitiesSlider.tsx` | wider upright-phone card; scaled label; phone `sizes` |

## Controller toolkit

Same as the homepage plan, with these ROOTS (in iframe document `d`):

```js
const byText = (sel, t) => [...d.querySelectorAll(sel)].find((e) => e.textContent.replace(/\s+/g, "").includes(t));
const ROOTS = {
  buysteps: () => byText("section", "Pre-Approved"),          // /buy
  contemporary: () => byText("section", "RESULTS"),           // /buy  — scroll to offsetTop + 10
  sellprocess: () => byText("section", "starttoclose"),       // /sell — scroll to offsetTop + 10
  sellvalues: () => byText("section", "OurValues"),           // /sell — scroll to offsetTop + 2*innerHeight
  rentsteps: () => byText("section", "Movingmade"),           // /rent
  rentcities: () => byText("section", "PopularCities"),       // /rent
};
```

MEASURE (transforms neutralized), OVERFLOW (clipped content excluded) as in the homepage plan.

**WEIGHT(path, W, H)** — first-load cost in an iframe:

```js
const weight = async (p, W, H) => { const f = await frame(p, W, H); await wait(4000);
  const res = f.contentWindow.performance.getEntriesByType("resource"); const nav = f.contentWindow.performance.getEntriesByType("navigation")[0];
  const size = (r) => r.transferSize || r.encodedBodySize || 0;
  return { totalKB: Math.round((res.reduce((a, r) => a + size(r), 0) + (nav.transferSize || 0)) / 1024),
           jsKB: Math.round(res.filter((r) => r.name.endsWith(".js")).reduce((a, r) => a + size(r), 0) / 1024),
           requests: res.length }; };
```

(Run each WEIGHT twice and keep the second, warm-server reading.)

---

### Task 1: Baselines (controller only)

- [ ] **Step 1:** Tree clean under `apps/web/src`; record `BASELINE_SHA`.
- [ ] **Step 2:** Build + serve on 3100.
- [ ] **Step 3:** Desktop 1440×900 MEASURE of all six ROOTS (twice; identical). Save to ledger workspace `baseline.txt`.
- [ ] **Step 4:** WEIGHT of `/buy`, `/sell`, `/rent`, `/manage` at 1440×900 and at 390×844. Save to `baseline.txt`.

---

### Task 2: Buy steps — left-edge timeline, stacked rows

**Files:** Modify `BuySteps.tsx`. No unit test (classes only).

- [ ] **Step 1:** `StepImage` motion.div className `"relative overflow-hidden rounded-2xl"` → append `" max-lg:!h-[220px]"` (overrides inline `height: "340px"` on phones). `sizes` already `(max-width: 1024px) 100vw, 45vw` — unchanged.
- [ ] **Step 2:** `StepText` inner div className — replace with:

```tsx
className={`relative flex flex-col gap-20 max-lg:items-start max-lg:gap-5 max-lg:text-left ${align === "right" ? "items-end text-right" : "items-start text-left"}`}
```

(Desktop classes unchanged; phone classes added. Because the `items-end text-right` variant comes from a conditional, the `max-lg:` overrides are listed explicitly so phones are always left-aligned.)

- [ ] **Step 3:** Timeline line div `"absolute inset-y-0 left-1/2 flex w-[2px] -translate-x-1/2 flex-col gap-4"` → append `" max-lg:left-0 max-lg:translate-x-0"`.
- [ ] **Step 4:** Step row `"relative flex items-center py-16"` → `"relative flex items-center py-16 max-lg:flex-col max-lg:items-stretch max-lg:gap-6 max-lg:py-10 max-lg:pl-8"`.
- [ ] **Step 5:** Left content div `"flex-1 pr-12"` → `` {`flex-1 pr-12 max-lg:pr-0 ${imageLeft ? "" : "max-lg:order-2"}`} `` (text-first desktop rows put the text after the image on phones). Centre spacer `"w-16 flex-shrink-0"` → `"w-16 flex-shrink-0 max-lg:hidden"`. Right content div `"flex-1 pl-12"` → `"flex-1 pl-12 max-lg:pl-0"`.
- [ ] **Step 6:** Suite, `tsc`, build. **Commit** `feat: Buy steps stack beside a left-edge timeline on phones`.
- [ ] **Step 7 (controller, with Task 3's build):** desktop MEASURE `buysteps` = baseline. Phones (7): OVERFLOW = `[]`; in each row the image's top < the text's top (image first); text `left` ≥ line's right + 16px; scroll through and confirm the four line segments fill (last segment's inner height reaches 100% by the section end).

---

### Task 3: Buy "Why Choose → RESULTS" — portrait-phone positions

**Files:**
- Modify: `BuyContemporary.tsx`
- Test: `apps/web/src/__tests__/components/BuyContemporary.test.ts`

**Interfaces:** Produces `export function clusterGeometry(portraitPhone: boolean): Record<"ctr" | "lft" | "rgt" | "bck", { dx: number; dy: number; scale: number }>` (dx/dy as viewport fractions). Consumes `useIsMobile()`.

- [ ] **Step 1: Failing test**

```ts
// apps/web/src/__tests__/components/BuyContemporary.test.ts
import { describe, it, expect } from "vitest";
import { clusterGeometry } from "@/components/buy/BuyContemporary";

describe("clusterGeometry", () => {
  // Desktop must equal the original (K - C) offsets and SC scale ratios.
  it("desktop: unchanged offsets and scales", () => {
    const g = clusterGeometry(false);
    expect(g.ctr.dx).toBeCloseTo(0.3905, 4);   expect(g.ctr.dy).toBeCloseTo(0.1875, 4);   expect(g.ctr.scale).toBeCloseTo(1.42237, 4);
    expect(g.lft.dx).toBeCloseTo(0.2010, 4);   expect(g.lft.dy).toBeCloseTo(-0.32785, 4); expect(g.lft.scale).toBeCloseTo(1.10171, 4);
    expect(g.rgt.dx).toBeCloseTo(-0.13409, 4); expect(g.rgt.dy).toBeCloseTo(0.21215, 4);  expect(g.rgt.scale).toBeCloseTo(0.97711, 4);
    expect(g.bck.dx).toBeCloseTo(-0.3694, 4);  expect(g.bck.dy).toBeCloseTo(-0.29, 4);    expect(g.bck.scale).toBeCloseTo(1.31255, 4);
  });

  it("portrait phone: two-by-two corners gathering into a larger centred cluster", () => {
    const g = clusterGeometry(true);
    expect(g.ctr).toEqual({ dx: expect.closeTo(0.23, 4), dy: expect.closeTo(0.3, 4), scale: expect.closeTo(1.55, 4) });
    expect(g.lft).toEqual({ dx: expect.closeTo(0.03, 4), dy: expect.closeTo(-0.27, 4), scale: expect.closeTo(1.1, 4) });
    expect(g.rgt).toEqual({ dx: expect.closeTo(-0.03, 4), dy: expect.closeTo(0.23, 4), scale: expect.closeTo(1.1, 4) });
    expect(g.bck).toEqual({ dx: expect.closeTo(-0.23, 4), dy: expect.closeTo(-0.32, 4), scale: expect.closeTo(1.55, 4) });
  });
});
```

- [ ] **Step 2:** Run `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/components/BuyContemporary.test.ts` — Expected FAIL (`clusterGeometry` not exported).

- [ ] **Step 3: Implement**

1. Imports: `import { useRef, useEffect } from "react";` → `import { useRef, useEffect } from "react";` stays; change the motion import to `import { motion, useMotionValue, useScroll, useTransform } from "motion/react";` and add `import { useIsMobile } from "@/hooks/useIsMobile";`.

2. After the `SC` constant, add:

```ts
// Upright phones: corners two-by-two around "WHY CHOOSE CnC", images taller
// than wide like on desktop; cluster larger and centred for a narrow screen.
// Static corner boxes are set by the max-lg:portrait:! classes below and must
// match these cx/cy/w/h values.
const C_PHONE = {
  topLeft:  { cx: 0.27, cy: 0.20, w: 0.40, h: 0.22 },
  topRight: { cx: 0.73, cy: 0.26, w: 0.40, h: 0.22 },
  btmLeft:  { cx: 0.27, cy: 0.76, w: 0.40, h: 0.22 },
  btmRight: { cx: 0.73, cy: 0.82, w: 0.40, h: 0.22 },
};
const K_PHONE = { center: { cx: 0.5, cy: 0.5 }, left: { cx: 0.30, cy: 0.49 }, right: { cx: 0.70, cy: 0.49 } };
const CW_PHONE = { center: 0.62, left: 0.44, right: 0.44 };

type Move = { dx: number; dy: number; scale: number };

// Fly-in geometry: how far (as viewport fractions) and how much each image
// grows from its corner to its cluster spot. Desktop values are the original
// (K - C) offsets and SC ratios.
export function clusterGeometry(portraitPhone: boolean): Record<"ctr" | "lft" | "rgt" | "bck", Move> {
  if (!portraitPhone) {
    return {
      ctr: { dx: K.center.cx - C.topLeft.cx, dy: K.center.cy - C.topLeft.cy, scale: SC.center },
      lft: { dx: K.left.cx - C.btmLeft.cx, dy: K.left.cy - C.btmLeft.cy, scale: SC.left },
      rgt: { dx: K.right.cx - C.topRight.cx, dy: K.right.cy - C.topRight.cy, scale: SC.right },
      bck: { dx: K.center.cx - C.btmRight.cx, dy: K.center.cy - C.btmRight.cy, scale: SC.back },
    };
  }
  return {
    ctr: { dx: K_PHONE.center.cx - C_PHONE.topLeft.cx, dy: K_PHONE.center.cy - C_PHONE.topLeft.cy, scale: CW_PHONE.center / C_PHONE.topLeft.w },
    lft: { dx: K_PHONE.left.cx - C_PHONE.btmLeft.cx, dy: K_PHONE.left.cy - C_PHONE.btmLeft.cy, scale: CW_PHONE.left / C_PHONE.btmLeft.w },
    rgt: { dx: K_PHONE.right.cx - C_PHONE.topRight.cx, dy: K_PHONE.right.cy - C_PHONE.topRight.cy, scale: CW_PHONE.right / C_PHONE.topRight.w },
    bck: { dx: K_PHONE.center.cx - C_PHONE.btmRight.cx, dy: K_PHONE.center.cy - C_PHONE.btmRight.cy, scale: CW_PHONE.center / C_PHONE.btmRight.w },
  };
}
```

3. In `BuyContemporary()`, after the `vwRef`/`vhRef` declarations add:

```ts
  // 1 on upright phones/iPads (matches the max-lg:portrait: CSS), 0 otherwise.
  const isMobile = useIsMobile();
  const portraitMV = useMotionValue(0);
```

and replace the existing resize `useEffect` with:

```ts
  useEffect(() => {
    const onResize = () => {
      vwRef.current = window.innerWidth;
      vhRef.current = window.innerHeight;
      portraitMV.set(isMobile && window.innerHeight >= window.innerWidth ? 1 : 0);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMobile, portraitMV]);
```

4. Replace the eleven position/scale transforms (`ctrX`, `ctrY`, `ctrSc`, `lftX`, `lftY`, `lftSc`, `rgtX`, `rgtY`, `rgtSc`, `bckX`, `bckY`, `bckSc` — keep `lftRot`, `rgtRot` and everything below unchanged) with:

```ts
  const geo = (m: number) => clusterGeometry(m === 1);
  const ctrX  = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 0, geo(m).ctr.dx * vwRef.current));
  const ctrY  = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 0, geo(m).ctr.dy * vhRef.current));
  const ctrSc = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 1, geo(m).ctr.scale));
  const lftX  = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 0, geo(m).lft.dx * vwRef.current));
  const lftY  = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 0, geo(m).lft.dy * vhRef.current));
  const lftSc = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 1, geo(m).lft.scale));
  const rgtX  = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 0, geo(m).rgt.dx * vwRef.current));
  const rgtY  = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 0, geo(m).rgt.dy * vhRef.current));
  const rgtSc = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 1, geo(m).rgt.scale));
  const bckX  = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 0, geo(m).bck.dx * vwRef.current));
  const bckY  = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 0, geo(m).bck.dy * vhRef.current));
  const bckSc = useTransform([scrollYProgress, portraitMV], ([p, m]: number[]) => ramp(p, 0.45, 0.70, 1, geo(m).bck.scale));
```

5. Layout classes (desktop untouched; corner boxes match `C_PHONE`: left = cx−w/2, top = cy−h/2):
- Section `"bg-[#1B1B1B]"` → `"bg-[#1B1B1B] max-lg:portrait:!h-[300svh]"`.
- Lines `motion.svg` className → append `" max-lg:portrait:hidden"`.
- Centre image `motion.div` (`POS_TOP_LEFT`) — add `className="max-lg:portrait:!left-[7vw] max-lg:portrait:!top-[9vh] max-lg:portrait:!h-[22vh] max-lg:portrait:!w-[40vw]"`; its Image `sizes="25vw"` → `sizes="(max-width: 1023px) 62vw, 25vw"`.
- Right image (`POS_TOP_RIGHT`) — `className="max-lg:portrait:!left-[53vw] max-lg:portrait:!top-[15vh] max-lg:portrait:!h-[22vh] max-lg:portrait:!w-[40vw]"`; `sizes` → `"(max-width: 1023px) 44vw, 18vw"`.
- Left image (`POS_BTM_LEFT`) — `className="max-lg:portrait:!left-[7vw] max-lg:portrait:!top-[65vh] max-lg:portrait:!h-[22vh] max-lg:portrait:!w-[40vw]"`; `sizes` → `"(max-width: 1023px) 44vw, 18vw"`.
- Back image (`POS_BTM_RIGHT`) — `className="max-lg:portrait:!left-[53vw] max-lg:portrait:!top-[71vh] max-lg:portrait:!h-[22vh] max-lg:portrait:!w-[40vw]"`; `sizes` → `"(max-width: 1023px) 62vw, 18vw"`.
- WHY paragraph `"mt-10 max-w-md font-sans font-light leading-relaxed text-white/60"` → append `" max-lg:mt-4 max-lg:px-8"`.
- WHY h2 (inline `clamp(2.5rem, 6vw, 7rem)`) — add `max-lg:landscape:!text-[clamp(1.6rem,9svh,2.5rem)]` to its className.

- [ ] **Step 4:** Run the test — Expected 2 passed.
- [ ] **Step 5:** Suite, `tsc` (fallback `(v: number[]) => …` if the tuple annotation is rejected), build. **Commit** `feat: Buy RESULTS cluster uses portrait-phone positions on upright phones`.
- [ ] **Step 6 (controller):** desktop MEASURE `contemporary` = baseline. Upright phones (6): at section start the four images are inside the screen, two-by-two (top pair above WHY text, bottom pair below); at the section's 70% scroll point the images overlap around the centre (cluster) and RESULTS is visible; no lines element displayed; OVERFLOW = `[]`. 844×390: lines visible, images at desktop fractions inside the screen, WHY h2 + paragraph inside the screen.

---

### Task 4: Sell "Our Process" — swipeable cards

**Files:** Modify `SellProcess.tsx`. No unit test (classes only).

Swipe-row pattern from `components/agents/StatCards.tsx`: row `overflow-x-auto [scroll-snap-type:x_mandatory]` + hidden scrollbar; cards `flex-shrink-0 [scroll-snap-align:start]`.

- [ ] **Step 1: Stop pinning on phones**
- Section `"relative bg-[#1B1B1B]"` → append `" max-lg:!h-auto max-lg:pb-16"`.
- Sticky div `"sticky top-0 h-screen overflow-hidden"` → append `" max-lg:static max-lg:h-auto max-lg:overflow-visible"`.
- Progress bar div `"absolute left-16 right-16 top-[5.25rem] z-20 flex gap-1"` → append `" max-lg:hidden"`.
- Title div `"absolute left-16 top-[6.25rem] z-20"` → append `" max-lg:static max-lg:px-6 max-lg:pb-6 max-lg:pt-24"`.

- [ ] **Step 2: Swipe row**

Row `motion.div` `"flex h-full"` → `"flex h-full max-lg:h-[75svh] max-lg:gap-3 max-lg:overflow-x-auto max-lg:px-6 max-lg:!transform-none max-lg:!w-auto max-lg:[scroll-snap-type:x_mandatory] max-lg:[scrollbar-width:none]"`.

- [ ] **Step 3: Cards** (each panel: phone width 85vw, no shrink, snap start)
- Intro panel `"flex h-full flex-col items-start justify-center px-16 lg:px-28"` → append `" max-lg:!w-[85vw] max-lg:shrink-0 max-lg:px-2 max-lg:[scroll-snap-align:start]"`; its h2 `"mb-6 max-w-2xl font-sans text-[3rem] font-light leading-tight text-white lg:text-[4.5rem]"` → append `" max-lg:text-[clamp(2rem,8vw,3rem)]"`.
- Photo panel `"relative h-full overflow-hidden"` → append `" max-lg:!w-[85vw] max-lg:shrink-0 max-lg:rounded-2xl max-lg:[scroll-snap-align:start]"`; Image `` sizes={`${PHOTO_VW}vw`} `` → `` sizes={`(max-width: 1023px) 85vw, ${PHOTO_VW}vw`} ``.
- Text panel `"relative flex h-full items-center"` → append `" max-lg:!w-[85vw] max-lg:shrink-0 max-lg:[scroll-snap-align:start]"`; inner `"relative z-10 px-16 lg:px-28"` → append `" max-lg:px-2"`; `"mb-10"` → `"mb-10 max-lg:mb-4"`; h3 → append `" max-lg:text-[clamp(2rem,8vw,2.8rem)]"`; both CTA classNames `"mt-20 inline-flex …"` → append `" max-lg:mt-8"`.
- `SlidePanel` outer `"relative flex h-full items-center justify-center"` → append `" max-lg:!w-[85vw] max-lg:shrink-0 max-lg:[scroll-snap-align:start]"`. Inner box (inline 30.8vw × 34.6vw + shift) — add `className="relative max-lg:portrait:!h-[64vw] max-lg:portrait:!w-[57vw] max-lg:portrait:!transform-none"` (replacing its current `className="relative"`). Top photo box `"relative overflow-hidden rounded-2xl"` → append `" max-lg:portrait:!h-[43vw] max-lg:portrait:!w-[35vw]"`; its `sizes="18.8vw"` → `"(max-width: 1023px) 35vw, 18.8vw"`. Bottom photo box `"absolute overflow-hidden rounded-2xl"` → append `" max-lg:portrait:!left-[30vw] max-lg:portrait:!top-[30vw] max-lg:portrait:!h-[34vw] max-lg:portrait:!w-[27vw]"`; `sizes="14.8vw"` → `"(max-width: 1023px) 27vw, 14.8vw"`.

(Sideways phones keep the desktop slide proportions — `34.6vw` of an 844px-wide screen ≈ the 292px card height.)

- [ ] **Step 4:** Suite, `tsc`, build. **Commit** `feat: Sell Our Process becomes swipeable cards on phones`.
- [ ] **Step 5 (controller, with Task 5's build):** desktop MEASURE `sellprocess` = baseline. Phones (7): section not pinned (height < 2× viewport); OVERFLOW on the section with the row excluded (the row itself scrolls horizontally by design) = `[]`; for every card in the row: `row.scrollTo({left: card.offsetLeft - 24})`, wait, then the card's rect is fully inside the screen horizontally, and every descendant text element has `scrollHeight <= clientHeight + 1` and bottom ≤ card bottom; on the last text card, clicking "Start" shows the contact pop-up.

---

### Task 5: Sell "Our Values" — shorter scroll, sized title

**Files:** Modify `SellValues.tsx`. No unit test (classes only; card math already pinned by `SellValues.test.ts`).

- [ ] **Step 1:** Section (inline `height: "500vh"`) `className="relative"` → `"relative max-lg:!h-[300svh]"`.
- [ ] **Step 2:** Title wrapper `"absolute inset-x-0 top-40 flex justify-center"` → append `" max-lg:top-24"`; h2 `"font-sans text-[3.5rem] font-light xl:text-[4.5rem]"` → append `" max-lg:text-[clamp(2.2rem,9vw,3.5rem)]"`; its "Our " span `"text-[2.6rem] xl:text-[3.4rem]"` → append `" max-lg:text-[clamp(1.7rem,7vw,2.6rem)]"`.
- [ ] **Step 3:** Card label `"px-4 text-center font-sans text-[2.2rem] font-light leading-tight text-white lg:text-[2.6rem]"` → append `" max-lg:px-2 max-lg:text-[1.3rem]"`.
- [ ] **Step 4:** Suite, `tsc`, build. **Commit** `feat: Sell Our Values scrolls shorter with fitted titles on phones`.
- [ ] **Step 6 (controller):** desktop MEASURE `sellvalues` = baseline. Phones (7): section ≈ 3× viewport; at start, middle, end of its scroll the title is inside the screen and the centred card's label fits inside the card (no label wider than its card); the active (centre) card changes from "Respect" to "Integrity" across the scroll.

---

### Task 6: Rent steps + Popular Cities

**Files:** Modify `RentSteps.tsx`, `RentCitiesSlider.tsx`. No unit test (classes only).

- [ ] **Step 1: RentSteps**
- Section `"bg-cnc-bg px-[75px] py-28"` → append `" max-lg:px-6 max-lg:py-16"`.
- Row `"flex gap-10"` → `"flex gap-10 max-lg:flex-col"`.
- Left column `"flex flex-1 flex-col gap-8 sticky top-28 self-start"` → append `" max-lg:static"`.
- `"block pl-[7.5rem]"` → append `" max-lg:pl-[3.5rem]"`; Search wrapper `"ml-[7.5rem] w-fit"` → append `" max-lg:ml-[3.5rem]"`.
- List column `"shrink-0 basis-[57%]"` → append `" max-lg:basis-auto"`.
- Step row `"flex items-center gap-10 border-t border-[#1B1B1B]/[0.07] py-6"` → append `" max-lg:gap-5"`; step title `"text-[2.1rem] text-[#1B1B1B]"` → append `" max-lg:text-[clamp(1.5rem,6.5vw,2.1rem)]"`.

- [ ] **Step 2: RentCitiesSlider**
- Card wrapper (inline `width: "65vw", maxWidth: 900`) `className="relative mx-auto"` → `"relative mx-auto max-lg:portrait:!w-[84vw]"`.
- 16:9 box (inline `paddingTop: "calc(65vw * 9 / 16)"`) `className="relative w-full"` → `"relative w-full max-lg:portrait:!pt-[calc(84vw*9/16)]"`.
- City label `"font-sans font-light text-white text-[4.4rem] xl:text-[5.2rem]"` → append `" max-lg:text-[clamp(2rem,9vw,4.4rem)]"`.
- Image `sizes="(max-width: 900px) 65vw, 900px"` → `"(max-width: 1023px) 84vw, 900px"`. (Desktop ≥1024px still resolves to `900px`, as before — the old 900px condition never applied at ≥1024px.)

- [ ] **Step 3:** Suite, `tsc`, build. **Commit** `feat: Rent steps stack and Popular Cities card widens on phones`.
- [ ] **Step 4 (controller):** desktop MEASURE `rentsteps`, `rentcities` = baselines. Phones (7): `/rent` `scrollWidth == innerWidth` (was 585 at 390); OVERFLOW both = `[]`; title above the list; the active city card inside the screen with its label inside the card; tapping the next arrow changes the active city.

---

### Task 7: Final verification (controller)

- [ ] **Step 1:** Suite + `tsc`; clean build; serve 3100.
- [ ] **Step 2:** Desktop MEASURE all six = baselines.
- [ ] **Step 3:** Phones (7) for `/buy`, `/sell`, `/rent`, `/manage`: `scrollWidth == innerWidth`; OVERFLOW on `document.body` (excluding the "Our Process" row) = `[]` — this also re-checks the no-change sections.
- [ ] **Step 4:** WEIGHT for the four pages at 1440×900 and 390×844; each within ~2% of baseline (totalKB, jsKB); report the numbers.
- [ ] **Step 5:** Stop 3100. Do not push.
