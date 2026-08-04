process.env.SENDGRID_API_KEY = "test-key";
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sendgrid/mail", () => ({ default: { setApiKey: vi.fn(), send: vi.fn() } }));

import sgMail from "@sendgrid/mail";
import { sendDeadlineReminder } from "@/lib/deadline-email";

describe("sendDeadlineReminder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes a matching plain-text part alongside the HTML", async () => {
    vi.mocked(sgMail.send).mockResolvedValue(undefined as any);

    await sendDeadlineReminder({
      agentEmail: "agent@example.com",
      agentName: "Jane",
      address: "123 Main St",
      label: "Inspection Deadline",
      date: new Date("2026-08-10T00:00:00.000Z"),
      daysOut: 3,
    });

    expect(sgMail.send).toHaveBeenCalledOnce();
    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;

    expect(call.text).toContain("Jane");
    expect(call.text).toContain("Inspection Deadline");
    expect(call.text).toContain("123 Main St");
    expect(call.text).not.toMatch(/<[^>]+>/);
  });
});
