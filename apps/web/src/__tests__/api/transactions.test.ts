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

  it("creates a REFERRAL_AGENT party when provided", async () => {
    let capturedArgs: any;
    vi.mocked(prisma.transactionFile.create).mockImplementation(
      (async (args: any) => {
        capturedArgs = args;
        return { id: "t1", ...args.data };
      }) as any
    );

    const res = await POST(makeRequest({
      transactionSide: "PURCHASE",
      propertyAddress: "1 Test St",
      city: "Test",
      zip: "00000",
      parties: [
        { role: "REFERRAL_AGENT", name: "Jane Outbound", email: "jane@otherbrokerage.com", company: "Other Realty" },
      ],
    }));

    expect(res.status).toBe(201);

    // Verify the referral agent party was included in the Prisma create call
    expect(capturedArgs.data.parties).toBeDefined();
    expect(capturedArgs.data.parties.create).toBeDefined();
    const referralAgentParty = capturedArgs.data.parties.create.find((p: any) => p.role === "REFERRAL_AGENT");
    expect(referralAgentParty).toBeDefined();
    expect(referralAgentParty?.name).toBe("Jane Outbound");
    expect(referralAgentParty?.email).toBe("jane@otherbrokerage.com");
    expect(referralAgentParty?.company).toBe("Other Realty");
  });

  it("persists leasePrice (not salePrice) for a LEASE_TENANT transaction", async () => {
    vi.mocked(prisma.transactionFile.create).mockImplementation(
      (async (args: any) => ({ id: "t1", ...args.data })) as any
    );

    const res = await POST(makeRequest({
      transactionSide: "LEASE_TENANT", propertyAddress: "1 Test St", city: "Test", zip: "00000",
      leasePrice: "2800",
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.transaction.leasePrice).toBe(2800);
    expect(body.transaction.salePrice).toBeNull();
  });

  it("creates a REFERRAL transaction with no property fields required", async () => {
    let capturedArgs: any;
    vi.mocked(prisma.transactionFile.create).mockImplementation((async (args: any) => {
      capturedArgs = args;
      return { id: "tf-referral" };
    }) as any);

    const res = await POST(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        transactionSide: "REFERRAL",
        referredToAgentName: "Jane Outbound",
        referredToBrokerageName: "Other Realty",
        referredToContactEmail: "jane@otherrealty.com",
        referredToContactPhone: "555-1234",
        dateReferred: "2026-07-14",
      }),
    }));

    expect(res.status).toBe(201);
    expect(capturedArgs.data.propertyAddress).toBeNull();
    expect(capturedArgs.data.referredToAgentName).toBe("Jane Outbound");
    expect(capturedArgs.data.referredToBrokerageName).toBe("Other Realty");
    expect(capturedArgs.data.status).toBe("PENDING");
  });

  it("still requires propertyAddress/city/zip for non-REFERRAL sides", async () => {
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ transactionSide: "PURCHASE" }),
    }));
    expect(res.status).toBe(400);
  });
});
