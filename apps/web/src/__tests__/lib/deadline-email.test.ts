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
      city: "Los Angeles",
      state: "CA",
      zip: "90012",
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

  it("puts the header photo right below the shared logo header, above the heading", async () => {
    await sendDeadlineReminder({
      agentEmail: "agent@example.com",
      agentName: "Jane",
      address: "123 Main St",
      city: "Los Angeles",
      state: "CA",
      zip: "90012",
      label: "Inspection",
      date: new Date("2026-08-10T00:00:00.000Z"),
      daysOut: 3,
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;
    const logoIndex = html.indexOf("logo-black.png");
    const photoIndex = html.indexOf("deadline-reminder-photo.jpg");
    const headingIndex = html.indexOf("Upcoming Deadline");

    expect(logoIndex).toBeGreaterThan(-1);
    expect(photoIndex).toBeGreaterThan(logoIndex);
    expect(headingIndex).toBeGreaterThan(photoIndex);
  });

  it("matches the onboarding email's heading size for 'Upcoming Deadline'", async () => {
    await sendDeadlineReminder({
      agentEmail: "agent@example.com",
      agentName: "Jane",
      address: "123 Main St",
      city: "Los Angeles",
      state: "CA",
      zip: "90012",
      label: "Inspection",
      date: new Date("2026-08-10T00:00:00.000Z"),
      daysOut: 3,
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain(
      '<h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 16px; text-align: center;">'
    );
  });

  it("formats the body as a greeting, a bold address block, then the bold deadline/date line", async () => {
    await sendDeadlineReminder({
      agentEmail: "agent@example.com",
      agentName: "Jane",
      address: "123 Main St",
      city: "Los Angeles",
      state: "CA",
      zip: "90012",
      label: "Inspection",
      date: new Date("2026-08-10T00:00:00.000Z"),
      daysOut: 3,
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;

    expect(html).toContain("Hi Jane, friendly reminder that your listing at:");
    expect(html).toContain(
      '<p style="color: #1B1B1B; font-size: 22.5px; line-height: 1.6; text-align: center; font-weight: 700; margin: 0 0 32px;">\n      123 Main St,<br />\n      Los Angeles, CA 90012\n    </p>'
    );
    expect(html).toContain('has an <strong style="color: #1B1B1B;">Inspection</strong> deadline on <strong style="color: #1B1B1B;">Sunday, August 9</strong>.');
  });

  it("picks 'a' vs 'an' based on the deadline label", async () => {
    await sendDeadlineReminder({
      agentEmail: "agent@example.com",
      agentName: "Jane",
      address: "123 Main St",
      city: "Los Angeles",
      state: "CA",
      zip: "90012",
      label: "Loan Approval",
      date: new Date("2026-08-10T00:00:00.000Z"),
      daysOut: 3,
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain("has a <strong");
    expect(call.html).not.toContain("has an <strong");
  });
});
