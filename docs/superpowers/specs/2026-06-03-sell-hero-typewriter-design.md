# Sell Page Hero — Typewriter Animation Design

**Date:** 2026-06-03
**Status:** Approved

---

## Goal

Add a letter-by-letter typewriter animation to the "SELL WITH US" SVG mask text on the sell page hero. Words reveal in sequence: SELL → WITH → US.

---

## Constraints

- Text lives inside an SVG `<mask>` — it punches letter-shaped holes in a dark overlay to reveal the video behind.
- `textAnchor="middle"` centering must stay locked throughout the animation (no layout shift).
- `sell/page.tsx` must stay a Server Component.
- No new dependencies.

---

## Approach: CSS `<tspan>` Opacity Animation

Each character becomes a `<tspan>` inside the existing `<text>` element. SVG lays out `<tspan>` elements sequentially so centering is computed from the full text width — opacity-0 characters still occupy space, preventing layout shift.

A `@keyframes cnc-letter-in` rule (opacity 0 → 1, ~1ms duration, `fill-mode: forwards`) is added to `globals.css`. Each `<tspan>` receives an inline `animationDelay`.

---

## Files Changed

| File | Change |
|---|---|
| `apps/web/src/components/sell/SellHero.tsx` | **New** — `"use client"` component containing the hero `<section>` |
| `apps/web/src/app/(marketing)/sell/page.tsx` | Replace inline hero JSX with `<SellHero />` |
| `apps/web/src/app/globals.css` | Add `@keyframes cnc-letter-in` |

---

## Character Delay Table

Interval: 70ms per character. Word gap: 100ms extra delay after each word ends.

| Line | Char | Delay (ms) |
|---|---|---|
| 1 | S | 0 |
| 1 | E | 70 |
| 1 | L | 140 |
| 1 | L | 210 |
| 1 | (space) | 0 (invisible) |
| 1 | W | 380 |
| 1 | I | 450 |
| 1 | T | 520 |
| 1 | H | 590 |
| 2 | U | 760 |
| 2 | S | 830 |

Total animation completes at ~830ms after page load.

---

## What Does NOT Change

- Video source, autoPlay, muted, loop, playsInline
- SVG viewBox, preserveAspectRatio
- Overlay opacity (`fillOpacity="0.72"`)
- Font family, font weight (300), fontSize (240 for both lines)
- Text positions (x=960, y=400 / y=710)
- `DownArrow` component
- `textAnchor="middle"`, `dominantBaseline="middle"`
