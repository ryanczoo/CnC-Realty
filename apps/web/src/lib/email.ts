import { readFileSync } from "fs";
import { join } from "path";
import { sendEmail } from "@/lib/email/send";

export const FROM = { email: "noreply@cncrealtygroup.com", name: "CnC Realty" };
export const NOTIFY = "info@cncrealtygroup.com";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Derives a readable plain-text fallback from an HTML email body. Mail clients
// build a multipart/alternative message from html + text at no extra send
// cost, and an HTML-only email (no text part) is a common spam-filter signal.
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&bull;/g, "•")
    .replace(/&copy;/g, "©")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

// Shared branded wrapper for every CnC email — logo header, card body,
// optional gold pill CTA button. Used for system-template emails as well as
// free-form agent/admin-authored content (drip steps, trigger automations,
// marketing campaigns) — CnC brands all outbound mail, including agent-composed
// content, since the brokerage is the one paying for it.
const EMAIL_FONT_STACK = "'Inter', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

export function emailLayout(opts: {
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
  footer?: string;
}): string {
  const logoUrl = `${process.env.NEXTAUTH_URL}/logo-black.png`;
  const footer = opts.footer ?? "— The CnC Realty Team";
  const socialIcons: Array<{ href: string; icon: string; alt: string; size: number }> = [
    { href: "https://www.facebook.com/CnCRealtyGroup", icon: "icon-facebook.png", alt: "Facebook", size: 24 },
    { href: "https://www.instagram.com/cncrealty", icon: "icon-instagram.png", alt: "Instagram", size: 24 },
    { href: "https://www.youtube.com/@CnCRealtyGroup", icon: "icon-youtube.png", alt: "YouTube", size: 30 },
  ];
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" />
      </head>
      <body style="margin: 0; padding: 0; background-color: #F2F0EF;">
        <div style="font-family: ${EMAIL_FONT_STACK}; max-width: 480px; margin: 0 auto; padding: 40px 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="${logoUrl}" alt="CnC Realty" width="160" style="display: inline-block; border: 0;" />
          </div>
          <div style="background-color: #ffffff; border-radius: 8px; padding: 32px;">
            <h2 style="color: #1B1B1B; font-weight: 400; font-size: 22px; margin: 0 0 16px; text-align: center;">
              ${opts.heading}
            </h2>
            ${opts.bodyHtml}
            ${
              opts.ctaLabel && opts.ctaHref
                ? `<div style="text-align: center; margin: 32px 0 0;">
                     <a href="${opts.ctaHref}" style="display: inline-block; background-color: #9E8C61; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 14px 36px; border-radius: 9999px;">
                       ${opts.ctaLabel}
                     </a>
                   </div>`
                : ""
            }
          </div>
          <p style="color: #8a8a8a; font-size: 13px; text-align: center; margin: 24px 0 12px;">
            ${footer}
          </p>
          <div style="text-align: center;">
            ${socialIcons
              .map(
                (s) =>
                  `<a href="${s.href}" style="display: inline-block; margin: 0 6px;"><img src="${process.env.NEXTAUTH_URL}/${s.icon}" alt="${s.alt}" width="${s.size}" height="${s.size}" style="display: inline-block; vertical-align: middle; border: 0;" /></a>`
              )
              .join("")}
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendLeadNotification(lead: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
}) {
  if (!process.env.POSTMARK_SERVER_TOKEN) {
    console.warn("[sendLeadNotification] POSTMARK_SERVER_TOKEN is not set — skipping email send.");
    return;
  }

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

  const html = emailLayout({
    heading: "New Lead Received",
    bodyHtml,
    footer: "cncrealtygroup.com",
  });

  await sendEmail({
    to: NOTIFY,
    subject: `New Lead: ${lead.firstName} ${lead.lastName}`,
    html,
    stream: "transactional",
  });
}

export async function sendApplicationNotification(app: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}) {
  if (!process.env.POSTMARK_SERVER_TOKEN) {
    console.warn(
      "[sendApplicationNotification] POSTMARK_SERVER_TOKEN is not set — skipping email send."
    );
    return;
  }
  const safeName = `${escapeHtml(app.firstName)} ${escapeHtml(app.lastName)}`;
  const safeEmail = escapeHtml(app.email);
  const bodyHtml = `
    <div style="color: #4b4b4b; font-size: 15px; line-height: 1.8; text-align: left;">
      <p style="margin: 0 0 8px;"><strong style="color: #1B1B1B;">Name:</strong> ${safeName}</p>
      <p style="margin: 0;"><strong style="color: #1B1B1B;">Email:</strong> ${safeEmail}</p>
    </div>
  `;

  const html = emailLayout({
    heading: "New Agent Application Received",
    bodyHtml,
    ctaLabel: "Review Application",
    ctaHref: `${process.env.NEXTAUTH_URL}/admin/applications/${app.id}`,
    footer: "cncrealtygroup.com",
  });

  await sendEmail({
    to: NOTIFY,
    subject: `New Agent Application: ${safeName}`,
    html,
    stream: "transactional",
  });
}

export async function sendApplicationApproved(
  to: string,
  firstName: string,
  setupUrl: string
) {
  if (!process.env.POSTMARK_SERVER_TOKEN) {
    console.warn(
      "[sendApplicationApproved] POSTMARK_SERVER_TOKEN is not set — skipping email send."
    );
    return;
  }
  const safeName = escapeHtml(firstName);
  const safeUrl = escapeHtml(setupUrl);

  const bodyHtml = `
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: center; margin: 0 0 8px;">
      Your application has been approved. Click the button below to set your password and access your dashboard.
    </p>
  `;

  const html = emailLayout({
    heading: `Welcome to CnC Realty, ${safeName}!`,
    bodyHtml,
    ctaLabel: "Set Up My Account",
    ctaHref: safeUrl,
  });

  await sendEmail({
    to,
    subject: "Welcome to CnC Realty — Set Up Your Account",
    html,
    stream: "transactional",
  });
}

// Announcements send from the monitored info@ inbox, not the default noreply@,
// because agents reply to them and those replies must reach a human.
const ANNOUNCEMENT_FROM = { email: "info@cncrealtygroup.com", name: "CnC Realty" };

export async function sendAnnouncement(recipients: string[], title: string, body: string) {
  if (!process.env.POSTMARK_SERVER_TOKEN) {
    console.warn("[sendAnnouncement] POSTMARK_SERVER_TOKEN is not set — skipping email send.");
    return;
  }
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);

  const bodyHtml = `
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: left; margin: 0; white-space: pre-wrap;">
      ${safeBody}
    </p>
  `;

  const html = emailLayout({
    heading: safeTitle,
    bodyHtml,
    footer: "cncrealtygroup.com",
  });

  await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: safeTitle,
        html,
        from: ANNOUNCEMENT_FROM,
        stream: "transactional",
      })
    )
  );
}

export async function sendPasswordReset(to: string, resetUrl: string) {
  if (!process.env.POSTMARK_SERVER_TOKEN) {
    console.warn("[sendPasswordReset] POSTMARK_SERVER_TOKEN is not set — skipping email send.");
    return;
  }
  const safeUrl = escapeHtml(resetUrl);

  const bodyHtml = `
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: center; margin: 0 0 8px;">
      We received a request to reset your password. Click the button below to choose a new one. This link expires in 2 hours.
    </p>
    <p style="color: #8a8a8a; font-size: 13px; text-align: center; margin: 16px 0 0;">
      If you didn't request this, you can safely ignore this email.
    </p>
  `;

  const html = emailLayout({
    heading: "Reset Your Password",
    bodyHtml,
    ctaLabel: "Reset Password",
    ctaHref: safeUrl,
  });

  await sendEmail({
    to,
    subject: "Reset Your CnC Realty Password",
    html,
    stream: "transactional",
  });
}

export async function sendApplicationRejected(
  to: string,
  firstName: string,
  reason: string
) {
  if (!process.env.POSTMARK_SERVER_TOKEN) {
    console.warn(
      "[sendApplicationRejected] POSTMARK_SERVER_TOKEN is not set — skipping email send."
    );
    return;
  }
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

  const html = emailLayout({
    heading: `Hi ${safeName},`,
    bodyHtml,
  });

  await sendEmail({
    to,
    subject: "CnC Realty — Application Update",
    html,
    stream: "transactional",
  });
}

const ATTACHMENTS_DIR = join(process.cwd(), "src", "lib", "email", "attachments");

export async function sendApprovalDocuments(to: string, firstName: string) {
  if (!process.env.POSTMARK_SERVER_TOKEN) {
    console.warn("[sendApprovalDocuments] POSTMARK_SERVER_TOKEN is not set — skipping email send.");
    return;
  }
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

  const html = emailLayout({
    heading: `Welcome, ${safeName}!`,
    bodyHtml,
  });

  await sendEmail({
    to,
    subject: "CnC Realty — Onboarding Documents",
    html,
    replyTo: NOTIFY,
    attachments: [
      {
        filename: "CnC Realty - Blank W-9.pdf",
        content: w9.toString("base64"),
        contentType: "application/pdf",
      },
      {
        filename: "CnC Realty - Office Policy Manual.pdf",
        content: opm.toString("base64"),
        contentType: "application/pdf",
      },
    ],
    stream: "transactional",
  });
}
