# Booking Calendar ("Book a call with Ryan") — Design

Date: 2026-11-16 · Status: draft for Ryan's review · Brainstormed with Ryan 2026-11-12 → 11-16

## Why

Other brokerages put Calendly on their sites to turn visitors into booked conversations. Ryan wants the same
without paying for Calendly, built into the CnC site so every booking lands in the CRM as a lead. It also gives the
daily recruiting emails (cnc-outreach-mailer) a one-click "Book a call" next step for agents at other brokerages.

Success: a visitor (buyer, seller, renter or agent) picks an open 15-minute slot, gets a Google Calendar invite,
and Ryan sees the call on his Google calendar and the lead in his CRM, with zero manual steps by Ryan.

## Goals

1. Live open times from Ryan's Google calendar (ryanchong@cncrealtygroup.com).
2. Booking rules: hours, minimum notice, booking window (values below).
3. Days off: handled through Google Calendar itself, all-day event set to Busy (no new dashboard screen).
4. Calendar invite with a Google Meet link or the visitor's phone number.
5. Email reminders 24 hours and 1 hour before the call.
6. Visitor can reschedule or cancel on their own.
7. A few intake questions (the contact form's fields).
8. Each booking lands in the CRM as a lead, unassigned, for Ryan to assign.
9. Placement: Contact page (right side), Join page (own section), recruiting email (button).

## Non-goals

- No per-agent calendars or routing. **Every booking is with Ryan, and every lead goes to Ryan** (Unassigned), who
  assigns it to an agent himself. The recruiting-email prefill does NOT route anything to anyone.
- No paid services: no Calendly, no Zoom, no SMS, no Workspace subscription. Google Meet (free) and phone only.
- No dashboard screen for booking rules or days off.
- No dedicated booking URL/page of its own (besides the visitor's reschedule/cancel page).
- No calendar inside an email (email clients strip interactive content) — the email gets a button.

## Anti-goals (would be a failure even if it "works")

- Two visitors booked into the same slot.
- Ryan's personal Gmail calendar involved in any way (Ryan's explicit call: personal plans must not block visitors).
- Contact or Join page loading slower on desktop or phone.
- A silently broken Google connection (calendar quietly shows no times and bookings dry up unnoticed).
- Any lead auto-assigned to an agent.

## Decisions Ryan made (as he made them)

| Topic | Decision |
|---|---|
| Call length | 15 minutes ("doesn't seem too intimidating") |
| Hours | **Every day incl. Sunday**, 8:00 AM – 8:00 PM Pacific (last call 7:45–8:00). Pacific = America/Los_Angeles, follows daylight saving |
| Gap between calls | None — back-to-back 15-min slots ("at the mercy of the lead") |
| Minimum notice | 15 minutes |
| Booking window | 14 days out |
| Daily max | None |
| Busy check | Only the Google calendar of ryanchong@cncrealtygroup.com. Not personal Gmail |
| Days off | Ryan blocks time in Google Calendar: an all-day event set to **"Busy"** closes the day; any normal event blocks its hours. Rarely used but wanted. (Not "Out of office" — see Account type) |
| Meeting type | Visitor chooses "Phone call" or "Google Meet" |
| Booking form | Contact-form fields: First, Last, Email, **Phone (required)**, I am a…, Phone call / Google Meet, **Message (optional)** |
| Layout of the calendar | Desktop: month grid on the left, scrollable column of times on the right (Calendly style). Phone: month grid on top full width, times list below (scrollable) |
| After picking a time | **Option B: pop-up over the calendar** (calendar darkens, form card on top). On phones the pop-up fills the screen with ✕ at top |
| Confirmation | Same pop-up switches to "You're booked!" with Reschedule / Cancel |
| Look | As mocked up: white card on off-white page, open days soft grey circles, selected day solid black, chosen time gold. **No "Times shown in Pacific Time" label** |
| Contact page | Contact form moves LEFT, calendar on the RIGHT; the faded stairs image (`/images/contact-agent.png`) is removed. Contact form itself is unchanged (phone stays optional there, message stays required there) |
| Join page | Calendar section **between "How to Join" (`HowToJoin`) and the closing CTA ("Your Journey Begins Here")** |
| Recruiting email | "Book a call" button opens the **Join page** calendar; the recruited agent's own name + email are pre-filled; lead tagged as from the recruiting email |
| Google connect | One-time "Connect Google Calendar", in a card on Dashboard → Settings to the right of Agent Profile. Card stays after connecting and shows status (Connected / Reconnect) |
| Message button restyle | In the CTA sections of **Buy, Sell, Rent, Join**: "Message" becomes white background, solid black border, black text. **Manage and Home Value keep their gold Message button** |
| Admin sidebar | No new admin tab (no room) |

## Reuse first (audited 2026-11-16 — build on these, don't recreate)

| Need | Reuse | Location |
|---|---|---|
| Option B pop-up shell | `ContactModal`: backdrop, ✕, Escape, `role="dialog"`, phone layout, fields, success screen, posts to `/api/leads`. Extract its shell + fields into shared pieces used by both the Message pop-up and the booking pop-up — do not copy it | `components/ui/ContactModal.tsx` |
| Fields / validation | `RequiredMark`, `FieldError`, `emailError`, `ROLE_OPTIONS` ("I am a" menu, `NAV_PANEL_CLS`/`NAV_ITEM_CLS`) | `components/ui`, `lib/form-validation.ts`, `lib/role-options.ts`, `lib/motion.ts` |
| Consent text | `ContactConsentNotice` | `components/ui` |
| Buttons | `PULSE_ANIMATE` + `PULSE_TRANSITION` + `SPRING_HOVER` on every new button (house rule) | `lib/motion.ts` |
| Phone vs desktop | `max-lg:` CSS for layout; `useIsMobile` only for animation values | `hooks/useIsMobile.ts` |
| Lead creation | `/api/leads` logic: zod schema, `publicFormRateLimit`, `sendLeadNotification`, newsletter consent. Factor the create-lead core into a shared server function the booking route calls, so both paths behave identically | `app/api/leads/route.ts`, `lib/rate-limit.ts`, `lib/email.ts` |
| Lead goes to Ryan | Leads with `agentId: null` appear in Admin → All Leads → Unassigned | `lib/unassigned-leads.ts` |
| Source labels | `applyTag(leadId, name)` | `lib/tags.ts` |
| Booking history on the lead | `Activity` rows on the lead (shows on lead detail for agent + admin, desktop + mobile) | Prisma `Activity` |
| Reschedule/cancel links, email prefill | HMAC signing pattern of unsubscribe tokens (`NEXTAUTH_SECRET`) | `lib/email/unsubscribe.ts` |
| Emails | `emailLayout`, `escapeHtml`, `sendSafely`, Postmark transactional stream from noreply@ | `lib/email.ts`, `lib/email/send-safely.ts` |
| Reminder timer | `isAuthorizedCronRequest`, `vercel.json` crons (Vercel Pro, 15-min crons already run) | `lib/cron-auth.ts` |
| Pacific time math | Native `Intl` with `America/Los_Angeles` (pattern in `lib/auto-status.ts`) — no new date library | |
| Settings card | Existing Settings page card styling | `app/(dashboard)/dashboard/settings/page.tsx` |
| Message button | `PageCTA` default `secondaryClassName` (Buy/Sell/Rent) and `JoinCTAButtons` (Join) — move the style to one shared constant both use | `components/ui/PageCTA.tsx`, `components/join/JoinCTAButtons.tsx` |

Genuinely new: the month + times calendar (`DateField` is a typed date input, not a grid), the Google Calendar
connection (site Google sign-in has no calendar scope), a `Booking` table, the visitor's reschedule/cancel page,
the reminder cron, the Settings card, and the mailer's per-agent link.

## How it works

### Visitor flow
1. Calendar shows the current month; days with at least one open slot (today … +14 days) are clickable.
2. Tap a day → that day's open times appear (desktop: right column; phone: below the grid). Scrollable.
3. Tap a time → Option B pop-up: chosen time at top ("Tue, Nov 17 · 10:15 AM PT"), the form, [Confirm Call].
4. Confirm → server re-checks the slot (see Double-booking), creates the booking, Google event, lead.
5. Pop-up shows "You're booked!" + time + Reschedule / Cancel. ✕ at any earlier point = nothing saved.
6. If the slot was just taken: "That time was just taken, please pick another." and back to the times.

### Open slots
- Pure function (unit-tested, TDD): inputs = now, rules, busy intervals; output = open 15-min slot starts.
- Slots every 15 min from 8:00 to 19:45 Pacific each day, today through today+14, dropping any slot that starts
  less than 15 min from now or overlaps a busy interval.
- Busy intervals = Google free/busy for ryanchong@cncrealtygroup.com primary calendar only (free/busy counts events
  marked "Busy"; all-day events default to "Free" and do not block unless Ryan sets them to Busy — the setup steps
  for Ryan must say this) **plus** this system's own active bookings (covers the gap before Google reflects a
  new event).
- DST-correct: build each slot as Pacific wall-clock time → UTC via Intl.

### Double-booking guard
- At Confirm: re-run free/busy for that slot, then insert the booking inside a transaction protected by a database
  uniqueness rule on the start time of active (non-cancelled) bookings. Second inserter loses and gets "just taken".

### Google connection
- Direct REST calls to Google Calendar API (freeBusy, events insert/patch/delete with `conferenceData` for Meet,
  `sendUpdates=all` so Google emails the invite). No `googleapis` package (too large for the bundle and not needed).
- OAuth: Ryan clicks Connect once; offline access → refresh token stored server-side (encrypted at rest with a new
  env secret) in a single-row store. Scopes limited to calendar free/busy + events.
- **Account type (verified 2026-11-16):** ryanchong@cncrealtygroup.com is a regular (free) Google account using a
  non-Gmail address, NOT paid Workspace — admin.google.com rejected it. Mail stays on Hostinger. Consequences:
  - OAuth app is **External** (Internal needs Workspace). Calendar scopes are "sensitive": publish the app to
    **In production** but leave it unverified — Ryan, the only user, clicks past Google's one-time "unverified app"
    warning when connecting. Do NOT leave it in "Testing" (refresh tokens there expire every 7 days).
  - Create a **new Cloud project owned by ryanchong@cncrealtygroup.com** for this; do not use the existing
    "CnC Realty" project (created from Ryan's personal Gmail; its sign-in client also has an open branding
    re-verification item, see CLAUDE.md deploy checklist).
  - No "Out of office" event type on this account → days off = all-day event set to Busy (above).
  - Google Meet links via `conferenceData` work on regular accounts (one-on-one Meet calls are free).
  - Builder: confirm each of these against Google's current docs during planning; if any differs, stop and report.
- If a Google call fails with an auth error: mark the connection broken, email Ryan once, Settings card shows
  "Reconnect". Calendar on the site shows a friendly fallback ("Booking is unavailable right now — send us a
  message instead") that opens the existing Message pop-up.

### The Google event (what Ryan sees)
Title "Call with {First Last} ({I am a}) – CnC"; description: email, phone, I am a, message, "Booked from:
Contact page / Join page / Recruiting email"; Meet link attached (Meet) or "Phone: …" (phone). Visitor added as
attendee so Google sends the invite.

### CRM
- Each new booking creates a Lead exactly like the contact form does (same fields, `agentId: null` → Unassigned,
  same "new lead" notification email), plus:
  - tag "Booked Call", and "Recruiting Email" when it came from the email button;
  - an Activity on the lead: "Booked a 15-min call for Tue Nov 17, 10:15 AM PT (Google Meet)".
- Reschedule → Activity "Rescheduled to …" (no new lead). Cancel → Activity "Cancelled the call"; lead stays.
- Agent and admin see these on the lead detail (desktop and phone) once the lead is assigned — no new agent UI.

### Emails to the visitor (Postmark, noreply@, `emailLayout`)
- Confirmation (with Reschedule and Cancel links, signed). Google's own invite is separate and automatic.
- Reminders 24 h and 1 h before (same links). Cron every 15 min sends any reminder now due and not yet sent;
  a booking made inside a reminder's window skips that reminder.
- Before sending a reminder, check the Google event still exists; if Ryan deleted it, mark the booking cancelled
  and send nothing.
- Template changes → live test send to ryanchong@cncrealtygroup.com (house rule).

### Reschedule / cancel page
Small public page reached only by signed link: shows the booking, "Pick a new time" (same calendar component, same
pop-up skipped — details already known) or "Cancel call". Updates Booking, Google event, and lead Activity.

### Recruiting email (cnc-outreach-mailer — separate repo, local)
- Ryan adds a "Book a call" button to his Outlook template pointing at a fixed placeholder URL.
- The mailer swaps that URL per agent for a link carrying a signed token of {name, email} (no plain email in the
  URL). The site verifies the token and pre-fills First/Last/Email in the pop-up; source = Recruiting Email.
- The token is signed with its own new secret shared by the site and the mailer (not `NEXTAUTH_SECRET`, which must
  never leave the site). Builder's call, settled here.
- If the token is missing/invalid, the calendar just works with blank fields.
- Mailer change is test-first (vitest suite exists) and followed by one live test send to Ryan.

### Dashboard → Settings (admin only)
- New "Google Calendar" card to the right of Agent Profile: Not connected → [Connect Google Calendar];
  Connected → "✓ Connected as ryanchong@cncrealtygroup.com" + Disconnect; Broken → [Reconnect].
- Visible only to admins (agents' Settings unchanged). On phones it stacks below the other cards.

### Message button restyle
- New shared style: `bg-white border border-[#1B1B1B] text-[#1B1B1B]`, same size/pulse/spring as today.
- Applied as `PageCTA`'s default secondary style (Buy, Sell, Rent) and used by `JoinCTAButtons` (Join).
- Manage (`secondaryClassName` gold override) and Home Value (primary gold) are untouched.

## Speed requirements

- The calendar must not add to the Contact/Join pages' initial load: lazy-load the calendar component, render the
  page shell first, fetch open slots from an API after mount. The slots API caches Google free/busy briefly
  (Upstash Redis, ~60 s) and the cache is cleared on every booking/reschedule/cancel.
- Dashboard: the Settings card reads one row; no new queries on any other dashboard page.
- Verification (targeted, not a site sweep): before/after first-load JS size for `/contact`, `/join`,
  `/dashboard/settings` from `next build` output, plus one timed load of `/contact` and `/join` at desktop and
  phone widths. Report numbers; any regression must be fixed before shipping.

## Agent vs admin, desktop vs phone

| Surface | Agent | Admin (Ryan) |
|---|---|---|
| Public calendar + pop-up | same for everyone, desktop + phone layouts above | same |
| Lead created by booking | sees tags/activity once assigned to them | sees in Unassigned, assigns |
| Settings card | not shown | shown (desktop: right column; phone: stacked) |

## Open calls I made (Ryan please check while reading)

1. Calendar heading (Join section and Contact page): "Chat with Ryan" (Ryan's call 2026-11-16, replaces "Book a Call with Ryan").
2. (Settled by Ryan 2026-11-16: recruiting-email button opens the Join page.)
3. A visitor who books twice with the same email gets a second lead (same as the contact form today).
4. Booking pop-up shows the contact-form consent notice and enrolls in the newsletter like the contact form does.
5. Settings card shown in a third column only on wide screens; narrower desktop and phones stack it.
6. Confirmation and pop-up times show "PT" after the time.

## Left to the builder

Booking table shape; token/refresh-token encryption details; slots API shape; component split of the calendar;
cron cadence details within "every 15 min"; Internal OAuth project setup steps (write them for Ryan).
