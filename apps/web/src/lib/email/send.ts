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
