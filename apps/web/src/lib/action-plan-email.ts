import sgMail from "@sendgrid/mail";
import { FROM } from "@/lib/email";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

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
  await sgMail.send({
    to: opts.to,
    from: FROM,
    replyTo,
    subject: opts.subject,
    text: opts.body,
  });
}
