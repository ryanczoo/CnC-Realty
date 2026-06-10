# Rent Page — Popular Cities Slider

**Date:** 2026-06-10  
**Status:** Approved

## Overview

A new section added to the `/rent` page between `<RentSteps />` and `<PageCTA />`. Dark-background photo slider showing 5 major California cities with city name overlaid on each photo, auto-advancing every 5 seconds. Inspired by Burkhard Projekte's projects slider, adapted to CnC's Framer Motion animation language.

## Component

**File:** `apps/web/src/components/rent/RentCitiesSlider.tsx`  
**Page:** `apps/web/src/app/(marketing)/rent/page.tsx` — inserted between `<RentSteps />` and `<PageCTA />`

## Section Layout

- Background: `bg-[#1B1B1B]`
- Padding: `py-20`
- Top: "Popular Cities" heading — `flex justify-end`, same `RevealLine` pattern as "Our Promise" in `SellQuote.tsx`
  - Line 1 (smaller): `text-[1.9rem] xl:text-[2.2rem]` → "Popular "
  - Line 2 (gold, font-medium): `text-[2.5rem] xl:text-[3rem]` → "Cities"
- Center: slider viewport, `overflow: hidden`, relative container
- Bottom: arrow buttons centered

## Slider Mechanics

Three slides always mounted simultaneously:
- **Prev slide:** `position: absolute`, `x: -72%`, `opacity: 0.45`, `scale: 0.88`
- **Active slide:** centered, `x: 0`, `opacity: 1`, `scale: 1.0`
- **Next slide:** `position: absolute`, `x: +72%`, `opacity: 0.45`, `scale: 0.88`

Transition via `AnimatePresence` with `custom={direction}` (`+1` = forward, `-1` = backward):
- Enter: `x: direction * 80, opacity: 0, scale: 0.9` → `x: 0, opacity: 1, scale: 1`
- Exit: `x: 0, opacity: 1, scale: 1` → `x: direction * -80, opacity: 0, scale: 0.9`
- Duration: `0.6s`, easing: `EASE_OUT_EXPO` from `lib/motion.ts`

Auto-advance: `useEffect` + `setInterval(5000ms)`. Pauses on hover via `isHovered` state.

## Slide Card

- Width: `65vw`, max-width `900px`
- Aspect ratio: `16/9`
- `rounded-2xl`, `overflow-hidden`
- Full-bleed `next/image` photo with `objectFit: cover`
- Dark overlay: `bg-black/40` (same as `SellValues` cards)
- City name: centered absolutely, `font-sans font-light text-white text-[2.2rem] xl:text-[2.6rem]`

## Cities (5 placeholder photos)

1. Los Angeles
2. San Francisco
3. San Diego
4. Sacramento
5. San Jose

Placeholder images from Unsplash/Pexels until real photos are sourced.

## Arrow Buttons

- Same SVG path as `DownArrow.tsx` (`components/ui/DownArrow.tsx:14`)
- Left arrow: `rotate-90` (points left)
- Right arrow: `-rotate-90` (points right)
- Wrapper: `border border-white/50 rounded-full p-3` — thin white circle border
- `PULSE_ANIMATE` + `PULSE_TRANSITION` at idle, `whileHover={{ scale: 1.05 }}` + `SPRING_HOVER`
- Positioned: `flex gap-6 justify-center mt-12`

## Direction Logic

```
forward click / auto-advance → direction = +1, activeIdx = (activeIdx + 1) % 5
backward click               → direction = -1, activeIdx = (activeIdx + 4) % 5
```

## No Dot Navigation

Dots are not included — the arrows are the only navigation controls.
