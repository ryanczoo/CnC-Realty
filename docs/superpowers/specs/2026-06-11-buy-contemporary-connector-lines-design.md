# BuyContemporary — Connector Lines Design

## Overview

Add 4 animated SVG connector lines to `BuyContemporary.tsx` that draw outward from the CnC logo center to each corner photo as the images explode to their corners during scroll.

## File Changed

`apps/web/src/components/buy/BuyContemporary.tsx` — only file touched.

## SVG Overlay

A full-viewport `<svg>` added inside the sticky container, between the image layers (z-index 0–2) and the WHY CHOOSE content (z-index 20). Uses z-index 10.

```
viewBox="0 0 1440 900"
preserveAspectRatio="xMidYMid slice"
pointer-events-none
aria-hidden
className="absolute inset-0 h-full w-full"
```

## Line Endpoints

All coordinates are in the 1440×900 viewBox coordinate system.

**Logo center (x1/y1 for all 4 lines):** `(720, 470)`
- Derived from the WHY CHOOSE block's vertical centering. The block (WHY CHOOSE text + logo + body) is ~253px tall centered at 450px, placing the logo mark center at ~470px.

**Corner centers (x2/y2), from existing `C` constants × 1440/900:**

| Line | Corner | x2 | y2 |
|---|---|---|---|
| 1 | topLeft | 158 | 281 |
| 2 | topRight | 1062 | 252 |
| 3 | btmLeft | 282 | 738 |
| 4 | btmRight | 1252 | 711 |

## Animation

4 `useTransform` calls on `scrollYProgress`, one per line:

```ts
const lineProgress = useTransform(scrollYProgress, [0, 0.55], [0, 1]);
```

All 4 use the same range `[0, 0.55]` — synchronized with the explosion phase. `pathLength={lineProgress}` on each `<motion.line>`. Lines draw outward from logo center (x1/y1) toward each corner (x2/y2).

## Style (matches SellValues guide lines)

```
stroke="#1B1B1B"
strokeOpacity="0.07"
strokeWidth="1"
fill="none"
```

## Implementation Notes

- 4 `useTransform` calls + 1 SVG block ≈ 25 lines added
- All 4 lines share a single motion value (identical range) — only one `useTransform` needed
- No new components, no new files
- No React re-renders — Framer Motion writes `pathLength` directly to SVG DOM
