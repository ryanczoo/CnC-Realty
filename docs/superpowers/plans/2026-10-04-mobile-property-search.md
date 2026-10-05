# Mobile Layout — Sub-project 5 (Property Search, Listing, Home-Value) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phone layouts for `/properties` (list-first, swipeable filter pills with bottom-sheet menus, Show Map/Show List with the map downloaded only on first tap), the listing popup and full listing page (full-width swipe photos, frosted sticky bar: heart + Contact Agent), and `/home-value` — desktop unchanged, phone load lighter.

**Architecture:** Phone-only classes (`max-lg:`, `max-sm:`, `portrait`/`landscape`, `!` overrides of inline styles), `lg:hidden` phone-only elements whose images are all lazy (nothing requested on desktop), and two pure exported helpers pinned by tests: `shouldRenderMap` (desktop always true once mounted) and `swiperIndex`. Two new shared components, each used in two places: `PhotoSwiper`, `StickyContactBar`. Reused: `useIsMobile`, the StatCards swipe-row classes, `SaveButton` (gains optional `className`), `ContactForm` (gains optional `id`), `FilterBar` itself.

**Tech Stack:** Next.js 14, Tailwind 3.4.19, `motion` 12.38, Vitest (node env).

**Spec:** `docs/superpowers/specs/2026-10-04-mobile-property-search-design.md` (parent: `docs/superpowers/specs/2026-10-03-mobile-layout-design.md`)

## Global Constraints

- **Desktop never edited:** only phone classes, `lg:hidden` phone-only elements, a `display:contents` wrapper (no box on desktop), optional props whose default leaves desktop output identical, and `shouldRenderMap` (desktop → map pane renders the identical grey placeholder until mount, then the map).
- **Desktop map timing must show no noticeable delay** (Task 1 baseline vs Task 2 after; if worse by more than ~100ms median, revert the gating and keep phones loading the map as today).
- **No new libraries; no new desktop requests** (all `PhotoSwiper` images `loading="lazy"` inside `lg:hidden`).
- Phone layout below 1024px; `max-sm:` = below 640px (cards 1 per row, detail lists 1 column, reveal form 1 per row).
- **Every task ends with** full suite, `tsc --noEmit`, clean `rm -rf apps/web/.next && pnpm --filter web build` (controller stops its own 3100 server first; never touches Ryan's dev server). Commit per task; no push.
- **Browser checks are the controller's** (Puppeteer, production build on 3100). DB-backed pages need the database — if Neon is unreachable (Ryan's office network), record it and check those pages when it is reachable.

## Review Focus

1. **Desktop drift** on `/properties` (filter bar, list pane, map pane placeholder), the open popup, the full listing page, `/home-value` — identical boxes at 1440×900; no extra desktop image requests.
2. **Map gating** — phones request the map chunk only after the first "Show Map" tap; desktop map appears within ~100ms of baseline; re-showing the map after "Show List" renders at full size (not a 0×0 canvas).
3. **Filter sheets** — each pill's menu opens as a bottom sheet, fully on screen at 320×568 and 844×340, closes on outside tap; the pill row swipes; no page sideways scroll.
4. **Sticky bar** — heart toggles save (same state as desktop heart), "Contact Agent" scrolls to the visible contact form in both the popup and the full page; bar never covers the last content.
5. **Swipe photos** — counter matches the photo in view after swipe and after arrow taps; tapping a full-page photo opens the lightbox at that photo.

---

## File Structure

| File | Change |
|---|---|
| `components/properties/SearchResults.tsx` | export `shouldRenderMap`; phone list/map toggle + Show Map pill; 1-per-row cards below 640 |
| `__tests__/components/SearchResults.test.ts` | pins `shouldRenderMap` |
| `components/properties/PropertyCard.tsx` | image `sizes` phone entry |
| `app/(listings)/properties/loading.tsx` | phone single column |
| `components/properties/FilterBar.tsx` | phone two-row bar, swipe row, bottom-sheet menus |
| `components/properties/PhotoSwiper.tsx` | **new** — export `swiperIndex` + `PhotoSwiper` |
| `__tests__/components/PhotoSwiper.test.ts` | pins `swiperIndex` |
| `components/properties/StickyContactBar.tsx` | **new** |
| `components/properties/SaveButton.tsx` | optional `className` |
| `components/properties/ContactForm.tsx` | optional `id` |
| `components/properties/PropertyDrawer.tsx` | phone full width, swiper, heart → bar, stats, detail lists |
| `components/properties/PhotoGallery.tsx` | phone swiper (grid hidden) |
| `app/(listings)/properties/[mlsNumber]/page.tsx` | phone single column, badge row, bar, stats, detail lists |
| `app/(marketing)/home-value/page.tsx`, `components/home-value/LocalMarketSnapshot.tsx`, `components/home-value/RevealEstimateForm.tsx` | phone padding/fit |

(All paths under `apps/web/src/`.)

## Controller toolkit

As sub-project 4 (`window.__tk`: `frame`, `measure`, `overflow`, `weight` with `nonVideoKB`/`jsKB`), plus:

```js
// MLS number for listing checks: first card link on /properties
const firstMls = async () => { const f = await tk.frame("/properties", 1440, 900); await tk.wait(2500); const a = f.contentDocument.querySelector('a[href^="/properties/"]'); return a?.getAttribute("href").split("/").pop(); };
// map ready time: ms from iframe load start until .mapboxgl-canvas exists
const mapReadyMs = async (W, H) => { [...document.querySelectorAll("iframe")].forEach((x) => x.remove()); const f = document.createElement("iframe"); f.style.cssText = `width:${W}px;height:${H}px;border:0`; document.body.appendChild(f); const t0 = performance.now(); f.src = "/properties"; for (;;) { await tk.wait(25); const c = f.contentDocument?.querySelector(".mapboxgl-canvas"); if (c && c.getBoundingClientRect().width > 0) return Math.round(performance.now() - t0); if (performance.now() - t0 > 20000) return -1; } };
const mapChunkRequested = (w) => w.performance.getEntriesByType("resource").some((r) => /mapbox|PropertyMapInner/i.test(r.name) || r.transferSize > 1000000);
ROOTS: search = () => d.querySelector('[data-navbar-theme="dark"].fixed'); drawer = () => d.querySelector(".fixed.bottom-0.right-0.z-50"); listing = () => d.querySelector("main") || d.body.firstElementChild; homevalue = () => d.querySelector("main");
```

Viewports: 320×568, 344×882, 375×667, 390×844, 430×932, 820×1180, 844×390, 844×340, 667×320.

---

### Task 1: Baselines (controller)

- [ ] Tree clean; `BASELINE_SHA`; build + serve 3100; confirm `/api/properties?limit=1` returns listings (DB reachable). If not, stop and report.
- [ ] Desktop 1440×900 MEASURE twice (identical): `search` (on `/properties`), `drawer` (after clicking the first card), `listing` (`/properties/<firstMls>`), `homevalue` (`/home-value?address=<that listing's address>`).
- [ ] Desktop map timing: `mapReadyMs(1440, 900)` × 5 → record median.
- [ ] WEIGHT `/properties`, `/properties/<firstMls>`, `/home-value?address=…` at 1440×900 and 390×844; record desktop image request count for the listing page and the open popup.

---

### Task 2: Search page — list first, Show Map pill, deferred map

**Files:** `components/properties/SearchResults.tsx`, `components/properties/PropertyCard.tsx`, `app/(listings)/properties/loading.tsx`; Test `__tests__/components/SearchResults.test.ts`.

**Interfaces:** Produces `export function shouldRenderMap(mounted: boolean, isMobile: boolean, mapRequested: boolean): boolean`. Consumes `useIsMobile` (`@/hooks/useIsMobile`), `PULSE_ANIMATE`, `PULSE_TRANSITION`, `SPRING_HOVER` (`@/lib/motion`).

- [ ] **Step 1: Failing test**

```ts
// apps/web/src/__tests__/components/SearchResults.test.ts
import { describe, it, expect } from "vitest";
import { shouldRenderMap } from "@/components/properties/SearchResults";

describe("shouldRenderMap", () => {
  it("renders nothing until mounted (placeholder shows instead)", () => {
    expect(shouldRenderMap(false, false, false)).toBe(false);
    expect(shouldRenderMap(false, true, true)).toBe(false);
  });
  it("desktop always renders the map once mounted (unchanged)", () => {
    expect(shouldRenderMap(true, false, false)).toBe(true);
  });
  it("phones load the map only after the first Show Map tap", () => {
    expect(shouldRenderMap(true, true, false)).toBe(false);
    expect(shouldRenderMap(true, true, true)).toBe(true);
  });
});
```

- [ ] **Step 2:** `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/components/SearchResults.test.ts` — Expected FAIL (`shouldRenderMap is not a function`).

- [ ] **Step 3: Implement in `SearchResults.tsx`**

1. Imports: `import { AnimatePresence, motion } from "motion/react";` (replace the existing `AnimatePresence` import), add `import { useIsMobile } from "@/hooks/useIsMobile";` and `import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";`.
2. Above `function SearchResultsInner`:

```ts
// Phones open on the list; the map code (~1.7 MB) downloads only on the first
// "Show Map" tap. Until the page has mounted we cannot know phone vs desktop,
// so the map pane shows the same grey placeholder the map's own loader shows.
export function shouldRenderMap(mounted: boolean, isMobile: boolean, mapRequested: boolean): boolean {
  if (!mounted) return false;
  return !isMobile || mapRequested;
}
```

3. In `SearchResultsInner`, after the existing state:

```ts
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [showMap, setShowMap] = useState(false);
  const [mapRequested, setMapRequested] = useState(false);
  const toggleMap = useCallback(() => {
    setMapRequested(true);
    setShowMap((v) => !v);
  }, []);
```

4. List pane: `className="flex w-[45%] flex-col overflow-y-auto"` → ``className={`flex w-[45%] flex-col overflow-y-auto max-lg:w-full${showMap ? " max-lg:hidden" : ""}`}``.
5. Card grid `className="grid grid-cols-2 gap-3 p-3"` → `"grid grid-cols-2 gap-3 p-3 max-sm:grid-cols-1"`; each of the three `col-span-2` message divs gets ` max-sm:col-span-1` appended.
6. Map pane:

```tsx
        <div className={`flex-1${showMap ? "" : " max-lg:hidden"}`}>
          {shouldRenderMap(mounted, isMobile, mapRequested) ? (
            <PropertyMap properties={properties} hoveredId={hoveredId} onSelect={handleSelect} />
          ) : (
            <div className="h-full w-full bg-[#1a1a1a]" />
          )}
        </div>
```

7. After the map pane's closing `</div>` of the `flex flex-1 overflow-hidden` row (before the drawer `AnimatePresence`):

```tsx
      {/* Phones: list/map toggle */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center lg:hidden">
        <motion.button
          type="button"
          onClick={toggleMap}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          className="pointer-events-auto rounded-full bg-[#1B1B1B] px-6 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-1 ring-white/10"
        >
          {showMap ? "Show List" : "Show Map"}
        </motion.button>
      </div>
```

- [ ] **Step 4:** `PropertyCard.tsx`: `sizes="(max-width: 768px) 50vw, 280px"` → `sizes="(max-width: 639px) 100vw, (max-width: 768px) 50vw, 280px"`. `loading.tsx`: `"w-[45%] overflow-y-auto border-r border-[#E8E6E4] p-4 space-y-4"` → append `" max-lg:w-full max-lg:border-r-0"`; map skeleton wrapper `<div className="flex-1">` → `<div className="flex-1 max-lg:hidden">`.
- [ ] **Step 5:** Test passes (3). Suite, `tsc`, build. Commit `feat: property search opens on the list on phones with a Show Map pill; map code loads on first tap`.
- [ ] **Step 6 (controller):** desktop MEASURE `search` = baseline; `mapReadyMs(1440,900)` × 5 median within ~100ms of baseline (else revert gating, ledger). Phones: no map chunk requested before tap (`mapChunkRequested` false); after tapping Show Map the canvas is full size; Show List → list, Show Map again → canvas full size; cards 1 per row below 640, 2 at 820/844/667; OVERFLOW `[]`.

---

### Task 3: Filter bar — two rows, swipe row, bottom-sheet menus

**Files:** `components/properties/FilterBar.tsx`. Classes + one `display:contents` wrapper.

- [ ] Root `"relative z-10 flex flex-wrap items-center gap-2 border-b border-white/5 bg-[#0f0f0f]/95 px-4 py-2.5 backdrop-blur-md"` → append `" max-lg:z-30 max-lg:backdrop-blur-none max-lg:px-3"` (a blurred parent would trap the `fixed` sheets; z-30 keeps sheets above the Show Map pill).
- [ ] Search wrapper `"relative w-56"` → `"relative w-56 max-lg:w-auto max-lg:flex-1"`.
- [ ] Wrap everything from the `{/* Price pill */}` block through the `{/* Result count */}` `<span>` (inclusive) in:

```tsx
      <div
        className="contents max-lg:flex max-lg:w-full max-lg:items-center max-lg:gap-2 max-lg:overflow-x-auto max-lg:[scroll-snap-type:x_mandatory] max-lg:[&>*]:shrink-0 max-lg:[&>*]:[scroll-snap-align:start] max-lg:[&_button]:whitespace-nowrap"
        style={{ scrollbarWidth: "none" }}
      >
        …existing Price / Beds / Baths / Type / Clear / count…
      </div>
```

(The backdrop `{openDropdown && …}` stays outside, as the last child of the root.)
- [ ] Every dropdown panel class beginning `"absolute left-0 top-full z-40 mt-1 "` (5 panels) → append `" max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto max-lg:mt-0 max-lg:w-auto max-lg:rounded-b-none max-lg:rounded-t-2xl max-lg:py-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]"`.
- [ ] Every menu item class containing `"px-4 py-2 text-left text-sm"` (5 groups) → append `" max-lg:py-3 max-lg:text-base"`.
- [ ] Suite, `tsc`, build. Commit `feat: property filters fit phones — swipeable pill row with bottom-sheet menus`.
- [ ] **Controller:** desktop MEASURE `search` = baseline. Phones (incl. 320×568, 844×340): first row = For Sale pill + search box; pill row scrolls horizontally inside itself (page `scrollWidth == innerWidth`); tapping each pill opens its sheet with its bottom at the viewport bottom and its full width on screen; tapping the backdrop closes it; choosing an option applies the filter.

---

### Task 4: Shared pieces — `PhotoSwiper`, `StickyContactBar`, `SaveButton.className`, `ContactForm.id`

**Files:** Create `components/properties/PhotoSwiper.tsx`, `components/properties/StickyContactBar.tsx`, Test `__tests__/components/PhotoSwiper.test.ts`; Modify `SaveButton.tsx`, `ContactForm.tsx`.

**Interfaces:** Produces `export function swiperIndex(scrollLeft: number, width: number, count: number): number`; `export function PhotoSwiper(props: { photos: string[]; alt: string; className?: string; onPhotoClick?: (i: number) => void })`; `export function StickyContactBar(props: { mlsNumber: string; targetId: string; className?: string })`; `SaveButton({ mlsNumber, className? })`; `ContactForm({ mlsNumber, address, id? })`.

- [ ] **Step 1: Failing test**

```ts
// apps/web/src/__tests__/components/PhotoSwiper.test.ts
import { describe, it, expect } from "vitest";
import { swiperIndex } from "@/components/properties/PhotoSwiper";

describe("swiperIndex", () => {
  it("maps the strip's scroll position to the photo in view", () => {
    expect(swiperIndex(0, 390, 5)).toBe(0);
    expect(swiperIndex(390, 390, 5)).toBe(1);
    expect(swiperIndex(800, 390, 5)).toBe(2); // mid-swipe rounds to nearest
  });
  it("clamps to the first/last photo and survives a zero width", () => {
    expect(swiperIndex(-20, 390, 5)).toBe(0);
    expect(swiperIndex(99999, 390, 5)).toBe(4);
    expect(swiperIndex(390, 0, 5)).toBe(0);
  });
});
```

- [ ] **Step 2:** Run it — Expected FAIL (module not found).

- [ ] **Step 3: Create `PhotoSwiper.tsx`**

```tsx
"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function swiperIndex(scrollLeft: number, width: number, count: number): number {
  if (width <= 0 || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / width)));
}

interface Props {
  photos: string[];
  alt: string;
  className?: string;
  onPhotoClick?: (i: number) => void;
}

// Phone photo strip: swipe between full-width photos (same swipe-row classes as
// StatCards/SellProcess). Every image is lazy, so when this sits inside an
// lg:hidden wrapper desktop downloads nothing.
export function PhotoSwiper({ photos, alt, className = "", onPhotoClick }: Props) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  function onScroll() {
    const el = stripRef.current;
    if (el) setIdx(swiperIndex(el.scrollLeft, el.clientWidth, photos.length));
  }
  function go(delta: number) {
    const el = stripRef.current;
    if (!el) return;
    const next = (idx + delta + photos.length) % photos.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        ref={stripRef}
        onScroll={onScroll}
        className="flex h-full overflow-x-auto [scroll-snap-type:x_mandatory]"
        style={{ scrollbarWidth: "none" }}
      >
        {photos.map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            onClick={() => onPhotoClick?.(i)}
            className="relative h-full w-full flex-shrink-0 [scroll-snap-align:start]"
            aria-label={`Photo ${i + 1} of ${photos.length}`}
          >
            <Image src={src} alt={i === 0 ? alt : `${alt} photo ${i + 1}`} fill sizes="100vw" loading="lazy" unoptimized className="object-cover" />
          </button>
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Next photo" onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-sm">
            {idx + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4:** `SaveButton.tsx`: props `{ mlsNumber: string; className?: string }`; signature `export function SaveButton({ mlsNumber, className = "" }: Props)`; button className → ``{`rounded-full p-2 transition-colors hover:bg-[#1B1B1B]/5 ${className}`.trim()}`` (no `className` → identical output).
- [ ] **Step 5:** `ContactForm.tsx`: props gain `id?: string`; signature `({ mlsNumber, address, id }: Props)`; **both** root `<div className="rounded-2xl bg-white p-5">` (success state and form state) get `id={id}`.
- [ ] **Step 6: Create `StickyContactBar.tsx`**

```tsx
"use client";

import { motion } from "motion/react";
import { SaveButton } from "./SaveButton";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

interface Props {
  mlsNumber: string;
  /** id of the ContactForm to scroll to */
  targetId: string;
  /** positioning: "shrink-0" inside the popup, "fixed inset-x-0 bottom-0 z-30" on the full page */
  className?: string;
}

// Phones only (lg:hidden): frosted off-white bar — save heart left,
// "Contact Agent" right, which scrolls to the listing's existing contact form.
export function StickyContactBar({ mlsNumber, targetId, className = "" }: Props) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-t border-[#1B1B1B]/10 bg-[#F2F0EF]/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden ${className}`}
    >
      <SaveButton mlsNumber={mlsNumber} />
      <motion.button
        type="button"
        onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })}
        animate={PULSE_ANIMATE}
        transition={PULSE_TRANSITION}
        whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
        className="rounded-full bg-[#1B1B1B] px-7 py-3 text-sm font-medium text-white"
      >
        Contact Agent
      </motion.button>
    </div>
  );
}
```

- [ ] **Step 7:** Test passes (2). Suite, `tsc`, build. Commit `feat: shared phone photo swiper and sticky contact bar`.

---

### Task 5: Listing popup on phones

**Files:** `components/properties/PropertyDrawer.tsx`. Consumes `PhotoSwiper`, `StickyContactBar` (Task 4).

- [ ] Imports: add `import { PhotoSwiper } from "./PhotoSwiper";` and `import { StickyContactBar } from "./StickyContactBar";`.
- [ ] Panel `motion.div` className `"fixed bottom-0 right-0 z-50 flex flex-col overflow-hidden bg-[#F2F0EF] shadow-2xl"` → append `" max-lg:!w-full"`.
- [ ] Photo container `"relative h-72 w-full bg-[#1B1B1B]/10 sm:h-80 md:h-96"` → append `" max-lg:landscape:h-[60svh]"`.
- [ ] Inside it, wrap the existing `{photos.length > 0 ? ( … ) : ( …No photos… )}` expression in `<div className="contents max-lg:hidden">…</div>`, and add right after that wrapper:

```tsx
                {photos.length > 0 && (
                  <PhotoSwiper photos={photos} alt={property.address} className="absolute inset-0 lg:hidden" />
                )}
                {photos.length === 0 && (
                  <div className="flex h-full items-center justify-center text-sm text-[#1B1B1B]/50 lg:hidden">No photos</div>
                )}
```

- [ ] Heart button `"absolute right-3 top-3 rounded-full bg-black/50 p-2 backdrop-blur-sm transition-colors hover:bg-black/70"` → append `" max-lg:hidden"`. (The status badge needs no change: it comes after the swiper in the markup, so it already shows on top.)
- [ ] Content row `"flex gap-6 px-6 pt-6"` → append `" max-lg:px-4"`; stacked contact block `"mt-6 flex flex-col gap-4 px-6 xl:hidden"` → append `" max-lg:px-4"` and its `ContactForm` gets `id="drawer-contact"`.
- [ ] Stats cell `"flex items-center gap-2.5 px-4 py-3.5"` → append `" max-lg:flex-col max-lg:items-start max-lg:gap-1 max-lg:px-3"`.
- [ ] MLS/Listed grid `"mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-xl bg-cnc-bg p-4 text-sm"` and section grid `"grid grid-cols-2 gap-x-6 gap-y-2.5"` → append `" max-sm:grid-cols-1"` to each.
- [ ] Just before the panel's closing `</motion.div>` (after the scrollable body):

```tsx
        {property && !isLoading && (
          <StickyContactBar mlsNumber={property.mlsNumber} targetId="drawer-contact" className="shrink-0" />
        )}
```

- [ ] Suite, `tsc`, build. Commit `feat: listing popup fills the screen on phones with swipe photos and a sticky contact bar`.
- [ ] **Controller (shared build with Task 6):** desktop MEASURE `drawer` = baseline and desktop image requests unchanged. Phones: panel width = viewport; swipe (scroll the strip by one width) → counter "2 / N"; Next arrow → "3 / N"; no heart on the photo; bar visible at the bottom; bar heart toggles saved state; "Contact Agent" scrolls `#drawer-contact` into view; stats values not truncated at 320; OVERFLOW `[]`.

---

### Task 6: Full listing page on phones

**Files:** `components/properties/PhotoGallery.tsx`, `app/(listings)/properties/[mlsNumber]/page.tsx`. Consumes `PhotoSwiper`, `StickyContactBar`, `SaveButton.className`, `ContactForm.id`.

- [ ] `PhotoGallery.tsx`: import `PhotoSwiper`; grid `"relative grid h-[420px] grid-cols-4 grid-rows-2 gap-1 overflow-hidden rounded-2xl"` → append `" max-lg:hidden"`; right after the grid's closing `</div>` add:

```tsx
      <PhotoSwiper
        photos={photos}
        alt={address}
        onPhotoClick={(i) => setLightboxIndex(i)}
        className="rounded-2xl lg:hidden max-lg:portrait:aspect-[4/3] max-lg:landscape:h-[60svh]"
      />
```

- [ ] `page.tsx`: import `StickyContactBar`. Root `"min-h-screen bg-[#F2F0EF] pb-20 text-[#1B1B1B]"` → append `" max-lg:pb-36"`. Two-column row `"mt-8 flex gap-8"` → append `" max-lg:flex-col"`. Header row `"flex items-start justify-between gap-4"` → append `" max-lg:flex-col max-lg:gap-3"`. `<SaveButton mlsNumber={property.mlsNumber} />` → `<SaveButton mlsNumber={property.mlsNumber} className="max-lg:hidden" />`. Stats cell (`"flex items-center gap-2.5 px-4 py-3.5"`) → same phone classes as Task 5. MLS grid `"mt-5 grid grid-cols-2 gap-x-8 gap-y-2.5 rounded-xl bg-cnc-bg p-4 text-sm"` and section grid `"grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm"` → append `" max-sm:grid-cols-1"`. Sidebar `"w-80 shrink-0"` → append `" max-lg:w-full"`; `"sticky top-24 flex flex-col gap-4"` → append `" max-lg:static"`; its `ContactForm` gets `id="listing-contact"`. Before the root's closing `</div>`:

```tsx
      <StickyContactBar mlsNumber={property.mlsNumber} targetId="listing-contact" className="fixed inset-x-0 bottom-0 z-30" />
```

- [ ] Suite, `tsc`, build. Commit `feat: full listing page stacks on phones with swipe photos and a sticky contact bar`.
- [ ] **Controller:** desktop MEASURE `listing` = baseline; desktop image request count unchanged; no `StickyContactBar` visible at 1440. Phones: swiper visible, grid hidden; tapping a photo opens the lightbox at that index; badge below price; heart only in the bar; contact form + calculator below details, full width; "Contact Agent" scrolls `#listing-contact` into view; disclaimer fully above the bar at page bottom; OVERFLOW `[]`.

---

### Task 7: Home-value report on phones

**Files:** `app/(marketing)/home-value/page.tsx`, `components/home-value/LocalMarketSnapshot.tsx`, `components/home-value/RevealEstimateForm.tsx`. Classes only.

- [ ] `page.tsx`: `"bg-cnc-bg px-8 pb-24 pt-32 lg:px-20"` → append `" max-sm:px-5"`; `"-mx-8 lg:-mx-20"` → append `" max-sm:-mx-5"`; estimate section `"flex flex-1 flex-col justify-center rounded-xl border border-[#1B1B1B]/10 bg-white p-8 text-center"` → append `" max-sm:p-5"`; stats cell `"flex items-center gap-2.5 px-4 py-3.5 text-left"` → append `" max-lg:flex-col max-lg:items-start max-lg:gap-1 max-lg:px-3"`; `"mt-16 overflow-hidden rounded-xl"` → append `" max-sm:mt-8"`.
- [ ] `LocalMarketSnapshot.tsx`: `"mt-8 flex h-40 items-end gap-6"` → append `" max-sm:gap-2"`; both bar label paragraphs `"text-xs text-[#1B1B1B]/60"` and `"text-xs font-medium text-[#1B1B1B]"` → append `" max-sm:text-[10px]"`.
- [ ] `RevealEstimateForm.tsx`: modal card `"relative w-full max-w-lg rounded-2xl bg-white p-10"` → append `" max-sm:p-6"`; field row `"grid grid-cols-2 gap-6"` → append `" max-sm:grid-cols-1 max-sm:gap-4"`.
- [ ] Suite, `tsc`, build. Commit `feat: home-value report fits phones`.
- [ ] **Controller:** desktop MEASURE `homevalue` = baseline; phones OVERFLOW `[]`, stats values not truncated at 320, every market bar label inside the chart, reveal modal fields 1 per row below 640.

---

### Task 8: Final verification (controller)

- [ ] Suite + `tsc`; clean build; serve 3100.
- [ ] Desktop MEASURE `search`, `drawer`, `listing`, `homevalue` = baselines; map timing median within ~100ms; desktop image requests unchanged.
- [ ] Phones (9 viewports): `/properties`, `/properties/<firstMls>`, `/home-value?address=…` → `scrollWidth == innerWidth`, OVERFLOW `[]`.
- [ ] WEIGHT vs baseline: desktop jsKB within ~2%; phone `/properties` total **lower** (no map code before tap).
- [ ] Stop 3100. No push.
