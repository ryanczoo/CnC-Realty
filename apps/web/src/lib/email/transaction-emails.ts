import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const FROM = "noreply@cncrealtygroup.com";
const BROKER_EMAIL = "info@cncrealtygroup.com";

export async function sendSubmitForReview(opts: {
  fileType: "Listing" | "Transaction";
  address: string;
  agentName: string;
  fileId: string;
}): Promise<void> {
  await sgMail.send({
    to: BROKER_EMAIL,
    from: FROM,
    subject: `[CnC] ${opts.fileType} File Ready for Review — ${opts.address}`,
    text: `${opts.agentName} has submitted a ${opts.fileType.toLowerCase()} file for compliance review.\n\nProperty: ${opts.address}\n\nReview at: https://cncrealtygroup.com/admin/transactions/${opts.fileType.toLowerCase()}/${opts.fileId}`,
  });
}

export async function sendDocumentRejected(opts: {
  agentEmail: string;
  agentName: string;
  documentName: string;
  address: string;
  rejectionNote: string;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  await sgMail.send({
    to: opts.agentEmail,
    from: FROM,
    subject: `[CnC] Document Rejected — ${opts.address}`,
    text: `Hi ${opts.agentName},\n\nThe document "${opts.documentName}" on your file for ${opts.address} was rejected by the broker.\n\nReason: ${opts.rejectionNote}\n\nPlease re-upload at: https://cncrealtygroup.com/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
}

export async function sendAllDocsApproved(opts: {
  agentEmail: string;
  agentName: string;
  address: string;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  await sgMail.send({
    to: opts.agentEmail,
    from: FROM,
    subject: `[CnC] All Documents Approved — ${opts.address}`,
    text: `Hi ${opts.agentName},\n\nAll required documents for ${opts.address} have been approved. The broker can now close this file.\n\nView file: https://cncrealtygroup.com/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
}

export async function sendFileClosed(opts: {
  agentEmail: string;
  agentName: string;
  address: string;
  fileType: "listing" | "transaction";
  fileId: string;
}): Promise<void> {
  await sgMail.send({
    to: opts.agentEmail,
    from: FROM,
    subject: `[CnC] File Closed — ${opts.address}`,
    text: `Hi ${opts.agentName},\n\nYour file for ${opts.address} has been marked as CLOSED by the broker. Congratulations!\n\nView file: https://cncrealtygroup.com/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
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
    text: `Hi ${opts.agentName},\n\nYour file for ${opts.address} expires in ${opts.expiresInDays} day(s). Please take action.\n\nView file: https://cncrealtygroup.com/dashboard/transactions/${opts.fileType}/${opts.fileId}`,
  });
}
