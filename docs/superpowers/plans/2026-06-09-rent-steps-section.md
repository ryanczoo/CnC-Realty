# RentSteps Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-column "steps" section to `/rent` that replicates Fluid's layout — large heading on the left with RevealLine animation, numbered step rows on the right — using CnC's off-white background and button standards.

**Architecture:** New `RentSteps` component; minimal one-line extension to `RevealLine` to accept an optional `color` prop (needed for gray second heading line); existing PERKS grid in `rent/page.tsx` replaced.

**Tech Stack:** Next.js 14, Framer Motion (`motion/react`), Tailwind CSS, `RevealLine` from `reveal-text.tsx`, `fadeUp`/`PULSE_ANIMATE`/`PULSE_TRANSITION`/`SPRING_HOVER` from `lib/motion.ts`

---

### Task 1: Add `color` prop to `RevealLine`

`RevealLine` currently only supports dark (`#1B1B1B`) or white (via `onDark`). The heading's second line needs gray (`#b3b3b3`). One-line extension.

**Files:**
- Modify: `apps/web/src/components/ui/reveal-text.tsx`

- [ ] **Step 1: Update the `RevealLine` props interface and color logic**

In `reveal-text.tsx`, change the `RevealLine` function signature and the outer span's style:

```tsx
export function RevealLine({ children, delay = 0, className, onDark = false, triggerOnMount = false, color }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  onDark?: boolean;
  triggerOnMount?: boolean;
  color?: string;
}) {
```

And change the outer span style from:
```tsx
style={{ color: onDark ? "#ffffff" : "#1B1B1B" }}
```
to:
```tsx
style={{ color: color ?? (onDark ? "#ffffff" : "#1B1B1B") }}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd C:/Users/hey_r/Desktop/CnC-Realty && pnpm --filter web exec tsc --noEmit 2>&1 | head -20
```

Expected: no new errors (pre-existing errors in test files are fine).

---

### Task 2: Create `RentSteps` component

**Files:**
- Create: `apps/web/src/components/rent/RentSteps.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { RevealLine } from "@/components/ui/reveal-text";
import { fadeUp, PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

const STEPS = [
  {
    num: "01",
    title: "Talk to a Real Human.",
    body: "We match you with an expert who actually listens.",
  },
  {
    num: "02",
    title: "Get Clarity.",
    body: "We define what you really need, not just what's available.",
  },
  {
    num: "03",
    title: "Move Forward.",
    body: "We find what fits — and make it happen.",
  },
];

export function RentSteps() {
  return (
    <section className="bg-cnc-bg px-[75px] py-28">
      <div className="flex gap-10">

        {/* Left: heading + CTA */}
        <div className="flex flex-1 flex-col gap-8">
          <h2 className="font-sans font-medium leading-none" style={{ fontSize: 54 }}>
            <RevealLine className="block">Real Estate,</RevealLine>
            <RevealLine className="block" color="#b3b3b3" delay={0.15}>Rewired.</RevealLine>
          </h2>
          <motion.div
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
            className="w-fit"
          >
            <Link
              href="/properties?listingType=FOR_LEASE"
              className="flex items-center gap-2 rounded-full bg-[#1B1B1B] px-7 py-4 font-sans text-base font-medium text-white"
            >
              Start Your Search <span aria-hidden>→</span>
            </Link>
          </motion.div>
        </div>

        {/* Right: steps list */}
        <div className="shrink-0 basis-[57%]">
          <p className="mb-6 font-sans text-2xl font-medium text-[#1B1B1B]">Steps:</p>
          <div>
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                {...fadeUp(i * 0.12)}
                className="flex items-center gap-10 border-t border-[#1B1B1B]/[0.07] py-6"
              >
                <span className="w-8 shrink-0 font-sans text-[15px] font-normal text-[#b3b3b3]">
                  {step.num}
                </span>
                <p className="font-sans font-medium leading-[1.15]" style={{ fontSize: "2.1rem" }}>
                  <span className="text-[#1B1B1B]">{step.title} </span>
                  <span className="text-[#b3b3b3]">{step.body}</span>
                </p>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
```

---

### Task 3: Wire into `rent/page.tsx` and commit

**Files:**
- Modify: `apps/web/src/app/(marketing)/rent/page.tsx`

- [ ] **Step 1: Replace the PERKS grid with `<RentSteps />`**

Replace the entire contents of `rent/page.tsx` with:

```tsx
import { Metadata } from "next";
import { RentHero } from "@/components/rent/RentHero";
import { RentSteps } from "@/components/rent/RentSteps";
import { PageCTA } from "@/components/ui/PageCTA";

export const metadata: Metadata = {
  title: "Rent | CnC Realty",
  description: "Find your next rental in California with CnC Realty. Live CRMLS lease listings with expert tenant representation.",
};

export default function RentPage() {
  return (
    <main className="min-h-screen bg-[#F2F0EF]">
      <RentHero />
      <RentSteps />
      <PageCTA
        heading={<>Need help finding a <span className="text-cnc-gold">rental?</span></>}
        body="A CnC agent will work on your behalf — at no cost to you."
        primaryHref="/properties?listingType=FOR_LEASE"
        primaryLabel="Browse Rentals →"
        secondaryHref="/contact"
        secondaryLabel="Talk to an Agent"
      />
    </main>
  );
}
```

- [ ] **Step 2: Check dev server for errors**

Open `http://localhost:3000/rent` — section should appear between hero and CTA. No console errors expected.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/hey_r/Desktop/CnC-Realty && git add apps/web/src/components/ui/reveal-text.tsx apps/web/src/components/rent/RentSteps.tsx apps/web/src/app/\(marketing\)/rent/page.tsx && git commit -m "feat(rent): add RentSteps section — Fluid-style two-column layout"
```
