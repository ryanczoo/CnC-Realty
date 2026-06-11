# BuyContemporary — Curved Connector Lines Design

## Overview

Replace the existing straight connector lines in `BuyContemporary.tsx` with gentle quadratic bezier arcs. Lines start from the inner edge of each corner photo (the edge facing the logo), arc softly toward the center, and terminate at the CnC logo. Lines draw in after the images have fully settled at their corners.

## File Changed

`apps/web/src/components/buy/BuyContemporary.tsx` — only file touched.

## SVG Paths

Each path is a quadratic bezier: `M start Q controlPoint 720,470`

- **Start point**: the point where the current path (logo → image center) crosses the image border — i.e., the inner edge of each image facing the logo.
- **Control point**: midpoint between start and logo, offset ~70px clockwise perpendicular to the line. This makes all 4 arcs bow in the same rotational direction (pinwheel effect).
- **End point**: logo center `(720, 470)` (unchanged).

| Line | Start | Control | End | SVG path |
|---|---|---|---|---|
| topLeft | `282, 323` | `556, 327` | `720, 470` | `M 282,323 Q 556,327 720,470` |
| topRight | `929, 337` | `864, 468` | `720, 470` | `M 929,337 Q 864,468 720,470` |
| btmLeft | `400, 666` | `530, 614` | `720, 470` | `M 400,666 Q 530,614 720,470` |
| btmRight | `1118, 650` | `948, 618` | `720, 470` | `M 1118,650 Q 948,618 720,470` |

All coordinates are in the `0 0 1440 900` SVG viewBox.

## Animation

```ts
const lineProgress = useTransform(scrollYProgress, [0.57, 0.72], [0, 1]);
```

- Lines begin drawing at `p = 0.57` — just after images finish settling at corners (`p = 0.55`)
- Lines fully drawn at `p = 0.72` — as WHY CHOOSE overlay completes its fade-in
- Each `motion.path` uses `style={{ pathLength: lineProgress }}` (all 4 share one motion value)

**Previous range was `[0, 0.55]`** (drew during explosion). New range `[0.57, 0.72]` draws after explosion.

## Style

```
stroke="white"
strokeOpacity="0.18"
strokeWidth="1"
strokeLinecap="round"
```

Unchanged from current implementation.

## Implementation

Two changes only, both in `BuyContemporary.tsx`:

1. Replace `LINE_PATHS` constant with new quadratic bezier paths
2. Update `lineProgress` useTransform range from `[0, 0.55]` to `[0.57, 0.72]`

No new files, no new components, no new imports.
