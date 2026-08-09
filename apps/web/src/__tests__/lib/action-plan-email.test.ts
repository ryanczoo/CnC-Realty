process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { sendEmail } from "@/lib/email/send";
import { sendActionPlanEmail } from "@/lib/action-plan-email";

describe("sendActionPlanEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("wraps the body in the branded emailLayout and sends on the broadcast stream", async () => {
    await sendActionPlanEmail({
      to: "jordan@example.com",
      subject: "Still thinking about your next home?",
      body: "Hi Jordan,\n\nI wanted to follow up on your interest.\n\nBest,\nRyan",
      enrollmentId: "enr-1",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0][0];

    expect(call.to).toBe("jordan@example.com");
    expect(call.stream).toBe("broadcast");
    // No override — the seam supplies the default noreply@ FROM.
    expect(call.from).toBeUndefined();
    // Per-enrollment reply address: the inbound webhook matches replies back to
    // the enrollment by this local part, so it must survive the seam migration.
    expect(call.replyTo).toBe("reply+enr-1@reply.cncrealtygroup.com");
    expect(call.subject).toBe("Still thinking about your next home?");
    // Branded: heading appears, logo image present, body content preserved
    expect(call.html).toContain("Still thinking about your next home?");
    expect(call.html).toContain("logo-gold.png");
    expect(call.html).toContain("I wanted to follow up on your interest.");
  });
});
