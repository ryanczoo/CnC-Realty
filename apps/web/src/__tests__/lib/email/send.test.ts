import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.POSTMARK_SERVER_TOKEN = "test-token";
process.env.POSTMARK_BROADCAST_STREAM = "test-broadcast-stream";

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn().mockResolvedValue({ MessageID: "x" }),
}));

// A class, not vi.fn().mockImplementation(() => ...): the seam calls
// `new ServerClient(token)`, and an arrow implementation is not a constructor.
vi.mock("postmark", () => ({
  ServerClient: class {
    sendEmail = sendEmailMock;
  },
}));

import { FROM } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";

/** The single message Postmark was handed by the call under test. */
function sentMessage(): any {
  expect(sendEmailMock).toHaveBeenCalledOnce();
  return sendEmailMock.mock.calls[0][0];
}

describe("sendEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends to the recipient with the given subject and html", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>Hello</p>",
      stream: "transactional",
    });

    const msg = sentMessage();
    expect(msg.To).toBe("a@b.com");
    expect(msg.Subject).toBe("Hi");
    expect(msg.HtmlBody).toBe("<p>Hello</p>");
  });

  it("sends from the app's FROM address", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>Hello</p>",
      stream: "transactional",
    });

    // Postmark takes a single formatted string, not SendGrid's {email,name}
    // object — the public SendOptions shape is unchanged, the seam maps it.
    expect(sentMessage().From).toBe(`${FROM.name} <${FROM.email}>`);
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

    // sendAnnouncement depends on this: announcements must reach the monitored
    // info@ inbox, not the unmonitored noreply@ default.
    const msg = sentMessage();
    expect(msg.From).toBe("CnC Realty <info@cncrealtygroup.com>");
    expect(msg.From).not.toBe(`${FROM.name} <${FROM.email}>`);
  });

  it("falls back to FROM when from is explicitly undefined", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>Hello</p>",
      from: undefined,
      stream: "transactional",
    });

    expect(sentMessage().From).toBe(`${FROM.name} <${FROM.email}>`);
  });

  it("derives a plain-text part from the html when text is omitted", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>Hello <a href='https://x.com'>link</a></p>",
      stream: "transactional",
    });

    const msg = sentMessage();
    expect(msg.TextBody).toContain("Hello");
    expect(msg.TextBody).not.toContain("<p>");
  });

  it("sends a text-only message with no html part at all", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      text: "plain only",
      stream: "transactional",
    });

    const msg = sentMessage();
    expect(msg.TextBody).toBe("plain only");

    // Not `HtmlBody: ""`. Mail clients prefer the text/html part whenever one
    // is present, so an empty html body renders as a blank email — the key must
    // be absent entirely.
    expect(msg).not.toHaveProperty("HtmlBody");
  });

  it("uses the caller's text part when one is given", async () => {
    await sendEmail({
      to: "a@b.com", subject: "Hi", html: "<p>x</p>", text: "custom", stream: "transactional",
    });

    expect(sentMessage().TextBody).toBe("custom");
  });

  it("passes replyTo through", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>x</p>",
      replyTo: "reply@b.com",
      stream: "transactional",
    });

    expect(sentMessage().ReplyTo).toBe("reply@b.com");
  });

  it("maps attachments to Postmark's Name/Content/ContentType shape", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>x</p>",
      attachments: [{ filename: "w9.pdf", content: "BASE64", contentType: "application/pdf" }],
      stream: "transactional",
    });

    // ContentID must be null, not absent: Postmark requires the key, and a
    // non-null value would make the PDF an inline `cid:` reference instead of
    // a downloadable attachment.
    expect(sentMessage().Attachments).toEqual([
      {
        Name: "w9.pdf",
        Content: "BASE64",
        ContentType: "application/pdf",
        ContentID: null,
      },
    ]);
  });

  it("omits replyTo and attachments when the caller gives neither", async () => {
    await sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>x</p>",
      stream: "transactional",
    });

    const msg = sentMessage();
    expect(msg).not.toHaveProperty("ReplyTo");
    expect(msg).not.toHaveProperty("Attachments");
  });

  it("routes a transactional send to the outbound stream", async () => {
    await sendEmail({
      to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "transactional",
    });

    expect(sentMessage().MessageStream).toBe("outbound");
  });

  it("routes a broadcast send to the broadcast stream", async () => {
    await sendEmail({
      to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "broadcast",
    });

    // Read from env, not hardcoded: the broadcast stream id is not `outbound`,
    // and sending marketing mail down the transactional stream is what the
    // stream split exists to prevent.
    expect(sentMessage().MessageStream).toBe(process.env.POSTMARK_BROADCAST_STREAM);
    expect(sentMessage().MessageStream).not.toBe("outbound");
  });

  describe("when POSTMARK_BROADCAST_STREAM is not configured", () => {
    let original: string | undefined;

    beforeEach(() => {
      original = process.env.POSTMARK_BROADCAST_STREAM;
      delete process.env.POSTMARK_BROADCAST_STREAM;
    });

    afterEach(() => {
      if (original === undefined) delete process.env.POSTMARK_BROADCAST_STREAM;
      else process.env.POSTMARK_BROADCAST_STREAM = original;
    });

    it("refuses a broadcast send and never calls Postmark", async () => {
      await expect(
        sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "broadcast" })
      ).rejects.toThrow("POSTMARK_BROADCAST_STREAM");

      // Refusing has to mean refusing. Falling through would hand Postmark a
      // message with no MessageStream, which it routes to the server default —
      // campaign mail on the transactional stream, silently.
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("refuses a broadcast send when the variable is set but empty", async () => {
      process.env.POSTMARK_BROADCAST_STREAM = "";

      await expect(
        sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "broadcast" })
      ).rejects.toThrow("POSTMARK_BROADCAST_STREAM");

      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("still sends a transactional message — the guard is broadcast-only", async () => {
      await sendEmail({
        to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "transactional",
      });

      expect(sentMessage().MessageStream).toBe("outbound");
    });
  });
});
