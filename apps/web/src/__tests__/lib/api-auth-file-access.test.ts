import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getFileAndVerifyAccess } from "@/lib/api-auth";

describe("getFileAndVerifyAccess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the file when the caller owns it", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status: "INCOMPLETE" } as any);
    const result = await getFileAndVerifyAccess("listing", "f1", "a1", "AGENT");
    expect(result).toEqual({ id: "f1", agentId: "a1", status: "INCOMPLETE" });
  });

  it("returns null when a different agent owns the file", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status: "INCOMPLETE" } as any);
    const result = await getFileAndVerifyAccess("listing", "f1", "a2", "AGENT");
    expect(result).toBeNull();
  });

  it("returns the file for ADMIN regardless of owner", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "f2", agentId: "a1", status: "PENDING" } as any);
    const result = await getFileAndVerifyAccess("transaction", "f2", null, "ADMIN");
    expect(result).toEqual({ id: "f2", agentId: "a1", status: "PENDING" });
  });

  it("returns null when the file does not exist", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(null);
    const result = await getFileAndVerifyAccess("listing", "missing", "a1", "AGENT");
    expect(result).toBeNull();
  });

  it("queries transactionFile, not listingFile, when fileType is 'transaction'", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "f3", agentId: "a1", status: "INCOMPLETE" } as any);
    await getFileAndVerifyAccess("transaction", "f3", "a1", "AGENT");
    expect(prisma.transactionFile.findUnique).toHaveBeenCalledWith({
      where: { id: "f3" },
      select: { id: true, agentId: true, status: true },
    });
    expect(prisma.listingFile.findUnique).not.toHaveBeenCalled();
  });
});
