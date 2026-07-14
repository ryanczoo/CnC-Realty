import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn(), update: vi.fn() },
    checklistTemplate: { findFirst: vi.fn() },
    transactionFile: { create: vi.fn() },
    fileActivity: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/listings/[id]/convert/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

const SALE_LISTING = {
  id: "l1", agentId: "a1", listingType: "RESIDENTIAL_SALE",
  propertyAddress: "123 Main St", city: "LA", state: "CA", zip: "90001",
  mlsNumber: "M1", listPrice: 800000,
};

const LEASE_LISTING = {
  ...SALE_LISTING, id: "l2", listingType: "RESIDENTIAL_LEASE",
};

describe("POST /api/listings/[id]/convert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(((arr: any[]) => Promise.all(arr)) as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({} as any);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "l1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 when listing not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "l1" } });
    expect(res.status).toBe(404);
  });

  it("returns 403 when the listing belongs to a different agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a2" } } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(SALE_LISTING as any);
    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "l1" } });
    expect(res.status).toBe(403);
  });

  it("converts a RESIDENTIAL_SALE listing to transactionSide LISTING", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(SALE_LISTING as any);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tf1" } as any);

    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "l1" } });
    expect(res.status).toBe(201);
    expect(prisma.transactionFile.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transactionSide: "LISTING" }) })
    );
  });

  it("converts a RESIDENTIAL_LEASE listing to transactionSide LEASE_LANDLORD, not LISTING", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(LEASE_LISTING as any);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tf2" } as any);

    const res = await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "l2" } });
    expect(res.status).toBe(201);
    expect(prisma.transactionFile.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transactionSide: "LEASE_LANDLORD" }) })
    );
  });

  it("looks up the checklist template using the derived transactionSide, not a hardcoded LISTING", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(LEASE_LISTING as any);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tf3" } as any);

    await POST(new Request("http://localhost", { method: "POST" }), { params: { id: "l2" } });
    expect(prisma.checklistTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ transactionSide: "LEASE_LANDLORD" }, { transactionSide: "ALL" }],
        }),
      })
    );
  });
});
