import sgMail from "@sendgrid/mail";
import { FROM, htmlToPlainText } from "@/lib/email";

if (!process.env.SENDGRID_API_KEY) {
  console.error("[email] SENDGRID_API_KEY is not set — email sending will be skipped");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export type MessageStream = "transactional" | "broadcast";

export interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: { filename: string; content: string; contentType: string }[];
  // Overrides the default FROM; callers should omit it unless they have a
  // specific reason. Announcements set it so agent replies reach the
  // monitored info@ inbox rather than the unmonitored noreply@ address.
  from?: { email: string; name: string };
  stream: MessageStream;
}

// The single place the app talks to an email vendor. Callers build content;
// this owns FROM, the plain-text part, stream routing, and (later) opt-out
// suppression. `stream` is required so no call site can forget to choose.
export async function sendEmail(opts: SendOptions): Promise<void> {
  await sgMail.send({
    from: opts.from ?? FROM,
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
