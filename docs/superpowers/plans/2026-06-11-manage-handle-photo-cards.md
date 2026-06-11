# ManageHandle Photo Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "What we handle" text grid on the manage page with a new `ManageHandle` component containing 2 rows of 3 photo cards styled identically to `ManageServices`, with per-row CSS `:has()` hover expand.

**Architecture:** One new component (`ManageHandle.tsx`) + one small edit to `manage/page.tsx`. No new dependencies. Mirrors the `ManageServices` pattern exactly.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, CSS `:has()` selector, picsum.photos placeholder images

---

## File Structure

| File | Change |
|---|---|
| Create: `apps/web/src/components/manage/ManageHandle.tsx` | New component — 6 photo cards in 2 rows with hover expand |
| Modify: `apps/web/src/app/(marketing)/manage/page.tsx` | Remove inline SERVICES section, add `<ManageHandle />` import and usage |

---

### Task 1: Create ManageHandle component

**Files:**
- Create: `apps/web/src/components/manage/ManageHandle.tsx`

- [ ] **Step 1: Create the file with all card data, CSS, and markup**

Create `apps/web/src/components/manage/ManageHandle.tsx` with this exact content:

```tsx
import Link from "next/link";
import { RevealText } from "@/components/ui/reveal-text";

const CARDS = [
  {
    title: "Tenant Placement",
    body: "We market your property on CRMLS and major platforms, screen applicants thoroughly, and place qualified tenants fast.",
    image: "https://picsum.photos/seed/handle-tenant/800/600",
    href: "/contact",
  },
  {
    title: "Rent Collection",
    body: "Automated rent collection with direct deposit to your account. Late payments handled professionally so you don't have to.",
    image: "https://picsum.photos/seed/handle-rent/800/600",
    href: "/contact",
  },
  {
    title: "Maintenance Coordination",
    body: "24/7 maintenance request line. We coordinate with licensed vendors, get multiple bids, and keep you informed at every step.",
    image: "https://picsum.photos/seed/handle-maintenance/800/600",
    href: "/contact",
  },
  {
    title: "Financial Reporting",
    body: "Monthly income and expense statements, annual reports for tax prep, and a live owner portal to see everything in real time.",
    image: "https://picsum.photos/seed/handle-financial/800/600",
    href: "/contact",
  },
  {
    title: "Lease Management",
    body: "California-compliant leases, renewals, rent increase notices, and move-out inspections — all handled by our team.",
    image: "https://picsum.photos/seed/handle-lease/800/600",
    href: "/contact",
  },
  {
    title: "Eviction Protection",
    body: "When necessary, we follow California eviction law precisely and work with our legal partners to protect your investment.",
    image: "https://picsum.photos/seed/handle-eviction/800/600",
    href: "/contact",
  },
];

const ROW_1 = CARDS.slice(0, 3);
const ROW_2 = CARDS.slice(3, 6);

export function ManageHandle() {
  return (
    <section data-navbar-theme="dark" className="bg-[#1B1B1B] text-white py-24 md:py-[150px]">
      <style>{`
        .manage-handle-row-1,
        .manage-handle-row-2 {
          transition: grid-template-columns 1s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (min-width: 768px) and (pointer: fine) {
          .manage-handle-row-1:has(.manage-handle-card:nth-child(1):hover) { grid-template-columns: 1.2fr 0.9fr 0.9fr; }
          .manage-handle-row-1:has(.manage-handle-card:nth-child(2):hover) { grid-template-columns: 0.9fr 1.2fr 0.9fr; }
          .manage-handle-row-1:has(.manage-handle-card:nth-child(3):hover) { grid-template-columns: 0.9fr 0.9fr 1.2fr; }
          .manage-handle-row-2:has(.manage-handle-card:nth-child(1):hover) { grid-template-columns: 1.2fr 0.9fr 0.9fr; }
          .manage-handle-row-2:has(.manage-handle-card:nth-child(2):hover) { grid-template-columns: 0.9fr 1.2fr 0.9fr; }
          .manage-handle-row-2:has(.manage-handle-card:nth-child(3):hover) { grid-template-columns: 0.9fr 0.9fr 1.2fr; }
          .manage-handle-card .card-handle-text { opacity: 0; transition: opacity 0.4s ease; }
          .manage-handle-card:hover .card-handle-text { opacity: 1; }
        }
      `}</style>

      <div className="mx-auto max-w-[1920px] px-10 md:px-[100px]">
        <h2 className="mb-16 font-sans text-[2rem] font-light">
          <RevealText>What we handle</RevealText>
        </h2>

        {/* Row 1 */}
        <div className="manage-handle-row-1 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-[20px]">
          {ROW_1.map((card) => (
            <div
              key={card.title}
              className="manage-handle-card relative overflow-hidden h-[400px] md:h-[470px] rounded-2xl md:rounded-xl grid content-end gap-5 p-8 md:p-[50px]"
            >
              <div className="absolute inset-0">
                <img
                  src={card.image}
                  alt={card.title}
                  className="w-full h-full object-cover scale-[1.01]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5" />
              </div>
              <h3 className="relative font-sans font-medium text-[28px] leading-[115%] tracking-[-0.01em] max-w-[85%] md:text-[42px] md:tracking-[-0.02em]">
                {card.title}
              </h3>
              <p className="card-handle-text relative font-sans text-sm leading-relaxed text-white/75 md:text-base">
                {card.body}
              </p>
              <div className="relative">
                <Link
                  href={card.href}
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/20 backdrop-blur-sm px-6 py-3 font-sans text-sm font-medium text-white hover:border-white/70 transition-colors"
                >
                  Learn More →
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Row 2 */}
        <div className="manage-handle-row-2 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-[20px] mt-3 md:mt-[20px]">
          {ROW_2.map((card) => (
            <div
              key={card.title}
              className="manage-handle-card relative overflow-hidden h-[400px] md:h-[470px] rounded-2xl md:rounded-xl grid content-end gap-5 p-8 md:p-[50px]"
            >
              <div className="absolute inset-0">
                <img
                  src={card.image}
                  alt={card.title}
                  className="w-full h-full object-cover scale-[1.01]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5" />
              </div>
              <h3 className="relative font-sans font-medium text-[28px] leading-[115%] tracking-[-0.01em] max-w-[85%] md:text-[42px] md:tracking-[-0.02em]">
                {card.title}
              </h3>
              <p className="card-handle-text relative font-sans text-sm leading-relaxed text-white/75 md:text-base">
                {card.body}
              </p>
              <div className="relative">
                <Link
                  href={card.href}
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/20 backdrop-blur-sm px-6 py-3 font-sans text-sm font-medium text-white hover:border-white/70 transition-colors"
                >
                  Learn More →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify the file was created**

Check that `apps/web/src/components/manage/ManageHandle.tsx` exists and is not empty.

---

### Task 2: Update manage/page.tsx

**Files:**
- Modify: `apps/web/src/app/(marketing)/manage/page.tsx`

- [ ] **Step 1: Read the current file**

Read `apps/web/src/app/(marketing)/manage/page.tsx` to confirm its exact current content.

- [ ] **Step 2: Add ManageHandle import**

At the top of the file, add:
```tsx
import { ManageHandle } from "@/components/manage/ManageHandle";
```

- [ ] **Step 3: Replace the inline SERVICES section**

Remove the entire inline `<section>` block (the `SERVICES` const + the section JSX). Replace with:
```tsx
<ManageHandle />
```

Also remove the `SERVICES` const declaration at the top of the file.

Remove `RevealText` from imports if it is no longer used in `page.tsx` after this change.

- [ ] **Step 4: Verify the file compiles**

Check dev server terminal for `✓ Compiled /manage` with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/manage/ManageHandle.tsx apps/web/src/app/(marketing)/manage/page.tsx
git commit -m "feat(manage): replace What we handle text grid with 2x3 photo cards"
```
