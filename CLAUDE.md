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

## Session Notes — 2026-06-08

### What Was Completed This Session

All changes committed and pushed on `claude/real-estate-website-9bdWi`.

| Commit | Description |
|---|---|
| `b5d9772` | feat(buy): polish BuyContemporary animation + BuySteps copy |
| `a480e77` | feat(rent): add rent hero + simplify pass across buy/sell/rent |

---

### BuyContemporary — Final State ✅

**File:** `apps/web/src/components/buy/BuyContemporary.tsx`

Complete rewrite of the scroll-driven animation section on `/buy`. Replicated Uptown's GSAP Flip cluster→corners pattern using Framer Motion.

**Animation flow (400vh section, sticky pinned for 300vh):**
- `p = 0`: Section opens with 3 images **already assembled** in a "RESULTS" cluster (no Phase 1 build animation)
- `p 0.00 → 0.55`: Explosion — images fly from cluster to 4 corner positions
- `p 0.50 → 0.65`: "WHY CHOOSE CnC?" text fades in
- `p 0.65 → 0.75`: Hold state — all 4 corners + WHY visible
- `p 0.75 → 1.00`: Sticky div scrolls off naturally

**Key decisions:**
- Removed Phase 1 assembly animation entirely — section starts with cluster already visible
- Section height `400vh` so sticky stays pinned long enough for the full animation
- Corner positions measured from Uptown at **1440×900 viewport** via Puppeteer (previous 800×600 measurements were wrong)
- `topRight.cy = 0.28` (pulled down from measured 0.12) so top-right image overlaps "OSE" of "CHOOSE" text (text zIndex=20 renders in front)
- Bottom images: `btmLeft.cy = 0.82`, `btmRight.cy = 0.79` (pulled up from 0.9787/0.9109 so images aren't cut off)
- Watermark word "PROFES/SIONAL" row: `width: "94vw"` (reduced from 112vw so word is mostly visible)
- Heading changed from "CONTEMPORARY" → **"RESULTS"**
- 4 new real California photos in `/images/contemporary/` (contemporary-01 through 04) — separate from BuySteps `/images/buy/` photos
- "WHY CHOOSE CnC?" body text: *"With over 15+ years of California real estate expertise, our team is built to protect your interest and put your needs first"*

**Simplify pass improvements:**
- `ramp()` moved to `lib/motion.ts` (was inline)
- `pos()` style objects hoisted to module-scope constants (`POS_TOP_LEFT` etc.)
- Overlay gradient extracted to `OVERLAY_GRADIENT` constant
- Overlay `motion.div` moved inside parent image `motion.div` — halves Framer Motion subscriptions
- Timeline comment rewritten to match actual two-state animation

---

### BuySteps — Copy + Style Updates ✅

**File:** `apps/web/src/components/buy/BuySteps.tsx`

**Body text (final, no trailing periods):**
| Step | Body |
|---|---|
| Get Pre-Approved | "Connect with a lender to understand your budget before falling in love with a home. Our team works with multiple lenders for a fast and smooth approval" |
| Find Your Agent | "CnC has agents all across California. Match with an expert today to get local expertise for your neighborhood" |
| Search & Tour | "Use our property search tool to browse all active homes for sale, and schedule a tour directly in our website to move fast when the right home appears" |
| Closing Escrow | (unchanged) |

**Other changes:**
- Step number: `text-sm` → `text-base`; body text: `0.95rem` → `1.1rem` for readability
- Gold title word: inline `style={{ color: "#9E8C61" }}` → `className="text-cnc-gold"`
- Step images 2–4: `loading="lazy"` added (first image stays eager)

---

### Rent Hero — New ✅

**Files:** `apps/web/src/components/rent/RentHero.tsx`, `apps/web/public/videos/rent-hero.mp4`

Video hero section added to `/rent` page matching Buy and Sell hero pattern exactly:
- `95vh` height, black background, video fill
- SVG mask cutout text: **"RENT" / "WITH US"** (same font, size, animation as buy/sell)
- Video: `4554542-hd_1366_720_50fps.mp4` (second video tried — Ryan preferred this one over `4554539`)
- `RentHero` is now a 4-line wrapper around the shared `VideoMaskHero` component

---

### Simplify Pass — Shared VideoMaskHero ✅

**File:** `apps/web/src/components/ui/VideoMaskHero.tsx` (new)

BuyHero, SellHero, and RentHero were identical copy-pastes. Extracted into a shared component:
- Props: `maskId: string`, `videoSrc: string`, `lines: [string, string]`
- All three hero files are now 4-line wrappers
- `preload="metadata"` (was `"auto"`) — avoids competing with LCP resources on page load
- `TEXT_PROPS`, `wordContainer(0.28)`, `WORD_VARIANT` all live in the shared component once

---

### Simplify Pass — useScrollStepper Performance ✅

**File:** `apps/web/src/hooks/useScrollStepper.ts`

`barWidths` state was causing React to re-render `BuySteps` at up to 60fps during scroll. Fixed by:
- Removed `barWidths` state entirely
- Added `registerBarEl(i, el)` callback — bar divs register their DOM refs into the hook
- On each scroll frame, heights are written **directly to `element.style.height`** — bypasses React render cycle
- `BuySteps` now only re-renders when `activeIdx` changes (at most 3 times per full scroll)

---

### Next Session — Start Here

**Branch:** `claude/real-estate-website-9bdWi` (pushed, clean)

**In progress / remaining work:**
1. **Rent page** — hero done ✅; body sections (PERKS grid, CTA) are placeholder content — need real copy and any additional sections Ryan wants
2. **Manage page** — still a shell at `apps/web/src/app/(marketing)/manage/page.tsx` — needs hero + content
3. **Checklist templates** — create at `/admin/settings/checklists` (CA Purchase Buyer Side, CA Purchase Seller Side, CA Lease Tenant Side)
4. **Phase 6** (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`): ISR, skeleton loaders, sitemap, JSON-LD, rate limiting, Sentry, PostHog, deploy to Vercel

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

1. **Call Rise Realty** — ask about dual agency / agent-relative-owned sale fee policy (still pending)
2. Continue with remaining work:
   - CnC ICA draft review (`docs/cnc-ica-draft.md`) — fee structure finalized, pending attorney review
   - Checklist templates at `/admin/settings/checklists`
   - Phase 6 tasks (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`)

---

## Session Notes — 2026-06-03

### What Was Completed This Session

All changes committed to `claude/real-estate-website-9bdWi`.

---

### ICA Fee Structure — FINALIZED ✅

Conducted full competitor research (West Shores PDF, Rise Realty, REeBroker, Virtual Realty Group) via Puppeteer + PDF read.

**Final fee structure locked in `docs/cnc-ica-draft.md`:**
- Flat transaction fee: **$990** (all transactions)
- E&O included through **$1M** sale price
- E&O Supplement: **$200 per $500k (or fraction) over $1M**
- Dual agency: full fee × 2 (both sides)
- Dual agency + agent-relative-owned sale: full fee × 2 (same as dual agency — confirmed by West Shores call)
- Monthly fee: **$0**
- Optional TC service: **$350** (through escrow)
- Non-compliance fee: **REMOVED** — replaced with commission withholding until file certified

**ICA sections updated:**
- Section 7.2: New fee table with $990 base + E&O supplement tiers
- Section 7.4: Renamed "Dual Agency and Agent-Relative Sales" — covers both cases explicitly
- Section 9.1: E&O coverage clarified ($1M threshold, supplement covers above)
- Section 10.3: Non-compliance fee removed → West Shores-style withholding language

**Competitor context:**
- West Shores: $900 flat + $95/mo, no E&O supplement (absorbed by monthly fee), fee × 2 for dual agency
- Rise Realty: $199–$999 scaled (capped), $0/mo, E&O through $1.5M, $150/500k supplement above $1.5M
- REeBroker: $700 total ($500 + $200 risk mgmt), **25% of commission for dual agency** — CnC is far cheaper on dual
- Virtual Realty (CA): $695 + tri-annual membership, large supplements at $1M/$1.5M/$2M

---

### Sell Page — New Video Hero ✅

- Full-screen SVG-mask video hero, `h-[95vh]` (matches join page)
- Video: `public/videos/sell-hero.mp4` (copied from Downloads)
- "SELL WITH" (top, fontSize 240) / "US" (bottom, fontSize 320), both center-anchored at x=960
- Same SVG mask technique as join page — video visible through letter cutouts
- `DownArrow` component reused
- Old text hero section removed

---

### PageCTA Component — New Shared Component ✅

New file: `apps/web/src/components/ui/PageCTA.tsx`

Matches Join page final CTA section style:
- Off-white `#F2F0EF` background
- `CTALineArt` isometric house SVG as background decoration
- `RevealLine` heading with gold accent on last word
- Two spring-animated buttons (gold primary + bordered secondary; secondary optional)

Applied to:
- `/buy` — "Ready to start **looking?**" · "Search All Listings →" + "Find an Agent"
- `/rent` — "Need help finding a **rental?**" · "Browse Rentals →" + "Talk to an Agent"
- `/manage` — "Ready to go **hands-off?**" · "Schedule a Consultation →" + "View Listings"
- `/sell` — "What's your home **worth?**" · "Request a Valuation →" + "Meet Our Agents"

---

### Section / Page Status

| Section / Page | Status |
|---|---|
| Sell Page — Hero (video) | ✅ Approved |
| Sell Page — Our Process | ✅ Approved |
| Sell Page — PageCTA | ✅ Applied |
| Buy Page — PageCTA | ✅ Applied |
| Rent Page — PageCTA | ✅ Applied |
| Manage Page — PageCTA | ✅ Applied |
| CnC ICA | ✅ Fee structure finalized, pending attorney review |

---

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. Continue with remaining work:
   - Checklist templates at `/admin/settings/checklists`
   - Phase 6 tasks (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`)
   - Call Rise Realty re: dual agency policy (still pending — not blocking anything now)

---

## Session Notes — 2026-06-03

### What Was Completed This Session

All changes committed to `claude/real-estate-website-9bdWi` (commits `369f843` through `751e011`).

---

### Sell Page Hero — Word-by-Word Animation

- Replaced typewriter letter-by-letter animation with Framer Motion word-by-word fade-in (matching homepage hero style)
- "SELL" and "WITH" on top line (manually x-positioned), "US" on bottom line
- Each word: `opacity 0→1, x -14→0`, `duration 0.9s easeOut`, `staggerChildren 0.28s`
- Extracted hero into `apps/web/src/components/sell/SellHero.tsx` ("use client")
- File: `apps/web/src/app/(marketing)/sell/page.tsx` → `<SellHero />`

### Join Page Hero — Word-by-Word Animation

- Same animation applied to "Be CnC" SVG mask text
- Extracted into `apps/web/src/components/join/JoinHero.tsx` ("use client")
- Stagger: `0.56s` (doubled from sell page — "Be CnC" is only 2 words so needed more gap to feel same speed)
- File: `apps/web/src/app/(marketing)/join/page.tsx` → `<JoinHero />`

### Homepage Hero — Font Swap

- `font-chopin` (Inter) → `font-sans` (Google Sans Flex) on the cycling phrase heading
- Matches the sell page hero SVG text font
- File: `apps/web/src/components/home/HeroSection.tsx`

### Hero Search — Natural Language Parsing

- Fixed: "3 bed homes in Pasadena" returned 0 results (API only did city/address string match)
- Added NLP parsing in `HeroSection.tsx` `onSubmit`: extracts "N bed" → `minBeds` param, "in City" → `query` param
- Routes to `/properties?query=Pasadena&minBeds=3` instead of passing full string verbatim

### Contact Page — Black Navbar

- Added `pathname !== "/contact"` to `isTransparent` exclusion in `Navbar.tsx`
- Removed `data-navbar-theme="light"` from contact page `<main>`
- Contact page now shows solid `bg-[#0f0f0f]` navbar with white logo/buttons

### Sell Page — Our Process Copy Updates

- Intro heading: "We handle everything, start to close." → "We're here for you, start to close"
- Intro body: updated to "CnC will be with you every step of the way"
- Listing body: updated to professional photography + immaculate staging + effective agent communication + California (not Southern California)
- Valuation body: period removed
- Offers body: period removed
- Closing body: "manage" → "read every detail"

### Sell Page — "Start" Button on Closing Step

- Added white pill "Start" button → `/contact` below Closing body text
- `mt-20` spacing below body text
- Pulses at idle, spring snap on hover (matches sitewide button standard)
- Field: `cta: { label: "Start", href: "/contact" }` on step 04 in `STEPS` array

### Sell Page — CTA Redesign

- Heading: "Free Property-Value **Estimate**" (gold on last word)
- Body: "By an experienced CnC Agent"
- Button: "Request Valuation" (single centered button, no secondary)

### Sell Page — FAQ Section

- Added `<FAQ />` between SellProcess and PageCTA
- FAQ component now accepts optional `faqs` prop (homepage uses default, sell page passes custom array)
- FAQ also accepts optional `className` prop for background override
- Sell page FAQ: `bg-[#DAD4D2]` + 4 sell-specific Q&As:
  1. How long will it take to sell my property?
  2. Should I get a home inspection?
  3. What are closing costs?
  4. Do I need to renovate my home or sell "as-is"?
- Gradient bridge above FAQ: `#F2F0EF → #DAD4D2` (80px)
- Gradient bridge below FAQ: `#DAD4D2 → #F2F0EF` (80px)

### Homepage FAQ — Color Update

- Background changed to `#DAD4D2` (same as sell page)
- Gradient bridge above (from Testimonials `#F2F0EF → #DAD4D2`) and below (to JoinCnCCTA `#DAD4D2 → #F2F0EF`)
- File: `apps/web/src/app/page.tsx`

### ICA — Fee Structure Finalized

- Rise Realty confirmed (via phone call): dual agency / agent-relative sale = fee × 2 (same as CnC policy)
- Dual agency policy locked — no ICA text change needed (was already correct)
- **New Section 7.9:** Broker-provided leads = 25% of gross commission + flat transaction fee, identified in writing at time of referral
- Renumbered: old 7.9 (Post-Termination) → 7.10
- Fee table updated with broker-provided lead row
- ICA converted to Word doc: `C:\Users\hey_r\Downloads\CnC-Realty-ICA-DRAFT.docx`

### StatsBar — Resources Updated

- "20+" → "30+" for Resources stat
- File: `apps/web/src/components/join/StatsBar.tsx`

### Pulse Animation — Sitewide Button Standard

**Established as the permanent standard for all buttons going forward.**

All CTA/pill buttons now use a continuous idle pulse that stops on hover:
- `animate={PULSE_ANIMATE}` — `scale: [1, 1.04, 1]`
- `transition={PULSE_TRANSITION}` — `duration: 2, repeat: Infinity, ease: "easeInOut"`
- `whileHover={{ scale: 1.05, transition: SPRING_HOVER }}` — hover overrides pulse transition

Constants added to `apps/web/src/lib/motion.ts`: `PULSE_ANIMATE`, `PULSE_TRANSITION`

**Applied to 10 buttons across 8 files:**
- `PageCTA.tsx` — primary + secondary buttons
- `JoinCnCCTA.tsx` — "Join Now"
- `WhyCnC.tsx` — "Join CnC" (Freedom Awaits panel)
- `ServicesSection.tsx` — "Services" pill
- `HowToJoin.tsx` — "Apply Now →"
- `JoinCTAButtons.tsx` — "Join" + "Message"
- `contact/page.tsx` — "Send Message"
- `SellProcess.tsx` — "Start" (Closing step)

---

### Section / Page Status

| Section / Page | Status |
|---|---|
| Sell Page — Hero (word-by-word animation) | ✅ Approved |
| Sell Page — Our Process (copy + Start button) | ✅ Approved |
| Sell Page — FAQ (sell Q&As, #DAD4D2, gradients) | ✅ Approved |
| Sell Page — CTA | ✅ Approved |
| Join Page — Hero (word-by-word animation) | ✅ Approved |
| Homepage — Hero (font swap + NLP search) | ✅ Approved |
| Homepage — FAQ (#DAD4D2 + gradients) | ✅ Approved |
| Contact Page — Navbar (solid black) | ✅ Approved |
| Sitewide — Pulse button animation | ✅ Applied to all existing CTAs |
| CnC ICA | ✅ Finalized + Word doc generated |

---

## Session Notes — 2026-06-04

### What Was Completed This Session

All changes committed to `claude/real-estate-website-9bdWi` (commits through `2791ace`).

---

### SellQuote — Placeholder Section Added

- New file: `apps/web/src/components/sell/SellQuote.tsx`
- Copied from `FounderQuote.tsx` — same scroll-driven word-reveal animation, same placeholder text
- Removed: photo, "Founder" label, "Ryan Chong" name
- Text is centered (`text-center`) instead of float layout
- Placed in `sell/page.tsx` directly after `<SellHero />`, before the light sections wrapper
- **Status: placeholder** — Ryan will change the text and format in a future session

### Sell Hero — Gradient Blend (Rejected)

Attempted two approaches to blend the hero into the SellQuote section — both rejected:
1. Gradient bridge div between sections (`#000000 → #F2F0EF`) — Ryan said it looked ugly
2. Transparent → `#F2F0EF` overlay on the bottom of `SellHero` — tried `h-40`, `h-20`, `height: 80px` — still didn't look right

**Final decision: hard cut between hero and SellQuote. No gradient.** Do not attempt a gradient blend between SellHero and SellQuote again unless Ryan explicitly asks with a specific reference.

---

### Homepage Section Titles — "Our Process" Format Applied Sitewide

All homepage section titles now follow the sell page "Our Process" pattern: top row smaller, bottom row bigger. The bottom word is gold.

**`FeaturedListings.tsx`:**
- "Exclusive Listings" → "Exclusive" (`text-[1.9rem] xl:text-[2.2rem]`) + "**Listings**" (gold, `text-[2.5rem] xl:text-[3rem]`) — same line, inline

**`WhyCnC.tsx`:**
- "100% COMMISSION" → `100%` (sm, `text-[3rem]`) / `COMMISSION` (custom `text-[3.4rem] xl:text-[4.1rem]` — slightly smaller than full 4rem)
- "AI-DRIVEN TECH" → `AI-DRIVEN` (sm) / `TECH` (full, gold)
- "TRAINING & MENTORSHIP" → `TRAINING &` (sm) / `MENTORSHIP` (full, gold)
- "FREEDOM AWAITS" → `FREEDOM` (sm) / `AWAITS` (full, gold)
- Added `size?: string` prop to `TitlePart` type for one-off size overrides

**`ServicesSection.tsx`:**
- "with" now same size as "CnC" — removed smaller `text-[2.5rem]` span override, both inherit `text-[3.5rem] xl:text-[4.2rem]`

**`Testimonials.tsx`:**
- Cycling word (trust/results/futures/homes/teams) now slightly bigger than "We create"
- Applied `fontSize: "clamp(3.5rem, 6.8vw, 6.2rem)"` to the `inline-grid` wrapper span
- "We create" stays at `clamp(2.8rem, 5.5vw, 5rem)` — only the wrapper was changed, `GhostWords` + active word both scale together so layout-shift prevention stays intact

---

### Simplify Pass — 4-Agent Parallel Review

Ran `/simplify` across all today's changes. Findings applied (`2791ace`):

**New shared utilities:**
- `lib/motion.ts` — added `WORD_VARIANT` (word fade-in variant) and `wordContainer(stagger)` factory
- `components/ui/GradientBridge.tsx` — new component: `<GradientBridge from="#F2F0EF" to="#DAD4D2" />` replaces inline gradient style divs

**Component improvements:**
- `PageCTA.tsx` — extracted `CTAButton` sub-component, eliminates 3 repeated motion props
- `SellProcess.tsx` — `motion(Link)` replaces `motion.div + Link` wrapper
- `SellHero.tsx` + `JoinHero.tsx` — use `WORD_VARIANT` + `wordContainer()` from `motion.ts`
- `FeaturedListings.tsx` — `MotionLink` + `SPRING_HOVER` replaces `motion.div` wrapper + inline spring
- `ServicesSection.tsx` — card-back buttons use `SPRING_HOVER` instead of inline spring literals
- `sell/page.tsx` — `SELL_FAQS` const hoisted out of inline JSX; uses `GradientBridge`
- `page.tsx` (homepage) — uses `GradientBridge`
- All 4 marketing pages + `FeaturedListings` — `className="text-cnc-gold"` replaces `style={{ color: "#9E8C61" }}`

**Skipped (intentional):**
- `VideoMaskHero` shared component — deferred until a 3rd page needs a video hero
- `SellQuote`/`FounderQuote` merge — `SellQuote` is a placeholder Ryan will change
- `SellQuote` scroll efficiency (`getBoundingClientRect` on every frame) — would need to fix `FounderQuote` too; deferred for consistency

---

### Section / Page Status

| Section / Page | Status |
|---|---|
| Sell Page — Hero | ✅ Approved |
| Sell Page — SellQuote | ✅ Approved — "Our Mission" section, scroll word-lighting |
| Sell Page — Our Process | ✅ Approved |
| Sell Page — Our Values | ✅ Approved — real photos pending from Ryan |
| Sell Page — FAQ | ✅ Approved |
| Sell Page — CTA | ✅ Approved |
| Homepage — All sections | ✅ Approved |
| Homepage — Section title format | ✅ Applied (smaller top row, bigger gold bottom row) |
| Buy Page | 🔄 Shell only — not yet finalized |
| Rent Page | 🔄 Shell only — not yet finalized |
| Manage Page | 🔄 Shell only — not yet finalized |

---

### SellValues — Our Values Arch Wheel (2026-06-04)

New component: `apps/web/src/components/sell/SellValues.tsx`
- 500vh sticky section with scroll-driven image wheel (same mechanic as azure.sa/about "Azure Projects")
- 5 cards on a half-circle arch, rotating right-to-left as user scrolls
- Cards: Respect, Punctuality, Attention to Detail, Compassion, Integrity
- Placeholder images: sell-01.jpg → sell-05.jpg (Ryan to swap real photos when ready)
- Title "Our Values" top-center with RevealLine (same as Our Process)
- 25 useTransform calls (5 cards × x/y/scale/opacity/rotate) — hooks at top level, not in loops
- Placed in sell/page.tsx immediately after `<SellProcess />`

---

### Session 2026-06-04 — Full Summary

#### Sell Page — Completed ✅

**SellQuote → "Our Promise" section**
- New text: "We know a home is more than 4 walls..." with scroll word-lighting animation
- "very" highlights in gold (#9E8C61) when lit
- Title "Our Promise" top-right, RevealLine reveal, same font as Our Process
- Section title was "Our Mission" — **renamed to "Our Promise"** at end of session
- File: `apps/web/src/components/sell/SellQuote.tsx`

**SellValues → "Our Values" arch wheel section**
- Placed after SellProcess, inside light bg-[#F2F0EF] wrapper
- 5 cards on a half-circle arch, scroll-driven (500vh sticky section)
- Cards: Respect, Punctuality, Attention to Detail, Compassion, Integrity
- Real photos provided by Ryan and committed: `values-respect.jpg`, `values-punctuality.jpg`, `values-attention.jpg`, `values-compassion.jpg`, `values-integrity.jpg` (in `/images/sell/`)
- Card overlay: `bg-black/40` tint, white label centered, `text-[2.2rem]/[2.6rem]`
- Title "Our Values" top-center, larger font (`text-[3.5rem]/[4.5rem]`), `top-40`
- File: `apps/web/src/components/sell/SellValues.tsx`
- 25 `useTransform` hooks (5 cards × 5 props) — must stay at top level, not in loops

**Key sell page decisions:**
- Hard cut between SellHero and SellQuote — no gradient blend (rejected twice, do not attempt again)
- Section title format: smaller dark "Our " + larger gold second word (RevealLine)
- "Our Promise" title in top-right corner; body text center-aligned

#### Buy Page — Completed ✅

**BuySteps — replaces "How it Works" grid entirely**
- Volta SKAI (voltaskai.endover.ee/en/) scroll-cards layout: sticky left panel + scrolling right images
- Left panel: `flex-col justify-between`, title top-left, counter+body bottom-left
- Title format: first word smaller (`text-[2.4rem]/[2.9rem]`), optional mid word smaller too, last word gold — with RevealLine `triggerOnMount`
  - "Get Pre-Approved", "Find Your Agent", "Search & Tour", "Closing Escrow"
  - "&" in "Search & Tour" is smaller size (same span as "Search")
- Progress bar: own sticky flex column between left and right panels, `h-[68vh]`, `items-start`
- Right panel: 4 images `height: 49vh` (matched Volta's ~437px), `gap-[4.2rem]`, `pr-8`
- Placeholder images: sell-06.jpg → sell-09.jpg (Ryan to swap real buy photos)
- Outer section: `pl-20 pr-8` (matched Volta's padding measurements exactly)
- Sticky offset: `top-[100px]` (matched Volta exactly)
- Left panel height: `h-[68vh]` (reduced from 78vh to tighten title/body spacing)
- File: `apps/web/src/components/buy/BuySteps.tsx`

**Volta measurements used (1440×900 viewport):**
- Grid: `562.5px left | 75.83px gap | 678.33px right`
- Card height: `437.5px` (~49vh)
- Card gap: `66.67px` (~4.2rem)
- Section padding: `left: 91.67px, right: 33.33px`
- Sticky top: `100px`
- Separator: CSS `::before` (700px track) + `::after` (dynamic fill, `right: -36.67px`)

#### Component Status

| Component | Status | Notes |
|-----------|--------|-------|
| Sell Page — SellQuote ("Our Promise") | ✅ Approved | Scroll word-lighting, "very" gold |
| Sell Page — SellValues ("Our Values") | ✅ Approved | Real photos in place |
| Sell Page — Our Process | ✅ Approved | |
| Sell Page — FAQ + CTA | ✅ Approved | |
| Buy Page — Hero | ✅ Approved | |
| Buy Page — BuySteps | ✅ Approved | Real photos pending from Ryan |
| Rent Page | 🔄 Shell only | Not yet finalized |
| Manage Page | 🔄 Shell only | Not yet finalized |

---

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. Continue with remaining work in order:
   - **Rent page** — finalize (shell exists at `app/(marketing)/rent/page.tsx`)
   - **Manage page** — finalize (shell exists at `app/(marketing)/manage/page.tsx`)
   - **Swap placeholder images** in BuySteps when Ryan provides 4 real buy photos
   - **Checklist templates** at `/admin/settings/checklists` (CA Purchase Buyer/Seller Side, CA Lease Tenant Side)
   - **Phase 6 tasks** (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`): ISR, skeleton loaders, sitemap, JSON-LD, rate limiting, Sentry, PostHog, deploy

---

## Session Notes — 2026-06-05

### What Was Completed This Session

All changes committed to `claude/real-estate-website-9bdWi` (commits through `d4efdd0`).

---

### BuyContemporary — Full Two-Phase Scroll Animation

New component: `apps/web/src/components/buy/BuyContemporary.tsx`

Inspired by Uptown's (uptown.ae) transition between their "Contemporary" and "Why Choose Uptown" sections. Puppeteer was used to read Uptown's live GSAP source and translate it to Framer Motion.

**Section structure:** `h-[200vh]` outer + `sticky top-0 h-screen overflow-hidden` inner → scroll-pinned viewport.

**Phase 1 (scrollYProgress 0.05→0.45) — Cluster assembly:**
- Center image (`buy-step-01.jpg`) scales 0.78×→1.455× while rising from below
- Left image (`buy-step-03.jpg`) rotates from -7deg, fades in, arrives from left
- Right image (`buy-step-02.jpg`) rotates from +7deg, fades in, arrives from right
- "CONTEMPORARY" heading fades in, gradient overlays fade in with side images
- Background watermark text (TRUSTWORTHY / INNOVATIVE / PROFESSIONAL) fades in at 12% opacity

**Phase 2 (scrollYProgress 0.45→0.85) — Explosion to corners:**
- All 4 images fly from cluster to viewport corners (all transforms → 0)
- Back image (`buy-step-04.jpg`) appears and flies to bottom-right
- Gradient overlays fade OUT during expansion
- "CONTEMPORARY" heading fades out
- "WHY CHOOSE CnC?" heading + body text fade in at center

**Key constants (from Uptown 800×600 Puppeteer measurements):**
- `C` = corner positions: cx/cy = image center as viewport fraction, w/h = size fraction
- `K` = contemporary cluster centers as viewport fraction
- `CW` = contemporary display widths (for scale ratio calculation)

**Key helpers:**
- `ramp(p, lo, hi, a, b)` — clamped linear interpolation
- `pos(corner)` — returns absolute style using `calc(cx*100vw - w*50vw)` for center-based positioning

**Viewport responsiveness:** `vwRef`/`vhRef` updated on resize, read inside `useTransform` callbacks to avoid stale closures.

**Scale ratios:** center 1.455 (CW.center/C.topLeft.w), left 1.127, right 1.0, back 1.343

**Critical fix — Tailwind + Framer Motion conflict:** `-translate-y-1/2` must be on a non-motion `div` wrapper; only `opacity` goes on the inner `motion.h2` — otherwise Framer Motion overrides Tailwind's CSS transform.

**Status: committed, visual review pending.** Ryan said "there is still work that needs to be done" — specific fixes TBD after visual inspection next session.

---

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000/buy`
3. **Review `BuyContemporary` visually** — scroll through the section, note any issues with timing, positioning, or text, then fix
4. Continue with remaining work in order:
   - **Rent page** — finalize (shell exists at `app/(marketing)/rent/page.tsx`)
   - **Manage page** — finalize (shell exists at `app/(marketing)/manage/page.tsx`)
   - **Swap placeholder images** in BuySteps when Ryan provides 4 real buy photos
   - **Checklist templates** at `/admin/settings/checklists` (CA Purchase Buyer/Seller Side, CA Lease Tenant Side)
   - **Phase 6 tasks** (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`): ISR, skeleton loaders, sitemap, JSON-LD, rate limiting, Sentry, PostHog, deploy

---

## Session Notes — 2026-06-09

### What Was Completed This Session

All changes committed as `a305f61` and pushed to `claude/real-estate-website-9bdWi` (23 files modified).

---

### Exclusive Listings Cards — Final State ✅

**File:** `apps/web/src/components/home/FeaturedListings.tsx`

Three iterations to find the right card color against the `#F2F0EF` section background:
1. `bg-cnc-bg` — invisible (same color as background)
2. `bg-[#1B1B1B]` — too dark (Ryan: "That's a little too dark now")
3. `bg-white` — approved ✅

**Canal Club "Be Inspired" attempt — reverted:**
- Ryan asked to replicate canalclub-wickside.com's tilted, colorful-bordered photo carousel
- Puppeteer blocked with 403 Forbidden on the site even in non-headless mode
- Implemented purely from visual analysis of a screenshot (tilted cards, colored borders, portrait orientation)
- Ryan saw the result and said "I don't think it looks that good. Can you change it back to how we had it, but keep the picture taking up the whole card with the address and price on the bottom left as it is now."

**Final card format (approved):**
- White shell: `w-72 bg-white border border-zinc-200 rounded-xl shadow-sm hover:border-[#c9a84c]/60`
- Height: `290px`, stagger offsets: `STAGGER_OFFSETS = [0, 48, 24]`
- Full-bleed image with `bg-gradient-to-t from-black/70 via-black/20 to-transparent` overlay
- Status badge top-left, price + address + city stacked at bottom-left in white text

---

### PhotoGallery Lightbox X Button — Fixed ✅

**File:** `apps/web/src/components/properties/PhotoGallery.tsx`

**Root cause:** `position: fixed` inside `PropertyDrawer`'s Framer Motion `motion.div` — Framer Motion applies a CSS `transform`, which creates a new stacking context. `position: fixed` children become positioned relative to the transformed ancestor, not the viewport. The navbar (in the global stacking context) sat above the lightbox and intercepted clicks on the X button at `top-4`.

**Fix:** `createPortal(lightboxContent, document.body)` renders the lightbox outside all transformed ancestors. Z-index bumped to `z-[500]`. X button gets `e.stopPropagation()`. Prev/Next buttons get `top-1/2 -translate-y-1/2` for proper vertical centering.

**Key principle:** `position: fixed` inside a CSS `transform` ancestor doesn't escape it — use `createPortal` to escape.

---

### useScrollStepper — Width Support

**File:** `apps/web/src/hooks/useScrollStepper.ts`

Added `prop: "height" | "width" = "height"` parameter. Bar elements' DOM style is written as `el.style[prop]` instead of always `el.style.height`. Required for `JoinStepsSlider` which uses horizontal progress bars.

---

### JoinStepsSlider — Fixes

**File:** `apps/web/src/components/join/JoinStepsSlider.tsx`

- Passed `"width"` as third arg to `useScrollStepper` for horizontal fill bars
- `line2: "webpage"` → `"Webpage"` (capitalization fix)
- `line2` span changed to `font-medium` to match gold word pattern

---

### HowToJoin — Heading Left Shift

**File:** `apps/web/src/components/join/HowToJoin.tsx`

- Applied `-ml-16` only to the `<h2>` element (not the whole section or its siblings)
- First attempt moved the whole section padding (wrong) — only the title should shift

---

### Font-Medium — Gold Word Standardization

Gold-colored words across the site standardized to `font-medium` (500 weight) consistently. Applied across buy, sell, join, home pages.

---

### Phase 6 — CCPA Cookie Consent Banner Added

**File:** `docs/superpowers/plans/2026-05-22-phase-6-launch.md`

Task 9 added: CCPA Cookie Consent Banner (7 steps):
- `useCookieConsent` hook (localStorage persistence)
- `CookieBanner` component (bottom bar, Accept / Decline buttons)
- PostHog initialization gated on consent
- "Do Not Sell or Share My Personal Information" link in Footer
- Old Tasks 9→10, 10→11 renumbered accordingly

---

### Section / Page Status

| Section / Page | Status |
|---|---|
| Homepage — Exclusive Listings | ✅ Approved (white cards, full-bleed image, overlay text) |
| Property Drawer — PhotoGallery lightbox | ✅ X button fixed via createPortal |
| Join Page — JoinStepsSlider | ✅ Width bars fixed, Webpage capitalized |

---

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. Continue with remaining work in order:
   - **Manage page** — still a shell at `apps/web/src/app/(marketing)/manage/page.tsx`
   - **Checklist templates** at `/admin/settings/checklists` (CA Purchase Buyer Side, CA Purchase Seller Side, CA Lease Tenant Side)
   - **Phase 6 tasks** (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`): ISR, skeleton loaders, sitemap, JSON-LD, rate limiting, CCPA cookie banner, Sentry, PostHog, deploy to Vercel + Railway

---

## Session Notes — 2026-06-10

### What Was Completed This Session

All changes committed as `1624529` on `claude/real-estate-website-9bdWi`. Branch is 12 commits ahead of origin (not yet pushed).

---

### Follow Up Boss — Full Feature Research (Complete)

Used Puppeteer to read all FUB help articles across 8 categories. Produced a complete feature audit comparing FUB vs CnC CRM.

**FUB's 8 core feature areas:**
1. Contacts & Lead Profiles — custom fields, relationships, Homes Tab (property view tracking), deduplication, auto-tags
2. Deal Tracking — separate pipelines/stages for forecasting (distinct from transaction files), Deals Leaderboard
3. People Screen + Smart Lists — saved filtered contact views, mass actions, export to CSV
4. Tasks — recurring tasks, quick follow-up tasks
5. Communication — built-in calling (FUB Phone), 1:1 + group + video texting, Team Inbox, connected email
6. Automation — Action Plans (per-lead drip with auto-pause on reply), Trigger-based Automations (stage change → plan), Lead Flow + Lead Ponds (round-robin routing + first-to-claim pool)
7. Reporting — speed-to-lead, agent activity, UTM tracking, leaderboards, goal setting
8. Integrations — 200+ (Zillow, Realtor.com, Zapier, calendar sync, etc.)

**CnC already has:** Lead profiles, pipeline Kanban, email campaigns/drip, transaction management, IDX, agent dashboard, admin dashboard, property alerts.

**CnC gaps vs FUB (all buildable):**
- Smart Lists, Deal Pipeline, Action Plans, Trigger Automations, Lead Ponds, Reporting

---

### Phase Structure — Finalized

**Key decision: site does NOT go live until BOTH Phase 6 AND Phase 7 are complete.**

- **Phase 6** (infrastructure — staging only): ISR, Redis, skeleton loaders, JSON-LD, rate limiting, CCPA banner, Sentry, PostHog, deploy to Vercel + Railway
- **Phase 7** (CRM Expansion — required before launch): 6 FUB-inspired features below
- **Launch** — after Phase 7 complete

**Phase 7 feature list and build order:**
1. Smart Lists (~1–2 days) — saved filtered contact views
2. Deal Pipeline (~2 days) — separate lightweight pipeline for forecasting
3. Lead Ponds (~1 day) — unassigned lead pool with first-to-claim
4. Action Plans (~4–5 days) — per-lead drip sequences with auto-pause on reply; needs background job runner (Railway worker or Vercel Cron)
5. Trigger Automations (~1–2 days) — stage change → start action plan (depends on Action Plans)
6. Reporting (~3–4 days) — agent activity, speed-to-lead, UTM tracking, leaderboards
- Total: ~12–16 days of work

---

### Manage Page — Hero Added ✅

**New file:** `apps/web/src/components/manage/ManageHero.tsx`

4-line wrapper around `VideoMaskHero` — identical pattern to `BuyHero` and `SellHero`:
```tsx
<VideoMaskHero maskId="manage-hero-mask" videoSrc="/videos/manage-hero.mp4" lines={["MANAGE", "WITH US"]} />
```

**Video:** `13905490_1920_1080_30fps.mp4` (suburban aerial neighborhood shot, Full HD 1920×1080) copied to `apps/web/public/videos/manage-hero.mp4`.

**`manage/page.tsx` updated:** Old text hero section removed (was `pt-40` heading + RevealText + Link button). `ManageHero` now renders at the top. `data-navbar-theme="light"` removed from `<main>` (hero handles dark theme internally). Unused `Link` import removed.

---

### FAQ Sections — Added to Rent and Buy Pages

**Rent page (`apps/web/src/app/(marketing)/rent/page.tsx`):**
- 4 rent-specific Q&As added below `<RentCitiesSlider />`
- `bg-[#DAD4D2]` background, `GradientBridge from="#DAD4D2" to="#F2F0EF"` below
- Questions: Do I need an agent to rent? / How long does it take? / What do I need to qualify? / Can CnC help with short-term rentals?

**Buy page (`apps/web/src/app/(marketing)/buy/page.tsx`):**
- 4 buy-specific Q&As added between `<BuyContemporary />` and `<PageCTA />`
- `GradientBridge from="#F2F0EF" to="#DAD4D2"` before FAQ, `GradientBridge from="#DAD4D2" to="#F2F0EF"` after
- Questions: Do I need pre-approval? / How much for a down payment? / How long does buying take? / Does it cost me anything to use a buyer's agent?

---

### BuyContemporary — WHY CHOOSE Section Polished ✅

**File:** `apps/web/src/components/buy/BuyContemporary.tsx`

- Replaced `<span className="text-cnc-gold font-medium">CnC?</span>` text with gold logo image (`/logo-mark.png`)
- `logo-mark.png` = lettermark-only gold gradient CnC logo (no "REALTY" text), transparent background — copied from `C:\Users\hey_r\Desktop\CNC Logo\Gold Gradient\Transparent Gold Graident CNC Logo - Copy.png`, intrinsic 612×370
- Question mark removed
- Logo centered via `<span className="mt-6 flex justify-center">` wrapper (plain `<Image>` without flex container drifted left)
- `leading-none` + explicit `mt-6` on logo span for controllable spacing between "WHY CHOOSE" and logo
- `mt-10` on body text paragraph for more breathing room below logo

**Key rule established:** `<Image>` without a flex container defaults to left alignment inside a block element. Always wrap in `<span className="flex justify-center">` to center.

---

### Sell Page — CTA Copy Fix ✅

**File:** `apps/web/src/app/(marketing)/sell/page.tsx`

- `body="By an experienced CnC Agent"` → `body="By an experienced CnC agent"` (lowercase 'a')

---

### RentCitiesSlider — Visual Polish ✅

**File:** `apps/web/src/components/rent/RentCitiesSlider.tsx`

- City name font size doubled: `text-[4.4rem] xl:text-[5.2rem]` (was `text-[2.2rem] xl:text-[2.6rem]` approx)
- Font weight iterated: bold (ugly) → medium → **font-light** (final)
- Overlay opacity iterated: /40 → /60 → **bg-black/50** (final)

---

### Rent Page CTA — Copy Updates ✅

**File:** `apps/web/src/app/(marketing)/rent/page.tsx`

| Field | Before | After |
|---|---|---|
| Heading | "Need help finding a rental?" (gold "rental?") | "Take the First **Step**" (only "Step" is gold + font-medium) |
| Body | "A CnC agent will work on your behalf — at no cost to you." | "We'll help you get there" |
| Primary button | "Browse Rentals →" | "Search Rentals" (no arrow) |
| Secondary button | "Talk to an Agent" | "Message" |

---

### Section / Page Status

| Section / Page | Status |
|---|---|
| Manage Page — Hero | ✅ ManageHero added (MANAGE WITH US video mask) |
| Rent Page — FAQ | ✅ Added (rent-specific Q&As, DAD4D2 bg) |
| Rent Page — CTA | ✅ Updated copy, Search Rentals, Message |
| Buy Page — FAQ | ✅ Added (buy-specific Q&As, gradient bridges) |
| Buy Page — WHY CHOOSE | ✅ Gold logo mark, no question mark, centered, spaced |
| Sell Page — CTA | ✅ Lowercase 'agent' fix |
| Manage Page — body sections | 🔄 Shell (ManageServices grid + What We Handle grid + PageCTA) — no visual changes yet |

---

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. **Push branch to GitHub** (12 commits are local-only): `git push`
4. **Review manage page** at `/manage` — confirm video hero looks right, decide if body sections need redesign or if the existing ManageServices + What We Handle grid is acceptable
5. **Continue with remaining work in order:**
   - Checklist templates at `/admin/settings/checklists` (CA Purchase Buyer Side, CA Purchase Seller Side, CA Lease Tenant Side)
   - Phase 6 tasks (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`): ISR, skeleton loaders, sitemap, JSON-LD, rate limiting, CCPA cookie banner, Sentry, PostHog, deploy to Vercel + Railway
   - Phase 7 CRM Expansion (Smart Lists → Deal Pipeline → Lead Ponds → Action Plans → Trigger Automations → Reporting) — **required before launch**

---

## Session Notes — 2026-06-11

### What Was Completed This Session

All changes committed as `944f01b` and pushed to `claude/real-estate-website-9bdWi` (4 files).

---

### Manage Page — Section Background Swap ✅

**Decision:** Ryan asked to swap the background colors of the two manage page body sections — "Property Management, Fully Handled." (ManageServices) and "What we handle" (ManageHandle).

**ManageServices** (`apps/web/src/components/manage/ManageServices.tsx`):
- Was: `bg-[#1B1B1B]` dark, `data-navbar-theme="dark"`, white text
- Now: `bg-[#F2F0EF]` off-white, `data-navbar-theme="light"`, `text-[#1B1B1B]` dark text
- Muted spans: `text-white/40` → `text-[#1B1B1B]/40`
- Button: `bg-white text-[#1B1B1B]` → `bg-[#1B1B1B] text-white` (inverted to stay visible)

**ManageHandle** (`apps/web/src/components/manage/ManageHandle.tsx`):
- Was: `bg-[#F2F0EF]` off-white, `data-navbar-theme="light"`
- Now: `bg-[#1B1B1B]` dark, `data-navbar-theme="dark"`, `text-white` on section
- h2: `text-[#1B1B1B]` → `text-white`
- `<RevealText>` gained `onDark` prop — without it the heading was invisible (dark text on dark bg); `onDark` switches to white text + `rgba(255,255,255,0.18)` dim layer

**Root cause of invisible heading:** `RevealText` defaults to `#1B1B1B` color (dark mode `false`). Always pass `onDark` when using `RevealText` inside a dark section.

---

### HowToJoin — House Photo Now Sticky ✅

**File:** `apps/web/src/components/join/HowToJoin.tsx`

Ryan asked for the house photo (right column) to move with the section title as the user scrolls — i.e., stay visible while scrolling through all 4 steps just like the heading does.

**Fix:** Added `sticky top-28 self-start` to the photo wrapper `<div>`.
- `sticky top-28` mirrors the heading's `sticky top-28` exactly
- `self-start` is required — without it, the flex item stretches to full column height and sticky has no room to activate

---

### JoinStepsSlider — Copy Updates ✅

**File:** `apps/web/src/components/join/JoinStepsSlider.tsx`

Three copy changes in the STEPS array:
1. Slide 1 (Full Transaction Management): removed trailing period from body text
2. Slide 2 (Personal Webpage): removed trailing period from body text
3. Slide 3 (Custom CRM & Email): "the CnC platform" → "your CnC account" (no period — already had none)

---

### Section / Page Status

| Section / Page | Status |
|---|---|
| Manage Page — Hero | ✅ Approved |
| Manage Page — ManageServices | ✅ Swapped to off-white bg, dark text, dark button |
| Manage Page — ManageHandle | ✅ Swapped to dark bg, white text, RevealText onDark |
| Join Page — HowToJoin photo | ✅ Sticky, mirrors heading scroll |
| Join Page — JoinStepsSlider copy | ✅ Periods removed, CnC account copy |

---

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. **Continue with remaining work in order:**
   - Manage page body sections — review current state at `/manage` (ManageServices off-white + ManageHandle dark are now live)
   - Checklist templates at `/admin/settings/checklists` (CA Purchase Buyer Side, CA Purchase Seller Side, CA Lease Tenant Side)
   - Phase 6 tasks (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`): ISR, skeleton loaders, sitemap, JSON-LD, rate limiting, CCPA cookie banner, Sentry, PostHog, deploy to Vercel + Railway
   - Phase 7 CRM Expansion (Smart Lists → Deal Pipeline → Lead Ponds → Action Plans → Trigger Automations → Reporting) — **required before launch**

---

## Session Notes — 2026-06-12

### What Was Completed This Session

All changes committed as `2237976` on `claude/real-estate-website-9bdWi`.

---

### Manage Page — ManageQuote Section (replaces ManageServices) ✅

**New file:** `apps/web/src/components/manage/ManageQuote.tsx`

Scroll-driven word-lighting quote section, identical mechanic to SellQuote and FounderQuote:
- **Title:** "Your property," (smaller, `text-[1.9rem] xl:text-[2.2rem]`) + "Managed" (gold, `text-[3rem] xl:text-[3.5rem] font-medium`) — indented `pl-[4.8rem]` so "M" sits under "p" of "property,"
- **Body text:** "The rental market never slows down - and neither do we. From tenant placement to monthly reporting, our team of dedicated agents and assistants handle everything to give you peace of mind"
- **Gold word:** "dedicated" lights up `#9E8C61` when scrolled to
- Font size: `text-[1.9rem] sm:text-[2.4rem] lg:text-[3rem]` (matches SellQuote and FounderQuote)
- Section: `bg-cnc-bg`, `data-navbar-theme="light"`, natural height (no sticky)

**`manage/page.tsx` updated:**
- Removed `<ManageServices />` import and usage
- Added `<ManageQuote />` after `<ManageHero />`
- Page order: ManageHero → ManageQuote → ManageHandle → PageCTA

---

### Manage Page — ManageHandle Title Redesign ✅

**File:** `apps/web/src/components/manage/ManageHandle.tsx`

- Title changed from "What we handle" (`RevealText onDark`) to **"Our Services"** (`RevealLine`) — matching the SellQuote "Our Promise" pattern
- Format: `<span className="text-[1.9rem] xl:text-[2.2rem] text-white/80">Our </span>` + `<span className="text-cnc-gold font-medium">Services</span>`
- Heading right-aligned (`flex justify-end`)
- Learn More buttons: arrow `→` removed; `PULSE_ANIMATE` + `PULSE_TRANSITION` + `SPRING_HOVER` added (matches sitewide button standard)

---

### Quote Sections — Font Sizes Standardized ✅

All three quote/word-lighting sections now use the same responsive font size:

| File | Old size | New size |
|---|---|---|
| `ManageQuote.tsx` | (new) | `text-[1.9rem] sm:text-[2.4rem] lg:text-[3rem]` |
| `SellQuote.tsx` | `text-[2rem] sm:text-[2.5rem] lg:text-[3.25rem]` | `text-[1.9rem] sm:text-[2.4rem] lg:text-[3rem]` |
| `FounderQuote.tsx` | `text-[2rem] sm:text-[2.5rem] lg:text-[3.25rem]` | `text-[1.9rem] sm:text-[2.4rem] lg:text-[3rem]` |

---

### BuyContemporary — Reversed Animation (committed earlier in session) ✅

**File:** `apps/web/src/components/buy/BuyContemporary.tsx`

Full reversal of the scroll animation direction:
- **Was:** section opens with cluster (RESULTS heading visible) → images explode to corners → WHY CHOOSE fades in
- **Now:** section opens with images at 4 corners + WHY CHOOSE visible → connector lines draw from images toward logo → images collapse into cluster → RESULTS heading fades in

**Final timeline:**
- `p 0.00`: images at corners, WHY CHOOSE visible, no lines
- `p 0.00→0.45`: connector lines draw from image edges toward logo
- `p 0.20→0.45`: WHY CHOOSE fades out
- `p 0.45→0.58`: lines fade out (via `lineOpacity` on `<motion.svg>`)
- `p 0.45→0.70`: images collapse to cluster
- `p 0.45→0.68`: gradient overlays fade in
- `p 0.50→0.68`: RESULTS heading fades in
- `p 0.55→0.70`: watermark fades in
- `p 0.70→0.75`: hold
- `p 0.75→1.00`: exit

**Key fixes during this work:**
- **Animation finishing too late:** Original collapse ran `[0.45, 1.0]` but FAQ section appears at `p=0.75`. Fixed by compressing to `[0.45, 0.70]`. Verified with Puppeteer at `p=0.72` and `p=0.75`.
- **Connector lines persisting in cluster state:** Added `lineOpacity = ramp(p, 0.45, 0.58, 1, 0)` on `<motion.svg style={{ opacity: lineOpacity }}>`.

---

### Simplify Pass — Code Cleanup ✅

Ran `/simplify` with 4 parallel agents (reuse, simplification, efficiency, altitude). Fixes applied (`2237976`):

1. **`ManageHandle.tsx`** — removed dead `text-[2.5rem] xl:text-[3rem]` from `h2` wrapper (children override these); changed gold span from `style={{ color: "#9E8C61", fontWeight: 500 }}` → `className="text-cnc-gold font-medium"`
2. **`SellQuote.tsx`** — "Promise" span: `style={{ color, fontWeight }}` → `className="text-cnc-gold font-medium"`
3. **`ManageQuote.tsx`** + **`SellQuote.tsx`** + **`FounderQuote.tsx`** — added `lastCountRef` guard to `compute()`: skips `setLitCount` when rounded value unchanged (was firing up to 60×/sec even when value was stable at 0 or 1)
4. **`BuyContemporary.tsx`** — fixed comment: `p 0.45 → 1.00` → `p 0.45 → 0.70`

**Skipped:**
- `motion.div` → `motion(Link)` on ManageHandle buttons: introduces new TS error not present before (reverted)
- Extract `useScrollWordLight` hook: valid but requires new file + touching 3 components — out of scope for simplify pass
- Shared Tailwind class for quote body font sizes: requires globals.css change — out of scope

---

### Section / Page Status

| Section / Page | Status |
|---|---|
| Manage Page — Hero | ✅ Approved |
| Manage Page — ManageQuote ("Your property, Managed") | ✅ Built and committed |
| Manage Page — ManageHandle ("Our Services") | ✅ Title redesigned, arrows removed, pulse added |
| Buy Page — BuyContemporary (reversed animation) | ✅ Committed |

---

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. **Review manage page at `/manage`** — confirm ManageQuote and ManageHandle look correct
4. **Continue with remaining work in order:**
   - Checklist templates at `/admin/settings/checklists` (CA Purchase Buyer Side, CA Purchase Seller Side, CA Lease Tenant Side)
   - Phase 6 tasks (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`): ISR, skeleton loaders, sitemap, JSON-LD, rate limiting, CCPA cookie banner, Sentry, PostHog, deploy to Vercel + Railway
   - Phase 7 CRM Expansion (Smart Lists → Deal Pipeline → Lead Ponds → Action Plans → Trigger Automations → Reporting) — **required before launch**

---

## Session Notes — 2026-06-14

### What Was Completed This Session

All changes committed on `claude/real-estate-website-9bdWi` across two commits: `26a3c2d` and `c615574`.

---

### JoinSteps — New Component (replaces JoinStepsSlider) ✅

**New file:** `apps/web/src/components/join/JoinSteps.tsx`
**Deleted:** `apps/web/src/components/join/JoinStepsSlider.tsx`

Replaced the old card-based JoinStepsSlider with the BuySteps sticky-scroll design adapted for the join page:
- Same layout as BuySteps: sticky left panel with title + gold checkmark icon + body text; vertical 2px segmented progress bar; stacked scrolling images on the right
- Images on LEFT, sticky text panel on RIGHT (flipped from BuySteps)
- Text panel is right-aligned (`text-right`, `ml-auto` on body)
- Background: `bg-white`
- Gold checkmark SVG icon replaces step numbers (inlined from `check-mark-circle-2-svgrepo-com.svg`)
- `data-navbar-theme="light"` preserved

**Content mapped from old JoinStepsSlider:**
| Step | Title | Image |
|---|---|---|
| 1 | Full Transaction Management | `join-slide-crm.png` |
| 2 | Personal Webpage | `join-slide-agent.png` |
| 3 | Custom CRM & Email | `join-slide-campaign.png` |

**`join/page.tsx`:** imports `JoinSteps` instead of `JoinStepsSlider`

---

### HowToJoin — Bottom Gradient ✅

**File:** `apps/web/src/components/join/HowToJoin.tsx`

Added `pointer-events-none absolute bottom-0 left-0 right-0 h-40` gradient overlay (`transparent → white`) to blend the off-white HowToJoin section into the white JoinSteps section below.

---

### BuySteps — Full Redesign (Remax-inspired alternating timeline) ✅

**File:** `apps/web/src/components/buy/BuySteps.tsx`

Completely replaced the sticky-panel design with a Remax-style alternating timeline:

**Layout:** Natural scroll, `bg-[#F2F0EF]`, `max-w-7xl` container
- Each step is a flex row: `[left content | w-16 spacer | right content]`
- Steps 1 & 3 (even index): image LEFT, text RIGHT
- Steps 2 & 4 (odd index): text LEFT, image RIGHT
- Center vertical line: `absolute left-1/2`, 4 segments with `gap-4` between them, animated via `useScroll` + 4 `useTransform` calls (one per segment, each covering 25% of scroll range)
- No sticky panel, no `useScrollStepper`

**Per step text block:**
- Gold `01`/`02`/`03`/`04` label (`font-sans text-sm font-medium text-[#9E8C61]`) above title
- Two-tier `RevealLine` title (smaller first word + gold last word)
- `gap-20` between title block and body text
- `max-w-md` body text
- `whileInView` fade + slide animation (`opacity: 0→1`, `x: ±20→0`)

**Per step image:** `h-[340px]` `rounded-2xl` `object-cover`, `whileInView` fade-up

**Removed:** `useScrollStepper`, `AnimatePresence`, sticky panel, horizontal split

---

### ManageHandle — Title Size Fix ✅

**File:** `apps/web/src/components/manage/ManageHandle.tsx`

Added `text-[2.5rem] xl:text-[3rem]` to the "Our Services" `h2` to match the "Our Promise" format from `SellQuote.tsx`.

---

### Section / Page Status

| Section / Page | Status |
|---|---|
| Buy Page — BuySteps (Remax alternating timeline) | ✅ Complete |
| Join Page — JoinSteps (new component) | ✅ Complete |
| Join Page — HowToJoin gradient | ✅ Complete |
| Manage Page — ManageHandle title size | ✅ Fixed |

---

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. **Continue manage page** at `/manage` — review full page visually and finish any remaining body sections
4. **Continue with remaining work in order:**
   - Checklist templates at `/admin/settings/checklists` (CA Purchase Buyer Side, CA Purchase Seller Side, CA Lease Tenant Side)
   - Phase 6 tasks (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`): ISR, skeleton loaders, sitemap, JSON-LD, rate limiting, CCPA cookie banner, Sentry, PostHog, deploy to Vercel + Railway
   - Phase 7 CRM Expansion (Smart Lists → Deal Pipeline → Lead Ponds → Action Plans → Trigger Automations → Reporting) — **required before launch**

---

## Session Notes — 2026-06-15

### What Was Completed This Session

Committed as `1c1dfce` on `claude/real-estate-website-9bdWi`.

---

### Legal Pages — 5 Pages Built and Committed ✅

Before building, reviewed three competitor privacy policies:
- **Rise Realty** (riserealtyca.com/privacy-policy) — full policy read via Puppeteer; California-specific, last updated 4/15/2026. Covers CCPA/CalOPPA, SMS non-sharing, third-party sharing, California users' rights.
- **eXp/AGNT** (agnt.inc/privacy-policy) — global policy (eXp operates in 30+ countries), read via Puppeteer. Key additions: "Do Not Track" signal disclosure, advertising opt-out via NAI/DAA industry groups, email unsubscribe process (10 business days), account deletion right, session-replay technology disclosure.
- **REeBroker PDF** — February 2020 PDF, browser native PDF viewer blocked text extraction. Skipped (too old to be useful for CCPA/CPRA compliance anyway — pre-CPRA Prop 24).

**Pages created:**

| Route | File | Description |
|---|---|---|
| `/privacy` | `(marketing)/privacy/page.tsx` | 16-section CCPA/CPRA + CalOPPA policy — data collection, SMS/TCPA, cookies, advertising opt-out (NAI/DAA), email unsubscribe, CA consumer rights (right to know/delete/correct/opt-out/limit/non-discrimination), Do Not Track disclosure, account deletion, children's policy |
| `/terms` | `(marketing)/terms/page.tsx` | 13-section ToS — permitted use, MLS data disclaimer, no-agency relationship clause, mortgage disclaimer (illustrative only), IP ownership, liability limits, indemnification, CA jurisdiction (Los Angeles County) |
| `/fair-housing` | `(marketing)/fair-housing/page.tsx` | Federal Fair Housing Act (7 protected classes) + CA FEHA (11 additional CA classes including source of income, immigration status, gender identity). HUD, CRD, and DRE complaint contacts. |
| `/dmca` | `(marketing)/dmca/page.tsx` | Designated DMCA agent (info@cncrealtygroup.com), all 6 required elements for valid takedown (17 U.S.C. § 512(c)(3)), counter-notification process, repeat infringer policy |
| `/do-not-sell` | `(marketing)/do-not-sell/page.tsx` | Interactive client component — opt-out button writes to localStorage + opts out PostHog; shows "already opted out" if consent=denied; email opt-out path; non-discrimination statement; link to Privacy Policy |

**NOT built:** `/mls-disclaimer` — see decision below.

**All pages share:** dark `bg-[#1B1B1B]` header / off-white `bg-[#F2F0EF]` content layout, `info@cncrealtygroup.com`, CA DRE #02439028.

**⚠️ Pending attorney review before launch** — these pages should be reviewed by a California real estate lawyer before the site goes live.

---

### MLS Disclaimer Page — Decided NOT to Build

**Decision:** Ryan asked if a dedicated `/mls-disclaimer` page is legally required. The answer is no:
- CRMLS/IDX compliance requires the disclaimer to appear **inline on each listing page** — which we already satisfy via `CrmlsDisclaimer.tsx` on the property drawer and detail pages.
- eXp, Rise Realty, and REeBroker do not have a standalone MLS disclaimer page in their footers — they only show the disclaimer inline on listing pages.
- A dedicated page would be redundant extra work with no legal benefit.

**Action taken:**
- Deleted `(marketing)/mls-disclaimer/page.tsx`
- Removed `{ href: "/mls-disclaimer", label: "MLS Disclaimer" }` from `LEGAL_LINKS` in `Footer.tsx`
- The inline `CrmlsDisclaimer.tsx` on listing pages remains unchanged — that IS required for IDX compliance.

---

### Footer — Needs Review (⚠️ Flagged for Next Session)

Ryan flagged that there is work to do on the footer links and pages. Specifically:
- The current `LEGAL_LINKS` in `Footer.tsx` are: Privacy Policy | Terms | Fair Housing Notice | DMCA Notice | Do Not Sell or Share My Personal Information
- Ryan wants to review these links and potentially the footer layout/content in the next session before launch.

**Do NOT launch without reviewing footer links with Ryan.**

---

### Current Footer Legal Links State

After removing the MLS disclaimer, `LEGAL_LINKS` in `Footer.tsx` is:
```ts
const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms" },
  { href: "/fair-housing", label: "Fair Housing Notice" },
  { href: "/dmca", label: "DMCA Notice" },
  { href: "/do-not-sell", label: "Do Not Sell or Share My Personal Information" },
];
```

---

### Next Session — Start Here (superseded — see 2026-06-16 session below)

---

## Session Notes — 2026-06-16

### What Was Completed This Session

Committed across five commits on `claude/real-estate-website-9bdWi`: `c7766b6`, `f559e08`, `822f54d`, `ada3394`, `a1cee41`.

---

### Sell Page CTA — Request Valuation Now Opens Contact Modal ✅

`PageCTA.tsx` previously only let the **secondary** button open `ContactModal` (via `showContactModal`); the primary button was always a `Link`. Added a new opt-in prop `primaryShowContactModal` so the primary button can open the modal too, without touching buy/rent/manage (their primary buttons stay real navigation links to `/properties`).

- `PageCTA.tsx` — added `primaryShowContactModal` prop, mirrors the existing secondary-button conditional pattern
- `sell/page.tsx` — "Request Valuation" now passes `primaryShowContactModal` instead of `primaryHref="/contact"`, matching "Message"

---

### Join Page — Step Copy Tightened ✅

`HowToJoin.tsx` step titles: "Approval" → "Approve", "Onboarding" → "Onboard" (now "Apply", "Approve", "Onboard", "Win" — consistent one-word/imperative style).

---

### News Page Renamed to Press, New Half-Height Hero ✅

Ryan noticed the News page had no hero section (unlike buy/sell/rent/manage/join, which all use full-bleed video-mask heroes), then asked to rename the whole section from "News" to "Press."

**Route rename:** `/news` → `/press` (and `/news/[slug]` → `/press/[slug]`), git tracked these as renames. Updated every internal reference: `Navbar.tsx` and `Footer.tsx` nav links/labels, `BlogCard.tsx` and `BlogHero.tsx` post links, the admin "View live" link in `(dashboard)/admin/blog/[id]/edit/page.tsx`, and the slug preview text in `BlogEditorForm.tsx`. Page metadata title is now "Press | CnC Realty Group". `NewsHero.tsx` renamed to `PressHero.tsx`.

**`VideoMaskHero.tsx` generalized** (shared by buy/sell/rent/manage/join heroes — all existing usages unaffected since new props default to prior behavior):
- `lines` widened from a fixed 2-tuple to `string[]`, with a `LINE_Y` lookup table supporting 1-line (centered, y=540) or 2-line (y=400/710) layouts
- New `heightClass` prop (default `h-[95vh]`) — Press hero uses `h-[47.5vh]` (half-size, per Ryan's request)
- New `playbackRate` prop (default `1`) — set via a video `ref` callback since it's not a JSX attribute; Press hero uses `0.5` (half speed)
- New `overlayOpacity` prop (default `0`, opt-in) — a plain dark `<div>` between the video and the SVG text-mask, so the masked-out letter cutouts (which show full video brightness) get dimmed too; Press hero uses `0.35` for legibility against a busy/bright video

**Video asset:** Ryan supplied `12991839-hd_1280_720_60fps.mp4` (1280×720, ~6MB), copied to `apps/web/public/videos/news-hero.mp4` (filename kept as-is; only the route/labels changed to Press).

**Hero copy:** Single line, "PRESS" (was going to follow the "X WITH US" pattern other heroes use, but Ryan wanted just the one word).

---

### Legal Pages / Footer Restructuring — Committed As-Is ✅

Found already sitting uncommitted in the working tree at session start (not done by Claude this session — likely Ryan's own edits, or carried from an earlier uncommitted state). Per CLAUDE.md's 2026-06-15 notes this was flagged "Do NOT launch without reviewing footer links with Ryan." Asked Ryan how to handle it before committing; he said commit it as-is alongside tonight's work.

**What changed vs. the 2026-06-15 state:**
- `/dmca` and `/do-not-sell` pages **deleted entirely** (routes no longer exist — previously these were two of the "5 legal pages")
- New `/accessibility` page added
- `/fair-housing`, `/privacy`, `/terms` content edited
- `Footer.tsx` `LEGAL_LINKS` is now just `Accessibility | Privacy Policy | Terms` (down from 5 links) — Fair Housing is no longer a text link in `LEGAL_LINKS` but is now represented by a clickable EHO (Equal Housing Opportunity) logo image (`/eho-logo.png`) linking to `/fair-housing` in the bottom legal bar
- `Navbar.tsx` — transparent-navbar path list extended to include `/accessibility`, `/privacy`, `/terms`, `/fair-housing`

**⚠️ Still flagged for Ryan's attention next session:** this is now committed to git history, but has **not** been visually reviewed in-browser this session. In particular, worth double-checking that fully removing the dedicated `/do-not-sell` page (rather than just relinking it) is the intended final CCPA approach, since the 2026-06-15 notes describe that page as having an interactive opt-out button (localStorage + PostHog opt-out) — confirm that functionality lives somewhere else now (e.g. the cookie banner) or was intentionally retired.

---

### Other Files Committed This Session

- `apps/web/public/images/manage-*.jpg` (6 files) — image assets referenced by the already-committed `ManageHandle.tsx`, were untracked until now
- `docs/superpowers/plans/2026-06-15-blog-system.md`, `docs/superpowers/plans/2026-06-15-manage-handle-contact-modal.md` — planning docs from earlier subagent-driven-development work this session, hadn't been committed yet

---

---

## Session Notes — 2026-06-16 (Evening)

### Third-Party Services Completed This Session

All remaining third-party services are now fully set up and credentials are in `apps/web/.env.local`:

**SendGrid** (completed earlier in session, carried over from prior context):
- Domain authenticated (DKIM CNAMEs + DMARC TXT in Hostinger DNS) ✅
- API key generated (Full Access) and added to `.env.local` ✅
- Free tier: 100 emails/day

**Upstash Redis** ✅
- Database: "CnC Realty", region: N. California (us-west-1), AWS, Free tier
- Used for: property search result caching + rate limiting on public forms
- Credentials in `.env.local`: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- Free forever at CnC's traffic levels (500k commands/month)

**Cloudflare R2** ✅
- Account created (ryanvchong@outlook.com), credit card on file
- Bucket: `cnc-realty`, Standard storage, Automatic region (Western North America)
- API token: "R2 Account Token", Object Read & Write, all buckets, Forever TTL
- Credentials in `.env.local`: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- Free tier: 10GB/month storage, 1M writes, 10M reads
- Used for: transaction document uploads, agent profile photos

**Vercel** ✅ (project created, NOT yet deployed)
- Account: ryanvchong@outlook.com, Hobby plan (free)
- Project: `cnc-realty-web` at `cnc-realty-web.vercel.app`
- GitHub connected: `ryanczoo/CnC-Realty`, branch `claude/real-estate-website-9bdWi`, root dir `apps/web`
- All env vars loaded from `.env.local` (except `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` — deleted since empty, must be added before production deploy)
- `NEXTAUTH_URL` set to `https://cncrealtygroup.com` (not localhost)
- **NOT deployed yet** — Hobby plan blocks cron jobs (our IDX sync runs every 15 min)

### Key Decisions Made

- **Lead routing:** Ryan manually assigns all leads from the website. No auto round-robin. Lead Ponds (Phase 7) is optional fallback only.
- **Vercel deploy blocked until:** (1) Upgrade to Pro ($20/mo), (2) Add `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`, (3) Phase 6 + Phase 7 complete
- **Google OAuth deferred** — not required for launch, add before going live
- **Cloudflare R2 is required** — agents need document uploads almost immediately after launch

### .env.local Status (as of this session)

All vars populated except `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (intentionally deferred).

---

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. **Review the legal pages/footer restructuring** — confirm `/do-not-sell` removal was intentional and that CCPA opt-out is still satisfied; spot-check `/accessibility`, `/privacy`, `/terms`, `/fair-housing` content and EHO logo footer link
4. **Visually check `/press`** — hero and post grid
5. **Ryan's Join page fixes** — Ryan has changes he wants to make to the Join page
6. **Continue with remaining work in order:**
   - Checklist templates at `/admin/settings/checklists` (CA Purchase Buyer Side, CA Purchase Seller Side, CA Lease Tenant Side) — Ryan's task
   - Phase 6 tasks (`docs/superpowers/plans/2026-05-22-phase-6-launch.md`): ISR, skeleton loaders, sitemap, JSON-LD, rate limiting
   - Phase 7 CRM Expansion (Smart Lists → Deal Pipeline → Lead Ponds → Action Plans → Trigger Automations → Reporting) — **required before launch**
   - When ready to go live: upgrade Vercel to Pro, set up Google OAuth, add missing env vars, deploy

---

## Session Notes — 2026-06-22

### What Was Completed This Session

Committed as `331cac7` on `main`.

---

### Agent Profile Hero — Full Redesign ✅

**File:** `apps/web/src/components/agents/AgentProfileHero.tsx`

Completely rewrote the agent profile hero to match the FIND real estate layout (`findrealestate.com/agents/jamiesittner`) with three CnC-specific differences: no star ratings, no contact buttons below the headline, and custom stat cards.

**Three-section layout:**

1. **Light hero section** (`bg-[#F2F0EF]`) — Large headline with the agent's circular photo embedded inline inside the `<h1>`, FIND-style. The "I'm [photo]" portion uses `white-space: nowrap` so the photo never detaches from the "I'm". Photo is a `relative inline-block overflow-hidden rounded-full` span with Next.js `<Image fill>` inside. Font: `clamp(2.4rem, 5.5vw, 5rem)`, `letter-spacing: -0.03em`. CA DRE license shown below in faded text.

2. **Dark stats section** (`bg-[#151717]`) — 4 cards: Years of Experience (Clock icon), Listings Closed (Home icon), Volume Closed (TrendingUp icon), Properties Rented (KeyRound icon). Mobile: horizontal snap-scroll; desktop: 4-col grid. Each card: `rgba(33,33,33,0.9)` bg, `1px solid rgba(179,179,179,0.1)` border, icon top-left, large white number + gray label bottom.

3. **Bio + Specialties** (`bg-[#F2F0EF]`) — Only renders if bio or specialties exist. Gold uppercase "ABOUT" / "SPECIALTIES" label above each.

**Icons:** Lucide React (`Clock`, `Home`, `TrendingUp`, `KeyRound`) — server-component safe.

---

### propertiesRented Stat — DB + API + Settings UI ✅

Added full support for tracking how many properties an agent has rented:

**Schema:** `propertiesRented Int @default(0)` on `Agent` model — migration `20260622070213_add_properties_rented` applied to Railway DB.

**Files changed:**
- `packages/database/prisma/schema.prisma` — field added
- `apps/web/src/app/(agents)/agents/[slug]/page.tsx` — added to Prisma select, passed as prop
- `apps/web/src/components/agents/AgentProfileHero.tsx` — consumed in stats array
- `apps/web/src/app/api/account/agent-profile/route.ts` — GET selects it; PATCH writes `Math.max(0, Number(...) || 0)` (non-nullable)
- `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx` — state, load effect, save payload, and UI input all added (appears after "Years of Experience" in the Agent Profile form)

**Prisma DLL lock issue (Windows):** When `prisma migrate dev` runs `prisma generate` while the dev server is holding the `query_engine-windows.dll.node` file, the binary rename fails with EPERM. Fix: kill all node processes → run `pnpm --filter @cnc/database exec prisma generate` → restart dev server.

---

### Agent Title — Admin Editing ✅

**Migration:** `20260622052443_add_agent_title` — added `title String?` to Agent model (e.g. "Listing Specialist", "Buyer's Agent").

**Files:**
- `apps/web/src/app/(dashboard)/admin/agents/AgentTitleEditor.tsx` — inline editable field (click to edit, PATCH to `/api/admin/agents/[id]`)
- `apps/web/src/app/api/admin/agents/[id]/route.ts` — PATCH route, `requireAuth("ADMIN")`, validates and updates `title`
- `apps/web/src/app/(dashboard)/admin/agents/page.tsx` — integrates AgentTitleEditor

---

### Prisma EPERM Fix — Important Note for Windows

The dev server holds a lock on `query_engine-windows.dll.node`. Any time you need to run `prisma generate` or `prisma migrate dev` (which internally runs generate), you must:
1. `Stop-Process -Name "node" -Force` in PowerShell
2. Run `pnpm --filter @cnc/database exec prisma generate`
3. Restart dev server with `pnpm --filter web dev`

---

### Join Page / Dashboard — Misc Polish ✅

Assorted CRM and join-page improvements committed alongside the above:
- `LeadKanban.tsx`, `LeadDetailSidebar.tsx`, `LeadTasksTab.tsx`, `NewLeadModal.tsx`, `TagPicker.tsx` — Phase 7 subagent polish
- `JoinSteps.tsx` — minor copy/image fix (`join-slide-campaign.png` recompressed)
- `Navbar.tsx` — minor tweak
- `r2.ts`, `leads/route.ts`, `account/profile/route.ts`, `headshot/[userId]/route.ts` — backend fixes
- `seed.ts` — sample data added
- Phase 7 sub1/sub3/sub6/sub7/sub8 specs and plans committed to `docs/superpowers/`

---

### What Still Needs to Be Done

| Task | Priority |
|---|---|
| **Join page** — still has work to do (user said "we have a lot of work to do still for this join page") | High |
| **Dashboard** — still has work to do | High |
| Checklist templates at `/admin/settings/checklists` (CA Purchase Buyer Side, CA Purchase Seller Side, CA Lease Tenant Side) | Medium |
| Phase 6: ISR, skeleton loaders, sitemap, JSON-LD, rate limiting, Sentry, PostHog, deploy | Medium |
| Phase 7 CRM Expansion: Smart Lists → Deal Pipeline → Lead Ponds → Action Plans → Trigger Automations → Reporting | Required before launch |

---

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. **Join page** — navigate to `/join` and review what still needs work
4. **Dashboard** — navigate to `/dashboard` and review what still needs work
5. User said both join page and dashboard have remaining work — let Ryan direct which to tackle first

---

## Post-Deploy: SendGrid Inbound Parse Webhook (Hostinger DNS)

**Do this AFTER the site is live on Vercel with cncrealtygroup.com pointing at it.**

The MX record is already in Hostinger DNS: `MX | reply | 10 | mx.sendgrid.net`

When ready to deploy, configure the webhook in SendGrid:
1. SendGrid → Settings → Inbound Parse → Add Host & URL
2. Host/Domain: `reply.cncrealtygroup.com`
3. Webhook URL: `https://cncrealtygroup.com/api/action-plans/inbound`

That's it. The DNS is already done — this is the only remaining step after deploy.

---

## Session Notes — 2026-06-22 / 2026-06-23

### What Was Completed This Session

All changes committed in git: `9ce1496`

---

### Agent About Section — Polish

- **Photo column** reduced from 38% → 29% width; background changed from `#2A2A2A` → `#E0DDD8` to match hero photo (seamless morph handoff)
- **Bio font** changed to `font-sans text-4xl font-medium leading-relaxed text-white/62`
- **"About Me" label** → `About {firstName}` (uses agent's first name)
- **Removed** the `<h2>` heading ("I'm Ryan Chong, a Licensed Real Estate Broker")
- **Removed** DRE # block from under photo
- **Removed** divider line above fields
- **Added** Location / Language / License fields below social icons (FIND-style)
- Bio column padding increased: `md:pl-16 lg:pl-24`

### LinkedIn — Removed Everywhere

Removed from all 6 touchpoints:
- `AgentAboutSection.tsx` — `linkedin` prop + `LiIcon` component removed
- `AgentProfileHero.tsx` — prop removed
- `agents/[slug]/page.tsx` — Prisma select + prop removed
- `settings/page.tsx` — state, load effect, save payload, UI field removed
- `agent-profile/route.ts` — select, destructuring, data assignment removed
- `join/agent/page.tsx` — FormData type, state, Step 3 UI, Step 4 review removed

**Decision:** Nobody cares about a real estate agent's LinkedIn profile.

---

### Agent Profile — New DB Fields (Migration: `20260623035930_add_agent_location_language`)

Added to Prisma `Agent` model:
- `location String?` — area the agent serves (e.g. "Los Angeles County, Orange County")
- `language String?` — languages spoken (e.g. "English, Cantonese")

These are editable in the Settings **Profile card** (left column), under Display Name, and save via `/api/account/profile`. They flow through to the About section on the public agent page.

---

### Settings Page — New Fields

**Profile card (left column) — new fields added under Display Name:**
- Location Served (text input, no placeholder)
- Languages Spoken (text input, no placeholder)
- Both save with the existing "Save Changes" button via `/api/account/profile` PATCH

**Agent Profile card (right column) — new fields added between Years of Experience and Properties Rented:**
- Listings Closed (whole numbers only, `step={1}`, strips non-digits)
- Volume Closed (formatted with commas as you type, e.g. `1,500,000`; stripped on save)
- Properties Rented (whole numbers only)
- Years of Experience (whole numbers only)

**"View Public Profile" button** added below "Save Agent Profile" button — outlined pill, opens agent's public page in new tab. Only renders once slug loads.

---

### Agent About Section — Email Icon

Added email icon to the left of the Instagram icon in the social row. Uses the agent's User account email (`agent.user.email` via Prisma join). Opens `mailto:` to launch mail app. Works automatically for every agent.

---

### Dashboard Tab Switcher — Redesigned

**Before:** Two pill buttons ("Overview" / "My Stats") always shown — admins saw a lone gold "Overview" button that did nothing.

**After:**
- Admins: tab bar hidden entirely, no button shown
- Non-admins: single gold "My Stats" button in the top-right, inline with "Overview" heading, above the Closed stat card
- Clicking "My Stats" → switches view; "← Overview" button appears in same position to go back

---

### Join Page — Apply Now Button

- Removed arrow (`→`) from button text
- Moved button left to `ml-[1.5rem]` (more under the word "Join")

---

### AgentAboutLineArt — Scroll Speed Tuned

Animation draw speed tuned:
- Original: completes at ~88% of scroll (too slow)
- After first change: completes at ~48% (too fast)
- **Final:** completes at ~67% of scroll — draw duration `0.16`, stagger `0.03` per path

---

### Agent Reviews Section

- Removed the "5.0 · 3 reviews" star rating row from the section header
- Reviews remain hardcoded placeholders — **decision made to keep fake reviews for now**
- To add a real review: tell Claude "Add a review for [Agent] from [Name], [Role] — [stars] stars, '[text]'"

---

### Key Decisions Made

1. **Reviews stay fake** — no client submission flow needed. Ryan will supply review text per agent.
2. **LinkedIn removed permanently** — not relevant for real estate agents.
3. **Location and language are free-text fields** — agents type whatever they want (e.g. "English, Cantonese").
4. **Volume Closed is dollar amount** — agents enter raw number, commas auto-format for readability.
5. **Always ask before placing any new UI element** — Claude must ask Ryan where to put things before coding.

---

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. Navigate to `/agents/ryan-chong` to verify all About section changes look correct
4. Navigate to `/dashboard/settings` to verify new Profile fields (Location, Language, Listings Closed, Volume Closed) load and save correctly
5. Check the dashboard Overview page — confirm the lone gold "Overview" button is gone for admins
6. Ryan to direct next area of work

---

## Session Notes — 2026-06-24

### What Was Completed This Session

All changes committed as `9dab434` on `main`.

---

### Agent Public Page — Transactions Section (New) ✅

**New file:** `apps/web/src/components/agents/AgentTransactionsSection.tsx`

Added a "[First Name]'s Transactions" section below the Client Reviews section on every agent's public profile page.

**Layout decisions:**
- Section background: `bg-white`; cards: `bg-cnc-bg` (`#F2F0EF`) — reversed from first attempt after Ryan said "reverse that"
- Gradient bridges at top (`#F2F0EF → white`) and bottom (`white → #F2F0EF`) via inline absolute divs to blend with adjacent sections
- Title: left-aligned, same two-tier style as "Client Reviews" — muted `text-[#1B1B1B]/70` "[firstName]'s " + gold `text-cnc-gold font-medium` "Transactions"
- **Grid:** 2 rows × 3 columns, `PER_PAGE = 6`
- **Card shape:** `flex items-center gap-4` — 78×78px house SVG thumbnail left, bold price, stats line (agent side + close date), address — all with `mb-2` spacing and `text-[#1B1B1B]/45` grey for stats AND address
- **Pagination:** FIND-style numbered (no arrows), ellipsis logic when `totalPages > 7`
- **Empty state:** Plain `<p>` text "Coming soon..." (no dashed border box) — bare centered text only

**Data source:**
- `page.tsx` already queries `prisma.transactionFile.findMany({ where: { agentId, status: "CLOSED" } })` and passes `transactions` prop — no changes needed there
- Component maps real data via `realToDisplay()` — shows actual sale/list price, agent side label, and close date
- When `transactions.length === 0` → shows "Coming soon..." instead of fake placeholders

---

### Agent Public Page — Client Reviews Carousel Restored ✅

**File:** `apps/web/src/components/agents/AgentReviewsSection.tsx`

The full placeholder carousel was accidentally removed in a previous session. Restored completely:

- All 7 PLACEHOLDER_REVIEWS: Sarah M. (Home Buyer), James T. (Home Seller), Priya K. (First-Time Buyer), Michael R. (Home Buyer), Linda C. (Home Seller), David & Amy W. (Relocation Buyers), Tony B. (Repeat Client)
- Gold star row (5 stars, `fill-[#9E8C61]`)
- Italic review text in `text-[#1B1B1B]/60`
- Author avatar circle + name + role
- `motion.div` horizontal scroll with `containerRef` measuring card width dynamically
- Prev/Next arrow buttons with `PULSE_ANIMATE` + `PULSE_TRANSITION` + `SPRING_HOVER` (matches sitewide button standard)
- `VISIBLE = 3`, `MAX_IDX = PLACEHOLDER_REVIEWS.length - VISIBLE`

**Empty state change (both sections):**
- Removed the `rounded-2xl border border-dashed border-[#1B1B1B]/15 py-16` wrapper div
- Now just: `<p className="py-16 text-center font-sans text-sm text-[#1B1B1B]/35">Coming soon...</p>`

---

### Key Decisions Made

1. **Reviews stay fake** — no client submission flow. Ryan will supply review text per agent when ready.
2. **Transactions section is fully data-driven** — when an agent closes a deal in the CRM (status `CLOSED`), it automatically appears on their public page. No manual work needed.
3. **Both section empty states are plain text** — no box, no border. Just the bare "Coming soon..." sentence.
4. **Section background contrast:** Transactions section is `bg-white` with `bg-cnc-bg` cards; Reviews section is `bg-cnc-bg` with `bg-white` cards.

---

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. Navigate to `/agents/ryan-chong` — review the Client Reviews carousel and the Transactions section beneath it
4. Ryan to direct next area of work

---

## Session Notes — 2026-06-29

### What Was Completed This Session

All changes committed as `c97c752` on `main`.

---

### AgentPlan — City Photo Swap + Crop ✅

**File:** `apps/web/src/components/join/AgentPlan.tsx`
**Asset:** `apps/web/public/images/join-city.jpg`

- Replaced the previous city photo with the LA skyline aerial shot (`pexels-mr-location-scout-22994825-6644764.jpg` from Downloads)
- Crop adjusted to `object-[center_55%]` — frames the warm orange/pink sky + skyline band, cutting out the blue cloudy top (matching the panoramic strip style of Image #8)
- Photo wrapper width reduced from `w-full` → `w-[80%]` — user said it looked "a little wide"

---

### BuyFeatures — Thumbs Up SVG + Feature Text ✅

**File:** `apps/web/src/components/buy/BuyFeatures.tsx`

- `IconThumbsUp` replaced with a clean stroke-based thumbs-up path (the original filled path was rendering as thumbs down)
- Feature text updated:
  - "Certified lenders for instant approval" → "Award-winning lenders for instant approval"
  - "Award-winning Escrow officers" → "Certified escrow officers to close with confidence"

---

### HowToJoin — Top Gradient + Sticky House Photo ✅

**File:** `apps/web/src/components/join/HowToJoin.tsx`

- Added gradient at top (`from-white to-transparent`) to blend into JoinSteps white section above
- House photo column is now `sticky top-28 self-start` — stays visible while scrolling through all 4 steps, mirroring the heading

---

### SellValues — Image Fix ✅

**File:** `apps/web/src/components/sell/SellValues.tsx`

- Replaced `<Image fill>` (next/image) with plain `<img>` tags for all 5 value cards
- Root cause: `next/image` with `fill` mode fails silently inside Framer Motion `motion.div` elements — CSS transforms break the browser's IntersectionObserver so lazy-loaded images never render. Punctuality and Compassion photos were invisible.
- Fix: plain `<img className="absolute inset-0 h-full w-full object-cover">` bypasses Next.js lazy loading entirely

---

### Contact Form — Sitewide Updates ✅

Applied the same set of changes to all three contact form surfaces:
- `apps/web/src/components/ui/ContactModal.tsx` (general popup)
- `apps/web/src/components/manage/ManageContactModal.tsx` (manage page popup)
- `apps/web/src/app/(marketing)/contact/page.tsx` (contact page)

**Changes made to all three:**
1. **Labels left-aligned** — added `text-left` to all field labels (First Name, Email, I am a, Message)
2. **Placeholders removed** from First Name and Email fields (were "First name" / "your@email.com")
3. **Message placeholder** changed to `"Type away..."`
4. **Role options updated** — removed "Home" prefix: "Home Buyer" → "Buyer", "Home Seller" → "Seller", "Home Owner" → "Owner"
5. **"Agent" added** as the first option in the "I am a" dropdown (above Buyer)

**Final ROLE_OPTIONS order:** Agent, Buyer, Seller, Owner, Renter, Landlord, Property Manager

---

### Key Decisions Made

1. **City photo crop:** `object-[center_55%]` on a `h-[260px] w-full object-cover` image gives the right panoramic strip framing the LA skyline
2. **Photo width:** `w-[80%]` on the wrapper is the right size — not too wide
3. **SellValues fix:** Plain `<img>` tags are the correct long-term approach for images inside Framer Motion transformed elements — do not use `next/image fill` there
4. **Contact form labels:** All form labels across the site should be `text-left` — centered labels look wrong
5. **"Agent" as first option:** Makes sense since agents may use the contact form to reach out about joining

---

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. Ryan to direct next area of work — remaining items in priority order:
   - **Join page** — review any remaining polish needed
   - **Dashboard** — review any remaining work
   - **Checklist templates** at `/admin/settings/checklists` (CA Purchase Buyer Side, CA Purchase Seller Side, CA Lease Tenant Side)
   - ~~Phase 6 tasks~~ ✅ Complete
   - ~~Phase 7 CRM Expansion~~ ✅ Complete

---

## Session: 2026-06-29 / 2026-06-30 — Navbar Fixes, ICA Checkbox, /join/ica Page

**Branch:** `feature/agent-application-redesign`
**Commit:** `a728341`

### What Was Done

#### 1. SendGrid Plan Clarification
- Ryan's SendGrid account is on **Free Trial** (Email API, unlimited until Aug 16, 2026) + auto-bundled **Marketing Campaigns** (unused, $0)
- **Decision:** Upgrade Email API to **Essentials (~$19.95/mo) before Aug 16, 2026** — all CRM emails go through `@sendgrid/mail` npm package → Email API plan. Marketing Campaigns is a separate drag-and-drop newsletter UI product that CnC does not use.

#### 2. Navbar Fix — /join/apply, /setup-account, /join/ica

**Root cause (systematic-debugging):** Pages with an off-white (`bg-[#F2F0EF]`) background were being excluded from `isTransparent` in `Navbar.tsx` (correct) BUT still had `data-navbar-theme="light"` on their `<main>` element (wrong). That attribute sets `navTheme = "light"` → `useLightElements = true` → `filter: invert(1)` on logo = dark logo on dark navbar = invisible.

**Fix applied to two files:**
- `apps/web/src/app/(marketing)/join/apply/page.tsx` — removed `data-navbar-theme="light"` from `<main>`
- `apps/web/src/app/(marketing)/setup-account/page.tsx` — removed `data-navbar-theme="light"` from `<main>`
- `apps/web/src/components/layout/Navbar.tsx` — added `pathname !== "/join/ica"` to `isTransparent` exclusion list (already had `/join/apply` and `/setup-account`)

**Rule going forward:** `data-navbar-theme` is ONLY for transparent-navbar pages that scroll over different-colored sections (homepage, sell page, join landing, etc.). Any page with a solid dark navbar exclusion must NOT have this attribute.

#### 3. ICA Checkbox Label Legibility Fix

**File:** `apps/web/src/components/join/ApplicationForm.tsx` (lines ~494–507)

The checkbox label text was invisible (white on off-white) when the ICA had not been opened yet, because the `text-[#1B1B1B]` color class was inside the conditional that toggled `opacity-40`. Fixed by always applying `text-[#1B1B1B]` and only toggling the opacity:

```jsx
// Before — text color lost when !icaOpened
className={`... ${!icaOpened ? "cursor-not-allowed opacity-40" : "text-[#1B1B1B]"}`}

// After — text always dark, only opacity changes
className={`... text-[#1B1B1B] ${!icaOpened ? "cursor-not-allowed opacity-40" : ""}`}
```

#### 4. /join/ica Page Created

**File:** `apps/web/src/app/(marketing)/join/ica/page.tsx`

- Created from `docs/cnc-ica-draft.md` (which also exists as `C:\Users\hey_r\Downloads\CnC-Realty-ICA-DRAFT.docx`)
- Renders all 26 sections with clean legal document typography on `bg-[#F2F0EF]`
- Includes E&O supplement fee table (Section 7.2) and Fee Schedule Summary table at bottom
- Prominent DRAFT banner at top: "Pending attorney review — not legal advice"
- Signature block with ruled lines for print/reference
- The "Read the CnC ICA →" button in `ApplicationForm.tsx` opens this page in a new tab; clicking it gates the ICA agreement checkbox (`icaOpened` state + `icaOpenedAt` timestamp)

### Key Decisions

1. **No `data-navbar-theme` on solid-dark-navbar pages** — only transparent-navbar pages use this attribute
2. **ICA is a link-gated checkbox, not an e-signature service** — applicant must click the ICA button (opening `/join/ica`) before the agreement checkbox enables; `icaOpenedAt` timestamp is stored with the application
3. **ICA draft is pending real estate attorney review** — Ryan targeting review by 2026-06-07 (already passed); follow up. Do NOT use as binding legal document until reviewed.
4. **SendGrid upgrade deadline: Aug 16, 2026** — Email API free trial ends; upgrade to Essentials before then

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. Test the full agent application flow end-to-end at `/join/apply`:
   - Fill out form → click ICA button (opens `/join/ica`) → checkbox enables → submit
   - Check admin queue at `/admin/applications`
   - Approve → verify setup email sent → agent sets password → logs in
4. Clean up test DB records (Test Applicant REJECTED, Jane Agent APPROVED) before launch
5. Ryan to direct next area of work after testing

---

## Session: 2026-07-01 / 2026-07-02 — Join Page Polish, /join/ica Polish, ApplicationForm Overhaul

**Branch:** `feature/agent-application-redesign`

### What Was Done

#### 1. AgentPlan.tsx — "For Agents, By Agents" heading alignment
- Shifted "For Agents," left with `-ml-[4rem] xl:-ml-[4.8rem]` so "Agents," sits directly above "By" in the second row

#### 2. /join/ica Page Polish
- Widened container from `max-w-3xl` → `max-w-6xl`
- Body text bumped from `text-sm` → `text-base`
- Section headings bumped from `text-base` → `text-xl`
- Title "Independent Contractor Agreement" — centered, `font-medium`, `text-3xl`
- "CnC Realty Group" label above title — centered
- Added `mt-14` spacing between title and intro paragraph
- Filled in CnC DRE License No. `02439028` in the intro paragraph
- **Fixed brokerage name throughout:** "CnC Realty Group" → "CnC Realty" (18 occurrences) — the brokerage is only called "CnC Realty"; "Group" only appears in the domain name

#### 3. ApplicationForm.tsx — Major overhaul
- Container widened: `max-w-2xl` → `max-w-4xl`
- Title changed from "Apply to Join CnC Realty" → "Welcome to CnC Realty" using the same two-tone inline `RevealLine` pattern as "Exclusive Listings" on the homepage ("Welcome to" smaller at `text-[1.9rem]`, "CnC Realty" larger at `text-[2.5rem]` in gold `#9E8C61`)
- Added `pt-32` top padding for breathing room below navbar
- `* indicates required` moved to below the DOB field
- Removed numbered section prefixes (`01 —`, `02 —`, etc.)
- Section headings bumped to `text-xl`
- All input fields changed from `bg-[#F2F0EF]` → `bg-white` for visibility
- Phone field: auto-formats to `XXX-XXX-XXXX` as user types; placeholder removed
- ZIP code: digits only, capped at 5 characters
- DRE License #: digits only, capped at 8 characters; placeholder removed
- Years Licensed: capped at 2 digits (max 99); placeholder "0" removed
- DOB field: narrowed to one-third width (matches City field); grey text when empty, dark when filled
- License Expiration Date: same grey/dark treatment as DOB
- Email: format-validated on submit (`x@x.x` regex) — catches gibberish, setup email serves as real-world verification
- "Broker Associate" → "Broker" for license type
- "Former Brokerage" label → "Current or Most Recent Brokerage"; placeholder → "N/A if not applicable"
- Commission entity buttons: switched from `grid-cols-2` to `flex flex-wrap gap-x-10` to eliminate excessive horizontal gap
- **Removed entire "Specialties & Bio" section** — specialties had no connection to the agent dashboard or settings page; bio/Instagram/Facebook are already editable in agent Settings post-approval

### Key Decisions

1. **"CnC Realty" not "CnC Realty Group"** — the brokerage name is CnC Realty; "Group" only appears in the domain (cncrealtygroup.com). Fix everywhere it appears in UI copy.
2. **Specialties removed from application** — were never wired to the agent dashboard. Agents manage bio/social links in their Settings page post-approval.
3. **Email validation approach** — client-side format check only. The setup email sent on approval is the real-world verification; if the email is wrong the agent never receives the password link.
4. **Railway DB proxy (kodama.proxy.rlwy.net:51294) was unreachable** — transient P1001 error, DB shows Online in Railway dashboard. Should resolve on its own; no action needed.

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. Test the full agent application flow end-to-end at `/join/apply`:
   - Fill out form → click "Read the CnC ICA →" button (opens `/join/ica`) → checkbox enables → submit
   - Check admin queue at `/admin/applications`
   - Approve → verify setup email sent → agent sets password at `/setup-account` → logs in
4. Clean up test DB records (Test Applicant REJECTED, Jane Agent APPROVED) before launch
5. Ryan to direct next area of work after testing

---

## Session Notes — 2026-07-03

Ryan's computer died mid-session with the previous day's work (Membership Association fields, ICA section 2.2) uncommitted. Verified on resume: migration was already applied to the Railway DB, new test passed, no new TypeScript errors — nothing was lost. **Still uncommitted at end of this session** — Ryan wanted to review in-browser before committing.

### DateField — Typeable Date Inputs (uncommitted)

**New file:** `apps/web/src/components/ui/DateField.tsx`

Native `<input type="date">` (esp. iOS Safari's wheel-only picker) made entering a birthdate painful. Built a reusable segmented MM/DD/YYYY text component:
- Three separate segment inputs, auto-advances focus forward as each segment completes; Backspace on an empty segment moves focus back
- Month clamps 1–12, Day clamps 1–31 (clamped once 2 digits are entered)
- Year: optional `minYear`/`maxYear` props, clamped on blur once 4 digits are entered; no bounds if omitted
- Calendar icon button still opens a hidden native `<input type="date">` via `.showPicker()`/`.click()` — so the native picker remains available for anyone who prefers it
- `apps/web/src/components/join/ApplicationForm.tsx` uses it for both fields:
  - Date of Birth: `minYear`/`maxYear` computed as `today − 120` / `today − 18` (18 is CA's minimum age to hold a real estate license)
  - License Expiration Date: no min/max — it's a future date, not an age check

### Automated Approval Document Email — Discussed, Not Yet Built

Ryan wants an automated email sent after he approves an agent application (separate from or alongside the existing `sendApplicationApproved` account-setup email in `apps/web/src/lib/email.ts`) that:
- Attaches a fixed packet of documents (same for every agent — W-9, onboarding docs, etc.)
- Requests documents back from the agent — replies land in Ryan's inbox directly, no upload UI needed on our side
- Text stays identical for every send except the agent's first name

**Decision:** static attachment files will live in the repo (e.g. `apps/web/src/lib/email/attachments/`) and get read off disk + attached via SendGrid at send time — not Cloudflare R2. Reasoning: the packet rarely changes, and Ryan is fine asking me to swap a file and redeploy on the rare occasion it does, so the simpler option (no upload UI, no new infra) wins.

**Not started — do NOT build until Ryan says go.** He wants to finish testing the full application flow first, then revisit this.

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Open `localhost:3000`
3. Ryan reviews the DateField change on `/join/apply`, compares fields against competitor applications, then approves
4. Commit the Membership Association + DateField work once approved (nothing committed yet as of end of this session)
5. Test the full agent application flow end-to-end (see 2026-07-01/07-02 session notes above for steps)
6. **After the flow is fully tested:** build the automated approval document email (see decision above)

---

## Session Notes — 2026-07-05 / 2026-07-06

### What Was Completed

Committed as `fd37ccc`, `069ae70`, `7a2eebf` on `main`.

**`fd37ccc` — Membership association fields, typeable date inputs, drop background check consent** (the work left uncommitted at the end of the 2026-07-03 session — reviewed and approved):
- Added Current/Desired Membership Association fields to the agent application (dropdown of CA associations + free-text fallback)
- Made Current/Most Recent Brokerage optional
- `DateField` component (see 2026-07-03 notes above) wired in for DOB (clamped 18–120 years) and License Expiration Date
- Added ICA section 2.2 (perjury certification re: investigations)
- Removed the background check consent requirement — not DRE-mandated, and the broker won't be performing one

**`069ae70` — design spec doc** for the application-submitted page (planning doc only, no app code)

**`7a2eebf` — Application-submitted page, reordered ICA section, branded emails:**
- New page: `/join/apply/submitted` ("You're IN") — DRE eLicensing instructions + a `PageCTA` section; `PageCTA`'s `body` prop is now optional (this page doesn't use one)
- `ApplicationForm.tsx`: State field hardcoded to CA (read-only, no more manual entry); ICA Review & Agreement section moved above Active Listings; the Legal/perjury checkbox merged into the Background section; "Welcome to CnC Realty" heading redone as a two-line staggered reveal; general spacing/copy polish
- **Agent setup links no longer expire** — previously 72 hours; both `/api/setup-account` and the approve route now treat a `null` token expiry as "never expires"
- **All system emails redesigned** with a shared branded layout — logo header + styled gold CTA button, via a new `emailLayout()` helper in `lib/email.ts`. Applies to: application-received notification, approval email, rejection email, deadline reminders, lead-assignment email. `FROM` now sends with a display name (e.g. "CnC Realty <noreply@cncrealtygroup.com>") instead of a bare address.
- Fixed the deadline-reminder email's CTA link — was a hardcoded production domain, unusable when testing in local dev; now uses `NEXTAUTH_URL`
- Removed the arrow from the `AgentPlan` "Get Started" button

### Status Update — Agent Application Flow

**Ryan has now tested the flow end-to-end** through admin approval — apply → ICA gate → submit → "You're IN" page → admin approve/reject → branded emails → setup-account → login all confirmed working. The one piece not yet built is the automated approval document email (see below).

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. **Decide the document packet** for the automated post-approval email — what fixed documents get attached and requested back from every newly-approved agent (W-9, onboarding paperwork, etc.)
3. **Build the automated approval document email** — static attachments read from disk (e.g. `apps/web/src/lib/email/attachments/`) and sent via SendGrid using the new `emailLayout()` branded template; replies land directly in Ryan's inbox, no upload UI needed
4. Older backlog, lower priority: checklist templates at `/admin/settings/checklists`; clean up test DB records (Test Applicant, Jane Agent) before launch

---

## Session Notes — 2026-07-06 / 2026-07-07

### What Was Completed

Full implementation of the signed ICA PDF e-signature feature, from `docs/superpowers/plans/2026-07-06-signed-ica-pdf.md`. All 12 tasks complete, tested, and committed on `feature/agent-application-redesign` (commits `979a780` through `51ced65`/`a2a9937`).

**Core feature — agents now e-sign the ICA as part of applying:**

1. **Canonical ICA content module** (`1580c43`) — the full ICA text (26 sections + fee tables) now lives in a single typed content module (`IcaSection`/`IcaParagraph`/RichText shapes) instead of being duplicated between the `/join/ica` page and the PDF generator. `/join/ica` was refactored (`c5d14ab`, fixed in `1ff6c83`) to render from this module — inline bold, list spacing, and table weight all preserved.
2. **Signature field on the application** (`75ad14b`) — typed full-name signature field added to `ApplicationForm.tsx`, gated the same way as before (must open `/join/ica` first). Copy/spacing/label polish across several follow-up commits (`ccda65d`, `670d586`, `f68a66c`).
3. **Name-match validator** (`536164d`) — shared `namesMatch(signatureName, firstName, lastName)` helper used both client-side (immediate feedback) and server-side (can't be bypassed).
4. **PDF generation** (`ae8c887`, phantom-space bug fixed in `7a35b16`/`8421a48`) — `generateSignedIcaPdf({ signerName, signedAt, signerIp })` renders the full ICA content module to a PDF via `pdf-lib`, embedding the signer's name, IP, and a server-authoritative timestamp.
5. **Schema + submit flow** (`fa2f22c`, `40078ae`) — `AgentApplication` and `Agent` both gained `signedName`/`icaVersion`/`signedIcaKey` fields. On application submit: signature captured → PDF generated → uploaded to R2 → key stored on the application record.
6. **Approval flow** (`49f7839`) — `signedIcaKey` is copied from the `AgentApplication` onto the new `Agent` record when Ryan approves, so the signed document travels with the agent permanently.
7. **Admin download** (`777cc37`, `e63fb73`) — presigned-URL route + a "Download signed ICA" button on `/admin/agents`.
8. **Final-review hardening** (`69d5db0`) — signing timestamp now uses the server clock (never trusts the client-supplied time) for the legal record; if the DB write fails after the PDF is already uploaded, the orphaned R2 object is cleaned up automatically instead of leaking storage.

**Related cleanup:**
- Removed the "Invite Agent" button from `/admin/agents` (`5bba1d3`) — it didn't do anything real; agents only enter the system via the application flow now.
- Added field-level red-ring highlighting on application validation errors (`51ced65`) so applicants can see exactly which field failed.
- Fixed a sitewide TypeScript error from `as const` on `PULSE_ANIMATE` (`a2a9937`) — unrelated to the ICA work but caught during this session.

### Status

**Feature is complete and committed but had NOT yet been visually/functionally verified in-browser as of end of session.** The 2026-07-01/07-02 session notes above describe the pre-signature version of the flow being tested end-to-end; the signature/PDF/R2/admin-download pieces are new since then.

### Next Session — Start Here

Ryan's stated priority order: **(1) ICA content/terms itself, (2) post-approval documents email, (3) E&O insurance.**

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. Work the ICA — review/finalize content, terms, and the signed-PDF flow (test end-to-end: apply → sign → approve → admin download)
3. Then: automated approval document email (attach fixed doc packet, request docs back — see 2026-07-03/07-05 notes above for the R2-vs-repo-file decision)
4. Then: E&O insurance (details TBD with Ryan)
5. Older backlog, lower priority: checklist templates at `/admin/settings/checklists`; clean up test DB records (Test Applicant, Jane Agent) before launch; consider merging `feature/agent-application-redesign` to `main` (27+ commits ahead)

---

## Session Notes — 2026-07-07

### What Was Completed

**Competitor ICA gap analysis + CnC ICA content update.** Ryan provided three competitor ICAs for comparison: REeBroker (live via Puppeteer), Virtual Realty Group (local PDF — the DigiSigner invitation link he initially gave had expired, so he supplied `VRG-ICA-OPPM.pdf` instead), and West Shores Realty, his previous brokerage (local PDF — the first file he pointed to, `W9.pdf`, turned out to be the IRS W-9 tax form, not the ICA; the correct file was `Pay Plan 5.2023.pdf`, his own signed onboarding packet).

Found and Ryan approved 10 gaps to close, all added to the **canonical ICA content module** (`apps/web/src/lib/ica-content.ts` — the single source of truth that both `/join/ica` and the signed-PDF generator render from) and mirrored into `docs/cnc-ica-draft.md`:

1. **Compensation Disputes** (new §7.11, REeBroker-style) — Broker can hold disputed compensation until resolved, no liability for the delay.
2. **Team and Co-Listing Transactions** (new §7.12, REeBroker-style) — fee charged once per side, split per agents' written agreement; Broker can withhold if no agreement exists; incorporated teams get one fee.
3. **Multi-Parcel Transactions** (new §7.13, West Shores/VRG-style) — separate transaction fee per APN.
4. **No Direct Compensation** (new §7.14, REeBroker-style) — no compensation directly from a client/other broker without Broker's written approval.
5. **Broker-Assigned Reassignment** (new §7.15, West Shores-style, 25% split as Ryan specified) — Broker can reassign a mishandled transaction; reassigned agent gets 25%, original agent gets the balance (or a referral fee only, if the client requested the switch).
6. **Departing-agent listings** (added to §21 Termination, West Shores model per Ryan's explicit choice) — active listings/pending transactions stay with CnC unless a written referral agreement is signed.
7. **Harassment and Discrimination Policy** (new standalone §24, West Shores/VRG-style).
8. **Waiver** (new standalone §25, REeBroker-style boilerplate).
9. **License-lapse consequence** (added to §2.1, West Shores/VRG-style) — lapsed/suspended license = immediate cessation of licensed activity + suspended association until restored.
10. **Platform credential confidentiality** (added to §18 Security and Cyber Fraud, REeBroker-style) — one sentence.
11. **Return of confidential materials within 24 hours of termination** (added to §20, VRG-style — this was a rephrase of the existing clause, not a new section).

**Renumbering:** inserting the two new standalone sections (Harassment, Waiver) between the old §23 and §24 pushed Mentorship Program → §26, Entire Agreement → §27, and the closing "Agrees and Understands" → §28. Total section count went from 26 → 28. Chose this insertion point specifically because the only internal cross-references in the document (`Section 6`, `Section 7.2`, `Section 8`, `Section 9`) all sit before it, so zero cross-references needed updating.

**Test updates:** `apps/web/src/__tests__/lib/ica-content.test.ts` — updated the hardcoded section-count assertion from 26 → 28. Full suite (`pnpm --filter web test`) passes at 206/206. `ICA_VERSION` bumped to `2026-07-07`.

**Verification:** confirmed all new section titles and the new termination sentence render correctly on the live `/join/ica` page (checked via a temporary second dev server on port 3001, killed after confirming — did not touch Ryan's existing dev server on port 3000).

**SUMMARY_TABLE update:** added an 11th row — "Multi-Parcel (APN) Transaction: Full fee charged per APN" — placed after the Dual Agency row since it's the same category (a fee-multiplier scenario, not a new dollar amount). `ica-content.test.ts` row-count assertion bumped 10 → 11. Ryan reviewed and decided the 25% reassignment split doesn't need its own summary row (it's an exception-handling clause, not a standard fee schedule item).

**Fee correction (same session, after Ryan reviewed the rendered page):** §7.9 Broker-Provided Leads and its SUMMARY_TABLE row previously said the 25% referral fee was charged **in addition to** the flat transaction fee — wrong. Ryan clarified the flat transaction fee does not apply at all to broker-provided leads; it's 25% of gross commission only. Fixed the clause text and the summary row in both `ica-content.ts` and `docs/cnc-ica-draft.md`.

**SUMMARY_TABLE cleanup (same session):** removed the "E&O Insurance — Included in transaction fee" row — Ryan correctly flagged it as redundant with row 2 ("E&O included through — $1,000,000 sale/lease price"). Also moved "E&O Deductible (if claim)" to sit directly below the "E&O Supplement examples" row so all the E&O-related rows group together at the top, before the fee-multiplier rows (Dual Agency, Multi-Parcel, Broker-Provided Lead). Row count back down to 10; `ica-content.test.ts` assertion updated accordingly (11 → 10).

### CA Statutory Compliance Pass (same session, continued)

Ryan pushed back on "competitor parity = safe to launch without a lawyer" — correctly, since matching 3 competitors doesn't verify CnC's own novel fee combination is legally sound. Researched the actual controlling law instead of competitor practice:

- **3-part independent-contractor test** (Unemployment Insurance Code §650 + Business & Professions Code §10162(a)): licensing, output-based pay, written non-employee tax statement. CnC's ICA passes cleanly (§2.1, §7 all-commission structure, §4.1).
- **10 CCR §2726** requires the written broker-salesperson agreement to cover supervision of licensed activities, duties, and compensation. Found one real gap: no explicit supervision clause. Closed it with new **§3.7 Supervision of Licensed Activities**, tying together existing platform mechanics (file certification, checklist compliance, written-approval requirements) while explicitly preserving the independent-contractor control limitations so it doesn't undercut the UIC §650 test elsewhere.
- Conclusion documented in this file's ICA notes: ICA is finalized on the strength of this statutory pass + the competitor gap analysis, **not** attorney-reviewed — that distinction should stay accurate in any future summary.

### Post-Approval Onboarding Documents Email — Built

The long-pending "automated approval document email" task (first scoped 2026-07-03) is done:

- **Packet decided:** blank IRS W-9 (sourced fresh from irs.gov, current March 2024 revision) + a new **CnC Realty Office Policy Manual** (14 sections, written this session — Supervision, Transaction Management, Working Remotely, Trust Fund Handling, Marketing Approval, MLS/Board Membership, Document Checklist, Personal/Family Transactions, Confidentiality, Harassment Reporting Procedure, Personal Assistants, Termination, Amendments). Cross-references the matching ICA section throughout.
- **`sendApprovalDocuments()`** built via TDD in `apps/web/src/lib/email.ts`, wired into the approve route (`api/agent-applications/[id]/approve/route.ts`) alongside the existing `sendApplicationApproved` call. Reply-to set to `info@cncrealtygroup.com` so agent replies (completed W-9, DRE license copy, headshot) land directly in Ryan's inbox. Static PDF attachments live in `apps/web/src/lib/email/attachments/` (`w9-blank.pdf`, `cnc-office-policy-manual.pdf`), read via `fs.readFileSync` at send time.
- **Important process correction:** initially over-built this — started extracting a full PDF-generation pipeline (`doc-content.ts` + `pdf-writer.ts` shared modules, mirroring the ICA's pdf-lib renderer) to generate the manual dynamically. Ryan caught this ("aren't we making a whole new document that isn't found in the website at all?") and it was fully reverted — the manual doesn't need per-agent personalization the ICA does, so a static file is simpler and was the originally-agreed approach. Reverted cleanly, verified with a full test pass + live check before proceeding.
- **Manual production:** written as `docs/cnc-office-policy-manual.md`, converted to Word via a new PowerShell + Word COM automation script (no pandoc/wkhtmltopdf/LibreOffice available on this machine), Ryan reviewed and hand-edited it, converted to PDF himself, handed back for the repo.
- **Live-tested for real:** sent an actual test email to Ryan's own inbox via a one-off `tsx` script loading real `.env.local` SendGrid credentials — confirmed delivery, script deleted immediately after (never committed).

### Security Fix — Leads Export Locked to ADMIN

Mid-conversation, checking whether agents could export client data (relevant to the Office Policy Manual's confidentiality clause) surfaced that `GET /api/leads/export` was gated with `requireAuth("AGENT")` — not `ADMIN` — with zero UI exposure to agents (only linked from `/admin/leads`), but technically callable directly by any authenticated agent for their own leads. Ryan asked to lock it down regardless ("agents can just write the client's info down somewhere for their personal use" — so UI-hiding isn't a real control). Fixed via TDD: now `requireAuth("ADMIN")`, removed the now-dead per-agent scoping branch.

### DRE Main Office Address — Discovered a Real Discrepancy, Unresolved

While discussing whether agents should update their zipForms "office address" field, queried the DRE's public license lookup directly (not from memory):

- Ryan's **individual** broker license (02202082): home address on file (12802 Cantrece Street, Cerritos) — compliant pattern.
- **CnC Realty's corporate broker license (02439028)**: a Sacramento registered-agent address (1401 21st St STE R) on file — **not** the Vista, CA registered-agent address Ryan believed he'd used. A third, different address than either of the two he had in mind.
- Researched B&P Code §10162(a): the statutory "definite place of business" must be "the place where the broker's license is displayed and where personal consultations with clients are held" — a registered-agent/mail-forwarding address is structurally incapable of satisfying that, since such services exist specifically so nobody visits.
- **Ryan is calling the DRE tomorrow** to (a) get the wrong Sacramento address corrected and (b) ask directly whether a registered-agent address can ever satisfy the main-office requirement. **Do not assume an answer or take further action on this until Ryan reports back from that call.**

### E&O Carrier Research — Deprioritized

Read REeBroker's fee schedule, Rise Realty's RISE 100 program page, and re-confirmed Virtual Realty Group's OPPM terms. New finding: REeBroker's "risk management fee" bundles E&O **and** Workers' Compensation together (unlike CnC/Rise/VRG, which only cover E&O — agents are 1099 contractors with no workers' comp, per ICA §16). None of the three — nor CnC — discloses an actual insurance carrier anywhere in public materials. Ryan decided actual carrier-shopping can wait until after launch/deploy; this session's work stayed at the fee-structure/contract-language level.

### ICA Fee Restructuring — Several Rounds, All Applied and Verified

All changes below hit `apps/web/src/lib/ica-content.ts`, `docs/cnc-ica-draft.md`, and a regenerated dated Word doc after each round (per the dated-docx-versioning convention below):

- **§7.5 split in two.** Was "Referral and Lease Transactions" (one clause, ambiguous fee model). Now:
  - **§7.5 Outbound Referral Transactions** — renamed to make the direction explicit after Ryan asked whether "referral" meant CnC-to-agent or agent-to-agent (it's agent-to-agent/outside-brokerage, outbound only — inbound referrals that the CnC agent closes themselves are just normal §7.2 transactions). Fee model corrected from a sale-price-tiered flat fee (which was actually wrong — competitors REeBroker and West Shores both base referral fees on the referral commission *received*, not the underlying sale price) to **10% of referral commission received, or $200, whichever is greater**.
  - **New §7.16 Lease Transactions** — matches REeBroker's rental treatment exactly: **10% of commission or $200, whichever is greater**, no flat transaction fee, no E&O supplement funding for leases (started at $100 minimum, raised to $200 to match the referral fee minimum).
- **§7.9 Broker-Provided Leads:** 25% → **30%** of gross commission.
- **§26 Mentorship Program:** split flipped **70/30 → 75/25** (mentee/mentor). Also fixed a leftover bug from the morning's section renumbering — the subsection IDs still said "24.1"–"24.4" internally despite living under section 26.
- **E&O Supplement rate:** $200 → **$400** per $500k over $1M. Full fee table (all 8 tiers), §7.2, §9.1, and the summary table all recalculated. Considered moving the $1M inclusion threshold to $1.5M as an alternative (walked through the mechanics with Ryan — it would have largely offset the rate increase) but he chose to keep the **$1M threshold as-is** and just take the higher per-increment rate.
- **§7.13 Multi-Parcel:** clause and summary row both clarified to explicitly state the per-APN fee includes "the base flat fee and any applicable E&O Supplement," matching how the Dual Agency row already spelled that out — removes an inference gap between the two similar fee-multiplier clauses.
- **Cleanup:** removed three leftover "sale or lease" references (§7.2, §9.1, fee table header) now that leases have their own separate structure. Simplified summary-table wording: dropped the redundant "(flat fee does not apply)" from the Lease row, renamed "Outbound Referral Fee" → "Referral Fee" in the summary table (the outbound-only scope lives in §7.5's actual text; didn't need repeating in the quick-reference row label).

### /join Pricing Card Cleanup

`apps/web/src/components/join/AgentPlan.tsx` — removed the "$400 per $500k over $1M" and "$350 through escrow" sub-lines from the Professional plan card (parent benefit labels like "E&O Insurance included through $1M" stayed), and matched the "Additional terms apply..." disclaimer text color to "Forever" (both `text-[#1B1B1B]/50`).

### New Standing Workflow: Dated ICA Word Doc Versioning

Every ICA content change now regenerates `CnC-Realty-ICA-DRAFT-{date}.docx` in Downloads — no undated "current" file (Ryan chose dated-only history over dated-plus-pointer, so he can diff across attorney review rounds). Saved as memory. Also corrected mid-session: stop updating CLAUDE.md after every small change — batch into one entry at end of session instead (this is now a standing preference); this entry is the first full application of that.

### Status

All 210 tests passing (up from 206 this morning — added: leads-export ADMIN-lock test, `email.test.ts` for `sendApprovalDocuments`, one new approve-route test). Everything verified live on the dev server throughout. Not yet committed — committing at the very end of this session, all in one pass.

### Next Session — Start Here

1. **Follow up on Ryan's DRE call** — did he get CnC's Sacramento address corrected? Did DRE clarify whether a registered-agent address can satisfy the main-office requirement? This determines what (if anything) to tell agents about their zipForms office address field.
2. **E&O insurance carrier research** — deprioritized until after launch/deploy per Ryan; revisit then, not before.
3. CnC's ICA is now fee-finalized as of tonight (referral/lease/mentorship/E&O-rate/multi-parcel changes) — still not attorney-reviewed (see this file's ICA notes); flag that distinction if it comes up again.
4. Older backlog, unchanged: checklist templates at `/admin/settings/checklists`; clean up test DB records (Test Applicant, Jane Agent); consider merging `feature/agent-application-redesign` to `main` (well past 30+ commits ahead now).

---

## Session Notes — 2026-07-08 / 2026-07-09

### Session Recovery

Previous session was cut off mid-response by a Claude Code auto-update (not a Ryan-initiated exit). Verified on resume: `git log` showed the last commit (`bc4486b` — Tasks page layout fix) matched exactly what was on screen when the update hit, working tree was clean, nothing lost. Home value estimator (built the prior session) and the Pipeline dnd-kit rework were both already safely committed.

### Dashboard Tab Titles — Bold Consistency (`7354ca1`)

Ryan noticed Pipeline and Tasks used `font-medium` while Overview, Leads, Transactions, Campaigns, and Settings used `font-light`. Fixed all 5 to `font-medium`, plus added the missing `font-sans` class on Transactions for consistency. Files: `DashboardTabs.tsx` (Overview), `leads/page.tsx`, `campaigns/page.tsx`, `settings/page.tsx`, `transactions/page.tsx`.

### Dashboard Tab-Switching Lag — Root Cause + Fix (`02a91c2`)

Ryan reported the agent dashboard felt laggy switching between tabs. Used `superpowers:systematic-debugging` to investigate before proposing anything.

**Root cause:** every dashboard tab independently re-queried Postgres for the exact same `prisma.agent.findUnique({ where: { userId } })` lookup on every navigation — Overview, Leads, Pipeline (via `/api/deals`), Tasks (via `/api/tasks`), Transactions (via `/api/listings` + `/api/transactions`), and Campaigns all did this separately, with zero caching or sharing across tabs. `leads/page.tsx` additionally ran 3 of its queries sequentially instead of in parallel. The DB itself is reached over Railway's public proxy (`kodama.proxy.rlwy.net`) with no connection pooler, so every one of these redundant round trips paid full network latency.

**Fix:** `agentId` is now resolved once at sign-in and cached on the JWT/session (`auth.ts` `jwt`/`session` callbacks; typed via `next-auth.d.ts`). Every page/route now reads `session.user.agentId` instead of hitting the DB again, preserving the exact same ADMIN-sees-everything vs agent-scoped-to-self role gating that existed before — just backed by a cached value. `leads/page.tsx`'s independent queries were also parallelized with `Promise.all`.

**Files touched:** `auth.ts`, `api-auth.ts`, `next-auth.d.ts`, `dashboard/page.tsx`, `leads/page.tsx`, `campaigns/page.tsx`, `api/deals/route.ts`, `api/tasks/route.ts`, `api/listings/route.ts`, `api/transactions/route.ts` — plus new/updated tests for all of them (`auth.test.ts`, `DashboardOverviewPage.test.ts`, `LeadsPage.test.ts`, `CampaignsPage.test.ts`, `deals.test.ts`, `tasks.test.ts`, `listings.test.ts`, `transactions.test.ts`). Full TDD (RED → GREEN per file). Checked `/api/account/profile` and `/api/account/agent-profile` too — left unchanged since those already do exactly one necessary query for real profile fields, not a redundant id-only lookup.

**Verified:** 273/273 tests pass, `tsc --noEmit` shows zero new errors (cross-checked every pre-existing error against files touched — no overlap).

### Why didn't `simplify` or `code-review` catch this?

Ryan asked, reasonably, since both have been run repeatedly on this codebase. Answer: both are diff/branch-scoped by design — `simplify` reviews "the changed code," `code-review` (including `/code-review ultra`) reviews "the current diff"/"current branch." Neither does a whole-codebase sweep. Every individual file's query was correct in isolation; the problem only existed in aggregate across ~9 files built in different sessions weeks apart, which no diff-scoped tool would ever see. No existing skill does a full-codebase architectural audit — the only way to catch this class of issue is (a) a symptom getting reported and traced backward (what happened here), (b) an explicit one-off request for a whole-codebase pattern audit (offered, deferred for tonight), or (c) production performance monitoring — Sentry is already wired in, so once deployed it should start surfacing this kind of thing from real traffic.

### Redis/Upstash Caching — Correction

Ryan asked whether Redis caching could be done now even though not deployed yet. First answer was wrong — said it hadn't been built. Re-verified against actual code (not memory of old notes) per `superpowers:verification-before-completion`, and confirmed **Redis caching was already shipped** on 2026-06-15 (`d19c646`) — `lib/redis.ts` wraps Upstash, and `/api/properties` caches search results with a 5-minute TTL keyed off sorted search params. Lesson: verify current code state before answering, don't answer from memory of old session notes.

### Phase 6 / Phase 7 — Verified Complete (Full Code Audit)

Ryan pointed out CLAUDE.md already marked both phases complete (2026-06-29 session notes) and asked for a superpowers-verified re-check. Grepped the actual codebase (not just prose) for every item on both lists:

**Phase 6 — all done:** ISR (`revalidate = 300` on property pages), Redis caching, rate limiting (Upstash `Ratelimit` on leads/home-value-reveal/agent-contact routes), Sentry (client/server/edge configs), PostHog, JSON-LD (agent/property/homepage), sitemap (`app/sitemap.ts`), skeleton loaders. CCPA cookie banner was built on 2026-06-15 then **deliberately removed** on 2026-06-16 as part of a legal-pages rework — not a gap, a considered decision already flagged at the time.

**Phase 7 — all done:** Smart Lists, Deal Pipeline, Lead Ponds (under different naming — brokerage lead assign/dismiss routes + `BrokerageLeadsBanner`), Action Plans, Trigger Automations (`admin/triggers`), Reporting (`admin/reports` + `api/reports/my-stats`) — all confirmed as real, substantive implementations, not stubs.

**The one real gap:** actual deployment to Vercel hasn't happened. No `.vercel` deploy artifact, and `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `.env.local` are still empty strings — the exact blocker flagged back on 2026-06-16. Everything else on the launch checklist is done; the deploy step itself is outstanding.

### Home Value Estimator Bug — Address Suffix Mismatch (`0ec8be9`)

Ryan tested `15595 Curtis Cir` on `/sell` per the plan from the interrupted session and got "we don't have this address on file yet." Used `superpowers:systematic-debugging` again.

**Root cause:** the property genuinely exists in the DB (MLS# 1170039079, Sonora CA 95370, status Closed) — this was not a sync-completeness issue. Mapbox's geocoder returns the fully-spelled-out `"15595 Curtis Circle"`, while CRMLS stores the USPS-abbreviated `"15595 Curtis Cir"` (built directly from RESO's `StreetSuffix` field in `field-map.ts`). `findSubjectProperty`'s strict `contains` substring match can never succeed when the query string is *longer* than the stored value due to this abbreviation expansion. Confirmed via a direct DB query (not assumption) that the row exists and that the mismatch is exactly the suffix word.

**Fix:** `findSubjectProperty` now tries the strict match first (unchanged behavior when it already works), and falls back to a suffix-stripped match (last word removed) only when the strict match returns empty. Guarded against bare street numbers with nothing left to search on. TDD throughout — new tests in `home-value-estimate.test.ts` (lib) cover the fallback, the guard, and confirm no fallback fires when the strict match already succeeds; updated one existing `api/home-value-estimate.test.ts` test whose mock sequence needed an extra queued response now that a genuine no-match case makes 2 calls instead of 1.

**Confirmed this applies proactively going forward**, independent of the pending full IDX resync — it's a request-time query fix, not a data patch. CRMLS's `StreetSuffix` field mapping is stable across every sync (initial, delta, or full re-resync), so the abbreviated format — and this fix's ability to handle it — isn't tied to sync timing at all. Scope caveat: only handles "last word differs due to suffix abbreviation" specifically; wouldn't catch a misspelled street name or a missing directional (e.g. "N Curtis" vs "Curtis") if either ever comes up.

### AddressAutocomplete — Loading Spinner (same commit)

Added a `Loader2`/`animate-spin` spinner (gold `#9E8C61`, matches the existing pattern in `SearchResults.tsx`/`PropertyDrawer.tsx`) at the right edge of the address field, visible while the debounced Mapbox geocoding fetch is in flight.

### Commits This Session

| Hash | Description |
|---|---|
| `7354ca1` | style: bold Overview/Settings/Transactions tab titles to match Pipeline/Tasks |
| `02a91c2` | perf: cache agentId on the session to fix dashboard tab-switching lag |
| `0ec8be9` | fix: match addresses when geocoder spells out street suffix but MLS abbreviates it |

### Next Session — Start Here

1. **Retest `15595 Curtis Cir` on `/sell`** — confirm the address now resolves to the real MLS# 1170039079 match with price history, and that the loading spinner shows correctly while typing.
2. **Full IDX resync before deployment** — this was the original next step from the interrupted session and is still outstanding; the address-matching fix is independent of it but the resync itself hasn't happened yet.
3. **Deploy is the one remaining Phase 6/7 gap** — add real `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` to `.env.local`, then deploy to Vercel + Railway.
4. Optional, offered but deferred: a full whole-codebase audit (agent-driven grep sweep) for similar N+1/redundant-query patterns elsewhere, now that today's fix established what to look for.
5. Older backlog, unchanged: checklist templates at `/admin/settings/checklists`; clean up test DB records (Test Applicant, Jane Agent); consider merging `feature/agent-application-redesign` to `main` (well past 30+ commits ahead).

---

## Session Notes — 2026-07-10

### DateField sitewide rollout, checklist templates paused for ZipForm research

**DateField year-overflow bug fixed sitewide.** The native `<input type="date">` year segment let users type unlimited digits (e.g. "222222"). `DateField` (built earlier for the agent application's DOB/License Expiration fields) already solved this with segmented MM/DD/YYYY inputs with real clamping. Extended it with an opt-in `withTime` prop (HH:MM segments, emits `datetime-local` format) via TDD — wrote a 31-test baseline for the existing date-only logic *before* touching it, then re-ran that exact baseline after adding `withTime` to prove the date-only path was unaffected. Rolled out to all remaining date fields sitewide: New Listing, New Transaction, file detail Tasks tab, Deal Drawer, New Deal Modal (plain dates), and Lead Task Drawer, Lead Tasks Tab, campaign "Schedule for Later" (datetime). 320/320 tests passing. Also redesigned New Listing's wizard to visually match New Transaction's layout (dot-indicator step bar, centered card, spring-hover pill buttons).

### Upstash Redis token was rotated/expired — fixed

`/api/properties` was throwing 500s (`WRONGPASS invalid or missing auth token`). Confirmed via direct curl against Upstash's REST API that the token itself was rejected (not an app-side bug). Ryan pulled a fresh token from the Upstash dashboard (database itself — "CnC Realty", `liked-moth-150001.upstash.io` — was still there, just the token had changed); updated `.env.local`, verified `/api/properties` returns 200 again.

### ZipForm / checklist template work — IMPORTANT, mid-investigation, not yet actioned

Ryan wanted to bulk-download every zipForm template from his C.A.R. membership and have them hosted inside CnC. **Verified via C.A.R.'s own published terms** (https://www.car.org/transactions/zipform/zf/standardformsterms) that this is explicitly prohibited — placing C.A.R. forms into any other software platform is called out by name as copyright infringement. The permitted exception: a *completed* form saved as a locked PDF for an actual transaction may exist outside zipForm — which is exactly how CnC's existing document-upload system already works (agents upload their own completed, transaction-specific documents; CnC never stores blank templates). **Decision: do not download or host any zipForm templates.** Checklist items are just name/label strings, not the forms themselves, and don't need verification against zipForm's actual content — they're generic CA legal disclosure category names.

**Verified checklist item names via C.A.R.'s official standard-forms directory** (https://www.car.org/transactions/standard-forms/list-of-standard-forms) — corrects/replaces the unverified list from earlier sessions:
- **Buyer-side purchase:** RPA-CA, BRBC, Agency Disclosure, AVID, SBSA, TDS, Proof of Funds, Loan Pre-Approval. (NHD is real and required but is NOT a C.A.R./zipForm form — it's ordered from a separate third-party NHD report vendor.)
- **Seller-side listing:** Listing Agreement, TDS, SPQ (missed in the original list), SBSA, NHD, Agency Disclosure.
- **Lease (tenant side):** RLMM, Agency Disclosure, Move-in Inspection.
- **Lease Listing (landlord side) — this 4th template never existed at all before.** LL (Lease Listing Agreement), Agency Disclosure.

**Ryan compared CnC's New Transaction/New Listing wizards against zipForm's actual "Transact" flow (14 screenshots) and surfaced real findings:**

1. ~~**Confirmed bug:** `packages/database/prisma/schema.prisma`'s `TransactionSide` enum has `BUYER_SIDE / SELLER_SIDE / DUAL / LEASE` — but in `new-transaction/page.tsx`'s `SIDES` array, `SELLER_SIDE` is mislabeled in the UI as **"Referral / Other"**. Anyone picking that option today gets miscategorized as `SELLER_SIDE` in the database.~~ **FIXED** (commits `e43e8a8`, `4ac6fac`, verified 2026-07-14 via `superpowers:systematic-debugging`) — `TransactionSide` enum is now `PURCHASE | LISTING | DUAL | LEASE_TENANT | LEASE_LANDLORD | LEASE_DUAL | REFERRAL`, and the `SIDES` array in `new-transaction/page.tsx` matches 1:1 with its own distinct label per value. "Referral" is its own option, no longer aliased onto Listing.
2. ~~**Structural gap:** the `LEASE` enum value doesn't distinguish tenant-side from landlord-side at all (one undifferentiated bucket), while zipForm explicitly splits Lease (tenant) from Lease Listing (landlord) the same way it splits Purchase from Listing on the sale side.~~ **FIXED** by the same commits above — `LEASE_TENANT`, `LEASE_LANDLORD`, and `LEASE_DUAL` are now separate enum values.
3. **Missing Property-step fields** (present in zipForm, absent from both CnC wizards) — still open: Legal Description, Property Includes/Excludes, Tax ID, Annual Taxes, School District, Zoning Class, photo upload.
4. **Missing Offer/Details-step fields:** Deposit amount, Offer Date, Offer Expiration Date, Final Walkthrough Date, Possession Date, and a free-form Conditions/Contingencies list (CnC only has 3 fixed deadline fields — Inspection/Appraisal/Loan — covering some but not all of this).
5. **Lower priority / Ryan's call whether to build:** zipForm's "RentSpree Tenant Screening" toggle (third-party integration, lease-only) and "apply a transaction template" reuse feature.

**Ryan's ask, not yet done:** read every single link from the Lone Wolf Transact resource hub (`https://community.lwolf.com/s/manage-transaction-resources`) for full context on how zipForm/Transact works — same depth as the earlier SkySlope research pass — before deciding what to adopt. **Blocked:** this is a Salesforce Experience Cloud site (fully JS-rendered; raw `curl`/`WebFetch` return an empty shell), so it requires Puppeteer. Puppeteer's MCP server had disconnected mid-session and needs a Claude Code restart to reconnect — that restart had not happened yet as of this note being written.

**Explicit instruction: do NOT download, screenshot-scrape-into-code, or otherwise reproduce zipForm/C.A.R.'s actual form content or templates.** Only checklist item *names* and general workflow/field *structure* (step order, field labels, transaction-type categories) should be adapted from zipForm — never the forms' copyrighted content itself.

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

---

## Lone Wolf Transact Research — Full Read-Through (2026-07-10)

Read all 58 articles from the Lone Wolf community resource hub (`community.lwolf.com/s/manage-transaction-resources` + its Signings sub-page) via Puppeteer, same depth as the earlier SkySlope research pass. Confirms "Transact" is the actual current product name for what Ryan referred to as "zipForm" — the two screenshots he took (`transact-workflow.lwolf.com`, `formseditor.lwolf.com`) are this exact product.

### Confirms and validates earlier findings
- **Exactly 4 transaction types**, matching Ryan's screenshots precisely: Purchase (buyer), Listing (seller), Lease (tenant), Lease Listing (landlord) — validates that fixing CnC's `SELLER_SIDE` → "Referral/Other" mislabeling and adding the missing Lease Listing distinction are real, correct priorities.
- **Confirms the missing Property-step fields**: Legal Description, Property Includes/Excludes, Tax ID, Annual Taxes, School District, Zoning Class, photo upload.
- **Confirms the missing Offer-step fields**: Deposit, Offer Date, Offer Expiration Date, Final Walkthrough Date, Possession Date, and a free-form Conditions list (each condition: name, relative-or-specific due date, notes).
- **CnC's property type list is also missing categories** Transact has: Industrial, Farm and Ranch, Manufactured Home, Co-Op (CnC only has Single Family/Condo/Townhouse/Multi-Family/Commercial/Land/Other).

### New findings — genuinely valuable, achievable within CnC's architecture (no licensing/legal blockers)
1. **Client Portal** (Transact's newest feature, June 2026) — invite external parties (buyer, seller, title co.) via a secure PIN-gated one-page link, no account needed; they can view paperwork/parties/details and upload documents directly. Solves the real "back-and-forth email for proof of funds / ID" pain point. High value, no licensing blockers — recommended as the best candidate to build.
2. **"Reset and copy" for lost deals** — when an offer is rejected or a deal falls through but the agent is still working with the same client, Transact archives the old transaction to a "Lost Deals" section and auto-creates a new transaction, optionally copying over selected parties/property/paperwork/to-dos. CnC has no equivalent today.
3. **Phase-triggered checklists** — Transact checklists apply to a specific transaction type *and* workflow phase (e.g., a separate checklist for "Under Contract" vs. "Closed"), and submission-for-review auto-triggers the moment status crosses into a phase with a checklist attached. CnC currently only applies one checklist upfront at file creation with no phase-based triggering — a real architectural gap, not just a naming one.
4. **Checklists have 3 requirement dimensions**, not just paperwork: paperwork requirements, **party requirements** (which roles must be filled, e.g. must have a Title/Escrow party), and **transaction-details requirements** (which fields must be filled — and these can hard-block submission if left blank, unlike paperwork/party which just warn). CnC's checklist system today is paperwork-only.
5. **Unified Timeline/Calendar tab** — aggregates to-dos with due dates, offer/condition dates, and custom events into one calendar+list view at the transaction level. CnC has no equivalent visual timeline on the file detail page.
6. **Relative due dates** for to-dos and conditions (e.g., "17 days after acceptance," not just a fixed calendar date) — matches how CA contingency periods actually work contractually. CnC's `FileTask` only supports absolute dates.
7. **Transaction templates bundle parties and to-do lists, not just paperwork** — CnC's `ChecklistTemplate` only covers document requirements; Transact's templates also pre-populate default parties (e.g., "always add the appraisal company") and default to-do lists.
8. Minor/lower-priority: saved custom transaction-list views, unique per-transaction email-in address for documents, cloud storage upload sources (Google Drive/OneDrive/Dropbox/Box), PDF merge tool, one-click undo of a status change, soft-delete/restore for transactions (180-day window), parent/sub-transaction linking for dual-agency pairs.
9. Since CnC already has 185k+ properties from its own IDX sync, CnC could actually implement "import property details" (Transact needs an external MLS/tax-source lookup for this) *more easily* than Transact did, using data already in the DB.

### Explicitly NOT recommended to build — bigger separate undertakings, not part of this checklist work
- **Interactive Forms Editor** (the thing in Ryan's screenshots — fillable fields, clause library, markup tools, watermarks) — only works because Transact has an official licensed integration with C.A.R./board form libraries. CnC cannot replicate this without its own equivalent licensing deal with C.A.R.
- **Full e-signature engine** ("Authentisign," Transact's in-house tool — comparable in scope to DocuSign: field placement, multi-participant sequencing, signing certificates, reject/reset/resend workflows, 20 articles' worth of functionality). If CnC ever wants e-signature for transaction paperwork, integrate an established third-party API (Dropbox Sign, DocuSign) rather than build this from scratch.
- **"Back Office"** — a separate, specialized Lone Wolf product for broker accounting/commission disbursement/trust accounting. Out of scope; CnC's existing Commission tab covers the basics already needed.
- **Multi-tier sequential review** — only matters once CnC has multiple office managers/reviewers; not relevant while Ryan is the sole admin.

---

## Session Notes — 2026-07-13

### What Was Completed This Session

All changes committed on `feature/agent-application-redesign` (commits `4b3a191` through `03d0b54`). Working tree clean, nothing uncommitted.

#### Home Value page polish (`4b3a191`)
- Extracted `formatPhoneInput`/`isValidEmail` into shared `apps/web/src/lib/form-validation.ts` (TDD, 11 tests), reused in both `ApplicationForm.tsx` and `RevealEstimateForm.tsx` — phone auto-formats to `XXX-XXX-XXXX` as typed (capped at 10 digits), email is format-validated before submit.
- `RevealEstimateForm.tsx`: tried a notched "ribbon" button shape (CSS `clip-path` polygon) per a reference screenshot, then reverted to a plain rounded pill per Ryan's explicit correction ("get rid of the ribbon style, just make it round like all the other buttons") — button uses `self-center` so it doesn't stretch to fill its flex parent. Added a `Loader2` spinner next to "Getting your estimate…" during submit. Copy: "Your Estimated Home Value" → "Estimated Home Value"; "A CnC agent will follow up shortly with a full comparative market analysis." → "Based off MLS data and actual transactions within your area".
- **Bug fix:** `LocalMarketSnapshot`'s bars were invisible — root cause: `bg-cnc-gold/70` doesn't work because `--cnc-gold` is a raw hex CSS variable, not the `rgb(var(--x) / <alpha-value>)` format Tailwind needs for opacity modifiers to resolve. Fixed to `bg-[#9E8C61]/70`.
- `FeaturedListings.tsx`: removed the arrow from "View All".

#### Local Market Snapshot rebuilt as a price histogram (`f684bf9`..`ada0df7`, subagent-driven-development)
Ryan noticed 2025 Q4 and 2026 Q1 always showed 0 sales in the quarterly chart. Root-cause investigation initially (incorrectly) concluded CRMLS only feeds closed-sale data for a trailing ~90 days — see correction below. Built full spec (`docs/superpowers/specs/2026-07-12-local-market-price-histogram-design.md`) + plan (`docs/superpowers/plans/2026-07-12-local-market-price-histogram.md`), executed via 2 subagent-driven tasks + a final whole-plan review (opus):
- `getMarketSnapshot` rewritten: instead of grouping by calendar quarter, buckets sales into price bands. 5+ sales → real histogram (`buildPriceBars`, ~5-6 bins, width picked from a "nice number" step table). 1-4 sales → one bar per sale (bar height = that sale's price, no count badge). 0 sales → text message replaces the chart.
- `LocalMarketSnapshot.tsx` renders whichever shape it's given; `QuarterStat` renamed/consolidated to a single `PriceBar` type in `lib/home-value-estimate.ts` (was duplicated in two files before).
- **Process note — implementer misdiagnosis caught:** Task 1's implementer reported a failing test as "environmental fake timer behavior, not a code defect." Controller didn't accept that at face value, investigated directly, and found the real bug: that describe block's `beforeEach` was missing `vi.clearAllMocks()` (unlike the file's other two describe blocks), so `mock.calls[0][0]` was reading a stale call left over from an earlier `findComps` test. Fixed with a one-line addition matching the existing pattern; reviewer independently re-verified.
- Final whole-plan review (opus, "Ready to merge: With fixes") found 3 Minor issues, all fixed directly: `route.ts`'s manual-entry early-return still emitted the old array shape (unreachable today, but a landmine); `key={b.label}` could collide in sparse mode (two sales rounding to the same price label) — fixed to include index; `[...bins.entries()]` triggered a non-build-blocking `tsc` error — changed to `Array.from(...)`.

#### CRMLS 90-day claim — corrected (important, read before touching sync code again)
Ryan pushed back on the "CRMLS restricts us to 90 days" premise the histogram rebuild was based on. Investigated directly: **queried CRMLS/Trestle's live API** (not our own DB) for closed listings older than 90 days. Result: **CRMLS reports 4,655,136 closed listings older than 90 days**, including samples from 2012 and 107,030 from just the first half of 2023. CRMLS does **not** restrict closed-sale history at all.
**The real reason our DB only has ~90 days of real closed-sale data:** our own sync has never pulled the older history. `apps/web/src/lib/idx/client.ts`'s full-resync query has no date filter and no `$orderby`, so it just pages through whatever default order CRMLS's API returns — which apparently biases toward recent listings rather than exhaustively crawling all statewide history. Per earlier session notes, the last full IDX resync attempt also failed/didn't complete cleanly.
**Decision (Ryan's call):** don't backfill now. A full, successful IDX resync will happen before launch, and that will populate real history. Widen the code's query windows now so they're *ready* for that data, and accept 0/sparse results in the meantime.

#### Time windows widened to 1 year (`ab2c9c2`)
- `getMarketSnapshot`: 90-day window → 1 year (`setFullYear(getFullYear() - 1)`). Copy updated: "last 90 days" → "past year" (subtitle, zero-state message, median-price line).
- `findComps`: `WINDOW_MONTHS` changed from `[6, 12, 24]` → `[6, 12]`, capping the widest fallback at 1 year instead of 2.
- **Considered and declined:** Ryan asked about raising `MIN_COMPS` from 3 to 18 (to guarantee a full display grid) with a 24-month fallback if needed. Discussed the tradeoff directly: 18 is a much higher bar than 3, so most ZIPs would routinely need 2-3 sequential DB round-trips per page load instead of usually just 1 (the window-widening loop is sequential, not parallel). Ryan decided against it specifically because of that latency cost — `MIN_COMPS` stays at 3, `WINDOW_MONTHS` stays `[6, 12]`.

#### Comparable Sales pagination (`03d0b54`)
Ryan noticed `findComps` fetches up to 25 comps but the page only ever displayed 9 (`DISPLAY_COMP_COUNT` slice in `route.ts`). Confirmed comps only ever send 1 photo per comp (`firstPhoto()`) — explicitly kept as-is, not expanded to a per-card gallery.
- `route.ts`: removed the `DISPLAY_COMP_COUNT` slice — sends every fetched comp (up to 25) to the client. No new DB query (the single `findComps` call already fetched all 25); only a marginally larger JSON payload.
- `ComparableSales.tsx`: new `paginate()` helper (TDD-tested), pages client-side at 9 per page (matches the existing 3×3 grid) — so only the *currently visible* page's photos are ever downloaded; clicking "next" is what triggers the next batch of image requests, not the initial load. Prev/next arrow buttons reuse `RentCitiesSlider.tsx`'s exact `ArrowIcon` SVG and circular button shape (rotated ±90°, pulse-then-spring-hover), recolored from white-on-dark to dark-on-light to match this section's background. "Page X of Y" label centered between the arrows. Pagination controls only render when there are more than 9 comps.
- Live-verified: page 1 → page 2 shows genuinely different homes (different address/price/date), not just relabeled.

### Key Decisions Made
1. **CRMLS does not limit closed-sale history to 90 days** — verified via live API, not assumption. The gap is entirely on our own sync's side (never fully backfilled). Correct this framing in any future discussion of the topic.
2. **Local Market Snapshot and Comparable Sales windows are both capped at 1 year now**, code-ready for when the full IDX resync happens — deliberately not backfilling before then.
3. **`MIN_COMPS` stays at 3`, not raised to 18** — a deliberate performance tradeoff Ryan chose after understanding the sequential-query cost.
4. **Comps show all fetched results (paginated), not a hard 9-cap** — but still only 1 photo per comp card (no per-card photo gallery).
5. Ryan reiterated a process preference mid-session: he'll say "don't code anything, just talk" when he wants pure discussion before implementation — respect that literally until he explicitly says "build it" / "go ahead."

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. **Full IDX resync is now more urgent than before** — Local Market Snapshot and Comparable Sales both depend on it for real 1-year history (currently sparse/zero for most quarters/older comps since the last resync attempt failed). Investigate why the last full resync failed before retrying — likely related to `idx/client.ts`'s pagination/`$orderby` behavior noted above.
3. Consider whether `idx/client.ts`'s full-resync query needs an explicit `$orderby=ModificationTimestamp desc` or a deliberate historical-closed-sales crawl strategy, given CRMLS's default ordering doesn't appear to favor completeness — this wasn't fixed this session, just diagnosed.
4. Older backlog, unchanged: checklist templates at `/admin/settings/checklists`; the zipForm/Transact gap-analysis findings (SELLER_SIDE mislabel bug, missing Lease Listing distinction, Client Portal candidate feature — see 2026-07-10 notes above); clean up test DB records; consider merging `feature/agent-application-redesign` to `main` (very far ahead now).

**Status: research complete, nothing built yet.** Next step is for Ryan to decide what to prioritize from the list above, alongside the already-identified `SELLER_SIDE` bug fix and the 4 checklist templates (buyer/seller/lease-tenant/lease-listing) from the earlier verified C.A.R. forms-directory research.

---

## Session Notes — 2026-07-13/14 (Railway outage → Neon migration decision + build)

### What happened, in order

**1. Railway went down mid-session.** While investigating an unrelated address-matching bug, Railway's Postgres became unreachable (`P1001` — the TCP proxy stayed up, the DB backend behind it didn't). Confirmed via both a standalone script and the live dev server hitting the same error. Not a one-off: CLAUDE.md already had two prior Railway incidents logged (disk-full crash, a separate platform-wide networking incident). It resolved on its own after a wait, matching the pattern from a previous incident.

**2. Reliability comparison — Neon chosen over Supabase, Railway, and the "big" cloud providers.** Pulled real pricing/SLA pages directly (not from memory) for Railway, Neon, Supabase, AWS RDS, and Google Cloud SQL:
- **Neon Scale plan: 99.95% SLA**, self-serve, no enterprise sales wall — matches AWS RDS/Google Cloud SQL's industry-standard number.
- **Supabase: 99.9% SLA, Enterprise-only** (custom "contact us" pricing) — worse on the one hard requirement Ryan set (reliability), so ruled out despite earlier being considered for its bundled auth/storage (CnC already has its own NextAuth setup, doesn't need that).
- **Railway (what we're on): no real SLA below $1,000+/mo Enterprise** — Hobby/Pro tiers only get a stated "Availability Target," not a contractual guarantee.
- **AWS RDS / Google Cloud SQL:** same 99.95-99.99% class, but no built-in connection pooling (would need a separate paid RDS Proxy) and meaningfully more ops overhead (VPC/IAM/subnet groups) for a team without dedicated DevOps.
- Codebase check (via Explore agent) confirmed a clean migration: **zero Postgres extensions in use, zero raw SQL** (`$queryRaw`/`$executeRaw` — grep found nothing), and **the site isn't in production yet** — so this is a zero-downtime, zero-cutover-risk decision, not a live migration.
- Also surfaced a real, already-existing gap: **no connection pooling configured at all today** — `DATABASE_URL` is a plain string straight to Railway's public proxy. Neon's bundled pgBouncer pooling (on every tier, including Free) fixes this for free.
- Storage growth check: DB is ~4GB today (185,017 rows). Neon's per-branch ceiling is 16TB — a complete non-issue at our scale, and multi-AZ HA/the SLA aren't gated by data volume at all.
- **Railway billing confirmed month-to-month, not prepaid** (screenshot of actual billing history: `$5.00` and `$3.20` monthly usage charges) — switching to Neon costs nothing extra, no forfeited balance.
- **Cron/background jobs are NOT on Railway.** Discovered `apps/crm-api` (the originally-planned Express background-jobs service) was dead code — a bare `/health`-endpoint stub, never deployed. All real cron work (IDX sync, property alerts, deadline reminders) already runs as Vercel Cron-triggered Next.js API routes. Railway's only real job was ever the database — this made the Neon migration a clean, isolated swap with no "where does the worker go" question. **`apps/crm-api` deleted** (commit `d20baeb`).

**3. IDX sync scope redesign (discussed, then built).** Since CnC recruits agents statewide across California (not a single-region brokerage — corrected an earlier wrong assumption), the sync stays unscoped geographically. Decided the status filter instead: keep `Active`/`ComingSoon`/`ActiveUnderContract` for both `FOR_SALE` and `FOR_RENT` (live search needs both), keep `Closed` for `FOR_SALE` only (closed rentals unused anywhere), explicitly exclude `Expired`/`Withdrawn`/`Cancelled` (confirmed via grep that nothing reads these — current DB is 100% split across only 5 "market-actionable" statuses already, likely a CRMLS IDX license restriction rather than something we needed to filter for space).

**4. Price History — kept, with a two-tier storage design.** Live-checked BHHS's actual home-value tool (the site's original reference) via Puppeteer — it has comps, a quarterly market-trends chart, and a buyer heatmap, but genuinely no per-property Price History section. So CnC's version is intentionally more built-out than its own reference, not something to cut to match it. Storage design: full record (photos + details JSON) for Active + Closed-within-1-year; lightweight (no JSON blobs) for Closed sales older than 1 year, so Price History stays complete statewide without unbounded storage growth. Measured real byte sizes from the DB: full record ~2,200 bytes/row vs. lightweight ~200 bytes/row (~11x smaller) — confirmed cheap, and confirmed via the actual index list (`[status, zip, closeDate]` etc.) that none of this slows down any existing query.

**5. Address-matching bug — real root cause found and fixed.** The Woodham/Woodhams mismatch flagged in the previous session note turned out to be a live-verifiable, structural problem: typing the *correct* MLS spelling into the real search bar, Mapbox's dropdown **never** offers it — its geocoding database simply doesn't have that spelling, so no user action could have avoided the mismatch. Ruled out a naive house-number+zip fallback (measured a **10.2% real collision rate** across the DB — two different streets sharing a house number in the same zip — too risky as a blind auto-match). Built instead: a 4th zip-scoped fallback tier in `findSubjectProperty`, using lat/lng proximity (bounding box ±0.005°, then exact Haversine distance, 100m cutoff) — sidesteps the entire class of Mapbox/MLS spelling disagreement rather than patching this one address.

**6. Built via subagent-driven-development — 2 plans, 6 tasks, both final whole-plan reviews caught real bugs:**
- Specs: `docs/superpowers/specs/2026-07-13-{idx-sync-status-filter,price-history-retention,address-latlng-fallback}-design.md`
- Plans: `docs/superpowers/plans/2026-07-13-{idx-sync-filtering-and-retention,address-latlng-fallback}.md`
- **Plan 1 final review caught a Critical bug**: the lightweight-record branch wrote a literal `null` for the `details Json?` column — Prisma 5 rejects that at runtime, so every old-closed-sale write would have silently thrown and been swallowed by the loop's try/catch, meaning the whole retention feature would have failed completely on first real use. This was a bug in *my own plan's example code*, not implementer error — mocked-Prisma tests couldn't catch it since the mock accepts any value. Fixed with `Prisma.DbNull` (commit `87f04b4`).
- **Plan 2 final review caught an even more consequential bug**: the `/home-value` page received `lat`/`lng` in its own URL but never forwarded them into its fetch call to the estimate API — so **tier 4 was completely unreachable in production** despite all 3 tasks individually passing their own tests (each layer's tests only verified itself in isolation; the route-level test hand-built a request URL containing lat/lng, which masked that the real page never sent them). This was the exact production case the whole plan was built to fix. Fixed (commits `2a6f1ba`, `46431c5`), plus a related NaN-handling gap (malformed `?lat=` bypassed the `== null` guard). **Live-verified end-to-end afterward via Puppeteer** (not just diff-trusted, since unit tests already missed this once): drove the real `/sell` → Mapbox autocomplete → `/home-value` flow for "18521 Woodham Carne Rd" — confirmed a matched subject (4bd/4ba/3,989sqft/1954/Tuolumne County), not manual entry.
- All commits: `b05ef9a`..`46431c5`. Full suite 420/420 passing.

### Key Decisions Made
1. **Switching Railway → Neon for the database.** Reasoning above. Migration is DB-only (background jobs already on Vercel).
2. **Full IDX resync deferred until deploy-time** — explicitly, per Ryan: the last full-resync attempt crashed the database (disk-full, logged in earlier session notes), so don't retry it until actually ready to launch. Code is ready for it (statewide, filtered, two-tier retention) but nothing has been backfilled yet.
3. **Cancel the Railway plan only after the Neon migration is confirmed working** — no rush, no prepaid balance to lose either way.
4. Ryan reiterated the same process preference again this session: "talk first" before implementation, explicit "let's get to work" before code starts.

### Migration completed same session — Neon is live, Railway is cancelled

Ryan finished the Neon signup and walked through project setup live (guided
step-by-step, screenshot by screenshot, since account/billing actions
needed to be his own clicks, not mine):

- **Org:** "CnC Realty" (email+password signup, not tied to a personal
  Google/GitHub account — deliberate, keeps business infra independent of
  personal account status).
- **Project:** "CnC Realty Production", region **AWS US West 2 (Oregon)**.
- **Plan: Scale**, not Launch — this was a real correction mid-setup. Launch's
  pricing page listing showed "Scale to zero after 5 minutes" as a fixed
  included feature, not configurable — only **Scale** shows "Configurable
  scale to zero" AND the "Uptime SLA 99.95%" we picked Neon for in the first
  place. Launch would have gotten us neither. Cost is roughly double Launch's
  per-CU-hour rate as a result (~$30-45/mo realistic estimate vs. the
  original ~$15-22/mo Launch guess) — worth it for what was actually the
  point of this migration.
- Scale-to-zero disabled on the `production` branch's primary compute via
  Branches → production → Edit primary compute → toggle off.
- Pooled connection string grabbed from Connect → Connection pooling toggle
  on (hostname has `-pooler` in it).

**Schema migration:** `prisma migrate deploy` applied all 30 existing
migrations cleanly to the fresh Neon database.

**Caught a real bug in my own verification, not just the migration:** the
first connectivity check silently reconnected to the *old* Railway DB
(returned Railway's exact row count) because `packages/database/.env` — a
separate file Prisma's tooling reads with higher precedence than
`apps/web/.env.local` — still had the Railway URL. Fixed both files,
re-verified for real: 0 rows, 44 tables, a genuine write+delete round-trip
succeeded.

**Full data migration (schema-only wasn't enough — Ryan caught this before
Railway got cancelled):** wrote a Prisma-to-Prisma copy script covering all
43 models in FK-dependency order (computed via a topological sort of the
live Prisma DMMF relation graph, not hand-transcribed). Hit two real bugs
during this, both root-caused before retrying:
1. Prisma's query engine cannot marshal ~185,017 rows in one unchunked
   `findMany()` call (`Failed to convert rust String into napi string`) —
   confirmed via binary-search isolation that no single row was at fault;
   reproduced cleanly with an unchunked call, fixed by paginating reads in
   5,000-row pages (not just chunking writes, which the first version
   already did).
2. `LeadTag` (and any join table with a composite `@@id`, not a plain `id`
   field) broke a hardcoded `orderBy: { id: "asc" }` — fixed by deriving
   each model's actual primary-key field(s) from the DMMF instead of
   assuming every table has `id`.
3. A background-task "exit code 0" was misleading once — it reflected
   `tee`'s exit code, not the underlying script's, since the pipe's exit
   status defaults to the last command. Redirecting to a file directly and
   checking `$?` explicitly afterward gave the real signal. Worth
   remembering for any future piped background command.

**Verification, independent of the migration script's own self-reported
counts:** a separate script compared live `count()` on both databases for
all 43 tables — all matched exactly (185,196 total rows each side).
Content spot-checked too (a real Property row's lat/lng, real user emails,
`AgentApplication` count) — not just row counts.

**Railway cancelled** after — and only after — the above was independently
verified. `$2.61` final charge on Jul 17 (usage through end of current
billing cycle, as expected from the month-to-month model). Dead Railway
credentials removed from both `.env` files once cancellation was confirmed.

**Dev server restarted** to pick up the new `DATABASE_URL` (env vars are
read at Next.js process start, not live) and confirmed via live server
logs that a real request executed a Prisma query against Neon.

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty` — it
   now points at Neon by default (`apps/web/.env.local` and
   `packages/database/.env` both updated, Railway fully removed from both).
2. Consider `superpowers:finishing-a-development-branch` for
   `feature/agent-application-redesign` at some point — it's been the
   working branch for a very long time now without merging; worth asking
   Ryan whether/when to address that, not a unilateral call.
3. Older backlog, unchanged: checklist templates at
   `/admin/settings/checklists`; zipForm/Transact gap-analysis findings
   (SELLER_SIDE mislabel bug, missing Lease Listing distinction, Client
   Portal candidate feature); clean up test DB records.

Not an active item — background context only: the full IDX resync remains
deferred with no target date (Ryan confirmed 2026-07-14 he won't be ready
for it "anytime soon"). Neon has all the same data Railway had (via the
full data migration), same volume/scope as before since the resync itself
still hasn't run (mostly recent listings, sparse older history). Don't
bring this up as a pending task — it'll come up again on Ryan's own
timeline, not proactively.

---

## Session Notes — 2026-07-15 / 2026-07-16

### What Was Completed

All changes committed on `feature/agent-application-redesign` (commits `44abe8b` through `53e8f27`).

**Referral transaction lifecycle — now fully fixed and verified end-to-end.** This closes out the whole thread of referral-workflow bugs discovered during last session's live Puppeteer verification.

1. **`44abe8b`** — Root cause of the admin-permission bug: `canTransitionTransaction`/`canTransitionListing` picked EITHER the admin transitions table OR the agent table by role, never both, so an ADMIN account that's also a file's agent couldn't perform agent-only transitions (e.g. `PENDING → REFERRAL_SUCCESSFUL`). Fixed by making ADMIN's allowed set the union of both tables. Verified via TDD (new tests) and confirmed the previously-broken Puppeteer flow now works live.
2. **`e34c79a`** — Closed the 3 outstanding Minor findings from the earlier final-plan review: admin `FileCard` now gets `referredToAgentName`; `ReferralActions.patch()` now checks `res.ok` and surfaces a real error instead of silently reloading (no test added — confirmed this project has zero React-component-render test infrastructure anywhere, so this was judged disproportionate to build out for one small fix); added a full-lifecycle integration test (agent marks successful → admin enters amount → admin closes, plus a negative case for an agent attempting an admin-only transition). Validity-checked the new test by temporarily breaking the real code and confirming it failed for the right reason.
3. **`1b2b1f6`** — Fixed the last Minor: the generic "Submit for Review" button was rendering as an identically-styled gold pill directly next to `ReferralActions`' "Submit for Broker Review" button — confirmed live via Puppeteer that this really did look confusing (two near-identical buttons doing unrelated things). Hidden entirely on referral files. Then finished the live click-through of the full 5-state lifecycle (Pending → Referral Successful → Broker Review → Closed), confirming the fee computes correctly server-side (5,000 → 500) and the Activity tab shows a clean audit trail.

**Home-value page (`/home-value`) — several rounds of polish, all committed:**

4. **`0cefec5`** — Unrelated pre-existing `tsc` gap fixed: `findByProximity`'s NaN-safety guard (`Number.isFinite(lat)`) wasn't recognized by TypeScript as a narrowing type guard, leaving 5 "possibly undefined" errors. Added a proper `isFiniteNumber(n): n is number` predicate wrapping the same check — zero behavior change, confirmed by temporarily swapping in a broken version of the predicate and watching the existing NaN regression test catch it.
5. **`e3e6144`** — Local Market Stats section: renamed from "Local Market Snapshot", median price re-centered and enlarged (now animates in with the same scramble-digit effect used on the join page's StatsBar — extracted into a new shared `components/ui/ScrambleValue.tsx`). Also applied the same animation to "Estimated Value Range" — this initially failed silently (stuck at the placeholder dashes) because the `useInView` hook was declared directly inside `HomeValuePage`, which has an `if (loading) return (...)` early return; the hook's first-ever effect ran while the ref was still `null` (before the loading gate lifted) and never re-subscribed once the ref populated on a later render of the same component instance. Fixed by extracting a dedicated `EstimatedValueRange` leaf component (matching the existing `LocalMarketSnapshot` pattern, which had avoided this same trap by construction). Also added the shared `PageCTA` section (same component used on buy/sell/rent/manage/join) to the bottom of the page — required canceling out `<main>`'s own padding with a negative margin since, unlike the other marketing pages, this page's `<main>` applies padding directly instead of leaving it to each full-bleed section. Final CTA copy (Ryan's own wording): heading "You're In **Control**", body "CnC's got your back", single "Message" button (no secondary button).
6. Minor copy tweaks: "Homes similar to yours that have recently sold nearby." → "Similar homes nearby that have recently sold"; removed trailing periods; "median" → "Median" capitalization; Price History and Comparable Sales sections swapped in display order.

**Two real investigations this session, both using `systematic-debugging`, with different outcomes:**

7. **"Median sold price" being much lower than "Estimated Value Range" for a large home — investigated, found NOT a bug.** `getMarketSnapshot` (the median/histogram) intentionally queries every closed sale in the ZIP with zero filtering by beds/sqft/type; `queryComps` (the estimate) intentionally filters to comparable-sized homes. Confirmed against the original design spec (`docs/superpowers/specs/2026-07-12-local-market-price-histogram-design.md`), which explicitly documents this as a deliberate "what's happening broadly in your ZIP" vs. "comps for this specific home" distinction. **Decision: leave as-is, no code change** — Ryan was satisfied with the explanation.
8. **`53e8f27`** — Comparable Sales showing blank/broken images — investigated, found a **real bug**, not a resync-completeness issue (all sampled comps had recent sync timestamps). Root cause: the IDX sync's photo mapping (`field-map.ts`) took every CRMLS `Media` entry's URL indiscriminately, with zero filtering by media type — and CRMLS's `Media` resource isn't photos-only (some listings have PDF disclosures/flyers attached via the same resource). Confirmed live against the real Trestle API that `MediaClassification` reliably distinguishes `"PHOTO"` from `"DOCUMENT"` (checked directly against a known-broken listing's actual PDF entry). **Also confirmed via live testing that this same bug affects the property search/detail pages too** (found real broken Active listings, e.g. `36393 Provence`, Murrieta) — it's just less visually obvious there because `PropertyCard.tsx` uses `next/image` (fails silently, blends into background) while `ComparableSales.tsx` uses a plain `<img>` tag (shows the browser's visible broken-image icon in a fixed-size box). Fixed by adding `MediaClassification` to the sync's `$expand=Media` select and filtering to `PHOTO`-or-unclassified entries before mapping. New test coverage added to `field-map.test.ts` (previously zero coverage of the photos-mapping logic at all); validity-checked the same way as the other fixes this session.
   - **Important caveat, not yet resolved:** this fix only applies going forward. It doesn't retroactively fix listings already sitting in the DB with a bad `photos` array — those stay broken until CRMLS reports a modification (triggering a normal incremental re-sync) or a full resync runs (still deferred, no target date).

### Key Decisions Made

1. **"Median sold price" stays ZIP-wide/unfiltered** — confirmed intentional by design, not worth changing.
2. **This session established a recurring verification pattern** worth continuing: for any fix to already-passing/already-working code, validate the new test is real (not decorative) by temporarily breaking the actual implementation and confirming the test catches it, then restoring — used on the admin-permission fix, the lifecycle integration test, the `isFiniteNumber` fix, and the IDX photo filter.
3. **No React-component-render test infrastructure exists in this project** (`vitest.config.ts` is `environment: "node"`, `.test.ts` only) — confirmed again this session. Don't attempt to add one for a single small fix; it's a bigger, separate decision if ever wanted.

### Next Session — Start Here

Ryan said "let's go back to testing the transaction management system" and then stopped for the night before any actual testing happened — this is the explicit next step, not yet started.

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty`
2. **Still-open item, carried forward from an earlier session, never resolved:** the referral wizard's step-bar visual highlight (the `displayStep` mapping in `new-transaction/page.tsx`, reusing raw step 5 → bar position 2) has been logic-traced correctly twice but never actually looked at rendering. Good candidate to check first since it's cheap and already flagged.
3. **Broader transaction-system testing** — the referral lifecycle is now fully verified end-to-end (this session), but regular (non-referral) transaction types — Purchase, Listing, Lease Tenant/Landlord — haven't had the same live click-through treatment recently. Worth walking at least one of each through its full status lifecycle.
4. Older backlog, unchanged: checklist templates at `/admin/settings/checklists`; zipForm/Transact gap-analysis findings (SELLER_SIDE mislabel bug — already fixed per 2026-07-14 notes, confirm still holds; missing Lease Listing distinction — also already fixed; Client Portal candidate feature — not started); consider `superpowers:finishing-a-development-branch` for `feature/agent-application-redesign` at some point (very long-lived branch now); full IDX resync remains deliberately deferred, no target date.

---

## Session Notes — 2026-07-19 / 2026-07-22

### What Was Completed

All changes committed on `feature/agent-application-redesign`: `00e1e85`, `bfda915`, `d10dd79`, `969504b`, `b805617`. Pushed to GitHub throughout.

**Closed out the 2026-07-18 audit-fix plan entirely:**
- Task 9 (shared `checkOwnership` helper, 14 route files) — dispatched the task-reviewer (opus): Approved with only Minor findings, zero Critical/Important. Marked complete in the ledger.
- Final whole-plan review across all 9 tasks (opus, `b17305c..8f93328`): **"Ready to merge? Yes."** Independently re-ran the full suite and `tsc`, confirmed no cross-task conflicts, confirmed migration ordering, confirmed the disclosed 7-file ownership-pattern gap was accurate. One non-blocking note: ~40 pre-existing `tsc` errors unrelated to the plan.

**Two real bugs found and fixed, via `systematic-debugging` + TDD:**
1. **`00e1e85`** — Referral-file status emails (`sendFileClosed`, `sendSubmitForReview`, `sendDocumentRejected`, `sendAllDocsApproved`) rendered the literal word "null" in the subject/body when `propertyAddress` was null (only ever true for `REFERRAL` transactions, by design). Fixed with a `"this referral file"` fallback.
2. **`bfda915`** — Public agent profile page displayed closed REFERRAL transactions as `"$0"` / `", , CA"` broken cards. Root-caused as the wrong fix target: a referral isn't a transaction the agent personally closed (no property, no price), so it shouldn't be counted as one publicly at all. Fixed by excluding `transactionSide: "REFERRAL"` from the public Transactions query, not by patching the display logic.

**Closed all 6 remaining production `tsc` errors (`969504b`):** one real bug (`LeadProfileTabs`'s `TaskItem` type was silently missing the `notes` field — the actual serialization in `dashboard/leads/[id]/page.tsx` dropped it too, meaning opening a lead's task-edit drawer showed a blank Notes field even when real notes existed, and saving would have silently overwritten them with `null` — fixed via TDD, committed separately as `d10dd79`), plus 4 pure type-only fixes (`agents/[slug]/page.tsx`, `SellProcess.tsx`, `Navbar.tsx`, `BuyFeatures.tsx` — zero behavior change, confirmed by reasoning + full suite). Remaining ~33 `tsc` errors are all test-file-only mock-shape mismatches, pre-existing, not touched.

**Git/GitHub housekeeping — first push in a long time, full branch cleanup:**
- Discovered `feature/agent-application-redesign` had never been pushed at all (384 commits, purely additive — no force-push risk). Pushed it, established `-u` tracking.
- Discovered GitHub's *default* branch (`claude/real-estate-website-9bdWi`) was actually the **stalest** of the three remote branches (last commit 2026-06-11) — `main` (last commit 2026-06-20, 142 commits ahead of it) was more current, and our branch was a strict superset of both with zero divergence anywhere.
- Fast-forwarded local `main` to the branch tip and pushed (`fcd2dc9..969504b` on `origin/main`) — a clean fast-forward, no merge commit, no conflicts.
- Walked Ryan through GitHub's Settings → General → Default branch UI (not Settings → Branches, which only has protection rules) to flip the default branch from `claude/real-estate-website-9bdWi` to `main`. Done, confirmed via the "Default branch changed to main" banner.
- `claude/real-estate-website-9bdWi` deliberately left alone (fully absorbed into `main`, zero data loss either way) — Ryan chose not to delete it, no urgency either way.
- **Established going-forward workflow, explicitly discussed:** push to `feature/agent-application-redesign` as the normal unit of work; `main` gets updated only as a deliberate, occasional action (like tonight's one-time catch-up), not automatically after every commit — this is standard practice so `main` keeps meaning "known-good/deployable," not just a live mirror of in-progress work. The 2026-07-21 commit (`b805617`) was pushed to the feature branch only, per this — `main` is now one commit behind on purpose.

**Diagnosed a real "30-second delay after selecting a Mapbox address" report, via `systematic-debugging`:** confirmed via direct reproduction (touched `Navbar.tsx`, timed consecutive requests: 3.1s cold vs 0.06s warm) that this is Next.js dev-server on-demand route compilation, triggered because `Navbar` sits in the root layout (a dependency of every page) and had just been edited. Compounded by the dev server's ~1.5GB memory footprint indicating a long, uninterrupted run — matches a previously-diagnosed pattern in this exact project (2026-05-27 session note). **Not a code bug, won't happen in production** (Vercel pre-compiles). No code changed; offered a dev-server restart, Ryan chose to keep testing instead.

**New Transaction wizard — copy pass, input restrictions, and required-field validation (`b805617`):**
- Reworded all 9 Transaction Type / Transaction Stage card descriptions to be shorter (e.g. "Representing the buyer in a purchase transaction" → "Buyer representation"); renamed "Representation Type" → "Transaction Type", "Additional Property Details" → "Optional Property Info".
- Removed the descriptions under Residential/Commercial cards (`OptionCard.desc` made optional, conditionally rendered — no empty gap left behind).
- Renamed the Residential/Commercial section label from "Property Type" to **"Select One"** after Ryan caught that it collided with Step 1's separate, unrelated "Property Type \*" field (Single Family/Condo/etc.) — two different concepts, now disambiguated.
- **Added input restrictions**, TDD'd: City (letters only — `stripDigits`), ZIP (5 digits), MLS Number (**10 digits**, not the originally-requested 9 — verified empirically that 100% of 185,017 real CRMLS MLS numbers in the DB are 10 digits, would have blocked every real MLS# otherwise), Year Built (4 digits). New shared helpers `stripDigits`/`digitsOnly` in `lib/form-validation.ts`. Also fixed the **agent application form's City field**, which had zero restriction at all (the literal bug Ryan screenshotted, "222222222222" typed into City) — and migrated its pre-existing ZIP/License Number inline regex duplicates onto the same shared helpers.
- **Extracted the byte-identical duplicated `Field` component** from the New Transaction and New Listing wizards into one shared `components/ui/FormField.tsx` (matching the `PageCTA` precedent Ryan referenced) — confirmed via direct discussion this is a maintainability win, explicitly **not** a performance/load-speed improvement (the duplicated code was only ~15 lines; savings are negligible either way).
- **Made Property Type and MLS Number required** for all non-REFERRAL transaction sides, both client-side (`canAdvance` Step-1 gate — also fixed a real latent bug where these two fields were missing from the gate's `useMemo` dependency array entirely) and server-side (`POST /api/transactions`). Required updating 6 existing tests whose payloads predated the new requirement.
- Scoped deliberately to the New Transaction wizard only — New Listing's "Type" field (`listingType`) is a different concept that already defaults to a set value, not a blank-optional dropdown; not touched.

**Investigated and answered: where did the New Transaction wizard's Offer-step field names come from?** Traced via `git log -S` / `git blame` rather than memory — confirmed a genuine two-source origin, not fabricated: most of the screen (List Price, Sale/Purchase Price, Escrow Number, Acceptance Date, Inspection/Appraisal/Loan-Approval Deadlines) traces to the original **SkySlope**-based wizard rebuild (2026-05-23 session, commit `d6923be`). Specifically Deposit, Offer Date, Offer Expiration Date, Final Walkthrough Date, Possession Date, and the Conditions/Contingencies section trace to the **Lone Wolf Transact** (zipForm's actual current product) research from the **2026-07-10** session, flowing through a written design spec (`docs/superpowers/specs/2026-07-11-core-transaction-type-overhaul-design.md`, §2c) into implementation commit `dfce848` on 2026-07-11.

### Key Decisions Made

1. **Branch workflow going forward:** `feature/agent-application-redesign` is where ongoing work gets pushed; `main` is updated deliberately, not automatically — confirmed explicitly with Ryan.
2. **MLS Number cap is 10 digits, not 9** — empirically verified against the real DB, not assumed from the original request.
3. **Shared components are for maintainability, not performance** — explicitly discussed and agreed; don't oversell future dedup work as a speed win.
4. **"Select One" vs "Property Type"** — Step 0's Residential/Commercial section label is intentionally different from Step 1's Property Type dropdown to avoid on-page naming collision.
5. **New Transaction wizard field provenance is dual-source** (SkySlope + zipForm/Transact, different sessions) — confirmed via git history, not fabricated by Claude, per Ryan's explicit question.

### Next Session — Start Here

1. Run `pnpm --filter web dev` from `C:\Users\hey_r\Desktop\CnC-Realty` (the same long-running dev server from tonight — a restart would clear the accumulated HMR cache bloat noted above; not urgent, Ryan's call).
2. **Pick back up "testing the transaction management system"** — this was the explicit next step two sessions ago, then got interrupted first by the audit-fix/tsc/Git cleanup work, then by this session's New Transaction wizard changes. Still genuinely the next thing:
   - The referral wizard's step-bar visual highlight (`displayStep` mapping, `new-transaction/page.tsx`) — logic-traced twice, never visually confirmed. Cheap to check first.
   - Regular (non-referral) transaction types — Purchase, Listing, Lease Tenant/Landlord — haven't had a live click-through in a while; the referral lifecycle is the only one fully verified end-to-end so far.
   - Now that Property Type + MLS Number are required, worth a live click-through of the New Transaction wizard specifically to confirm the new validation gate feels right in practice (not just test-covered).
3. `main` is one commit behind `feature/agent-application-redesign` (`969504b` vs `b805617`) — intentional per the new workflow, not an error; only sync it when Ryan actually wants `main` updated.
4. Older backlog, unchanged: checklist templates at `/admin/settings/checklists`; the 7 disclosed-but-unfixed duplicate-ownership-check files from Task 9; full IDX resync (deliberately deferred, no target date).

**Decided 2026-07-22: not building Client Portal.** Was the top candidate from the 2026-07-10 zipForm/Transact gap analysis — but most agents already get proof-of-funds/ID directly from clients via text/email, so the portal wouldn't solve a real friction point at CnC's scale. Dropped from the backlog (Ryan's call).
