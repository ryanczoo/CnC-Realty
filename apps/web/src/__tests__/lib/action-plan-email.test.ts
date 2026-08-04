process.env.SENDGRID_API_KEY = "test-key";
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sendgrid/mail", () => ({ default: { setApiKey: vi.fn(), send: vi.fn() } }));

import sgMail from "@sendgrid/mail";
import { sendActionPlanEmail } from "@/lib/action-plan-email";

describe("sendActionPlanEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("wraps the body in the branded emailLayout and includes a matching plain-text part", async () => {
    vi.mocked(sgMail.send).mockResolvedValue(undefined as any);

    await sendActionPlanEmail({
      to: "jordan@example.com",
      subject: "Still thinking about your next home?",
      body: "Hi Jordan,\n\nI wanted to follow up on your interest.\n\nBest,\nRyan",
      enrollmentId: "enr-1",
    });

    expect(sgMail.send).toHaveBeenCalledOnce();
    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;

    expect(call.replyTo).toBe("reply+enr-1@reply.cncrealtygroup.com");
    expect(call.subject).toBe("Still thinking about your next home?");
    // Branded: heading appears, logo image present, body content preserved
    expect(call.html).toContain("Still thinking about your next home?");
    expect(call.html).toContain("logo-gold.png");
    expect(call.html).toContain("I wanted to follow up on your interest.");
    expect(call.text).toContain("I wanted to follow up on your interest.");
    expect(call.text).not.toMatch(/<[^>]+>/);
  });
});
