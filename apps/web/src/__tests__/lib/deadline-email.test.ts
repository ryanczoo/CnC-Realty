process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { sendEmail } from "@/lib/email/send";
import { sendDeadlineReminder } from "@/lib/deadline-email";

describe("sendDeadlineReminder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emails the agent the deadline details on the transactional stream", async () => {
    await sendDeadlineReminder({
      agentEmail: "agent@example.com",
      agentName: "Jane",
      address: "123 Main St",
      label: "Inspection Deadline",
      date: new Date("2026-08-10T00:00:00.000Z"),
      daysOut: 3,
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0][0];

    expect(call.to).toBe("agent@example.com");
    expect(call.stream).toBe("transactional");
    // No override — the seam supplies the default noreply@ FROM.
    expect(call.from).toBeUndefined();
    expect(call.subject).toBe("Deadline reminder: Inspection Deadline for 123 Main St");
    expect(call.html).toContain("Jane");
    expect(call.html).toContain("Inspection Deadline");
    expect(call.html).toContain("123 Main St");
  });
});
