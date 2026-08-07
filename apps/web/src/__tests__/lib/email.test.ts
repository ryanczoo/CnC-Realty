process.env.SENDGRID_API_KEY = "test-key";
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sendgrid/mail", () => ({ default: { setApiKey: vi.fn(), send: vi.fn() } }));

import sgMail from "@sendgrid/mail";
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
    vi.mocked(sgMail.send).mockResolvedValue(undefined as any);

    await sendApprovalDocuments("jane@example.com", "Jane");

    expect(sgMail.send).toHaveBeenCalledOnce();
    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;

    expect(call.to).toBe("jane@example.com");
    expect(call.replyTo).toBe("info@cncrealtygroup.com");
    expect(call.html).toContain("Jane");
    expect(call.text).toContain("Jane");
    expect(call.text).not.toMatch(/<[^>]+>/);

    expect(call.attachments).toHaveLength(2);
    for (const attachment of call.attachments) {
      expect(attachment.type).toBe("application/pdf");
      expect(attachment.disposition).toBe("attachment");
      expect(typeof attachment.content).toBe("string");
      expect(attachment.content.length).toBeGreaterThan(100);
    }
    const filenames = call.attachments.map((a: any) => a.filename);
    expect(filenames.some((f: string) => /w-?9/i.test(f))).toBe(true);
    expect(filenames.some((f: string) => /office policy manual/i.test(f))).toBe(true);
  });
});

describe("sendAnnouncement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emails every recipient individually from info@cncrealtygroup.com", async () => {
    vi.mocked(sgMail.send).mockResolvedValue(undefined as any);

    await sendAnnouncement(
      ["agent1@example.com", "agent2@example.com"],
      "Office Closed Monday",
      "We will be closed for the holiday."
    );

    expect(sgMail.send).toHaveBeenCalledTimes(2);

    const calls = vi.mocked(sgMail.send).mock.calls.map((c) => c[0] as any);
    expect(calls.map((c) => c.to).sort()).toEqual(["agent1@example.com", "agent2@example.com"]);
    for (const call of calls) {
      expect(call.from).toEqual({ email: "info@cncrealtygroup.com", name: "CnC Realty" });
      expect(call.html).toContain("Office Closed Monday");
      expect(call.html).toContain("We will be closed for the holiday.");
      expect(call.text).toContain("Office Closed Monday");
      expect(call.text).toContain("We will be closed for the holiday.");
      expect(call.text).not.toMatch(/<[^>]+>/);
    }
  });
});

describe("sendPasswordReset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emails the reset link to the given address", async () => {
    vi.mocked(sgMail.send).mockResolvedValue(undefined as any);

    await sendPasswordReset("jane@example.com", "http://localhost:3000/reset-password?token=abc123");

    expect(sgMail.send).toHaveBeenCalledOnce();
    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;

    expect(call.to).toBe("jane@example.com");
    expect(call.from).toEqual({ email: "noreply@cncrealtygroup.com", name: "CnC Realty" });
    expect(call.html).toContain("http://localhost:3000/reset-password?token=abc123");
    expect(call.text).toContain("http://localhost:3000/reset-password?token=abc123");
    expect(call.text).not.toMatch(/<[^>]+>/);
  });
});

describe("sendLeadNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes a matching plain-text part alongside the HTML", async () => {
    vi.mocked(sgMail.send).mockResolvedValue(undefined as any);

    await sendLeadNotification({
      firstName: "Jordan",
      lastName: "Lee",
      email: "jordan@example.com",
      phone: "555-1234",
      notes: "Interested in Pasadena listings",
    });

    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(call.text).toContain("Jordan Lee");
    expect(call.text).toContain("jordan@example.com");
    expect(call.text).toContain("Interested in Pasadena listings");
    expect(call.text).not.toMatch(/<[^>]+>/);
  });
});

describe("sendApplicationNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes a matching plain-text part alongside the HTML", async () => {
    vi.mocked(sgMail.send).mockResolvedValue(undefined as any);

    await sendApplicationNotification({
      id: "app-1",
      firstName: "Jane",
      lastName: "Agent",
      email: "jane@example.com",
    });

    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(call.text).toContain("Jane Agent");
    expect(call.text).toContain("jane@example.com");
    expect(call.text).not.toMatch(/<[^>]+>/);
  });
});

describe("sendApplicationApproved", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes a matching plain-text part alongside the HTML", async () => {
    vi.mocked(sgMail.send).mockResolvedValue(undefined as any);

    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc");

    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(call.text).toContain("Jane");
    expect(call.text).toContain("http://localhost:3000/setup-account?token=abc");
    expect(call.text).not.toMatch(/<[^>]+>/);
  });
});

describe("sendApplicationRejected", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes a matching plain-text part alongside the HTML", async () => {
    vi.mocked(sgMail.send).mockResolvedValue(undefined as any);

    await sendApplicationRejected("jane@example.com", "Jane", "Not enough experience");

    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(call.text).toContain("Not enough experience");
    expect(call.text).not.toMatch(/<[^>]+>/);
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

  it("applies the off-white background to the full email surface, not just the content box", () => {
    const result = html();
    expect(result).toMatch(/<body[^>]*background-color:\s*#F2F0EF/i);
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
