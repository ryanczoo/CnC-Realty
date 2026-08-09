process.env.POSTMARK_SERVER_TOKEN = "test-key";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { sendEmail } from "@/lib/email/send";
import { sendPropertyAlertEmail } from "@/lib/email/property-alert-email";

const ONE_LISTING = [
  {
    address: "123 Main St",
    city: "Pasadena",
    listPrice: 950000,
    mlsNumber: "ML123",
    photoUrl: null,
  },
];

describe("sendPropertyAlertEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emails the matching listings on the broadcast stream", async () => {
    await sendPropertyAlertEmail("buyer@example.com", "Jordan", ONE_LISTING);

    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0][0];

    expect(call.to).toBe("buyer@example.com");
    expect(call.subject).toBe("New listings matching your search");
    expect(call.stream).toBe("broadcast");
    // No override — the seam supplies the default noreply@ FROM.
    expect(call.from).toBeUndefined();
    expect(call.html).toContain("Jordan");
    expect(call.html).toContain("123 Main St");
    expect(call.html).toContain("Pasadena");
  });

  it("skips the send entirely when no API key is configured", async () => {
    const original = process.env.POSTMARK_SERVER_TOKEN;
    delete process.env.POSTMARK_SERVER_TOKEN;

    try {
      await sendPropertyAlertEmail("buyer@example.com", "Jordan", ONE_LISTING);
      expect(sendEmail).not.toHaveBeenCalled();
    } finally {
      process.env.POSTMARK_SERVER_TOKEN = original;
    }
  });
});
