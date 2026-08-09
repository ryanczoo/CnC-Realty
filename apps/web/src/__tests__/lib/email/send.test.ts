import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sendgrid/mail", () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue(undefined) },
}));

import sgMail from "@sendgrid/mail";
import { FROM } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";

describe("sendEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends to the recipient with the given subject and html", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>Hello</p>",
      stream: "transactional",
    });

    expect(sgMail.send).toHaveBeenCalledOnce();
    const msg = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(msg.to).toBe("a@b.com");
    expect(msg.subject).toBe("Hi");
    expect(msg.html).toBe("<p>Hello</p>");
  });

  it("sends from the app's FROM address", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>Hello</p>",
      stream: "transactional",
    });

    const msg = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(msg.from).toEqual(FROM);
  });

  it("uses the caller's from address when one is given", async () => {
    const announcementFrom = { email: "info@cncrealtygroup.com", name: "CnC Realty" };

    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>Hello</p>",
      from: announcementFrom,
      stream: "transactional",
    });

    const msg = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(msg.from).toEqual(announcementFrom);
    expect(msg.from).not.toEqual(FROM);
  });

  it("falls back to FROM when from is explicitly undefined", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>Hello</p>",
      from: undefined,
      stream: "transactional",
    });

    const msg = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(msg.from).toEqual(FROM);
  });

  it("derives a plain-text part from the html when text is omitted", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>Hello <a href='https://x.com'>link</a></p>",
      stream: "transactional",
    });

    const msg = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(msg.text).toContain("Hello");
    expect(msg.text).not.toContain("<p>");
  });

  it("sends a text-only message with no html part at all", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      text: "plain only",
      stream: "transactional",
    });

    const msg = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(msg.text).toBe("plain only");

    // Not `html: ""`. Mail clients prefer the text/html part whenever one is
    // present, so an empty html body renders as a blank email — the key must
    // be absent entirely, exactly as a text-only sgMail.send call was before.
    expect(msg).not.toHaveProperty("html");
  });

  it("uses the caller's text part when one is given", async () => {
    await sendEmail({
      to: "a@b.com", subject: "Hi", html: "<p>x</p>", text: "custom", stream: "transactional",
    });

    const msg = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(msg.text).toBe("custom");
  });

  it("passes replyTo and attachments through", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>x</p>",
      replyTo: "reply@b.com",
      attachments: [{ filename: "w9.pdf", content: "BASE64", contentType: "application/pdf" }],
      stream: "transactional",
    });

    const msg = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(msg.replyTo).toBe("reply@b.com");
    expect(msg.attachments).toHaveLength(1);

    // The whole mapped shape, not just the filename: contentType must become
    // SendGrid's `type`, and `disposition` must be emitted — without it the
    // PDFs render inline in the recipient's client instead of attaching.
    expect(msg.attachments[0]).toEqual({
      filename: "w9.pdf",
      content: "BASE64",
      type: "application/pdf",
      disposition: "attachment",
    });
  });
});
