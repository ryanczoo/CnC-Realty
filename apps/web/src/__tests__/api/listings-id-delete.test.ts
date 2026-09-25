import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/r2", () => ({ deleteR2Object: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn(), delete: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object } from "@/lib/r2";
import { DELETE } from "../../app/api/listings/[id]/route";

const ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: null } };
const AGENT = { user: { id: "u1", role: "AGENT", agentId: "agent-1" } };
const listing = (over: Record<string, unknown> = {}) => ({
  id: "listing-1", status: "INCOMPLETE", agentId: "agent-1", _count: { documents: 0, convertedFiles: 0 }, ...over,
});
const del = () => DELETE(new Request("http://localhost/api/listings/listing-1", { method: "DELETE" }), { params: { id: "listing-1" } });

// Retention (B&P §10148): a listing is only deletable by the broker, and only
// while it holds no documents and was never converted to a transaction.
describe("DELETE /api/listings/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses an agent, even the listing's own agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing() as any);
    const res = await del();
    expect(res.status).toBe(403);
    expect(prisma.listingFile.delete).not.toHaveBeenCalled();
  });

  it("refuses when the listing still has documents", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing({ _count: { documents: 2, convertedFiles: 0 } }) as any);
    const res = await del();
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Delete this listing's documents first");
    expect(prisma.listingFile.delete).not.toHaveBeenCalled();
  });

  it("refuses when the listing was converted to a transaction", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing({ _count: { documents: 0, convertedFiles: 1 } }) as any);
    const res = await del();
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("This listing was converted to a transaction and can't be deleted");
    expect(prisma.listingFile.delete).not.toHaveBeenCalled();
  });

  it.each(["INCOMPLETE", "PENDING_TRANSFER", "ACTIVE", "WITHDRAWN"])("lets the broker delete an empty %s listing", async (status) => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(listing({ status }) as any);
    const res = await del();
    expect(res.status).toBe(200);
    expect(prisma.listingFile.delete).toHaveBeenCalledWith({ where: { id: "listing-1" } });
    expect(deleteR2Object).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing listing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(null);
    expect((await del()).status).toBe(404);
  });
});
