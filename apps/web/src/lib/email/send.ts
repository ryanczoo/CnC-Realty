import { ServerClient } from "postmark";
import { FROM, htmlToPlainText } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import {
  unsubscribePostUrl,
  type OptOutKind,
  type EmailCategory,
} from "@/lib/email/unsubscribe";

// Postmark's transactional stream. Hardcoded because it is fixed per server and
// identical across environments. The broadcast stream id is account-specific, so
// that one is read from the environment instead.
const TRANSACTIONAL_STREAM = "outbound";

let client: ServerClient | null = null;

// Constructed lazily, not at module load: importing this module must not throw
// in environments that never send (tests, builds, local dev without a token).
function getClient(): ServerClient {
  if (!client) {
    const token = process.env.POSTMARK_SERVER_TOKEN;
    if (!token) throw new Error("POSTMARK_SERVER_TOKEN is not set");
    client = new ServerClient(token);
  }
  return client;
}

export type MessageStream = "transactional" | "broadcast";

// Refuses rather than falls back. An unset variable would serialize
// MessageStream as undefined, which Postmark drops — routing the send to the
// server's default stream, `outbound`. That would put campaign and property-
// alert mail on the transactional stream silently, with no error, which is the
// exact contamination the stream split exists to prevent. A broadcast that does
// not go out is recoverable; a poisoned transactional reputation is not.
function resolveStream(stream: MessageStream): string {
  if (stream !== "broadcast") return TRANSACTIONAL_STREAM;

  const broadcast = process.env.POSTMARK_BROADCAST_STREAM;
  if (!broadcast) {
    throw new Error(
      "POSTMARK_BROADCAST_STREAM is not set — refusing to send a broadcast on the transactional stream"
    );
  }
  return broadcast;
}

// At least one body part, enforced at compile time: html (text derived or
// given), or text alone. A caller with neither is a type error, not a runtime
// one. Text-only senders must not be forced to invent an html part — mail
// clients prefer text/html whenever one is present, so `html: ""` would ship a
// blank email.
type BodyParts = { html: string; text?: string } | { html?: undefined; text: string };

export type OptOutRecipient = { kind: OptOutKind; id: string };

// Required on broadcast, optional on transactional. Commercial email must
// honour an opt-out and carry a working unsubscribe link, and neither is
// possible without knowing who the recipient is. `category` is required for
// the same reason: an unsubscribe click has to opt the recipient out of the
// list this message came from and nothing else.
type StreamRouting =
  | { stream: "transactional"; recipient?: OptOutRecipient; category?: never }
  | { stream: "broadcast"; recipient: OptOutRecipient; category: EmailCategory };

// Returned rather than void so a caller can tell a suppressed send from a
// delivered one. Returning void made an opt-out indistinguishable from a
// success, which is how campaign stats came to count suppressed contacts as
// SENT.
export type SendResult = { sent: true } | { sent: false; reason: "opted_out" };

export type SendOptions = {
  to: string;
  subject: string;
  replyTo?: string;
  attachments?: { filename: string; content: string; contentType: string }[];
  // Overrides the default FROM; callers should omit it unless they have a
  // specific reason. Announcements set it so agent replies reach the
  // monitored info@ inbox rather than the unmonitored noreply@ address.
  from?: { email: string; name: string };
} & BodyParts &
  StreamRouting;

// Fails open on a missing row: a deleted lead is not an opt-out, and treating
// every lookup miss as one would silently drop mail.
async function isOptedOut(
  recipient: OptOutRecipient,
  category: EmailCategory
): Promise<boolean> {
  if (recipient.kind === "lead") {
    const row = await prisma.lead.findUnique({
      where: { id: recipient.id },
      select: { campaignOptOut: true, actionPlanOptOut: true },
    });
    if (!row) return false;
    return category === "action_plan" ? row.actionPlanOptOut : row.campaignOptOut;
  }

  const row = await prisma.user.findUnique({
    where: { id: recipient.id },
    select: { propertyAlertOptOut: true },
  });
  return row?.propertyAlertOptOut === true;
}

// The single place the app talks to an email vendor. Callers build content;
// this owns FROM, the plain-text part, stream routing, and (later) opt-out
// suppression. `stream` is required so no call site can forget to choose.
export async function sendEmail(opts: SendOptions): Promise<SendResult> {
  // Resolved first so a misconfigured broadcast throws before the opt-out
  // lookup, rather than after a pointless database round trip.
  const messageStream = resolveStream(opts.stream);

  // Only broadcast mail is suppressible. Transactional mail is not commercial
  // email, the recipient cannot unsubscribe from it, and silently dropping an
  // account-setup or deadline message would be a far worse failure.
  const unsubscribe =
    opts.stream === "broadcast"
      ? unsubscribePostUrl(opts.recipient.kind, opts.recipient.id, opts.category)
      : null;

  if (opts.stream === "broadcast" && (await isOptedOut(opts.recipient, opts.category))) {
    return { sent: false, reason: "opted_out" };
  }

  const from = opts.from ?? FROM;

  const base = {
    // Postmark takes one formatted string where SendGrid took {email, name}.
    // The mapping lives here so the public SendOptions shape stays vendor-free.
    From: `${from.name} <${from.email}>`,
    To: opts.to,
    Subject: opts.subject,
    MessageStream: messageStream,
    ...(unsubscribe
      ? {
          Headers: [
            // Angle brackets are required by RFC 2369. The pair of headers is
            // what makes Gmail and Apple Mail render a native Unsubscribe
            // control instead of surfacing a "report spam" prompt.
            { Name: "List-Unsubscribe", Value: `<${unsubscribe}>` },
            { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
          ],
        }
      : {}),
    ...(opts.replyTo ? { ReplyTo: opts.replyTo } : {}),
    ...(opts.attachments
      ? {
          Attachments: opts.attachments.map((a) => ({
            Name: a.filename,
            Content: a.content,
            ContentType: a.contentType,
            // Required by Postmark's Attachment type. null is the value for a
            // downloadable attachment; a ContentID would make it an inline
            // `cid:` reference instead, which these never are.
            ContentID: null,
          })),
        }
      : {}),
  };

  // Branch rather than spread the body parts in conditionally: each branch
  // narrows BodyParts to one member, which is what lets the text-only path omit
  // HtmlBody entirely without a cast.
  if (opts.html !== undefined) {
    await getClient().sendEmail({
      ...base,
      HtmlBody: opts.html,
      TextBody: opts.text ?? htmlToPlainText(opts.html),
    });
    return { sent: true };
  }

  // Text-only: no HtmlBody key at all. An empty html part would render as a
  // blank email in clients that prefer text/html.
  await getClient().sendEmail({ ...base, TextBody: opts.text });
  return { sent: true };
}
