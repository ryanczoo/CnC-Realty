import { emailLayout, escapeHtml } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";

const BROKER_EMAIL = "info@cncrealtygroup.com";

// Referral files have no propertyAddress (they're not tied to a specific property yet).
const NO_ADDRESS_LABEL = "this referral file";

export async function sendSubmitForReview(opts: {
  fileType: "Listing" | "Transaction";
  address: string | null;
  agentName: string;
  fileId: string;
}): Promise<void> {
  const address = opts.address ?? NO_ADDRESS_LABEL;
  const safeAgentName = escapeHtml(opts.agentName);
  const safeAddress = escapeHtml(address);
  const bodyHtml = `
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: center; margin: 0;">
      <strong style="color: #1B1B1B;">${safeAgentName}</strong> has submitted a
      ${opts.fileType.toLowerCase()} file for compliance review.
    </p>
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: center; margin: 12px 0 0;">
      Property: <strong style="color: #1B1B1B;">${safeAddress}</strong>
    </p>
  `;
  const html = emailLayout({
    heading: `${opts.fileType} File Ready for Review`,
    bodyHtml,
    ctaLabel: "Review File",
    ctaHref: `${process.env.NEXTAUTH_URL}/admin/transactions/${opts.fileType.toLowerCase()}/${opts.fileId}`,
  });
  await sendEmail({
    to: BROKER_EMAIL,
    subject: `[CnC] ${opts.fileType} File Ready for Review — ${address}`,
    html,
    stream: "transactional",
  });
}

export async function sendDocumentRejected(opts: {
  agentEmail: string;
  agentName: string;
  documentName: string;
  address: string | null;
  rejectionNote: string;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  const address = opts.address ?? NO_ADDRESS_LABEL;
  const safeAgentName = escapeHtml(opts.agentName);
  const safeAddress = escapeHtml(address);
  const safeDocumentName = escapeHtml(opts.documentName);
  const safeNote = escapeHtml(opts.rejectionNote).replace(/\.+$/, "");
  const bodyHtml = `
    <div style="margin: 0 0 24px;">
      <img src="${process.env.NEXTAUTH_URL}/document-correction-photo.jpg" alt="" width="100%" style="display: block; width: 100%; border-radius: 8px; border: 0;" />
    </div>
    <h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 16px; text-align: center;">
      Correction Needed
    </h2>
    <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: center; margin: 0 0 32px;">
      Hi ${safeAgentName}, the following document was rejected for your listing at <strong style="color: #1B1B1B;">${safeAddress}</strong>:
    </p>
    <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: center; font-weight: 700; margin: 0 0 32px;">
      Document: <strong style="color: #1B1B1B;">${safeDocumentName}</strong><br />
      Reason: <strong style="color: #1B1B1B;">${safeNote}</strong>
    </p>
    <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: center; margin: 0;">
      Please re-upload the document with the necessary corrections or <a href="mailto:ryanchong@cncrealtygroup.com" style="color: #9E8C61;">reach out</a> for help!
    </p>
  `;
  const html = emailLayout({
    heading: "",
    bodyHtml,
    ctaLabel: "View Checklists",
    ctaHref: `${process.env.NEXTAUTH_URL}/dashboard/transactions/${opts.fileType}/${opts.fileId}?tab=checklist`,
  });
  await sendEmail({
    to: opts.agentEmail,
    subject: `Document Correction - ${address}`,
    html,
    stream: "transactional",
  });
}

export async function sendAllDocsApproved(opts: {
  agentEmail: string;
  agentName: string;
  address: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  const address = opts.address ?? NO_ADDRESS_LABEL;
  const safeAgentName = escapeHtml(opts.agentName);
  const safeAddress = escapeHtml(address);
  const safeCityStateZip = escapeHtml(
    [opts.city, [opts.state, opts.zip].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ")
  );
  const bodyHtml = `
    <div style="margin: 0 0 24px;">
      <img src="${process.env.NEXTAUTH_URL}/document-rejected-photo.jpg" alt="" width="100%" style="display: block; width: 100%; border-radius: 8px; border: 0;" />
    </div>
    <h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 16px; text-align: center;">
      All Documents Approved
    </h2>
    <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: center; margin: 0 0 32px;">
      Hi ${safeAgentName}, all required documents have been approved for your listing at:
    </p>
    <p style="color: #1B1B1B; font-size: 22.5px; line-height: 1.6; text-align: center; font-weight: 700; margin: 0 0 32px;">
      ${safeAddress}${safeCityStateZip ? `,<br />\n      ${safeCityStateZip}` : ""}
    </p>
    <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: center; margin: 0;">
      The broker can now close this file.
    </p>
  `;
  const html = emailLayout({
    heading: "",
    bodyHtml,
    ctaLabel: "View File",
    ctaHref: `${process.env.NEXTAUTH_URL}/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
  await sendEmail({
    to: opts.agentEmail,
    subject: `Documents Approved - ${address}`,
    html,
    stream: "transactional",
  });
}

export async function sendFileClosed(opts: {
  agentEmail: string;
  agentName: string;
  address: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  const address = opts.address ?? NO_ADDRESS_LABEL;
  const firstName = opts.agentName.trim().split(/\s+/)[0] || opts.agentName;
  const safeFirstName = escapeHtml(firstName);
  const safeAddress = escapeHtml(address);
  const safeCityStateZip = escapeHtml(
    [opts.city, [opts.state, opts.zip].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ")
  );
  const bodyHtml = `
    <div style="margin: 0 0 24px;">
      <img src="${process.env.NEXTAUTH_URL}/file-closed-photo.jpg" alt="" width="100%" style="display: block; width: 100%; border-radius: 8px; border: 0;" />
    </div>
    <h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 16px; text-align: center;">
      File Closed
    </h2>
    <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: center; margin: 0 0 32px;">
      Hi ${safeFirstName}, the following file has been marked CLOSED for:
    </p>
    <p style="color: #1B1B1B; font-size: 22.5px; line-height: 1.6; text-align: center; font-weight: 700; margin: 0 0 32px;">
      ${safeAddress}${safeCityStateZip ? `,<br />\n      ${safeCityStateZip}` : ""}
    </p>
    <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: center; margin: 0;">
      Congratulations - it's time to celebrate!
    </p>
  `;
  const html = emailLayout({
    heading: "",
    bodyHtml,
    ctaLabel: "View File",
    ctaHref: `${process.env.NEXTAUTH_URL}/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
  await sendEmail({
    to: opts.agentEmail,
    subject: `File Closed - ${address}`,
    html,
    stream: "transactional",
  });
}

export async function sendFileExpirationWarning(opts: {
  agentEmail: string;
  agentName: string;
  address: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  expiresInDays: number;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  const firstName = opts.agentName.trim().split(/\s+/)[0] || opts.agentName;
  const safeFirstName = escapeHtml(firstName);
  const safeAddress = escapeHtml(opts.address);
  const safeCityStateZip = escapeHtml(
    [opts.city, [opts.state, opts.zip].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ")
  );
  const dayWord = opts.expiresInDays === 1 ? "1 day" : `${opts.expiresInDays} days`;
  const bodyHtml = `
    <div style="margin: 0 0 24px;">
      <img src="${process.env.NEXTAUTH_URL}/file-expiring-photo.jpg" alt="" width="100%" style="display: block; width: 100%; border-radius: 8px; border: 0;" />
    </div>
    <h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 16px; text-align: center;">
      File Expiring Soon
    </h2>
    <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: center; margin: 0 0 32px;">
      Hi ${safeFirstName}, the following file expires in ${dayWord} for:
    </p>
    <p style="color: #1B1B1B; font-size: 22.5px; line-height: 1.6; text-align: center; font-weight: 700; margin: 0 0 32px;">
      ${safeAddress}${safeCityStateZip ? `,<br />\n      ${safeCityStateZip}` : ""}
    </p>
    <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: center; margin: 0;">
      Please review your file and take any necessary action!
    </p>
  `;
  const html = emailLayout({
    heading: "",
    bodyHtml,
    ctaLabel: "View File",
    ctaHref: `${process.env.NEXTAUTH_URL}/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
  await sendEmail({
    to: opts.agentEmail,
    subject: `File Expiring Soon — ${opts.address}`,
    html,
    stream: "transactional",
  });
}
