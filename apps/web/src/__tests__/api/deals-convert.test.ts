import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    deal: { findUnique: vi.fn(), update: vi.fn() },
    transactionFile: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/deals/[id]/convert/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const BUYERS_DEAL = {
  id: "d1", agentId: "a1", leadId: "l1",
  pipeline: "BUYERS", stage: "OFFER_ACCEPTED",
  propertyAddress: "123 Main St", price: 800000,
  transactionFileId: null,
  lead: { firstName: "Jane", lastName: "Doe" },
};

describe("POST /api/deals/[id]/convert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "d1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 when deal not found or not owned", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a2" } } as any);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue(BUYERS_DEAL as any);

    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "d1" } });
    expect(res.status).toBe(404);
  });

  it("returns 400 when stage is not OFFER_ACCEPTED", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue({ ...BUYERS_DEAL, stage: "TOURING" } as any);

    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "d1" } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/final stage/);
  });

  it("returns 409 when deal already has a transactionFileId", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue({ ...BUYERS_DEAL, transactionFileId: "tf1" } as any);

    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "d1" } });
    expect(res.status).toBe(409);
  });

  it("creates a TransactionFile and links it to the deal", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue(BUYERS_DEAL as any);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tf-new" } as any);
    vi.mocked(prisma.deal.update).mockResolvedValue({} as any);

    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "d1" } });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.transactionFileId).toBe("tf-new");
    expect(prisma.transactionFile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agentId: "a1",
          originatingLeadId: "l1",
          transactionSide: "PURCHASE",
          salePrice: 800000,
        }),
      })
    );
  });

  it("uses LISTING for SELLERS pipeline", async () => {
    const sellersDeal = { ...BUYERS_DEAL, pipeline: "SELLERS", price: 750000 };
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue(sellersDeal as any);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tf-new" } as any);
    vi.mocked(prisma.deal.update).mockResolvedValue({} as any);

    await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "d1" } });
    expect(prisma.transactionFile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ transactionSide: "LISTING", listPrice: 750000, originatingLeadId: "l1" }),
      })
    );
  });

  it("converts a LEASE_TENANT deal to a LEASE_TENANT transaction with leasePrice set", async () => {
    const leaseTenantDeal = {
      ...BUYERS_DEAL,
      id: "d1",
      pipeline: "LEASE_TENANT",
      stage: "LEASE_SIGNED",
      price: 2800,
    };
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue(leaseTenantDeal as any);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tf-new" } as any);
    vi.mocked(prisma.deal.update).mockResolvedValue({} as any);

    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "d1" } });
    expect(res.status).toBe(201);
    expect(prisma.transactionFile.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transactionSide: "LEASE_TENANT", leasePrice: 2800 }) })
    );
  });

  it("converts a LEASE_LANDLORD deal to a LEASE_LANDLORD transaction with leasePrice set", async () => {
    const leaseLandlordDeal = {
      ...BUYERS_DEAL,
      id: "d2",
      pipeline: "LEASE_LANDLORD",
      stage: "LEASE_SIGNED",
      price: 3200,
    };
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue(leaseLandlordDeal as any);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tf-new" } as any);
    vi.mocked(prisma.deal.update).mockResolvedValue({} as any);

    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "d2" } });
    expect(res.status).toBe(201);
    expect(prisma.transactionFile.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transactionSide: "LEASE_LANDLORD", leasePrice: 3200 }) })
    );
  });

  it("rejects converting a LEASE_TENANT deal that hasn't reached LEASE_SIGNED", async () => {
    const notYetSignedDeal = {
      ...BUYERS_DEAL,
      id: "d3",
      pipeline: "LEASE_TENANT",
      stage: "TOURING",
    };
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.deal.findUnique).mockResolvedValue(notYetSignedDeal as any);

    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "d3" } });
    expect(res.status).toBe(400);
  });
});
