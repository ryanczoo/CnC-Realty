# Buy Page — BuySteps Scroll Section

**Date:** 2026-06-04  
**Status:** Approved  
**Component:** `apps/web/src/components/buy/BuySteps.tsx`

---

## Overview

A scroll-driven two-column section on the buy page, inspired by the Volta SKAI `.scroll-cards` layout. The left panel stays sticky while the right panel scrolls through 4 stacked images. As the user scrolls, the active step's heading, body, and counter update on the left. The "How it Works" grid section is removed and replaced entirely by this component.

---

## Content — 4 Steps

| # | Title | Body |
|---|-------|------|
| 1 | Get Pre-Approved | Connect with a lender to understand your budget before you fall in love with a home. Our agents can refer you to trusted local lenders. |
| 2 | Find Your Agent | Every CnC agent is a local California expert. Match with someone who knows your target neighborhoods inside and out. |
| 3 | Search & Tour | Browse live CRMLS listings updated every 15 minutes. Schedule tours directly and move fast when the right home appears. |
| 4 | Closing Escrow | From offer to keys, your CnC agent handles the contracts, negotiations, inspections, and escrow — so you can focus on the move. |

---

## Visual Design

- **Background:** `bg-[#F2F0EF]`
- **Section:** `position: relative`, `height: 500vh`
- **Sticky inner panel:** `position: sticky, top: 0, height: 100vh, overflow: hidden`
- **Split:** left 42%, right 58%

### Left panel (sticky)

- **Counter** — top-left, `"N / 4"` in gold `#9E8C61`, `font-sans text-sm tracking-widest uppercase`
- **Vertical segmented progress bar** — identical to WhyCnC:
  - `position: absolute, left: 14, top: 50%, -translate-y-1/2`
  - `width: 2px, height: 220px`
  - 4 equal segments with `gap-1` between them
  - Track: `rgba(27,27,27,0.12)`, fill: `#1B1B1B`
  - Each segment fills top-to-bottom via `height: barWidths[i]%`
- **Step heading** — large, `font-sans font-light text-[3.5rem] xl:text-[4.5rem] leading-tight text-[#1B1B1B]`, changes per step
- **Body text** — `font-sans text-lg font-light text-[#1B1B1B]/60 max-w-sm`, changes per step
- **Transitions** — `AnimatePresence mode="wait"` (same exit/enter as WhyCnC: `y: -44` exit, stagger children enter)

### Right panel (scrolling, not sticky)

- 4 images stacked vertically, each `height: 85vh`
- `rounded-2xl overflow-hidden` on each image wrapper
- `gap-6` between images
- `padding-top: 7.5vh, padding-bottom: 7.5vh` to vertically center the first/last image in viewport
- `object-cover` fill
- Placeholder images: `/images/sell/sell-06.jpg` → `sell-09.jpg` (Ryan to swap real photos)

---

## Scroll Mechanism

```ts
// Outer section ref → useScroll → scrollYProgress 0→1
// useScrollStepper(scrollYProgress, 4) → { activeIdx, barWidths, scrollDirRef }
// activeIdx drives: heading, body, counter
// barWidths drives: progress bar segment heights
```

`useScrollStepper` and `computeSegmentProgress` already exist — reuse exactly.

---

## Page Changes (`buy/page.tsx`)

1. **Remove** the entire `<section className="border-t border-[#1B1B1B]/8 px-8 py-24 lg:px-20">` How it Works block (including the `STEPS` const and grid)
2. **Add** `import { BuySteps } from "@/components/buy/BuySteps"`
3. **Place** `<BuySteps />` between the hero `<section>` and `<PageCTA />`

---

## File Map

| Action | File |
|--------|------|
| Create | `apps/web/src/components/buy/BuySteps.tsx` |
| Modify | `apps/web/src/app/(marketing)/buy/page.tsx` |

---

## Out of Scope

- Real buy-page photos (Ryan to provide)
- Mobile layout tweaks beyond basic responsiveness
- Click-to-jump navigation between steps
