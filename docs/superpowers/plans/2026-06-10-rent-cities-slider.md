# Popular Cities Slider — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dark-background photo slider with 5 California city photos, city name overlay, auto-advance, and CnC-styled arrow buttons directly below the "Moving made, Easy" section on the rent page.

**Architecture:** Single new component `RentCitiesSlider.tsx`. All 5 slides always mounted as `position: absolute` `motion.div`s — their `animate` prop drives x/opacity/scale based on a computed state (prev/active/next/hidden). `setInterval` in a `useEffect` handles auto-advance; hover pauses it. Arrow buttons reuse the DownArrow SVG rotated via Tailwind. No AnimatePresence needed — just `motion.div` + `animate`.

**Tech Stack:** Next.js 14 (`next/image`), Framer Motion (`motion.div` + `animate`), Vitest (pure helper tests), Tailwind CSS, shared `lib/motion.ts` constants.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/web/src/components/rent/RentCitiesSlider.tsx` | Full slider component |
| Create | `apps/web/src/__tests__/components/RentCitiesSlider.test.ts` | Unit test for `getSlideState` |
| Modify | `apps/web/src/app/(marketing)/rent/page.tsx` | Insert component between `<RentSteps />` and `<PageCTA />` |
| Create | `apps/web/public/images/cities/` | 5 placeholder city photos |

---

## Task 1: Download 5 placeholder city photos

**Files:**
- Create: `apps/web/public/images/cities/los-angeles.jpg`
- Create: `apps/web/public/images/cities/san-francisco.jpg`
- Create: `apps/web/public/images/cities/san-diego.jpg`
- Create: `apps/web/public/images/cities/sacramento.jpg`
- Create: `apps/web/public/images/cities/san-jose.jpg`

- [ ] **Step 1: Create the directory and download images**

Run in PowerShell from `C:\Users\hey_r\Desktop\CnC-Realty`:

```powershell
New-Item -ItemType Directory -Force "apps\web\public\images\cities"

# Los Angeles skyline
Invoke-WebRequest "https://images.pexels.com/photos/1486222/pexels-photo-1486222.jpeg?auto=compress&cs=tinysrgb&w=1280" -OutFile "apps\web\public\images\cities\los-angeles.jpg"

# San Francisco bay/bridge
Invoke-WebRequest "https://images.pexels.com/photos/208745/pexels-photo-208745.jpeg?auto=compress&cs=tinysrgb&w=1280" -OutFile "apps\web\public\images\cities\san-francisco.jpg"

# San Diego skyline
Invoke-WebRequest "https://images.pexels.com/photos/1619317/pexels-photo-1619317.jpeg?auto=compress&cs=tinysrgb&w=1280" -OutFile "apps\web\public\images\cities\san-diego.jpg"

# Sacramento (use a warm California city shot as placeholder)
Invoke-WebRequest "https://images.pexels.com/photos/3522879/pexels-photo-3522879.jpeg?auto=compress&cs=tinysrgb&w=1280" -OutFile "apps\web\public\images\cities\sacramento.jpg"

# San Jose
Invoke-WebRequest "https://images.pexels.com/photos/7245365/pexels-photo-7245365.jpeg?auto=compress&cs=tinysrgb&w=1280" -OutFile "apps\web\public\images\cities\san-jose.jpg"
```

Expected: 5 `.jpg` files in `apps/web/public/images/cities/`, each ~300–600KB.

- [ ] **Step 2: Verify files exist**

```powershell
Get-ChildItem "apps\web\public\images\cities"
```

Expected: 5 files listed.

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/images/cities/
git commit -m "feat(rent): add placeholder city photos for Popular Cities slider"
```

---

## Task 2: Write the `getSlideState` helper and its test

**Files:**
- Create: `apps/web/src/__tests__/components/RentCitiesSlider.test.ts`
- Create: `apps/web/src/components/rent/RentCitiesSlider.tsx` (stub + exported helper)

- [ ] **Step 1: Create the test file**

Create `apps/web/src/__tests__/components/RentCitiesSlider.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getSlideState } from "@/components/rent/RentCitiesSlider";

describe("getSlideState", () => {
  it("marks the active index as active", () => {
    expect(getSlideState(2, 2, 5)).toBe("active");
  });

  it("marks the immediately previous index as prev", () => {
    expect(getSlideState(1, 2, 5)).toBe("prev");
  });

  it("marks the immediately next index as next", () => {
    expect(getSlideState(3, 2, 5)).toBe("next");
  });

  it("marks all other indices as hidden", () => {
    expect(getSlideState(0, 2, 5)).toBe("hidden");
    expect(getSlideState(4, 2, 5)).toBe("hidden");
  });

  it("wraps around: prev of index 0 is the last index", () => {
    expect(getSlideState(4, 0, 5)).toBe("prev");
  });

  it("wraps around: next of last index is index 0", () => {
    expect(getSlideState(0, 4, 5)).toBe("next");
  });
});
```

- [ ] **Step 2: Create the component stub with the exported helper**

Create `apps/web/src/components/rent/RentCitiesSlider.tsx`:

```tsx
"use client";

export type SlidePosition = "active" | "prev" | "next" | "hidden";

export function getSlideState(
  idx: number,
  activeIdx: number,
  total: number
): SlidePosition {
  if (idx === activeIdx) return "active";
  if (idx === (activeIdx - 1 + total) % total) return "prev";
  if (idx === (activeIdx + 1) % total) return "next";
  return "hidden";
}

export function RentCitiesSlider() {
  return <div />;
}
```

- [ ] **Step 3: Run the tests and verify they pass**

```bash
pnpm --filter web test src/__tests__/components/RentCitiesSlider.test.ts
```

Expected output: `6 tests passed`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/__tests__/components/RentCitiesSlider.test.ts apps/web/src/components/rent/RentCitiesSlider.tsx
git commit -m "feat(rent): add getSlideState helper with tests"
```

---

## Task 3: Build the full `RentCitiesSlider` component

**Files:**
- Modify: `apps/web/src/components/rent/RentCitiesSlider.tsx`

- [ ] **Step 1: Replace stub with full implementation**

Overwrite `apps/web/src/components/rent/RentCitiesSlider.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { RevealLine } from "@/components/ui/reveal-text";
import {
  EASE_OUT_EXPO,
  PULSE_ANIMATE,
  PULSE_TRANSITION,
  SPRING_HOVER,
} from "@/lib/motion";

// ─── Data ───────────────────────────────────────────────────────────────────

const CITIES = [
  { name: "Los Angeles",    src: "/images/cities/los-angeles.jpg" },
  { name: "San Francisco",  src: "/images/cities/san-francisco.jpg" },
  { name: "San Diego",      src: "/images/cities/san-diego.jpg" },
  { name: "Sacramento",     src: "/images/cities/sacramento.jpg" },
  { name: "San Jose",       src: "/images/cities/san-jose.jpg" },
] as const;

const INTERVAL_MS = 5000;

// ─── Helper ──────────────────────────────────────────────────────────────────

export type SlidePosition = "active" | "prev" | "next" | "hidden";

export function getSlideState(
  idx: number,
  activeIdx: number,
  total: number
): SlidePosition {
  if (idx === activeIdx) return "active";
  if (idx === (activeIdx - 1 + total) % total) return "prev";
  if (idx === (activeIdx + 1) % total) return "next";
  return "hidden";
}

// Framer Motion animate targets per position
function slideAnimate(pos: SlidePosition) {
  switch (pos) {
    case "active": return { x: "0vw",   opacity: 1,    scale: 1,    zIndex: 10 };
    case "prev":   return { x: "-70vw", opacity: 0.45, scale: 0.88, zIndex: 1  };
    case "next":   return { x: "70vw",  opacity: 0.45, scale: 0.88, zIndex: 1  };
    case "hidden": return { x: "0vw",   opacity: 0,    scale: 0.88, zIndex: 0  };
  }
}

// ─── Arrow SVG (same path as DownArrow.tsx, no animation wrapper) ─────────────

function ArrowIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 30 30" fill="currentColor">
      <path d="M16 20.488c0-.13.053-.253.146-.344l13-13.002c.42-.44 1.174.24.706.707l-13 13c-.302.31-.853.096-.853-.362z" />
      <path d="M.852 7.142l14 14.002c.447.447-.273 1.16-.707.707l-14-14c-.444-.445.26-1.155.707-.708z" />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RentCitiesSlider() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-advance
  useEffect(() => {
    if (isHovered) return;
    const id = setInterval(() => {
      setActiveIdx(i => (i + 1) % CITIES.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [isHovered]);

  function goNext() {
    setActiveIdx(i => (i + 1) % CITIES.length);
  }

  function goPrev() {
    setActiveIdx(i => (i - 1 + CITIES.length) % CITIES.length);
  }

  return (
    <section className="bg-[#1B1B1B] py-20 overflow-hidden">
      {/* Heading — same pattern as "Our Promise" in SellQuote */}
      <div className="mb-10 flex justify-end px-8 lg:px-20">
        <h2 className="font-sans text-[2.5rem] font-light xl:text-[3rem]">
          <RevealLine>
            <span className="text-[1.9rem] xl:text-[2.2rem] text-white/80">Popular </span>
            <span style={{ color: "#9E8C61", fontWeight: 500 }}>Cities</span>
          </RevealLine>
        </h2>
      </div>

      {/* Slider viewport */}
      <div
        className="relative mx-auto"
        style={{ width: "65vw", maxWidth: 900 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Fixed-height rail (16:9) */}
        <div className="relative w-full" style={{ paddingTop: "calc(65vw * 9 / 16)", maxHeight: 506 }}>
          <div className="absolute inset-0">
            {CITIES.map((city, i) => {
              const pos = getSlideState(i, activeIdx, CITIES.length);
              return (
                <motion.div
                  key={city.name}
                  className="absolute inset-0 rounded-2xl overflow-hidden"
                  animate={slideAnimate(pos)}
                  transition={
                    pos === "hidden"
                      ? { duration: 0 }
                      : { duration: 0.6, ease: EASE_OUT_EXPO as [number, number, number, number] }
                  }
                >
                  <Image
                    src={city.src}
                    alt={city.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 900px) 65vw, 900px"
                    priority={i === 0}
                  />
                  {/* Dark overlay — same as SellValues */}
                  <div className="absolute inset-0 bg-black/40" />
                  {/* City name */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="font-sans font-light text-white text-[2.2rem] xl:text-[2.6rem]">
                      {city.name}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Arrow buttons */}
      <div className="flex gap-6 justify-center mt-12">
        {/* Left arrow */}
        <motion.button
          onClick={goPrev}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          className="text-white border border-white/50 rounded-full p-3 rotate-90 cursor-pointer"
          aria-label="Previous city"
        >
          <ArrowIcon />
        </motion.button>
        {/* Right arrow */}
        <motion.button
          onClick={goNext}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          className="-rotate-90 text-white border border-white/50 rounded-full p-3 cursor-pointer"
          aria-label="Next city"
        >
          <ArrowIcon />
        </motion.button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run existing tests to confirm nothing is broken**

```bash
pnpm --filter web test
```

Expected: All previously-passing tests still pass. The new `getSlideState` test also passes (6 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/rent/RentCitiesSlider.tsx
git commit -m "feat(rent): build RentCitiesSlider component"
```

---

## Task 4: Wire into the rent page

**Files:**
- Modify: `apps/web/src/app/(marketing)/rent/page.tsx`

- [ ] **Step 1: Insert the component**

Open `apps/web/src/app/(marketing)/rent/page.tsx`. The current content is:

```tsx
import { Metadata } from "next";
import { RentHero } from "@/components/rent/RentHero";
import { RentSteps } from "@/components/rent/RentSteps";
import { PageCTA } from "@/components/ui/PageCTA";

export const metadata: Metadata = {
  title: "Rent | CnC Realty",
  description: "Find your next rental in California with CnC Realty. Live CRMLS lease listings with expert tenant representation.",
};

export default function RentPage() {
  return (
    <main className="min-h-screen bg-[#F2F0EF]">
      <RentHero />
      <RentSteps />
      <PageCTA
        heading={<>Need help finding a <span className="text-cnc-gold">rental?</span></>}
        body="A CnC agent will work on your behalf — at no cost to you."
        primaryHref="/properties?listingType=FOR_LEASE"
        primaryLabel="Browse Rentals →"
        secondaryHref="/contact"
        secondaryLabel="Talk to an Agent"
      />
    </main>
  );
}
```

Replace with:

```tsx
import { Metadata } from "next";
import { RentHero } from "@/components/rent/RentHero";
import { RentSteps } from "@/components/rent/RentSteps";
import { RentCitiesSlider } from "@/components/rent/RentCitiesSlider";
import { PageCTA } from "@/components/ui/PageCTA";

export const metadata: Metadata = {
  title: "Rent | CnC Realty",
  description: "Find your next rental in California with CnC Realty. Live CRMLS lease listings with expert tenant representation.",
};

export default function RentPage() {
  return (
    <main className="min-h-screen bg-[#F2F0EF]">
      <RentHero />
      <RentSteps />
      <RentCitiesSlider />
      <PageCTA
        heading={<>Need help finding a <span className="text-cnc-gold">rental?</span></>}
        body="A CnC agent will work on your behalf — at no cost to you."
        primaryHref="/properties?listingType=FOR_LEASE"
        primaryLabel="Browse Rentals →"
        secondaryHref="/contact"
        secondaryLabel="Talk to an Agent"
      />
    </main>
  );
}
```

- [ ] **Step 2: Start dev server and verify visually**

```bash
pnpm --filter web dev
```

Open `localhost:3000/rent`. Scroll past the "Moving made, Easy" section. Verify:
- Dark `#1B1B1B` background section appears
- "Popular Cities" heading top-right with gold "Cities"
- One city photo centered with dark overlay and city name
- Adjacent photos peeking in from left/right at reduced opacity
- Photos auto-advance every 5 seconds
- Left arrow rotates slide backward, right arrow rotates forward
- Arrows pulse at idle, spring-snap on hover

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(marketing)/rent/page.tsx
git commit -m "feat(rent): add Popular Cities slider to rent page"
```

---

## Self-Review

**Spec coverage:**
- ✅ Dark background `#1B1B1B`
- ✅ Automatic shifting photos with 5-second interval
- ✅ 5 photos (placeholder California cities)
- ✅ City name over photo
- ✅ Dark overlay `bg-black/40` matching Our Values
- ✅ Left/right arrows: DownArrow SVG rotated, thin white circle border
- ✅ "Popular Cities" heading matching "Our Promise" pattern (`RevealLine`, same font sizes, gold second word)
- ✅ Placed between `<RentSteps />` and `<PageCTA />`
- ✅ Adjacent slides visible on sides (prev at x: -70vw, next at x: 70vw, opacity 0.45)

**Placeholder scan:** No TBDs, no vague steps. All code blocks are complete.

**Type consistency:** `SlidePosition` defined in Task 2 and used in Task 3. `getSlideState` signature is identical across both tasks. `CITIES` uses `as const` so index types are narrowed correctly.
