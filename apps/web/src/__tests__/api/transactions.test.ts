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
      propertyType: "Single Family", yearBuilt: "1990", mlsNumber: "1234567890",
      legalDescription: "Lot 4, Block 2, Tract 12345",
      propertyIncludes: "Refrigerator, washer/dryer",
      propertyExcludes: "Wall-mounted TV brackets",
      taxId: "1234-567-890",
      numberOfParcels: "3",
      schoolDistrict: "Pasadena Unified",
      zoningClass: "R-1",
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.transaction.legalDescription).toBe("Lot 4, Block 2, Tract 12345");
    expect(body.transaction.numberOfParcels).toBe(3);
  });

  it("persists numberOfParcels as an integer, and null when omitted", async () => {
    let capturedArgs: any;
    vi.mocked(prisma.transactionFile.create).mockImplementation(
      (async (args: any) => {
        capturedArgs = args;
        return { id: "t1", ...args.data };
      }) as any
    );

    const withParcels = await POST(makeRequest({
      transactionSide: "PURCHASE",
      propertyAddress: "1 Test St", city: "Test", zip: "00000",
      propertyType: "Single Family", yearBuilt: "1990", mlsNumber: "1234567890",
      numberOfParcels: "3",
    }));
    expect(withParcels.status).toBe(201);
    expect(capturedArgs.data.numberOfParcels).toBe(3);
    expect(typeof capturedArgs.data.numberOfParcels).toBe("number");

    const withoutParcels = await POST(makeRequest({
      transactionSide: "PURCHASE",
      propertyAddress: "1 Test St", city: "Test", zip: "00000",
      propertyType: "Single Family", yearBuilt: "1990", mlsNumber: "1234567890",
    }));
    expect(withoutParcels.status).toBe(201);
    expect(capturedArgs.data.numberOfParcels).toBeNull();
  });

  it("persists saleCommissionAmount and listingCommissionAmount as the raw dollar amount regardless of which mode entered them", async () => {
    let capturedArgs: any;
    vi.mocked(prisma.transactionFile.create).mockImplementation(
      (async (args: any) => {
        capturedArgs = args;
        return { id: "t1", ...args.data };
      }) as any
    );

    const res = await POST(makeRequest({
      transactionSide: "DUAL",
      propertyAddress: "1 Test St", city: "Test", zip: "00000",
      propertyType: "Single Family", yearBuilt: "1990", mlsNumber: "1234567890",
      saleCommissionAmount: "12345.67",
      listingCommissionAmount: "890.12",
    }));
    expect(res.status).toBe(201);
    expect(capturedArgs.data.saleCommissionAmount).toBe(12345.67);
    expect(capturedArgs.data.listingCommissionAmount).toBe(890.12);
  });

  it("persists saleCommissionAmount and listingCommissionAmount as null when omitted", async () => {
    let capturedArgs: any;
    vi.mocked(prisma.transactionFile.create).mockImplementation(
      (async (args: any) => {
        capturedArgs = args;
        return { id: "t1", ...args.data };
      }) as any
    );

    const res = await POST(makeRequest({
      transactionSide: "PURCHASE",
      propertyAddress: "1 Test St", city: "Test", zip: "00000",
      propertyType: "Single Family", yearBuilt: "1990", mlsNumber: "1234567890",
    }));
    expect(res.status).toBe(201);
    expect(capturedArgs.data.saleCommissionAmount).toBeNull();
    expect(capturedArgs.data.listingCommissionAmount).toBeNull();
  });

  it("persists agentRelativeSale and brokerProvidedLead as true when provided, false by default", async () => {
    let capturedArgs: any;
    vi.mocked(prisma.transactionFile.create).mockImplementation(
      (async (args: any) => {
        capturedArgs = args;
        return { id: "t1", ...args.data };
      }) as any
    );

    const withBooleans = await POST(makeRequest({
      transactionSide: "PURCHASE",
      propertyAddress: "1 Test St", city: "Test", zip: "00000",
      propertyType: "Single Family", yearBuilt: "1990", mlsNumber: "1234567890",
      agentRelativeSale: true,
      brokerProvidedLead: true,
    }));
    expect(withBooleans.status).toBe(201);
    expect(capturedArgs.data.agentRelativeSale).toBe(true);
    expect(capturedArgs.data.brokerProvidedLead).toBe(true);

    const withoutBooleans = await POST(makeRequest({
      transactionSide: "PURCHASE",
      propertyAddress: "1 Test St", city: "Test", zip: "00000",
      propertyType: "Single Family", yearBuilt: "1990", mlsNumber: "1234567890",
    }));
    expect(withoutBooleans.status).toBe(201);
    expect(capturedArgs.data.agentRelativeSale).toBe(false);
    expect(capturedArgs.data.brokerProvidedLead).toBe(false);
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
      propertyType: "Single Family", yearBuilt: "1990",
      mlsNumber: "1234567890",
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
      propertyType: "Single Family", yearBuilt: "1990", mlsNumber: "1234567890",
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

  it("returns 400 when REFERRAL is submitted without referredToAgentName", async () => {
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        transactionSide: "REFERRAL",
        referredToBrokerageName: "Other Realty",
      }),
    }));
    expect(res.status).toBe(400);
  });

  it("still requires propertyAddress/city/zip for non-REFERRAL sides", async () => {
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ transactionSide: "PURCHASE" }),
    }));
    expect(res.status).toBe(400);
  });

  it("requires propertyType for non-REFERRAL sides", async () => {
    const res = await POST(makeRequest({
      transactionSide: "PURCHASE",
      propertyAddress: "1 Test St", city: "Test", zip: "00000",
      mlsNumber: "1234567890",
    }));
    expect(res.status).toBe(400);
  });

  // MLS # is optional (off-market, FSBO, new construction, most leases and
  // commercial deals have none) — reverses the 2026-07-21 requirement.
  it("creates a non-REFERRAL transaction without an MLS number", async () => {
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "t-no-mls" } as any);
    const res = await POST(makeRequest({
      transactionSide: "PURCHASE",
      propertyAddress: "1 Test St", city: "Test", zip: "00000",
      propertyType: "Single Family", yearBuilt: "1990",
    }));
    expect(res.status).toBe(201);
    const data = vi.mocked(prisma.transactionFile.create).mock.calls[0][0].data as any;
    expect(data.mlsNumber).toBeNull();
  });

  it("saves lease signed/start dates for a lease side", async () => {
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "t-lease" } as any);
    const res = await POST(makeRequest({
      transactionSide: "LEASE_TENANT",
      propertyAddress: "1 Test St", city: "Test", zip: "00000", propertyType: "Condo", yearBuilt: "1990", leasePrice: "36000",
      leaseSignedDate: "2026-09-20", leaseStartDate: "2026-10-01",
    }));
    expect(res.status).toBe(201);
    const data = vi.mocked(prisma.transactionFile.create).mock.calls[0][0].data as any;
    expect(data.leaseSignedDate).toEqual(new Date("2026-09-20"));
    expect(data.leaseStartDate).toEqual(new Date("2026-10-01"));
  });

  it("ignores lease dates on a sale side", async () => {
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "t-sale" } as any);
    await POST(makeRequest({
      transactionSide: "PURCHASE",
      propertyAddress: "1 Test St", city: "Test", zip: "00000", propertyType: "Condo", yearBuilt: "1990",
      leaseSignedDate: "2026-09-20", leaseStartDate: "2026-10-01",
    }));
    const data = vi.mocked(prisma.transactionFile.create).mock.calls[0][0].data as any;
    expect(data.leaseSignedDate).toBeNull();
    expect(data.leaseStartDate).toBeNull();
  });

  describe("starting status", () => {
    const complete = {
      transactionSide: "LISTING", stage: "UNDER_CONTRACT",
      propertyAddress: "1 Test St", city: "Test", zip: "00000", propertyType: "Condo", yearBuilt: "1990",
      salePrice: "900000", acceptanceDate: "2026-09-20", closeOfEscrow: "2026-10-20",
      listingCommissionPct: "2.5",
      parties: [{ role: "SELLER", name: "Sam Seller" }],
    };

    it("refuses an Under Contract file without its side's commission", async () => {
      const res = await POST(makeRequest({ ...complete, listingCommissionPct: "" }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Commission is required for an Under Contract file");
      expect(prisma.transactionFile.create).not.toHaveBeenCalled();
    });

    it("refuses dates out of order, at any stage", async () => {
      const res = await POST(makeRequest({ ...complete, closeOfEscrow: "2026-09-01" }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Close of Escrow can't be before the Acceptance Date");
      const pre = await POST(makeRequest({ ...complete, stage: "PRE_CONTRACT", offerDate: "2026-09-10", offerExpirationDate: "2026-09-05" }));
      expect(pre.status).toBe(400);
      expect(prisma.transactionFile.create).not.toHaveBeenCalled();
    });

    it("lets a Pre-Contract file skip commission", async () => {
      const res = await POST(makeRequest({ ...complete, stage: "PRE_CONTRACT", listingCommissionPct: "" }));
      expect(res.status).toBe(201);
    });

    it("rejects a commission % over 100", async () => {
      const res = await POST(makeRequest({ ...complete, listingCommissionPct: "150" }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Commission can't be more than 100%");
    });
    const created = () => (vi.mocked(prisma.transactionFile.create).mock.calls[0][0].data as any).status;
    beforeEach(() => vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "t-new" } as any));

    it("starts an Under Contract transaction as Pending when its details are complete", async () => {
      await POST(makeRequest(complete));
      expect(created()).toBe("PENDING");
    });

    it("starts it Incomplete while details are missing", async () => {
      await POST(makeRequest({ ...complete, closeOfEscrow: "" }));
      expect(created()).toBe("INCOMPLETE");
    });

    it("keeps a Pre-Contract file Pre-Contract", async () => {
      await POST(makeRequest({ ...complete, stage: "PRE_CONTRACT" }));
      expect(created()).toBe("PRE_CONTRACT");
    });
  });

  it("does not require propertyType or mlsNumber for REFERRAL", async () => {
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "t-ref" } as any);

    const res = await POST(makeRequest({
      transactionSide: "REFERRAL",
      referredToAgentName: "Jane Outbound",
    }));
    expect(res.status).toBe(201);
  });
});

describe("POST /api/transactions — propertyCategory checklist matching", () => {
  beforeEach(() => vi.clearAllMocks());

  it("matches the checklist template using both transactionSide and propertyCategory", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: "a1" } } as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tx1" } as any);

    await POST(makeRequest({
      transactionSide: "PURCHASE", propertyCategory: "COMMERCIAL",
      propertyAddress: "1 Biz Park Dr", city: "Irvine", zip: "92618",
      propertyType: "Commercial", yearBuilt: "1990", mlsNumber: "1234567890",
    }));

    expect(prisma.checklistTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ transactionSide: "PURCHASE" }, { transactionSide: "ALL" }],
          AND: [{ OR: [{ propertyCategory: "COMMERCIAL" }, { propertyCategory: "ALL" }] }],
        }),
      })
    );
  });

  it("defaults propertyCategory to RESIDENTIAL when not provided (regression guard)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: "a1" } } as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tx2" } as any);

    await POST(makeRequest({
      transactionSide: "PURCHASE",
      propertyAddress: "123 Main St", city: "LA", zip: "90001",
      propertyType: "Single Family", yearBuilt: "1990", mlsNumber: "1234567890",
    }));

    expect(prisma.checklistTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ OR: [{ propertyCategory: "RESIDENTIAL" }, { propertyCategory: "ALL" }] }],
        }),
      })
    );
  });

  it("persists propertyCategory on the created TransactionFile", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: "a1" } } as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tx3" } as any);

    await POST(makeRequest({
      transactionSide: "PURCHASE", propertyCategory: "COMMERCIAL",
      propertyAddress: "1 Biz Park Dr", city: "Irvine", zip: "92618",
      propertyType: "Commercial", yearBuilt: "1990", mlsNumber: "1234567890",
    }));

    expect(prisma.transactionFile.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ propertyCategory: "COMMERCIAL" }) })
    );
  });

  it("refuses a photo key that isn't the caller's", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: "a1" } } as any);
    const res = await POST(makeRequest({
      transactionSide: "PURCHASE", propertyAddress: "1 Test St", city: "Test", zip: "00000", propertyType: "Single Family", yearBuilt: "1990",
      photoKey: "transactions/listing/l9/d9/secret.pdf",
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid photo");
    expect(prisma.transactionFile.create).not.toHaveBeenCalled();
  });

  it("saves the caller's own photo key", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: "a1" } } as any);
    vi.mocked(prisma.transactionFile.create).mockImplementation((async (args: any) => ({ id: "t1", ...args.data })) as any);
    const res = await POST(makeRequest({
      transactionSide: "PURCHASE", propertyAddress: "1 Test St", city: "Test", zip: "00000", propertyType: "Single Family", yearBuilt: "1990",
      photoKey: "wizard-photos/u1/abc/photo.jpg",
    }));
    expect(res.status).toBe(201);
    expect((await res.json()).transaction.photoKey).toBe("wizard-photos/u1/abc/photo.jpg");
  });

  it("never saves a photo on a referral", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: "a1" } } as any);
    vi.mocked(prisma.transactionFile.create).mockImplementation((async (args: any) => ({ id: "t1", ...args.data })) as any);
    await POST(makeRequest({
      transactionSide: "REFERRAL", referredToAgentName: "Pat Lee",
      photoKey: "wizard-photos/u1/abc/photo.jpg",
    }));
    expect(vi.mocked(prisma.transactionFile.create).mock.calls[0][0].data.photoKey).toBeNull();
  });
});

describe("POST /api/transactions — Year Built", () => {
  const LPD = { name: "LPD", description: "lead", order: 2, isRequired: true, builtBefore: 1978 };
  const template = { items: [{ name: "RPA", description: null, order: 1, isRequired: true, builtBefore: null }, LPD] };
  const body = (extra: object) => makeRequest({
    transactionSide: "PURCHASE", propertyAddress: "1 Test St", city: "Test", zip: "00000",
    propertyType: "Single Family", yearBuilt: "1990", mlsNumber: "1234567890", ...extra,
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", agentId: "a1" } } as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(template as any);
    vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tx1" } as any);
  });

  it("requires a year unless the property is Land", async () => {
    const res = await POST(body({ yearBuilt: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Year Built is required");
    expect((await POST(body({ yearBuilt: "", propertyType: "Land" }))).status).toBe(201);
  });

  it("refuses a year outside 1500 through next year", async () => {
    const res = await POST(body({ yearBuilt: "1400" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^Year Built must be between 1500 and \d{4}$/);
  });

  it("adds the lead-paint item only for an older home", async () => {
    await POST(body({ yearBuilt: "1952" }));
    const old = (vi.mocked(prisma.transactionFile.create).mock.calls[0][0].data as any).checklistItems.create;
    expect(old.map((i: any) => [i.name, i.builtBefore])).toEqual([["RPA", null], ["LPD", 1978]]);
    await POST(body({ yearBuilt: "2005" }));
    const newer = (vi.mocked(prisma.transactionFile.create).mock.calls[1][0].data as any).checklistItems.create;
    expect(newer.map((i: any) => i.name)).toEqual(["RPA"]);
  });

  it("a referral needs no year", async () => {
    const res = await POST(makeRequest({ transactionSide: "REFERRAL", referredToAgentName: "Pat" }));
    expect(res.status).toBe(201);
  });
});
