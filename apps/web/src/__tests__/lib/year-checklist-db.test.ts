import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn(), update: vi.fn() },
    transactionFile: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    checklistTemplate: { findFirst: vi.fn() },
    fileChecklistItem: { createMany: vi.fn(), deleteMany: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { recheckYearChecklist, applyPropertyFacts } from "@/lib/year-checklist-db";

const LPD = "LPD — Lead-Based Paint and Lead-Based Paint Hazards Disclosure";
const EQ = "Residential Earthquake Hazards Report (Homeowner's Guide to Earthquake Safety)";
const TEMPLATE = { items: [
  { name: "RLA", description: null, order: 1, isRequired: true, builtBefore: null },
  { name: LPD, description: "lead", order: 9, isRequired: true, builtBefore: 1978 },
  { name: EQ, description: "eq", order: 10, isRequired: true, builtBefore: 1960 },
] };
const AGENT = { userId: "u1", role: "AGENT" as const };
const row = (id: string, name: string, documents = 0, isRequired = true) => ({ id, name, isRequired, _count: { documents } });
const listing = (over: Record<string, unknown> = {}) => ({
  id: "l1", status: "ACTIVE", listingType: "RESIDENTIAL_SALE", yearBuilt: 1952, checklistItems: [row("r1", "RLA")], ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(((ops: unknown[]) => Promise.all(ops)) as any);
  vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(TEMPLATE as any);
  vi.mocked(prisma.transactionFile.findMany).mockResolvedValue([]);
});

describe("recheckYearChecklist", () => {
  it("adds the items that now apply and logs one activity", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing() as any);
    const res = await recheckYearChecklist("listing", "l1", AGENT, "Year Built set to 1952");
    expect(res).toEqual({ added: ["LPD", "Residential Earthquake Hazards Report"], removed: [] });
    const created = vi.mocked(prisma.fileChecklistItem.createMany).mock.calls[0][0] as any;
    expect(created.data.map((d: any) => [d.name, d.listingFileId, d.builtBefore, d.order])).toEqual([[LPD, "l1", 1978, 9], [EQ, "l1", 1960, 10]]);
    expect(prisma.fileActivity.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.fileActivity.create).mock.calls[0][0]).toMatchObject({ data: {
      type: "CHECKLIST_UPDATED", fileType: "LISTING", listingFileId: "l1", actorId: "u1", actorRole: "AGENT",
      payload: { reason: "Year Built set to 1952", added: ["LPD", "Residential Earthquake Hazards Report"], removed: [] },
    } });
  });

  it("removes a year row without documents, keeps one with a document", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing({ yearBuilt: 2005, checklistItems: [row("r1", "RLA"), row("l", LPD), row("e", EQ, 1)] }) as any);
    const res = await recheckYearChecklist("listing", "l1", AGENT, "Year Built set to 2005");
    expect(res).toEqual({ added: [], removed: ["LPD"] });
    expect(prisma.fileChecklistItem.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["l"] } } });
  });

  it("running again on a matching checklist writes nothing", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing({ checklistItems: [row("r1", "RLA"), row("l", LPD), row("e", EQ)] }) as any);
    expect(await recheckYearChecklist("listing", "l1", AGENT, "x")).toEqual({ added: [], removed: [] });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
  });

  it("leaves a locked (closed) file alone", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "t1", status: "CLOSED", transactionSide: "LISTING", propertyCategory: "RESIDENTIAL", yearBuilt: 1952, checklistItems: [] } as any);
    expect(await recheckYearChecklist("transaction", "t1", AGENT, "x")).toEqual({ added: [], removed: [] });
    expect(prisma.checklistTemplate.findFirst).not.toHaveBeenCalled();
  });

  it("uses the template's current built-before year", async () => {
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue({ items: [{ ...TEMPLATE.items[1], builtBefore: 1950 }] } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing() as any);
    expect((await recheckYearChecklist("listing", "l1", AGENT, "x")).added).toEqual([]);
  });

  it("makes an existing optional row of the same name required", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing({ checklistItems: [row("l", LPD, 0, false), row("e", EQ)] }) as any);
    await recheckYearChecklist("listing", "l1", AGENT, "x");
    expect(prisma.fileChecklistItem.update).toHaveBeenCalledWith({ where: { id: "l" }, data: { isRequired: true, builtBefore: 1978 } });
  });
});

describe("applyPropertyFacts", () => {
  it("copies the year to the listing's open transaction and re-checks both", async () => {
    vi.mocked(prisma.transactionFile.findMany).mockResolvedValue([{ id: "t1", status: "PENDING" }, { id: "t2", status: "CLOSED" }] as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing({ checklistItems: [row("l", LPD), row("e", EQ)] }) as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "t1", status: "PENDING", transactionSide: "LISTING", propertyCategory: "RESIDENTIAL", yearBuilt: 1952, checklistItems: [] } as any);
    await applyPropertyFacts("listing", "l1", { yearBuilt: 1952 }, AGENT);
    expect(prisma.transactionFile.update).toHaveBeenCalledTimes(1);
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { yearBuilt: 1952 } });
    const txActivity = vi.mocked(prisma.fileActivity.create).mock.calls.map((c: any) => c[0].data).find((d: any) => d.transactionFileId === "t1");
    expect(txActivity.payload.reason).toBe("Year Built set to 1952");
  });

  it("copies a transaction's property type back to its open listing", async () => {
    vi.mocked(prisma.transactionFile.findUnique)
      .mockResolvedValueOnce({ originatingListingId: "l1" } as any)
      .mockResolvedValue({ id: "t1", status: "PENDING", transactionSide: "LISTING", propertyCategory: "RESIDENTIAL", yearBuilt: null, checklistItems: [] } as any);
    vi.mocked(prisma.listingFile.findUnique)
      .mockResolvedValueOnce({ id: "l1", status: "ACTIVE_UNDER_CONTRACT" } as any)
      .mockResolvedValue(listing({ yearBuilt: null, checklistItems: [] }) as any);
    await applyPropertyFacts("transaction", "t1", { propertyType: "Land" }, AGENT);
    expect(prisma.listingFile.update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { propertyType: "Land" } });
  });
});
