import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sendgrid/mail", () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue(undefined) },
}));

import sgMail from "@sendgrid/mail";
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

  it("sends from the shared branded FROM object, not a bare address", async () => {
    await sendSubmitForReview({
      fileType: "Transaction",
      address: "123 Main St",
      agentName: "Jane Agent",
      fileId: "f1",
    });

    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(call.from).toEqual({ email: "noreply@cncrealtygroup.com", name: "CnC Realty" });
  });

  it("builds links from NEXTAUTH_URL, not a hardcoded production domain", async () => {
    await sendFileClosed({
      agentEmail: "jane@example.com",
      agentName: "Jane Agent",
      address: "123 Main St",
      fileType: "transaction",
      fileId: "f1",
    });

    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;
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

    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;
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

    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;
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

    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;
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

    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(call.subject).not.toContain("null");
    expect(call.text).not.toContain("null");
  });
});
