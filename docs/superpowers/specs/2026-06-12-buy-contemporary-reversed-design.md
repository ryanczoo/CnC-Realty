# BuyContemporary — Reversed Scroll Animation

**Date:** 2026-06-12  
**File:** `apps/web/src/components/buy/BuyContemporary.tsx`  
**Scope:** Single-file rewrite of scroll animation timing. No other components affected.

---

## Goal

Reverse the `BuyContemporary` scroll animation so the section opens with the dramatic 4-corner state (WHY CHOOSE CnC visible), then draws connector lines from images to the logo as the user scrolls, then collapses the images into the RESULTS cluster.

---

## Current vs Proposed

| | Current | Proposed |
|---|---|---|
| **Start state** | Cluster (RESULTS heading) | Corners (WHY CHOOSE + logo) |
| **Phase 1** | Images explode to corners | Lines draw from images to logo |
| **Phase 2** | WHY CHOOSE fades in | Images collapse to cluster |
| **End state** | 4 corners + WHY CHOOSE | Cluster (RESULTS heading) |

---

## Animation Timeline

All values are `scrollYProgress` fractions (section is 400vh, sticky pinned for 300vh = p 0→0.75).

| Progress | Event |
|---|---|
| `p = 0.00` | Images at all 4 corners, WHY CHOOSE fully visible (opacity 1), no lines drawn |
| `p 0.00 → 0.45` | Connector lines draw from each image edge toward the logo center |
| `p 0.20 → 0.45` | WHY CHOOSE fades out (opacity 1 → 0) as lines approach logo |
| `p 0.45 → 1.00` | Images fly from corners to cluster positions |
| `p 0.50 → 0.72` | RESULTS heading fades in (opacity 0 → 1) |
| `p 0.55 → 0.72` | Watermark text fades in (opacity 0 → 0.12) |
| `p 0.45 → 0.75` | Gradient overlays on side images fade in (opacity 0 → 1) |
| `p 0.72 → 0.75` | Hold — cluster fully assembled, RESULTS visible |
| `p 0.75 → 1.00` | Sticky div scrolls off naturally |

---

## Transform Changes

Each `useTransform` / `ramp()` call is inverted. Start value becomes end value and vice versa; progress ranges shift to the collapse phase `[0.45, 1.0]`.

### Image positions (all 4 images)

| Image | Starts at | Moves to | Progress range |
|---|---|---|---|
| Center (`contemporary-01`) | `C.topLeft` corner, no offset | `K.center` cluster offset | `0.45 → 1.0` |
| Right (`contemporary-02`) | `C.topRight` corner, no offset | `K.right` cluster offset | `0.45 → 1.0` |
| Left (`contemporary-03`) | `C.btmLeft` corner, no offset | `K.left` cluster offset | `0.45 → 1.0` |
| Back (`contemporary-04`) | `C.btmRight` corner, no offset | `K.center` cluster offset | `0.45 → 1.0` |

Rotation on left/right images: `0 → ±3.5deg` over `[0.45, 1.0]` (acquires tilt as it joins cluster).

Back image opacity: starts at `1` (fully visible at corner), no fade needed.

### Opacity schedules

| Element | Old | New |
|---|---|---|
| `contemporaryOp` (RESULTS) | `ramp(p, 0.05, 0.28, 1, 0)` fade-out | `ramp(p, 0.50, 0.72, 0, 1)` fade-in |
| `floatOp` (watermark) | `ramp(p, 0, 0.22, 0.12, 0)` fade-out | `ramp(p, 0.55, 0.72, 0, 0.12)` fade-in |
| `overlayOp` (gradients) | `ramp(p, 0, 0.30, 1, 0)` fade-out | `ramp(p, 0.45, 0.75, 0, 1)` fade-in |
| `whyOp` (WHY CHOOSE) | `ramp(p, 0.50, 0.65, 0, 1)` fade-in | `ramp(p, 0.20, 0.45, 1, 0)` fade-out |
| `whyY` (WHY CHOOSE y) | `ramp(p, 0.50, 0.65, 28, 0)` slides up | `0` (static — already in final position at start) |
| `bckOp` (back image) | `ramp(p, 0.05, 0.40, 0, 1)` fade-in | constant `1` (visible from start) |

### Connector lines

```
lineProgress = useTransform(scrollYProgress, [0, 0.45], [0, 1])
```

Draws over the first scroll phase instead of the second. Path definitions (`LINE_PATHS`) are unchanged — they already go from image edge → logo center, which is the correct draw direction.

---

## What Does NOT Change

- `LINE_PATHS` — same bezier paths, same direction
- `C`, `K`, `CW`, `SC`, `POS_*` constants — unchanged
- Section height (`400vh`), sticky behavior — unchanged
- All image sources, sizes, z-indices — unchanged
- `FLOAT_ROWS` watermark content — unchanged
- JSX structure — same elements, only motion prop values change

---

## Risk

Low. All changes are confined to `useTransform` value ranges inside one file. The positions, paths, and JSX tree are untouched. Git history preserves the original if a revert is needed.
