import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sendgrid/mail", () => ({ default: { setApiKey: vi.fn(), send: vi.fn() } }));
vi.mock("@/lib/email", () => ({ FROM: "noreply@cncrealtygroup.com" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    leadPlanStep: { findMany: vi.fn(), update: vi.fn() },
    leadPlanEnrollment: { findMany: vi.fn(), update: vi.fn() },
    leadTask: { create: vi.fn() },
    lead: { findUnique: vi.fn() },
    agent: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import sgMail from "@sendgrid/mail";
import { POST } from "../../app/api/cron/action-plans/route";

const CRON_SECRET = "test-secret";
process.env.CRON_SECRET = CRON_SECRET;

function makeReq(auth?: string) {
  return new Request("http://localhost/api/cron/action-plans", {
    method: "POST",
    headers: auth ? { authorization: `Bearer ${auth}` } : {},
  });
}

const LEAD = { id: "l1", firstName: "John", lastName: "Doe", email: "john@example.com" };
const AGENT = { id: "a1", displayName: "Jane Agent", phone: "555-1234", user: { email: "agent@test.com" } };
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
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without auth", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it("sends email for EMAIL step and marks DONE", async () => {
    vi.mocked(prisma.leadPlanStep.findMany).mockResolvedValue([EMAIL_STEP] as any);
    vi.mocked(prisma.leadPlanStep.update).mockResolvedValue({ ...EMAIL_STEP, status: "DONE" } as any);
    vi.mocked(prisma.leadPlanEnrollment.findMany).mockResolvedValue([]);
    vi.mocked(sgMail.send).mockResolvedValue(undefined as any);

    const res = await POST(makeReq(CRON_SECRET));
    expect(res.status).toBe(200);
    expect(sgMail.send).toHaveBeenCalledOnce();
    const call = vi.mocked(sgMail.send).mock.calls[0][0] as any;
    expect(call.subject).toBe("Hi John");
    expect(call.text).toContain("Hello John from Jane Agent");
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

  it("marks enrollment COMPLETED when all steps done", async () => {
    vi.mocked(prisma.leadPlanStep.findMany)
      .mockResolvedValueOnce([]) // no pending steps
      .mockResolvedValueOnce([]); // all steps DONE
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
});
