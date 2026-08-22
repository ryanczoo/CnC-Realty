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
    expect(call.html).toContain("logo-gold.png");
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
    expect(call.html).toContain("logo-gold.png");
    expect(call.text).toBeUndefined();
  });
});
