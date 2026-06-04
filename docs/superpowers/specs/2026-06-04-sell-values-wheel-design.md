# Sell Page — "Our Values" Wheel Section

**Date:** 2026-06-04  
**Status:** Approved  
**Component:** `apps/web/src/components/sell/SellValues.tsx`

---

## Overview

A scroll-driven image wheel section added to the sell page directly after `SellProcess`. Five image cards are arranged on the lower arc of a large invisible circle. As the user scrolls, the wheel rotates so each card passes through the center (active) position, moving right-to-left — identical in mechanic to the "Azure Projects" section on azure.sa/about.

---

## Visual Design

- **Background:** `#F2F0EF` (`bg-cnc-bg`) — off-white, matching the light section block
- **Section title:** Top-centered, using `RevealLine` (same component as "Our Process"):
  - `"Our "` — `font-sans font-light text-[1.9rem] xl:text-[2.2rem]` in dark (`#1B1B1B`)
  - `"Values"` — gold `#9E8C61`, `text-[2.5rem] xl:text-[3rem]`
- **Arc guide lines:** Two faint concentric SVG arcs drawn behind the cards, dark `#1B1B1B` at 10% opacity, matching Azure's aesthetic adapted for a light background
- **Cards:** Rounded corners (`rounded-2xl`), portrait orientation (~`300×390px` at full size), `overflow-hidden`, drop shadow on active card

---

## Cards — 5 Values

| Index | Label |
|-------|-------|
| 0 | Respect |
| 1 | Punctuality |
| 2 | Attention to Detail |
| 3 | Compassion |
| 4 | Integrity |

Each card shows:
- Full-bleed placeholder image (using `/images/sell/sell-10.jpg` etc. rotated — real photos provided later)
- Value label in white, bottom-left, `font-sans font-light text-lg`

---

## Animation Mechanics

### Sticky container
- Outer `<section>` is `relative` with height `500vh` — provides scroll distance
- Inner `div` is `position: sticky; top: 0; height: 100vh` — stays pinned while parent scrolls

### Scroll binding
```ts
const ref = useRef<HTMLDivElement>(null);
const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
```
`scrollYProgress` goes 0 → 1 as the section scrolls through.

### Circle geometry
Cards sit on the bottom arc of a large circle. The circle has radius `R` (responsive: ~`650px` desktop, ~`420px` mobile). The circle center is positioned above the viewport mid-point so only the bottom arc is visible.

Each card `i` has a **base angle** distributed across a 120° arc centered at the bottom (270° in standard math = 6 o'clock position):

```
baseAngle[i] = 270° + (i - 2) * SPREAD°   // SPREAD = 28°
// i=0: 214°  i=1: 242°  i=2: 270° (bottom/center)  i=3: 298°  i=4: 326°
```

### Scroll-driven rotation
`scrollYProgress` is transformed to a rotation offset of `-120°` to `0°` (i.e., the wheel rotates CCW as you scroll, carrying cards from right to center to left):

```ts
const wheelRotation = useTransform(scrollYProgress, [0, 1], [60, -60]); // degrees
```

Each card's rendered angle = `baseAngle[i] + wheelRotation`.

### Card position (polar → cartesian)
```ts
const x = cx + R * cos(angle)
const y = cy + R * sin(angle)  // cy = center of circle above viewport
```

Cards are positioned `absolute` within the sticky panel, centered at `(x, y)` via `transform: translate(-50%, -50%)`.

### Scale + opacity by distance from center (270°)
```ts
const distFromCenter = |normalizedAngle - 270°|
scale:   1.0 → 0.65  as dist goes 0° → 56°
opacity: 1.0 → 0.45  as dist goes 0° → 56°
```

### Card tilt
Each card is also rotated by `(angle - 270°) * 0.4` degrees so outer cards tilt naturally along the arc tangent.

---

## Component Structure

```
SellValues (section, 500vh, relative)
  └── sticky panel (100vh, sticky top-0)
        ├── title (absolute, top-12, left-0 right-0, text-center)
        │     └── h2 > RevealLine > "Our " + "Values"
        ├── arc SVGs (absolute, centered, pointer-events-none)
        └── cards container (absolute, fill panel)
              └── [×5] MotionCard (absolute, position via polar coords)
                    ├── image (fill)
                    └── label (absolute bottom-4 left-4)
```

Each card is a `motion.div` with `style={{ x, y, scale, opacity, rotate }}` driven by `useTransform` on `scrollYProgress`.

---

## Page Integration

In `apps/web/src/app/(marketing)/sell/page.tsx`:
- Import `SellValues`
- Place it **inside** the `data-navbar-theme="light"` + `bg-[#F2F0EF]` wrapper, directly after `<SellProcess />`

```tsx
<div data-navbar-theme="light" className="bg-[#F2F0EF]">
  <SellProcess />
  <SellValues />        {/* ← new */}
  <GradientBridge ... />
  ...
</div>
```

---

## Responsive

- Desktop (≥1024px): `R = 650px`, card `300×390px`, spread `28°`
- Mobile (<1024px): `R = 380px`, card `180×235px`, spread `32°`
- On very small screens the outer cards clip — acceptable; `overflow-hidden` on the sticky panel handles this

---

## Placeholder Images

Until real photos are provided, use existing sell page images rotated across the 5 cards:
`/images/sell/sell-1.jpg` through `/images/sell/sell-5.jpg` (or whichever exist).

---

## Out of Scope

- Drag/swipe to spin the wheel (mobile touch)
- Click-to-focus a card
- Caption text beyond the single label
