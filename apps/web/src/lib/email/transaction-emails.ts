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
  const safeNote = escapeHtml(opts.rejectionNote);
  const bodyHtml = `
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: center; margin: 0;">
      Hi ${safeAgentName}, the document
      <strong style="color: #1B1B1B;">${safeDocumentName}</strong> on your file for
      <strong style="color: #1B1B1B;">${safeAddress}</strong> was rejected by the broker.
    </p>
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: center; margin: 12px 0 0;">
      Reason: <strong style="color: #1B1B1B;">${safeNote}</strong>
    </p>
  `;
  const html = emailLayout({
    heading: "Document Rejected",
    bodyHtml,
    ctaLabel: "Re-upload Document",
    ctaHref: `${process.env.NEXTAUTH_URL}/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
  await sendEmail({
    to: opts.agentEmail,
    subject: `[CnC] Document Rejected — ${address}`,
    html,
    stream: "transactional",
  });
}

export async function sendAllDocsApproved(opts: {
  agentEmail: string;
  agentName: string;
  address: string | null;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  const address = opts.address ?? NO_ADDRESS_LABEL;
  const safeAgentName = escapeHtml(opts.agentName);
  const safeAddress = escapeHtml(address);
  const bodyHtml = `
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: center; margin: 0;">
      Hi ${safeAgentName}, all required documents for
      <strong style="color: #1B1B1B;">${safeAddress}</strong> have been approved. The broker can now
      close this file.
    </p>
  `;
  const html = emailLayout({
    heading: "All Documents Approved",
    bodyHtml,
    ctaLabel: "View File",
    ctaHref: `${process.env.NEXTAUTH_URL}/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
  await sendEmail({
    to: opts.agentEmail,
    subject: `[CnC] All Documents Approved — ${address}`,
    html,
    stream: "transactional",
  });
}

export async function sendFileClosed(opts: {
  agentEmail: string;
  agentName: string;
  address: string | null;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  const address = opts.address ?? NO_ADDRESS_LABEL;
  const safeAgentName = escapeHtml(opts.agentName);
  const safeAddress = escapeHtml(address);
  const bodyHtml = `
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: center; margin: 0;">
      Hi ${safeAgentName}, your file for
      <strong style="color: #1B1B1B;">${safeAddress}</strong> has been marked as
      <strong style="color: #1B1B1B;">CLOSED</strong> by the broker. Congratulations!
    </p>
  `;
  const html = emailLayout({
    heading: "File Closed",
    bodyHtml,
    ctaLabel: "View File",
    ctaHref: `${process.env.NEXTAUTH_URL}/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
  await sendEmail({
    to: opts.agentEmail,
    subject: `[CnC] File Closed — ${address}`,
    html,
    stream: "transactional",
  });
}

export async function sendFileExpirationWarning(opts: {
  agentEmail: string;
  agentName: string;
  address: string;
  expiresInDays: number;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  const safeAgentName = escapeHtml(opts.agentName);
  const safeAddress = escapeHtml(opts.address);
  const dayWord = opts.expiresInDays === 1 ? "1 day" : `${opts.expiresInDays} days`;
  const bodyHtml = `
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: center; margin: 0;">
      Hi ${safeAgentName}, your file for
      <strong style="color: #1B1B1B;">${safeAddress}</strong> expires in
      <strong style="color: #1B1B1B;">${dayWord}</strong>. Please take action.
    </p>
  `;
  const html = emailLayout({
    heading: "File Expiring Soon",
    bodyHtml,
    ctaLabel: "View File",
    ctaHref: `${process.env.NEXTAUTH_URL}/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
  await sendEmail({
    to: opts.agentEmail,
    subject: `[CnC] File Expiring Soon — ${opts.address}`,
    html,
    stream: "transactional",
  });
}
