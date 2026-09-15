import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/r2", () => ({ deleteR2Object: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn(), delete: vi.fn() },
    fileDocument: { findMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object } from "@/lib/r2";
import { DELETE } from "../../app/api/listings/[id]/route";

describe("DELETE /api/listings/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.fileDocument.findMany).mockResolvedValue([]);
  });

  it("still allows deleting an INCOMPLETE listing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "ADMIN", agentId: null } } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "listing-1", status: "INCOMPLETE", agentId: "agent-1" } as any);

    const res = await DELETE(new Request("http://localhost/api/listings/listing-1", { method: "DELETE" }), { params: { id: "listing-1" } });

    expect(res.status).toBe(200);
    expect(prisma.listingFile.delete).toHaveBeenCalledWith({ where: { id: "listing-1" } });
  });

  it("deletes each attached document's R2 object before deleting the listing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "ADMIN", agentId: null } } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "listing-4", status: "INCOMPLETE", agentId: "agent-1" } as any);
    vi.mocked(prisma.fileDocument.findMany).mockResolvedValue([
      { r2Key: "transactions/listing/listing-4/doc-1/a.pdf" },
      { r2Key: "transactions/listing/listing-4/doc-2/b.pdf" },
    ] as any);

    const res = await DELETE(new Request("http://localhost/api/listings/listing-4", { method: "DELETE" }), { params: { id: "listing-4" } });

    expect(res.status).toBe(200);
    expect(deleteR2Object).toHaveBeenCalledTimes(2);
    expect(deleteR2Object).toHaveBeenCalledWith("transactions/listing/listing-4/doc-1/a.pdf");
    expect(deleteR2Object).toHaveBeenCalledWith("transactions/listing/listing-4/doc-2/b.pdf");
    expect(prisma.listingFile.delete).toHaveBeenCalledWith({ where: { id: "listing-4" } });
  });

  it("still deletes the listing even when an R2 delete fails", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "ADMIN", agentId: null } } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "listing-5", status: "INCOMPLETE", agentId: "agent-1" } as any);
    vi.mocked(prisma.fileDocument.findMany).mockResolvedValue([{ r2Key: "bad-key" }] as any);
    vi.mocked(deleteR2Object).mockRejectedValueOnce(new Error("R2 unreachable"));

    const res = await DELETE(new Request("http://localhost/api/listings/listing-5", { method: "DELETE" }), { params: { id: "listing-5" } });

    expect(res.status).toBe(200);
    expect(prisma.listingFile.delete).toHaveBeenCalledWith({ where: { id: "listing-5" } });
  });

  it("also allows deleting a PENDING_TRANSFER listing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "ADMIN", agentId: null } } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "listing-2", status: "PENDING_TRANSFER", agentId: "agent-1" } as any);

    const res = await DELETE(new Request("http://localhost/api/listings/listing-2", { method: "DELETE" }), { params: { id: "listing-2" } });

    expect(res.status).toBe(200);
    expect(prisma.listingFile.delete).toHaveBeenCalledWith({ where: { id: "listing-2" } });
  });

  it("still rejects deleting an ACTIVE listing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "ADMIN", agentId: null } } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "listing-3", status: "ACTIVE", agentId: "agent-1" } as any);

    const res = await DELETE(new Request("http://localhost/api/listings/listing-3", { method: "DELETE" }), { params: { id: "listing-3" } });

    expect(res.status).toBe(400);
    expect(prisma.listingFile.delete).not.toHaveBeenCalled();
  });
});
