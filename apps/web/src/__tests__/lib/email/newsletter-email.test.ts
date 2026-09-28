process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.NEXTAUTH_SECRET = "test-secret";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue({ sent: true }) }));

import { sendEmail } from "@/lib/email/send";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { sendNewsletterWelcome } from "@/lib/email/newsletter-email";

/** The category the in-body unsubscribe link will actually opt the reader out of. */
function footerCategory(html: string): string | undefined {
  const href = html.match(/href="([^"]+\/unsubscribe\?t=[^"]+)"/)?.[1];
  if (!href) return undefined;
  const token = new URL(href.replace(/&amp;/g, "&")).searchParams.get("t");
  return verifyUnsubscribeToken(token ?? "")?.category;
}

describe("sendNewsletterWelcome", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the branded welcome on the marketing stream as a newsletter email", async () => {
    await sendNewsletterWelcome({ to: "sam@example.com", leadId: "lead-9" });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call).toMatchObject({
      to: "sam@example.com",
      subject: "Welcome to the CnC Newsletter",
      stream: "broadcast",
      recipient: { kind: "lead", id: "lead-9" },
      category: "newsletter",
    });
    const html = call.html!;
    expect(html).toContain("logo-black.png");
    expect(html).toContain("Welcome to the CnC Newsletter");
    expect(html).toContain("Thanks for subscribing!");
    expect(html).toContain("Visit CnC Realty");
  });

  it("carries an unsubscribe link that opts out of the newsletter only", async () => {
    await sendNewsletterWelcome({ to: "sam@example.com", leadId: "lead-9" });
    expect(footerCategory(vi.mocked(sendEmail).mock.calls[0][0].html!)).toBe("newsletter");
  });
});
