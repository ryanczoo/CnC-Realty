import { emailLayout, escapeHtml } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";

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

export async function sendActionPlanEmail(opts: {
  to: string;
  subject: string;
  body: string;
  enrollmentId: string;
}): Promise<void> {
  const replyTo = `reply+${opts.enrollmentId}@reply.cncrealtygroup.com`;
  const bodyHtml = `<p style="color: #4b4b4b; font-size: 15px; line-height: 1.6;">${escapeHtml(opts.body).replace(/\n/g, "<br>")}</p>`;
  const html = emailLayout({ heading: opts.subject, bodyHtml });

  await sendEmail({
    to: opts.to,
    subject: opts.subject,
    html,
    replyTo,
    stream: "broadcast",
  });
}
