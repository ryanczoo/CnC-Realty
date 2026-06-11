# BuyContemporary Connector Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 animated SVG connector lines to BuyContemporary.tsx that draw outward from the CnC logo center to each corner photo as the scroll explosion plays.

**Architecture:** A single `useTransform` drives `pathLength` on 4 `<motion.path>` elements inside a full-viewport SVG overlay. All 4 lines share the same motion value (identical animation range). No new files, no new components.

**Tech Stack:** Framer Motion (`motion/react`) — `useTransform`, `motion.path`, `pathLength`

---

## File Structure

| File | Change |
|---|---|
| `apps/web/src/components/buy/BuyContemporary.tsx` | Add `lineProgress` motion value + SVG overlay with 4 `motion.path` lines |

---

### Task 1: Add connector lines to BuyContemporary

**Files:**
- Modify: `apps/web/src/components/buy/BuyContemporary.tsx`

- [ ] **Step 1: Add `lineProgress` motion value**

Open `apps/web/src/components/buy/BuyContemporary.tsx`. Find the block of `useTransform` calls that ends with:

```ts
const whyOp = useTransform(scrollYProgress, (p) => ramp(p, 0.50, 0.65, 0, 1));
const whyY  = useTransform(scrollYProgress, (p) => ramp(p, 0.50, 0.65, 28, 0));
```

Add one line immediately after:

```ts
const lineProgress = useTransform(scrollYProgress, [0, 0.55], [0, 1]);
```

- [ ] **Step 2: Add SVG overlay to JSX**

Inside the sticky container div (`<div className="sticky top-0 h-screen overflow-hidden bg-[#1B1B1B]">`), find the comment `{/* WHY CHOOSE CnC? */}` and insert the following block **immediately before it**:

```tsx
{/* Connector lines — draw outward from logo center to each corner */}
<svg
  className="pointer-events-none absolute inset-0 h-full w-full"
  viewBox="0 0 1440 900"
  preserveAspectRatio="xMidYMid slice"
  fill="none"
  aria-hidden
  style={{ zIndex: 10 }}
>
  {[
    "M 720,470 L 158,281",
    "M 720,470 L 1062,252",
    "M 720,470 L 282,738",
    "M 720,470 L 1252,711",
  ].map((d, i) => (
    <motion.path
      key={i}
      d={d}
      stroke="#1B1B1B"
      strokeOpacity="0.07"
      strokeWidth="1"
      strokeLinecap="round"
      style={{ pathLength: lineProgress }}
    />
  ))}
</svg>
```

Corner coordinates (1440×900 viewBox, from `C` constants × viewport):
- `158,281` = topLeft (C.topLeft.cx × 1440, C.topLeft.cy × 900)
- `1062,252` = topRight
- `282,738` = btmLeft
- `1252,711` = btmRight
- `720,470` = logo center (WHY CHOOSE block centered at 50vw, ~52vh)

- [ ] **Step 3: Verify dev server compiles with no errors**

Check the terminal running `pnpm --filter web dev`. Expect no TypeScript or runtime errors. If there's a type error on `style={{ zIndex: 10 }}` on the SVG, change it to `className` with an inline `z-[10]` Tailwind class instead.

- [ ] **Step 4: Visual review in browser**

Open `http://localhost:3000/buy` and scroll slowly into the BuyContemporary section. Expected:

1. At the start of the section — no lines visible
2. As images begin flying to corners (scroll into explosion) — 4 faint dark lines begin drawing outward from the center logo position toward each corner
3. Lines complete drawing as images arrive at corners (~55% through the sticky section)
4. Lines remain visible through the "hold" state and WHY CHOOSE overlay

If the lines are too visible, decrease `strokeOpacity` (try `0.05`). If they're invisible, increase to `0.10`.

If the logo center position looks off (lines don't emanate from the logo mark), adjust `y1` from `470` toward `430` or `490` until visually aligned.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/buy/BuyContemporary.tsx
git commit -m "feat(buy): add animated connector lines from logo to corner photos"
```
