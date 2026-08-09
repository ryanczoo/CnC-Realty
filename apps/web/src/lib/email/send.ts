import { ServerClient } from "postmark";
import { FROM, htmlToPlainText } from "@/lib/email";

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

// At least one body part, enforced at compile time: html (text derived or
// given), or text alone. A caller with neither is a type error, not a runtime
// one. Text-only senders must not be forced to invent an html part — mail
// clients prefer text/html whenever one is present, so `html: ""` would ship a
// blank email.
type BodyParts = { html: string; text?: string } | { html?: undefined; text: string };

export type SendOptions = {
  to: string;
  subject: string;
  replyTo?: string;
  attachments?: { filename: string; content: string; contentType: string }[];
  // Overrides the default FROM; callers should omit it unless they have a
  // specific reason. Announcements set it so agent replies reach the
  // monitored info@ inbox rather than the unmonitored noreply@ address.
  from?: { email: string; name: string };
  stream: MessageStream;
} & BodyParts;

// The single place the app talks to an email vendor. Callers build content;
// this owns FROM, the plain-text part, stream routing, and (later) opt-out
// suppression. `stream` is required so no call site can forget to choose.
export async function sendEmail(opts: SendOptions): Promise<void> {
  const from = opts.from ?? FROM;

  const base = {
    // Postmark takes one formatted string where SendGrid took {email, name}.
    // The mapping lives here so the public SendOptions shape stays vendor-free.
    From: `${from.name} <${from.email}>`,
    To: opts.to,
    Subject: opts.subject,
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
    return;
  }

  // Text-only: no HtmlBody key at all. An empty html part would render as a
  // blank email in clients that prefer text/html.
  await getClient().sendEmail({ ...base, TextBody: opts.text });
}
