import { emailLayout, escapeHtml } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";
import { unsubscribeFooterHtml } from "@/lib/email/unsubscribe";

export function substituteVars(
  template: string,
  vars: { firstName: string; lastName: string; agentName: string; agentPhone: string }
): string {
  return template
    .replace(/\{\{first_name\}\}/g, vars.firstName)
    .replace(/\{\{last_name\}\}/g, vars.lastName)
    .replace(/\{\{agent_name\}\}/g, vars.agentName)
    .replace(/\{\{agent_phone\}\}/g, vars.agentPhone);
}

function paragraph(body: string): string {
  return `<p style="color: #4b4b4b; font-size: 15px; line-height: 1.6;">${escapeHtml(body).replace(/\n/g, "<br>")}</p>`;
}

/** A drip step going out to a lead. Marketing: suppressible, unsubscribable. */
export async function sendActionPlanEmail(opts: {
  to: string;
  subject: string;
  body: string;
  enrollmentId: string;
  leadId: string;
}): Promise<void> {
  const replyTo = `reply+${opts.enrollmentId}@reply.cncrealtygroup.com`;
  const bodyHtml = paragraph(opts.body) + unsubscribeFooterHtml("lead", opts.leadId);
  const html = emailLayout({ heading: opts.subject, bodyHtml });

  await sendEmail({
    to: opts.to,
    subject: opts.subject,
    html,
    replyTo,
    stream: "broadcast",
    recipient: { kind: "lead", id: opts.leadId },
  });
}

/**
 * A lead's reply forwarded to their agent. Transactional, not broadcast: this
 * is work the agent needs to see, they never subscribed to it, and a marketing
 * opt-out must not silently swallow it.
 */
export async function sendLeadReplyNotification(opts: {
  to: string;
  subject: string;
  body: string;
  enrollmentId: string;
}): Promise<void> {
  await sendEmail({
    to: opts.to,
    subject: opts.subject,
    html: emailLayout({ heading: opts.subject, bodyHtml: paragraph(opts.body) }),
    replyTo: `reply+${opts.enrollmentId}@reply.cncrealtygroup.com`,
    stream: "transactional",
  });
}
