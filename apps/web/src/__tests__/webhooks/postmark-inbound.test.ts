process.env.POSTMARK_WEBHOOK_USER = "hookuser";
process.env.POSTMARK_WEBHOOK_PASSWORD = "hookpass";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leadPlanEnrollment: { findUnique: vi.fn(), update: vi.fn() },
    leadPlanStep: { updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/action-plan-email", () => ({ sendLeadReplyNotification: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { sendLeadReplyNotification } from "@/lib/action-plan-email";
import { POST } from "../../app/api/webhooks/postmark/inbound/route";

const GOOD = "Basic " + Buffer.from("hookuser:hookpass").toString("base64");
const ENROLLMENT = {
  id: "enr1",
  status: "ACTIVE",
  agent: { user: { email: "agent@test.com" } },
};

function req(body: Record<string, unknown>, auth: string | null = GOOD) {
  return new Request("http://localhost/api/webhooks/postmark/inbound", {
    method: "POST",
    headers: auth ? { authorization: auth, "content-type": "application/json" } : {},
    body: JSON.stringify(body),
  });
}

const REPLY = {
  From: "lead@example.com",
  To: "reply+enr1@reply.cncrealtygroup.com",
  OriginalRecipient: "reply+enr1@reply.cncrealtygroup.com",
  MailboxHash: "enr1",
  Subject: "Re: your inquiry",
  TextBody: "Thanks, I'm interested\n\n> On Mon, CnC wrote:\n> original message",
  StrippedTextReply: "Thanks, I'm interested",
};

describe("POST /api/webhooks/postmark/inbound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.leadPlanEnrollment.findUnique).mockResolvedValue(ENROLLMENT as never);
  });

  it("rejects a request with no credentials", async () => {
    const res = await POST(req(REPLY, null));
    expect(res.status).toBe(401);
    expect(prisma.leadPlanEnrollment.update).not.toHaveBeenCalled();
  });

  it("pauses the enrollment and its pending steps on a reply", async () => {
    const res = await POST(req(REPLY));

    expect(res.status).toBe(200);
    expect(prisma.leadPlanEnrollment.update).toHaveBeenCalledWith({
      where: { id: "enr1" },
      data: expect.objectContaining({ status: "PAUSED", pausedReason: "REPLY" }),
    });
    expect(prisma.leadPlanStep.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: "enr1", status: "PENDING" },
      data: { status: "PAUSED" },
    });
  });

  it("forwards the reply to the agent", async () => {
    await POST(req(REPLY));

    expect(sendLeadReplyNotification).toHaveBeenCalledOnce();
    const call = vi.mocked(sendLeadReplyNotification).mock.calls[0][0];
    expect(call.to).toBe("agent@test.com");
    expect(call.subject).toBe("[Lead Reply] Re: your inquiry");
    expect(call.enrollmentId).toBe("enr1");
  });

  it("forwards the stripped reply rather than the quoted history", async () => {
    await POST(req(REPLY));

    // Postmark strips the quoted original for us; forwarding TextBody would
    // send the agent the whole thread back every time.
    const call = vi.mocked(sendLeadReplyNotification).mock.calls[0][0];
    expect(call.body).toBe("Thanks, I'm interested");
    expect(call.body).not.toContain("original message");
  });

  it("falls back to TextBody when Postmark could not strip a reply", async () => {
    await POST(req({ ...REPLY, StrippedTextReply: undefined }));

    expect(vi.mocked(sendLeadReplyNotification).mock.calls[0][0].body).toContain(
      "Thanks, I'm interested"
    );
  });

  it("recovers the enrollment id from the address when MailboxHash is absent", async () => {
    // MailboxHash depends on the inbound domain being configured for
    // plus-addressing; the address itself always carries the id.
    await POST(req({ ...REPLY, MailboxHash: undefined }));

    expect(prisma.leadPlanEnrollment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "enr1" } })
    );
    expect(prisma.leadPlanEnrollment.update).toHaveBeenCalled();
  });

  it("ignores mail sent to an address with no enrollment id", async () => {
    const res = await POST(
      req({ ...REPLY, MailboxHash: undefined, To: "hello@cncrealtygroup.com", OriginalRecipient: "hello@cncrealtygroup.com" })
    );

    expect(res.status).toBe(200);
    expect(prisma.leadPlanEnrollment.findUnique).not.toHaveBeenCalled();
  });

  it("ignores a reply to an enrollment that is not ACTIVE", async () => {
    vi.mocked(prisma.leadPlanEnrollment.findUnique).mockResolvedValue({
      ...ENROLLMENT,
      status: "PAUSED",
    } as never);

    const res = await POST(req(REPLY));

    // The agent replying to a forwarded notification re-triggers this webhook.
    // Already PAUSED means it must no-op rather than loop.
    expect(res.status).toBe(200);
    expect(prisma.leadPlanEnrollment.update).not.toHaveBeenCalled();
    expect(sendLeadReplyNotification).not.toHaveBeenCalled();
  });

  it("still pauses when the enrollment has no agent email", async () => {
    vi.mocked(prisma.leadPlanEnrollment.findUnique).mockResolvedValue({
      ...ENROLLMENT,
      agent: null,
    } as never);

    const res = await POST(req(REPLY));

    expect(res.status).toBe(200);
    expect(prisma.leadPlanEnrollment.update).toHaveBeenCalled();
    expect(sendLeadReplyNotification).not.toHaveBeenCalled();
  });

  it("returns 200 on a malformed body so Postmark does not retry forever", async () => {
    const res = await POST(
      new Request("http://localhost/api/webhooks/postmark/inbound", {
        method: "POST",
        headers: { authorization: GOOD, "content-type": "application/json" },
        body: "not json",
      })
    );

    expect(res.status).toBe(200);
  });
});
