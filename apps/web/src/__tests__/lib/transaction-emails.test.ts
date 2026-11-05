import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { sendEmail } from "@/lib/email/send";
import {
  sendSubmitForReview,
  sendCancellationRequested,
  sendCommissionChangeRequest,
  sendCommissionChangeRejected,
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

  it("sendSubmitForReview renders the shared 33px heading style, not the generic 22px emailLayout heading", async () => {
    await sendSubmitForReview({
      fileType: "Transaction",
      address: "123 Main St",
      agentName: "Jane Agent",
      fileId: "f1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain("font-size: 33px");
    expect(call.html).toContain("Transaction File Ready for Review");
    expect(call.html).not.toContain("font-size: 22px");
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
      'Hi Jane Agent, the following document was rejected for your transaction at <strong style="color: #1B1B1B;">123 Main St</strong>:'
    );
    expect(html).toContain('Document: <strong style="color: #1B1B1B;">RFA</strong><br />');
    expect(html).toContain('Reason: <strong style="color: #1B1B1B;">missing signature</strong>');
    expect(html).toContain(
      'Please re-upload the document with the necessary corrections or <a href="mailto:ryanchong@cncrealtygroup.com" style="color: #9E8C61;">reach out</a> for help!'
    );
    expect(html).toContain(
      '<h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 24px; text-align: center;">'
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
      '<h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 24px; text-align: center;">'
    );
    expect(html).toContain("Hi Jane Agent, all required documents have been approved for your transaction at:");
    expect(html).toMatch(
      /<p style="color: #1B1B1B; font-size: 22\.5px; line-height: 1\.6; text-align: center; font-weight: 700; margin: 0 0 32px;">\s*123 Main St,<br \/>\s*Los Angeles, CA 90012\s*<\/p>/
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
      '<h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 24px; text-align: center;">'
    );
    expect(html).toContain("Hi Jane, the following file has been marked CLOSED for:");
    expect(html).not.toContain("Hi Jane Agent");
    expect(html).toMatch(
      /<p style="color: #1B1B1B; font-size: 22\.5px; line-height: 1\.6; text-align: center; font-weight: 700; margin: 0 0 32px;">\s*123 Main St,<br \/>\s*Los Angeles, CA 90012\s*<\/p>/
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
      '<h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 24px; text-align: center;">'
    );
    expect(html).toContain("Hi Jane, the following file expires in 3 days for:");
    expect(html).not.toContain("Hi Jane Agent");
    expect(html).toMatch(
      /<p style="color: #1B1B1B; font-size: 22\.5px; line-height: 1\.6; text-align: center; font-weight: 700; margin: 0 0 32px;">\s*123 Main St,<br \/>\s*Los Angeles, CA 90012\s*<\/p>/
    );
    expect(html).toContain("Please review your file and take any necessary action!");
    expect(html).not.toContain("Please take action.");
    expect(html).not.toContain("font-size: 15px");
  });
});

describe("transaction-emails — wording follows the file type", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  it("the rejection email says 'transaction' for a transaction file", async () => {
    await sendDocumentRejected({
      agentEmail: "a@example.com", agentName: "Jane", documentName: "TDS.pdf",
      address: "1 Main St", rejectionNote: "Blurry scan", fileType: "transaction", fileId: "f1",
    });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html;
    expect(html).toContain("your transaction at");
    expect(html).not.toContain("your listing at");
  });

  it("the rejection email still says 'listing' for a listing file", async () => {
    await sendDocumentRejected({
      agentEmail: "a@example.com", agentName: "Jane", documentName: "LL.pdf",
      address: "1 Main St", rejectionNote: "Unsigned", fileType: "listing", fileId: "f1",
    });
    expect(vi.mocked(sendEmail).mock.calls[0][0].html).toContain("your listing at");
  });

  it("the all-approved email says 'transaction' for a transaction file", async () => {
    await sendAllDocsApproved({
      agentEmail: "a@example.com", agentName: "Jane", address: "1 Main St",
      fileType: "transaction", fileId: "f1",
    });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html;
    expect(html).toContain("for your transaction at");
    expect(html).not.toContain("for your listing at");
  });

  it("the all-approved email still says 'listing' for a listing file", async () => {
    await sendAllDocsApproved({
      agentEmail: "a@example.com", agentName: "Jane", address: "1 Main St",
      fileType: "listing", fileId: "f1",
    });
    expect(vi.mocked(sendEmail).mock.calls[0][0].html).toContain("for your listing at");
  });

  it("sendFileClosed says congratulations for a real close, with no previousStatus given", async () => {
    await sendFileClosed({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      address: "123 Main St",
      fileType: "transaction",
      fileId: "f1",
    });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    expect(html).toContain("Congratulations - it's time to celebrate!");
    expect(html).not.toContain("So close!");
  });

  it("sendFileClosed says congratulations when the file closed from PENDING", async () => {
    await sendFileClosed({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      address: "123 Main St",
      fileType: "transaction",
      fileId: "f1",
      previousStatus: "PENDING",
    });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    expect(html).toContain("Congratulations - it's time to celebrate!");
  });

  it("sendFileClosed wishes good luck instead when the file closed from EXPIRED", async () => {
    await sendFileClosed({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      address: "123 Main St",
      fileType: "listing",
      fileId: "f1",
      previousStatus: "EXPIRED",
    });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    expect(html).toContain("So close! We wish you the best of luck on your next transaction.");
    expect(html).not.toContain("Congratulations - it's time to celebrate!");
  });

  it("sendFileClosed wishes good luck instead when the file closed from REFERRAL_UNSUCCESSFUL", async () => {
    await sendFileClosed({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      address: null,
      fileType: "transaction",
      fileId: "f1",
      previousStatus: "REFERRAL_UNSUCCESSFUL",
    });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    expect(html).toContain("So close! We wish you the best of luck on your next transaction.");
    expect(html).not.toContain("Congratulations - it's time to celebrate!");
  });
});

describe("broker email subjects have no [CnC] prefix", () => {
  beforeEach(() => vi.mocked(sendEmail).mockClear());

  it("File Ready for Review", async () => {
    await sendSubmitForReview({ fileType: "Transaction", address: "1 Main St", agentName: "Ann", fileId: "t1" });
    expect(vi.mocked(sendEmail).mock.calls[0][0].subject).toBe("Transaction File Ready for Review — 1 Main St");
  });

  it("Cancellation Requested", async () => {
    await sendCancellationRequested({ address: "1 Main St", agentName: "Ann", reason: "Fell through", fileId: "t1" });
    expect(vi.mocked(sendEmail).mock.calls[0][0].subject).toBe("Cancellation Requested — 1 Main St");
  });
});

describe("sendSubmitForReview photo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the review photo between the logo and the heading, like the other photo emails", async () => {
    await sendSubmitForReview({ fileType: "Listing", address: "12 Oak Ave", agentName: "Jane Agent", fileId: "l1" });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    const logoIndex = html.indexOf("logo-black.png");
    const photoIndex = html.indexOf("/submit-review-photo.jpg");
    const headingIndex = html.indexOf("Listing File Ready for Review");
    expect(logoIndex).toBeGreaterThan(-1);
    expect(photoIndex).toBeGreaterThan(logoIndex);
    expect(headingIndex).toBeGreaterThan(photoIndex);
  });
});

describe("sendCommissionChangeRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  const changes = [
    { label: "Sale Commission %", from: "2.5%", to: "3%" },
    { label: "Listing Commission $", from: "$10,000", to: "$12,000" },
  ];

  it("goes to the broker on the transactional stream with the right subject", async () => {
    await sendCommissionChangeRequest({ fileType: "Transaction", address: "1 Main St", agentName: "Ann", fileId: "t1", changes });
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("info@cncrealtygroup.com");
    expect(call.stream).toBe("transactional");
    expect(call.subject).toBe("Commission Change Request — 1 Main St");
  });

  it("shows heading, photo, property, and every change as label: from → to", async () => {
    await sendCommissionChangeRequest({ fileType: "Listing", address: "1 Main St", agentName: "Ann", fileId: "l1", changes });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    expect(html).toContain("Commission Change Request");
    expect(html).toContain("http://localhost:3000/commission-change-photo.jpg");
    expect(html).toContain("changed the commission on a listing file.");
    expect(html).toContain("1 Main St");
    expect(html).toContain("Sale Commission %: 2.5% → 3%");
    expect(html).toContain("Listing Commission $: $10,000 → $12,000");
  });

  it("links the Review Change button to the admin file page", async () => {
    await sendCommissionChangeRequest({ fileType: "Transaction", address: "1 Main St", agentName: "Ann", fileId: "t1", changes });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    expect(html).toContain("Review Change");
    expect(html).toContain("http://localhost:3000/admin/transactions/transaction/t1");
  });

  it("escapes the agent name once, never twice, and falls back when there is no address", async () => {
    await sendCommissionChangeRequest({ fileType: "Transaction", address: null, agentName: "O'Brien", fileId: "t1", changes });
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain("O&#39;Brien");
    expect(call.html).not.toContain("&amp;#39;");
    expect(call.html).toContain("this referral file");
    expect(call.subject).toBe("Commission Change Request — this referral file");
  });

  it("escapes a change label in the request email", async () => {
    await sendCommissionChangeRequest({ fileType: "Transaction", address: "1 Main St", agentName: "Ann", fileId: "t1", changes: [{ label: "A <b>x</b>", from: "1", to: "2" }] });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    expect(html).toContain("A &lt;b&gt;x&lt;/b&gt;: 1 → 2");
    expect(html).not.toContain("<b>x</b>");
  });
});

describe("sendCommissionChangeRejected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  });

  const base = {
    agentEmail: "ann@example.com",
    agentName: "Ann",
    fileType: "Transaction" as const,
    address: "1 Main St",
    fileId: "t1",
    reason: "Not agreed with seller",
    changes: [{ label: "Sale Commission %", from: "2.5%", to: "3%" }],
  };

  it("goes to the agent on the transactional stream", async () => {
    await sendCommissionChangeRejected(base);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("ann@example.com");
    expect(call.stream).toBe("transactional");
    expect(call.subject).toContain("1 Main St");
  });

  it("shows heading, rejection photo, the reverted change (to → from) and the reason", async () => {
    await sendCommissionChangeRejected(base);
    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    expect(html).toContain("Commission Change Not Approved");
    expect(html).toContain("http://localhost:3000/document-correction-photo.jpg");
    expect(html).toContain("1 Main St");
    expect(html).toContain("Sale Commission %: 3% → 2.5%");
    expect(html).toContain("Reason: <em>Not agreed with seller</em>");
  });

  it("links View File to the agent dashboard file page", async () => {
    await sendCommissionChangeRejected({ ...base, fileType: "Listing", fileId: "l9" });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    expect(html).toContain("View File");
    expect(html).toContain("http://localhost:3000/dashboard/transactions/listing/l9");
  });

  it("escapes the reason once and falls back when there is no address", async () => {
    await sendCommissionChangeRejected({ ...base, address: null, reason: "It's <b>no</b>" });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    expect(html).toContain("It&#39;s &lt;b&gt;no&lt;/b&gt;");
    expect(html).not.toContain("&amp;#39;");
    expect(html).toContain("this referral file");
  });

  it("escapes a change label in the rejection email", async () => {
    await sendCommissionChangeRejected({ ...base, changes: [{ label: "A <b>x</b>", from: "1", to: "2" }] });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    expect(html).toContain("A &lt;b&gt;x&lt;/b&gt;: 2 → 1");
    expect(html).not.toContain("<b>x</b>");
  });

  it("escapes the agent name once in the greeting", async () => {
    await sendCommissionChangeRejected({ ...base, agentName: "O'Brien" });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    expect(html).toContain("Hi O&#39;Brien, your commission change on");
    expect(html).not.toContain("&amp;#39;");
  });

  it("uses the dashed subject with the address", async () => {
    await sendCommissionChangeRejected({ ...base, address: "11538 Foster Road" });
    expect(vi.mocked(sendEmail).mock.calls[0][0].subject).toBe("Commission Change Not Approved — 11538 Foster Road");
  });

  it("a listing rejection links to the listing file page", async () => {
    await sendCommissionChangeRejected({ ...base, fileType: "Listing", fileId: "l9" });
    expect(vi.mocked(sendEmail).mock.calls[0][0].html).toContain("/dashboard/transactions/listing/");
  });

  it("says was not approved. and drops the old back-to-what-it-was wording", async () => {
    await sendCommissionChangeRejected(base);
    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    expect(html).toContain("was not approved.");
    expect(html).not.toContain("back to what it was");
  });
});
