// Set before imports: drip bodies carry a signed unsubscribe link.
process.env.NEXTAUTH_SECRET = "test-secret";
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Resolves a SendResult, not undefined: the route reads `.sent` off the
// result to decide whether to refund the quota unit it already consumed.
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue({ sent: true }) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    leadPlanStep: { findMany: vi.fn(), update: vi.fn() },
    leadPlanEnrollment: { findMany: vi.fn(), update: vi.fn() },
    leadTask: { create: vi.fn() },
    lead: { findUnique: vi.fn() },
    agent: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { POST } from "../../app/api/cron/action-plans/route";

const CRON_SECRET = "test-secret";
process.env.CRON_SECRET = CRON_SECRET;

function makeReq(auth?: string) {
  return new NextRequest("http://localhost/api/cron/action-plans", {
    method: "POST",
    headers: auth ? { authorization: `Bearer ${auth}` } : {},
  });
}

const LEAD = { id: "l1", firstName: "John", lastName: "Doe", email: "john@example.com" };
const AGENT = {
  id: "a1",
  displayName: "Jane Agent",
  phone: "555-1234",
  monthlyEmailLimit: 200,
  user: { email: "agent@test.com" },
};
const EMAIL_STEP = {
  id: "ls1", enrollmentId: "e1", stepType: "EMAIL",
  subject: "Hi {{first_name}}", body: "Hello {{first_name}} from {{agent_name}}",
  taskTitle: null, dueAt: new Date(), status: "PENDING",
  enrollment: { id: "e1", leadId: "l1", agentId: "a1", status: "ACTIVE", lead: LEAD, agent: AGENT },
};
const TASK_STEP = {
  id: "ls2", enrollmentId: "e2", stepType: "TASK",
  subject: null, body: null, taskTitle: "Call {{first_name}}",
  dueAt: new Date(), status: "PENDING",
  enrollment: { id: "e2", leadId: "l1", agentId: "a1", status: "ACTIVE", lead: LEAD, agent: AGENT },
};

describe("POST /api/cron/action-plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.agent.updateMany).mockResolvedValue({ count: 1 } as any);
  });

  it("returns 401 without auth", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it("sends email for EMAIL step and marks DONE", async () => {
    vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([EMAIL_STEP] as any);
    vi.mocked(prisma.leadPlanStep.update).mockResolvedValue({ ...EMAIL_STEP, status: "DONE" } as any);
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.subject).toBe("Hi John");
    expect(call.stream).toBe("broadcast");
    expect(call.html).toContain("Hello John from Jane Agent");
    expect(prisma.leadPlanStep.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ls1" }, data: expect.objectContaining({ status: "DONE" }) })
    );
  });

  it("creates LeadTask for TASK step and marks DONE", async () => {
    vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([TASK_STEP] as any);
    vi.mocked(prisma.leadPlanStep.update).mockResolvedValue({ ...TASK_STEP, status: "DONE" } as any);
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.leadTask.create).mockResolvedValue({} as any);

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(prisma.leadTask.create).toHaveBeenCalledOnce();
    const call = vi.mocked(prisma.leadTask.create).mock.calls[0][0] as any;
    expect(call.data.title).toBe("Call John");
  });

  it("isolates a failing step so other steps still process", async () => {
    const failingStep = { ...EMAIL_STEP, id: "ls-fail", enrollmentId: "e-fail" };
    vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([failingStep, TASK_STEP] as any);
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("email send failed"));
    vi.mocked(prisma.leadTask.create).mockResolvedValue({} as any);
    vi.mocked(prisma.leadPlanStep.update).mockResolvedValue({} as any);
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(1);
    expect(body.errors).toBe(1);
    // The failing step must never be marked DONE
    expect(prisma.leadPlanStep.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ls-fail" } })
    );
    // The other step still completes
    expect(prisma.leadPlanStep.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ls2" }, data: expect.objectContaining({ status: "DONE" }) })
    );
  });

  it("marks enrollment COMPLETED when all steps done", async () => {
    // The route calls leadPlanStep.findMany exactly once (for due steps);
    // enrollment completion is checked via leadPlanEnrollment.findMany below,
    // not a second leadPlanStep.findMany call.
    vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([]); // no pending steps
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([
      { id: "e1", steps: [{ status: "DONE" }] },
    ] as any);
    vi.mocked(prisma.leadPlanEnrollment.update).mockResolvedValue({} as any);

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(prisma.leadPlanEnrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) })
    );
  });

  it("skips an EMAIL step over quota, leaves it PENDING (not SKIPPED), and reports skippedLimit", async () => {
    vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([EMAIL_STEP] as any);
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);
    // First call is the once-per-agent ensureQuotaReset; second is this
    // step's tryConsumeEmailQuota, which reports the agent already at limit.
    vi.mocked(prisma.agent.updateMany)
      .mockResolvedValueOnce({ count: 0 } as any)
      .mockResolvedValueOnce({ count: 0 } as any);

    const res = await POST(makeReq(CRON_SECRET));
    const body = await res.json();

    expect(body.skippedLimit).toBe(1);
    expect(body.processed).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    // Must stay PENDING, not be marked SKIPPED or DONE — the cron's own
    // dueAt <= now query re-selects it once quota is available again.
    expect(prisma.leadPlanStep.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ls1" } })
    );
  });

  it("still processes a TASK step normally when the same agent is over their email quota", async () => {
    vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([TASK_STEP] as any);
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.leadTask.create).mockResolvedValue({} as any);
    vi.mocked(prisma.leadPlanStep.update).mockResolvedValue({} as any);
    // Even if quota is exhausted, a TASK step never calls tryConsumeEmailQuota
    // at all — only ensureQuotaReset runs, once.
    vi.mocked(prisma.agent.updateMany).mockResolvedValueOnce({ count: 0 } as any);

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(prisma.leadTask.create).toHaveBeenCalledOnce();
    expect(prisma.agent.updateMany).toHaveBeenCalledTimes(1);
  });

  it("refunds the quota unit and still marks the step DONE when the send is suppressed (e.g. opted out)", async () => {
    vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([EMAIL_STEP] as any);
    vi.mocked(prisma.leadPlanStep.update).mockResolvedValue({ ...EMAIL_STEP, status: "DONE" } as any);
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);
    // ensureQuotaReset (no-op) + tryConsumeEmailQuota (succeeds, count===1) +
    // the compensating refund decrement (also targets agent.updateMany).
    vi.mocked(prisma.agent.updateMany)
      .mockResolvedValueOnce({ count: 0 } as any) // ensureQuotaReset
      .mockResolvedValueOnce({ count: 1 } as any) // tryConsumeEmailQuota: consumed
      .mockResolvedValueOnce({ count: 1 } as any); // refund decrement
    vi.mocked(sendEmail).mockResolvedValue({ sent: false, reason: "opted_out" });

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);

    // The step still completes — opting out is permanent, only billing was wrong.
    expect(prisma.leadPlanStep.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ls1" }, data: expect.objectContaining({ status: "DONE" }) })
    );

    // Exact shape of the refund call — distinguishable from the earlier
    // ensureQuotaReset/tryConsumeEmailQuota calls in this same test by its where clause.
    expect(prisma.agent.updateMany).toHaveBeenCalledWith({
      where: { id: "a1", monthlyEmailsSent: { gt: 0 } },
      data: { monthlyEmailsSent: { decrement: 1 } },
    });
    expect(prisma.agent.updateMany).toHaveBeenCalledTimes(3);
  });

  it("checks the reset boundary once per distinct agent, not once per step", async () => {
    const secondStep = {
      ...EMAIL_STEP,
      id: "ls3",
      enrollmentId: "e3",
      enrollment: { ...EMAIL_STEP.enrollment, id: "e3" }, // same agentId "a1"
    };
    vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([EMAIL_STEP, secondStep] as any);
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.leadPlanStep.update).mockResolvedValue({} as any);
    vi.mocked(sendEmail).mockResolvedValue({ sent: true });

    await POST(makeReq(CRON_SECRET));

    // 1 ensureQuotaReset (both steps share agent "a1") + 2 tryConsumeEmailQuota
    // (one per EMAIL step) = 3 total, not 4.
    expect(prisma.agent.updateMany).toHaveBeenCalledTimes(3);
  });
});
