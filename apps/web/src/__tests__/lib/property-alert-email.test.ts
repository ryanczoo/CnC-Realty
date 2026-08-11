process.env.POSTMARK_SERVER_TOKEN = "test-key";
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.NEXTAUTH_SECRET = "test-secret";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { sendEmail } from "@/lib/email/send";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { sendPropertyAlertEmail } from "@/lib/email/property-alert-email";

/** The category the footer link will actually opt the recipient out of. */
function footerCategory(html: string): string | undefined {
  const href = html.match(/href="([^"]+\/unsubscribe\?t=[^"]+)"/)?.[1];
  if (!href) return undefined;
  const token = new URL(href.replace(/&amp;/g, "&")).searchParams.get("t");
  return verifyUnsubscribeToken(token ?? "")?.category;
}

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
    await sendPropertyAlertEmail("buyer@example.com", "Jordan", ONE_LISTING, "user-1");

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

  it("identifies the user so the seam can honour an opt-out", async () => {
    await sendPropertyAlertEmail("buyer@example.com", "Jordan", ONE_LISTING, "user-1");

    // Alerts opt out against User, not Lead — the recipient is a registered
    // account holder with a saved search, not a CRM lead.
    expect(vi.mocked(sendEmail).mock.calls[0][0].recipient).toEqual({
      kind: "user",
      id: "user-1",
    });
  });

  it("puts a visible unsubscribe link in the body", async () => {
    await sendPropertyAlertEmail("buyer@example.com", "Jordan", ONE_LISTING, "user-1");

    expect(vi.mocked(sendEmail).mock.calls[0][0].html).toContain("/unsubscribe?t=");
  });

  it("names property_alert in both the send category and the footer token", async () => {
    await sendPropertyAlertEmail("buyer@example.com", "Jordan", ONE_LISTING, "user-1");

    // Named twice as independent string literals — once in
    // unsubscribeFooterHtml, once in sendEmail. A mismatch type-checks, so
    // both halves are asserted together; the footer half is what actually
    // catches an email whose opt-out link points at the wrong list.
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.category).toBe("property_alert");
    expect(footerCategory(call.html!)).toBe("property_alert");
  });

  it("skips the send entirely when no API key is configured", async () => {
    const original = process.env.POSTMARK_SERVER_TOKEN;
    delete process.env.POSTMARK_SERVER_TOKEN;

    try {
      await sendPropertyAlertEmail("buyer@example.com", "Jordan", ONE_LISTING, "user-1");
      expect(sendEmail).not.toHaveBeenCalled();
    } finally {
      process.env.POSTMARK_SERVER_TOKEN = original;
    }
  });
});
