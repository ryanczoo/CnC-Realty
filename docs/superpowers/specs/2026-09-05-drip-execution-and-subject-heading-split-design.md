# Drip Execution Engine + Subject/Heading Split — Design

## Overview

Two related problems, being solved together because they share the same underlying
delivery mechanism:

1. **Campaign DRIP sequences don't send.** `DripStep` (subject/body/delay per step)
   has existed since 2026-05-21, but no code anywhere reads those rows to send an
   email. The wizard's own submit handler explicitly excludes DRIP from the send
   call (`else if (sendNow && type === "EMAIL")`). Separately, "Schedule for Later"
   on a plain one-off EMAIL campaign has the identical gap: `Campaign.status` can be
   set to `SCHEDULED` with a `scheduledAt` date, but no cron ever checks for a
   scheduled campaign whose time has come.
2. **One field currently drives both the literal email subject line and the large
   in-body heading**, on three models: `Campaign.subject`, `ActionPlanStep.subject`,
   and `DripStep.subject`. Agents can't write a short subject line and a longer,
   different-sounding heading — whatever they type becomes both.

Both problems are fixed in one pass because DRIP execution requires touching the
same send paths (Campaign send, Action Plan send) that the heading split also needs
to touch, and because `DripStep` currently has zero live send history — it's the
cheapest of the three models to get right, with no existing behavior to preserve.

## Scope

**In scope:**
- A real execution engine covering (a) scheduled one-off EMAIL campaigns and (b)
  all DRIP campaigns, via a new per-recipient delivery table and an hourly cron.
- Fixing the live bug where the campaign detail page's "Send Now" button can fire
  on a DRIP campaign and send every recipient a blank email.
- A "Drip Steps" preview section on the campaign detail page.
- A "Start Now" manual override for a `SCHEDULED` campaign.
- Adding an optional `heading` field (falls back to `subject` when blank) to
  `Campaign`, `ActionPlanStep`, and `DripStep`, plus the UI inputs for each.
- Visually upgrading Action Plan emails (`sendActionPlanEmail`,
  `sendLeadReplyNotification`) from `emailLayout`'s generic 22px heading to the same
  33px/centered heading + 22.5px/`#4b4b4b` body style Campaign emails already have.
- A shared render helper so the heading/body markup is written once, not
  duplicated across the immediate send route, the new cron, and Action Plan sends.

**Explicitly out of scope:**
- Changing `ActionPlanStep.delayDays`'s existing "relative to enrollment" semantics.
  It's a separate field on a separate model with real live enrollments depending on
  its current behavior; nobody asked to touch it.
- Pause/resume/cancel for an in-flight DRIP campaign (Action Plans has this for
  enrollments; DRIP does not get it here — not requested, and adding it would be
  scope creep on top of an already substantial build).
- Editing a campaign's content after creation (true for EMAIL today too — no
  regression, just not extended to DRIP either).
- Per-agent email sending limits beyond the existing shared monthly quota
  (`Agent.monthlyEmailLimit`) — that's a separate, already-flagged future project.

## Data model

One new model, one new enum, three new nullable columns — all additive, no
migration risk to existing data:

```prisma
enum DeliveryStatus {
  PENDING
  SENT
  SKIPPED
  ERROR
}

model CampaignDelivery {
  id                String         @id @default(cuid())
  campaignContactId String
  dripStepId        String?
  dueAt             DateTime
  status            DeliveryStatus @default(PENDING)
  executedAt        DateTime?
  createdAt         DateTime       @default(now())

  campaignContact CampaignContact @relation(fields: [campaignContactId], references: [id], onDelete: Cascade)
  dripStep        DripStep?       @relation(fields: [dripStepId], references: [id], onDelete: Cascade)

  @@index([status, dueAt])
}
```

- `dripStepId: null` → this delivery is a plain scheduled one-off email (content
  comes from the parent `Campaign`).
- `dripStepId` set → this delivery is one step of a DRIP sequence (content comes
  from the referenced `DripStep`).
- `CampaignContact` gains `deliveries CampaignDelivery[]`.
- `DripStep` gains `deliveries CampaignDelivery[]`.
- `Campaign.heading String?`, `ActionPlanStep.heading String?`,
  `DripStep.heading String?` — all nullable, no default needed.

This mirrors `LeadPlanStep`'s already-proven shape (same `[status, dueAt]` index,
same `PENDING` → terminal lifecycle) rather than inventing a new pattern.

## Materialization — the new `/schedule` endpoint

New route: `POST /api/campaigns/[id]/schedule`. Body: `{ sendNow: boolean,
scheduledAt?: string }`.

This is the only place `CampaignDelivery` rows get created, and it runs once, at
the same point in the flow where contacts are currently attached (the wizard's
`handleFinish`) — not lazily, matching how `LeadPlanStep` rows are materialized
immediately at enrollment rather than computed on the fly by the cron.

Behavior:
1. `requireAuth("AGENT")` + `checkOwnership`, same pattern as every other campaign
   route.
2. Load the campaign with its contacts and (if `type === "DRIP"`) its `DripStep`s
   ordered by `stepOrder`.
3. Validate server-side (client-side wizard gating is not trusted alone, matching
   this codebase's existing convention): 400 if there are no contacts; 400 if
   `type === "DRIP"` and there are no steps; 400 if `!sendNow` and `scheduledAt` is
   missing or not in the future; **400 if `campaign.status` is not `DRAFT`** — this
   is the endpoint's idempotency guard. A double-submit or network retry of the
   wizard's finish call cannot materialize duplicate delivery rows, because the
   first successful call always advances the campaign past `DRAFT` before a second
   one could run.
4. `startTime = sendNow ? now : new Date(scheduledAt)`.
5. Build `CampaignDelivery` rows:
   - `type === "EMAIL"`: one row per contact, `dripStepId: null`,
     `dueAt: startTime`.
   - `type === "DRIP"`: for each contact, one row per step. Each step's `dueAt` is
     computed **cumulatively from the previous step**, not from `startTime`
     directly: step 1's `dueAt = startTime`, step 2's `dueAt = step1.dueAt +
     step2.delayDays`, step 3's `dueAt = step2.dueAt + step3.delayDays`, and so on.
     (See "Resolved ambiguity" below — this is deliberately different from how
     `ActionPlanStep.delayDays` is computed.)
6. Set `campaign.status = sendNow ? "ACTIVE" : "SCHEDULED"` and, if `sendNow`,
   `campaign.sentAt = startTime`.

**This endpoint replaces the wizard's current ad-hoc branching for two of its
three cases.** The wizard's `handleFinish` today does:

```
if (!sendNow && scheduledAt) → PATCH { scheduledAt, status: "SCHEDULED" }
else if (sendNow && type === "EMAIL") → POST /send
// (sendNow && type === "DRIP") falls through and does nothing — the live gap)
```

After this change:

```
if (sendNow && type === "EMAIL") → POST /send   // unchanged, untouched, still synchronous
else                             → POST /schedule { sendNow, scheduledAt }
```

The existing immediate "Send Now on a plain EMAIL campaign" path is not modified
in any way — it keeps its own tested quota/opt-out/pre-mark logic exactly as it is
today. Only the two currently-broken cases (scheduled EMAIL, and DRIP of either
timing) route through the new endpoint.

### Resolved ambiguity: `DripStep.delayDays` is cumulative, not enrollment-relative

`ActionPlanStep.delayDays` is computed as `enrollmentTime + delayDays` independently
for every step (`cron/action-plans/route.ts`). `DripStep.delayDays` will use a
**different** semantic: cumulative from the previous step. Reasoning:

- `DripSequenceEditor`'s own "Add Step" button defaults every step after the first
  to `delayDays: 3` (not an increasing number per position). Under an
  enrollment-relative interpretation, two un-edited steps would silently land on
  the exact same day — a real footgun. Under cumulative, the default behaves
  sensibly: each new step is 3 days after the one before it.
- Cumulative spacing ("wait 3 days, then send the next one") is the standard
  mental model for drip/nurture sequences across virtually every mainstream email
  tool, and DRIP is being kept specifically because it's a selling point for
  agents evaluating the CRM — it should feel like the drip tools they already
  know.
- `ActionPlanStep.delayDays`'s existing behavior is not changed. It's a distinct
  field on a distinct model, authored by an admin building day-N milestones from
  enrollment (a legitimately different and reasonable mental model for that
  feature) with real live enrollments already depending on it.

## Starting a `SCHEDULED` campaign early — `/start-now`

This is a **separate** endpoint from `/schedule`, not the same call reused —
`/schedule` only ever runs once per campaign (guarded by the `DRAFT`-only check
above) and *creates* delivery rows; starting early needs to *reshape* rows that
already exist, which is a different operation with a different precondition.

New route: `POST /api/campaigns/[id]/start-now`. No body.

1. `requireAuth("AGENT")` + `checkOwnership`.
2. 400 if `campaign.status !== "SCHEDULED"` — this only makes sense for a campaign
   that's waiting on a future date; it is not a way to resend a completed or
   already-active campaign.
3. Load all of this campaign's `CampaignDelivery` rows still `status = "PENDING"`,
   find the earliest `dueAt` among them (that's step 1 for a DRIP sequence, or the
   single row for a plain scheduled email), and compute `delta = now -
   earliestDueAt`.
4. Shift every `PENDING` delivery's `dueAt` forward by `delta` (i.e., add the same
   delta to each), so the earliest one becomes due immediately while every later
   step keeps its original spacing relative to it.
5. Set `campaign.status = "ACTIVE"` and `campaign.sentAt = now`.

The hourly cron picks up the now-due first delivery on its next run exactly as it
would for anything else — `/start-now` only ever touches `dueAt` timestamps, it
never sends an email itself.

## Execution engine — hourly cron

New route: `POST /api/cron/campaign-deliveries`. Added to `vercel.json`:
`{ "path": "/api/cron/campaign-deliveries", "schedule": "0 * * * *" }` (hourly).

Closely mirrors `cron/action-plans/route.ts`, an already-proven pattern:

1. `Authorization: Bearer ${CRON_SECRET}` check, same as every other cron.
2. Query `CampaignDelivery` where `status = "PENDING" AND dueAt <= now`, including
   the contact's lead, the owning agent (for quota), and either the parent
   `Campaign` (plain scheduled send) or the related `DripStep` (drip step),
   ordered by `dueAt`.
3. One `ensureQuotaReset` per distinct agent represented in the batch — deduped,
   not once per delivery.
4. Process all due deliveries concurrently via `Promise.all`, each branch
   resolving rather than rejecting (so one failure can't abandon the rest of the
   batch, matching the Action Plans cron's error-isolation style):
   - `tryConsumeEmailQuota(agentId, monthlyEmailLimit)`. If unavailable, leave the
     delivery `PENDING` — picked up on a later hourly run once quota resets. This
     is circumstantial, not a permanent skip.
   - Resolve content: for a plain scheduled email, `subject = campaign.subject`,
     `heading = campaign.heading || campaign.subject`, `body = campaign.body`. For
     a drip step, `subject = dripStep.subject`, `heading = dripStep.heading ||
     dripStep.subject`, `body = dripStep.body`.
   - Render via the shared helper (see below) and send via `sendEmail` on the
     broadcast stream, `category: "campaign"`, with the unsubscribe footer —
     identical to what the immediate `/send` route already does.
   - Mark the delivery `SENT` / `SKIPPED` (opted out) / `ERROR`, with
     `executedAt`.
5. Status rollup, run after processing:
   - The moment a campaign's *first* delivery actually sends, flip
     `Campaign.status` from `SCHEDULED` → `ACTIVE` and set `campaign.sentAt` to
     that timestamp — so `SCHEDULED` accurately means "nothing has gone out yet."
   - `CampaignContact.status` flips to `SENT` only once **all** of that contact's
     own deliveries are terminal (for a one-off email that's the same moment
     either way; for DRIP, only after the last step completes) — mirroring how
     `LeadPlanEnrollment` only completes once every one of its steps is
     `DONE`/`SKIPPED`.
   - Once every contact on a campaign is terminal, flip `Campaign.status` to
     `COMPLETED`.

## Shared render helper

The `<h2>` heading markup + scoped paragraph-spacing `<style>` block currently
duplicated inline in `campaigns/[id]/send/route.ts` gets extracted into one small
function (living alongside `emailLayout` in `lib/email.ts`), taking `{ heading,
bodyHtml }` and returning the ready-to-wrap markup. Three call sites use it:
- The existing immediate Campaign `/send` route (replacing its current inline
  markup — no behavior change, same output).
- The new hourly cron, for both plain scheduled sends and drip steps.
- `sendActionPlanEmail` / `sendLeadReplyNotification` in `lib/action-plan-email.ts`,
  replacing their current plain `emailLayout({ heading: opts.subject })` call —
  this is the visual upgrade to the 33px style, applied by construction rather
  than by duplicating the markup a fourth time.

## Subject/heading split

- `heading` is optional everywhere. When blank, the rendered heading falls back to
  `subject`. The literal email `subject:` line always uses `subject` alone,
  never `heading`.
- New input added directly under the existing "Subject" field, labeled "Heading
  (optional) — defaults to subject line," in three places:
  - Campaign wizard's Details step (`campaigns/new/page.tsx`).
  - Each step in `DripSequenceEditor.tsx`.
  - The admin's `ActionPlanStepDrawer.tsx` (Action Plan template step editor).
- `POST /api/campaigns`, `PATCH /api/campaigns/[id]`, and the drip-steps CRUD route
  all accept and persist the new field alongside `subject`, following the exact
  pattern already used for `subject` in each.

## UI fixes on the campaign detail page

- **Bug fix:** `canSend` (currently `status === "DRAFT" && has pending contacts`,
  with no type check) is restricted to `type === "EMAIL"` only. This is
  defense-in-depth — once the wizard routes every DRIP/scheduled-EMAIL campaign
  through `/schedule` at creation, none should ever reach `DRAFT` with contacts
  already attached, but the button itself should not be able to fire on a DRIP
  campaign under any circumstance.
- **New "Start Now" override:** for a campaign in `SCHEDULED` status, a button
  calls the new `POST /api/campaigns/[id]/start-now` endpoint, letting an agent
  kick off an already-scheduled campaign (one-off or DRIP) immediately instead of
  waiting for its original date. See "Starting a SCHEDULED campaign early" above.
- **New "Drip Steps" preview**, shown only when `campaign.type === "DRIP"`,
  replacing the current "Body Preview" block (which never renders for DRIP today,
  since `campaign.body` is always empty for that type). Lists each step — delay,
  subject, heading, body — plus per-step delivery progress once sending has
  started (e.g., "Step 2 of 3 — 12 of 40 sent"), read from `CampaignDelivery`
  rows grouped by `dripStepId`. Read-only, matching how EMAIL campaigns have no
  post-creation edit UI either.

## Testing

- TDD throughout, matching this project's convention.
- New tests for the shared render helper (heading falls back to subject; literal
  subject line is never affected by heading).
- New tests for `/api/campaigns/[id]/schedule`: correct `dueAt` math for both a
  plain scheduled send and a cumulative multi-step drip sequence, correct status
  transitions, all four validation 400s (no contacts, DRIP with no steps, missing
  or past `scheduledAt`, and non-`DRAFT` status rejecting a second call).
- New tests for `/api/campaigns/[id]/start-now`: rejects any status other than
  `SCHEDULED`, shifts every `PENDING` delivery by the same delta so relative
  spacing between steps is preserved, leaves already-terminal deliveries alone.
- New tests for `/api/cron/campaign-deliveries`, mirroring
  `cron-action-plans.test.ts`'s shape: due vs. not-yet-due, quota exhaustion
  leaves a delivery `PENDING` rather than erroring it, an opted-out lead results
  in `SKIPPED`, and campaign/contact status rolls up correctly only once every
  delivery is terminal.
- Updated tests: `campaigns-send.test.ts` (heading fallback on the untouched
  immediate path, confirming no behavior change there beyond the new field), and
  `action-plan-email.test.ts` (33px style + heading fallback once the visual
  upgrade lands).
- No new UI/component tests — this project has no React-component-render test
  infrastructure; wizard and detail-page changes are verified live in the
  browser, matching every prior email/UI change in this project.
- Safety already inherited from the pattern being mirrored: the cron is
  idempotent (a delivery only processes while `status = "PENDING"`, so a retry or
  overlapping run can't double-send), and each delivery is processed
  independently so one failure can't block the batch.

## Migration notes

All schema changes are additive (one new table, one new enum, three nullable
columns) — no risk to existing `Campaign`, `ActionPlanStep`, `DripStep`, or
`CampaignContact` data, and no relation to `Property` or anything else under any
active constraint.
