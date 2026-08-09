# Postmark Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SendGrid with Postmark everywhere, routing transactional and commercial email onto separate Message Streams, and ship a working unsubscribe mechanism.

**Architecture:** Introduce a single send seam (`lib/email/send.ts`) that every caller uses, migrate all call sites to it while SendGrid is still underneath (suite stays green), then swap the seam's body to Postmark in one file. Unsubscribe, webhooks, and inbound follow on top of that choke point.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma/Postgres (Neon), Vitest, `postmark` npm package.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-08-08-postmark-migration-design.md`. Read it first.
- **Do NOT run `prisma migrate` until the IDX resync on the parent's desktop has finished.** Tasks 6+ are blocked on that. Check with `node packages/database/check-count.mjs` — `checkpoint: NONE` means done.
- **Never modify the `Property` table.** The running crawl depends on its current schema.
- Run tests with `pnpm --filter web test -- <path>`. Full suite: `pnpm --filter web test`.
- Typecheck with `cd apps/web && npx tsc --noEmit`. Must stay clean.
- Postmark transactional stream ID is **`outbound`**. The broadcast stream ID must be read from the Postmark dashboard (Servers → My First Server → Broadcasts) — do not guess it.
- Email content, layout, and copy must not change. `emailLayout()` and all templates stay as-is.
- Opt-out must never suppress transactional email.
- Secrets go in `apps/web/.env.local`, never committed.

---

### Task 1: Add the send seam, backed by SendGrid

**Files:**
- Create: `apps/web/src/lib/email/send.ts`
- Test: `apps/web/src/__tests__/lib/email/send.test.ts`

**Interfaces:**
- Consumes: `htmlToPlainText`, `FROM` from `@/lib/email`
- Produces: `sendEmail(opts: SendOptions): Promise<void>`, `type MessageStream = "transactional" | "broadcast"`, `interface SendOptions`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/__tests__/lib/email/send.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sendgrid/mail", () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue(undefined) },
}));

import sgMail from "@sendgrid/mail";
import { sendEmail } from "@/lib/email/send";

describe("sendEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends to the recipient with the given subject and html", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>Hello</p>",
      stream: "transactional",
    });

    expect(sgMail.send).toHaveBeenCalledOnce();
    const msg = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(msg.to).toBe("a@b.com");
    expect(msg.subject).toBe("Hi");
    expect(msg.html).toBe("<p>Hello</p>");
  });

  it("derives a plain-text part from the html when text is omitted", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>Hello <a href='https://x.com'>link</a></p>",
      stream: "transactional",
    });

    const msg = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(msg.text).toContain("Hello");
    expect(msg.text).not.toContain("<p>");
  });

  it("uses the caller's text part when one is given", async () => {
    await sendEmail({
      to: "a@b.com", subject: "Hi", html: "<p>x</p>", text: "custom", stream: "transactional",
    });

    const msg = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(msg.text).toBe("custom");
  });

  it("passes replyTo and attachments through", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>x</p>",
      replyTo: "reply@b.com",
      attachments: [{ filename: "w9.pdf", content: "BASE64", contentType: "application/pdf" }],
      stream: "transactional",
    });

    const msg = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(msg.replyTo).toBe("reply@b.com");
    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments[0].filename).toBe("w9.pdf");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/__tests__/lib/email/send.test.ts`
Expected: FAIL — cannot resolve `@/lib/email/send`

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/email/send.ts
import sgMail from "@sendgrid/mail";
import { FROM, htmlToPlainText } from "@/lib/email";

export type MessageStream = "transactional" | "broadcast";

export interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: { filename: string; content: string; contentType: string }[];
  stream: MessageStream;
}

// The single place the app talks to an email vendor. Callers build content;
// this owns FROM, the plain-text part, stream routing, and (later) opt-out
// suppression. `stream` is required so no call site can forget to choose.
export async function sendEmail(opts: SendOptions): Promise<void> {
  await sgMail.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? htmlToPlainText(opts.html),
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    ...(opts.attachments
      ? {
          attachments: opts.attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            type: a.contentType,
            disposition: "attachment",
          })),
        }
      : {}),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/__tests__/lib/email/send.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/email/send.ts apps/web/src/__tests__/lib/email/send.test.ts
git commit -m "feat: add sendEmail seam, still backed by SendGrid"
```

---

### Task 2: Move `lib/email.ts` onto the seam

**Files:**
- Modify: `apps/web/src/lib/email.ts`
- Modify: `apps/web/src/__tests__/lib/email.test.ts`

**Interfaces:**
- Consumes: `sendEmail` from Task 1
- Produces: no signature changes — all exported functions keep their names and parameters

- [ ] **Step 1: Rewrite the test assertions to target the seam**

Replace the `vi.mock("@sendgrid/mail", ...)` block and every `sgMail.send` assertion. Example transformation — apply the same shape to every test in the file:

```ts
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { sendEmail } from "@/lib/email/send";

// before: const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;
//         expect(call.to).toBe("x@y.com");
// after:
const call = vi.mocked(sendEmail).mock.calls[0][0];
expect(call.to).toBe("x@y.com");
expect(call.stream).toBe("transactional");
```

Every existing assertion about `to`, `subject`, `html`, and `attachments` carries over unchanged. Add `expect(call.stream).toBe("transactional")` to each — every function in this file is transactional.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- src/__tests__/lib/email.test.ts`
Expected: FAIL — `sendEmail` never called, because `lib/email.ts` still calls `sgMail.send`

- [ ] **Step 3: Replace every `sgMail.send(...)` call in `lib/email.ts`**

For each send, swap the SendGrid message object for a `sendEmail` call:

```ts
// before
await sgMail.send({ from: FROM, to, subject, html, text: htmlToPlainText(html) });

// after
await sendEmail({ to, subject, html, stream: "transactional" });
```

For `sendApprovalDocuments`, which has attachments:

```ts
await sendEmail({
  to,
  subject,
  html,
  replyTo: NOTIFY,
  attachments: [
    { filename: "w9-blank.pdf", content: w9Base64, contentType: "application/pdf" },
    { filename: "cnc-office-policy-manual.pdf", content: manualBase64, contentType: "application/pdf" },
  ],
  stream: "transactional",
});
```

Add `import { sendEmail } from "@/lib/email/send";`. Remove the `import sgMail from "@sendgrid/mail";` line and the `sgMail.setApiKey(...)` block — that now lives in `send.ts`. Keep `FROM`, `NOTIFY`, `escapeHtml`, `htmlToPlainText`, and `emailLayout` exported; other modules import them.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- src/__tests__/lib/email.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/email.ts apps/web/src/__tests__/lib/email.test.ts
git commit -m "refactor: move lib/email.ts onto the sendEmail seam"
```

---

### Task 3: Move the four remaining email libraries onto the seam

**Files:**
- Modify: `apps/web/src/lib/deadline-email.ts`, `apps/web/src/lib/action-plan-email.ts`, `apps/web/src/lib/email/property-alert-email.ts`, `apps/web/src/lib/email/transaction-emails.ts`
- Modify: their four test files under `apps/web/src/__tests__/lib/`

**Interfaces:**
- Consumes: `sendEmail` from Task 1
- Produces: no signature changes

**Stream assignment for this task** — from the spec:

| File | Stream |
|---|---|
| `deadline-email.ts` | `transactional` |
| `transaction-emails.ts` | `transactional` |
| `action-plan-email.ts` | `broadcast` |
| `email/property-alert-email.ts` | `broadcast` |

- [ ] **Step 1: Rewrite each test file's mock and assertions**

Apply the Task 2 transformation to all four files: replace the `@sendgrid/mail` mock with `vi.mock("@/lib/email/send", ...)`, change `vi.mocked(sgMail.send).mock.calls[0][0]` to `vi.mocked(sendEmail).mock.calls[0][0]`, and add a `stream` assertion using the table above.

- [ ] **Step 2: Run the four test files to verify they fail**

Run: `pnpm --filter web test -- src/__tests__/lib/deadline-email.test.ts src/__tests__/lib/action-plan-email.test.ts src/__tests__/lib/property-alert-email.test.ts src/__tests__/lib/transaction-emails.test.ts`
Expected: FAIL in all four — `sendEmail` not called

- [ ] **Step 3: Replace `sgMail.send` in each of the four libraries**

Same swap as Task 2, passing the stream from the table. Remove each file's `import sgMail from "@sendgrid/mail";`.

- [ ] **Step 4: Run the four test files to verify they pass**

Run the same command as Step 2.
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib apps/web/src/__tests__/lib
git commit -m "refactor: move remaining email libraries onto the sendEmail seam"
```

---

### Task 4: Move route call sites onto the seam

**Files:**
- Modify: `apps/web/src/app/api/campaigns/[id]/send/route.ts`, `apps/web/src/app/api/leads/[id]/route.ts`, `apps/web/src/app/api/admin/leads/[id]/assign/route.ts`
- Modify: `apps/web/src/__tests__/api/campaigns-send.test.ts`, `apps/web/src/__tests__/api/triggers.test.ts`, `apps/web/src/__tests__/api/admin-leads-assign.test.ts`, `apps/web/src/__tests__/api/lead-pool.test.ts`, `apps/web/src/__tests__/api/cron-action-plans.test.ts`

**Interfaces:**
- Consumes: `sendEmail` from Task 1
- Produces: no signature changes

**Stream assignment:** campaign sends are `broadcast`. Lead-assignment and trigger notification emails are `transactional`.

- [ ] **Step 1: Rewrite the mocks and assertions in all five test files**

Same transformation as Task 2. In `campaigns-send.test.ts`, assert `expect(call.stream).toBe("broadcast")`.

- [ ] **Step 2: Run the five test files to verify they fail**

Run: `pnpm --filter web test -- src/__tests__/api/campaigns-send.test.ts src/__tests__/api/triggers.test.ts src/__tests__/api/admin-leads-assign.test.ts src/__tests__/api/lead-pool.test.ts src/__tests__/api/cron-action-plans.test.ts`
Expected: FAIL

- [ ] **Step 3: Replace `sgMail.send` in the three route files**

Same swap. The campaign send route batches with `Promise.allSettled` — keep that structure, only replace the per-recipient send call.

- [ ] **Step 4: Run the full suite**

Run: `pnpm --filter web test`
Expected: PASS, all files. Then `cd apps/web && npx tsc --noEmit` — clean.

- [ ] **Step 5: Verify no direct vendor usage remains outside the seam**

Run: `grep -rn "@sendgrid/mail" apps/web/src --include=*.ts --include=*.tsx`
Expected: only `apps/web/src/lib/email/send.ts` and `apps/web/src/__tests__/lib/email/send.test.ts`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "refactor: move route email call sites onto the sendEmail seam"
```

---

### Task 5: Swap the seam's body to Postmark

**Files:**
- Modify: `apps/web/src/lib/email/send.ts`
- Modify: `apps/web/src/__tests__/lib/email/send.test.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/.env.local` (local only, not committed)

**Interfaces:**
- Consumes: nothing new
- Produces: `sendEmail` signature unchanged — this is why only this file changes

**Prerequisite:** read the broadcast stream ID from the Postmark dashboard (Servers → My First Server → Broadcasts). The transactional stream ID is `outbound`.

- [ ] **Step 1: Install the SDK**

```bash
pnpm --filter web add postmark
pnpm --filter web remove @sendgrid/mail
```

Add to `apps/web/.env.local`:
```
POSTMARK_SERVER_TOKEN=<server token from Postmark dashboard>
POSTMARK_BROADCAST_STREAM=<broadcast stream id from dashboard>
```

- [ ] **Step 2: Rewrite the test to mock Postmark**

```ts
const sendEmailMock = vi.fn().mockResolvedValue({ MessageID: "x" });
vi.mock("postmark", () => ({
  ServerClient: vi.fn().mockImplementation(() => ({ sendEmail: sendEmailMock })),
}));

import { sendEmail } from "@/lib/email/send";

it("routes a transactional send to the outbound stream", async () => {
  await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "transactional" });

  const msg = sendEmailMock.mock.calls[0][0];
  expect(msg.To).toBe("a@b.com");
  expect(msg.Subject).toBe("Hi");
  expect(msg.HtmlBody).toBe("<p>x</p>");
  expect(msg.MessageStream).toBe("outbound");
});

it("routes a broadcast send to the broadcast stream", async () => {
  await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "broadcast" });

  expect(sendEmailMock.mock.calls[0][0].MessageStream).toBe(process.env.POSTMARK_BROADCAST_STREAM);
});

it("maps attachments to Postmark's Name/Content/ContentType shape", async () => {
  await sendEmail({
    to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "transactional",
    attachments: [{ filename: "w9.pdf", content: "BASE64", contentType: "application/pdf" }],
  });

  expect(sendEmailMock.mock.calls[0][0].Attachments).toEqual([
    { Name: "w9.pdf", Content: "BASE64", ContentType: "application/pdf" },
  ]);
});
```

Keep the existing plain-text-derivation and replyTo tests, updating field names to `TextBody` and `ReplyTo`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter web test -- src/__tests__/lib/email/send.test.ts`
Expected: FAIL — still calling SendGrid

- [ ] **Step 4: Swap the implementation**

```ts
import { ServerClient } from "postmark";
import { FROM, htmlToPlainText } from "@/lib/email";

const TRANSACTIONAL_STREAM = "outbound";

let client: ServerClient | null = null;
function getClient(): ServerClient {
  if (!client) {
    const token = process.env.POSTMARK_SERVER_TOKEN;
    if (!token) throw new Error("POSTMARK_SERVER_TOKEN is not set");
    client = new ServerClient(token);
  }
  return client;
}

export async function sendEmail(opts: SendOptions): Promise<void> {
  await getClient().sendEmail({
    From: `${FROM.name} <${FROM.email}>`,
    To: opts.to,
    Subject: opts.subject,
    HtmlBody: opts.html,
    TextBody: opts.text ?? htmlToPlainText(opts.html),
    MessageStream:
      opts.stream === "broadcast"
        ? process.env.POSTMARK_BROADCAST_STREAM!
        : TRANSACTIONAL_STREAM,
    ...(opts.replyTo ? { ReplyTo: opts.replyTo } : {}),
    ...(opts.attachments
      ? {
          Attachments: opts.attachments.map((a) => ({
            Name: a.filename,
            Content: a.content,
            ContentType: a.contentType,
          })),
        }
      : {}),
  });
}
```

Keep the `SendOptions` and `MessageStream` type declarations from Task 1 unchanged.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `pnpm --filter web test` then `cd apps/web && npx tsc --noEmit`
Expected: PASS, clean. No other test file should need changing — that is the point of the seam.

- [ ] **Step 6: Live smoke test (test mode allows sends to verified domains)**

```bash
node -e "const {ServerClient}=require('postmark');new ServerClient(process.env.POSTMARK_SERVER_TOKEN).sendEmail({From:'noreply@cncrealtygroup.com',To:'ryanchong@cncrealtygroup.com',Subject:'Postmark seam smoke test',HtmlBody:'<p>ok</p>',TextBody:'ok',MessageStream:'outbound'}).then(r=>console.log(r.MessageID))"
```

Expected: a MessageID, and the email arrives.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/email/send.ts apps/web/src/__tests__/lib/email/send.test.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat: swap the send seam from SendGrid to Postmark"
```

---

### Task 6: Add opt-out storage

**BLOCKED until the IDX resync finishes.** Verify with `node packages/database/check-count.mjs` showing `checkpoint: NONE`.

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: migration under `packages/database/prisma/migrations/`

**Interfaces:**
- Produces: `Lead.emailOptOut: boolean`, `User.emailOptOut: boolean`, index on `Lead.email`

- [ ] **Step 1: Edit the schema**

Add to `model Lead`:
```prisma
  emailOptOut Boolean @default(false)
```
and add to its index block:
```prisma
  @@index([email])
```

Add to `model User`:
```prisma
  emailOptOut Boolean @default(false)
```

`User.email` is already `@unique` and therefore indexed — do not add a second index.

- [ ] **Step 2: Generate and apply the migration**

```bash
pnpm --filter @cnc/database exec prisma migrate dev --name add_email_opt_out
```

If `prisma generate` fails with EPERM on Windows, stop all node processes, run `pnpm --filter @cnc/database exec prisma generate`, then restart.

- [ ] **Step 3: Verify the columns exist**

```bash
pnpm --filter @cnc/database exec prisma studio
```
Confirm `emailOptOut` on both `Lead` and `User`, defaulting to `false`.

- [ ] **Step 4: Run the full suite and typecheck**

Run: `pnpm --filter web test` then `cd apps/web && npx tsc --noEmit`
Expected: PASS, clean

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma
git commit -m "feat: add emailOptOut to Lead and User, index Lead.email"
```

---

### Task 7: Unsubscribe token helpers

**Files:**
- Create: `apps/web/src/lib/email/unsubscribe.ts`
- Test: `apps/web/src/__tests__/lib/email/unsubscribe.test.ts`

**Interfaces:**
- Produces: `makeUnsubscribeToken(kind: "lead" | "user", id: string): string`, `verifyUnsubscribeToken(token: string): { kind: "lead" | "user"; id: string } | null`, `unsubscribeUrl(kind, id): string`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { makeUnsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl } from "@/lib/email/unsubscribe";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret";
  process.env.NEXTAUTH_URL = "https://cncrealtygroup.com";
});

describe("unsubscribe tokens", () => {
  it("round-trips a lead token", () => {
    const t = makeUnsubscribeToken("lead", "lead_123");
    expect(verifyUnsubscribeToken(t)).toEqual({ kind: "lead", id: "lead_123" });
  });

  it("round-trips a user token", () => {
    const t = makeUnsubscribeToken("user", "user_456");
    expect(verifyUnsubscribeToken(t)).toEqual({ kind: "user", id: "user_456" });
  });

  it("rejects a tampered token", () => {
    const t = makeUnsubscribeToken("lead", "lead_123");
    expect(verifyUnsubscribeToken(t.slice(0, -1) + "0")).toBeNull();
  });

  it("rejects a token whose payload was swapped", () => {
    const a = makeUnsubscribeToken("lead", "lead_123");
    const b = makeUnsubscribeToken("lead", "lead_999");
    const forged = a.split(".")[0] + "." + b.split(".")[1];
    expect(verifyUnsubscribeToken(forged)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifyUnsubscribeToken("garbage")).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
  });

  it("builds an absolute unsubscribe url", () => {
    expect(unsubscribeUrl("lead", "lead_123")).toMatch(
      /^https:\/\/cncrealtygroup\.com\/unsubscribe\?t=/
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/__tests__/lib/email/unsubscribe.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/email/unsubscribe.ts
import { createHmac, timingSafeEqual } from "crypto";

export type OptOutKind = "lead" | "user";

function sign(payload: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function makeUnsubscribeToken(kind: OptOutKind, id: string): string {
  const payload = Buffer.from(`${kind}:${id}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(token: string): { kind: OptOutKind; id: string } | null {
  const [payload, sig] = (token ?? "").split(".");
  if (!payload || !sig) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  const [kind, ...rest] = Buffer.from(payload, "base64url").toString().split(":");
  const id = rest.join(":");
  if ((kind !== "lead" && kind !== "user") || !id) return null;
  return { kind, id };
}

export function unsubscribeUrl(kind: OptOutKind, id: string): string {
  return `${process.env.NEXTAUTH_URL}/unsubscribe?t=${makeUnsubscribeToken(kind, id)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/__tests__/lib/email/unsubscribe.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/email/unsubscribe.ts apps/web/src/__tests__/lib/email/unsubscribe.test.ts
git commit -m "feat: add signed unsubscribe token helpers"
```

---

### Task 8: Unsubscribe routes

**Files:**
- Create: `apps/web/src/app/api/unsubscribe/route.ts`
- Create: `apps/web/src/app/(marketing)/unsubscribe/page.tsx`
- Test: `apps/web/src/__tests__/api/unsubscribe.test.ts`

**Interfaces:**
- Consumes: `verifyUnsubscribeToken` from Task 7; `Lead.emailOptOut` / `User.emailOptOut` from Task 6
- Produces: `POST /api/unsubscribe`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { update: vi.fn() }, user: { update: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { makeUnsubscribeToken } from "@/lib/email/unsubscribe";
import { POST } from "../../app/api/unsubscribe/route";

function req(token: string) {
  return new Request("http://localhost/api/unsubscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

describe("POST /api/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_SECRET = "test-secret";
  });

  it("sets emailOptOut on a lead", async () => {
    const res = await POST(req(makeUnsubscribeToken("lead", "lead_1")));
    expect(res.status).toBe(200);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead_1" },
      data: { emailOptOut: true },
    });
  });

  it("sets emailOptOut on a user", async () => {
    const res = await POST(req(makeUnsubscribeToken("user", "user_1")));
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { emailOptOut: true },
    });
  });

  it("rejects an invalid token without touching the database", async () => {
    const res = await POST(req("garbage"));
    expect(res.status).toBe(400);
    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/__tests__/api/unsubscribe.test.ts`
Expected: FAIL — route module not found

- [ ] **Step 3: Write the route**

```ts
// apps/web/src/app/api/unsubscribe/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

export async function POST(req: Request) {
  let token = "";
  try {
    token = (await req.json())?.token ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const claim = verifyUnsubscribeToken(token);
  if (!claim) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  if (claim.kind === "lead") {
    await prisma.lead.update({ where: { id: claim.id }, data: { emailOptOut: true } });
  } else {
    await prisma.user.update({ where: { id: claim.id }, data: { emailOptOut: true } });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/__tests__/api/unsubscribe.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Add the confirmation page**

```tsx
// apps/web/src/app/(marketing)/unsubscribe/page.tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

export default function UnsubscribePage() {
  const token = useSearchParams().get("t") ?? "";
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  // Deliberately does NOT unsubscribe on load. Mail scanners and link
  // preview bots fetch URLs found in email; a mutating GET would opt out
  // people who never clicked.
  async function confirm() {
    setState("sending");
    const res = await fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setState(res.ok ? "done" : "error");
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-cnc-bg px-6">
      <div className="max-w-md text-center">
        {state === "done" ? (
          <>
            <h1 className="font-sans text-[2rem] font-light text-[#1B1B1B]">You&apos;re unsubscribed</h1>
            <p className="mt-4 text-[#1B1B1B]/70">
              You won&apos;t receive marketing emails from CnC Realty. You&apos;ll still get
              messages about your account and any active transactions.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-sans text-[2rem] font-light text-[#1B1B1B]">Unsubscribe</h1>
            <p className="mt-4 text-[#1B1B1B]/70">
              Stop receiving marketing emails from CnC Realty?
            </p>
            {state === "error" && (
              <p className="mt-4 text-sm text-red-600">
                That link is invalid or expired. Please use the link from a recent email.
              </p>
            )}
            <motion.button
              type="button"
              onClick={confirm}
              disabled={!token || state === "sending"}
              animate={PULSE_ANIMATE}
              transition={PULSE_TRANSITION}
              whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
              className="mt-8 rounded-full bg-[#1B1B1B] px-7 py-3.5 text-white disabled:opacity-50"
            >
              {state === "sending" ? "Unsubscribing…" : "Unsubscribe"}
            </motion.button>
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Verify the page does not mutate on GET**

Start the dev server, open `/unsubscribe?t=<a token you generate in node>`, and confirm in Prisma Studio that `emailOptOut` is still `false` until the button is clicked.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/unsubscribe apps/web/src/app/\(marketing\)/unsubscribe apps/web/src/__tests__/api/unsubscribe.test.ts
git commit -m "feat: add unsubscribe confirmation page and POST endpoint"
```

---

### Task 9: Wire suppression and headers into the seam

**Files:**
- Modify: `apps/web/src/lib/email/send.ts`
- Modify: `apps/web/src/__tests__/lib/email/send.test.ts`

**Interfaces:**
- Consumes: `unsubscribeUrl` from Task 7; `emailOptOut` from Task 6
- Produces: `SendOptions` gains `recipient?: { kind: "lead" | "user"; id: string }`

- [ ] **Step 1: Write the failing tests**

```ts
it("does not send a broadcast to an opted-out recipient", async () => {
  vi.mocked(prisma.lead.findUnique).mockResolvedValue({ emailOptOut: true } as any);

  await sendEmail({
    to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "broadcast",
    recipient: { kind: "lead", id: "lead_1" },
  });

  expect(sendEmailMock).not.toHaveBeenCalled();
});

it("still sends transactional mail to an opted-out recipient", async () => {
  vi.mocked(prisma.lead.findUnique).mockResolvedValue({ emailOptOut: true } as any);

  await sendEmail({
    to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "transactional",
    recipient: { kind: "lead", id: "lead_1" },
  });

  expect(sendEmailMock).toHaveBeenCalledOnce();
});

it("adds one-click unsubscribe headers to broadcast sends", async () => {
  vi.mocked(prisma.lead.findUnique).mockResolvedValue({ emailOptOut: false } as any);

  await sendEmail({
    to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "broadcast",
    recipient: { kind: "lead", id: "lead_1" },
  });

  const headers = sendEmailMock.mock.calls[0][0].Headers;
  expect(headers).toContainEqual(
    expect.objectContaining({ Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" })
  );
  expect(headers.find((h: any) => h.Name === "List-Unsubscribe").Value).toContain("/unsubscribe?t=");
});

it("adds no unsubscribe headers to transactional sends", async () => {
  await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "transactional" });
  expect(sendEmailMock.mock.calls[0][0].Headers).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- src/__tests__/lib/email/send.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
async function isOptedOut(recipient: SendOptions["recipient"]): Promise<boolean> {
  if (!recipient) return false;
  const row =
    recipient.kind === "lead"
      ? await prisma.lead.findUnique({ where: { id: recipient.id }, select: { emailOptOut: true } })
      : await prisma.user.findUnique({ where: { id: recipient.id }, select: { emailOptOut: true } });
  return row?.emailOptOut === true;
}
```

In `sendEmail`, before building the message:

```ts
if (opts.stream === "broadcast" && (await isOptedOut(opts.recipient))) return;
```

And when `stream === "broadcast"` and `opts.recipient` is present, add:

```ts
Headers: [
  { Name: "List-Unsubscribe", Value: `<${unsubscribeUrl(opts.recipient.kind, opts.recipient.id)}>` },
  { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
],
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- src/__tests__/lib/email/send.test.ts`
Expected: PASS

- [ ] **Step 5: Pass `recipient` from the three broadcast call sites**

In `action-plan-email.ts` and the campaign send route, pass `recipient: { kind: "lead", id: lead.id }`. In `property-alert-email.ts`, pass `recipient: { kind: "user", id: user.id }`. Add a footer unsubscribe link to the broadcast email bodies using `unsubscribeUrl(...)` — the header alone is not sufficient.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `pnpm --filter web test` then `cd apps/web && npx tsc --noEmit`
Expected: PASS, clean

- [ ] **Step 7: Commit**

```bash
git add apps/web/src
git commit -m "feat: enforce opt-out and add one-click unsubscribe headers on broadcast sends"
```

---

### Task 10: Replace the event webhook

**Files:**
- Create: `apps/web/src/app/api/webhooks/postmark/route.ts`
- Test: `apps/web/src/__tests__/webhooks/postmark.test.ts`
- Delete: `apps/web/src/app/api/webhooks/sendgrid/route.ts`, `apps/web/src/app/api/webhooks/sendgrid/verify.ts`, `apps/web/src/__tests__/webhooks/sendgrid-verify.test.ts`

**Interfaces:**
- Produces: `POST /api/webhooks/postmark`

Postmark authenticates webhooks with HTTP Basic Auth on the endpoint URL. Add `POSTMARK_WEBHOOK_USER` and `POSTMARK_WEBHOOK_PASSWORD` to `.env.local`; the same values go in the dashboard webhook URL as `https://user:password@cncrealtygroup.com/api/webhooks/postmark`.

- [ ] **Step 1: Write the failing test**

```ts
function req(body: unknown, auth?: string) {
  return new Request("http://localhost/api/webhooks/postmark", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
    body: JSON.stringify(body),
  });
}
const good = "Basic " + Buffer.from("hookuser:hookpass").toString("base64");

it("rejects a request with no credentials", async () => {
  expect((await POST(req({}))).status).toBe(401);
});

it("rejects wrong credentials", async () => {
  const bad = "Basic " + Buffer.from("hookuser:nope").toString("base64");
  expect((await POST(req({}, bad))).status).toBe(401);
});

it("marks a contact opened on an Open event", async () => {
  const res = await POST(req({ RecordType: "Open", MessageID: "m1" }, good));
  expect(res.status).toBe(200);
  expect(prisma.campaignContact.updateMany).toHaveBeenCalledWith({
    where: { messageId: "m1" },
    data: { status: "OPENED", openedAt: expect.any(Date) },
  });
});
```

Add equivalent cases for `Click` and `Bounce`, mirroring the status transitions the existing SendGrid route performs — read that file before deleting it.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/__tests__/webhooks/postmark.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the route**

```ts
// apps/web/src/app/api/webhooks/postmark/route.ts
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

function authorized(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const user = process.env.POSTMARK_WEBHOOK_USER;
  const pass = process.env.POSTMARK_WEBHOOK_PASSWORD;
  if (!user || !pass) return false;

  const expected = Buffer.from("Basic " + Buffer.from(`${user}:${pass}`).toString("base64"));
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const event = await req.json();
    const messageId: string | undefined = event.MessageID;
    if (!messageId) return NextResponse.json({ ok: true });

    const now = new Date();
    const update =
      event.RecordType === "Open"
        ? { status: "OPENED", openedAt: now }
        : event.RecordType === "Click"
          ? { status: "CLICKED", clickedAt: now }
          : event.RecordType === "Bounce" || event.RecordType === "SpamComplaint"
            ? { status: "BOUNCED", bouncedAt: now }
            : null;

    if (update) {
      await prisma.campaignContact.updateMany({ where: { messageId }, data: update });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Return 200 on internal errors so Postmark does not retry forever —
    // same reasoning as the SendGrid route this replaces.
    console.error("[postmark-webhook] failed", err);
    return NextResponse.json({ ok: true });
  }
}
```

Before writing this, open the SendGrid route being deleted and confirm the exact `CampaignContact` field names and status values it used — mirror them rather than the placeholders above if they differ.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/__tests__/webhooks/postmark.test.ts`
Expected: PASS

- [ ] **Step 5: Delete the SendGrid webhook files**

```bash
git rm apps/web/src/app/api/webhooks/sendgrid/route.ts apps/web/src/app/api/webhooks/sendgrid/verify.ts apps/web/src/__tests__/webhooks/sendgrid-verify.test.ts
pnpm --filter web remove @sendgrid/eventwebhook
```

- [ ] **Step 6: Run the full suite and typecheck**

Run: `pnpm --filter web test` then `cd apps/web && npx tsc --noEmit`
Expected: PASS, clean

- [ ] **Step 7: Commit**

```bash
git add -A apps/web
git commit -m "feat: replace the SendGrid event webhook with Postmark"
```

---

### Task 11: Replace inbound email

**Files:**
- Create: `apps/web/src/app/api/webhooks/postmark/inbound/route.ts`
- Test: `apps/web/src/__tests__/webhooks/postmark-inbound.test.ts`
- Delete: `apps/web/src/app/api/webhooks/sendgrid/inbound/route.ts`, `apps/web/src/__tests__/webhooks/sendgrid-inbound.test.ts`

**Interfaces:**
- Produces: `POST /api/webhooks/postmark/inbound`

Postmark posts JSON with `From`, `To`, `Subject`, `TextBody`, `HtmlBody`, and `StrippedTextReply`. SendGrid posted multipart form data. Read the existing inbound route before deleting it — the action-plan pause logic is unchanged, only parsing differs.

- [ ] **Step 1: Write the failing test**

```ts
it("pauses the sender's action plan enrollment on a reply", async () => {
  const res = await POST(new Request("http://localhost/api/webhooks/postmark/inbound", {
    method: "POST",
    headers: { authorization: good, "content-type": "application/json" },
    body: JSON.stringify({
      From: "lead@example.com",
      Subject: "Re: your inquiry",
      TextBody: "Thanks, I'm interested",
      StrippedTextReply: "Thanks, I'm interested",
    }),
  }));

  expect(res.status).toBe(200);
  expect(prisma.leadPlanEnrollment.updateMany).toHaveBeenCalled();
});

it("returns 200 for an unrecognised sender without throwing", async () => {
  vi.mocked(prisma.lead.findFirst).mockResolvedValue(null);
  const res = await POST(/* same shape, unknown From */);
  expect(res.status).toBe(200);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- src/__tests__/webhooks/postmark-inbound.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the route**

```ts
// apps/web/src/app/api/webhooks/postmark/inbound/route.ts
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

function authorized(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const user = process.env.POSTMARK_WEBHOOK_USER;
  const pass = process.env.POSTMARK_WEBHOOK_PASSWORD;
  if (!user || !pass) return false;

  const expected = Buffer.from("Basic " + Buffer.from(`${user}:${pass}`).toString("base64"));
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Postmark posts JSON. SendGrid posted multipart form data — that is the
    // only part of this route that changes.
    const mail = await req.json();
    const from: string = (mail.From ?? "").toLowerCase().trim();
    if (!from) return NextResponse.json({ ok: true });

    const lead = await prisma.lead.findFirst({ where: { email: from } });
    if (!lead) return NextResponse.json({ ok: true });

    // A reply means a human is engaged — stop the automated sequence.
    await prisma.leadPlanEnrollment.updateMany({
      where: { leadId: lead.id, status: "ACTIVE" },
      data: { status: "PAUSED" },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[postmark-inbound] failed", err);
    return NextResponse.json({ ok: true });
  }
}
```

Before writing this, open the SendGrid inbound route being deleted and mirror its exact enrollment-pause logic and status values — the code above shows the shape, not necessarily the current field names.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- src/__tests__/webhooks/postmark-inbound.test.ts`
Expected: PASS

- [ ] **Step 5: Delete the SendGrid inbound files**

```bash
git rm apps/web/src/app/api/webhooks/sendgrid/inbound/route.ts apps/web/src/__tests__/webhooks/sendgrid-inbound.test.ts
```

- [ ] **Step 6: Run the full suite and typecheck, then commit**

```bash
pnpm --filter web test && cd apps/web && npx tsc --noEmit && cd ../..
git add -A apps/web
git commit -m "feat: replace SendGrid inbound parse with Postmark inbound"
```

---

### Task 12: Remove the last SendGrid traces

**Files:**
- Modify: `apps/web/src/app/(marketing)/privacy/page.tsx`
- Modify: `apps/web/package.json`, `apps/web/.env.local`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Confirm nothing references SendGrid**

```bash
grep -rn "sendgrid\|SENDGRID\|SendGrid" apps/web/src packages --include=*.ts --include=*.tsx --include=*.prisma
```
Expected: only the privacy policy's subprocessor mention.

- [ ] **Step 2: Update the privacy policy**

Replace the SendGrid subprocessor entry with Postmark (ActiveCampaign, LLC). Keep surrounding wording intact.

- [ ] **Step 3: Remove the dependency and env var**

```bash
grep -n "@sendgrid" apps/web/package.json   # expect no matches
```
Delete `SENDGRID_API_KEY` from `apps/web/.env.local`.

- [ ] **Step 4: Run the full suite, typecheck, and build**

```bash
pnpm --filter web test && cd apps/web && npx tsc --noEmit && cd ../.. && pnpm --filter web build
```
Expected: PASS, clean, `✓ Compiled successfully`

- [ ] **Step 5: Update CLAUDE.md**

Remove the **⏸️ PARKED — Postmark migration** section and replace it with a short completed-work note recording the stream IDs used, the unsubscribe design, and the remaining deploy-day configuration steps.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove SendGrid entirely and update the privacy policy"
```

---

## Deploy-day checklist (not code — do at launch)

- [ ] Upgrade Postmark to Pro (Bulk API + Inbound)
- [ ] Add `POSTMARK_SERVER_TOKEN`, `POSTMARK_BROADCAST_STREAM`, `POSTMARK_WEBHOOK_USER`, `POSTMARK_WEBHOOK_PASSWORD` to Vercel; remove `SENDGRID_API_KEY`
- [ ] Point the Postmark event webhook at `https://user:pass@cncrealtygroup.com/api/webhooks/postmark`
- [ ] Point Postmark inbound at `https://user:pass@cncrealtygroup.com/api/webhooks/postmark/inbound`
- [ ] Repoint the `reply.cncrealtygroup.com` MX record off `mx.sendgrid.net` to Postmark's inbound MX
- [ ] Send one live test of each: transactional, broadcast, inbound reply
