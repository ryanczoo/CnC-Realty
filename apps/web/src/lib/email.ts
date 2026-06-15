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
