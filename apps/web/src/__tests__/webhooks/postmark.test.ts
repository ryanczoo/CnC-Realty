process.env.POSTMARK_WEBHOOK_USER = "hookuser";
process.env.POSTMARK_WEBHOOK_PASSWORD = "hookpass";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findFirst: vi.fn() },
    campaignContact: { updateMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/webhooks/postmark/route";

const GOOD = "Basic " + Buffer.from("hookuser:hookpass").toString("base64");
const LEAD = { id: "lead_1", email: "john@example.com" };

function req(body: unknown, auth: string | null = GOOD) {
  return new Request("http://localhost/api/webhooks/postmark", {
    method: "POST",
    headers: auth ? { authorization: auth, "content-type": "application/json" } : {},
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/postmark", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.lead.findFirst).mockResolvedValue(LEAD as never);
  });

  describe("authentication", () => {
    it("rejects a request with no credentials", async () => {
      const res = await POST(req({ RecordType: "Open" }, null));
      expect(res.status).toBe(401);
      expect(prisma.campaignContact.updateMany).not.toHaveBeenCalled();
    });

    it("rejects wrong credentials", async () => {
      const bad = "Basic " + Buffer.from("hookuser:nope").toString("base64");
      const res = await POST(req({ RecordType: "Open" }, bad));
      expect(res.status).toBe(401);
      expect(prisma.campaignContact.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("event handling", () => {
    it("marks a contact opened on an Open event", async () => {
      const res = await POST(
        req({
          RecordType: "Open",
          Recipient: "john@example.com",
          ReceivedAt: "2026-08-09T16:33:54.907Z",
        })
      );

      expect(res.status).toBe(200);
      // Mirrors the SendGrid route being replaced: only SENT/PENDING advance to
      // OPENED, so a contact that already clicked is not walked backwards.
      expect(prisma.campaignContact.updateMany).toHaveBeenCalledWith({
        where: { leadId: "lead_1", status: { in: ["SENT", "PENDING"] } },
        data: { status: "OPENED", openedAt: new Date("2026-08-09T16:33:54.907Z") },
      });
    });

    it("marks a contact clicked on a Click event", async () => {
      const res = await POST(
        req({
          RecordType: "Click",
          Recipient: "john@example.com",
          ReceivedAt: "2026-08-09T16:33:54.907Z",
        })
      );

      expect(res.status).toBe(200);
      expect(prisma.campaignContact.updateMany).toHaveBeenCalledWith({
        where: { leadId: "lead_1", status: { not: "BOUNCED" } },
        data: { status: "CLICKED", clickedAt: new Date("2026-08-09T16:33:54.907Z") },
      });
    });

    it("marks a contact bounced on a Bounce event", async () => {
      // Bounce carries the address as `Email`, not `Recipient` — Postmark is
      // inconsistent between engagement and delivery events.
      const res = await POST(
        req({
          RecordType: "Bounce",
          Email: "john@example.com",
          BouncedAt: "2026-08-09T16:33:54.907Z",
        })
      );

      expect(res.status).toBe(200);
      expect(prisma.campaignContact.updateMany).toHaveBeenCalledWith({
        where: { leadId: "lead_1" },
        data: { status: "BOUNCED" },
      });
    });

    it("marks a contact bounced on a SpamComplaint event", async () => {
      const res = await POST(
        req({
          RecordType: "SpamComplaint",
          Email: "john@example.com",
          BouncedAt: "2026-08-09T16:33:54.907Z",
        })
      );

      expect(res.status).toBe(200);
      expect(prisma.campaignContact.updateMany).toHaveBeenCalledWith({
        where: { leadId: "lead_1" },
        data: { status: "BOUNCED" },
      });
    });

    it("ignores an event type it does not track", async () => {
      const res = await POST(
        req({ RecordType: "Delivery", Recipient: "john@example.com" })
      );

      expect(res.status).toBe(200);
      expect(prisma.campaignContact.updateMany).not.toHaveBeenCalled();
    });

    it("ignores an event for an address with no matching lead", async () => {
      vi.mocked(prisma.lead.findFirst).mockResolvedValue(null as never);

      const res = await POST(
        req({ RecordType: "Open", Recipient: "stranger@example.com" })
      );

      expect(res.status).toBe(200);
      expect(prisma.campaignContact.updateMany).not.toHaveBeenCalled();
    });

    it("ignores an event with no recipient address", async () => {
      const res = await POST(req({ RecordType: "Open" }));

      expect(res.status).toBe(200);
      expect(prisma.lead.findFirst).not.toHaveBeenCalled();
    });
  });

  it("returns 200 on a malformed body so Postmark does not retry forever", async () => {
    const res = await POST(
      new Request("http://localhost/api/webhooks/postmark", {
        method: "POST",
        headers: { authorization: GOOD, "content-type": "application/json" },
        body: "not json",
      })
    );

    expect(res.status).toBe(200);
  });
});
