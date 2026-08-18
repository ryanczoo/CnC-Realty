# Per-agent email limit — design

**Date:** 2026-08-17
**Status:** Approved, ready for implementation planning
**Resolves:** "Per-agent email limits" — listed as out of scope in the 2026-08-10 per-category-unsubscribe design, open since 2026-08-04.

---

## Problem

Postmark bills per account, not per agent. Nothing today stops one agent's campaign or drip sequence from consuming
the brokerage's entire monthly send allowance by itself. Postmark is currently on the Free tier (100 sends/month,
account-wide); the planned upgrade is Basic ($15/mo, 10,000 sends/month). Ryan wants a per-agent ceiling in place
before that upgrade matters, sized so ~50 agents can each get a fair, predictable share.

## Decisions

| Decision | Rationale |
|---|---|
| Only agent-initiated bulk sends count — campaigns and drip/Action Plan steps | These are the only two email types an agent actively chooses to send to a list. Trigger-automation emails and system notifications (deadline reminders, lead-assigned, etc.) are not agent-initiated and are excluded. |
| Fixed number per agent, admin-editable, not a global constant | Ryan wants the ability to raise or lower an individual agent's limit later without a code change. |
| Default limit: **200/month** | `10,000 ÷ 50 agents = 200`, sized against the Basic plan Ryan intends to upgrade to. Purely a starting point — editable per agent from day one. |
| A batch sends what fits and skips the rest, never blocks the whole send | Matches how the campaign route already treats suppressed (opted-out) recipients — a partial send, not a hard failure. |
| Reset is a lazy comparison, not a cron | No new scheduled job, no write on page load. The counter only physically zeroes out the next time that agent actually sends something after the boundary has passed. |
| Quota display lives on the Campaigns list page, not the New Campaign wizard | `/dashboard/campaigns` is a Server Component that already runs a session-scoped query on page load — one more field on that same fetch. The wizard is a Client Component; showing it there would need a new client-side fetch (a real added round trip), so it's out of scope for this pass. |
| Admin editing reuses the existing `/admin/agents` table and its inline-edit pattern | `AgentTitleEditor.tsx` already does exactly this for the `title` field. A sibling component and one more field on the same PATCH route, not new architecture. |

## Schema

Three new fields on `Agent`:

```prisma
monthlyEmailLimit Int      @default(200)
monthlyEmailsSent Int      @default(0)
monthlyResetAt    DateTime @default(now())
```

`monthlyResetAt` marks the end of the current counting period. Initialized to `now()` on creation so a brand-new
agent's first send correctly triggers the reset-and-count-from-zero path rather than requiring a special case for
"never set."

## Reset boundary

Calendar-month, same for every agent (1st of the month, **UTC** — corrected during plan-writing; this section
originally said `America/Los_Angeles` "matches the site's other date handling," which turned out to be false on
inspection — there is no timezone-aware date logic anywhere in this codebase, and the one comparable case
(`deal-pipeline.ts`) explicitly uses UTC). UTC is simple to communicate to agents and to reason about, avoids
hand-rolled DST math for a low-stakes internal cap, and is not tied to Postmark's own billing cycle, which doesn't
need to align for this purely internal cap. The implementation (`apps/web/src/lib/email-quota.ts`) uses UTC
throughout; this was the plan's own self-correction, not a deviation from it.

"Advance `monthlyResetAt` to the next 1st" means the first 1st-of-month midnight strictly after the moment of the
reset — so a reset triggered on the 1st itself lands on the *following* month's 1st, not the same day. This avoids
an agent's counter resetting twice in one day if their first send of the month happens to land exactly on the
boundary.

## Computing remaining quota

One pure function, used by both the read path (Campaigns page display) and the write path (send-time check), so
the two can never disagree:

```
remaining(agent, now) =
  monthlyResetAt(agent) <= now
    ? monthlyEmailLimit(agent)
    : max(0, monthlyEmailLimit(agent) - monthlyEmailsSent(agent))
```

The read path (Campaigns page) only ever calls this function — it never writes. The physical reset (zeroing
`monthlyEmailsSent`, advancing `monthlyResetAt` to the next 1st) happens only inside the increment path, the first
time that agent sends something after the boundary has passed.

## Enforcement — concurrency

Both call sites (campaign send route, Action Plan cron) process multiple recipients concurrently
(`Promise.allSettled` / `Promise.all`), so a naive "read count, compare, increment" per recipient races: several
sends could all read the same "quota available" state before any of them writes it back, letting the agent go over
their limit within one batch.

Fix: each successful send point performs one atomic conditional update, not a separate read-then-write:

```ts
const result = await prisma.agent.updateMany({
  where: { id: agentId, monthlyEmailsSent: { lt: agent.monthlyEmailLimit } },
  data: { monthlyEmailsSent: { increment: 1 } },
});
// result.count === 1 → quota was available, this send counts
// result.count === 0 → agent was already at their limit, skip this send
```

`agent.monthlyEmailLimit` is read once at the start of the batch (it doesn't change mid-batch) and reused as the
threshold for every recipient's conditional update. Before the batch starts, a single reset check runs first (if
`monthlyResetAt <= now`, one `updateMany` sets `monthlyEmailsSent: 0` and advances `monthlyResetAt` to the next 1st)
so the batch always starts counting from a correct baseline.

## Campaign route — behavior at the limit

`apps/web/src/app/api/campaigns/[id]/send/route.ts` already loops over `campaign.contacts` inside
`Promise.allSettled`, and already distinguishes `sent` from `skipped` (unsubscribed) in its response. This adds a
third bucket:

- A contact whose send fails the atomic quota check is **not** marked `UNSUBSCRIBED` (that status means "never
  attempt again") and is **left `PENDING`** — same status it already had. It remains eligible for a future manual
  re-send of the same campaign once quota is available again, exactly like today's unsubscribed-filtering behavior
  for anyone who re-subscribes.
- Response shape grows to `{ sent, skipped, skippedLimit, errors }`. The existing invariant test
  (`sent + skipped + errors === contacts.length`, from the per-category unsubscribe work) becomes
  `sent + skipped + skippedLimit + errors === contacts.length`.

## Action Plan cron — behavior at the limit

`apps/web/src/app/api/cron/action-plans/route.ts` already has a `PlanStepStatus.SKIPPED` terminal state, currently
used only when a lead has no email on file — a permanent condition that will never resolve itself.

A limit-reached skip is different: it's circumstantial, not permanent. The step is **left `PENDING`** (not marked
`SKIPPED`). Its `dueAt` is already `<= now`, so the cron's own `where` clause picks it up again automatically on
the next run — including the run after the monthly reset, with no extra logic needed. This deliberately does not
reuse `SKIPPED`, since that status has no "retry later" meaning today and repurposing it would blur the two very
different cases (dead lead vs. temporary quota).

## Display — Campaigns list page

`apps/web/src/app/(dashboard)/dashboard/campaigns/page.tsx` already loads `session.user.agentId` from the cached
JWT and runs a Prisma query for the campaign list, all server-side, all in the same request. Add one small
`prisma.agent.findUnique` (or fold the needed fields into an existing query if one already touches `Agent`) selecting
just `monthlyEmailLimit`, `monthlyEmailsSent`, `monthlyResetAt`, and render:

```
142 / 200 sends left this month
```

using the same `remaining()` calculation as the enforcement path. No new network round trip, no client-side fetch —
this is the entire reason the Campaigns page (not the wizard) was chosen.

Only rendered for `AGENT` role — an `ADMIN` viewing this page has no personal quota (mirrors the existing
`agentId = role !== "ADMIN" ? ... : null` pattern already in this file).

## Admin editing — `/admin/agents`

New column on the existing `All Agents` table, next to `LEADS`. New sibling component to `AgentTitleEditor.tsx`
(e.g. `AgentEmailLimitEditor.tsx`) — identical click-to-edit shape, numeric input instead of text, PATCHing the
same `apps/web/src/app/api/admin/agents/[id]/route.ts` route with one more optional field:

```ts
const { title, monthlyEmailLimit } = body as { title?: unknown; monthlyEmailLimit?: unknown };
```

Validate `monthlyEmailLimit` as a non-negative integer when present; reject (400) otherwise. Does not touch
`monthlyEmailsSent` or `monthlyResetAt` — this route only ever changes the ceiling, never the running count.

## Testing

- `remaining()`: correct before and after the reset boundary; clamps at 0; unaffected by concurrent reads.
- Atomic increment: two concurrent sends at `limit - 1` remaining — exactly one succeeds, one is skipped; a
  single-threaded sequence of sends stops accepting exactly at the limit.
- Reset: a send after `monthlyResetAt` has passed zeroes the counter and advances `monthlyResetAt` to the next 1st
  before counting that send; a send before the boundary does not reset early.
- Campaign route: `sent + skipped + skippedLimit + errors === contacts.length`; a limit-skipped contact stays
  `PENDING`, not `UNSUBSCRIBED`.
- Action Plan cron: a limit-skipped step stays `PENDING` (not `SKIPPED`) and is re-selected by the cron's own query
  on the next run; a step skipped for a genuinely missing lead email is still marked `SKIPPED` as before —
  unchanged.
- Campaigns page: renders the correct remaining count for both an agent under and at their limit; renders nothing
  extra for `ADMIN`.
- Admin PATCH route: accepts a valid non-negative integer; rejects a negative number, a non-numeric value, and a
  missing agent id (404, matching the existing `title`-only behavior).

## Out of scope

- Notifying the agent proactively that they're near/at their limit (e.g. in the wizard, before they hit Send) —
  explicitly deferred earlier in this conversation because it requires a new client-side fetch on
  `dashboard/campaigns/new/page.tsx`. Revisit if agents are regularly surprised by partial sends.
- Any change to Trigger Automation emails or system notifications — confirmed out of scope for the cap itself.
- Postmark plan upgrade — a separate, already-tracked backlog item. This feature is useful regardless of which
  plan is active; it just matters more once the account is above the Free tier's 100/month ceiling.
- A monthly reset cron — deliberately rejected in favor of the lazy-comparison approach.

## Open items requiring action outside this spec

None — this is fully self-contained. No deploy-day steps, no external service configuration, no waiting on a
third party.
