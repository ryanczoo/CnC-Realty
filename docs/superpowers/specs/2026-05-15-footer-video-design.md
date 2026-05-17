# Footer — Sticky Underlay Video Design

**Date:** 2026-05-15  
**Status:** Approved

---

## Goal

Replace the current static navy footer with a cinematic scroll-reveal video footer. As the user scrolls to the bottom of the page, the main content peels away upward and exposes the video footer beneath — matching the Mino (mino.works) sticky underlay effect.

---

## Scroll Mechanic — Option A (Sticky Underlay)

The footer is `sticky bottom-0` at a base z-index. All page content (`<main>`) sits above it with `relative z-10` and solid section backgrounds. As the user scrolls past the last section (JoinCnCCTA), the content slides up and the footer video is revealed beneath. No scroll listeners, no Framer Motion — pure CSS stacking.

**Constraint:** every section in `<main>` must have a solid background (no transparency). All current sections already satisfy this (`#F2F0EF`, `#181818`, `#F2F0EF`, etc.).

---

## Layout Changes

### `apps/web/src/app/layout.tsx`
- Add `relative z-10` to the `<main>` element so it stacks above the sticky footer.

### `apps/web/src/components/layout/Footer.tsx`
- Full rewrite (see component spec below).

---

## Footer Component Spec

**File:** `apps/web/src/components/layout/Footer.tsx`

### Outer wrapper
```
<footer sticky bottom-0 w-full min-h-[500px] relative overflow-hidden>
```

### Video background
- `<video autoPlay muted loop playsInline>` with `fill` / `absolute inset-0 w-full h-full object-cover object-center`
- Source: `apps/web/public/videos/footer-bg.mp4` (copied from `C:\Users\hey_r\Downloads\15875609-hd_1280_720_30fps.mp4`)
- Dark overlay: `absolute inset-0 bg-black/55`

### Content overlay
- `absolute inset-0 flex flex-col justify-between px-8 py-12 lg:px-16`
- Top: 3-column grid
- Bottom: copyright bar

### 3-column grid (top)
| Left | Center | Right |
|---|---|---|
| CnC logo (white, `width=90`) + tagline below | "Quick Links" label + nav links | "Contact" label + email + website |

- All text: white
- Link hover: `text-[#9E8C61]` (cnc-gold token)
- Column labels: `text-xs uppercase tracking-widest text-white/50`
- Links: `text-sm font-light text-white/80 hover:text-cnc-gold transition-colors`
- Tagline: `text-sm font-light text-white/60 mt-3 max-w-[200px]`

**Quick Links:** Buy, Sell, Rent, Join CnC, Contact, News  
**Contact:** `info@cncrealtygroup.com` · `cncrealtygroup.com`

### Copyright bar (bottom)
- `text-xs text-white/40 text-center`
- Content: `© 2026 CnC Realty Group. All rights reserved. CA DRE #XXXXXXXX`

---

## Assets

| File | Source |
|---|---|
| `apps/web/public/videos/footer-bg.mp4` | `C:\Users\hey_r\Downloads\15875609-hd_1280_720_30fps.mp4` |

---

## Out of Scope

- Framer Motion scroll animations (Option A is CSS-only)
- Mobile-specific footer layout changes (same grid, wraps naturally)
- Social media icons (not in current footer, not requested)
