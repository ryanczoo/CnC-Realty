# AgentId Session Refresh — Design

## Problem

`lib/auth.ts`'s `jwt` callback computes `token.agentId` only once, inside the
`if (user)` branch that runs at sign-in. It is never re-checked afterward. If a
user's linked `Agent` record changes after their session already exists
(promoted to AGENT, relinked, or edited directly via Prisma Studio), their
live session keeps the old `agentId` — including `null` — until they manually
log out and back in. This was confirmed live: an ADMIN account with a valid
`Agent` record in the database still got `404 "Agent not found"` from
`/api/transactions` and `/api/listings`, because the session's cached
`agentId` predated the `Agent` record's creation.

## Decision

Add a periodic, cadence-based re-check inside the existing `jwt` callback:
on every call, if more than `AGENT_ID_REFRESH_INTERVAL_MS` (10 minutes) has
elapsed since `token.agentIdCheckedAt`, re-run the same `Agent` lookup used at
sign-in and update `token.agentId` + `token.agentIdCheckedAt`. Otherwise, skip
the DB call entirely (matching today's zero-query behavior on a fresh token).

This was chosen over two alternatives discussed with Ryan:
- **Re-check on every request** — correct instantly, but reintroduces a DB
  round-trip on every single request, undoing the July 2026 fix this bug sits
  next to.
- **Purely reactive (`trigger === "update"` only)** — zero added cost, but
  doesn't proactively catch drift; only helps if something else happens to
  call `update()`.

The chosen approach bounds the added DB load to roughly one small query per
active user per 10 minutes, regardless of how many requests they make in that
window — negligible next to existing traffic, and fixes real staleness within
minutes instead of requiring a manual logout.

## Implementation

- `token.agentIdCheckedAt: number` (Unix ms) added to the JWT, set alongside
  `token.agentId` in the existing `if (user)` sign-in branch.
- New branch in `jwt()`, evaluated when `user` is absent (i.e. not the
  sign-in call): if `Date.now() - token.agentIdCheckedAt > AGENT_ID_REFRESH_INTERVAL_MS`,
  re-run the `Agent` lookup and update both fields.
- `AGENT_ID_REFRESH_INTERVAL_MS = 10 * 60 * 1000` — a plain constant, no new
  env var or config surface.
- No change to the `trigger === "update"` branch (name refresh) or the
  `session` callback — `agentId` already flows from `token` to `session.user`
  there.

## Testing

- Existing test `"does not re-query the DB on token refresh (no user
  present)"` updated to set a *recent* `agentIdCheckedAt` so it still proves
  the zero-query fast path is intact.
- New tests: re-query fires when `agentIdCheckedAt` is older than the
  interval; `agentIdCheckedAt` itself gets refreshed after a successful
  re-check; sign-in always sets `agentIdCheckedAt` to "now".

## Out of scope

- No change to session/JWT expiration length (`updateAge`/`maxAge`) — this
  fix is about claim freshness within a session, not session lifetime.
- No new database column — everything lives in the JWT itself, nothing is
  persisted server-side beyond the existing `Agent` table already being
  queried.
