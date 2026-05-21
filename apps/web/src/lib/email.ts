import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export const FROM = "noreply@cncrealtygroup.com";
const NOTIFY = "info@cncrealtygroup.com";

export async function sendLeadNotification(lead: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
}) {
  await sgMail.send({
    to: NOTIFY,
    from: FROM,
    subject: `New Lead: ${lead.firstName} ${lead.lastName}`,
    html: `
      <h2>New lead from cncrealtygroup.com</h2>
      <p><strong>Name:</strong> ${lead.firstName} ${lead.lastName}</p>
      <p><strong>Email:</strong> ${lead.email}</p>
      ${lead.phone ? `<p><strong>Phone:</strong> ${lead.phone}</p>` : ""}
      ${lead.notes ? `<p><strong>Message:</strong> ${lead.notes}</p>` : ""}
    `,
  });
}
