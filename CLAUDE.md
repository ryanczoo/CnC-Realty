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
- Buy, Sell, About, Contact pages
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

**Design Direction: Option A — Video Hero, Dark Gold + Light Body**

**Color shift:** Primary hero color changed from navy to **dark gold**. Navy used as accent/secondary.

**Homepage sections (in order):**
1. **Hero** — Full-viewport video background (`C:\Users\hey_r\Desktop\Homepage video 6K.mp4`, copy to `apps/web/public/`). Dark gold semi-transparent overlay. Centered: CnC logo, typewriter effect cycling *"Find Your Dream Home" → "Sell Smarter" → "Join Our Team" → "Your Future Starts Here"*, and Aceternity `placeholder-and-vanish-input` search bar.
2. **Stats Bar** — Full-width dark gold strip. Animated number counters (homes sold, active listings, agents, years in CA) ticking up on scroll.
3. **Featured Listings** — White background. Aceternity `focus-cards` grid (hover to focus, blur others). Placeholder data for now — real MLS data comes in Phase 4.
4. **Why CnC** — Light gray background. Aceternity `bento-grid` highlighting differentiators: CRMLS access, free agent signup, tech tools, local expertise.
5. **Agent Spotlight** — White background. Aceternity `animated-tooltip` on agent photos — hover to see stats pop up.
6. **Testimonials** — Dark gold background. Framer-motion animated cards.
7. **Join CnC CTA Banner** — Navy background. Magic UI `shimmer-button` with bold recruitment message.

**Vibe:** Warm/trustworthy + tech-forward + premium (like Compass meets eXp but more alive)

**Video note:** `Homepage video 6K.mp4` is 160MB — fine for local dev, needs compression before Vercel deploy.

**Feedback workflow:** Ryan will run `pnpm dev` locally, take screenshots (save as PNG to Desktop with path), and describe changes. No Word docs — paste feedback in chat or share PNG file paths.

**Component libraries available:**
- shadcn/ui (base components)
- Magic UI via shadcn registry (`pnpm dlx shadcn@latest add "https://magicui.design/r/[name]"`)
- Aceternity UI via MCP + shadcn registry (`npx shadcn@latest add https://ui.aceternity.com/registry/[name].json`)

### Next Session — Start Here

1. Copy video to `apps/web/public/homepage-video.mp4`
2. Build Phase 2 homepage (all 7 sections above) and remaining marketing pages
3. Run `pnpm dev` in `apps/web`, open `localhost:3000`, Ryan reviews and gives feedback
4. Iterate on visuals until approved, then commit and move to Phase 3

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
