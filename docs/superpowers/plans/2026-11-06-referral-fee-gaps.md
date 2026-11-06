# Referral Fee Gaps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A successful referral can't be closed without its fee, and only the broker can set the referral amount received.

**Architecture:** One pure rule, `canCloseReferral`, used by the server (`changeFileStatus`) and by the Admin page's status options. The transactions PATCH accepts `referralAmountReceived` only as part of the admin's move from Referral Successful to Broker Review.

**Tech Stack:** Next.js 14, Prisma 5, Vitest (node, `src/**/*.test.ts`), pnpm, Windows.

**Spec:** decided in chat with Ryan, 2026-11-06. These are the two follow-ups the 2026-11-05 final review raised for
`docs/superpowers/specs/2026-11-05-agent-rules-in-transactions-tab-and-review-fixes-design.md`:
- **Gap 1.** A referral may be Closed only from Referral Broker Review with an amount entered, or from Referral
  Unsuccessful (no money received, no amount needed). The Admin dropdown must not offer Closed otherwise, and the
  server refuses it.
- **Gap 2.** `referralAmountReceived` can be set only by an admin, and only together with the move to Referral Broker
  Review. Once set, no normal save can change it. Anyone else, including an admin in the Agent section (who sends the
  agent-view marker), is refused.

## Global Constraints

- Covers agent AND admin, desktop AND phone. No layout changes, no new UI components. The agent's referral steps
  are unchanged.
- No extra database queries. Use the file each route already loads.
- Exact copy:
  - close refusal: `Enter the referral amount received first` (existing message, reused);
  - amount refusal: `Only the broker can enter the referral amount received`.
- The fee stays `calcReferralFee` in `lib/transaction-helpers.ts` (ICA §7.5: 10% of the amount received or $200,
  whichever is greater).
- Never run the full seed. Never print `.env`. Local and production share one Neon DB. Ask before every push.

## Review Focus

1. **Unsuccessful referral.** Closing still works with no amount (Task 1 test).
2. **Admin in the Agent section.** An amount sent with the agent-view marker is refused (Task 1 test).
3. **Non-referral transactions.** Pending → Closed rules are unchanged (Task 1 test).
4. **Amount after Broker Review.** An admin re-sending an amount on a file already in Broker Review is refused, so
   the fee can't be quietly changed (Task 1 test).

---

### Task 1: Server rules

**Files:** `apps/web/src/lib/transaction-helpers.ts`, `apps/web/src/lib/file-status.ts`,
`apps/web/src/app/api/transactions/[id]/route.ts`; tests in `__tests__/lib/transaction-helpers.test.ts`,
`__tests__/lib/file-status.test.ts`, `__tests__/api/transactions-id.test.ts`.

**Interfaces:** Produces
`export function canCloseReferral(file: { status: string; referralAmountReceived?: number | null }): boolean`.
It returns true when `status === "REFERRAL_UNSUCCESSFUL"`, or when `status === "REFERRAL_BROKER_REVIEW"` and
`referralAmountReceived != null`. Otherwise it returns false.

- `changeFileStatus`: for a transaction file with `transactionSide === "REFERRAL"` and `toStatus === "CLOSED"`, when
  `!canCloseReferral(file)` return the route's existing refusal shape with status 400 and the close-refusal message.
  This applies before any write and for every actor.
- Transactions PATCH. When `body.referralAmountReceived !== undefined`, it is allowed only when all of these hold:
  - `role === "ADMIN"`;
  - `tx.transactionSide === "REFERRAL"`;
  - `tx.status === "REFERRAL_SUCCESSFUL"`;
  - `body.status === "REFERRAL_BROKER_REVIEW"`.

  Otherwise return 403 with the amount-refusal message, before any write. Delete the legacy
  `body.referralAmountReceived !== undefined && { referralAmountReceived: parseFloat(...) }` branch: the amount is
  only ever written from the guarded `referralAmount`. Keep the existing Broker Review amount guard.

**Tests:**
- `canCloseReferral`:
  - Unsuccessful → true;
  - Broker Review with 5000 → true;
  - Broker Review with null → false;
  - Pending → false;
  - Successful → false.
- `changeFileStatus`:
  - referral Pending → Closed by an admin → 400, no update;
  - referral Unsuccessful → Closed → allowed;
  - referral Broker Review with amount → Closed → allowed;
  - a PURCHASE transaction Pending → Closed behaves as before.
- PATCH:
  - an agent sends an amount → 403;
  - an admin with the marker header sends an amount → 403;
  - an admin re-sends an amount on a file already in REFERRAL_BROKER_REVIEW (with or without status) → 403;
  - an admin on REFERRAL_SUCCESSFUL with status REFERRAL_BROKER_REVIEW and "5000" → 200, `referralCncFee` 500;
  - the existing referral lifecycle integration test still passes.

- [ ] TDD: write the tests, watch them fail, implement, watch them pass. Then run the full suite and tsc, and
  commit `fix: referrals close only with their fee; only the broker sets the amount`.

### Task 2: Admin page status options

**Files:** `apps/web/src/lib/transaction-helpers.ts`,
`apps/web/src/app/(dashboard)/admin/transactions/[fileType]/[id]/page.tsx`, `__tests__/lib/transaction-helpers.test.ts`.

**Interfaces:** Consumes `canCloseReferral`. Replace `withoutReferralReview` with
`export function referralAdminStatusOptions(file: { status: string; referralAmountReceived?: number | null }, options: string[]): string[]`.
It always drops `"REFERRAL_BROKER_REVIEW"`, and drops `"CLOSED"` unless `canCloseReferral(file)`. Remove
`withoutReferralReview` and move its test cases over. The Admin page uses the new helper for referral files.

**Tests:**
- Pending options containing CLOSED → no CLOSED;
- Unsuccessful → CLOSED kept;
- Broker Review with an amount → CLOSED kept;
- REFERRAL_BROKER_REVIEW is always dropped;
- other statuses pass through unchanged.

- [ ] TDD, run the touched tests, then the full suite and tsc. Commit `fix: admin referral status options follow the fee rule`.

### Task 3: Verify

- [ ] Full suite, `tsc --noEmit`, and a clean production build (no dev server running).
- [ ] Targeted speed check, old (plan BASE) vs new. Agent and Admin file pages for Foster Road
  (`cmvivu9290001n3iejhf2jtap`), 1440×900 and 390×844, 3 runs each, numeric only. Pass: not slower beyond noise.
- [ ] No DB writes needed: there is no referral file, and unit tests cover the rules.
