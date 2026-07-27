# Homepage Advantage Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3-slide, Compass-style stacked-depth carousel ("CnC Academy" / "Full CRM" / "Transaction Management System") to the homepage, positioned so it — not the testimonial review cards — is what scrolls up and covers the sticky "We create..." headline.

**Architecture:** `Testimonials.tsx` is split into `TestimonialsIntro.tsx` (owns the sticky headline + the new carousel, in one `<section>` so the existing cover-reveal CSS mechanic still works) and `TestimonialCards.tsx` (the review grid, now a plain section with no cover trick). The carousel itself is a new self-contained component, `AdvantageCarousel.tsx`, using a 3-slot depth-stack pattern (front/middle/back) analogous to the prev/active/next pattern already used in `RentCitiesSlider.tsx`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion (`motion/react`), Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-25-homepage-advantage-carousel-design.md` (approved, committed at `825a86b`).
- Slide copy is fixed, verbatim, do not alter: "CnC Academy" / "Learning center and training guides in one place"; "Full CRM" / "Free client relationship management system built with AI"; "Transaction Management System" / "Our in-house TMS helps you save money and remain compliant".
- Images: `/images/advantage-crm.jpg` (real, already committed) for "Full CRM"; `/images/sell/sell-11.jpg` and `/images/sell/sell-12.jpg` (existing, already-unused stock photos) as placeholders for the other two — do not download or create new placeholder assets.
- Title text must render larger than the subtitle text on each card (Ryan's explicit instruction).
- Arrows must reuse `RentCitiesSlider.tsx`'s `ArrowIcon` SVG and circular pill-button treatment (rotated ±90°, `PULSE_ANIMATE`/`PULSE_TRANSITION` idle pulse, `SPRING_HOVER` on hover) — colors adapted to dark-on-light since this section's background is `#F2F0EF`, not `RentCitiesSlider`'s dark `#1B1B1B`.
- No auto-play — manual arrow navigation only.
- Font: this project's own `font-sans` (Google Sans Flex) throughout — never Compass's serif.
- Only `apps/web/src/app/page.tsx` imports `Testimonials` today (confirmed via grep) — safe to delete `Testimonials.tsx` once its replacement is wired in.
- This codebase has no React component-render test infrastructure (`vitest.config.ts` is `environment: "node"`, `.test.ts` files only) — testable logic here is limited to the pure `getStackDepth` function, matching the existing precedent of `RentCitiesSlider.tsx`'s tested `getSlideState`. Visual/animation correctness is verified by running the dev server and a manual browser check, not by an automated render test.

---

### Task 1: `AdvantageCarousel` component

**Files:**
- Create: `apps/web/src/components/home/AdvantageCarousel.tsx`
- Modify: `apps/web/src/lib/motion.ts` (add `STACK_SPRING`)
- Test: `apps/web/src/__tests__/components/AdvantageCarousel.test.ts`

**Interfaces:**
- Consumes: `PULSE_ANIMATE`, `PULSE_TRANSITION`, `SPRING_HOVER` from `@/lib/motion` (existing); adds and consumes `STACK_SPRING` from the same file.
- Produces: `export function AdvantageCarousel(): JSX.Element` (default stacked-card carousel, no props — 3 slides are fixed data inside the component), `export type StackDepth = "front" | "middle" | "back"`, `export function getStackDepth(idx: number, activeIdx: number, total: number): StackDepth`. Task 2's `TestimonialsIntro.tsx` imports `AdvantageCarousel` from this file.

- [ ] **Step 1: Write the failing test for `getStackDepth`**

Create `apps/web/src/__tests__/components/AdvantageCarousel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getStackDepth } from "@/components/home/AdvantageCarousel";

describe("getStackDepth", () => {
  it("marks the active index as front", () => {
    expect(getStackDepth(1, 1, 3)).toBe("front");
  });

  it("marks the next index as middle", () => {
    expect(getStackDepth(2, 1, 3)).toBe("middle");
  });

  it("marks the index after that as back", () => {
    expect(getStackDepth(0, 1, 3)).toBe("back");
  });

  it("computes correctly when active index is 0", () => {
    expect(getStackDepth(0, 0, 3)).toBe("front");
    expect(getStackDepth(1, 0, 3)).toBe("middle");
    expect(getStackDepth(2, 0, 3)).toBe("back");
  });

  it("wraps around: middle wraps past the end back to index 0", () => {
    expect(getStackDepth(0, 2, 3)).toBe("middle");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/components/AdvantageCarousel.test.ts`
Expected: FAIL — `Cannot find module '@/components/home/AdvantageCarousel'` (file doesn't exist yet).

- [ ] **Step 3: Add `STACK_SPRING` to `lib/motion.ts`**

Add this constant to `apps/web/src/lib/motion.ts` (anywhere alongside the other exported constants, e.g. directly below `SPRING_HOVER`):

```ts
// Spring for the 3-slot stacked-card carousel (AdvantageCarousel) — tuned to
// approximate Compass's ~550ms settle-with-slight-overshoot on slide change.
export const STACK_SPRING = { type: "spring", stiffness: 220, damping: 24 } as const;
```

- [ ] **Step 4: Create `AdvantageCarousel.tsx` with the minimal `getStackDepth` implementation**

Create `apps/web/src/components/home/AdvantageCarousel.tsx`:

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER, STACK_SPRING } from "@/lib/motion";

export type StackDepth = "front" | "middle" | "back";

export function getStackDepth(idx: number, activeIdx: number, total: number): StackDepth {
  const offset = (idx - activeIdx + total) % total;
  if (offset === 0) return "front";
  if (offset === 1) return "middle";
  return "back";
}

function stackAnimate(depth: StackDepth) {
  switch (depth) {
    case "front":
      return { x: "-7%", y: "-10.5%", zIndex: 3 };
    case "middle":
      return { x: "0%", y: "0%", zIndex: 2 };
    case "back":
      return { x: "7%", y: "10.5%", zIndex: 1 };
  }
}

const SLIDES = [
  {
    title: "CnC Academy",
    subtitle: "Learning center and training guides in one place",
    image: "/images/sell/sell-11.jpg",
  },
  {
    title: "Full CRM",
    subtitle: "Free client relationship management system built with AI",
    image: "/images/advantage-crm.jpg",
  },
  {
    title: "Transaction Management System",
    subtitle: "Our in-house TMS helps you save money and remain compliant",
    image: "/images/sell/sell-12.jpg",
  },
] as const;

function ArrowIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 30 30" fill="currentColor">
      <path d="M16 20.488c0-.13.053-.253.146-.344l13-13.002c.42-.44 1.174.24.706.707l-13 13c-.302.31-.853.096-.853-.362z" />
      <path d="M.852 7.142l14 14.002c.447.447-.273 1.16-.707.707l-14-14c-.444-.445.26-1.155.707-.708z" />
    </svg>
  );
}

export function AdvantageCarousel() {
  const [activeIdx, setActiveIdx] = useState(0);

  function goNext() {
    setActiveIdx((i) => (i + 1) % SLIDES.length);
  }

  function goPrev() {
    setActiveIdx((i) => (i - 1 + SLIDES.length) % SLIDES.length);
  }

  return (
    <div>
      <div className="relative mx-auto" style={{ width: "60vw", maxWidth: 820 }}>
        <div className="relative w-full" style={{ paddingTop: "calc(60vw / 1.45)", maxHeight: 566 }}>
          <div className="absolute inset-0">
            {SLIDES.map((slide, i) => {
              const depth = getStackDepth(i, activeIdx, SLIDES.length);
              return (
                <motion.div
                  key={slide.title}
                  className="absolute inset-0 overflow-hidden rounded-[22px] shadow-[5px_5px_20px_0px_rgba(0,0,0,0.4)]"
                  animate={stackAnimate(depth)}
                  transition={STACK_SPRING}
                >
                  <Image
                    src={slide.image}
                    alt={slide.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 820px) 60vw, 820px"
                    priority={i === 0}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute left-8 top-8 max-w-[70%]">
                    <p className="font-sans text-2xl font-medium text-white xl:text-3xl">
                      {slide.title}
                    </p>
                    <p className="mt-3 font-sans text-sm text-white/80 xl:text-base">
                      {slide.subtitle}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-12 flex justify-center gap-6">
        <motion.button
          onClick={goPrev}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          className="cursor-pointer rounded-full border border-[#1B1B1B]/50 p-3 text-[#1B1B1B]"
          style={{ rotate: "90deg" }}
          aria-label="Previous slide"
        >
          <ArrowIcon />
        </motion.button>
        <motion.button
          onClick={goNext}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          className="cursor-pointer rounded-full border border-[#1B1B1B]/50 p-3 text-[#1B1B1B]"
          style={{ rotate: "-90deg" }}
          aria-label="Next slide"
        >
          <ArrowIcon />
        </motion.button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/components/AdvantageCarousel.test.ts`
Expected: PASS — all 5 assertions green.

- [ ] **Step 6: Run the full test suite and type check to confirm nothing else broke**

Run: `pnpm --filter web exec vitest run` and `pnpm --filter web exec tsc --noEmit`
Expected: same pass/fail counts as before this task (no new failures; pre-existing unrelated `tsc` errors, if any, are unaffected — do not attempt to fix them here).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/home/AdvantageCarousel.tsx apps/web/src/lib/motion.ts apps/web/src/__tests__/components/AdvantageCarousel.test.ts
git commit -m "feat: add AdvantageCarousel stacked-card component"
```

---

### Task 2: Split `Testimonials.tsx` into `TestimonialsIntro.tsx` + `TestimonialCards.tsx`

**Files:**
- Create: `apps/web/src/components/home/TestimonialsIntro.tsx`
- Create: `apps/web/src/components/home/TestimonialCards.tsx`
- Delete: `apps/web/src/components/home/Testimonials.tsx`

**Interfaces:**
- Consumes: `AdvantageCarousel` from `@/components/home/AdvantageCarousel` (Task 1); `fadeUp` from `@/lib/motion` (existing).
- Produces: `export function TestimonialsIntro(): JSX.Element`, `export function TestimonialCards(): JSX.Element`. Task 3's `page.tsx` imports both.

- [ ] **Step 1: Create `TestimonialsIntro.tsx`**

This owns the sticky "We create..." headline (copied verbatim from the current `Testimonials.tsx`) plus the new carousel, in one `<section>`, so the sticky-then-covered CSS mechanic still works exactly as it did when the review cards played that role.

Create `apps/web/src/components/home/TestimonialsIntro.tsx`:

```tsx
"use client";

import { AnimatePresence, motion } from "motion/react";
import { memo, useEffect, useState } from "react";
import { AdvantageCarousel } from "./AdvantageCarousel";

const WORDS = ["trust", "results", "futures", "homes", "teams"];

// Memoized so ghost words don't re-render on every word cycle
const GhostWords = memo(function GhostWords() {
  return (
    <>
      {WORDS.map((w) => (
        <span
          key={w}
          aria-hidden="true"
          style={{
            gridArea: "1/1",
            visibility: "hidden",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {w}
        </span>
      ))}
    </>
  );
});

export function TestimonialsIntro() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % WORDS.length), 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <section data-navbar-theme="light" className="relative bg-[#F2F0EF]">
      {/* Sticky headline — stays fixed while the carousel below scrolls over it */}
      <div className="sticky top-[32vh] z-0 px-4 text-center">
        <h2
          className="font-sans font-light text-[#1B1B1B]"
          style={{ fontSize: "clamp(2.8rem, 5.5vw, 5rem)", lineHeight: 1.15 }}
        >
          We create{" "}
          {/*
            inline-grid trick: ghost spans all stack in the same grid cell to
            hold the width of the widest word — prevents "We create" from
            shifting as the cycling word changes length
          */}
          <span
            style={{
              display: "inline-grid",
              overflow: "visible",
              verticalAlign: "bottom",
              lineHeight: "inherit",
              fontSize: "clamp(3.5rem, 6.8vw, 6.2rem)",
            }}
          >
            <GhostWords />
            <AnimatePresence mode="wait">
              <motion.span
                key={idx}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0, transition: { duration: 0.9, ease: "easeOut" } }}
                exit={{ opacity: 0, transition: { duration: 0.25, ease: "easeIn" } }}
                style={{ gridArea: "1/1", display: "block", color: "#9E8C61" }}
              >
                {WORDS[idx]}
              </motion.span>
            </AnimatePresence>
          </span>
        </h2>
      </div>

      {/* Carousel — covers the sticky headline as the user scrolls (same mechanic Testimonials.tsx used to run with the review cards) */}
      <div className="relative z-10 mt-[52vh] bg-[#F2F0EF] pb-20">
        <AdvantageCarousel />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create `TestimonialCards.tsx`**

This is the 3-column review grid, copied verbatim from the current `Testimonials.tsx`, with the `mt-[52vh]`/cover-specific offset removed (it's a plain section now, nothing scrolls over it) and replaced with a normal `pt-16` top spacing.

Create `apps/web/src/components/home/TestimonialCards.tsx`:

```tsx
"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { fadeUp } from "@/lib/motion";

export function TestimonialCards() {
  return (
    <section data-navbar-theme="light" className="relative bg-[#F2F0EF] pt-16">
      {/* Staggered layout: all 6 boxes same fixed height, side columns offset downward */}
      <div style={{ display: "flex", gap: "1px", backgroundColor: "#F2F0EF", alignItems: "flex-start" }}>
        {/* Left column — offset down by 200px */}
        <div className="flex flex-1 flex-col" style={{ marginTop: "200px", gap: "1px" }}>
          <motion.div {...fadeUp(0)} style={{ height: "420px", overflow: "hidden", position: "relative" }}>
            <Image src="/images/testimonials-left.jpg" alt="" fill className="object-cover" />
          </motion.div>
          <motion.div
            {...fadeUp(0.06)}
            className="flex flex-col bg-white px-10 py-10"
            style={{ height: "420px" }}
          >
            <p className="font-sans text-[1.05rem] leading-[1.85] text-[#1B1B1B]">
              Working with CnC Realty has been an inspiring experience. Their deep
              knowledge of the real estate sector, combined with a dynamic and
              dedicated team, authentically guided us through every step and
              amplified our confidence throughout the entire process.
            </p>
            <p className="mt-4 font-sans text-[1.05rem] leading-[1.85] text-[#1B1B1B]">
              A partnership we truly value and look forward to continuing.
            </p>
            <div className="mt-auto border-t border-[#1B1B1B]/15 pt-5">
              <p className="font-sans text-sm font-medium text-[#1B1B1B]">Kevin Luevanos</p>
              <p className="font-sans text-xs text-[#1B1B1B]/45">Prime Construction LLC</p>
            </div>
          </motion.div>
        </div>

        {/* Center column — starts at top */}
        <div className="flex flex-1 flex-col" style={{ gap: "1px" }}>
          <motion.div
            {...fadeUp(0.08)}
            className="flex flex-col bg-[#1B1B1B] px-10 py-10"
            style={{ height: "420px" }}
          >
            <p className="font-sans text-[1.05rem] leading-[1.85] text-white">
              Last year when my husband and I bought our home, we had no idea where
              to start! CnC really made the homebuying process easy and we couldn&apos;t
              be happier with our purchase. Highly recommend reaching out to get some
              helpful insight before making the first step.
            </p>
            <div className="mt-auto border-t border-white/15 pt-5">
              <p className="font-sans text-sm font-medium text-white">Jessica Meyes</p>
              <p className="font-sans text-xs text-white/40">First Time Homeowner</p>
            </div>
          </motion.div>
          <motion.div {...fadeUp(0.12)} style={{ height: "420px", overflow: "hidden", position: "relative" }}>
            <Image src="/images/testimonials-center.jpg" alt="" fill className="object-cover" />
          </motion.div>
          <motion.div
            {...fadeUp(0.16)}
            className="flex flex-col bg-[#1B1B1B] px-10 py-10"
            style={{ height: "420px" }}
          >
            <p className="font-sans text-[1.05rem] leading-[1.85] text-white">
              Much appreciation for the folks over at CnC — not only did I get top
              dollar for my home, but I moved into a bigger home with a 1031 exchange.
              If you want the best communication, knowledge, and professionalism, you
              have to give CnC a call.
            </p>
            <div className="mt-auto border-t border-white/15 pt-5">
              <p className="font-sans text-sm font-medium text-white">Raymond Lee</p>
              <p className="font-sans text-xs text-white/40">SoCal Resident & Investor</p>
            </div>
          </motion.div>
        </div>

        {/* Right column — offset down by 200px */}
        <div className="flex flex-1 flex-col" style={{ marginTop: "200px", gap: "1px" }}>
          <motion.div {...fadeUp(0.04)} style={{ height: "420px", overflow: "hidden", position: "relative" }}>
            <Image src="/images/testimonials-right.jpg" alt="" fill className="object-cover" />
          </motion.div>
          <motion.div
            {...fadeUp(0.10)}
            className="flex flex-col bg-white px-10 py-10"
            style={{ height: "420px" }}
          >
            <p className="font-sans text-[1.05rem] leading-[1.85] text-[#1B1B1B]">
              My experience switching from my previous brokerage to CnC has exceeded
              my expectations. Being able to take home ALL of my commission has really
              changed the game for me. I am able to commit more time to client outreach
              and less time balancing my day-job.
            </p>
            <div className="mt-auto border-t border-[#1B1B1B]/15 pt-5">
              <p className="font-sans text-sm font-medium text-[#1B1B1B]">Rachel Kent</p>
              <p className="font-sans text-xs text-[#1B1B1B]/45">Real Estate Agent</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Delete the original `Testimonials.tsx`**

```bash
rm apps/web/src/components/home/Testimonials.tsx
```

Do not run this until Task 3, Step 1 has already updated `page.tsx` to stop importing it — otherwise the build breaks between steps. (If executing tasks strictly in order, it's fine to delete it now and fix the now-broken `page.tsx` import in Task 3 immediately next; either order works as long as both changes land in the same task-review cycle.)

- [ ] **Step 4: Run the full test suite**

Run: `pnpm --filter web exec vitest run`
Expected: same pass count as after Task 1 (this task adds no new tests — it's a pure extraction of existing, unchanged JSX/logic into two files).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/home/TestimonialsIntro.tsx apps/web/src/components/home/TestimonialCards.tsx
git rm apps/web/src/components/home/Testimonials.tsx
git commit -m "refactor: split Testimonials.tsx into TestimonialsIntro + TestimonialCards"
```

---

### Task 3: Wire into the homepage

**Files:**
- Modify: `apps/web/src/app/page.tsx`

**Interfaces:**
- Consumes: `TestimonialsIntro` from `@/components/home/TestimonialsIntro` and `TestimonialCards` from `@/components/home/TestimonialCards` (both from Task 2).

- [ ] **Step 1: Update `page.tsx`**

In `apps/web/src/app/page.tsx`, replace the import:

```ts
import { Testimonials } from "@/components/home/Testimonials";
```

with:

```ts
import { TestimonialsIntro } from "@/components/home/TestimonialsIntro";
import { TestimonialCards } from "@/components/home/TestimonialCards";
```

And replace the single usage:

```tsx
<Testimonials />
```

with:

```tsx
<TestimonialsIntro />
<TestimonialCards />
```

No other lines in `page.tsx` change — `TestimonialsIntro`/`TestimonialCards` render in exactly the position `Testimonials` used to.

- [ ] **Step 2: Run the full test suite and type check**

Run: `pnpm --filter web exec vitest run` and `pnpm --filter web exec tsc --noEmit`
Expected: all tests pass; no new `tsc` errors (specifically confirm no leftover reference to the deleted `Testimonials.tsx` anywhere).

- [ ] **Step 3: Start the dev server and confirm the homepage renders without errors**

Run: `pnpm --filter web dev` (or reuse an already-running dev server), then check the terminal/server log for compile or runtime errors on `/` — no Puppeteer needed for this local check (dev server logs are sufficient per this project's convention).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: wire AdvantageCarousel into the homepage via TestimonialsIntro"
```

- [ ] **Step 5: Flag for Ryan's manual visual review**

This last step is not automatable — ask Ryan to open `localhost:3000`, scroll through the "We create..." → carousel → review-cards sequence, and confirm: the carousel visually covers the sticky headline as expected, the 3 cards stack/cycle correctly with the arrows, the "Full CRM" card shows the real screenshot, and the title text on each card reads larger than the subtitle beneath it.

---

## Self-Review Notes

- **Spec coverage:** Placement (Task 2/3), stack mechanic + arrows + copy + images (Task 1), no-auto-play (Task 1 has no interval/timer, matches), font/sizing hierarchy (Task 1's `text-2xl`/`xl:text-3xl` title vs `text-sm`/`xl:text-base` subtitle) — all covered.
- **Placeholder scan:** no TBD/TODO; the one deliberately-left-open item from the spec (responsive sizing / spring feel tuning) is called out in Task 3 Step 5 as part of the manual review, not silently dropped.
- **Type consistency:** `getStackDepth(idx, activeIdx, total)` signature and `StackDepth` type are identical everywhere they're referenced (Task 1 definition, Task 1 test, Task 1 usage inside `AdvantageCarousel`). `AdvantageCarousel`/`TestimonialsIntro`/`TestimonialCards` export names match their import sites in Tasks 2 and 3 exactly.
