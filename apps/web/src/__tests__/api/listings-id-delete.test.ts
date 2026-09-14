import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn(), delete: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { DELETE } from "../../app/api/listings/[id]/route";

describe("DELETE /api/listings/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("still allows deleting an INCOMPLETE listing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "ADMIN", agentId: null } } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "listing-1", status: "INCOMPLETE", agentId: "agent-1" } as any);

    const res = await DELETE(new Request("http://localhost/api/listings/listing-1", { method: "DELETE" }), { params: { id: "listing-1" } });

    expect(res.status).toBe(200);
    expect(prisma.listingFile.delete).toHaveBeenCalledWith({ where: { id: "listing-1" } });
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
