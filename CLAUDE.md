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
- **AI-assisted transaction coordinator (TC) automation:**
  - Deadline tracking: inspection, appraisal, loan approval, COE auto-calculated from transaction dates (already stored on `Transaction` model)
  - Automated deadline email reminders: Vercel Cron reads upcoming deadlines daily → sends agent reminders via SendGrid (3 days out, 1 day out)
  - In-app dashboard alerts: deadline notification banner on agent dashboard when logged in (no new service — pure Next.js)
  - Broker supervision view: `/admin` shows all open transactions with upcoming deadlines across all agents — fulfills broker's legal DRE supervision obligation
  - No new third-party services required — runs entirely on existing Railway (DB), Vercel Cron, and SendGrid
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

## Session Notes — 2026-05-19 (continuation 2)

### What Was Completed This Session

All changes committed as `7d093e5` on `claude/real-estate-website-9bdWi`. Map search phase complete ✅

### Map Search Polish

1. **ContactForm — UX improvements** (`ContactForm.tsx`)
   - Removed last name field — single "Name" field only
   - Phone is now required (was optional)
   - Placeholders simplified: "Email address" → "Email", "Phone number" → "Phone"
   - Message pre-filled: `"Hi there! I am interested in {address}."` (Zillow-style, address injected from prop)
   - Applies to both the drawer and full detail page (shared component)

2. **PropertyDrawer — heart/save button** (`PropertyDrawer.tsx`)
   - Heart button added to top-right corner of photo carousel (absolute positioned over photo)
   - Style: dark frosted-glass circle (`bg-black/50 backdrop-blur-sm`), fills gold when saved
   - Uses `useSavedProperties` hook — syncs with list cards and map popup saves
   - "Back to search" and "Open full page ↗" text changed to full white (was `white/60` and `white/30`)

3. **BackLink — white text** (`BackLink.tsx`)
   - "Back to search" on full detail page changed to full white

4. **SaveButton — new component** (`SaveButton.tsx`)
   - New client component for the full detail page
   - Heart button placed to the left of the status badge ("Active")
   - Light-background style: empty state `text-[#1B1B1B]/40`, filled state gold

5. **PropertyMapInner — Zillow-style price labels** (`PropertyMapInner.tsx`)
   - Under $1M: `$950K`, `$499K` (was `$950k`, `$1108k`)
   - $1M+: `$1.10M`, `$1.99M`, `$2.40M` — always 2 decimal places
   - Extracted `M`, `HUNDRED_K`, `TEN_K` constants for readability

6. **useSavedProperties — stable toggle** (`useSavedProperties.ts`)
   - `toggle` callback removed `savedSet` from dependency array
   - Reads current state via `setSavedSet` functional updater instead — toggle is now stable across renders

### Phase Status Update

**Phase 4B: COMPLETE ✅** — Map search polish done, all committed.

### Next Session — Start Here (Phase 5)

Phase 5: Full CRM

1. Transaction management: create from lead, timeline view, document upload (Cloudflare R2), status progression
2. Email campaigns: Tiptap rich text editor, recipient selection, SendGrid delivery
3. Drip email sequence builder
4. SendGrid webhook handlers to update `CampaignContact` stats
5. Property alert job: match new listings to saved searches → notify via email
6. Admin dashboard: manage all agents, leads, transactions, campaigns; commission reports
7. Agent onboarding multi-step form

**Also pending before Phase 5:** Full IDX resync (Ryan confirmed — triggers from dev server, call `/api/idx/sync?type=full` with the sync token)

---

## Session Notes — 2026-05-19

### What Was Completed This Session

All changes committed as `c355492` on `claude/real-estate-website-9bdWi`.

### Drawer & Detail Page — Off-White Theme

Full light-theme conversion of the property drawer (`PropertyDrawer.tsx`) and full detail page (`/properties/[mlsNumber]/page.tsx`). Both now use the same off-white palette as the homepage sections.

**Color decisions:**
- Drawer/page background: `bg-[#F2F0EF]`
- Card/box backgrounds: `bg-white`
- Primary text: `text-[#1B1B1B]` (full black)
- Muted text hierarchy: `/80` (address, description) → `/70` (city, field labels) → `/60` (stat sublabels, section headers) → `/50` (secondary headers, disclaimer)
- Gold accents `#9E8C61` unchanged
- **Top navigation bar stays dark `bg-[#1B1B1B]`** on both the drawer and the detail page — this was an explicit decision to keep contrast for the "Back to search" / "Open full page" navigation

**Detail page header bar:** Added a full-width `bg-[#1B1B1B]` strip at the top of the detail page (`pt-[76px] pb-3`) that clears the fixed navbar and contains the `<BackLink />` in white text. Content starts below it with `pt-6`.

**Map popup fix:** Clicking "View →" on a map pin now opens the drawer instead of navigating to a new page. Done by threading `onSelect` callback through `SearchResults` → `PropertyMap` → `PropertyMapInner`, replacing the `<Link>` with a `<button>`.

### ContactForm & MortgageCalculator — Off-White Theme

Both updated to match: `bg-white` card, `bg-[#F2F0EF]` inputs, `#1B1B1B` text.
- Section headings ("Request a Tour", "Mortgage Estimate") set to full `text-[#1B1B1B]` (not muted)
- All muted label text uses opacity variants matching the drawer
- Mortgage calculator inactive term buttons: `bg-[#F2F0EF]` with dark text

### Shared Components & Helpers Extracted (Code Review)

Used `superpowers:requesting-code-review` skill — reviewer found critical duplication. Fixed:

**New files:**
- `src/lib/property-ui-helpers.ts` — `buildStatsFields()` and `buildDetailSections()` shared between drawer and detail page. Eliminates duplicated section data and HOA logic. Both functions now the single source of truth.
- `src/components/properties/AgentAttribution.tsx` — shared agent/office/license attribution block. Accepts `rawData`, `className`, `iconClassName` props.
- `src/components/properties/CrmlsDisclaimer.tsx` — shared CRMLS disclaimer paragraph. Accepts `syncedAt` and `className`.

**Bugs fixed:**
- `finally(() => setIsLoading(false))` in drawer fetch now guarded: `if (!controller.signal.aborted)` — prevents state update flash on fast MLS number changes
- `photos: unknown` → `photos: string[] | null` in `PropertyDetail` interface
- `statsFields` filter now uses a proper TypeScript type predicate instead of unsound `as` cast
- Added `aria-label="Previous photo"` / `"Next photo"` to carousel buttons
- Added `type="button"` to mortgage calculator 15-yr/30-yr toggle buttons
- Added dev-mode `console.error` logging in `ContactForm` catch block

### IDX Fields Expanded

- `SELECT_FIELDS` in `src/lib/idx/client.ts` expanded to 40+ RESO fields (architecture, amenities, HOA, community, financial)
- `ResoProperty` interface in `src/lib/idx/field-map.ts` updated to match
- These fields show "N/A" in the UI until the full IDX resync runs

### Pending

- **Full IDX resync** — must be done after map search polish. New fields (architecture, amenities, HOA, school district, etc.) won't populate until a full sync.
- **Map search polish** — current focus before the resync
- **Phase 5** — transaction management, email campaigns, admin dashboard

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Dev server starts on localhost:3000 (or next available port — check terminal)
3. Open `/properties`, click a listing — review the off-white drawer with dark top bar
4. Open a listing's full page (`/properties/[mlsNumber]`) — confirm dark header bar + off-white content
5. Continue map search polish, then trigger full IDX resync once ready
6. After resync, all property detail fields (Architecture, Amenities, HOA, etc.) will populate from real MLS data

---

## Session Notes — 2026-05-20

### What Was Completed This Session

All changes committed as `30ef3ca` on `claude/real-estate-website-9bdWi`.

### Auth Pages — Full UI Redesign

Both `/login` and `/register` pages were redesigned to match the CnC brand.

**Login page (`apps/web/src/app/(auth)/login/page.tsx`):**
- Background: `bg-[#1B1B1B]` (dark), card: `bg-[#F2F0EF]` (off-white)
- "Sign In" heading: `text-[#1B1B1B]` black
- Subtitle: "Access your agent dashboard or client account."
- All labels removed — placeholders inside inputs instead
- Eye toggle on password field (shared `PasswordInput` component)
- "Continue" button: gold `#9E8C61`
- "Continue with Google" button: `#1B1B1B` black
- Footer: "New to CnC? Create account" — "Create account" in gold
- Role-based redirect after login: `BUYER` → `/account`, `AGENT`/`ADMIN` → `/dashboard`

**Register page (`apps/web/src/app/(auth)/register/page.tsx`):**
- Same dark bg / off-white card treatment as login
- "Create Account" heading: `text-[#1B1B1B]` black
- No subtitle text
- Placeholder-only inputs: Full Name, Email, Password, Re-enter Password
- Eye toggle on both password fields (shared `PasswordInput` component)
- Password match validation before API call
- "Continue" button: gold `#9E8C61`
- Footer: "Already have an account? Sign in" — "Sign in" in `#1B1B1B` black

**Shared `PasswordInput` component (`apps/web/src/components/ui/PasswordInput.tsx`):**
- Extracted from both auth pages to eliminate duplication
- Exports `PasswordInput` component and `inputClass` string constant
- Each instance has its own independent show/hide state

### Client Account Dashboard

New `/account` route for `BUYER` role users.

**Files created:**
- `apps/web/src/app/(account)/account/page.tsx` — client dashboard
- `apps/web/src/app/api/account/saved-properties/route.ts` — full property data for saved MLS numbers
- `apps/web/src/app/api/account/tour-requests/route.ts` — leads matched by user email

**Dashboard features:**
- Welcome header with user name and email
- Stats cards: Saved Properties count + Tour Requests count
- Tab switcher: "Saved Properties" | "Tour Requests"
- Saved Properties tab: grid of `PropertyCard` components with save/unsave working
- Tour Requests tab: list of submitted inquiries matched by email, with status badge and date
- Empty state component (shared between both tabs) with "Browse listings →" link

**Routing decisions:**
- `/account` is protected by middleware (redirects to `/login` if unauthenticated)
- Agents/admins who land on `/account` are redirected to `/dashboard`
- There is no role-selection screen on signup — all new accounts get `BUYER` role by default
- Agent onboarding will be built separately as its own flow (Phase 5 backlog)

### Navbar Fixes

1. **Dark mode on light-bg pages:** Navbar stays in dark mode (black logo/buttons) on `/account`, `/dashboard`, `/admin`. All other pages keep the original transparent + white behavior. Controlled via `FORCE_DARK_ROUTES` module constant.
2. **Client-side navigation fix:** Added `useEffect` watching `forceDark` to reset `pastHero` and `scrolled` when navigating between pages.
3. **Role-based auth link:** Shows "My Account" → `/account` for buyers, "Dashboard" → `/dashboard` for agents/admins, "Login" for unauthenticated.
4. **Session pre-population:** Root layout now calls `getServerSession(authOptions)` (JWT-based, no DB hit) and passes result to `SessionProvider` via `Providers`. This eliminates the `useSession()` loading flicker and the brief "Login" flash when opening new tabs.
5. **Scroll handler optimization:** Uses functional updater pattern to bail out when `scrolled`/`pastHero` values haven't changed — prevents unnecessary re-renders at 60fps.

### Key Decisions

- **No role-selection at signup** — all users register as `BUYER`. Agent onboarding is a separate future feature.
- **Agent promotion** — to become an `AGENT`, Ryan manually sets role in Prisma Studio (or future onboarding form).
- **Tour requests matched by email** — the `Lead` model has no `userId` FK, so tour requests are matched by `session.user.email`. No schema migration needed.
- **getServerSession in root layout** — the efficiency agent flagged this as hot-path bloat, but it uses JWT (no DB query), so the cost is just a cookie read + JWT decode on every render. Acceptable tradeoff for eliminating the Navbar loading flicker.

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Dev server starts on `localhost:3000` (or next available port — check terminal)
3. **Create a test account** at `/register` → check that you land on `/account`
4. **Promote to ADMIN** via Prisma Studio (`pnpm --filter @cnc/database exec prisma studio` → `localhost:5555`) to test agent/admin dashboard
5. **Continue Phase 5A testing** — transactions, file detail pages, admin document review
6. **Pending: full IDX resync** — new MLS fields (architecture, amenities, HOA, etc.) won't populate until a full sync is triggered

---

## Session Notes — 2026-05-20 (continuation)

### What Was Completed This Session

All changes committed on `claude/real-estate-website-9bdWi`.

### Railway Incident + DB Error Hardening

Railway had a platform-wide incident (postgres-volume warning + degraded networking). Root cause was that Prisma's connection pool can't recover from mid-request wifi drops without a server restart.

**Code fix committed as `f14972a`** — all 6 server components that called Prisma directly now have try/catch:
- `/properties` page — shows "Unable to load listings" instead of unhandled error overlay
- `/properties/[mlsNumber]` — shows "Unable to load listing" message
- `/account` page — `finally` block ensures loading spinner always resolves (was stuck forever on error)
- `/dashboard` (Overview) — shows zero stats on error
- `/dashboard/leads` — shows empty Kanban board on error
- `/dashboard/leads/[id]` — shows "Unable to load lead details" message

### Phase 5B — Email Campaigns (`6ff9441`)

Full email campaign system built with Tiptap rich text editor:

- Schema migration: added `agentId` to `Campaign` model
- **Tiptap installed:** `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`
- `/dashboard/campaigns` — campaign list page (Server Component)
- `/dashboard/campaigns/new` — 4-step wizard: details → content (Tiptap) → recipients → schedule
- `/dashboard/campaigns/[id]` — detail page with stats cards + send/delete actions
- `TiptapEditor` component (rich text with Bold/Italic/List toolbar)
- `RecipientPicker` component (searchable lead list with checkboxes)
- `CampaignCard` component (status-color-coded)
- `GET/POST /api/campaigns` — list + create (scoped to agent)
- `GET/PATCH/DELETE /api/campaigns/[id]`
- `POST /api/campaigns/[id]/contacts` — add leads to campaign
- `POST /api/campaigns/[id]/send` — send via SendGrid, updates ContactStatus
- `POST /api/webhooks/sendgrid` — open/click/bounce event handler

### Phase 5B — Admin Dashboard + Agent Onboarding + Property Alerts (`a8dbbc7`)

**Admin Dashboard:**
- `/admin` — broker overview (6 StatsCards: total agents, leads, active leads, closed this month, listing files, transaction files)
- `/admin/agents` — all agents table with role badges + `PromoteButton` (AGENT→ADMIN via POST /api/admin/agents/[id]/promote)
- `/admin/leads` — all leads cross-agent with status badges, links to lead detail
- `AdminTable` shared component
- Sidebar updated: Campaigns link + Admin sub-nav (Overview, All Agents, All Leads, All Files, Checklists)

**Agent Onboarding:**
- `/join/agent` — 4-step form (Personal Info → License → Social → Review), sets role to AGENT on submit
- `POST /api/agent-onboarding` — upsert Agent record + promote user to AGENT role

**Property Alerts:**
- `POST /api/property-alerts/run` — matches new listings (last 24h) to SavedSearches, sends one email per user via SendGrid
- `GET/POST /api/saved-searches` — CRUD for user's saved searches
- `DELETE /api/saved-searches/[id]`
- `sendPropertyAlertEmail` — CnC-branded HTML email template with property list + "View Listing →" buttons

### Known Schema Gaps (onboarding agent discovered)

The `Agent` model is missing several fields the onboarding form collects: `displayName`, `yearsExp`, `specialties`, `licenseState`. Form collects them but only persists what the schema supports (`bio`, `phone`, `licenseNum`, `instagram`, `facebook`, `linkedin`). A schema migration to add these fields is needed before agent onboarding is fully functional.

### Next Session — Start Here

1. **Railway DB** — check status.railway.com before starting; restart dev server if DB was recently recovered
2. Run `pnpm --filter web dev` and `pnpm --filter @cnc/database exec prisma studio`
3. **Schema migration needed:** Add `displayName`, `yearsExp`, `specialties String[]`, `licenseState` to `Agent` model so `/join/agent` can persist all onboarding fields
4. **Test Phase 5B:**
   - Create a campaign at `/dashboard/campaigns/new`
   - Try `/admin` (requires ADMIN role — promote via Prisma Studio first)
   - Try `/join/agent` onboarding form
5. **Remaining Phase 5 items:**
   - Drip email sequence builder (DRIP type campaigns — step-based sequence editor)
   - Agent profile pages at `/agents/[slug]` (public-facing, links from agent directory)
   - `vercel.json` cron for property alerts: `POST /api/property-alerts/run` daily
   - SendGrid webhook verification (verify signature header before processing)
6. **Phase 6:** Performance (ISR, Redis caching, skeleton loaders), SEO (JSON-LD), Sentry, deploy to Vercel + Railway

---

## Session Notes — 2026-05-21

### What Was Completed This Session

All changes committed on `claude/real-estate-website-9bdWi`.

### Railway DB Incident + Dev Server Recovery

- Railway had a platform-wide incident (postgres volume degraded) — DB was TCP-reachable but the PostgreSQL handshake was unresponsive
- Dev server had a stale webpack chunk (`Cannot find module './8541.js'`) — cleared `.next` directory and restarted; server came up on port 3001
- Once Railway resolved the incident, ran `prisma migrate deploy` to apply any pending migrations
- Verified `/properties` and `/dashboard` loaded correctly post-recovery

### Navbar Bug Fixes (`f09182c`, `5d1895e`)

Two commits to fix navbar state on non-homepage routes:

**Fix 1 (`f09182c`) — stale closure reset:**
- `useEffect` watching `forceDark` was calling `setPastHero(forceDark)` but the scroll listener had a stale closure — `pastHero` wasn't resetting when navigating between routes
- Fixed: `setPastHero(forceDark || !isHomepage)` in effect, deps `[forceDark, isHomepage]`

**Fix 2 (`5d1895e`) — dark nav on all non-homepage pages:**
- Root cause: `pastHero` initialized to `forceDark` only — on pages like `/contact` (not in `FORCE_DARK_ROUTES` and not homepage), navbar started transparent with white text, making logo/buttons invisible against a light background
- Fix: `useState(forceDark || !isHomepage)` as the initial value + effect uses same expression
- **Rule established:** homepage = transparent white nav (transitions dark on scroll past hero); all other pages = always dark nav from the start

### Contact Page Subtitle Update

- Changed subtitle on `/contact` from "Send us a message and a CnC agent will reach out within 24 hours." → **"We're super responsive!"**
- File: `apps/web/src/app/(marketing)/contact/page.tsx`

### Simplify Skill — Pass 1 (`28e38a6`)

Ran `superpowers:simplify` across all Phase 5 code (campaigns, admin, API routes). Three parallel agents reviewed for reuse, quality, and efficiency.

**New shared utilities created:**
- `src/lib/utils.ts` — added `toTitleCase(s)` and `formatDate(d)` helpers
- `src/lib/email.ts` — exported `FROM` constant (`"noreply@cncrealtygroup.com"`) so API routes don't hardcode it
- `src/lib/campaign-ui.ts` — created with `CAMPAIGN_TYPE_COLORS`, `CAMPAIGN_STATUS_COLORS`, `CONTACT_STATUS_COLORS`

**API routes refactored:**
- `campaigns/[id]/route.ts` — split into lightweight `checkAccess()` (no eager-load) for PATCH/DELETE vs full fetch for GET only; extracted `getAgentId()` helper
- `webhooks/sendgrid/route.ts` — fixed N+1: single `findMany` batch lookup + concurrent `updateMany` via `Promise.all`
- `agent-onboarding/route.ts` — wrapped agent upsert + user role update in `prisma.$transaction`
- `admin/agents/[id]/promote/route.ts` — replaced manual `getServerSession` + role check with `requireAuth("ADMIN")`

**UI components / pages refactored:**
- `CampaignCard.tsx`, `campaigns/[id]/page.tsx` — imported from `campaign-ui.ts` and `utils.ts`; removed local duplicate constants
- `RecipientPicker.tsx` — added `AbortController` to fetch `useEffect`
- `campaigns/new/page.tsx` — PATCH body and POST contacts now run concurrently with `Promise.all`
- `admin/agents/page.tsx` — added `take: 200`, used `formatDate()`
- `admin/leads/page.tsx` — used `formatDate()`
- `properties/page.tsx` — removed redundant `dbError` boolean

### Simplify Skill — Pass 2 (`20c7f67`)

Second pass applying remaining findings.

**New shared components/helpers:**
- `src/lib/server-utils.ts` — `requireAdminPage()`: gets session, redirects non-ADMIN to `/dashboard`, returns session. Replaces 3× duplicated boilerplate across admin pages.
- `src/components/ui/EmptyState.tsx` — shared dashed-border empty state component used in admin pages.
- `src/lib/campaign-ui.ts` — added `LEAD_STATUS_COLORS` map at top.

**Files updated to use new shared code:**
- `/admin/page.tsx`, `/admin/agents/page.tsx`, `/admin/leads/page.tsx` — all now use `requireAdminPage()` and `EmptyState`
- `admin/leads/page.tsx` — removed local `STATUS_BADGE` map; uses `LEAD_STATUS_COLORS` from `campaign-ui.ts`
- `RecipientPicker.tsx` — imports `LEAD_STATUS_COLORS` from `campaign-ui.ts` (removed local duplicate); fixed `replace("_", " ")` → `replace(/_/g, " ")` (global regex, was only replacing first underscore)

**Campaign send route batched:**
- Replaced sequential `for` loop (one DB write per contact) with `Promise.allSettled` (all emails fire concurrently) + single `prisma.campaignContact.updateMany` for all successful sends
- Imported `FROM` from `@/lib/email` (removed hardcoded string)

**Query limits added:**
- `GET /api/leads` admin path: `take: 200`
- `property-alerts/run` match query: `take: 50` per saved search

**Comments removed:**
- `{/* Step 1: Details */}`, `{/* Step 2: Content */}` etc. from campaigns/new wizard
- `{/* Lead header */}`, `{/* Add note */}`, `{/* Activity feed */}` from leads/[id] page

### Commits This Session

| Hash | Description |
|---|---|
| `28e38a6` | refactor: simplify pass 1 — dedup, efficiency, and cleanup |
| `f09182c` | fix: navbar pastHero state not resetting when leaving dark routes |
| `5d1895e` | fix: navbar shows white text on light-background pages like /contact |
| `20c7f67` | refactor: simplify pass 2 — shared utils, batched sends, admin pages cleanup |

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Dev server starts on `localhost:3000` (or next available port — check terminal)
3. **Remaining Phase 5 items to build:**
   - Public agent profile pages at `/agents/[slug]` — linked from agent directory and admin table
   - Drip campaign sequence editor (DRIP type — step-based delay/send sequences)
   - `vercel.json` cron entry for property alerts: `POST /api/property-alerts/run` daily
   - SendGrid webhook signature verification (verify `X-Twilio-Email-Event-Webhook-Signature` header)
4. **Phase 6** (after Phase 5 complete): ISR on property pages, Redis caching, skeleton loaders, JSON-LD SEO, Sentry, Vercel + Railway deploy

---

## Session Notes — 2026-05-22

### What Was Completed This Session

All changes committed on `claude/real-estate-website-9bdWi`. **Phase 5 is now complete ✅**

### Phase 5 — Remaining Items (All Done)

#### 1. Property Alert Cron (`99b6611`)
- Added daily cron entry to `vercel.json`: `POST /api/property-alerts/run` at 9am daily
- File: `vercel.json`

#### 2. SendGrid Webhook Signature Verification (`99f71cf`, `c992bda`)
- Installed `@sendgrid/eventwebhook` package (ECDSA-based verification)
- New file: `apps/web/src/app/api/webhooks/sendgrid/verify.ts` — exports `verifyWebhookSignature()` helper
- `EventWebhook` instance hoisted to module level (not re-created per request)
- Webhook route: returns `200` (not `500`) on internal errors so SendGrid doesn't retry permanently
- **Bug fixed:** method was incorrectly called with ECDH — corrected to ECDSA (`verify` method name on `EventWebhook`)
- Test file: `apps/web/src/__tests__/webhooks/sendgrid-verify.test.ts`

#### 3. Public Agent Profile Pages (`2717329`, `ef4b47f`)
- New SSR page: `apps/web/src/app/(agents)/agents/[slug]/page.tsx`
- New component: `apps/web/src/components/agents/AgentProfileHero.tsx` — agent photo, name, title, bio, stats, social links
- New component: `apps/web/src/components/agents/AgentContactForm.tsx` — contact form on agent's public page
- New API route: `apps/web/src/app/api/agents/[slug]/contact/route.ts`
  - `POST` creates a `Lead` in DB + sends email notification to the agent
  - Returns `404` if agent slug not found
  - Agent query deduped (was fetching agent twice — fixed to single query)
- Test file: `apps/web/src/__tests__/api/agents-contact.test.ts` (404 + 200 cases)

#### 4. Drip Campaign Sequence Editor (`333e0c2`, `8937ef8`)
- New Prisma model: `DripStep` — fields: `id`, `campaignId`, `stepNumber`, `delayDays`, `subject`, `body`, `createdAt`
- Migration: `packages/database/prisma/migrations/20260522064153_add_drip_steps/migration.sql`
- New API route: `apps/web/src/app/api/campaigns/[id]/drip-steps/route.ts`
  - `GET` returns all steps for a campaign (requires AGENT auth, ownership check)
  - `POST` atomically replaces all steps via `prisma.$transaction` (delete all + createMany)
  - Returns `404` if campaign not found, `403` if not owner (ADMIN bypasses)
  - Returns `400` on malformed JSON
  - Uses `requireAuth("AGENT")` + `checkCampaignAccess()` helper
- New component: `apps/web/src/components/dashboard/DripSequenceEditor.tsx` — step-based sequence UI (add/remove/reorder steps, delay days, subject, body per step)
- Campaign wizard (`/dashboard/campaigns/new`) updated: DRIP type campaigns now show `DripSequenceEditor` in the content step
- Test file: `apps/web/src/__tests__/api/drip-steps.test.ts` (auth, CRUD, 403 ownership, 400 malformed JSON)

**⚠️ Drip execution engine NOT built** — steps are saved to DB but not sent on schedule. Execution engine (cron that reads `DripStep` records and sends emails at the right delay) is deferred to Phase 6 or a dedicated session.

### Phase 5 Status

| Item | Status |
|---|---|
| Transaction management | ✅ Complete (Phase 5A) |
| Email campaigns (Tiptap, SendGrid) | ✅ Complete (Phase 5B) |
| SendGrid webhook verification | ✅ Complete |
| Admin dashboard | ✅ Complete (Phase 5B) |
| Agent onboarding form | ✅ Complete (Phase 5B) |
| Property alert cron | ✅ Complete |
| Public agent profile pages | ✅ Complete |
| Drip sequence editor (UI + DB) | ✅ Complete |
| Drip execution engine | ❌ Not yet built |

### Next Session — Start Here (Phase 6)

**Phase 6: Polish & Launch**

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. **Trigger full IDX resync** (still pending from Phase 4B — new fields won't populate until done):
   ```powershell
   $token = "7f3a9c2e8b1d4f6a0e5c7b3d9f2a8e1c4b6d0f3a9c2e8b1d4f6a0e5c7b3d9f2"
   Invoke-RestMethod -Uri "http://localhost:3000/api/idx/sync?type=full" -Method POST -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 300
   ```
3. **Phase 6 items:**
   - Performance: ISR on property pages (`revalidate: 300`), Redis caching for search, skeleton loaders
   - SEO: JSON-LD structured data (RealEstateListing, Person schemas), auto sitemap
   - Security: Upstash rate limiting on public forms, Zod validation on all API routes
   - Error monitoring: Sentry on both apps
   - Analytics: PostHog or GA4
   - Deploy: Vercel (web) + Railway (CRM API + Postgres)
4. **Also pending:** Drip execution engine (send drip steps on schedule)
5. **Contact page** — Ryan explicitly requested; was deferred until after Phase 5. Now it's time.

---

## Session Notes — 2026-05-22 (Phase 6 Visual Review)

### What Was Completed This Session

All changes committed and pushed to `claude/real-estate-website-9bdWi` (4 commits: `bbf0939`, `bb29da3`, `8531a7e`, `84110ee`).

### Bug Fixes

1. **Navbar background on non-homepage pages (`bbf0939`)**
   - Removed `FORCE_DARK_ROUTES` array approach — it was a growing allowlist that broke on any new route
   - Introduced `useLightElements = isHomepage && pastHero` boolean
   - All non-homepage pages now get `bg-[#0f0f0f]` dark background automatically
   - Light elements (inverted logo, dark pills) only apply on homepage after hero fold
   - File: `apps/web/src/components/layout/Navbar.tsx`

2. **IDX sync fire-and-forget (`bbf0939`)**
   - `POST /api/idx/sync` previously awaited full sync — HTTP disconnect killed the job
   - Now returns `202` immediately and runs `runSync().catch(console.error)` in background
   - GET (Vercel Cron) remains synchronous so cron logs capture the result
   - Comment added to clarify `maxDuration = 300` only applies to GET
   - File: `apps/web/src/app/api/idx/sync/route.ts`

3. **Dashboard sidebar logo clipped (`bb29da3`)**
   - Layout had no top offset — fixed navbar (64px) was covering the CnC logo
   - Added `pt-16` to the outer flex div in the dashboard layout
   - File: `apps/web/src/app/(dashboard)/layout.tsx`

4. **Prisma Studio connection (`packages/database/.env` created)**
   - Prisma Studio was failing with "Unable to run script" — no DATABASE_URL in packages/database
   - Created `packages/database/.env` with the Railway DATABASE_URL
   - Studio now works at `localhost:5555`

### UI Polish

5. **Contact page (`bb29da3`)**
   - Heading changed: "Get in touch." → "Let's chat"
   - Added "I am a" custom dropdown (Home Buyer, Home Seller, Home Owner, Renter, Landlord, Property Manager)
   - Dropdown styled to match navbar panel exactly (dark, rounded-xl, backdrop-blur)
   - Message field made required (asterisk + `required` attribute)
   - Send Message button: spring scale animation matching all other site buttons
   - File: `apps/web/src/app/(marketing)/contact/page.tsx`

6. **Account page (`bb29da3`)**
   - Removed email display from "Welcome back" header (moves to Settings tab later)
   - User name colored gold `#9E8C61` to match homepage accent
   - File: `apps/web/src/app/(account)/account/page.tsx`

7. **Transaction wizard redesign (`84110ee`)**
   - Full redesign to match Ryan's mockup screenshot
   - Header: "New Transaction" (text-4xl) stacked above "← Back" — top-left
   - Step bar: centered `max-w-4xl`, dot indicator (no numbers), lines as flat flex siblings so they render correctly, `text-lg` labels
   - Content card: centered `max-w-2xl`, larger padding (`p-10`)
   - Option cards: bigger padding (`p-7`), `text-base` labels
   - Next/Create buttons: homepage-style pill (`px-7 py-3.5`, spring scale 1.1)
   - File: `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx`

### Code Quality (Superpowers Review — `8531a7e`)

Ran `superpowers:requesting-code-review` — fixed all Critical and Important issues:

- **`lib/motion.ts`** — added `NAV_PANEL_CLS` and `NAV_ITEM_CLS` shared constants; both Navbar and contact dropdown now reference the same source so panel style stays in sync
- **`hooks/useClickOutside.ts`** — new shared hook replacing hand-rolled `mousedown` listener
- **`idx/sync/route.ts`** — clarifying comment on `maxDuration`

### IDX Sync Status

- Full sync was triggered at session start via the fixed fire-and-forget POST route
- At last check: **79,989 properties** in DB (up from 28,856 before session)
- Sync may still be running — check dev server terminal for `[idx-sync] done` log line
- No need to re-trigger next session unless the log never appeared

### Puppeteer MCP Server Installed

- Installed official `@modelcontextprotocol/server-puppeteer` via `claude mcp add`
- Config written to `C:\Users\hey_r\.claude.json` (project scope)
- **Requires Claude Code restart to activate**
- Purpose: browse SkySlope support docs (their site blocks automated HTTP requests)

### Decisions Made

- **Account settings tab** — not yet built; email/profile info will live there; both buyers AND agents need it
- **Buy, Sell, Rent, Property Management, Join CnC pages** — all currently 404; need to be built
- **Transaction wizard** — needs to be rebuilt to match SkySlope's process after reading their docs via Puppeteer
- **Dashboard slowness** — caused by Railway DB latency + dev server overhead; will improve in production + Prisma Accelerate (Phase 6)
- **Ryan's role** — promoted to ADMIN via Prisma Studio; can access `/dashboard` and `/admin`

### Next Session — Start Here

1. Restart Claude Code to activate the Puppeteer MCP server
2. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
3. **Use Puppeteer to read SkySlope's transaction docs** — browse `https://support.skyslope.com/support/solutions/156000559647`, find "Transaction Files" and "Resources for Listings & Transactions" sections, read all relevant articles
4. **Rebuild the transaction wizard** to match SkySlope's process exactly — add Parties step, proper commission breakdown, document checklist
5. **Build account Settings tab** for both buyers (`/account`) and agents (`/dashboard`) — name editing, notification preferences, password change link
6. **Build shell pages** for Buy, Sell, Rent, Property Management, Join CnC (currently all 404)
7. **Continue Phase 6** tasks from `docs/superpowers/plans/2026-05-22-phase-6-launch.md`

---

## Session Notes — 2026-05-23

### What Was Completed This Session

All changes committed and pushed to `claude/real-estate-website-9bdWi` (commits: `d6923be`, `df7bfec`).

### SkySlope Research Summary (read all 18 articles via Puppeteer MCP)

SkySlope separates file management into two distinct flows:

**Transaction Files** (buyer-side):
- 6-step wizard: File Type → Property → Transaction Details → Parties → Commission → (Checklist auto-generated)
- Representation types: Purchase (buyer), Listing (seller), Both Purchase & Listing (dual agency), Lease Tenant, Lease Landlord, Referral, BPO, Other
- Stage: Pre-Contract (no signed agreement) vs Under Contract (signed purchase agreement)
- Parties: Buyers (multi), Sellers (multi), Listing Agent, Buyer's Agent, Co-Agent, Title/Escrow/Attorney, Loan Officer, Transaction Coordinator
- Commission: Sale commission % + Listing commission % (or flat $), other deductions, auto-calculates net to agent
- Checklist: Required compliance docs set by brokerage admin; agents upload and submit for review; statuses: Pending → In Review → Approved/Rejected

**Listing Files** (seller-side):
- Separate creation flow from transaction files
- Has its own checklist (listing agreement, disclosures, etc.)
- Can be "converted to transaction" when offer is accepted → creates a linked Transaction File

**Document Management**:
- 4 upload methods: computer, drag-and-drop, email forwarding, fax
- Split & Assign: auto-splits multi-page PDFs and assigns pages to checklist items
- Documents go through review workflow: agent submits → broker/TC reviews → approved or rejected with note

**Tasks & Reminders**:
- Per-file tasks with due dates and assignees
- Reusable Task Templates (brokerage-wide)
- Reminder emails sent automatically

**Key architectural insight**: Transaction Files and Listing Files are separate models with separate checklists. A Listing File can optionally "convert" to a Transaction File when under contract.

### What Was Built This Session

1. **Transaction wizard rebuilt to match SkySlope** (`d6923be`)
   - 6 steps: File Type → Property → Details → Parties → Commission → Review
   - Step 1: Representation type cards (Purchase, Both, Lease, Referral) + Stage (Under Contract / Pre-Contract)
   - Step 2: Address, city, state, zip, property type dropdown, MLS#, year built
   - Step 3: List/sale price, key dates, escrow #, inspection/appraisal/loan deadlines
   - Step 4: Dynamic buyers/sellers (add/remove), listing agent, title/escrow toggle, optional loan officer + TC
   - Step 5: Sale commission % or $, listing commission % or $, other deductions, auto-calculated net to agent
   - Step 6: Full sectioned review summary
   - Schema: added propertyType, yearBuilt, escrowNumber, saleCommissionPct, listingCommissionPct, otherDeductions
   - Note: "Listing" (seller-side) is intentionally NOT in this wizard — it lives in New Listing (`/dashboard/transactions/new-listing`)

2. **rawData removed from Property model** (`df7bfec`)
   - Root cause of Railway DB crash: 80k properties × ~50KB raw JSON = 4GB disk fill
   - rawData dropped; 3 agent attribution fields promoted to proper columns: listAgentName, listAgentLicense, listOfficeName
   - IDX sync updated to save these 3 fields individually instead of storing full JSON
   - AgentAttribution component, PropertyDrawer, property detail page all updated

3. **Account Settings tab** (`df7bfec`)
   - Buyers: new "Settings" tab on `/account` — display name edit, reset password link, sign out
   - Agents: new `/dashboard/settings` page — same + "Edit Public Profile" link
   - API: `PATCH /api/account/profile` for display name updates

4. **Railway DB recreated from scratch**
   - Old DB crashed (100% disk from rawData)
   - Deleted Postgres service + both volumes
   - Created fresh Postgres on Railway
   - New DATABASE_URL: `postgresql://postgres:eAVMklDXFYiLwGPTVgBLQwLWHoefXEpJ@kodama.proxy.rlwy.net:51294/railway`
   - All 10 migrations applied cleanly
   - Admin account recreated: `ryanchong@cncrealty.com` / `Fakeaccount1!` (role: ADMIN)

### Still Pending

1. **Shell pages** — all currently 404:
   - `/buy` — Buy page
   - `/sell` — Sell page
   - `/rent` — Rent/Lease page
   - `/manage` — Property Management page
   - `/join` — Join CnC landing page (links to `/join/agent` form)

2. **IDX resync** — DB is fresh/empty; trigger sync to repopulate 80k properties:
   ```
   curl -X POST http://localhost:3000/api/idx/sync -H "x-cron-secret: 7f3a9c2e8b1d4f6a0e5c7b3d9f2a8e1c4b6d0f3a9c2e8b1d4f6a0e5c7b3d9f2"
   ```

3. **Transaction file detail page** — after creating a transaction, the file detail view needs document checklist UI, tasks, and activity timeline

4. **Listing file detail page** — same as above for listing files

5. **Phase 6 tasks** from `docs/superpowers/plans/2026-05-22-phase-6-launch.md`

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. **Trigger IDX sync** to repopulate properties (DB is empty after Railway reset):
   ```
   curl -X POST http://localhost:3000/api/idx/sync -H "x-cron-secret: 7f3a9c2e8b1d4f6a0e5c7b3d9f2a8e1c4b6d0f3a9c2e8b1d4f6a0e5c7b3d9f2"
   ```

3. **BUILD THESE FIRST — File detail page (SkySlope parity):**
   All 4 items are on the file detail page at `/dashboard/transactions/[fileType]/[id]`

   a. **Overview tab** (~10 min) — add missing fields: propertyType, yearBuilt, escrowNumber, acceptanceDate, inspectionDeadline, appraisalDeadline, loanApprovalDeadline, saleCommissionPct, listingCommissionPct, otherDeductions

   b. **Commission tab** (~15 min) — new tab showing full breakdown: sale commission %, listing commission %, other deductions, net to agent calculation (same logic as wizard Step 5)

   c. **Documents tab** (~15 min) — flat list of all uploaded documents across all checklist items for the file; shows name, checklist item it belongs to, review status, upload date, download link

   d. **Tasks tab** (~45 min) — needs new `Task` DB model + migration + API routes + UI; per-file tasks with title, due date, assignee, complete/incomplete toggle

4. **Build shell pages** for `/buy`, `/sell`, `/rent`, `/manage`, `/join`
5. **Continue Phase 6** tasks

---

## Session Notes — 2026-05-23 (continuation 2)

### What Was Completed This Session

All changes committed as `53c6847` on `claude/real-estate-website-9bdWi`.

### File Detail Page — 3 New Tabs + Overview Fix

**Overview tab updated:**
- Added Key Dates card (transaction only): Offer Date, Acceptance Date, Inspection Deadline, Appraisal Deadline, Loan Approval, Close of Escrow
- Added missing Property Detail fields: Property Type, Year Built, Escrow #
- `TransactionFileDetail` and `ListingFileDetail` types both now include the missing fields + `tasks: FileTaskRecord[]`

**Commission tab (NEW — transaction files only):**
- Shows: Sale Price, Sale Commission %, Sale Commission $, Listing Commission %, Listing Commission $, Other Deductions
- Net-to-agent calculation card: Gross Commission → Deductions → Net to Agent (gold highlight)
- Hidden for listing files

**Documents tab (NEW):**
- Flat table: Document name, Checklist item (or "Unattached"), Review status badge, Upload date, Download ↗

**Tasks tab (NEW):**
- New `FileTask` Prisma model (`20260523161739_add_file_task`) — title, dueDate, assigneeName, done
- API routes: `GET/POST /api/file-tasks`, `PATCH/DELETE /api/file-tasks/[taskId]`
- UI: pending tasks + completed tasks (dimmed/strikethrough), overdue dates in red, optimistic toggle, delete
- Tab badge shows pending count

### Shell Pages Built

All 5 were previously 404:
- `/buy` — hero + How It Works (4 steps) + dark CTA
- `/sell` — hero + Why Sell With CnC (4 items) + dark CTA
- `/rent` — hero + 3 perk cards + dark CTA
- `/manage` — hero + What We Handle (6 items) + dark CTA
- `/join` — full recruitment page: hero, 6 benefits, FAQ, dark CTA linking to `/join/agent`

Note: `/join` is public — middleware only protects `/dashboard`, `/admin`, `/account`.

### Checklist Template System — Confirmed Already Fully Built

The entire checklist template system was already implemented. Ryan just needs to create templates at `/admin/settings/checklists`. The auto-apply logic in both `/api/transactions` POST and `/api/listings` POST is already live.

**Standard CA documents to create (for guidance):**
- **CA Purchase — Buyer Side**: RPA, Agency Disclosure, AVID, Proof of Funds, Loan Pre-Approval, SBSA, TDS, NHD
- **CA Purchase — Seller Side**: Listing Agreement, TDS, SBSA, NHD, Agency Disclosure, Seller's Net Sheet
- **CA Lease — Tenant Side**: Residential Lease Agreement, Agency Disclosure, Move-in Inspection

### IDX Resync — Still Pending

Safe to do (rawData removed). Trigger with dev server running:
```powershell
$token = "7f3a9c2e8b1d4f6a0e5c7b3d9f2a8e1c4b6d0f3a9c2e8b1d4f6a0e5c7b3d9f2"
Invoke-RestMethod -Uri "http://localhost:3000/api/idx/sync?type=full" -Method POST -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 300
```

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. **Trigger IDX resync** (DB still empty after Railway reset) — use command above
3. **Create checklist templates** at `/admin/settings/checklists`:
   - CA Purchase — Buyer Side: RPA, Agency Disclosure, AVID, Proof of Funds, Loan Pre-Approval, SBSA, TDS, NHD
   - CA Purchase — Seller Side: Listing Agreement, TDS, SBSA, NHD, Agency Disclosure
   - CA Lease — Tenant Side: Lease Agreement, Agency Disclosure, Move-in Inspection
4. **Phase 6 tasks** (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`):
   - ISR on property pages (`revalidate: 300`), Redis caching, skeleton loaders
   - JSON-LD structured data (RealEstateListing, Person schemas)
   - Upstash rate limiting on public forms
   - Sentry error monitoring, PostHog/GA4 analytics
   - Deploy to Vercel + Railway production

---

## Session Notes — 2026-05-24

### What Was Completed This Session

All changes committed to `claude/real-estate-website-9bdWi` (7 commits: `4236838`, `d848a2a`, `7a97af9`, `199903b`, `423f79c`, `e92874c`, `677c4ad`). **13 commits are local only — not yet pushed to GitHub.**

### CRMLS Disclaimer — Logo + Timestamp (`4236838`, `d848a2a`)

- CRMLS logo image added: `apps/web/public/images/crmls-logo.png`
- `CrmlsDisclaimer.tsx` updated: logo displayed inline left of disclaimer text, "Last updated: [date]" timestamp shown
- Redundant date sentence removed from disclaimer body text (was duplicating the timestamp)
- File: `apps/web/src/components/properties/CrmlsDisclaimer.tsx`

### Code Review Fixes (`7a97af9`)

Auth, validation, and UX issues found and fixed across the codebase.

### Navbar Dropdown — Solid Black Restored (`199903b`)

Nav dropdown was showing as transparent — restored to solid black background.
File: `apps/web/src/components/layout/Navbar.tsx`

### /join Page — Full Redesign (`423f79c`, `e92874c`, `677c4ad`)

The `/join` page was completely rebuilt. It was previously at `(agents)/join/page.tsx` — moved to `(marketing)/join/page.tsx`.

**New files:**
- `apps/web/src/components/join/StatsBar.tsx` — gold stats bar with scroll-triggered scramble animation
- `apps/web/src/components/join/JoinFaq.tsx` — accordion FAQ component
- `apps/web/public/videos/join-hero.mp4` — landscape clip for hero background

**Page structure (top to bottom):**
1. **Hero** — 95vh full-bleed video background; SVG mask punches "Be / CnC" letterforms out of a near-black overlay so moving clouds show through the text outlines; two buttons at bottom: "Apply" (gold pill → `/join/agent`) + "Message" (ghost pill → `/contact`)
2. **Stats bar** — gold `#9E8C61` background; 4 stats: 100% Commission Kept, $0 Monthly Fees, 24/7 Broker Support, 30+ Resources
3. **Benefits grid** — dark `#111111` bg; 6 numbered benefit cards (2-col/3-col responsive grid with gap-px lines); hover brightens cell + turns title gold
4. **FAQ** — dark `#0f0f0f` bg; 5 Q&As in expandable accordion (`JoinFaq` component)
5. **CTA** — gold `#9E8C61` bg; "Ready to make the move?" headline + "Start Your Application →" white pill button → `/join/agent`

**Stats bar animation (all stats scroll-triggered simultaneously, lock in one at a time):**
- All 4 stats start scrambling together the moment the bar enters view
- Lock-in timing (via staggered `duration` prop): `duration = 700 + i * 600`
  - 100% Commission → locks at 700ms
  - $0 Monthly Fees → locks at 1300ms
  - 24/7 Broker Support → locks at 1900ms
  - 30+ Resources → locks at 2500ms
- Scramble mechanic: `setInterval` at 40ms, last 300ms eases into final value via quadratic `progress²`
- File: `apps/web/src/components/join/StatsBar.tsx`

**Font note (action needed next session):**
- Stats bar number values (`100%`, `$0`, `24/7`, `30+`) currently use `font-sans` (GoogleSansFlex) — same font as the rest of the site
- Ryan confirmed this and said **"we are going to have to change that in the next session"** — the numbers should use a different font (serif or display) to distinguish them visually
- Line: `StatsBar.tsx:67` — `className="font-sans text-3xl font-bold tabular-nums text-white"`

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. **FIRST: Change the stats bar number font** — open `apps/web/src/components/join/StatsBar.tsx` line 67, change `font-sans` to a different font (e.g. `font-display` for Cormorant Garamond serif — test it, or try another). Ryan will decide on the look.
3. **Trigger IDX resync** (DB is empty after Railway reset from the 2026-05-23 session):
   ```powershell
   $token = "7f3a9c2e8b1d4f6a0e5c7b3d9f2a8e1c4b6d0f3a9c2e8b1d4f6a0e5c7b3d9f2"
   Invoke-RestMethod -Uri "http://localhost:3000/api/idx/sync?type=full" -Method POST -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 300
   ```
4. **Create checklist templates** at `/admin/settings/checklists`:
   - CA Purchase — Buyer Side: RPA, Agency Disclosure, AVID, Proof of Funds, Loan Pre-Approval, SBSA, TDS, NHD
   - CA Purchase — Seller Side: Listing Agreement, TDS, SBSA, NHD, Agency Disclosure
   - CA Lease — Tenant Side: Lease Agreement, Agency Disclosure, Move-in Inspection
5. **Phase 6 tasks** (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`):
   - ISR on property pages (`revalidate: 300`), Redis caching, skeleton loaders
   - JSON-LD structured data (RealEstateListing, Person schemas)
   - Upstash rate limiting on public forms
   - Sentry error monitoring, PostHog/GA4 analytics
   - Deploy to Vercel + Railway production

---

## Session Notes — 2026-05-25

### What Was Completed This Session

All changes committed as `a38a0e8`.

1. **IDX resync** — triggered full resync against new Railway DB. DB was empty after 2026-05-23 reset; sync ran during the session and populated 50k+ properties (still running at session end — will continue in background as long as dev server stays up).

2. **StatsBar font** — stat number values (`100%`, `$0`, `24/7`, `30+`) changed from `font-sans` (Google Sans Flex) to `font-chopin` (Inter) for visual distinction. File: `apps/web/src/components/join/StatsBar.tsx:67`

3. **Navbar scroll transparency — /join fix** — `pastHero` was always `true` on the join page because the scroll handler only tracked it for the homepage. Fixed by extending the logic to all `isTransparent` pages. Past-hero on /join now uses `backdrop-blur-md border-b border-white/10` (no color tint — pure frosted glass). File: `apps/web/src/components/layout/Navbar.tsx`

4. **FounderQuote section** — new component between StatsBar and Benefits on /join page. Off-white `#F2F0EF` background. Quote split word-by-word; each word starts as warm grey (`#C4BFB8`) and transitions to near-black (`#1B1B1B`) as it crosses the 58% viewport threshold on scroll. Attribution row: Ryan's headshot (`public/images/ryan-chong.png` — transparent bg PNG) + "Founder / Ryan Chong" label. Files: `apps/web/src/components/join/FounderQuote.tsx`, `apps/web/src/app/(marketing)/join/page.tsx`

5. **Ryan's headshot** — `RV Smooth 3.png` (already had transparent background) copied to `apps/web/public/images/ryan-chong.png`.

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. **Check IDX resync status** — query `http://localhost:3000/api/properties?limit=1` and check `.total`. Target is ~80k. If not done, re-trigger with the PowerShell command in the 2026-05-23 session notes.
3. **Create checklist templates** at `/admin/settings/checklists`:
   - CA Purchase — Buyer Side: RPA, Agency Disclosure, AVID, Proof of Funds, Loan Pre-Approval, SBSA, TDS, NHD
   - CA Purchase — Seller Side: Listing Agreement, TDS, SBSA, NHD, Agency Disclosure
   - CA Lease — Tenant Side: Lease Agreement, Agency Disclosure, Move-in Inspection
4. **Phase 6 tasks** (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`):
   - ISR on property pages (`revalidate: 300`), Redis caching, skeleton loaders
   - JSON-LD structured data (RealEstateListing, Person schemas)
   - Upstash rate limiting on public forms
   - Sentry error monitoring, PostHog/GA4 analytics
   - Deploy to Vercel + Railway production

---

## Session Notes — 2026-05-26

### What Was Completed This Session

All changes committed as `0359d9b`.

### IDX Resync — Confirmed Complete
- Queried `http://localhost:3000/api/properties?limit=1` → **82,143 total properties** ✅
- Sync that was triggered at the end of the 2026-05-25 session finished overnight in the background.

### FounderQuote Section — Full Polish (`apps/web/src/components/join/FounderQuote.tsx`)

**Scroll-driven word reveal:**
- Words animate grey (`#C4BFB8`) → near-black (`#1B1B1B`) as user scrolls past the section
- Progress formula: `(vh - rect.top) / (vh * 1.0)` — starts when section enters viewport, completes within one viewport height of scroll
- Speed multiplier is `1.0` (tuned through session: 0.5 too fast, 1.5 too slow, 1.25 slightly slow, 1.1 close, settled on 1.0)
- No sticky/pinning — section is natural height, scroll effect is purely visual

**Gold "need" words:**
- All 3 instances of the word `"need"` in the quote reveal as gold `#9E8C61` instead of near-black
- Logic: `word === "need" ? "#9E8C61" : "#1B1B1B"` applied per-word when lit

**Layout — float-based (like eXp Realty):**
- Photo (`h-32`, `float-left`, `mr-10`) sits left of quote text on first 2–3 lines, text wraps underneath
- "Founder" label + "Ryan Chong" name stacked below the photo
- Photo src: `/images/ryan-chong.png` (transparent background PNG)
- No circular crop — natural cutout

**Sizing:**
- Section: `bg-cnc-bg px-8 py-16 lg:px-20` (natural height, not full-screen)
- Background: `bg-cnc-bg` (CSS variable `--cnc-bg: #F2F0EF`)

### Sitewide Off-White Background Consistency

Replaced `bg-white` → `bg-cnc-bg` (`#F2F0EF`) on all public-facing section and content-card backgrounds:

| File | Element |
|------|---------|
| `components/agents/AgentProfileHero.tsx` | Agent profile wrapper |
| `app/(agents)/agents/[slug]/page.tsx` | Agent listings section |
| `components/home/FeaturedListings.tsx` | Property listing cards |
| `app/(marketing)/contact/page.tsx` | Success message card |
| `app/(marketing)/rent/page.tsx` | "Why rent with CnC" feature cards |
| `components/properties/MortgageCalculator.tsx` | Calculator card |
| `components/properties/ContactForm.tsx` | Confirmation card |
| `app/(listings)/properties/[mlsNumber]/page.tsx` | Stats/details sections |
| `components/properties/PropertyDrawer.tsx` | Stats/details in drawer |

**Left white intentionally:** Testimonial cards, dashboard UI, inputs, buttons, auth forms, nav dropdowns.

### Design Decisions Made
- Testimonial cards stay white (user reverted after initial change)
- FounderQuote section must NOT take up the full viewport — natural height only
- No sticky scroll for FounderQuote — scroll effect only, no pinning

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. **Create checklist templates** at `/admin/settings/checklists`:
   - CA Purchase — Buyer Side: RPA, Agency Disclosure, AVID, Proof of Funds, Loan Pre-Approval, SBSA, TDS, NHD
   - CA Purchase — Seller Side: Listing Agreement, TDS, SBSA, NHD, Agency Disclosure
   - CA Lease — Tenant Side: Lease Agreement, Agency Disclosure, Move-in Inspection
3. **Phase 6 tasks** (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`):
   - ISR on property pages (`revalidate: 300`), Redis caching, skeleton loaders
   - JSON-LD structured data (RealEstateListing, Person schemas)
   - Upstash rate limiting on public forms
   - Sentry error monitoring, PostHog/GA4 analytics
   - Deploy to Vercel + Railway production

---

## Session Notes — 2026-05-27

### What Was Completed This Session

All changes committed as `23e69c9` on `claude/real-estate-website-9bdWi`.

### Bug Fixes

1. **ChunkLoadError for PropertyMapInner.tsx**
   - Corrupted `.next` webpack cache caused `Cannot find module './PropertyMapInner'` at runtime
   - Fix: deleted `.next` directory and restarted dev server

2. **ContactForm + MortgageCalculator — reverted to `bg-white` cards**
   - Both had been changed to `bg-cnc-bg` (`#F2F0EF`) for consistency, but this made inputs invisible (same color as card background)
   - Reverted: card wrapper → `bg-white`, inputs stay `bg-[#F2F0EF]` for contrast
   - Files: `components/properties/ContactForm.tsx`, `components/properties/MortgageCalculator.tsx`

3. **Property Details all showing N/A**
   - Root cause: expanded RESO fields (architecture, amenities, HOA, etc.) were fetched by the IDX client and mapped but never saved to DB — no schema column existed
   - Fix: added `details Json?` column to Property model (migration `20260526233629_add_property_details_json`)
   - Updated `mapResoToProperty` in `field-map.ts` to populate a `details` JSON blob with 33 RESO fields
   - Updated `PropertyDrawer.tsx` and property detail page to pass `(property.details as Record<string, unknown>) ?? {}` to `buildDetailSections` (was passing empty `{}`)
   - Added `details: Record<string, unknown> | null` to `PropertyDetail` interface in `PropertyDrawer.tsx`
   - Triggered full IDX resync to populate details for all 82,143 properties — running in background, will complete overnight

### /join Page — WhyCnCStacked Section (NEW)

New file: `apps/web/src/components/join/WhyCnCStacked.tsx`

**3 sticky stacking rows:**
1. **Dare to Dream** — cloud-based brokerage / freedom to work anywhere. Photo right (`unsplash` house exterior). Text bg: `#1B1B1B` (dark). Photo bg: `#F2F0EF`.
2. **Tools for Success** — fully-custom CRM with lead tracking + Kanban board FREE. CRM screenshot left (`/images/join-crm.png`). Text bg: `#FFFFFF`. Section bg: `#ECEAE7`.
3. **Beyond the Brand** — community + mentorship. Team high-five photo right (`/images/join-community.jpg`). Text bg: `#1B1B1B`. Section bg: `#1B1B1B`.

**Key decisions:**
- All 3 rows same height: `height: "52vh"` — user explicitly rejected progressive sizing (`calc(52vh - i*88px)` made rows 2 and 3 progressively shorter)
- `<G>` gold span component for inline highlights — `body` typed as `ReactNode` (not `string`)
- Heading "For Agents, By Agents" right-aligned (`text-right`), "Agents" in gold, no "Why CnC" label
- Grey `h-px` divider between FounderQuote and WhyCnCStacked
- Sticky stacking: each row has `position: sticky`, `top: 80 + i * 88px`, `paddingBottom: 100px` on container

### /join Page — HowToJoin Section (NEW)

New file: `apps/web/src/components/join/HowToJoin.tsx`

**Layout modeled after FIND Real Estate (`findrealestate.com/join`):**
- Left column (45% width): sticky heading + "Apply Now →" button
- Right column: step list (numbered 01–04) + photo beside steps
- `gap-24` between columns, `bg-cnc-bg` background

**4 steps:** Apply Online → Schedule a Call → Sign Your Contract → Start Earning

**Heading:** "How to" (2.5rem, font-light, black) / "Join **CnC**" (3.5rem, font-light, black + gold "CnC")
- Title format is "How to" / "Join CnC" on two lines — do NOT change this split
- "CnC" is gold (`text-[#9E8C61]`) and font-light (unbold)
- "to" and "Join" are both plain black

**Button:** "Apply Now →", black pill (`bg-[#1B1B1B]`, `rounded-full`), spring scale hover (`whileHover: { scale: 1.1 }`)

**Photo:** unsplash professional woman photo, `h-[380px] w-full object-cover`, sharp corners (no `rounded-*`)

### StatsBar Updates

- "Commission Kept" → "Commission" (label text shortened)
- "30+" → "20+" for Resources stat
- File: `apps/web/src/components/join/StatsBar.tsx`

### New Images Added

- `apps/web/public/images/join-community.jpg` — team high-five photo (used in WhyCnCStacked row 3)
- `apps/web/public/images/join-crm.png` — CRM dashboard screenshot (used in WhyCnCStacked row 2)
- Note: unused images (fist-bump variation) were NOT saved to public/ — only active images live there

### IDX Resync

- Triggered full resync (fire-and-forget POST → 202) to populate the new `details` field for all 82,143 properties
- Resync was still running at session end — will complete in the background
- No need to re-trigger next session; check `/api/properties?limit=1` to confirm `.total` is still ~82k

### Commit

- `23e69c9` feat: /join page WhyCnCStacked + HowToJoin sections, property details JSON column, drawer polish

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. **Verify property details are now populated** — open any listing in the drawer or detail page, check that Property Details section shows real values (not all N/A). If still N/A, check that the IDX resync completed (the fire-and-forget POST was triggered last session — it should have finished overnight).
3. **Create checklist templates** at `/admin/settings/checklists`:
   - CA Purchase — Buyer Side: RPA, Agency Disclosure, AVID, Proof of Funds, Loan Pre-Approval, SBSA, TDS, NHD
   - CA Purchase — Seller Side: Listing Agreement, TDS, SBSA, NHD, Agency Disclosure
   - CA Lease — Tenant Side: Lease Agreement, Agency Disclosure, Move-in Inspection
4. **AI-assisted transaction coordinator** (`docs/superpowers/plans/2026-05-27-ai-transaction-coordinator.md`):
   - Automated deadline email reminders via SendGrid + Vercel Cron (3-day and 1-day warnings)
   - In-app dashboard deadline alerts banner on agent dashboard
   - Broker supervision view in `/admin` showing all open transactions with upcoming deadlines
5. **Phase 6 tasks** (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`):
   - ISR on property pages (`revalidate: 300`), Redis caching, skeleton loaders
   - JSON-LD structured data (RealEstateListing, Person schemas)
   - Upstash rate limiting on public forms
   - Sentry error monitoring, PostHog/GA4 analytics
   - Deploy to Vercel + Railway production

---

## Session Notes — 2026-05-27 (continuation 2)

### What Was Completed This Session

All changes committed on `claude/real-estate-website-9bdWi` (commits: `16609c9` through `c062150`). **1 commit is local-only — not yet pushed to GitHub.**

### AI Transaction Coordinator — All Tasks Complete ✅

Implemented the full AI-assisted TC plan from `docs/superpowers/plans/2026-05-27-ai-transaction-coordinator.md`.

**Files created/modified:**

| File | What It Does |
|---|---|
| `apps/web/src/app/api/transactions/deadlines/route.ts` | GET endpoint — upcoming deadlines scoped by role (BUYER→403, AGENT→own files, ADMIN→all) |
| `apps/web/src/lib/deadline-email.ts` | `sendDeadlineReminder()` via SendGrid with XSS-safe HTML template |
| `apps/web/src/app/api/cron/deadline-reminders/route.ts` | POST endpoint — daily cron, sends reminders 1 and 3 days out via `Promise.allSettled` |
| `apps/web/src/components/dashboard/DeadlineAlerts.tsx` | Client component — red/amber alert banners on agent dashboard for urgent/upcoming deadlines |
| `apps/web/src/app/(dashboard)/dashboard/page.tsx` | Added `<DeadlineAlerts />` at top of agent dashboard |
| `apps/web/src/app/(dashboard)/admin/page.tsx` | Added broker supervision table — all open transactions with upcoming deadlines across all agents |
| `vercel.json` | Added cron entry: `POST /api/cron/deadline-reminders` at `0 16 * * *` (9am PT) |

**Key bugs found and fixed during code review:**
- **Agent.id vs User.id**: deadlines endpoint was using `session.user.id` as `agentId` — wrong, `TransactionFile.agentId` is FK to `Agent.id` not `User.id`. Fixed by looking up `Agent` record first via `prisma.agent.findUnique({ where: { userId: session.user.id } })`.
- **404 links in DeadlineAlerts**: `href=/dashboard/transactions/${id}` was missing the `[fileType]` segment. Fixed to `/dashboard/transactions/transaction/${id}`.
- **Duplicate React keys**: `key={d.transactionId}` reused when one transaction has multiple deadlines. Fixed to `key={`${d.transactionId}-${d.label}`}`.
- **XSS in email**: `agentName` and `address` interpolated unescaped into HTML. Fixed with `escapeHtml()` helper.
- **No AbortController**: `useEffect` fetch had no cleanup. Fixed with AbortController pattern.
- **Silent admin DB errors**: `.catch(() => [])` swallowed errors. Fixed with `console.error`.
- **Unsorted admin rows**: No orderBy on Prisma query. Fixed with JS sort after flatMap.
- **Same-day deadline gap**: Used `new Date()` (current time) as lower bound. Fixed with `startOfToday` (midnight).

### TC Fee Option — $350 Optional Toggle ✅

Implemented from `docs/superpowers/plans/2026-05-27-tc-fee-option.md`.

**Fee structure decision:** CnC will offer an optional $350 in-house TC service — same price as Rise Realty. Ryan's mom (experienced agent) will be the designated TC once licensed.

**Files modified:**

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | Added `tcFeeEnabled Boolean @default(false)` to `TransactionFile` |
| Migration `20260528020639_add_tc_fee_enabled` | Auto-generated |
| `apps/web/src/app/(dashboard)/dashboard/transactions/new-transaction/page.tsx` | `TC_FEE = 350` constant, `tcFeeEnabled` state, pill toggle in Commission step, `BdRow` in breakdown, `ReviewRow` in review step, passed in submit |
| `apps/web/src/app/api/transactions/route.ts` | `tcFeeEnabled = false` in destructuring, `tcFeeEnabled: !!tcFeeEnabled` in create data |
| `apps/web/src/types/transaction.ts` | Added `tcFeeEnabled: boolean` to `TransactionFileDetail` |
| `apps/web/src/app/(dashboard)/dashboard/transactions/[fileType]/[id]/page.tsx` | `TC_FEE = 350`, `tcFee` in net calculation, conditional `InfoRow` and deduction row in CommissionTab |

**Architecture:** `tcFeeEnabled` stored as boolean — dollar amount ($350) is a constant in code, not the DB. Brokerage-wide fee change = one-line code edit, no migration.

### WhyCnC — AI-Driven Tech Copy Updated

- File: `apps/web/src/components/home/WhyCnC.tsx`
- New copy: "Predictive lead scoring, automated transaction alerts, creative email campaigns, real-time marketing analysis all powered by AI and FREE for CnC Agents. Combined with our custom CRM software, you have all the tools to succeed."

### IDX Sync — Confirmed Complete

- Queried Railway DB: **83,052 total properties** ✅
- DB storage: ~3GB on Railway Hobby plan (5GB volume) — ~2GB headroom for launch
- Listing photos (JSON) are the main storage driver — intentionally kept (important for clients)
- No need to re-trigger sync

### ICA Research — West Shores Realty (Complete)

Read the full West Shores Realty ICA (Ryan's previous brokerage). Key TC section findings:

**Section 4.c — TC clause:**
- TC is **recommended** (optional, not mandatory) on all transactions
- Their in-house TC: Jodi Pestello, fees **$500–$750 per transaction** (variable scope)
- Paid from agent's commission through escrow
- Outside TC requires broker approval + SkySlope access + active real estate license
- If agent can't comply with file checklists, broker can force-assign TC and deduct fee from commission

**West Shores fee structure (for reference when drafting CnC ICA):**
- Broker transaction fee: $900 per transaction
- Monthly: $95/mo (Key Plan) or variable (Desk Plan)
- TC: $500–$750 (optional)
- E&O: $1M coverage, $5K deductible split with agent
- Referral fee: $250 or 10% whichever is greater

**CnC's positioning vs West Shores:** $0/mo, $950 flat broker fee, optional $350 TC (cheaper and simpler than WSR's $500–$750 variable)

### ICA Research — REeBroker + VRG (Blocked — Needs Puppeteer)

- REeBroker's site (`reebroker.com`) returns HTTP 403 on all pages including their ICA and fee schedule
- Virtual Realty Group's ICA is behind DigiSigner authentication — can't read without a browser
- **Puppeteer MCP server** was installed at end of the 2026-05-22 session but requires a Claude Code restart to activate
- Ryan confirmed: closing and reopening Claude Code is safe — all work is saved, git history preserved, CLAUDE.md carries context forward

### Next Session — Start Here

1. **Restart Claude Code** to activate the Puppeteer MCP server (was installed but requires restart)
2. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
3. **Use Puppeteer to open and read:**
   - REeBroker ICA: `https://reebroker.com/ica.aspx?agentname=`
   - Virtual Realty Group ICA: `https://www.thevirtualrealtygroup.com/join-ca` → click "Independent Contractor Agreement" link (goes to DigiSigner)
4. **Draft CnC ICA** — based on West Shores template + competitive positioning:
   - Fee structure: $950 flat broker fee + E&O tiers, $0 monthly, optional $350 CnC TC Service
   - TC section: optional, recommended, paid through escrow, broker can mandate if agent non-compliant
5. **Create checklist templates** at `/admin/settings/checklists`:
   - CA Purchase — Buyer Side: RPA, Agency Disclosure, AVID, Proof of Funds, Loan Pre-Approval, SBSA, TDS, NHD
   - CA Purchase — Seller Side: Listing Agreement, TDS, SBSA, NHD, Agency Disclosure
   - CA Lease — Tenant Side: Lease Agreement, Agency Disclosure, Move-in Inspection
6. **Phase 6 tasks** (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`):
   - ISR on property pages, Redis caching, skeleton loaders
   - JSON-LD structured data, Upstash rate limiting
   - Sentry, PostHog/GA4, deploy to Vercel + Railway production

---

## Session Notes — 2026-05-27 (ICA Research Complete)

### ICA Research — REeBroker (Complete via Puppeteer)

Puppeteer MCP confirmed active after restart. Full REeBroker ICA text extracted.

**Key REeBroker terms:**
- Risk-management fee (E&O equivalent) deducted from commission per Fee Schedule (not shown in ICA)
- Agent can receive commission directly from escrow if file submitted 2+ business days before COE
- Trust funds: must go to escrow/title within 3 business days — agent cannot touch earnest money
- San Diego County jurisdiction
- At-will termination by either party
- Agent responsible for all expenses (no office, supplies, or marketing provided)

### ICA Research — VRG (Complete via Puppeteer / DigiSigner)

VRG ICA accessed via DigiSigner public template link — no authentication required with Puppeteer. All 16 pages read.

**Key VRG terms:**
- **Flat fee plan (CA): $695 per transaction** + bump-up fees: over $1M add $599, over $1.5M add $699, over $2M add $1,500
- Park Your License plan: 85%-15% split (VRG keeps 15%)
- Brand New Agent plan: 75%-25% split (VRG keeps 25%), must close 4 deals before switching
- Unlimited plan: $899/month for unlimited residential deals
- Plan change fee: $200 (waived for brand new agents until after 4 sales)
- E&O: Covered under VRG broker policy ($1M per claim / $1M aggregate). Agent pays deductible only. No separate per-transaction E&O charge.
- Referral bonus: $100 per closed deal by recruited agent
- TC system compliance: $500 fee if agent closes without first entering transaction in VRG's system
- Referrals/leases/rentals: 10% to VRG
- Commercial: 90%-10% split or $1,000 min
- No monthly fee on Flat Fee or Park Your License plans
- Jurisdiction: laws of the state where licensee is licensed

### CnC ICA Draft — Complete

Drafted full CnC ICA at `docs/cnc-ica-draft.md`. Structure modeled on REeBroker + VRG, with CnC's own fee structure:
- $950 flat fee ($0–$999,999) with E&O included in fee
- E&O tiers for higher-priced transactions (up to $2,550 for $4M+)
- $0 monthly fee
- Optional $350 CnC TC Service (recommended, paid through escrow; broker can mandate if non-compliant)
- $500 non-compliance fee for closing without creating TC record
- 100% commission to agent after flat fee
- CA jurisdiction

**⚠️ Needs attorney review before use as a binding legal document.**

### Next Session — Start Here

1. **Fix sell page stacked cards animation** (`apps/web/src/components/sell/SellStackedCards.tsx`):
   - Cards should fill most of the viewport (like Vorszk) — the current card is fully visible before the next one comes up from below
   - Next card slides up from below the current card's bottom edge, covering it as current card scales to 0.9 and fades
   - Reference: https://www.vorszk.com — their "expertises" section (Mining, Real Estate, etc.)
   - Current issue: card sizing/timing still off — needs a fresh look in next session
2. **Review CnC ICA draft** (`docs/cnc-ica-draft.md`) — Ryan to review, note any changes or additions before attorney review
3. **Create checklist templates** at `/admin/settings/checklists`:
   - CA Purchase — Buyer Side: RPA, Agency Disclosure, AVID, Proof of Funds, Loan Pre-Approval, SBSA, TDS, NHD
   - CA Purchase — Seller Side: Listing Agreement, TDS, SBSA, NHD, Agency Disclosure
   - CA Lease — Tenant Side: Lease Agreement, Agency Disclosure, Move-in Inspection
3. **Phase 6 tasks** (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`):
   - ISR on property pages, Redis caching, skeleton loaders
   - JSON-LD structured data, Upstash rate limiting
   - Sentry, PostHog/GA4, deploy to Vercel + Railway production
4. **Post-Phase 6 CRM gaps** (SkySlope parity — build after launch):
   - **Pre-contract file stage** — allow agents to start a transaction file before going under contract (stage selector in wizard step 1)
   - **Task templates** — brokerage-wide reusable task lists that auto-apply to new files (similar to checklist templates but for tasks/reminders)
   - **CDA generator** — auto-generate a Commission Disbursement Authorization PDF from transaction data (agent name, address, commission amounts, broker signature block)
   - **Cancellation approval workflow** — route cancelled files through broker approval instead of direct status change (submit cancellation → broker approves/rejects with note)
   - **Document bundles** — "Send to Escrow" button that emails all approved docs in a transaction as a zip or bundle to a specified email (title/escrow officer)
   - **Audit trail** — immutable system-generated event log per file (who uploaded, who approved, when status changed, who added a party) — separate from agent notes; required for DRE supervision
   - **Excel/CSV reports** — broker-level reports: agent production (closed volume, GCI, transaction count), commission summary by period, open pipeline by agent

---

## Session Notes — 2026-05-28

### What Was Completed This Session

All changes committed on `claude/real-estate-website-9bdWi` (commits `0e47f67`, `5a3259a`).

---

### SkySlope vs. CnC CRM — Full Audit (Complete)

Ran Puppeteer through all 85+ SkySlope KB articles and produced a full feature-by-feature comparison. Key findings:

**CnC has parity on all core compliance workflows:**
- Transaction File + Listing File wizards (6-step)
- Convert Listing → Transaction
- Dual agency: 2 transaction records required (per ICA), fee charged twice
- Document checklists: admin templates, auto-apply, agent upload, broker approve/reject with note
- Broker review queue (`/api/admin/audit-queue`)
- File status lifecycle management
- Deadline tracking + automated email reminders (3-day, 1-day via Vercel Cron + SendGrid)
- In-app deadline alert banners + broker supervision view in `/admin`
- Per-file tasks (`/api/file-tasks`)
- Commission tracking, net-to-agent calc, TC fee toggle
- Parties management
- File notes + lead activity log
- MLS integration (83k CRMLS properties)

**CnC has features SkySlope does NOT have:**
- Email campaigns (Tiptap editor, drip sequences, SendGrid webhooks)
- Lead pipeline Kanban board
- Property search (IDX)
- Property alerts for saved searches

**Intentionally excluded (not gaps):** DigiSign, SkySlope Forms, Breeze AI, SkySight AI, PDF Split & Assign, email-to-file inbox forwarding, NHD/home warranty integrations.

**Post-Phase 6 gaps to build (noted in CLAUDE.md):**
Pre-contract file stage, task templates, CDA generator PDF, cancellation approval workflow, document bundles (Send to Escrow), immutable audit trail, Excel/CSV broker reports.

---

### Join Page — HowToJoin Steps (Complete ✅)

**File:** `apps/web/src/components/join/HowToJoin.tsx`

Updated all four steps with new copy:
| # | Title | Body |
|---|---|---|
| 01 | Apply | Fill out an application and review the Independent Contractor Agreement |
| 02 | Approval | Get your guaranteed approval to join the team within 24 hours |
| 03 | Onboarding | A team member will welcome and prep you for your new journey |
| 04 | Win | Hit the ground running with full access to all our tools and network |

---

### Join Page — House Photo (Complete ✅)

**File:** `apps/web/public/images/join-house.jpg`

Replaced the old join-house.jpg with a white Victorian-style house photo (from `pexels-josh-hild-1270765-17145685.jpg`). No code change needed — component already referenced `/images/join-house.jpg`.

---

### Sell Page — Stacked Cards Animation (WIP ⚠️)

**Files:**
- `apps/web/src/components/sell/SellStackedCards.tsx` — new component
- `apps/web/src/app/(marketing)/sell/page.tsx` — replaced WHY grid with `<SellStackedCards />`

**Goal:** Vorszk-inspired scroll-driven stacked cards (https://www.vorszk.com — their "expertises" section with Mining, Real Estate, etc.)

**Vorszk's mechanism (researched via Puppeteer + fetching JS chunks):**
- All cards: `position: sticky; top: [same value]` — they all stick at the same viewport y
- Cards are in a flat container with `margin-top: -[totalHeight - oneCardHeight]` — this pulls all cards close together in the DOM so the scroll distance between cards is very short (~73px in Vorszk)
- As you scroll past a card, GSAP ScrollTrigger drives: `scale(0.9)` from `transformOrigin: "50% 100%"`, inner opacity → 0.1
- The NEXT card slides up from below the current card's bottom edge and covers it
- Card height: `clamp(450px, 162px + 37.5vw, 882px)` — fills most of the viewport

**What's been tried (all 3 iterations):**
1. Per-card wrappers (680px tall) + cards with incremental `top` values → wrappers too tall, cards never overlap, incremental top made later cards lower on screen (wrong)
2. Flat container, same `top: 88px`, negative `marginBottom`, section-level `scrollYProgress` → fade started too early (at section enter) before next card arrived; negative margins caused card 1 to overlap card 0 mid-viewport instead of from below
3. Per-card wrappers where `wrapper height = card height = calc(100vh - 88px)` → correct theory (next card sits at viewport bottom when wrapper starts), but visual result still not matching Vorszk

**The correct theory (confirmed):** wrapper height = card height = `100vh - STICKY_TOP`. At `progress=0` (wrapper top = viewport top), next card's top is at the viewport bottom — it peeks. As `progress` goes 0→1, next card rises from viewport bottom to `STICKY_TOP`, covering current card. Current card scales 1→0.9 and fades 1→0.1.

**Current issue:** Despite correct theory, visual result is still off — card sizing/timing doesn't match Vorszk. Needs debugging in next session. Ryan confirmed the fade direction is correct but cards aren't showing fully before next one appears.

**Approach for next session:**
- Re-examine with Puppeteer on Vorszk to get exact card height, sticky top, and scroll distance values at the current viewport
- May need to re-examine `useScroll` offset values or add a spacer at the top of the section to give the first card "dwell time" before the next starts rising

---

## Session Notes — 2026-05-28 (Part 2)

### Sell Page — Stacked Cards REMOVED

- Deleted `apps/web/src/components/sell/SellStackedCards.tsx` entirely — could not get the stacking/overlap animation to match Vorszk correctly after multiple iterations
- Removed import and usage from `apps/web/src/app/(marketing)/sell/page.tsx`
- Sell page now goes straight from hero to the valuation CTA section

### JoinCnCCTA — Mersi-style Expanding Image (Complete ✅)

**File:** `apps/web/src/components/home/JoinCnCCTA.tsx`

Rebuilt to match the image-expansion effect from `mersi-architecture.com/agence`:

**Mechanism:**
- Section: `200vh` tall (scroll space), `bg-[#F2F0EF]`
- Sticky inner: `65vh`, `top: calc((100vh - 65vh) / 2)` — centered in the viewport at all times
- `useScroll` offset: `["start start", "end end"]` — progress 0 when section top hits viewport top (sticky locks in)
- Image: `position: absolute, top: 50%, left: 50%, translate(-50%, -50%)` — always centered in sticky area

**Animation sequence:**
1. Section scrolls into view from below naturally (no animation yet)
2. Section top hits viewport top → sticky locks in, small image (52% × 42vh) is visible centered
3. User scrolls → image expands from 52%×42vh → 100%×65vh (fills section) over progress [0.1, 0.88]
4. "Be the agent you're meant to be." sits at `bottom: 1.5rem` inside sticky, `text-[2rem] lg:text-[2.5rem] font-light text-[#1B1B1B]` — matches section heading style
5. Heading fades out progress [0.65, 0.85]
6. "Be CnC." + "Join Now →" button fade IN on the image at progress [0.85, 0.95] — only appears after heading is fully gone
7. Section ends → footer appears with no gap

**Puppeteer note:** Puppeteer should only be used for external websites Ryan sends, NOT for screenshotting localhost.

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. Review JoinCnCCTA expanding image animation on homepage — approved or needs tweaks
4. Continue with remaining work:
   - CnC ICA draft review (`docs/cnc-ica-draft.md`)
   - Checklist templates at `/admin/settings/checklists`
   - Phase 6 tasks (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`)

---

## Session Notes — 2026-05-28 (Part 3)

### What Was Completed This Session

All changes committed on `claude/real-estate-website-9bdWi` (commit `c2d8a60`).

Dev server ran on **localhost:3001** this session (port 3000 was already in use).

---

### JoinCnCCTA — Full Polish (Complete ✅)

**File:** `apps/web/src/components/home/JoinCnCCTA.tsx`

Complete redesign of the CTA section. Final state:

**Layout:**
- Section: `200vh` tall, `bg-[#F2F0EF]`
- Sticky container: `top: calc(100vh - 65vh)` (= 35vh) — anchored so image bottom is flush with viewport bottom when fully expanded. This eliminates the off-white gap between the expanded image and the footer.
- Small image: `52% × 42vh`, centered in sticky area
- Fully expanded image: `100% × 65vh`, fills sticky container

**"Be the agent you're meant to be" heading:**
- Positioned at `top: 1.5rem` within sticky container (ABOVE the image, not below)
- Two-layer approach (matches RevealText behavior exactly):
  - **Dim base layer** (`aria-hidden`): always visible in gray `rgba(27,27,27,0.18)` + dim gold `rgba(158,140,97,0.18)` — the "gray" state
  - **Bright overlay**: same text in full `#1B1B1B` / `#9E8C61`, CSS mask sweeps left-to-right in 1.2s — exactly matching FAQ RevealText speed/easing
- Outer `motion.div` wrapper: fade-up (opacity 0→1, y 24→0, 0.8s easeOut) matching FAQ heading animation
- "meant" reveals in gold `#9E8C61` matching the ServicesSection accent color
- No trailing period

**"Be CnC" + "Join Now" button:**
- Appear inside image at scroll progress [0.85, 0.95] via `overlayOpacity`
- "Be CnC": `text-white` — solid white (removed `opacity-60`)
- "Join Now": `bg-white` pill, `text-cnc-dark` — solid white button
- No trailing period on "Be CnC", no arrow on "Join Now"

**Key decisions made:**
- `overflow: hidden` removed from sticky container — it was blocking IntersectionObserver, preventing RevealText from firing
- Heading moved from `bottom: 1.5rem` to `top: 1.5rem` so it sits above the image and gets covered as image expands downward
- `headingOpacity` scroll animation removed entirely — heading is always visible until physically covered by expanding image
- Three separate RevealText instances rejected — each sweeps independently within its own bounds, not one unified sweep
- CSS mask on container chosen over RevealText for the heading because it allows mixed colors (dark + gold) in one unified left-to-right sweep

**RevealText component updates:**
- Added `color?: string` prop for custom reveal colors
- `EASE_OUT_EXPO` from `motion.ts` now used in `transitionTimingFunction` (was hardcoded string)

**Code cleanup (simplify skill):**
- Removed local `EASING` constant — now uses shared `EASE_OUT_EXPO` from `motion.ts`
- `motion.ts` `fadeUp` uses `EASE_OUT_EXPO as [number, number, number, number]` (cast needed for Framer Motion type compatibility — `readonly` tuple not assignable to mutable tuple)
- Pre-existing TypeScript errors in `Testimonials.tsx`, `Navbar.tsx`, and test files are NOT from these changes

**Testimonials:**
- Periods removed from `WORDS` cycling array: `["trust", "results", "futures", "homes", "teams"]`

**Superpowers discipline note:** Skills must be invoked BEFORE every action — not just when the user asks. The correct flow is: task arrives → invoke relevant skill → then act.

---

### Section Status

| Section | Status |
|---|---|
| Hero | ✅ Approved |
| Exclusive Listings | ✅ Approved |
| Why CnC | ✅ Approved |
| Services | ✅ Approved |
| Testimonials | ✅ Approved |
| Join CnC CTA | 🔄 Built and polished — needs final review next session |
| FAQ | ✅ Approved |
| Footer | ✅ Approved |

Nothing new committed beyond `c2d8a60` this session.

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000` (or `localhost:3001` if 3000 is occupied)
3. **Review JoinCnCCTA** — confirm:
   - "Be the agent you're meant to be" heading: gray first → left-to-right reveal → black/gold, fade-up on enter
   - Image expands to fill viewport bottom with no gap before footer
   - "Be CnC" solid white, "Join Now" solid white button
4. Once approved → move to remaining work:
   - CnC ICA draft review (`docs/cnc-ica-draft.md`)
   - Checklist templates at `/admin/settings/checklists`
   - Phase 6 tasks (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`)

---

## Session Notes — 2026-05-29

### What Was Completed This Session

All changes committed on `claude/real-estate-website-9bdWi` (commits `c2d8a60` through `c9d5ebf`).

Dev server ran on **localhost:3001** this session.

---

### JoinCnCCTA Homepage Section — Final State ✅

**File:** `apps/web/src/components/home/JoinCnCCTA.tsx`

- Two-layer heading reveal: dim base layer (gray) always visible, bright overlay masked left-to-right in 1.2s
- "meant" reveals in gold `#9E8C61` as one unified sweep using CSS mask on container
- Outer `motion.div`: fade-up matching FAQ heading animation
- "Be CnC" solid white (removed `opacity-60`), "Join Now" solid white button (no arrow)
- Sticky container at `top: calc(100vh - 65vh)` — image bottom flush with viewport, no gap before footer
- EASE_OUT_EXPO shared constant used across `motion.ts`, `reveal-text.tsx`, `JoinCnCCTA.tsx`

---

### JoinStepsSlider — New Section on Join Page ✅

**File:** `apps/web/src/components/join/JoinStepsSlider.tsx`
**Placed:** Between `<HowToJoin />` and FAQ on `apps/web/src/app/(marketing)/join/page.tsx`

**Layout:**
- Section: `300vh` tall, `bg-white`, sticky panel inset `1.5rem` from sides/bottom, `top: 5.5rem` (below navbar)
- **Left panel** (text): `bg-[#DAD4D2]`, `width: 35%`, `order-1` — progress bars at top, body text vertically centered (`flex-1 items-center`)
- **Right panel** (images): `flex-1`, `order-2`, `-ml-6` (overlaps left panel slightly), `object-contain` images
- `gap-3` between panels (white bg shows through)

**3 slides:**
| Slide | Image | Body |
|---|---|---|
| 1 | `/images/join-slide-crm.png` | Custom CRM — AI-powered lead/transaction/campaign management |
| 2 | `/images/join-slide-agent.png` | Agent Profile — live profile page on cncrealtygroup.com |
| 3 | `/images/join-slide-campaign.png` | Email Campaigns — branded drip sequences, no third-party tools |

**Mechanics:**
- `useScroll` + `useMotionValueEvent` → `activeStep` (0–2), `barWidths` (3 values)
- 3 progress bars at top of left panel: each fills top-to-bottom per scroll range (0–⅓, ⅓–⅔, ⅔–1)
- `AnimatePresence mode="wait"` on image crossfade and body text
- No numbers, no titles, no buttons in slides

**Design decisions:**
- Panels swapped (text left, images right) after initial build
- `object-contain` chosen over `object-cover` to avoid cropping dashboard screenshots
- Images replaced multiple times as Ryan cropped better versions

---

### WhyCnC Homepage — Progress Bar Updated ✅

**File:** `apps/web/src/components/home/WhyCnC.tsx`

Replaced the single vertical pill (`3px wide, 220px tall, grows top-to-bottom`) with a **4-segment vertical bar**:
- `2px` wide × `220px` tall container, `flex-col gap-1`
- 4 equal `flex-1` segments, each fills top-to-bottom via `height %` as its panel scrolls through
- Same position: `absolute left-14 top-1/2 -translate-y-1/2`
- Matches the segmented style of JoinStepsSlider's progress bars for visual consistency

---

### FAQ Homepage — Gold "s" ✅

**File:** `apps/web/src/components/home/FAQ.tsx`

- The lowercase "s" in "FAQs" heading is now gold `#9E8C61` via `<span style={{ color: "#9E8C61" }}>s</span>` inside `RevealText`

---

### Agent Profile Page — Dark Navbar ✅

**File:** `apps/web/src/components/layout/Navbar.tsx`

- Added `!pathname.startsWith("/agents/")` to the `isTransparent` exclusion list
- All agent profile pages (`/agents/[slug]`) now show the solid `bg-[#0f0f0f]` dark navbar

---

### Section Status

| Section / Page | Status |
|---|---|
| Homepage — Hero | ✅ Approved |
| Homepage — Exclusive Listings | ✅ Approved |
| Homepage — Why CnC | ✅ Approved (new segmented progress bar) |
| Homepage — Services | ✅ Approved |
| Homepage — Testimonials | ✅ Approved |
| Homepage — Join CnC CTA | ✅ Approved |
| Homepage — FAQ | ✅ Approved (gold "s") |
| Homepage — Footer | ✅ Approved |
| Join Page — JoinStepsSlider | 🔄 Built and iterated — needs final review next session |
| Agent Profile Page | ✅ Dark navbar fixed |

---

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000` (or 3001 if occupied)
3. **Review JoinStepsSlider** on `/join` — confirm final look (text left/images right, overlap, progress bars, body text centered)
4. **Review JoinCnCCTA** on homepage — confirm heading reveal, footer gap, solid white text
5. Continue with remaining work:
   - CnC ICA draft review (`docs/cnc-ica-draft.md`)
   - Checklist templates at `/admin/settings/checklists`
   - Phase 6 tasks (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`)

---

## Session Notes — 2026-05-30

### What Was Completed This Session

All changes committed as `66d6891` on `claude/real-estate-website-9bdWi`. Branch is now 10 commits ahead of origin (not yet pushed).

---

### WhyCnCStacked — Rebuilt with Framer-Motion Scroll-Driven Stacking

**File:** `apps/web/src/components/join/WhyCnCStacked.tsx`

The previous implementation used simple CSS `position: sticky` with `paddingBottom: 100px` — cards just sat at their stacked positions with no entrance animation. Rebuilt to use a proper scroll-driven stacking animation:

- **200vh scroll driver** with `useScroll` + `useTransform` to drive card entrance
- Card 1 fixed at `top: BASE (80px)`, height `52vh`
- Card 2 slides up from `slideDistance` below → 0 over scroll progress [0, 0.5]
- Card 3 follows card 2's bottom in phase 1, then stacks over card 2 in phase 2 [0, 0.5, 1.0]
- `slideDistance = cardH - OFFSET = (vh * 0.52) - 88` (card bottom aligns with next card's initial top)
- Heading ("For Agents, / By Agents") now uses `RevealLine` component
- All 3 cards get `rounded-2xl`
- Added `marginBottom: "-110px"` on section to close gap to HowToJoin (see below)

---

### RevealLine — New Component in reveal-text.tsx

**File:** `apps/web/src/components/ui/reveal-text.tsx`

New `RevealLine` component for headings that contain mixed colors (dark text + gold `<span>`). Uses `clipPath inset()` animation instead of a mask — more reliable across browsers. Pattern:
- Dim base layer (`opacity: 0.18`, `aria-hidden`) always visible — sets layout dimensions
- Bright overlay with `clipPath: inset(-10% 100% -10% -5%)` → `inset(-10% 0% -10% -5%)` on scroll enter
- Negative inset values extend clip region past border box to capture ascenders/descenders
- `once: true` + `margin: "-8%"` for scroll trigger

Now used in: `WhyCnCStacked` heading, `HowToJoin` heading.

---

### HowToJoin — Gap Fix + Heading Polish

**File:** `apps/web/src/components/join/HowToJoin.tsx`

- Top padding changed: `py-28` → `pt-6 pb-28` (reduces top padding from 112px to 24px)
- Heading now uses `RevealText` / `RevealLine` (was plain static text)

**Gap fix decisions (important for future sessions):**
- The gap between card 3 and HowToJoin had two sources: (1) ~136px empty off-white space below card 3 inside the sticky container, and (2) HowToJoin's top padding
- First attempt: reduce `py-28` → `pt-14` — user didn't notice the difference
- Second attempt: increased card heights from `52vh` to `calc(100vh - 280px)` to fill the sticky container + reduced padding to `pt-6` — gap looked good
- **Ryan's feedback:** "why did you make the cards taller? I didn't tell you to change the size of the cards" — revert card height, only fix what was asked
- **Final solution:** Reverted cards to `52vh`, added `marginBottom: "-110px"` on `WhyCnCStacked` section, kept `pt-6` on HowToJoin. Net visual gap ≈ 50px.
- **Rule established:** Do not change component dimensions/sizes as a side-effect of a spacing fix. Use negative margins or padding to close gaps instead.

---

### Other Polish (same commit)

- **WhyCnC.tsx** — Added `rounded-2xl` to back media container and front image overlay
- **JoinCnCCTA.tsx** — Added `borderRadius: "1rem"` to the expanding image container
- **JoinStepsSlider.tsx** — Minor polish
- **ServicesSection.tsx** — Minor polish
- **Footer.tsx** — Minor polish
- **Marketing pages** (buy, contact, join, manage, rent, sell) — Minor copy/layout polish

---

### Section Status

| Section / Page | Status |
|---|---|
| Homepage — Hero | ✅ Approved |
| Homepage — Exclusive Listings | ✅ Approved |
| Homepage — Why CnC | ✅ Approved (rounded-2xl on media) |
| Homepage — Services | ✅ Approved |
| Homepage — Testimonials | ✅ Approved |
| Homepage — Join CnC CTA | ✅ Approved (borderRadius on expanding image) |
| Homepage — FAQ | ✅ Approved |
| Homepage — Footer | ✅ Approved |
| Join Page — StatsBar | ✅ Approved |
| Join Page — FounderQuote | ✅ Approved |
| Join Page — WhyCnCStacked | ✅ Approved (scroll-driven stacking, gap fixed) |
| Join Page — HowToJoin | ✅ Approved (gap fixed, RevealLine heading) |
| Join Page — JoinStepsSlider | 🔄 Needs final review next session |
| Join Page — FAQ | ✅ Approved |
| Join Page — CTA | ✅ Approved |

---

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000` (or 3001 if occupied)
3. **Review JoinStepsSlider** on `/join` — confirm final look (text left / images right, progress bars, body text)
4. **Push branch** to GitHub (10 commits are local-only): `git push`
5. Continue with remaining work:
   - CnC ICA draft review (`docs/cnc-ica-draft.md`)
   - Checklist templates at `/admin/settings/checklists`
   - Phase 6 tasks (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`)

---

## Session Notes — 2026-05-31

### What Was Completed This Session

All changes are uncommitted (dev server was running, no git commit made this session).

---

### CTALineArt — Scroll Effect Fixed ✅

**File:** `apps/web/src/components/join/CTALineArt.tsx` (untracked — new file, not yet committed)

**Root cause of broken scroll effect:** SVG was `w-[40%]` which rendered at 638px tall, but the CTA section is only 431px tall. The SVG overflowed 103px above and 104px below the section, clipping the roof and bottom of walls via `overflow-hidden`. At that size, `strokeWidth="1"` also rendered sub-pixel (0.71px), making lines nearly invisible against `#F2F0EF`.

**Fixes applied:**
- `w-[40%]` → `w-[25%]` — SVG now 356×399px, fits within 431px section
- `right-[-4%]` → `right-[2%]` — no longer bleeds past right edge
- `strokeWidth="1"` → `strokeWidth="1.5"` — compensates for smaller size
- `opacity: 0.14` → `opacity: 0.22` — visible against off-white bg
- Roof diagonal `len: 269` → `len: 277` — corrected actual path length
- Parallax values `50/25/12` → `80/40/20` SVG units — preserves same screen-pixel travel at smaller size

**Both effects confirmed working:**
- **Draw animation:** lines draw staggered (0.08s between each of 14 paths, 1.4s each) when section enters viewport (`useInView` + CSS `stroke-dashoffset` transitions)
- **Parallax scroll:** roof moves at 2× walls, walls at 2× details (scroll listener + `setAttribute` on SVG `<g>` groups)

**Still needs:** final visual review on `/join` — Ryan hasn't seen it in its fixed state yet.

---

### Property Search — Three Bug Fixes ✅

#### 1. Status filter corrected

**Files:** `apps/web/src/app/api/properties/route.ts`, `apps/web/src/app/(listings)/properties/page.tsx`

Old filter: `["Active", "Coming Soon"]` — wrong on two counts.
New filter: `["Active", "ComingSoon", "ActiveUnderContract"]`

- `"Coming Soon"` → `"ComingSoon"` — the space variant never existed in DB (1,095 listings were invisible)
- Added `"ActiveUnderContract"` — 8,610 listings were invisible
- Removed `"Active Under Contract"` (spaced) — doesn't exist in DB at all

**Confirmed via DB query:** only statuses in the DB are `Active`, `Pending`, `ActiveUnderContract`, `ComingSoon`, `Closed`.

#### 2. Address search added

**Files:** `route.ts`, `properties/page.tsx`, `apps/web/src/hooks/useProperties.ts`

Old behavior: query sent as `city=` OR `zip=` (client-side detection), only matched city field.
New behavior: query sent as `query=`, API handles detection:
- 5-digit → exact zip match
- anything else → `OR [city contains, address contains]` (case-insensitive)

Tested with TDD — test file: `apps/web/src/__tests__/api/properties-search.test.ts` (7 tests, all pass).

#### 3. Status badge display

**File:** `apps/web/src/types/property.ts` — added `formatPropertyStatus()` function:
- `"ComingSoon"` → `"Coming Soon"`
- `"ActiveUnderContract"` → `"Under Contract"`

Used in: `PropertyCard.tsx`, `PropertyDrawer.tsx`, `properties/[mlsNumber]/page.tsx`

---

### Property Search — Type Filter Fixed ✅

**Files:** `apps/web/src/components/properties/FilterBar.tsx`, `route.ts`, `properties/page.tsx`

Old TYPE_OPTIONS values didn't match DB strings — `"Residential"` and `"Multi-Family"` matched nothing.

| Label | Old value (broken) | New value | DB types matched |
|---|---|---|---|
| Single Family | `"Residential"` | `"SingleFamilyResidence"` | SingleFamilyResidence (48,544) |
| Condo | `"Condominium"` | unchanged | Condominium (17,528) |
| Townhouse | `"Townhouse"` | unchanged | Townhouse (4,320) |
| Multi-Family | `"Multi-Family"` | `"MultiFamily"` + OR | Duplex, Triplex, Quadruplex, MultiFamily, Apartment, ResidentialIncome (~8,300 combined) |
| Land | `"Land"` | unchanged | Land + UnimprovedLand (17,859) |

Multi-Family uses `{ in: [...] }` in the API instead of `contains` to cover all multi-unit sub-types.

---

### Deferred — Commercial Listings

DB has ~6,000+ active commercial listings (CommercialSale, Office, Retail, Industrial, Warehouse, etc.) mixed into search results. Ryan wants to filter these out eventually but deferred to a later session. Note for when we do this: add a blocklist at the API/SSR level — no UI changes needed.

---

### Section Status

| Section / Page | Status |
|---|---|
| Homepage — All sections | ✅ Approved |
| Join Page — StatsBar | ✅ Approved |
| Join Page — FounderQuote | ✅ Approved |
| Join Page — WhyCnCStacked | ✅ Approved |
| Join Page — HowToJoin | ✅ Approved |
| Join Page — JoinStepsSlider | 🔄 Needs final review |
| Join Page — FAQ | ✅ Approved |
| Join Page — CTA (text + buttons) | ✅ Approved |
| Join Page — CTALineArt (house SVG) | 🔄 Fixed this session, needs first visual review |
| Property Search | ✅ Fixes applied (status, address, type filter) |

---

### Session Notes — 2026-05-31

#### Join Page — Complete ✅
- **CTALineArt** rebuilt from scratch: isometric 3D house, scroll-linked draw via Framer Motion `useScroll` + `useTransform` → `pathLength` on each `motion.path`. No CSS transitions — raw scroll follower. Front face (roof gable, walls, window, door) draws first, then left roof slope, then side face bleeds off-screen right.
- **CTA copy**: "Ready to make the move?" → "Your Journey Begins Here" (gold "Here" via `RevealLine`), subtext → "Be CnC", button "Apply" → "Join", removed "Together, we are CnC."
- **JoinStepsSlider** | ✅ Approved (text left / images right, progress bars, body text centered)

----

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000` (or 3001 if occupied)
3. Continue with remaining work:
   - CnC ICA draft review (`docs/cnc-ica-draft.md`)
   - Checklist templates at `/admin/settings/checklists`
   - Phase 6 tasks (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`)

---

## Session Notes — 2026-06-01

### What Was Completed This Session

All changes committed as `c3a15f6` on `claude/real-estate-website-9bdWi`.

### Sell Page — Our Process Section (`SellProcess.tsx`)

**Root cause investigation (via Puppeteer on fluid.glass/approach):**

Used Puppeteer to inspect Fluid's actual HTML/CSS instead of guessing. Key findings:
- Fluid's `.scroll` is `display: inline-flex` — all panels side by side
- Panels are **NOT 100vw** — intro: 55vw, photos: 93.8vw, text slides: 91.9vw
- This is what creates the "photo appears on the right side" split — adjacent panels always peek into the viewport
- The `objectPosition` approach was wrong — the effect is purely architectural (panel widths)

**Panel widths implemented (matching Fluid):**

| Panel | Width |
|---|---|
| Intro | 55vw |
| Full-bleed photo | 93vw |
| Slide (overlapping photos) | 46vw |
| Step text | 40vw |

- `TOTAL_VW` and `TRAVEL_VW` calculated dynamically from panel counts
- Section height stays 900vh

**Process slide panel (step 01 only):**
- Inserted between Photo 01 (sell-10.jpg) and Valuation text
- Two overlapping photos: `sell-slide-top.jpg` (Spanish house w/ palms) and `sell-slide-bottom.jpg` (person on couch)
- Exact Fluid dimensions (converted from px to vw):
  - Top photo: `18.8vw × 23.3vw`, `transform: translateX(20%)`
  - Bottom photo: `14.8vw × 18.4vw`, `position: absolute`, `left: 16.1vw`, `top: 16.3vw`, `z-index: 1`
- Both photos have `rounded-2xl` corners

**Other polish decisions:**
- `sell-08.jpg` (Listing photo): `objectPosition: left center` — buildings are on the left of the image, anchor them so they show first as the panel scrolls in
- Ghost step number watermark (faint `01`/`02` etc.) — **removed** from all text panels
- Dash line next to step number — **removed** from all text panels
- `TEXT_VW` tuned from 92 → 65 → 52 → 40 based on user feedback ("tighter, tighter, tighter")
- `SLIDE_VW` tuned from 92 → 55 → 46

**Key architectural rule (do NOT regress):**
> Fluid's split effect comes ENTIRELY from panel widths being smaller than 100vw. Never set panels back to `w-screen`. The `objectPosition` and `leftGap` approaches were both wrong — panel width is the only correct approach.

**Superpowers discipline reinforced:**
- Always use Puppeteer to inspect reference sites before guessing at implementation
- Always invoke the relevant skill before taking action
- The systematic-debugging skill was used to find the root cause before writing any fix code

### Section Status

| Section | Status |
|---|---|
| Sell Page — Hero | ✅ Approved (from prior session) |
| Sell Page — Our Process | 🔄 Built this session, needs Ryan's full review next session |

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000/sell`
3. **Review Our Process section** — scroll through all 4 steps, check photo/slide/text transitions
4. Continue with remaining work if Process approved:
   - CnC ICA draft review (`docs/cnc-ica-draft.md`)
   - Checklist templates at `/admin/settings/checklists`
   - Phase 6 tasks (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`)

---

## Session Notes — 2026-06-02

### What Was Completed This Session

All changes committed and pushed to `claude/real-estate-website-9bdWi`.

---

### Sell Page — Our Process ✅ Approved

No changes needed — Ryan reviewed and approved the Fluid-style horizontal scroll section built last session.

---

### Transaction Fee Structure — Research & Decisions

Conducted full competitive research on 4 brokerages using Puppeteer + web search:

**Competitors:**

| Brokerage | Base Fee | E&O Supplement | Monthly | Dual Agency |
|---|---|---|---|---|
| West Shores | $900/transaction | None | $95/mo | Not disclosed |
| Rise Realty | $199–$999 scaled (capped) | $150/500k over $1.5M | None | Not disclosed |
| REeBroker ($500 Plan) | $500 broker + $200 risk mgmt | $120/100k over $1M | None | 25% of commission (30% if dual + relative-owned) |
| CnC (new) | $990 flat | $175/500k over $1M | None | (flat fee + E&O supplement) × 2 |

**Key REeBroker findings from agent tools audit:**
- REeBroker charges $349/transaction separately for TC services — CnC includes this free (SkySlope-equivalent built in)
- REeBroker charges $99 for checklist management — CnC includes free
- REeBroker has: revenue sharing ($100/referred agent close), active lead gen (Opcity/PrimeStreet, 30% referral fee), regional team leaders, monthly webinars
- Rise Realty has: Lofty AI CRM (optional, paid add-on), live transfer leads (Opcity/PrimeStreet)
- CnC gap vs both: no agent lead generation program yet

**Agreed CnC fee structure (PENDING one item):**
- Flat transaction fee: **$990** (changed from $950)
- E&O included through **$1M** sale price
- E&O supplement: **$175 per $500k over $1M**
- Dual agency: **(flat fee + applicable E&O supplement) × 2**
- Dual agency + agent-relative-owned sale: ⏳ **PENDING** — Ryan calling Rise Realty on 2026-06-02 to check their policy before deciding. REeBroker charges 30% of commission for this case; West Shores and Rise do not publicly disclose a policy.

**Once Rise call is done:** Update `docs/cnc-ica-draft.md` and the Join page fee display.

---

### JoinStepsSlider — Slide Titles Added ✅

**File:** `apps/web/src/components/join/JoinStepsSlider.tsx`

- Added two-line titles to each slide, displayed below progress bars in upper-left of left panel
- Line 1 (smaller, dark): "Full" / "Personal" / "Custom"
- Line 2 (larger, gold `#9E8C61`): "Transaction Management" / "webpage" / "CRM & Email"
- Style matches HowToJoin heading: line1 `clamp(1.2rem, 1.6vw, 1.5rem) font-light`, line2 `clamp(1.7rem, 2.3vw, 2.2rem) font-light`
- Animation: `RevealLine triggerOnMount` — fires on mount via `requestAnimationFrame` instead of `useInView`, so all 3 slides reveal consistently regardless of scroll position

**`triggerOnMount` prop added to `RevealLine` in `reveal-text.tsx`** — when true, skips `useInView` and reveals via rAF on mount. Used wherever RevealLine is inside an AnimatePresence block that's always in view.

---

### Simplify Pass — Code Cleanup ✅

Ran `/simplify` with 4 parallel agents (reuse, simplification, efficiency, altitude). All 5 findings fixed:

1. **`EASE_CSS` exported from `lib/motion.ts`** — was duplicated in `reveal-text.tsx` and `JoinStepsSlider.tsx`
2. **`SliderReveal` deleted** — replaced by `RevealLine triggerOnMount` (correct altitude)
3. **`SellProcess.tsx` dead code removed** — `s.textVw` field never existed on Step type; ranges now derived from `N = STEPS.length`
4. **`useScrollStepper.ts` optimized** — pre-rounds segment widths once per frame instead of twice per element
5. **`JoinCnCCTA.tsx` reverted** — simplify pass broke the heading into two hard lines; reverted to original single `RevealLine` (visual was correct, only a minor dim-layer issue in the implementation)

**Commits this session:**
- `c3a15f6` — Sell page Our Process (prior session, approved this session)
- `43aa748` — session notes
- `36b86b3` — sell page slide panels, join page fixes
- `842769a` — simplify pass
- `47fd9b5` — revert JoinCnCCTA heading fix (broke layout)

---

### Section / Page Status

| Section / Page | Status |
|---|---|
| Sell Page — Hero | ✅ Approved |
| Sell Page — Our Process | ✅ Approved |
| Join Page — All sections | ✅ Approved |
| Join Page — JoinStepsSlider titles | ✅ Approved |
| Homepage — All sections | ✅ Approved |

---

### Next Session — Start Here

1. **Call Rise Realty** — ask about dual agency / agent-relative-owned sale fee policy
2. Once confirmed → finalize fee structure → update `docs/cnc-ica-draft.md` + Join page fee display
3. Continue with remaining work:
   - CnC ICA draft review (`docs/cnc-ica-draft.md`)
   - Checklist templates at `/admin/settings/checklists`
   - Phase 6 tasks (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`)

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
