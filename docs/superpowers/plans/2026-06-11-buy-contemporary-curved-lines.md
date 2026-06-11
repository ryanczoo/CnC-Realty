# BuyContemporary Curved Connector Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4 straight `L` connector lines in BuyContemporary with quadratic bezier arcs that start from each image's inner edge and draw in after the images have settled at their corners.

**Architecture:** Two targeted edits in `BuyContemporary.tsx`: replace the `LINE_PATHS` string array with quadratic bezier paths, and shift the `lineProgress` animation window from `[0, 0.55]` (during explosion) to `[0.57, 0.72]` (after images settle). No new files, no new imports, no structural changes.

**Tech Stack:** Framer Motion (`motion/react`) — `useTransform`, `motion.path`, `pathLength`

---

## File Structure

| File | Change |
|---|---|
| `apps/web/src/components/buy/BuyContemporary.tsx` | Replace `LINE_PATHS` + update `lineProgress` range |

---

### Task 1: Replace straight lines with quadratic bezier curves

**Files:**
- Modify: `apps/web/src/components/buy/BuyContemporary.tsx` lines 62–67 and line 147

- [ ] **Step 1: Update `LINE_PATHS`**

Open `apps/web/src/components/buy/BuyContemporary.tsx`. Find the `LINE_PATHS` constant (currently lines 61–67):

```ts
// Connector line paths — logo center (720,470) to each corner image center.
const LINE_PATHS = [
  "M 720,470 L 158,281",
  "M 720,470 L 1062,252",
  "M 720,470 L 282,738",
  "M 720,470 L 1252,711",
];
```

Replace it with:

```ts
// Connector line paths — quadratic bezier arcs from each image's inner edge to logo center.
// Start = where the direct logo→image-center line crosses the image border.
// Control point = midpoint offset ~70px clockwise-perpendicular for a consistent bow direction.
const LINE_PATHS = [
  "M 282,323 Q 556,327 720,470",   // topLeft  — right edge → logo
  "M 929,337 Q 864,468 720,470",   // topRight — left edge  → logo
  "M 400,666 Q 530,614 720,470",   // btmLeft  — right edge → logo
  "M 1118,650 Q 948,618 720,470",  // btmRight — left edge  → logo
];
```

- [ ] **Step 2: Update `lineProgress` animation range**

In the same file, find line 147:

```ts
  const lineProgress = useTransform(scrollYProgress, [0, 0.55], [0, 1]);
```

Replace with:

```ts
  const lineProgress = useTransform(scrollYProgress, [0.57, 0.72], [0, 1]);
```

This shifts the draw animation to start just after images settle at corners (`p=0.55`) and finish as the WHY CHOOSE overlay completes (`p=0.72`).

- [ ] **Step 3: Verify dev server compiles with no errors**

Check the terminal running `pnpm --filter web dev`. Expect:
```
✓ Compiled in Xs (NNNN modules)
```
No TypeScript or runtime errors.

- [ ] **Step 4: Visual verification in browser**

Open `http://localhost:3000/buy` and scroll into the BuyContemporary section. Expected behavior:

1. **During explosion** (`p=0–0.55`): no lines visible — lines have not started drawing yet
2. **Just after images settle** (`p≈0.57`): 4 faint white arcs begin drawing from the inner edge of each corner photo toward the logo center
3. **By `p=0.72`**: all 4 arcs fully drawn, curving gently as they converge on the logo
4. **Hold state** (`p=0.65–0.75`): WHY CHOOSE overlay and arcs both visible together

If the arc bow direction looks wrong or the control points need tuning, adjust the control point coordinates in `LINE_PATHS`. To increase curve depth, move the control point further from the midpoint. To decrease, move it closer to the midpoint.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/buy/BuyContemporary.tsx
git commit -m "feat(buy): replace straight connector lines with quadratic bezier arcs"
```
