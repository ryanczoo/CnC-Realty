# Mobile Layout — Sub-project 6 (Agent Profiles, Press, Contact, Auth, Legal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the five phone problems found in the survey — reviews squeezed 3-across, oversized bio text, agent photo taller than sideways-phone screens, blurry animated agent photo, Fair Housing URL overflow — and confirm the Press article page on phones; desktop unchanged.

**Architecture:** Phone-only classes (`max-lg:`, `max-lg:landscape:`) on existing markup, one exported pure function pinned by a test (`reviewsPerView`), and an image `sizes` string whose ≥1024px entry is unchanged. No new components.

**Tech Stack:** Next.js 14, Tailwind 3.4.19, `motion` 12.38, Vitest (node env).

**Spec:** `docs/superpowers/specs/2026-10-05-mobile-agents-press-auth-legal-design.md` (parent: `docs/superpowers/specs/2026-10-03-mobile-layout-design.md`)

## Global Constraints

- **Desktop (≥1024px) pixel-identical;** no new components, libraries, or desktop requests.
- **Photo animation kept on every size** — only its end spot changes on sideways phones.
- **Every task ends with** full suite, `tsc --noEmit`, clean `rm -rf apps/web/.next && pnpm --filter web build` (controller stops its own 3100 server first; never touches Ryan's dev server). Commit per task; no push.
- **Browser checks are the controller's** (Puppeteer against the local production build on 3100; same-origin iframes). Agent page fixture: `/agents/ryan-chong`.

## Review Focus

1. **Desktop drift** on `/agents/ryan-chong` (hero, about, reviews, transactions), `/fair-housing`, one `/press/<slug>` — identical boxes at 1440×900; same agent-photo file downloaded on desktop.
2. **Reviews on rotation** — rotating a phone (390×844 ↔ 844×390) changes 1 ↔ 2 per view without leaving a blank slot or an unreachable last review.
3. **Sideways phones (844×340, 667×320)** — after the animation ends, the whole agent photo is on screen, the info under it is reachable by scrolling, and the animation's end matches the photo (no jump).
4. **Bio text** ≤ 28px on phones; desktop 36px unchanged.
5. **Photo sharpness** — on upright phones the animated photo's chosen image is ≥ its displayed width × device pixel ratio.

---

## File Structure

| File | Change |
|---|---|
| `components/agents/AgentReviewsSection.tsx` | export `reviewsPerView`; live per-view count; index clamp |
| `__tests__/components/AgentReviewsSection.test.ts` | pins `reviewsPerView` |
| `components/agents/AgentAboutSection.tsx` | bio text size; sideways side-by-side layout, height-sized photo, static column |
| `components/agents/AgentPhotoMorph.tsx` | `sizes` phone entries |
| `app/(marketing)/fair-housing/page.tsx` | long-URL wrapping |

(All paths under `apps/web/src/`.)

---

### Task 1: Baselines (controller)

- [ ] Tree clean; `BASELINE_SHA`; build + serve 3100. Pick the first `/press/<slug>` from `/press`.
- [ ] Desktop 1440×900 MEASURE twice (identical): agent page `main` (after scrolling through the animation and back to top), `/fair-housing` main content, the Press article main content. Record the agent page's desktop image URLs (the `/_next/image?url=…&w=` requests).
- [ ] Phones: record the Press article page — `scrollWidth`, overflow, screenshot at 390×844 — and note any phone problems (fix in Task 5 with phone-only classes if found).

---

### Task 2: Client Reviews — one card at a time on phones

**Files:** `components/agents/AgentReviewsSection.tsx`; Test `__tests__/components/AgentReviewsSection.test.ts`.

**Interfaces:** Produces `export function reviewsPerView(viewportWidth: number): number`.

- [ ] **Step 1: Failing test**

```ts
// apps/web/src/__tests__/components/AgentReviewsSection.test.ts
import { describe, it, expect } from "vitest";
import { reviewsPerView } from "@/components/agents/AgentReviewsSection";

describe("reviewsPerView", () => {
  it("desktop shows 3 reviews (unchanged)", () => {
    expect(reviewsPerView(1024)).toBe(3);
    expect(reviewsPerView(1440)).toBe(3);
  });
  it("wider phones and iPads show 2", () => {
    expect(reviewsPerView(640)).toBe(2);
    expect(reviewsPerView(844)).toBe(2);
    expect(reviewsPerView(1023)).toBe(2);
  });
  it("upright phones show 1", () => {
    expect(reviewsPerView(320)).toBe(1);
    expect(reviewsPerView(390)).toBe(1);
    expect(reviewsPerView(639)).toBe(1);
  });
});
```

- [ ] **Step 2:** `cd C:/Users/hey_r/Desktop/CnC-Realty/apps/web && npx vitest run src/__tests__/components/AgentReviewsSection.test.ts` — Expected FAIL (`reviewsPerView is not a function`).

- [ ] **Step 3: Implement**

1. Replace

```ts
const VISIBLE = 3;
const MAX_IDX = PLACEHOLDER_REVIEWS.length - VISIBLE;
```

with

```ts
// Reviews shown side by side: 3 on desktop (unchanged), 2 on wider phones and
// iPads, 1 on upright phones — three columns at 390px wrap one word per line.
export function reviewsPerView(viewportWidth: number): number {
  if (viewportWidth >= 1024) return 3;
  if (viewportWidth >= 640) return 2;
  return 1;
}
```

2. In the component, after `const [cardWidth, setCardWidth] = useState(0);` add `const [perView, setPerView] = useState(3);` (first render = 3 = server HTML, so hydration is unchanged) and `const maxIdx = Math.max(0, PLACEHOLDER_REVIEWS.length - perView);`.
3. Replace the `measure` body with:

```ts
    function measure() {
      if (!containerRef.current) return;
      const n = reviewsPerView(window.innerWidth);
      setPerView(n);
      setIdx((i) => Math.min(i, Math.max(0, PLACEHOLDER_REVIEWS.length - n)));
      setCardWidth((containerRef.current.offsetWidth - GAP * (n - 1)) / n);
    }
```

4. `goNext`: `Math.min(MAX_IDX, i + 1)` → `Math.min(maxIdx, i + 1)`; the Next button's `disabled={idx === MAX_IDX}` → `disabled={idx === maxIdx}`.

- [ ] **Step 4:** Test passes (3). Suite, `tsc`, build. Commit `feat: agent reviews show one card at a time on phones`.
- [ ] **Step 5 (controller):** desktop MEASURE agent page = baseline. Phones: 320/390/430 → 1 card, its width ≈ container width, review text lines > 3 words; 820/844/667 → 2 cards; Next reaches the last review and then disables; rotate 390×844 → 844×390 → 390×844 mid-way: no blank slot, last review still reachable.

---

### Task 3: Agent about section — bio size and sideways-phone layout

**Files:** `components/agents/AgentAboutSection.tsx`. Classes only.

- [ ] Row `"flex flex-col gap-12 md:flex-row md:gap-16 lg:gap-24"` → append `" max-lg:landscape:flex-row max-lg:landscape:gap-6"`.
- [ ] Photo column `<div className="md:w-[29%]">` → `<div className="md:w-[29%] max-lg:landscape:w-[29%] max-lg:landscape:shrink-0">`.
- [ ] Sticky wrapper `<div className="sticky top-28">` → `<div className="sticky top-28 max-lg:landscape:static">`.
- [ ] Photo `"relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[#E0DDD8]"` → append `" max-lg:landscape:w-[min(100%,calc((100svh_-_9rem)*0.75))]"` (3:4 photo whose height = screen height − 9rem fits under the 112px navbar offset).
- [ ] Bio column `"md:w-[71%] md:py-4 md:pl-16 lg:pl-24"` → append `" max-lg:landscape:w-[71%] max-lg:landscape:pl-2"`.
- [ ] Both bio paragraphs `"font-sans text-4xl font-medium leading-relaxed text-white/62"` → append `" max-lg:text-[clamp(1.25rem,5.5vw,1.75rem)]"`.
- [ ] Suite, `tsc`, build. Commit `feat: agent bio fits phones; sideways phones get the side-by-side layout with the whole photo on screen`.
- [ ] **Controller:** desktop MEASURE agent page = baseline. Phones: bio font ≤ 28px (≈20px at 320); upright layout otherwise unchanged; 844×340 and 667×320: scroll through the animation — at its end the photo's bottom ≤ viewport height and the visible about photo's box equals the animation's last box (±2px); the license line under the photo can be scrolled into view; no sideways scroll at all 9 sizes.

---

### Task 4: Sharper agent photo on phones; Fair Housing wrapping

**Files:** `components/agents/AgentPhotoMorph.tsx`, `app/(marketing)/fair-housing/page.tsx`.

- [ ] `AgentPhotoMorph.tsx`: `sizes="(max-width: 768px) 96px, 40vw"` → `sizes="(max-width: 1023px) and (orientation: portrait) 100vw, (max-width: 768px) 25vw, 40vw"` (1024px+ still `40vw` → same desktop file).
- [ ] `fair-housing/page.tsx`: `<div className="space-y-12 font-sans text-[#1B1B1B]">` → `<div className="space-y-12 font-sans text-[#1B1B1B] max-lg:[overflow-wrap:anywhere]">`.
- [ ] Suite, `tsc`, build. Commit `fix: sharp agent photo on phones; Fair Housing addresses wrap on phones`.
- [ ] **Controller:** desktop: agent-page image request URLs = baseline list; Fair Housing MEASURE = baseline. Phones: at 390×844 the animated photo's `currentSrc` width parameter (`w=`) ≥ displayed width × 2 at the animation's end; `/fair-housing` scrollWidth = viewport at all 9 sizes.

---

### Task 5: Final verification (controller)

- [ ] Suite + `tsc`; clean build; serve 3100.
- [ ] Desktop MEASURE agent page, Fair Housing, Press article = baselines.
- [ ] Phones (9 sizes): `/agents/ryan-chong`, `/press/<slug>`, `/fair-housing`, plus the already-fine pages (`/press`, `/contact`, `/login`, `/register`, `/forgot-password`, `/privacy`, `/terms`, `/accessibility`) → `scrollWidth == innerWidth`, no overflow. Any Press-article problem found → phone-only class fix, ledgered.
- [ ] WEIGHT agent page desktop + 390×844 vs baseline (desktop jsKB within ~2%; phone image bytes may rise — sharper photo).
- [ ] Stop 3100. No push.
