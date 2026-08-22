process.env.POSTMARK_SERVER_TOKEN = "test-key";
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { sendEmail } from "@/lib/email/send";
import {
  sendApprovalDocuments,
  sendPasswordReset,
  sendAnnouncement,
  sendLeadNotification,
  sendApplicationNotification,
  sendApplicationApproved,
  sendApplicationRejected,
  emailLayout,
} from "@/lib/email";

describe("sendApprovalDocuments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends one email to the agent with the W-9 and Office Policy Manual attached", async () => {
    await sendApprovalDocuments("jane@example.com", "Jane");

    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0][0];

    expect(call.to).toBe("jane@example.com");
    expect(call.replyTo).toBe("info@cncrealtygroup.com");
    expect(call.stream).toBe("transactional");
    expect(call.html).toContain("Jane");

    expect(call.attachments).toHaveLength(2);
    for (const attachment of call.attachments!) {
      expect(attachment.contentType).toBe("application/pdf");
      expect(typeof attachment.content).toBe("string");
      expect(attachment.content.length).toBeGreaterThan(100);
    }
    const filenames = call.attachments!.map((a) => a.filename);
    expect(filenames.some((f) => /w-?9/i.test(f))).toBe(true);
    expect(filenames.some((f) => /office policy manual/i.test(f))).toBe(true);
  });
});

describe("sendAnnouncement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emails every recipient individually from info@cncrealtygroup.com", async () => {
    await sendAnnouncement(
      ["agent1@example.com", "agent2@example.com"],
      "Office Closed Monday",
      "We will be closed for the holiday."
    );

    expect(sendEmail).toHaveBeenCalledTimes(2);

    const calls = vi.mocked(sendEmail).mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.to).sort()).toEqual(["agent1@example.com", "agent2@example.com"]);
    for (const call of calls) {
      expect(call.from).toEqual({ email: "info@cncrealtygroup.com", name: "CnC Realty" });
      expect(call.stream).toBe("transactional");
      expect(call.subject).toBe("Office Closed Monday");
      expect(call.html).toContain("Office Closed Monday");
      expect(call.html).toContain("We will be closed for the holiday.");
    }
  });
});

describe("sendPasswordReset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emails the reset link to the given address", async () => {
    await sendPasswordReset("jane@example.com", "http://localhost:3000/reset-password?token=abc123");

    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0][0];

    expect(call.to).toBe("jane@example.com");
    expect(call.stream).toBe("transactional");
    // No override — the seam supplies the default noreply@ FROM.
    expect(call.from).toBeUndefined();
    expect(call.html).toContain("http://localhost:3000/reset-password?token=abc123");
  });
});

describe("sendLeadNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("notifies the brokerage inbox with the lead's details", async () => {
    await sendLeadNotification({
      firstName: "Jordan",
      lastName: "Lee",
      email: "jordan@example.com",
      phone: "555-1234",
      notes: "Interested in Pasadena listings",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("info@cncrealtygroup.com");
    expect(call.stream).toBe("transactional");
    expect(call.html).toContain("Jordan Lee");
    expect(call.html).toContain("jordan@example.com");
    expect(call.html).toContain("Interested in Pasadena listings");
  });
});

describe("sendApplicationNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("notifies the brokerage inbox with the applicant's details", async () => {
    await sendApplicationNotification({
      id: "app-1",
      firstName: "Jane",
      lastName: "Agent",
      email: "jane@example.com",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("info@cncrealtygroup.com");
    expect(call.stream).toBe("transactional");
    expect(call.html).toContain("Jane Agent");
    expect(call.html).toContain("jane@example.com");
  });
});

describe("sendApplicationApproved", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emails the applicant their account setup link", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("jane@example.com");
    expect(call.stream).toBe("transactional");
    expect(call.html).toContain("Jane");
    expect(call.html).toContain("http://localhost:3000/setup-account?token=abc");
  });
});

describe("sendApplicationRejected", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emails the applicant the rejection reason", async () => {
    await sendApplicationRejected("jane@example.com", "Jane", "Not enough experience");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("jane@example.com");
    expect(call.stream).toBe("transactional");
    expect(call.html).toContain("Not enough experience");
  });
});

describe("emailLayout", () => {
  const html = () => emailLayout({ heading: "Test Heading", bodyHtml: "<p>Body</p>" });

  it("uses the site's off-white background instead of pure white", () => {
    expect(html()).toContain("#F2F0EF");
  });

  it("loads Inter from Google Fonts with a system fallback stack", () => {
    const result = html();
    expect(result).toContain("fonts.googleapis.com/css2?family=Inter");
    expect(result).toContain("'Inter', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif");
  });

  it("includes social icon links below the footer signature", () => {
    const result = html();

    expect(result).toContain('href="https://www.facebook.com/CnCRealtyGroup"');
    expect(result).toContain('href="https://www.instagram.com/cncrealty"');
    expect(result).toContain('href="https://www.youtube.com/@CnCRealtyGroup"');
    expect(result).toContain("/icon-facebook.png");
    expect(result).toContain("/icon-instagram.png");
    expect(result).toContain("/icon-youtube.png");

    const footerIndex = result.indexOf("The CnC Realty Team");
    const iconsIndex = result.indexOf("/icon-facebook.png");
    expect(footerIndex).toBeGreaterThan(-1);
    expect(iconsIndex).toBeGreaterThan(footerIndex);
  });

  it("keeps only the header/footer margins off-white, with a white content card in between", () => {
    const result = html();
    // The page canvas (body + outer wrapper) stays off-white -- that's what
    // shows behind the logo header and the footer/social-icons area, since
    // neither of those gets its own contrasting background.
    expect(result).toMatch(/<body[^>]*background-color:\s*#F2F0EF/i);
    // But the heading + body content sits inside its own white card, not
    // directly on the off-white page background.
    expect(result).toMatch(/background-color:\s*#ffffff/i);
  });

  it("uses the black logo, not the gold one", () => {
    expect(html()).toContain("logo-black.png");
    expect(html()).not.toContain("logo-gold.png");
  });

  it("renders the YouTube icon larger than Facebook and Instagram so they read as the same visual size", () => {
    const result = html();
    const widthOf = (file: string) => {
      const match = result.match(new RegExp(`${file}"[^>]*width="(\\d+)"`));
      if (!match) throw new Error(`no width found for ${file}`);
      return Number(match[1]);
    };

    const fbWidth = widthOf("icon-facebook\\.png");
    const igWidth = widthOf("icon-instagram\\.png");
    const ytWidth = widthOf("icon-youtube\\.png");

    expect(fbWidth).toBe(igWidth);
    expect(ytWidth).toBeGreaterThan(fbWidth);
  });

  it("vertically centers the social icons so different-sized icons stay level with each other", () => {
    const result = html();
    const iconImgTags = result.match(/<img src="[^"]*icon-[a-z]+\.png"[^>]*>/g) ?? [];
    expect(iconImgTags).toHaveLength(3);
    for (const tag of iconImgTags) {
      expect(tag).toMatch(/vertical-align:\s*middle/);
    }
  });
});
