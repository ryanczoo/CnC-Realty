# Newsletter — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD per task.

**Goal:** Footer signups become brokerage leads on a newsletter list (single opt-in + welcome email) that an admin can mass-email as a Campaign, with its own unsubscribe category.

**Spec:** `docs/superpowers/specs/2026-09-28-newsletter-design.md`

**Reuses:** `publicFormRateLimit`, `isValidEmail`/`emailError`, `FieldError`, `sendEmail` (broadcast stream + category), `emailLayout` + `buildHeadingBodyHtml`, unsubscribe token/preferences system, Postmark webhook, `PREBUILT_LISTS`, campaign send route + `CampaignContact` stats, motion `PULSE_*`.

## Tasks
1. **Migration (ask first)** `20260928120000_add_newsletter`: `Lead.newsletterSubscribedAt`, `Lead.newsletterOptOut`, `LeadSource.NEWSLETTER`, enum `CampaignAudience` + `Campaign.audience`. migrate status → deploy → stop only the :3000 Next process → prisma generate → restart dev.
2. **Unsubscribe category** (TDD): `newsletter` in `EmailCategory`/`CATEGORY_KIND` (lead); `sendEmail` lead opt-out lookup + unsubscribe apply/preferences include `newsletterOptOut`; preferences page checkbox; Postmark webhook bounce/spam sets it.
3. **Welcome email** (TDD): `sendNewsletterWelcome(lead)` — shared layout + photo, broadcast/newsletter. Photo file added when Ryan sends it (placeholder until then). Live test send.
4. **Signup route** (TDD) `POST /api/newsletter/subscribe`: rate limit, email check, existing-lead upsert vs. new brokerage lead, welcome only on first join, always `{ ok: true }`.
5. **Footer** form wiring: submit → loading → "You're subscribed!" / error; pulse on the arrow.
6. **Campaign audience** (TDD): admin-only "All newsletter subscribers" on the Recipients step; send route resolves subscribers at send time, creates `CampaignContact` rows, sends with category `newsletter`.
7. **List visibility** (TDD): Smart List "Newsletter Subscribers"; unassigned-brokerage banner/list exclude `source NEWSLETTER`.
8. Gate (vitest, tsc, lint, dev log, page checks), commit per task; click-through list for Ryan.
