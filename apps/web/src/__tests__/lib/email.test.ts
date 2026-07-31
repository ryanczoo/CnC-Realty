process.env.SENDGRID_API_KEY = "test-key";
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sendgrid/mail", () => ({ default: { setApiKey: vi.fn(), send: vi.fn() } }));

import sgMail from "@sendgrid/mail";
import { sendApprovalDocuments, sendPasswordReset, sendAnnouncement } from "@/lib/email";

describe("sendApprovalDocuments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends one email to the agent with the W-9 and Office Policy Manual attached", async () => {
    vi.mocked(sgMail.send).mockResolvedValue(undefined as any);

    await sendApprovalDocuments("jane@example.com", "Jane");

    expect(sgMail.send).toHaveBeenCalledOnce();
    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;

    expect(call.to).toBe("jane@example.com");
    expect(call.replyTo).toBe("info@cncrealtygroup.com");
    expect(call.html).toContain("Jane");

    expect(call.attachments).toHaveLength(2);
    for (const attachment of call.attachments) {
      expect(attachment.type).toBe("application/pdf");
      expect(attachment.disposition).toBe("attachment");
      expect(typeof attachment.content).toBe("string");
      expect(attachment.content.length).toBeGreaterThan(100);
    }
    const filenames = call.attachments.map((a: any) => a.filename);
    expect(filenames.some((f: string) => /w-?9/i.test(f))).toBe(true);
    expect(filenames.some((f: string) => /office policy manual/i.test(f))).toBe(true);
  });
});

describe("sendAnnouncement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emails every recipient individually from info@cncrealtygroup.com", async () => {
    vi.mocked(sgMail.send).mockResolvedValue(undefined as any);

    await sendAnnouncement(
      ["agent1@example.com", "agent2@example.com"],
      "Office Closed Monday",
      "We will be closed for the holiday."
    );

    expect(sgMail.send).toHaveBeenCalledTimes(2);

    const calls = vi.mocked(sgMail.send).mock.calls.map((c) => c[0] as any);
    expect(calls.map((c) => c.to).sort()).toEqual(["agent1@example.com", "agent2@example.com"]);
    for (const call of calls) {
      expect(call.from).toEqual({ email: "info@cncrealtygroup.com", name: "CnC Realty" });
      expect(call.html).toContain("Office Closed Monday");
      expect(call.html).toContain("We will be closed for the holiday.");
    }
  });
});

describe("sendPasswordReset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emails the reset link to the given address", async () => {
    vi.mocked(sgMail.send).mockResolvedValue(undefined as any);

    await sendPasswordReset("jane@example.com", "http://localhost:3000/reset-password?token=abc123");

    expect(sgMail.send).toHaveBeenCalledOnce();
    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;

    expect(call.to).toBe("jane@example.com");
    expect(call.from).toEqual({ email: "noreply@cncrealtygroup.com", name: "CnC Realty" });
    expect(call.html).toContain("http://localhost:3000/reset-password?token=abc123");
  });
});
