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
      subject: "Heck yeah, You're In!",
      stream: "broadcast",
      recipient: { kind: "lead", id: "lead-9" },
      category: "newsletter",
    });
    const html = call.html!;
    expect(html).toContain("logo-black.png");
    expect(html).toContain("Welcome to our Newsletter!");
    expect(html).toContain(
      "Going forward, we will make sure to only send you exclusive listings and important market updates to keep you ahead of the game."
    );
    expect(html).toContain("Homepage");
    expect(html).not.toContain("Visit CnC Realty");
    expect(html).not.toContain("Thanks for subscribing!");
  });

  it("puts the unsubscribe line under the Homepage button", async () => {
    await sendNewsletterWelcome({ to: "sam@example.com", leadId: "lead-9" });
    const html = vi.mocked(sendEmail).mock.calls[0][0].html!;
    const button = html.indexOf("Homepage");
    const unsubscribe = html.indexOf("Unsubscribe");
    expect(button).toBeGreaterThan(-1);
    expect(unsubscribe).toBeGreaterThan(button);
  });

  it("shows the newsletter hero photo like the other photo emails", async () => {
    await sendNewsletterWelcome({ to: "sam@example.com", leadId: "lead-9" });
    expect(vi.mocked(sendEmail).mock.calls[0][0].html).toContain(
      '<img src="http://localhost:3000/newsletter-welcome-photo.jpg"'
    );
  });

  it("carries an unsubscribe link that opts out of the newsletter only", async () => {
    await sendNewsletterWelcome({ to: "sam@example.com", leadId: "lead-9" });
    expect(footerCategory(vi.mocked(sendEmail).mock.calls[0][0].html!)).toBe("newsletter");
  });
});
