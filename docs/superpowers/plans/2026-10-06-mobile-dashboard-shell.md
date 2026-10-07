# Mobile Layout — Sub-project 7a (Dashboard Shell + Shared Pieces) Implementation Plan

> **Note (post-build):** the table approach changed. Tables scroll via `PHONE_TABLE_FRAME` (`max-lg:overflow-x-auto`) on the PARENT card, not `PHONE_TABLE` / `max-lg:block` on the `<table>` (that shrank rows on iPads). See the spec, sections 2 and 4.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones and upright iPads (<1024px) the dashboard's fixed 224px sidebar becomes a slim bar + slide-in menu, and the shared pieces every dashboard page uses (popups, form fields, tables, tab bars, drag boards) work on touch screens — desktop unchanged.

**Architecture:** Phone-only `max-lg:` classes appended to existing markup, most of them through one named bundle in `lib/dashboard-phone.ts` whose every word is pinned to `max-lg:` by a test. The sidebar's nav lists and sections move unchanged into shared modules so the desktop sidebar and the new phone menu render from one source. One new client component holds the menu's open state; one new hook gives both drag boards the same desktop sensor and a phone touch sensor.

**Tech Stack:** Next.js 14 App Router, Tailwind 3.4.19, `motion` 12.38 (`motion/react`), `@dnd-kit/core` 6.3, `lucide-react`, Vitest (node env, `src/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-10-06-mobile-dashboard-shell-design.md` (parent: `docs/superpowers/specs/2026-10-03-mobile-layout-design.md`)

## Global Constraints

- **Desktop (≥1024px) pixel-identical.** Existing class strings are never edited — only words appended, every one prefixed `max-lg:` (compiles to `@media not all and (min-width:1024px)`), except `lg:hidden` on elements that exist only for phones.
- **Width-based switch at 1024px** (Ryan, option A).
- **No new libraries.** Reuse: nav lists + `NavSection` from `app/(dashboard)/layout.tsx`, the navbar's `AnimatePresence` + `bg-black/40` backdrop pattern, `useIsMobile()`, `EASE_OUT_EXPO` from `lib/motion.ts`, `@dnd-kit/core` `TouchSensor`/`MouseSensor`, `lucide-react` icons.
- **Phone hold-to-drag: 0.4s** (`delay: 400`), tolerance 8. Desktop drag stays `PointerSensor` `{ distance: 8 }`.
- **Popups centered on phones** with 16px margin, height capped to the screen, scrolling inside.
- **Every task ends with:** full suite, `tsc --noEmit`, clean `rm -rf apps/web/.next && pnpm --filter web build` (controller stops its own 3100 server first; never touches Ryan's dev server). Commit per task; **no push**.
- **Browser checks are the controller's** (Puppeteer against the local production build on 3100, **headless** — a hidden headed tab freezes animations; same-origin iframes; logged in as Ryan's admin account, read-only: load pages and open/close popups only, never submit).
- **The CRM is empty** (0 leads/deals/files/campaigns) — do not create records. If a desktop fingerprint differs, first check whether data changed.

## Review Focus

1. **Window crosses 1024px while the menu is open** (rotate an iPad, resize a laptop) — the panel must close, never stay hidden-but-open or cover desktop. Pinned in Task 4 (close when `useIsMobile()` turns false) and checked in Task 8.
2. **Short sideways phone (844×340)** — every menu link and a tall popup's Save button must be reachable by scrolling inside the panel. Checked in Task 8.
3. **Exactly 1024px wide** — desktop layout (sidebar, 14px fields, no slim bar). Fingerprints at 1024×768 in Tasks 1 and 8.
4. **Pages not in the nav** (`/admin/reports`, `/admin/triggers`, lead detail, file detail, wizards) — slim bar shows a sensible name, never blank. Pinned by `dashboardPageTitle` tests in Task 3.
5. **Field inside an open popup** — 16px on phones (no iPhone zoom), 14px on desktop. Checked in Task 8.

## Browser toolkit (controller)

Login (once per browser, on any page of `http://localhost:3100`):

```js
const { csrfToken } = await (await fetch("/api/auth/csrf")).json();
await fetch("/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ csrfToken, email: "ryanchong@cncrealtygroup.com", password: "Fakeaccount1!", json: "true" }) });
```

**PAGES (26):** `/dashboard`, `/dashboard/leads`, `/dashboard/pipeline`, `/dashboard/tasks`, `/dashboard/transactions`, `/dashboard/transactions/new-transaction`, `/dashboard/transactions/new-listing`, `/dashboard/campaigns`, `/dashboard/campaigns/new`, `/dashboard/settings`, `/dashboard/academy/videos`, `/dashboard/academy/guides`, `/dashboard/academy/announcements`, `/admin`, `/admin/agents`, `/admin/leads`, `/admin/transactions`, `/admin/applications`, `/admin/action-plans`, `/admin/settings/checklists`, `/admin/blog`, `/admin/blog/new`, `/admin/blog/cms2v38by00005pg4x8msg6e1/edit`, `/admin/settings/tags`, `/admin/reports`, `/admin/triggers`.

**MEASURE(root)** — root = the dashboard frame (`aside.parentElement`), transforms neutralized:

```js
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(16) + ":" + s.length; };
const measure = (root) => { const els = [root, ...root.querySelectorAll("*")]; const sv = els.map((e) => e.style ? e.style.transform : null); els.forEach((e) => { if (e.style) e.style.transform = "none"; }); const r0 = root.getBoundingClientRect();
  const s = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 || r.height > 0).map((r) => [Math.round(r.left - r0.left), Math.round(r.top - r0.top), Math.round(r.width), Math.round(r.height)].join(",")).join("|");
  els.forEach((e, i) => { if (e.style) e.style.transform = sv[i]; }); return hash(s); };
```

Open each page in an iframe of the given size, wait 2500ms, then MEASURE. Long sweeps run as a background loop in the page writing to `window.X`, polled in ≤110s chunks.

**SPEED** — fresh `--user-data-dir` + `--disk-cache-size=1` per run; desktop DPR 1 at 1440×900, phone DPR 3 at 390×844 (`defaultViewport.deviceScaleFactor`); per page 3 loads: TTFB, load, LCP (buffered `largest-contentful-paint` observer, record the element), JS/CSS/image KB from `transferSize`.

## File Structure

| File | Change |
|---|---|
| `lib/dashboard-phone.ts` | **new** — named phone-only class bundles |
| `__tests__/lib/dashboard-phone.test.ts` | **new** — every word starts with `max-lg:` |
| `lib/dashboard-nav.ts` | **new** — nav lists (moved), `dashboardNavMatch`, `dashboardPageTitle` |
| `__tests__/lib/dashboard-nav.test.ts` | **new** |
| `components/dashboard/SidebarNav.tsx` | **new** — `NavSection` + sections + email footer (moved verbatim from layout), optional `activeHref` |
| `components/dashboard/DashboardMobileNav.tsx` | **new** — slim bar + slide-in menu (client) |
| `app/(dashboard)/layout.tsx` | uses the moved pieces; phone frame classes |
| `app/(dashboard)/dashboard/leads/page.tsx`, `.../campaigns/new/page.tsx` | phone height/margin |
| 7 popup files + `components/leads/SmartListDrawer.tsx` | popup/drawer bundles |
| 13 table files, 5 tab-bar files | table/tab bundles |
| `hooks/useBoardSensors.ts` (+ test) | **new** — shared drag sensors |
| `components/dashboard/LeadKanban.tsx`, `components/deals/DealBoard.tsx`, `LeadCard.tsx`, `DealCard.tsx` | use the hook / card bundle |

(All paths under `apps/web/src/`.)

---

### Task 1: Baselines (controller)

- [ ] `git status -s apps/web/src` empty; record `BASELINE_SHA`. Clean build, serve 3100, headless, log in.
- [ ] Desktop MEASURE of all 26 PAGES at **1440×900** and **1024×768**, twice each — both runs identical; record the 52 hashes.
- [ ] SPEED for `/dashboard`, `/dashboard/transactions`, `/dashboard/leads` — desktop and phone; record CSS file bytes (`ls -l .next/static/css`).
- [ ] Desktop: computed font-size of the first `input` on `/dashboard/settings` = 14px; record. Stop 3100.

### Task 2: Phone class bundle

**Files:** Create `lib/dashboard-phone.ts`, `__tests__/lib/dashboard-phone.test.ts`

**Interfaces — Produces:** `PHONE_POPUP_FRAME`, `PHONE_POPUP_PANEL`, `PHONE_DRAWER_PANEL`, `PHONE_TABLE`, `PHONE_TAB_BAR`, `PHONE_FIELDS_16`, `PHONE_DRAG_CARD` (all `string`).

- [ ] **Step 1: Failing test** — `__tests__/lib/dashboard-phone.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as bundle from "@/lib/dashboard-phone";

describe("dashboard phone bundle", () => {
  it("exports the seven phone bundles", () => {
    expect(Object.keys(bundle).sort()).toEqual([
      "PHONE_DRAG_CARD", "PHONE_DRAWER_PANEL", "PHONE_FIELDS_16", "PHONE_POPUP_FRAME",
      "PHONE_POPUP_PANEL", "PHONE_TABLE", "PHONE_TAB_BAR",
    ]);
  });

  it("every class word is phone-only, so nothing here can reach desktop", () => {
    for (const [name, value] of Object.entries(bundle)) {
      expect(typeof value, name).toBe("string");
      const words = (value as string).split(/\s+/).filter(Boolean);
      expect(words.length, name).toBeGreaterThan(0);
      for (const word of words) expect(word, `${name}: ${word}`).toMatch(/^max-lg:/);
    }
  });
});
```

- [ ] **Step 2:** `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/lib/dashboard-phone.test.ts` — Expected FAIL (cannot find `@/lib/dashboard-phone`).
- [ ] **Step 3: Implement** `lib/dashboard-phone.ts`:

```ts
// Phone-only (below 1024px) class bundles for the dashboard, appended to existing classes.
// Every word must start with `max-lg:` so nothing here can reach desktop — pinned by
// __tests__/lib/dashboard-phone.test.ts. Same idea as NAV_PANEL_CLS in lib/motion.ts.

// Centered popup overlay: centered, 16px from the screen edges.
export const PHONE_POPUP_FRAME = "max-lg:items-center max-lg:justify-center max-lg:p-4";
// Popup panel: never taller than the screen, scrolls inside, fully rounded.
export const PHONE_POPUP_PANEL =
  "max-lg:m-0 max-lg:max-h-[calc(100svh-2rem)] max-lg:overflow-y-auto max-lg:rounded-2xl";
// Side drawer panel: full width like the other drawers.
export const PHONE_DRAWER_PANEL = "max-lg:w-full";
// Table: scrolls sideways inside its own box (no wrapper element needed).
export const PHONE_TABLE = "max-lg:block max-lg:overflow-x-auto";
// Pill tab bar: scrolls sideways within itself; pills keep their size.
export const PHONE_TAB_BAR = "max-lg:max-w-full max-lg:overflow-x-auto max-lg:[&>*]:shrink-0";
// 16px fields so iPhone Safari doesn't zoom the page on focus.
export const PHONE_FIELDS_16 =
  "max-lg:[&_input]:text-base max-lg:[&_select]:text-base max-lg:[&_textarea]:text-base max-lg:[&_[contenteditable=true]]:text-base";
// Draggable cards: no iPhone text-selection popup on long-press; touch-friendly.
export const PHONE_DRAG_CARD = "max-lg:select-none max-lg:touch-manipulation max-lg:[-webkit-touch-callout:none]";
```

- [ ] **Step 4:** Test passes (2). Suite, `tsc`, clean build. Then confirm Tailwind generated every bundle rule (`lib/**` is in `tailwind.config.ts` content): `grep -c "contenteditable" .next/static/css/*.css`, `grep -c "touch-callout" ...`, `grep -c "100svh-2rem" ...`, `grep -c "shrink-0" ...` — each ≥1 inside `@media not all and (min-width:1024px)`.
- [ ] **Step 5:** Commit `feat: phone-only class bundle for the dashboard, pinned to max-lg by a test`.

### Task 3: Shared nav lists, page names, sidebar sections (desktop identical)

**Files:** Create `lib/dashboard-nav.ts`, `__tests__/lib/dashboard-nav.test.ts`, `components/dashboard/SidebarNav.tsx`; Modify `app/(dashboard)/layout.tsx`

**Interfaces — Produces:** `type NavItem = { href: string; label: string }`; `AGENT_NAV`, `ACADEMY_NAV`, `ADMIN_NAV: NavItem[]`; `SETTINGS_ITEM: NavItem`; `dashboardNavMatch(pathname: string, isAdmin: boolean): NavItem | null`; `dashboardPageTitle(pathname: string, isAdmin: boolean): string`; `SidebarNav({ isAdmin, email, activeHref? }: { isAdmin: boolean; email: string; activeHref?: string })`.

- [ ] **Step 1: Failing test** — `__tests__/lib/dashboard-nav.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dashboardPageTitle, dashboardNavMatch, AGENT_NAV, ADMIN_NAV } from "@/lib/dashboard-nav";

describe("dashboardPageTitle", () => {
  it("names pages that are in the nav", () => {
    expect(dashboardPageTitle("/dashboard", false)).toBe("Overview");
    expect(dashboardPageTitle("/dashboard/settings", false)).toBe("Settings");
    expect(dashboardPageTitle("/dashboard/academy/videos", false)).toBe("Training Videos");
    expect(dashboardPageTitle("/admin/agents", true)).toBe("All Agents");
  });
  it("names detail and wizard pages after their section", () => {
    expect(dashboardPageTitle("/dashboard/leads/abc123", false)).toBe("Leads");
    expect(dashboardPageTitle("/dashboard/transactions/new-listing", false)).toBe("Transactions");
    expect(dashboardPageTitle("/admin/transactions/listing/xyz", true)).toBe("All Files");
    expect(dashboardPageTitle("/admin/blog/xyz/edit", true)).toBe("Blog");
  });
  it("names admin pages that are not in the nav", () => {
    expect(dashboardPageTitle("/admin", true)).toBe("Admin Overview");
    expect(dashboardPageTitle("/admin/reports", true)).toBe("Reports");
    expect(dashboardPageTitle("/admin/triggers", true)).toBe("Triggers");
  });
  it("matches whole path segments only and never returns blank", () => {
    expect(dashboardPageTitle("/dashboard/leadsfoo", false)).toBe("Overview");
    expect(dashboardPageTitle("/admin/agents", false)).toBe("Dashboard");
    expect(dashboardPageTitle("/somewhere", false)).toBe("Dashboard");
  });
});

describe("dashboardNavMatch", () => {
  it("returns the nav item to highlight (longest match)", () => {
    expect(dashboardNavMatch("/dashboard/leads/abc", false)).toEqual({ href: "/dashboard/leads", label: "Leads" });
    expect(dashboardNavMatch("/admin/settings/tags", true)).toEqual({ href: "/admin/settings/tags", label: "Tags" });
    expect(dashboardNavMatch("/admin/reports", true)).toEqual({ href: "/admin", label: "Overview" });
  });
  it("keeps the nav lists exactly as the sidebar had them", () => {
    expect(AGENT_NAV.map((i) => i.label)).toEqual(["Overview", "Leads", "Pipeline", "Tasks", "Transactions", "Campaigns"]);
    expect(ADMIN_NAV.map((i) => i.label)).toEqual(["Overview", "All Agents", "All Leads", "All Files", "Applications", "Action Plans", "Checklists", "Blog", "Tags"]);
  });
});
```

- [ ] **Step 2:** Run it — Expected FAIL (module not found).
- [ ] **Step 3: Implement** `lib/dashboard-nav.ts` (lists copied verbatim from `layout.tsx` lines 6–33):

```ts
export type NavItem = { href: string; label: string };

export const AGENT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/pipeline", label: "Pipeline" },
  { href: "/dashboard/tasks", label: "Tasks" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
];

export const SETTINGS_ITEM: NavItem = { href: "/dashboard/settings", label: "Settings" };

export const ACADEMY_NAV: NavItem[] = [
  { href: "/dashboard/academy/videos", label: "Training Videos" },
  { href: "/dashboard/academy/guides", label: "Documents" },
  { href: "/dashboard/academy/announcements", label: "Announcements" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/agents", label: "All Agents" },
  { href: "/admin/leads", label: "All Leads" },
  { href: "/admin/transactions", label: "All Files" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/action-plans", label: "Action Plans" },
  { href: "/admin/settings/checklists", label: "Checklists" },
  { href: "/admin/blog", label: "Blog" },
  { href: "/admin/settings/tags", label: "Tags" },
];

// Slim-bar names for admin pages the nav doesn't list (and to tell the two "Overview"s apart).
const EXTRA_TITLES: NavItem[] = [
  { href: "/admin", label: "Admin Overview" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/triggers", label: "Triggers" },
];

const covers = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

function longestMatch(pathname: string, items: NavItem[]): NavItem | null {
  return items.filter((i) => covers(pathname, i.href)).sort((a, b) => b.href.length - a.href.length)[0] ?? null;
}

function navItems(isAdmin: boolean): NavItem[] {
  return [...AGENT_NAV, ...ACADEMY_NAV, SETTINGS_ITEM, ...(isAdmin ? ADMIN_NAV : [])];
}

// The sidebar link to highlight for this page.
export function dashboardNavMatch(pathname: string, isAdmin: boolean): NavItem | null {
  return longestMatch(pathname, navItems(isAdmin));
}

// The page name shown in the phone slim bar. Extras come first so they win ties.
export function dashboardPageTitle(pathname: string, isAdmin: boolean): string {
  const items = [...(isAdmin ? EXTRA_TITLES : []), ...navItems(isAdmin)];
  return longestMatch(pathname, items)?.label ?? "Dashboard";
}
```

- [ ] **Step 4:** Test passes.
- [ ] **Step 5: Move the sidebar markup** — create `components/dashboard/SidebarNav.tsx`. `NavSection` is copied **verbatim** from `layout.tsx` lines 35–71 with one addition (`activeHref`); the sections and email footer are copied verbatim from lines 81–91. With `activeHref` omitted, the rendered HTML is identical to today's:

```tsx
import Link from "next/link";
import { AGENT_NAV, ACADEMY_NAV, ADMIN_NAV, SETTINGS_ITEM, type NavItem } from "@/lib/dashboard-nav";

function NavSection({
  label,
  items,
  stickToBottom = false,
  preserveCase = false,
  activeHref,
}: {
  label: string;
  items: NavItem[];
  stickToBottom?: boolean;
  preserveCase?: boolean;
  activeHref?: string;
}) {
  return (
    <div className={stickToBottom ? "mt-auto" : "mb-6"}>
      <p
        className={`mb-1 px-3 text-xs font-semibold tracking-wider text-[#1B1B1B]/30 ${preserveCase ? "" : "uppercase"}`}
      >
        {label}
      </p>
      <div className="mb-2 border-t border-[#1B1B1B]/10" />
      <nav className="flex flex-col gap-1">
        {items.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-2 font-sans text-sm font-light text-[#1B1B1B]/60 transition-colors hover:bg-[#F2F0EF] hover:text-[#1B1B1B]${href === activeHref ? " bg-[#F2F0EF] !text-[#1B1B1B]" : ""}`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

// The dashboard sidebar's contents — rendered by the desktop sidebar (no activeHref) and the
// phone menu (DashboardMobileNav, with activeHref).
export function SidebarNav({ isAdmin, email, activeHref }: { isAdmin: boolean; email: string; activeHref?: string }) {
  return (
    <>
      <NavSection label="Agent" items={AGENT_NAV} activeHref={activeHref} />
      <NavSection label="CnC ACADEMY" items={ACADEMY_NAV} preserveCase activeHref={activeHref} />
      {!isAdmin && <NavSection label="Account" items={[SETTINGS_ITEM]} stickToBottom activeHref={activeHref} />}
      {isAdmin && <NavSection label="Admin" items={[...ADMIN_NAV, SETTINGS_ITEM]} stickToBottom activeHref={activeHref} />}

      <div className="border-t border-[#1B1B1B]/10 pt-4">
        <p className="font-sans text-xs text-[#1B1B1B]/40">{email}</p>
        {isAdmin && (
          <p className="mt-0.5 font-sans text-xs font-medium text-[#9E8C61]">Admin</p>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 6:** In `layout.tsx`: delete the `Link` import (line 1), the four nav constants (6–33) and `NavSection` (35–71); import `SidebarNav`; replace the aside's children (lines 81–91) with `<SidebarNav isAdmin={isAdmin} email={(session.user as any).email} />`. Nothing else changes in this task.
- [ ] **Step 7:** Suite, `tsc`, clean build. Commit `refactor: dashboard nav lists and sidebar sections in shared modules (same desktop output)`.
- [ ] **Step 8 (controller):** desktop MEASURE all 26 PAGES at 1440×900 + 1024×768 = Task 1 baselines. Also `curl` the server HTML of `/dashboard` (logged-in cookie) before/after: the `<aside>`'s inner HTML is byte-identical.

### Task 4: Phone shell — slim bar, slide-in menu, page frame, field size

**Files:** Create `components/dashboard/DashboardMobileNav.tsx`; Modify `app/(dashboard)/layout.tsx`, `app/(dashboard)/dashboard/leads/page.tsx:83`, `app/(dashboard)/dashboard/campaigns/new/page.tsx:116`

**Interfaces — Consumes:** `SidebarNav`, `dashboardNavMatch`, `dashboardPageTitle` (Task 3); `PHONE_FIELDS_16` (Task 2); `useIsMobile` (`hooks/useIsMobile.ts`); `EASE_OUT_EXPO` (`lib/motion.ts`). **Produces:** `DashboardMobileNav({ email, isAdmin }: { email: string; isAdmin: boolean })`.

(The component's logic is covered by Task 3's pure functions; this project has no component-render tests — node env — so its behavior is verified in the browser in Step 6 and Task 8.)

- [ ] **Step 1:** Create `components/dashboard/DashboardMobileNav.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { dashboardNavMatch, dashboardPageTitle } from "@/lib/dashboard-nav";
import { useIsMobile } from "@/hooks/useIsMobile";
import { EASE_OUT_EXPO } from "@/lib/motion";

// Phones only (<1024px): slim bar with the menu button and page name; the sidebar slides in
// from the left over the page. Same backdrop/AnimatePresence pattern as the site navbar's menu.
export function DashboardMobileNav({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // Close on navigation, and whenever the window grows to desktop width.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!isMobile) setOpen(false);
  }, [isMobile]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="flex h-11 flex-shrink-0 items-center gap-2 border-b border-[#1B1B1B]/10 bg-white px-2 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open dashboard menu"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#1B1B1B]/70 transition-colors hover:bg-[#F2F0EF]"
        >
          <Menu size={20} />
        </button>
        <p className="truncate font-sans text-sm font-medium text-[#1B1B1B]">{dashboardPageTitle(pathname, isAdmin)}</p>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="dashboard-menu-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-black/40 lg:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              key="dashboard-menu-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Dashboard menu"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: EASE_OUT_EXPO as [number, number, number, number] }}
              className="fixed inset-y-0 left-0 z-[70] flex w-[280px] max-w-[85vw] flex-col overflow-y-auto bg-white px-4 py-4 shadow-2xl lg:hidden"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close dashboard menu"
                className="mb-4 flex h-9 w-9 items-center justify-center self-end rounded-lg text-[#1B1B1B]/60 transition-colors hover:bg-[#F2F0EF]"
              >
                <X size={18} />
              </button>
              <SidebarNav isAdmin={isAdmin} email={email} activeHref={dashboardNavMatch(pathname, isAdmin)?.href} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 2:** In `layout.tsx` (import `DashboardMobileNav` and `PHONE_FIELDS_16`):
  - outer `<div className="flex h-screen bg-[#F2F0EF] pt-16">` → ``<div className={`flex h-screen bg-[#F2F0EF] pt-16 max-lg:h-[100svh] max-lg:flex-col ${PHONE_FIELDS_16}`}>``
  - first child of that div: `<DashboardMobileNav email={(session.user as any).email} isAdmin={isAdmin} />`
  - `<aside className="flex w-56 flex-shrink-0 flex-col overflow-y-auto border-r border-[#1B1B1B]/10 bg-white px-4 py-6">` → append `" max-lg:hidden"`
  - `<main className="flex-1 overflow-auto p-8">` → `<main className="flex-1 overflow-auto p-8 max-lg:min-h-0 max-lg:p-4">` (`min-h-0` lets `<main>` stay the scroll container in the stacked phone frame)
- [ ] **Step 3:** `leads/page.tsx:83` `"-m-8 flex min-h-[calc(100vh-4rem)]"` → `"-m-8 flex min-h-[calc(100vh-4rem)] max-lg:-m-4 max-lg:min-h-[calc(100svh-4rem-2.75rem)]"`; `campaigns/new/page.tsx:116` append `" max-lg:min-h-[calc(100svh-4rem-2.75rem)]"` to its class string.
- [ ] **Step 4:** Suite, `tsc`, clean build. Commit `feat: dashboard phone shell — slim bar, slide-in menu, 16px fields`.
- [ ] **Step 5 (controller):** desktop MEASURE all 26 PAGES at 1440×900 + 1024×768 = baselines; desktop: no element with `aria-label="Open dashboard menu"` visible, first `/dashboard/settings` input 14px.
- [ ] **Step 6 (controller), phones** (320×568, 390×844, 844×340, 820×1180): slim bar visible with the right name on `/dashboard`, `/dashboard/leads`, `/admin/reports`; sidebar hidden; `<main>` width = viewport and its content box = viewport − 32px; menu opens (button), closes via backdrop, ✕, Escape, and a link click (lands on the new page closed); on 844×340 the panel scrolls and its last link is reachable; resize the iframe 820→1100 with the menu open → panel gone, reopen at 820 → closed; field font 16px.

### Task 5: Popups and the Smart List drawer

**Files:** Modify `components/leads/NewLeadModal.tsx:133`, `components/deals/NewDealModal.tsx:95,97`, `components/leads/AssignLeadModal.tsx:41-42`, `components/leads/RelationshipSection.tsx:71-72`, `app/(dashboard)/admin/leads/AdminLeadsClient.tsx:335-336`, `app/(dashboard)/admin/leads/AdminLeadsMergeClient.tsx:179-180`, `components/leads/LeadTasksTab.tsx:181,183`, `components/leads/SmartListDrawer.tsx:352`

**Interfaces — Consumes:** `PHONE_POPUP_FRAME`, `PHONE_POPUP_PANEL`, `PHONE_DRAWER_PANEL` from `@/lib/dashboard-phone`.

In each file import the bundles and append them to the existing strings — the existing text stays exactly as is. Plain strings become template literals:

- [ ] `NewLeadModal.tsx:133` `"w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl"` → `` `w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl ${PHONE_POPUP_PANEL}` `` (its overlay at :126 already has `p-4` and is centered).
- [ ] `NewDealModal.tsx:95` `` `fixed inset-0 z-50 flex items-center justify-center ${open ? "" : "hidden"}` `` → `` `fixed inset-0 z-50 flex items-center justify-center ${open ? "" : "hidden"} ${PHONE_POPUP_FRAME}` ``; `:97` `"relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"` → `` `relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ${PHONE_POPUP_PANEL}` ``.
- [ ] `AssignLeadModal.tsx`, `RelationshipSection.tsx`, `AdminLeadsClient.tsx`, `AdminLeadsMergeClient.tsx`: overlay `"fixed inset-0 z-50 flex items-center justify-center bg-black/40"` → `` `fixed inset-0 z-50 flex items-center justify-center bg-black/40 ${PHONE_POPUP_FRAME}` ``; panel `"w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"` → `` `w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ${PHONE_POPUP_PANEL}` ``.
- [ ] `LeadTasksTab.tsx:181` `"fixed inset-0 z-50 flex items-end justify-end"` → `` `fixed inset-0 z-50 flex items-end justify-end ${PHONE_POPUP_FRAME}` ``; `:183` `"relative w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl sm:m-4"` → `` `relative w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl sm:m-4 ${PHONE_POPUP_PANEL}` `` (centered on phones, per Ryan).
- [ ] `SmartListDrawer.tsx:352` `"relative flex h-full w-96 flex-col overflow-y-auto bg-white shadow-xl"` → `` `relative flex h-full w-96 flex-col overflow-y-auto bg-white shadow-xl ${PHONE_DRAWER_PANEL}` ``.
- [ ] Suite, `tsc`, clean build. Commit `feat: dashboard popups fit phones — margin, screen-height cap, scroll; Smart List drawer full width`.
- [ ] **Controller:** desktop MEASURE all 26 PAGES = baselines. Phones (390×844, 844×340, 320×568): open **New Lead** (`/dashboard/leads`) and **New Deal** (`/dashboard/pipeline`) via their buttons — panel inside the screen with ≥16px margin, `max-height` ≤ viewport − 32px, last button reachable by scrolling the panel, field font 16px; close without submitting. Open the Smart List drawer if reachable without data (its "new list" button) — width = viewport.

### Task 6: Tables and tab bars

**Files:** Modify the 15 `<table>`s: `admin/applications/ApplicationsClient.tsx:51`, `admin/leads/AdminLeadsClient.tsx:169,263`, `admin/leads/AdminLeadsMergeClient.tsx:87`, `admin/page.tsx:134`, `admin/reports/page.tsx:117,167,207`, `admin/settings/tags/AdminTagsClient.tsx:115`, `components/admin/AdminTable.tsx:9`, `components/blog/admin/BlogPostList.tsx:37`, `components/dashboard/DashboardTabs.tsx:174`, `components/leads/SmartListResults.tsx:157`, `components/transactions/DocumentsTab.tsx:76`, `components/transactions/PartiesTable.tsx:46` (app paths under `app/(dashboard)/`). Tab bars: `admin/transactions/page.tsx:48`, `admin/transactions/[fileType]/[id]/page.tsx:216`, `dashboard/pipeline/page.tsx:102`, `dashboard/transactions/page.tsx:45`, `components/leads/LeadProfileTabs.tsx:47`.

**Interfaces — Consumes:** `PHONE_TABLE`, `PHONE_TAB_BAR`.

- [ ] Each listed `<table className="w-full text-sm">` → `` <table className={`w-full text-sm ${PHONE_TABLE}`}> ``; the one `<table className="w-full">` (`SmartListResults.tsx:157`) → `` <table className={`w-full ${PHONE_TABLE}`}> ``. Leave `dashboard/campaigns/[id]/page.tsx:317` alone (already inside `overflow-x-auto`). `AdminTable`'s wrapper keeps `overflow-hidden` (the table now scrolls inside it, which also keeps the rounded corners).
- [ ] Each tab bar `"mb-6 flex gap-1 rounded-xl bg-[#F2F0EF] p-1 w-fit"` → `` `mb-6 flex gap-1 rounded-xl bg-[#F2F0EF] p-1 w-fit ${PHONE_TAB_BAR}` ``; `LeadProfileTabs.tsx:47` `"mb-4 flex gap-1 rounded-xl bg-[#F2F0EF] p-1"` → `` `mb-4 flex gap-1 rounded-xl bg-[#F2F0EF] p-1 ${PHONE_TAB_BAR}` ``. The agent file-detail tab bar (`dashboard/transactions/[fileType]/[id]/page.tsx:317`) already scrolls — unchanged.
- [ ] Suite, `tsc`, clean build. Commit `feat: dashboard tables and tab bars scroll sideways within themselves on phones`.
- [ ] **Controller:** desktop MEASURE all 26 PAGES = baselines. Phones 320×568 + 390×844: `/admin/settings/tags`, `/admin/reports`, `/admin/leads`, `/dashboard/pipeline` — page scrollWidth = viewport; each table's `scrollWidth ≥ clientWidth` and its box ≤ the content width; Pipeline's tab bar box ≤ content width and scrolls to its last pill.

### Task 7: Shared touch drag for the two boards

**Files:** Create `hooks/useBoardSensors.ts`, `__tests__/hooks/useBoardSensors.test.ts`; Modify `components/dashboard/LeadKanban.tsx:60`, `components/deals/DealBoard.tsx:43`, `components/dashboard/LeadCard.tsx:24`, `components/deals/DealCard.tsx:25`

**Interfaces — Consumes:** `useIsMobile`, `PHONE_DRAG_CARD`. **Produces:** `DESKTOP_DRAG = { distance: 8 }`, `PHONE_TOUCH_DRAG = { delay: 400, tolerance: 8 }`, `boardSensorKinds(isMobile: boolean): ("pointer" | "touch" | "mouse")[]`, `useBoardSensors(): SensorDescriptor<any>[]`.

- [ ] **Step 1: Failing test** — `__tests__/hooks/useBoardSensors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { boardSensorKinds, DESKTOP_DRAG, PHONE_TOUCH_DRAG } from "@/hooks/useBoardSensors";

describe("board drag sensors", () => {
  it("desktop keeps today's mouse drag exactly", () => {
    expect(boardSensorKinds(false)).toEqual(["pointer"]);
    expect(DESKTOP_DRAG).toEqual({ distance: 8 });
  });
  it("phones pick a card up after a 0.4s hold, so swipes still scroll", () => {
    expect(boardSensorKinds(true)).toEqual(["touch", "mouse"]);
    expect(PHONE_TOUCH_DRAG).toEqual({ delay: 400, tolerance: 8 });
  });
});
```

- [ ] **Step 2:** Run — Expected FAIL (module not found).
- [ ] **Step 3: Implement** `hooks/useBoardSensors.ts`:

```ts
import { MouseSensor, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useIsMobile } from "@/hooks/useIsMobile";

// Desktop: the boards' existing mouse drag, unchanged.
export const DESKTOP_DRAG = { distance: 8 } as const;
// Phones: hold 0.4s to pick a card up; a quick swipe keeps scrolling the page.
export const PHONE_TOUCH_DRAG = { delay: 400, tolerance: 8 } as const;

export function boardSensorKinds(isMobile: boolean): ("pointer" | "touch" | "mouse")[] {
  return isMobile ? ["touch", "mouse"] : ["pointer"];
}

// Shared by LeadKanban and DealBoard. Hooks are always called in the same order.
export function useBoardSensors() {
  const isMobile = useIsMobile();
  const pointer = useSensor(PointerSensor, { activationConstraint: DESKTOP_DRAG });
  const touch = useSensor(TouchSensor, { activationConstraint: PHONE_TOUCH_DRAG });
  const mouse = useSensor(MouseSensor, { activationConstraint: DESKTOP_DRAG });
  const byKind = { pointer, touch, mouse };
  return useSensors(...boardSensorKinds(isMobile).map((k) => byKind[k]));
}
```

- [ ] **Step 4:** Test passes (2).
- [ ] **Step 5:** `LeadKanban.tsx:60` and `DealBoard.tsx:43` `const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));` → `const sensors = useBoardSensors();`; import it; remove `PointerSensor`, `useSensor`, `useSensors` from each file's `@dnd-kit/core` import only if now unused. `LeadCard.tsx:24` `"cursor-grab rounded-xl bg-white p-4 shadow-sm active:cursor-grabbing"` → `` `cursor-grab rounded-xl bg-white p-4 shadow-sm active:cursor-grabbing ${PHONE_DRAG_CARD}` ``; `DealCard.tsx:25-27` — the existing template literal gets one appended word; the conditional is unchanged:

```tsx
      className={`cursor-grab rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${
        isAccepted ? "border-l-2 border-l-[#9E8C61] border-[#1B1B1B]/10" : "border-[#1B1B1B]/10"
      } ${PHONE_DRAG_CARD}`}
```
- [ ] **Step 6:** Suite, `tsc`, clean build. Commit `feat: drag boards share one sensor setup — desktop unchanged, 0.4s hold on phones`.
- [ ] **Controller:** desktop MEASURE `/dashboard/leads`, `/dashboard/pipeline` = baselines. Live touch-drag can't be exercised with an empty CRM — Ruling carried to 7d: test long-press drag (synthetic touch + Ryan's iPhone) once sample data exists with Ryan's OK.

### Task 8: Final verification (controller)

- [ ] Suite + `tsc`; clean build; serve 3100 (headless, logged in).
- [ ] Desktop MEASURE all 26 PAGES at 1440×900 + 1024×768, twice = Task 1 baselines (52/52). Desktop field 14px; no slim bar.
- [ ] Phones (320×568, 344×882, 375×667, 390×844, 430×932, 820×1180, 844×390, 844×340, 667×320): all 26 PAGES — sidebar hidden, slim bar shows a name, `<main>` content width = viewport − 32px, document `scrollWidth == innerWidth`; list remaining in-page overflows (expected: page-specific items for 7b–7e) without fixing them.
- [ ] Review Focus 1–5 (menu across 1024, 844×340 reachability, exact 1024, unnamed pages, field in open popup).
- [ ] SPEED: same three pages, desktop + phone, fresh profiles, vs Task 1 — JS/image KB equal (CSS growth reported in bytes); LCP elements named; repeat cold runs if a single sample differs.
- [ ] Stop 3100. No push. Ryan checks on his iPhone.
