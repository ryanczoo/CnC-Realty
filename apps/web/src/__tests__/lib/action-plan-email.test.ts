process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.NEXTAUTH_SECRET = "test-secret";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { sendEmail } from "@/lib/email/send";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { sendActionPlanEmail, sendLeadReplyNotification } from "@/lib/action-plan-email";

/** The category the footer link will actually opt the recipient out of. */
function footerCategory(html: string): string | undefined {
  const href = html.match(/href="([^"]+\/unsubscribe\?t=[^"]+)"/)?.[1];
  if (!href) return undefined;
  const token = new URL(href.replace(/&amp;/g, "&")).searchParams.get("t");
  return verifyUnsubscribeToken(token ?? "")?.category;
}

describe("sendActionPlanEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("wraps the body in the branded emailLayout and sends on the broadcast stream", async () => {
    await sendActionPlanEmail({
      to: "jordan@example.com",
      subject: "Still thinking about your next home?",
      body: "Hi Jordan,\n\nI wanted to follow up on your interest.\n\nBest,\nRyan",
      enrollmentId: "enr-1",
      leadId: "lead-1",
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
    expect(call.html).toContain("logo-black.png");
    expect(call.html).toContain("I wanted to follow up on your interest.");
  });

  it("identifies the lead so the seam can honour an opt-out", async () => {
    await sendActionPlanEmail({
      to: "jordan@example.com",
      subject: "Following up",
      body: "hi",
      enrollmentId: "enr-1",
      leadId: "lead-1",
    });

    expect(vi.mocked(sendEmail).mock.calls[0][0].recipient).toEqual({
      kind: "lead",
      id: "lead-1",
    });
  });

  it("puts a visible unsubscribe link in the body", async () => {
    await sendActionPlanEmail({
      to: "jordan@example.com",
      subject: "Following up",
      body: "hi",
      enrollmentId: "enr-1",
      leadId: "lead-1",
    });

    // The List-Unsubscribe header is not enough on its own — CAN-SPAM wants a
    // visible opt-out inside the message.
    expect(vi.mocked(sendEmail).mock.calls[0][0].html).toContain("/unsubscribe?t=");
  });

  it("names action_plan in both the send category and the footer token", async () => {
    await sendActionPlanEmail({
      to: "jordan@example.com",
      subject: "Following up",
      body: "hi",
      enrollmentId: "enr-1",
      leadId: "lead-1",
    });

    // The category is written twice as independent string literals — once in
    // unsubscribeFooterHtml, once in sendEmail. A mismatch type-checks and
    // ships an email whose visible unsubscribe link opts the recipient out of
    // a list the message did not come from. Asserting only one half would not
    // catch that, so both are asserted together.
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.category).toBe("action_plan");
    expect(footerCategory(call.html!)).toBe("action_plan");
  });
});

describe("sendLeadReplyNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the agent's copy on the transactional stream", async () => {
    await sendLeadReplyNotification({
      to: "agent@cncrealtygroup.com",
      subject: "[Lead Reply] Still interested",
      body: "Yes, please call me",
      enrollmentId: "enr-1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];

    // This is the agent's own work landing in their inbox, not marketing.
    // On the broadcast stream a marketing opt-out would silently swallow it.
    expect(call.stream).toBe("transactional");
    expect(call.to).toBe("agent@cncrealtygroup.com");
    expect(call.replyTo).toBe("reply+enr-1@reply.cncrealtygroup.com");
  });

  it("carries no unsubscribe link — the agent cannot opt out of their own leads", async () => {
    await sendLeadReplyNotification({
      to: "agent@cncrealtygroup.com",
      subject: "[Lead Reply] Still interested",
      body: "Yes, please call me",
      enrollmentId: "enr-1",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).not.toContain("/unsubscribe?t=");
    expect(call.recipient).toBeUndefined();
  });
});
