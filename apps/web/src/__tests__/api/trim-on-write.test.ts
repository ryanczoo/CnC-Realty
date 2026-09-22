import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/api-auth", () => ({
  getFileAndVerifyAccess: vi.fn(),
  assertFileEditable: vi.fn(() => null),
  resolveFileRef: vi.fn(),
}));
vi.mock("@/lib/file-lock", () => ({ isFileReadOnlyFor: vi.fn(() => false) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    transactionFile: { create: vi.fn() },
    listingFile: { create: vi.fn() },
    checklistTemplate: { findFirst: vi.fn() },
    fileParty: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { getFileAndVerifyAccess, resolveFileRef } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST as postTransaction } from "../../app/api/transactions/route";
import { POST as postListing } from "../../app/api/listings/route";
import { POST as postParty } from "../../app/api/files/[fileType]/[id]/parties/route";
import { PATCH as patchParty } from "../../app/api/files/[fileType]/[id]/parties/[partyId]/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const json = (body: unknown) =>
  new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
  vi.mocked(getFileAndVerifyAccess).mockResolvedValue({ id: "f1", agentId: "a1", status: "PENDING" } as any);
  vi.mocked(resolveFileRef).mockReturnValue({ fileId: "f1", fileType: "transaction" } as any);
  vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.transactionFile.create).mockResolvedValue({ id: "tx1" } as any);
  vi.mocked(prisma.listingFile.create).mockResolvedValue({ id: "lf1" } as any);
  vi.mocked(prisma.fileParty.create).mockResolvedValue({ id: "p1" } as any);
  vi.mocked(prisma.fileParty.update).mockResolvedValue({ id: "p1" } as any);
  vi.mocked(prisma.fileParty.findUnique).mockResolvedValue({ id: "p1", transactionFileId: "f1", listingFileId: null } as any);
  vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
});

describe("whitespace is trimmed before a write", () => {
  it("POST /api/transactions trims propertyAddress and a nested party name", async () => {
    await postTransaction(json({
      transactionSide: "PURCHASE", propertyAddress: "  1 Main St  ", city: " Irvine ", zip: " 92603 ",
      propertyType: "Single Family", mlsNumber: "1234567890",
      parties: [{ role: "BUYER", name: "  Jane Buyer  " }],
    }));
    const data = vi.mocked(prisma.transactionFile.create).mock.calls[0][0].data as any;
    expect(data.propertyAddress).toBe("1 Main St");
    expect(data.city).toBe("Irvine");
    expect(data.parties.create[0].name).toBe("Jane Buyer");
  });

  it("POST /api/listings trims propertyAddress", async () => {
    await postListing(json({
      propertyAddress: "  1 Main St  ", city: "Irvine", zip: "92603", listPrice: "500000", listingType: "RESIDENTIAL_SALE",
    }));
    const data = vi.mocked(prisma.listingFile.create).mock.calls[0][0].data as any;
    expect(data.propertyAddress).toBe("1 Main St");
  });

  it("POST party trims name and company", async () => {
    await postParty(json({ role: "BUYER", name: "  Jane  ", company: " Acme  " }), { params: { fileType: "transaction", id: "f1" } });
    const data = vi.mocked(prisma.fileParty.create).mock.calls[0][0].data as any;
    expect(data.name).toBe("Jane");
    expect(data.company).toBe("Acme");
  });

  it("PATCH party trims name", async () => {
    await patchParty(json({ name: "  Jane  " }), { params: { fileType: "transaction", id: "f1", partyId: "p1" } });
    const data = vi.mocked(prisma.fileParty.update).mock.calls[0][0].data as any;
    expect(data.name).toBe("Jane");
  });
});
