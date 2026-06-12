# BuyContemporary Reversed Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reverse the BuyContemporary scroll animation so it opens with photos at 4 corners + WHY CHOOSE visible, draws connector lines toward the logo, then collapses images into the RESULTS cluster.

**Architecture:** Single file rewrite of `useTransform` / `ramp()` progress ranges in `BuyContemporary.tsx`. All positions, paths, constants, and JSX structure are unchanged — only timing values and opacity directions are inverted.

**Tech Stack:** Framer Motion (`useTransform`, `useScroll`), `ramp()` from `lib/motion.ts`

---

### Task 1: Rewrite all transforms in BuyContemporary.tsx

**Files:**
- Modify: `apps/web/src/components/buy/BuyContemporary.tsx:99-150`

- [ ] **Step 1: Replace the entire block of `useTransform` calls (lines 99–150) with the reversed versions below**

Replace everything from `// ── Center image →` through `const lineProgress = ...` with:

```tsx
// ── Center image: from top-left corner → cluster center ─────────────────────
const ctrX = useTransform(scrollYProgress, (p) =>
  ramp(p, 0.45, 1.0, 0, (K.center.cx - C.topLeft.cx) * vwRef.current)
);
const ctrY = useTransform(scrollYProgress, (p) =>
  ramp(p, 0.45, 1.0, 0, (K.center.cy - C.topLeft.cy) * vhRef.current)
);
const ctrSc = useTransform(scrollYProgress, (p) => ramp(p, 0.45, 1.0, 1, SC.center));

// ── Left image: from bottom-left corner → cluster left ──────────────────────
const lftX = useTransform(scrollYProgress, (p) =>
  ramp(p, 0.45, 1.0, 0, (K.left.cx - C.btmLeft.cx) * vwRef.current)
);
const lftY = useTransform(scrollYProgress, (p) =>
  ramp(p, 0.45, 1.0, 0, (K.left.cy - C.btmLeft.cy) * vhRef.current)
);
const lftSc  = useTransform(scrollYProgress, (p) => ramp(p, 0.45, 1.0, 1, SC.left));
const lftRot = useTransform(scrollYProgress, (p) => ramp(p, 0.45, 1.0, 0, -3.5));

// ── Right image: from top-right corner → cluster right ──────────────────────
const rgtX = useTransform(scrollYProgress, (p) =>
  ramp(p, 0.45, 1.0, 0, (K.right.cx - C.topRight.cx) * vwRef.current)
);
const rgtY = useTransform(scrollYProgress, (p) =>
  ramp(p, 0.45, 1.0, 0, (K.right.cy - C.topRight.cy) * vhRef.current)
);
const rgtSc  = useTransform(scrollYProgress, (p) => ramp(p, 0.45, 1.0, 1, SC.right));
const rgtRot = useTransform(scrollYProgress, (p) => ramp(p, 0.45, 1.0, 0, 3.5));

// ── Back image: from bottom-right corner → cluster center (behind) ───────────
const bckX = useTransform(scrollYProgress, (p) =>
  ramp(p, 0.45, 1.0, 0, (K.center.cx - C.btmRight.cx) * vwRef.current)
);
const bckY = useTransform(scrollYProgress, (p) =>
  ramp(p, 0.45, 1.0, 0, (K.center.cy - C.btmRight.cy) * vhRef.current)
);
const bckSc = useTransform(scrollYProgress, (p) => ramp(p, 0.45, 1.0, 1, SC.back));

// Gradient overlays: absent at corners, fade in as images cluster.
const overlayOp = useTransform(scrollYProgress, (p) => ramp(p, 0.45, 0.75, 0, 1));

// RESULTS heading: invisible at start, fades in as cluster forms.
const contemporaryOp = useTransform(scrollYProgress, (p) => ramp(p, 0.50, 0.72, 0, 1));

// Watermark text: invisible at start, fades in as cluster forms.
const floatOp = useTransform(scrollYProgress, (p) => ramp(p, 0.55, 0.72, 0, 0.12));

// WHY CHOOSE CnC?: fully visible at start, fades out as lines reach logo.
const whyOp = useTransform(scrollYProgress, (p) => ramp(p, 0.20, 0.45, 1, 0));

// Lines draw from images toward logo over the first scroll phase.
const lineProgress = useTransform(scrollYProgress, [0, 0.45], [0, 1]);
```

- [ ] **Step 2: Remove `whyY` from the WHY CHOOSE motion div**

Find this in the JSX (around line 242):
```tsx
<motion.div
  style={{ opacity: whyOp, y: whyY, zIndex: 20 }}
```
Change to:
```tsx
<motion.div
  style={{ opacity: whyOp, zIndex: 20 }}
```

- [ ] **Step 3: Remove `bckOp` from the back image motion div and set opacity to 1**

Find (around line 237):
```tsx
<motion.div style={{ ...POS_BTM_RIGHT, x: bckX, y: bckY, scale: bckSc, opacity: bckOp, zIndex: 0 }}>
```
Change to:
```tsx
<motion.div style={{ ...POS_BTM_RIGHT, x: bckX, y: bckY, scale: bckSc, zIndex: 0 }}>
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `pnpm --filter web build 2>&1 | grep -i error`

Expected: no new errors (pre-existing errors unrelated to this change are acceptable — check git diff to confirm any errors aren't from these edits)

- [ ] **Step 5: Visual check at localhost:3000/buy**

Scroll through the BuyContemporary section. Confirm:
1. Section opens with all 4 photos at corners, WHY CHOOSE + logo visible, no lines
2. Scrolling draws lines from each image toward the logo
3. WHY CHOOSE fades out as lines approach the logo
4. Images then fly from corners toward center, forming the cluster
5. RESULTS heading and watermark text fade in as cluster assembles

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/buy/BuyContemporary.tsx docs/superpowers/specs/2026-06-12-buy-contemporary-reversed-design.md docs/superpowers/plans/2026-06-12-buy-contemporary-reversed.md
git commit -m "feat(buy): reverse BuyContemporary animation — corners→lines→cluster"
```
