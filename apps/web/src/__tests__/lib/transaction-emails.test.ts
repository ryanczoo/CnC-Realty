import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { sendEmail } from "@/lib/email/send";
import {
  sendSubmitForReview,
  sendFileClosed,
  sendDocumentRejected,
  sendAllDocsApproved,
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

  it("stays text-only — these emails have no html part to render", async () => {
    await sendSubmitForReview({
      fileType: "Transaction",
      address: "123 Main St",
      agentName: "Jane Agent",
      fileId: "f1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];

    expect(call.text).toContain("Jane Agent");
    // An empty html part would render as a blank email in clients that prefer
    // text/html, so these senders must pass no html at all.
    expect(call.html).toBeUndefined();
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
    expect(call.text).toContain("http://localhost:3000/dashboard/transactions/transaction/f1");
    expect(call.text).not.toContain("https://cncrealtygroup.com");
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
    expect(call.subject).not.toContain("null");
    expect(call.text).not.toContain("null");
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
    expect(call.subject).not.toContain("null");
    expect(call.text).not.toContain("null");
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
    expect(call.subject).not.toContain("null");
    expect(call.text).not.toContain("null");
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
    expect(call.subject).not.toContain("null");
    expect(call.text).not.toContain("null");
  });
});
