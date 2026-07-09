import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    lead: { findFirst: vi.fn() },
    deal: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../../app/api/deals/route";
import { GET as GET_ONE, PATCH, DELETE } from "../../app/api/deals/[id]/route";

const AGENT = { id: "a1" };
const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

const MOCK_DEAL_DB = {
  id: "d1",
  agentId: "a1",
  leadId: "l1",
  pipeline: "BUYERS",
  stage: "TOURING",
  propertyAddress: "123 Main St",
  price: 850000,
  expectedCloseDate: null,
  notes: null,
  transactionFileId: null,
  stageUpdatedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  lead: { firstName: "Jane", lastName: "Doe" },
};

describe("GET /api/deals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/deals"));
    expect(res.status).toBe(401);
  });

  it("returns deal list for authenticated agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.deal.findMany).mockResolvedValue([MOCK_DEAL_DB] as any);

    const res = await GET(new Request("http://localhost/api/deals"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].leadName).toBe("Jane Doe");
    expect(typeof data[0].daysInStage).toBe("number");
  });

  it("uses session.agentId directly, without querying prisma.agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as any);

    await GET(new Request("http://localhost/api/deals"));

    expect(prisma.agent.findUnique).not.toHaveBeenCalled();
    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ agentId: "a1" }) })
    );
  });

  it("filters by pipeline when ?pipeline=SELLERS", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as any);

    const res = await GET(new Request("http://localhost/api/deals?pipeline=SELLERS"));
    expect(res.status).toBe(200);
    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ pipeline: "SELLERS" }) })
    );
  });
});

describe("POST /api/deals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when stage is invalid for pipeline", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: "l1" } as any);

    const body = { leadId: "l1", pipeline: "BUYERS", stage: "LISTING_APPOINTMENT" };
    const res = await POST(
      new Request("http://localhost/api/deals", { method: "POST", body: JSON.stringify(body) })
    );
    expect(res.status).toBe(400);
  });

  it("creates a deal for valid input", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: "l1" } as any);
    vi.mocked(prisma.deal.create).mockResolvedValue(MOCK_DEAL_DB as any);

    const body = { leadId: "l1", pipeline: "BUYERS", stage: "TOURING" };
    const res = await POST(
      new Request("http://localhost/api/deals", { method: "POST", body: JSON.stringify(body) })
    );
    expect(res.status).toBe(201);
  });
});

describe("PATCH /api/deals/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when deal belongs to different agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: "a2" } as any);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue(MOCK_DEAL_DB as any);

    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ notes: "hi" }) }),
      { params: { id: "d1" } }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when new stage is invalid for pipeline", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue(MOCK_DEAL_DB as any);

    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ stage: "LISTING_APPOINTMENT" }),
      }),
      { params: { id: "d1" } }
    );
    expect(res.status).toBe(400);
  });

  it("updates stageUpdatedAt only when stage changes", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue(MOCK_DEAL_DB as any);
    vi.mocked(prisma.deal.update).mockResolvedValue(MOCK_DEAL_DB as any);

    await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ stage: "OFFER_SUBMITTED" }) }),
      { params: { id: "d1" } }
    );

    const updateCall = vi.mocked(prisma.deal.update).mock.calls[0][0];
    expect(updateCall.data).toHaveProperty("stageUpdatedAt");
  });

  it("does NOT update stageUpdatedAt when stage is unchanged", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue(MOCK_DEAL_DB as any);
    vi.mocked(prisma.deal.update).mockResolvedValue(MOCK_DEAL_DB as any);

    await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ notes: "updated" }) }),
      { params: { id: "d1" } }
    );

    const updateCall = vi.mocked(prisma.deal.update).mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("stageUpdatedAt");
  });
});

describe("DELETE /api/deals/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 204 on successful delete", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue(MOCK_DEAL_DB as any);
    vi.mocked(prisma.deal.delete).mockResolvedValue(MOCK_DEAL_DB as any);

    const res = await DELETE(new Request("http://localhost"), { params: { id: "d1" } });
    expect(res.status).toBe(204);
  });
});
