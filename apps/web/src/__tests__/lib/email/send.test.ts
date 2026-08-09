import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sendgrid/mail", () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue(undefined) },
}));

import sgMail from "@sendgrid/mail";
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
    expect(msg.attachments[0].filename).toBe("w9.pdf");
  });
});
