import { emailLayout, buildHeadingBodyHtml } from "@/lib/email";
import { sendEmail, type SendResult } from "@/lib/email/send";
import { unsubscribeFooterHtml } from "@/lib/email/unsubscribe";

const SUBJECT = "Heck yeah, You're In!";
const HEADING = "Welcome to our Newsletter!";

/**
 * Sent once, when someone first joins the newsletter from the footer. Marketing
 * (broadcast stream, "newsletter" category): suppressible, and its unsubscribe
 * link leaves the newsletter only. Built from the same shared pieces as every
 * other CnC email.
 */
export async function sendNewsletterWelcome(opts: { to: string; leadId: string }): Promise<SendResult> {
  const bodyHtml = buildHeadingBodyHtml({
    heading: HEADING,
    photoUrl: `${process.env.NEXTAUTH_URL}/newsletter-welcome-photo.jpg`,
    bodyHtml: `
        <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.6; text-align: center; margin: 20px 0 12px;">
          Going forward, we will make sure to only send you exclusive listings and important market updates to keep you ahead of the game.
        </p>
      `,
  });

  return sendEmail({
    to: opts.to,
    subject: SUBJECT,
    html: emailLayout({
      bodyHtml,
      ctaLabel: "Homepage",
      ctaHref: `${process.env.NEXTAUTH_URL}/`,
      // Spacing here is newsletter-only: the shared heading (24px), button
      // (32px) and unsubscribe (24px) margins are left alone so no other email
      // changes. The extra 20/12/20px brings each gap to 44px, matching the
      // section spacing in the agent welcome email.
      afterCtaHtml: `<div style="padding-top: 20px;">${unsubscribeFooterHtml("lead", opts.leadId, "newsletter")}</div>`,
    }),
    stream: "broadcast",
    recipient: { kind: "lead", id: opts.leadId },
    category: "newsletter",
  });
}
