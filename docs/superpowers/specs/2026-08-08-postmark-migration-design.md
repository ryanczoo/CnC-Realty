# Postmark Migration — Design

**Date:** 2026-08-08
**Status:** Approved, ready for implementation planning

## Problem

SendGrid's default shared IP pool is intermittently blocklisted by third-party
reputation services because of other customers' traffic. Real bounces were
observed against `ryanchong@cncrealtygroup.com`:

```
550 5.7.1 Service unavailable; client [...] blocked using rep.mailspike.net
```

CnC's own account has zero spam reports — this is a property of the shared pool,
not of our sending. The SendGrid Essentials upgrade that was already planned
would not have fixed it: Essentials is still shared-IP, and a dedicated IP is a
separate $30–90/mo add-on.

Postmark separates transactional from broadcast traffic at the IP level, which
is the specific structural difference that addresses this.

## Goals

- Remove SendGrid from the codebase entirely.
- Route transactional and commercial email onto separate Postmark Message
  Streams so marketing volume can never affect delivery of account, application,
  and transaction email.
- Ship a working unsubscribe mechanism. None exists today, which is both a
  CAN-SPAM gap and a hard requirement of Postmark's Broadcast streams.

## Non-goals

- Changing any email's content, layout, or copy. `emailLayout()` and the
  existing templates stay exactly as they are.
- Rewriting the campaign, drip, or property-alert features. Only their delivery
  path changes.
- Building a preference centre. A single opt-out flag is sufficient and is what
  the law requires; granular per-category preferences are a later project.

## Current state

Explored 2026-08-08. 24 files reference SendGrid.

- **No send abstraction exists.** `lib/email.ts`, `lib/deadline-email.ts`,
  `lib/action-plan-email.ts`, `lib/email/property-alert-email.ts`, and
  `lib/email/transaction-emails.ts` each `import sgMail` and call
  `sgMail.send()` directly, as do several route handlers.
- **~11 test files assert on SendGrid's payload shape**
  (`vi.mocked(sgMail.send).mock.calls[0][0]`). They verify the vendor's message
  format rather than our intent, which is what makes a direct swap expensive.
- **No unsubscribe mechanism anywhere in `src`.** The only occurrence of the
  word is in the privacy policy, describing one that does not exist.
- Event webhook verification uses ECDSA via `@sendgrid/eventwebhook`
  (`app/api/webhooks/sendgrid/verify.ts`). Postmark uses HTTP Basic Auth.
- Inbound uses SendGrid Parse, which posts multipart form data. Postmark posts
  JSON.
- `app/(marketing)/privacy/page.tsx` names SendGrid as a subprocessor.

## Verified about Postmark

Read from the live site and Ryan's dashboard on 2026-08-08, not assumed:

- *"transactional and broadcast traffic do not mix in Postmark, including IP
  ranges."*
- Default transactional stream ID is **`outbound`**. Broadcast and Inbound
  streams exist per server alongside it.
- Each stream has a built-in **Suppressions** list.
- Dedicated IPs require 300,000+ emails/month, so this is a shared-IP decision
  either way. Postmark's own guidance is that well-managed shared IPs are
  preferable for small and mid-size senders, because ISPs weight *domain*
  reputation more heavily. CnC's SPF/DKIM/DMARC are already configured.
- Free tier lacks **Bulk API** and **Inbound**. Pro ($16.50/mo) at launch.
- New accounts are in **Test mode** pending manual approval: 100 emails, only to
  verified domains. **Inbound processing has no domain restriction**, so the
  inbound path is testable before approval.
- ⚠️ Postmark is owned by **ActiveCampaign**, a marketing-email company. The
  separation policy holds today; worth re-checking periodically.

## Approach

Build an internal send seam first, then swap the vendor behind it. Four ordered
steps, each ending with a green test suite.

The seam is not speculative future-proofing. Two things we have already
committed to require a single choke point: Postmark's per-send `MessageStream`,
and the opt-out suppression check. Without one, both get duplicated across five
libraries and several routes, and eventually one gets missed — producing either
marketing on the transactional stream or mail to someone who unsubscribed.

Rejected alternatives:

- **Direct swap.** Fewer steps, but no green intermediate state, tests stay
  coupled to a vendor, and stream/suppression logic scatters.
- **Runtime provider switch.** Enables rollback, but SendGrid is being removed
  and the site is not launched, so there is no live traffic to roll back.

## Components

### `lib/email/send.ts` — the send seam

```ts
export type MessageStream = "transactional" | "broadcast";

export interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;        // derived via htmlToPlainText() when omitted
  replyTo?: string;
  attachments?: { filename: string; content: string; contentType: string }[];
  stream: MessageStream;   // required
}

export async function sendEmail(opts: SendOptions): Promise<void>;
```

Owns: the Postmark client, the `FROM` address, plain-text derivation, mapping
`stream` to a Postmark stream ID, and the opt-out check.

Does not own: content. The five existing libraries keep building HTML with
`emailLayout()` and hand the result to `sendEmail()`.

`stream` is **required** rather than defaulted. Both defaults are unsafe:
default-transactional puts a forgotten marketing email on the transactional
reputation; default-broadcast risks a password reset being suppressed by an
opt-out. Requiring it makes the compiler reject any call site that has not
decided.

`sendEmail` throws on failure, matching `sgMail.send()`, so callers' existing
try/catch behaviour is unchanged.

### Stream assignment

| Transactional | Broadcast |
|---|---|
| Agent application received / approved / rejected | Marketing campaigns |
| Account setup, password reset | Drip / action-plan sequences |
| Transaction file status, document approved/rejected | Property alerts |
| Contract deadline reminders | |
| Lead assignment to agent | |
| Contact-form notification to the brokerage | |

Property alerts and drip sequences are classed as broadcast deliberately: they
are recurring commercial content a recipient may mark as spam, and must not be
able to contaminate transactional deliverability.

### Unsubscribe

Built to the standard bulk senders actually use, not invented.

**Storage.** `emailOptOut Boolean @default(false)` on **`Lead`** and **`User`**.
Campaigns and drips target Leads; property alerts target Users with saved
searches. This migration touches neither the `Property` table nor the machine
running the IDX resync, so it is safe under the active resync constraint.

The same migration must add **`@@index([email])` to `Lead`**. `User.email` is
already `@unique` and therefore indexed, but `Lead.email` is a plain `String`
with no index — its only indexes are `agentId`, `status`, `createdAt`, and
`agentId, createdAt`. Without this, the per-send suppression lookup below would
be a sequential scan on every broadcast recipient.

**Token.** An HMAC of recipient type and id signed with `NEXTAUTH_SECRET`.
Stateless — no token table, nothing to expire, not guessable.

**Routes.**

- `GET /unsubscribe?t=<token>` — renders a confirmation page. **Mutates
  nothing.** Gmail's image proxy, corporate security scanners, and link-preview
  bots all fetch URLs found in email; a mutating GET would silently opt out
  people who never clicked.
- `POST /unsubscribe` — verifies the token and sets the flag.

**Headers on every broadcast send.**

```
List-Unsubscribe: <https://cncrealtygroup.com/unsubscribe?t=TOKEN>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

RFC 2369 and RFC 8058. Gmail and Yahoo have required one-click unsubscribe of
bulk senders since February 2024. CnC is below the 5,000/day threshold that
triggers enforcement, but this is standard practice and materially helps
deliverability. A visible unsubscribe link also goes in the broadcast email
footer; the header alone is not sufficient.

**HTTPS only, no `mailto:` variant.** The Hostinger mailbox is
`ryanchong@cncrealtygroup.com` with aliases `info@` and `noreply@` — there is no
`unsubscribe@` address, and adding one would create a mailbox nobody processes,
so unsubscribe requests sent there would be silently ignored while the header
advertised them as valid. RFC 8058 one-click uses the HTTPS URL, so omitting
`mailto:` is fully compliant. A `mailto:` variant can be added later if it is
backed by automated handling.

**Suppression check** lives inside `sendEmail`, on broadcast sends only: one
indexed lookup by email address per send. Slightly redundant for a large
campaign, but it makes emailing an opted-out recipient structurally impossible,
which is the guarantee worth paying for. Callers may filter in bulk later as an
optimisation; this is the backstop.

**Opt-out never suppresses transactional mail.** Password resets and application
decisions still send. This is correct and legally sound — CAN-SPAM governs
commercial email.

Postmark's own per-stream Suppressions list acts as a second layer, but CnC
keeps its own flag so the CRM can display opt-out state and so compliance does
not depend on the vendor.

### Event webhook

`app/api/webhooks/postmark/route.ts` replaces the SendGrid route. Postmark
authenticates webhooks with HTTP Basic Auth on the endpoint URL, so
`webhooks/sendgrid/verify.ts` and the `@sendgrid/eventwebhook` dependency are
both deleted. Events map to the same `CampaignContact` open/click/bounce
updates as today.

### Inbound

`app/api/webhooks/postmark/inbound/route.ts` replaces the SendGrid Parse route.
Payload parsing changes from multipart form data to JSON; the action-plan reply
logic is unchanged.

## Migration order

Each step ends with the full suite green.

1. Add `sendEmail()` with SendGrid underneath. No callers change.
2. Move all libraries, route call sites, and their tests onto it. Tests assert
   intent — recipient, subject, attachments, stream — rather than a vendor
   payload shape. Behaviour identical.
3. Swap the body of `send.ts` to Postmark. One file changes. If anything breaks
   here, it is the vendor swap and nothing else.
4. Unsubscribe: schema migration, token helpers, routes, headers, suppression.
5. Webhook and inbound swap.
6. Remove `@sendgrid/*` dependencies; update the privacy policy's subprocessor
   list to name Postmark/ActiveCampaign.

Test-driven throughout, per step.

## Testing

- **Unit** — no Postmark account required; the client is mocked. Covers stream
  selection, plain-text derivation, opt-out suppression, token
  generation/verification, and header construction.
- **Route** — unsubscribe GET does not mutate; POST does; an invalid or tampered
  token is rejected.
- **Live, pre-approval** — transactional sends to verified `cncrealtygroup.com`
  addresses (100-email test-mode cap), and inbound, which has no domain
  restriction.
- **Live, post-approval and post-deploy** — broadcast sends, the event webhook,
  and the full inbound round trip.

## Deploy-time configuration

Config, not code. Neither blocks removing SendGrid from the codebase.

1. Point the Postmark event webhook at the deployed
   `/api/webhooks/postmark` URL.
2. Repoint the `reply.cncrealtygroup.com` MX record off `mx.sendgrid.net` to
   Postmark's inbound address.
3. Add `POSTMARK_SERVER_TOKEN` to Vercel; remove `SENDGRID_API_KEY`.
4. Upgrade Postmark to Pro before launch, for Bulk API and Inbound.

## Risks

- **Account approval is a gate.** Submitted 2026-08-08; Postmark quotes 24 hours
  or the next business day. Until approved, sending is limited to 100 emails to
  verified domains.
- **Broadcast sends cannot be fully verified until deployed**, since the webhook
  needs a public URL. Unit tests cover the code; the live path is a launch-day
  check.
- **Postmark's ActiveCampaign ownership** is a long-horizon consideration for
  the transactional/broadcast separation that motivated this choice.
