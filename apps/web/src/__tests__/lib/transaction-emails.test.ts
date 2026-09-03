import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { sendEmail } from "@/lib/email/send";
import {
  sendSubmitForReview,
  sendFileClosed,
  sendDocumentRejected,
  sendAllDocsApproved,
  sendFileExpirationWarning,
} from "@/lib/email/transaction-emails";

describe("transaction-emails — sender identity and links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  it("sends on the transactional stream from the default branded FROM", async () => {
    await sendSubmitForReview({
      fileType: "Transaction",
      address: "123 Main St",
      agentName: "Jane Agent",
      fileId: "f1",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0][0];

    expect(call.to).toBe("info@cncrealtygroup.com");
    expect(call.stream).toBe("transactional");
    // No override — the seam supplies the default noreply@ FROM.
    expect(call.from).toBeUndefined();
  });

  it("wraps the body in the branded emailLayout, same as every other transactional email", async () => {
    await sendSubmitForReview({
      fileType: "Transaction",
      address: "123 Main St",
      agentName: "Jane Agent",
      fileId: "f1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];

    expect(call.html).toContain("Jane Agent");
    expect(call.html).toContain("logo-black.png");
    // No manual text part — the seam derives plain text from the html.
    expect(call.text).toBeUndefined();
  });

  it("builds links from NEXTAUTH_URL, not a hardcoded production domain", async () => {
    await sendFileClosed({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      address: "123 Main St",
      fileType: "transaction",
      fileId: "f1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.stream).toBe("transactional");
    expect(call.html).toContain("http://localhost:3000/dashboard/transactions/transaction/f1");
    expect(call.html).not.toContain("https://cncrealtygroup.com");
  });
});

describe("transaction-emails — referral files with no property address", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  it("sendSubmitForReview falls back to a generic label instead of the literal word 'null'", async () => {
    await sendSubmitForReview({
      fileType: "Transaction",
      address: null,
      agentName: "Jane Agent",
      fileId: "f1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.stream).toBe("transactional");
    expect(call.subject).not.toContain("null");
    expect(call.html).not.toContain("null");
  });

  it("sendDocumentRejected falls back to a generic label instead of the literal word 'null'", async () => {
    await sendDocumentRejected({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      documentName: "RFA",
      address: null,
      rejectionNote: "missing signature",
      fileType: "transaction",
      fileId: "f1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.stream).toBe("transactional");
    expect(call.subject).not.toContain("null");
    expect(call.html).not.toContain("null");
  });

  it("sendDocumentRejected links straight to the Checklist tab, labeled 'View Checklists'", async () => {
    await sendDocumentRejected({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      documentName: "RFA",
      address: "123 Main St",
      rejectionNote: "missing signature",
      fileType: "transaction",
      fileId: "f1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain('href="http://localhost:3000/dashboard/transactions/transaction/f1?tab=checklist"');
    expect(call.html).toContain("View Checklists");
    expect(call.html).not.toContain("Re-upload Document");
  });

  it("sendDocumentRejected uses the reworded body with a Document/Reason block and a mailto 'reach out' link", async () => {
    await sendDocumentRejected({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      documentName: "RFA",
      address: "123 Main St",
      rejectionNote: "missing signature",
      fileType: "transaction",
      fileId: "f1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;

    expect(call.subject).toBe("Document Correction - 123 Main St");
    expect(html).toContain(
      'Hi Jane Agent, the following document was rejected for your listing at <strong style="color: #1B1B1B;">123 Main St</strong>:'
    );
    expect(html).toContain('Document: <strong style="color: #1B1B1B;">RFA</strong><br />');
    expect(html).toContain('Reason: <strong style="color: #1B1B1B;">missing signature</strong>');
    expect(html).toContain(
      'Please re-upload the document with the necessary corrections or <a href="mailto:ryanchong@cncrealtygroup.com" style="color: #9E8C61;">reach out</a> for help!'
    );
    expect(html).toContain(
      '<h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 16px; text-align: center;">'
    );
    expect(html).toContain("Correction Needed");
    expect(html).not.toContain("Document Rejected");
    expect(html).toContain(
      '<p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: center; font-weight: 700; margin: 0 0 32px;">'
    );
    expect(html).not.toContain("font-size: 15px");
  });

  it("sendDocumentRejected strips a trailing period from the rejection reason", async () => {
    await sendDocumentRejected({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      documentName: "RFA",
      address: "123 Main St",
      rejectionNote: "Missing buyer signature on page 2.",
      fileType: "transaction",
      fileId: "f1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain(
      'Reason: <strong style="color: #1B1B1B;">Missing buyer signature on page 2</strong>'
    );
    expect(call.html).not.toContain("page 2.<");
  });

  it("sendDocumentRejected puts the header photo right below the shared logo header, above the heading", async () => {
    await sendDocumentRejected({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      documentName: "RFA",
      address: "123 Main St",
      rejectionNote: "missing signature",
      fileType: "transaction",
      fileId: "f1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;
    const logoIndex = html.indexOf("logo-black.png");
    const photoIndex = html.indexOf("document-correction-photo.jpg");
    const headingIndex = html.indexOf("Correction Needed");

    expect(logoIndex).toBeGreaterThan(-1);
    expect(photoIndex).toBeGreaterThan(logoIndex);
    expect(headingIndex).toBeGreaterThan(photoIndex);
    expect(html).not.toContain("was rejected by the broker");
  });

  it("sendAllDocsApproved falls back to a generic label instead of the literal word 'null'", async () => {
    await sendAllDocsApproved({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      address: null,
      fileType: "transaction",
      fileId: "f1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.stream).toBe("transactional");
    expect(call.subject).not.toContain("null");
    expect(call.html).not.toContain("null");
  });

  it("sendAllDocsApproved reuses the document-rejected photo at the same dimensions, below the header", async () => {
    await sendAllDocsApproved({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      address: "123 Main St",
      fileType: "transaction",
      fileId: "f1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;
    const logoIndex = html.indexOf("logo-black.png");
    const photoIndex = html.indexOf("document-rejected-photo.jpg");
    const headingIndex = html.indexOf("All Documents Approved");

    expect(logoIndex).toBeGreaterThan(-1);
    expect(photoIndex).toBeGreaterThan(logoIndex);
    expect(headingIndex).toBeGreaterThan(photoIndex);
    expect(html).toContain('<img src="http://localhost:3000/document-rejected-photo.jpg" alt="" width="100%" style="display: block; width: 100%; border-radius: 8px; border: 0;" />');
  });

  it("sendAllDocsApproved matches Correction Needed's heading size, uses the new subject, and splits the address like the deadline reminder", async () => {
    await sendAllDocsApproved({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      address: "123 Main St",
      city: "Los Angeles",
      state: "CA",
      zip: "90012",
      fileType: "transaction",
      fileId: "f1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;

    expect(call.subject).toBe("Documents Approved - 123 Main St");
    expect(html).toContain(
      '<h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 16px; text-align: center;">'
    );
    expect(html).toContain("Hi Jane Agent, all required documents have been approved for your listing at:");
    expect(html).toContain(
      '<p style="color: #1B1B1B; font-size: 22.5px; line-height: 1.6; text-align: center; font-weight: 700; margin: 0 0 32px;">\n      123 Main St,<br />\n      Los Angeles, CA 90012\n    </p>'
    );
    expect(html).toContain("The broker can now close this file.");
    expect(html).not.toContain("font-size: 15px");
    expect(html).not.toContain("[CnC]");
  });

  it("sendFileClosed falls back to a generic label instead of the literal word 'null'", async () => {
    await sendFileClosed({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      address: null,
      fileType: "transaction",
      fileId: "f1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.stream).toBe("transactional");
    expect(call.subject).not.toContain("null");
    expect(call.html).not.toContain("null");
  });

  it("sendFileClosed uses the new photo/heading/subject/copy, greets by first name, and bolds the address like sendAllDocsApproved", async () => {
    await sendFileClosed({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      address: "123 Main St",
      city: "Los Angeles",
      state: "CA",
      zip: "90012",
      fileType: "transaction",
      fileId: "f1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;
    const logoIndex = html.indexOf("logo-black.png");
    const photoIndex = html.indexOf("file-closed-photo.jpg");
    const headingIndex = html.indexOf("File Closed");

    expect(call.subject).toBe("File Closed - 123 Main St");
    expect(logoIndex).toBeGreaterThan(-1);
    expect(photoIndex).toBeGreaterThan(logoIndex);
    expect(headingIndex).toBeGreaterThan(photoIndex);
    expect(html).toContain(
      '<h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 16px; text-align: center;">'
    );
    expect(html).toContain("Hi Jane, the following file has been marked CLOSED for:");
    expect(html).not.toContain("Hi Jane Agent");
    expect(html).toContain(
      '<p style="color: #1B1B1B; font-size: 22.5px; line-height: 1.6; text-align: center; font-weight: 700; margin: 0 0 32px;">\n      123 Main St,<br />\n      Los Angeles, CA 90012\n    </p>'
    );
    expect(html).toContain("Congratulations - it's time to celebrate!");
    expect(html).not.toContain("has been marked as");
    expect(html).not.toContain("by the broker. Congratulations!");
    expect(html).not.toContain("font-size: 15px");
  });
});

// The fifth sender. Every transaction email must stay on the transactional
// stream — routing any of them to broadcast would be a deliverability
// regression, so each sender carries its own assertion.
describe("transaction-emails — sendFileExpirationWarning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  it("sends on the transactional stream", async () => {
    await sendFileExpirationWarning({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      address: "123 Main St",
      expiresInDays: 3,
      fileType: "transaction",
      fileId: "f1",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0][0];

    expect(call.to).toBe("jane@example.com");
    expect(call.stream).toBe("transactional");
    expect(call.html).toContain("3 day");
    expect(call.html).toContain("logo-black.png");
    expect(call.text).toBeUndefined();
  });

  it("uses the new photo/heading, greets by first name, and bolds the address like sendAllDocsApproved", async () => {
    await sendFileExpirationWarning({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      address: "123 Main St",
      city: "Los Angeles",
      state: "CA",
      zip: "90012",
      expiresInDays: 3,
      fileType: "listing",
      fileId: "f1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;
    const logoIndex = html.indexOf("logo-black.png");
    const photoIndex = html.indexOf("file-expiring-photo.jpg");
    const headingIndex = html.indexOf("File Expiring Soon");

    expect(logoIndex).toBeGreaterThan(-1);
    expect(photoIndex).toBeGreaterThan(logoIndex);
    expect(headingIndex).toBeGreaterThan(photoIndex);
    expect(html).toContain(
      '<h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 16px; text-align: center;">'
    );
    expect(html).toContain("Hi Jane, the following file expires in 3 days for:");
    expect(html).not.toContain("Hi Jane Agent");
    expect(html).toContain(
      '<p style="color: #1B1B1B; font-size: 22.5px; line-height: 1.6; text-align: center; font-weight: 700; margin: 0 0 32px;">\n      123 Main St,<br />\n      Los Angeles, CA 90012\n    </p>'
    );
    expect(html).toContain("Please review your file and take any necessary action!");
    expect(html).not.toContain("Please take action.");
    expect(html).not.toContain("font-size: 15px");
  });
});
