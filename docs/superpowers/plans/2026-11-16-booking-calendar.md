# Booking Calendar ("Chat with Ryan") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A self-built 15-minute booking calendar (Contact page, Join page, recruiting-email link) that checks Ryan's Google calendar, creates the Google event with an invite, and drops every booking into the CRM as an unassigned lead.

**Architecture:** A pure slot generator (Pacific time, Intl) fed by Google free/busy (direct REST, refresh token encrypted in `SiteSettings`) plus our own `Booking` rows; a partial unique index on active start times prevents double-booking. Public pages lazy-load one shared `BookingCalendar` client component that fetches slots after mount; a pop-up (shared shell extracted from `ContactModal`) collects details. Reminders run from a 15-minute Vercel cron; reschedule/cancel uses a signed link.

**Tech Stack:** Next.js 14 App Router, Prisma/Neon Postgres, Upstash Redis, Postmark (`sendEmail`), motion/react, vitest (node env). No new npm packages.

**Spec:** `docs/superpowers/specs/2026-11-16-booking-calendar-design.md` (approved by Ryan 2026-11-16). Executors read both.

All app paths below are relative to `apps/web/` unless they start with `packages/`, `docs/` or `C:\`.

## Global Constraints

- Hours: every day incl. Sunday, 8:00 AM – 8:00 PM `America/Los_Angeles`; slots start 8:00 … 19:45; 15-min calls, no gap, 15-min minimum notice, booking window today … today+14 (Pacific dates, inclusive), no daily max.
- Busy source: ONLY the Google primary calendar of `ryanchong@cncrealtygroup.com`. The OAuth callback must refuse any other Google account.
- Every lead from a booking: `agentId: null` (Unassigned), `source: "WEBSITE"`, same notification + newsletter behavior as `/api/leads`. Never auto-assign.
- Booking form fields: First*, Last*, Email*, Phone* (required), I am a* (`ROLE_OPTIONS`), Phone call / Google Meet*, Message (optional). Consent notice shown (`ContactConsentNotice`), `newsletterConsent: true`.
- Calendar heading copy: "Chat with Ryan" ("Ryan" in gold `#9E8C61`) on both the Join section and the Contact page.
- Time display: "Tue, Nov 17 · 10:15 AM PT" style, always Pacific regardless of the visitor's device timezone. NO "Times shown in Pacific Time" label anywhere.
- Every new button: `animate={PULSE_ANIMATE}`, `transition={PULSE_TRANSITION}`, `whileHover={{ scale: 1.05, transition: SPRING_HOVER }}` from `@/lib/motion`.
- Layout split by `max-lg:` CSS; `useIsMobile` only for animation values.
- Google: direct `fetch` to Google REST; no `googleapis` package. Scopes exactly `openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy`.
- New env vars (add to `.env.local` and Vercel, never commit values): `GOOGLE_CAL_CLIENT_ID`, `GOOGLE_CAL_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY` (32 random bytes, base64), `BOOKING_LINK_SECRET` (shared with the mailer). `NEXTAUTH_SECRET` must never leave the site.
- Speed: Contact/Join first-load JS must not grow (calendar is `next/dynamic` with `ssr: false`); dashboard pages other than Settings get zero new queries.
- Email-template change ⇒ one live test send to `ryanchong@cncrealtygroup.com`.
- Mailer: never read or print `C:\Users\hey_r\cnc-outreach-mailer\settings.env`; append/change single lines only (`echo ... >>` or `sed`). Excel closed when the mailer runs.
- Commits: commit per task on a feature branch. Never `git push` without asking Ryan (push to main = live deploy).
- DB work needs Ryan's home network (office blocks Neon port 5432). Run `prisma generate` from PowerShell.

## Review Focus

1. **Visitor on a non-Pacific device (e.g. New York).** Expect every time shown in the calendar, pop-up and emails in Pacific with "PT", and the booked instant correct. Pinned in Task 2 (`format` test with `TZ=America/New_York`) and Task 12 (times rendered from ISO via the PT formatter, never `toLocaleTimeString()` without `timeZone`).
2. **Two visitors confirming the same slot at the same moment.** Expect exactly one booking; the other sees "That time was just taken, please pick another." Pinned in Task 8 (P2002 → 409 `taken`, lead rolled back).
3. **Stale tab.** Calendar left open; the slot drops inside the 15-min notice (or Ryan adds an event) before Confirm. Expect the same "just taken" response, nothing saved. Pinned in Task 8 (`invalid_slot` → 409 `taken`).
4. **Google never connected, revoked, or broken.** Expect the calendar to show "Booking is unavailable right now — send us a message instead" with a button opening the existing Message pop-up, Ryan emailed once, and the Settings card showing Reconnect. Pinned in Tasks 5, 6 and 12.
5. **Bad manage link.** A tampered token, an already-cancelled booking, or a reschedule to a taken or past time. Expect a friendly message, no change to the booking or Google. Pinned in Task 10.

---

### Task 0: Branch and speed baseline

**Files:** none changed. Writes `docs/superpowers/plans/2026-11-16-booking-calendar-baseline.txt`.

- [ ] **Step 1:** `git checkout -b feature/booking-calendar` from `main` in `C:\Users\hey_r\Desktop\CnC-Realty`.
- [ ] **Step 2:** Run `pnpm --filter web build`. From the route table, copy the `First Load JS` lines for `/contact`, `/join` and `/dashboard/settings` into the baseline file. Expected: build exits 0.
- [ ] **Step 3:** Commit the baseline file: `git commit -m "chore: booking calendar speed baseline"`.

---

### Task 1: Booking table

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (new enums + model, `bookings Booking[]` on `Lead`)
- Create: `packages/database/prisma/migrations/<timestamp>_booking/migration.sql` (generated, then edited)

**Interfaces:**
- Produces:
  - Enums: `BookingStatus { ACTIVE CANCELLED }`, `MeetingType { PHONE MEET }`, `BookingSource { CONTACT JOIN RECRUITING_EMAIL }`.
  - Model `Booking`: `id String @id @default(cuid())`, `leadId String`, `startsAt DateTime`, `endsAt DateTime`, `status BookingStatus @default(ACTIVE)`, `meetingType MeetingType`, `source BookingSource`, `googleEventId String?`, `meetLink String?`, `scheduledAt DateTime @default(now())` (reset on reschedule; used by the reminder rule), `reminder24SentAt DateTime?`, `reminder1SentAt DateTime?`, `cancelledAt DateTime?`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, relation `lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)`, `@@index([startsAt])`, `@@index([leadId])`.

- [ ] **Step 1:** Add the enums and model to `schema.prisma`.
- [ ] **Step 2:** Run `pnpm --filter @cnc/database exec prisma migrate dev --name booking --create-only`.
- [ ] **Step 3:** Append to the generated `migration.sql` (Prisma can't express a partial unique index):

```sql
CREATE UNIQUE INDEX "Booking_active_startsAt_key" ON "Booking"("startsAt") WHERE "status" = 'ACTIVE';
```

- [ ] **Step 4:** Run `pnpm --filter @cnc/database exec prisma migrate dev` and then `prisma generate` (PowerShell). Expected: migration applied, client generated.
- [ ] **Step 5:** Verify the index: `pnpm --filter @cnc/database exec prisma db execute --stdin` with `SELECT indexdef FROM pg_indexes WHERE indexname='Booking_active_startsAt_key';`. Expected: one row containing `WHERE (status = 'ACTIVE'`.
- [ ] **Step 6:** Commit `feat(booking): Booking table with one active booking per start time`.

---

### Task 2: Slot generator and Pacific formatting (pure, TDD)

**Files:**
- Create: `src/lib/booking/rules.ts`, `src/lib/booking/slots.ts`, `src/lib/booking/format.ts`
- Test: `src/__tests__/lib/booking-slots.test.ts`, `src/__tests__/lib/booking-format.test.ts`

**Interfaces:**
- Produces:
  - `BOOKING_RULES = { timeZone: "America/Los_Angeles", firstSlot: { h: 8, m: 0 }, lastSlot: { h: 19, m: 45 }, slotMinutes: 15, minNoticeMinutes: 15, windowDays: 14 } as const` (`rules.ts`), plus `BOOKING_CALENDAR_EMAIL = "ryanchong@cncrealtygroup.com"`.
  - `type Interval = { start: Date; end: Date }`
  - `pacificDate(d: Date): string` → `"YYYY-MM-DD"` in Pacific.
  - `pacificWallTimeToUtc(ymd: string, h: number, m: number): Date` (DST-correct via Intl offset lookup, no date library).
  - `openSlots(now: Date, busy: Interval[], rules = BOOKING_RULES): Date[]` (ascending).
  - `isOpenSlot(start: Date, now: Date, busy: Interval[]): boolean` (same rules, one slot).
  - `groupByPacificDate(slots: Date[]): Record<string, string[]>` (ISO strings).
  - `formatSlotPT(d: Date): string` → `"Tue, Nov 17 · 10:15 AM PT"`; `formatTimePT(d: Date): string` → `"10:15 AM"`.

- [ ] **Step 1: Write failing tests** in `booking-slots.test.ts`:

```ts
const at = (iso: string) => new Date(iso);
it("first slot of a November day is 8:00 PST = 16:00Z", () => {
  const s = openSlots(at("2026-11-16T15:00:00Z"), []);
  expect(s[0].toISOString()).toBe("2026-11-16T16:00:00.000Z");
});
it("48 slots per full day, last one 19:45 PT", () => {
  const day = groupByPacificDate(openSlots(at("2026-11-16T15:00:00Z"), []))["2026-11-17"];
  expect(day).toHaveLength(48);
  expect(day[47]).toBe("2026-11-18T03:45:00.000Z");
});
it("Sunday is open", () => {
  expect(groupByPacificDate(openSlots(at("2026-11-16T15:00:00Z"), []))["2026-11-22"]).toHaveLength(48);
});
it("window is today through today+14, inclusive", () => {
  const days = Object.keys(groupByPacificDate(openSlots(at("2026-11-16T15:00:00Z"), [])));
  expect(days[0]).toBe("2026-11-16");
  expect(days.at(-1)).toBe("2026-11-30");
  expect(days).toHaveLength(15);
});
it("15-minute notice: at 8:05 PT the first slot is 8:30", () => {
  expect(openSlots(at("2026-11-16T16:05:00Z"), [])[0].toISOString()).toBe("2026-11-16T16:30:00.000Z");
});
it("a slot exactly 15 minutes away is allowed", () => {
  expect(openSlots(at("2026-11-16T16:00:00Z"), [])[0].toISOString()).toBe("2026-11-16T16:15:00.000Z");
});
it("busy 10:05–10:20 PT removes 10:00 and 10:15 only", () => {
  const busy = [{ start: at("2026-11-17T18:05:00Z"), end: at("2026-11-17T18:20:00Z") }];
  const day = groupByPacificDate(openSlots(at("2026-11-16T15:00:00Z"), busy))["2026-11-17"];
  expect(day).not.toContain("2026-11-17T18:00:00.000Z");
  expect(day).not.toContain("2026-11-17T18:15:00.000Z");
  expect(day).toContain("2026-11-17T18:30:00.000Z");
});
it("busy ending exactly at a slot start does not block it", () => {
  const busy = [{ start: at("2026-11-17T17:00:00Z"), end: at("2026-11-17T18:00:00Z") }];
  expect(groupByPacificDate(openSlots(at("2026-11-16T15:00:00Z"), busy))["2026-11-17"]).toContain("2026-11-17T18:00:00.000Z");
});
it("an all-day busy block closes the day", () => {
  const busy = [{ start: at("2026-11-20T08:00:00Z"), end: at("2026-11-21T08:00:00Z") }];
  expect(groupByPacificDate(openSlots(at("2026-11-16T15:00:00Z"), busy))["2026-11-20"]).toBeUndefined();
});
it("after 7:30 PT today has no slots", () => {
  expect(groupByPacificDate(openSlots(at("2026-11-17T03:31:00Z"), []))["2026-11-16"]).toBeUndefined();
});
it("DST spring-forward day: 8:00 PDT = 15:00Z", () => {
  expect(pacificWallTimeToUtc("2027-03-14", 8, 0).toISOString()).toBe("2027-03-14T15:00:00.000Z");
});
it("DST fall-back day: 8:00 PST = 16:00Z", () => {
  expect(pacificWallTimeToUtc("2026-11-01", 8, 0).toISOString()).toBe("2026-11-01T16:00:00.000Z");
});
it("isOpenSlot rejects a time off the 15-minute grid", () => {
  expect(isOpenSlot(at("2026-11-17T18:05:00Z"), at("2026-11-16T15:00:00Z"), [])).toBe(false);
});
```

And `booking-format.test.ts` (Review Focus 1):

```ts
it("formats in Pacific even on a New York machine", () => {
  vi.stubEnv("TZ", "America/New_York");
  expect(formatSlotPT(new Date("2026-11-17T18:15:00Z"))).toBe("Tue, Nov 17 · 10:15 AM PT");
  expect(formatTimePT(new Date("2026-11-17T18:15:00Z"))).toBe("10:15 AM");
});
```

- [ ] **Step 2:** Run `pnpm --filter web exec vitest run src/__tests__/lib/booking-slots.test.ts src/__tests__/lib/booking-format.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement the three files. Offset lookup: format a candidate UTC instant with `Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year, month, day, hour, minute })`, compute the difference from the wanted wall time, adjust once and re-check (the pattern in `src/lib/auto-status.ts` uses the same Intl approach). Overlap rule: slot `[s, s+15)` overlaps busy `[b.start, b.end)` iff `s < b.end && s+15 > b.start`.
- [ ] **Step 4:** Re-run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(booking): Pacific-time slot generator`.

---

### Task 3: Signed tokens (manage link + recruiting link)

**Files:**
- Create: `src/lib/signed-token.ts`, `src/lib/booking/tokens.ts`
- Test: `src/__tests__/lib/booking-tokens.test.ts`

**Interfaces:**
- Produces:
  - `signPayload(data: string, secret: string): string` → `${base64url(data)}.${base64url(hmacSha256)}`; `verifySignedPayload(token: string, secret: string): string | null` (length check before `timingSafeEqual`, like `lib/email/unsubscribe.ts`). Leave `unsubscribe.ts` untouched.
  - `makeManageToken(bookingId: string): string` / `verifyManageToken(t: string): string | null` (payload `booking:<id>`, secret `NEXTAUTH_SECRET`).
  - `manageUrl(bookingId: string): string` → `${NEXTAUTH_URL}/booking/manage?t=…`.
  - `verifyRecruitToken(t: string): { firstName: string; lastName: string; email: string } | null` (payload `JSON.stringify({ n, e })`, secret `BOOKING_LINK_SECRET`; first word = first name, rest = last name; returns null if the secret is unset).

- [ ] **Step 1: Write failing tests:**

```ts
// Fixed vector shared with the mailer's test (Task 16) — both sides must produce/accept this exact string.
const VECTOR = "eyJuIjoiSm9zw6kgTydOZWlsIiwiZSI6Impvc2VAZXhhbXBsZS5jb20ifQ.EHlY9TBG-FymaxTkIpkf-b4atGYN-3XM16B7Tc5QOO0";
beforeEach(() => { vi.stubEnv("BOOKING_LINK_SECRET", "test-recruit-secret"); vi.stubEnv("NEXTAUTH_SECRET", "s"); });
it("reads the mailer's token", () => {
  expect(verifyRecruitToken(VECTOR)).toEqual({ firstName: "José", lastName: "O'Neil", email: "jose@example.com" });
});
it("rejects a tampered recruit token", () => {
  expect(verifyRecruitToken(VECTOR.replace("eyJu", "eyJv"))).toBeNull();
});
it("rejects when the recruit secret is not set", () => {
  vi.stubEnv("BOOKING_LINK_SECRET", "");
  expect(verifyRecruitToken(VECTOR)).toBeNull();
});
it("manage token round-trips and is not a recruit token", () => {
  const t = makeManageToken("bk_1");
  expect(verifyManageToken(t)).toBe("bk_1");
  expect(verifyRecruitToken(t)).toBeNull();
});
it("rejects garbage", () => { expect(verifyManageToken("abc")).toBeNull(); });
```

- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat(booking): signed manage and recruiting tokens`.

---

### Task 4: Encrypted Google connection store

**Files:**
- Create: `src/lib/secret-box.ts`, `src/lib/google-calendar/connection.ts`
- Test: `src/__tests__/lib/secret-box.test.ts`, `src/__tests__/lib/google-calendar-connection.test.ts`

**Interfaces:**
- Produces:
  - `sealSecret(plain: string): string` / `openSecret(sealed: string): string` (AES-256-GCM, key from `GOOGLE_TOKEN_KEY` base64; format `iv.tag.ciphertext` base64url; throws if key unset or wrong length).
  - `type CalendarConnection = { status: "connected" | "broken"; email: string; refreshToken: string; connectedAt: string; alertSentAt: string | null }`
  - `getConnection(): Promise<CalendarConnection | null>`; `saveConnection(email: string, refreshToken: string): Promise<void>`; `markBroken(): Promise<{ firstTime: boolean }>` (sets status + `alertSentAt` once); `deleteConnection(): Promise<void>`. Stored as ONE `SiteSettings` row, key `google_calendar`, value = `sealSecret(JSON.stringify(rest))`.

- [ ] **Step 1: Write failing tests:** round-trip; tampered ciphertext throws; two seals of the same text differ (random IV); `markBroken` returns `firstTime: true` once then `false` (mock `prisma.siteSettings.findUnique/upsert/deleteMany`).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement with `node:crypto` `createCipheriv("aes-256-gcm", key, iv)`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(booking): encrypted Google connection store`.

---

### Task 5: Google OAuth + Calendar REST client + Settings API

**Files:**
- Create: `src/lib/google-calendar/oauth.ts`, `src/lib/google-calendar/api.ts`, `src/lib/google-calendar/errors.ts`
- Create: `src/app/api/google-calendar/connect/route.ts` (GET), `src/app/api/google-calendar/callback/route.ts` (GET), `src/app/api/google-calendar/status/route.ts` (GET, DELETE)
- Test: `src/__tests__/lib/google-calendar-api.test.ts`, `src/__tests__/api/google-calendar-callback.test.ts`

**Interfaces:**
- Consumes: Task 4 store, `BOOKING_CALENDAR_EMAIL`, `redis`, `requireAuth("ADMIN")`.
- Produces:
  - `class GoogleAuthError extends Error` (thrown on HTTP 401 or `invalid_grant`).
  - `authUrl(state: string): string`. Params: `client_id`, `redirect_uri=${NEXTAUTH_URL}/api/google-calendar/callback`, `response_type=code`, the four scopes, `access_type=offline`, `prompt=consent`, `login_hint=ryanchong@cncrealtygroup.com`, `state`.
  - `exchangeCode(code: string): Promise<{ refreshToken: string; email: string }>`: POST `https://oauth2.googleapis.com/token`, then GET `https://openidconnect.googleapis.com/v1/userinfo`.
  - `getAccessToken(): Promise<string>`: refresh grant, cached in Redis key `gcal:access-token`, TTL `expires_in - 60`.
  - `freeBusy(from: Date, to: Date): Promise<Interval[]>`: POST `https://www.googleapis.com/calendar/v3/freeBusy`, `items: [{ id: "primary" }]`.
  - `createEvent(e: { bookingId: string; start: Date; end: Date; summary: string; description: string; attendeeEmail: string; meet: boolean; location?: string }): Promise<{ id: string; meetLink: string | null }>`: POST `…/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`. When `meet`: `conferenceData.createRequest = { requestId: bookingId, conferenceSolutionKey: { type: "hangoutsMeet" } }`. Meet link = `hangoutLink` ?? the video `entryPoints[].uri` ?? null.
  - `moveEvent(id: string, start: Date, end: Date): Promise<void>` (PATCH, `sendUpdates=all`); `deleteEvent(id: string): Promise<void>` (DELETE, `sendUpdates=all`, 404/410 treated as done); `eventExists(id: string): Promise<boolean>` (GET; false on 404/410 or `status === "cancelled"`).
  - `withGoogle<T>(fn: () => Promise<T>): Promise<T>`: on `GoogleAuthError`, calls `markBroken()`. The first time, it emails `NOTIFY` via `sendSafely` (subject "Booking calendar disconnected — reconnect in Settings"). Then it rethrows.
  - Routes:
    - `connect`: admin only; sets an httpOnly `gcal_state` cookie (random 32 bytes) and redirects to `authUrl(state)`.
    - `callback`: checks the state cookie. If the email is not `BOOKING_CALENDAR_EMAIL` (case-insensitive), it redirects to `/dashboard/settings?gcal=wrong-account` and saves nothing. Otherwise it saves the connection, clears the busy cache, and redirects `?gcal=connected`.
    - `status` GET: `{ status: "disconnected" | "connected" | "broken", email?: string }`.
    - `status` DELETE: revokes the token at `https://oauth2.googleapis.com/revoke` (best effort) and deletes the row.

- [ ] **Step 1: Write failing tests** (mock `fetch` with `vi.stubGlobal`):
  - `freeBusy` maps `calendars.primary.busy[]` to `Interval[]`.
  - `createEvent` with `meet: true` sends `conferenceDataVersion=1` and `sendUpdates=all`, and returns `hangoutLink`.
  - `createEvent` with `meet: false` sends no `conferenceData`.
  - A 401 response throws `GoogleAuthError`.
  - `withGoogle` emails once across two auth failures.
  - `eventExists` returns false for 404 and for `status: "cancelled"`.
  - Callback with a personal Gmail (`someone@gmail.com`) redirects to `gcal=wrong-account` and calls no `saveConnection`.
  - Callback with a bad state returns 400.
  - `connect` returns 403 for an AGENT.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(booking): Google Calendar connection (OAuth + REST)`.

---

### Task 6: Busy intervals + slots API

**Files:**
- Create: `src/lib/booking/busy.ts`, `src/app/api/booking/slots/route.ts`
- Test: `src/__tests__/api/booking-slots.test.ts`

**Interfaces:**
- Consumes: `freeBusy`, `withGoogle`, `getConnection`, `openSlots`, `groupByPacificDate`, `redis`.
- Produces:
  - `getBusy(from: Date, to: Date, opts?: { fresh?: boolean }): Promise<Interval[]>`: Google busy (Redis key `booking:busy:v1`, 60 s TTL; skipped when `fresh`) + active `Booking` rows overlapping the range (always from DB).
  - `clearBusyCache(): Promise<void>`.
  - `class BookingUnavailableError extends Error`: thrown when there is no connection, it is `broken`, or Google errors.
  - `GET /api/booking/slots` → `200 { status: "ok", days: Record<"YYYY-MM-DD", string[]> }` or `200 { status: "unavailable" }`, with `Cache-Control: no-store`. Range is now … now + 15 days.

- [ ] **Step 1: Write failing tests:**
  - With a connected store and mocked busy, `days["2026-11-17"]` excludes the busy slot.
  - A DB `ACTIVE` booking's slot is excluded.
  - No connection → `{ status: "unavailable" }` (Review Focus 4).
  - Broken connection → `unavailable`.
  - A second call within 60 s does not call `freeBusy` again (Redis mocked as an in-memory map).
  - `fresh: true` bypasses the cache.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(booking): open-slots API with 60s busy cache`.

---

### Task 7: Shared lead-creation core (no behavior change)

**Files:**
- Create: `src/lib/leads/create-lead.ts`
- Modify: `src/app/api/leads/route.ts:43-58` (POST uses the core)
- Test: `src/__tests__/lib/create-lead.test.ts`; existing `/api/leads` tests must stay green

**Interfaces:**
- Produces:
  - `type WebsiteLeadInput = { firstName: string; lastName: string; email: string; phone?: string; notes?: string; source: LeadSource; utmSource?: string; role?: string }`
  - `leadCreateData(input: WebsiteLeadInput): Prisma.LeadCreateInput`: maps `role` to `visitorRole`, nothing else.
  - `afterLeadCreated(lead: Lead, opts: { newsletterConsent?: boolean }): Promise<void>`: fires `sendLeadNotification` (not awaited, `.catch(console.error)`), awaits `subscribeToNewsletter({ email, leadId, source: "contact-form" })`, and reports errors to Sentry.

- [ ] **Step 1: Write failing tests:**
  - `leadCreateData` maps `role` → `visitorRole` and never sets `agentId`.
  - `afterLeadCreated` with consent calls `subscribeToNewsletter` once.
  - `afterLeadCreated` without consent calls it zero times.
  - A newsletter failure does not throw.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement and switch `/api/leads` POST to `prisma.lead.create({ data: leadCreateData(...) })` + `afterLeadCreated`. Keep the OPEN_HOUSE tag line in the route.
- [ ] **Step 4:** Run `pnpm --filter web exec vitest run src/__tests__/lib/create-lead.test.ts src/__tests__/api`. Expected: all PASS.
- [ ] **Step 5:** Commit `refactor(leads): share lead-creation core`.

---

### Task 8: Create booking + POST /api/booking + prefill

**Files:**
- Create: `src/lib/booking/create-booking.ts`, `src/lib/booking/event-text.ts`, `src/app/api/booking/route.ts` (POST), `src/app/api/booking/prefill/route.ts` (GET)
- Test: `src/__tests__/api/booking-create.test.ts`, `src/__tests__/lib/booking-event-text.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 3, 5, 6, 7; `applyTag`; `publicFormRateLimit`.
- Produces:
  - `type BookingInput = WebsiteLeadInput & { startsAt: Date; meetingType: "PHONE" | "MEET"; bookingSource: BookingSource; newsletterConsent: boolean }`
  - `createBooking(input: BookingInput, now?: Date): Promise<{ ok: true; booking: Booking; manageUrl: string } | { ok: false; reason: "taken" | "unavailable" }>`. Order:
    1. `isOpenSlot` against `getBusy(start, end, { fresh: true })`; false → `taken`.
    2. `prisma.$transaction`: `lead.create(leadCreateData)` + `booking.create`; Prisma `P2002` → `taken` (lead rolled back).
    3. `withGoogle(createEvent)` and store `googleEventId`/`meetLink`. A Google failure keeps the booking (Sentry); the CRM lead still exists.
    4. `applyTag(lead.id, "Booked Call")`, plus `"Recruiting Email"` when the source is `RECRUITING_EMAIL`.
    5. `prisma.activity.create({ type: "NOTE", content: "Booked a 15-min call for Tue, Nov 17 · 10:15 AM PT (Google Meet)" })`.
    6. `afterLeadCreated(lead, { newsletterConsent })`.
    7. `clearBusyCache()`.
    (Task 9 adds the confirmation email after step 6.)
  - `eventSummary(i)` → `"Call with Jordan Lee (Home Buyer) – CnC"`. `eventDescription(i)`: email, phone, I am a, message, `"Booked from: Contact page" | "Join page" | "Recruiting email"`, and `"Phone: <number>"` for phone calls. The phone number also goes in `location` for phone calls.
  - POST body (zod):
    - `startsAt` ISO, `firstName`, `lastName`, `email`
    - `phone` (min 7 digits), `role` (one of `ROLE_OPTIONS`), `notes?`
    - `meetingType`, `page: "CONTACT" | "JOIN"`, `recruitToken?`
  - The source is `RECRUITING_EMAIL` only when `recruitToken` verifies; otherwise it comes from `page`. `utmSource` = `BOOKING_CONTACT` | `BOOKING_JOIN` | `BOOKING_RECRUITING_EMAIL`.
  - Responses:
    - `201 { startsAt, meetingType, meetLink, manageUrl }`
    - `409 { error: "taken" }`
    - `503 { error: "unavailable" }`
    - `400 { error }`
    - `429` (rate limit, same handling as `/api/leads`)
  - `GET /api/booking/prefill?t=` → `200 { firstName, lastName, email }` or `404`.

- [ ] **Step 1: Write failing tests:**
  - Happy path → 201. The lead is created with `agentId` undefined and `source: "WEBSITE"`, the tag "Booked Call" is applied, the Activity text matches exactly, and `createEvent` is called with `meet: true`.
  - **Review Focus 2:** `booking.create` rejects with `{ code: "P2002" }` → 409 `taken`, and `createEvent` is not called.
  - **Review Focus 3:** `startsAt` 10 minutes from now → 409 `taken`, nothing created.
  - Missing phone → 400.
  - A valid recruit token → tags include "Recruiting Email"; a forged token → only "Booked Call", source JOIN.
  - Google throws `GoogleAuthError` after the insert → still 201, `googleEventId` null.
  - `eventSummary` matches the exact string above.
  - Prefill with `VECTOR` → José / O'Neil / jose@example.com.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(booking): create booking, Google event and CRM lead`.

---

### Task 9: Booking emails + reminder cron

**Files:**
- Create: `src/lib/email/booking-emails.ts`, `src/lib/booking/reminders.ts`, `src/app/api/cron/booking-reminders/route.ts` (GET + POST)
- Modify: `vercel.json` (add `{ "path": "/api/cron/booking-reminders", "schedule": "*/15 * * * *" }`), `src/lib/booking/create-booking.ts` (wire confirmation)
- Test: `src/__tests__/lib/booking-reminders.test.ts`, `src/__tests__/lib/booking-emails.test.ts`, `src/__tests__/api/cron-booking-reminders.test.ts`

**Interfaces:**
- Produces:
  - `sendBookingConfirmation(b: { email: string; firstName: string; startsAt: Date; meetingType: MeetingType; meetLink: string | null; manageUrl: string }): Promise<void>` and `sendBookingReminder(b: same, which: "24h" | "1h")`. Both use `emailLayout` + `buildHeadingBodyHtml` + `escapeHtml`, `sendEmail({ stream: "transactional" })`, and show the Reschedule and Cancel links.
    - Confirmation heading: "You're booked!"; body line: `formatSlotPT(startsAt)` + "Google Meet" or "Phone call — Ryan will call you at <phone>".
    - When `meet` and `meetLink` is null: "Your Google Meet link is in the calendar invite."
    - Reminder subjects: "Reminder: your call with Ryan is tomorrow" / "Reminder: your call with Ryan starts in 1 hour".
  - `reminderDue(b: { startsAt: Date; scheduledAt: Date; reminder24SentAt: Date | null; reminder1SentAt: Date | null }, now: Date): "24h" | "1h" | null`:
    - `"1h"` when `0 < startsAt−now ≤ 60 min`, the 1h reminder is unsent, and `scheduledAt ≤ startsAt−60min`.
    - Otherwise `"24h"` when `60 min < startsAt−now ≤ 24 h`, the 24h reminder is unsent, and `scheduledAt ≤ startsAt−24h`.
    - Otherwise `null`.
  - Cron: `isAuthorizedCronRequest`. It finds `ACTIVE` bookings starting in the next 24h 15m. For each due one with a `googleEventId`: `eventExists` false → set `CANCELLED` + `cancelledAt` + Activity "Cancelled the call (removed from Google Calendar)", no email. Otherwise send the reminder and stamp `reminder24SentAt`/`reminder1SentAt`. Returns `{ sent, cancelled }`.

- [ ] **Step 1: Write failing tests:**
  - `reminderDue`: booked 3 days ahead at 23h out → `"24h"`; booked 2h before the call at 23h out → `null`; at 50 min → `"1h"`; with 1h already sent → `null`; at 20h with 24h already sent → `null`.
  - Cron: 401 with a bad secret; a deleted Google event → booking cancelled and `sendEmail` not called; a due booking → one email and stamp set.
  - Emails: the confirmation html contains "Tue, Nov 17 · 10:15 AM PT", the manage URL and "Cancel"; a name with `<script>` is escaped.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement and wire confirmation into `createBooking`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Live test sends (house rule): with dev server env, a one-off `pnpm --filter web exec tsx` script in the scratchpad (not committed) calls `sendBookingConfirmation` and `sendBookingReminder(…, "1h")` to `ryanchong@cncrealtygroup.com`. Expected: both arrive; tell Ryan to check them.
- [ ] **Step 6:** Commit `feat(booking): confirmation and reminder emails`.

---

### Task 10: Reschedule / cancel API

**Files:**
- Create: `src/lib/booking/manage-booking.ts`, `src/app/api/booking/manage/route.ts` (GET, POST)
- Test: `src/__tests__/api/booking-manage.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/booking/manage?t=` → `200 { status, startsAt, meetingType, firstName }` or `404`.
  - `POST { t, action: "cancel" }`:
    - Active booking: set `CANCELLED` + `cancelledAt`, `deleteEvent`, Activity "Cancelled the call", `clearBusyCache` → `200 { status: "CANCELLED" }`.
    - Already cancelled: `200`, unchanged, no Google call.
  - `POST { t, action: "reschedule", startsAt }`:
    - `isOpenSlot` (fresh busy, ignoring this booking's own interval) fails → `409 taken`.
    - Otherwise update `startsAt`/`endsAt`, `scheduledAt = now`, clear both reminder stamps, `moveEvent`, Activity "Rescheduled to <formatSlotPT>", `clearBusyCache` → `200 { startsAt }`. Unique-index `P2002` → `409 taken`.
    - Cancelled booking → `409 { error: "cancelled" }`.
  - Bad token → `404`. Rate-limited like `/api/leads`.

- [ ] **Step 1: Write failing tests** (Review Focus 5):
  - A tampered token → 404, no DB write.
  - Cancel twice → second call makes no `deleteEvent` call.
  - Reschedule a cancelled booking → 409 `cancelled`.
  - Reschedule to a taken slot → 409 `taken`, booking unchanged.
  - Reschedule to a past time → 409 `taken`.
  - Successful reschedule → reminders cleared, `moveEvent` called, Activity text exact.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(booking): reschedule and cancel via signed link`.

---

### Task 11: Extract shared pop-up pieces from ContactModal (no visual change)

**Files:**
- Create: `src/components/ui/ModalShell.tsx`, `src/components/ui/UnderlineField.tsx`, `src/components/ui/RoleSelect.tsx`
- Modify: `src/components/ui/ContactModal.tsx` (uses the three; same markup/classes)
- Test: `src/__tests__/components/ModalShell.test.ts`

**Interfaces:**
- Produces:
  - `ModalShell({ open, onClose, label, fullScreenOnMobile = false, children })`: AnimatePresence backdrop (`bg-black/60`), Escape closes, ✕ button, `role="dialog" aria-modal="true" aria-label={label}`, card `max-w-lg rounded-2xl bg-white p-10`. With `fullScreenOnMobile`, the card under `max-lg:` becomes `max-lg:fixed max-lg:inset-0 max-lg:max-w-none max-lg:rounded-none max-lg:overflow-y-auto`.
  - `UnderlineField({ label, required?, type?, value, onChange, autoFocus?, multiline?, rows?, placeholder?, error? })`: the existing underline input/textarea classes.
  - `RoleSelect({ value, onChange, error, onOpen })`: the existing "I am a" dropdown using `NAV_PANEL_CLS`/`NAV_ITEM_CLS` + `useClickOutside`.

- [ ] **Step 1: Write failing test** using `renderToStaticMarkup` from `react-dom/server`:
  - `ModalShell` open renders `role="dialog"` and the label.
  - With `fullScreenOnMobile` the markup contains `max-lg:inset-0`; without it, the markup does not.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Extract and switch `ContactModal` to them. Its rendered classes must be identical.
- [ ] **Step 4:** Run the test plus the full suite `pnpm --filter web test`. Expected: PASS. Then start the dev server and open the Buy page's Message pop-up at desktop and 390px widths. Expected: looks exactly as before. Use Ryan's eyes or one screenshot each, nothing more.
- [ ] **Step 5:** Commit `refactor(ui): shared modal shell and form fields`.

---

### Task 12: BookingCalendar component

**Files:**
- Create: `src/lib/booking/month-grid.ts`, `src/components/booking/BookingCalendar.tsx`, `src/components/booking/MonthGrid.tsx`, `src/components/booking/TimeList.tsx`, `src/components/booking/BookingModal.tsx`, `src/components/booking/BookingCalendarLazy.tsx`
- Test: `src/__tests__/lib/booking-month-grid.test.ts`, `src/__tests__/components/BookingCalendar.test.ts`

**Interfaces:**
- Consumes: `GET /api/booking/slots`, `POST /api/booking`, `GET /api/booking/prefill`, `POST /api/booking/manage`, `formatSlotPT`, `formatTimePT`, `ModalShell`, `UnderlineField`, `RoleSelect`, `ContactConsentNotice`, `ContactModal`.
- Produces:
  - `buildMonthGrid(year: number, month0: number): (string | null)[]`: Sunday-first cells, `"YYYY-MM-DD"` or null padding, length a multiple of 7.
  - `type CalendarMode = { kind: "book"; page: "CONTACT" | "JOIN" } | { kind: "reschedule"; token: string; onDone: (startsAt: string) => void }`
  - `BookingCalendar({ mode, heading?: string })`, client component, with this behavior:
    - **Load:** fetches slots in `useEffect` after mount.
    - **Days:** a day with ≥1 slot is a clickable soft-grey circle (`bg-[#F2F0EF]`); the selected day is solid black. Month arrows are limited to months inside the window. Defaults to the first open day.
    - **Layout:** desktop `lg:grid-cols-[1fr_220px]` with the month grid left and a scrollable times column right (`max-h-[360px] overflow-y-auto`); phone stacks the grid full width with the times list below.
    - **Times:** time pills use `formatTimePT`; the chosen one is gold `bg-[#9E8C61] text-white`.
    - **Picking a time (book mode):** opens `BookingModal` (`fullScreenOnMobile`). The chip at top reads `formatSlotPT`. The form has the fields from Global Constraints, a Phone call / Google Meet segmented control, the consent notice, and [Confirm Call]. Success → "You're booked!" + time + "Reschedule" and "Cancel" links (both go to `manageUrl`). A 409 → closes the modal, shows "That time was just taken, please pick another." above the times, and refetches slots.
    - **Reschedule mode:** a time opens a small `ModalShell` "Move your call to <formatSlotPT>?" [Confirm] → POST manage `reschedule` → `onDone`.
    - **Unavailable:** `status: "unavailable"` or a fetch error shows "Booking is unavailable right now — send us a message instead" + [Message] (opens `ContactModal`, source `BOOKING_FALLBACK`).
    - **Recruiting prefill:** on mount, `?book=<token>` in `window.location.search` → GET prefill → fills First/Last/Email and sends `recruitToken` on submit.
    - **Loading:** a fixed-height skeleton (same height as the loaded calendar, so nothing jumps).
    - **Copy:** no "Pacific Time" label anywhere.
  - `BookingCalendarLazy` = `next/dynamic(() => import("./BookingCalendar"), { ssr: false, loading: <same skeleton> })` with the same props. Pages import ONLY this.

- [ ] **Step 1: Write failing tests:**
  - `buildMonthGrid(2026, 10)` (Nov 2026) → first cell `"2026-11-01"` (a Sunday), length 35.
  - `buildMonthGrid(2027, 1)` (Feb 2027) → 1 leading null (Feb 1 is a Monday), length 35 (trailing nulls pad to a full week).
  - Export a pure `dayState(ymd, days, selected): "closed" | "open" | "selected"` from `MonthGrid.tsx` and test the three states.
  - `renderToStaticMarkup(<BookingCalendar …/>)` contains no "Pacific Time".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS. Then check in the dev server:
  - Book one slot against Ryan's real connected calendar (after Task 17 setup), or against a mocked slots response if Google isn't connected yet.
  - Look at desktop 1440px and phone 390px.
- [ ] **Step 5:** Commit `feat(booking): calendar and booking pop-up`.

---

### Task 13: Placement — Contact page, Join page, manage page

**Files:**
- Modify: `src/app/(marketing)/contact/page.tsx` (two columns; remove the `contact-agent.png` block and the `next/image` import)
- Create: `src/components/join/BookACallSection.tsx`
- Modify: `src/app/(marketing)/join/page.tsx` (insert between `<HowToJoin />` and the Final CTA section)
- Create: `src/app/(marketing)/booking/manage/page.tsx` (+ `metadata = { robots: { index: false, follow: false } }`)
- Test: `src/__tests__/components/BookACallSection.test.ts`

**Interfaces:**
- Consumes: `BookingCalendarLazy`.
- Produces:
  - **Contact:** wrapper becomes `mx-auto max-w-6xl lg:grid lg:grid-cols-2 lg:gap-16`. The existing form block stays on the left unchanged (phone optional, message required). Right column: `<BookingCalendarLazy mode={{ kind: "book", page: "CONTACT" }} heading="Chat with Ryan" />` inside a white rounded card. Phone: the calendar stacks below the form.
  - **Join:** `BookACallSection` = `<section id="book-a-call" data-navbar-theme="light" className="bg-[#F2F0EF] px-8 py-24 lg:px-20 scroll-mt-24">` with heading "Chat with **Ryan**" (Ryan in gold `#9E8C61`, same heading scale as `HowToJoin`), then the calendar with `page: "JOIN"`.
  - **Manage page:** reads `t`, calls the manage GET server-side (or the lib directly) and shows:
    - the booking time,
    - a [Cancel call] button with a confirm step,
    - "Pick a new time" with `BookingCalendarLazy mode={{ kind: "reschedule", token }}`.
    - Cancelled → "This call was cancelled." Bad link → "This link isn't valid anymore." plus a link to `/contact`.

- [ ] **Step 1: Write failing test:** the `BookACallSection` markup contains `id="book-a-call"` and "Chat with".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement all three.
- [ ] **Step 4:** Run the test. Expected: PASS. Check in the dev server:
  - `/contact` and `/join#book-a-call` at 1440px and 390px.
  - `/join?book=<VECTOR-equivalent token signed with your local BOOKING_LINK_SECRET>#book-a-call` scrolls to the section and pre-fills.
  - A manage link from a test booking cancels and reschedules.
- [ ] **Step 5:** Commit `feat(booking): calendar on Contact and Join, manage page`.

---

### Task 14: Settings → Google Calendar card (admin only)

**Files:**
- Create: `src/components/dashboard/GoogleCalendarCard.tsx`
- Modify: `src/app/(dashboard)/dashboard/settings/page.tsx` (grid at ~line 186)
- Test: `src/__tests__/components/GoogleCalendarCard.test.ts`

**Interfaces:**
- Consumes: `GET/DELETE /api/google-calendar/status`, `/api/google-calendar/connect`.
- Produces:
  - `googleCardView(status: "disconnected" | "connected" | "broken", email?: string): { line: string; button: "Connect Google Calendar" | "Disconnect" | "Reconnect" }` (pure, exported).
  - Card (same `rounded-xl bg-white p-6 shadow-sm` styling, title "Google Calendar"):
    - Connected: "✓ Connected as ryanchong@cncrealtygroup.com" + Disconnect (with confirm).
    - Disconnected: one line "Lets visitors book 15-min calls on your calendar." + [Connect Google Calendar] (a link to the connect route).
    - Broken: "Connection lost — bookings are paused." + [Reconnect].
    - Reads `?gcal=connected | wrong-account` once to show "Connected." / "That wasn't ryanchong@cncrealtygroup.com — please pick that account."
  - Settings grid: admins get `grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 max-w-5xl xl:max-w-7xl` with the card as the third column; agents keep the exact current classes and never render or fetch the card (`session?.user?.role === "ADMIN"`). Below xl the card stacks under the others. The card is the page's only new query (one `useQuery`).

- [ ] **Step 1: Write failing test** for `googleCardView` (three states, exact strings above).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS. In the dev server, check Settings as admin at 1440px (three columns), 1100px (stacked) and 390px, and as an agent (unchanged, no request to `/api/google-calendar/status` in the network tab).
- [ ] **Step 5:** Commit `feat(booking): Google Calendar card on Settings`.

---

### Task 15: Message button restyle

**Files:**
- Create: `src/components/ui/cta-styles.ts`
- Modify: `src/components/ui/PageCTA.tsx` (default `secondaryClassName`), `src/components/join/JoinCTAButtons.tsx` (Message button)
- Test: `src/__tests__/components/cta-styles.test.ts`

**Interfaces:**
- Produces: `CTA_MESSAGE_CLS = "inline-flex items-center rounded-full border border-[#1B1B1B] bg-white px-8 py-3.5 font-sans text-sm font-medium text-[#1B1B1B]"`.
- Effect: Buy, Sell, Rent (`PageCTA` default), Join (`JoinCTAButtons`), and `/join/apply/submitted` (also uses the `PageCTA` default "Message") turn white with a black border. Manage (explicit gold `secondaryClassName`) and Home Value (gold primary) stay unchanged.

- [ ] **Step 1: Write failing test:**
  - `renderToStaticMarkup(<PageCTA heading="x" secondaryLabel="Message" showContactModal />)` contains `bg-white` and `border-[#1B1B1B] ` (solid border, not `/20`).
  - With Manage's override it contains `bg-[#9E8C61]` and not `bg-white`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS. Spot-check `/buy` and `/manage` CTAs in the dev server.
- [ ] **Step 5:** Commit `style: white Message button in CTA sections`.

---

### Task 16: Recruiting mailer — per-agent "Book a call" link (separate local repo)

**Files (in `C:\Users\hey_r\cnc-outreach-mailer`, not a git repo — back up `lib.mjs`, `lib.test.mjs` and `send.mjs` to `*.bak` first):**
- Modify: `lib.mjs` (new export), `lib.test.mjs`, `send.mjs` (apply link, dry-run warning, read `BOOKING_LINK_SECRET`)

**Interfaces:**
- Produces:
  - `BOOKING_PLACEHOLDER = "?book=AGENT"` (Ryan's Outlook button URL: `https://cncrealtygroup.com/join?book=AGENT#book-a-call`).
  - `makeBookingToken(name: string, email: string, secret: string): string`: the same format as the site (`base64url(JSON.stringify({ n: name, e: normEmail(email) })) + "." + base64url(HMAC-SHA256)`).
  - `addBookingLink(html: string, name: string, email: string, secret: string): { html: string; found: boolean }`: replaces every literal `?book=AGENT` with `?book=<token>`; `found` says whether any was present.
- `send.mjs`: `loadSettings` returns `bookingSecret: s.BOOKING_LINK_SECRET`. After `personalize(...)`, it calls `addBookingLink`. On a dry run it prints "Book-a-call button: found / NOT found in template". In live mode, a missing secret while the placeholder is present stops with a plain message ("Add BOOKING_LINK_SECRET to settings.env"). A missing placeholder sends as today.

- [ ] **Step 1: Write failing tests:**

```js
it("makes the same token the website reads (shared vector)", () => {
  expect(makeBookingToken("José O'Neil", "Jose@Example.com ", "test-recruit-secret"))
    .toBe("eyJuIjoiSm9zw6kgTydOZWlsIiwiZSI6Impvc2VAZXhhbXBsZS5jb20ifQ.EHlY9TBG-FymaxTkIpkf-b4atGYN-3XM16B7Tc5QOO0");
});
it("swaps every placeholder", () => {
  const r = addBookingLink('<a href="https://cncrealtygroup.com/join?book=AGENT#book-a-call">Book</a>x?book=AGENT', "A B", "a@b.co", "k");
  expect(r.found).toBe(true);
  expect(r.html).not.toContain("AGENT");
});
it("leaves a template without the button alone", () => {
  expect(addBookingLink("<p>hi</p>", "A B", "a@b.co", "k")).toEqual({ html: "<p>hi</p>", found: false });
});
```

- [ ] **Step 2:** Run `npx vitest run` in the mailer folder. Expected: new tests FAIL, existing PASS.
- [ ] **Step 3:** Implement with `node:crypto`.
- [ ] **Step 4:** Run. Expected: all PASS.
- [ ] **Step 5:** Ryan generates the secret once. Claude runs `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` and gives it to Ryan. He adds `BOOKING_LINK_SECRET=<value>` to Vercel and `apps/web/.env.local`. Claude appends the same line to settings.env with `echo "BOOKING_LINK_SECRET=<value>" >> settings.env` (never reading the file).
- [ ] **Step 6:** After Ryan adds the button to his Outlook template, run `node send.mjs --test` (sends one to `TEST_TO`). Expected: the email arrives, and the button opens `/join` with Ryan's test name pre-filled (once the site is deployed). This needs a deploy → do it in Task 17 after Ryan approves the push.

---

### Task 17: Google setup for Ryan, env, speed check, ship

**Files:**
- Create: `docs/superpowers/specs/2026-11-16-booking-calendar-google-setup.md` (plain-English steps for Ryan)

- [ ] **Step 1:** Write the setup steps (Ryan clicks; Claude does not drive his browser). Each step is one line:
  1. Signed in as ryanchong@cncrealtygroup.com, go to console.cloud.google.com, create a new project named "CnC Booking".
  2. APIs & Services → Library → enable "Google Calendar API".
  3. OAuth consent screen: user type External, app name "CnC Realty Booking", support email ryanchong@, scopes `calendar.events` + `calendar.freebusy`, then **Publish app → In production** (not Testing — Testing tokens expire in 7 days).
  4. Credentials → Create OAuth client ID → Web application. Authorized redirect URIs: `https://cncrealtygroup.com/api/google-calendar/callback` and `http://localhost:3000/api/google-calendar/callback`.
  5. Copy the Client ID/Secret into Vercel env (`GOOGLE_CAL_CLIENT_ID`, `GOOGLE_CAL_CLIENT_SECRET`) and `.env.local`. Claude generates `GOOGLE_TOKEN_KEY` with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
  6. After deploy: Dashboard → Settings → Connect Google Calendar → pick ryanchong@ → "Google hasn't verified this app" → Advanced → Go to CnC Realty Booking → Allow.
  7. Days off: create a timed event (e.g. 8 AM–8 PM, Busy by default) or an all-day event switched to **Busy**.
- [ ] **Step 2:** Local end-to-end with Ryan's real connection on `localhost:3000`:
  - Book a Meet call. Expected: the Google event shows on Ryan's calendar with a Meet link and the invite reaches the test address. **If no Meet link is ever created on this account, stop and report to Ryan before continuing.**
  - The lead appears in Admin → All Leads → Unassigned with the tags and Activity.
  - Reschedule, then cancel, from the email link.
  - A second browser trying the same slot gets "just taken".
- [ ] **Step 3:** Run `pnpm --filter web test` and `pnpm --filter web build`. Expected: 0 failures, build exits 0.
- [ ] **Step 4: Speed check (targeted):**
  - Compare `First Load JS` for `/contact`, `/join` and `/dashboard/settings` against the Task 0 baseline file. Expected: `/contact` and `/join` unchanged or smaller (the lazy chunk is not in first load); Settings grows only by the card.
  - One timed load each of `/contact` and `/join` with `next start` at 1440px and 390px (Puppeteer `performance.getEntriesByType("navigation")[0].loadEventEnd`), before (on `main`) and after.
  - Report the numbers to Ryan. Any regression gets fixed before shipping.
- [ ] **Step 5:** Run `superpowers:requesting-code-review` on the branch and fix findings.
- [ ] **Step 6:** Ask Ryan before pushing. Pre-push checklist: the migration includes the partial index; all 4 env vars are in Vercel; the vercel.json cron is added. After push, watch the Vercel build, then Ryan connects Google on live Settings and does one real booking.
- [ ] **Step 7:** Run the mailer `--test` send (Task 16 Step 6) and confirm the pre-filled Join link works live.
