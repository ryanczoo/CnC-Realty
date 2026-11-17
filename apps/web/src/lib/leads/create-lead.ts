import * as Sentry from "@sentry/nextjs";
import type { Lead, LeadSource, Prisma } from "@cnc/database";
import { sendLeadNotification } from "@/lib/email";
import { subscribeToNewsletter } from "@/lib/newsletter";

export type WebsiteLeadInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  notes?: string;
  source: LeadSource;
  utmSource?: string;
  role?: string;
};

// Never sets agentId: website leads land Unassigned.
export function leadCreateData(input: WebsiteLeadInput): Prisma.LeadCreateInput {
  const { role, ...fields } = input;
  return { ...fields, visitorRole: role };
}

export async function afterLeadCreated(lead: Lead, opts: { newsletterConsent?: boolean }): Promise<void> {
  sendLeadNotification(lead).catch(console.error);
  // A failed enrollment never fails the inquiry.
  if (opts.newsletterConsent) {
    await subscribeToNewsletter({ email: lead.email, leadId: lead.id, source: "contact-form" }).catch((err) =>
      Sentry.captureException(err)
    );
  }
}
