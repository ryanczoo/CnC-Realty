# RentSteps Section — Design Spec

**Date:** 2026-06-09  
**Page:** `/rent`  
**Placement:** Immediately after `<RentHero />`, before the existing PERKS grid (which will be removed)

---

## Reference

Fluid Real Estate (findrealestate.com) — the two-column "Real Estate, Rewired." + "Steps:" section.  
Puppeteer measurements taken at 1440×900.

---

## Layout

Two-column flex row inside a standard CnC section container:

| Property | Value |
|---|---|
| Background | `#F2F0EF` (`bg-cnc-bg`) |
| Section padding | `~112px` top/bottom → `py-28` |
| Container padding | `0 75px` → `px-[75px]` |
| Row | `flex`, `gap: ~40px` → `gap-10` |
| Left col | `flex: 1` — fills remaining space |
| Right col | `flex: 0 0 ~57%` — fixed, holds the steps list |

---

## Left Column

- **Heading** — two lines, `RevealLine` clip-path animation (same as buy page section titles):
  - Line 1: dark (`#1B1B1B`), e.g. "Real Estate,"
  - Line 2: gray (`#b3b3b3`), e.g. "Rewired."
  - Font: `font-sans font-medium`, `text-[54px]`, `leading-none`
- **CTA button** below heading, `mt-8`:
  - Dark pill (`bg-[#1B1B1B] text-white rounded-full`)
  - "Start Your Search →"
  - Uses `PULSE_ANIMATE` + `PULSE_TRANSITION` + `whileHover` spring (sitewide button standard)
  - `href="/properties?listingType=FOR_LEASE"`

---

## Right Column

- **"Steps:" label** — `text-2xl font-medium text-[#1B1B1B]`, `mb-6`
- **3 list rows** — each:
  - `flex items-center gap-10`
  - `py-6`
  - `border-t border-[#1B1B1B]/[0.07]`
  - Number: `text-[15px] text-[#b3b3b3] font-normal w-8 shrink-0` (`01`, `02`, `03`)
  - Text: `text-[2.1rem] font-medium leading-[1.15]`
    - Bold phrase: `text-[#1B1B1B]`
    - Continuation: `text-[#b3b3b3]`

---

## Animations

- `RevealLine` on the heading (scroll-triggered, `once: true`)
- Staggered `fadeUp` on each list row (from `lib/motion.ts`), `delay: i * 0.12`

---

## File

**New:** `apps/web/src/components/rent/RentSteps.tsx`  
**Edit:** `apps/web/src/app/(marketing)/rent/page.tsx` — replace PERKS grid section with `<RentSteps />`

---

## Out of Scope

- The existing `PageCTA` stays below `RentSteps`
- Text content is placeholder (user will replace)
