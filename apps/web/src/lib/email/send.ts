import sgMail from "@sendgrid/mail";
import { FROM, htmlToPlainText } from "@/lib/email";

if (!process.env.SENDGRID_API_KEY) {
  console.error("[email] SENDGRID_API_KEY is not set — email sending will be skipped");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
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
  const base = {
    from: opts.from ?? FROM,
    to: opts.to,
    subject: opts.subject,
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
  };

  // Branch rather than spread the body parts in conditionally: SendGrid's
  // MailDataRequired demands provable evidence that a body part is present,
  // which an optional spread cannot give it. Each branch narrows BodyParts to
  // one member, so this type-checks without a cast.
  if (opts.html !== undefined) {
    await sgMail.send({
      ...base,
      html: opts.html,
      text: opts.text ?? htmlToPlainText(opts.html),
    });
    return;
  }

  // Text-only: no html key at all. An empty html part would render as a blank
  // email in clients that prefer text/html.
  await sgMail.send({ ...base, text: opts.text });
}
