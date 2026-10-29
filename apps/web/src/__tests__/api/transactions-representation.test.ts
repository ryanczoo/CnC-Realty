import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    transactionFile: { findUnique: vi.fn(), update: vi.fn() },
    checklistTemplate: { findFirst: vi.fn() },
    fileChecklistItem: { createMany: vi.fn(), deleteMany: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/file-status", () => ({ maybeAutoPending: vi.fn() }));

import { maybeAutoPending } from "@/lib/file-status";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/transactions/[id]/representation/route";

const item = (name: string, extra: Record<string, unknown> = {}) => ({
  name, description: null, order: 1, isRequired: true, builtBefore: null, skipWhenConverted: false, ...extra,
});
const row = (id: string, name: string, docs = 0) => ({ id, name, isRequired: true, _count: { documents: docs } });

function file(over: Record<string, unknown> = {}) {
  return {
    id: "tf1", status: "PRE_CONTRACT", transactionSide: "LISTING", propertyCategory: "RESIDENTIAL",
    yearBuilt: 2000, originatingListingId: null, salePrice: 1000000, leasePrice: null,
    saleCommissionPct: 2, saleCommissionAmount: null, listingCommissionPct: 3, listingCommissionAmount: null,
    checklistItems: [], ...over,
  };
}
const req = (body: unknown) => new Request("http://localhost/api/transactions/tf1/representation", { method: "POST", body: JSON.stringify(body) });
const call = (body: unknown) => POST(req(body), { params: { id: "tf1" } });
const admin = () => vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin1", role: "ADMIN", agentId: null } } as any);

describe("POST /api/transactions/[id]/representation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    admin();
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue({ items: [] } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "tf1" } as any);
  });

  it("401 signed out", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    expect((await call({ transactionSide: "DUAL" })).status).toBe(401);
  });

  it("403 for an AGENT, even the file's own agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    expect((await call({ transactionSide: "DUAL" })).status).toBe(403);
  });

  it("404 unknown id", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(null);
    expect((await call({ transactionSide: "DUAL" })).status).toBe(404);
  });

  it.each(["CLOSED", "CANCELED_APPROVED", "ARCHIVED"])("400 for a finished file (%s)", async (status) => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(file({ status }) as any);
    const res = await call({ transactionSide: "DUAL" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("This file is finished and can't be changed.");
  });

  it("400 for a locked transfer placeholder", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(file({ status: "PENDING_TRANSFER" }) as any);
    const res = await call({ transactionSide: "DUAL" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("This file is locked until its transfer is approved.");
  });

  it("allows CANCELED_PENDING", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(file({ status: "CANCELED_PENDING" }) as any);
    expect((await call({ transactionSide: "DUAL" })).status).toBe(200);
  });

  it.each([
    ["LISTING", "LEASE_DUAL"], ["LEASE_TENANT", "PURCHASE"], ["LISTING", "REFERRAL"], ["REFERRAL", "LISTING"], ["LISTING", "LISTING"], ["LISTING", undefined],
  ])("400 for %s -> %s", async (from, to) => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(file({ transactionSide: from }) as any);
    const res = await call({ transactionSide: to });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("That change isn't allowed.");
  });

  it("LISTING -> DUAL adds Dual rows, keeps a row with a document, removes an empty row Dual lacks", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(file({
      checklistItems: [row("r1", "Shared"), row("r2", "Listing Only Doc", 1), row("r3", "Listing Only Empty", 0)],
    }) as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue({ items: [item("Shared"), item("Buyer Rep Agreement")] } as any);
    const res = await call({ transactionSide: "DUAL" });
    expect(res.status).toBe(200);
    expect((await res.json()).transactionFile).toEqual({ id: "tf1" });
    const created = vi.mocked(prisma.fileChecklistItem.createMany).mock.calls[0][0] as any;
    expect(created.data).toHaveLength(1);
    expect(created.data[0]).toMatchObject({ name: "Buyer Rep Agreement", transactionFileId: "tf1", fileType: "TRANSACTION" });
    expect(prisma.fileChecklistItem.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["r3"] }, documents: { none: {} } } });
  });

  it("a converted file switching DUAL -> LISTING doesn't add RLA/AVID", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(file({ transactionSide: "DUAL", originatingListingId: "l1" }) as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue({
      items: [item("Residential Listing Agreement (RLA)", { skipWhenConverted: true }), item("Other")],
    } as any);
    await call({ transactionSide: "LISTING" });
    const created = vi.mocked(prisma.fileChecklistItem.createMany).mock.calls[0][0] as any;
    expect(created.data.map((d: any) => d.name)).toEqual(["Other"]);
  });

  it("recomputes commissionGCI for the new side", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(file() as any);
    await call({ transactionSide: "DUAL" });
    expect(vi.mocked(prisma.transactionFile.update).mock.calls[0][0]).toMatchObject({
      where: { id: "tf1" },
      data: { transactionSide: "DUAL", commissionGCI: 50000, saleCommissionAmount: 20000, listingCommissionAmount: 30000 },
    });
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(file({ transactionSide: "DUAL" }) as any);
    await call({ transactionSide: "PURCHASE" });
    expect(vi.mocked(prisma.transactionFile.update).mock.calls[1][0]).toMatchObject({ data: { transactionSide: "PURCHASE", commissionGCI: 20000 } });
  });

  it("writes one REPRESENTATION_CHANGED activity with short names and the admin's id", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(file({ checklistItems: [row("r3", "Listing Only Empty", 0)] }) as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue({ items: [item("Buyer Rep Agreement")] } as any);
    await call({ transactionSide: "DUAL" });
    expect(prisma.fileActivity.create).toHaveBeenCalledTimes(1);
    const data = (vi.mocked(prisma.fileActivity.create).mock.calls[0][0] as any).data;
    expect(data).toMatchObject({
      fileType: "TRANSACTION", transactionFileId: "tf1", actorId: "admin1", actorRole: "ADMIN", type: "REPRESENTATION_CHANGED",
      payload: { from: "LISTING", to: "DUAL", added: ["Buyer Rep Agreement"], removed: ["Listing Only Empty"] },
    });
  });

  it("LEASE_TENANT -> LEASE_DUAL prices commission from leasePrice", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(file({
      transactionSide: "LEASE_TENANT", leasePrice: 2000, salePrice: 999999,
      saleCommissionPct: 50, listingCommissionPct: 50,
    }) as any);
    const res = await call({ transactionSide: "LEASE_DUAL" });
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.transactionFile.update).mock.calls[0][0]).toMatchObject({
      data: { transactionSide: "LEASE_DUAL", saleCommissionAmount: 1000, listingCommissionAmount: 1000, commissionGCI: 2000 },
    });
  });

  it("flips a matching row's required flag", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(file({ checklistItems: [row("r1", "Shared")] }) as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue({ items: [item("Shared", { isRequired: false })] } as any);
    await call({ transactionSide: "DUAL" });
    expect(prisma.fileChecklistItem.update).toHaveBeenCalledWith({ where: { id: "r1" }, data: { isRequired: false } });
  });

  it("demotes a kept old-type row (has a document) to optional", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(file({ checklistItems: [row("r2", "Listing Only Doc", 1)] }) as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue({ items: [item("Buyer Rep Agreement")] } as any);
    await call({ transactionSide: "DUAL" });
    expect(prisma.fileChecklistItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.fileChecklistItem.update).toHaveBeenCalledWith({ where: { id: "r2" }, data: { isRequired: false } });
  });

  it("runs maybeAutoPending as the admin after success, not on a 400", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(file() as any);
    await call({ transactionSide: "DUAL" });
    expect(maybeAutoPending).toHaveBeenCalledWith("tf1", { userId: "admin1", role: "ADMIN" });
    vi.mocked(maybeAutoPending).mockClear();
    await call({ transactionSide: "LEASE_DUAL" });
    expect(maybeAutoPending).not.toHaveBeenCalled();
  });

  it("with no matching template, still changes side and commission but no checklist rows", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(file({ checklistItems: [row("r3", "Listing Only Empty")] }) as any);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
    const res = await call({ transactionSide: "DUAL" });
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.transactionFile.update).mock.calls[0][0]).toMatchObject({ data: { transactionSide: "DUAL", commissionGCI: 50000 } });
    expect(prisma.fileChecklistItem.createMany).not.toHaveBeenCalled();
    expect(prisma.fileChecklistItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.fileChecklistItem.update).not.toHaveBeenCalled();
  });
});
