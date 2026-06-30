import sgMail from "@sendgrid/mail";

if (!process.env.SENDGRID_API_KEY) {
  console.error("[email] SENDGRID_API_KEY is not set — email sending will be skipped");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export const FROM = "noreply@cncrealtygroup.com";
const NOTIFY = "info@cncrealtygroup.com";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendLeadNotification(lead: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
}) {
  if (!process.env.SENDGRID_API_KEY) return;

  const safeName = `${escapeHtml(lead.firstName)} ${escapeHtml(lead.lastName)}`;
  const safeEmail = escapeHtml(lead.email);
  const safePhone = lead.phone ? escapeHtml(lead.phone) : null;
  const safeNotes = lead.notes ? escapeHtml(lead.notes) : null;

  await sgMail.send({
    to: NOTIFY,
    from: FROM,
    subject: `New Lead: ${lead.firstName} ${lead.lastName}`,
    html: `
      <h2>New lead from cncrealtygroup.com</h2>
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      ${safePhone ? `<p><strong>Phone:</strong> ${safePhone}</p>` : ""}
      ${safeNotes ? `<p><strong>Message:</strong> ${safeNotes}</p>` : ""}
    `,
  });
}

export async function sendApplicationNotification(app: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}) {
  if (!process.env.SENDGRID_API_KEY) return;
  const safeName = `${escapeHtml(app.firstName)} ${escapeHtml(app.lastName)}`;
  const safeEmail = escapeHtml(app.email);
  await sgMail.send({
    to: NOTIFY,
    from: FROM,
    subject: `New Agent Application: ${app.firstName} ${app.lastName}`,
    html: `
      <h2>New agent application received</h2>
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><a href="${process.env.NEXTAUTH_URL}/admin/applications/${app.id}">Review application →</a></p>
    `,
  });
}

export async function sendApplicationApproved(
  to: string,
  firstName: string,
  setupUrl: string
) {
  if (!process.env.SENDGRID_API_KEY) return;
  const safeName = escapeHtml(firstName);
  const safeUrl = escapeHtml(setupUrl);
  await sgMail.send({
    to,
    from: FROM,
    subject: "Welcome to CnC Realty — Set Up Your Account",
    html: `
      <h2>Welcome to CnC Realty, ${safeName}!</h2>
      <p>Your application has been approved. Click the link below to set your password and access your dashboard.</p>
      <p><a href="${safeUrl}">Set up my account →</a></p>
      <p>This link expires in 72 hours.</p>
      <p>— The CnC Realty Team</p>
    `,
  });
}

export async function sendApplicationRejected(
  to: string,
  firstName: string,
  reason: string
) {
  if (!process.env.SENDGRID_API_KEY) return;
  const safeName = escapeHtml(firstName);
  const safeReason = escapeHtml(reason);
  await sgMail.send({
    to,
    from: FROM,
    subject: "CnC Realty — Application Update",
    html: `
      <h2>Hi ${safeName},</h2>
      <p>Thank you for your interest in joining CnC Realty. After reviewing your application, we are unable to move forward at this time.</p>
      ${safeReason ? `<p><strong>Reason:</strong> ${safeReason}</p>` : ""}
      <p>If you have questions, please reach out to <a href="mailto:info@cncrealtygroup.com">info@cncrealtygroup.com</a>.</p>
      <p>— The CnC Realty Team</p>
    `,
  });
}
