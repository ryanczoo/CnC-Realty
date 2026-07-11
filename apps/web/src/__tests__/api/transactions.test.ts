import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    transactionFile: { findMany: vi.fn(), create: vi.fn() },
    checklistTemplate: { findFirst: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../../app/api/transactions/route";

function makeRequest(body: object) {
  return new Request("http://localhost/api/transactions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/transactions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 404 when session has no agentId", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: null } } as any);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("scopes transactions using session.agentId, without querying prisma.agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: "a1" } } as any);
    vi.mocked(prisma.transactionFile.findMany).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.agent.findUnique).not.toHaveBeenCalled();
    expect(prisma.transactionFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agentId: "a1" } })
    );
  });
});

describe("POST /api/transactions", () => {
  const SESSION_AGENT = { user: { id: "u1", agentId: "a1" } };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null as any);
  });

  it("persists the new Property-step fields", async () => {
    vi.mocked(prisma.transactionFile.create).mockImplementation(
      (async (args: any) => ({ id: "t1", ...args.data })) as any
    );

    const res = await POST(makeRequest({
      transactionSide: "PURCHASE",
      propertyAddress: "1 Test St", city: "Test", zip: "00000",
      legalDescription: "Lot 4, Block 2, Tract 12345",
      propertyIncludes: "Refrigerator, washer/dryer",
      propertyExcludes: "Wall-mounted TV brackets",
      taxId: "1234-567-890",
      annualTaxes: 8500,
      schoolDistrict: "Pasadena Unified",
      zoningClass: "R-1",
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.transaction.legalDescription).toBe("Lot 4, Block 2, Tract 12345");
    expect(body.transaction.annualTaxes).toBe(8500);
  });
});
