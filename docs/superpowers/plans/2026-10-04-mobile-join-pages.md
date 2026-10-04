# Mobile Layout — Sub-project 4 (Join Pages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phone/upright-iPad layouts for the Join hero, AgentPlan, WhyCnCStacked, JoinSteps, HowToJoin, the application form and the "You're IN" page (incl. lighter confetti) — desktop unchanged, load cost unchanged.

**Architecture:** Phone-only `max-lg:` classes (incl. `!` overrides of inline styles, `portrait`/`landscape`, and `max-sm:` for the form). Two pure functions carry numbers that differ on phones, desktop values pinned by tests: `stackGeometry` (stacked-card slide distance) and `confettiCanvasSize`. The Join hero's phone layer reuses `phoneWordLayout` and the (newly exported) `PHONE_TEXT_SIZE` from `VideoMaskHero`.

**Tech Stack:** Next.js 14, Tailwind 3.4.19, `motion` 12.38, Vitest (node env).

**Spec:** `docs/superpowers/specs/2026-10-04-mobile-join-pages-design.md` (parent: `docs/superpowers/specs/2026-10-03-mobile-layout-design.md`)

## Global Constraints

- **Desktop never edited:** only `max-lg:`/`max-sm:` classes (incl. `!`), phone-only JS paths whose desktop values are pinned by tests, and a no-behaviour `export` added to `VideoMaskHero`'s existing constant.
- **Phone layout below 1024px** (form rows: below 640px); fluid 320–1023px; sideways phones incl. short Safari heights.
- **No new components, libraries, images, videos, requests.**
- **Load:** first-load JS within ~2% per page (desktop + phone); totals compared with hero-video noise excluded.
- **Every task ends with** suite, `tsc`, clean build (no dev server; stop the controller's 3100 server first). Commit per task; no push.
- **Browser checks are the controller's** (Puppeteer, production build on 3100, same-origin iframes from `/press`).

## Review Focus

1. **Desktop drift** in any changed section — identical boxes at 1440×900 vs baseline.
2. **Stacked cards end state on short screens** — at the end of the stacking scroll, card 3's bottom ≤ viewport height at 320×568, 390×844, 844×390, 844×340, 667×320; card text not cut at 320×568.
3. **JoinSteps on an upright phone** — while each photo is on screen, the pinned text shows that photo's step; the pinned panel never covers more than ~45% of the screen at 320×568.
4. **Application form at 320px** — every field ≥ 240px wide, nothing overflows, labels readable.
5. **Confetti** — desktop canvas stays 1280×720; phones 640×360.

---

## File Structure

| File | Change |
|---|---|
| `components/ui/VideoMaskHero.tsx` | `export` the existing `PHONE_TEXT_SIZE` (no behaviour change) |
| `components/join/JoinHero.tsx` | phone lettering layer |
| `components/join/AgentPlan.tsx` | stacked heading / photo / full-width card |
| `components/join/WhyCnCStacked.tsx` | export `stackGeometry`; phone offsets/heights; photo-behind-text cards on upright phones |
| `__tests__/components/WhyCnCStacked.test.ts` | pins `stackGeometry` |
| `components/join/JoinSteps.tsx` | pinned text above photos on upright phones |
| `components/join/HowToJoin.tsx` | one column |
| `components/join/ApplicationForm.tsx` | `max-sm:grid-cols-1` on 7 field rows |
| `app/(marketing)/join/apply/submitted/page.tsx` | heading offset |
| `components/join/ConfettiCannonInner.tsx` | export `confettiCanvasSize`; phone half resolution |
| `__tests__/components/ConfettiCannonInner.test.ts` | pins `confettiCanvasSize` |

(All paths under `apps/web/src/`.)

## Controller toolkit

As sub-project 3 (MEASURE with transforms neutralised, OVERFLOW excluding clipped content, WEIGHT, iframe `frame()`), with ROOTS:

```js
const byText = (sel, t) => [...d.querySelectorAll(sel)].find((e) => e.textContent.replace(/\s+/g, "").includes(t));
const ROOTS = {
  joinhero: () => d.querySelector("main section, section"),               // /join
  agentplan: () => byText("section", "ForAgents"),                         // /join
  stacked: () => byText("section", "DaretoDream"),                         // /join — scroll to offsetTop + 10
  joinsteps: () => byText("section", "TransactionManagement"),             // /join — scroll to offsetTop + 10
  howtojoin: () => byText("section", "Howto"),                             // /join
  form: () => d.querySelector("form"),                                     // /join/apply
  submitted: () => d.querySelector("main"),                                // /join/apply/submitted
};
```

Phone viewports: 320×568, 344×882, 375×667, 390×844, 430×932, 820×1180, 844×390, plus **844×340 and 667×320** (sideways with Safari's bar).

---

### Task 1: Baselines (controller)

- [ ] Tree clean; record `BASELINE_SHA`; build + serve 3100.
- [ ] Desktop 1440×900 MEASURE all seven ROOTS, twice, identical → `baseline.txt`.
- [ ] WEIGHT `/join`, `/join/apply`, `/join/apply/submitted` at 1440×900 and 390×844 → `baseline.txt`.

---

### Task 2: Join hero phone lettering

**Files:** `components/ui/VideoMaskHero.tsx`, `components/join/JoinHero.tsx`. No new unit test (`phoneWordLayout` already tested; this task is markup).

- [ ] **Step 1:** In `VideoMaskHero.tsx` change `const PHONE_TEXT_SIZE = "180";` to `export const PHONE_TEXT_SIZE = "180";` (nothing else).
- [ ] **Step 2:** `JoinHero.tsx` imports: add `import { phoneWordLayout, PHONE_TEXT_SIZE } from "@/components/ui/VideoMaskHero";`.
- [ ] **Step 3:** Section className `"relative h-[95vh] overflow-hidden bg-black"` → append `" max-lg:h-[95svh]"`. Desktop `<svg>` className `"absolute inset-0 h-full w-full"` → append `" max-lg:portrait:hidden"`.
- [ ] **Step 4:** After the desktop `</svg>`, add:

```tsx
      <svg
        className="absolute inset-0 hidden h-full w-full max-lg:portrait:block"
        viewBox="0 0 1080 1920"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="be-cnc-mask-mobile">
            <rect width="1080" height="1920" fill="white" />
            <motion.g initial="hidden" animate="visible" variants={container}>
              {phoneWordLayout(["Be", "CnC"]).map(({ word, y }, i) => (
                <motion.text
                  key={`${word}-${i}`}
                  x="540"
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={PHONE_TEXT_SIZE}
                  fill="black"
                  style={TEXT_STYLE}
                  variants={WORD_VARIANT}
                >
                  {word}
                </motion.text>
              ))}
            </motion.g>
          </mask>
        </defs>
        <rect width="1080" height="1920" fill="black" fillOpacity="0.72" mask="url(#be-cnc-mask-mobile)" />
      </svg>
```

- [ ] **Step 5:** Suite, `tsc`, build. Commit `feat: Join hero phone lettering layer (reuses phoneWordLayout)`.
- [ ] **Step 6 (controller, with Task 3's build):** desktop MEASURE `joinhero` = baseline. Upright phones: phone svg shown, desktop svg hidden, both words inside the section edges, height ≈ 95%. 844×390: desktop lettering inside the section.

---

### Task 3: AgentPlan — stacked

**Files:** `components/join/AgentPlan.tsx`. Classes only.

- [ ] Container `"mx-auto flex max-w-7xl gap-20"` → append `" max-lg:flex-col max-lg:gap-10"`.
- [ ] Sticky wrapper `"sticky top-28"` → append `" max-lg:static"`.
- [ ] `"block -ml-[4rem] text-[2.5rem] xl:-ml-[4.8rem] xl:text-[3rem]"` → append `" max-lg:ml-0 max-lg:text-[clamp(1.9rem,8vw,2.5rem)]"`.
- [ ] `"block text-[3.5rem] font-medium xl:text-[4.2rem]"` → append `" max-lg:text-[clamp(2.6rem,11vw,3.5rem)]"`.
- [ ] Photo wrapper `"mt-8 w-[80%] overflow-hidden rounded-2xl"` → append `" max-lg:w-full"`.
- [ ] Plan card `"mr-24 w-[420px] flex-shrink-0 rounded-2xl bg-white p-10 shadow-[0_4px_32px_rgba(0,0,0,0.07)]"` → append `" max-lg:mr-0 max-lg:w-full max-lg:p-6"`.
- [ ] Suite, `tsc`. Commit `feat: Join pricing stacks with a full-width plan card on phones`.
- [ ] **Controller (shared build with Task 2):** desktop MEASURE `agentplan` = baseline; phones: OVERFLOW `agentplan` = `[]`, card full width (≥ 85% of viewport minus padding), heading above photo above card.

---

### Task 4: WhyCnCStacked — phone geometry and photo-behind-text cards

**Files:** `components/join/WhyCnCStacked.tsx`; Test `__tests__/components/WhyCnCStacked.test.ts`.

**Interfaces:** Produces `export type StackMode = "desktop" | "portrait" | "landscape"`, `export function stackGeometry(vh: number, mode: StackMode): { offset: number; cardH: number }`. Consumes `useIsMobile()`.

- [ ] **Step 1: Failing test**

```ts
// apps/web/src/__tests__/components/WhyCnCStacked.test.ts
import { describe, it, expect } from "vitest";
import { stackGeometry } from "@/components/join/WhyCnCStacked";

describe("stackGeometry", () => {
  it("desktop: 88px offset and 52vh cards (unchanged)", () => {
    expect(stackGeometry(900, "desktop")).toEqual({ offset: 88, cardH: 468 });
    expect(stackGeometry(800, "desktop")).toEqual({ offset: 88, cardH: 416 });
  });
  it("upright phones: tighter 40px offset, same 52vh cards", () => {
    expect(stackGeometry(844, "portrait")).toEqual({ offset: 40, cardH: expect.closeTo(438.88, 6) });
  });
  it("sideways phones: 40px offset and shorter 48vh cards so the last card ends on screen", () => {
    expect(stackGeometry(390, "landscape")).toEqual({ offset: 40, cardH: expect.closeTo(187.2, 6) });
  });
});
```

- [ ] **Step 2:** Run `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/components/WhyCnCStacked.test.ts` — Expected FAIL (not exported).

- [ ] **Step 3: Implement**

1. Imports: add `import { useIsMobile } from "@/hooks/useIsMobile";`.
2. Below `const OFFSET = 88;` add:

```ts
// Phones stack with a tighter offset (and sideways phones a shorter card) so
// the third card's bottom stays on screen: desktop 80 + 2*88 + 52vh fits a
// 900px screen but runs ~70px below a sideways phone's. Static tops are set by
// the max-lg:!top-* classes below and must match these offsets (base 64px).
export type StackMode = "desktop" | "portrait" | "landscape";
export function stackGeometry(vh: number, mode: StackMode): { offset: number; cardH: number } {
  if (mode === "desktop") return { offset: OFFSET, cardH: vh * 0.52 };
  return { offset: 40, cardH: vh * (mode === "landscape" ? 0.48 : 0.52) };
}
```

3. In `WhyCnCStacked()`, replace the `vh` state + effect + `cardH`/`slideDistance` lines with:

```ts
  const [vh, setVh] = useState(800);
  const [mode, setMode] = useState<StackMode>("desktop");
  const isMobile = useIsMobile();

  useEffect(() => {
    const update = () => {
      setVh(window.innerHeight);
      setMode(!isMobile ? "desktop" : window.innerHeight >= window.innerWidth ? "portrait" : "landscape");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [isMobile]);
```

and

```ts
  const { offset, cardH } = stackGeometry(vh, mode);

  // Both cards start the same distance below their stacked position:
  // exactly at the bottom edge of the card above them once stacked.
  const slideDistance = cardH - offset; // desktop e.g. 416 - 88 = 328px
```

(`useScroll`, `card2Y`, `card3Y` unchanged.)

4. Card classes (static tops/heights for phones; desktop inline styles untouched):
- Card 1 div `"absolute left-6 right-6 overflow-hidden rounded-2xl"` → append `" max-lg:!top-[64px] max-lg:left-4 max-lg:right-4 max-lg:landscape:!h-[48vh]"`.
- Card 2 motion.div (same className) → append `" max-lg:!top-[104px] max-lg:left-4 max-lg:right-4 max-lg:landscape:!h-[48vh]"`.
- Card 3 motion.div → append `" max-lg:!top-[144px] max-lg:left-4 max-lg:right-4 max-lg:landscape:!h-[48vh]"`.

5. `CardContent` (upright phones: photo fills the card, dark overlay, white text over it; sideways: side-by-side with smaller text):
- Outer `"flex h-full"` → `"flex h-full max-lg:portrait:relative"`.
- Photo wrapper `"relative w-1/2 overflow-hidden"` → append `" max-lg:portrait:!absolute max-lg:portrait:inset-0 max-lg:portrait:w-full"`.
- Text panel `"flex w-1/2 flex-col justify-between p-10 lg:p-16"` → append `" max-lg:p-4 max-lg:portrait:relative max-lg:portrait:w-full max-lg:portrait:!bg-black/55 max-lg:portrait:p-5"`.
- h3 `"font-sans text-[2.5rem] font-semibold uppercase tracking-widest leading-tight"` → append `" max-lg:tracking-wide max-lg:portrait:!text-white max-lg:portrait:text-[clamp(1.2rem,6vw,2rem)] max-lg:landscape:text-[clamp(0.9rem,5svh,1.6rem)]"`.
- p `"max-w-lg font-sans text-[1.25rem] font-light leading-relaxed"` → append `" max-lg:portrait:!text-white max-lg:portrait:text-[clamp(0.85rem,3.8vw,1.05rem)] max-lg:landscape:text-[clamp(0.7rem,3.3svh,0.95rem)]"`.

- [ ] **Step 4:** Test passes (3). Suite, `tsc`, build. Commit `feat: Join stacked cards fit phones with photo-behind-text and tighter stacking`.
- [ ] **Step 5 (controller, shared build with Task 5):** desktop MEASURE `stacked` = baseline. Phones incl. 844×340 and 667×320: at the end of the stacking scroll (`scrollRef` bottom − viewport), card 3 bottom ≤ viewport height; at start, middle and end, every card's text (`h3`, `p`) bottom ≤ its card's bottom (no cut text); OVERFLOW = `[]`.

---

### Task 5: JoinSteps — pinned text above photos on upright phones

**Files:** `components/join/JoinSteps.tsx`. Classes only.

- [ ] Section `"relative flex bg-white pl-8 pr-20"` → append `" max-lg:portrait:flex-col max-lg:portrait:px-6 max-lg:landscape:pr-6"`.
- [ ] Image column `"flex flex-1 flex-col gap-[4.2rem] py-[7.5vh]"` → append `" max-lg:portrait:gap-6 max-lg:portrait:py-6"`. Each image box `"relative overflow-hidden rounded-2xl"` (inline `height: "49vh"`) → append `" max-lg:portrait:!h-[40svh]"`.
- [ ] Progress bar `"sticky top-[100px] flex h-[68vh] w-8 flex-col items-end self-start py-10"` → append `" max-lg:portrait:hidden max-lg:landscape:top-16 max-lg:landscape:h-[80svh] max-lg:landscape:py-4"`.
- [ ] Text panel `"sticky top-[100px] flex h-[68vh] w-[42%] flex-col justify-between self-start pb-12 pt-10 text-right"` → append `" max-lg:portrait:order-first max-lg:portrait:top-16 max-lg:portrait:z-10 max-lg:portrait:h-auto max-lg:portrait:w-full max-lg:portrait:gap-3 max-lg:portrait:bg-white max-lg:portrait:py-4 max-lg:portrait:text-left max-lg:landscape:top-16 max-lg:landscape:h-[80svh] max-lg:landscape:pb-4 max-lg:landscape:pt-4"`.
- [ ] h2 `"font-sans text-[3.2rem] font-light leading-[1.0] xl:text-[3.8rem]"` → append `" max-lg:portrait:text-[clamp(1.8rem,8vw,3.2rem)] max-lg:landscape:text-[clamp(1.4rem,8svh,2.6rem)]"`; its first span `"text-[2.4rem] xl:text-[2.9rem]"` → append `" max-lg:portrait:text-[clamp(1.4rem,6vw,2.4rem)] max-lg:landscape:text-[clamp(1.1rem,6svh,2rem)]"`.
- [ ] Icon wrapper `"ml-auto"` → `"ml-auto max-lg:portrait:ml-0"`. Body p `"ml-auto max-w-sm whitespace-pre-line font-sans text-[1.1rem] leading-relaxed text-[#1B1B1B]/60"` → append `" max-lg:portrait:ml-0 max-lg:portrait:max-w-none max-lg:portrait:text-[clamp(0.85rem,3.6vw,1.05rem)] max-lg:landscape:text-[clamp(0.75rem,3.6svh,1rem)]"`.
- [ ] Suite, `tsc`, build. Commit `feat: Join steps pin their text above the photos on phones`.
- [ ] **Controller:** desktop MEASURE `joinsteps` = baseline. Upright phones: text panel above the first photo; for each photo, scroll so its centre is at viewport centre → the pinned h2's last word equals that step's title last word; pinned panel height + 64 ≤ 45% of viewport at 320×568 (else reduce sizes and note); OVERFLOW = `[]`. Sideways (incl. 844×340): panel and bar inside the visible height; text not cut.

---

### Task 6: HowToJoin — one column

**Files:** `components/join/HowToJoin.tsx`. Classes only.

- [ ] `"flex gap-24"` → `"flex gap-24 max-lg:flex-col max-lg:gap-10"`; `"w-[45%] shrink-0"` → append `" max-lg:w-full"`; `"sticky top-28"` (heading wrapper) → append `" max-lg:static"`.
- [ ] h2 `"font-sans leading-[1.1] -ml-16"` → append `" max-lg:ml-0"`; `"block text-[2.5rem] font-light"` → append `" max-lg:text-[clamp(1.9rem,8vw,2.5rem)]"`; `"block pl-[5.5rem] text-[3.5rem] font-medium"` → append `" max-lg:pl-[3rem] max-lg:text-[clamp(2.6rem,11vw,3.5rem)]"`.
- [ ] `"flex flex-1 gap-12"` → append `" max-lg:flex-col max-lg:gap-6"`; step h3 `"mb-3 font-sans text-[2.2rem] font-medium text-[#1B1B1B]"` → append `" max-lg:text-[clamp(1.6rem,7vw,2.2rem)]"`; step `"py-10"` → `"py-10 max-lg:py-6"`.
- [ ] Photo column `"w-72 shrink-0 pt-10 sticky top-28 self-start"` → append `" max-lg:static max-lg:w-full max-lg:pt-0"`; photo box `"h-[380px] w-full overflow-hidden rounded-2xl shadow-lg"` → append `" max-lg:h-[260px]"`.
- [ ] Suite, `tsc`. Commit `feat: How to Join stacks in one column on phones`.

### Task 7: Application form rows + "You're IN" heading

**Files:** `components/join/ApplicationForm.tsx`, `app/(marketing)/join/apply/submitted/page.tsx`. Classes only.

- [ ] Form: each of the five `grid grid-cols-2 gap-4` rows and two `grid grid-cols-3 gap-4` rows (lines ~239, 249, 264, 283, 318, 330, 340) → add `max-sm:grid-cols-1` to the class string (e.g. `"mt-4 grid grid-cols-3 gap-4 max-sm:grid-cols-1"`).
- [ ] Submitted page h1 `"-ml-40 mb-12 font-sans font-light leading-[1.05]"` → append `" max-lg:ml-0"`.
- [ ] Suite, `tsc`, build. Commit `feat: application form rows stack on phones; You're IN heading fits`.
- [ ] **Controller (shared build for Tasks 6–8):** desktop MEASURE `howtojoin`, `form`, `submitted` = baselines. Phones: OVERFLOW each = `[]`; at 320 every `input, select, textarea` in the form is ≥ 240px wide; at 820×1180 the 2-column rows are still 2 columns; HowToJoin order heading → steps → photo.

---

### Task 8: Confetti — half resolution on phones

**Files:** `components/join/ConfettiCannonInner.tsx`; Test `__tests__/components/ConfettiCannonInner.test.ts`.

**Interfaces:** Produces `export function confettiCanvasSize(isMobile: boolean): { width: number; height: number }`. Consumes `MOBILE_QUERY` from `@/hooks/useIsMobile`.

- [ ] **Step 1: Failing test**

```ts
// apps/web/src/__tests__/components/ConfettiCannonInner.test.ts
import { describe, it, expect } from "vitest";
import { confettiCanvasSize } from "@/components/join/ConfettiCannonInner";

describe("confettiCanvasSize", () => {
  it("desktop keys at the video's native 1280x720 (unchanged)", () => {
    expect(confettiCanvasSize(false)).toEqual({ width: 1280, height: 720 });
  });
  it("phones key at half resolution — 4x fewer pixels per frame", () => {
    expect(confettiCanvasSize(true)).toEqual({ width: 640, height: 360 });
  });
});
```

- [ ] **Step 2:** Run it — Expected FAIL (not exported).
- [ ] **Step 3: Implement** — add `import { MOBILE_QUERY } from "@/hooks/useIsMobile";`. Below `CANVAS_HEIGHT` add:

```ts
// Phones key at half resolution: 4x fewer pixels per frame keeps playback
// smooth on slower phone processors. Trade-off accepted for phones only: the
// smallest confetti pieces blend slightly with the green before keying (see
// above). Desktop keeps the native resolution.
export function confettiCanvasSize(isMobile: boolean): { width: number; height: number } {
  return isMobile ? { width: CANVAS_WIDTH / 2, height: CANVAS_HEIGHT / 2 } : { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
}
```

In the effect, replace `canvas.width = CANVAS_WIDTH; canvas.height = CANVAS_HEIGHT;` with:

```ts
    // Read the media query directly: the canvas is sized once at mount, and
    // useIsMobile() is still false during hydration.
    const { width, height } = confettiCanvasSize(window.matchMedia(MOBILE_QUERY).matches);
    canvas.width = width;
    canvas.height = height;
```

and in `drawFrame` replace `CANVAS_WIDTH, CANVAS_HEIGHT` (both calls) with `width, height`.

- [ ] **Step 4:** Test passes (2). Suite, `tsc`, build. Commit `perf: confetti keys at half resolution on phones`.
- [ ] **Controller:** desktop `/join/apply/submitted` canvas `width`=1280 `height`=720 and MEASURE `submitted` = baseline; phones canvas 640×360.

---

### Task 9: Final verification (controller)

- [ ] Suite + `tsc`; clean build; serve 3100.
- [ ] Desktop MEASURE all seven = baselines.
- [ ] Phones (all 9 viewports) for `/join`, `/join/apply`, `/join/apply/submitted`, `/join/ica`: `scrollWidth == innerWidth`, OVERFLOW on `body` = `[]`.
- [ ] WEIGHT the three Join pages at 1440×900 and 390×844 vs baseline (jsKB within ~2%; totals with video noise excluded).
- [ ] Stop 3100. No push.
