# CnC Realty — Full Website & CRM Implementation Plan

## Context

A new real estate brokerage ("CnC Realty") needs a modern, full-featured website built from scratch. Domain: **www.cncrealtygroup.com** (already purchased, previously attempted WordPress/Elementor). The goals are:
1. A beautiful public-facing site for home buyers to search properties and connect with agents
2. Individual agent profile pages
3. A built-in CRM for lead tracking, agent management, transaction management, and email/SMS campaigns
4. IDX integration directly with CRMLS (RESO Web API) to display live MLS listings — cheaper than IDX Broker

The repo is completely empty. Everything must be built from the ground up.

**Email:** Hostinger Starter Business Email is set up. Primary mailbox: `ryanchong@cncrealtygroup.com`. Two aliases are configured under this mailbox: `info@cncrealtygroup.com` and `noreply@cncrealtygroup.com` — all emails to these addresses land in Ryan's inbox. SendGrid will send automated emails using the `noreply@` alias as the sender.

**Agent Accounts:** Agents sign up for free using **any personal email** (Gmail, Yahoo, etc.). A professional `@cncrealtygroup.com` mailbox is an **optional perk** — purchased separately through Hostinger (~$1/mo per mailbox) — and is completely unrelated to website account creation.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS + shadcn/ui |
| Auth | NextAuth.js (email/password + Google OAuth) |
| Database | PostgreSQL via Prisma ORM |
| Background jobs | Express/Fastify service (separate from Next.js) |
| Email | SendGrid |
| Maps | Mapbox GL JS |
| Storage | Cloudflare R2 (documents/images) |
| Cache | Upstash Redis |
| Monorepo | Turborepo + pnpm workspaces |
| Hosting | Vercel (web) + Railway (CRM API + DB) |

---

## Navigation

**Navbar tabs:** Buy | Sell | Join CnC | News | About | Contact
**Login button:** Separate styled button (top-right). Routes to `/login` where:
- Existing agents sign in → redirected to `/dashboard`
- New clients can create a free account (using any personal email) → redirected to saved searches/property alerts
- Role-based redirect after auth (AGENT → dashboard, BUYER → account, ADMIN → admin panel)
- No `@cncrealtygroup.com` email required — agents and clients sign up with any email they already have

---

## Monorepo Structure

CnC-Realty/
├── apps/
│   ├── web/                        # Next.js 14 App Router
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (marketing)/    # buy, sell, about, contact
│   │       │   ├── (listings)/     # /properties, /properties/[mlsNumber], /properties/map
│   │       │   ├── (agents)/       # /join (Join CnC), /agents/[slug]
│   │       │   ├── (auth)/         # login, register, forgot/reset password
│   │       │   ├── (dashboard)/    # /dashboard/* (agents), /admin/* (broker)
│   │       │   ├── news/           # Blog/News (mapped to "News" nav tab)
│   │       │   ├── api/            # All Next.js API routes
│   │       │   ├── layout.tsx
│   │       │   └── page.tsx        # Homepage
│   │       ├── components/
│   │       │   ├── ui/             # shadcn/ui primitives
│   │       │   ├── layout/         # Navbar, Footer, DashboardSidebar
│   │       │   ├── home/           # HeroSearch, FeaturedListings, AgentSpotlight, Testimonials
│   │       │   ├── properties/     # PropertyCard, PropertyFilters, PropertyGallery, MortgageCalculator
│   │       │   ├── agents/         # AgentCard, AgentProfileHero, AgentContactForm
│   │       │   └── dashboard/      # LeadPipelineBoard (kanban), TransactionTimeline, CampaignBuilder
│   │       ├── lib/
│   │       │   ├── auth.ts         # NextAuth config (CRITICAL)
│   │       │   ├── prisma.ts       # Prisma singleton
│   │       │   ├── idx/            # CRMLS RESO Web API client + sync logic
│   │       │   └── email/          # SendGrid client + templates
│   │       ├── hooks/              # React Query hooks (useProperties, useLeads, etc.)
│   │       ├── store/              # Zustand (searchStore, mapStore, uiStore)
│   │       └── middleware.ts       # Route protection (CRITICAL)
│   │
│   └── crm-api/                    # Express service for background jobs
│       └── src/
│           ├── jobs/               # idx-sync.job.ts, property-alerts.job.ts, drip-campaign.job.ts
│           ├── services/           # Business logic layer
│           └── routes/             # REST endpoints mirroring Next.js API
│
├── packages/
│   ├── database/
│   │   └── prisma/
│   │       ├── schema.prisma       # SINGLE source of truth (CRITICAL)
│   │       └── seed.ts
│   └── shared-types/               # TypeScript types shared across apps
│
└── infrastructure/
    └── docker-compose.yml          # Local Postgres + Redis

---

## Database Schema (Key Models)

- **User** — buyers, agents, admin; NextAuth accounts/sessions
- **Agent** — public profile (slug, bio, headshot, license, metrics, social links)
- **Property** — IDX-synced MLS listings (mlsNumber, RESO fields, coordinates, photos JSON)
- **Lead** — contact info, status (NEW→CLOSED), source, score, UTM tracking, assigned agent
- **Activity** — polymorphic log (notes, calls, emails, showings) on Lead or Transaction
- **Transaction** — deal from offer to close (dates, commission, documents)
- **Document** — uploaded files linked to transactions
- **Campaign** — email/drip campaigns with stats
- **CampaignContact** — per-recipient status (sent, opened, clicked, bounced)
- **SavedSearch** — user's search criteria + alert preferences
- **PropertyAlert** — matched properties for saved searches
- **BlogPost**, **SiteSettings**, **Message**

Full Prisma schema with all enums (`LeadStatus`, `TransactionStatus`, `CampaignType`, etc.) to be written to `packages/database/prisma/schema.prisma`.

---

## Implementation Phases

### Phase 1 — Foundation (Week 1–2)
- Initialize Turborepo monorepo with pnpm
- Scaffold Next.js 14 app + CRM API service
- Write full Prisma schema, run initial migration
- Configure NextAuth (email/password + Google)
- Build auth pages (login, register, forgot/reset password)
- Set up `middleware.ts` route protection for `/dashboard/*` and `/admin/*`
- Root layout with Navbar + Footer shells
- Define brand color CSS variables in `globals.css`
- `docker-compose.yml` for local Postgres + Redis

### Phase 2 — Public Marketing Pages (Week 3–4)
- Homepage with HeroSearch, FeaturedListings, AgentSpotlight, Testimonials, CTABanner
- Buy, Sell, About pages
- `/contact` — simple contact form page (name, email, phone, message → submits to `info@cncrealtygroup.com` via SendGrid); linked from navbar dropdown
- **"Let's Start" modal** (ServicesSection) — clicking "Let's Start" opens a centered popup overlay (white card, dark backdrop). Fields: Email Address, Phone Number, Min Price, Max Price, Deal Type dropdown (Buy / Sell / Rent / Property Management). Dark full-width "Next →" pill button. Reference screenshot: `C:\Users\hey_r\Downloads\Screenshot 2026-05-15 153811.png`. On submit → creates Lead in DB + sends notification to `info@cncrealtygroup.com`.
- "Join CnC" recruitment page (`/join`) — attract agents to the brokerage
- Individual agent profile pages (`/agents/[slug]`)
- Agent contact form → creates Lead in DB
- News section (blog/market reports, mapped to "News" nav tab)
- SEO: metadata exports, OG tags, sitemap.xml, robots.txt

### Phase 3 — Lead Capture & Agent Dashboard (Week 5–6)
- Wire all public forms (contact, property inquiry, valuation) to `/api/leads` → creates Lead + email notification
- Agent dashboard home with StatsCards
- Lead pipeline Kanban board (`@dnd-kit`) with drag-to-change-status
- Lead detail page with activity feed + add note form
- `/api/leads/*` endpoints with role-based auth guards

### Phase 4 — IDX / CRMLS Integration (Week 7–9)
- Build RESO Web API client (`lib/idx/client.ts`) with auth, rate limiting, field mapping
- IDX sync job: initial full sync + 15-minute delta sync cron
- Property search page with filters (price, beds, baths, type, city/zip)
- Homepage carousel of nearby listings based on user location (like eXp Realty)
- Property detail page: photo gallery lightbox, map, mortgage calculator, inquiry form
- Map search page (`/properties/map`) with Mapbox GL JS + clustering
- Saved properties (heart button) + saved searches UI

### Phase 5 — Full CRM (Week 9–11)
- Transaction management: create from lead, timeline view, document upload (R2), status progression
- Email campaigns: rich text editor (Tiptap), recipient selection, SendGrid delivery
- Drip email sequence builder
- SendGrid webhook handlers to update `CampaignContact` stats
- Property alert job: match new listings to saved searches → notify via email
- Admin dashboard: manage all agents, leads, transactions, campaigns; commission reports
- Agent onboarding multi-step form

### Phase 6 — Polish & Launch (Week 12–13)
- Performance: ISR on property pages (`revalidate: 300`), Redis caching for property search, skeleton loaders
- SEO: JSON-LD structured data (RealEstateListing, Person schemas), auto sitemap
- Security: Upstash rate limiting on public forms, Zod validation on all API routes, CSRF protection
- Error monitoring: Sentry on both apps
- Analytics: PostHog or GA4
- Deploy: Vercel (web) + Railway (CRM API + Postgres)

---

## Critical Files

| File | Why Critical |
|---|---|
| `packages/database/prisma/schema.prisma` | All data models; every feature depends on this being correct first |
| `apps/web/src/lib/auth.ts` | NextAuth config; broken setup breaks all protected routes |
| `apps/web/src/middleware.ts` | Controls which routes require auth + what role |
| `apps/web/src/lib/idx/client.ts` | CRMLS RESO Web API client; all property data flows through here |
| `apps/crm-api/src/jobs/idx-sync.job.ts` | RESO→Prisma field mapping; syncs MLS data every 15 min |

---

## Third-Party Services Needed

| Service | Purpose |
|---|---|
| CRMLS RESO Web API | Direct MLS property feed (included with broker membership) |
| Vercel Pro | Frontend hosting + Cron Jobs |
| Railway | CRM API + PostgreSQL |
| SendGrid | Transactional email + campaigns |
| Mapbox | Property maps |
| Cloudflare R2 | Document/image storage |
| Upstash Redis | Search caching + rate limiting |
| Sentry | Error monitoring |
| Google OAuth | Social login |

---

## Session Notes — 2026-05-05

### What Was Completed This Session

**All changes are in `apps/web` — nothing has been committed to git yet.**

#### Session A (earlier today — already in notes above, kept for reference)
1. Chopin Script font removed → Inter
2. Navbar logo/button hover spring animations
3. Search bar magnifying glass icon

#### Session B (this session)

1. **Hero section finalized (approved)**
   - Removed "California's Premier Brokerage" subtitle
   - Pushed content block lower (`mt-48` → `mt-72`)
   - Replaced slide animation with word-by-word fade-in from left using `AnimatePresence` + staggered `motion.span` per word
   - Stagger: `0.28s` between words; each word duration: `0.9s`; exit: whole phrase fades as one unit (`0.25s`)
   - Last word of each phrase colored gold `#9E8C61`
   - File: `apps/web/src/components/home/HeroSection.tsx`

2. **Site icon set**
   - `C:\Users\hey_r\Desktop\CNC Logo\Site Icon.png` copied to `apps/web/src/app/icon.png`
   - Default `favicon.ico` deleted (Next.js App Router serves `icon.png` automatically as favicon)
   - Shows in localhost browser tab

3. **Navbar transparency reduced**
   - Scrolled state: `bg-black/75` → `bg-black/20` (much more transparent, backdrop-blur kept)
   - File: `apps/web/src/components/layout/Navbar.tsx`

4. **Featured Listings — rebuilt as carousel (in progress, not fully approved)**
   - Replaced Aceternity FocusCards grid with infinite right-to-left scroll carousel
   - 8 placeholder SoCal listings (Pasadena, Glendale, Arcadia, Burbank, San Marino, Monrovia, Sierra Madre, Temple City)
   - **3-tier vertical stagger**: cards alternate between `0px / 48px / 24px` translateY — more varied than eXp's simple 2-level alternating
   - Stagger is seamless across the loop: `(i % LISTINGS.length) % OFFSETS.length` ensures both halves of the doubled array use identical offsets
   - Speed: `80s` linear (slowed 2× from original 40s)
   - Pauses on hover; fade edges left/right
   - **Background changed to white** — section is an intentional light break between two dark sections
   - Cards: white bg, `border-zinc-200`, `shadow-sm`, dark text
   - "View All Listings" button: gold border, gold text on white bg
   - File: `apps/web/src/components/home/FeaturedListings.tsx`
   - **Still needs review** — will come back to it

5. **Why CnC — completely rebuilt as scroll-locked sticky section**
   - Inspiration: `elyse-residence-dev.webflow.io` (scroll-driven panel with side progress indicator + image transitions)
   - Section is `400vh` tall; inner panel is `sticky top-0 h-screen`
   - 4 items scroll-locked: CRMLS Access → CRM & Tech Tools → Free Agent Signup → Local California Expertise
   - **Left panel (5/12 width):** counter (`01 / 04`), large bold title (two lines, `font-chopin`), gold horizontal rule, description paragraph, vertical gold accent bar on far left
   - **Right panel (flex-1):** full-bleed image, crossfades on transition, gradient blends left edge into dark panel
   - **Transitions:** text slides up/down with `AnimatePresence mode="wait"`; image crossfades with subtle scale
   - **Right-edge progress indicator:** dots connected by a vertical line; gold fill creeps down via `scaleY` driven by `useScroll` → `useTransform`; active dot pulses larger
   - Uses `useMotionValueEvent` to track `scrollYProgress` and set `activeIdx`
   - Images are picsum placeholders — will be replaced with real photos in a later session
   - File: `apps/web/src/components/home/WhyCnC.tsx`
   - **Not yet reviewed** — first look next session

### Section Status

| Section | Status |
|---|---|
| Hero | ✅ Approved |
| Featured Listings | 🔄 Built, needs review |
| Why CnC | ✅ Approved (Elyse-style scroll-locked, Cormorant serif, venetian blind + fade-up image transitions, pill progress bar) |
| Agent Spotlight | 🔄 Needs redesign (see design note below) |
| Testimonials | ⏳ Not yet reviewed |
| Join CnC CTA | ⏳ Not yet reviewed |

Nothing committed to git this session.

### Agent Spotlight — Design Note

Rebuild to match eXp Realty's card layout (screenshot saved at `C:\Users\hey_r\Desktop\Screenshot 2026-05-06 094023.png`):
- 4 slightly tilted/rotated cards in a horizontal row (each card tilts a different direction)
- Each card: dark navy/colored background, label text top-left (e.g. "Buy With Us"), circular image cutout center, "+" button bottom-right corner
- Cards are partially cut off on left and right edges (extends beyond viewport)
- Adapt for CnC: cards could be "Buy With Us", "Sell With Us", "Find an Agent", "Join CnC" — or use as actual agent spotlight cards with agent photos in the circle cutout

### Next Session — Start Here

1. Run `pnpm dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. **Review Featured Listings** (white bg carousel) — decide approved or needs tweaks
4. **Rebuild Agent Spotlight** — eXp card style (see design note above)
5. Review Testimonials → Join CnC CTA
6. Once all sections approved, commit as one Phase 2 commit and move to Phase 3

---

## Session Notes — 2026-05-06

### What Was Completed This Session

**All changes are in `apps/web` — nothing has been committed to git yet.**

### Why CnC — Full Redesign (Approved)

Rebuilt `apps/web/src/components/home/WhyCnC.tsx` to match the Elyse website aesthetic (`elyse-residence-dev.webflow.io`).

**Font added:**
- Cormorant Garamond (weight 300/400) from Google Fonts
- CSS variable: `--font-display`, Tailwind class: `font-display`
- Added to `apps/web/src/app/layout.tsx` and `apps/web/tailwind.config.ts`

**Layout:**
- Dark `#181818` background (Elyse's charcoal)
- Left panel (42%): pill-shaped scroll progress bar (growing white fill, no outline) + large ALL-CAPS Cormorant Garamond title + description + "Learn More" button
- Right panel: two overlapping floating images — back (60% wide, anchored right with 2.5% gap, top 13%) and front (40% wide, left 2%, top 25%, z-index above back)

**Progress indicator:**
- Thin vertical pill (20×220px), no outline — just a 3px white bar that grows from 0→100% of the pill height driven by `scrollYProgress`

**Image transitions:**
- Back image: venetian blind shutter effect — 8 horizontal strips, each `scaleY: 0→1` staggered top-to-bottom (0.045s stagger, 0.38s per strip)
- Front image: fade up — `opacity 0→1` + `y: 36→0` with 0.18s delay
- `ShutterImage` extracted as its own component so AnimatePresence correctly freezes `imgSrc` on exit

**Mixed media support:**
- ITEMS array supports optional `videoBack` field — when present, renders a crossfading `<video autoPlay muted loop playsInline>` instead of the shutter image
- Also supports `imgFrontPosition` for per-item `object-position` control

**4 sections and content:**
1. **100% COMMISSION** — "No jokes, no surprises. Keep every dollar you earn from every sale because you deserve it. Plain and simple."
2. **AI-DRIVEN TECH** — "Predictive lead scoring, automated follow-ups, and real-time market insights powered by AI. Combined with our custom CRM integrated software to provide you with all the tools to succeed."
3. **TRAINING & MENTORSHIP** — "Whether its your first deal or your 100th, CnC has unlimited resources to information and video guides to ensure you are always on top of your game. New agents receive a mentor who will help them every step of the way."
4. **FREEDOM AWAITS** — "Create a personal brand, build your own team, and grow at your pace - backed by CnC Realty to give you everything you need and nothing you don't."

**Font size note:** "COMMISSION" and "MENTORSHIP" render at `4rem` (vs `5.5rem` for other lines) to prevent overlap with the photos — implemented via `TitlePart[]` array with optional `sm: true` flag.

**Freedom Awaits — real media:**
- Back: `/videos/freedom-back.mp4` — aerial drone shot of coastal SoCal homes, HD 1280×720 (Pexels, Kindel Media, 25s, free to use)
- Front: `/images/freedom-front.jpg` — white Mediterranean-style house with turquoise ocean + tropical plants, `object-position: center 55%`
- Original 1920×1080 video was replaced with 720p for web optimization

**Files added to `public/`:**
- `public/videos/freedom-back.mp4`
- `public/images/freedom-front.jpg`

### Section Status

| Section | Status |
|---|---|
| Hero | ✅ Approved |
| Featured Listings | 🔄 Built, needs review |
| Why CnC | ✅ Approved |
| Agent Spotlight | 🔄 Needs full redesign (eXp card style — see design note in 2026-05-05 notes) |
| Testimonials | ⏳ Not yet reviewed |
| Join CnC CTA | ⏳ Not yet reviewed |

Nothing committed to git this session.

---

## Session Notes — 2026-05-10

### What Was Completed This Session

**All changes are in `apps/web` — nothing has been committed to git yet.**

1. **Global color change — all sections below Hero**
   - Background: all 5 sections (Featured Listings, Why CnC, Agent Spotlight, Testimonials, Join CnC CTA) → `bg-[#F2F0EF]` (warm off-white)
   - Text: all headings/body → `text-[#1B1B1B]`, muted text uses opacity variants (`/45`, `/60`, `/70`)
   - Gold accents untouched
   - Testimonial cards → `bg-white` for contrast against off-white section
   - Agent Spotlight cards kept dark (dark cards on light bg looks intentional)
   - Fade edge gradients + card borders updated to match new bg

2. **Navbar — scroll-aware color flip**
   - Added `pastHero` state: fires when `scrollY > window.innerHeight * 0.85`
   - Past hero: logo inverted to black (`filter: invert(1)`), login/burger pill → `#1B1B1B` border + text, navbar bg → `bg-[#F2F0EF]/60 backdrop-blur`
   - In hero: white logo, white pills, `bg-black/10 backdrop-blur` (when scrolled >30px)
   - File: `apps/web/src/components/layout/Navbar.tsx`

3. **Why CnC — multiple refinements (all approved)**
   - "Join CnC" button: only shows on **Freedom Awaits** panel (not other 3); dark pill style (`bg-[#1B1B1B]`, `rounded-full`, white text); spring scale on hover (`whileHover: scale 1.1`)
   - Gap between title/description/button increased: `gap-8` → `gap-12`
   - Title font sizes reduced: regular `5.5rem/6.5rem` → `4rem/4.8rem`; small variant `4rem/4.8rem` → `3rem/3.6rem`
   - Title text animation: word-by-word slide-in from left (`x: -16→0`, stagger 0.1s per word) on each panel enter — matches hero phrase animation style
   - File: `apps/web/src/components/home/WhyCnC.tsx`

4. **Why CnC — venetian shutter on front image (attempted, reverted)**
   - Tried 3 implementations: `scaleY`, `clipPath inset(right)`, `clipPath inset(bottom)` — all looked wrong
   - **Reverted** front image back to original fade-up: `opacity: 0, y: 36` → `opacity: 1, y: 0`, delay 0.18s
   - Do NOT attempt venetian shutter on front image again unless Ryan has a specific reference with working code

### Section Status

| Section | Status |
|---|---|
| Hero | ✅ Approved |
| Featured Listings | 🔄 Built, needs review |
| Why CnC | 🔄 All refinements done, needs full review next session |
| Agent Spotlight | 🔄 eXp fan style, not yet reviewed |
| Testimonials | ⏳ Not yet reviewed |
| Join CnC CTA | ⏳ Not yet reviewed |

Nothing committed to git this session.

### Next Session — Start Here

1. Run `pnpm dev --filter web` from `C:\Users\hey_r\Desktop\CnC-Realty` in a terminal
2. Open `localhost:3000`
3. **Review all pending sections in order:**
   - Featured Listings (off-white bg, white cards, infinite carousel)
   - Why CnC (off-white bg, word-by-word title animation, Join CnC button on Freedom Awaits only)
   - Agent Spotlight (dark cards on off-white bg, eXp fan style)
   - Testimonials (off-white bg, white cards)
   - Join CnC CTA (off-white bg, dark shimmer button)
4. Once all approved → one Phase 2 git commit → move to Phase 3

---

## Session Notes — 2026-05-09

### What Was Completed This Session

**All changes are in `apps/web` — nothing has been committed to git yet.**

1. **Why CnC — real media added for all 4 sections**
   - **100% Commission:** back video → `/videos/commission-back.mp4`, front image → `/images/commission-front.jpg` (agent with Sale Pending sign)
   - **AI-Driven Tech:** back video → `/videos/ai-tech-back.mp4`, front image → `/images/ai-tech-front.jpg` (agent with tablet in empty home)
   - **Training & Mentorship:** back video → `/videos/training-back.mp4`, front image → `/images/training-front.jpg` (agent with couple reviewing documents)
   - **Freedom Awaits:** already had real media from previous session — unchanged
   - All 4 sections now use `videoBack` + `imgFront` (no more picsum placeholders)

2. **Training & Mentorship — description updated**
   - New copy: "24/7 access to seasoned agents, updated video guides, custom roadmaps for success, and much more. New agents receive a mentor to help them with every step of the way."

3. **Why CnC — font corrected**
   - Section headings were using `font-display` (Cormorant Garamond serif) — changed to `font-sans` (Google Sans Flex) to match the rest of the site
   - File: `apps/web/src/components/home/WhyCnC.tsx`

4. **Public folder audit**
   - All files in `apps/web/public/` are actively used except `logo-gold.png` (kept — will be used soon)
   - Desktop source files (original photos/videos) can be safely deleted — copies live in `public/`

### Section Status

| Section | Status |
|---|---|
| Hero | ✅ Approved |
| Featured Listings | 🔄 Built, needs review |
| Why CnC | 🔄 Real media added + font fixed, needs full review |
| Agent Spotlight | 🔄 Rebuilt to eXp fan style, not yet reviewed |
| Testimonials | ⏳ Not yet reviewed |
| Join CnC CTA | ⏳ Not yet reviewed |

Nothing committed to git this session.

### Next Session — Start Here

1. Run `pnpm dev --filter web` from `C:\Users\hey_r\Desktop\CnC-Realty` in a terminal
2. Open `localhost:3000`
3. **Review all pending sections in order:**
   - Featured Listings (white bg infinite carousel, 3-tier vertical stagger)
   - Why CnC (all 4 panels now have real media — check crops, adjust `imgFrontPosition` per item if needed)
   - Agent Spotlight (eXp fan cards — check rotations, hover feel, sizing)
   - Testimonials (dark bg infinite scroll carousel)
   - Join CnC CTA (shimmer button, gold radial glow, black bg)
4. Once all sections approved → one Phase 2 git commit → move to Phase 3

---

## Session Notes — 2026-05-08

### What Was Completed This Session

**All changes are in `apps/web` — nothing has been committed to git yet.**

1. **Agent Spotlight — fully rebuilt (not yet reviewed by Ryan)**
   - Old design (AnimatedTooltip + card grid) replaced entirely
   - New design: eXp-style horizontal fan of 5 tilted portrait cards
   - Each card: 260×347px, dark-hued background (distinct but subtle — navy, purple, forest, burgundy, teal)
   - Card anatomy: agent title label top-left (10px uppercase), circular photo (130px, gold border) centered at 44% height, agent name + closed count below, gold `+` button bottom-right links to `/agents/[slug]`
   - Rotations (alternating directions for organic feel): Ryan −9°, Sarah +4°, Elena −3°, James +7°, David −6°
   - Hover animation (framer-motion spring): card de-rotates to 0°, lifts 20px, scales 1.06×, pops above neighbors via z-index
   - Section heading uses `font-display` (Cormorant Garamond) to match Why CnC aesthetic
   - Card row has `−6% horizontal margin` so edge cards are slightly cut off at viewport edges
   - File: `apps/web/src/components/home/AgentSpotlight.tsx`

2. **Freedom Awaits front image replaced**
   - Old: white Mediterranean house with turquoise ocean + tropical plants
   - New: aerial cliff-side house with dramatic ocean waves behind it (`pexels-joaquin-carfagna-3131171-15885532.jpg`)
   - File overwritten: `apps/web/public/images/freedom-front.jpg`
   - `object-position` updated from `center 55%` to `center 40%` to favor the house-roofline + ocean area
   - File: `apps/web/src/components/home/WhyCnC.tsx` (ITEMS array, Freedom Awaits entry)

### Section Status

| Section | Status |
|---|---|
| Hero | ✅ Approved |
| Featured Listings | 🔄 Built, needs review |
| Why CnC | ✅ Approved (new front image added, not yet re-reviewed) |
| Agent Spotlight | 🔄 Rebuilt to eXp fan style, not yet reviewed |
| Testimonials | ⏳ Not yet reviewed |
| Join CnC CTA | ⏳ Not yet reviewed |

Nothing committed to git this session.

### Next Session — Start Here

1. Run `pnpm dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. **Review all 4 pending sections in order:**
   - Featured Listings (white bg infinite carousel, 3-tier vertical stagger)
   - Why CnC Freedom Awaits (new cliff-house front image — check crop, adjust `imgFrontPosition` in WhyCnC.tsx if needed)
   - Agent Spotlight (new eXp fan cards — check rotations, hover feel, sizing)
   - Testimonials (dark bg infinite scroll carousel)
   - Join CnC CTA (shimmer button, gold radial glow, black bg)
4. Once all sections approved → one Phase 2 git commit → move to Phase 3

---

## Session Notes — 2026-05-04

### Design Corrections & Decisions Made This Session

1. **Color palette corrected** — The theme is dark (black base, white text) with gold as ACCENT ONLY, like eXp Realty. Previous session notes incorrectly described it as "dark gold" dominant. Gold is used sparingly (borders, highlights, buttons) — not as background fills.

2. **Stats Bar removed** — CnC Realty is a new brokerage with no meaningful stats to display yet. Section cut entirely.

3. **Testimonials added back** (replacing Stats Bar) — Small scrolling carousel: circular profile photo + short quote. Infinite horizontal auto-scroll (left to right, slow). Pauses on hover. Ryan will share a reference image at the start of next session before this section is built.

4. **Final homepage is 6 sections:** Hero → Featured Listings → Why CnC → Agent Spotlight → Testimonials → Join CnC CTA

No code was written this session — all decisions are design/planning only.

---

## Session Notes — 2026-05-02

### What Was Completed This Session

**Phase 1 (Foundation) — DONE ✅**
- Turborepo monorepo initialized with pnpm workspaces
- Next.js 14 App Router scaffolded at `apps/web`
- CRM API service scaffolded at `apps/crm-api`
- Full Prisma schema written at `packages/database/prisma/schema.prisma` (14 models)
- NextAuth configured with email/password + Google OAuth, JWT sessions, role-based redirects
- Auth pages built: `/login`, `/register`, `/forgot-password`
- Route protection middleware at `apps/web/src/middleware.ts`
- Navbar + Footer with CnC brand colors
- shadcn/ui initialized
- Magic UI installed (framer-motion + shimmer-button component)
- Aceternity UI MCP server available (24 free components)
- Railway PostgreSQL provisioned and initial migration run (`20260502064718_init`)
- `.env.local` configured at `apps/web/.env.local` (DATABASE_URL + NEXTAUTH_SECRET set)
- Everything committed and pushed to `claude/real-estate-website-9bdWi`

### Phase 2 Design Decisions — APPROVED, NOT YET BUILT

**Inspiration:** eXp Realty (exprealty.com) — but more interactive and premium

**Design Direction: Option A — Dark Theme + Gold Accents + Video Hero**

**Color palette:** Black/dark base, white text, gold (#C9A84C or similar) as ACCENT ONLY — NOT the dominant color. Reference exprealty.com for overall tone. Previous notes saying "dark gold background" were incorrect — correct to dark/black backgrounds with gold used sparingly as accents.

**Homepage sections (6 total, in order):**
1. **Hero** — Full-viewport video background (`C:\Users\hey_r\Desktop\Homepage video 6K.mp4`, copy to `apps/web/public/homepage-video.mp4`). Dark semi-transparent overlay. Centered: CnC logo, typewriter effect cycling *"Find Your Dream Home" → "Sell Smarter" → "Join Our Team" → "Your Future Starts Here"*, and Aceternity `placeholder-and-vanish-input` search bar ("Search by city, zip, or address…").
2. **Featured Listings** — Dark background. Aceternity `focus-cards` grid (hover to focus, blur others). Placeholder data for now — real MLS data comes in Phase 4.
3. **Why CnC** — Dark background. Aceternity `bento-grid` highlighting differentiators: CRMLS access, free agent signup, tech tools, local expertise.
4. **Agent Spotlight** — Dark background. Aceternity `animated-tooltip` on agent photos — hover to see stats pop up.
5. **Testimonials** — Small cards: circular profile photo + short client quote underneath. Infinite horizontal auto-scroll (left to right), smooth and slow. Pauses when cursor hovers over it. **Ryan will share an example reference image next session before building this.**
6. **Join CnC CTA Banner** — Dark background with gold accent. Magic UI `shimmer-button` with bold recruitment message.

**Sections removed vs. previous notes:**
- Stats Bar removed (brokerage is new, not enough stats to show yet)

**Video note:** `Homepage video 6K.mp4` is 160MB — fine for local dev, needs compression before Vercel deploy.

**Feedback workflow:** Ryan will run `pnpm dev` locally, take screenshots (save as PNG to Desktop with path), and describe changes. No Word docs — paste feedback in chat or share PNG file paths.

**Component libraries available:**
- shadcn/ui (base components)
- Magic UI via shadcn registry (`pnpm dlx shadcn@latest add "https://magicui.design/r/[name]"`)
- Aceternity UI via MCP + shadcn registry (`npx shadcn@latest add https://ui.aceternity.com/registry/[name].json`)

### Next Session — Start Here

1. Ryan shares reference image for Testimonials scrolling carousel style
2. Copy video to `apps/web/public/homepage-video.mp4`
3. Build Phase 2 homepage (all 6 sections above) and remaining marketing pages
4. Run `pnpm dev` in `apps/web`, open `localhost:3000`, Ryan reviews and gives feedback
5. Iterate on visuals until approved, then commit and move to Phase 3

---

## Session Notes — 2026-05-11

### What Was Completed This Session

**All changes are in `apps/web` — nothing has been committed to git yet.**

1. **Why CnC — 100% Commission media replaced**
   - Front image: `pexels-thirdman-8470808.jpg` (agent + couple on porch reviewing documents) → `public/images/commission-front.jpg`
   - Back video: `8471041-hd_1280_720_25fps.mp4` → `public/videos/commission-back.mp4`
   - Front image position: `center` (default)
   - Back video frame shifted right: `videoBackPosition: "75% center"` (new per-item field added to ITEMS type)

2. **Why CnC — back media container shifted left**
   - `right: "2.5%"` → `right: "12%"` so the front image overlaps the back video more
   - File: `apps/web/src/components/home/WhyCnC.tsx`

3. **Agent Spotlight removed — replaced with ServicesSection**
   - New file: `apps/web/src/components/home/ServicesSection.tsx`
   - `apps/web/src/app/page.tsx` updated: `<AgentSpotlight />` → `<ServicesSection />`
   - Inspired by fluid.glass product overview design
   - Off-white `#F2F0EF` background, `minHeight: "170vh"`
   - "See the difference, with CnC." heading — `font-sans font-light text-[3rem]`, top-right, fades in on scroll
   - 4 cards all same size: `w-[22%] aspect-[3/4]`, scroll-triggered slide-up with staggered delays

4. **ServicesSection — images**
   - BUY: `pexels-kindelmedia-7579042.jpg` → `public/images/services-buy.jpg`
   - SELL: `pexels-gustavo-fring-7489091.jpg` → `public/images/services-sell.jpg`
   - LEASE: `pexels-ketut-subiyanto-4247753.jpg` → `public/images/services-lease.jpg`
   - MANAGE: `pexels-yosef-futsum-14476591.jpg` → `public/images/services-manage.jpg`

5. **ServicesSection — final card positions**
   - BUY: `left: "39%", top: "4%"` (top center)
   - SELL: `right: "9%", top: "32%"` (right side)
   - LEASE: `left: "45%", top: "42%"` (center-right, lower — small gap to the left of SELL)
   - MANAGE: `left: "8%", top: "52%"` (left side, lowest)

6. **ServicesSection — labels**
   - Centered in each card (both horizontally and vertically): `absolute inset-0 flex items-center justify-center`
   - Font: `font-sans text-3xl font-light text-white`

### Section Status

| Section | Status |
|---|---|
| Hero | ✅ Approved |
| Featured Listings | 🔄 Needs review |
| Why CnC | 🔄 Needs full review (100% Commission has new media, back media shifted left) |
| Services | 🔄 Built, needs review |
| Testimonials | ⏳ Not yet reviewed |
| Join CnC CTA | ⏳ Not yet reviewed |

Nothing committed to git this session.

### Next Session — Start Here

1. Run `pnpm dev --filter web` from `C:\Users\hey_r\Desktop\CnC-Realty` in a terminal
2. Open `localhost:3000`
3. **Review all pending sections in order:**
   - Featured Listings (off-white bg, white cards, infinite carousel)
   - Why CnC (new Commission media, back media shifted left on all panels)
   - Services (4 cards: BUY top-center, SELL right, LEASE center-right, MANAGE left-lower)
   - Testimonials
   - Join CnC CTA
4. Once all approved → one Phase 2 git commit → move to Phase 3

---

## Session Notes — 2026-05-12

### What Was Completed This Session

**All changes are in `apps/web` — nothing has been committed to git yet.**

### Featured Listings — refinements
- Removed "Latest Properties" label and gold divider line below heading
- `font-chopin` → `font-sans font-light` to match site font
- Font size: `text-[2.5rem] xl:text-[3rem]`
- Section padding: `py-20` → `py-10` (thinner section)
- "View All Listings" button → dark pill style matching Join CnC button (spring hover, dark bg, white text)
- Button text: "View All →"

### Why CnC — progress bar track
- Added thin full-height background track (`1px`, `bg-[#1B1B1B]/20`) behind the growing fill bar
- Matches Elyse's style: thin dim track always visible, thicker fill grows over it on scroll
- File: `apps/web/src/components/home/WhyCnC.tsx`

### Why CnC — 100% Commission front image replaced
- New image: `pexels-thirdman-8469941.jpg` (agent shaking hands with couple outside house)
- `object-position: center 20%` to show all 3 people
- File: `apps/web/public/images/commission-front.jpg`

### Services Section — complete rebuild
- **Dark overlay** added to all 4 cards: `bg-black/40`
- **Labels**: ALL CAPS → title case (Buy, Sell, Lease, Manage); `font-light` → `font-medium`; `text-3xl` → `text-4xl`; `font-sans` (matches site font)
- **Heading**: "See the difference," (`2.5rem`) + "with CnC" (`3.5rem`), "with" same size as first line; `leading-[1.0]`; Services pill button (dark, spring hover) below "CnC"; period removed from "CnC."
- **Card positions**: Buy `left:39% top:4%`, Sell `right:9% top:32%`, Lease `left:45% top:62%` (width 18%), Manage `left:8% top:52%`
- **Parallax scroll**: Buy=0 (stationary), Sell=200px, Lease=200px, Manage=450px — outer div handles parallax, inner div handles entry animation (fixes glitch)
- **Section height**: `minHeight: 108vh`
- **Flip card effect**: `+` button (thin plus SVG `public/icons/plus-thin.svg`) bottom-right → 3D rotateY flip → back face shows description text + label pill button + `×` to flip back; both back buttons have spring hover scale; back face has `ring-1 ring-[#1B1B1B]/15` outline; hover zoom disabled when flipped
- **Image hover zoom**: `whileHover` scale 1.07 on all cards
- File: `apps/web/src/components/home/ServicesSection.tsx`

### Page dividers added
- Between Featured Listings and Why CnC: `pt-10 pb-0` (no bottom gap before WhyCnC)
- Between Why CnC and Services: `py-10`
- Between Services and Testimonials: `py-10`
- File: `apps/web/src/app/page.tsx`

### Navbar — dropdown menu updated
- Old: Buy, Sell, Find Your Agent, Join CnC, Contact, News
- New: Buy, Sell, Lease, Manage, Join CnC, News
- File: `apps/web/src/components/layout/Navbar.tsx`

### Testimonials — completely rebuilt (Mino style)
- Inspired by mino.works "We build trust." section
- **Sticky headline**: "We build trust." — `font-sans font-light`, `clamp(2.8rem, 5.5vw, 5rem)`, "trust." in gold `#9E8C61`; `sticky top-[32vh] z-0`
- **Scroll effect**: 3-column content has `mt-[52vh] z-10 bg-[#F2F0EF]` — as user scrolls, content rises and physically covers the sticky headline
- **3-column layout** (no max-width container, full width):
  - Left: Alma Development long testimonial + attribution (Catarina Pita)
  - Center: Dark card `bg-[#1B1B1B]` (CostaTerra) + center image + dark card (JLL/Madalena Abecasis)
  - Right: Isaac Safdie long testimonial + attribution
- **Center image**: `pexels-orlovamaria-4906249.jpg` (cozy living room with fireplace) at `public/images/testimonials-center.jpg`, `aspect-ratio: 4/3`
- All columns fade up on scroll into view
- File: `apps/web/src/components/home/Testimonials.tsx`

### Join CnC CTA — gold top border line removed
- File: `apps/web/src/components/home/JoinCnCCTA.tsx`

### Section Status

| Section | Status |
|---|---|
| Hero | ✅ Approved |
| Featured Listings | 🔄 Needs review |
| Why CnC | 🔄 Needs review (progress bar track, new Commission image) |
| Services | 🔄 Needs review (parallax, flip cards, new heading) |
| Testimonials | 🔄 Needs review (full rebuild — Mino sticky style) |
| Join CnC CTA | 🔄 Needs review (gold top border removed) |

Nothing committed to git this session.

### Next Session — Start Here

1. Run `pnpm dev --filter web` from `C:\Users\hey_r\Desktop\CnC-Realty` in a terminal
2. Open `localhost:3000`
3. **Review all pending sections in order:**
   - Featured Listings (thin section, dark pill button, font-sans heading)
   - Why CnC (progress bar track, new Commission front image)
   - Services (parallax cards, flip effect, new heading/button)
   - Testimonials (Mino-style sticky headline, 3-column layout)
   - Join CnC CTA (no gold top border)
4. Once all approved → one Phase 2 git commit → move to Phase 3

---

## Session Notes — 2026-05-13

### What Was Completed This Session

**All changes are in `apps/web` — nothing has been committed to git yet.**

1. **Testimonials — "We create" cycling word animation**
   - Phrase changed from "We build" to "We create" (done prior session — confirmed today)
   - Cycling words: `trust.` → `results.` → `futures.` → `homes.` → `teams.`
   - Cycle interval: **2 seconds**
   - Animation changed from Mino vertical clip to **hero-style fade-in from left**: `x: -14→0, opacity: 0→1` (0.9s easeOut in, 0.25s easeIn out)
   - Ghost element grid trick keeps "We create" locked — container always sized to widest word
   - File: `apps/web/src/components/home/Testimonials.tsx`

2. **Services section — card layout flipped (pancake flip)**
   - Sell: `right: 9%` → `left: 9%`
   - Lease: `left: 45%` → `right: 45%`
   - Manage: `left: 8%` → `right: 8%`
   - Buy card unchanged
   - File: `apps/web/src/components/home/ServicesSection.tsx`

3. **Services section — heading lowered**
   - `top: 8%` → `top: 14%`
   - File: `apps/web/src/components/home/ServicesSection.tsx`

4. **Services section — card drop shadows**
   - 3-layer shadow added to all 4 cards for 3D floating effect
   - Final value: `0 40px 80px rgba(0,0,0,0.32), 0 16px 32px rgba(0,0,0,0.20), 0 4px 8px rgba(0,0,0,0.12)`
   - File: `apps/web/src/components/home/ServicesSection.tsx`

5. **Testimonials — full Mino-style layout rebuild**
   - Structure: left column (image + white box), center column (dark card / image / dark card), right column (image + white box)
   - Sharp corners (no `rounded-*`), `1px` off-white gaps between all boxes
   - **Staggered offset**: all 6 boxes fixed at `420px` height; left/right columns `marginTop: 200px` so they start below the center
   - File: `apps/web/src/components/home/Testimonials.tsx`

6. **Testimonials — new images**
   - Left: `public/images/testimonials-left.jpg` — white modern house (pexels-molnartamasphotography)
   - Center: `public/images/testimonials-center.jpg` — cozy living room with plant (pexels-aju-bee)
   - Right: `public/images/testimonials-right.jpg` — aerial house with pool/patio (pexels-jonathanborba)

7. **Testimonials — all text/attribution updated**
   - **Center top (dark):** "Last year when my husband and I bought our home…" — Jessica Meyes / First Time Homeowner
   - **Center bottom (dark):** "Much appreciation for the folks over at CnC…" — Raymond Lee / SoCal Resident & Investor
   - **Left white:** body text kept — Kevin Luevanos / Prime Construction LLC
   - **Right white:** "My experience switching from my previous brokerage to CnC…" — Rachel Kent / Real Estate Agent

### Section Status

| Section | Status |
|---|---|
| Hero | ✅ Approved |
| Featured Listings | 🔄 Needs review |
| Why CnC | 🔄 Needs review (progress bar track, new Commission image) |
| Services | 🔄 Needs review (flipped card layout, shadows, heading position) |
| Testimonials | 🔄 Needs review (Mino layout, staggered offset, new images + text) |
| Join CnC CTA | 🔄 Needs review (gold top border removed) |

Nothing committed to git this session.

### Next Session — Start Here

1. Run `pnpm dev --filter web` from `C:\Users\hey_r\Desktop\CnC-Realty` in a terminal
2. Open `localhost:3000`
3. **Review all pending sections in order:**
   - Featured Listings (thin section, dark pill button, font-sans heading)
   - Why CnC (progress bar track, new Commission front image)
   - Services (flipped card layout — Sell left, Lease center-left, Manage right; shadows; heading at top:14%)
   - Testimonials (Mino staggered layout, 420px fixed boxes, 200px side offset, new images + testimonial text)
   - Join CnC CTA (no gold top border)
4. Once all approved → one Phase 2 git commit → move to Phase 3

---

## Session Notes — 2026-05-14

### What Was Completed This Session

**All changes are in `apps/web` — nothing has been committed to git yet.**

1. **Featured Listings carousel — bug fix**
   - Carousel had stopped moving entirely
   - Root cause: `@keyframes testimonial-scroll` was defined in the old Testimonials carousel code and was lost when Testimonials was rebuilt as the Mino sticky layout
   - Fix: added `@keyframes testimonial-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }` to `apps/web/src/app/globals.css`

2. **Services section — card label renames**
   - "Lease" → "Find an Agent" (new description: "Browse our roster of experienced local agents and find the right fit for your goals. Every CnC agent brings deep market knowledge of your area in California and a commitment to results.")
   - "Manage" → "Property Management" (description unchanged)
   - "Property Management" label: added `text-center` + `px-4` so long text centers when wrapping to two lines
   - File: `apps/web/src/components/home/ServicesSection.tsx`

3. **Navbar dropdown — label renames to match Services**
   - "Lease" → "Find an Agent" (href changed from `/lease` → `/agents`)
   - "Manage" → "Property Management"
   - File: `apps/web/src/components/layout/Navbar.tsx`

4. **FAQ section — new component added**
   - New file: `apps/web/src/components/home/FAQ.tsx`
   - Inserted between Testimonials and JoinCnCCTA in `apps/web/src/app/page.tsx`
   - Background: `#F2F0EF` (matches all other off-white sections)
   - Heading: "Answers for your," + "FAQs" — `font-sans font-light`, same two-line size pattern as Services heading (`2.5rem/3rem` + `3.5rem/4.2rem`)
   - **Row layout** (3-column grid `14% 44% 42%`): Question (left) | Answer (center, hidden) | Number `( N )` (right)
   - **Hover behavior**: answer fades up into center column (`opacity 0→1`, `y: 6→0`, 0.3s); top border line fades in (`opacity 0→0.12`) — no dividers visible in default state
   - 4 placeholder Q&As (Ryan will update copy later):
     1. HOW DO I GET STARTED BUYING A HOME?
     2. WHAT DOES IT COST TO SELL MY HOME?
     3. CAN I JOIN CNC AS A NEW AGENT?
     4. HOW DOES PROPERTY MANAGEMENT WORK?

5. **Why CnC — 100% Commission front image replaced**
   - New image: `pexels-thirdman-8469984.jpg` (agent + couple reviewing blueprints through glass door)
   - `imgFrontPosition: "center center"`
   - File: `apps/web/public/images/commission-front.jpg`
   - Status: ✅ Approved

6. **Join CnC CTA — full redesign**
   - New layout: two-column inside a dark `#1B1B1B` rounded-2xl box, `#F2F0EF` background outside
   - Left: keys photo (`public/images/cta-keys.jpg`) sharp-edged, `h-[480px] w-[44%]`
   - Right (center-aligned): headline ("Ready to take your real estate career further?"), body ("Instant guaranteed approval for all agents. Together, we are CnC."), pill button, gold text link
   - Pill button: "CnC Agent Contract Form" → `href="/join/contract"` — dedicated PDF contract page (Phase 2); signed PDF emails to `info@cncrealtygroup.com`; reference: https://100split.com/join-our-team.html
   - Gold text link: "Learn more ›" → `href="/join"` — Join CnC recruitment page (Phase 2)
   - Spacing: `pt-10 pb-24`
   - File: `apps/web/src/components/home/JoinCnCCTA.tsx`

7. **Button routing — wired up across sections**
   - "Services" pill (ServicesSection) → `/sell`
   - "Join CnC" button (WhyCnC, Freedom Awaits panel) → `/join`
   - All destination pages (`/sell`, `/join`, `/join/contract`) to be built in Phase 2

8. **Services section — custom cursor**
   - Real cursor hidden (`cursor: none`) on card front hover
   - Custom cursor: house icon + "VIEW" label in a transparent white-bordered box, follows mouse with `useSpring` (stiffness 180, damping 22)
   - Cursor rendered outside the `overflow-hidden` front face (inside entry wrapper) to prevent clipping
   - File: `apps/web/src/components/home/ServicesSection.tsx`

9. **Services section — click to flip**
   - Clicking anywhere on the card image now flips to the back, same as the + button
   - `onClick={() => !flipped && setFlipped(true)}` on the front face div

10. **FAQ — heading and spacing**
    - "Answers for your," removed — heading is now just "FAQs"
    - Gap between heading and first row: `mb-20` → `mb-8`
    - File: `apps/web/src/components/home/FAQ.tsx`

11. **Page section order updated**
    - Previous: Testimonials → FAQ → Join CnC CTA
    - New: Testimonials → Join CnC CTA → FAQ
    - File: `apps/web/src/app/page.tsx`

### Section Status

| Section | Status |
|---|---|
| Hero | ✅ Approved |
| Featured Listings | ✅ Approved |
| Why CnC | ✅ Approved |
| Services | 🔄 Needs verbiage update (Ryan to supply final card descriptions + back-face button copy) |
| Testimonials | ✅ Approved |
| Join CnC CTA | 🔄 Needs final review (new dark-box layout, keys image, new copy, new section order) |
| FAQ | 🔄 Needs verbiage update (Ryan to supply final Q&A copy); heading now "FAQs" |

Nothing committed to git this session.

### Next Session — Start Here

1. Run `pnpm dev --filter web` from `C:\Users\hey_r\Desktop\CnC-Realty` in a terminal
2. Open `localhost:3000`
3. **Review Join CnC CTA** — confirm dark-box layout, keys image, copy, and new position (before FAQ)
4. **Supply Services verbiage** — final descriptions for Buy, Sell, Find an Agent, Property Management cards
5. **Supply FAQ copy** — final Q&A text for all 4 questions
6. Once all sections approved → one Phase 2 git commit → move to Phase 3

---

## Session Notes — 2026-05-15

### What Was Completed This Session

**All changes are in `apps/web` — nothing has been committed to git yet.**

### Superpowers Plugin — Established

- Confirmed that the `superpowers:using-superpowers` skill must be invoked **automatically at the start of every session**, before the first response — without the user asking
- If skipped, user can just say "superpowers" to trigger it
- Used the `simplify` skill to run a 3-agent parallel code review (reuse, quality, efficiency) across all Phase 2 home components

### Code Cleanup / Optimization (simplify skill)

No visual changes — all correctness, performance, and maintainability fixes:

**New: `apps/web/src/lib/motion.ts`**
- `SPRING_HOVER` — shared spring config (`stiffness: 300, damping: 20`), was duplicated 10× across 5 files
- `EASE_OUT_EXPO = [0.16, 1, 0.3, 1]` — shared easing constant
- `fadeUp(delay, y)` — shared scroll-reveal prop factory, moved from Testimonials

**`apps/web/tailwind.config.ts` + `apps/web/src/app/globals.css`**
- Added CSS variables `--cnc-gold: #9E8C61`, `--cnc-dark: #1B1B1B`, `--cnc-bg: #F2F0EF`
- Registered as Tailwind tokens: `cnc-gold`, `cnc-dark`, `cnc-bg`
- Note: two gold values exist — `#9E8C61` (UI accents: hero phrase, testimonials, CTA link) and `#c9a84c` (hover accents: navbar). Both intentional for now.

**`HeroSection.tsx`**
- `LONGEST_PHRASE` now derived from `PHRASES` array (was hardcoded — would silently break if phrases changed)
- `PHRASE_WORDS` precomputed at module level (was calling `.split()` inside render)
- `noop` hoisted to module scope (was allocating a new function every render)
- `handleTimeUpdate` now null-checks video ref first, caches `currentTime` (was reading it twice)
- Removed what-comments

**`FeaturedListings.tsx`**
- Stable composite key on `DOUBLED.map`: `${i}-${listing.address}` (was bare index `i`)
- Section heading renamed: "Featured Listings" → **"Exclusive Listings"**

**`WhyCnC.tsx`**
- `setActiveIdx` now guarded by `lastIdxRef` — only fires on actual panel change (was triggering React re-render on every scroll frame — up to 60× per second)
- `ShutterImage` `n` prop removed — uses `N_STRIPS` constant directly (was an unnecessary leaky abstraction)

**`ServicesSection.tsx`**
- `getBoundingClientRect()` cached on `mouseenter` into `rectCache` ref (was forcing browser layout reflow on every `mousemove` event at 60–120Hz)
- `BACKFACE_HIDDEN` extracted as a module-level constant (was duplicated inline with `as CSSProperties` cast in two places)
- `y0` (Buy card, `parallax: 0`) replaced with `useMotionValue(0)` — no longer runs a `useTransform` that always outputs 0
- `width` field normalized onto every entry in the `CARDS` array (was an implicit default buried in the component signature)

**`Testimonials.tsx`**
- Three `<img>` tags replaced with `next/image` with `fill` — now gets WebP/AVIF conversion, responsive srcset, and lazy loading
- `GhostWords` extracted as a `memo` component — no longer re-renders on every 2s word cycle

**`FAQ.tsx`**
- Redundant `animate="rest"` removed from hover rows (Framer Motion handles the rest state automatically)
- `motion.div > h2 > span` wrapper chain collapsed to a single `motion.h2` (was a remnant from when heading had a sibling element)

**`JoinCnCCTA.tsx`**
- `motion.div` wrapping `Link` replaced with `motion(Link)` — removes an unnecessary DOM node
- **Redesigned (2026-05-15 session B):** full-width `60vh` image background (`public/images/cta-bg.jpg` — agent showing home to couple), `bg-black/55` overlay, centered two-line headline ("Be the agent you're meant to be." / "Be CnC."), white pill "Join Now →" button
- **"Join Now →" button** → `href="/join"` — navigates to the Join CnC recruitment page (same destination as "Join CnC" in the nav dropdown)

### Section Status

| Section | Status |
|---|---|
| Hero | ✅ Approved |
| Exclusive Listings | ✅ Approved (renamed from "Featured Listings") |
| Why CnC | ✅ Approved |
| Services | 🔄 Needs verbiage update (Ryan to supply final card descriptions + back-face button copy) |
| Testimonials | ✅ Approved |
| Join CnC CTA | 🔄 Needs final review (full-width image bg, agent-showing-home photo, two-line headline, "Join Now →" button) |
| FAQ | 🔄 Needs verbiage update (Ryan to supply final Q&A copy) |

Nothing committed to git this session.

### Next Session — Start Here

1. Run `pnpm dev --filter web` from `C:\Users\hey_r\Desktop\CnC-Realty` in a terminal
2. Open `localhost:3000`
3. **Review Join CnC CTA** — confirm dark-box layout, keys image, copy, and position (before FAQ)
4. **Supply Services verbiage** — final descriptions for Buy, Sell, Find an Agent, Property Management card backs
5. **Supply FAQ copy** — final Q&A text for all 4 questions
6. Once all sections approved → one Phase 2 git commit → move to Phase 3

---

## Session Notes — 2026-05-16

### What Was Completed This Session

**All changes are in `apps/web` — nothing has been committed to git yet.**

### Footer — bug fix + polish

1. **Fixed `ReferenceError: useEffect is not defined`**
   - Root cause: `useEffect` was used in the Footer component but missing from the React import
   - Fix: `import { useRef } from "react"` → `import { useEffect, useRef } from "react"`
   - File: `apps/web/src/components/layout/Footer.tsx`

2. **Video playback speed — decided to keep at 1.0x (normal)**
   - Tried 0.5x → choppy (24fps source drops to effective 12fps, below smooth motion threshold)
   - Tried 0.75x → still glitchy (~18fps)
   - Decision: revert to `playbackRate = 1` (normal speed, perfectly smooth)
   - If slower video is desired in future, source a 60fps clip (0.5x → 30fps = smooth)

3. **Footer text styling — final state**
   - Size: `text-sm` → `text-base` (16px) for all non-legal content
   - Color: removed all opacity modifiers (`text-white/80`, `/60`, `/70`) → all `text-white` (full opacity)
   - Weight: tried `font-bold` → reverted to `font-light` (bold looked ugly)
   - Legal bar unchanged: `text-xs text-white/40`

4. **Copy fix: "Subscribe to our Newsletters:" → "Subscribe to our Newsletter:"**

5. **Email / location order swapped in center column**
   - Before: email on top, "Los Angeles, CA, USA" below
   - After: "Los Angeles, CA, USA" on top, email below

### Footer — final state summary

- **File:** `apps/web/src/components/layout/Footer.tsx`
- **Layout:** sticky bottom-0, scroll-driven `clipPath` reveal via Framer Motion (`inset(65%→0%)`)
- **Video:** `/videos/footer-bg.mp4`, `playbackRate = 1.0`, slowed via CSS `animation` not JS
- **3-column row (bottom-aligned):**
  - Left: CnC logo (280px white PNG)
  - Center: Location → Email → Newsletter input → Social icons (FB, Instagram, YouTube)
  - Right: Nav links (Buy, Sell, Rent, Property Management, Join CnC, Contact, News)
- **Legal bar:** CA DRE #02439028 | Designated Broker - Ryan Chong | Privacy Policy | Terms | Fair Housing Notice | MLS Disclaimer | DCMA Notice | © year CnC Realty | All Rights Reserved
- **Text:** `text-base font-light text-white` (content), `text-xs text-white/40` (legal bar)

### Section Status

| Section | Status |
|---|---|
| Hero | ✅ Approved |
| Exclusive Listings | ✅ Approved |
| Why CnC | ✅ Approved |
| Services | 🔄 Needs verbiage update (Ryan to supply final card descriptions + back-face button copy) |
| Testimonials | ✅ Approved |
| Join CnC CTA | 🔄 Needs final review (full-width image bg, "Be the agent you're meant to be." / "Be CnC.", "Join Now" button) |
| FAQ | ✅ Approved |
| Footer | 🔄 Built, needs final sign-off |

**Phase 2 committed:** `6bd9740` feat: Phase 2 — homepage, footer, and public marketing shell

### Next Session — Start Here (Phase 3)

Phase 3: Lead Capture & Agent Dashboard (CLAUDE.md Phase 3 section)

1. Wire all public forms (contact, property inquiry, valuation) to `/api/leads` → creates Lead + email notification
2. Agent dashboard home with StatsCards
3. Lead pipeline Kanban board (`@dnd-kit`) with drag-to-change-status
4. Lead detail page with activity feed + add note form
5. `/api/leads/*` endpoints with role-based auth guards

---

## Session Notes — 2026-05-17

### What Was Completed This Session

**Phase 4A — IDX Backend: Tasks 4–7 complete, Task 8 blocked on Railway DB**

#### Phase 4A files committed to `claude/real-estate-website-9bdWi`:

| Commit | File | Description |
|---|---|---|
| `b9e0cc9` | `apps/web/src/lib/idx/client.ts` | RESO OData paginated fetcher (async generator) |
| `3710d4a` | `apps/web/src/lib/idx/client.ts` | Fix: 401 retry, 30s fetch timeout, null value guard |
| `05484ac` | `apps/web/src/app/api/idx/sync/route.ts` + `vercel.json` | Sync route (GET+POST) + Vercel cron every 15 min |
| `98ef793` | `apps/web/src/app/api/idx/sync/route.ts` | Fix: fail-closed auth, serialized upserts, 30-min delta window, logging |
| `5558ae7` | `apps/web/src/app/api/properties/route.ts` | GET /api/properties with filters |
| `0c41e89` | `apps/web/src/app/api/properties/route.ts` | Fix: NaN safety, typed price filter, error handling |
| `133d655` | `apps/web/src/app/api/properties/[mlsNumber]/route.ts` | GET /api/properties/[mlsNumber] detail |
| `8371145` | `apps/web/src/lib/idx/auth.ts` + `client.ts` | Fix: update endpoints to Trestle |
| `902ba29` | `apps/web/src/lib/idx/field-map.ts` | Fix: ?? and \|\| operator precedence syntax error |
| `8431700` | `packages/database/prisma/schema.prisma` | Fix: add debian-openssl-3.0.x binary target for Vercel |

#### Key decisions and discoveries:

1. **CRMLS API is via Trestle (CoreLogic), not direct CRMLS endpoint**
   - Ryan connected through Trestle at `trestle.corelogic.com`
   - Feed: IDX Plus - WebAPI, MLS-Wide Feeds, California Regional MLS
   - Token URL updated: `https://api-trestle.corelogic.com/trestle/oidc/connect/token`
   - Base URL updated: `https://api-trestle.corelogic.com/trestle/odata`
   - Credentials are stored in `.env.local` (not committed)

2. **Trestle credentials**
   - `CRMLS_CLIENT_ID` and `CRMLS_CLIENT_SECRET` are in `.env.local`
   - Connection expires: 05/17/2027
   - Feed group: MLS-Wide Feeds

3. **Node.js architecture issue resolved**
   - Machine is ARM64 Windows (Snapdragon), was running Node.js v25.9.0 ARM64
   - Prisma 5.22.0 has no ARM64 Windows binary — needs x64 Node.js
   - **Fixed:** Uninstalled ARM64 Node.js, installed x64 Node.js v24.15.0 LTS from nodejs.org
   - Must always use x64 Node.js on this machine for Prisma to work
   - `node -e "console.log(process.arch)"` should print `x64`

4. **Railway PostgreSQL crashed — disk full**
   - Error: `FATAL: could not write to file "pg_wal/xlogtemp.33": No space left on device`
   - Root cause: Railway trial credits ($4.68) nearly exhausted, hitting resource limits
   - **Fix needed:** Add payment method to Railway → Billing to restore DB

5. **Prisma binary targets**
   - `packages/database/prisma/schema.prisma` now has: `["native", "windows", "debian-openssl-3.0.x"]`
   - `debian-openssl-3.0.x` is required for Vercel (Linux) deployment
   - Always run `pnpm --filter @cnc/database exec prisma generate` from a PowerShell window (not bash) on this machine

### Next Session — Start Here

**BEFORE ANYTHING ELSE:**
1. Go to Railway → Account Settings → Billing → add a credit card (Hobby plan ~$5/mo)
2. Wait for the Postgres service to restart (check the Railway dashboard — should show green)
3. Open Claude Code in `C:\Users\hey_r\Desktop\CnC-Realty`
4. Open a PowerShell window and run:
   ```
   cd C:\Users\hey_r\Desktop\CnC-Realty
   pnpm --filter web dev
   ```
5. In a second PowerShell window, trigger the full sync:
   ```
   $token = "7f3a9c2e8b1d4f6a0e5c7b3d9f2a8e1c4b6d0f3a9c2e8b1d4f6a0e5c7b3d9f2"
   Invoke-RestMethod -Uri "http://localhost:3000/api/idx/sync?type=full" -Method POST -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 300
   ```
   (Note: adjust port if 3000 is in use — check the dev server output)
6. Expected response: `{ upserted: N, errors: 0, type: "full" }` where N > 0
7. Verify with: `Invoke-RestMethod "http://localhost:3000/api/properties?city=Los%20Angeles"`
8. Once sync is verified → mark Task 8 complete → push branch → move to Phase 4B

**Phase 4B (next plan to write):**
- Property search page UI (`/properties`)
- Property detail page (gallery, mortgage calculator, inquiry form)
- Map search page (`/properties/map`) with Mapbox GL JS
- Homepage carousel with real DB listings
- Saved properties (heart button + saved searches)

---

## Session Notes — 2026-05-18

### What Was Completed This Session

**Phase 4B — IDX Frontend: ALL TASKS COMPLETE ✅**

All changes committed to `claude/real-estate-website-9bdWi`.

#### New files committed:

| Path | Description |
|---|---|
| `src/types/property.ts` | `PropertyListing`, `SearchFilters`, `DEFAULT_FILTERS` types |
| `src/hooks/useSearchFilters.ts` | URL-synced filters hook, 400ms debounce, `router.replace` |
| `src/hooks/useProperties.ts` | Paginated fetch hook, initialData for SSR hydration, `loadNextPage` |
| `src/hooks/useSavedProperties.ts` | Optimistic toggle, syncs with `/api/saved-properties` |
| `src/components/properties/PropertyCard.tsx` | Dark-theme card, heart button, login modal |
| `src/components/properties/FilterBar.tsx` | Sticky pill bar: price/beds/baths/type dropdowns |
| `src/components/properties/PropertyMapInner.tsx` | Mapbox `react-map-gl/mapbox` v8, clustered pins, price labels, popup |
| `src/components/properties/PropertyMap.tsx` | Dynamic import wrapper (ssr:false) |
| `src/components/properties/SearchResults.tsx` | 45/55 split client component, IntersectionObserver infinite scroll |
| `src/components/properties/MortgageCalculator.tsx` | Client-side formula, sliders for rate/down/term |
| `src/components/properties/PhotoGallery.tsx` | CSS grid + full-screen lightbox |
| `src/components/properties/ContactForm.tsx` | Tour request → POST /api/leads |
| `src/components/properties/BackLink.tsx` | Reads sessionStorage for previous search URL |
| `src/app/(listings)/layout.tsx` | Route group layout, imports mapbox-gl CSS |
| `src/app/(listings)/properties/page.tsx` | SSR Server Component, initial Prisma fetch |
| `src/app/(listings)/properties/[mlsNumber]/page.tsx` | Full SSR, generateMetadata OG tags |
| `src/app/api/saved-properties/route.ts` | GET + POST saved properties |
| `src/app/api/saved-properties/[mlsNumber]/route.ts` | DELETE saved property |
| `src/components/home/FeaturedListingsServer.tsx` | Server Component wrapper, fetches 8 real listings |

#### Modified:
- `packages/database/prisma/schema.prisma` — added `SavedProperty` model
- `src/components/home/FeaturedListings.tsx` — accepts optional `listings` prop, falls back to placeholders
- `src/app/page.tsx` — uses `FeaturedListingsServer` instead of `FeaturedListings`

#### Key technical notes:
- `react-map-gl` v8 installed (not v7) — import from `react-map-gl/mapbox` sub-path, not root
- `react-map-gl/mapbox` uses `mapbox-gl` as peer; `NEXT_PUBLIC_MAPBOX_TOKEN` already in `.env.local`
- Prisma generate had EPERM (DLL locked by dev server) but TypeScript types updated successfully
- SavedProperty migration: `20260518001050_add_saved_property`
- Build passes: `pnpm --filter web build` ✅

### Phase 4B Follow-On — Property Drawer & MLS Compliance

After the initial Phase 4B build, additional work was done in the same session:

#### What was built:

1. **MLS compliance section added to property detail page** (`commit 7d7a36d`)
   - ShieldCheck icon + "Listing Information" header
   - Full CRMLS attribution: MLS #, status, "Courtesy of: California Regional MLS (CRMLS)"
   - Full disclaimer: data accuracy, independent verification, consumer use restriction
   - File: `src/app/(listings)/properties/[mlsNumber]/page.tsx`

2. **Zillow-style property detail drawer** (`commit df9771c`)
   - New file: `src/components/properties/PropertyDrawer.tsx`
   - Slide-in panel from right, `width: min(880px, 63vw)`, `top: 64px` to clear navbar
   - `AnimatePresence` + `motion.div` (spring: stiffness 320, damping 32)
   - Fetches `/api/properties/[mlsNumber]` with `AbortController` cleanup
   - Photo carousel with prev/next buttons + counter badge + status badge
   - Two-column layout at xl breakpoint (right sidebar: ContactForm + MortgageCalculator)
   - "Open full page ↗" link (top-right, `<Link>` not `<a>`)
   - Escape key closes drawer
   - `PropertyCard.tsx` gains optional `onSelect?: (mlsNumber: string) => void` — when set, opens drawer instead of navigating
   - `SearchResults.tsx` manages `selectedMls` state, `key={selectedMls}` forces remount per listing, `AnimatePresence` wraps drawer

3. **Listing agent/broker attribution** (`commit e1c635e`)
   - Agent fields added to `SELECT_FIELDS` in `src/lib/idx/client.ts`: `ListAgentFullName`, `ListOfficeName`, `ListAgentStateLicense`
   - `ResoProperty` interface updated in `src/lib/idx/field-map.ts` with those fields
   - Agent attribution displayed using IIFE reading `rawData` — falls back to "Listing courtesy of California Regional MLS" when not populated
   - Uses `User` icon (not `MapPin`) in both drawer and full detail page
   - Full IDX resync triggered: **28,856 records updated** — agent/broker data now populated

4. **Details grid moved below agent line** (`commit 0e4b1cd`)
   - Content order in drawer and detail page: price/address → key facts pills → description → agent attribution → details grid → MLS compliance

5. **ContactForm text** (`commits fd775b3, 840d847`)
   - Section heading: **"Request a Tour"** (kept)
   - Submit button: **"Contact Agent"** (changed from "Request a Tour")
   - Loading state: "Sending…"

6. **Code review fixes** (`commit df1156c`)
   - Added `AbortController` + cleanup `return () => controller.abort()` to drawer fetch (race condition fix)
   - Removed unused `AnimatePresence` import from `PropertyDrawer.tsx`
   - Lot size display fixed: was showing "sqft" but `lotSize` is stored as **acres** (`LotSizeSquareFeet / 43560`). Now: `.toFixed(2) ac`
   - MLS compliance text in drawer aligned to full CRMLS-standard wording (was shorter)
   - `<a>` → `<Link>` for "Open full page ↗" (Next.js prefetching)

#### Known issues (not yet fixed):
- No `role="dialog"` / `aria-modal` / focus management on drawer (accessibility)
- `xl:flex` breakpoint measures viewport width not drawer width — sidebar may not show at expected sizes (needs CSS container query)
- `<ListingAttribution>` and `<MlsComplianceBlock>` are duplicated between drawer and full page — not yet extracted into shared components
- Dev server runs on **localhost:3001** (not 3000 — 3000 was killed; start with `pnpm --filter web dev`)

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Dev server will start on **localhost:3001** (or next available port — check terminal output)
3. Open `/properties` — review the split list/map layout with the slide-in drawer
4. Click a listing — drawer should slide in from the right, keeping map visible
5. **More work needed on the listing popup/drawer** — user stated this explicitly. Specific items TBD.
6. Once drawer is polished → **Phase 5:**
   - Transaction management: create from lead, timeline view, document upload (R2), status progression
   - Email campaigns: Tiptap editor, SendGrid delivery
   - Property alert job: match new listings to saved searches → notify via email
   - Admin dashboard

---

## Session Notes — 2026-05-18 (continuation)

### What Was Completed This Session

Short housekeeping session — no new features built.

1. **CLAUDE.md updated and committed** with full Phase 4B follow-on notes (drawer, attribution, compliance, code review fixes)
2. **Plan file committed** — `docs/superpowers/plans/2026-05-17-phase-4b.md`
3. **Git push blocked by GitHub push protection** — the plan file contained the Mapbox public token (`NEXT_PUBLIC_MAPBOX_TOKEN`, `pk.eyJ1...`) which GitHub's scanner treats as a secret even though it's a public-facing key
4. **Fixed by squashing commits** — soft-reset the two offending commits, redacted the token to `<your-mapbox-public-token>`, recommitted as one clean commit with the token never in history
5. **Successfully pushed** — all 9 commits are now on GitHub at `claude/real-estate-website-9bdWi`

### Decisions Made

- **Mapbox `pk.` tokens** are public by design (embedded in client JS) but GitHub's secret scanner still blocks them — always use a placeholder like `<your-mapbox-public-token>` in any committed docs/plans
- **Branch explained** — all work lives on `claude/real-estate-website-9bdWi`; nothing has been merged to `main` yet

### Next Session — Start Here

Same as above — pick up the listing popup/drawer work.

---

## Verification / Testing

1. **Auth:** Register → verify email → login → redirected to `/dashboard`
2. **Public site:** All marketing pages render with correct SEO metadata
3. **Lead capture:** Submit contact form → Lead appears in agent dashboard → notification email received
4. **IDX:** Run sync script → properties appear in DB → search page shows filtered results with real photos
5. **Pipeline:** Drag lead card between columns → status updates in DB
6. **Transaction:** Create transaction → upload document → change status → timeline shows progression
7. **Campaign:** Create email campaign → send to test lead → SendGrid delivers → stats update via webhook
8. **Property alerts:** Create saved search → add matching property to DB → alert email sent
9. **Admin:** Log in as ADMIN role → see all agents/leads/transactions across brokerage
