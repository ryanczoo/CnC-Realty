import { AGENT_VIEW_HEADER } from "@/lib/agent-view";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendSubmitForReview: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    transactionFile: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { sendSubmitForReview } from "@/lib/email/transaction-emails";
import { POST } from "../../app/api/transactions/[id]/submit-review/route";

const TX = {
  id: "tf1",
  agentId: "a1",
  propertyAddress: "123 Main St",
  checklistItems: [],
  agent: { user: { name: "Agent One" } },
};

const REAL_PENDING = {
  before: { commissionPercent: 2.5, commissionAmount: null },
  changes: [{ label: "Commission", from: "2.5%", to: "2%" }],
  requestedAt: "2026-10-02T00:00:00.000Z",
};

describe("POST /api/transactions/[id]/submit-review — ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(TX as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({} as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "tf1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the transaction does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });

  it("returns 403 when the transaction belongs to a different agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u2", role: "AGENT", agentId: "a2" } } as any);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "tf1" } });
    expect(res.status).toBe(403);
  });

  it("allows the owning agent to submit for review", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "tf1" } });
    expect(res.status).toBe(200);
  });

  it("allows ADMIN to submit for review on any agent's transaction", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u3", role: "ADMIN", agentId: null } } as any);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "tf1" } });
    expect(res.status).toBe(200);
  });
});


const PENDING_ITEMS = [{ id: "i1", isRequired: true, documents: [{ id: "d1", reviewStatus: "PENDING_REVIEW" }] }];
const APPROVED_ITEMS = [{ id: "i1", isRequired: true, documents: [{ id: "d1", reviewStatus: "APPROVED" }] }];
const AGENT_SESSION = { user: { id: "u1", role: "AGENT", agentId: "a1" } } as any;

describe("POST /api/transactions/[id]/submit-review — review submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({} as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  });

  it("flags the file, records reviewSubmittedAt, and emails when a required document is pending", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ ...TX, checklistItems: PENDING_ITEMS, reviewSubmittedAt: null, pendingCommission: null } as any);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "tf1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({
      where: { id: "tf1" },
      data: { awaitingReview: true, reviewSubmittedAt: expect.any(Date) },
    });
    expect(prisma.fileActivity.create).toHaveBeenCalled();
    expect(sendSubmitForReview).toHaveBeenCalled();
  });

  it("does not overwrite reviewSubmittedAt when it is already set", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ ...TX, checklistItems: PENDING_ITEMS, reviewSubmittedAt: new Date("2026-01-01"), pendingCommission: null } as any);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "tf1" } });
    expect(res.status).toBe(200);
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({
      where: { id: "tf1" },
      data: { awaitingReview: true },
    });
  });

  it("records the submission time, and nothing else, when everything is approved and nothing was recorded yet", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ ...TX, checklistItems: APPROVED_ITEMS, reviewSubmittedAt: null, pendingCommission: null } as any);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "tf1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, alreadyApproved: true });
    expect(prisma.transactionFile.update).toHaveBeenCalledTimes(1);
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({ where: { id: "tf1" }, data: { reviewSubmittedAt: expect.any(Date) } });
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
    expect(sendSubmitForReview).not.toHaveBeenCalled();
  });

  it("writes nothing when everything is approved and the submission time is already recorded", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ ...TX, checklistItems: APPROVED_ITEMS, reviewSubmittedAt: new Date("2026-01-01"), pendingCommission: null } as any);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "tf1" } });
    expect(await res.json()).toEqual({ ok: true, alreadyApproved: true });
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
    expect(sendSubmitForReview).not.toHaveBeenCalled();
  });

  it("treats a stored {} as no pending change", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ ...TX, checklistItems: APPROVED_ITEMS, reviewSubmittedAt: new Date("2026-01-01"), pendingCommission: {} } as any);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "tf1" } });
    expect(await res.json()).toEqual({ ok: true, alreadyApproved: true });
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });

  it("still flags the file when everything is approved but a commission change is pending", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ ...TX, checklistItems: APPROVED_ITEMS, reviewSubmittedAt: null, pendingCommission: REAL_PENDING } as any);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "tf1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(prisma.transactionFile.update).toHaveBeenCalled();
  });
});

describe("POST /api/transactions/[id]/submit-review — agent-view marker", () => {
  const VIEWING_ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: "a1" } };
  const post = (marked: boolean) =>
    POST(new Request("http://localhost", { method: "POST", headers: marked ? { [AGENT_VIEW_HEADER]: "1" } : {} }), { params: { id: "tf1" } });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ ...TX, agentId: "a2" } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({} as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
    vi.mocked(getServerSession).mockResolvedValue(VIEWING_ADMIN as any);
  });

  it("refuses another agent's transaction with the marker, allows it without", async () => {
    expect((await post(true)).status).toBe(403);
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
    expect((await post(false)).status).toBe(200);
  });
});
