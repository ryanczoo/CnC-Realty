import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leadPlanEnrollment: { findUnique: vi.fn(), update: vi.fn() },
    leadPlanStep: { updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/action-plan-email", () => ({ sendActionPlanEmail: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { sendActionPlanEmail } from "@/lib/action-plan-email";
import { POST } from "../../app/api/webhooks/sendgrid/inbound/route";

const AGENT = { id: "a1", user: { email: "agent@test.com" } };
const ENROLLMENT = {
  id: "e1", leadId: "l1", agentId: "a1", status: "ACTIVE",
  agent: AGENT,
};

function makeRequest(to: string, subject = "Re: Hello", text = "Thanks for reaching out") {
  const form = new FormData();
  form.append("to", to);
  form.append("from", "lead@gmail.com");
  form.append("subject", subject);
  form.append("text", text);
  return new NextRequest("http://localhost/api/webhooks/sendgrid/inbound", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/webhooks/sendgrid/inbound", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 and ignores unknown enrollment IDs", async () => {
    vi.mocked(prisma.leadPlanEnrollment.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("reply+unknown123@reply.cncrealtygroup.com"));
    expect(res.status).toBe(200);
    expect(prisma.leadPlanEnrollment.update).not.toHaveBeenCalled();
  });

  it("pauses ACTIVE enrollment and forwards email to agent", async () => {
    vi.mocked(prisma.leadPlanEnrollment.findUnique).mockResolvedValue(ENROLLMENT as any);
    vi.mocked(prisma.leadPlanEnrollment.update).mockResolvedValue({ ...ENROLLMENT, status: "PAUSED" } as any);
    vi.mocked(prisma.leadPlanStep.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(sendActionPlanEmail).mockResolvedValue(undefined);

    const res = await POST(makeRequest("reply+e1@reply.cncrealtygroup.com"));
    expect(res.status).toBe(200);
    expect(prisma.leadPlanEnrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAUSED", pausedReason: "REPLY" }),
      })
    );
    expect(prisma.leadPlanStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PAUSED" } })
    );
    expect(sendActionPlanEmail).toHaveBeenCalledOnce();
    const fwdCall = vi.mocked(sendActionPlanEmail).mock.calls[0][0];
    expect(fwdCall.to).toBe("agent@test.com");
    expect(fwdCall.subject).toContain("[Lead Reply]");
  });

  it("does not pause already-PAUSED enrollment", async () => {
    vi.mocked(prisma.leadPlanEnrollment.findUnique).mockResolvedValue({ ...ENROLLMENT, status: "PAUSED" } as any);
    const res = await POST(makeRequest("reply+e1@reply.cncrealtygroup.com"));
    expect(res.status).toBe(200);
    expect(prisma.leadPlanEnrollment.update).not.toHaveBeenCalled();
  });

  it("returns 200 when to field contains no valid reply address", async () => {
    const res = await POST(makeRequest("noreply@example.com"));
    expect(res.status).toBe(200);
    expect(prisma.leadPlanEnrollment.findUnique).not.toHaveBeenCalled();
  });

  it("pauses steps but skips email forward when agent has no email", async () => {
    const enrollmentNoEmail = { ...ENROLLMENT, agent: { id: "a1", user: { email: null } } };
    vi.mocked(prisma.leadPlanEnrollment.findUnique).mockResolvedValue(enrollmentNoEmail as any);
    vi.mocked(prisma.leadPlanEnrollment.update).mockResolvedValue({ ...ENROLLMENT, status: "PAUSED" } as any);
    vi.mocked(prisma.leadPlanStep.updateMany).mockResolvedValue({ count: 1 } as any);

    const res = await POST(makeRequest("reply+e1@reply.cncrealtygroup.com"));
    expect(res.status).toBe(200);
    expect(prisma.leadPlanEnrollment.update).toHaveBeenCalled();
    expect(prisma.leadPlanStep.updateMany).toHaveBeenCalled();
    expect(sendActionPlanEmail).not.toHaveBeenCalled();
  });
});
