# Newsletter — Design

**Status:** approved by Ryan 2026-09-28. Welcome-email photo to come from Ryan.
**Why:** the footer "Subscribe to our Newsletter" box has never done anything — no route, no list. It should collect leads for the brokerage and build a list Ryan can mass-email.

## Decisions (Ryan)
1. Signups belong to the **brokerage** (lead pool, `agentId: null`); an admin can still assign one to an agent.
2. A **separate "Newsletter" unsubscribe category** — leaving the newsletter doesn't stop an agent's campaigns/drips, and vice versa.
3. **Single opt-in** — subscribed immediately + a branded welcome email.
4. Newsletter-only signups are **kept out of the "unassigned brokerage leads" banner/list**.
5. Postmark 10k/month plan at deploy; Ryan raises his own monthly email limit (Admin → All Agents) as needed — no quota code changes.

## 1. Data (migration — ask before applying)
- `Lead.newsletterSubscribedAt DateTime?` — set when they join (kept on opt-out, as history).
- `Lead.newsletterOptOut Boolean @default(false)` — the new opt-out, like `campaignOptOut` / `actionPlanOptOut`.
- `LeadSource` gains `NEWSLETTER`.
- `Campaign.audience` — new enum `CampaignAudience { SELECTED_LEADS, NEWSLETTER }`, default `SELECTED_LEADS` (today's behavior unchanged).

A subscriber = `newsletterSubscribedAt != null AND newsletterOptOut = false`.

## 2. Signup — `POST /api/newsletter/subscribe { email }`
- Shared `publicFormRateLimit` + shared `isValidEmail` (400 "Please enter a valid email address.").
- **Existing lead with that email** (case-insensitive, any agent): set `newsletterSubscribedAt` if empty, `newsletterOptOut = false`. Agent unchanged. No duplicate.
- **New email:** create a lead — `firstName "Newsletter"`, `lastName "Subscriber"`, `email`, `source NEWSLETTER`, `agentId null`, subscribed.
- **Welcome email** only the first time someone joins (not on re-submits).
- Always responds `{ ok: true }` → footer shows "You're subscribed!" (never reveals whether the email already existed).

## 3. Footer
The newsletter box becomes a real form: shared `emailError` + `FieldError`, submit → loading → "You're subscribed!" (or an error); the Subscribe arrow gets the standard pulse. No new queries on page load.

## 4. Welcome email — `sendNewsletterWelcome`
Shared `buildHeadingBodyHtml` (hero photo + heading + body) inside `emailLayout` (logo, CTA, shared footer). Marketing stream: `stream: "broadcast"`, `category: "newsletter"`, recipient = the lead → unsubscribe link and opt-out check come from `sendEmail`.
- **Photo:** Ryan supplies; cropped to the 2400×693 banner → `public/newsletter-welcome-photo.jpg`.
- **Draft copy (Ryan may edit):** heading "Welcome to the CnC Newsletter"; body "Thanks for subscribing! You'll get California market updates, new listings, and home tips from CnC Realty."; button "Visit CnC Realty" → homepage.
- Live test send to ryanchong@cncrealtygroup.com after it's built.

## 5. Sending a newsletter — Campaigns
- New Campaign → Recipients: **admin-only** "All newsletter subscribers" (sets `audience = NEWSLETTER`; no 200-lead picker).
- `POST /api/campaigns/[id]/send`: for `NEWSLETTER`, resolve subscribers at send time, create their `CampaignContact` rows for stats, send with `category: "newsletter"`. Existing suppression logic extended to the new category; quota/stats/Postmark unchanged.

## 6. Unsubscribe
- `EmailCategory` + `CATEGORY_KIND` gain `newsletter: "lead"`; lead opt-out lookup covers `newsletterOptOut`.
- Preferences page: a "Newsletter" checkbox (same component as the others).
- Postmark bounce/spam webhook also sets `newsletterOptOut`.

## 7. Seeing the list
- Prebuilt Smart List **"Newsletter Subscribers"** (`PREBUILT_LISTS`).
- Unassigned-brokerage banner/list (`admin/leads` page + `/api/admin/leads/unassigned`) excludes `source NEWSLETTER`.

## Scope / cost
Footer + admin campaign flow + unsubscribe. No page-load queries added. TDD throughout; one migration (asked first).
