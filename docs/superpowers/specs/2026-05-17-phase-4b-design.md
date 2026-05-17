# Phase 4B — IDX Frontend Design

**Date:** 2026-05-17  
**Status:** Approved  
**Branch:** claude/real-estate-website-9bdWi

---

## Overview

Build the public-facing property search UI on top of the Phase 4A backend (Trestle sync + `/api/properties` endpoints already complete with ~14k+ live CRMLS listings).

**Scope:**
1. Property search page (`/properties`) — split list + map
2. Property detail page (`/properties/[mlsNumber]`) — gallery + contact form + mortgage calc
3. Homepage carousel — replace placeholders with real DB listings
4. Saved properties — heart button + API (dashboard page deferred to Phase 5)

---

## Decisions Made

| Question | Decision |
|---|---|
| Search page layout | Split: list left (45%), map right (55%) — like Redfin/Zillow |
| Filter UI | Horizontal pill bar above split (Price, Beds, Baths, Type dropdowns) |
| Detail page layout | Full-width gallery top, two-column below (details left, sticky contact+calc right) |
| Saved properties auth | Login required — clicking heart while logged out shows login modal |
| Data fetching approach | Approach C: Hybrid URL params (SSR initial load) + client state (live filtering) |

---

## Architecture

### New hooks

**`src/hooks/useSearchFilters.ts`**
- Reads `useSearchParams()` to initialize from URL
- Exposes `filters` + `setFilter(key, value)`
- Debounces API calls 400ms
- Syncs to URL via `router.replace` (no history stack)

**`src/hooks/useProperties.ts`**
- Fetches `/api/properties?${params}` when filters change
- Returns `{ properties, total, pages, isLoading }`

### New components

**`src/components/properties/PropertyCard.tsx`**
- Used in search list + homepage carousel
- Shows: photo, price, address, bed/bath/sqft pills, property type badge
- Heart button (top-right): login modal if logged out, toggle saved if logged in
- Dark theme

**`src/components/properties/PropertyMap.tsx`**
- Mapbox GL JS, dynamic import `ssr: false`
- Clustered pins, individual pins show price label
- Pin click → popup card with photo + "View" link
- Accepts `properties` array + `hoveredId` prop

**`src/components/properties/FilterBar.tsx`**
- Sticky below navbar
- Search input (city/zip), Price dropdown (min/max), Beds (1+–4+), Baths (1+–3+), Type (SFR/Condo/Townhouse/Multi/Land)
- Active filters highlighted `#9E8C61` gold
- "Clear all" when any filter active

**`src/components/properties/MortgageCalculator.tsx`**
- Inputs: purchase price (pre-filled), down payment %, interest rate, term (15/30yr)
- Computes monthly payment client-side (no API)

**`src/components/properties/PhotoGallery.tsx`**
- Full-width CSS grid: 1 large left + 4 thumbnails right
- "See all X photos" → full-screen lightbox

---

## Pages

### `/properties` — Search page
**File:** `src/app/(listings)/properties/page.tsx`

- Server Component receives `searchParams`, fetches initial page server-side
- Filter bar sticky below navbar
- Split pane fills remaining viewport height (no body scroll)
- Left: result count + scrollable `PropertyCard` list, infinite scroll (load next page at 200px from bottom)
- Right: `PropertyMap` — free pan, does not auto-follow filter changes
- Hovering card → highlights corresponding map pin

### `/properties/[mlsNumber]` — Detail page
**File:** `src/app/(listings)/properties/[mlsNumber]/page.tsx`

- Full SSR + `generateMetadata` (OG tags: address, price, first photo)
- Photo gallery (full-width grid + lightbox)
- Two-column: left (description, map pin, listing details), right sticky (contact form → `POST /api/leads`, mortgage calculator)
- "← Back to search" restores previous filter URL from `sessionStorage`

---

## API additions

### `POST /api/saved-properties`
Body: `{ mlsNumber }` — requires auth, upserts `SavedProperty` row

### `DELETE /api/saved-properties/[mlsNumber]`
Requires auth, deletes saved property for current user

### New Prisma model
```prisma
model SavedProperty {
  id          String   @id @default(cuid())
  userId      String
  mlsNumber   String
  createdAt   DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, mlsNumber])
}
```

---

## Homepage carousel

Replace 8 placeholder listings in `FeaturedListings.tsx` with `fetch('/api/properties?limit=8')` at build/request time. Falls back to placeholder data on error.

---

## Out of scope (Phase 5)

- `/dashboard/saved` page listing saved properties
- Saved searches (search criteria → alert emails)
- Map search as standalone `/properties/map` route (map is embedded in the split view)
