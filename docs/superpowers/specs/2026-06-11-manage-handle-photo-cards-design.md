# ManageHandle — "What we handle" Photo Cards Design

## Overview

Replace the inline 6-item text grid in the manage page "What we handle" section with 2 rows of 3 photo cards styled identically to the existing `ManageServices` component above it. The section heading "What we handle" is retained.

## File Changed

- Create: `apps/web/src/components/manage/ManageHandle.tsx`
- Modify: `apps/web/src/app/(marketing)/manage/page.tsx` — import `ManageHandle`, replace inline section with `<ManageHandle />`

## Section Style

- Background: `bg-[#1B1B1B]` (dark), matches `ManageServices`
- `data-navbar-theme="dark"` on the outer `<section>`
- Padding: `py-24 md:py-[150px]`
- Max-width container: `mx-auto max-w-[1920px] px-10 md:px-[100px]`
- Text color: `text-white`

## Heading

```tsx
<h2 className="mb-16 font-sans text-[2rem] font-light">
  <RevealText>What we handle</RevealText>
</h2>
```

Retains the original `font-light text-[2rem]` style, unchanged. `RevealText` provides the scroll-reveal animation. Text is white on the dark background.

## Grid Layout

Two separate `<div>` grid containers stacked vertically with `gap-[20px]` between them:

| Row | Cards |
|---|---|
| Row 1 | Tenant Placement, Rent Collection, Maintenance Coordination |
| Row 2 | Financial Reporting, Lease Management, Eviction Protection |

Each row has its own CSS class (`manage-handle-row-1`, `manage-handle-row-2`) so CSS `:has()` hover expand operates independently per row.

## Card Style

Cards are **identical** to `ManageServices` cards:

```tsx
<div className="manage-handle-card relative overflow-hidden h-[470px] rounded-xl grid content-end gap-5 p-[50px]">
  {/* Background image */}
  <div className="absolute inset-0">
    <img src={card.image} alt={card.title} className="w-full h-full object-cover scale-[1.01]" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5" />
  </div>
  {/* Title */}
  <h3 className="relative font-sans font-medium text-[42px] tracking-[-0.02em]">{card.title}</h3>
  {/* Body */}
  <p className="card-handle-text relative font-sans text-sm leading-relaxed text-white/75 md:text-base">{card.body}</p>
  {/* Button */}
  <div className="relative">
    <Link href="/contact" className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/20 backdrop-blur-sm px-6 py-3 font-sans text-sm font-medium text-white hover:border-white/70 transition-colors">
      Learn More →
    </Link>
  </div>
</div>
```

Note: body text class is `card-handle-text` (not `card-body-text`) to avoid inheriting ManageServices CSS from the same page.

## Hover Expand (Desktop Only)

CSS injected via `<style>` tag in the component, same pattern as `ManageServices`:

```css
.manage-handle-row-1,
.manage-handle-row-2 {
  transition: grid-template-columns 1s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (min-width: 768px) and (pointer: fine) {
  /* Row 1 */
  .manage-handle-row-1:has(.manage-handle-card:nth-child(1):hover) { grid-template-columns: 1.2fr 0.9fr 0.9fr; }
  .manage-handle-row-1:has(.manage-handle-card:nth-child(2):hover) { grid-template-columns: 0.9fr 1.2fr 0.9fr; }
  .manage-handle-row-1:has(.manage-handle-card:nth-child(3):hover) { grid-template-columns: 0.9fr 0.9fr 1.2fr; }
  /* Row 2 */
  .manage-handle-row-2:has(.manage-handle-card:nth-child(1):hover) { grid-template-columns: 1.2fr 0.9fr 0.9fr; }
  .manage-handle-row-2:has(.manage-handle-card:nth-child(2):hover) { grid-template-columns: 0.9fr 1.2fr 0.9fr; }
  .manage-handle-row-2:has(.manage-handle-card:nth-child(3):hover) { grid-template-columns: 0.9fr 0.9fr 1.2fr; }
  /* Body text — hidden at rest, fade-in on hover */
  .manage-handle-card .card-handle-text { opacity: 0; transition: opacity 0.4s ease; }
  .manage-handle-card:hover .card-handle-text { opacity: 1; }
}
```

## Card Data

```ts
const CARDS = [
  // Row 1
  { title: "Tenant Placement",       body: "We market your property on CRMLS and major platforms, screen applicants thoroughly, and place qualified tenants fast.",        image: "https://picsum.photos/seed/handle-tenant/800/600",      href: "/contact" },
  { title: "Rent Collection",         body: "Automated rent collection with direct deposit to your account. Late payments handled professionally so you don't have to.",   image: "https://picsum.photos/seed/handle-rent/800/600",        href: "/contact" },
  { title: "Maintenance Coordination",body: "24/7 maintenance request line. We coordinate with licensed vendors, get multiple bids, and keep you informed at every step.", image: "https://picsum.photos/seed/handle-maintenance/800/600",  href: "/contact" },
  // Row 2
  { title: "Financial Reporting",     body: "Monthly income and expense statements, annual reports for tax prep, and a live owner portal to see everything in real time.", image: "https://picsum.photos/seed/handle-financial/800/600",   href: "/contact" },
  { title: "Lease Management",        body: "California-compliant leases, renewals, rent increase notices, and move-out inspections — all handled by our team.",           image: "https://picsum.photos/seed/handle-lease/800/600",       href: "/contact" },
  { title: "Eviction Protection",     body: "When necessary, we follow California eviction law precisely and work with our legal partners to protect your investment.",     image: "https://picsum.photos/seed/handle-eviction/800/600",    href: "/contact" },
];
```

## Mobile Behavior

- Single column (`grid-cols-1`) on mobile — same as `ManageServices`
- `:has()` hover rules scoped to `(min-width: 768px) and (pointer: fine)` — touch devices see static single-column grid only
- Card height: `h-[400px] md:h-[470px]` — slightly shorter on mobile, matching ManageServices

## page.tsx Change

Remove:
```tsx
const SERVICES = [...]; // 6-item array

<section className="border-t border-[#1B1B1B]/20 px-8 py-24 lg:px-20">
  ...text grid...
</section>
```

Add:
```tsx
import { ManageHandle } from "@/components/manage/ManageHandle";
// ...
<ManageHandle />
```

`SERVICES` array and `RevealText` import can be removed from `page.tsx` if no longer used elsewhere.

## Spec Self-Review

1. **Placeholder scan:** No TBDs. All card data, CSS class names, and markup are fully specified.
2. **Internal consistency:** `card-handle-text` class is used in both the CSS block and card markup. `manage-handle-card` class is used in both `:has()` selectors and card markup.
3. **Scope:** Single component + one page import. Focused.
4. **Ambiguity:** Mobile card height (`h-[400px] md:h-[470px]`) follows ManageServices pattern exactly. No ambiguity.
