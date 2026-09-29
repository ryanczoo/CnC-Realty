import { prisma } from "@/lib/prisma";
import { emailMatchWhere } from "@/lib/email-match";
import { sendSafely } from "@/lib/email/send-safely";
import { sendNewsletterWelcome } from "@/lib/email/newsletter-email";

export type NewsletterSignupSource = "footer" | "contact-form";

/**
 * The one place a newsletter subscription is created: the footer signup and
 * the contact forms (the /contact page, the shared contact pop-up and the
 * agent-profile form) all come through here.
 *
 * - One subscription per email address. Newsletter sends read subscribed
 *   leads, so two subscribed leads with one address would get every
 *   newsletter twice.
 * - Only the footer (an explicit signup) re-subscribes someone who left; a
 *   contact form's disclaimer never overrides an unsubscribe.
 * - A contact form subscribes the lead it just created (`leadId`), so a lead
 *   from an agent's profile page stays that agent's.
 * - The welcome email goes out only on a first subscription, and a failed
 *   send never fails the signup.
 */
export async function subscribeToNewsletter(opts: {
  email: string;
  source: NewsletterSignupSource;
  leadId?: string;
}): Promise<void> {
  const matches = await prisma.lead.findMany({
    where: emailMatchWhere(opts.email),
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, newsletterSubscribedAt: true, newsletterOptOut: true },
  });

  if (matches.some((m) => m.newsletterSubscribedAt && !m.newsletterOptOut)) return;

  const optedOut = matches.find((m) => m.newsletterOptOut);
  if (optedOut && opts.source === "contact-form") return;

  const target =
    optedOut ?? (opts.leadId ? matches.find((m) => m.id === opts.leadId) : matches[0]);

  const now = new Date();

  if (!target) {
    // Only a footer signup creates its own lead; a contact form always passes
    // the lead it just made.
    if (opts.source === "contact-form") return;
    const lead = await prisma.lead.create({
      data: {
        firstName: "Newsletter", lastName: "Subscriber", email: opts.email,
        source: "NEWSLETTER", agentId: null, newsletterSubscribedAt: now,
      },
    });
    await sendSafely(() => sendNewsletterWelcome({ to: opts.email, leadId: lead.id }));
    return;
  }

  const firstJoin = !target.newsletterSubscribedAt;
  await prisma.lead.update({
    where: { id: target.id },
    data: firstJoin ? { newsletterSubscribedAt: now, newsletterOptOut: false } : { newsletterOptOut: false },
  });
  if (firstJoin) await sendSafely(() => sendNewsletterWelcome({ to: target.email, leadId: target.id }));
}
