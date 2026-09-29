import { emailLayout, buildHeadingBodyHtml } from "@/lib/email";
import { sendEmail, type SendResult } from "@/lib/email/send";
import { unsubscribeFooterHtml } from "@/lib/email/unsubscribe";

const HEADING = "Welcome to the CnC Newsletter";

/**
 * Sent once, when someone first joins the newsletter from the footer. Marketing
 * (broadcast stream, "newsletter" category): suppressible, and its unsubscribe
 * link leaves the newsletter only. Built from the same shared pieces as every
 * other CnC email.
 */
export async function sendNewsletterWelcome(opts: { to: string; leadId: string }): Promise<SendResult> {
  const bodyHtml =
    buildHeadingBodyHtml({
      heading: HEADING,
      photoUrl: `${process.env.NEXTAUTH_URL}/newsletter-welcome-photo.jpg`,
      bodyHtml: `
        <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.6; text-align: center; margin: 0;">
          Thanks for subscribing! You&rsquo;ll get California market updates, new listings, and home tips from CnC Realty.
        </p>
      `,
    }) + unsubscribeFooterHtml("lead", opts.leadId, "newsletter");

  return sendEmail({
    to: opts.to,
    subject: HEADING,
    html: emailLayout({ bodyHtml, ctaLabel: "Visit CnC Realty", ctaHref: `${process.env.NEXTAUTH_URL}/` }),
    stream: "broadcast",
    recipient: { kind: "lead", id: opts.leadId },
    category: "newsletter",
  });
}
