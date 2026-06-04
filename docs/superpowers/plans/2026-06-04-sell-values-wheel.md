# SellValues Wheel Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scroll-driven image wheel section ("Our Values") to the sell page, where 5 photo cards rotate along a half-circle arch as the user scrolls — identical in mechanic to azure.sa/about's "Azure Projects" section.

**Architecture:** A tall `<section>` (500vh) with a sticky inner panel (100vh) gives the scroll distance. `useScroll` tracks progress 0→1 across the outer section. 25 `useTransform` calls (5 cards × x, y, scale, opacity, rotate) convert scroll progress to each card's polar position on the arc. Cards are absolutely positioned at `left:50%; top:50%` and offset via Framer Motion's `x`/`y` style props.

**Tech Stack:** Next.js 14, `motion/react` (useScroll, useTransform, motion.div), `RevealLine` from `@/components/ui/reveal-text`, `next/image`, Tailwind CSS.

---

## File Map

| Action | File |
|--------|------|
| **Create** | `apps/web/src/components/sell/SellValues.tsx` |
| **Modify** | `apps/web/src/app/(marketing)/sell/page.tsx` |

---

## Task 1: Create `SellValues.tsx`

**Files:**
- Create: `apps/web/src/components/sell/SellValues.tsx`

### Circle geometry (read before coding)

5 cards are placed on the lower half of an invisible circle. The circle center sits **above** the sticky panel so only the bottom arc is visible.

```
Circle center (cx, cy_css):
  cx      = 0 px from panel horizontal center
  cy_css  = panelH * 0.15 - R        (above panel center)

Card[i] angle:
  angleDeg = 270 + (i - 2) * SPREAD + wheelRotation
  (270° = 6-o'clock = bottom of circle in CSS coordinates)

Scroll → wheelRotation mapping:
  t=0   → wr=+60  → card[0] (Respect)            at 270° (center)
  t=0.25→ wr=+30  → card[1] (Punctuality)         at 270°
  t=0.5 → wr=  0  → card[2] (Attention to Detail) at 270°
  t=0.75→ wr=-30  → card[3] (Compassion)           at 270°
  t=1   → wr=-60  → card[4] (Integrity)            at 270°

Card center position (relative to panel center):
  x = R * cos(angleRad) - CW/2     (CW = card width, for self-centering)
  y = cy_css - R * sin(angleRad) - CH/2   (CSS y is flipped: -sin)

Scale / opacity by distance from active (frac = dist_degrees / SPREAD, clamped 0–2):
  scale   = max(0.64, 1 - frac * 0.18)
  opacity = max(0.42, 1 - frac * 0.29)
  rotate  = (angleDeg - 270) * 0.42   (tangent tilt)
```

- [ ] **Step 1: Write `SellValues.tsx`**

```tsx
"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { RevealLine } from "@/components/ui/reveal-text";

const SPREAD = 30; // degrees between adjacent cards
const WR_START =  2 * SPREAD; //  60 — card[0] at center when scroll=0
const WR_END   = -2 * SPREAD; // -60 — card[4] at center when scroll=1

const VALUES = [
  { label: "Respect",             img: "/images/sell/sell-01.jpg" },
  { label: "Punctuality",         img: "/images/sell/sell-02.jpg" },
  { label: "Attention to Detail", img: "/images/sell/sell-03.jpg" },
  { label: "Compassion",          img: "/images/sell/sell-04.jpg" },
  { label: "Integrity",           img: "/images/sell/sell-05.jpg" },
];

function cardVars(i: number, t: number) {
  const mobile  = typeof window !== "undefined" && window.innerWidth < 1024;
  const R       = mobile ? 360 : 660;
  const CW      = mobile ? 160 : 300;
  const CH      = mobile ? 208 : 390;
  const panelH  = typeof window !== "undefined" ? window.innerHeight : 900;

  const wr       = WR_START + t * (WR_END - WR_START);
  const angleDeg = 270 + (i - 2) * SPREAD + wr;
  const angleRad = angleDeg * (Math.PI / 180);

  // Circle center offset from panel center (px, CSS y-down)
  const CY = panelH * 0.15 - R;

  // Card center offset from panel center
  const x = R * Math.cos(angleRad) - CW / 2;
  const y = CY - R * Math.sin(angleRad) - CH / 2;

  // Distance from active position (270°), normalised by SPREAD
  const raw  = ((angleDeg % 360) + 360) % 360;
  const dist = Math.min(Math.abs(raw - 270), 360 - Math.abs(raw - 270));
  const frac = Math.min(dist / SPREAD, 2);

  return {
    x,
    y,
    scale:   Math.max(0.64, 1 - frac * 0.18),
    opacity: Math.max(0.42, 1 - frac * 0.29),
    rotate:  (angleDeg - 270) * 0.42,
  };
}

export function SellValues() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // 25 motion values: 5 cards × {x, y, scale, opacity, rotate}
  // Must be declared at top level — hooks cannot live in loops
  const x0  = useTransform(scrollYProgress, t => cardVars(0, t).x);
  const y0  = useTransform(scrollYProgress, t => cardVars(0, t).y);
  const s0  = useTransform(scrollYProgress, t => cardVars(0, t).scale);
  const o0  = useTransform(scrollYProgress, t => cardVars(0, t).opacity);
  const ro0 = useTransform(scrollYProgress, t => cardVars(0, t).rotate);

  const x1  = useTransform(scrollYProgress, t => cardVars(1, t).x);
  const y1  = useTransform(scrollYProgress, t => cardVars(1, t).y);
  const s1  = useTransform(scrollYProgress, t => cardVars(1, t).scale);
  const o1  = useTransform(scrollYProgress, t => cardVars(1, t).opacity);
  const ro1 = useTransform(scrollYProgress, t => cardVars(1, t).rotate);

  const x2  = useTransform(scrollYProgress, t => cardVars(2, t).x);
  const y2  = useTransform(scrollYProgress, t => cardVars(2, t).y);
  const s2  = useTransform(scrollYProgress, t => cardVars(2, t).scale);
  const o2  = useTransform(scrollYProgress, t => cardVars(2, t).opacity);
  const ro2 = useTransform(scrollYProgress, t => cardVars(2, t).rotate);

  const x3  = useTransform(scrollYProgress, t => cardVars(3, t).x);
  const y3  = useTransform(scrollYProgress, t => cardVars(3, t).y);
  const s3  = useTransform(scrollYProgress, t => cardVars(3, t).scale);
  const o3  = useTransform(scrollYProgress, t => cardVars(3, t).opacity);
  const ro3 = useTransform(scrollYProgress, t => cardVars(3, t).rotate);

  const x4  = useTransform(scrollYProgress, t => cardVars(4, t).x);
  const y4  = useTransform(scrollYProgress, t => cardVars(4, t).y);
  const s4  = useTransform(scrollYProgress, t => cardVars(4, t).scale);
  const o4  = useTransform(scrollYProgress, t => cardVars(4, t).opacity);
  const ro4 = useTransform(scrollYProgress, t => cardVars(4, t).rotate);

  const MOTION = [
    { x: x0, y: y0, scale: s0, opacity: o0, rotate: ro0 },
    { x: x1, y: y1, scale: s1, opacity: o1, rotate: ro1 },
    { x: x2, y: y2, scale: s2, opacity: o2, rotate: ro2 },
    { x: x3, y: y3, scale: s3, opacity: o3, rotate: ro3 },
    { x: x4, y: y4, scale: s4, opacity: o4, rotate: ro4 },
  ];

  return (
    <section ref={sectionRef} className="relative" style={{ height: "500vh" }}>
      {/* ── Sticky panel ── */}
      <div className="sticky top-0 h-screen overflow-hidden bg-cnc-bg">

        {/* Title — top center, same pattern as "Our Process" */}
        <div className="absolute inset-x-0 top-12 flex justify-center">
          <h2 className="font-sans text-[2.5rem] font-light xl:text-[3rem]">
            <RevealLine>
              <span className="text-[1.9rem] xl:text-[2.2rem]">Our </span>
              <span style={{ color: "#9E8C61" }}>Values</span>
            </RevealLine>
          </h2>
        </div>

        {/* Arc guide lines — two faint concentric ellipses, clipped by overflow:hidden */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          aria-hidden
        >
          {/* Outer arc — R≈660, center at (720, -75) so bottom sits at y≈585 */}
          <ellipse cx="720" cy="-75" rx="660" ry="660"
            stroke="#1B1B1B" strokeOpacity="0.07" strokeWidth="1" />
          {/* Inner arc */}
          <ellipse cx="720" cy="-75" rx="460" ry="460"
            stroke="#1B1B1B" strokeOpacity="0.07" strokeWidth="1" />
        </svg>

        {/* Cards */}
        {VALUES.map((v, i) => (
          <motion.div
            key={v.label}
            className="absolute overflow-hidden rounded-2xl shadow-md
                       w-[160px] h-[208px] lg:w-[300px] lg:h-[390px]"
            style={{
              left: "50%",
              top: "50%",
              x: MOTION[i].x,
              y: MOTION[i].y,
              scale: MOTION[i].scale,
              opacity: MOTION[i].opacity,
              rotate: MOTION[i].rotate,
            }}
          >
            <Image
              src={v.img}
              alt={v.label}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 160px, 300px"
            />
            {/* Label gradient overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent pb-4 pl-4 pr-2 pt-10">
              <p className="font-sans text-sm font-light leading-tight text-white lg:text-base">
                {v.label}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm --filter web exec tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `SellValues.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/sell/SellValues.tsx
git commit -m "feat: SellValues scroll-driven arch wheel — Our Values section"
```

---

## Task 2: Wire `SellValues` into `sell/page.tsx`

**Files:**
- Modify: `apps/web/src/app/(marketing)/sell/page.tsx`

- [ ] **Step 1: Add import and component**

Open `apps/web/src/app/(marketing)/sell/page.tsx`. It currently reads:

```tsx
import { SellProcess } from "@/components/sell/SellProcess";
// ...

export default function SellPage() {
  return (
    <main>
      <SellHero />
      <SellQuote />
      <div data-navbar-theme="light" className="bg-[#F2F0EF]">
        <SellProcess />
        <GradientBridge from="#F2F0EF" to="#DAD4D2" />
        ...
      </div>
    </main>
  );
}
```

Add the import and place `<SellValues />` directly after `<SellProcess />`:

```tsx
import { SellValues } from "@/components/sell/SellValues";

// inside SellPage():
<div data-navbar-theme="light" className="bg-[#F2F0EF]">
  <SellProcess />
  <SellValues />
  <GradientBridge from="#F2F0EF" to="#DAD4D2" />
  <FAQ className="bg-[#DAD4D2]" faqs={SELL_FAQS} />
  <GradientBridge from="#DAD4D2" to="#F2F0EF" />
  <PageCTA
    heading={<>Free Property-Value <span className="text-cnc-gold">Estimate</span></>}
    body="By an experienced CnC Agent"
    primaryHref="/contact"
    primaryLabel="Request Valuation"
  />
</div>
```

- [ ] **Step 2: Verify page compiles**

```bash
cd C:\Users\hey_r\Desktop\CnC-Realty
pnpm --filter web exec tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(marketing)/sell/page.tsx
git commit -m "feat: add SellValues to sell page after Our Process section"
```

---

## Task 3: Visual QA in browser

- [ ] **Step 1: Open `localhost:3000/sell` and scroll to the Our Values section**

Scroll past the Our Process section. The sticky Our Values panel should appear with 5 cards arranged in an arch.

Expected at rest (top of section): Respect card at center, Punctuality and Attention to Detail visible to the right, two cards off-screen left.

Expected mid-scroll: Attention to Detail at center, flanked by Punctuality and Compassion.

Expected bottom of section: Integrity at center.

- [ ] **Step 2: Check title reveal**

Scroll back up so the title enters the viewport. "Our Values" should reveal left-to-right exactly like "Our Process" and "Our Mission".

- [ ] **Step 3: Check mobile (DevTools → responsive, 390px wide)**

Cards should be smaller (160×208px) and still arch correctly. Outer cards may clip — that is acceptable per spec.

- [ ] **Step 4: If arch geometry looks off, adjust `CY` and `R` constants**

The two tuning levers:
- `panelH * 0.15 - R` in `cardVars`: increase `0.15` to push the arc bottom lower in the panel
- `SPREAD`: decrease (e.g. to `26`) to bring cards closer together, increase to spread them wider
- `0.42` in `rotate`: decrease to make cards tilt less, increase for more tilt

- [ ] **Step 5: Commit final visual tweaks (if any)**

```bash
git add apps/web/src/components/sell/SellValues.tsx
git commit -m "fix: SellValues arch geometry tuning"
```

---

## Task 4: Update CLAUDE.md session notes

- [ ] **Step 1: Append to the bottom of CLAUDE.md**

Add a new `### Next Session — Start Here` block:

```markdown
### SellValues — Our Values Arch Wheel (2026-06-04)

New component: `apps/web/src/components/sell/SellValues.tsx`
- 500vh sticky section with scroll-driven image wheel
- 5 cards on a half-circle arch, rotating right-to-left as user scrolls
- Cards: Respect, Punctuality, Attention to Detail, Compassion, Integrity
- Placeholder images: sell-01.jpg → sell-05.jpg (Ryan to swap real photos)
- Title "Our Values" top-center with RevealLine (same as Our Process)
- Placed in sell/page.tsx immediately after <SellProcess />

| Sell Page — Our Values | ✅ Approved — real photos pending |

---

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3001` (or check terminal for port)
3. Continue with remaining work:
   - Swap placeholder images in SellValues when Ryan provides 5 photos
   - Finalize buy, rent, manage pages
   - Checklist templates at `/admin/settings/checklists`
   - Phase 6 tasks (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: session notes 2026-06-04 — SellValues arch wheel complete"
```
