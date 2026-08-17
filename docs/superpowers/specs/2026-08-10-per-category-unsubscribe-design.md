# Per-category unsubscribe — design

**Date:** 2026-08-10
**Status:** Approved, ready for implementation planning
**Supersedes:** outstanding item #3 in the 2026-08-09 session notes ("Unsubscribe: two systems that don't talk to each other")

---

## Problem

Two unsubscribe systems run in parallel and neither knows about the other.

Postmark's broadcast stream is configured with `SubscriptionManagementConfiguration.UnsubscribeHandlingType = "Postmark"`, so Postmark maintains its own suppression list and injects its own unsubscribe link. Alongside it we built a second system: signed HMAC tokens, an `emailOptOut` column, `/api/unsubscribe`, and our own `List-Unsubscribe` header.

Measured against the live API on 2026-08-10, not inferred:

- `GET /message-streams/broadcast` returns `UnsubscribeHandlingType: "Postmark"`.
- The only broadcast ever delivered (MessageID `787751b1-2f32-44d7-b5eb-fc0d05b9f8a1`) carried
  `List-Unsubscribe: <https://subscriptions.pstmrk.it/demo/unsubscribe>` — Postmark's URL, not ours — and Postmark
  appended its own unsubscribe link into both the HTML and plain-text bodies.
- `GET /message-streams/broadcast/suppressions/dump` returns **0 entries**.
- `GET /webhooks` returns **no registered webhooks at all**.

That smoke test was ad-hoc and is not in the repo, so it cannot be determined from the archive alone whether Postmark
*overrode* a custom header or the test never set one. Either way, the system that reached the inbox was Postmark's.

A second, independent problem surfaced while scoping this. A single boolean governs three different kinds of email, so
unsubscribing from a marketing blast also silently kills the saved-search property alerts the recipient explicitly asked
for.

## Decisions

| Decision | Rationale |
|---|---|
| Set the broadcast stream to `UnsubscribeHandlingType: "none"` | We own the unsubscribe path end to end. Single source of truth is our database. The code is already written and currently bypassed. |
| One opt-out flag **per email category** | An unsubscribe click cancels only the category it arrived in. Matches Google's stated model: "the recipient can be removed only from the mailing list associated with the message." |
| Reuse booleans; do not model a suppression *reason* | Bounce, complaint, and unsubscribe all simply set flags. Shipping speed over reporting granularity. Revisit if list hygiene reporting is ever needed. |
| Hard bounce and spam complaint set **all** category flags | A dead address is dead for every category; a complaint means stop everything. |
| Ignore Postmark reactivation events | With no stored reason we cannot tell an opted-out person from a bounced one, so auto-clearing risks resubscribing someone who asked to leave. Recipients can resubscribe themselves — see "Why reactivation needs no handling". |
| Keep a separate "unsubscribe from all" control | Expected by regulators and by Gmail's bulk-sender guidance. It is a deliberate second click, not a side effect of a single-category unsubscribe, so it does not violate the per-category rule. |

## Categories

Exactly three, matching the three existing broadcast call sites one-to-one.

| Category | Call site | Recipient table |
|---|---|---|
| `campaign` | `apps/web/src/app/api/campaigns/[id]/send/route.ts` | `Lead` |
| `action_plan` | `apps/web/src/lib/action-plan-email.ts` | `Lead` |
| `property_alert` | `apps/web/src/lib/email/property-alert-email.ts` | `User` (via `SavedSearch.userId`) |

`User` only ever receives property alerts; `Lead` receives campaigns and drips. So `User` needs one flag (a rename) and
`Lead` needs two.

Transactional mail is unaffected and remains unsuppressable.

## Schema

```prisma
// Lead
campaignOptOut     Boolean @default(false)  // renamed from emailOptOut
actionPlanOptOut   Boolean @default(false)  // new

// User
propertyAlertOptOut Boolean @default(false) // renamed from emailOptOut
```

`emailOptOut` is removed from both models.

**Migration must use explicit `ALTER TABLE ... RENAME COLUMN`, hand-written.** Renaming a field in the Prisma schema and
autogenerating produces `DROP COLUMN` + `ADD COLUMN`, which discards data. All current values are believed to be `false`
(the column was added 2026-08-09, no campaign has sent, Postmark's suppression list is empty), but the rename should
preserve data regardless rather than rely on that belief.

**Verify before writing the migration:** query both tables for any `emailOptOut = true` rows. If any exist, they map to
`campaignOptOut` / `propertyAlertOptOut` respectively, and `actionPlanOptOut` starts `false`.

## Token

Payload becomes `kind:id:category`, still base64url, still HMAC-SHA256 over `NEXTAUTH_SECRET`, still no table and no
expiry.

```
makeUnsubscribeToken(kind, id, category) -> "<payload>.<sig>"
verifyUnsubscribeToken(token)            -> { kind, id, category } | null
```

Parsing keeps the existing "split on the first colons, rejoin the remainder" defensiveness. `category` is validated
against the three known values; an unknown category fails verification rather than defaulting.

No tokens have ever been sent, so there is no backward-compatibility burden for the old two-field format. Do not add
one.

**`NEXTAUTH_SECRET` must be rotated before launch, not after.** It signs these tokens; rotating post-launch invalidates
every unsubscribe link already sitting in recipients' inboxes, which is a compliance failure. This is already tracked as
a pre-launch item and this design increases its importance.

## Send seam (`lib/email/send.ts`)

`category` becomes required on broadcast sends, via the existing discriminated union:

```ts
type StreamRouting =
  | { stream: "transactional"; recipient?: OptOutRecipient }
  | { stream: "broadcast"; recipient: OptOutRecipient; category: EmailCategory };
```

This is the same compile-time trick that made `recipient` required during the Postmark migration; the compiler will
locate exactly the three broadcast call sites.

`isOptedOut(recipient, category)` maps category to column:

| category | table | column |
|---|---|---|
| `campaign` | Lead | `campaignOptOut` |
| `action_plan` | Lead | `actionPlanOptOut` |
| `property_alert` | User | `propertyAlertOptOut` |

Existing fail-open behaviour on a missing row is preserved: a deleted lead is not an opt-out.

**`sendEmail` returns a result instead of `void`:**

```ts
type SendResult = { sent: true } | { sent: false; reason: "opted_out" };
```

See "Bug 1" below for why.

## One-click endpoint (`/api/unsubscribe`)

Behaviour is unchanged except that it now opts out of the token's category only.

Constraints to preserve, both already satisfied and both load-bearing:

- POST only. Mail scanners prefetch links; a mutating GET would opt out people who never clicked.
- The token is read from the query string *before* the body is touched, because RFC 8058 one-click sends a
  form-encoded body while our own page sends JSON.
- The one-click POST must complete the unsubscribe **immediately and must not redirect to the preference center**.
  Google's guidance is explicit that a header pointing at a preference page does not satisfy the requirement.

## Preference page (`/unsubscribe`)

Reads the token, renders the recipient's three current preferences as checkboxes, and saves on submit. Still never
mutates on GET.

- A `Lead` sees `campaign` and `action_plan`; a `User` sees `property_alert`. Do not render checkboxes for categories
  the recipient's table cannot receive.
- A separate "unsubscribe from all" button sets every applicable flag.
- Single page, no login, mobile-first with large touch targets — over half of email opens are mobile.
- The category the recipient arrived from should be visually indicated.

## SubscriptionChange webhook

New handler for `RecordType: "SubscriptionChange"` in `apps/web/src/app/api/webhooks/postmark/route.ts`.

- `SuppressSending: true` with reason `HardBounce` or `SpamComplaint` → set **all** category flags for that email
  address.
- `SuppressSending: false` (reactivation) → **ignore**.
- Unknown or absent reason → ignore, do not guess.
- Keep returning 200 on internal errors so Postmark does not retry the same payload indefinitely.

**Look up the address in both `Lead` and `User`, and update every match.** The existing handler only queries `Lead`
(`route.ts:51`). Property alerts go to `User`s, so a hard-bouncing saved-search subscriber is currently never flagged at
all. The same address may exist in both tables — a lead who later registered — and both must be updated.

**This is additive to the existing `Bounce` / `SpamComplaint` handling, which stays.** Those `RecordType`s update
`CampaignContact.status` for a specific campaign; `SubscriptionChange` sets the durable per-person opt-out flags. Both
events fire and both are needed — do not replace one with the other. Without the durable flag, a bounced address is
mailable again on the next campaign, because that campaign creates fresh `CampaignContact` rows with `PENDING` status.

Even with the stream set to `none`, Postmark still adds hard bounces and spam complaints to its suppression list, so
this handler is required regardless of the unsubscribe-handling choice.

**Registration is a deploy-day task.** No webhooks are registered today and `NEXTAUTH_URL` is still `localhost:3000`, so
Postmark cannot reach us. The handler is written and unit-tested now; wiring it up joins the existing deploy checklist.

### Why reactivation needs no handling

The token is a stable HMAC, not a single-use nonce, so a link in a months-old email keeps working indefinitely. A
recipient who wants back on a list can re-check the box themselves. Postmark's reactivation event is therefore redundant,
and ignoring it removes a whole class of two-way-sync bug.

## Two pre-existing bugs, fixed as part of this work

Neither is caused by the category change, but both live in the code being modified and bug 1 worsens with three
categories.

### Bug 1 — suppressed contacts are recorded as `SENT`

`sendEmail` returns early and silently when a recipient is opted out. The promise still fulfills, so the campaign route
increments `sent` and writes `status: "SENT"` for someone who received nothing. Campaign stats overstate delivery and
dilute the open rate.

This is the same failure mode as the IDX `skipped` counter fixed on 2026-08-09: a deliberate skip that is
indistinguishable from a success because nothing counts it.

**Fix:** `sendEmail` returns `SendResult`. The campaign route counts suppressed recipients separately and marks those
contacts `UNSUBSCRIBED` rather than `SENT`. The API response reports `{ sent, skipped, errors }`, and a test asserts
`sent + skipped + errors === contacts.length` — the same invariant assertion used for the IDX sync.

`UNSUBSCRIBED` already exists in the `ContactStatus` enum (`schema.prisma:71`) and already has a badge style in
`campaign-ui.ts:34`, but **no code path has ever written it**. The status was designed in and never wired up, so this
fix needs no enum migration and no new UI work.

### Bug 2 — N+1 opt-out lookups per campaign

The contact query filters on `status: "PENDING"` only, then the seam runs a `findUnique` per recipient inside
`Promise.allSettled`. A 1,000-lead campaign fires 1,000 concurrent opt-out queries at Neon.

**Fix:** filter opted-out leads in the original contact query. The per-send check in the seam stays as a backstop for
races and for callers that do not pre-filter.

## Stream configuration change — ✅ DONE (2026-08-16/17)

**`none` does not exist for a Broadcasts stream.** `PATCH` with `UnsubscribeHandlingType: "none"` returns `422`
(`ErrorCode 1239`, "not supported for this stream type") — every Broadcasts stream must carry an unsubscribe
mechanism, so management cannot be switched off entirely. This was discovered only when attempted live; the value
below is corrected from what was originally written here.

```
PATCH /message-streams/broadcast
{ "SubscriptionManagementConfiguration": { "UnsubscribeHandlingType": "Custom" } }
```

`Custom` matches the approved design intent ("own it entirely") and was always listed as a valid resolution — only
the specific value chosen above was wrong. `Custom` is gated behind Postmark granting account-level permission
(`422`, `ErrorCode 1238` until granted). Unblocked via a support ticket describing the built system (visible
unsubscribe link, `List-Unsubscribe`/`List-Unsubscribe-Post` headers, own suppression store, `SubscriptionChange`
webhook handling); Postmark enabled the permission 2026-08-16.

**Live verification, through the real seam** (not the API in isolation): a temporary script imported `sendEmail`
from `lib/email/send.ts` unmodified and called it exactly as the app does. Delivered message diffed against the
2026-08-09 Postmark-handled baseline:

| | Before (`Postmark`) | After (`Custom`) |
|---|---|---|
| `List-Unsubscribe` | `<https://subscriptions.pstmrk.it/demo/unsubscribe>` | our own `/api/unsubscribe?t=…` |
| Body | Postmark appended its own unsubscribe paragraph | unchanged — byte-identical to what was sent |
| Accepted | Sent | Sent |

All three confirmed. This settles the open question definitively: Postmark **was** the one reaching the inbox
before this, not merely filling a gap.

## Testing

- Token: round-trips each of the three categories; rejects a tampered signature, an unknown category, and a malformed
  payload.
- Seam: each category reads the correct table and column; a broadcast to an opted-out recipient does not call Postmark
  and returns `{ sent: false, reason: "opted_out" }`; opting out of one category does not suppress another; a missing
  row still sends.
- One-click: POST with a category token sets only that flag; GET is not accepted; the form-encoded body path works.
- Preference page: GET never mutates; a Lead is not offered `property_alert`; "unsubscribe from all" sets every
  applicable flag.
- Webhook: `HardBounce` and `SpamComplaint` set all flags; reactivation is ignored; unknown reason is ignored; an
  address present in both `Lead` and `User` updates both; existing `Bounce` / `SpamComplaint` `CampaignContact`
  behaviour still passes unchanged.
- Campaign route: `sent + skipped + errors === contacts.length`; suppressed contacts are not marked `SENT`.

Mock hygiene: set implementations in `beforeEach`, not `vi.clearAllMocks()`, which clears calls but not
implementations — the leak that caused the `idx-sync.test.ts` pollution.

## Out of scope

- Suppression reason / audit columns. Explicitly declined in favour of shipping.
- "Pause for 30/60/90 days" instead of unsubscribing. Common in the wild, worth revisiting after launch.
- Per-agent email limits. Unrelated, still open from 2026-08-04.
- Syncing our opt-outs *into* Postmark's suppression list. Unnecessary once the stream is `Custom` and every send
  goes through the seam.

## Open items requiring action outside this spec

1. ~~Verify no `emailOptOut = true` rows exist before writing the migration.~~ Superseded — the implementation used
   an expand/contract migration with a backfill instead, closing this by construction (see the plan).
2. ~~Ryan's go-ahead for the live `PATCH` and the verification send.~~ Done 2026-08-16/17 — see Stream configuration
   change above.
3. Webhook registration at deploy — add `SubscriptionChange` to the existing deploy checklist.
4. Rotate `NEXTAUTH_SECRET` before launch.
