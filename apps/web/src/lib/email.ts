import sgMail from "@sendgrid/mail";
import { readFileSync } from "fs";
import { join } from "path";

if (!process.env.SENDGRID_API_KEY) {
  console.error("[email] SENDGRID_API_KEY is not set — email sending will be skipped");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export const FROM = { email: "noreply@cncrealtygroup.com", name: "CnC Realty" };
const NOTIFY = "info@cncrealtygroup.com";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Shared branded wrapper for system-template emails — logo header, card body,
// optional gold pill CTA button. Not used for free-form agent/admin-authored
// content (drip campaign steps, trigger automations, marketing campaigns),
// where imposing a template would fight the point of that content looking personal.
export function emailLayout(opts: {
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
  footer?: string;
}): string {
  const logoUrl = `${process.env.NEXTAUTH_URL}/logo-gold.png`;
  const footer = opts.footer ?? "— The CnC Realty Team";
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 32px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 32px;">
        <img src="${logoUrl}" alt="CnC Realty" width="160" style="display: inline-block; border: 0;" />
      </div>
      <h2 style="color: #1B1B1B; font-weight: 400; font-size: 22px; margin: 0 0 16px; text-align: center;">
        ${opts.heading}
      </h2>
      ${opts.bodyHtml}
      ${
        opts.ctaLabel && opts.ctaHref
          ? `<div style="text-align: center; margin: 32px 0;">
               <a href="${opts.ctaHref}" style="display: inline-block; background-color: #9E8C61; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 14px 36px; border-radius: 9999px;">
                 ${opts.ctaLabel}
               </a>
             </div>`
          : ""
      }
      <p style="color: #8a8a8a; font-size: 13px; text-align: center; margin: ${opts.ctaLabel ? "0" : "24px 0 0"};">
        ${footer}
      </p>
    </div>
  `;
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

  const bodyHtml = `
    <div style="color: #4b4b4b; font-size: 15px; line-height: 1.8; text-align: left;">
      <p style="margin: 0 0 8px;"><strong style="color: #1B1B1B;">Name:</strong> ${safeName}</p>
      <p style="margin: 0 0 8px;"><strong style="color: #1B1B1B;">Email:</strong> ${safeEmail}</p>
      ${safePhone ? `<p style="margin: 0 0 8px;"><strong style="color: #1B1B1B;">Phone:</strong> ${safePhone}</p>` : ""}
      ${safeNotes ? `<p style="margin: 0;"><strong style="color: #1B1B1B;">Message:</strong> ${safeNotes}</p>` : ""}
    </div>
  `;

  await sgMail.send({
    to: NOTIFY,
    from: FROM,
    subject: `New Lead: ${lead.firstName} ${lead.lastName}`,
    html: emailLayout({
      heading: "New Lead Received",
      bodyHtml,
      footer: "cncrealtygroup.com",
    }),
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
  const bodyHtml = `
    <div style="color: #4b4b4b; font-size: 15px; line-height: 1.8; text-align: left;">
      <p style="margin: 0 0 8px;"><strong style="color: #1B1B1B;">Name:</strong> ${safeName}</p>
      <p style="margin: 0;"><strong style="color: #1B1B1B;">Email:</strong> ${safeEmail}</p>
    </div>
  `;

  await sgMail.send({
    to: NOTIFY,
    from: FROM,
    subject: `New Agent Application: ${safeName}`,
    html: emailLayout({
      heading: "New Agent Application Received",
      bodyHtml,
      ctaLabel: "Review Application",
      ctaHref: `${process.env.NEXTAUTH_URL}/admin/applications/${app.id}`,
      footer: "cncrealtygroup.com",
    }),
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

  const bodyHtml = `
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: center; margin: 0 0 8px;">
      Your application has been approved. Click the button below to set your password and access your dashboard.
    </p>
  `;

  await sgMail.send({
    to,
    from: FROM,
    subject: "Welcome to CnC Realty — Set Up Your Account",
    html: emailLayout({
      heading: `Welcome to CnC Realty, ${safeName}!`,
      bodyHtml,
      ctaLabel: "Set Up My Account",
      ctaHref: safeUrl,
    }),
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
  const bodyHtml = `
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: center; margin: 0 0 16px;">
      Thank you for your interest in joining CnC Realty. After reviewing your application, we are
      unable to move forward at this time.
    </p>
    ${safeReason ? `<p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: center; margin: 0 0 16px;"><strong style="color: #1B1B1B;">Reason:</strong> ${safeReason}</p>` : ""}
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: center; margin: 0;">
      If you have questions, please reach out to
      <a href="mailto:info@cncrealtygroup.com" style="color: #9E8C61;">info@cncrealtygroup.com</a>.
    </p>
  `;

  await sgMail.send({
    to,
    from: FROM,
    subject: "CnC Realty — Application Update",
    html: emailLayout({
      heading: `Hi ${safeName},`,
      bodyHtml,
    }),
  });
}

const ATTACHMENTS_DIR = join(process.cwd(), "src", "lib", "email", "attachments");

export async function sendApprovalDocuments(to: string, firstName: string) {
  if (!process.env.SENDGRID_API_KEY) return;
  const safeName = escapeHtml(firstName);

  const w9 = readFileSync(join(ATTACHMENTS_DIR, "w9-blank.pdf"));
  const opm = readFileSync(join(ATTACHMENTS_DIR, "cnc-office-policy-manual.pdf"));

  const bodyHtml = `
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: left; margin: 0 0 16px;">
      Welcome to CnC Realty! Attached you'll find:
    </p>
    <ul style="color: #4b4b4b; font-size: 15px; line-height: 1.8; margin: 0 0 16px; padding-left: 20px;">
      <li>A blank IRS Form W-9</li>
      <li>CnC Realty's Office Policy Manual</li>
    </ul>
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: left; margin: 0 0 16px;">
      Please reply to this email with:
    </p>
    <ul style="color: #4b4b4b; font-size: 15px; line-height: 1.8; margin: 0 0 16px; padding-left: 20px;">
      <li>Your completed W-9</li>
      <li>A copy of your active California DRE license</li>
      <li>A headshot for your agent profile page</li>
    </ul>
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: left; margin: 0;">
      One more thing — if you haven't already, join the Board of REALTORS®/MLS association that covers the area(s) you work in. CnC doesn't select or pay for this membership, but it's required for MLS access.
    </p>
  `;

  await sgMail.send({
    to,
    from: FROM,
    replyTo: NOTIFY,
    subject: "CnC Realty — Onboarding Documents",
    html: emailLayout({
      heading: `Welcome, ${safeName}!`,
      bodyHtml,
    }),
    attachments: [
      {
        content: w9.toString("base64"),
        filename: "CnC Realty - Blank W-9.pdf",
        type: "application/pdf",
        disposition: "attachment",
      },
      {
        content: opm.toString("base64"),
        filename: "CnC Realty - Office Policy Manual.pdf",
        type: "application/pdf",
        disposition: "attachment",
      },
    ],
  });
}
