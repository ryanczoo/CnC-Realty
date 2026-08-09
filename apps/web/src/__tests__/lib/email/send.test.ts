import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.POSTMARK_SERVER_TOKEN = "test-token";
process.env.POSTMARK_BROADCAST_STREAM = "test-broadcast-stream";
process.env.NEXTAUTH_SECRET = "test-secret";
process.env.NEXTAUTH_URL = "https://cncrealtygroup.com";

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn().mockResolvedValue({ MessageID: "x" }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

// A class, not vi.fn().mockImplementation(() => ...): the seam calls
// `new ServerClient(token)`, and an arrow implementation is not a constructor.
vi.mock("postmark", () => ({
  ServerClient: class {
    sendEmail = sendEmailMock;
  },
}));

import { FROM } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";

/** The single message Postmark was handed by the call under test. */
function sentMessage(): any {
  expect(sendEmailMock).toHaveBeenCalledOnce();
  return sendEmailMock.mock.calls[0][0];
}

const LEAD = { kind: "lead" as const, id: "lead_1" };

/** Broadcast sends require a recipient, so every broadcast test needs one. */
function optedOut(value: boolean) {
  vi.mocked(prisma.lead.findUnique).mockResolvedValue({ emailOptOut: value } as never);
}

describe("sendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    optedOut(false);
  });

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
      to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "broadcast", recipient: LEAD,
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
        sendEmail({
          to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "broadcast", recipient: LEAD,
        })
      ).rejects.toThrow("POSTMARK_BROADCAST_STREAM");

      // Refusing has to mean refusing. Falling through would hand Postmark a
      // message with no MessageStream, which it routes to the server default —
      // campaign mail on the transactional stream, silently.
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("refuses a broadcast send when the variable is set but empty", async () => {
      process.env.POSTMARK_BROADCAST_STREAM = "";

      await expect(
        sendEmail({
          to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "broadcast", recipient: LEAD,
        })
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

  describe("opt-out suppression", () => {
    it("does not send a broadcast to an opted-out recipient", async () => {
      optedOut(true);

      await sendEmail({
        to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "broadcast", recipient: LEAD,
      });

      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("sends a broadcast to a recipient who has not opted out", async () => {
      optedOut(false);

      await sendEmail({
        to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "broadcast", recipient: LEAD,
      });

      expect(sendEmailMock).toHaveBeenCalledOnce();
    });

    it("still sends transactional mail to an opted-out recipient", async () => {
      optedOut(true);

      // Opting out of marketing must never suppress account, transaction, or
      // deadline mail — those are not commercial email and the recipient
      // cannot unsubscribe from them.
      await sendEmail({
        to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "transactional", recipient: LEAD,
      });

      expect(sendEmailMock).toHaveBeenCalledOnce();
    });

    it("reads the User table for a user recipient", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ emailOptOut: true } as never);

      await sendEmail({
        to: "a@b.com",
        subject: "Hi",
        html: "<p>x</p>",
        stream: "broadcast",
        recipient: { kind: "user", id: "user_1" },
      });

      expect(prisma.user.findUnique).toHaveBeenCalled();
      expect(prisma.lead.findUnique).not.toHaveBeenCalled();
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("sends when the recipient row no longer exists", async () => {
      vi.mocked(prisma.lead.findUnique).mockResolvedValue(null as never);

      // A deleted lead is not an opt-out. Failing open here matters because
      // the alternative silently drops mail for any row-lookup miss.
      await sendEmail({
        to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "broadcast", recipient: LEAD,
      });

      expect(sendEmailMock).toHaveBeenCalledOnce();
    });
  });

  describe("one-click unsubscribe headers", () => {
    it("adds List-Unsubscribe headers to broadcast sends", async () => {
      await sendEmail({
        to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "broadcast", recipient: LEAD,
      });

      const headers = sentMessage().Headers;
      expect(headers).toContainEqual({
        Name: "List-Unsubscribe-Post",
        Value: "List-Unsubscribe=One-Click",
      });
      expect(
        headers.find((h: { Name: string }) => h.Name === "List-Unsubscribe").Value
      ).toContain("/unsubscribe?t=");
    });

    it("wraps the List-Unsubscribe url in angle brackets per RFC 2369", async () => {
      await sendEmail({
        to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "broadcast", recipient: LEAD,
      });

      const value = sentMessage().Headers.find(
        (h: { Name: string }) => h.Name === "List-Unsubscribe"
      ).Value;
      expect(value.startsWith("<")).toBe(true);
      expect(value.endsWith(">")).toBe(true);
    });

    it("adds no unsubscribe headers to transactional sends", async () => {
      await sendEmail({
        to: "a@b.com", subject: "Hi", html: "<p>x</p>", stream: "transactional",
      });

      expect(sentMessage()).not.toHaveProperty("Headers");
    });
  });
});
