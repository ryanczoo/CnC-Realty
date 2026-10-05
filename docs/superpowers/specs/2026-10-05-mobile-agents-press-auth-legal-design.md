# Mobile Layout — Sub-project 6: Agent Profiles, Press, Contact, Auth, Legal

**Parent spec:** `docs/superpowers/specs/2026-10-03-mobile-layout-design.md` (phone layout below 1024px,
desktop never changes, fluid 320–1023px incl. sideways phones with short Safari heights, no new
libraries, load speed not worse).
**Scope change (Ryan, 2026-10-05):** the client account page (`/account`) moves to sub-project 7 with the
dashboard (both are behind login).

## Survey (live site, 2026-10-05)

Measured on cncrealtygroup.com at 320–390px wide (and sideways phones where relevant): overflow,
cramped text, screenshots.

**Already fine on phones — no changes:** Press list, Contact, Login, Register, Forgot password, Reset
password, Account setup, Privacy, Terms, Accessibility, Unsubscribe; on the agent profile: intro, stat cards
(already swipe), transactions grid (1/2/3 per row), contact form; the photo animation on upright phones.

**Not visible live:** the Press article page (every article returned 500 in production — fixed in
`5bd32c5`, ships with the final push). Checked on the local production build in this sub-project; any
layout issue found there is fixed with phone-only classes and recorded.

## Hard constraints

- **Desktop (≥1024px) is pixel-identical:** phone-only classes (`max-lg:`, `max-sm:`, `portrait`/`landscape`),
  phone-only JS values pinned by tests, and image `sizes` changes whose ≥1024px entry is unchanged
  (desktop downloads the same file).
- **No new components or libraries; no new desktop requests.**
- The agent photo animation is **kept on every screen size**; only where it ends changes on sideways
  phones.

## Fixes

### 1. Client Reviews — one card at a time on phones (`components/agents/AgentReviewsSection.tsx`)

Today `VISIBLE = 3` is fixed, so phones get three ~100px columns (text one word per line, long words
spilling out).
- New exported pure function `reviewsPerView(viewportWidth)`: below 640px → 1, 640–1023px → 2, 1024px+ → 3
  (desktop pinned by a unit test).
- The component keeps `3` as its first render (server + hydration identical to today), then sets the
  per-view count from the window width in its existing resize handler; card width = container width
  minus gaps, divided by the count (the existing formula). The last-page index uses the live count, and the
  current index is clamped when the count changes (e.g. rotation). Arrows unchanged.

### 2. Bio text size on phones (`components/agents/AgentAboutSection.tsx`)

The bio paragraph(s) are `text-4xl` (36px) everywhere, so a short bio is taller than a phone screen.
- Phones/tablets: `max-lg:text-[clamp(1.25rem,5.5vw,1.75rem)]` (≈20px at 320 → 28px at 510px+). Same
  weight, colour and line height. Desktop unchanged.

### 3. Sideways phones — side-by-side about layout (`AgentAboutSection.tsx`)

Below 768px the about section stacks, so on a sideways phone the bio photo (the animation's end spot) is
full width — 635×847 on a 667×320 screen; visitors see only part of a face.
- Sideways phones (`max-lg:landscape:`) use the side-by-side layout iPads/desktop use: photo column left,
  bio right (`flex-row`, photo column ~29%, bio ~71%, smaller gaps/padding).
- The photo is sized from the screen height so it fits under the 112px navbar offset:
  width `min(100%, (100svh − 9rem) × ¾)` (3:4 photo) → e.g. 132×176 at 320px tall, 184×245 at 390px tall.
- The photo column scrolls normally on sideways phones (its sticky wrapper becomes static), so the
  icons/location/language/license under the photo are never stuck below the screen.
- The animation already measures its end spot at runtime, so it simply ends in the smaller photo.

### 4. Agent photo sharpness on phones (`components/agents/AgentPhotoMorph.tsx`)

The animated photo's `sizes` is `(max-width: 768px) 96px, 40vw` — phones download a ~96px-wide image
that ends ~288px wide on an iPhone (blurry).
- New value: `(max-width: 1023px) and (orientation: portrait) 100vw, (max-width: 768px) 25vw, 40vw`.
  Upright phones/tablets get a full-width image; small sideways phones a column-sized one; **1024px+
  keeps `40vw`**, so desktop downloads the same file.

### 5. Fair Housing — long web address (`app/(marketing)/fair-housing/page.tsx`)

A long URL (`hud.gov/program_offices/fair_housing…`) can't wrap, so the page is 457px wide on a 390px
phone (sideways scrolling).
- Phones: the content wrapper gets `max-lg:[overflow-wrap:anywhere]` so long addresses break onto the next
  line. Desktop unchanged.

## Verification

- **Desktop 1440×900:** element boxes identical before/after for the agent profile (hero, about, reviews,
  transactions), Fair Housing, and a Press article; desktop image requests on the agent profile unchanged
  (same files).
- **Phones** (320×568, 344×882, 375×667, 390×844, 430×932, 820×1180, 844×390, 844×340, 667×320):
  agent profile, Press article, Fair Housing → no sideways scroll; reviews show 1 card (<640) / 2 (640–1023)
  with readable text and working arrows; bio text ≤28px; on sideways phones the photo (after the animation)
  fits fully on screen and the info under it is reachable; the animation still runs on every size; the
  animated photo's chosen image is at least as wide as it is displayed (×device pixel ratio) on phones.
- **Load:** first-load JS per page within ~2%; agent profile phone download may grow slightly (sharper
  photo — the intended trade-off).
- **Tests:** `reviewsPerView` (desktop pinned); full suite, `tsc`, clean production build per task.

## Out of scope

Desktop anything; `/account` (sub-project 7); pages already fine on phones (listed above).
