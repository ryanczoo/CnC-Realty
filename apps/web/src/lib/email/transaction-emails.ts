import sgMail from "@sendgrid/mail";
import { FROM } from "@/lib/email";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

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
  await sgMail.send({
    to: BROKER_EMAIL,
    from: FROM,
    subject: `[CnC] ${opts.fileType} File Ready for Review — ${address}`,
    text: `${opts.agentName} has submitted a ${opts.fileType.toLowerCase()} file for compliance review.\n\nProperty: ${address}\n\nReview at: ${process.env.NEXTAUTH_URL}/admin/transactions/${opts.fileType.toLowerCase()}/${opts.fileId}`,
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
  await sgMail.send({
    to: opts.agentEmail,
    from: FROM,
    subject: `[CnC] Document Rejected — ${address}`,
    text: `Hi ${opts.agentName},\n\nThe document "${opts.documentName}" on your file for ${address} was rejected by the broker.\n\nReason: ${opts.rejectionNote}\n\nPlease re-upload at: ${process.env.NEXTAUTH_URL}/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
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
  await sgMail.send({
    to: opts.agentEmail,
    from: FROM,
    subject: `[CnC] All Documents Approved — ${address}`,
    text: `Hi ${opts.agentName},\n\nAll required documents for ${address} have been approved. The broker can now close this file.\n\nView file: ${process.env.NEXTAUTH_URL}/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
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
  await sgMail.send({
    to: opts.agentEmail,
    from: FROM,
    subject: `[CnC] File Closed — ${address}`,
    text: `Hi ${opts.agentName},\n\nYour file for ${address} has been marked as CLOSED by the broker. Congratulations!\n\nView file: ${process.env.NEXTAUTH_URL}/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
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
  await sgMail.send({
    to: opts.agentEmail,
    from: FROM,
    subject: `[CnC] File Expiring Soon — ${opts.address}`,
    text: `Hi ${opts.agentName},\n\nYour file for ${opts.address} expires in ${opts.expiresInDays} day(s). Please take action.\n\nView file: ${process.env.NEXTAUTH_URL}/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
}
