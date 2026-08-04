process.env.SENDGRID_API_KEY = "test-key";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sendgrid/mail", () => ({ default: { setApiKey: vi.fn(), send: vi.fn() } }));

import sgMail from "@sendgrid/mail";
import { sendPropertyAlertEmail } from "@/lib/email/property-alert-email";

describe("sendPropertyAlertEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes a matching plain-text part alongside the HTML", async () => {
    vi.mocked(sgMail.send).mockResolvedValue(undefined as any);

    await sendPropertyAlertEmail("buyer@example.com", "Jordan", [
      {
        address: "123 Main St",
        city: "Pasadena",
        listPrice: 950000,
        mlsNumber: "ML123",
        photoUrl: null,
      },
    ]);

    expect(sgMail.send).toHaveBeenCalledOnce();
    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;

    expect(call.text).toContain("Jordan");
    expect(call.text).toContain("123 Main St");
    expect(call.text).toContain("Pasadena");
    expect(call.text).not.toMatch(/<[^>]+>/);
    // The <head>/<title> content must not leak into the plain-text part
    expect(call.text).not.toContain("New listings matching your search");
  });
});
